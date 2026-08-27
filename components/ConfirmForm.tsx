"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Formulario que pide confirmación explícita (con el texto que se le pase) antes de
// dejar pasar el submit — pensado para envolver botones de "Eliminar" y acciones con
// impacto real, para que un clic accidental no dispare la acción. El modal usa el
// estilo propio de la app en vez del confirm() nativo del navegador.
export function ConfirmForm({
  action,
  mensaje,
  children,
  className,
}: {
  action: (formData: FormData) => void;
  mensaje: string;
  children: ReactNode;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmadoRef = useRef(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto]);

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={(e) => {
          if (confirmadoRef.current) {
            confirmadoRef.current = false;
            return;
          }
          e.preventDefault();
          setAbierto(true);
        }}
        className={className}
      >
        {children}
      </form>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
          onClick={() => setAbierto(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-card bg-surface p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-ink-secondary">{mensaje}</p>
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-btn border border-border-strong bg-surface px-[18px] py-2.5 text-sm font-semibold text-ink-secondary hover:bg-chip"
              >
                Cancelar
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  confirmadoRef.current = true;
                  setAbierto(false);
                  formRef.current?.requestSubmit();
                }}
                className="rounded-btn bg-danger px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-danger/90"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
