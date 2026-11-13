"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ConfirmForm } from "@/components/ConfirmForm";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
  rowDelClass,
  rowLinkClass,
} from "@/components/formStyles";
import { LONGITUD_MINIMA_PATRON } from "@/lib/etiquetas";

export type EtiquetaEnGestion = { id: string; nombre: string; patron: string | null; usos: number };

type Resultado = { ok: boolean; error?: string };

// Tanda 15: alta, edición y borrado de etiquetas. Vive en la página de Categorías porque es
// el sitio donde se organiza "cómo clasifico mis movimientos"; las etiquetas se ponen y se
// filtran desde Movimientos.
export function EtiquetasGestion({
  etiquetas,
  crearEtiqueta,
  editarEtiqueta,
  eliminarEtiqueta,
  aplicarEtiquetaAExistentes,
}: {
  etiquetas: EtiquetaEnGestion[];
  crearEtiqueta: (formData: FormData) => Promise<Resultado>;
  editarEtiqueta: (formData: FormData) => Promise<Resultado>;
  eliminarEtiqueta: (formData: FormData) => void;
  aplicarEtiquetaAExistentes: (formData: FormData) => Promise<{ etiquetados: number }>;
}) {
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const formulario = (etiqueta: EtiquetaEnGestion | null) => (
    <form
      action={(formData) =>
        startTransition(async () => {
          const r = etiqueta ? await editarEtiqueta(formData) : await crearEtiqueta(formData);
          if (!r.ok) {
            setError(r.error ?? "No se ha podido guardar.");
            return;
          }
          setError(null);
          setCreando(false);
          setEditando(null);
        })
      }
      className="grid grid-cols-1 gap-4 rounded-card border border-border bg-page p-5 sm:grid-cols-[1fr_1fr_auto]"
    >
      {etiqueta && <input type="hidden" name="id" value={etiqueta.id} />}
      <div>
        <label className={labelClass}>Nombre</label>
        <input
          name="nombre"
          required
          defaultValue={etiqueta?.nombre ?? ""}
          placeholder="Viaje a Japón"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Ponerla sola si el concepto contiene</label>
        <input name="patron" defaultValue={etiqueta?.patron ?? ""} placeholder="Opcional" className={inputClass} />
        <p className="mt-1.5 text-xs text-ink-tertiary">
          Al importar o crear movimientos. Sin distinguir mayúsculas ni acentos; mínimo {LONGITUD_MINIMA_PATRON} letras.
        </p>
      </div>
      <div className="flex items-start gap-2 sm:pt-6">
        <button type="submit" disabled={pendiente} className={btnPrimaryClass}>
          Guardar
        </button>
        <button
          type="button"
          onClick={() => {
            setCreando(false);
            setEditando(null);
            setError(null);
          }}
          className={btnSecondaryClass}
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-sm text-danger sm:col-span-3">{error}</p>}
    </form>
  );

  return (
    <div id="etiquetas" className={`${cardClass} scroll-mt-6 space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-sora text-base font-semibold text-ink">Etiquetas</h2>
          <p className="text-[13px] text-ink-tertiary">
            La categoría dice qué es un gasto; la etiqueta, para qué fue. Un movimiento puede llevar varias.
          </p>
        </div>
        {!creando && (
          <button
            type="button"
            onClick={() => {
              setCreando(true);
              setEditando(null);
              setError(null);
            }}
            className={btnSecondaryClass}
          >
            + Nueva etiqueta
          </button>
        )}
      </div>

      {creando && formulario(null)}
      {aviso && <p className="text-sm text-success">{aviso}</p>}

      {etiquetas.length === 0 && !creando ? (
        <p className="text-sm text-ink-tertiary">
          Todavía no tienes etiquetas. Sirven para juntar los gastos de un viaje, una reforma o el coche, aunque
          sean de categorías distintas.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {etiquetas.map((e) =>
            editando === e.id ? (
              <li key={e.id} className="py-3">
                {formulario(e)}
              </li>
            ) : (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/movimientos?etiqueta=${e.id}`}
                    className="font-semibold text-ink hover:underline"
                  >
                    {e.nombre}
                  </Link>
                  <p className="text-[11px] text-ink-tertiary">
                    {e.usos} {e.usos === 1 ? "movimiento" : "movimientos"}
                    {e.patron && <> · se pone sola si el concepto contiene “{e.patron}”</>}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {e.patron && (
                    <form
                      action={(formData) =>
                        startTransition(async () => {
                          const r = await aplicarEtiquetaAExistentes(formData);
                          setAviso(
                            r.etiquetados === 0
                              ? `Ningún movimiento nuevo para “${e.nombre}”.`
                              : `“${e.nombre}” puesta en ${r.etiquetados} ${r.etiquetados === 1 ? "movimiento" : "movimientos"} más.`
                          );
                        })
                      }
                    >
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" disabled={pendiente} className={rowLinkClass}>
                        Aplicar a los ya importados
                      </button>
                    </form>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(e.id);
                      setCreando(false);
                      setError(null);
                    }}
                    className={rowLinkClass}
                  >
                    Editar
                  </button>
                  <ConfirmForm
                    action={eliminarEtiqueta}
                    mensaje={`¿Eliminar la etiqueta "${e.nombre}"? Se quitará de sus ${e.usos} movimientos; los movimientos no se borran.`}
                    className="inline"
                  >
                    <input type="hidden" name="id" value={e.id} />
                    <button type="submit" className={rowDelClass}>
                      Eliminar
                    </button>
                  </ConfirmForm>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
