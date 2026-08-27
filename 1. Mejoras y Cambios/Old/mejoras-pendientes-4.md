---
title: Mejoras y cambios pendientes (tanda 4) — App Seguimiento Financiero
description: Nueva lista viva de mejoras, dudas abiertas y pruebas, posterior a la tanda 3 (ver mejoras-pendientes-3.md). Redactada como especificaciones para pasar directamente a Claude Code.
---

# Mejoras y cambios pendientes (tanda 4)

Nueva lista viva. Tandas anteriores:
- Tanda 1 (`mejoras-pendientes.md`, entregada a Claude Code el 2026-08-24): cuentas editables, formulario bajo demanda, cuentas remuneradas, agrupación temporal de deuda, simulador de amortización en pantalla propia, fechas libres en amortizaciones, previsión de flujo de caja por categoría, detección automática de patrones, traspasos entre cuentas.
- Tanda 2 (`mejoras-pendientes-2.md`): categoría automática al crear deuda, revisar enfoque de traspasos con Claude Code, confirmación al editar/eliminar, bug de categoría no visible en previsiones, cálculo del saldo tras importar.
- Tanda 3 (`mejoras-pendientes-3.md`): objetivo de ahorro único movido a Configuración (con booleano de inversión), pestaña Configuración de Perfil, previsión automática de intereses de cuentas remuneradas, tabla de sin categorizar en Movimientos, formularios bajo demanda en toda la app, recálculo del simulador desde la fecha elegida, aclaración manual vs. automático en previsiones, fecha de corte en importación. Dudas: futura pestaña de Informes. Pruebas: flujo hipoteca → categoría → previsión → conciliación.

Esta tanda sigue el mismo formato que la tanda 3, con tres tipos de entradas:
- **Mejoras**: cambios/funcionalidades concretas, redactadas como contexto + requisito + criterios de aceptación, listas para pasarse tal cual a Claude Code.
- **Dudas**: preguntas abiertas o cosas que Pablo no tiene claras todavía — no llevan criterios de aceptación cerrados, son para plantearle la pregunta a Claude Code (o decidir con él) antes de convertirlas en una mejora concreta.
- **Pruebas**: casos de prueba/verificación concretos que Pablo quiere que se comprueben en la app, para pasárselos a Claude Code como checklist de testing.

## Mejoras

### 1. Visión central de la app: el "Planificador" — proyección integral de flujo, patrimonio e inversión

**Contexto**: esto no es una funcionalidad aislada, sino la idea principal que da sentido a la app y a la que deben servir todas las piezas de previsión ya especificadas en tandas anteriores (previsión de flujo de caja y detección de patrones — tanda 1, puntos 7-8; previsión de intereses de cuentas remuneradas — tanda 3, punto 3; calendario/simulador de deuda — tanda 1, puntos 4-6; patrimonio global con/sin deuda — `analisis-funcional.md`, sección 2). Eleva y concreta la duda 1 de la tanda 3 ("futura pestaña de Informes"): deja de ser una idea difusa para el futuro y pasa a ser el objetivo central del producto.
**Requisito**: Pablo quiere, en un único sitio (el "Planificador"), poder ver de un vistazo:
- Qué gastos e ingresos **suele tener** (patrones históricos, lo ya ocurrido).
- Qué gastos e ingresos **va a tener** (previsión hacia adelante, combinando lo previsto manual, lo detectado automáticamente, la deuda y los intereses de cuentas remuneradas).
- **Cuánto dinero va a ir teniendo mes a mes y año a año** (evolución de liquidez/saldo agregado a lo largo del tiempo, no solo el mes en curso).
- **Cómo va a evolucionar su patrimonio**: el líquido subiendo, la deuda bajando (coherente con el toggle patrimonio con/sin deuda ya previsto en el análisis funcional), proyectado hacia el futuro, no solo como foto fija de hoy.
- **Cómo van a evolucionar sus inversiones** dentro de esa misma proyección.
**Detalle**:
- Es el módulo que da sentido y consume todo lo que ya se ha ido pidiendo en tandas anteriores: la previsión de flujo de caja por categoría (tanda 1, puntos 7-8) es la pieza de gastos/ingresos; el calendario de deuda y su simulador (tanda 1, puntos 4-6) son la pieza de "deuda bajando"; la previsión de intereses (tanda 3, punto 3) alimenta tanto el flujo como el patrimonio; el patrimonio global con/sin deuda (ya en el análisis funcional) se convierte aquí en una serie temporal proyectada, no en un número estático de hoy.
- La vista debe permitir moverse tanto en granularidad mensual (para el corto/medio plazo) como anual (para el largo plazo, ej. ver la evolución de la hipoteca o del ahorro a 10-20 años vista) — coherente con la agrupación temporal ya pedida para el detalle de deuda (tanda 1, punto 4).
- Debe distinguir visualmente lo que es histórico/real de lo que es previsión/proyección, para que Pablo no confunda ambos.
- No es necesario resolver aquí el diseño visual concreto (gráficos, tablas) — eso se define con Claude Code al implementarlo — pero sí que el modelo de datos y las previsiones ya especificadas en tandas anteriores estén pensadas para poder alimentar esta vista integral sin tener que rehacerse.
**Criterios de aceptación**:
- Existe una pantalla ("Planificador" o nombre equivalente) que muestra, en una misma proyección temporal, ingresos/gastos previstos, evolución del patrimonio (con/sin deuda) y evolución de las inversiones, mes a mes y año a año.
- La proyección combina todas las fuentes de previsión ya especificadas (movimientos previstos manuales y automáticos, calendario de deuda/amortizaciones, intereses de cuentas remuneradas) de forma coherente, sin duplicar ni omitir ninguna.
- Se puede alternar entre vista mensual y anual.
- Se distingue claramente qué datos son histórico real y cuáles son proyección futura.

### 2. Bug — la sugerencia de categoría no reconoce un patrón de descripción ya categorizado como el de un previsto existente

**Contexto**: motor de sugerencia de categoría (tanda 3, punto 4 — tabla de "sin categorizar" con sugerencias), previsión de flujo de caja (tanda 1, puntos 7-8) y aclaración manual vs. automático (tanda 3, punto 7).
**Problema reportado**: en "Movimientos previstos" aparece la previsión "Cuota Hipoteca Pablo". En la tabla de sugerencias aparece un movimiento con descripción bancaria "Operación préstamos crédito aval", que en realidad es el mismo concepto (la cuota de la hipoteca) — Pablo ya ha categorizado antes movimientos con esa misma descripción como "Hipoteca". A pesar de eso, la sugerencia no lo está reconociendo/vinculando correctamente con lo ya aprendido ni con el previsto existente.
**Requisito**: investigar por qué el motor de reglas de categorización no está haciendo match de este patrón de descripción con la categoría "Hipoteca" ya aprendida (a pesar de haber histórico de movimientos con esa misma descripción ya categorizados así), y por qué no se está relacionando con el `Movimiento previsto` "Cuota Hipoteca Pablo" ya existente para esa deuda.
**Hipótesis a revisar con Claude Code**:
- El matching de descripción puede ser demasiado estricto (exacto o casi exacto) y no reconocer que "Operación préstamos crédito aval" es el mismo patrón que ya se aprendió para esa hipoteca (quizás porque el banco usa descripciones variables/genéricas para el mismo concepto).
- Puede no estar comprobando correctamente contra el histórico de categorizaciones ya hechas por el usuario para movimientos de esa misma cuenta/deuda.
- Relacionado con el punto 7 de la tanda 3 (evitar duplicados entre previsto manual y detección automática): si ya existe un `Movimiento previsto` "Cuota Hipoteca Pablo" ligado a la deuda Hipoteca (vía la categoría automática del punto 1 de la tanda 2), la sugerencia debería aprovechar esa relación en vez de tratarlo como un patrón nuevo y desconectado.
**Criterios de aceptación**:
- Un movimiento con una descripción que coincide con el patrón ya aprendido para una categoría (aunque el texto exacto varíe ligeramente, como en este caso) recibe la sugerencia de categoría correcta.
- Si existe un `Movimiento previsto` recurrente para esa misma categoría/deuda, el movimiento se reconcilia con él en vez de aparecer como un patrón nuevo sin relación.
- Cubrir este caso concreto (descripción "Operación préstamos crédito aval" → categoría "Hipoteca") como caso de prueba de regresión.

### 3. Tabla de diagnóstico de la previsión — meses en columnas, categorías padre en filas (desplegables)

**Contexto**: previsión de flujo de caja por categoría (tanda 1, puntos 7-8), directamente motivada por la duda 1 de esta misma tanda (categorías repetidas con importes distintos, subcategorías sueltas en sugerencias). Pablo necesita poder ver exactamente qué previsión está aplicando el sistema para poder localizar dónde están los errores, en vez de intentar depurarlo a ciegas.
**Requisito**: crear una tabla de diagnóstico de la previsión con esta estructura:
- **Columnas**: los meses (proyección hacia adelante, con la misma lógica de horizonte ya usada en el resto de previsión).
- **Filas**: las categorías **padre**. Las categorías padre que tengan subcategorías deben ser desplegables: al expandir una fila, se muestran debajo sus subcategorías con su previsión mes a mes de forma individual (mismo patrón de fila expandible ya usado en la agrupación temporal de deuda, tanda 1, punto 4).
- **Celdas**: el importe previsto de esa categoría (o subcategoría) para ese mes — o vacío/cero si no hay previsión para esa combinación categoría-mes, para poder detectar a simple vista huecos o duplicados.
**Detalle**:
- Es una herramienta de diagnóstico interno, no necesariamente parte de la experiencia final pulida — el objetivo es que Pablo (y Claude Code) puedan ver de un vistazo qué está cogiendo el motor de previsión mes a mes por categoría, y así identificar errores como los de la duda 1 (una misma categoría con varias líneas/importes, subcategorías apareciendo donde no deberían).
- Debe reflejar el resultado real de combinar todas las fuentes de previsión ya especificadas (previsto manual, detección automática nivel 1 y nivel 2 del punto 8 de la tanda 1, previsión de intereses de cuentas remuneradas del punto 3 de la tanda 3, calendario de deuda), para que sirva como vista de verificación de todo el motor, no solo de una pieza.
**Criterios de aceptación**:
- Existe una tabla con meses en columnas y categorías padre en filas, con las filas de categorías con subcategorías desplegables para ver el detalle por subcategoría.
- Cada celda muestra el importe previsto para esa categoría/mes (o queda vacía si no hay previsión), permitiendo detectar visualmente huecos, duplicados o importes inesperados.
- Sirve como base para diagnosticar y resolver la duda 1 de esta tanda antes de convertirla en un fix concreto.
- **Implementada** — ver captura del 2026-08-25: la tabla ya funciona (meses en columnas, categorías padre con subcategorías desplegables, filtro 3/6/12 meses), y gracias a ella se detectó el punto 4 (gap del nivel 2 de detección automática).

### 4. Gap — falta el "nivel 2" de previsión automática (media agregada por categoría, tanto gastos como ingresos) en el motor real

**Contexto**: previsión automática de patrones (tanda 1, punto 8), que especificaba dos niveles: nivel 1 (patrón por transacción individual — recurrencias mensuales o anuales con importe estable) y nivel 2 (patrón agregado por categoría — media mensual histórica para categorías con movimiento recurrente pero variable, ej. Ocio, Compras, Supermercado, **y también ingresos variables**, no solo gastos). Confirmado con la tabla de diagnóstico (punto 3, ya implementada).
**Problema detectado**: en la captura de la tabla de diagnóstico del 2026-08-25, todas las líneas que aparecen (Vivienda, Gimnasio, Pago Yamaha XMAX, Licencias, Intereses, Aportación inversión) son importes idénticos mes a mes — es decir, son todo previsiones de nivel 1 (ítems fijos/vinculados: manuales, deuda, intereses). No hay ninguna categoría mostrando una previsión calculada como **media histórica variable** (nivel 2), ni de gasto ni de ingreso. Esto indica que, aunque el nivel 2 se especificó en la tanda 1 punto 8, no está implementado (o no se está aplicando) en el motor real — la previsión de categorías variables (tanto gastos como comida, ocio, compras, suministros variables, como ingresos variables: extras, propinas, ventas puntuales, etc.) simplemente no aparece, en vez de aparecer como una media calculada.
**Requisito**: implementar (o corregir, si ya existe código para ello pero no se está aplicando) el nivel 2 de la previsión automática **para categorías de gasto y de ingreso por igual**: para categorías con histórico de movimiento recurrente pero sin un patrón de descripción único y estable, calcular la media mensual histórica de esa categoría (sea de gasto o de ingreso) y reflejarla en la previsión de los meses futuros — mismo comportamiento ya descrito en el punto 8 de la tanda 1 (umbral mínimo de histórico, actualización con más datos, el usuario puede revisar/ajustar antes de que sea previsión activa, principio ya reforzado en el punto 7 de la tanda 3).
**Criterios de aceptación**:
- En la tabla de diagnóstico (punto 3), las categorías variables con histórico suficiente —tanto de gasto (ej. Ocio, Supermercado) como de ingreso (ej. ingresos extra variables)— muestran una previsión mensual calculada como media histórica, no aparecen vacías ni ausentes.
- Esa media se recalcula/actualiza a medida que hay más histórico disponible, tal como especifica el punto 8 de la tanda 1.
- Se distingue en la tabla (o en un tooltip/indicador) qué líneas son previsión de nivel 1 (ítem fijo) y cuáles de nivel 2 (media variable), para que Pablo sepa qué tipo de previsión está viendo.

## Dudas

### 1. Sugerencias de Previsión — categorías repetidas con importes distintos, y aparecen subcategorías

**Contexto**: previsión automática de patrones (tanda 1, punto 8), en concreto el nivel 2 (patrón agregado por categoría, ej. "Ocio" con una media mensual).
**Duda de Pablo**: en el apartado de "Sugerencias de Previsión", ¿por qué aparecen categorías repetidas (la misma categoría varias veces, cada una con un importe distinto)? ¿Y por qué aparecen subcategorías en vez de solo las categorías "padre"? Su expectativa es que ahí solo deberían aparecer las categorías padre, cada una una única vez.
**Hipótesis a revisar con Claude Code**:
- Las repeticiones con importes distintos podrían deberse a que el sistema está generando una sugerencia agregada por cada subcategoría por separado (en vez de una sola por categoría padre sumando/promediando todas sus subcategorías), lo que haría que la categoría padre aparezca varias veces con importes distintos (uno por cada subcategoría).
- Las subcategorías apareciendo como entradas propias en la lista de sugerencias, cuando la expectativa de Pablo es que la previsión agregada (nivel 2 del punto 8 de la tanda 1) se muestre siempre a nivel de categoría padre, dejando el desglose por subcategoría (si lo hay) como un detalle dentro de esa sugerencia, no como sugerencias independientes.
**A decidir con Claude Code**: si la solución correcta es que la agregación del nivel 2 (media mensual) se calcule siempre a nivel de categoría padre (sumando todas sus subcategorías), o si tiene sentido mantener el desglose por subcategoría pero presentado de otra forma (ej. una sola sugerencia por categoría padre con el desglose por subcategoría plegado dentro, no como líneas sueltas).
**Nota**: la tabla de diagnóstico (punto 3 de Mejoras, en esta misma tanda) es la herramienta pensada para investigar esta duda antes de convertirla en un fix concreto. Relacionada con el punto 4 (gap del nivel 2) — puede que ambas se resuelvan juntas al implementar/corregir correctamente la agregación por categoría, tanto para gastos como para ingresos.

### 2. Ingresos recurrentes (nómina, pagas extra, alquiler de un piso) — ¿marcarlos manualmente como "recurrente" o debe aprenderlos la app sola?

**Contexto**: aclaración manual vs. automático (tanda 3, punto 7) y nivel 1 de detección automática (tanda 1, punto 8), aplicados esta vez específicamente a ingresos: nómina (mensual), pagas extra (normalmente 1-2 veces al año, en fechas más o menos fijas), y el alquiler que Pablo cobra de un piso que tiene alquilado (mensual, importe estable).
**Duda de Pablo**: ¿debería categorizar/marcar estos ingresos como "recurrentes" a mano, o la app debería aprenderlos sola con el histórico?
**Respuesta funcional (a confirmar que así se está implementando)**: según lo ya especificado, estos casos son justo lo que cubre el nivel 1 de detección automática (tanda 1, punto 8) — no deberían necesitar marcado manual. La nómina y el alquiler son patrones mensuales con importe estable; las pagas extra son patrones anuales con importe estable en fechas más o menos fijas (mismo tipo de caso que el ejemplo ya puesto del seguro del coche en junio). Con histórico suficiente, el sistema debería detectarlos y proponerlos solos, sin necesidad de que Pablo los dé de alta como previsto manual ni los marque de ninguna forma especial.
**Punto abierto a verificar**: en la captura de la tabla de diagnóstico (punto 3 de Mejoras) no aparecía ninguna línea de ingreso (ni nómina, ni alquiler, ni pagas extra), solo gastos. No está claro si es porque no se veían en ese recorte de columnas o porque el nivel 1 no se está aplicando correctamente a los ingresos (mismo tipo de gap que el punto 4, pero de ingresos en vez de nivel 2). Antes de decidir si hace falta alguna acción manual, pedir a Claude Code que confirme, usando la propia tabla de diagnóstico, si estos ingresos ya aparecen previstos automáticamente o no.

## Pruebas

*(vacío por ahora)*

## Hechas / incorporadas

*(se mueven aquí las que ya se han pasado a Claude Code o incorporado al análisis funcional)*
