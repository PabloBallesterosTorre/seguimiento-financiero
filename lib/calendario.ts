// Tanda 16: vista calendario de Movimientos.
//
// Un mes natural en rejilla de lunes a domingo, con lo que ya ha pasado (movimientos
// reales) y lo que está por pasar (previstos todavía pendientes) en el día que les toca.

import { contarConciliacionesPorMes, fechasPrevistoEnMes, type MovimientoPrevisto } from "@/lib/prevision";

export type ItemCalendario = {
  id: string;
  descripcion: string;
  importe: number;
  tipo: string;
  previsto: boolean;
};

export type DiaCalendario = {
  fecha: string;
  delMes: boolean;
  esHoy: boolean;
  items: ItemCalendario[];
  // Neto del día sin traspasos ni previstos: lo que de verdad ha movido el saldo.
  neto: number;
};

export type ResumenMesCalendario = { entradas: number; salidas: number; neto: number; previstoNeto: number };

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Mes anterior y siguiente en formato "AAAA-MM", para la navegación.
export function mesVecino(mes: string, delta: number): string {
  const total = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function construirCalendario(
  mes: string,
  movimientos: { id: string; fecha: string; descripcion: string; importe: number; tipo: string }[],
  previstos: MovimientoPrevisto[],
  conciliaciones: { previsto_id: string; periodo: string }[],
  hoy: string
): { semanas: DiaCalendario[][]; resumen: ResumenMesCalendario } {
  const year = Number(mes.slice(0, 4));
  const month = Number(mes.slice(5, 7));
  const diasMes = new Date(year, month, 0).getDate();

  const porDia = new Map<string, ItemCalendario[]>();
  const anadir = (fecha: string, item: ItemCalendario) =>
    porDia.set(fecha, [...(porDia.get(fecha) ?? []), item]);

  for (const m of movimientos) {
    if (m.fecha.slice(0, 7) !== mes) continue;
    anadir(m.fecha, { id: m.id, descripcion: m.descripcion, importe: m.importe, tipo: m.tipo, previsto: false });
  }

  // Previstos: solo las ocurrencias que siguen pendientes (las conciliadas ya están como
  // movimiento real) y solo de hoy en adelante (una pasada sin conciliar no es "lo que
  // viene", es algo que revisar en Previsión). Los presupuestos de categoría no tienen día
  // y no se pintan.
  const conciliadas = contarConciliacionesPorMes(conciliaciones);
  for (const p of previstos) {
    if (p.es_presupuesto) continue;
    const fechas = fechasPrevistoEnMes(p, year, month);
    const yaConciliadas = conciliadas.get(`${p.id}:${mes}`) ?? 0;
    const importe = p.tipo === "gasto" ? -Math.abs(p.importe_estimado) : Math.abs(p.importe_estimado);
    fechas.slice(yaConciliadas).forEach((fecha, i) => {
      if (fecha < hoy) return;
      anadir(fecha, { id: `${p.id}:${i}`, descripcion: p.descripcion, importe, tipo: p.tipo, previsto: true });
    });
  }

  // Rejilla de lunes a domingo, con los días del mes anterior y siguiente que completan
  // la primera y la última semana.
  const primerDiaSemana = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 0 = lunes
  const celdas: DiaCalendario[] = [];
  for (let i = -primerDiaSemana; celdas.length % 7 !== 0 || i < diasMes; i++) {
    const d = new Date(year, month - 1, 1 + i);
    const fecha = iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const delMes = i >= 0 && i < diasMes;
    const items = delMes ? (porDia.get(fecha) ?? []) : [];
    items.sort((a, b) => Number(a.previsto) - Number(b.previsto) || a.importe - b.importe);
    const neto = items.filter((x) => !x.previsto && x.tipo !== "traspaso").reduce((s, x) => s + x.importe, 0);
    celdas.push({ fecha, delMes, esHoy: fecha === hoy, items, neto: Math.round(neto * 100) / 100 });
  }

  const semanas: DiaCalendario[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));

  let entradas = 0;
  let salidas = 0;
  let previstoNeto = 0;
  for (const dia of celdas) {
    for (const x of dia.items) {
      if (x.tipo === "traspaso") continue;
      if (x.previsto) previstoNeto += x.importe;
      else if (x.importe > 0) entradas += x.importe;
      else salidas += -x.importe;
    }
  }
  const r = (v: number) => Math.round(v * 100) / 100;

  return {
    semanas,
    resumen: { entradas: r(entradas), salidas: r(salidas), neto: r(entradas - salidas), previstoNeto: r(previstoNeto) },
  };
}
