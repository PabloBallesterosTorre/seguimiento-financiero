"use client";

import { useMemo, useState } from "react";
import { simularConProgramadas, type TipoReduccion, type AmortizacionProgramada } from "@/lib/amortizacion";
import { formatMoneda } from "@/lib/formato";

type ProgramadaConId = AmortizacionProgramada & { id: string };

export function SimuladorAmortizacion({
  capitalPendiente,
  tasaAnual,
  cuotaActual,
  valorResidual,
  moneda = "EUR",
  hoy,
}: {
  capitalPendiente: number;
  tasaAnual: number;
  cuotaActual: number;
  valorResidual: number;
  moneda?: string;
  hoy: string;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);

  const [programadas, setProgramadas] = useState<ProgramadaConId[]>([]);
  const [fecha, setFecha] = useState(hoy);
  const [importe, setImporte] = useState(1000);
  const [tipoReduccion, setTipoReduccion] = useState<TipoReduccion>("reducir_plazo");

  function anadir() {
    if (importe <= 0 || !fecha) return;
    setProgramadas((prev) => [...prev, { id: crypto.randomUUID(), fecha, importe, tipoReduccion }]);
    setImporte(1000);
  }

  function quitar(id: string) {
    setProgramadas((prev) => prev.filter((p) => p.id !== id));
  }

  const antes = useMemo(
    () => simularConProgramadas(capitalPendiente, tasaAnual, cuotaActual, valorResidual, hoy, []),
    [capitalPendiente, tasaAnual, cuotaActual, valorResidual, hoy]
  );

  const despues = useMemo(
    () => simularConProgramadas(capitalPendiente, tasaAnual, cuotaActual, valorResidual, hoy, programadas),
    [capitalPendiente, tasaAnual, cuotaActual, valorResidual, hoy, programadas]
  );

  const hayCambios = programadas.length > 0;
  const ahorroIntereses = antes.interesesTotales - despues.interesesTotales;
  const mesesAhorrados = antes.mesesRestantes - despues.mesesRestantes;
  const cuotaCambio = Math.abs(despues.cuotaFinal - cuotaActual) > 0.01;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-slate-700">Simulador de amortización anticipada</h2>
        <p className="text-xs text-slate-400">
          Solo de consulta — prueba tantas amortizaciones como quieras, cada una en su fecha; se aplican
          en orden cronológico. Nada se guarda aquí. Para registrar una amortización real, hazlo desde el
          detalle de la deuda.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label className="block text-xs text-slate-500">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Importe</label>
          <input
            type="number"
            min="0"
            step="10"
            value={importe}
            onChange={(e) => setImporte(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Efecto</label>
          <select
            value={tipoReduccion}
            onChange={(e) => setTipoReduccion(e.target.value as TipoReduccion)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="reducir_plazo">Reducir plazo (misma cuota)</option>
            <option value="reducir_cuota">Reducir cuota (mismo plazo)</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={anadir}
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Añadir a la simulación
          </button>
        </div>
      </div>

      {programadas.length > 0 && (
        <ul className="space-y-1">
          {programadas
            .slice()
            .sort((a, b) => a.fecha.localeCompare(b.fecha))
            .map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm"
              >
                <span>
                  {p.fecha} — {formatEUR(p.importe)} —{" "}
                  {p.tipoReduccion === "reducir_cuota" ? "reduce cuota" : "reduce plazo"}
                </span>
                <button type="button" onClick={() => quitar(p.id)} className="text-xs text-slate-400 hover:text-red-600">
                  Quitar
                </button>
              </li>
            ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-4 rounded-md bg-slate-50 p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Meses restantes</p>
          <p className="text-sm font-medium">
            {despues.mesesRestantes}
            {hayCambios && <span className="text-slate-400"> (antes {antes.mesesRestantes})</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Intereses totales</p>
          <p className="text-sm font-medium">{formatEUR(despues.interesesTotales)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Ahorro en intereses</p>
          <p className="text-sm font-medium text-emerald-600">{formatEUR(ahorroIntereses)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{cuotaCambio ? "Cuota final" : "Meses ahorrados"}</p>
          <p className="text-sm font-medium">{cuotaCambio ? formatEUR(despues.cuotaFinal) : mesesAhorrados}</p>
        </div>
      </div>

      {despues.cuotaNoCubreIntereses && (
        <p className="text-xs text-red-600">
          Con esta combinación, en algún momento la cuota deja de cubrir los intereses generados.
        </p>
      )}
    </div>
  );
}
