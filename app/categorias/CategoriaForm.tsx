"use client";

type Categoria = {
  id: string;
  nombre: string;
  categoria_padre_id: string | null;
  es_categoria_inversion: boolean;
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
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      {categoria && <input type="hidden" name="id" value={categoria.id} />}
      <div>
        <label className="block text-xs text-slate-500">Nombre</label>
        <input
          name="nombre"
          required
          defaultValue={categoria?.nombre}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Alimentación"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Categoría padre (opcional)</label>
        <select
          name="categoria_padre_id"
          defaultValue={categoria?.categoria_padre_id ?? ""}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Ninguna — categoría principal</option>
          {padresDisponibles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="es_categoria_inversion"
            defaultChecked={categoria?.es_categoria_inversion}
          />
          Es aportación a inversión
        </label>
      </div>

      <div className="flex gap-3 sm:col-span-3">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {categoria ? "Guardar cambios" : "Añadir categoría"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
