---
title: Mejoras y cambios pendientes (tanda 4) — App Seguimiento Financiero
description: Nueva lista viva de mejoras, dudas abiertas y pruebas, posterior a la tanda 3 (ver mejoras-pendientes-3.md). Redactada como especificaciones para pasar directamente a Claude Code.
---

# Mejoras y cambios pendientes (tanda 4)

Nueva lista viva. Tandas anteriores:
- Tanda 1 (`mejoras-pendientes.md`, entregada a Claude Code el 2026-08-24): cuentas editables, formulario bajo demanda, cuentas remuneradas, agrupación temporal de deuda, simulador de amortización en pantalla propia, fechas libres en amortizaciones, previsión de flujo de caja por categoría, detección automática de patrones, traspasos entre cuentas.
- Tanda 2 (`mejoras-pendientes-2.md`): categoría automática al crear deuda, revisar enfoque de traspasos con Claude Code, confirmación al editar/eliminar, bug de categoría no visible en previsiones, cálculo del saldo tras importar.
- Tanda 3 (`mejoras-pendientes-3.md`): objetivo de ahorro único movido a Configuración (con booleano de inversión), pestaña Configuración de Perfil, previsión automática de intereses de cuentas remuneradas, tabla de sin categorizar en Movimientos, formularios bajo demanda en toda la app, recálculo del simulador desde la fecha elegida, aclaración manual vs. automático en previsiones, fecha de corte en importación. Dudas: futura pestaña de Informes. Pruebas: flujo hipoteca → categoría → previsión → conciliación.

Esta tanda sigue el mismo formato que la tanda 3, con tres tipos de entradas:
- **Mejoras**: cambios/funcionalidades concretas, redactadas como contexto + requisito + criterios de aceptación, listas para pasarse tal cual a Claude Code.
- **Dudas**: preguntas abiertas o cosas que Pablo no tiene claras todavía — no llevan criterios de aceptación cerrados, son para plantearle la pregunta a Claude Code (o decidir con él) antes de convertirlas en una mejora concreta.
- **Pruebas**: casos de prueba/verificación concretos que Pablo quiere que se comprueben en la app, para pasárselos a Claude Code como checklist de testing.

## Mejoras

### 1. Visión central de la app: el "Planificador" — proyección integral de flujo, patrimonio e inversión

**Contexto**: esto no es una funcionalidad aislada, sino la idea principal que da sentido a la app y a la que deben servir todas las piezas de previsión ya especificadas en tandas anteriores (previsión de flujo de caja y detección de patrones — tanda 1, puntos 7-8; previsión de intereses de cuentas remuneradas — tanda 3, punto 3; calendario/simulador de deuda — tanda 1, puntos 4-6; patrimonio global con/sin deuda — `analisis-funcional.md`, sección 2). Eleva y concreta la duda 1 de la tanda 3 ("futura pestaña de Informes"): deja de ser una idea difusa para el futuro y pasa a ser el objetivo central del producto.
**Requisito**: Pablo quiere, en un único sitio (el "Planificador"), poder ver de un vistazo:
- Qué gastos e ingresos **suele tener** (patrones históricos, lo ya ocurrido).
- Qué gastos e ingresos **va a tener** (previsión hacia adelante, combinando lo previsto manual, lo detectado automáticamente, la deuda y los intereses de cuentas remuneradas).
- **Cuánto dinero va a ir teniendo mes a mes y año a año** (evolución de liquidez/saldo agregado a lo largo del tiempo, no solo el mes en curso).
- **Cómo va a evolucionar su patrimonio**: el líquido subiendo, la deuda bajando (coherente con el toggle patrimonio con/sin deuda ya previsto en el análisis funcional), proyectado hacia el futuro, no solo como foto fija de hoy.
- **Cómo van a evolucionar sus inversiones** dentro de esa misma proyección.
**Detalle**:
- Es el módulo que da sentido y consume todo lo que ya se ha ido pidiendo en tandas anteriores: la previsión de flujo de caja por categoría (tanda 1, puntos 7-8) es la pieza de gastos/ingresos; el calendario de deuda y su simulador (tanda 1, puntos 4-6) son la pieza de "deuda bajando"; la previsión de intereses (tanda 3, punto 3) alimenta tanto el flujo como el patrimonio; el patrimonio global con/sin deuda (ya en el análisis funcional) se convierte aquí en una serie temporal proyectada, no en un número estático de hoy.
- La vista debe permitir moverse tanto en granularidad mensual (para el corto/medio plazo) como anual (para el largo plazo, ej. ver la evolución de la hipoteca o del ahorro a 10-20 años vista) — coherente con la agrupación temporal ya pedida para el detalle de deuda (tanda 1, punto 4).
- Debe distinguir visualmente lo que es histórico/real de lo que es previsión/proyección, para que Pablo no confunda ambos.
- No es necesario resolver aquí el diseño visual concreto (gráficos, tablas) — eso se define con Claude Code al implementarlo — pero sí que el modelo de datos y las previsiones ya especificadas en tandas anteriores estén pensadas para poder alimentar esta vista integral sin tener que rehacerse.
**Criterios de aceptación**:
- Existe una pantalla ("Planificador" o nombre equivalente) que muestra, en una misma proyección temporal, ingresos/gastos previstos, evolución del patrimonio (con/sin deuda) y evolución de las inversiones, mes a mes y año a año.
- La proyección combina todas las fuentes de previsión ya especificadas (movimientos previstos manuales y automáticos, calendario de deuda/amortizaciones, intereses de cuentas remuneradas) de forma coherente, sin duplicar ni omitir ninguna.
- Se puede alternar entre vista mensual y anual.
- Se distingue claramente qué datos son histórico real y cuáles son proyección futura.

## Dudas

*(vacío por ahora)*

## Pruebas

*(vacío por ahora)*

## Hechas / incorporadas

*(se mueven aquí las que ya se han pasado a Claude Code o incorporado al análisis funcional)*
