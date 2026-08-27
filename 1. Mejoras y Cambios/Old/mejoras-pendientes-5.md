---
title: Mejoras y cambios pendientes (tanda 5) — App Seguimiento Financiero
description: Nueva lista viva de cambios, mejoras, dudas y pruebas, posterior a las tandas 1-4. Redactada como especificaciones para pasar directamente a Claude Code.
---

# Mejoras y cambios pendientes (tanda 5)

Nueva lista viva. Tandas anteriores:

- **Tanda 1** (`mejoras-pendientes.md`, entregada a Claude Code el 2026-08-24): cuentas editables, formulario bajo demanda, cuentas remuneradas, agrupación temporal de deuda, simulador de amortización en pantalla propia, fechas libres en amortizaciones, previsión de flujo de caja por categoría (`Movimiento previsto`), detección automática de patrones (nivel 1 y nivel 2), traspasos entre cuentas.
- **Tanda 2** (`mejoras-pendientes-2.md`): categoría automática al crear una deuda, revisar con Claude Code el diseño de traspasos antes de implementar, confirmación obligatoria al editar/eliminar, bug de categoría "Sin Categoría" en previsiones, cálculo del saldo tras importar.
- **Tanda 3** (`mejoras-pendientes-3.md`): objetivo de ahorro único y genérico movido a Configuración con booleano de inversión, previsión automática de intereses de cuentas remuneradas, tabla de "sin categorizar" en Movimientos, formularios bajo demanda en toda la app, recálculo del simulador desde una fecha elegida, previsto manual vs. automático, fecha de corte en importación; duda sobre pestaña de Informes; prueba de flujo completo hipoteca → categoría → previsión → conciliación.
- **Tanda 4** (`mejoras-pendientes-4.md`): visión central de "El Planificador" (proyección integral de flujo, patrimonio e inversión, mes a mes y año a año); bug de sugerencia de categoría que no reconoce un patrón ya aprendido (Hipoteca); tabla de diagnóstico de la previsión — **implementada**; gap del nivel 2 de previsión automática (media agregada por categoría, gastos e ingresos) que falta en el motor real; duda sobre categorías repetidas/subcategorías sueltas en sugerencias de previsión; duda sobre si los ingresos recurrentes necesitan marcado manual o deben aprenderse solos.

Cada entrada de aquí en adelante sigue el mismo formato: contexto + requisito + criterios de aceptación (Mejoras), contexto + duda + hipótesis (Dudas), o pasos + resultado esperado (Pruebas), para poder pasarse tal cual a Claude Code cuando la tanda esté lista.

## Mejoras

### 1. Planificador / previsión de flujo de caja — diferenciar visualmente histórico y futuro

**Contexto**: pantalla de proyección de flujo de caja (tanda 1, punto 7) y visión de "El Planificador" (tanda 4, punto 1), que muestra meses pasados (histórico real) y meses futuros (proyección/previsión) en la misma vista.
**Requisito**: la app debe diferenciar visualmente, de forma clara, qué parte de lo que se muestra es histórico (movimientos reales ya ocurridos) y qué parte es previsión/futuro (proyectado, todavía no ha pasado), tanto en tablas como en gráficos, para que de un vistazo se sepa qué es un dato consolidado y qué es una estimación.
**Detalle**:
- Aplica al menos a: la tabla/vista de flujo de caja proyectado, y a cualquier gráfico de evolución (patrimonio, flujo, inversión) que combine meses pasados y futuros en el mismo eje temporal.
- El punto de corte es el mes actual (o el último mes con movimientos reales cerrados): todo lo anterior es histórico, todo lo posterior es previsión.
- Sugerencia de tratamiento (a decidir el detalle visual con Claude Code): color o estilo distinto para las celdas/barras de meses futuros (ej. más tenue, con un patrón, o con una etiqueta "previsto"), y/o una línea o separador vertical marcando el mes actual dentro de la tabla o el gráfico.
- Un mes que ya tiene movimientos reales pero todavía no ha terminado (el mes en curso) debe tratarse como caso especial: probablemente mostrar lo real acumulado del mes más lo previsto para los días/movimientos que faltan, dejando claro que es una mezcla (a confirmar el tratamiento exacto con Claude Code).
**Criterios de aceptación**:
- En la vista de flujo de caja / planificador, cualquier usuario puede distinguir de un vistazo qué meses son histórico real y cuáles son previsión futura.
- El criterio de corte (mes actual) es consistente en toda la app, no varía de una pantalla a otra.
- Se aplica tanto en vistas de tabla como en gráficos que mezclen histórico y futuro.

### 2. Todas las tablas de la app — ordenación de filas por columna, y que se recuerde el orden elegido

**Contexto**: transversal a toda la app (Movimientos, Deuda, Cuentas, Movimientos previstos, Categorías, etc.), cualquier pantalla con una tabla de registros.
**Requisito**: en todas las tablas de la app, el usuario debe poder ordenar las filas haciendo clic en la cabecera de cualquier columna (ascendente/descendente), y ese orden elegido debe recordarse — la próxima vez que Pablo entre en esa misma tabla, debe seguir ordenada como la dejó, no volver al orden por defecto.
**Detalle**:
- Aplica a todas las tablas existentes y futuras de la app (patrón transversal, no una pantalla concreta).
- El orden se guarda por tabla (cada tabla recuerda su propio criterio de ordenación de forma independiente) y persiste entre sesiones (no solo mientras la pestaña está abierta) — es decir, se guarda en base de datos asociado al usuario, no solo en el estado local del navegador.
- Comportamiento estándar de ordenación por columna: primer clic ordena ascendente, segundo clic descendente, con indicador visual (flecha o similar) de qué columna y en qué dirección está ordenada la tabla en cada momento.
- Cada tabla tiene un orden por defecto razonable la primera vez que se usa (ej. movimientos por fecha descendente) hasta que el usuario elija otro.
**Criterios de aceptación**:
- El usuario puede ordenar cualquier tabla de la app haciendo clic en la cabecera de columna.
- Al salir y volver a entrar en la misma tabla (incluso en otra sesión/otro día), el orden elegido se mantiene.
- El criterio de ordenación es independiente por tabla (ordenar Movimientos no afecta al orden guardado de Deuda, por ejemplo).

### 3. Formulario de Movimiento previsto — ampliar opciones de periodicidad

**Contexto**: formulario de alta/edición de `Movimiento previsto` (tanda 1, punto 7), desplegable de periodicidad para previsiones recurrentes.
**Requisito**: el desplegable de periodicidad debe incluir más opciones además de mensual/anual, al menos: bimensual (cada 2 meses), trimestral (cada 3 meses) y semestral (cada 6 meses).
**Detalle**:
- Aplica tanto al alta manual de un `Movimiento previsto` como, si procede, a la detección automática de patrones (tanda 1, punto 8), que ya contempla periodicidad mensual y anual/estacional — conviene que el motor de detección también sepa reconocer estas periodicidades intermedias si aparecen en el histórico (ej. un gasto que se repite cada 3 meses), no solo el formulario manual.
- Ejemplos de uso real: seguros o suscripciones con pago trimestral o semestral, algunas cuotas bimensuales.
**Criterios de aceptación**:
- El desplegable de periodicidad ofrece al menos: mensual, bimensual, trimestral, semestral, anual.
- Una previsión creada con una de estas periodicidades genera correctamente las ocurrencias futuras en la proyección de flujo de caja, espaciadas según corresponda.

### 4. Categorías — vista de detalle al editar, con los movimientos asociados

**Contexto**: pantalla de gestión de `Categoría` (con relación padre-hija vía `categoria_padre_id`, ver `analisis-funcional.md`).
**Requisito**: al querer editar una categoría, se debe abrir una vista de detalle en la misma pantalla del navegador (sin navegar a otra URL/pantalla) mostrando los datos de esa categoría, y justo debajo, el listado de todos los `Movimiento` asociados a ella.
**Detalle**:
- Si la categoría editada es una **categoría padre**, el listado de movimientos debe incluir tanto los movimientos categorizados directamente en ella como los de todas sus categorías hijas (vista agregada).
- Si la categoría editada es una **categoría hija** (subcategoría), el listado de movimientos debe mostrar únicamente los movimientos categorizados en esa subcategoría concreta, sin mezclar con otras hijas de la misma categoría padre.
- El listado de movimientos asociados debería poder aprovechar la tabla de movimientos ya existente (con su ordenación, ver Mejora 2 de esta tanda) en vez de construir una tabla nueva desde cero.
- No implica necesariamente un modal flotante clásico — puede ser un panel/sección que se despliega en la propia pantalla ("misma pantalla del navegador" tal como lo pide Pablo), a decidir el patrón visual concreto con Claude Code según lo que ya use el resto de la app para edición.
**Criterios de aceptación**:
- Al editar cualquier categoría, se abre una vista de detalle en la misma pantalla con sus datos y sus movimientos asociados, sin recargar ni navegar a otra pantalla.
- Editar una categoría padre muestra los movimientos propios más los de todas sus hijas.
- Editar una categoría hija muestra solo sus propios movimientos.

### 5. Aclaración funcional — qué gana, previsto o real, al conciliar un movimiento importado

**Contexto**: conciliación previsto-real en la importación (tanda 1, punto 7). Diagrama de referencia: [Previsto vs. Real al Importar](https://claude.ai/code/artifact/bd5c07e5-7401-42e3-affb-4f9a78efbb5e).
**Aclaración funcional (para guiar la implementación, no solo documentación)**: cuando un movimiento importado coincide con un `Movimiento previsto` existente y la conciliación se confirma:
- El **importe, la fecha, la categoría y la cuenta que cuentan en saldo, flujo de caja y patrimonio son siempre los del Movimiento real** (el importado), nunca los estimados de la previsión.
- El `Movimiento previsto` original se marca como **materializado** para ese periodo concreto (vía `movimiento_real_id`) y **deja de sumarse aparte** en la proyección — así se evita la duplicidad que preocupaba a Pablo.
- El importe estimado original de la previsión **se conserva** en su propio registro, pero únicamente como referencia para la comparativa previsto vs. real (tanda 1, punto 7) — no participa en ningún total.
- Si no hay coincidencia, o el usuario no confirma la sugerencia de conciliación, el movimiento sigue su flujo normal (sugerencia de categoría por histórico, tabla de "sin categorizar" si no tiene categoría — tanda 3, punto 4).
**Casos borde a resolver con Claude Code** (no cerrados todavía, decidir al implementar):
1. Ambigüedad: si dos previsiones parecidas podrían coincidir con el mismo movimiento (ej. dos previsiones de "Ocio" el mismo mes), ¿cuál se prioriza, o se pide al usuario que elija?
2. Si el usuario rechaza una sugerencia de conciliación, ¿queda memorizado para no repetirla, o puede volver a proponerse en la siguiente importación?
3. Si el importe real se aleja bastante del previsto (ej. previsto 600€, real 1.200€), ¿el umbral de "importe similar" ya lo descarta como no-match, o debe seguir sugiriéndose igualmente?
**Criterios de aceptación**:
- Tras conciliarse un `Movimiento previsto` con su `Movimiento` real, el importe solo computa una vez (el real) en cualquier cálculo de saldo, flujo de caja o patrimonio.
- La previsión conciliada queda marcada como materializada, visible como tal, y no se puede volver a conciliar por error con otro movimiento.
- La comparativa previsto vs. real muestra ambos importes (estimado y real) sin que eso implique sumarlos juntos.
- Los tres casos borde de arriba quedan resueltos explícitamente en el diseño antes de darlo por cerrado (no dejarlos a comportamiento implícito no definido).

### 6. Sugerencias de Previsión — poder descartar una sugerencia, no solo aceptarla

**Contexto**: previsión automática de patrones a partir del histórico (tanda 1, punto 8), que especifica que "el sistema propone, no crea previsiones de forma silenciosa: el usuario revisa y confirma/ajusta antes de que se convierta en `Movimiento previsto` activo". Hoy, en la pantalla de sugerencias de previsión, la única acción disponible es aceptar.
**Problema reportado**: hay sugerencias que, aunque el sistema las detecta como patrón (mismo importe/descripción repitiéndose varias veces), Pablo sabe por contexto que no son un patrón real, sino coincidencia (ej. dos compras puntuales por casualidad con importes parecidos, o un gasto que no va a repetirse). Ahora mismo no hay forma de decirle a la app "esto no es un patrón, no lo quiero como previsión" — solo se puede aceptar o ignorar la pantalla, sin que quede constancia de que se ha revisado y descartado a propósito.
**Requisito**: añadir una acción de **descartar/rechazar** a cada sugerencia de previsión (nivel 1 y nivel 2), junto a la de aceptar, para que Pablo pueda decir explícitamente que una sugerencia detectada no es un patrón real.
**Detalle**:
- Al descartar una sugerencia, esta debe **dejar de proponerse en el futuro** para el mismo patrón concreto (misma descripción/categoría/importe que la originó) — si no, el sistema volvería a sugerir lo mismo en el siguiente ciclo de análisis y la acción de descartar no serviría de nada.
- Conviene guardar el descarte de forma explícita (ej. un estado "descartado" en el patrón detectado, o una lista de patrones ignorados por el usuario), no solo borrar la sugerencia de la vista, para que el motor de detección lo tenga en cuenta en análisis futuros del histórico.
- Debe quedar accesible en algún sitio (aunque sea secundario) el historial de sugerencias descartadas, por si Pablo se equivoca y quiere recuperar una — no es obligatorio para la primera versión, pero conviene tenerlo en cuenta en el modelo de datos para no tener que rehacerlo.
- Relacionado con el caso borde 2 de la Mejora 5 de esta misma tanda (rechazo de una sugerencia de *conciliación* import-real vs. previsto): son dos superficies distintas (una es "¿esto es un patrón?", la otra es "¿este movimiento real es el mismo que esta previsión?"), pero comparten el mismo principio — un rechazo del usuario debe recordarse y no repetirse sin más contexto.
**Criterios de aceptación**:
- Cada sugerencia de previsión (nivel 1 o nivel 2) tiene una acción de descartar, además de la de aceptar.
- Un patrón descartado no se vuelve a proponer como sugerencia en análisis posteriores del histórico.
- El descarte queda registrado (no es solo ocultar la fila en la interfaz), de forma que se pueda auditar o revertir más adelante si hace falta.

### 7. Módulo de previsión — orden por defecto: ingresos primero, luego gastos

**Contexto**: todas las tablas y listados dentro del módulo de previsión (`Movimiento previsto`, sugerencias de previsión, tabla de diagnóstico de previsión — tanda 4, punto 3 — y, cuando exista, el Planificador — tanda 4, punto 1).
**Requisito**: en cualquier tabla o listado de la parte de previsión, el orden por defecto debe mostrar primero todos los ingresos y después todos los gastos, en vez del orden actual (mezclados o sin distinción por tipo).
**Detalle**:
- Aplica como criterio de orden por defecto en todas las vistas de previsión: listado de movimientos previstos, sugerencias de previsión (nivel 1 y nivel 2), y la tabla de diagnóstico.
- Es un orden por defecto, no exclusivo: dentro de cada bloque (ingresos, luego gastos) sigue aplicando el criterio de ordenación secundario que ya exista (ej. por categoría o por importe), y es compatible con la ordenación por columna y su persistencia ya pedida en esta misma tanda (Mejora 2) — si Pablo cambia el orden de una tabla haciendo clic en una columna, ese cambio manual prevalece sobre el agrupado por defecto, salvo que se decida lo contrario con Claude Code.
**Criterios de aceptación**:
- En toda tabla o listado del módulo de previsión, al cargar por primera vez (sin que el usuario haya elegido otro orden), los ingresos aparecen antes que los gastos.
- El criterio es consistente en todas las pantallas de previsión, no varía de una a otra.

### 8. Pantalla de Informes — dashboard con las vistas acordadas con Pablo

**Contexto**: resuelve la duda 1 de la tanda 3 (futura pestaña de "Informes") y da forma concreta a la parte de visualización de "El Planificador" (tanda 4, mejora 1). Antes de especificarlo, se construyó un prototipo interactivo con datos de ejemplo (ficticios, no reales) para acordar con Pablo qué vistas son útiles: [Dashboard de Informes](https://claude.ai/code/artifact/7e6278fe-935b-46f7-8d47-943939a68b5c). Este punto traduce ese prototipo a especificación para implementarlo con datos reales.
**Requisito general**: crear una pantalla de Informes con las siete vistas descritas abajo (8.1 a 8.7), todas ellas dentro de un único filtro de rango temporal compartido (presets: últimos 6 / últimos 12 / todos los meses de histórico disponible), aplicado a todas las vistas salvo donde se indique lo contrario. La previsión de los próximos meses se muestra siempre a continuación del histórico, distinguida visualmente según ya se especificó en la Mejora 1 de esta misma tanda (color más tenue + marcador de "hoy").
**Principios transversales a las siete vistas** (ya validados en el prototipo, deben mantenerse en la implementación real):
- Cada gráfico con datos por mes muestra un tooltip al pasar el cursor sobre cualquier punto o barra, con los valores relevantes de ese mes.
- Cada gráfico tiene una alternativa de "ver como tabla" (accesibilidad y para poder copiar/consultar los números exactos).
- Los gráficos con más de una serie llevan leyenda.
- Los datos agregados por categoría (8.3, 8.4, 8.5) se calculan solo sobre movimientos reales/históricos, nunca mezclando con previsión, para no repetir el problema que motivó la Mejora 1.

#### 8.1 Dinero disponible ahora (indicador principal)

**Requisito**: mostrar de forma destacada, arriba de la pantalla, el dinero disponible actual (líquido + inversión, sin descontar deuda) con: el valor actual, la variación absoluta y porcentual frente al mes anterior, y una minigráfica de los últimos 12 meses.
**Criterios de aceptación**: el valor y la variación se recalculan automáticamente al cerrarse cada mes; la minigráfica refleja los últimos 12 meses con datos reales disponibles.

#### 8.2 Flujo mensual disponible

**Requisito**: gráfico de barras por mes mostrando el dinero disponible neto de ese mes (ingresos − gastos), con barras hacia arriba cuando sobra y hacia abajo cuando falta.
**Criterios de aceptación**: cada barra, al pasar el cursor, muestra ingresos, gastos y el neto de ese mes; los meses de previsión se distinguen visualmente de los históricos (Mejora 1).

#### 8.3 Gasto e ingreso medio mensual por categoría

**Requisito**: dos gráficos de barras horizontales (uno de gasto, uno de ingreso), ordenados de mayor a menor, mostrando la **media mensual** de cada categoría en el rango de histórico seleccionado (total del periodo dividido entre el número de meses del periodo), no la suma acumulada.
**Detalle**: en gasto, las categorías son las categorías padre ya existentes en el modelo de datos (con sus subcategorías agregadas dentro, coherente con la Mejora 4 de esta tanda). En ingreso, las fuentes de ingreso recurrentes ya identificadas (nómina, alquiler, pagas extra, ingresos variables — tanda 4, duda 2).
**Criterios de aceptación**: cambiar el rango de histórico (6/12/todos) recalcula la media dividiendo por el número de meses correspondiente.

#### 8.4 Evolución mensual por categoría de gasto (pequeños múltiplos)

**Requisito**: un mini-gráfico de línea por cada categoría de gasto (una cuadrícula, uno por categoría padre), mostrando su importe mes a mes dentro del rango de histórico seleccionado, para detectar si una categoría tiene una tendencia sostenida o un pico puntual.
**Criterios de aceptación**: cada mini-gráfico muestra el valor del último mes junto al nombre de la categoría; al pasar el cursor sobre un punto se ve el mes y el importe exacto.

#### 8.5 Previsto vs. real por categoría

**Requisito**: gráfico de barras agrupadas por categoría de gasto comparando, para el último mes cerrado, el importe que el motor de previsión automática (nivel 2, tanda 1 punto 8) habría estimado frente al importe real de ese mes.
**Detalle**: usar los mismos colores ya establecidos en la aclaración funcional de la Mejora 5 de esta tanda para distinguir "previsto" (ámbar) de "real" (verde/teal), para que la codificación visual sea consistente en toda la documentación y, si se traslada a la app, en toda la interfaz.
**Criterios de aceptación**: la comparativa usa el valor de previsión que realmente calcula el motor (no un cálculo aparte solo para esta pantalla) — si en el momento de implementar esto el nivel 2 sigue sin funcionar bien (tanda 4, punto 4), esta vista queda bloqueada hasta que se resuelva esa mejora, no se debe inventar un cálculo alternativo solo para el dashboard.

#### 8.6 Patrimonio neto y deuda pendiente

**Requisito**: gráfico de líneas con dos series: patrimonio neto (activos totales menos deuda pendiente) y deuda pendiente, evolucionando juntas mes a mes, histórico y previsión.
**Criterios de aceptación**: permite ver de un vistazo que la deuda baja mientras el patrimonio neto sube, coherente con la visión del Planificador (tanda 4, punto 1).

#### 8.7 Objetivo de ahorro — cumplimiento mensual

**Requisito**: una tira de indicadores, uno por mes (histórico y previsión), en verde si el ahorro real de ese mes alcanzó el objetivo de ahorro configurado (tanda 3, punto 1) y en rojo si no, cada uno con un icono además del color (nunca solo color, por accesibilidad).
**Criterios de aceptación**: usa el objetivo de ahorro único configurado en Configuración de Perfil (tanda 3, punto 1), incluyendo el booleano de si la inversión cuenta o no en ese cálculo; al pasar el cursor sobre un mes se ve el ahorro real, el objetivo y si se cumplió.

## Dudas

### 1. Conciliación previsto-real — ¿se duplica el importe cuando la previsión se materializa? *(resuelta → ver Mejora 5)*

**Contexto**: módulo de `Movimiento previsto` (ver tanda 1, punto 7). Pablo ha creado manualmente la previsión "Nómina"; cuando llegue el mes y se importe/registre el `Movimiento` real correspondiente a esa nómina, quiere saber qué pasa con los totales (flujo de caja, proyección, comparativa previsto vs. real).
**Duda**: cuando el movimiento real que corresponde a una previsión se crea (por importación o alta manual), ¿se cuenta solo el movimiento real, se cuentan ambos (previsto + real), o depende de si se ha conciliado explícitamente? Pablo no quiere que el importe se duplique en ningún cálculo (flujo de caja del mes, totales, comparativa previsto vs. real).
**Lo que dice la especificación ya entregada (tanda 1, punto 7)**: "cuando entra un Movimiento real que coincide con un Movimiento previsto (misma categoría/cuenta, importe similar, fecha cercana), la app sugiere vincularlos; al confirmarse, ese previsto se marca 'materializado' para ese periodo y no se duplica en la proyección." Es decir, el diseño ya contempla este caso: tras la conciliación, solo debería contar el movimiento real; el previsto queda marcado como materializado para ese periodo concreto (no se borra, para conservar el histórico de qué se prevía vs. qué pasó realmente, pero deja de sumarse aparte).
**Hipótesis**: dado que ya hay un bug abierto relacionado (tanda 2, punto 4 — una transacción categorizada aparece "Sin Categoría" en gestión de previsiones), es posible que la conciliación previsto-real no esté funcionando de forma completamente fiable en la implementación actual, y que de ahí venga también la duda de si hay doble conteo. Hay que verificar con Claude Code, con un caso real (crear previsión de nómina, importar/registrar el movimiento real correspondiente, y comprobar el flujo de caja del mes y la comparativa previsto vs. real), que:
- El importe solo se cuenta una vez en el flujo de caja real del periodo (el del movimiento real, no el estimado).
- La previsión original queda marcada como "materializada"/conciliada para ese periodo y no aparece también como pendiente.
- La comparativa previsto vs. real (ya prevista en tanda 1, punto 7) muestra ambos valores (lo que se preveía y lo que realmente ocurrió) sin que eso implique sumarlos juntos en los totales.
**Criterios de aceptación**:
- Confirmar (o corregir) que, tras conciliarse un `Movimiento previsto` con su `Movimiento` real, el importe solo computa una vez en el flujo de caja y en cualquier total agregado.
- La previsión conciliada queda visualmente identificada como tal (materializada) y no se puede volver a conciliar por error con otro movimiento.
- Cubrir este escenario con un caso de prueba (ver sección Pruebas de esta tanda o de tandas siguientes).

## Pruebas

*(pendiente de completar)*

## Hechas / incorporadas

*(se mueven aquí las que ya se han pasado a Claude Code o incorporado al análisis funcional)*
