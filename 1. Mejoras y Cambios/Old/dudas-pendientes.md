---
title: Dudas abiertas — App Seguimiento Financiero
description: Recopilación de todas las dudas abiertas planteadas por Pablo a lo largo de las tandas de mejoras (1 a 5). Incluye un prompt para que Claude Code responda directamente dentro de este mismo documento.
---

# Dudas abiertas — App Seguimiento Financiero

Este documento reúne todas las "Dudas" (preguntas abiertas, no cerradas todavía como mejora concreta) recogidas hasta ahora en las distintas tandas de `mejoras-pendientes*.md`. El objetivo es que Claude Code las responda aquí mismo, con la información real del código y del comportamiento actual de la app, para poder decidir después si cada una se cierra, se convierte en un bug a corregir, o en una mejora nueva.

## Prompt para Claude Code

> Lee cada una de las dudas de este documento (sección "Dudas"). Para cada una, investiga en el código/base de datos real de la app la respuesta a la pregunta planteada (no supongas, comprueba el comportamiento actual). Responde **dentro de este mismo documento**, añadiendo justo debajo de cada duda una subsección nueva `**Respuesta de Claude Code:**` con: (1) qué hace la app hoy realmente en ese punto, (2) si coincide o no con lo especificado en la tanda de origen, y (3) si aplica, una recomendación de qué habría que cambiar y en qué documento (mejora nueva, bug, o ninguna acción porque ya funciona bien). No modifiques el enunciado de las dudas originales, añade tu respuesta a continuación de cada una. Guarda los cambios en este mismo archivo.

## Dudas

### 1. Futura pestaña de "Informes" (pasado y, sobre todo, futuro)

**Origen**: tanda 3, duda 1.
**Contexto**: Pablo quiere, más adelante, una pestaña de informes que muestre tanto la evolución pasada como (especialmente) proyecciones futuras, apoyándose en toda la inteligencia de previsión que se vaya construyendo (previsión de flujo de caja, patrones automáticos, intereses de cuentas remuneradas, calendario de deuda, etc.).
**Duda**: todavía no está definida como mejora concreta — se elevó parcialmente a visión central en la tanda 4 (punto 1, "El Planificador"). ¿Sigue siendo una pestaña de informes separada del Planificador, o el Planificador la sustituye/absorbe? ¿Hay algo del modelo de datos actual que no esté preparado para alimentar esta vista sin rehacerse?

**Respuesta de Claude Code:**
1. **Qué hace la app hoy**: el Planificador (`/planificador`) ya muestra, en una sola línea temporal continua, tanto el pasado real como el futuro proyectado: N periodos hacia atrás reconstruidos del histórico real (líquido exacto, deuda pendiente simulada desde su origen, inversión como coste acumulado) + el mes en curso (marcado "Mixto": real hasta hoy más lo previsto para lo que falta, sin duplicar) + N periodos futuros de proyección (previsión de flujo de caja, calendario de amortización de deuda, intereses de cuentas remuneradas). Tiene vista mensual y anual, y cada fila se etiqueta "Real", "Mixto" o "Proyección".
2. **Coincide con lo especificado**: sí, cubre exactamente lo que pedía esta duda y lo que pedía la tanda 4 (punto 1) — no hay ya una necesidad clara de una pestaña de "Informes" separada, el Planificador la absorbe.
3. **Recomendación**: cerrar esta duda sin crear una pestaña nueva. Dos limitaciones del modelo de datos a anotar para el futuro, ninguna bloqueante hoy:
   - La inversión histórica se muestra como **coste acumulado aportado**, no como valor de mercado histórico — la tabla `inversiones` solo guarda un valor actual (`valor_actual`), no una serie temporal de valoración. Si algún día se quiere ver la evolución real de plusvalías/minusvalías, haría falta una tabla de snapshots de valoración por fecha, que no existe hoy.
   - Si una deuda tuvo alguna vez una reducción de cuota, el tramo histórico anterior a esa reducción se reconstruye con la cuota **actual** (solo se guarda la vigente, no su historial), así que ese tramo es una aproximación, no un cálculo exacto.

---

### 2. Sugerencias de Previsión — categorías repetidas con importes distintos, y aparecen subcategorías

**Origen**: tanda 4, duda 1.
**Contexto**: previsión automática de patrones (tanda 1, punto 8), en concreto el nivel 2 (patrón agregado por categoría, ej. "Ocio" con una media mensual).
**Duda**: en el apartado de "Sugerencias de Previsión", ¿por qué aparecen categorías repetidas (la misma categoría varias veces, cada una con un importe distinto)? ¿Y por qué aparecen subcategorías en vez de solo las categorías "padre"? La expectativa de Pablo es que ahí solo deberían aparecer las categorías padre, cada una una única vez.
**Hipótesis a revisar**: las repeticiones podrían deberse a que el sistema genera una sugerencia agregada por cada subcategoría por separado (en vez de una sola por categoría padre sumando/promediando todas sus subcategorías). Relacionada con la duda 3 de este documento y con el gap de nivel 2 ya detectado en tanda 4, punto 4.

**Respuesta de Claude Code:**
1. **Qué hacía la app**: la hipótesis era correcta. `detectarMediaPorCategoria` (nivel 2) agrupaba por `categoria_id` exacto, así que cada subcategoría generaba su propia sugerencia con su propia media — de ahí las "repeticiones" (en realidad subcategorías distintas de una misma categoría padre, cada una con un importe distinto) y las subcategorías sueltas en vez de la categoría padre.
2. **Ya corregido**: en la tanda 4 se cambió la agregación para que siempre resuelva cada categoría a su padre antes de agrupar (vía un resolver `categoriaEfectiva`), de forma que una categoría con subcategorías sale como una única sugerencia. Cubierto por tests unitarios en `lib/deteccionPatrones.test.ts`.
3. **Recomendación**: cerrar esta duda — no debería reproducirse. Si Pablo lo sigue viendo en la app, sería un bug nuevo a reportar aparte, no el original.

---

### 3. Ingresos recurrentes (nómina, pagas extra, alquiler) — ¿marcarlos manualmente como "recurrente" o debe aprenderlos la app sola?

**Origen**: tanda 4, duda 2.
**Contexto**: nivel 1 de detección automática (tanda 1, punto 8), aplicado a ingresos: nómina (mensual), pagas extra (1-2 veces al año), alquiler que Pablo cobra de un piso (mensual).
**Duda**: ¿debería categorizar/marcar estos ingresos como "recurrentes" a mano, o la app debería aprenderlos sola con el histórico? Según lo especificado, no deberían necesitar marcado manual (nivel 1 ya cubre este caso). Punto abierto a verificar: en la captura de la tabla de diagnóstico (tanda 4, punto 3) no aparecía ninguna línea de ingreso — no está claro si es porque no se veían en ese recorte o porque el nivel 1 no se está aplicando correctamente a los ingresos.

**Respuesta de Claude Code:**
1. **Qué hace la app hoy (comprobado con datos reales, no supuesto)**: el nivel 1 trata ingresos y gastos exactamente igual — no hay ningún caso especial por tipo. El problema no es un bug de "ingreso vs. gasto", es que el histórico real de estos ingresos concretos no encaja en la ventana de detección:
   - La "NOMINA" real tiene 4 pagos con intervalos de 18, 14 y 31 días entre sí (media 21 días) — fuera de la ventana de mensualidad (25-35 días), así que nunca se clasifica como patrón mensual.
   - "Pago de LOCALOCOM S.L." (probablemente la misma nómina, con otra descripción bancaria en 2 meses) solo tiene 2 apariciones — por debajo del mínimo de 3 repeticiones exigido para un patrón mensual. El motor no relaciona "NOMINA" y "Pago de LOCALOCOM S.L." entre sí, al ser descripciones distintas.
   - **Confirmación directa en tus propios datos**: ahora mismo existen 3 `Movimientos previstos` de tipo ingreso — "Alquiler", "Nómina" y "Paga Extra" — los tres con `origen_calculo = 'fijo'` (compatible con alta manual) y, en concreto, "Nómina" guardada con `importe_estimado = 0 €`. Un previsto aceptado desde una sugerencia de nivel 1 siempre trae el importe medio ya calculado, nunca 0 — esto indica que los diste de alta a mano porque el sistema no te los propuso solo, tal como sospechabas.
2. **Coincide con lo especificado**: no del todo — la especificación decía que nivel 1 debería cubrir estos casos sin marcado manual, pero en la práctica la ventana de detección es demasiado estricta para una nómina con esta variabilidad de fechas, y no hay forma de fusionar dos descripciones distintas como "el mismo concepto".
3. **Recomendación**: no cerrar esta duda sin más — hay una mejora real pendiente aquí, para una tanda futura si quieres abordarla: (a) ampliar la ventana de tolerancia de la detección mensual (o hacerla configurable), y (b) añadir una forma de decir "estas dos descripciones son el mismo patrón" en vez de depender de coincidencia exacta de texto. Aparte, ya que reviso esto: el previsto "Nómina" tiene el importe a 0 € — probablemente quieras corregirlo a mano desde Movimientos previstos (ya se puede editar) para que la proyección de flujo de caja no infravalore tus ingresos futuros.

---

### 4. Conciliación previsto-real — ¿se duplica el importe cuando la previsión se materializa?

**Origen**: tanda 5, duda 1.
**Contexto**: módulo de `Movimiento previsto` (tanda 1, punto 7). Ejemplo: Pablo crea manualmente la previsión "Nómina"; cuando llega el mes y se importa/registra el movimiento real correspondiente, ¿qué pasa con los totales?
**Duda**: ¿se cuenta solo el movimiento real, se cuentan ambos (previsto + real), o depende de si se ha conciliado explícitamente? Pablo no quiere que el importe se duplique en ningún cálculo (flujo de caja del mes, totales, comparativa previsto vs. real). La especificación original (tanda 1, punto 7) dice que al confirmarse la conciliación, el previsto se marca "materializado" y no se duplica en la proyección — hay que confirmar que esto es lo que ocurre realmente hoy, dado que hay un bug relacionado ya abierto (tanda 2, punto 4 — categoría "Sin Categoría" en gestión de previsiones) que podría indicar que la conciliación no es del todo fiable.

**Respuesta de Claude Code:**
1. **Qué hacía la app (bug real confirmado, no solo sospecha)**: sí había doble conteo. El saldo del mes en curso partía del saldo real de hoy (que ya incluye lo ocurrido ese mes) y le sumaba ADEMÁS el previsto completo de cada categoría aplicable ese mes, sin excluir los ya conciliados con un movimiento real — tanto en `/prevision` como en el Planificador.
2. **Ya corregido**: ahora un previsto vinculado (`movimiento_real_id`) a un movimiento real fechado en ese mismo mes se excluye del cálculo de ese mes en ambas pantallas — su importe ya está dentro del saldo real de partida, no se vuelve a sumar como previsión. Además, el mes en curso se etiqueta visualmente como "Mes en curso" (en previsión) o "Mixto" (en el Planificador), distinto de los meses puramente futuros, para dejar claro que mezcla lo real ya ocurrido con lo previsto para lo que falta.
3. **Coincide con lo especificado**: sí, ahora sí — la conciliación evita la duplicación tal como decía la especificación original.
4. **Limitación conocida que queda, no resuelta**: `movimiento_real_id` es un único campo por previsión recurrente, así que solo recuerda la conciliación del **último** mes vinculado, no una conciliación independiente por cada instancia mensual. En la práctica esto ya no causa doble conteo (gracias al fix), pero si concilias la nómina de julio y luego quieres ver "qué se concilió en junio", ese dato ya no se conserva. No es urgente, pero sería una mejora futura si te importa guardar el histórico de conciliaciones mes a mes.

## Hechas / incorporadas

*(cuando una duda quede resuelta y no requiera ninguna acción adicional, o su acción derivada ya esté implementada, se mueve aquí con una nota breve de la resolución)*
