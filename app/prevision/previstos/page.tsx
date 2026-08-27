import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import {
  actualizarMovimientoPrevisto,
  cambiarEstadoPrevisto,
  crearMovimientoPrevisto,
  eliminarMovimientoPrevisto,
} from "../actions";
import { NuevoPrevisto } from "./NuevoPrevisto";
import { importeEfectivoPrevisto, categoriaEfectivaId, mapaCategoriaPorPrevistoMasReciente } from "@/lib/prevision";
import { mapaMediaPorCategoria, type MovimientoHistorico } from "@/lib/deteccionPatrones";
import { ordenarCategoriasJerarquia } from "@/lib/categorias";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { obtenerOrdenTabla } from "@/lib/ordenTabla";
import { PrevistosClient, type FilaPrevisto } from "./PrevistosClient";

export default async function PrevistosPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const desde = new Date();
  desde.setFullYear(desde.getFullYear() - 3);

  const [{ data: previstos }, { data: categorias }, { data: cuentas }, { data: historicoRaw }, config, ordenInicial] =
    await Promise.all([
      supabase.from("movimientos_previstos").select("*").order("created_at", { ascending: false }),
      supabase.from("categorias").select("id, nombre, categoria_padre_id").order("nombre"),
      supabase.from("cuentas").select("id, nombre, banco_nombre").eq("activa", true).order("nombre"),
      supabase
        .from("movimientos")
        .select("descripcion, categoria_id, tipo, importe, fecha")
        .in("tipo", ["ingreso", "gasto"])
        .gte("fecha", desde.toISOString().slice(0, 10)),
      user ? obtenerConfiguracion(supabase, user.id) : null,
      user ? obtenerOrdenTabla(supabase, user.id, "movimientos_previstos") : null,
    ]);

  const moneda = config?.moneda_base ?? "EUR";
  const categoriaPadreId = new Map((categorias ?? []).map((c) => [c.id, c.categoria_padre_id as string | null]));
  const categoriaEfectiva = (id: string) => categoriaPadreId.get(id) ?? id;
  const historico = (historicoRaw ?? []) as MovimientoHistorico[];
  const mediaPorCategoria = mapaMediaPorCategoria(historico, categoriaEfectiva);

  const { data: conciliaciones } = await supabase
    .from("previsto_conciliaciones")
    .select("previsto_id, periodo, movimiento_real_id");

  const idsMovimientosReales = (conciliaciones ?? []).map((c) => c.movimiento_real_id);
  const { data: movimientosReales } =
    idsMovimientosReales.length > 0
      ? await supabase.from("movimientos").select("id, categoria_id").in("id", idsMovimientosReales)
      : { data: [] as { id: string; categoria_id: string | null }[] };

  const categoriaPorMovimientoReal = new Map((movimientosReales ?? []).map((m) => [m.id, m.categoria_id]));
  const categoriaPorPrevisto = mapaCategoriaPorPrevistoMasReciente(conciliaciones ?? [], categoriaPorMovimientoReal);
  const nombrePorCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nombre]));

  function categoriaMostrada(p: { id: string; categoria_id: string | null }) {
    const categoriaId = categoriaEfectivaId(p, categoriaPorPrevisto);
    return categoriaId ? nombrePorCategoria.get(categoriaId) ?? "—" : "—";
  }

  const categoriasOrdenadas = ordenarCategoriasJerarquia(categorias ?? []);
  const hoy = new Date().toISOString().slice(0, 10);

  const filas: FilaPrevisto[] = (previstos ?? []).map((p) => ({
    id: p.id,
    descripcion: p.descripcion,
    tipo: p.tipo,
    categoriaNombre: categoriaMostrada(p),
    categoria_id: p.categoria_id,
    cuenta_id: p.cuenta_id,
    importe: importeEfectivoPrevisto(p, mediaPorCategoria),
    importe_estimado: Number(p.importe_estimado),
    importe_min: p.importe_min !== null ? Number(p.importe_min) : null,
    importe_max: p.importe_max !== null ? Number(p.importe_max) : null,
    recurrenciaLabel: p.tipo_recurrencia === "unica_vez" ? "Única vez" : `Recurrente (${p.periodicidad})`,
    tipo_recurrencia: p.tipo_recurrencia,
    periodicidad: p.periodicidad,
    fecha: p.fecha,
    fecha_inicio: p.fecha_inicio,
    fecha_fin: p.fecha_fin,
    estado: p.estado,
    esMedia: p.origen_calculo === "media_categoria",
  }));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <h1 className="font-sora text-[26px] font-bold text-ink">Movimientos previstos</h1>
          <div className="flex items-center gap-4">
            <Link href="/prevision/sugerencias" className="text-[13px] font-semibold text-accent hover:underline">
              Ver sugerencias →
            </Link>
            <Link href="/prevision" className="text-[13px] font-semibold text-accent hover:underline">
              ← Ver proyección
            </Link>
          </div>
        </div>

        <NuevoPrevisto
          action={crearMovimientoPrevisto}
          categorias={categoriasOrdenadas}
          cuentas={cuentas ?? []}
          hoy={hoy}
        />

        <PrevistosClient
          filas={filas}
          moneda={moneda}
          categorias={categoriasOrdenadas}
          cuentas={cuentas ?? []}
          hoy={hoy}
          cambiarEstadoPrevisto={cambiarEstadoPrevisto}
          actualizarMovimientoPrevisto={actualizarMovimientoPrevisto}
          eliminarMovimientoPrevisto={eliminarMovimientoPrevisto}
          ordenInicial={ordenInicial}
        />

        <p className="text-[13px] text-ink-tertiary">
          Da de alta previsiones a mano solo para: gastos/ingresos nuevos sin histórico todavía (una
          suscripción recién contratada), ítems puntuales que ya sabes que van a pasar (una paga extra
          concreta), o mientras no tengas suficiente histórico importado para que la detección automática
          (
          <Link href="/prevision/sugerencias" className="font-semibold text-accent hover:underline">
            Sugerencias
          </Link>
          ) lo identifique sola. Para gastos recurrentes con histórico ya importado (hipoteca, nómina,
          seguros), deja que el motor de patrones lo proponga — evita duplicar la previsión a mano y con el
          motor.
        </p>
      </main>
    </>
  );
}
