---
title: Mejoras y cambios pendientes (tanda 6) — App Seguimiento Financiero
description: Nueva lista viva de cambios, mejoras, dudas y pruebas, posterior a las tandas 1-5. Redactada como especificaciones para pasar directamente a Claude Code.
---

# Mejoras y cambios pendientes (tanda 6)

Nueva lista viva. Las tandas anteriores (1 a 5, más el documento de dudas y el de datos disponibles) se han archivado en la subcarpeta `Old\` de esta misma carpeta, para dejar aquí solo lo activo. Resumen de tandas anteriores:

- **Tanda 1**: cuentas editables, formulario bajo demanda, cuentas remuneradas, agrupación temporal de deuda, simulador de amortización en pantalla propia, fechas libres en amortizaciones, previsión de flujo de caja por categoría (`Movimiento previsto`), detección automática de patrones (nivel 1 y nivel 2), traspasos entre cuentas.
- **Tanda 2**: categoría automática al crear una deuda, revisar con Claude Code el diseño de traspasos, confirmación obligatoria al editar/eliminar, bug de categoría "Sin Categoría" en previsiones, cálculo del saldo tras importar.
- **Tanda 3**: objetivo de ahorro único y genérico en Configuración, previsión automática de intereses de cuentas remuneradas, tabla de "sin categorizar" en Movimientos, formularios bajo demanda en toda la app, recálculo del simulador desde una fecha elegida, previsto manual vs. automático, fecha de corte en importación.
- **Tanda 4**: visión central de "El Planificador"; bug de sugerencia de categoría que no reconoce un patrón ya aprendido; tabla de diagnóstico de la previsión (implementada); gap del nivel 2 de previsión automática (gastos e ingresos); dudas sobre categorías repetidas en sugerencias y sobre ingresos recurrentes.
- **Tanda 5**: cuentas editables/tablas ordenables y persistentes, periodicidades intermedias en previsiones, vista de detalle de categoría con sus movimientos, aclaración funcional previsto vs. real al conciliar (con diagrama), poder descartar sugerencias de previsión, orden ingresos-antes-que-gastos en previsión, y la especificación completa del dashboard de Informes (7 vistas, con prototipo interactivo de referencia).
- **`dudas-pendientes.md`**: documento con un prompt para que Claude Code respondiera directamente las dudas abiertas hasta ese momento — revisar si ya tiene respuestas antes de repetir esas preguntas aquí.
- **`datos-disponibles-para-informes.md`**: inventario real de las tablas y campos de la base de datos, escrito por Claude Code. Muy útil como referencia antes de especificar nada que dependa de datos concretos — de ahí salen las dos entradas de "Bugs / gaps detectados" de más abajo.

Cada entrada de aquí en adelante sigue el mismo formato: contexto + requisito + criterios de aceptación (Mejoras), contexto + duda + hipótesis (Dudas), o pasos + resultado esperado (Pruebas).

## Mejoras

### 1. Bug — `movimientos_previstos.movimiento_real_id` solo recuerda la conciliación del último mes, no una por cada instancia mensual

**Contexto**: descubierto al revisar `datos-disponibles-para-informes.md` (inventario de base de datos escrito por Claude Code). La tabla `movimientos_previstos` tiene un único campo `movimiento_real_id` por fila de previsión recurrente. Una previsión recurrente (ej. "Nómina", mensual) es una sola fila en la base de datos que se repite conceptualmente cada mes — pero solo hay un campo para guardar con qué movimiento real se concilió, no uno por cada mes/instancia.
**Problema**: esto entra en conflicto directo con lo ya especificado en la tanda 1 (punto 7) y con la aclaración funcional de la tanda 5 (Mejora 5): cada mes debe poder conciliarse de forma independiente, y debe quedar registro de qué pasó en cada mes concreto (para la comparativa previsto vs. real mes a mes, y para que un mes ya conciliado no vuelva a aparecer como pendiente). Con un único campo, al conciliarse el mes de octubre se pierde (se sobrescribe) el registro de que noviembre ya se concilió el mes anterior, y no hay forma de mostrar un histórico de "qué pasó cada mes" para esa previsión recurrente.
**Requisito**: cambiar el modelo de datos para que la conciliación se registre **por instancia mensual**, no una sola vez por previsión recurrente. La forma más simple y coherente con lo ya construido: una tabla nueva de conciliaciones (`previsto_id`, `periodo` o `fecha_instancia`, `movimiento_real_id`), o bien materializar cada instancia mensual de una previsión recurrente como su propia fila vinculable — a decidir con Claude Code cuál encaja mejor con cómo está construido hoy el motor de previsión, pero el resultado debe ser: cada mes de una previsión recurrente se concilia de forma independiente y queda su propio registro.
**Criterios de aceptación**:
- Conciliar el movimiento real de un mes con una previsión recurrente no afecta ni sobrescribe la conciliación de otro mes de esa misma previsión.
- Es posible consultar, para una previsión recurrente, qué meses están conciliados/materializados y con qué movimiento real, mes a mes.
- La comparativa previsto vs. real (tanda 1, punto 7; tanda 5, Mejora 8.5) puede mostrar el histórico completo, no solo el último mes conciliado.

### 2. Duda / posible gap — la previsión de intereses de cuentas remuneradas ignora la periodicidad configurada

**Contexto**: descubierto en `datos-disponibles-para-informes.md`. El campo `cuentas.periodicidad_pago_interes` se captura en el formulario (tanda 1, punto 3) pero **no se usa en ningún cálculo**: el interés previsto siempre se compone mensualmente, sea cual sea la periodicidad configurada.
**Duda**: ¿es una simplificación aceptada (todas las cuentas remuneradas se tratan como si pagaran mensualmente, aunque el campo diga otra cosa) o es un gap frente a lo pedido en la tanda 3, punto 3 ("cálculo del interés previsto en cada periodo según la periodicidad configurada")? Si es una simplificación consciente, lo suyo sería quitar las opciones que no se van a usar del formulario (o dejar claro en la interfaz que hoy todo se compone mensualmente) en vez de dejar un campo que aparenta tener efecto y no lo tiene.
**A decidir con Claude Code**: si merece la pena implementar el cálculo real por periodicidad (diaria/semanal/trimestral/anual) o si se acepta la simplificación mensual y se ajusta el formulario para no prometer algo que no se cumple.

### 3. Home — renombrar `/dashboard` a `/home`, y sustituir "Cuentas" por el indicador de Liquidez

**Contexto**: la ruta actual `/dashboard` pasa a llamarse `/home`. En esa pantalla existe hoy una sección "Cuentas"; se sustituye por el indicador "Dinero disponible ahora" ya especificado en la tanda 5 (Mejora 8, apartado 8.1, dashboard de Informes en `/informes`), renombrado aquí como **"Liquidez"**.
**Requisito**:
- Renombrar la ruta `/dashboard` a `/home` (y cualquier enlace de navegación interna que apunte a `/dashboard` debe actualizarse a `/home`).
- En la posición donde hoy aparece "Cuentas" en esa pantalla, colocar el indicador de liquidez: valor actual (líquido + inversión), variación frente al mes anterior, y la minigráfica de los últimos 12 meses — mismo componente ya especificado en la Mejora 8.1 de la tanda 5, con la etiqueta "Liquidez" en vez de "Dinero disponible ahora".
- La sección "Cuentas" deja de aparecer en esa posición de la Home. Se asume que la pantalla de Cuentas sigue existiendo y accesible desde la navegación general de la app (no se elimina la funcionalidad, solo se quita de esa posición en la Home) — confirmar este punto con Claude Code si no es lo que se quiere.
**Criterios de aceptación**:
- La URL `/dashboard` ya no existe como tal; `/home` muestra lo que antes mostraba `/dashboard`.
- En la posición donde antes estaba "Cuentas", ahora se muestra el indicador "Liquidez" (mismo cálculo y comportamiento que la Mejora 8.1 de la tanda 5: valor, variación vs. mes anterior, minigráfica).
- La pantalla de Cuentas sigue siendo accesible desde algún otro punto de la navegación de la app.

### 4. Home — sustituir "Objetivo de ahorro" por "Flujo Mensual Disponible" comparado con la línea del objetivo

**Contexto**: en la Home (antes `/dashboard`, ahora `/home` — ver Mejora 3 de esta tanda), existe hoy una sección de "Objetivo de ahorro" (Cumplió/No cumplió, tanda 3 punto 1). Se sustituye por el gráfico de "Flujo Mensual Disponible" ya especificado en la tanda 5 (Mejora 8, apartado 8.2), añadiéndole la comparación visual contra el objetivo.
**Requisito**:
- En esa posición de la Home, mostrar el gráfico de barras de Flujo Mensual Disponible (ingresos − gastos por mes, tanda 5 Mejora 8.2).
- Añadir al gráfico una **línea horizontal discontinua** en el valor del objetivo de ahorro configurado (Configuración de Perfil, tanda 3 punto 1), para poder comparar de un vistazo si el flujo disponible de cada mes alcanza o no ese objetivo.
**Detalle**:
- Ojo con el booleano `incluir_inversion_en_ahorro` (tanda 3, punto 1): el ahorro real ya configurado en la app puede o no restar la aportación a inversión, según ese booleano. El flujo mensual disponible tal y como está especificado en la Mejora 8.2 es simplemente ingresos − gastos, sin ese matiz. Para que la comparación contra la línea del objetivo tenga sentido, hay que decidir con Claude Code si el cálculo de las barras en esta vista debe aplicar ese mismo booleano (y por tanto puede diferir del "Flujo Mensual Disponible" que se ve en la pantalla de Informes) o si se deja igual y se acepta que la línea de objetivo se compara contra un flujo calculado de forma distinta a como se calcula el cumplimiento en Configuración/Informes.
- Esto sustituye a la sección "Objetivo de ahorro" (Cumplió/No cumplió) de `/dashboard`. El semáforo mensual de cumplimiento (tanda 5, Mejora 8.7) sigue existiendo aparte, en la pantalla de Informes — esta mejora no lo elimina, es un indicador complementario en otro sitio.
**Criterios de aceptación**:
- La Home muestra el flujo mensual disponible como gráfico de barras, con una línea horizontal discontinua marcando el objetivo de ahorro vigente.
- Un mes cuya barra queda por debajo de la línea es identificable de un vistazo como "no alcanzó el objetivo ese mes", sin tener que mirar el número exacto.
- Cambiar el objetivo de ahorro en Configuración de Perfil actualiza la posición de la línea sin necesidad de otro cambio.
- Queda resuelto explícitamente (no implícito) si el cálculo de las barras aplica o no el booleano `incluir_inversion_en_ahorro`.

### 5. Principio transversal — todos los informes calculan solo sobre los datos reales disponibles, nunca asumen un periodo completo que no existe

**Contexto**: aplica a todo el dashboard de Informes (tanda 5, Mejora 8) y a las vistas equivalentes añadidas a la Home (Mejoras 3 y 4 de esta tanda): medias mensuales por categoría, indicador de "Liquidez", flujo mensual disponible, previsto vs. real, patrimonio y deuda, cumplimiento del objetivo de ahorro.
**Problema a evitar**: si el usuario selecciona un rango como "últimos 6 meses" pero la app solo tiene histórico real de, por ejemplo, 3 meses (porque lleva poco tiempo usándola, o acaba de importar), ningún cálculo debe asumir que hay 6 meses de datos. Una media dividida entre 6 cuando solo hay 3 meses reales da un resultado incorrecto (más bajo de lo real).
**Requisito**: en todos los informes, cualquier cálculo (media, comparación con el periodo anterior, tendencia, agregación) debe operar exclusivamente sobre los meses en los que existen datos reales, sea cual sea el rango nominal seleccionado por el usuario.
**Detalle**:
- Las medias mensuales por categoría (tanda 5, Mejora 8.3) se dividen entre el número real de meses con datos, no entre el tamaño del rango seleccionado.
- Las comparativas "vs. mes/periodo anterior" (indicador de Liquidez, Mejora 3 de esta tanda) solo se calculan si existe un periodo anterior con datos; si no existe (ej. el usuario lleva menos de dos meses usando la app), no se muestra una comparación inventada — se indica claramente que todavía no hay periodo anterior con el que comparar.
- Cuando el rango seleccionado por el usuario (6/12/todos) es mayor que el histórico real disponible, la interfaz debe dejarlo claro (ej. "media sobre los últimos 3 meses" en vez de dar a entender que son 6), no fallar en silencio ni mostrar un rango que en realidad no tiene datos.
- Aplica también a los pequeños múltiplos por categoría (tanda 5, Mejora 8.4) y a cualquier vista de tendencia: no se dibuja ni se etiqueta un mes sin datos reales como si tuviera un valor de cero o vacío indistinguible de "no hay datos todavía".
**Criterios de aceptación**:
- Ningún cálculo de media, comparación o tendencia en los informes divide o compara contra un número de periodos mayor que los que realmente tienen datos.
- La interfaz comunica cuántos meses reales está usando cada cálculo cuando ese número es menor que el rango seleccionado.
- Un usuario con poco histórico (ej. 1-2 meses) ve informes coherentes con esos pocos datos, no medias o comparativas distorsionadas por meses inexistentes.

### 6. Informes — eliminar la vista "Objetivo de ahorro — cumplimiento mensual" (8.7)

**Contexto**: la vista 8.7 del dashboard de Informes (tanda 5, Mejora 8) — la tira de indicadores verde/rojo por mes — queda redundante ahora que la comparación de flujo disponible contra el objetivo de ahorro se muestra directamente en la Home (Mejora 4 de esta tanda: gráfico de Flujo Mensual Disponible con la línea discontinua del objetivo).
**Requisito**: eliminar la vista 8.7 de la pantalla de Informes. El dashboard de Informes pasa a tener las seis vistas restantes (8.1 a 8.6), sin la séptima.
**Criterios de aceptación**: la pantalla de Informes ya no muestra la tira de cumplimiento mensual del objetivo de ahorro; esa comparación vive únicamente en la Home (Mejora 4 de esta tanda).

## Dudas

*(pendiente de completar)*

## Pruebas

*(pendiente de completar)*

## Hechas / incorporadas

*(se mueven aquí las que ya se han pasado a Claude Code o incorporado al análisis funcional)*
