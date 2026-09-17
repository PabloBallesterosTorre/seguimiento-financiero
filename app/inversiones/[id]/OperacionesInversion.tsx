"use client";

import { useState } from "react";
import Link from "next/link";
import { ConfirmForm } from "@/components/ConfirmForm";
import { formatMoneda } from "@/lib/formato";
import { inputClass, labelClass, btnPrimaryClass, btnSecondaryClass, rowDelClass } from "@/components/formStyles";

export type OperacionEnTabla = {
  id: string;
  fecha: string;
  tipo: string;
  importe: number;
  participaciones: number | null;
  precio: number | null;
  comision: number;
  nota: string | null;
  origen: string;
  movimiento_id: string | null;
};

const TIPOS: { value: string; label: string; ayuda: string }[] = [
  { value: "compra", label: "Compra", ayuda: "Dinero que entra y compra participaciones." },
  { value: "venta", label: "Venta", ayuda: "Participaciones que salen y devuelven dinero." },
  { value: "aportacion", label: "Aportación", ayuda: "Dinero que entra sin participaciones (un depósito, un producto opaco)." },
  { value: "retirada", label: "Retirada", ayuda: "Dinero que sale sin vender participaciones." },
  { value: "dividendo", label: "Dividendo", ayuda: "Reparto cobrado en efectivo: sale de la inversión y llega a la cuenta." },
  { value: "ajuste", label: "Ajuste", ayuda: "Corrección manual del libro (un split, un traspaso entre fondos)." },
];

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

export function OperacionesInversion({
  inversionId,
  operaciones,
  moneda,
  hoy,
  registrarOperacion,
  eliminarOperacion,
}: {
  inversionId: string;
  operaciones: OperacionEnTabla[];
  moneda: string;
  hoy: string;
  registrarOperacion: (formData: FormData) => void;
  eliminarOperacion: (formData: FormData) => void;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState("compra");

  const ayudaTipo = TIPOS.find((t) => t.value === tipo)?.ayuda;
  const pideParticipaciones = tipo === "compra" || tipo === "venta" || tipo === "ajuste";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-sora text-base font-semibold text-ink">Operaciones</h2>
        {!abierto && (
          <button type="button" onClick={() => setAbierto(true)} className={btnSecondaryClass}>
            + Registrar operación
          </button>
        )}
      </div>

      {abierto && (
        <form
          action={async (formData) => {
            await registrarOperacion(formData);
            setAbierto(false);
          }}
          className="grid grid-cols-1 gap-4 rounded-card border border-border bg-page p-5 sm:grid-cols-3"
        >
          <input type="hidden" name="inversion_id" value={inversionId} />
          <div>
            <label className={labelClass}>Tipo</label>
            <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputClass}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {ayudaTipo && <p className="mt-1.5 text-xs text-ink-tertiary">{ayudaTipo}</p>}
          </div>
          <div>
            <label className={labelClass}>Fecha</label>
            <input name="fecha" type="date" required defaultValue={hoy} max={hoy} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Importe</label>
            <input name="importe" type="number" step="0.01" min="0" required className={inputClass} />
            {/* El signo lo pone el tipo de operación, no el usuario: pedirle que teclee un
                negativo para una venta es una fuente de errores gratuita. */}
            <p className="mt-1.5 text-xs text-ink-tertiary">En positivo. El signo lo pone el tipo de operación.</p>
          </div>

          {pideParticipaciones && (
            <>
              <div>
                <label className={labelClass}>Participaciones</label>
                <input name="participaciones" type="number" step="0.00000001" min="0" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Precio por participación</label>
                <input name="precio" type="number" step="0.000001" min="0" className={inputClass} />
                <p className="mt-1.5 text-xs text-ink-tertiary">
                  Si lo rellenas, revaloriza toda la posición a esa fecha.
                </p>
              </div>
            </>
          )}

          <div>
            <label className={labelClass}>Comisión</label>
            <input name="comision" type="number" step="0.01" min="0" className={inputClass} />
          </div>
          <div className="sm:col-span-3">
            <label className={labelClass}>Nota</label>
            <input name="nota" placeholder="Opcional" className={inputClass} />
          </div>

          <div className="flex gap-3 sm:col-span-3">
            <button type="submit" className={btnPrimaryClass}>
              Guardar operación
            </button>
            <button type="button" onClick={() => setAbierto(false)} className={btnSecondaryClass}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Tipo</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Participaciones</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Precio</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Importe</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Origen</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {operaciones.map((op) => (
              <tr key={op.id} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-3 text-ink-secondary">{formatFecha(op.fecha)}</td>
                <td className="px-4 py-3">
                  <span className="capitalize text-ink">{op.tipo}</span>
                  {op.nota && <p className="text-[11px] text-ink-tertiary">{op.nota}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-ink-secondary">
                  {op.participaciones !== null
                    ? op.participaciones.toLocaleString("es-ES", { maximumFractionDigits: 6 })
                    : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-ink-secondary">
                  {op.precio !== null ? formatEUR(op.precio) : "—"}
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                    op.importe >= 0 ? "text-ink" : "text-success"
                  }`}
                >
                  {op.importe >= 0 ? "" : "+"}
                  {formatEUR(Math.abs(op.importe))}
                  {op.comision > 0 && (
                    <p className="text-[11px] font-normal text-ink-tertiary">
                      incl. {formatEUR(op.comision)} de comisión
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[11px] text-ink-tertiary">
                  {op.movimiento_id ? (
                    <Link href="/movimientos" className="font-semibold text-accent hover:underline">
                      Del extracto
                    </Link>
                  ) : (
                    <span className="capitalize">{op.origen}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <ConfirmForm
                    action={eliminarOperacion}
                    mensaje="¿Seguro que quieres eliminar esta operación? El movimiento del extracto no se borra, solo deja de contar como aportación."
                    className="inline"
                  >
                    <input type="hidden" name="id" value={op.id} />
                    <input type="hidden" name="inversion_id" value={inversionId} />
                    <button className={rowDelClass} type="submit">
                      Eliminar
                    </button>
                  </ConfirmForm>
                </td>
              </tr>
            ))}
            {operaciones.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-ink-tertiary">
                  Todavía no hay ninguna operación. Si esta posición tiene ISIN, la próxima importación del
                  extracto las registrará sola.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
