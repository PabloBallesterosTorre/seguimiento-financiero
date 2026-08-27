"use client";

import { useRef } from "react";
import { sugerirCategoria, type ReglaCategorizacion } from "@/lib/categorizacion";
import type { CategoriaJerarquica } from "@/lib/categorias";
import { inputClass, labelClass, btnPrimaryClass } from "@/components/formStyles";

type Cuenta = { id: string; nombre: string; banco_nombre: string };

export function MovimientoForm({
  action,
  cuentas,
  categorias,
  reglas,
  hoy,
}: {
  action: (formData: FormData) => void;
  cuentas: Cuenta[];
  categorias: CategoriaJerarquica[];
  reglas: ReglaCategorizacion[];
  hoy: string;
}) {
  const categoriaRef = useRef<HTMLSelectElement>(null);

  function onDescripcionChange(descripcion: string) {
    const sugerida = sugerirCategoria(descripcion, reglas);
    if (sugerida && categoriaRef.current) {
      categoriaRef.current.value = sugerida;
    }
  }

  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <label className={labelClass}>Fecha</label>
        <input name="fecha" type="date" required defaultValue={hoy} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Cuenta</label>
        <select name="cuenta_id" required className={inputClass}>
          {cuentas.map((cuenta) => (
            <option key={cuenta.id} value={cuenta.id}>
              {cuenta.banco_nombre} — {cuenta.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Tipo</label>
        <select name="tipo" className={inputClass}>
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Importe</label>
        <input name="importe" type="number" step="0.01" min="0" required placeholder="0.00" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Categoría</label>
        <select ref={categoriaRef} name="categoria_id" defaultValue="" className={inputClass}>
          <option value="">Sin categoría</option>
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Descripción</label>
        <input
          name="descripcion"
          required
          placeholder="Mercadona"
          onChange={(e) => onDescripcionChange(e.target.value)}
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-ink-tertiary">
          La categoría se sugiere sola si ya has categorizado algo parecido antes.
        </p>
      </div>
      <div className="sm:col-span-3">
        <button type="submit" className={btnPrimaryClass}>
          Añadir movimiento
        </button>
      </div>
    </form>
  );
}
