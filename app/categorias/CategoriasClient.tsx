"use client";

import { Fragment, useEffect, useState } from "react";
import { CategoriaForm } from "./CategoriaForm";
import { ConfirmForm } from "@/components/ConfirmForm";
import { formatMoneda } from "@/lib/formato";
import { btnPrimaryClass, btnSecondaryClass, cardClass, tableWrapClass, rowLinkClass, rowDelClass } from "@/components/formStyles";

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
  crearCategoriasSugeridas,
  obtenerMovimientosDeCategoria,
  moneda = "EUR",
}: {
  categorias: Categoria[];
  crearCategoria: (formData: FormData) => void;
  actualizarCategoria: (formData: FormData) => void;
  eliminarCategoria: (formData: FormData) => void;
  crearCategoriasSugeridas: () => void;
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
    <div className="space-y-6">
      {abierto === "nueva" ? (
        <div className={cardClass}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-sora text-base font-semibold text-ink">Añadir categoría</h2>
            <button type="button" onClick={() => setAbierto(null)} className="text-[13px] font-semibold text-ink-tertiary hover:text-ink">
              Cancelar
            </button>
          </div>
          <CategoriaForm padres={padres} action={crearCategoria} onCancelar={() => setAbierto(null)} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => setAbierto("nueva")} className={btnPrimaryClass}>
            + Nueva categoría
          </button>
          {categorias.length === 0 && (
            <form action={crearCategoriasSugeridas}>
              <button type="submit" className={btnSecondaryClass}>
                Usar categorías sugeridas
              </button>
            </form>
          )}
        </div>
      )}

      <div className={tableWrapClass}>
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
                    <tr className="border-t border-border bg-page">
                      <td colSpan={3} className="px-5 py-5">
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
                        <tr className="border-t border-border bg-page">
                          <td colSpan={3} className="px-5 py-5">
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
                <td colSpan={3} className="px-4 py-6 text-center text-ink-tertiary">
                  Todavía no hay categorías. Puedes crearlas una a una o usar &quot;Usar categorías
                  sugeridas&quot; arriba para partir de una plantilla editable.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
    <tr className="border-t border-border first:border-t-0">
      <td className={`px-5 py-3.5 ${indentada ? "pl-10 text-[13px] text-ink-tertiary" : "text-sm text-ink"}`}>
        {categoria.nombre}
      </td>
      <td className="px-5 py-3.5">
        {categoria.es_categoria_inversion && (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
            Inversión
          </span>
        )}
      </td>
      <td className="px-5 py-3.5 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => setAbierto(abierto === categoria.id ? null : categoria.id)}
          className={`mr-3.5 ${rowLinkClass}`}
        >
          Editar
        </button>
        <ConfirmForm
          action={eliminarCategoria}
          mensaje={`¿Seguro que quieres eliminar la categoría "${categoria.nombre}"? Los movimientos que la usaban se quedarán sin categoría.`}
          className="inline"
        >
          <input type="hidden" name="id" value={categoria.id} />
          <button className={rowDelClass} type="submit">
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
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-tertiary">
          Movimientos asociados
          {categoria.categoria_padre_id === null && " (incluye subcategorías)"}
        </h3>
        {cargando ? (
          <p className="text-sm text-ink-tertiary">Cargando…</p>
        ) : !movimientos || movimientos.length === 0 ? (
          <p className="text-sm text-ink-tertiary">No hay movimientos en esta categoría.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-btn border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-ink-tertiary">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">Cuenta</th>
                  <th className="px-3 py-2 font-semibold">Descripción</th>
                  <th className="px-3 py-2 text-right font-semibold">Importe</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-1.5 text-ink-tertiary">{formatFecha(m.fecha)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-ink-tertiary">
                      {m.cuentas ? `${m.cuentas.banco_nombre} — ${m.cuentas.nombre}` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-ink">{m.descripcion}</td>
                    <td
                      className={`whitespace-nowrap px-3 py-1.5 text-right font-semibold ${
                        Number(m.importe) < 0 ? "text-ink" : "text-success"
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
