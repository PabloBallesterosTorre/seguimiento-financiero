"use client";

import type { CategoriaJerarquica } from "@/lib/categorias";

export function CategoriaCelda({
  movimientoId,
  descripcion,
  categoriaId,
  categorias,
  action,
}: {
  movimientoId: string;
  descripcion: string;
  categoriaId: string | null;
  categorias: CategoriaJerarquica[];
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={movimientoId} />
      <input type="hidden" name="descripcion" value={descripcion} />
      <select
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
    </form>
  );
}
