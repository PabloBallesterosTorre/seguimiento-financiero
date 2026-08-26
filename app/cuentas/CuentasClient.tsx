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
    <div className="space-y-8">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <ThOrdenable columna="banco" orden={orden} onToggle={toggle}>Banco</ThOrdenable>
              <ThOrdenable columna="cuenta" orden={orden} onToggle={toggle}>Cuenta</ThOrdenable>
              <ThOrdenable columna="tipo" orden={orden} onToggle={toggle}>Tipo</ThOrdenable>
              <ThOrdenable columna="remunerada" orden={orden} onToggle={toggle}>Remunerada</ThOrdenable>
              <ThOrdenable columna="saldo" orden={orden} onToggle={toggle} align="right">Saldo</ThOrdenable>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cuentasOrdenadas.map((cuenta) => (
              <Fragment key={cuenta.id}>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2">{cuenta.banco_nombre}</td>
                  <td className="px-4 py-2">
                    {cuenta.nombre}
                    {cuenta.iban && <p className="text-xs text-slate-400">{cuenta.iban}</p>}
                  </td>
                  <td className="px-4 py-2 capitalize">{cuenta.tipo}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {cuenta.es_remunerada ? `${cuenta.tipo_interes ?? "—"}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">{formatEUR(Number(cuenta.saldo_actual))}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setAbierto(abierto === cuenta.id ? null : cuenta.id)}
                      className="mr-3 text-slate-500 hover:text-slate-900"
                    >
                      Editar
                    </button>
                    <ConfirmForm
                      action={eliminarCuenta}
                      mensaje={`¿Seguro que quieres eliminar la cuenta "${cuenta.banco_nombre} — ${cuenta.nombre}"? Se borrarán también todos sus movimientos. Esta acción no se puede deshacer.`}
                      className="inline"
                    >
                      <input type="hidden" name="id" value={cuenta.id} />
                      <button className="text-slate-400 hover:text-red-600" type="submit">
                        Eliminar
                      </button>
                    </ConfirmForm>
                  </td>
                </tr>
                {abierto === cuenta.id && (
                  <tr className="border-t border-slate-100 bg-slate-50">
                    <td colSpan={6} className="px-4 py-4">
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
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Todavía no has dado de alta ninguna cuenta.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {abierto === "nueva" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-slate-700">Añadir cuenta</h2>
          <CuentaForm action={crearCuenta} onCancelar={() => setAbierto(null)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto("nueva")}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva cuenta
        </button>
      )}
    </div>
  );
}
