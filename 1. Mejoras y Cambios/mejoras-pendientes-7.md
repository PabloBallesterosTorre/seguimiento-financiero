---
title: Mejoras y cambios pendientes (tanda 7) — App Seguimiento Financiero
description: Nueva lista viva de cambios, mejoras, dudas y pruebas, posterior a las tandas 1-6. Redactada como especificaciones para pasar directamente a Claude Code.
---

# Mejoras y cambios pendientes (tanda 7)

Nueva lista viva. Las tandas anteriores (1 a 6, más el documento de dudas y el de datos disponibles) están archivadas en la subcarpeta `Old\` de esta misma carpeta. Resumen:

- **Tanda 1**: cuentas editables, formulario bajo demanda, cuentas remuneradas, agrupación temporal de deuda, simulador de amortización en pantalla propia, fechas libres en amortizaciones, previsión de flujo de caja por categoría (`Movimiento previsto`), detección automática de patrones (nivel 1 y nivel 2), traspasos entre cuentas.
- **Tanda 2**: categoría automática al crear una deuda, revisar con Claude Code el diseño de traspasos, confirmación obligatoria al editar/eliminar, bug de categoría "Sin Categoría" en previsiones, cálculo del saldo tras importar.
- **Tanda 3**: objetivo de ahorro único y genérico en Configuración, previsión automática de intereses de cuentas remuneradas, tabla de "sin categorizar" en Movimientos, formularios bajo demanda en toda la app, recálculo del simulador desde una fecha elegida, previsto manual vs. automático, fecha de corte en importación.
- **Tanda 4**: visión central de "El Planificador"; bug de sugerencia de categoría que no reconoce un patrón ya aprendido; tabla de diagnóstico de la previsión (implementada); gap del nivel 2 de previsión automática (gastos e ingresos); dudas sobre categorías repetidas en sugerencias y sobre ingresos recurrentes.
- **Tanda 5**: tablas ordenables y persistentes, periodicidades intermedias en previsiones, vista de detalle de categoría con sus movimientos, aclaración funcional previsto vs. real al conciliar (con diagrama), poder descartar sugerencias de previsión, orden ingresos-antes-que-gastos en previsión, y la especificación completa del dashboard de Informes en `/informes` (7 vistas, con prototipo interactivo de referencia).
- **Tanda 6**: bug detectado en el modelo de datos (`movimiento_real_id` solo recuerda la conciliación del último mes, no una por instancia mensual); duda sobre la periodicidad de intereses de cuentas remuneradas (se captura pero no se usa); `/dashboard` pasa a llamarse `/home`, con "Cuentas" sustituido por el indicador de "Liquidez" (antes "Dinero disponible ahora" en Informes) y "Objetivo de ahorro" sustituido por "Flujo Mensual Disponible" con una línea discontinua marcando el objetivo; principio transversal de que todos los informes calculan solo sobre los datos reales disponibles (nunca asumen un periodo completo que no existe); eliminación de la vista de cumplimiento mensual del objetivo de ahorro en `/informes` (queda redundante con la Home).
- **`dudas-pendientes.md`** (en `Old\`): documento con un prompt para que Claude Code respondiera directamente las dudas abiertas hasta ese momento — revisar si ya tiene respuestas antes de repetir esas preguntas aquí.
- **`datos-disponibles-para-informes.md`** (en `Old\`): inventario real de las tablas y campos de la base de datos, escrito por Claude Code. Consultarlo antes de especificar nada que dependa de datos concretos.

Cada entrada de aquí en adelante sigue el mismo formato: contexto + requisito + criterios de aceptación (Mejoras), contexto + duda + hipótesis (Dudas), o pasos + resultado esperado (Pruebas).

## Mejoras

*(sin puntos abiertos ahora mismo — ver Dudas y la sección "Notas del recorrido" de `auditoria-ux-ui.md` para lo pendiente de decidir)*

## Dudas

*(pendiente de completar)*

## Pruebas

*(pendiente de completar)*

## Hechas / incorporadas

*(se mueven aquí las que ya se han pasado a Claude Code o incorporado al análisis funcional)*

### 2. Encargo — cobertura de tests de regresión sobre todo lo ya construido (HECHA)

Al revisarlo (durante la tanda de arreglos de la auditoría, punto 1 más abajo) ya existía una suite
Vitest con buena cobertura de lógica de cálculo, pero con dos huecos reales frente al encargo
original: el cálculo de "saldo de cuenta tras importar" vivía solo dentro de la Server Action (sin
función pura testeable), y las "reglas transversales" de UI (confirmación al editar/eliminar,
formularios bajo demanda, orden de tabla persistente) no tenían ningún test de componente — solo
lógica pura. Se cerraron los dos:

- **Saldo tras importar**: extraída la función pura `calcularSaldoTrasImportar` a
  `lib/importarCsv.ts` (antes el cálculo estaba inline en la Server Action de importación), con
  tests propios (lote vacío, saldo negativo, no depende del orden de las filas).
- **Tests de componente**: añadido `@testing-library/react` + `jsdom` al proyecto (antes solo había
  tests de lógica pura en Node). Nuevos tests: `ConfirmForm.test.tsx` (abre modal en vez de
  `confirm()` nativo, cancelar no ejecuta la acción, Escape cierra, confirmar reintenta el envío),
  `NuevaDeuda.test.tsx` como representante del patrón "formulario bajo demanda" (arranca colapsado,
  se despliega, cancelar colapsa sin acción, validación nativa con los campos obligatorios), y
  `OrdenTabla.test.tsx` (ciclo asc → desc → asc del orden de tabla y que se persiste en cada clic).
  **Limitación descubierta y documentada en el propio código**: `<form action={fn}>` (el patrón de
  Server Actions usado en toda la app) depende del fork de React que usa Next.js en su build interno
  — react-dom "vanilla" (el que carga Vitest fuera de ese pipeline) no lo soporta y avisa con un
  warning. Por eso estos tests de componente verifican la lógica propia de cada componente (abrir/
  cerrar, validación, reintento de envío) pero no el tramo final "la Server Action se ejecutó de
  verdad" — ese tramo se verificó manualmente contra la app real con Playwright durante esta tanda.
- De paso, arreglados dos errores de tipado preexistentes en `lib/supabase/middleware.ts` y
  `server.ts` que hacían fallar `npm run build` (con `next dev` no se notaba, al no tipar tan
  estricto) — no relacionados con esta tanda, pero bloqueaban comprobar que el build de producción
  funcionaba.

Suite final: **16 archivos, 164 tests**, ejecutable con `npx vitest run` (`npm test`). `npm run
build` termina sin errores.

### 1. Encargo — auditoría de UX/UI de toda la app (HECHA — auditoría + arreglos aplicados)

Informe completo en `auditoria-ux-ui.md` (misma carpeta): recorrido funcional real (cuentas,
importación de los 2 extractos reales, categorización, deuda con simulador, inversión, previsión
con periodicidad semanal, Planificador mensual/anual, Informes, Configuración) más auditoría de
UX/UI pantalla por pantalla en escritorio y móvil (375×800).

Se detectaron 8 bugs y 13 hallazgos de UX/UI. Tras revisar el informe, Pablo pidió aplicar
directamente todos los que tenían solución propuesta clara — quedan implementados y verificados en
vivo (con tests donde aplicaba; ver el punto 2 de más abajo para la suite completa):

- Importación: filtro por columna para archivos que mezclan varias cuentas (caso Revolut), y
  detalle de qué filas se descartan y por qué.
- Movimientos: cabecera "Categorizados (N)"; el aprendizaje de patrones ahora reconoce
  repeticiones aunque cambie una fecha embebida en la descripción (típico en intereses diarios).
- Cuentas: placeholder de "Tipo de interés" ya no confunde con un valor real, y pasa a obligatorio
  en cuentas remuneradas.
- Navegación móvil: menú hamburguesa (antes no cabía y forzaba scroll horizontal de toda la
  página).
- Tablas anchas (Movimientos, Deuda, Cuentas, Categorías, Inversión, Previstos, Amortizaciones):
  scroll horizontal contenido en la propia tabla, ya no en toda la página.
- Categorías: botón "Usar categorías sugeridas" (plantilla de 9 categorías habituales, editable)
  para que un usuario nuevo no empiece de cero total.
- Confirmaciones de borrado: modal propio con el estilo de la app en vez del `confirm()` nativo del
  navegador — un solo cambio central, aplicado a toda la app.
- Inversión: "Tipo de activo" pasa de texto libre a desplegable (sin artefactos de guion bajo).
- Favicon añadido.
- Planificador: la "Deuda pendiente" reconstruida hacia atrás ya no da un salto discontinuo en el
  mes de hoy — se ancla al capital pendiente real en vez de recalcularse de forma independiente
  desde `fecha_inicio`.

Tres hallazgos de la primera pasada del informe (previsiones sin categoría editable, jerarquía de
subcategorías, y "Tipo" de cuenta en minúscula) resultaron ser falsos positivos al comprobarlos a
fondo — ya funcionaban correctamente, no se tocó código.

Quedan sin resolver, marcadas explícitamente en `auditoria-ux-ui.md` como dudas de diseño para que
Pablo las confirme antes de convertirlas en mejora (ver su sección "Notas del recorrido"): alcance
del matching de patrones más allá de fechas, heurística de "¿es un traspaso?" no identificada,
inestabilidad observada en las pruebas automatizadas (posible revalidación/polling en
`/movimientos`), comparativa "frente al mes anterior" en Home con importación masiva de golpe,
edición de movimientos importados, y cobertura de accesibilidad por teclado / anchos intermedios
(tablet).
