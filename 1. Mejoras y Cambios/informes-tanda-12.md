---
title: Informes — las cuatro preguntas y el eje personal/conjunto (tanda 12)
description: Reorientación de Informes alrededor de lo que Pablo quiere saber, con separación personal/conjunto como dimensión transversal y neteo de reembolsos por categoría. Incluye lo aplicado y lo que queda.
---

# Informes: las cuatro preguntas

Pablo pidió cuatro cosas y una condición que las atraviesa todas:

1. Cuánto ingreso y cuánto gasto al mes.
2. En qué se va mi dinero y de dónde vienen mis ingresos.
3. Qué previsión de ingresos y gastos tengo por delante.
4. Si estoy ahorrando: si tengo más que el mes pasado y cuánto.
5. **Todo separado entre lo personal y lo conjunto.**

## Lo que dijeron los datos antes de dibujar nada

### Las categorías mezclan gasto y reembolso

| Categoría | Salidas | "Ingresos" |
|---|---:|---:|
| Restaurantes | 2.371,60 € | 1.016,64 € |
| Ocio | 3.913,75 € | 1.359,14 € |
| Compras | 1.310,70 € | 1.029,25 € |

No son ingresos: son los Bizums de cuando paga él la cena y le devuelven. Un gráfico de "de
dónde vienen mis ingresos" hecho sin pensar pondría **Restaurantes como la segunda fuente de
ingresos**, con 1.016 €.

### `cuentas.tipo` mezclaba dos ejes

`corriente` / `ahorro` describen la naturaleza de la cuenta; `conjunta`, de quién es el
dinero. Al no poder elegir los dos, la cuenta "Ahorro Conjunto" estaba marcada como
`conjunta` y había perdido que era de ahorro.

### La app ya sabía resolver los traspasos según la selección

`filtrarMovimientosPorCuentasSeleccionadas` ya hacía lo correcto: si las dos patas de un
traspaso están dentro de la selección, se anula; si solo una, cuenta como ingreso o gasto de
ese lado. Es exactamente el comportamiento que pedía el punto 5, así que el eje
personal/conjunto no necesitó lógica nueva: solo un selector que traduzca el ámbito a un
conjunto de cuentas.

## Lo aplicado

### El ámbito, como eje propio — migraciones `0026` y `0027`

`cuentas.ambito` y `deudas.ambito` (`personal` / `conjunto`), separados de `tipo`. Ambos con
su campo en el formulario, y `tipo` deja de ofrecer "conjunta".

Las siete cuentas quedaron clasificadas en los dos ejes a la vez: "Ahorro Conjunto" vuelve a
ser de **ahorro** y además **conjunta**, que era el caso que no se podía expresar.

### Selector de ámbito en Informes y en el Resumen

`Personal · Conjunto · Todo` arriba del todo, porque cambia las cuatro preguntas a la vez.
Al elegir un ámbito concreto se ignora la preferencia de cuentas excluidas: si pides ver el
conjunto, quieres el conjunto entero.

El mismo control está en el **Resumen**, con las mismas tres reglas: las cuentas las decide
el ámbito, la inversión hereda el ámbito de su cuenta de custodia y la deuda el suyo propio.
El componente vive en `components/SelectorAmbito.tsx` y no bajo `app/informes/` justamente
por eso: que las dos pantallas compartan el control es parte del punto, porque el ámbito
significa lo mismo en las dos.

Las tres tarjetas del Resumen se comportan en consecuencia: en Conjunto la hipoteca a
nombre propio desaparece de "Deuda pendiente" y la cartera desaparece de "Inversión", en
vez de sumarse a un patrimonio compartido al que no pertenecen. Las cifras cuadran entre
vistas — Personal 14.088,57 € + Conjunto 686,85 € = Todo 14.775,42 € de liquidez.

Dentro de un ámbito concreto el selector de cuentas no se muestra (no decidiría nada) y la
selección no se arrastra en la URL, para que al volver a "Todo" no aparezca filtrado por las
cuentas del ámbito anterior.

### Neteo por categoría — `netoPorCategoria` y `separarGastosEIngresos`

Una categoría cae en un lado o en el otro por su **saldo neto**, nunca en los dos. Ocio pasa
de "3.277,71 € de gasto y 1.253,62 € de ingresos" a **2.024,09 € de gasto real**, y debajo se
explica de dónde sale la cifra para que no parezca inventada.

Los movimientos **sin categoría no se descartan**: se agrupan bajo "Sin categorizar". Si
desaparecieran, las dos mitades no cuadrarían con el flujo mensual y no habría forma de saber
por qué faltan. En el ámbito conjunto son 1.050,13 € — probablemente las aportaciones de
Marta.

### Dos cifras que estaban mal y solo se vieron al separar

Ninguna de las dos era un fallo nuevo: estaban ahí, pero sin el eje personal/conjunto no
había forma de notarlas.

| | Antes | Después |
|---|---:|---:|
| "Dinero disponible" en Conjunto | 2.851,91 € | **686,85 €** |
| Deuda en el patrimonio de Conjunto | 148.203,66 € | **0,00 €** |

La primera sumaba la cartera de inversión entera —que es personal— a las cuentas compartidas.
La segunda pintaba la hipoteca a nombre propio como deuda compartida. La inversión hereda
ahora el ámbito de su cuenta de custodia (sin cuenta asignada, personal), y la deuda el suyo
propio.

## El mes financiero: los meses van de nómina a nómina

Preguntando cómo computaba el desfase de la nómina salió que no era un matiz.

| Mes | Neto por mes natural | Neto por mes financiero |
|---|---:|---:|
| Junio | +6.523,59 € | +3.507,02 € |
| Julio | **−2.131,73 €** | **+799,78 €** |
| Agosto | −1.498,21 € | −2.463,27 € |
| Septiembre | **−305,77 €** | **+744,35 €** |

En julio y en septiembre **cambia el signo**: la app respondía "no has ahorrado" a meses en
los que sí se había ahorrado. La causa es que la nómina con la que se vive septiembre entra
el 28 de agosto, así que por mes natural septiembre no tiene sueldo y agosto tiene dos.

### Por qué no vale un día de corte fijo

Las fechas reales de cobro son **28, 29, 30** (y el banco adelanta si cae en fin de semana).
Cualquier día fijo acierta unos meses y falla otros. La frontera se ancla en la propia
nómina: el mes financiero M empieza el día en que se cobró la última nómina antes del 1 de M.

| Mes financiero | Empieza |
|---|---|
| Junio 2026 | 28 de mayo |
| Julio 2026 | 29 de junio |
| Agosto 2026 | 30 de julio |
| Septiembre 2026 | 28 de agosto |

### La paga extra

En junio de 2026 hay **dos** nóminas: la extra el día 15 y la ordinaria el 29. Un "coge la
nómina del mes" ingenuo habría hecho que julio empezara el 15 de junio y se comiera medio
mes. Solo se aceptan como ancla las nóminas de los últimos días del mes (desde el día de
corte menos 5), así que la del 15 no mueve nada y sigue contando como ingreso de junio,
que es cuando se cobró.

### El respaldo

Cuando no hay nómina que anclar —el mes en curso hasta que entra, o un periodo sin cobrar—
se usa un día de corte configurable, por defecto el 25. Por eso **el mes en curso se cierra
en el día de respaldo y se recoloca solo** en cuanto entra su nómina. La vista previa de
Configuración enseña las fechas concretas para que no haya que fiarse de la descripción.

### Tres nóminas estaban sin categorizar

De las cinco nóminas del histórico solo dos tenían categoría. Las otras tres caían en "Sin
categorizar", así que el bloque "de dónde viene mi dinero" **no enseñaba el sueldo como
fuente de ingresos**, que es la respuesta más obvia a esa pregunta. Migración `0029`,
con criterio estrecho: solo ingresos cuya descripción sea exactamente "NOMINA" y que no
tuvieran ya una categoría puesta a mano.

### La comparativa contra el mes anterior

Es "el saldo de hoy frente al saldo al **cierre** del último mes cerrado". El saldo de cierre
no se guarda: se reconstruye restando al saldo real de hoy todos los movimientos posteriores
a esa fecha, el mismo criterio que `reconstruirSaldo`.

Lo que estaba mal era **qué mes se consideraba el último cerrado**. La lista de meses se
generaba a partir del mes natural de hoy, así que desde el día en que entra la nómina hasta
fin de mes el "mes anterior" se quedaba uno atrás: el 29 de septiembre habría comparado
contra el cierre del 27 de **agosto** en vez del de septiembre, seis semanas de diferencia.
No se veía porque justo hoy los dos meses coinciden.

`generarMeses` y `generarMesesHaciaAtras` aceptan ahora un ancla, y las tres pantallas le
pasan el mes financiero en curso. Con eso el último punto histórico es siempre el último mes
de verdad cerrado, y el primero de la previsión enlaza sin hueco ni solape.

Además la tarjeta dice la fecha: "frente al cierre del 27 de agosto" en vez de "frente al mes
anterior". Con meses que no acaban el 31 no se puede dar por supuesta.

### Dónde se aplica

En todas las pantallas con cifras mensuales: Informes, Resumen, Planificador y el histórico
de patrimonio (que cierra cada mes en su frontera, no el día 31). Si una pantalla contara
por mes natural y otra no, el mismo mes daría dos cifras distintas según dónde se mire.

La **previsión** conserva etiquetas de mes: un previsto "mensual" significa "una vez al mes"
y el mes financiero sigue siendo un mes. Lo que se movía era la frontera del pasado, que es
donde vive lo real. Por el mismo motivo no se tocó el periodo de las conciliaciones, para no
desestabilizar las que ya existen.

## Estado de las cinco peticiones

| | Estado |
|---|---|
| 2. En qué se va y de dónde viene | **Hecho**: bloque nuevo, neteado, con las dos mitades a la misma escala |
| 5. Personal / conjunto | **Hecho**: eje propio en datos, formularios e informes |
| 1. Cuánto entra y sale al mes | **Hecho**: el flujo mensual respeta el ámbito y cuenta los meses de nómina a nómina |
| 4. ¿Estoy ahorrando? | **Parcial**: la frontera del mes ya es la correcta (era lo que cambiaba el signo), pero la cifra sigue midiendo "líquido + inversión", no la pregunta tal como la hizo |
| 3. Previsión por delante | **Pendiente**: vive en la sección Futuro, sin resumen en Informes |

## Pendiente

- **Las aportaciones al común no están enlazadas.** Son dos movimientos sueltos (gasto en
  personal, ingreso en común) en vez de un traspaso. Mientras no se enlacen, en "Todo" se
  cuentan dos veces. Hay casos ambiguos —el 3 de agosto entran dos recargas de 400 € el mismo
  día en el Común, una suya y otra de Marta, indistinguibles por la descripción—, así que no
  se tocó el histórico: se enlazan desde Movimientos con el botón que ya existe.
- **"Vivienda" netea el alquiler que cobra contra los gastos de la casa** y sale como ingreso
  de 1.189,44 €. El neteo es correcto para reembolsos, pero aquí esconde dos cosas reales.
  Se arregla separando "Alquiler" (ingreso) de los gastos de vivienda, que es una decisión de
  categorización, no de código.
- Las preguntas 3 y 4, en los términos en que las hizo.
- `previstosCoincidentes` empareja un movimiento con una previsión usando su mes **natural**,
  no el financiero. Se dejó así a propósito: los previstos recurrentes aplican igual en los
  dos meses candidatos, así que cambiarlo arriesgaría el emparejamiento al importar sin
  ganancia clara. Si algún día aparece un desajuste al importar a final de mes, mirar aquí.
