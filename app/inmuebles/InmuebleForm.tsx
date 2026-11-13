"use client";

import { useState } from "react";
import { USOS_INMUEBLE } from "@/lib/inmuebles";
import { btnPrimaryClass, btnSecondaryClass, cardClass, inputClass, labelClass } from "@/components/formStyles";

export type DeudaOption = { id: string; nombre: string };

export type FichaInmueble = {
  id?: string;
  nombre: string;
  uso: string;
  direccion: string | null;
  superficie_m2: number | null;
  fecha_compra: string | null;
  precio_compra: number | null;
  gastos_compra: number;
  porcentaje_propiedad: number;
  deuda_id: string | null;
  fianza: number | null;
  ambito: string;
  notas: string | null;
};

// Formulario de la ficha, compartido por el alta y la edición. El valor actual solo se pide
// en el alta: después cambia con "Registrar valoración", que guarda el historial.
function CamposFicha({ ficha, deudas, conValor }: { ficha?: FichaInmueble; deudas: DeudaOption[]; conValor: boolean }) {
  const v = (n: number | null | undefined) => (n === null || n === undefined ? undefined : n);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <label className={labelClass}>Nombre</label>
        <input name="nombre" required defaultValue={ficha?.nombre} placeholder="Piso de la calle Mayor" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Uso</label>
        <select name="uso" defaultValue={ficha?.uso ?? "alquiler"} className={inputClass}>
          {USOS_INMUEBLE.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Dirección</label>
        <input name="direccion" defaultValue={ficha?.direccion ?? ""} placeholder="Opcional" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Superficie (m²)</label>
        <input name="superficie_m2" type="number" step="0.01" min="0" defaultValue={v(ficha?.superficie_m2)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Fecha de compra</label>
        <input name="fecha_compra" type="date" defaultValue={ficha?.fecha_compra ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Precio de compra</label>
        <input name="precio_compra" type="number" step="0.01" min="0" defaultValue={v(ficha?.precio_compra)} placeholder="Al 100 %" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Gastos de compra</label>
        <input name="gastos_compra" type="number" step="0.01" min="0" defaultValue={v(ficha?.gastos_compra)} placeholder="Notaría, impuestos…" className={inputClass} />
      </div>
      {conValor && (
        <div>
          <label className={labelClass}>Valor actual estimado</label>
          <input name="valor_actual" type="number" step="0.01" min="0" placeholder="Al 100 %" className={inputClass} />
          <p className="mt-1.5 text-xs text-ink-tertiary">Lo que valdría el inmueble entero hoy.</p>
        </div>
      )}
      <div>
        <label className={labelClass}>Tu parte (%)</label>
        <input
          name="porcentaje_propiedad"
          type="number"
          step="0.01"
          min="0.01"
          max="100"
          defaultValue={ficha?.porcentaje_propiedad ?? 100}
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-ink-tertiary">50 si es a medias con otra persona.</p>
      </div>
      <div>
        <label className={labelClass}>Hipoteca</label>
        <select name="deuda_id" defaultValue={ficha?.deuda_id ?? ""} className={inputClass}>
          <option value="">Sin hipoteca</option>
          {deudas.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-ink-tertiary">Una de tus deudas. Sus cuotas cuentan solas.</p>
      </div>
      <div>
        <label className={labelClass}>Fianza cobrada</label>
        <input name="fianza" type="number" step="0.01" min="0" defaultValue={v(ficha?.fianza)} placeholder="Si está alquilado" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Ámbito</label>
        <select name="ambito" defaultValue={ficha?.ambito ?? "personal"} className={inputClass}>
          <option value="personal">Personal</option>
          <option value="conjunto">Conjunto</option>
        </select>
      </div>
      <div className="sm:col-span-3">
        <label className={labelClass}>Notas</label>
        <input name="notas" defaultValue={ficha?.notas ?? ""} placeholder="Referencia catastral, inquilino, fin del contrato…" className={inputClass} />
      </div>
    </div>
  );
}

export function NuevoInmueble({ action, deudas }: { action: (formData: FormData) => void; deudas: DeudaOption[] }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={btnPrimaryClass}>
        + Nuevo inmueble
      </button>
    );
  }
  return (
    <form action={action} className={`${cardClass} space-y-5`}>
      <div className="flex items-center justify-between">
        <h2 className="font-sora text-base font-semibold text-ink">Nuevo inmueble</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-[13px] font-semibold text-ink-tertiary hover:text-ink">
          Cancelar
        </button>
      </div>
      <CamposFicha deudas={deudas} conValor />
      <button type="submit" className={btnPrimaryClass}>
        Guardar inmueble
      </button>
    </form>
  );
}

export function EditarFicha({
  action,
  ficha,
  deudas,
}: {
  action: (formData: FormData) => Promise<void>;
  ficha: FichaInmueble;
  deudas: DeudaOption[];
}) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={btnSecondaryClass}>
        Editar ficha
      </button>
    );
  }
  return (
    <form
      action={async (formData) => {
        await action(formData);
        setAbierto(false);
      }}
      className={`${cardClass} space-y-5`}
    >
      <input type="hidden" name="id" value={ficha.id} />
      <div className="flex items-center justify-between">
        <h2 className="font-sora text-base font-semibold text-ink">Editar ficha</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-[13px] font-semibold text-ink-tertiary hover:text-ink">
          Cancelar
        </button>
      </div>
      <CamposFicha ficha={ficha} deudas={deudas} conValor={false} />
      <button type="submit" className={btnPrimaryClass}>
        Guardar cambios
      </button>
    </form>
  );
}
