// Formateador de importes compartido por toda la app, para que la moneda base
// configurada por el usuario cambie de verdad lo que se ve, no solo se guarde.
export function formatMoneda(value: number, moneda: string = "EUR"): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: moneda }).format(value);
}
