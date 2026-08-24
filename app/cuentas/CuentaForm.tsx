"use client";

import { useState } from "react";

type Cuenta = {
  id: string;
  banco_nombre: string;
  nombre: string;
  tipo: string;
  saldo_actual: number;
  es_remunerada: boolean;
  tipo_interes: number | null;
  periodicidad_pago_interes: string | null;
};

export function CuentaForm({
  cuenta,
  action,
  onCancelar,
}: {
  cuenta?: Cuenta;
  action: (formData: FormData) => void;
  onCancelar: () => void;
}) {
  const [esRemunerada, setEsRemunerada] = useState(cuenta?.es_remunerada ?? false);

  return (
    <form
      action={async (formData) => {
        await action(formData);
        onCancelar();
      }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-4"
    >
      {cuenta && <input type="hidden" name="id" value={cuenta.id} />}
      <div>
        <label className="block text-xs text-slate-500">Banco</label>
        <input
          name="banco"
          required
          defaultValue={cuenta?.banco_nombre}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Ibercaja"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Nombre de la cuenta</label>
        <input
          name="nombre"
          required
          defaultValue={cuenta?.nombre}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Cuenta corriente"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Tipo</label>
        <select
          name="tipo"
          defaultValue={cuenta?.tipo ?? "corriente"}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="corriente">Corriente</option>
          <option value="ahorro">Ahorro</option>
          <option value="conjunta">Conjunta</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500">Saldo actual</label>
        <input
          name="saldo_actual"
          type="number"
          step="0.01"
          defaultValue={cuenta?.saldo_actual ?? 0}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="sm:col-span-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="es_remunerada"
            checked={esRemunerada}
            onChange={(e) => setEsRemunerada(e.target.checked)}
          />
          Cuenta remunerada (genera intereses)
        </label>
      </div>

      {esRemunerada && (
        <>
          <div>
            <label className="block text-xs text-slate-500">Tipo de interés (% anual)</label>
            <input
              name="tipo_interes"
              type="number"
              step="0.001"
              defaultValue={cuenta?.tipo_interes ?? undefined}
              placeholder="2.5"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Periodicidad de pago</label>
            <select
              name="periodicidad_pago_interes"
              defaultValue={cuenta?.periodicidad_pago_interes ?? "mensual"}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="diaria">Diaria</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="anual">Anual</option>
            </select>
          </div>
        </>
      )}

      <div className="flex gap-3 sm:col-span-4">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {cuenta ? "Guardar cambios" : "Añadir cuenta"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
