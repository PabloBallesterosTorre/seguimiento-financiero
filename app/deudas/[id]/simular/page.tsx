import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { SimuladorAmortizacion } from "../SimuladorAmortizacion";

export default async function SimularAmortizacionPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: deuda } = await supabase
    .from("deudas")
    .select("nombre, capital_pendiente, cuota, tipo_interes, valor_residual")
    .eq("id", params.id)
    .single();

  if (!deuda) notFound();

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Simular amortización — {deuda.nombre}</h1>
          <Link href={`/deudas/${params.id}`} className="text-sm text-slate-500 hover:text-slate-900">
            ← Volver al detalle
          </Link>
        </div>

        {deuda.tipo_interes === null ? (
          <p className="text-sm text-amber-600">
            Esta deuda no tiene tipo de interés asignado, así que no se puede simular.
          </p>
        ) : (
          <SimuladorAmortizacion
            capitalPendiente={Number(deuda.capital_pendiente)}
            tasaAnual={Number(deuda.tipo_interes)}
            cuotaActual={Number(deuda.cuota)}
            valorResidual={Number(deuda.valor_residual ?? 0)}
          />
        )}
      </main>
    </>
  );
}
