"use client";

import { useState } from "react";
import type { CategoriaJerarquica } from "@/lib/categorias";

type Cuenta = { id: string; nombre: string; banco_nombre: string };

export type PrevistoParaEditar = {
  id: string;
  descripcion: string;
  tipo: "gasto" | "ingreso" | "traspaso";
  categoria_id: string | null;
  cuenta_id: string | null;
  importe_estimado: number;
  importe_min: number | null;
  importe_max: number | null;
  tipo_recurrencia: "unica_vez" | "recurrente";
  periodicidad: string | null;
  fecha: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

export function MovimientoPrevistoForm({
  action,
  categorias,
  cuentas,
  hoy,
  previsto,
}: {
  action: (formData: FormData) => void;
  categorias: CategoriaJerarquica[];
  cuentas: Cuenta[];
  hoy: string;
  previsto?: PrevistoParaEditar;
}) {
  const [tipo, setTipo] = useState<"gasto" | "ingreso" | "traspaso">(previsto?.tipo ?? "gasto");
  const [tipoRecurrencia, setTipoRecurrencia] = useState<"unica_vez" | "recurrente">(
    previsto?.tipo_recurrencia ?? "recurrente"
  );
  const [esRango, setEsRango] = useState(previsto?.importe_min != null && previsto?.importe_max != null);
  const [periodicidad, setPeriodicidad] = useState(previsto?.periodicidad ?? "mensual");

  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {previsto && <input type="hidden" name="id" value={previsto.id} />}
      <div className="sm:col-span-2">
        <label className="block text-xs text-slate-500">Descripción</label>
        <input
          name="descripcion"
          required
          defaultValue={previsto?.descripcion}
          placeholder="Seguro del coche, Nómina, Ocio…"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Tipo</label>
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof tipo)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
          <option value="traspaso">Traspaso</option>
        </select>
      </div>

      {tipo !== "traspaso" && (
        <div>
          <label className="block text-xs text-slate-500">Categoría</label>
          <select
            name="categoria_id"
            defaultValue={previsto?.categoria_id ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs text-slate-500">Cuenta (opcional)</label>
        <select
          name="cuenta_id"
          defaultValue={previsto?.cuenta_id ?? ""}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Sin especificar</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.banco_nombre} — {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={esRango} onChange={(e) => setEsRango(e.target.checked)} />
          Importe variable (rango en vez de un importe fijo)
        </label>
      </div>

      {esRango ? (
        <>
          <div>
            <label className="block text-xs text-slate-500">Importe mínimo</label>
            <input
              name="importe_min"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={previsto?.importe_min ?? undefined}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Importe máximo</label>
            <input
              name="importe_max"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={previsto?.importe_max ?? undefined}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <input type="hidden" name="importe_estimado" value="0" />
        </>
      ) : (
        <div>
          <label className="block text-xs text-slate-500">Importe estimado</label>
          <input
            name="importe_estimado"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={previsto?.importe_estimado ?? undefined}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="sm:col-span-3">
        <label className="block text-xs text-slate-500">Recurrencia</label>
        <div className="mt-1 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="tipo_recurrencia"
              value="unica_vez"
              checked={tipoRecurrencia === "unica_vez"}
              onChange={() => setTipoRecurrencia("unica_vez")}
            />
            Única vez
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="tipo_recurrencia"
              value="recurrente"
              checked={tipoRecurrencia === "recurrente"}
              onChange={() => setTipoRecurrencia("recurrente")}
            />
            Recurrente
          </label>
        </div>
      </div>

      {tipoRecurrencia === "unica_vez" ? (
        <div>
          <label className="block text-xs text-slate-500">Fecha</label>
          <input
            name="fecha"
            type="date"
            required
            defaultValue={previsto?.fecha ?? hoy}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      ) : (
        <>
          <div>
            <label className="block text-xs text-slate-500">Periodicidad</label>
            <select
              name="periodicidad"
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="bimensual">Bimensual (cada 2 meses)</option>
              <option value="trimestral">Trimestral (cada 3 meses)</option>
              <option value="semestral">Semestral (cada 6 meses)</option>
              <option value="anual">Anual (estacional)</option>
            </select>
            {periodicidad === "semanal" && (
              <p className="mt-1 text-xs text-slate-400">
                El importe se entiende por semana: se multiplica por las semanas que caigan en cada mes (4 o 5).
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500">Desde</label>
            <input
              name="fecha_inicio"
              type="date"
              required
              defaultValue={previsto?.fecha_inicio ?? hoy}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Hasta (opcional)</label>
            <input
              name="fecha_fin"
              type="date"
              defaultValue={previsto?.fecha_fin ?? undefined}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </>
      )}

      <div className="sm:col-span-3">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {previsto ? "Guardar cambios" : "Añadir previsión"}
        </button>
      </div>
    </form>
  );
}
