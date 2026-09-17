---
title: Auditoría de diseño — primer filtro (tanda 11)
description: Recorrido de diseño con navegador contra dev (datos reales copiados de producción), a 1440, 961 y 375 px. Solo diagnóstico, sin cambios aplicados. Pendiente del repaso al detalle de Pablo.
---

# Auditoría de diseño — primer filtro

Hecha con el navegador contra `localhost:3000` apuntando al proyecto **dev**, con una copia de
los datos reales de producción (7 cuentas con sus saldos exactos, 46 categorías, 115 movimientos
del 1 al 16 de agosto, las 7 posiciones de inversión con sus 52 operaciones, 2 deudas, 18
previstos). Revisado a **961 px** (portátil), **1440 px** y **375 px** (móvil).

Es un primer filtro: diagnóstico, no arreglos. Lo ordeno por si merece la pena tocarlo, no por
pantalla.

Cada punto marcado **medido** lleva su número, obtenido del DOM, no de mirar la captura.

---

## 1. Rompe la app: scroll horizontal en todas las pantallas

**Medido**: a 961 px de ventana, el contenido ocupa **1055 px** en `/home`, `/cuentas`,
`/movimientos` e `/inversiones` — en todas. Aparece una barra de scroll horizontal y la
navegación se corta a media palabra ("Confi…").

El culpable es la barra de navegación: `NAV.ml-9 hidden shrink-0 items-center gap-5`. Con
`shrink-0`, los nueve enlaces más el logo más "Salir" necesitan ~1055 px y no ceden. El menú
hamburguesa entra a 768 px (`md:`), así que **entre 768 y 1055 px la app entera desborda**.

Es la franja de un portátil de 1024, de una ventana a media pantalla en un monitor de 1920, o del
navegador con las herramientas de desarrollo abiertas. A 375 px no pasa (el hamburguesa lo
resuelve) y a 1440 px tampoco.

Lo pongo el primero porque no es una pantalla, son todas, y porque el síntoma —scroll lateral y
texto cortado— es de los que hacen que una app parezca rota.

## 2. El campo más importante de Inversión es ilegible

En el listado de posiciones, la columna **Valor** lleva un `input` editable con el valor actual.
Tiene la clase `w-28` (112 px), pero **medido: se renderiza a 26 px**. El valor está ahí
(`1007.7`), simplemente no se ve: la tabla comprime la celda y el input cede.

Queda una caja blanca vacía junto a un botón "Guardar". El usuario no puede leer ni editar
cómodamente la cifra principal de cada posición.

`app/inversiones/InversionesClient.tsx`, celda de valor.

## 3. Dos tablas se salen de su tarjeta

**Medido**:

| Tabla | Ancho | Contenedor | Se sale |
|---|---:|---:|---|
| Posiciones de inversión | 887 px | 866 px | 21 px |
| Movimientos categorizados | 939 px | 814 px | 125 px |

El efecto visible es que la última columna queda cortada: en Inversión se lee "**Elimina**" en vez
de "Eliminar". No es solo estético — el usuario no ve que hay una acción ahí.

## 4. Los porcentajes usan punto decimal en una app en español

Aparece en todas partes: `+1.8%`, `-0.4%`, `-100.0%`, `+4.4%`, `+0.23%`, `+0.05%`. Al lado, los
importes sí están bien (`1.007,70 €`). La mezcla de "1.007,70 €" y "+1.8%" en la misma tarjeta
canta bastante.

Viene de usar `.toFixed(n)`, que siempre emite punto. Hace falta un `formatPorcentaje` hermano de
`formatMoneda`, con `Intl.NumberFormat("es-ES", { style: "percent" })` o equivalente, y en español
además va **espacio antes del signo**: `+1,8 %`.

## 5. El error de login se enseña crudo y en inglés

Al fallar el acceso, la pantalla muestra literalmente **"Invalid login credentials"** — el mensaje
de Supabase, sin traducir, en una app que está entera en español.
[app/login/page.tsx:36](app/login/page.tsx:36) pinta `error` tal cual llega por la query string.

Dos cosas de golpe: traducirlo, y de paso no propagar mensajes de la librería a la interfaz (hoy
cualquier error de Auth acabaría en pantalla con su texto original).

## 6. El precio medio pierde toda la precisión en valores pequeños

Ezentis cotiza a 0,0748 € y la tabla muestra **"0,07 €"**. Con dos decimales, cualquier acción de
céntimos se convierte en un número inútil: dos posiciones a 0,0748 y 0,0712 se ven iguales.

Los precios unitarios no son importes: necesitan decimales adaptativos (más decimales cuanto menor
es el valor). Afecta a la columna "Precio medio" del listado y a la tarjeta del detalle.

## 7. "−100,0 %" en las posiciones cerradas es correcto pero engañoso

Europe Defence muestra **−10,41 € / −100.0%**. La cifra sale de `ganancia / aportado neto`, y como
el aportado neto de una posición cerrada es el residuo (lo metido menos lo recuperado), el
porcentaje siempre sale −100 %.

Es matemáticamente correcto y a la vez comunica algo falso: parece que perdió todo lo invertido,
cuando metió unos 140 € y recuperó unos 130 €. En una posición cerrada el porcentaje sobre el
aportado neto no significa nada — o se calcula sobre el total comprado, o no se enseña.

## 8. Los nombres de las posiciones destrozan la tabla

**Medido**: la fila más alta del listado mide **208 px**, porque "WisdomTree Issuer ICAV -
WisdomTree Europe Defence UCITS ETF - EUR Acc" ocupa cinco líneas.

Son los nombres legales que dejó la reconstrucción del histórico (documentado en la tanda 10). Hay
dos arreglos y no son excluyentes: renombrarlos a mano a algo legible, y que la columna trunque
con el nombre completo en el `title`.

## 9. Jerarquía de acciones en Movimientos

Tres acciones repartidas en dos grupos a dos alturas distintas: "Nuevo traspaso" e "Importar CSV"
arriba a la derecha en secundario, y "+ Nuevo movimiento" debajo a la izquierda en negro. No se lee
cuál es la acción principal, y el botón negro rompe la línea del título.

Lo mismo pasa en Inversión: **"+ Añadir inversión"** queda huérfano entre el gráfico y la tabla,
un bloque negro en mitad de la página sin pertenecer a ninguno de los dos.

## 10. "Eliminar" tiene peso visual permanente en 98 filas

En Movimientos, cada fila lleva su "Eliminar" siempre visible. Con 98 filas, la acción más
destructiva de la pantalla es también la palabra que más se repite. Lo normal es esconderla tras
hover o un menú de fila.

## 11. Móvil: la tabla de posiciones no está adaptada

**Medido**: a 375 px, la tabla de inversión mide **887 px dentro de un contenedor de 333 px**. Se
puede arrastrar en horizontal (el contenedor tiene `overflow-x-auto`, así que no rompe la página),
pero en un móvil supone recorrer ocho columnas de lado a lado para leer una posición.

El resto del móvil está bastante bien: las tarjetas se apilan en 2×2, el gráfico se lee, el
hamburguesa funciona y la página no desborda.

---

## Comprobado y descartado

Dos cosas que parecían fallos y no lo son. Las dejo escritas para que nadie las vuelva a "arreglar":

- **"2165,06 €" sin punto de millar**, al lado de "15.441,34 €". Es **correcto**: el español no
  agrupa los millares hasta las cinco cifras, y `Intl.NumberFormat("es-ES")` lo aplica bien. Se
  puede forzar con `useGrouping: "always"` si se prefiere la coherencia visual en una fila de
  tarjetas, pero hoy no está mal.
- **El gráfico "Valor frente a lo aportado" aparece vacío.** Es la animación de entrada de
  Recharts: al capturar la pantalla nada más cargar, todavía no ha dibujado. Dos segundos después
  está completo y correcto, con las dos series.

## Fuera del diseño, pero lo vi de paso

**Hipoteca Pablo tiene un capital inicial de 2.370.000 €** con 143.831,58 € pendientes y una cuota
de 591,83 €. Parece un error de tecleo (¿237.000?, ¿el precio de la vivienda en vez del préstamo?).
No afecta al pendiente ni a la cuota, pero el Planificador reconstruye la curva histórica de deuda
**desde el capital inicial**, así que sí deforma esa gráfica. Está igual en producción.

---

# Decisiones (17/09/2026)

Repasados los 20 puntos uno a uno con Pablo. Lo acordado:

| # | Cambio | Decisión |
|---|---|---|
| 1 | "Liquidez" en Inicio | El 15.441,34 € pasa a ser el **titular "Patrimonio"** (sin deuda por defecto, con el toggle). Debajo, fila desglosada: Liquidez 13.276,28 € · Inversión · Deuda. La fila suma el titular |
| 2 | Capital inicial de la hipoteca | Corregir el dato **y** avisar en el formulario cuando la cuota no cubra el interés mensual |
| 3 | Navegación | **5 secciones**: Resumen · Movimientos (con **Categorías** dentro) · Patrimonio (Cuentas · Inversión · Deuda) · Futuro (Previsión · Planificador) · Informes. Configuración y Salir al menú de usuario |
| 4 | Input de valor a 26 px | Arreglar |
| 5 | Tablas que desbordan su tarjeta | Arreglar |
| 6 | Posiciones en móvil | **Tarjetas apiladas** por debajo del breakpoint |
| 7 | Porcentajes y millares | `formatPorcentaje` en español (`+1,8 %`) **y** agrupación de millares forzada en columnas de importes |
| 8 | Importar CSV | Al sistema visual, **entera**, incluida la zona de subida |
| 9 | Error de login | Traducir los errores de Auth **y** dejar de propagar el texto de la librería |
| 10 | Precios unitarios | **Decimales adaptativos**, separados del formato de importes |
| 12 | Titular de Inicio | Patrimonio **sin deuda** por defecto |
| 13 | Tablas | Importes dominantes, `tabular-nums`, **color reservado** para lo que importa (deja de marcar el signo) |
| 14 | Totales | Pie de totales en **las cuatro** tablas (Cuentas, Deuda, Inversión, Movimientos con el neto filtrado) |
| 15 | Muro de texto del Planificador | **Plegado** tras un "Cómo se calcula", conservando el texto entero |
| 16 | "−100 %" en cerradas | Calcular el porcentaje **sobre el total comprado** |
| 17 | Nombres de posiciones | Acortarlos **y** truncar la columna con el nombre completo al pasar el ratón |
| 18 | "Eliminar" | Visible **al pasar el ratón**; siempre visible en móvil |
| 19 | Cuentas excluidas de informes | **Distintivo en la fila** y poder cambiarlo desde Cuentas |
| 20 | Categorías / Deuda | Categorías: **buscador y nº de movimientos**. Deuda: **total, "Editar" y plazo restante** |

Ritmo acordado: **todo seguido**, con un repaso al final.

Pendiente de dato: el capital inicial real de la hipoteca.

---

# Ejecución (17/09/2026)

Los 20 puntos aplicados de una tirada. Verificado en el navegador contra dev con los datos
reales copiados, a 961 px y a 375 px.

## Base: tres formatos donde había uno

`lib/formato.ts` pasa de exponer solo `formatMoneda` a distinguir tres cosas que son
distintas, con tests para cada una:

- `formatMoneda` — importes sueltos, como hasta ahora.
- `formatMonedaTabla` — igual pero agrupando millares siempre, para que en una columna no
  convivan "4372,08 €" y "143.831,58 €".
- `formatPorcentaje` — coma decimal y espacio antes del signo (`+1,8 %`), con el `+`
  opcional. Sustituye a los once `.toFixed()` repartidos por la app.
- `formatPrecio` — decimales adaptativos para precios unitarios: Ezentis pasa de "0,07 €" a
  "0,0749 €".

## Medido antes y después

| | Antes | Después |
|---|---:|---:|
| Contenido de la página a 961 px | 1055 px (desbordaba) | 946 px |
| Input de valor en Inversión | 26 px | legible, con `min-w` |
| Tabla de posiciones / su tarjeta | 887 / 866 px | 864 / 864 px |
| Fila más alta del listado | 208 px | 95 px |
| Tabla de posiciones en móvil | 887 px en 333 | tarjetas, sin tabla |
| Rutas que desbordan | todas | ninguna |

## Lo que cambió en cada sitio

- **Navegación** — cinco secciones con segunda fila de sub-pantallas. Las rutas no cambian,
  así que ningún enlace guardado se rompe. `components/Nav.tsx`, reescrito.
- **Resumen** — abre sin deuda; el titular es "Patrimonio" (15.441,34 €) y la fila de abajo
  lo desglosa en Liquidez (13.276,28 €) · Inversión · Deuda, de modo que la fila suma el
  titular. La tarjeta de "Liquidez" ya no enseña líquido + inversión.
- **Variación de la tarjeta** — tres estados en vez de dos: una variación de 0,00 € ya no se
  pinta en verde con una flecha hacia arriba.
- **Inversión** — input legible, nombres truncados con el completo al pasar el ratón,
  precios con decimales adaptativos, pie de totales, `tabular-nums`, acciones al señalar la
  fila, tarjetas en móvil y el botón de añadir en la línea del título.
- **Posiciones cerradas** — el porcentaje pasa a medirse sobre el aportado bruto: Europe
  Defence dice −6,5 % en vez de −100 %.
- **Movimientos** — pie con el neto de lo filtrado (sin contar traspasos), importes en tinta
  con signo explícito y más peso, fecha y cuenta atenuadas, "Eliminar" al pasar el ratón
  (siempre visible en móvil), y las tres acciones en una sola línea.
- **Importar** — al sistema visual, entera: tarjetas, campos, botones, avisos y la zona de
  subida de archivo. Cero clases `slate-` restantes.
- **Cuentas** — pie de totales (distinguiendo el total con y sin las cuentas excluidas),
  distintivo "Fuera de informes" en la fila y acción Incluir/Excluir sin salir de la
  pantalla.
- **Deuda** — pie con la deuda total y la cuota mensual, "Editar" explícito, y columna "Le
  queda" con el plazo restante estimado.
- **Categorías** — buscador que conserva la jerarquía y número de movimientos por categoría.
  Primer hallazgo: **23 de las 46 están sin usar**.
- **Planificador** — el muro de siete líneas, plegado tras "Cómo se calcula", sin perder una
  palabra.
- **Login** — `lib/erroresAuth.ts` traduce los errores de Supabase Auth y, lo más
  importante, deja de propagar a la interfaz cualquier mensaje de la librería: lo que no
  esté traducido sale como un texto neutro y el original se queda en el servidor.
- **Deuda, formulario** — avisa cuando la cuota no cubre los intereses del primer mes.
  `cuotaCubreIntereses` en `lib/amortizacion.ts`, con tests que usan el caso real de la
  hipoteca.

## Retoque posterior: las tres tarjetas del Resumen, iguales

Pablo señaló que las tres tarjetas de la fila no medían lo mismo. No era solo percepción: la
de Liquidez era `1.3fr` frente a `1fr` de las otras dos, y además `items-start` dejaba que
cada una se ajustara a su contenido, así que la de Liquidez —con variación y minigráfico—
era también bastante más alta.

Igualadas con `grid-cols-3` y sin `items-start`: **259 × 232 px las tres**. Y como Inversión
y Deuda se quedaban con un título y un número sueltos, se les dio una segunda línea con un
dato que ya estaba cacheado y no cuesta ninguna consulta extra:

- **Inversión** → la ganancia sobre lo aportado (`coste_neto` ya vive en la tabla).
- **Deuda pendiente** → la suma de las cuotas mensuales.

Al estrecharse la tarjeta apareció un efecto secundario que no se veía antes: el minigráfico
de Liquidez (`w-28`, 112 px, con `shrink-0`) **se salía 51 px por la derecha** del borde de
su tarjeta. Estaba ahí desde siempre, pero con la tarjeta más ancha no llegaba a asomar.
Movido debajo del texto y a todo el ancho, que funciona a cualquier tamaño: ahora mide
209 px y termina 25 px antes del borde.

## Un ancho para toda la app

Pablo señaló que en un monitor normal todo se veía estrecho. No era solo estrecho: eran
**tres anchos distintos conviviendo**. La barra de navegación iba a `max-w-5xl` (1024 px) y
la mayoría de pantallas a `max-w-4xl` (896 px), con unas pocas a `5xl`. Así que el contenido
ni aprovechaba la pantalla ni cuadraba con la barra que tenía encima.

Unificado en `contenedorClass` (`components/formStyles.ts`), a **1280 px**, aplicado a la
barra y a las 17 pantallas. Los bloques de texto largo conservan su `max-w-2xl` / `max-w-3xl`
propio: eso no es el contenedor, es longitud de línea legible, y ensancharla sería
empeorarla.

Medido a 1920 px de ventana:

| | Antes | Ahora |
|---|---:|---:|
| Contenido / barra | 896 / 1024 px (desalineados) | **1280 / 1280 px, alineados** |
| Tabla de movimientos | 939 px apretados en 814 | **1198 px sin apretar** |
| Tabla del Planificador | se cortaba en "Patri…" | **cabe entera** |
| Tarjetas del Resumen | — | 387 px, las tres iguales |

Comprobado que el extremo estrecho sigue bien: a 961 px ninguna ruta desborda.

## Pendiente

**El capital inicial real de la hipoteca.** La validación ya está, pero el dato de
producción sigue en 2.370.000 € y el Planificador seguirá deformando la curva histórica de
deuda hasta que se corrija.
