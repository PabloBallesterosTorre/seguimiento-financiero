import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import {
  actualizarCategoriaMovimiento,
  crearMovimiento,
  crearTraspaso,
  eliminarMovimiento,
  eliminarTraspaso,
  vincularComoTraspaso,
  actualizarProrrateo,
} from "./actions";
import { asignarMovimientoAInversion } from "../inversiones/actions";
import { alternarEtiquetaMovimiento } from "../etiquetas/actions";
import { resumenPorEtiqueta } from "@/lib/etiquetas";
import { formatMoneda } from "@/lib/formato";
import { VistaCalendario } from "./VistaCalendario";

// Lista o calendario. Enlaces y no un estado de cliente: así la vista elegida se puede
// guardar, compartir y volver con el botón Atrás.
function SelectorVista({ vista }: { vista: "lista" | "calendario" }) {
  const clase = (activa: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
      activa ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"
    }`;
  return (
    <div className="flex w-fit rounded-full bg-chip p-1" role="group" aria-label="Vista de movimientos">
      <Link href="/movimientos" className={clase(vista === "lista")} aria-current={vista === "lista" ? "page" : undefined}>
        Lista
      </Link>
      <Link
        href="/movimientos?vista=calendario"
        className={clase(vista === "calendario")}
        aria-current={vista === "calendario" ? "page" : undefined}
      >
        Calendario
      </Link>
    </div>
  );
}
import { NuevoMovimiento } from "./NuevoMovimiento";
import { NuevoTraspaso } from "./NuevoTraspaso";
import { MovimientosTabla, type MovimientoFila } from "./MovimientosTabla";
import { ordenarCategoriasJerarquia } from "@/lib/categorias";
import { sugerirCategoria, type ReglaCategorizacion } from "@/lib/categorizacion";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { traspasoNecesitaCategoria } from "@/lib/informes";
import { obtenerOrdenTabla } from "@/lib/ordenTabla";
import { encontrarCandidatosTraspaso, type CandidatoTraspaso } from "@/lib/traspasos";

type Movimiento = {
  id: string;
  cuenta_id: string | null;
  fecha: string;
  descripcion: string;
  importe: number;
  tipo: string;
  categoria_id: string | null;
  traspaso_grupo_id: string | null;
  tipo_original: string | null;
  cuentas: { nombre: string; banco_nombre: string } | null;
  categorias: { nombre: string } | null;
  movimiento_etiquetas: { etiqueta_id: string }[] | null;
};

const SELECT_MOVIMIENTO = "*, cuentas(nombre, banco_nombre), categorias!categoria_id(nombre), movimiento_etiquetas(etiqueta_id)";

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ etiqueta?: string; vista?: string; mes?: string }>;
}) {
  const { etiqueta: etiquetaParam, vista: vistaParam, mes: mesParam } = await searchParams;
  const supabase = await createClient();

  if (vistaParam === "calendario") {
    const {
      data: { user: usuario },
    } = await supabase.auth.getUser();
    const configuracion = usuario ? await obtenerConfiguracion(supabase, usuario.id) : null;
    const mes = mesParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : new Date().toISOString().slice(0, 7);
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-sora text-[26px] font-bold text-ink">Movimientos</h1>
            <SelectorVista vista="calendario" />
          </div>
          <VistaCalendario mes={mes} moneda={configuracion?.moneda_base ?? "EUR"} />
        </main>
      </>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: movimientos },
    { data: pendientes },
    { data: cuentas },
    { data: categorias },
    { data: reglas },
    { data: inversiones },
    { data: operacionesInversion },
    config,
    ordenSinCategorizar,
    ordenCategorizados,
    { data: etiquetasRaw },
  ] = await Promise.all([
    supabase
      .from("movimientos")
      .select(SELECT_MOVIMIENTO)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    // Los pendientes de categorizar se piden aparte y sin el recorte de 200: son la lista
    // de trabajo de esta pantalla, y con el límite quedaban escondidos justo los que más
    // falta hacía repasar. El 2026-09-21 había 110 sin categorizar y la pantalla mostraba
    // CERO, porque todos eran anteriores al movimiento nº 200 (25/08).
    supabase
      .from("movimientos")
      .select(SELECT_MOVIMIENTO)
      .is("categoria_id", null)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("cuentas").select("id, nombre, banco_nombre, ambito").eq("activa", true).order("nombre"),
    supabase
      .from("categorias")
      .select("id, nombre, categoria_padre_id, es_categoria_inversion")
      .order("nombre"),
    supabase.from("reglas_categorizacion").select("patron_descripcion, categoria_id, veces_usada"),
    supabase.from("inversiones").select("id, nombre").order("nombre"),
    supabase.from("inversion_operaciones").select("movimiento_id, inversion_id").not("movimiento_id", "is", null),
    user ? obtenerConfiguracion(supabase, user.id) : null,
    user ? obtenerOrdenTabla(supabase, user.id, "movimientos_sin_categorizar") : null,
    user ? obtenerOrdenTabla(supabase, user.id, "movimientos") : null,
    supabase.from("etiquetas").select("id, nombre").order("nombre"),
  ]);

  const etiquetas = etiquetasRaw ?? [];
  const etiquetaFiltro = etiquetas.find((e) => e.id === etiquetaParam) ?? null;

  const categoriasOrdenadas = ordenarCategoriasJerarquia(categorias ?? []);
  const hayCuentas = (cuentas ?? []).length > 0;
  const hoy = new Date().toISOString().slice(0, 10);
  const moneda = config?.moneda_base ?? "EUR";
  const reglasCategorizacion = (reglas ?? []) as ReglaCategorizacion[];

  const recientes = (movimientos ?? []) as unknown as Movimiento[];
  const pendientesCrudos = (pendientes ?? []) as unknown as Movimiento[];
  const categorizados = recientes.filter((m) => m.tipo === "traspaso" || m.categoria_id);

  // De los traspasos sin categoría solo son "pendientes" los que de verdad la necesitan:
  // aquellos cuya contrapartida está fuera de informes (ver `traspasoNecesitaCategoria`).
  // Para saberlo hace falta conocer todas las cuentas de cada grupo, y la pata de enfrente
  // puede estar ya categorizada y por tanto fuera de esta consulta.
  const gruposPendientes = Array.from(
    new Set(
      pendientesCrudos
        .filter((m) => m.tipo === "traspaso" && m.traspaso_grupo_id)
        .map((m) => m.traspaso_grupo_id as string)
    )
  );
  const { data: patasDeGrupos } = gruposPendientes.length
    ? await supabase
        .from("movimientos")
        .select("traspaso_grupo_id, cuenta_id")
        .in("traspaso_grupo_id", gruposPendientes)
    : { data: [] as { traspaso_grupo_id: string; cuenta_id: string }[] };

  const cuentasPorGrupo = new Map<string, string[]>();
  for (const pata of patasDeGrupos ?? []) {
    const grupo = pata.traspaso_grupo_id as string;
    cuentasPorGrupo.set(grupo, [...(cuentasPorGrupo.get(grupo) ?? []), pata.cuenta_id as string]);
  }
  const excluidasDeInformes = new Set(config?.cuentas_excluidas_informes ?? []);
  const ambitoPorCuenta = new Map(
    (cuentas ?? []).map((c) => [c.id, ((c as { ambito?: string }).ambito ?? "personal") as string])
  );

  const sinCategorizar = pendientesCrudos.filter((m) => {
    if (m.tipo !== "traspaso") return true;
    if (!m.traspaso_grupo_id || !m.cuenta_id) return false;
    return traspasoNecesitaCategoria(
      m.cuenta_id,
      cuentasPorGrupo.get(m.traspaso_grupo_id) ?? [],
      excluidasDeInformes,
      ambitoPorCuenta
    );
  });

  // Para buscar la pareja de un traspaso hacen falta las dos listas juntas, sin repetir
  // los movimientos que aparecen en ambas.
  const idsRecientes = new Set(recientes.map((m) => m.id));
  const todos = [...recientes, ...sinCategorizar.filter((m) => !idsRecientes.has(m.id))];

  // Vínculo movimiento -> inversión, para ofrecer "¿es una aportación?" solo donde tiene
  // sentido: movimientos de una categoría marcada como inversión que todavía no tienen
  // operación. La categoría efectiva es la del padre cuando es una subcategoría.
  const nombreInversion = new Map((inversiones ?? []).map((i) => [i.id, i.nombre]));
  const inversionPorMovimiento = new Map(
    (operacionesInversion ?? []).map((o) => [o.movimiento_id as string, nombreInversion.get(o.inversion_id) ?? null])
  );
  const categoriaPadreId = new Map((categorias ?? []).map((c) => [c.id, c.categoria_padre_id as string | null]));
  const categoriaEsInversion = new Map(
    (categorias ?? []).map((c) => [c.id, (c as { es_categoria_inversion?: boolean }).es_categoria_inversion === true])
  );
  const esCategoriaInversion = (categoriaId: string | null) => {
    if (!categoriaId) return false;
    const efectiva = categoriaPadreId.get(categoriaId) ?? categoriaId;
    return categoriaEsInversion.get(efectiva) === true || categoriaEsInversion.get(categoriaId) === true;
  };

  const datosInversion = (m: Movimiento) => ({
    esAporteInversion: m.tipo !== "traspaso" && esCategoriaInversion(m.categoria_id),
    inversionAsignada: inversionPorMovimiento.get(m.id) ?? null,
  });

  const candidatosPorMovimiento = new Map<string, CandidatoTraspaso[]>(
    todos.filter((m) => m.tipo !== "traspaso").map((m) => [m.id, encontrarCandidatosTraspaso(m, todos)])
  );

  const idsEtiquetas = (m: Movimiento) => (m.movimiento_etiquetas ?? []).map((me) => me.etiqueta_id);

  const filasSinCategorizar: MovimientoFila[] = sinCategorizar.map((m) => ({
    ...m,
    etiquetaIds: idsEtiquetas(m),
    sugeridaId: sugerirCategoria(m.descripcion, reglasCategorizacion),
    candidatosTraspaso: candidatosPorMovimiento.get(m.id) ?? [],
    ...datosInversion(m),
  }));

  const filasCategorizados: MovimientoFila[] = categorizados.map((m) => ({
    ...m,
    etiquetaIds: idsEtiquetas(m),
    candidatosTraspaso: candidatosPorMovimiento.get(m.id) ?? [],
    ...datosInversion(m),
  }));

  // ---- Filtro por etiqueta (tanda 15) ----
  // Con una etiqueta elegida la pantalla responde a "¿cuánto me costó esto?": todos sus
  // movimientos, sin el recorte de 200 de la vista normal, con el total arriba.
  let filasEtiqueta: MovimientoFila[] = [];
  let resumenEtiqueta: ReturnType<typeof resumenPorEtiqueta>[number] | null = null;
  if (etiquetaFiltro) {
    // La unión se embebe dos veces: `filtro` (inner) se queda solo con los movimientos que
    // llevan esta etiqueta, y `movimiento_etiquetas` sigue trayendo TODAS las suyas para
    // pintarlas. Así no hace falta pasar una lista de ids por la URL, que con un viaje largo
    // se salía del límite de longitud.
    const { data: delFiltro } = await supabase
      .from("movimientos")
      .select(`${SELECT_MOVIMIENTO}, filtro:movimiento_etiquetas!inner(etiqueta_id)`)
      .eq("filtro.etiqueta_id", etiquetaFiltro.id)
      .order("fecha", { ascending: false })
      .throwOnError();
    const movimientosFiltro = (delFiltro ?? []) as unknown as Movimiento[];
    filasEtiqueta = movimientosFiltro.map((m) => ({
      ...m,
      etiquetaIds: idsEtiquetas(m),
      candidatosTraspaso: [],
      ...datosInversion(m),
    }));
    resumenEtiqueta = resumenPorEtiqueta(
      movimientosFiltro.map((m) => ({
        importe: Number(m.importe),
        tipo: m.tipo,
        fecha: m.fecha,
        etiquetaIds: idsEtiquetas(m),
      })),
      [etiquetaFiltro.id]
    )[0];
  }

  const propsTabla = {
    categoriasOrdenadas,
    moneda,
    inversiones: inversiones ?? [],
    etiquetas,
    alternarEtiqueta: alternarEtiquetaMovimiento,
    actualizarProrrateo,
    actualizarCategoriaMovimiento,
    vincularComoTraspaso,
    eliminarTraspaso,
    eliminarMovimiento,
    asignarMovimientoAInversion,
  };
  const formatEUR = (v: number) => formatMoneda(v, moneda);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-sora text-[26px] font-bold text-ink">Movimientos</h1>
            <SelectorVista vista="lista" />
          </div>
          {/* Las tres acciones juntas y en una sola línea: antes "Nuevo traspaso" e
              "Importar CSV" iban arriba a la derecha y "+ Nuevo movimiento" debajo a la
              izquierda en negro, así que no se leía cuál era la principal. */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/movimientos/importar"
              className="rounded-btn border border-border-strong bg-surface px-[18px] py-2.5 text-sm font-semibold text-ink-secondary hover:bg-chip"
            >
              Importar CSV
            </Link>
            <NuevoTraspaso cuentas={cuentas ?? []} categorias={categoriasOrdenadas} action={crearTraspaso} hoy={hoy} />
            {hayCuentas && (
              <NuevoMovimiento
                action={crearMovimiento}
                cuentas={cuentas ?? []}
                categorias={categoriasOrdenadas}
                reglas={reglasCategorizacion}
                hoy={hoy}
              />
            )}
          </div>
        </div>

        {!hayCuentas && (
          <p className="text-sm text-ink-tertiary">
            Antes de añadir movimientos, da de alta una cuenta en la sección Cuentas.
          </p>
        )}

        {/* Sin ninguna etiqueta creada no habría nada en esta pantalla que dijera que existen:
            la sección para crearlas vive al final de Categorías. */}
        {etiquetas.length === 0 && (
          <p className="text-[13px] text-ink-tertiary">
            Etiquetas: todavía no tienes ninguna. Sirven para juntar los gastos de un viaje, una reforma o el coche.{" "}
            <Link href="/categorias#etiquetas" className="font-semibold text-accent hover:underline">
              Crear la primera
            </Link>
          </p>
        )}

        {etiquetas.length > 0 && (
          <nav aria-label="Filtrar por etiqueta" className="flex flex-wrap items-center gap-1.5 text-[13px]">
            <span className="mr-1 text-ink-tertiary">Etiquetas:</span>
            {etiquetas.map((e) => (
              <Link
                key={e.id}
                href={etiquetaFiltro?.id === e.id ? "/movimientos" : `/movimientos?etiqueta=${e.id}`}
                className={`rounded-full px-2.5 py-1 font-semibold ${
                  etiquetaFiltro?.id === e.id ? "bg-ink text-white" : "bg-chip text-ink-secondary hover:bg-border"
                }`}
              >
                #{e.nombre}
              </Link>
            ))}
            <Link href="/categorias#etiquetas" className="ml-1 font-semibold text-accent hover:underline">
              Gestionar
            </Link>
          </nav>
        )}

        {etiquetaFiltro && resumenEtiqueta ? (
          <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-4">
              <div>
                <h2 className="font-sora text-base font-semibold text-ink">#{etiquetaFiltro.nombre}</h2>
                <p className="text-[13px] text-ink-tertiary">
                  {filasEtiqueta.length} {filasEtiqueta.length === 1 ? "movimiento" : "movimientos"}
                  {filasEtiqueta.length > resumenEtiqueta.movimientos &&
                    ` (los traspasos no suman al total)`}
                  {resumenEtiqueta.primeraFecha &&
                    resumenEtiqueta.ultimaFecha &&
                    ` · del ${resumenEtiqueta.primeraFecha.split("-").reverse().join("/")} al ${resumenEtiqueta.ultimaFecha
                      .split("-")
                      .reverse()
                      .join("/")}`}
                  {" · "}
                  <Link href="/movimientos" className="font-semibold text-accent hover:underline">
                    Quitar filtro
                  </Link>
                </p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-xs text-ink-secondary">Gastado</p>
                  <p className="font-sora text-lg font-semibold tabular-nums text-ink">
                    {formatEUR(resumenEtiqueta.gastos)}
                  </p>
                </div>
                {resumenEtiqueta.ingresos > 0 && (
                  <div>
                    <p className="text-xs text-ink-secondary">Ingresado</p>
                    <p className="font-sora text-lg font-semibold tabular-nums text-success">
                      {formatEUR(resumenEtiqueta.ingresos)}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <MovimientosTabla
              tablaKey="movimientos_etiqueta"
              movimientos={filasEtiqueta}
              ordenInicial={null}
              mensajeVacio="Ningún movimiento lleva esta etiqueta todavía."
              {...propsTabla}
            />
          </div>
        ) : (
          <>
            {filasSinCategorizar.length > 0 && (
              <div className="overflow-hidden rounded-card border border-forecast/30 bg-surface shadow-card">
                <div className="border-b border-forecast/20 bg-forecast/10 px-4 py-3">
                  <h2 className="text-[13px] font-semibold text-forecast">
                    Sin categorizar ({filasSinCategorizar.length})
                  </h2>
                </div>
                <MovimientosTabla
                  tablaKey="movimientos_sin_categorizar"
                  movimientos={filasSinCategorizar}
                  ordenInicial={ordenSinCategorizar}
                  {...propsTabla}
                />
              </div>
            )}

            <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-[13px] font-semibold text-ink-secondary">
                  Categorizados ({filasCategorizados.length})
                </h2>
              </div>
              <MovimientosTabla
                tablaKey="movimientos"
                movimientos={filasCategorizados}
                ordenInicial={ordenCategorizados}
                mensajeVacio="Todavía no hay movimientos categorizados."
                {...propsTabla}
              />
            </div>
          </>
        )}
      </main>
    </>
  );
}
