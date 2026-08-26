"use client";

import { Fragment, useEffect, useState } from "react";
import { CategoriaForm } from "./CategoriaForm";
import { ConfirmForm } from "@/components/ConfirmForm";
import { formatMoneda } from "@/lib/formato";

type Categoria = {
  id: string;
  nombre: string;
  categoria_padre_id: string | null;
  es_categoria_inversion: boolean;
};

type MovimientoAsociado = {
  id: string;
  fecha: string;
  descripcion: string;
  importe: number;
  tipo: string;
  cuentas: { nombre: string; banco_nombre: string } | null;
};

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

export function CategoriasClient({
  categorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  obtenerMovimientosDeCategoria,
  moneda = "EUR",
}: {
  categorias: Categoria[];
  crearCategoria: (formData: FormData) => void;
  actualizarCategoria: (formData: FormData) => void;
  eliminarCategoria: (formData: FormData) => void;
  obtenerMovimientosDeCategoria: (categoriaIds: string[]) => Promise<MovimientoAsociado[]>;
  moneda?: string;
}) {
  const [abierto, setAbierto] = useState<"nueva" | string | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoAsociado[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const padres = categorias.filter((c) => c.categoria_padre_id === null);
  const formatEUR = (v: number) => formatMoneda(v, moneda);

  useEffect(() => {
    if (!abierto || abierto === "nueva") {
      setMovimientos(null);
      return;
    }

    const categoria = categorias.find((c) => c.id === abierto);
    if (!categoria) return;

    const esPadre = categoria.categoria_padre_id === null;
    const ids = esPadre
      ? [categoria.id, ...categorias.filter((c) => c.categoria_padre_id === categoria.id).map((c) => c.id)]
      : [categoria.id];

    setCargando(true);
    obtenerMovimientosDeCategoria(ids)
      .then(setMovimientos)
      .finally(() => setCargando(false));
  }, [abierto, categorias, obtenerMovimientosDeCategoria]);

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <tbody>
            {padres.map((cat) => {
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
                        <DetalleCategoria
                          categoria={cat}
                          padres={padres}
                          actualizarCategoria={actualizarCategoria}
                          onCancelar={() => setAbierto(null)}
                          movimientos={movimientos}
                          cargando={cargando}
                          formatEUR={formatEUR}
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
                            <DetalleCategoria
                              categoria={sub}
                              padres={padres}
                              actualizarCategoria={actualizarCategoria}
                              onCancelar={() => setAbierto(null)}
                              movimientos={movimientos}
                              cargando={cargando}
                              formatEUR={formatEUR}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </Fragment>
              );
            })}
            {padres.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  Todavía no hay categorías.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
        <ConfirmForm
          action={eliminarCategoria}
          mensaje={`¿Seguro que quieres eliminar la categoría "${categoria.nombre}"? Los movimientos que la usaban se quedarán sin categoría.`}
          className="inline"
        >
          <input type="hidden" name="id" value={categoria.id} />
          <button className="text-slate-400 hover:text-red-600" type="submit">
            Eliminar
          </button>
        </ConfirmForm>
      </td>
    </tr>
  );
}

function DetalleCategoria({
  categoria,
  padres,
  actualizarCategoria,
  onCancelar,
  movimientos,
  cargando,
  formatEUR,
}: {
  categoria: Categoria;
  padres: Categoria[];
  actualizarCategoria: (formData: FormData) => void;
  onCancelar: () => void;
  movimientos: MovimientoAsociado[] | null;
  cargando: boolean;
  formatEUR: (v: number) => string;
}) {
  return (
    <div className="space-y-4">
      <CategoriaForm categoria={categoria} padres={padres} action={actualizarCategoria} onCancelar={onCancelar} />
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Movimientos asociados
          {categoria.categoria_padre_id === null && " (incluye subcategorías)"}
        </h3>
        {cargando ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : !movimientos || movimientos.length === 0 ? (
          <p className="text-sm text-slate-400">No hay movimientos en esta categoría.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Cuenta</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{formatFecha(m.fecha)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">
                      {m.cuentas ? `${m.cuentas.banco_nombre} — ${m.cuentas.nombre}` : "—"}
                    </td>
                    <td className="px-3 py-1.5">{m.descripcion}</td>
                    <td
                      className={`whitespace-nowrap px-3 py-1.5 text-right font-medium ${
                        Number(m.importe) < 0 ? "text-slate-900" : "text-emerald-600"
                      }`}
                    >
                      {formatEUR(Number(m.importe))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
