"use client";

import type { ReactNode } from "react";

// Formulario que pide confirmación explícita (con el texto que se le pase) antes de
// dejar pasar el submit — pensado para envolver botones de "Eliminar" y acciones con
// impacto real, para que un clic accidental no dispare la acción.
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
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(mensaje)) {
          e.preventDefault();
        }
      }}
      className={className}
    >
      {children}
    </form>
  );
}
