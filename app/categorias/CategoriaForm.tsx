"use client";

import { inputClass, labelClass, btnPrimaryClass, btnSecondaryClass } from "@/components/formStyles";
import type { Bloque } from "@/lib/regla503020";

type Categoria = {
  id: string;
  nombre: string;
  categoria_padre_id: string | null;
  es_categoria_inversion: boolean;
  bloque: Bloque | null;
};

type CategoriaPadre = { id: string; nombre: string };

export function CategoriaForm({
  categoria,
  padres,
  action,
  onCancelar,
}: {
  categoria?: Categoria;
  padres: CategoriaPadre[];
  action: (formData: FormData) => void;
  onCancelar: () => void;
}) {
  const padresDisponibles = padres.filter((p) => p.id !== categoria?.id);

  return (
    <form
      action={async (formData) => {
        await action(formData);
        onCancelar();
      }}
      className="grid grid-cols-1 items-end gap-4 sm:grid-cols-4"
    >
      {categoria && <input type="hidden" name="id" value={categoria.id} />}
      <div>
        <label className={labelClass}>Nombre</label>
        <input name="nombre" required defaultValue={categoria?.nombre} className={inputClass} placeholder="Alimentación" />
      </div>
      <div>
        <label className={labelClass}>Categoría padre (opcional)</label>
        <select name="categoria_padre_id" defaultValue={categoria?.categoria_padre_id ?? ""} className={inputClass}>
          <option value="">Ninguna — categoría principal</option>
          {padresDisponibles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Bloque en la regla 50/30/20</label>
        <select name="bloque" defaultValue={categoria?.bloque ?? ""} className={inputClass}>
          <option value="">Sin bloque (hereda el del padre)</option>
          <option value="ingreso">Ingreso</option>
          <option value="necesario">Necesario</option>
          <option value="capricho">Capricho</option>
        </select>
      </div>
      <div className="flex items-center pb-2.5">
        <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[13px] text-ink-secondary">
          <input type="checkbox" name="es_categoria_inversion" defaultChecked={categoria?.es_categoria_inversion} className="h-4 w-4" />
          Es aportación a inversión
        </label>
      </div>
      <p className="text-[12px] text-ink-tertiary sm:col-span-4">
        Las aportaciones a inversión cuentan siempre como Ahorro, sea cual sea el bloque.
      </p>

      <div className="flex gap-2.5 sm:col-span-4">
        <button type="submit" className={btnPrimaryClass}>
          {categoria ? "Guardar cambios" : "Añadir categoría"}
        </button>
        <button type="button" onClick={onCancelar} className={btnSecondaryClass}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
