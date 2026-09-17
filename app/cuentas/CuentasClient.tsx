"use client";

import { Fragment, useState } from "react";
import { CuentaForm } from "./CuentaForm";
import { ConfirmForm } from "@/components/ConfirmForm";
import { formatMonedaTabla, formatPorcentaje } from "@/lib/formato";
import { ordenarFilas, type OrdenTabla } from "@/lib/ordenTabla";
import { useOrdenTabla, ThOrdenable } from "@/components/OrdenTabla";

type Cuenta = {
  id: string;
  banco_nombre: string;
  nombre: string;
  tipo: string;
  saldo_actual: number;
  iban: string | null;
  es_remunerada: boolean;
  tipo_interes: number | null;
  periodicidad_pago_interes: string | null;
};

type Desfase = { cuentaId: string; desfase: number; saldoEsperado: number };

export function CuentasClient({
  cuentas,
  moneda,
  crearCuenta,
  actualizarCuenta,
  eliminarCuenta,
  recalcularSaldoCuenta,
  alternarExclusionInformes,
  cuentasExcluidas,
  desfases = {},
  ordenInicial = null,
}: {
  cuentas: Cuenta[];
  moneda: string;
  crearCuenta: (formData: FormData) => void;
  actualizarCuenta: (formData: FormData) => void;
  eliminarCuenta: (formData: FormData) => void;
  recalcularSaldoCuenta: (formData: FormData) => void;
  alternarExclusionInformes: (formData: FormData) => void;
  cuentasExcluidas: string[];
  desfases?: Record<string, Desfase>;
  ordenInicial?: OrdenTabla;
}) {
  const excluidas = new Set(cuentasExcluidas);
  const formatEUR = (v: number) => formatMonedaTabla(v, moneda);
  const [abierto, setAbierto] = useState<"nueva" | string | null>(null);
  const { orden, toggle } = useOrdenTabla("cuentas", ordenInicial);

  const cuentasOrdenadas = ordenarFilas(cuentas, orden, {
    banco: (c) => c.banco_nombre,
    cuenta: (c) => c.nombre,
    tipo: (c) => c.tipo,
    remunerada: (c) => (c.es_remunerada ? Number(c.tipo_interes ?? 0) : null),
    saldo: (c) => Number(c.saldo_actual),
  });

  const cuentasDescuadradas = cuentas.filter((c) => desfases[c.id]);
  const totalIncluidas = cuentas.filter((c) => !excluidas.has(c.id)).reduce((s, c) => s + Number(c.saldo_actual), 0);
  const totalTodas = cuentas.reduce((s, c) => s + Number(c.saldo_actual), 0);

  return (
    <div className="space-y-6">
      {cuentasDescuadradas.length > 0 && (
        <div className="rounded-card border border-danger/30 bg-danger/5 p-5">
          <p className="text-sm font-semibold text-danger">
            {cuentasDescuadradas.length === 1
              ? "Una cuenta no cuadra con sus movimientos"
              : `${cuentasDescuadradas.length} cuentas no cuadran con sus movimientos`}
          </p>
          <p className="mt-1.5 text-[13px] text-ink-secondary">
            El saldo guardado debería ser el saldo inicial más todos los movimientos de la cuenta. Cuando
            no coincide, es que alguna operación no llegó a completarse. Recalcular reconstruye el saldo
            desde los movimientos, que son la fuente fiable.
          </p>
          <ul className="mt-3 space-y-2">
            {cuentasDescuadradas.map((cuenta) => {
              const d = desfases[cuenta.id];
              return (
                <li key={cuenta.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
                  <span className="font-semibold text-ink">
                    {cuenta.banco_nombre} — {cuenta.nombre}
                  </span>
                  <span className="text-ink-secondary">
                    muestra {formatEUR(Number(cuenta.saldo_actual))} y debería mostrar{" "}
                    {formatEUR(d.saldoEsperado)}
                  </span>
                  <span className="rounded-full bg-danger/10 px-2 py-0.5 font-semibold text-danger">
                    {d.desfase > 0 ? "+" : ""}
                    {formatEUR(d.desfase)}
                  </span>
                  <form action={recalcularSaldoCuenta}>
                    <input type="hidden" name="id" value={cuenta.id} />
                    <button type="submit" className="font-semibold text-accent hover:underline">
                      Recalcular saldo
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {abierto === "nueva" ? (
        <div className="rounded-card border border-border bg-surface p-7 shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-sora text-base font-semibold text-ink">Añadir cuenta</h2>
            <button type="button" onClick={() => setAbierto(null)} className="text-[13px] font-semibold text-ink-tertiary hover:text-ink">
              Cancelar
            </button>
          </div>
          <CuentaForm action={crearCuenta} onCancelar={() => setAbierto(null)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto("nueva")}
          className="rounded-btn bg-ink px-[18px] py-[11px] text-sm font-semibold text-white hover:bg-ink/90"
        >
          + Nueva cuenta
        </button>
      )}

      <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <ThOrdenable columna="banco" orden={orden} onToggle={toggle}>Banco</ThOrdenable>
              <ThOrdenable columna="cuenta" orden={orden} onToggle={toggle}>Cuenta</ThOrdenable>
              <ThOrdenable columna="tipo" orden={orden} onToggle={toggle}>Tipo</ThOrdenable>
              <ThOrdenable columna="remunerada" orden={orden} onToggle={toggle}>Remunerada</ThOrdenable>
              <ThOrdenable columna="saldo" orden={orden} onToggle={toggle} align="right">Saldo</ThOrdenable>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {cuentasOrdenadas.map((cuenta) => (
              <Fragment key={cuenta.id}>
                <tr className="border-t border-border">
                  <td className="px-4 py-3.5 font-semibold text-ink">{cuenta.banco_nombre}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ink">{cuenta.nombre}</span>
                      {/* Cuatro de las siete cuentas estaban excluidas de informes y esta
                          pantalla no lo decía en ninguna parte: había que ir a Configuración
                          para saberlo, siendo un estado que cambia lo que se ve en media
                          app (auditoría de diseño, tanda 11). */}
                      {excluidas.has(cuenta.id) && (
                        <span className="rounded-full bg-chip px-2 py-0.5 text-[10px] font-semibold text-ink-tertiary">
                          Fuera de informes
                        </span>
                      )}
                    </div>
                    {cuenta.iban && <div className="text-xs text-faint">{cuenta.iban}</div>}
                  </td>
                  <td className="px-4 py-3.5 capitalize text-ink-secondary">{cuenta.tipo}</td>
                  <td className="px-4 py-3.5 text-ink-secondary">
                    {cuenta.es_remunerada && cuenta.tipo_interes !== null ? (
                      <span className="tabular-nums">{formatPorcentaje(Number(cuenta.tipo_interes), { decimales: 2 })}</span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right text-[15px] font-semibold tabular-nums text-ink">
                    {formatEUR(Number(cuenta.saldo_actual))}
                    {desfases[cuenta.id] && (
                      <div className="text-xs font-semibold text-danger">No cuadra</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right">
                    <form action={alternarExclusionInformes} className="inline">
                      <input type="hidden" name="id" value={cuenta.id} />
                      <button
                        type="submit"
                        className="mr-3.5 text-[13px] font-semibold text-ink-tertiary hover:text-ink"
                        title={
                          excluidas.has(cuenta.id)
                            ? "Volver a contar esta cuenta en informes y en el resumen"
                            : "Dejar de contar esta cuenta en informes y en el resumen"
                        }
                      >
                        {excluidas.has(cuenta.id) ? "Incluir" : "Excluir"}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setAbierto(abierto === cuenta.id ? null : cuenta.id)}
                      className="mr-3.5 text-[13px] font-semibold text-accent"
                    >
                      Editar
                    </button>
                    <ConfirmForm
                      action={eliminarCuenta}
                      mensaje={`¿Seguro que quieres eliminar la cuenta "${cuenta.banco_nombre} — ${cuenta.nombre}"? Se borrarán también todos sus movimientos. Esta acción no se puede deshacer.`}
                      className="inline"
                    >
                      <input type="hidden" name="id" value={cuenta.id} />
                      <button className="text-[13px] font-semibold text-faint hover:text-danger" type="submit">
                        Eliminar
                      </button>
                    </ConfirmForm>
                  </td>
                </tr>
                {abierto === cuenta.id && (
                  <tr className="border-t border-border bg-page">
                    <td colSpan={6} className="px-4 py-5">
                      <CuentaForm
                        cuenta={cuenta}
                        action={actualizarCuenta}
                        onCancelar={() => setAbierto(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {cuentas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-tertiary">
                  Todavía no has dado de alta ninguna cuenta.
                </td>
              </tr>
            )}
          </tbody>
          {cuentas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border-strong bg-chip/60">
                <td colSpan={4} className="px-4 py-3 text-[13px] font-semibold text-ink">
                  Total
                  {totalIncluidas !== totalTodas && (
                    <span className="ml-1.5 font-normal text-ink-tertiary">
                      (sin las cuentas fuera de informes; con ellas, {formatEUR(totalTodas)})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-sora text-base font-bold tabular-nums text-ink">
                  {formatEUR(totalIncluidas)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
