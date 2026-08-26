import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { cambiarEstadoPrevisto, crearMovimientoPrevisto, eliminarMovimientoPrevisto } from "../actions";
import { NuevoPrevisto } from "./NuevoPrevisto";
import { importeEfectivoPrevisto, categoriaEfectivaId } from "@/lib/prevision";
import { mapaMediaPorCategoria, type MovimientoHistorico } from "@/lib/deteccionPatrones";
import { ordenarCategoriasJerarquia } from "@/lib/categorias";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { obtenerOrdenTabla } from "@/lib/ordenTabla";
import { formatMoneda } from "@/lib/formato";
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

  const formatEUR = (v: number) => formatMoneda(v, config?.moneda_base ?? "EUR");
  const categoriaPadreId = new Map((categorias ?? []).map((c) => [c.id, c.categoria_padre_id as string | null]));
  const categoriaEfectiva = (id: string) => categoriaPadreId.get(id) ?? id;
  const historico = (historicoRaw ?? []) as MovimientoHistorico[];
  const mediaPorCategoria = mapaMediaPorCategoria(historico, categoriaEfectiva);

  const idsMovimientosReales = (previstos ?? [])
    .map((p) => p.movimiento_real_id)
    .filter((id): id is string => Boolean(id));

  const { data: movimientosReales } =
    idsMovimientosReales.length > 0
      ? await supabase.from("movimientos").select("id, categoria_id").in("id", idsMovimientosReales)
      : { data: [] as { id: string; categoria_id: string | null }[] };

  const categoriaPorMovimientoReal = new Map((movimientosReales ?? []).map((m) => [m.id, m.categoria_id]));
  const nombrePorCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nombre]));

  function categoriaMostrada(p: { categoria_id: string | null; movimiento_real_id: string | null }) {
    const categoriaId = categoriaEfectivaId(p, categoriaPorMovimientoReal);
    return categoriaId ? nombrePorCategoria.get(categoriaId) ?? "—" : "—";
  }

  const categoriasOrdenadas = ordenarCategoriasJerarquia(categorias ?? []);
  const hoy = new Date().toISOString().slice(0, 10);

  const filas: FilaPrevisto[] = (previstos ?? []).map((p) => ({
    id: p.id,
    descripcion: p.descripcion,
    tipo: p.tipo,
    categoriaNombre: categoriaMostrada(p),
    importe: importeEfectivoPrevisto(p, mediaPorCategoria),
    recurrenciaLabel: p.tipo_recurrencia === "unica_vez" ? "Única vez" : `Recurrente (${p.periodicidad})`,
    estado: p.estado,
    esMedia: p.origen_calculo === "media_categoria",
  }));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Movimientos previstos</h1>
          <div className="flex items-center gap-4">
            <Link href="/prevision/sugerencias" className="text-sm text-slate-500 hover:text-slate-900">
              Ver sugerencias →
            </Link>
            <Link href="/prevision" className="text-sm text-slate-500 hover:text-slate-900">
              ← Ver proyección
            </Link>
          </div>
        </div>

        <PrevistosClient
          filas={filas}
          formatEUR={formatEUR}
          cambiarEstadoPrevisto={cambiarEstadoPrevisto}
          eliminarMovimientoPrevisto={eliminarMovimientoPrevisto}
          ordenInicial={ordenInicial}
        />

        <NuevoPrevisto
          action={crearMovimientoPrevisto}
          categorias={categoriasOrdenadas}
          cuentas={cuentas ?? []}
          hoy={hoy}
        />

        <p className="text-sm text-slate-400">
          Da de alta previsiones a mano solo para: gastos/ingresos nuevos sin histórico todavía (una
          suscripción recién contratada), ítems puntuales que ya sabes que van a pasar (una paga extra
          concreta), o mientras no tengas suficiente histórico importado para que la detección automática
          (
          <Link href="/prevision/sugerencias" className="underline">
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
