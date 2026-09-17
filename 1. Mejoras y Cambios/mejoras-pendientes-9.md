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

## Segunda reparación: 101 movimientos invisibles en Revolut — Personal

El detector de descuadres encontró un problema real **en su primera ejecución en
producción**, minutos después de desplegarlo.

Revolut — Personal tenía **101 movimientos cuyo `usuario_id` era el del usuario de
pruebas** (`prueba@prueba.com`), creados el 26 y 27 de agosto — una importación hecha
bajo esa sesión apuntando a producción. El efecto era doble y silencioso:

- **RLS se los ocultaba en la app**: no aparecían en Movimientos ni contaban en informes.
- **Pero sí se habían sumado a `saldo_actual`** al importarlos.

De los 101, **95 eran duplicados exactos** de movimientos que sí eran del usuario (misma
cuenta, fecha, importe y descripción), y los 6 restantes eran tres parejas que se anulan
entre sí. Esto explica además por qué el detector de duplicados de la importación no
avisó al reimportarlos: RLS se los ocultaba también a él, así que la app creía que no
existían.

Lección para diagnósticos futuros: **las consultas por el MCP de Supabase corren como
administrador y se saltan RLS**. Un diagnóstico hecho así puede mostrar una cuenta que
cuadra mientras el usuario ve otra cosa. Al comprobar saldos hay que filtrar también por
`movimientos.usuario_id`, no solo por el dueño de la cuenta.

Reparación aplicada (respaldo previo en `public.respaldo_revolut_personal_ajenos_20260917`):
borrados los 101 movimientos y recalculado `saldo_inicial` de la cuenta a 5.122,40 €,
manteniendo `saldo_actual` en 112,59 € (que es el que cuadra con el banco). El backfill de
la migración 0019 había derivado 8.697,23 €, contaminado por esos duplicados invisibles.

Verificación final, simulando RLS (contando solo movimientos del propio usuario): las seis
cuentas con desfase 0,00 €.

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

### ~~La importación no es atómica~~ — RESUELTO (migración 0020)

`importarMovimientos` insertaba los movimientos y **después** actualizaba el saldo, sin
transacción. Si fallaba a mitad —especialmente en el bucle fila a fila de las
conciliaciones— quedaban movimientos insertados y el saldo sin actualizar: la causa raíz
del descuadre.

Resuelto moviendo la importación entera a dos funciones de Postgres (`importar_movimientos`
e `importar_traspasos`, migración 0020). Cada llamada corre en una única transacción.

Dos decisiones de diseño:

- Son **`security invoker`**, así que RLS sigue aplicando dentro de la función. Una función
  `security definer` habría saltado RLS — justo el agujero por el que 101 movimientos
  acabaron en una cuenta que no les correspondía.
- El saldo se **reconstruye** (`saldo_inicial` + suma de movimientos) en vez de sumarle el
  neto del lote al valor anterior, así que la importación es autocorrectiva: deja la cuenta
  cuadrada incluso si venía descuadrada. El mismo criterio se aplicó al resto de escrituras
  (alta y borrado de movimiento, alta y borrado de traspaso) vía el helper
  `reconstruirSaldo`, que no les da atomicidad pero hace que la siguiente operación repare
  cualquier deriva anterior.

Verificado contra el proyecto de desarrollo, simulando la sesión de un usuario autenticado:

| Prueba | Resultado |
|---|---|
| Importar 2 movimientos sobre una cuenta con el saldo deliberadamente mal (999 €) | Saldo reconstruido a 114,50 € = saldo inicial + movimientos |
| Importar un lote cuya segunda fila viola una restricción | 0 filas insertadas, saldo intacto |
| Importar un traspaso entre dos cuentas | Ambos lados creados, ambos saldos cuadrados |

### Verificar el resto de cuentas

Reconciliadas contra su extracto y coincidiendo con el banco: **Trade Republic — Personal**
(12.401,86 €), **Ibercaja — Personal** (761,83 €) y **Revolut — Suscripciones** (49,86 €).

**Revolut — Comun es la única que sigue sin verificar**: su saldo inicial (71,43 €) es el
que se deduce de su estado actual, no un saldo comprobado. Como el backfill preserva el
estado, aparece cuadrada por construcción, lo cual no significa que coincida con su banco.
Hace falta su extracto completo.

Revolut — Personal queda en 112,59 € frente a los 122,37 € que dice la columna de saldo de
su extracto: la diferencia es el pago de Leroy Merlin del 16/09 (−9,79 €), que el extracto
incluye como fila pero no refleja todavía en su saldo, más 1 céntimo que la cuenta ya
arrastraba.

Descartado que Revolut arrastre el problema de comisiones del error 1: **en Revolut el
`Importe` ya viene neto** y la columna `Comisión` es informativa (verificado contra la
columna de saldo). No debe mapearse al importar, aunque la autodetección la proponga —
hacerlo introduciría el error en vez de corregirlo.

## Orden de despliegue (importante)

El código nuevo lee y escribe `cuentas.saldo_inicial`, así que **la migración 0019 tiene que
aplicarse antes de desplegar**, en los dos proyectos de Supabase:

```bash
npx supabase db push --project-ref vyxhujahqhpkskjbalzg   # dev
npx supabase db push --project-ref ctyqpyznqhcauufoiqam   # producción
```

Si se despliega el código sin la migración: dar de alta una cuenta y recalcular un saldo
fallarán, y el aviso de descuadre saltará en todas las cuentas (leería `saldo_inicial` como 0).
