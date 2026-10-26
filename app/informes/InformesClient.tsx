"use client";

import { KpiDineroDisponible } from "./KpiDineroDisponible";
import { EnQueSeVa, type FilaCategoria } from "./EnQueSeVa";
import { Regla503020 } from "@/components/Regla503020";
import type { Reparto } from "@/lib/regla503020";

export type PuntoMini = { label: string; valor: number };

export type DatosRegla503020 = {
  etiquetaMes: string;
  hastaHoy: Reparto;
  cierre: Reparto;
  objetivo: number | null;
  incluirInversionEnAhorro: boolean;
};

export function InformesClient({
  moneda,
  patrimonioHoy,
  variacion,
  miniSerie,
  regla503020,
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
  regla503020: DatosRegla503020;
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
      <Regla503020 moneda={moneda} descripcionMes={notaMes} {...regla503020} />
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
