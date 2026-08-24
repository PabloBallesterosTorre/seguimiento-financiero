"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { simularAmortizacionExtra, type Recurrencia, type TipoReduccion } from "@/lib/amortizacion";
import { aplicarAmortizacionExtra } from "../actions";

const formatEUR = (v: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);

export function SimuladorAmortizacion({
  deudaId,
  capitalPendiente,
  tasaAnual,
  cuotaActual,
  valorResidual,
}: {
  deudaId: string;
  capitalPendiente: number;
  tasaAnual: number;
  cuotaActual: number;
  valorResidual: number;
}) {
  const router = useRouter();
  const [importe, setImporte] = useState(1000);
  const [recurrencia, setRecurrencia] = useState<Recurrencia>("puntual");
  const [tipoReduccion, setTipoReduccion] = useState<TipoReduccion>("reducir_plazo");
  const [aplicando, setAplicando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const efectoAplicado: TipoReduccion = recurrencia === "puntual" ? tipoReduccion : "reducir_plazo";

  const resultado = useMemo(() => {
    if (importe <= 0) return null;
    return simularAmortizacionExtra({
      saldoActual: capitalPendiente,
      tasaAnual,
      cuotaActual,
      valorResidual,
      importeExtra: importe,
      recurrencia,
      tipoReduccion: efectoAplicado,
    });
  }, [importe, recurrencia, efectoAplicado, capitalPendiente, tasaAnual, cuotaActual, valorResidual]);

  async function aplicar() {
    if (!resultado) return;
    setAplicando(true);
    setMensaje(null);

    const respuesta = await aplicarAmortizacionExtra({
      deuda_id: deudaId,
      importe,
      tipo_reduccion: efectoAplicado,
      recurrencia,
      cuota_nueva: resultado.cuotaNueva,
      meses_restantes_nuevos: resultado.despues.mesesRestantes,
    });

    setAplicando(false);

    if (respuesta.ok) {
      setMensaje("Amortización aplicada. Los datos de la deuda se han actualizado.");
      router.refresh();
    } else {
      setMensaje(`Error: ${respuesta.error}`);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
      <h2 className="text-sm font-medium text-slate-700">Simulador de amortización anticipada</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-slate-500">Importe extra</label>
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
          <label className="block text-xs text-slate-500">Recurrencia</label>
          <select
            value={recurrencia}
            onChange={(e) => setRecurrencia(e.target.value as Recurrencia)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="puntual">Puntual (un pago ahora)</option>
            <option value="mensual">Recurrente cada mes</option>
            <option value="anual">Recurrente cada año</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">
            Efecto {recurrencia !== "puntual" && <span className="text-slate-400">(fijo en recurrentes)</span>}
          </label>
          <select
            value={efectoAplicado}
            onChange={(e) => setTipoReduccion(e.target.value as TipoReduccion)}
            disabled={recurrencia !== "puntual"}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="reducir_plazo">Reducir plazo (misma cuota)</option>
            <option value="reducir_cuota">Reducir cuota (mismo plazo)</option>
          </select>
        </div>
      </div>

      {resultado && (
        <div className="grid grid-cols-2 gap-4 rounded-md bg-slate-50 p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Meses restantes</p>
            <p className="text-sm font-medium">
              {resultado.despues.mesesRestantes}{" "}
              <span className="text-slate-400">(antes {resultado.antes.mesesRestantes})</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Intereses totales</p>
            <p className="text-sm font-medium">{formatEUR(resultado.despues.interesesTotales)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Ahorro en intereses</p>
            <p className="text-sm font-medium text-emerald-600">{formatEUR(resultado.ahorroIntereses)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{resultado.cuotaNueva ? "Nueva cuota" : "Meses ahorrados"}</p>
            <p className="text-sm font-medium">
              {resultado.cuotaNueva ? formatEUR(resultado.cuotaNueva) : resultado.mesesAhorrados}
            </p>
          </div>
        </div>
      )}

      {mensaje && (
        <p className={`text-sm ${mensaje.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{mensaje}</p>
      )}

      <button
        type="button"
        onClick={aplicar}
        disabled={!resultado || aplicando}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
      >
        {aplicando ? "Aplicando…" : "Aplicar esta amortización"}
      </button>

      <p className="text-xs text-slate-400">
        {recurrencia === "puntual"
          ? `Se registra como pago realizado hoy: se descuenta del capital pendiente${
              efectoAplicado === "reducir_cuota" ? " y se actualiza la cuota." : "."
            }`
          : "Se registra como plan recurrente: no descuenta capital pendiente ahora, solo actualiza la fecha de fin estimada."}
      </p>
    </div>
  );
}
