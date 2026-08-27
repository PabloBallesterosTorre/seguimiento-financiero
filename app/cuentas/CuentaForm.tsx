"use client";

import { useState } from "react";

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

const inputClass =
  "w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink placeholder:text-faint";
const labelClass = "mb-1.5 block text-xs font-semibold text-ink-secondary";

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
        <label className={labelClass}>Banco</label>
        <input name="banco" required defaultValue={cuenta?.banco_nombre} className={inputClass} placeholder="Ibercaja" />
      </div>
      <div>
        <label className={labelClass}>Nombre de la cuenta</label>
        <input
          name="nombre"
          required
          defaultValue={cuenta?.nombre}
          className={inputClass}
          placeholder="Cuenta corriente"
        />
      </div>
      <div>
        <label className={labelClass}>Tipo</label>
        <select name="tipo" defaultValue={cuenta?.tipo ?? "corriente"} className={inputClass}>
          <option value="corriente">Corriente</option>
          <option value="ahorro">Ahorro</option>
          <option value="conjunta">Conjunta</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Saldo actual</label>
        <input
          name="saldo_actual"
          type="number"
          step="0.01"
          defaultValue={cuenta?.saldo_actual ?? 0}
          className={inputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>IBAN (opcional)</label>
        <input
          name="iban"
          defaultValue={cuenta?.iban ?? ""}
          placeholder="ES61 2085 9968 0303 3033 3263"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-ink-tertiary">
          Sirve para reconocer traspasos entre tus bancos al importar CSV.
        </p>
      </div>

      <div className="sm:col-span-4">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-secondary">
          <input
            type="checkbox"
            name="es_remunerada"
            checked={esRemunerada}
            onChange={(e) => setEsRemunerada(e.target.checked)}
            className="h-4 w-4"
          />
          Cuenta remunerada (genera intereses)
        </label>
      </div>

      {esRemunerada && (
        <>
          <div>
            <label className={labelClass}>Tipo de interés (% anual)</label>
            <input
              name="tipo_interes"
              type="number"
              step="0.001"
              required
              defaultValue={cuenta?.tipo_interes ?? undefined}
              placeholder="p. ej. 2.5"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Periodicidad de pago</label>
            <select
              name="periodicidad_pago_interes"
              defaultValue={cuenta?.periodicidad_pago_interes ?? "mensual"}
              className={inputClass}
            >
              <option value="diaria">Diaria</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="anual">Anual</option>
            </select>
            <p className="mt-1.5 text-xs text-ink-tertiary">
              Solo informativo: la previsión de intereses siempre calcula y compone el interés mes
              a mes, sin importar la periodicidad de pago real del banco.
            </p>
          </div>
        </>
      )}

      <div className="flex gap-2.5 sm:col-span-4">
        <button type="submit" className="rounded-btn bg-ink px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-ink/90">
          {cuenta ? "Guardar cambios" : "Añadir cuenta"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-btn border border-border-strong bg-surface px-[18px] py-2.5 text-sm font-semibold text-ink-secondary hover:bg-chip"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
