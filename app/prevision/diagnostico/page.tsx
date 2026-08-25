import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { construirDiagnosticoPrevision, generarMeses, type CategoriaInfo, type MovimientoPrevisto } from "@/lib/prevision";
import { calcularInteresesPrevistos } from "@/lib/intereses";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { TablaDiagnosticoPrevision } from "./TablaDiagnosticoPrevision";

const HORIZONTES = [3, 6, 12];

export default async function DiagnosticoPrevisionPage({
  searchParams,
}: {
  searchParams: { meses?: string };
}) {
  const supabase = createClient();
  const horizonte = HORIZONTES.includes(Number(searchParams.meses)) ? Number(searchParams.meses) : 6;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: previstosRaw }, { data: categoriasRaw }, { data: cuentas }, config] = await Promise.all([
    supabase.from("movimientos_previstos").select("*"),
    supabase.from("categorias").select("id, nombre, categoria_padre_id"),
    supabase.from("cuentas").select("id, saldo_actual, es_remunerada, tipo_interes").eq("activa", true),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const previstos = (previstosRaw ?? []) as unknown as MovimientoPrevisto[];
  const categorias = (categoriasRaw ?? []) as CategoriaInfo[];
  const mesesHorizonte = generarMeses(horizonte);

  const cuentasRemuneradas = (cuentas ?? [])
    .filter((c) => c.es_remunerada && c.tipo_interes !== null)
    .map((c) => ({ id: c.id, saldo_actual: Number(c.saldo_actual), tipo_interes: Number(c.tipo_interes) }));

  const interesesPorMes = calcularInteresesPrevistos(cuentasRemuneradas, previstos, mesesHorizonte);
  const filas = construirDiagnosticoPrevision(previstos, mesesHorizonte, categorias, interesesPorMes);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Diagnóstico de previsión</h1>
          <Link href="/prevision" className="text-sm text-slate-500 hover:text-slate-900">
            ← Ver proyección
          </Link>
        </div>
        <p className="text-sm text-slate-400">
          Herramienta interna: qué está aplicando el motor de previsión, mes a mes y categoría a
          categoría (categorías padre, con sus subcategorías desplegables debajo). Útil para
          detectar huecos, duplicados o importes inesperados. Combina previsiones manuales,
          detectadas y aceptadas, la cuota de deuda y los intereses previstos de cuentas
          remuneradas.
        </p>

        <div className="flex rounded-md border border-slate-300 text-sm w-fit">
          {HORIZONTES.map((h) => (
            <Link
              key={h}
              href={`/prevision/diagnostico?meses=${h}`}
              className={`px-3 py-1.5 ${h === horizonte ? "bg-slate-900 text-white" : "hover:bg-slate-100"} ${
                h === 3 ? "rounded-l-md" : h === 12 ? "rounded-r-md" : ""
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
