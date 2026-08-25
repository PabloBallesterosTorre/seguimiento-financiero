import { importeEfectivoPrevisto, previstoAplicaEnMes, type MovimientoPrevisto } from "@/lib/prevision";

export type CuentaRemunerada = {
  id: string;
  saldo_actual: number;
  tipo_interes: number;
};

export type MesHorizonte = { year: number; month: number };

// Interés previsto mes a mes para cada cuenta remunerada, con saldo proyectado
// dinámico: parte del saldo actual y, mes a mes, le suma el propio interés
// devengado (compuesto) más el neto de cualquier otro movimiento previsto
// asignado a esa cuenta (ingresos/gastos previstos en ella), para que el interés
// de los meses siguientes refleje esos cambios de saldo.
export function calcularInteresesPrevistos(
  cuentas: CuentaRemunerada[],
  previstos: MovimientoPrevisto[],
  meses: MesHorizonte[],
  mediaPorCategoria: Map<string, number> = new Map()
): Map<string, number> {
  const interesesPorMes = new Map<string, number>();

  for (const cuenta of cuentas) {
    let saldo = cuenta.saldo_actual;
    const tasaMensual = cuenta.tipo_interes / 100 / 12;

    for (const mes of meses) {
      const interesMes = saldo * tasaMensual;
      const clave = `${mes.year}-${mes.month}`;
      interesesPorMes.set(clave, (interesesPorMes.get(clave) ?? 0) + interesMes);

      const otrosPrevistos = previstos.filter(
        (p) => p.cuenta_id === cuenta.id && p.tipo !== "traspaso" && previstoAplicaEnMes(p, mes.year, mes.month)
      );
      const netoOtros = otrosPrevistos.reduce((suma, p) => {
        const importe = importeEfectivoPrevisto(p, mediaPorCategoria);
        return suma + (p.tipo === "ingreso" ? importe : -importe);
      }, 0);

      saldo = saldo + interesMes + netoOtros;
    }
  }

  return interesesPorMes;
}
