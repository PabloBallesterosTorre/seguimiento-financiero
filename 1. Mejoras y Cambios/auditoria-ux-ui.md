---
title: Auditoría de UX/UI y recorrido funcional — App Seguimiento Financiero
description: Resultado del encargo de la tanda 7 (punto 1) — recorrido completo como usuario real (cuentas, importación, categorización, deuda, inversión, previsión) más auditoría de UX/UI pantalla por pantalla. Solo diagnóstico, sin cambios aplicados.
---

# Auditoría de UX/UI y recorrido funcional

Hecho con Claude Code controlando un navegador (Playwright) contra `localhost:3000`, con un usuario
de prueba (`prueba@prueba.com`). Se dieron de alta datos reales: 4 cuentas (Trade Republic Cash,
Revolut Actual/Ahorros/Depósito), se importaron los dos extractos reales de
`2. Extractos\` (261 + 94 movimientos), se crearon 8 categorías, se categorizaron manualmente
~175 movimientos (probando el aprendizaje de patrones), se dio de alta una hipoteca con su
simulador de amortización, una inversión, una previsión recurrente semanal (además de la mensual
automática de la hipoteca), y se revisaron Home, Informes, Planificador (vista mensual y anual) y
Configuración. Se probó el redimensionado a móvil (375×800) en Movimientos, Home, Deuda, Informes y
el diagnóstico de previsión. También se revisó a fondo `/prevision/diagnostico` y se resolvieron
todas las "Sugerencias de previsión" pendientes (aceptando o descartando cada una).

El documento nació como diagnóstico puro (tal como pedía el encargo original, tanda 7 punto 1), pero
tras revisarlo Pablo pidió aplicar directamente todos los arreglos con solución propuesta clara. Cada
punto marcado "RESUELTO" ya está implementado, verificado en vivo con datos reales y cubierto por
tests donde aplicaba (164 tests del proyecto pasan (tras cerrar también el punto 2 de la tanda 7, cobertura de tests)). Durante la implementación se comprobó además que
3 hallazgos de la primera pasada (bug #7, hallazgos de jerarquía de categorías y de terminología de
"Tipo") ya funcionaban correctamente — quedan documentados como falsos positivos, sin cambio de
código. Solo quedan sin resolver los puntos que el propio informe marcó como dudas de diseño para que
Pablo las confirme antes de tocar nada (ver "Notas del recorrido").

## Bugs encontrados en el recorrido funcional

### 1. Importar un extracto con varios "productos" en un único archivo mezcla las cuentas (alto impacto) — RESUELTO

**Solución aplicada**: se añadió al mapeo de columnas un filtro opcional "Filtrar por columna" +
"Valor a importar": se elige la columna que distingue las cuentas dentro del archivo (aquí,
"Producto") y el valor concreto a importar (aquí, "Ahorros"), y solo esas filas entran en la
previsualización/importación. Verificado en vivo con el extracto real de Revolut: al filtrar por
"Producto" = "Ahorros" se pasó de 96 filas totales a 5, y se importaron exactamente esas 5 a la
cuenta "Revolut — Ahorros" sin arrastrar movimientos de "Actual" ni "Depósito". Repetir la
importación una vez por cada valor del archivo para cubrir todas las cuentas. Cambio en
`app/movimientos/importar/ImportarCSV.tsx`.

**Pantalla/flujo**: Movimientos → Importar CSV.
**Pasos para reproducir**: el extracto de Revolut (`20260825-RE.csv`) trae en una sola columna
"Producto" tres cuentas distintas del banco (Ahorros, Actual, Depósito/Cuenta Remunerada) mezcladas
por fila. Al importar ese archivo completo a la cuenta destino "Revolut — Actual" (no hay forma de
filtrar por columna antes de importar), se importan también los movimientos de "Ahorros" y
"Depósito".
**Qué pasa**: la cuenta "Revolut — Actual" queda con saldo -3.386,85 € tras la importación, un
número sin sentido económico porque incluye movimientos de otras dos cuentas (incluidos traspasos
internos entre esas cuentas, como "A EUR Cuenta Remunerada" / "Desde EUR Cuenta Remunerada", que
aparecen como gasto/ingreso normal en vez de como traspaso).
**Qué debería pasar**: o bien el mapeo de columnas permite filtrar/dividir la importación por el
valor de una columna (para bancos como Revolut que exportan así), o al menos un aviso explícito de
que el archivo parece contener más de una cuenta cuando detecta valores distintos repetidos en una
columna no mapeada.

### 2. Filas descartadas en la importación sin decir cuáles ni por qué exactamente (medio-alto impacto) — RESUELTO

**Solución aplicada**: el aviso de filas descartadas ahora es un desplegable ("Ver detalle") con una
tabla de Fila / Motivo / Contenido original por cada fila omitida. El motivo distingue "fecha no
reconocida", "descripción vacía", "importe no reconocido" e "importe es cero". Verificado en vivo
con el extracto real de Trade Republic: las 2 filas que antes solo se contaban ahora se identifican
como fila 9 y 26, ambas "importe es cero" — resultó ser la fila de "Tarifa del plan Premium", donde
el coste real está en la columna "Comisión" (no mapeada) y "Importe" queda a 0.00, no un problema de
formato como se pensaba inicialmente. Cambio en `app/movimientos/importar/ImportarCSV.tsx`.

**Pantalla/flujo**: Movimientos → Importar CSV → previsualización.
**Pasos para reproducir**: en ambas importaciones (Trade Republic y Revolut) apareció el aviso
"2 filas no se han podido leer (fecha o importe con formato inesperado) y se omitirán."
**Qué pasa**: no hay forma de saber qué 2 filas fueron, ni ver su contenido, para decidir si es
grave o descartable con seguridad.
**Qué debería pasar**: listar (aunque sea colapsado) las filas concretas descartadas, con el motivo,
para poder revisarlas o corregir el mapeo.

### 3. La tabla de movimientos ya categorizados no tiene título/cabecera (bajo-medio impacto) — RESUELTO

**Solución aplicada**: se añadió una cabecera "Categorizados (N)" con el mismo tratamiento visual
que "Sin categorizar (N)", justo encima de la tabla. Verificado en vivo: con 175 sin categorizar y
25 categorizados en ese momento, se ve "Categorizados (25)" correctamente. Cambio en
`app/movimientos/page.tsx`.

**Pantalla/flujo**: Movimientos.
**Qué pasa**: la sección "Sin categorizar (N)" tiene un `<h2>` con contador; justo debajo, la tabla
de movimientos ya categorizados no tiene ningún título ni contador — visualmente parece que la
tabla de "sin categorizar" sigue, y hay que fijarse en el propio contenido (categorías ya
rellenas) para darse cuenta de que ha cambiado de sección.
**Qué debería pasar**: un encabezado tipo "Categorizados" (o similar) con el mismo tratamiento que
"Sin categorizar (N)".

### 4. El aprendizaje de patrones no reconoce descripciones casi idénticas que solo difieren en una fecha embebida (medio impacto) — RESUELTO

**Solución aplicada**: `sugerirCategoria` (`lib/categorizacion.ts`) ahora hace una segunda pasada,
solo cuando no hay coincidencia exacta, quitando números y nombres de mes (español e inglés) de la
descripción y del patrón antes de compararlos — con un mínimo de 8 caracteres en la parte estable
para evitar falsos positivos con restos cortos o genéricos. Tests nuevos en
`lib/categorizacion.test.ts` (164 tests del proyecto pasan (tras cerrar también el punto 2 de la tanda 7, cobertura de tests)).

**Verificado en vivo**: tras categorizar "Interés neto pagado a Cuenta Remunerada del Aug 23, 2026"
como "Ahorro e Inversión", el resto de días (Aug 19, 20, 21, 22, 24…) pasaron a mostrar
automáticamente "Sugerida: Ahorro e Inversión" en Movimientos. Al aceptar una sugerencia, "Sin
categorizar" bajó de 175 a 174 correctamente.

**Pantalla/flujo**: Movimientos (sugerencia de categoría).
**Pasos para reproducir**: categoricé "Interés neto pagado a Cuenta Remunerada del Aug 23, 2026"
como "Ahorro e Inversión". El movimiento del día siguiente, "...del Aug 24, 2026", no recibió
ninguna sugerencia (a diferencia de "RESTAURANTE LA ESCOLLERA", que sí se sugirió correctamente en
repeticiones exactas).
**Qué pasa**: cualquier movimiento generado por el banco con una fecha o número variable dentro de
la propia descripción (frecuente en pagos de intereses diarios) nunca se beneficia del aprendizaje
de patrones, aunque sea claramente el mismo tipo de movimiento repetido.
**Qué debería pasar**: a confirmar con Pablo — un matching por prefijo/similaridad (ignorando la
parte final variable) reduciría mucho la categorización manual en estos casos.

### 5. El campo "Tipo de interés" se ve prerrellenado por el placeholder, pero está vacío de verdad (bajo-medio impacto) — RESUELTO

**Solución aplicada**: placeholder cambiado a "p. ej. 2.5" (ya no parece un valor real) y el campo
ahora es `required` cuando la cuenta es remunerada, así que no se puede guardar sin un valor. Cambio
en `app/cuentas/CuentaForm.tsx`.

**Pantalla/flujo**: Cuentas → Añadir/Editar cuenta, al marcar "Cuenta remunerada".
**Pasos para reproducir**: marcar la casilla "Cuenta remunerada" sin tocar el campo "Tipo de
interés (% anual)": el campo muestra "2.5" en gris (placeholder). Si se guarda así, la cuenta queda
con tipo de interés `null` y la columna "Remunerada" de la tabla muestra "—%".
**Qué pasa**: el placeholder "2.5" parece un valor real ya cargado (mismo color/tamaño que un valor
normal en un vistazo rápido), y solo al guardar se descubre que no se guardó nada.
**Qué debería pasar**: o un placeholder más claramente "de ejemplo" (ej. "p. ej. 2.5"), o exigir el
valor si la cuenta es remunerada.

### 6. Navegación no utilizable en móvil (alto impacto) — RESUELTO

**Solución aplicada**: `components/Nav.tsx` pasa a ser un componente cliente con un menú hamburguesa
por debajo de `md` — los enlaces se ocultan y aparece un botón que despliega un menú vertical con
todos los enlaces (incluido "Salir"), resaltando la sección activa. Por encima de `md` se mantiene
el menú horizontal de siempre.

**Verificado en vivo** a 375×800 en `/movimientos`: el botón de menú aparece y funciona, y
`document.body.scrollWidth === document.documentElement.clientWidth` (360 = 360) — ya no hay scroll
horizontal de página. Esto también resuelve de raíz el hallazgo #2 (tablas anchas), que dependía en
parte del desbordamiento de este menú.

**Pantalla/flujo**: todas — barra de navegación superior.
**Pasos para reproducir**: redimensionar el navegador a 375×800 (móvil) en cualquier pantalla.
**Qué pasa**: el menú de navegación (Patrimonio, Cuentas, Movimientos, Categorías, Inversión, Deuda,
Previsión, Planificador, Informes, Configuración) no colapsa ni se convierte en menú hamburguesa —
se corta a partir de "Inversión" y para acceder al resto hay que hacer scroll horizontal de toda la
página (no solo del menú), lo que además dispara una barra de scroll horizontal en pantallas donde
el contenido en sí sí cabría (comprobado en Home). Ver capturas: `mobile-movimientos.png`,
`mobile-home.png`, `mobile-deudas.png`, `mobile-informes.png` y `mobile-diagnostico.png` (raíz del
proyecto — conviene moverlas o borrarlas tras revisar, son capturas de la prueba, no parte del
repo).
**Qué debería pasar**: un patrón de navegación adaptado a móvil (menú hamburguesa, tabs con scroll
propio contenido, o similar) que no arrastre el scroll horizontal a toda la página.

### 7. Las previsiones aceptadas desde "Patrones por transacción repetida" quedan permanentemente sin categoría (medio-alto impacto) — NO ERA UN BUG, VERIFICADO

**Verificado en vivo**: la lista de Movimientos previstos (`/prevision/previstos`) sí permite
categorizarlas después — el botón "Editar" de cada fila abre `MovimientoPrevistoForm`, que incluye
un desplegable de Categoría igual que el de alta manual. Probado con "Interest payment Booking"
(antes "Sin categoría"): al editar, elegir "Ahorro e Inversión" y guardar, la tabla pasó a mostrar
"Ahorro e Inversión" correctamente. El hallazgo original venía de no haber probado a fondo el
formulario de "Editar" (quedó anotado como pendiente en la primera pasada). No se ha tocado código.

**Pantalla/flujo**: Previsión → Sugerencias → "Patrones por transacción repetida" → Aceptar.
**Pasos para reproducir**: en `/prevision/sugerencias`, aceptar cualquier sugerencia de la sección
"Patrones por transacción repetida" (probado con "Interest payment Booking" y "Incoming transfer
from CARLOS GARCIA GALLARDO"). Ir después a `/prevision/previstos`.
**Qué pasa**: ambas previsiones aceptadas aparecen con Categoría "—" (sin categoría), y no hay forma
de asignarles una categoría ni al aceptar ni después desde la lista de previsiones (el formulario de
"Editar" — no lo he comprobado a fondo, pero el listado no ofrece categorizarlas al vuelo como sí
hace la tabla de "Sin categorizar" en Movimientos). En cambio, las sugerencias de "Media mensual por
categoría" sí llegan con categoría (heredada de la categoría de origen), y las previsiones manuales
exigen categoría en el propio formulario.
**Qué debería pasar**: o el diálogo de aceptar pide una categoría, o al menos la lista de previsiones
permite categorizarlas después, igual que los movimientos reales. Mientras tanto, cualquier informe o
diagnóstico agrupado por categoría (incluido `/prevision/diagnostico`) va a mostrar una fila "Sin
categoría" permanente por cada patrón de este tipo aceptado.

### 8. La "Deuda pendiente" reconstruida hacia atrás en el Planificador no se reconcilia con el valor real de hoy (medio-alto impacto) — RESUELTO

**Solución aplicada**: `construirHistoricoPatrimonio` (`lib/planificador.ts`) simulaba cada deuda
hacia adelante desde `capital_inicial`/`fecha_inicio` de forma totalmente independiente del
`capital_pendiente` real guardado hoy. Ahora, para cada deuda, se calcula el saldo teórico que la
simulación daría en la fecha de hoy y se le suma a toda la curva histórica la diferencia (offset)
frente al capital pendiente real — ancla la curva completa a "hoy" en vez de mostrar dos
trayectorias independientes que chocan justo en el punto de unión. Cambio en
`lib/planificador.ts` (tipo `DeudaParaHistorico` con `capital_pendiente`, y `construirHistoricoPatrimonio`
recibe `hoy`) y en `app/planificador/page.tsx`, `app/home/page.tsx`, `app/informes/page.tsx` (que
comparten esa función). Añadidos tests en `lib/planificador.test.ts` (`capitalPendienteTeoricoEn`
+ un test dedicado al anclaje) — los 147 tests del proyecto pasan.

**Verificado en vivo** con la hipoteca real de Pablo (`fecha_inicio = 2023-01-01`, capital pendiente
actual dejado en blanco = igual al inicial): la secuencia pasó de 155.724,58 € (2024) →
**140.110,00 € (2025) → salto a 148.680,70 € (2026, "hoy")** a 155.724,58 € → 152.325,34 € (2025) →
**148.680,70 € (2026, "hoy") → 145.444,07 € (2027)** — ahora baja de forma continua, sin salto.

**Pantalla/flujo**: Planificador → vista Anual.
**Pasos para reproducir**: crear una deuda con fecha de inicio antigua (en la prueba, hipoteca con
`fecha_inicio = 2023-01-01`) dejando "Capital pendiente actual" en blanco (queda igual al capital
inicial, 150.000 €, tal como indica el propio placeholder "Igual al inicial si es nueva"). Abrir
`/planificador?vista=anual`.
**Qué pasa**: la columna "Deuda pendiente" reconstruye el pasado asumiendo pagos ininterrumpidos
desde `fecha_inicio` con la cuota y el interés configurados — baja de forma coherente año a año
(143.509,24 € a cierre de 2024, 140.110,00 € a cierre de 2025) — pero la fila de "hoy" (2026, que sí
usa el valor real registrado en la deuda) vuelve a mostrar 148.680,70 €: un salto hacia **arriba**
de casi 8.570 € de un año a otro, sin que haya habido ningún préstamo nuevo. El patrimonio con deuda
hereda esa misma discontinuidad.
**Qué debería pasar**: a confirmar con Pablo — probablemente la reconstrucción histórica debería
anclarse al capital pendiente real de hoy (deshaciendo la amortización teórica hacia atrás desde ahí)
en vez de recalcularlo de forma independiente desde `fecha_inicio`, para que ambos tramos conecten sin
salto. Puede que en el caso de uso real (dar de alta la deuda con su pendiente actual correcto desde
el principio, no con el capital inicial completo) este salto no llegue a verse — pero conviene
confirmarlo, porque es fácil que un usuario nuevo deje ese campo en blanco igual que hice yo.

## Hallazgos de UX/UI

### Impacto alto

1. **Navegación rota en móvil** (bug #6 arriba) — bloqueante para cualquier uso desde el móvil, que
   es parte del roadmap declarado del proyecto ("pensada para extenderse a móvil más adelante").
2. **Tablas anchas sin tratamiento en móvil** (Movimientos, Deuda) — RESUELTO: se extendió a toda
   la app el patrón de scroll horizontal contenido que ya usaba el diagnóstico de previsión — cada
   tabla ancha (Movimientos, Deuda, Cuentas, Categorías, Inversión, Movimientos previstos,
   Amortizaciones extra) ahora tiene su propio `overflow-x-auto` en vez de depender del scroll de
   toda la página. Cambios en `MovimientosTabla.tsx`, `DeudasClient.tsx`, `CuentasClient.tsx`,
   `CategoriasClient.tsx`, `PrevistosClient.tsx`, `app/inversiones/page.tsx` y
   `app/deudas/[id]/page.tsx`. Sumado al arreglo de la navegación (#6 de Bugs), la página ya no
   necesita scroll horizontal en ningún punto probado.
3. **No hay categorías de partida** — RESUELTO: se añadió un botón "Usar categorías sugeridas" (solo
   visible cuando el usuario no tiene ninguna categoría todavía) que crea de golpe una plantilla de
   9 categorías habituales (Nómina, Alimentación, Vivienda, Transporte, Ocio, Salud, Compras, Ahorro
   e Inversión, Transferencias entre cuentas propias) — completamente editables/eliminables después,
   no una lista cerrada. Cambios en `app/categorias/actions.ts` (`crearCategoriasSugeridas`) y
   `CategoriasClient.tsx`.
4. **La vista de Categorías no muestra jerarquía** — NO ERA UN BUG, VERIFICADO: comprobado en vivo
   en `/categorias`, "Suscripciones" aparece correctamente indentada (`pl-10`, texto gris) justo
   debajo de "Ocio", no mezclada alfabéticamente con las categorías principales. El código
   (`CategoriasClient.tsx`) ya agrupa cada subcategoría bajo su padre con indentación. El hallazgo
   original fue un error de observación durante el recorrido (posiblemente esa categoría se creó
   sin padre en ese momento de la prueba). No se ha tocado código.
5. **Importación sin forma de dividir por columna** (RESUELTO — ver bug #1): no era una limitación
   menor — bancos reales (Revolut, entre otros) exportan varias cuentas/productos en un único
   archivo con una columna que los distingue. Ahora el mapeo de importación permite filtrar por esa
   columna.

### Impacto medio

6. **Confirmación de borrado con el diálogo nativo del navegador** — RESUELTO: `ConfirmForm.tsx`
   (usado en toda la app para eliminar/desvincular) ya no usa `window.confirm()` — ahora es un modal
   propio con el estilo de la app (overlay, texto, botones "Cancelar"/"Confirmar" en rojo, cierre
   con Escape o clic fuera). Al ser un componente central, el cambio se aplica automáticamente a
   todos los sitios que ya lo usaban, sin tocarlos. Verificado en vivo en Deuda → Eliminar.
7. **Aviso de importación poco accionable** (bug #2, RESUELTO) — ahora es un desplegable con fila,
   motivo y contenido original de cada descarte.
8. **Tabla de categorizados sin título** (bug #3, RESUELTO).
9. **Placeholder de tipo de interés confuso** (bug #5).
10. **Terminología "Tipo" de cuenta en minúscula** — NO ERA UN BUG, VERIFICADO: la celda ya usa la
    clase `capitalize` de Tailwind (`CuentasClient.tsx` y `DeudasClient.tsx`); comprobado en vivo en
    `/cuentas`, se ve "Ahorro" y "Corriente" con mayúscula inicial correctamente. No se ha tocado
    código.
11. **Inconsistencia de scroll en tablas anchas entre pantallas** (matiza el #2) — RESUELTO junto
    con el #2: todas las tablas anchas siguen ahora el mismo patrón que ya usaba el diagnóstico de
    previsión.

### Impacto bajo

12. El campo "Tipo de activo" de Inversión aceptaba texto libre tipo `fondo_indexado` — RESUELTO:
    ahora es un desplegable (Fondo indexado, Acciones, Cripto, Cuenta, Otro con texto libre) que
    guarda valores ya limpios, sin guiones bajos. Cambio en `app/inversiones/NuevaInversion.tsx`.
13. Favicon no configurado (404 en consola) — RESUELTO: añadido `app/icon.svg` (convención de
    Next.js App Router para el icono de pestaña).

## Notas del recorrido

- **Duda sobre el alcance del aprendizaje de patrones** (bug #4): no sé si el matching exacto de
  descripción es una decisión de diseño ya tomada (para evitar falsos positivos) o simplemente no
  se ha planteado el caso de descripciones con una parte variable. Antes de proponerlo como mejora
  formal convendría que Pablo confirme la intención original.
- **"¿Es un traspaso?"**: apareció como aviso en varios movimientos (p. ej. "Bizum payment to:
  Pablo B.T.", "Una recarga de Apple Pay con *4002") sin que las cuentas de Revolut tuvieran IBAN
  cargado (el CSV de Revolut no trae columna de IBAN de contraparte, así que no pudo ser por ese
  criterio). No he identificado qué heurística lo dispara — merece revisión para descartar falsos
  positivos, sobre todo en la recarga de Apple Pay, que no es necesariamente un traspaso entre
  cuentas propias.
- **Inestabilidad observada durante las pruebas automatizadas**: en varias ocasiones, una
  referencia de elemento tomada en una captura de pantalla dejaba de ser válida casi
  inmediatamente después (sin ninguna acción intermedia), como si la tabla de Movimientos se
  volviera a renderizar sola poco después de cargar la página. No he podido determinar la causa
  (¿revalidación o polling en el cliente?) ni confirmar si esto es perceptible para un usuario real
  (parpadeo, pérdida de scroll/foco) o es inocuo. Vale la pena que Pablo lo observe manualmente en
  el navegador con las herramientas de desarrollador abiertas (pestaña Network) mientras está en
  `/movimientos` con muchos movimientos cargados. Como dato adicional: al volver a `/prevision/diagnostico`
  en esta segunda pasada, la primera carga sin parámetro (`?meses=`) mostró una vez "No hay ninguna
  previsión activa en este horizonte" pese a tener 3 previsiones activas, con las cabeceras de mes ya
  pintadas correctamente; recargar la misma URL momentos después (y con `?meses=3`/`?meses=6`
  explícitos) siempre mostró los datos bien. No ha sido reproducible a voluntad, así que podría ser la
  misma causa que esta inestabilidad general — no lo cuento como bug confirmado aparte.
- **Comparativa "frente al mes anterior" en Home**: tras importar de golpe un año de histórico real
  en una sola sesión, la tarjeta de Liquidez mostró "▲ 9145,67 € (+107,2%) frente al mes anterior".
  No he verificado si el cálculo compara correctamente por fecha de movimiento (correcto) o si
  puede verse afectado por el momento en que se dieron de alta las cuentas/movimientos (incorrecto).
  Con datos reales importados de forma incremental (no todos de golpe, como aquí) es posible que
  este efecto no se dé nunca — señalarlo por si acaso, no como bug confirmado.
- **Cobertura ya completada en una segunda pasada**: `/prevision/diagnostico` (visto a fondo, con
  `?meses=3/6/12` — ver bug #8 sobre la reconstrucción histórica de deuda, que se detectó en la vista
  anual del Planificador, no aquí), la vista anual del Planificador, y el resto de "Sugerencias de
  previsión": se aceptó "Incoming transfer from CARLOS GARCIA GALLARDO" (bug #7: queda sin
  categoría) y "Media mensual — Vivienda" (bug #7 no aplica a esta, llega con categoría), y se
  descartó "Incoming transfer from CARLOS SANZ CAMPO", "Media mensual — Ocio" y "Media mensual —
  Transferencias entre cuentas propias" (el descarte pide confirmación con el mismo `confirm()`
  nativo que borrar, y no vuelve a proponerse). También se redimensionó a móvil Deuda, Informes y el
  diagnóstico de previsión (ver hallazgo #2 y #11). Informes en móvil no presentó problemas: sus
  gráficos y tarjetas se adaptan bien a 375px (aviso: al hacer una captura de página completa
  (`fullPage`) los gráficos de barras aparecieron vacíos — es un artefacto de la captura, no un bug;
  al volver a comprobar con scroll real y captura de viewport, las barras se veían correctamente).
- **Sin cubrir todavía**: no he revisado el formulario de "Editar" de una previsión en detalle (para
  confirmar si desde ahí sí se puede asignar categoría a una previsión de "Patrones por transacción
  repetida" ya aceptada — ver bug #7), ni las vistas de Deuda/Informes en anchos intermedios
  (tablet), ni la accesibilidad por teclado en ninguna pantalla.
- **Edición de movimientos importados**: hoy, un movimiento importado solo se puede recategorizar o
  eliminar, no editar (fecha/importe/descripción). No sé si es una decisión deliberada (para
  proteger la integridad de lo importado, en línea con "la importación debe cuadrar exacta") o un
  hueco funcional — confirmar con Pablo antes de convertirlo en mejora.
