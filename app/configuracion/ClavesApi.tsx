"use client";

import { useEffect, useState, useTransition } from "react";
import { ConfirmForm } from "@/components/ConfirmForm";
import { btnPrimaryClass, cardClass, inputClass, labelClass, rowDelClass } from "@/components/formStyles";
import type { ClaveApi } from "./accionesClaves";

function formatFecha(valor: string | null) {
  if (!valor) return "nunca";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(valor));
}

// Tanda 17: claves personales para usar la app desde Claude Code (servidor MCP).
export function ClavesApi({
  claves,
  crearClave,
  revocarClave,
}: {
  claves: ClaveApi[];
  crearClave: (formData: FormData) => Promise<{ ok: boolean; clave?: string; error?: string }>;
  revocarClave: (formData: FormData) => void;
}) {
  const [nueva, setNueva] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [origen, setOrigen] = useState("https://<tu-dominio>");
  const [pendiente, startTransition] = useTransition();

  useEffect(() => setOrigen(window.location.origin), []);

  const comando = `claude mcp add --transport http finanzas ${origen}/api/mcp --header "Authorization: Bearer ${nueva ?? "sf_..."}"`;

  const copiar = async (texto: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const activas = claves.filter((c) => !c.revocada_at);
  const revocadas = claves.filter((c) => c.revocada_at);

  return (
    <div className="max-w-3xl space-y-6">
      <div className={`${cardClass} space-y-4`}>
        <div>
          <h2 className="font-sora text-base font-semibold text-ink">Usar la app desde Claude</h2>
          <p className="mt-1 text-[13px] text-ink-tertiary">
            Crea una clave y añádela a Claude Code. Podrás preguntarle por tus saldos, gastos, inversiones o deudas
            y, si la clave lo permite, apuntar movimientos. Cada clave se puede revocar cuando quieras.
          </p>
        </div>

        <form
          action={(formData) =>
            startTransition(async () => {
              const r = await crearClave(formData);
              if (!r.ok) {
                setError(r.error ?? "No se ha podido crear la clave.");
                return;
              }
              setError(null);
              setNueva(r.clave ?? null);
            })
          }
          className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        >
          <div>
            <label className={labelClass}>Nombre</label>
            <input name="nombre" required placeholder="Portátil" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Permiso</label>
            <select name="permiso" defaultValue="lectura" className={inputClass}>
              <option value="lectura">Solo consultar</option>
              <option value="escritura">Consultar y apuntar</option>
            </select>
          </div>
          <button type="submit" disabled={pendiente} className={btnPrimaryClass}>
            Crear clave
          </button>
          {error && <p className="text-sm text-danger sm:col-span-3">{error}</p>}
        </form>

        {nueva && (
          <div className="space-y-3 rounded-card border border-forecast/40 bg-forecast/10 p-4">
            <p className="text-[13px] font-semibold text-ink">
              Copia la clave ahora: no se volverá a mostrar. Si la pierdes, revócala y crea otra.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1.5 font-mono text-[13px] text-ink">
                {nueva}
              </code>
              <button type="button" onClick={() => copiar(nueva)} className="text-[13px] font-semibold text-accent">
                {copiado ? "Copiada" : "Copiar"}
              </button>
            </div>
            <p className="text-[13px] text-ink-secondary">Para añadirla a Claude Code, ejecuta en una terminal:</p>
            <div className="flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-surface px-2 py-1.5 font-mono text-[12px] text-ink">
                {comando}
              </code>
              <button type="button" onClick={() => copiar(comando)} className="text-[13px] font-semibold text-accent">
                Copiar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`${cardClass} space-y-3`}>
        <h3 className="text-[13px] font-semibold text-ink-secondary">Claves activas</h3>
        {activas.length === 0 ? (
          <p className="text-sm text-ink-tertiary">Ninguna.</p>
        ) : (
          <ul className="divide-y divide-border">
            {activas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-ink">
                    {c.nombre}
                    <span className="ml-2 font-mono text-[12px] font-normal text-ink-tertiary">{c.prefijo}…</span>
                  </p>
                  <p className="text-[11px] text-ink-tertiary">
                    {c.permiso === "escritura" ? "Consultar y apuntar" : "Solo consultar"} · creada{" "}
                    {formatFecha(c.created_at)} · último uso {formatFecha(c.ultimo_uso)}
                  </p>
                </div>
                <ConfirmForm
                  action={revocarClave}
                  mensaje={`¿Revocar la clave "${c.nombre}"? Claude dejará de poder usarla en cuanto la revoques. No se puede deshacer.`}
                  className="inline"
                >
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className={rowDelClass}>
                    Revocar
                  </button>
                </ConfirmForm>
              </li>
            ))}
          </ul>
        )}
        {revocadas.length > 0 && (
          <p className="text-[11px] text-ink-tertiary">
            {revocadas.length} {revocadas.length === 1 ? "clave revocada" : "claves revocadas"}.
          </p>
        )}
      </div>
    </div>
  );
}
