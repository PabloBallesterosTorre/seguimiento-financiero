---
title: Descuadre de saldos — reparación y prevención (tanda 9)
description: Diagnóstico completo del descuadre de la cuenta de Trade Republic (17/09/2026), reparación de los datos, cambios de código para que no se repita, y lo que queda pendiente.
---

# Descuadre de saldos (tanda 9)

Al importar el extracto de Trade Republic del 17/09/2026 el saldo de la app no coincidía
con el del banco. La reconciliación contra el histórico completo (321 movimientos desde
la apertura de la cuenta) destapó **dos errores independientes** que se sumaban.

## Diagnóstico

Cifras de partida:

| | |
|---|---|
| Extracto completo, 321 movimientos, cuenta abierta a cero | 12.401,86 € |
| Movimientos guardados en la app (319) | 12.450,19 € |
| `saldo_actual` guardado en la app | 12.326,86 € |
| Saldo que mostraba Trade Republic | 12.376,86 € |

Los 25 € entre el extracto y lo que mostraba el banco son la ejecución del plan de ahorro
de Emerging Markets del propio 17/09 (semanal, los miércoles): ya cobrada por TR pero
todavía no reflejada en el export. No es un error.

### Error 1 — comisiones y retenciones nunca descontadas (48,33 €)

El importador no aprendió a sumar las columnas `fee` y `tax` hasta el commit `400ed47`.
Todo lo importado antes se guardó solo con `amount`:

- **24 movimientos** guardados sin su comisión o retención: 38,33 € de más.
- **2 comisiones de tarjeta de 5 €** (15/05/2024 y 29/06/2026) descartadas enteras:
  10,00 € de más. Vienen con `amount = 0` y `fee = -5`, así que el validador de entonces
  las rechazaba por "importe es cero".

Ya está corregido en el código actual: hoy esas filas entran bien, porque
`calcularPreview` combina comisión y retención **antes** de validar que el importe no sea
cero. La compra de Ezentis importada el 17/09 es el único movimiento del histórico que
llevaba su comisión aplicada.

### Error 2 — el saldo guardado no cuadraba ni con sus propios movimientos (123,33 €)

`cuentas.saldo_actual` se mantenía **solo de forma incremental**: cada alta, importación,
traspaso o borrado lo sumaba o lo restaba. No había forma de contrastarlo con nada, así
que cualquier operación que se quedara a medias — o cualquier edición manual del campo —
lo desacoplaba de sus movimientos de forma permanente y silenciosa.

No se puede reconstruir cuándo pasó: no hay registro de auditoría. El vector más probable
era `actualizarCuenta`, que reescribía `saldo_actual` con el valor del formulario cada vez
que se editaba la cuenta (para añadir el IBAN, marcarla como remunerada, etc.), y ese campo
era editable a mano en la pantalla de Cuentas.

## Reparación de los datos (hecha el 17/09/2026)

Aplicada directamente sobre producción, con respaldo previo en la tabla
`public.respaldo_tr_20260917` (319 filas, 12.450,19 €):

1. Corregido el importe de los 24 movimientos afectados (−38,33 €). Cada uno se identificó
   por fecha + importe + descripción exactos, verificando antes que cada objetivo casara
   con una y solo una fila.
2. Creados los 2 movimientos de comisión de tarjeta de −5 € (−10,00 €).
3. Recalculado `saldo_actual` desde los movimientos.

Resultado: **321 movimientos, 12.401,86 €, desfase 0,00** — idéntico al extracto al céntimo.

La tabla de respaldo se puede borrar cuando haya confianza en el resultado.

## Prevención (código, pendiente de desplegar)

### 1. El saldo pasa a ser verificable — migración `0019_saldo_inicial.sql`

Nueva columna `cuentas.saldo_inicial`: el saldo de la cuenta antes del primer movimiento
registrado. Con ella el saldo se puede comprobar en todo momento:

```
saldo esperado = saldo_inicial + suma(movimientos)
```

El backfill deriva el saldo inicial de cada cuenta restando sus movimientos al saldo
guardado hoy, así que **ninguna cuenta cambia de saldo al aplicar la migración**: el estado
actual se conserva exactamente y, a partir de ahí, cualquier desfase nuevo es detectable.

### 2. Detección y reparación en la pantalla de Cuentas

- `lib/saldos.ts` (funciones puras, con tests): `saldoEsperado`, `desfaseSaldo`,
  `hayDesfase` y `diagnosticarSaldos`.
- La pantalla de Cuentas comprueba todas las cuentas en cada carga y, si alguna no cuadra,
  muestra un aviso con el saldo real, el esperado, la diferencia y un botón
  **Recalcular saldo**.
- Nueva Server Action `recalcularSaldoCuenta`, que reconstruye el saldo desde los
  movimientos.

### 3. Editar una cuenta ya no puede tocar su saldo

`leerCamposCuenta` ya no incluye `saldo_actual`, y el campo de saldo del formulario solo
aparece al **crear** la cuenta (como "Saldo inicial", con la explicación de qué es). Para
corregir un saldo está Recalcular, no teclearlo a mano.

### 4. Bug de zona horaria en la fecha de corte de la importación

`diaSiguiente` construía la fecha en hora local y la devolvía con `toISOString()` (UTC), así
que en Europe/Madrid el "día siguiente" caía otra vez en el mismo día. La fecha de corte por
defecto se quedaba una jornada corta. Movido a `lib/importarCsv.ts` como `diaSiguienteISO`,
calculado en UTC, con tests de regresión.

## Pendiente

### La importación sigue sin ser atómica (causa raíz no resuelta)

`importarMovimientos` inserta los movimientos y **después** actualiza el saldo, sin
transacción. Si falla a mitad —especialmente en el bucle fila a fila de las conciliaciones—
quedan movimientos insertados y el saldo sin actualizar: exactamente la clase de descuadre
que ha ocurrido. La detección y el botón de recalcular son una red de seguridad, no el
arreglo de fondo.

El arreglo real es mover la importación a una función RPC de Postgres (`create function
importar_movimientos(...) language plpgsql`) para que inserciones y saldo entren en una
única transacción. No se ha hecho en esta tanda.

### Verificar el resto de cuentas

Solo se ha reconciliado Trade Republic, contra su extracto completo. Los saldos iniciales
que la migración deja en Revolut (Comun 71,43 €, Personal 8.697,23 €) e Ibercaja
(1.050,65 €) son los que se deducen de su estado actual, **no saldos verificados**: como el
backfill preserva el estado, después de la migración esas cuentas aparecerán cuadradas por
construcción, lo cual no significa que coincidan con su banco. Para comprobarlas hace falta
el histórico completo de cada una.

Además, Revolut exporta su propia columna `Comisión`, así que conviene revisar si arrastra
el mismo problema del error 1.

## Orden de despliegue (importante)

El código nuevo lee y escribe `cuentas.saldo_inicial`, así que **la migración 0019 tiene que
aplicarse antes de desplegar**, en los dos proyectos de Supabase:

```bash
npx supabase db push --project-ref vyxhujahqhpkskjbalzg   # dev
npx supabase db push --project-ref ctyqpyznqhcauufoiqam   # producción
```

Si se despliega el código sin la migración: dar de alta una cuenta y recalcular un saldo
fallarán, y el aviso de descuadre saltará en todas las cuentas (leería `saldo_inicial` como 0).
