---
title: Inversión — de un número a una cartera (tanda 10)
description: El módulo de inversión pasa a tener libro de operaciones, se alimenta solo desde el extracto de Trade Republic, y calcula ganancia y TIR reales. Incluye la reconstrucción del histórico ya importado y lo que queda pendiente.
---

# Inversión: de un número tecleado a una cartera (tanda 10)

## De qué se partía

Una inversión era una fila con un nombre y un `valor_actual` que se escribía a mano. La app
sabía cuánto valía, pero **no cuánto se había metido**, así que no podía calcular ninguna
rentabilidad real: la única que existía era `rentabilidad_anual_asumida`, un supuesto que el
usuario teclea para poder proyectar.

En paralelo, los movimientos de inversión del extracto entraban como gastos normales y ahí se
quedaban: dinero que desaparecía del flujo y reaparecía, sin relación, como un número escrito a
mano en otra pantalla.

## El hallazgo que cambia el diseño

El extracto de Trade Republic **ya trae todo lo necesario en columnas propias**: `symbol` (ISIN),
`shares` (participaciones), `price` (precio unitario), `name` y `asset_class`, además de `type`
(`BUY` / `SELL` / `BENEFITS_SAVEBACK`).

Es decir: la cartera se puede alimentar sola al importar, sin teclear nada y **sin depender de
una API de precios externa** (que sigue siendo fase 2). Y cada ejecución de un plan de ahorro
trae, de regalo, un precio real de mercado de ese día con el que revalorizar la posición entera.

## Qué se ha construido

### 1. La inversión es una posición con su libro — migración `0022`

`inversiones` gana `isin` (único por usuario, opcional), `cuenta_id` (dónde está custodiada,
informativo), y dos derivados cacheados: `participaciones` y `coste_neto`.

Tabla nueva `inversion_operaciones`, el libro mayor:

| campo | para qué |
|---|---|
| `fecha`, `tipo` | `compra` / `venta` / `aportacion` / `retirada` / `dividendo` / `ajuste` |
| `importe` | efectivo **visto desde la inversión**: + entra, − sale (signo contrario al del extracto) |
| `participaciones` | +compra / −venta; null si la inversión no se mide en participaciones |
| `precio`, `comision` | precio unitario de la operación |
| `movimiento_id` | el vínculo con el extracto, nullable y único |

Tabla aparte y no reutilizar `movimientos` porque un movimiento no tiene participaciones ni
precio, y porque hay operaciones que no tocan ninguna cuenta registrada (un dividendo reinvertido
dentro del fondo, un traspaso entre fondos, una posición custodiada fuera de la app). Pero toda
operación que sí venga de una cuenta apunta a su movimiento, así que **nunca hay doble
contabilidad**: el dinero sale del líquido y entra en la inversión, el patrimonio no se mueve.

Dos funciones de Postgres sostienen la coherencia:

- `recalcular_inversion(id)` **reconstruye** los cacheados desde las operaciones en vez de irlos
  sumando — mismo criterio que `reconstruirSaldo` para las cuentas (tanda 9), así que cualquier
  deriva anterior se repara sola en la siguiente operación.
- `revalorizar_inversion(id, fecha, precio)` convierte el precio de una operación en un punto
  real de valor de **toda** la posición a esa fecha. Nunca pisa una valoración manual.

### 2. La importación alimenta la cartera

`importar_movimientos` (la función atómica de la tanda 9) se amplía: cuando una fila trae ISIN y
participaciones, además del movimiento crea su operación, y da de alta la posición si el ISIN no
existía. Todo dentro de la misma transacción — o entra el movimiento con su operación y el saldo,
o no entra nada.

En la pantalla de importación hay cuatro columnas nuevas opcionales (ISIN/símbolo,
participaciones, precio, nombre del activo), autodetectadas. La vista previa avisa de las
posiciones que se van a crear, con el nombre y el tipo ya rellenados y editables, y se pueden
desmarcar.

Para los bancos que no traen nada de esto (Revolut, Ibercaja) queda el vínculo manual: en
Movimientos, cualquier movimiento de categoría inversión ofrece **"¿Es una aportación a
inversión?"**, con participaciones y precio opcionales.

**Ojo**: un `BENEFITS_SAVEBACK` de Trade Republic viene asociado a un fondo pero **es dinero que
entra en la cuenta**, todavía no ha comprado nada — llega sin `shares` y por eso se queda como
movimiento normal, que es lo que es. La compra posterior sí genera su operación.

### 3. Rentabilidad real, con dos cifras — `lib/inversiones.ts`

- **Ganancia** = valor de mercado − aportado neto, con su % simple. Como `coste_neto` es el flujo
  de caja neto (aportado menos retirado) y no el coste fiscal de lo que queda, esta ganancia es
  la **total**: realizada + latente.
- **TIR anualizada (XIRR)**, por Newton-Raphson con bisección de respaldo.

La TIR no es un adorno. Con planes de ahorro semanales el porcentaje simple engaña, porque mezcla
importes con antigüedades muy distintas: la mayor parte del dinero de esta cartera lleva dentro
pocos meses, así que la TIR sale unas cinco veces por encima del porcentaje simple (0,075% anual
frente a 0,015% simple con las cifras corregidas de hoy; 1,55% frente a 0,305% con las de antes
de la migración `0024`). El simple no se puede comparar con nada; la TIR sí, con el "X% anual" de
cualquier otro producto.

`rentabilidad_anual_asumida` sigue existiendo, pero ya solo para **proyectar** en el Planificador.

### 4. Cuadro de mando

- Cabecera: valor de mercado, aportado neto, ganancia (€ y %), TIR anual.
- Gráfico de **valor de mercado frente a aportado acumulado**: la distancia entre las dos líneas
  *es* la ganancia. Una línea de valor subiendo no dice nada si no se ve cuánto dinero se ha ido
  metiendo para conseguirlo.
- Reparto por tipo de activo.
- Tabla de posiciones con participaciones, precio medio de compra, aportado, valor, ganancia y
  peso.
- En el detalle de cada posición: sus estadísticas, el libro de operaciones completo (con alta y
  borrado manual) y el histórico de valoraciones, distinguiendo las manuales de las deducidas del
  precio del extracto.

### 5. El patrimonio histórico deja de valorarse solo a coste

`construirHistoricoPatrimonio` calculaba el valor histórico de inversión como la suma acumulada
de gastos de categoría inversión — **coste, no valor de mercado**, porque no había otro dato.
Ahora sí lo hay, y pasa a valorarse de forma híbrida:

- Las aportaciones **vinculadas a una posición** se representan por el valor de mercado de esa
  posición: su última valoración conocida a cada cierre de mes. Incluye la revalorización.
- Las que **no están vinculadas a nada** siguen contando a coste. Es lo único que se sabe de
  ellas, y dejarlas fuera haría caer el patrimonio histórico sin motivo.

Sumar las dos cosas no duplica nada: cada aportación cae exactamente en un lado. Consecuencia
esperada: **las gráficas de patrimonio de Inicio e Informes cambian de números**, porque ahora
reflejan la revalorización real en vez de solo el dinero metido.

## Reconstrucción del histórico (hecha el 17/09/2026)

No hizo falta reimportar nada: la descripción que guardó Trade Republic conserva el ISIN y la
cantidad (`"Savings plan execution IE0032126645 Vanguard ... , quantity: 0.625359"`), así que la
migración `0023` reconstruye las operaciones desde el propio texto. Se identifican por la forma de
la descripción, **no por la categoría**: si el texto dice que es una compra de un ISIN concreto,
lo es, esté bien categorizado el movimiento o no. De hecho solo 23 de los 52 movimientos estaban
categorizados como inversión.

Resultado en producción: **7 posiciones, 52 operaciones**, aportado neto 2.164,06 €, valor
2.164,38 €, ganancia +0,32 €, con 15,00 € pagados en comisiones. (Las cifras que dio el backfill
antes de la corrección de la migración `0024` eran 2.170,65 € de valor y +6,59 € de ganancia —
ver más abajo.)

| Posición | Participaciones | Aportado | Valor | Ganancia |
|---|---:|---:|---:|---:|
| Ezentis (ES0172708234) | 13.224,37 | 990,00 € | 1.003,73 € | +13,73 € |
| Vanguard U.S. 500 (IE0032126645) | 9,520897 | 765,07 € | 761,23 € | −3,84 € |
| Emerging Markets (IE0031786696) | 0,636702 | 197,85 € | 200,90 € | +3,05 € |
| FTSE All-World ex-US (IE0009A5ADV9) | 46,269268 | 201,00 € | 198,52 € | −2,48 € |
| Europe Defence (IE0002Y8CX98) | 0 — cerrada | 10,41 € | 0,00 € | −10,41 € |
| All-World IMI (IE00B3YLTY66) | 0 — cerrada | −1,80 € | 0,00 € | +1,80 € |
| Vanguard S&P 500 (IE00BFMXXD54) | 0 — cerrada | 1,53 € | 0,00 € | −1,53 € |

Dos matices de la reconstrucción:

- **El precio se deduce dividiendo el importe entre las participaciones**, así que incluye la
  comisión que llevara la operación (en un plan de ahorro de Trade Republic, ninguna; en una
  compra suelta, 1 €). A partir de ahora la importación usa la columna `price`, que es el precio
  limpio. Las valoraciones deducidas quedan marcadas como `automatico` y cualquier valoración
  manual las pisa.
- **Los nombres son los nombres legales largos** del extracto ("SSGA SPDR ETFs Europe I plc -
  State Street SPDR MSCI All Country World..."). Renombrarlos a algo legible es cosa de un
  momento desde Editar.

También se borró la inversión de prueba **MSCI World (Vanguard), 9.000 €**, que no correspondía a
nada real (respaldo previo en `public.respaldo_inversion_prueba_20260917` y
`public.respaldo_inversion_prueba_valoraciones_20260917`). El patrimonio baja esos 9.000 € y pasa
a reflejar solo las posiciones reales.

### Un fallo que se cazó antes de tocar producción

La primera versión de la revalorización solo escribía un punto de valor si las participaciones
acumuladas eran mayores que cero. Con eso, **una posición vendida entera se quedaba valorada a su
último precio antes de la venta**: el dinero habría estado contado dos veces, en la cuenta y en la
inversión. Tres de las siete posiciones están cerradas, así que habría salido en el primer vistazo
—pero no es así como se quiere encontrar un error—. Ahora participaciones netas a cero significa
valor cero, tanto en `revalorizar_inversion` como en el backfill.

## La comisión, separada del precio — migración `0024`

Al explicar de dónde sale el valor de mercado apareció un fallo del backfill que no había saltado
en las pruebas.

El precio se dedujo dividiendo el importe entre las participaciones, y el importe **ya lleva la
comisión dentro** desde la tanda 9. Para un plan de ahorro da igual, porque Trade Republic no
cobra comisión; pero una compra o venta suelta lleva 1 €, y ese euro se coló en el precio. En una
compra el precio salía alto, así que la posición parecía valer más de lo que vale.

No era cosmético. La compra de Ezentis del 17/09 era la última operación de esa posición, así que
su precio inflado revalorizaba las 13.224 participaciones enteras:

| | Antes | Después |
|---|---:|---:|
| Valor de Ezentis | 1.010,00 € | 1.003,73 € |
| Ganancia de la cartera | +6,59 € | **+0,32 €** |
| TIR anual | +1,55% | **+0,075%** |

Es decir: **casi toda la "ganancia" era el artefacto**. La cartera está plana.

Lo taimado es que el error se compensaba solo — la comisión encarece el coste (bien, es dinero
que sale) y a la vez inflaba el valor (mal), así que el total parecía razonable. Por eso pasó el
primer repaso.

La corrección recalcula el precio sobre el importe bruto, sacando la comisión antes de dividir, y
con el signo que toca: en una compra la comisión encarece lo pagado (se resta), en una venta
reduce lo cobrado (se suma). La comisión de 1 € está verificada fila a fila contra la columna
`fee` del extracto — 8 compras y 5 ventas con −1,00 €, con una sola excepción documentada (la
venta del 26/06 del resto residual de 0,278158 participaciones, que salió sin comisión).

## Las comisiones, visibles — migración `0025`

La columna `comision` existía pero nadie la rellenaba: la comisión se fundía en el coste y no se
podía consultar. Ahora la importación la guarda aparte, tomándola de la misma columna del extracto
que ya se mapea para sumarla al importe.

Sigue contando dentro del aportado neto, que es lo correcto — es dinero que sale y no vuelve, y si
no contara, la rentabilidad saldría mejor de lo que es. Pero ahora se ve: en la portada, bajo
"Aportado neto" ("Incluye 15,00 € de comisiones"); en el detalle de cada posición, como tarjeta
propia; y operación a operación, bajo su importe.

**La retención fiscal no entra ahí**: no es un coste de operar sino un impuesto adelantado. Sigue
contando dentro del importe, como hasta ahora.

Verificado en desarrollo con una compra de 51 € (50 € + 1 € de comisión) de 11,502185
participaciones a 4,347 €: coste 51,00 €, comisión 1,00 €, precio limpio 4,347 y la posición
valorada en 50,00 €. Que es la realidad — el euro de comisión se pierde en el momento de comprar.

## Verificación

| Prueba | Resultado |
|---|---|
| Importar 4 filas con ISIN sobre una cuenta limpia (dev) | 4 movimientos, 3 operaciones, 1 posición nueva, saldo cuadrado |
| Participaciones, coste y valoraciones derivadas de esas filas | Exactos al céntimo contra el cálculo a mano |
| Valoración manual del mismo día que una operación importada | Se conserva la manual, no la pisa la automática |
| Lote cuya segunda fila viola una restricción | 0 movimientos, 0 operaciones, 0 posiciones, saldo intacto |
| Backfill ejecutado dos veces | La segunda pasada no crea nada |
| TIR sobre el libro real de 52 operaciones | Converge, muy por encima de la rentabilidad simple |
| Importar una compra con comisión (dev) | Coste con comisión, precio limpio, valoración correcta |
| `npm run build`, `tsc --noEmit`, 225 tests | Todo en verde |

Queda pendiente el **repaso visual** de las cuatro pantallas tocadas (Inversión, detalle,
Movimientos e Importar) y de las gráficas de patrimonio con sus números nuevos.

## Pendiente

- **Sincronización automática de precios (fase 2).** Ahora que hay ISIN y participaciones, solo
  falta un proveedor que devuelva el precio de un ISIN (Stooq para acciones/ETF, CoinGecko para
  cripto) para tener valor de mercado diario sin operar. El hueco del modelo ya está hecho: sería
  llamar a `revalorizar_inversion` con el precio del día.
- **Detección automática del traspaso a inversión** en el extracto de un banco que no sea bróker
  (seguía en la lista de fase 2 y sigue).
- **Nombres y tipos de activo** de las posiciones reconstruidas, por revisar a mano.
