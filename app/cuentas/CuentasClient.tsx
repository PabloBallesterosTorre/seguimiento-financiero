"use client";

import { Fragment, useState } from "react";
import { CuentaForm } from "./CuentaForm";
import { ConfirmForm } from "@/components/ConfirmForm";
import { formatMoneda } from "@/lib/formato";
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

export function CuentasClient({
  cuentas,
  moneda,
  crearCuenta,
  actualizarCuenta,
  eliminarCuenta,
  ordenInicial = null,
}: {
  cuentas: Cuenta[];
  moneda: string;
  crearCuenta: (formData: FormData) => void;
  actualizarCuenta: (formData: FormData) => void;
  eliminarCuenta: (formData: FormData) => void;
  ordenInicial?: OrdenTabla;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const [abierto, setAbierto] = useState<"nueva" | string | null>(null);
  const { orden, toggle } = useOrdenTabla("cuentas", ordenInicial);

  const cuentasOrdenadas = ordenarFilas(cuentas, orden, {
    banco: (c) => c.banco_nombre,
    cuenta: (c) => c.nombre,
    tipo: (c) => c.tipo,
    remunerada: (c) => (c.es_remunerada ? Number(c.tipo_interes ?? 0) : null),
    saldo: (c) => Number(c.saldo_actual),
  });

  return (
    <div className="space-y-6">
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
                    <div className="text-ink">{cuenta.nombre}</div>
                    {cuenta.iban && <div className="text-xs text-faint">{cuenta.iban}</div>}
                  </td>
                  <td className="px-4 py-3.5 capitalize text-ink-secondary">{cuenta.tipo}</td>
                  <td className="px-4 py-3.5 text-ink-secondary">
                    {cuenta.es_remunerada ? `${cuenta.tipo_interes ?? "—"}%` : <span className="text-faint">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-ink">{formatEUR(Number(cuenta.saldo_actual))}</td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
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
        </table>
      </div>
    </div>
  );
}
