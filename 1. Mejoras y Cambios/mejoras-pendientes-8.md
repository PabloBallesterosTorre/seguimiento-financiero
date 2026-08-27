---
title: Mejoras y cambios pendientes (tanda 8) — App Seguimiento Financiero
description: Nueva lista viva de cambios, mejoras, dudas y pruebas, posterior a las tandas 1-7. Redactada como especificaciones para pasar directamente a Claude Code.
---

# Mejoras y cambios pendientes (tanda 8)

Nueva lista viva. Las tandas anteriores (1 a 7, más el documento de dudas y el de datos disponibles) están archivadas en la subcarpeta `Old\` de esta misma carpeta. Resumen:

- **Tanda 1**: cuentas editables, formulario bajo demanda, cuentas remuneradas, agrupación temporal de deuda, simulador de amortización en pantalla propia, fechas libres en amortizaciones, previsión de flujo de caja por categoría (`Movimiento previsto`), detección automática de patrones (nivel 1 y nivel 2), traspasos entre cuentas.
- **Tanda 2**: categoría automática al crear una deuda, revisar con Claude Code el diseño de traspasos, confirmación obligatoria al editar/eliminar, bug de categoría "Sin Categoría" en previsiones, cálculo del saldo tras importar.
- **Tanda 3**: objetivo de ahorro único y genérico en Configuración, previsión automática de intereses de cuentas remuneradas, tabla de "sin categorizar" en Movimientos, formularios bajo demanda en toda la app, recálculo del simulador desde una fecha elegida, previsto manual vs. automático, fecha de corte en importación.
- **Tanda 4**: visión central de "El Planificador"; bug de sugerencia de categoría que no reconoce un patrón ya aprendido; tabla de diagnóstico de la previsión (implementada); gap del nivel 2 de previsión automática (gastos e ingresos); dudas sobre categorías repetidas en sugerencias y sobre ingresos recurrentes.
- **Tanda 5**: tablas ordenables y persistentes, periodicidades intermedias en previsiones, vista de detalle de categoría con sus movimientos, aclaración funcional previsto vs. real al conciliar (con diagrama), poder descartar sugerencias de previsión, orden ingresos-antes-que-gastos en previsión, y la especificación completa del dashboard de Informes en `/informes` (7 vistas, con prototipo interactivo de referencia).
- **Tanda 6**: bug detectado en el modelo de datos (`movimiento_real_id` solo recuerda la conciliación del último mes, no una por instancia mensual); duda sobre la periodicidad de intereses de cuentas remuneradas (se captura pero no se usa); `/dashboard` pasa a llamarse `/home`, con "Cuentas" sustituido por el indicador de "Liquidez" (antes "Dinero disponible ahora" en Informes) y "Objetivo de ahorro" sustituido por "Flujo Mensual Disponible" con una línea discontinua marcando el objetivo; principio transversal de que todos los informes calculan solo sobre los datos reales disponibles (nunca asumen un periodo completo que no existe); eliminación de la vista de cumplimiento mensual del objetivo de ahorro en `/informes` (queda redundante con la Home).
- **Tanda 7**: encargo de auditoría de UX/UI de toda la app (**pendiente, no incluido en esta tanda — ver nota al final**); encargo de cobertura de tests de regresión (**pendiente, no incluido en esta tanda — ver nota al final**); especificación de Inversiones (aportaciones recurrentes, evolución diaria, rentabilidad asumida) — **incorporada en esta tanda, punto 2**; prototipo visual interactivo del rediseño completo de la app — **incorporado en esta tanda, punto 1**.
- **`dudas-pendientes.md`** (en `Old\`): documento con un prompt para que Claude Code respondiera directamente las dudas abiertas hasta ese momento — revisar si ya tiene respuestas antes de repetir esas preguntas aquí.
- **`datos-disponibles-para-informes.md`** (en `Old\`): inventario real de las tablas y campos de la base de datos, escrito por Claude Code. Consultarlo antes de especificar nada que dependa de datos concretos.

Cada entrada de aquí en adelante sigue el mismo formato: contexto + requisito + criterios de aceptación (Mejoras), contexto + duda + hipótesis (Dudas), o pasos + resultado esperado (Pruebas).

## Mejoras

### 1. Rediseño visual — aplicar el nuevo sistema visual a toda la app

**Contexto**: se ha construido un prototipo interactivo completo con un nuevo sistema visual ("minimalista y confiable"), partiendo de capturas de pantalla de la app actual, pantalla a pantalla. Prototipo interactivo (se puede navegar y probar): [Rediseño Seguimiento Financiero](https://claude.ai/code/artifact/99773411-9794-48bd-9d01-2cabbc78a497). Mockup HTML autónomo de la pantalla de Informes, sin dependencias del editor del prototipo, para referencia de maquetación directa: archivo `informes.html` (entregado a Pablo).

**Tokens visuales del sistema** (extraerlos del prototipo, no inventar variaciones):
- Tipografía: "Sora" (títulos y cifras destacadas, pesos 500/600/700) + "Manrope" (todo lo demás, pesos 400-700), vía Google Fonts.
- Color de fondo de página: `#f9f9f7`. Tarjetas: fondo `#ffffff`, borde `1px solid rgba(11,11,11,0.08)`, radio 12px, sombra `0 1px 2px rgba(11,11,11,0.04)`.
- Acento/color primario: azul `#2a78d6`. Texto principal `#0b0b0b`, texto secundario `#52514e`, texto tenue `#898781`.
- Estados: verde `#0ca30c` (positivo/real), rojo `#d03b3b` (negativo), y en la comparativa previsto-vs-real de Informes específicamente ámbar `#eda100` (previsto) / verde-azulado `#1baf7a` (real) — no confundir los dos usos del verde, cada gráfico dentro de Informes usa la paleta que se ve en el mockup.
- Botón primario: fondo `#0b0b0b`, texto blanco, radio 8px. Botón secundario: fondo blanco, borde `1px solid rgba(11,11,11,0.14)`, texto `#52514e`.
- Navegación superior: fila de enlaces de texto, el activo en negro con subrayado azul de 2px.

**Requisito**: aplicar este sistema visual a todas las pantallas ya existentes de la app (Patrimonio/Home, Cuentas, Movimientos, Categorías, Inversión, Deuda, Previsión con sus 4 sub-vistas, Planificador, Configuración), y construir la pantalla de Informes, que todavía no existe en la app, siguiendo tanto la especificación funcional ya cerrada (tanda 5, punto 8) como el mockup visual de esta tanda.

**Detalle**:
- Esto es un cambio de estilo y maquetación, no de funcionalidad: los formularios, tablas, flujos y lógica de cada pantalla ya existente deben seguir comportándose exactamente igual que hoy — solo cambia el aspecto visual para que coincida con el prototipo.
- El prototipo tiene simplificaciones deliberadas, hechas solo porque era un mockup con datos de ejemplo, que **no se deben copiar como si fueran especificación funcional**:
  - Los toggles Real/Mixto/Proyección y Mensual/Anual/3-6-12 meses del Planificador deben seguir siendo funcionales como ya lo son hoy — en el prototipo eran solo visuales.
  - El botón "+ Nueva previsión" (Previsión → Movimientos previstos) debe seguir abriendo su formulario real — en el prototipo no tenía acción porque esos campos no eran visibles en las capturas de partida.
  - La pantalla de Inversión debe incorporar ya lo especificado en el punto 2 de esta misma tanda (recurrente/puntual, evolución diaria, rentabilidad asumida), no quedarse solo con la actualización manual simple que mostraba el mockup.
  - En Informes, el filtro de rango (6/12/todo el histórico) debe recalcular de verdad los datos de las siete vistas — en el prototipo era solo visual sobre datos de ejemplo. Los toggles "ver como tabla" de cada gráfico sí son funcionales en el mockup y deben serlo también en real.
- El prototipo no construyó versión móvil de las pantallas nuevas (solo la Home la tiene). Si la app actual ya es responsive en esas pantallas, mantener esa adaptación a móvil, aplicando el nuevo estilo visual también ahí aunque el mockup no lo mostrara explícitamente.

**Criterios de aceptación**:
- Todas las pantallas de la app usan la tipografía, colores, espaciados y componentes del prototipo.
- Ninguna funcionalidad existente se ha perdido ni ha cambiado de comportamiento como efecto del rediseño.
- La pantalla de Informes existe, es navegable desde el menú principal, y muestra las siete vistas con datos reales del usuario (no los de ejemplo del mockup), con el filtro de rango temporal funcionando de verdad.
- Los elementos que en el prototipo eran solo visuales (toggles no funcionales del Planificador, botón "+ Nueva previsión" sin formulario, filtro de rango de Informes) están completamente funcionales en la implementación real.

### 2. Inversiones — aportaciones recurrentes, conciliación, evolución diaria y proyección con rentabilidad asumida

**Contexto**: el modelo actual ya contempla que una aportación a inversión es un movimiento categorizado con `categoria_id` marcado `es_categoria_inversion` (resta de líquido, suma a patrimonio) y que "El Planificador" (tanda 4, punto 1) muestra la evolución de las inversiones dentro de la proyección integral mes a mes y año a año — pero sin especificar todavía cómo se distingue una aportación recurrente de una puntual, ni de dónde sale el dato de evolución diaria, ni cómo se proyecta a futuro. Esta entrada cierra esos tres huecos.

**Requisito**:

a) **Recurrente vs. puntual**: se marca con un checkbox en la propia inversión (o en su plan de aportación), no algo que el motor tenga que adivinar. Si es recurrente, se vincula a un `Movimiento previsto` de categoría inversión (ej. 500€/mes); cuando llega el movimiento real de ese mes que hace match, se concilia con él — mismo mecanismo ya especificado para cualquier previsto en la Mejora 5 de la tanda 5, sin necesidad de un mecanismo nuevo. Una aportación puntual no lleva previsto asociado: es un movimiento suelto, categorizado igual, sin conciliación mensual esperada.

b) **Evolución diaria de las inversiones**: hoy `valor_actual` en la tabla `inversiones` se actualiza a mano y sin histórico, así que no existe una fuente real de "cuánto vale cada día". Para no bloquear la especificación con esa carencia de datos, la solución adoptada combina lo barato de la actualización manual con una curva coherente entre valoraciones:
   - Cada actualización manual de `valor_actual` queda registrada como punto real en un histórico (nueva tabla de valoraciones: inversión, fecha, valor, origen=manual), en vez de sobrescribir sin dejar rastro como hoy.
   - Entre dos valoraciones manuales, la gráfica interpola usando la rentabilidad anual asumida de esa inversión (ver punto c) en vez de una línea recta simple — no es el dato real día a día, pero es coherente con la proyección futura y no exige integrar ninguna fuente de mercado.
   - Los tramos interpolados quedan etiquetados visualmente como estimación, distinguibles de los puntos reales.
   - La integración con una fuente de mercado real para traer el valor diario automático queda en el backlog de Fase 2 ya previsto en el análisis funcional, y no bloquea esta mejora, pero ya hay decisión concreta de qué fuente usar cuando se aborde:
     - **Acciones y ETF cotizados → Stooq**: fuente gratuita sin API key ni registro (CSV descargable por URL), con cobertura de bolsas europeas (Xetra, Euronext...) además de EEUU. Se descartan las alternativas con capa gratuita "oficial" (Twelve Data, Finnhub) porque ambas limitan su plan gratuito a mercado estadounidense y no cubren las bolsas europeas donde cotizan los ETF de Pablo. Se descarta también `yfinance`/Yahoo Finance por llevar tiempo bloqueándose progresivamente, y la librería no oficial de Trade Republic (aunque sea el bróker real de Pablo) por no estar mantenida y porque Trade Republic solo permite una sesión activa a la vez — usarla en segundo plano cerraría la sesión del móvil. **Pendiente de verificar en implementación**: no se ha podido confirmar de forma automatizada si Stooq cubre BME/Madrid (IBEX35) ni con qué convención de ticker — hay indicios de que sí (Banco Santander aparece indexado), pero Claude Code debe comprobarlo probando con algunos valores reales de la cartera de Pablo (ej. SAN, IBE, ITX) antes de dar el punto por cerrado. Nótese también que Stooq bloquea el acceso automatizado genérico vía `robots.txt`, coherente con que no es una fuente oficial — reforzando el diseño "mejor esfuerzo" del punto siguiente.
     - **Criptomonedas → CoinGecko**: capa gratuita robusta y estándar de facto, sin más alternativas a valorar.
     - **Fondos de inversión tradicionales (no ETF) e inversión privada → se quedan en actualización manual**: no existe fuente gratuita universal por ISIN para esto; sigue aplicando la interpolación de este mismo punto.
     - **Diseño del job de actualización**: al no ser Stooq una fuente oficial con SLA, el job diario debe tratarse como "mejor esfuerzo", no como una dependencia dura de la app — si la consulta de un instrumento falla un día concreto (cambio de formato, bloqueo temporal, ticker no encontrado), simplemente no se registra ese punto y se sigue usando la interpolación con la rentabilidad asumida; el usuario puede corregir el valor a mano en cualquier momento sin que eso rompa nada.

c) **Rentabilidad anual asumida**: campo manual por inversión (ej. "rentabilidad anual asumida: 6%"), que Claude Code puede modelar como campo por activo o como valor global si encaja mejor con cómo está montada la tabla `Inversiones` — a decidir en implementación. Se usa para (1) interpolar la evolución diaria del punto b, y (2) calcular en "El Planificador" el acumulado futuro de cada inversión: valor actual compuesto a esa tasa más las aportaciones recurrentes futuras, también compuestas desde su fecha. Es una simulación con un supuesto del usuario, no una predicción, y debe quedar etiquetada como tal (ej. "proyección estimada al 6%") en cualquier cifra o gráfico que la use, para no confundirse con un dato real.

**Criterios de aceptación**:
- La inversión (o su plan de aportación) tiene un checkbox de "recurrente"; si está marcado, se vincula a un `Movimiento previsto` de categoría inversión que se concilia mes a mes con el mecanismo ya existente de la Mejora 5, tanda 5. Una aportación puntual no exige conciliación con ningún previsto.
- Cada actualización manual de `valor_actual` de una inversión se guarda como punto histórico real (fecha + valor) sin perder el histórico anterior.
- La gráfica de evolución de inversión (individual y, si aplica, agregada dentro de "El Planificador") muestra los puntos reales y, entre ellos, una curva interpolada según la rentabilidad asumida, visualmente distinguible como estimación.
- Cada inversión (o el conjunto, según lo que decida Claude Code en implementación) tiene un campo de rentabilidad anual asumida, editable por el usuario.
- "El Planificador" usa esa rentabilidad asumida de forma compuesta, junto con las aportaciones recurrentes futuras, para proyectar el valor futuro de cada inversión, y cualquier cifra o gráfico derivado de ese supuesto queda etiquetado como estimación, no como dato real.

## Dudas

*(pendiente de completar)*

## Pruebas

*(pendiente de completar)*

## Hechas / incorporadas

- **1. Rediseño visual**: aplicado a todas las pantallas (Home, Cuentas, Movimientos, Categorías,
  Deuda, Previsión con sus 4 sub-vistas, Planificador, Configuración e Informes) con los tokens del
  prototipo (Sora+Manrope, paleta de color, tarjetas/botones). Los elementos que en el prototipo eran
  solo visuales (toggles del Planificador, "+ Nueva previsión", filtro de rango de Informes) están
  completamente funcionales. Verificado con capturas en escritorio y móvil tras cada pantalla, sin
  errores de consola. Único punto no cubierto: la pantalla de importación de CSV
  (`app/movimientos/importar/`) sigue con el estilo antiguo — no había mockup de referencia para ella
  y se dejó fuera deliberadamente; sigue pendiente si se quiere abordar en una tanda futura.
- **2. Inversiones — recurrente, valoraciones históricas y rentabilidad asumida**: `inversiones` tiene
  ahora `es_recurrente` + `movimiento_previsto_id` (se concilia con el mecanismo ya existente de
  `previsto_conciliaciones`) y `rentabilidad_anual_asumida`; nueva tabla `inversion_valoraciones`
  guarda cada actualización manual como punto real (migración `0017`, ya aplicada al proyecto de
  Supabase). `lib/inversiones.ts` interpola/extrapola la evolución diaria entre puntos reales (y desde
  el último hasta hoy) componiendo la rentabilidad asumida, etiquetada como estimación en el gráfico
  de detalle de cada inversión (`/inversiones/[id]`). El Planificador (y el KPI/gráfico de patrimonio
  de Informes) componen ahora esa rentabilidad, ponderada por valor entre todas las inversiones, sobre
  el valor de inversión proyectado — con el porcentaje aplicado explícito en el texto de la pantalla.
  Integración con Stooq/CoinGecko para valor de mercado automático queda en el backlog de Fase 2, tal
  como especifica este punto.

## Pendiente, no incluido en esta tanda

Estos dos encargos de la tanda 7 no se han traído a la tanda 8 porque esta tanda se ha limitado a lo pedido (rediseño visual + Inversiones). Siguen abiertos y sin asignar a ninguna tanda concreta:

- **Auditoría de UX/UI de toda la app** (tanda 7, punto 1): diagnóstico transversal de inconsistencias, estados no contemplados, accesibilidad y uso en móvil — todavía por hacer.
- **Cobertura de tests de regresión sobre todo lo ya construido** (tanda 7, punto 2): suite de tests automatizados para no romper funcionalidad existente al añadir tandas nuevas — todavía por hacer.

Si se quiere que Code los aborde también, hay que incorporarlos explícitamente a esta tanda (o a una tanda 9), copiando su contexto/requisito/criterios de aceptación desde `mejoras-pendientes-7.md`.
