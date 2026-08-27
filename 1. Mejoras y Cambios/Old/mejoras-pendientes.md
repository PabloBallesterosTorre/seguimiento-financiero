---
title: Mejoras y cambios pendientes — App Seguimiento Financiero
description: Listado vivo de cambios, mejoras e ideas para la app, redactado como especificaciones para pasar directamente a Claude Code. Ver también claude/analisis-funcional.md para el diseño base.
---

# Mejoras y cambios pendientes

Lista viva de cambios y mejoras sobre `claude/analisis-funcional.md`. Cada entrada está redactada como una tarea autocontenida (contexto + requisito + criterios de aceptación) para poder pasarse tal cual a Claude Code. Cuando una tarea se implementa, se mueve a "Hechas / incorporadas".

## Pendientes

### 1. Cuentas — permitir edición

**Contexto**: módulo de Cuentas.
**Requisito**: las cuentas ya creadas deben ser editables, no solo dar de alta. Debe poder modificarse cualquier campo de la cuenta (nombre, banco, tipo, moneda, y los nuevos campos de remuneración del punto 3).
**Criterios de aceptación**:
- Desde el listado/detalle de una cuenta existe una acción "Editar".
- El formulario de edición reutiliza el mismo formulario que el alta, precargado con los datos actuales.
- Guardar actualiza la cuenta sin duplicarla ni afectar a su histórico de movimientos.

### 2. Cuentas — formulario de alta como acción bajo demanda

**Contexto**: módulo de Cuentas.
**Requisito**: el formulario de "nueva cuenta" no debe estar siempre visible/abierto en la pantalla. En su lugar, mostrar solo un botón (ej. "Nueva cuenta"); al pulsarlo se abre el formulario.
**Criterios de aceptación**:
- Estado por defecto de la pantalla: formulario cerrado, solo visible el botón.
- Clic en el botón abre el formulario (modal, panel desplegable o navegación a pantalla propia — usa el patrón de UI que ya predomine en el resto de la app).
- Al guardar o cancelar, el formulario se cierra y se vuelve al estado por defecto (botón).

### 3. Cuentas — soporte de cuentas remuneradas

**Contexto**: módulo de Cuentas / modelo de datos (entidad `Cuenta`).
**Requisito**: una cuenta puede marcarse como remunerada (genera intereses). Cada cuenta remunerada tiene su propio tipo de interés y su propia periodicidad de pago del interés.
**Detalle de campos nuevos en `Cuenta`**:
- `es_remunerada` (bool).
- `tipo_interes` (numérico, % — solo aplica si `es_remunerada`).
- `periodicidad_pago_interes` (enum: diaria / semanal / mensual / otras a definir — solo aplica si `es_remunerada`).
**Criterios de aceptación**:
- El formulario de alta/edición de cuenta permite marcar "remunerada" y, si se marca, muestra los campos de tipo de interés y periodicidad.
- Cada cuenta remunerada puede tener un interés y una periodicidad distintos e independientes del resto de cuentas.
- (Pendiente de definir en un futuro incremento: cómo se calculan y reflejan los intereses devengados sobre el saldo — no bloqueante para este cambio, que es solo de captura de datos.)

### 4. Deuda — agrupación temporal del listado de cuotas

**Contexto**: pantalla de detalle de una deuda, listado de cuotas/movimientos de amortización.
**Requisito**: el listado debe mostrar el detalle mes a mes solo para los próximos 12 meses. A partir de ahí, agrupar por año (una línea resumen por año) para facilitar la lectura en deudas largas (ej. hipotecas a 20-30 años).
**Criterios de aceptación**:
- Los primeros 12 meses (desde la fecha actual) se listan siempre expandidos, mes a mes.
- Los años posteriores aparecen colapsados como una única línea por año (con datos agregados del año: total pagado, capital pendiente a cierre de año, etc. — a definir qué agregados mostrar).
- Cada línea de año es clicable/desplegable: al hacer clic se expande y muestra el detalle mes a mes de ese año concreto; al volver a hacer clic se colapsa de nuevo.
- Varios años pueden estar expandidos a la vez (no es acordeón exclusivo, salvo que se decida lo contrario).

### 5. Deuda — simulador de amortización anticipada en pantalla propia

**Contexto**: pantalla de detalle de una deuda, funcionalidad de calculadora de amortización anticipada (ver `analisis-funcional.md`, sección 5, punto 5).
**Requisito**: el simulador no debe estar integrado en la misma pantalla de detalle de la deuda. Debe ser una pestaña o enlace que lleve a una pantalla dedicada, separada de la vista normal de la deuda, donde el usuario pueda simular escenarios sin afectar ni mezclarse con los datos "reales" mostrados en el detalle.
**Criterios de aceptación**:
- Desde el detalle de la deuda hay una pestaña/botón "Simular amortización" que navega a una pantalla distinta.
- Los cambios que se hagan en el simulador no persisten como amortizaciones reales hasta que el usuario decida aplicarlos explícitamente (a confirmar si existe un paso de "aplicar" o si el simulador es puramente de consulta).

### 6. Deuda — fecha libre por cada amortización extra (puntual o recurrente)

**Contexto**: dentro del simulador/calculadora de amortización anticipada (entidad `Amortización extra`).
**Requisito**: al añadir una amortización extra, el usuario debe poder fijar la fecha concreta de cada aportación individualmente, en lugar de que la app imponga un patrón rígido idéntico todos los periodos.
**Ejemplo de caso de uso**: el usuario hace una amortización puntual en octubre de un año, pero al año siguiente no hace ninguna; o hace una recurrente pero siempre en diciembre (no en el mismo mes natural de la primera aportación si el usuario así lo decide).
**Criterios de aceptación**:
- Amortización puntual: el usuario elige libremente la fecha (día/mes/año) de esa aportación concreta.
- Amortización recurrente: el usuario puede definir la fecha de cada ocurrencia individualmente (no solo una regla fija tipo "cada mes en el día X"), permitiendo saltarse periodos o cambiar el mes de un año a otro.
- El modelo de datos de `Amortización extra` debe soportar una fecha explícita por cada aportación (puntual o cada instancia de una recurrente), no solo una regla de recurrencia abstracta.

### 7. Previsión de flujo de caja — movimientos previstos y proyección, desglosada por categoría

**Contexto**: nuevo módulo transversal, relacionado con `Movimiento` y con el motor de reglas de categorización ya previsto en el análisis funcional.
**Requisito**: la app debe permitir prever gastos e ingresos futuros (fijos o variables) y mostrar una proyección de flujo de caja hacia adelante, **desglosada por categoría**, replicando y mejorando lo que Pablo hacía a mano en el Excel viendo qué tenía "previsto".
**Modelo de datos — nueva entidad `Movimiento previsto`**:
- `id`, `usuario_id`, `cuenta_id`, `descripción`, `categoria_id`, `subcategoria_id` (nullable).
- `importe_estimado` (puede ser fijo o un rango: mínimo/máximo si es variable).
- `tipo_recurrencia` (única vez / recurrente), `periodicidad` (mensual, anual...), `fecha` (si es única vez) o `fecha_inicio` + `fecha_fin` (nullable, si es recurrente).
- `estado` (activo / pausado).
- `movimiento_real_id` (nullable — enlaza con el `Movimiento` real cuando se concilia/materializa).
**Funcionalidad — proyección por categoría**:
- Pantalla de proyección de flujo de caja: partiendo del saldo actual, proyecta hacia adelante (3/6/12 meses configurable) sumando/restando los `Movimiento previsto` de cada periodo.
- La proyección debe poder verse **desglosada por categoría**, no solo como un total agregado, distinguiendo al menos dos naturalezas de previsión por categoría:
  - **Ítems puntuales/estacionales con fecha propia**: ej. "paga extra" como ingreso en un mes concreto, "seguro del coche" como gasto siempre en junio. Se ven como una línea propia en el mes en que caen.
  - **Estimación recurrente media de una categoría**: ej. "Ocio" no es un único movimiento repetido sino la agregación de varios gastos variables — la previsión aquí es una media mensual (ej. 600€/mes), no un movimiento único. Ver punto 8 para cómo se calcula.
- Conciliación: cuando entra un `Movimiento` real que coincide con un `Movimiento previsto` (misma categoría/cuenta, importe similar, fecha cercana), la app sugiere vincularlos; al confirmarse, ese previsto se marca "materializado" para ese periodo y no se duplica en la proyección.
- Comparativa previsto vs. real por categoría y periodo (generaliza el "Cumplió/No cumplió" que ya existe hoy solo para el objetivo de ahorro global).

### 8. Previsión automática de patrones a partir del histórico (por transacción y por categoría agregada)

**Contexto**: extensión del punto 7, apoyada en el motor de reglas de categorización (`Regla de categorización`) ya previsto en el análisis funcional.
**Requisito**: en vez de que el usuario tenga que dar de alta manualmente cada `Movimiento previsto`, la app debe poder analizar el histórico de movimientos importados y detectar patrones recurrentes automáticamente, proponiéndolos como previsiones. El análisis debe operar a dos niveles:
1. **Patrón por transacción individual** (mismo patrón de descripción que se repite): detecta periodicidad (mensual, anual...) y estabilidad del importe. Cubre tanto recurrencias mensuales (nómina, hipoteca, Spotify) como **anuales/estacionales** (seguro del coche siempre en junio, paga extra en un mes concreto) — la periodicidad detectada no debe asumirse siempre mensual, debe poder ser anual u otra.
2. **Patrón agregado por categoría** (varias transacciones distintas dentro de la misma categoría, sin un patrón de descripción único): cuando una categoría tiene gasto recurrente pero variable (ej. Ocio, Compras), calcular una media mensual histórica de esa categoría como estimación de previsión, en vez de intentar prever cada transacción suelta.
**Enfoque común**:
- Reutilizar el agrupado por patrón de descripción del motor de categorización para el nivel 1, y agregación por categoría/mes para el nivel 2.
- Umbral mínimo de histórico antes de proponer un patrón (ej. 3 repeticiones para patrones mensuales, al menos 1-2 años de histórico para confirmar un patrón anual/estacional).
- Cuanta más historia haya, mayor la confianza del sistema en la previsión (tanto en la media de una categoría agregada como en la detección de patrones anuales, que necesitan varios años para confirmarse).
- El sistema **propone**, no crea previsiones de forma silenciosa: el usuario revisa y confirma/ajusta antes de que se convierta en `Movimiento previsto` activo (mismo principio que la categorización sugerida).
**Criterios de aceptación**:
- La app distingue y sugiere tanto ítems puntuales/estacionales con fecha concreta (nivel 1) como medias mensuales por categoría (nivel 2).
- Cuantos más meses/años de histórico tenga el usuario, más patrones y con mayor confianza se detectan (incluyendo patrones anuales, que requieren histórico de varios años).
- El usuario puede aceptar, editar (importe, periodicidad, fecha) o descartar cada patrón sugerido antes de que pase a ser una previsión activa.

### 9. Traspasos entre cuentas — tipo de movimiento independiente (ni ingreso ni gasto)

**Contexto**: modelo de datos de `Movimiento` / categorías.
**Requisito**: Pablo mueve dinero con frecuencia entre sus propias cuentas (traspasos). Estos movimientos no deben contarse como ingreso ni como gasto (distorsionarían las estadísticas de gasto real y la previsión de flujo de caja de los puntos 7-8), pero sí deben registrarse y, si son recurrentes, poder preverse igual que el resto.
**Detalle**:
- Añadir un tipo de movimiento `traspaso` (junto a ingreso/gasto), o una categoría especial equivalente a la ya prevista `es_categoria_inversion` pero para traspasos entre cuentas propias.
- Un traspaso debe poder enlazar cuenta origen y cuenta destino (dos caras del mismo movimiento), para que el patrimonio global no se vea afectado (no es ni entrada ni salida de patrimonio, solo cambia de sitio).
- Los traspasos quedan excluidos del cálculo de ingresos/gastos y del objetivo de ahorro, pero si son recurrentes deben poder aparecer en la previsión de flujo de caja (punto 7-8) para saber qué saldo va a tener cada cuenta individualmente.
**Criterios de aceptación**:
- Un traspaso entre cuentas propias no computa como gasto ni como ingreso en ningún informe ni en el objetivo de ahorro.
- El patrimonio global no varía al registrar un traspaso (solo cambia el saldo por cuenta, no el total).
- Los traspasos recurrentes pueden preverse igual que cualquier otro movimiento previsto.
- **Nota**: antes de implementar este punto, ver tanda 2 punto 2 — pedir a Claude Code que proponga primero su enfoque de diseño y revisarlo con Pablo.

## Hechas / incorporadas

*(se mueven aquí las que ya se han pasado a Claude Code o incorporado al análisis funcional)*
