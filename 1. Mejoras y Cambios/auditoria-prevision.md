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

## Qué hacer, por orden

1. **Borrar o desactivar** el previsto "Cuota Hipoteca vivienda habitual". Decisión de Pablo:
   es su dato, no se toca sin que lo confirme.
2. **Asignar cuenta** a los 10 previstos que no la tienen, al menos a los dos ambiguos.
3. **Dar de alta Restaurantes** y subir Ocio a algo parecido a la realidad.
4. Con eso hecho, la estimación de cierre del mes se puede apoyar en la previsión.

Mientras tanto el bloque "Cómo va el mes" del Resumen **no usa previsión**: solo enseña lo
acumulado de verdad y las dos referencias del mes anterior. Ese número no depende de nada de
lo anterior y es correcto ya.
