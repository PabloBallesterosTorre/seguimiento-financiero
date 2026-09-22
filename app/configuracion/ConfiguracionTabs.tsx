"use client";

import { useState } from "react";
import { Invitaciones } from "./Invitaciones";
import type { Invitacion } from "@/lib/invitaciones";
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
  mesFinanciero,
  diaCorteMes,
  categoriaInicioMes,
  categorias,
  vistaPreviaMeses,
  guardarConfiguracionGeneral,
  guardarObjetivoAhorroGlobal,
  guardarMesFinanciero,
  puedeInvitar,
  invitaciones,
  crearInvitacion,
  revocarInvitacion,
}: {
  email: string;
  nombre: string | null;
  monedaBase: string;
  idioma: string;
  objetivoAhorroMensual: number | null;
  incluirInversionEnAhorro: boolean;
  mesFinanciero: boolean;
  diaCorteMes: number;
  categoriaInicioMes: string | null;
  categorias: { id: string; nombre: string }[];
  vistaPreviaMeses: { nombre: string; rango: string }[];
  guardarConfiguracionGeneral: (formData: FormData) => void;
  guardarObjetivoAhorroGlobal: (formData: FormData) => void;
  guardarMesFinanciero: (formData: FormData) => void;
  // La pestaña de invitaciones solo existe para quien administra la app (ver lib/admin.ts).
  // Llegan los datos, no el elemento ya montado: un elemento creado en el Server Component
  // y pasado como prop pierde la clave posicional al serializarse, y React avisaba por
  // consola de que faltaba una `key`. Además así se pasa igual que el resto de esta
  // pantalla, que ya recibe sus server actions por props.
  puedeInvitar: boolean;
  invitaciones: Invitacion[];
  crearInvitacion: (formData: FormData) => void;
  revocarInvitacion: (formData: FormData) => void;
}) {
  const [tab, setTab] = useState<"general" | "ahorro" | "meses" | "invitaciones">("general");
  // El resto del formulario se apaga visualmente cuando el mes financiero está
  // desactivado, para que no parezca que la categoría o el día hacen algo.
  const [activo, setActivo] = useState(mesFinanciero);

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
        <button
          type="button"
          onClick={() => setTab("meses")}
          className={`rounded-full px-[18px] py-2.5 text-sm font-semibold transition-colors ${
            tab === "meses" ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"
          }`}
        >
          Meses
        </button>
        {puedeInvitar && (
          <button
            type="button"
            onClick={() => setTab("invitaciones")}
            className={`rounded-full px-[18px] py-2.5 text-sm font-semibold transition-colors ${
              tab === "invitaciones" ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"
            }`}
          >
            Invitaciones
          </button>
        )}
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

      {tab === "meses" && (
        <form action={guardarMesFinanciero} className={`${cardClass} max-w-lg space-y-5`}>
          <div>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                name="mes_financiero"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block text-sm text-ink">Contar los meses de nómina a nómina</span>
                <span className="mt-1 block text-xs text-ink-tertiary">
                  Si cobras los últimos días del mes, la nómina con la que vives septiembre entra el 28 de
                  agosto. Contando del 1 al 31, septiembre aparece sin sueldo y agosto con dos, y la app te
                  dice que no has ahorrado en meses en los que sí ahorraste. Activado, cada mes empieza el
                  día que entró la nómina.
                </span>
              </span>
            </label>
          </div>

          <div className={activo ? "" : "pointer-events-none opacity-40"}>
            <label className={labelClass}>Categoría que marca el inicio del mes</label>
            <select name="categoria_inicio_mes" defaultValue={categoriaInicioMes ?? ""} className={inputClass}>
              <option value="">Ninguna (usar solo el día de respaldo)</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-tertiary">
              Solo cuentan los ingresos de esta categoría cobrados en los últimos días del mes. Una paga extra
              a mitad de mes no mueve la frontera: sigue contando como ingreso del mes en que se cobró.
            </p>
          </div>

          <div className={activo ? "" : "pointer-events-none opacity-40"}>
            <label className={labelClass}>Día de respaldo</label>
            <input
              name="dia_corte_mes"
              type="number"
              min="1"
              max="28"
              defaultValue={diaCorteMes}
              className={`${inputClass} max-w-[8rem]`}
            />
            <p className="mt-1.5 text-xs text-ink-tertiary">
              Para los meses en los que todavía no hay nómina que anclar: el mes en curso hasta que entra, o un
              periodo sin cobrar. Entre 1 y 28, para que exista también en febrero.
            </p>
          </div>

          <div className="rounded-btn border border-border bg-chip/40 p-4">
            <p className="text-xs font-semibold text-ink-secondary">Así quedan tus últimos meses</p>
            <ul className="mt-2 space-y-1">
              {vistaPreviaMeses.map((m) => (
                <li key={m.nombre} className="flex justify-between gap-3 text-[13px]">
                  <span className="text-ink">{m.nombre}</span>
                  <span className="text-ink-tertiary">{m.rango}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[11px] text-ink-tertiary">
              Refleja lo que hay guardado ahora mismo, no lo que estés cambiando en este formulario. El mes en
              curso se cierra en el día de respaldo hasta que entre su nómina, y entonces se recoloca solo.
            </p>
          </div>

          <button type="submit" className={btnPrimaryClass}>
            Guardar
          </button>
        </form>
      )}

      {tab === "invitaciones" && puedeInvitar && (
        <Invitaciones
          invitaciones={invitaciones}
          crearInvitacion={crearInvitacion}
          revocarInvitacion={revocarInvitacion}
        />
      )}
    </div>
  );
}
