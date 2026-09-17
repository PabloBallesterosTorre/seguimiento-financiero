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

### Selector de ámbito en Informes

`Personal · Conjunto · Todo` arriba del todo, porque cambia las cuatro preguntas a la vez.
Al elegir un ámbito concreto se ignora la preferencia de cuentas excluidas: si pides ver el
conjunto, quieres el conjunto entero.

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

## Estado de las cinco peticiones

| | Estado |
|---|---|
| 2. En qué se va y de dónde viene | **Hecho**: bloque nuevo, neteado, con las dos mitades a la misma escala |
| 5. Personal / conjunto | **Hecho**: eje propio en datos, formularios e informes |
| 1. Cuánto entra y sale al mes | **Parcial**: el flujo mensual ya existía y ahora respeta el ámbito |
| 4. ¿Estoy ahorrando? | **Parcial**: hay variación frente al mes anterior, pero mide "líquido + inversión", no la pregunta tal como la hizo |
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
