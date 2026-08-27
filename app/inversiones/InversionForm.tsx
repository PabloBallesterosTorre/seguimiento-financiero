"use client";

import { useState } from "react";
import { inputClass, labelClass, btnPrimaryClass, cardClass } from "@/components/formStyles";

const TIPOS_ACTIVO = ["Fondo indexado", "Acciones", "Cripto", "Cuenta", "Otro"];

export type PrevistoInversionOption = { id: string; descripcion: string; importe_estimado: number };

export type InversionParaEditar = {
  id: string;
  tipo_activo: string;
  nombre: string;
  es_recurrente: boolean;
  movimiento_previsto_id: string | null;
  rentabilidad_anual_asumida: number | null;
};

export function InversionForm({
  action,
  previstosInversion,
  inversion,
  onGuardado,
}: {
  action: (formData: FormData) => void;
  previstosInversion: PrevistoInversionOption[];
  inversion?: InversionParaEditar;
  onGuardado?: () => void;
}) {
  const esNueva = !inversion;
  const tipoInicial = inversion && !TIPOS_ACTIVO.includes(inversion.tipo_activo) ? "Otro" : inversion?.tipo_activo ?? TIPOS_ACTIVO[0];
  const [tipoActivo, setTipoActivo] = useState(tipoInicial);
  const [esRecurrente, setEsRecurrente] = useState(inversion?.es_recurrente ?? false);

  return (
    <div className={cardClass}>
      <h2 className="mb-5 font-sora text-base font-semibold text-ink">
        {esNueva ? "Añadir inversión" : "Editar inversión"}
      </h2>
      <form
        action={async (formData) => {
          await action(formData);
          onGuardado?.();
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-4"
      >
        {inversion && <input type="hidden" name="id" value={inversion.id} />}
        <div>
          <label className={labelClass}>Tipo de activo</label>
          <select
            name={tipoActivo === "Otro" ? undefined : "tipo_activo"}
            value={tipoActivo}
            onChange={(e) => setTipoActivo(e.target.value)}
            className={inputClass}
          >
            {TIPOS_ACTIVO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {tipoActivo === "Otro" && (
            <input
              name="tipo_activo"
              required
              defaultValue={inversion && !TIPOS_ACTIVO.includes(inversion.tipo_activo) ? inversion.tipo_activo : ""}
              placeholder="Especifica el tipo"
              className={`${inputClass} mt-1.5`}
            />
          )}
        </div>
        <div>
          <label className={labelClass}>Nombre</label>
          <input
            name="nombre"
            required
            defaultValue={inversion?.nombre}
            placeholder="MSCI World (Vanguard)"
            className={inputClass}
          />
        </div>
        {esNueva && (
          <div>
            <label className={labelClass}>Valor actual</label>
            <input name="valor_actual" type="number" step="0.01" min="0" defaultValue={0} className={inputClass} />
          </div>
        )}
        <div>
          <label className={labelClass}>Rentabilidad anual asumida (%)</label>
          <input
            name="rentabilidad_anual_asumida"
            type="number"
            step="0.01"
            placeholder="6"
            defaultValue={inversion?.rentabilidad_anual_asumida ?? undefined}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-ink-tertiary">Para proyectar su evolución — es un supuesto, no un dato real.</p>
        </div>

        <div className="sm:col-span-4">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              name="es_recurrente"
              checked={esRecurrente}
              onChange={(e) => setEsRecurrente(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-ink">Aportación recurrente</span>
          </label>
        </div>

        {esRecurrente && (
          <div className="sm:col-span-4">
            <label className={labelClass}>Movimiento previsto vinculado</label>
            <select name="movimiento_previsto_id" defaultValue={inversion?.movimiento_previsto_id ?? ""} className={inputClass}>
              <option value="">Sin vincular todavía</option>
              {previstosInversion.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.descripcion} — {p.importe_estimado.toFixed(2)} €
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-tertiary">
              Cada mes que llegue el movimiento real de esa previsión se conciliará con ella igual que
              cualquier otro previsto. Si todavía no existe, créala primero en{" "}
              <span className="font-semibold">Previsión → Movimientos previstos</span> (tipo gasto, categoría de
              inversión, recurrente).
            </p>
          </div>
        )}

        <div className="sm:col-span-4">
          <button type="submit" className={btnPrimaryClass}>
            {esNueva ? "Añadir inversión" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
