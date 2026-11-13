import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMonedaTabla as formatMoneda, formatPorcentaje } from "@/lib/formato";
import { estadoHipoteca, etiquetaUso, rendimientoInmueble, revalorizacion, valorTuParte } from "@/lib/inmuebles";
import { crearInmueble } from "./actions";
import { NuevoInmueble } from "./InmuebleForm";
import { inicioVentana, movimientosPorInmueble } from "./datos";

function Kpi({ label, valor, nota, tono }: { label: string; valor: string; nota?: string; tono?: "danger" | "success" }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className={`mt-1.5 font-sora text-xl font-semibold ${tono === "danger" ? "text-danger" : tono === "success" ? "text-success" : "text-ink"}`}>
        {valor}
      </p>
      {nota && <p className="mt-1 text-[11px] text-ink-tertiary">{nota}</p>}
    </div>
  );
}

// Tanda 18: lista de inmuebles con lo que valen (tu parte), lo que se debe de cada uno y lo
// que dejan o cuestan al mes.
export default async function InmueblesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: inmuebles }, { data: deudas }, config] = await Promise.all([
    supabase.from("inmuebles").select("*").order("created_at", { ascending: true }),
    supabase
      .from("deudas")
      .select("id, nombre, categoria_id, capital_inicial, capital_pendiente, cuota, tipo_interes, fecha_fin, valor_residual")
      .order("nombre"),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const moneda = config?.moneda_base ?? "EUR";
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const hoy = new Date().toISOString().slice(0, 10);
  const lista = inmuebles ?? [];
  const deudaPorId = new Map((deudas ?? []).map((d) => [d.id as string, d]));

  const movimientos = await movimientosPorInmueble(
    supabase,
    lista.map((i) => ({ id: i.id, deuda_id: i.deuda_id })),
    (deudas ?? []).map((d) => ({ id: d.id, categoria_id: d.categoria_id })),
    { desde: inicioVentana(hoy) }
  );

  const filas = lista.map((i) => {
    const valor = valorTuParte({ valor_actual: i.valor_actual === null ? null : Number(i.valor_actual), porcentaje_propiedad: Number(i.porcentaje_propiedad) });
    const deuda = i.deuda_id ? deudaPorId.get(i.deuda_id) : undefined;
    const hipoteca = deuda
      ? estadoHipoteca(
          {
            capital_inicial: Number(deuda.capital_inicial),
            capital_pendiente: Number(deuda.capital_pendiente),
            cuota: Number(deuda.cuota),
            tipo_interes: deuda.tipo_interes === null ? null : Number(deuda.tipo_interes),
            fecha_fin: deuda.fecha_fin,
            valor_residual: deuda.valor_residual === null ? null : Number(deuda.valor_residual),
          },
          hoy
        )
      : null;
    const rendimiento = rendimientoInmueble(movimientos.get(i.id) ?? [], valor, hipoteca, hoy);
    const reval = revalorizacion({
      valor_actual: i.valor_actual === null ? null : Number(i.valor_actual),
      porcentaje_propiedad: Number(i.porcentaje_propiedad),
      precio_compra: i.precio_compra === null ? null : Number(i.precio_compra),
      gastos_compra: Number(i.gastos_compra ?? 0),
    });
    return { i, valor, hipoteca, rendimiento, reval, capitalPropio: valor - (hipoteca?.pendiente ?? 0) };
  });

  const totalValor = filas.reduce((s, f) => s + f.valor, 0);
  const totalHipoteca = filas.reduce((s, f) => s + (f.hipoteca?.pendiente ?? 0), 0);
  const totalFlujo = filas.reduce((s, f) => s + f.rendimiento.flujoMensual, 0);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-10">
        <h1 className="font-sora text-[26px] font-bold text-ink">Inmuebles</h1>

        {lista.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi label="Valor (tu parte)" valor={formatEUR(totalValor)} />
            <Kpi label="Hipotecas pendientes" valor={formatEUR(totalHipoteca)} />
            <Kpi
              label="Capital propio"
              valor={formatEUR(totalValor - totalHipoteca)}
              nota="Valor menos hipoteca. Suma en el patrimonio con deuda."
              tono={totalValor - totalHipoteca < 0 ? "danger" : undefined}
            />
            <Kpi
              label="Te dejan al mes"
              valor={`${totalFlujo >= 0 ? "+" : "−"}${formatEUR(Math.abs(totalFlujo))}`}
              nota="Media de los últimos 12 meses, cuotas incluidas."
              tono={totalFlujo < 0 ? "danger" : "success"}
            />
          </div>
        )}

        <NuevoInmueble action={crearInmueble} deudas={(deudas ?? []).map((d) => ({ id: d.id, nombre: d.nombre }))} />

        {lista.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-7 text-sm text-ink-tertiary shadow-card">
            Todavía no hay inmuebles. Da de alta uno con su valor estimado y, si tiene hipoteca, enlázala con tu deuda:
            sumará al patrimonio con deuda y verás cuánto te deja o te cuesta cada mes.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {filas.map(({ i, valor, hipoteca, rendimiento, reval, capitalPropio }) => (
              <Link
                key={i.id}
                href={`/inmuebles/${i.id}`}
                className="block rounded-card border border-border bg-surface p-6 shadow-card transition-colors hover:border-border-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-sora text-base font-semibold text-ink">{i.nombre}</h2>
                    <p className="text-xs text-ink-tertiary">
                      {etiquetaUso(i.uso)}
                      {Number(i.porcentaje_propiedad) < 100 && ` · tu parte ${formatPorcentaje(Number(i.porcentaje_propiedad), { decimales: 0 })}`}
                      {i.ambito === "conjunto" && " · conjunto"}
                    </p>
                  </div>
                  <p className="font-sora text-lg font-semibold text-ink">{i.valor_actual === null ? "Sin valorar" : formatEUR(valor)}</p>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-[13px]">
                  <div>
                    <dt className="text-[11px] text-ink-tertiary">Hipoteca</dt>
                    <dd className="font-semibold text-ink">{hipoteca ? formatEUR(hipoteca.pendiente) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-ink-tertiary">Capital propio</dt>
                    <dd className={`font-semibold ${capitalPropio < 0 ? "text-danger" : "text-ink"}`}>{formatEUR(capitalPropio)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-ink-tertiary">Al mes</dt>
                    <dd className={`font-semibold ${rendimiento.mesesConDatos === 0 ? "text-ink-tertiary" : rendimiento.flujoMensual < 0 ? "text-danger" : "text-success"}`}>
                      {rendimiento.mesesConDatos === 0
                        ? "Sin movimientos"
                        : `${rendimiento.flujoMensual >= 0 ? "+" : "−"}${formatEUR(Math.abs(rendimiento.flujoMensual))}`}
                    </dd>
                  </div>
                </dl>
                {reval && (
                  <p className="mt-3 text-[11px] text-ink-tertiary">
                    {reval.abs >= 0 ? "Revalorización" : "Pérdida de valor"} desde la compra: {reval.abs >= 0 ? "+" : "−"}
                    {formatEUR(Math.abs(reval.abs))}
                    {reval.pct !== null && ` (${formatPorcentaje(reval.pct)})`}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
