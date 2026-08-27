import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { SimuladorAmortizacion } from "../SimuladorAmortizacion";
import { obtenerConfiguracion } from "@/lib/configuracion";

export default async function SimularAmortizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: deuda }, config] = await Promise.all([
    supabase
      .from("deudas")
      .select("nombre, capital_pendiente, cuota, tipo_interes, valor_residual")
      .eq("id", id)
      .single(),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  if (!deuda) notFound();

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <h1 className="font-sora text-[26px] font-bold text-ink">Simular amortización — {deuda.nombre}</h1>
          <Link href={`/deudas/${id}`} className="text-sm font-semibold text-ink-tertiary hover:text-ink">
            ← Volver al detalle
          </Link>
        </div>

        {deuda.tipo_interes === null ? (
          <p className="text-sm text-forecast">
            Esta deuda no tiene tipo de interés asignado, así que no se puede simular.
          </p>
        ) : (
          <SimuladorAmortizacion
            capitalPendiente={Number(deuda.capital_pendiente)}
            tasaAnual={Number(deuda.tipo_interes)}
            cuotaActual={Number(deuda.cuota)}
            valorResidual={Number(deuda.valor_residual ?? 0)}
            moneda={config?.moneda_base ?? "EUR"}
            hoy={hoy}
          />
        )}
      </main>
    </>
  );
}
