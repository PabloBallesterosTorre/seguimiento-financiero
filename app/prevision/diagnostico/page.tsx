import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { construirDiagnosticoPrevision, generarMeses, type CategoriaInfo, type MovimientoPrevisto } from "@/lib/prevision";
import { calcularInteresesPrevistos } from "@/lib/intereses";
import { mapaMediaPorCategoria, type MovimientoHistorico } from "@/lib/deteccionPatrones";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { TablaDiagnosticoPrevision } from "./TablaDiagnosticoPrevision";

const HORIZONTES = [3, 6, 12];

export default async function DiagnosticoPrevisionPage({
  searchParams,
}: {
  searchParams: Promise<{ meses?: string }>;
}) {
  const { meses } = await searchParams;
  const supabase = await createClient();
  const horizonte = HORIZONTES.includes(Number(meses)) ? Number(meses) : 6;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const desde = new Date();
  desde.setFullYear(desde.getFullYear() - 3);

  const [{ data: previstosRaw }, { data: categoriasRaw }, { data: cuentas }, { data: historicoRaw }, config] =
    await Promise.all([
      supabase.from("movimientos_previstos").select("*"),
      supabase.from("categorias").select("id, nombre, categoria_padre_id"),
      supabase.from("cuentas").select("id, saldo_actual, es_remunerada, tipo_interes").eq("activa", true),
      supabase
        .from("movimientos")
        .select("descripcion, categoria_id, tipo, importe, fecha")
        .in("tipo", ["ingreso", "gasto"])
        .gte("fecha", desde.toISOString().slice(0, 10)),
      user ? obtenerConfiguracion(supabase, user.id) : null,
    ]);

  const previstos = (previstosRaw ?? []) as unknown as MovimientoPrevisto[];
  const categorias = (categoriasRaw ?? []) as CategoriaInfo[];
  const mesesHorizonte = generarMeses(horizonte);

  const cuentasRemuneradas = (cuentas ?? [])
    .filter((c) => c.es_remunerada && c.tipo_interes !== null)
    .map((c) => ({ id: c.id, saldo_actual: Number(c.saldo_actual), tipo_interes: Number(c.tipo_interes) }));

  const categoriaPadreId = new Map(categorias.map((c) => [c.id, c.categoria_padre_id]));
  const categoriaEfectiva = (id: string) => categoriaPadreId.get(id) ?? id;
  const historico = (historicoRaw ?? []) as MovimientoHistorico[];
  const mediaPorCategoria = mapaMediaPorCategoria(historico, categoriaEfectiva);

  const interesesPorMes = calcularInteresesPrevistos(cuentasRemuneradas, previstos, mesesHorizonte, mediaPorCategoria);
  const filas = construirDiagnosticoPrevision(previstos, mesesHorizonte, categorias, interesesPorMes, mediaPorCategoria);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl space-y-5 px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <h1 className="font-sora text-[26px] font-bold text-ink">Diagnóstico de previsión</h1>
          <Link href="/prevision" className="text-[13px] font-semibold text-accent hover:underline">
            ← Ver proyección
          </Link>
        </div>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-secondary">
          Herramienta interna: qué está aplicando el motor de previsión, mes a mes y categoría a
          categoría (categorías padre, con sus subcategorías desplegables debajo). Útil para
          detectar huecos, duplicados o importes inesperados. Combina previsiones manuales,
          detectadas y aceptadas, la cuota de deuda y los intereses previstos de cuentas
          remuneradas. Los importes marcados con <span className="italic">≈</span> son media
          variable (nivel 2, recalculada con el histórico más reciente); el resto son ítems fijos
          (nivel 1: manual, patrón con importe estable, o deuda).
        </p>

        <div className="flex w-fit rounded-full bg-chip p-1">
          {HORIZONTES.map((h) => (
            <Link
              key={h}
              href={`/prevision/diagnostico?meses=${h}`}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                h === horizonte ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"
              }`}
            >
              {h} meses
            </Link>
          ))}
        </div>

        <TablaDiagnosticoPrevision
          filas={filas}
          mesesLabel={mesesHorizonte.map((m) => m.label)}
          moneda={config?.moneda_base ?? "EUR"}
        />
      </main>
    </>
  );
}
