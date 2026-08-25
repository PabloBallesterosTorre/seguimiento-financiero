"use client";

import { useState } from "react";

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
      <div className="flex rounded-md border border-slate-300 text-sm w-fit">
        <button
          type="button"
          onClick={() => setTab("general")}
          className={`rounded-l-md px-4 py-1.5 ${tab === "general" ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setTab("ahorro")}
          className={`rounded-r-md px-4 py-1.5 ${tab === "ahorro" ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
        >
          Objetivo de ahorro
        </button>
      </div>

      {tab === "general" && (
        <form action={guardarConfiguracionGeneral} className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-500">Email</label>
            <input
              disabled
              value={email}
              className="mt-1 w-full max-w-sm rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Nombre</label>
            <input
              name="nombre"
              defaultValue={nombre ?? ""}
              placeholder="Pablo"
              className="mt-1 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Moneda base</label>
            <select
              name="moneda_base"
              defaultValue={monedaBase}
              className="mt-1 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {MONEDAS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">Cambia el formato de todos los importes de la app.</p>
          </div>
          <div>
            <label className="block text-xs text-slate-500">Idioma</label>
            <select
              name="idioma"
              defaultValue={idioma}
              className="mt-1 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="es">Español</option>
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Se guarda tu preferencia, pero de momento la app solo está disponible en español.
            </p>
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Guardar
          </button>
        </form>
      )}

      {tab === "ahorro" && (
        <form
          action={guardarObjetivoAhorroGlobal}
          className="rounded-lg border border-slate-200 bg-white p-6 space-y-4"
        >
          <div>
            <label className="block text-xs text-slate-500">Objetivo de ahorro mensual</label>
            <input
              name="objetivo_ahorro_mensual"
              type="number"
              step="0.01"
              min="0"
              defaultValue={objetivoAhorroMensual ?? undefined}
              placeholder="500"
              className="mt-1 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">
              Un único valor que se aplica igual a todos los meses (ya no se configura mes a mes).
            </p>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="incluir_inversion_en_ahorro"
                defaultChecked={incluirInversionEnAhorro}
              />
              La aportación a inversión del mes cuenta como ahorro
            </label>
            <p className="mt-1 text-xs text-slate-400">
              Activado (por defecto): invertir cuenta como ahorrar — ahorro = ingresos − gastos (sin contar
              lo invertido como gasto). Desactivado: ahorro = ingresos − gastos − inversión, más estricto
              (solo cuenta el dinero que se queda líquido en tus cuentas).
            </p>
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Guardar
          </button>
        </form>
      )}
    </div>
  );
}
