---
title: Mejoras y cambios pendientes (tanda 2) — App Seguimiento Financiero
description: Nueva lista viva de cambios, mejoras e ideas, posterior a la primera tanda (ver mejoras-pendientes.md, ya entregada a Claude Code el 2026-08-24). Redactada como especificaciones para pasar directamente a Claude Code.
---

# Mejoras y cambios pendientes (tanda 2)

Nueva lista viva. La primera tanda (9 puntos: cuentas editables, formulario bajo demanda, cuentas remuneradas, agrupación temporal de deuda, simulador de amortización en pantalla propia, fechas libres en amortizaciones, previsión de flujo de caja por categoría, detección automática de patrones, traspasos entre cuentas) ya se entregó a Claude Code el 2026-08-24 — ver `mejoras-pendientes.md`.

Cada entrada de aquí en adelante sigue el mismo formato: contexto + requisito + criterios de aceptación, para poder pasarse tal cual a Claude Code cuando la tanda esté lista.

## Pendientes

### 1. Deuda — categoría automática al crear una deuda

**Contexto**: alta de deuda/préstamo (entidad `Deuda`) y su relación con `Categoría`.
**Requisito**: al crear una deuda nueva, la app debe crear automáticamente una categoría de gasto asociada a esa deuda concreta, para que sus cuotas se puedan categorizar sin tener que crear la categoría a mano cada vez. Ejemplos: al crear la deuda "Hipoteca" se crea la categoría "Pago Hipoteca"; al crear el préstamo "Moto" se crea la categoría "Pago Moto".
**Detalle**:
- La categoría se genera a partir del nombre de la deuda (patrón sugerido: "Pago " + nombre de la deuda), y debe quedar enlazada a esa `Deuda` (nuevo campo `deuda_id` en `Categoría`, o `categoria_id` en `Deuda` — a decidir según convención ya usada en el repo, mismo patrón que ya existe para `es_categoria_inversion`).
- Un movimiento categorizado con esa categoría debe poder identificarse como pago de esa deuda concreta (para, en el futuro, poder conciliar cuotas pagadas con el calendario de amortización — no bloqueante para este punto, pero tenerlo en cuenta en el modelo de datos).
- Si se renombra la deuda después de creada, decidir si se renombra también la categoría automáticamente o si a partir de ahí quedan desacopladas (a confirmar con Pablo; por defecto, lo más simple es que se pueda editar la categoría igual que cualquier otra una vez creada, sin que renombrar la deuda la vuelva a tocar).
**Criterios de aceptación**:
- Crear una deuda genera automáticamente su categoría de gasto asociada, sin acción manual del usuario.
- La categoría creada queda vinculada a la deuda de origen.
- El usuario puede seguir editando esa categoría con normalidad (ej. cambiarle el nombre) como cualquier otra categoría.

### 2. Traspasos entre cuentas — revisar enfoque de implementación con Claude Code

**Contexto**: el punto 9 de la tanda 1 (`mejoras-pendientes.md`) ya pide soporte de traspasos entre cuentas como tipo de movimiento independiente (ni ingreso ni gasto). Pablo quiere retomar este tema específicamente para que Claude Code proponga el diseño concreto antes de darlo por cerrado, en vez de asumir nosotros la solución.
**Requisito**: al abordar el punto 9, pedir explícitamente a Claude Code que proponga su enfoque de implementación (modelo de datos, cómo se refleja en el formulario de movimiento, cómo se enlazan las dos cuentas, cómo afecta al patrimonio y a los informes) antes de escribir código, y revisarlo con Pablo. No dar por buena una única forma de hacerlo sin pasar por esa propuesta previa.
**Criterios de aceptación**:
- Antes de implementar el punto 9 de la tanda 1, Claude Code presenta una propuesta de diseño para los traspasos (no solo empieza a programar).
- Pablo revisa y aprueba (o ajusta) esa propuesta antes de que se implemente.

### 3. Confirmación obligatoria al editar o eliminar (doble comprobación)

**Contexto**: transversal a toda la app (cuentas, movimientos, categorías, deudas, inversiones, amortizaciones extra, movimientos previstos, etc.).
**Requisito**: cualquier acción de editar o eliminar un registro debe pedir confirmación explícita al usuario antes de ejecutarse, tipo "¿Estás seguro de...?", para evitar cambios o borrados accidentales.
**Detalle**:
- Aplica especialmente a eliminar (acción destructiva e irreversible), y también a editar cuando el cambio pueda tener impacto relevante (ej. cambiar el saldo de una cuenta, los datos de una deuda ya con histórico, etc.) — a definir con Claude Code el criterio exacto de en qué ediciones hace falta confirmación y en cuáles no (una edición menor de texto quizá no necesite doble comprobación, pero es preferible pecar de cauto).
- El texto de confirmación debe ser específico de la acción y el elemento (ej. "¿Estás seguro de que quieres eliminar la cuenta 'Revolut'? Esta acción no se puede deshacer"), no un mensaje genérico.
**Criterios de aceptación**:
- Toda acción de eliminar en la app muestra un diálogo de confirmación antes de ejecutarse.
- Las ediciones con impacto relevante también piden confirmación.
- El usuario puede cancelar la acción desde el propio diálogo sin que se aplique ningún cambio.

### 4. Bug — transacción con categoría aparece como "Sin Categoría" en gestión de previsiones

**Contexto**: pantalla/módulo de gestión de previsiones (`Movimiento previsto`, ver tanda 1 punto 7-8).
**Problema reportado**: una transacción que ya tiene categoría asignada aparece como "Sin Categoría" en la parte de gestión de previsiones.
**Requisito**: investigar la causa raíz (posibles hipótesis a revisar: la categoría no se está leyendo/uniendo correctamente al mostrar la previsión vinculada a esa transacción, un problema en la conciliación previsto-real del punto 7 que no arrastra la categoría del movimiento real, o la categoría se está mirando en el `Movimiento previsto` en vez de en el `Movimiento` real conciliado) y corregirlo para que la categoría se muestre correctamente en todas las pantallas relacionadas con previsiones.
**Criterios de aceptación**:
- Una transacción categorizada nunca aparece como "Sin Categoría" en la gestión de previsiones.
- Cubrir con caso de prueba este escenario para evitar regresiones.

### 5. Importación de movimientos — cálculo del saldo final tras importar

**Contexto**: flujo de importación de movimientos desde archivo de banco (ver `analisis-funcional.md`, sección 2 "Movimientos" y sección 5, flujo 1 "Importación de movimientos").
**Requisito**: al importar un archivo de un banco con transacciones nuevas, el saldo final de la cuenta debe calcularse sumando y restando todas las transacciones nuevas importadas sobre el saldo que ya tenía la cuenta antes de la importación (saldo_nuevo = saldo_actual_previo + Σ importes de las transacciones importadas), no recalculando ni sobrescribiendo el saldo desde cero ni tomando un saldo final que venga indicado en el propio archivo importado.
**Detalle**:
- Coherente con lo ya definido en el análisis funcional: "la importación debe ser exacta, el saldo debe cuadrar directamente" — este punto concreta cómo se calcula ese cuadre.
- Aplica tanto si el archivo importado trae explícitamente un campo de saldo como si no; el saldo que manda es siempre saldo previo + movimientos nuevos, no un valor tomado directamente del archivo.
**Criterios de aceptación**:
- Tras importar un archivo con N transacciones nuevas, el saldo de la cuenta = saldo anterior a la importación + suma de los importes (con su signo, ingreso/gasto) de esas N transacciones.
- Si se importa el mismo archivo dos veces por error, no se deben duplicar transacciones ni descuadrar el saldo (relacionado con la detección de duplicados en la importación, a confirmar si ya existe esa lógica en el repo).

## Hechas / incorporadas

*(se mueven aquí las que ya se han pasado a Claude Code o incorporado al análisis funcional)*
