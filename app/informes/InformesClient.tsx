"use client";

import { KpiDineroDisponible } from "./KpiDineroDisponible";
import { FlujoMensual } from "./FlujoMensual";
import { EnQueSeVa, type FilaCategoria } from "./EnQueSeVa";

export type MesFlujo = { label: string; esReal: boolean; ingresos: number; gastos: number; neto: number };
export type PuntoMini = { label: string; valor: number };

export function InformesClient({
  moneda,
  patrimonioHoy,
  variacion,
  miniSerie,
  flujoPorMes,
  gastosNetos,
  ingresosNetos,
  etiquetaRango,
  mesesDelDesglose,
  mesDesglose,
  queryBaseDesglose,
  notaMes,
  fechaCierreAnterior,
}: {
  moneda: string;
  patrimonioHoy: number;
  variacion: { abs: number; pct: number } | null;
  miniSerie: PuntoMini[];
  flujoPorMes: MesFlujo[];
  gastosNetos: FilaCategoria[];
  ingresosNetos: FilaCategoria[];
  etiquetaRango: string;
  mesesDelDesglose: { clave: string; etiqueta: string }[];
  mesDesglose: string | null;
  queryBaseDesglose: string;
  notaMes?: string;
  fechaCierreAnterior?: string;
}) {
  return (
    <div className="space-y-6">
      <KpiDineroDisponible
        moneda={moneda}
        valor={patrimonioHoy}
        variacion={variacion}
        miniSerie={miniSerie}
        fechaCierreAnterior={fechaCierreAnterior}
      />
      <FlujoMensual moneda={moneda} datos={flujoPorMes} notaMes={notaMes} />
      <EnQueSeVa
        gastos={gastosNetos}
        ingresos={ingresosNetos}
        moneda={moneda}
        etiquetaRango={etiquetaRango}
        meses={mesesDelDesglose}
        mesSeleccionado={mesDesglose}
        queryBase={queryBaseDesglose}
      />
    </div>
  );
}
