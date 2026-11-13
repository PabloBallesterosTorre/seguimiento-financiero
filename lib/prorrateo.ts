// Tanda 16: prorrateo de un movimiento entre varios meses.
//
// Un seguro anual de 600 € pagado en enero no es "enero carísimo y el resto gratis": son
// 50 € al mes. Prorratear no toca el saldo —el dinero salió el día que salió—, solo cómo se
// reparte el gasto en los informes por mes (categorías, regla 50/30/20, desglose del mes).
// Por eso se aplica al leer, en los informes, y nunca se guarda partido.

export const OPCIONES_PRORRATEO = [2, 3, 4, 6, 12, 24] as const;
export const MAX_MESES_PRORRATEO = 36;

// La misma fecha `meses` meses después, con el día recortado al final de los meses cortos
// (un 31 de enero más un mes es el 28 o 29 de febrero).
export function sumarMeses(fecha: string, meses: number): string {
  const year = Number(fecha.slice(0, 4));
  const month = Number(fecha.slice(5, 7)) - 1 + meses;
  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  const ultimo = new Date(y, m + 1, 0).getDate();
  const dia = Math.min(Number(fecha.slice(8, 10)), ultimo);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

type Prorrateable = { fecha: string; importe: number | string; tipo: string; prorrateo_meses?: number | null };

// Sustituye cada movimiento prorrateado por N partes, una por mes desde el suyo, con el
// importe repartido a céntimos: el resto de la división va en la primera parte para que la
// suma sea exactamente el original. Los traspasos no se prorratean (no son gasto ni
// ingreso), ni lo que tiene menos de 2 meses.
export function prorratear<T extends Prorrateable>(movimientos: T[]): T[] {
  const resultado: T[] = [];
  for (const m of movimientos) {
    const n = Math.min(Number(m.prorrateo_meses ?? 0), MAX_MESES_PRORRATEO);
    if (m.tipo === "traspaso" || !Number.isInteger(n) || n < 2) {
      resultado.push(m);
      continue;
    }
    const centimos = Math.round(Number(m.importe) * 100);
    const parte = Math.trunc(centimos / n);
    const resto = centimos - parte * n;
    for (let i = 0; i < n; i++) {
      resultado.push({ ...m, fecha: sumarMeses(m.fecha, i), importe: (parte + (i === 0 ? resto : 0)) / 100 });
    }
  }
  return resultado;
}
