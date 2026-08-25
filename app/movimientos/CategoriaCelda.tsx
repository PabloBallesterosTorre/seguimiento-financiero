"use client";

import { useRef } from "react";
import type { CategoriaJerarquica } from "@/lib/categorias";

export function CategoriaCelda({
  movimientoId,
  descripcion,
  categoriaId,
  categorias,
  action,
  sugeridaId,
}: {
  movimientoId: string;
  descripcion: string;
  categoriaId: string | null;
  categorias: CategoriaJerarquica[];
  action: (formData: FormData) => void;
  sugeridaId?: string | null;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const sugerida = !categoriaId && sugeridaId ? categorias.find((c) => c.id === sugeridaId) : null;

  return (
    <form action={action}>
      <input type="hidden" name="id" value={movimientoId} />
      <input type="hidden" name="descripcion" value={descripcion} />
      <select
        ref={selectRef}
        name="categoria_id"
        defaultValue={categoriaId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-sm text-slate-600 hover:border-slate-300 focus:border-slate-300"
      >
        <option value="">Sin categoría</option>
        {categorias.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.label}
          </option>
        ))}
      </select>
      {sugerida && (
        <button
          type="button"
          onClick={() => {
            if (selectRef.current) {
              selectRef.current.value = sugerida.id;
              selectRef.current.form?.requestSubmit();
            }
          }}
          className="mt-0.5 block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-200"
        >
          Sugerida: {sugerida.nombre}
        </button>
      )}
    </form>
  );
}
