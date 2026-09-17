import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { crearInversion, editarInversion, registrarValoracionInversion, eliminarInversion } from "./actions";
import { NuevaInversion } from "./NuevaInversion";
import { InversionesClient, type InversionEnListado } from "./InversionesClient";
import { ResumenCartera } from "./ResumenCartera";
import { EvolucionCarteraChart } from "./EvolucionCarteraChart";
import { RepartoPorTipo } from "./RepartoPorTipo";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { cardClass } from "@/components/formStyles";
import {
  calcularPosicion,
  construirSerieCartera,
  flujosParaTIR,
  mesesEntre,
  tirAnualizada,
  type OperacionInversion,
} from "@/lib/inversiones";
import type { PrevistoInversionOption, CuentaOption } from "./InversionForm";

export default async function InversionesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: inversiones },
    { data: operacionesRaw },
    { data: valoracionesRaw },
    { data: categorias },
    { data: previstosRaw },
    { data: cuentasRaw },
    config,
  ] = await Promise.all([
    supabase.from("inversiones").select("*").order("created_at", { ascending: true }),
    supabase
      .from("inversion_operaciones")
      .select("inversion_id, fecha, tipo, importe, participaciones, precio, comision")
      .order("fecha", { ascending: true }),
    supabase.from("inversion_valoraciones").select("inversion_id, fecha, valor").order("fecha", { ascending: true }),
    supabase.from("categorias").select("id, categoria_padre_id, es_categoria_inversion"),
    supabase
      .from("movimientos_previstos")
      .select("id, descripcion, importe_estimado, tipo, categoria_id, tipo_recurrencia")
      .eq("tipo", "gasto")
      .eq("tipo_recurrencia", "recurrente"),
    supabase.from("cuentas").select("id, nombre, banco_nombre").order("banco_nombre"),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const moneda = config?.moneda_base ?? "EUR";
  const hoy = new Date().toISOString().slice(0, 10);

  // ---- Operaciones agrupadas por inversión ----
  const operaciones: (OperacionInversion & { inversionId: string; comision: number })[] = (operacionesRaw ?? []).map((o) => ({
    inversionId: o.inversion_id,
    fecha: o.fecha,
    tipo: o.tipo,
    importe: Number(o.importe),
    participaciones: o.participaciones !== null ? Number(o.participaciones) : null,
    precio: o.precio !== null ? Number(o.precio) : null,
    comision: Number(o.comision ?? 0),
  }));

  const operacionesPorInversion = new Map<string, OperacionInversion[]>();
  for (const op of operaciones) {
    if (!operacionesPorInversion.has(op.inversionId)) operacionesPorInversion.set(op.inversionId, []);
    operacionesPorInversion.get(op.inversionId)!.push(op);
  }

  const valorTotal = (inversiones ?? []).reduce((suma, i) => suma + Number(i.valor_actual ?? 0), 0);

  const posiciones: InversionEnListado[] = (inversiones ?? []).map((i) => {
    const ops = operacionesPorInversion.get(i.id) ?? [];
    const valorMercado = Number(i.valor_actual);
    const posicion = calcularPosicion(ops, valorMercado);

    return {
      id: i.id,
      tipo_activo: i.tipo_activo,
      nombre: i.nombre,
      isin: i.isin,
      cuenta_id: i.cuenta_id,
      valor_actual: valorMercado,
      fecha_actualizacion: i.fecha_actualizacion,
      es_recurrente: i.es_recurrente,
      movimiento_previsto_id: i.movimiento_previsto_id,
      rentabilidad_anual_asumida:
        i.rentabilidad_anual_asumida !== null ? Number(i.rentabilidad_anual_asumida) : null,
      participaciones: posicion.participaciones,
      aportadoNeto: posicion.aportadoNeto,
      precioMedioCompra: posicion.precioMedioCompra,
      ganancia: posicion.ganancia,
      rentabilidadSimple: posicion.rentabilidadSimple,
      peso: valorTotal > 0 ? (valorMercado / valorTotal) * 100 : 0,
      operaciones: ops.length,
    };
  });

  // ---- Agregados de la cartera ----
  // El aportado del conjunto se suma de las operaciones, no de los campos cacheados, para
  // que sea siempre coherente con lo que se muestra posición a posición.
  const aportadoTotal = operaciones.reduce((suma, o) => suma + o.importe, 0);
  const gananciaTotal = valorTotal - aportadoTotal;
  const rentabilidadSimpleTotal = aportadoTotal > 0 ? (gananciaTotal / aportadoTotal) * 100 : null;
  const tirTotal = tirAnualizada(flujosParaTIR(operaciones, valorTotal, hoy));
  // Las comisiones ya están dentro del aportado (son dinero que sale y no vuelve), pero se
  // suman aparte para poder decir cuánto de lo aportado se ha ido en comisiones.
  const comisionesTotales = operaciones.reduce((suma, o) => suma + o.comision, 0);

  const primeraOperacion = operaciones[0]?.fecha ?? null;
  const serieCartera = primeraOperacion
    ? construirSerieCartera(
        (valoracionesRaw ?? []).map((v) => ({
          inversionId: v.inversion_id,
          fecha: v.fecha,
          valor: Number(v.valor),
        })),
        operaciones,
        mesesEntre(primeraOperacion, hoy)
      )
    : [];

  const repartoPorTipo = [...
    (inversiones ?? []).reduce((mapa, i) => {
      const clave = i.tipo_activo;
      mapa.set(clave, (mapa.get(clave) ?? 0) + Number(i.valor_actual ?? 0));
      return mapa;
    }, new Map<string, number>())
  ]
    .map(([tipo, valor]) => ({ tipo, valor }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  // ---- Datos auxiliares de los formularios ----
  const categoriaPadreId = new Map((categorias ?? []).map((c) => [c.id, c.categoria_padre_id as string | null]));
  const categoriaEsInversion = new Map((categorias ?? []).map((c) => [c.id, c.es_categoria_inversion === true]));
  const esCategoriaInversion = (categoriaId: string | null) => {
    if (!categoriaId) return false;
    const efectiva = categoriaPadreId.get(categoriaId) ?? categoriaId;
    return categoriaEsInversion.get(efectiva) === true || categoriaEsInversion.get(categoriaId) === true;
  };

  const previstosInversion: PrevistoInversionOption[] = (previstosRaw ?? [])
    .filter((p) => esCategoriaInversion(p.categoria_id))
    .map((p) => ({ id: p.id, descripcion: p.descripcion, importe_estimado: Number(p.importe_estimado) }));

  const cuentas: CuentaOption[] = (cuentasRaw ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    banco_nombre: c.banco_nombre,
  }));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-sora text-[26px] font-bold text-ink">Inversión</h1>
          <NuevaInversion action={crearInversion} previstosInversion={previstosInversion} cuentas={cuentas} />
        </div>

        <ResumenCartera
          valor={valorTotal}
          aportado={aportadoTotal}
          ganancia={gananciaTotal}
          rentabilidadSimple={rentabilidadSimpleTotal}
          tir={tirTotal}
          comisiones={comisionesTotales}
          moneda={moneda}
        />

        {serieCartera.length > 0 && (
          <div className={`${cardClass} space-y-4`}>
            <h2 className="font-sora text-base font-semibold text-ink">Valor frente a lo aportado</h2>
            <EvolucionCarteraChart puntos={serieCartera} moneda={moneda} />
          </div>
        )}

        <InversionesClient
          inversiones={posiciones}
          moneda={moneda}
          previstosInversion={previstosInversion}
          cuentas={cuentas}
          registrarValoracionInversion={registrarValoracionInversion}
          editarInversion={editarInversion}
          eliminarInversion={eliminarInversion}
        />

        {repartoPorTipo.length > 0 && (
          <div className={`${cardClass} space-y-4`}>
            <h2 className="font-sora text-base font-semibold text-ink">Reparto por tipo de activo</h2>
            <RepartoPorTipo reparto={repartoPorTipo} total={valorTotal} moneda={moneda} />
          </div>
        )}

        <div className={cardClass}>
          <p className="text-[13px] text-ink-tertiary">
            Las posiciones con ISIN se alimentan solas al importar el extracto: cada compra y cada venta quedan
            registradas con sus participaciones, y el precio de esa operación revaloriza la posición entera a esa
            fecha. Entre dos operaciones no hay dato de mercado real —la sincronización automática con
            bróker/exchange sigue siendo una mejora de fase 2—, así que la línea del detalle de cada inversión es
            una <span className="font-semibold text-ink">estimación</span> entre puntos reales.
          </p>
        </div>
      </main>
    </>
  );
}
