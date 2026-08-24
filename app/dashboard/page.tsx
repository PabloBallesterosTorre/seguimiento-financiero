import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { guardarObjetivoAhorro } from "./actions";

function formatEUR(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { sinDeuda?: string };
}) {
  const supabase = createClient();
  const conDeuda = searchParams.sinDeuda !== "1";

  const hoy = new Date();
  const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  const inicioMesSiguienteDate = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  const inicioMesSiguiente = `${inicioMesSiguienteDate.getFullYear()}-${String(
    inicioMesSiguienteDate.getMonth() + 1
  ).padStart(2, "0")}-01`;
  const nombreMesRaw = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(hoy);
  const nombreMes = nombreMesRaw.charAt(0).toUpperCase() + nombreMesRaw.slice(1);

  const [{ data: cuentas }, { data: inversiones }, { data: deudas }, { data: objetivo }, { data: movimientosMes }] =
    await Promise.all([
      supabase.from("cuentas").select("saldo_actual").eq("activa", true),
      supabase.from("inversiones").select("valor_actual"),
      supabase.from("deudas").select("capital_pendiente"),
      supabase.from("objetivos_ahorro").select("importe_objetivo").eq("periodo", inicioMes).maybeSingle(),
      supabase
        .from("movimientos")
        .select("importe, tipo, categorias!categoria_id(es_categoria_inversion)")
        .gte("fecha", inicioMes)
        .lt("fecha", inicioMesSiguiente),
    ]);

  const totalCuentas = (cuentas ?? []).reduce((sum, c) => sum + Number(c.saldo_actual ?? 0), 0);
  const totalInversion = (inversiones ?? []).reduce((sum, i) => sum + Number(i.valor_actual ?? 0), 0);
  const totalDeuda = (deudas ?? []).reduce((sum, d) => sum + Number(d.capital_pendiente ?? 0), 0);

  const patrimonio = totalCuentas + totalInversion - (conDeuda ? totalDeuda : 0);

  type MovimientoMes = {
    importe: number;
    tipo: string;
    categorias: { es_categoria_inversion: boolean } | null;
  };
  const movimientosDelMes = (movimientosMes ?? []) as unknown as MovimientoMes[];

  const ahorroReal = movimientosDelMes.reduce((sum, m) => {
    if (m.tipo === "traspaso") return sum;
    const esAportacionInversion = m.tipo === "gasto" && m.categorias?.es_categoria_inversion === true;
    return esAportacionInversion ? sum : sum + Number(m.importe);
  }, 0);

  const importeObjetivo = objetivo ? Number(objetivo.importe_objetivo) : null;
  const cumplido = importeObjetivo !== null && ahorroReal >= importeObjetivo;
  const porcentaje = importeObjetivo ? Math.min(100, Math.max(0, (ahorroReal / importeObjetivo) * 100)) : 0;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Patrimonio global</h1>
          <div className="flex rounded-md border border-slate-300 text-sm">
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 rounded-l-md ${conDeuda ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
            >
              Con deuda
            </Link>
            <Link
              href="/dashboard?sinDeuda=1"
              className={`px-3 py-1.5 rounded-r-md ${!conDeuda ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
            >
              Sin deuda
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-500">Patrimonio total</p>
          <p className="mt-1 text-3xl font-semibold">{formatEUR(patrimonio)}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Cuentas</p>
            <p className="mt-1 text-lg font-medium">{formatEUR(totalCuentas)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Inversión</p>
            <p className="mt-1 text-lg font-medium">{formatEUR(totalInversion)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Deuda pendiente</p>
            <p className="mt-1 text-lg font-medium">{formatEUR(totalDeuda)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-700">Objetivo de ahorro — {nombreMes}</h2>
            {importeObjetivo !== null && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  cumplido ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {cumplido ? "Cumplido" : "En progreso"}
              </span>
            )}
          </div>

          {importeObjetivo !== null ? (
            <>
              <p className="text-sm text-slate-600">
                Ahorrado: <span className="font-medium text-slate-900">{formatEUR(ahorroReal)}</span> de{" "}
                <span className="font-medium text-slate-900">{formatEUR(importeObjetivo)}</span> objetivo (
                {porcentaje.toFixed(0)}%)
              </p>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${cumplido ? "bg-emerald-500" : "bg-slate-900"}`}
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Todavía no has fijado un objetivo de ahorro para este mes.</p>
          )}

          <form action={guardarObjetivoAhorro} className="flex items-end gap-3">
            <input type="hidden" name="periodo" value={inicioMes} />
            <div>
              <label className="block text-xs text-slate-500">Objetivo mensual</label>
              <input
                name="importe_objetivo"
                type="number"
                step="0.01"
                min="0"
                defaultValue={importeObjetivo ?? undefined}
                required
                className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Guardar objetivo
            </button>
          </form>
        </div>

        <p className="text-sm text-slate-400">
          El ahorro del mes se calcula a partir de los movimientos (los ingresos menos los gastos, sin
          contar como gasto las aportaciones a inversión). Añádelos en{" "}
          <Link href="/movimientos" className="underline">
            Movimientos
          </Link>
          .
        </p>
      </main>
    </>
  );
}
