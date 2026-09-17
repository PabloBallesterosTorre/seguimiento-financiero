"use client";

import { KpiDineroDisponible } from "./KpiDineroDisponible";
import { FlujoMensual } from "./FlujoMensual";
import { MediaPorCategoria } from "./MediaPorCategoria";
import { EvolucionPorCategoria } from "./EvolucionPorCategoria";
import { PrevistoVsReal } from "./PrevistoVsReal";
import { PatrimonioYDeuda } from "./PatrimonioYDeuda";
import { EnQueSeVa, type FilaCategoria } from "./EnQueSeVa";

export type MesFlujo = { label: string; esReal: boolean; ingresos: number; gastos: number; neto: number };
export type CategoriaMedia = { nombre: string; media: number };
export type SerieCategoria = { nombre: string; valores: number[] };
export type FilaComparativa = { nombre: string; previsto: number; real: number };
export type MesPatrimonio = { label: string; esReal: boolean; patrimonio: number; deuda: number };
export type PuntoMini = { label: string; valor: number };

export function InformesClient({
  moneda,
  patrimonioHoy,
  variacion,
  miniSerie,
  flujoPorMes,
  mediaGasto,
  mediaIngreso,
  mesesUsadosParaMedia,
  seriesGastoPorCategoria,
  etiquetasMeses,
  comparativa,
  etiquetaMesCerrado,
  patrimonioYDeuda,
  gastosNetos,
  ingresosNetos,
  etiquetaPeriodo,
}: {
  moneda: string;
  patrimonioHoy: number;
  variacion: { abs: number; pct: number } | null;
  miniSerie: PuntoMini[];
  flujoPorMes: MesFlujo[];
  mediaGasto: CategoriaMedia[];
  mediaIngreso: CategoriaMedia[];
  mesesUsadosParaMedia: number;
  seriesGastoPorCategoria: SerieCategoria[];
  etiquetasMeses: string[];
  comparativa: FilaComparativa[];
  etiquetaMesCerrado: string;
  patrimonioYDeuda: MesPatrimonio[];
  gastosNetos: FilaCategoria[];
  ingresosNetos: FilaCategoria[];
  etiquetaPeriodo: string;
}) {
  return (
    <div className="space-y-6">
      <KpiDineroDisponible moneda={moneda} valor={patrimonioHoy} variacion={variacion} miniSerie={miniSerie} />
      <FlujoMensual moneda={moneda} datos={flujoPorMes} />
      <EnQueSeVa gastos={gastosNetos} ingresos={ingresosNetos} moneda={moneda} etiquetaPeriodo={etiquetaPeriodo} />
      <MediaPorCategoria
        moneda={moneda}
        gasto={mediaGasto}
        ingreso={mediaIngreso}
        mesesUsados={mesesUsadosParaMedia}
      />
      <EvolucionPorCategoria moneda={moneda} series={seriesGastoPorCategoria} etiquetas={etiquetasMeses} />
      <PrevistoVsReal moneda={moneda} filas={comparativa} etiquetaMes={etiquetaMesCerrado} />
      <PatrimonioYDeuda moneda={moneda} datos={patrimonioYDeuda} />
    </div>
  );
}
