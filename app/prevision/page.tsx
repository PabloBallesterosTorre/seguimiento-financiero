import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { generarMeses, importeEstimado, previstoAplicaEnMes, type MovimientoPrevisto } from "@/lib/prevision";
import { desvincularMovimientoPrevisto, vincularMovimientoPrevisto } from "./actions";

function formatEUR(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

const HORIZONTES = [3, 6, 12];

export default async function PrevisionPage({
  searchParams,
}: {
  searchParams: { meses?: string };
}) {
  const supabase = createClient();
  const horizonte = HORIZONTES.includes(Number(searchParams.meses)) ? Number(searchParams.meses) : 3;

  const hoyDate = new Date();
  const inicioMes = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, "0")}-01`;
  const inicioMesSiguienteDate = new Date(hoyDate.getFullYear(), hoyDate.getMonth() + 1, 1);
  const inicioMesSiguiente = `${inicioMesSiguienteDate.getFullYear()}-${String(
    inicioMesSiguienteDate.getMonth() + 1
  ).padStart(2, "0")}-01`;

  const [{ data: previstosRaw }, { data: categorias }, { data: cuentas }, { data: movimientosMes }] =
    await Promise.all([
      supabase.from("movimientos_previstos").select("*"),
      supabase.from("categorias").select("id, nombre"),
      supabase.from("cuentas").select("saldo_actual").eq("activa", true),
      supabase
        .from("movimientos")
        .select("id, descripcion, importe, tipo, categoria_id, fecha")
        .gte("fecha", inicioMes)
        .lt("fecha", inicioMesSiguiente)
        .in("tipo", ["ingreso", "gasto"]),
    ]);

  const previstos = (previstosRaw ?? []) as unknown as MovimientoPrevisto[];
  const nombreCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nombre]));
  const saldoInicial = (cuentas ?? []).reduce((sum, c) => sum + Number(c.saldo_actual ?? 0), 0);
  const movimientosDelMes = movimientosMes ?? [];

  const meses = generarMeses(horizonte).map((mes) => {
    const aplicables = previstos.filter((p) => previstoAplicaEnMes(p, mes.year, mes.month));
    const traspasos = aplicables.filter((p) => p.tipo === "traspaso");
    const resto = aplicables.filter((p) => p.tipo !== "traspaso");

    const porCategoria = new Map<string, { nombre: string; importe: number }>();
    for (const p of resto) {
      const clave = p.categoria_id ?? "__sin_categoria__";
      const nombre = p.categoria_id ? nombreCategoria.get(p.categoria_id) ?? "Categoría eliminada" : "Sin categoría";
      const signo = p.tipo === "ingreso" ? 1 : -1;
      const actual = porCategoria.get(clave) ?? { nombre, importe: 0 };
      actual.importe += signo * importeEstimado(p);
      porCategoria.set(clave, actual);
    }

    const totalMes = Array.from(porCategoria.values()).reduce((sum, c) => sum + c.importe, 0);

    return { ...mes, porCategoria: Array.from(porCategoria.entries()), totalMes, traspasos, previstosMes: resto };
  });

  let saldoAcumulado = saldoInicial;
  const mesesConSaldo = meses.map((mes) => {
    saldoAcumulado += mes.totalMes;
    return { ...mes, saldoProyectado: saldoAcumulado };
  });

  const mesActual = mesesConSaldo[0];
  const previstosSinVincular = (mesActual?.previstosMes ?? []).filter((p) => !p.movimiento_real_id);
  const previstosVinculados = previstos.filter(
    (p) => p.movimiento_real_id && mesActual && previstoAplicaEnMes(p, mesActual.year, mesActual.month)
  );

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Previsión de flujo de caja</h1>
          <Link href="/prevision/previstos" className="text-sm text-slate-500 hover:text-slate-900">
            Gestionar previsiones →
          </Link>
        </div>

        <div className="flex rounded-md border border-slate-300 text-sm w-fit">
          {HORIZONTES.map((h) => (
            <Link
              key={h}
              href={`/prevision?meses=${h}`}
              className={`px-3 py-1.5 ${h === horizonte ? "bg-slate-900 text-white" : "hover:bg-slate-100"} ${
                h === 3 ? "rounded-l-md" : h === 12 ? "rounded-r-md" : ""
              }`}
            >
              {h} meses
            </Link>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-500">Saldo actual de cuentas</p>
          <p className="mt-1 text-2xl font-semibold">{formatEUR(saldoInicial)}</p>
        </div>

        <div className="space-y-4">
          {mesesConSaldo.map((mes) => (
            <div key={`${mes.year}-${mes.month}`} className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-slate-700">{mes.label}</h2>
                <p className="text-sm text-slate-500">
                  Neto:{" "}
                  <span className={mes.totalMes >= 0 ? "text-emerald-600" : "text-slate-900"}>
                    {formatEUR(mes.totalMes)}
                  </span>{" "}
                  · Saldo proyectado:{" "}
                  <span className="font-medium text-slate-900">{formatEUR(mes.saldoProyectado)}</span>
                </p>
              </div>

              {mes.porCategoria.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">Sin previsiones para este mes.</p>
              ) : (
                <table className="mt-3 w-full text-sm">
                  <tbody>
                    {mes.porCategoria.map(([clave, c]) => (
                      <tr key={clave} className="border-t border-slate-100">
                        <td className="py-1.5 text-slate-600">{c.nombre}</td>
                        <td
                          className={`py-1.5 text-right font-medium ${
                            c.importe >= 0 ? "text-emerald-600" : "text-slate-900"
                          }`}
                        >
                          {formatEUR(c.importe)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {mes.traspasos.length > 0 && (
                <p className="mt-3 text-xs text-slate-400">
                  + {mes.traspasos.length} traspaso(s) previsto(s) entre cuentas propias (no afectan al total).
                </p>
              )}
            </div>
          ))}
        </div>

        {mesActual && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-sm font-medium text-slate-700">
              Previsto vs. real — {mesActual.label}
            </h2>

            {mesActual.porCategoria.length === 0 ? (
              <p className="text-sm text-slate-400">No hay previsiones activas para este mes.</p>
            ) : (
              <div className="space-y-3">
                {mesActual.porCategoria.map(([clave, c]) => {
                  const real = movimientosDelMes
                    .filter((m) => (m.categoria_id ?? "__sin_categoria__") === clave)
                    .reduce((sum, m) => sum + Number(m.importe), 0);
                  const cumplido = c.importe >= 0 ? real >= c.importe : real <= c.importe;
                  const pct =
                    c.importe !== 0 ? Math.min(100, Math.max(0, (Math.abs(real) / Math.abs(c.importe)) * 100)) : 0;

                  return (
                    <div key={clave}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{c.nombre}</span>
                        <span>
                          <span className="font-medium text-slate-900">{formatEUR(real)}</span>
                          <span className="text-slate-400"> / {formatEUR(c.importe)} previsto</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                        <div
                          className={`h-1.5 rounded-full ${cumplido ? "bg-emerald-500" : "bg-slate-900"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(previstosSinVincular.length > 0 || previstosVinculados.length > 0) && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-sm font-medium text-slate-700">Conciliación — {mesActual?.label}</h2>
            <p className="text-xs text-slate-400">
              Vincula cada previsión con el movimiento real correspondiente para que no se duplique en la
              proyección de los próximos meses.
            </p>

            {previstosSinVincular.map((p) => {
              const candidatos = movimientosDelMes.filter(
                (m) => (m.categoria_id ?? null) === p.categoria_id
              );
              return (
                <form key={p.id} action={vincularMovimientoPrevisto} className="flex items-center gap-2 text-sm">
                  <input type="hidden" name="previsto_id" value={p.id} />
                  <span className="w-48 truncate text-slate-600">{p.descripcion}</span>
                  <span className="text-slate-400">{formatEUR(importeEstimado(p))}</span>
                  <select
                    name="movimiento_id"
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    defaultValue=""
                  >
                    <option value="">Sin vincular todavía</option>
                    {candidatos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.descripcion} — {formatEUR(Number(m.importe))}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Vincular
                  </button>
                </form>
              );
            })}

            {previstosVinculados.map((p) => (
              <form key={p.id} action={desvincularMovimientoPrevisto} className="flex items-center gap-2 text-sm">
                <input type="hidden" name="previsto_id" value={p.id} />
                <span className="w-48 truncate text-slate-600">{p.descripcion}</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Vinculado
                </span>
                <button type="submit" className="text-xs text-slate-400 hover:text-red-600">
                  Desvincular
                </button>
              </form>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
