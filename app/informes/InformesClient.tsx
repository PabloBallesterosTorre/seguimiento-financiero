"use client";

import { KpiDineroDisponible } from "./KpiDineroDisponible";
import { FlujoMensual } from "./FlujoMensual";
import { MediaPorCategoria } from "./MediaPorCategoria";
import { EvolucionPorCategoria } from "./EvolucionPorCategoria";
import { PrevistoVsReal } from "./PrevistoVsReal";
import { PatrimonioYDeuda } from "./PatrimonioYDeuda";
import { ObjetivoAhorro } from "./ObjetivoAhorro";

export type MesFlujo = { label: string; esReal: boolean; ingresos: number; gastos: number; neto: number };
export type CategoriaMedia = { nombre: string; media: number };
export type SerieCategoria = { nombre: string; valores: number[] };
export type FilaComparativa = { nombre: string; previsto: number; real: number };
export type MesAhorro = { label: string; esReal: boolean; ahorro: number; objetivo: number | null; cumplido: boolean | null };
export type MesPatrimonio = { label: string; esReal: boolean; patrimonio: number; deuda: number };
export type PuntoMini = { label: string; valor: number };

export function InformesClient({
  moneda,
  patrimonioHoy,
  variacionAbs,
  variacionPct,
  miniSerie,
  flujoPorMes,
  mediaGasto,
  mediaIngreso,
  seriesGastoPorCategoria,
  etiquetasMeses,
  comparativa,
  etiquetaMesCerrado,
  patrimonioYDeuda,
  ahorroPorMes,
  objetivoAhorroMensual,
}: {
  moneda: string;
  patrimonioHoy: number;
  variacionAbs: number;
  variacionPct: number;
  miniSerie: PuntoMini[];
  flujoPorMes: MesFlujo[];
  mediaGasto: CategoriaMedia[];
  mediaIngreso: CategoriaMedia[];
  seriesGastoPorCategoria: SerieCategoria[];
  etiquetasMeses: string[];
  comparativa: FilaComparativa[];
  etiquetaMesCerrado: string;
  patrimonioYDeuda: MesPatrimonio[];
  ahorroPorMes: MesAhorro[];
  objetivoAhorroMensual: number | null;
}) {
  return (
    <div className="space-y-6">
      <KpiDineroDisponible
        moneda={moneda}
        valor={patrimonioHoy}
        variacionAbs={variacionAbs}
        variacionPct={variacionPct}
        miniSerie={miniSerie}
      />
      <FlujoMensual moneda={moneda} datos={flujoPorMes} />
      <MediaPorCategoria moneda={moneda} gasto={mediaGasto} ingreso={mediaIngreso} />
      <EvolucionPorCategoria moneda={moneda} series={seriesGastoPorCategoria} etiquetas={etiquetasMeses} />
      <PrevistoVsReal moneda={moneda} filas={comparativa} etiquetaMes={etiquetaMesCerrado} />
      <PatrimonioYDeuda moneda={moneda} datos={patrimonioYDeuda} />
      <ObjetivoAhorro moneda={moneda} datos={ahorroPorMes} objetivo={objetivoAhorroMensual} />
    </div>
  );
}
