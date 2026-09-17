// Verificación y reparación del saldo de una cuenta (migración 0019).
//
// El saldo se mantiene de forma incremental en `cuentas.saldo_actual` — cada alta,
// importación, traspaso o borrado lo suma o lo resta. Es rápido de leer, pero no se
// valida solo: si una operación falla a medias (la importación no es atómica) o se
// edita el saldo a mano, queda desacoplado de sus movimientos y nada lo detecta.
// Con `saldo_inicial` (el saldo anterior al primer movimiento registrado) el saldo
// pasa a ser comprobable y, por tanto, reparable.

// Tolerancia al comparar dos saldos. Los importes se guardan como numeric(14,2), así
// que cualquier diferencia real es de al menos un céntimo; medio céntimo absorbe el
// error de coma flotante de sumar muchos importes en JavaScript sin llegar a ocultar
// nunca un descuadre auténtico.
const TOLERANCIA = 0.005;

export function saldoEsperado(saldoInicial: number, movimientos: { importe: number }[]): number {
  const suma = movimientos.reduce((total, m) => total + Number(m.importe), 0);
  return Math.round((Number(saldoInicial) + suma) * 100) / 100;
}

// Cuánto se desvía el saldo guardado del que se deduce de los movimientos. Positivo =
// la cuenta muestra más dinero del que justifican sus movimientos; negativo = muestra
// menos. Se devuelve redondeado al céntimo para poder enseñarlo tal cual.
export function desfaseSaldo(
  saldoGuardado: number,
  saldoInicial: number,
  movimientos: { importe: number }[]
): number {
  return Math.round((Number(saldoGuardado) - saldoEsperado(saldoInicial, movimientos)) * 100) / 100;
}

export function hayDesfase(
  saldoGuardado: number,
  saldoInicial: number,
  movimientos: { importe: number }[]
): boolean {
  return Math.abs(desfaseSaldo(saldoGuardado, saldoInicial, movimientos)) > TOLERANCIA;
}

export type CuentaConSaldo = { id: string; saldo_actual: number; saldo_inicial: number };
export type DesfasePorCuenta = { cuentaId: string; desfase: number; saldoEsperado: number };

// Agrupa los movimientos por cuenta una sola vez y devuelve el diagnóstico de cada
// cuenta descuadrada. Se recorre la lista completa de movimientos en vez de consultar
// cuenta a cuenta porque la pantalla de Cuentas ya los necesita todos de una carga.
export function diagnosticarSaldos(
  cuentas: CuentaConSaldo[],
  movimientos: { cuenta_id: string; importe: number }[]
): Map<string, DesfasePorCuenta> {
  const porCuenta = new Map<string, { importe: number }[]>();
  for (const m of movimientos) {
    if (!porCuenta.has(m.cuenta_id)) porCuenta.set(m.cuenta_id, []);
    porCuenta.get(m.cuenta_id)!.push({ importe: Number(m.importe) });
  }

  const resultado = new Map<string, DesfasePorCuenta>();
  for (const cuenta of cuentas) {
    const movs = porCuenta.get(cuenta.id) ?? [];
    if (!hayDesfase(cuenta.saldo_actual, cuenta.saldo_inicial, movs)) continue;
    resultado.set(cuenta.id, {
      cuentaId: cuenta.id,
      desfase: desfaseSaldo(cuenta.saldo_actual, cuenta.saldo_inicial, movs),
      saldoEsperado: saldoEsperado(cuenta.saldo_inicial, movs),
    });
  }
  return resultado;
}
