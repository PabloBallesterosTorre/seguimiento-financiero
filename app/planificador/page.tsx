import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { generarMeses, type MovimientoPrevisto } from "@/lib/prevision";
import { calcularInteresesPrevistos } from "@/lib/intereses";
import { construirProyeccionPatrimonio, agruparPorAnio, type DeudaParaProyeccion } from "@/lib/planificador";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMoneda } from "@/lib/formato";

const HORIZONTES_MESES = [3, 6, 12];
const HORIZONTES_ANIOS = [5, 10, 20];

export default async function PlanificadorPage({
  searchParams,
}: {
  searchParams: { vista?: string; horizonte?: string };
}) {
  const supabase = createClient();
  const vista = searchParams.vista === "anual" ? "anual" : "mensual";
  const horizonteElegido =
    vista === "mensual"
      ? HORIZONTES_MESES.includes(Number(searchParams.horizonte)) ? Number(searchParams.horizonte) : 12
      : HORIZONTES_ANIOS.includes(Number(searchParams.horizonte)) ? Number(searchParams.horizonte) : 10;
  const horizonteMeses = vista === "mensual" ? horizonteElegido : horizonteElegido * 12;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hoy = new Date().toISOString().slice(0, 10);

  const [
    { data: cuentas },
    { data: inversiones },
    { data: deudasRaw },
    { data: amortizacionesRaw },
    { data: previstosRaw },
    { data: categorias },
    config,
  ] = await Promise.all([
    supabase.from("cuentas").select("id, saldo_actual, es_remunerada, tipo_interes").eq("activa", true),
    supabase.from("inversiones").select("valor_actual"),
    supabase.from("deudas").select("id, capital_pendiente, cuota, tipo_interes, valor_residual"),
    supabase
      .from("amortizaciones_extra")
      .select("deuda_id, fecha, importe, tipo_reduccion")
      .eq("aplicado", false)
      .gt("fecha", hoy),
    supabase.from("movimientos_previstos").select("*"),
    supabase.from("categorias").select("id, es_categoria_inversion"),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const moneda = config?.moneda_base ?? "EUR";
  const formatEUR = (v: number) => formatMoneda(v, moneda);

  const saldoLiquidoInicial = (cuentas ?? []).reduce((sum, c) => sum + Number(c.saldo_actual ?? 0), 0);
  const valorInversionInicial = (inversiones ?? []).reduce((sum, i) => sum + Number(i.valor_actual ?? 0), 0);
  const deudaActual = (deudasRaw ?? []).reduce((sum, d) => sum + Number(d.capital_pendiente ?? 0), 0);

  const deudas: DeudaParaProyeccion[] = (deudasRaw ?? []).map((d) => ({
    id: d.id,
    capital_pendiente: Number(d.capital_pendiente),
    cuota: Number(d.cuota),
    tipo_interes: d.tipo_interes === null ? null : Number(d.tipo_interes),
    valor_residual: Number(d.valor_residual ?? 0),
  }));

  const amortizacionesProgramadas = (amortizacionesRaw ?? []).map((a) => ({
    deuda_id: a.deuda_id,
    fecha: a.fecha,
    importe: Number(a.importe),
    tipoReduccion: a.tipo_reduccion as "reducir_cuota" | "reducir_plazo",
  }));

  const cuentasRemuneradas = (cuentas ?? [])
    .filter((c) => c.es_remunerada && c.tipo_interes !== null)
    .map((c) => ({ id: c.id, saldo_actual: Number(c.saldo_actual), tipo_interes: Number(c.tipo_interes) }));

  const previstos = (previstosRaw ?? []) as unknown as MovimientoPrevisto[];
  const categoriaEsInversion = new Map((categorias ?? []).map((c) => [c.id, c.es_categoria_inversion === true]));
  const esCategoriaInversion = (categoriaId: string | null) =>
    categoriaId !== null && categoriaEsInversion.get(categoriaId) === true;

  const meses = generarMeses(horizonteMeses);
  const interesesPorMes = calcularInteresesPrevistos(cuentasRemuneradas, previstos, meses);

  const puntos = construirProyeccionPatrimonio({
    meses,
    fechaInicio: hoy,
    saldoLiquidoInicial,
    valorInversionInicial,
    previstos,
    interesesPorMes,
    deudas,
    amortizacionesProgramadas,
    esCategoriaInversion,
  });

  const filasAnuales = vista === "anual" ? agruparPorAnio(puntos) : [];

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Planificador</h1>
          <Link href="/prevision" className="text-sm text-slate-500 hover:text-slate-900">
            Ver previsión de flujo →
          </Link>
        </div>
        <p className="text-sm text-slate-400">
          Proyección conjunta de líquido, deuda e inversión combinando la previsión de flujo de
          caja, el calendario de amortización de tus deudas y los intereses previstos de cuentas
          remuneradas. La inversión proyectada solo suma las aportaciones previstas — no asume
          ninguna rentabilidad futura.
        </p>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Hoy — patrimonio real</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Real</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div>
              <p className="text-xs text-slate-500">Líquido</p>
              <p className="text-sm font-medium">{formatEUR(saldoLiquidoInicial)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Inversión</p>
              <p className="text-sm font-medium">{formatEUR(valorInversionInicial)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Deuda pendiente</p>
              <p className="text-sm font-medium">{formatEUR(deudaActual)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Patrimonio con deuda</p>
              <p className="text-sm font-medium">{formatEUR(saldoLiquidoInicial + valorInversionInicial - deudaActual)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Patrimonio sin deuda</p>
              <p className="text-sm font-medium">{formatEUR(saldoLiquidoInicial + valorInversionInicial)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">Proyección</span>
            <p className="text-sm text-slate-500">a partir de aquí, todo es previsión, no histórico</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-md border border-slate-300 text-sm">
              <Link
                href={`/planificador?vista=mensual`}
                className={`px-3 py-1.5 rounded-l-md ${vista === "mensual" ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
              >
                Mensual
              </Link>
              <Link
                href={`/planificador?vista=anual`}
                className={`px-3 py-1.5 rounded-r-md ${vista === "anual" ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
              >
                Anual
              </Link>
            </div>
            <div className="flex rounded-md border border-slate-300 text-sm">
              {(vista === "mensual" ? HORIZONTES_MESES : HORIZONTES_ANIOS).map((h, idx, arr) => (
                <Link
                  key={h}
                  href={`/planificador?vista=${vista}&horizonte=${h}`}
                  className={`px-3 py-1.5 ${horizonteElegido === h ? "bg-slate-900 text-white" : "hover:bg-slate-100"} ${
                    idx === 0 ? "rounded-l-md" : idx === arr.length - 1 ? "rounded-r-md" : ""
                  }`}
                >
                  {h} {vista === "mensual" ? "meses" : "años"}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">{vista === "mensual" ? "Mes" : "Año"}</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  {vista === "mensual" ? "Flujo neto" : "Flujo neto anual"}
                </th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Líquido</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Inversión</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Deuda pendiente</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Patrimonio (con deuda)</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Patrimonio (sin deuda)</th>
              </tr>
            </thead>
            <tbody>
              {vista === "mensual"
                ? puntos.map((p) => (
                    <tr key={`${p.year}-${p.month}`} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{p.label}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-2 text-right ${
                          p.flujoNeto >= 0 ? "text-emerald-600" : "text-slate-900"
                        }`}
                      >
                        {formatEUR(p.flujoNeto)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatEUR(p.saldoLiquido)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatEUR(p.valorInversion)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatEUR(p.deudaPendiente)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-medium">
                        {formatEUR(p.patrimonioConDeuda)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-medium">
                        {formatEUR(p.patrimonioSinDeuda)}
                      </td>
                    </tr>
                  ))
                : filasAnuales.map((f) => (
                    <tr key={f.year} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{f.year}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-2 text-right ${
                          f.flujoNetoAnual >= 0 ? "text-emerald-600" : "text-slate-900"
                        }`}
                      >
                        {formatEUR(f.flujoNetoAnual)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatEUR(f.saldoLiquido)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatEUR(f.valorInversion)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatEUR(f.deudaPendiente)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-medium">
                        {formatEUR(f.patrimonioConDeuda)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-medium">
                        {formatEUR(f.patrimonioSinDeuda)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
