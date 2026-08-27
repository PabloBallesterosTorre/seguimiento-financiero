"use client";

import { useState } from "react";
import { inputClass, labelClass, btnPrimaryClass, cardClass } from "@/components/formStyles";

const MONEDAS = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "Dólar estadounidense ($)" },
  { value: "GBP", label: "Libra esterlina (£)" },
];

export function ConfiguracionTabs({
  email,
  nombre,
  monedaBase,
  idioma,
  objetivoAhorroMensual,
  incluirInversionEnAhorro,
  guardarConfiguracionGeneral,
  guardarObjetivoAhorroGlobal,
}: {
  email: string;
  nombre: string | null;
  monedaBase: string;
  idioma: string;
  objetivoAhorroMensual: number | null;
  incluirInversionEnAhorro: boolean;
  guardarConfiguracionGeneral: (formData: FormData) => void;
  guardarObjetivoAhorroGlobal: (formData: FormData) => void;
}) {
  const [tab, setTab] = useState<"general" | "ahorro">("general");

  return (
    <div className="space-y-6">
      <div className="flex w-fit rounded-full bg-chip p-1">
        <button
          type="button"
          onClick={() => setTab("general")}
          className={`rounded-full px-[18px] py-2.5 text-sm font-semibold transition-colors ${
            tab === "general" ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"
          }`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setTab("ahorro")}
          className={`rounded-full px-[18px] py-2.5 text-sm font-semibold transition-colors ${
            tab === "ahorro" ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"
          }`}
        >
          Objetivo de ahorro
        </button>
      </div>

      {tab === "general" && (
        <form action={guardarConfiguracionGeneral} className={`${cardClass} max-w-md space-y-4`}>
          <div>
            <label className={labelClass}>Email</label>
            <input disabled value={email} className={`${inputClass} cursor-not-allowed text-ink-tertiary`} />
          </div>
          <div>
            <label className={labelClass}>Nombre</label>
            <input name="nombre" defaultValue={nombre ?? ""} placeholder="Pablo" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Moneda base</label>
            <select name="moneda_base" defaultValue={monedaBase} className={inputClass}>
              {MONEDAS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-tertiary">Cambia el formato de todos los importes de la app.</p>
          </div>
          <div>
            <label className={labelClass}>Idioma</label>
            <select name="idioma" defaultValue={idioma} className={inputClass}>
              <option value="es">Español</option>
            </select>
            <p className="mt-1.5 text-xs text-ink-tertiary">
              Se guarda tu preferencia, pero de momento la app solo está disponible en español.
            </p>
          </div>
          <button type="submit" className={btnPrimaryClass}>
            Guardar
          </button>
        </form>
      )}

      {tab === "ahorro" && (
        <form action={guardarObjetivoAhorroGlobal} className={`${cardClass} max-w-lg space-y-5`}>
          <div>
            <label className={labelClass}>Objetivo de ahorro mensual</label>
            <input
              name="objetivo_ahorro_mensual"
              type="number"
              step="0.01"
              min="0"
              defaultValue={objetivoAhorroMensual ?? undefined}
              placeholder="500"
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-ink-tertiary">
              Un único valor que se aplica igual a todos los meses (ya no se configura mes a mes).
            </p>
          </div>
          <div>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                name="incluir_inversion_en_ahorro"
                defaultChecked={incluirInversionEnAhorro}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block text-sm text-ink">La aportación a inversión del mes cuenta como ahorro</span>
                <span className="mt-1 block text-xs text-ink-tertiary">
                  Activado (por defecto): invertir cuenta como ahorrar — ahorro = ingresos − gastos (sin contar
                  lo invertido como gasto). Desactivado: ahorro = ingresos − gastos − inversión, más estricto
                  (solo cuenta el dinero que se queda líquido en tus cuentas).
                </span>
              </span>
            </label>
          </div>
          <button type="submit" className={btnPrimaryClass}>
            Guardar
          </button>
        </form>
      )}
    </div>
  );
}
