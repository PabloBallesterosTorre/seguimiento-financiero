// Formateadores compartidos por toda la app. Tres formatos distintos porque son tres
// cosas distintas: un importe de dinero, un porcentaje y el precio unitario de un activo.
// Mezclarlos es lo que producía "1.007,70 €" junto a "+1.8%" en la misma tarjeta
// (auditoría de diseño, tanda 11).

export function formatMoneda(value: number, moneda: string = "EUR"): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: moneda }).format(value);
}

// Igual que formatMoneda pero forzando la agrupación de millares. El español no agrupa
// hasta las cinco cifras, así que `formatMoneda` deja "4372,08 €" y "143.831,58 €" — que
// por separado están bien, pero en la misma columna de una tabla se leen como un error de
// formato. En columnas de importes gana la coherencia visual sobre la norma tipográfica.
export function formatMonedaTabla(value: number, moneda: string = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: moneda,
    useGrouping: "always",
  }).format(value);
}

// Porcentaje en español: coma decimal y espacio antes del signo ("+1,8 %"). Recibe el
// valor ya en puntos porcentuales (1.8, no 0.018), que es como lo calculan lib/inversiones
// y los informes.
//
// `signo: "siempre"` antepone el + en los positivos, para las variaciones y rentabilidades
// donde la dirección importa tanto como la magnitud.
export function formatPorcentaje(
  value: number,
  opciones: { decimales?: number; signo?: "siempre" | "solo-negativo" } = {}
): string {
  const { decimales = 2, signo = "solo-negativo" } = opciones;

  const texto = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    signDisplay: signo === "siempre" ? "exceptZero" : "auto",
  }).format(value);

  // El espacio es fino (U+00A0) para que el número y el signo no se separen al partir línea.
  return `${texto} %`;
}

// Precio unitario de un activo. No es un importe: una acción a 0,0748 € y otra a 0,0712 €
// se ven idénticas con dos decimales ("0,07 €"), y esa columna deja de servir para nada.
// Los decimales crecen según cae el valor, hasta seis, que es la precisión con la que se
// guardan los precios en inversion_operaciones.
export function formatPrecio(value: number, moneda: string = "EUR"): string {
  const abs = Math.abs(value);
  const decimales = abs === 0 ? 2 : abs >= 100 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: "always",
  }).format(value);
}
