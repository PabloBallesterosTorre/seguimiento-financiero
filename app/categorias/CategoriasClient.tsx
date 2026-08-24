"use client";

import { Fragment, useState } from "react";
import { CategoriaForm } from "./CategoriaForm";

type Categoria = {
  id: string;
  nombre: string;
  tipo: string;
  categoria_padre_id: string | null;
  es_categoria_inversion: boolean;
};

export function CategoriasClient({
  categorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
}: {
  categorias: Categoria[];
  crearCategoria: (formData: FormData) => void;
  actualizarCategoria: (formData: FormData) => void;
  eliminarCategoria: (formData: FormData) => void;
}) {
  const [abierto, setAbierto] = useState<"nueva" | string | null>(null);
  const padres = categorias.filter((c) => c.categoria_padre_id === null);

  function grupo(tipo: "gasto" | "ingreso", titulo: string) {
    const principales = categorias.filter((c) => c.tipo === tipo && c.categoria_padre_id === null);

    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-700">{titulo}</h2>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {principales.map((cat) => {
              const subcategorias = categorias.filter((c) => c.categoria_padre_id === cat.id);
              return (
                <Fragment key={cat.id}>
                  <FilaCategoria
                    categoria={cat}
                    indentada={false}
                    abierto={abierto}
                    setAbierto={setAbierto}
                    eliminarCategoria={eliminarCategoria}
                  />
                  {abierto === cat.id && (
                    <tr className="border-t border-slate-100 bg-slate-50">
                      <td colSpan={3} className="px-4 py-4">
                        <CategoriaForm
                          categoria={cat}
                          padres={padres}
                          action={actualizarCategoria}
                          onCancelar={() => setAbierto(null)}
                        />
                      </td>
                    </tr>
                  )}
                  {subcategorias.map((sub) => (
                    <Fragment key={sub.id}>
                      <FilaCategoria
                        categoria={sub}
                        indentada
                        abierto={abierto}
                        setAbierto={setAbierto}
                        eliminarCategoria={eliminarCategoria}
                      />
                      {abierto === sub.id && (
                        <tr className="border-t border-slate-100 bg-slate-50">
                          <td colSpan={3} className="px-4 py-4">
                            <CategoriaForm
                              categoria={sub}
                              padres={padres}
                              action={actualizarCategoria}
                              onCancelar={() => setAbierto(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </Fragment>
              );
            })}
            {principales.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  Todavía no hay categorías de {titulo.toLowerCase()}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {grupo("gasto", "Gastos")}
      {grupo("ingreso", "Ingresos")}

      {abierto === "nueva" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-slate-700">Añadir categoría</h2>
          <CategoriaForm padres={padres} action={crearCategoria} onCancelar={() => setAbierto(null)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto("nueva")}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva categoría
        </button>
      )}
    </div>
  );
}

function FilaCategoria({
  categoria,
  indentada,
  abierto,
  setAbierto,
  eliminarCategoria,
}: {
  categoria: Categoria;
  indentada: boolean;
  abierto: "nueva" | string | null;
  setAbierto: (v: "nueva" | string | null) => void;
  eliminarCategoria: (formData: FormData) => void;
}) {
  return (
    <tr className="border-t border-slate-100">
      <td className={`px-4 py-2 ${indentada ? "pl-10 text-slate-500" : ""}`}>{categoria.nombre}</td>
      <td className="px-4 py-2">
        {categoria.es_categoria_inversion && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
            Inversión
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => setAbierto(abierto === categoria.id ? null : categoria.id)}
          className="mr-3 text-slate-500 hover:text-slate-900"
        >
          Editar
        </button>
        <form action={eliminarCategoria} className="inline">
          <input type="hidden" name="id" value={categoria.id} />
          <button className="text-slate-400 hover:text-red-600" type="submit">
            Eliminar
          </button>
        </form>
      </td>
    </tr>
  );
}
