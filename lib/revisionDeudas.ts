// Comprobaciones de salud de una deuda contra la realidad de los movimientos.
//
// Nacen de un caso concreto: había registrada una hipoteca de 150.000 € con una cuota de
// 650 € al mes que en realidad paga otra persona. Nunca se pagó desde ninguna cuenta del
// usuario, así que su categoría no tenía ni un solo movimiento y su capital pendiente
// seguía siendo el inicial tres años y ocho meses después. La app enseñaba 297.875,52 € de
// deuda cuando la real era 147.875,52 €, y la previsión restaba 650 € al mes que no salían
// de ninguna parte.
//
// Nada de esto se podía deducir mirando la ficha de la deuda: cuadraba consigo misma. Solo
// se ve al contrastarla con los movimientos, que es lo que hacen estas comprobaciones.

export type DeudaParaRevisar = {
  id: string;
  nombre: string;
  capital_inicial: number;
  capital_pendiente: number;
  cuota: number;
  fecha_inicio: string;
  categoria_id: string | null;
};

export type AvisoDeuda = {
  deudaId: string;
  // `grave` se reserva para lo que significa que la cifra de patrimonio está mal ahora
  // mismo, no para lo que conviene repasar.
  gravedad: "grave" | "aviso";
  titulo: string;
  detalle: string;
};

// Margen antes de dar la alarma. Dos meses evita avisar de una deuda recién dada de alta
// cuyo primer recibo aún no ha llegado, o del mes en curso a medias.
const MESES_DE_CORTESIA = 2;

// Cuánto puede desviarse el pago real de la cuota registrada sin que se avise. Un 2 % (con
// un mínimo de 2 €) deja pasar redondeos y comisiones pequeñas, pero no una revisión de
// tipo de un préstamo variable, que es lo que interesa cazar.
const TOLERANCIA_CUOTA = 0.02;

function mesesTranscurridos(desde: string, hasta: string): number {
  const [aIni, mIni] = desde.split("-").map(Number);
  const [aFin, mFin] = hasta.split("-").map(Number);
  return aFin * 12 + mFin - (aIni * 12 + mIni);
}

function mediana(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 0 ? (orden[medio - 1] + orden[medio]) / 2 : orden[medio];
}

/**
 * Revisa una deuda contra los pagos reales de su categoría.
 *
 * `pagos` son los importes (en positivo) de los movimientos de gasto de la categoría de la
 * deuda, del más antiguo al más reciente. Se usa la MEDIANA y no la media para comparar con
 * la cuota: una amortización extra o un recibo doble no deben mover la referencia.
 */
export function revisarDeuda(deuda: DeudaParaRevisar, pagos: number[], hoy: string): AvisoDeuda[] {
  const avisos: AvisoDeuda[] = [];
  const meses = mesesTranscurridos(deuda.fecha_inicio, hoy);
  if (meses < MESES_DE_CORTESIA) return avisos;

  if (pagos.length === 0) {
    avisos.push({
      deudaId: deuda.id,
      gravedad: "grave",
      titulo: "No hay ningún pago registrado de esta deuda",
      detalle:
        deuda.categoria_id === null
          ? "No tiene categoría asignada, así que no hay forma de reconocer sus pagos. Asígnale una para poder contrastarla."
          : `Lleva ${meses} meses de alta y su categoría no tiene ni un movimiento. Si la paga otra persona, o sale de una cuenta que no sigues aquí, no debería estar registrada: está restando su cuota de la previsión y su capital del patrimonio.`,
    });
    // Sin pagos no tiene sentido seguir comprobando importes ni amortización.
    return avisos;
  }

  if (deuda.capital_pendiente >= deuda.capital_inicial) {
    avisos.push({
      deudaId: deuda.id,
      gravedad: "grave",
      titulo: "El capital pendiente sigue siendo el inicial",
      detalle: `Han pasado ${meses} meses desde el inicio y el pendiente no ha bajado del capital de partida. Actualízalo con el de tu último recibo.`,
    });
  }

  const habitual = mediana(pagos);
  const desvio = Math.abs(habitual - deuda.cuota);
  if (desvio > Math.max(deuda.cuota * TOLERANCIA_CUOTA, 2)) {
    avisos.push({
      deudaId: deuda.id,
      gravedad: "aviso",
      titulo: "Lo que pagas no coincide con la cuota registrada",
      detalle: `La cuota registrada es ${deuda.cuota.toFixed(2)} € y lo que sale de tus cuentas es ${habitual.toFixed(
        2
      )} €. Si es un préstamo a tipo variable puede que te lo hayan revisado.`,
    });
  }

  return avisos;
}
