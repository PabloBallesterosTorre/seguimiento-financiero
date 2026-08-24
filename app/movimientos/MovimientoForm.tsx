"use client";

import { useRef } from "react";
import { sugerirCategoria, type ReglaCategorizacion } from "@/lib/categorizacion";

type Cuenta = { id: string; nombre: string; banco_nombre: string };
type Categoria = { id: string; nombre: string };

export function MovimientoForm({
  action,
  cuentas,
  categoriasGasto,
  categoriasIngreso,
  reglas,
  hoy,
}: {
  action: (formData: FormData) => void;
  cuentas: Cuenta[];
  categoriasGasto: Categoria[];
  categoriasIngreso: Categoria[];
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
        <label className="block text-xs text-slate-500">Fecha</label>
        <input
          name="fecha"
          type="date"
          required
          defaultValue={hoy}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Cuenta</label>
        <select
          name="cuenta_id"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {cuentas.map((cuenta) => (
            <option key={cuenta.id} value={cuenta.id}>
              {cuenta.banco_nombre} — {cuenta.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500">Tipo</label>
        <select name="tipo" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500">Importe</label>
        <input
          name="importe"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="0.00"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Categoría</label>
        <select
          ref={categoriaRef}
          name="categoria_id"
          defaultValue=""
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Sin categoría</option>
          {categoriasGasto.length > 0 && (
            <optgroup label="Gastos">
              {categoriasGasto.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </optgroup>
          )}
          {categoriasIngreso.length > 0 && (
            <optgroup label="Ingresos">
              {categoriasIngreso.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs text-slate-500">Descripción</label>
        <input
          name="descripcion"
          required
          placeholder="Mercadona"
          onChange={(e) => onDescripcionChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-slate-400">
          La categoría se sugiere sola si ya has categorizado algo parecido antes.
        </p>
      </div>
      <div className="sm:col-span-3">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Añadir movimiento
        </button>
      </div>
    </form>
  );
}
