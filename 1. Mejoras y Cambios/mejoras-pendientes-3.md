---
title: Mejoras y cambios pendientes (tanda 3) — App Seguimiento Financiero
description: Nueva lista viva de mejoras, dudas abiertas y pruebas, posterior a la tanda 2 (ver mejoras-pendientes-2.md). Redactada como especificaciones para pasar directamente a Claude Code.
---

# Mejoras y cambios pendientes (tanda 3)

Nueva lista viva. Tandas anteriores:
- Tanda 1 (`mejoras-pendientes.md`, entregada a Claude Code el 2026-08-24): cuentas editables, formulario bajo demanda, cuentas remuneradas, agrupación temporal de deuda, simulador de amortización en pantalla propia, fechas libres en amortizaciones, previsión de flujo de caja por categoría, detección automática de patrones, traspasos entre cuentas.
- Tanda 2 (`mejoras-pendientes-2.md`): categoría automática al crear deuda, revisar enfoque de traspasos con Claude Code, confirmación al editar/eliminar, bug de categoría no visible en previsiones, cálculo del saldo tras importar.

Esta tanda incluye tres tipos de entradas:
- **Mejoras**: cambios/funcionalidades concretas, redactadas como contexto + requisito + criterios de aceptación, listas para pasarse tal cual a Claude Code.
- **Dudas**: preguntas abiertas o cosas que Pablo no tiene claras todavía — no llevan criterios de aceptación cerrados, son para plantearle la pregunta a Claude Code (o decidir con él) antes de convertirlas en una mejora concreta.
- **Pruebas**: casos de prueba/verificación concretos que Pablo quiere que se comprueben en la app (funcionalidad ya implementada, escenarios a validar), para pasárselos a Claude Code como checklist de testing.

## Mejoras

### 1. Objetivo de ahorro — único, genérico, aplicable a todos los meses, movido a Configuración

**Contexto**: entidad `Objetivo de ahorro` (ver `analisis-funcional.md`, sección 2 y 4, y flujo 6 de la sección 5: "ahorro real = ingresos − gastos − inversión del periodo"), hoy definida "por periodo (mes/año)" y hoy configurable/visible desde la Home.
**Requisito**: el objetivo de ahorro deja de configurarse desde la Home. Pablo quiere un único objetivo de ahorro genérico (ej. "quiero ahorrar como mínimo X€"), que se aplica automáticamente **igual para todos los meses** — no un valor distinto por mes. Su configuración se traslada a la nueva pestaña "Objetivo de ahorro" dentro de "Configuración de Perfil" (ver punto 2).
**Detalle**:
- Un único importe configurable (el objetivo mínimo de ahorro mensual), sin gestión mes a mes — se simplifica frente a la idea inicial de permitir excepciones puntuales por mes: por ahora, un solo valor que rige para todos los periodos.
- La Home deja de tener el control de edición del objetivo; en su lugar, sigue mostrando el resultado (Cumplió/No cumplió, progreso del mes) tomando el valor configurado en Configuración de Perfil.
- **Nuevo campo booleano — incluir o no la inversión en el cálculo**: en esa misma pestaña de configuración, añadir un booleano para que Pablo elija si, en la comparativa mensual de flujo real vs. objetivo de ahorro, la aportación a inversión del periodo cuenta o no como parte del ahorro. Es decir, permite alternar entre `ahorro real = ingresos − gastos` y `ahorro real = ingresos − gastos − inversión` (esta segunda fórmula es la que ya recoge hoy el análisis funcional en el flujo 6; el booleano la hace opcional en vez de fija).
- Modelo de datos: simplifica lo apuntado antes — no hace falta un `periodo` por objetivo si va a ser un único valor global; puede bastar un campo en la configuración de usuario en vez de mantener la entidad `Objetivo de ahorro` como colección por periodo (a confirmar con Claude Code según cómo esté ya montado el modelo, para no romper el histórico de "Cumplió/No cumplió" ya calculado mes a mes). Añadir también el campo booleano `incluir_inversion_en_ahorro` (o nombre equivalente) a esa configuración.
**Criterios de aceptación**:
- El objetivo de ahorro se edita únicamente desde Configuración de Perfil → pestaña "Objetivo de ahorro".
- Ese valor se aplica igual a todos los meses (pasados no se recalculan; futuros usan el valor vigente en cada momento).
- Desde la misma pestaña, Pablo puede activar/desactivar si la aportación a inversión del periodo resta del ahorro real usado para comparar contra el objetivo.
- La Home muestra el objetivo y si se ha cumplido o no (aplicando el criterio de inversión configurado), pero ya no permite editar directamente ahí ni el importe ni el booleano.

### 2. Configuración de Perfil — moneda, idioma, ajustes básicos y objetivo de ahorro

**Contexto**: entidad `Usuario` (ver `analisis-funcional.md`, sección 4, que ya prevé `moneda_base`), sin pantalla propia de configuración hoy.
**Requisito**: crear una sección de "Configuración de Perfil", organizada en pestañas, con los ajustes básicos típicos de cualquier app y, como una pestaña más, el objetivo de ahorro (ver punto 1).
**Detalle — pestañas/ajustes a incluir**:
- Pestaña de datos generales: moneda base (`moneda_base`, ya existe en el modelo — aquí se le da interfaz), idioma de la app, datos básicos de perfil (nombre, email).
- Pestaña "Objetivo de ahorro": configuración del único valor de ahorro mínimo mensual y del booleano de si la inversión cuenta o no en esa comparativa (ver punto 1), movida aquí desde la Home.
- (A valorar con Claude Code qué más encaja como ajuste básico adicional: formato de fecha, tema claro/oscuro, notificaciones si ya existieran, etc. — no es una lista cerrada, es el sitio donde deben vivir este tipo de ajustes según se vayan necesitando.)
**Criterios de aceptación**:
- Existe una pantalla de "Configuración de Perfil" accesible desde la navegación principal, con al menos dos pestañas: ajustes generales (moneda, idioma, perfil) y "Objetivo de ahorro".
- Desde la pestaña de ajustes generales se puede cambiar la moneda base y el idioma, y los cambios se aplican a la app (formato de importes, textos de interfaz si hay más de un idioma soportado).
- Desde la pestaña "Objetivo de ahorro" se configura el valor único que aplica a todos los meses y el booleano de inclusión de inversión (ver punto 1).
- La pantalla queda preparada para ir añadiendo más pestañas/ajustes en el futuro sin rehacer la estructura.

### 3. Cuentas remuneradas — previsión automática de los intereses generados

**Contexto**: cuentas remuneradas (tanda 1, punto 3 — captura `es_remunerada`, `tipo_interes`, `periodicidad_pago_interes`, con el cálculo de intereses marcado ahí como "pendiente de definir en un futuro incremento") y previsión de flujo de caja (tanda 1, puntos 7-8).
**Requisito**: cuando una cuenta está marcada como remunerada con un tipo de interés y una periodicidad de pago, la app debe generar automáticamente una previsión de esos ingresos por intereses (como `Movimiento previsto` recurrente, ingreso, ligado a esa cuenta), sin que Pablo tenga que darlos de alta a mano. Esto conecta directamente con la previsión de flujo de caja: los intereses previstos deben sumarse a la proyección igual que cualquier otro ingreso previsto.
**Motivación explícita de Pablo**: sienta la base para una futura pestaña de "Informes", tanto de lo pasado como, sobre todo, de lo futuro — cuanta más previsión "inteligente" tenga la app (intereses, deuda, patrones de gasto...), más completos podrán ser esos informes cuando se construyan.
**Detalle**:
- Cálculo del interés previsto en cada periodo según la periodicidad configurada (diaria/semanal/mensual) y el tipo de interés de la cuenta, aplicado sobre el saldo relevante de la cuenta en ese momento (a definir con Claude Code si se usa el saldo actual, un saldo medio del periodo, u otro criterio — el interés real depende de cómo evolucione el saldo, así que la previsión debe ser dinámica, no un importe fijo calculado una sola vez al configurar la cuenta).
- La previsión de intereses se recalcula/actualiza a medida que cambia el saldo previsto de la cuenta en la proyección (por ejemplo, si hay más ingresos o gastos previstos en esa cuenta, el interés previsto de los siguientes periodos debe reflejarlo).
- Igual que el resto de previsiones automáticas (tanda 1, punto 8), esto debería poder mostrarse desglosado en la proyección de flujo de caja por categoría (ej. categoría "Intereses" o similar).
**Criterios de aceptación**:
- Al marcar una cuenta como remunerada con interés y periodicidad, la previsión de flujo de caja incluye automáticamente los ingresos por intereses esperados de esa cuenta en los periodos futuros.
- Si se desmarca la cuenta como remunerada o se cambian sus condiciones (interés, periodicidad), la previsión se actualiza en consecuencia.
- Los intereses previstos se distinguen como su propia categoría/línea dentro de la previsión desglosada, no se mezclan sin identificar con otros ingresos.

### 4. Movimientos — tabla de "sin categorizar" separada, con sugerencia automática por historial

**Contexto**: pantalla de Movimientos, y motor de reglas de categorización / sugerencia por patrón ya usado en la importación (ver `analisis-funcional.md`, sección 5, flujo 2 "Categorización asistida").
**Requisito**: en la pantalla de Movimientos, por encima de la tabla actual, añadir otra tabla con los movimientos **sin categorizar**. Esa tabla debe aplicar la misma inteligencia que ya se usa en la importación: proponer una categoría según el histórico (matching por patrón de descripción), igual que en el flujo de categorización asistida. La tabla de abajo (la que ya existe) debe mostrar únicamente los movimientos **ya categorizados**.
**Detalle**:
- La tabla de "sin categorizar" reutiliza el mismo motor de sugerencia (`Regla de categorización`) que ya propone categoría al importar — no se trata de una lógica nueva, sino de aplicar la misma en un sitio más donde antes no se veía.
- Cada fila sin categorizar muestra la categoría (y subcategoría si aplica) sugerida, con posibilidad de confirmar la sugerencia con un clic o corregirla eligiendo otra.
- Al confirmar/asignar categoría a un movimiento de la tabla de arriba, este debe desaparecer de ahí y pasar a la tabla de abajo (la de categorizados), sin necesidad de recargar la pantalla.
- Si un movimiento no tiene ninguna sugerencia posible (sin histórico suficiente que haga match), se muestra igualmente en la tabla de arriba pero sin sugerencia, a la espera de que el usuario lo categorice manualmente.
**Criterios de aceptación**:
- La pantalla de Movimientos muestra dos tablas: arriba "Sin categorizar" (con sugerencia automática cuando la haya), abajo solo los movimientos ya categorizados.
- Las sugerencias de la tabla de arriba usan el mismo motor/lógica que la categorización asistida de la importación.
- Categorizar un movimiento (aceptando la sugerencia o eligiendo otra categoría) lo mueve de la tabla de arriba a la de abajo.

### 5. Todos los formularios de la app — bajo demanda, nunca abiertos por defecto

**Contexto**: generaliza el punto 2 de la tanda 1, que pedía este comportamiento solo para el formulario de nueva cuenta.
**Requisito**: en todas las pestañas/pantallas de la app (cuentas, movimientos, categorías, deudas, inversiones, amortizaciones extra, movimientos previstos, etc.), ningún formulario de alta debe estar abierto/visible por defecto. En su lugar, cada pantalla muestra solo un botón (ej. "Nuevo/a [elemento]"); al pulsarlo se abre el formulario correspondiente.
**Criterios de aceptación**:
- En cualquier pantalla de la app con un formulario de alta, el estado por defecto es: formulario cerrado, solo visible el botón.
- Clic en el botón abre el formulario (modal, panel desplegable o navegación a pantalla propia, según el patrón de UI que se use en cada caso).
- Al guardar o cancelar, el formulario se cierra y se vuelve al estado por defecto (botón).
- Este comportamiento es consistente en toda la app, no solo en el módulo de cuentas.

### 6. Simulador de amortización — recalcular a partir de la fecha elegida para la amortización

**Contexto**: simulador de amortización anticipada en pantalla propia (tanda 1, punto 5) y fecha libre por amortización extra (tanda 1, punto 6).
**Requisito**: en el simulador, al añadir una amortización extra, Pablo elige la fecha en la que la haría; el cálculo de la simulación (nuevo capital pendiente, cuota o plazo resultante, evolución posterior) debe recalcularse **a partir de esa fecha concreta** que ha seleccionado, no desde la fecha actual ni desde una fecha por defecto.
**Detalle**:
- Refuerza y concreta el punto 6 de la tanda 1: la fecha no es solo un dato que se guarda, sino el punto de partida real del recálculo de la tabla de amortización dentro del simulador.
- Si Pablo simula varias amortizaciones con fechas distintas dentro del mismo escenario, cada una debe aplicarse en su fecha correspondiente y el cálculo debe encadenarse correctamente (capital pendiente antes de cada amortización = el resultante hasta esa fecha, con las amortizaciones anteriores ya aplicadas).
**Criterios de aceptación**:
- Al fijar la fecha de una amortización extra en el simulador, la tabla/gráfico de resultado se recalcula desde esa fecha en adelante.
- Con varias amortizaciones en fechas distintas dentro de la misma simulación, el resultado final las aplica todas correctamente en orden cronológico.

### 7. Aclaración funcional — cuándo usar `Movimiento previsto` manual vs. detección automática

**Contexto**: previsión de flujo de caja y previsión automática de patrones (tanda 1, puntos 7-8). Surge de una duda de Pablo sobre si debe dar de alta a mano previstos para gastos recurrentes como la hipoteca, la nómina o los seguros, y qué hacer con gastos anuales como el IBI.
**Aclaración funcional (para guiar la implementación, no solo documentación)**:
- El `Movimiento previsto` manual está pensado para: (a) la fase inicial, mientras no hay histórico suficiente importado para que la detección automática (punto 8) identifique el patrón sola; (b) ítems puntuales que Pablo ya sabe que van a ocurrir pero que no son un patrón repetido (una paga extra concreta, un gasto grande conocido de antemano); (c) casos nuevos sin histórico por definición (una suscripción recién contratada, un cambio de nómina).
- Para gastos/ingresos recurrentes ya establecidos con histórico suficiente (hipoteca, nómina, seguros con varios meses de pagos), el objetivo es que **no haga falta darlos de alta a mano**: el motor de detección automática debe identificarlos y proponerlos, y Pablo solo confirma. Si Pablo los ha creado ya a mano y luego el histórico permite detectarlos automáticamente, el sistema no debe duplicar la previsión (ver requisito de deduplicación abajo).
- Para el caso concreto del IBI (anual, a final de año): si se importa histórico de años anteriores (Pablo tiene datos desde 2023 en su Excel) que cubra el umbral de detección anual (1-2 años, ya definido en el punto 8), el sistema debería detectarlo solo como patrón anual. Si no hay ese histórico importado todavía, conviene darlo de alta manualmente como previsto anual el primer año, hasta que el propio histórico generado por la app permita que la detección automática lo asuma.
**Nuevo requisito derivado — evitar duplicados entre previsto manual y detección automática**: antes de proponer un patrón detectado automáticamente (punto 8), el sistema debe comprobar si ya existe un `Movimiento previsto` manual equivalente (misma categoría/cuenta/periodicidad aproximada) y, si es así, no crear un duplicado — puede ofrecer "fusionar"/convertir el previsto manual en uno gestionado por el motor automático, o simplemente no proponerlo de nuevo.
**Criterios de aceptación**:
- La documentación/ayuda de la app dentro de la pantalla de previsiones explica brevemente esta diferencia (manual vs. automático), para que quede claro también para el propio Pablo al usarla.
- El sistema no genera una previsión automática duplicada de una ya existente creada manualmente para el mismo gasto/ingreso recurrente.

### 8. Importación — fecha de corte para no reimportar movimientos antiguos o eliminados a propósito

**Contexto**: flujo de importación de movimientos (ver `analisis-funcional.md`, sección 5, flujo 1, y tanda 2 punto 5 sobre el cálculo del saldo tras importar).
**Requisito**: al importar un archivo de banco, permitir configurar una fecha a partir de la cual sí se importan movimientos, ignorando cualquier transacción anterior a esa fecha. Esto evita dos problemas: (a) duplicados si se reimporta un archivo que se solapa con movimientos ya existentes, y (b) que vuelvan a crearse movimientos que Pablo eliminó a propósito (si el archivo importado los sigue incluyendo).
**Detalle**:
- La fecha de corte puede ser un valor por defecto sensato (ej. la fecha del último movimiento ya existente en esa cuenta) que el usuario puede ajustar manualmente en cada importación, o un campo que se rellena a mano cada vez — a decidir con Claude Code cuál es más práctico dado el flujo de importación ya construido.
- Esto es un mecanismo adicional a (no sustituye) cualquier detección de duplicados por coincidencia exacta de movimiento que ya exista o se vaya a construir — cubre específicamente el caso de movimientos que técnicamente no son duplicados exactos en el sistema (p. ej. porque el usuario los borró) pero que no se deben volver a crear.
**Criterios de aceptación**:
- Al importar, el usuario puede fijar una fecha de corte antes de la cual ninguna transacción del archivo se importa, aunque el archivo las incluya.
- Los movimientos anteriores a esa fecha se ignoran silenciosamente en esa importación (o se listan como "omitidos por fecha de corte" para que Pablo pueda revisarlo, a valorar con Claude Code).
- El saldo resultante de la importación (tanda 2, punto 5) se calcula solo con las transacciones efectivamente importadas (las posteriores a la fecha de corte).

## Dudas

### 1. Futura pestaña de "Informes" (pasado y, sobre todo, futuro)

Pablo quiere, más adelante, una pestaña de informes que muestre tanto la evolución pasada como (especialmente) proyecciones futuras, apoyándose en toda la inteligencia de previsión que se vaya construyendo (previsión de flujo de caja, patrones automáticos, intereses de cuentas remuneradas, calendario de deuda, etc.). Todavía no está definida como mejora concreta — queda anotado aquí para no perder el hilo y para tenerlo en cuenta al diseñar el resto de módulos de previsión, de forma que puedan alimentar esos informes sin tener que rehacerlos después.

## Pruebas

### 1. Flujo completo: alta de deuda → categoría automática → previsión → conciliación al importar

**Contexto**: integra varias funcionalidades ya especificadas — categoría automática al crear deuda (tanda 2, punto 1), previsión de flujo de caja por categoría (tanda 1, puntos 7-8) y conciliación previsto-real en la importación (tanda 1, punto 7).
**Caso de prueba** (ejemplo real de Pablo: ya tiene creada la deuda "Hipoteca"):
1. Crear (o partir de) un tipo de deuda, ej. "Hipoteca".
2. Verificar que se ha creado automáticamente la categoría de transacción asociada (ej. "Pago Hipoteca").
3. Verificar que ese gasto (la cuota de la hipoteca) queda previsto automáticamente en los meses futuros — debe aparecer en la previsión de flujo de caja de los próximos meses con su importe y categoría, sin que Pablo tenga que darlo de alta a mano como `Movimiento previsto`.
4. Importar un extracto bancario que incluya el movimiento real de esa cuota.
5. Verificar que ese movimiento importado se asocia/concilia automáticamente con la previsión correspondiente de ese mes (categoría "Pago Hipoteca"), en vez de quedar como un movimiento suelto sin relacionar con la previsión.
**Resultado esperado**:
- La categoría se crea sola al dar de alta la deuda.
- La cuota aparece prevista en los meses futuros sin intervención manual.
- Al importar el movimiento real correspondiente, se concilia automáticamente con esa previsión (se marca como materializada, no se duplica en la proyección).

## Hechas / incorporadas

*(se mueven aquí las que ya se han pasado a Claude Code o incorporado al análisis funcional)*
