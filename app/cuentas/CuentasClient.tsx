"use client";

import { Fragment, useState } from "react";
import { CuentaForm } from "./CuentaForm";
import { ConfirmForm } from "@/components/ConfirmForm";

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

function formatEUR(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

export function CuentasClient({
  cuentas,
  crearCuenta,
  actualizarCuenta,
  eliminarCuenta,
}: {
  cuentas: Cuenta[];
  crearCuenta: (formData: FormData) => void;
  actualizarCuenta: (formData: FormData) => void;
  eliminarCuenta: (formData: FormData) => void;
}) {
  const [abierto, setAbierto] = useState<"nueva" | string | null>(null);

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Banco</th>
              <th className="px-4 py-2 font-medium">Cuenta</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Remunerada</th>
              <th className="px-4 py-2 font-medium text-right">Saldo</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map((cuenta) => (
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
