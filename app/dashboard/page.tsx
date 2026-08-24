import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

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

  const [{ data: cuentas }, { data: inversiones }, { data: deudas }] = await Promise.all([
    supabase.from("cuentas").select("saldo_actual").eq("activa", true),
    supabase.from("inversiones").select("valor_actual"),
    supabase.from("deudas").select("capital_pendiente"),
  ]);

  const totalCuentas = (cuentas ?? []).reduce((sum, c) => sum + Number(c.saldo_actual ?? 0), 0);
  const totalInversion = (inversiones ?? []).reduce((sum, i) => sum + Number(i.valor_actual ?? 0), 0);
  const totalDeuda = (deudas ?? []).reduce((sum, d) => sum + Number(d.capital_pendiente ?? 0), 0);

  const patrimonio = totalCuentas + totalInversion - (conDeuda ? totalDeuda : 0);

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

        <p className="text-sm text-slate-400">
          Este es el arranque del MVP. Movimientos, categorización, inversión y deuda se irán
          añadiendo módulo a módulo — de momento puedes dar de alta cuentas en{" "}
          <Link href="/cuentas" className="underline">
            Cuentas
          </Link>
          .
        </p>
      </main>
    </>
  );
}
