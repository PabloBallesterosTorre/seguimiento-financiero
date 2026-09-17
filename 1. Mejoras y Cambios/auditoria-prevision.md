---
title: Auditoría de la previsión (tanda 12)
description: Revisión de los 23 movimientos previstos activos contra el gasto real de julio, agosto y septiembre de 2026. Qué cuadra, qué no, y qué bloquea estimar el cierre del mes por ámbito.
---

# Auditoría de la previsión

Pablo pidió estimar el cierre del mes con los previstos pendientes, pero avisó: *"habría que
revisar la lógica que se utiliza de previsión"*. Tenía razón. Esto es lo que salió al
contrastar los 23 previstos activos contra lo que de verdad pagó.

## 1. Hay un previsto fantasma de 650 € al mes

| Previsto | Importe | Activo desde | Movimientos reales |
|---|---:|---|---:|
| Cuota Hipoteca vivienda habitual | 650,00 € | 2023-01-01 | **0** |
| Cuota Hipoteca Pablo | 591,83 € | 2024-11-24 | 2 |

La categoría "Pago Hipoteca vivienda habitual" **no tiene un solo movimiento en todo el
histórico**. La hipoteca real es la otra, y cuadra al céntimo: 591,83 € en agosto y 591,83 €
en septiembre.

Son **7.800 € al año de gasto inventado** metidos en cada proyección desde 2023. Es la causa
más probable de que la previsión parezca pesimista.

## 2. La mitad de los previstos no tiene cuenta

10 de los 23 están como `(sin cuenta)`. Sin cuenta no tienen ámbito, así que **no se pueden
repartir entre personal y conjunto**. Esto es lo que bloquea la estimación separada.

Entre ellos hay algunos obvios (Hipoteca Pablo, Yamaha, Gimnasio, Spotify → personales) y
dos que no lo son en absoluto: "Compra semanal supermercado" (60 €/sem) y "Media mensual —
Vivienda" (1.081,50 €). Esos dos hay que asignarlos a mano: adivinarlos sería inventar.

## 3. Los dos mayores gastos reales están mal previstos

| Categoría | Previsto | Real julio | Real agosto |
|---|---:|---:|---:|
| Ocio | 400,00 €/mes | 1.388,70 € | 2.505,14 € |
| Restaurantes | **ninguno** | 377,44 € | 1.717,55 € |

Entre los dos son la explicación de que agosto cerrara en −1.370,48 € cuando a día 20 iba en
+40,44 €. La previsión no los vio venir porque no los tiene.

Tampoco hay previsto para Vuelos, Compras, Hostinger, Boda, Discoteca, Transporte, Tabaco,
Cumpleaños ni IVA.

## 4. Los dos errores se compensan, que es lo peor que podía pasar

El fantasma mete 650 € de gasto de más; Ocio y Restaurantes faltan del orden de 1.500 € en un
mes como agosto. En el total mensual casi se anulan, así que la cifra global parece razonable
mientras **cada línea está mal**. Una previsión que falla por arriba y por abajo a la vez es
más peligrosa que una que falla en una sola dirección, porque no se nota.

## 5. Lo que sí está bien

No todo está roto — esta parte cuadra al céntimo con lo real y no hay que tocarla:

| | Previsto | Real |
|---|---:|---:|
| Gimnasio | 47,00 € | 47,00 € |
| Cuota Yamaha XMAX | 76,25 € | 76,25 € |
| Seguro Médico | 50,40 € | 50,40 € |
| Seguros Ibercaja | 81,25 € | 81,25 € |
| Hipoteca Pablo | 591,83 € | 591,83 € |
| Hipoteca Marta | 363,00 € | 363,00 € |

La lógica de importes también es correcta: la nómina está guardada como rango 2.100–2.300 €
y `importeEstimado` usa el punto medio (2.200 €), no el `importe_estimado` de 0,00 € que
tiene guardado. Ese era el fallo que más temía y no existe.

## 6. "Media mensual — Vivienda" hereda un problema conocido

Vale 1.081,50 € y su `origen_calculo` es `media_categoria`, o sea que se recalcula sola de la
media de la categoría Vivienda. Pero esa categoría mezcla el alquiler que Pablo **cobra** con
los gastos de la casa —ya anotado en la tanda 12—, así que su media no significa lo que
parece. Se arregla separando "Alquiler" de los gastos de vivienda, que es decisión de
categorización.

## Lo aplicado: fijos, presupuestos y conciliación por ocurrencias

### Los previstos no eran todos la misma cosa

Migración `0030`: `movimientos_previstos.es_presupuesto`.

- **Fijo** (por defecto): una transacción esperada de importe conocido — hipoteca, seguros,
  comunidad, aportación periódica a inversión. Se cumple tal cual y deja de contar cuando se
  concilia con su movimiento real.
- **Presupuesto**: un techo de categoría — "cuento con 400 € de ocio". En cuanto el mes en
  curso tiene gasto real en esa categoría, el presupuesto deja de aportar y el mes vale lo
  gastado de verdad. Los meses futuros siguen valiendo el presupuesto.

Sin esta distinción el mes en curso contaba las dos cosas: el gasto real ya estaba descontado
del saldo y encima se le sumaba el previsto entero.

No se reutilizó `origen_calculo` a propósito. Ese campo dice de dónde sale el **importe**;
este dice cómo se **comporta** el previsto dentro del mes. Son dos ejes distintos y
mezclarlos es el mismo error que ya se cometió con `cuentas.tipo` (tanda 12).

### La conciliación se contaba por mes, no por ocurrencia

Las tres aportaciones a inversión son previstos **semanales**. La conciliación guardaba una
marca por previsto y mes, así que enlazar la aportación de una sola semana daba el mes entero
por cumplido y borraba las otras cuatro: unos **375 € de aportación prevista que
desaparecían**.

Ahora se cuentan ocurrencias (`contarConciliacionesPorMes` + `ocurrenciasPendientesEnMes`) y
el periodo guardado es la **fecha del movimiento real**, no el día 1 del mes — que es lo que
permite varias conciliaciones de un mismo previsto dentro del mes, por la clave única
`(previsto_id, periodo)`. Las conciliaciones antiguas guardaban el día 1 y siguen contando
como una, así que los previstos mensuales no cambian de comportamiento.

El mes de una conciliación se calcula con el **mes financiero**, no con
`periodo.slice(0, 7)`: una nómina del 28 de agosto pertenece a septiembre, y con el mes
natural la conciliación caería en agosto mientras el previsto de septiembre seguiría
pendiente.

### Un extra puntual suma, no sustituye

Una inversión que apetece hacer o una amortización anticipada **se suman** a lo previsto. En
deuda ya era así (las amortizaciones extra viven en su propia tabla). En inversión funciona
porque nadie concilia un previsto de 50 € con un movimiento de 200 €: el extra ya está en el
saldo real y el previsto sigue pendiente. Hay un test que lo fija.

## Qué hacer, por orden

1. **Borrar o desactivar** el previsto "Cuota Hipoteca vivienda habitual". Decisión de Pablo:
   es su dato, no se toca sin que lo confirme.
2. **Asignar cuenta** a los 10 previstos que no la tienen, al menos a los dos ambiguos.
3. **Dar de alta Restaurantes** y subir Ocio a algo parecido a la realidad.
4. **Marcar como presupuesto** los previstos que lo sean (Ocio, y Restaurantes cuando se dé
   de alta). Los fijos se quedan como están.
5. Con eso hecho, la estimación de cierre del mes se puede apoyar en la previsión.

Sigue pendiente que la conciliación sea **automática al importar**: hoy hay que enlazar a
mano y en toda la base de datos solo hay tres conciliaciones, las tres de agosto. Mientras no
lo sea, los previstos fijos ya pagados del mes en curso se siguen contando dos veces.

Mientras tanto el bloque "Cómo va el mes" del Resumen **no usa previsión**: solo enseña lo
acumulado de verdad y las dos referencias del mes anterior. Ese número no depende de nada de
lo anterior y es correcto ya.
