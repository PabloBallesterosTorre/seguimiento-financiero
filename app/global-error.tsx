"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring/client";

// Captura errores en el layout raíz (fuera del alcance de app/error.tsx). Sustituye
// <html>/<body> por completo, así que no puede depender de las fuentes/estilos
// normales de layout.tsx — solo estilos inline, para que funcione incluso si algo
// básico de la app se ha roto.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f9f9f7", color: "#0b0b0b" }}>
        <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div
            style={{
              width: "100%",
              maxWidth: "24rem",
              textAlign: "center",
              padding: "2rem",
              borderRadius: 12,
              border: "1px solid rgba(11,11,11,0.08)",
              background: "#ffffff",
              boxShadow: "0 1px 2px rgba(11,11,11,0.04)",
            }}
          >
            <h1 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>Algo ha ido muy mal</h1>
            <p style={{ fontSize: "0.8125rem", color: "#52514e", marginTop: 12 }}>
              La aplicación no ha podido cargar. Intenta recargar la página.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: 16,
                borderRadius: 8,
                background: "#0b0b0b",
                color: "#ffffff",
                padding: "10px 18px",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
