---
title: Datos disponibles en BBDD — para diseñar Informes
description: Inventario completo de tablas y campos reales de la app Seguimiento Financiero (sin datos, solo estructura), para que se pueda diseñar una futura pestaña de Informes sabiendo con qué se cuenta de verdad.
---

# Datos disponibles en BBDD — para diseñar Informes

Este documento describe **qué datos existen hoy** en la base de datos de la app (Postgres/Supabase), tabla por tabla, sin datos reales — solo la estructura y qué significa cada campo. Es la base para diseñar una pestaña de Informes (o cualquier otra vista analítica) sabiendo exactamente con qué información real se puede contar, sin inventar campos que no existen.

Todas las tablas tienen `usuario_id` (referencia a `auth.users`) y RLS por usuario — cada usuario solo ve sus propios datos. Se omite ese detalle en cada tabla para no repetirlo.

## Tablas con datos introducidos por el usuario

### `cuentas` — cuentas bancarias/efectivo
- `id`, `usuario_id`
- `banco_nombre` (texto libre, no hay tabla de bancos aparte)
- `nombre` (nombre que el usuario le da a la cuenta)
- `tipo`: `corriente` / `ahorro` / `conjunta`
- `moneda` (texto, por defecto `EUR`)
- `saldo_actual` (numérico) — saldo mantenido a mano por la app en cada alta/edición de movimiento, no se recalcula sumando movimientos sobre la marcha
- `activa` (booleano) — las inactivas se excluyen de los cálculos de patrimonio/previsión
- `iban` (opcional, texto)
- `es_remunerada` (booleano), `tipo_interes` (numérico, % anual), `periodicidad_pago_interes` (`diaria`/`semanal`/`mensual`/`trimestral`/`anual`) — **`periodicidad_pago_interes` se captura pero hoy no se usa en ningún cálculo**; el interés previsto siempre se compone mensualmente independientemente de este valor
- `created_at`

### `categorias` — categorías de movimientos, jerárquicas
- `id`, `usuario_id`, `nombre`
- `categoria_padre_id` (referencia a otra categoría, o null si es categoría padre) — es toda la jerarquía: no hay más de 2 niveles (padre → subcategoría, no subcategoría de subcategoría)
- `es_categoria_inversion` (booleano) — marca las categorías cuyos movimientos se tratan como "aportación a inversión" (no cuentan como gasto en el objetivo de ahorro si así se configura, y alimentan la inversión proyectada del Planificador)
- `created_at`
- (una categoría ya **no** tiene campo `tipo` ingreso/gasto — se eliminó porque una misma categoría puede usarse en ambos; el signo lo determina el `importe` del movimiento)

### `movimientos` — transacciones reales (manual o importadas)
- `id`, `usuario_id`, `cuenta_id`
- `fecha` (date), `descripcion` (texto, tal cual venga del banco o como lo escriba el usuario)
- `importe` (numérico, con signo: negativo gasto, positivo ingreso)
- `tipo`: `ingreso` / `gasto` / `traspaso`
- `categoria_id` (puede apuntar a una categoría padre o a una subcategoría directamente; null = sin categorizar)
- `subcategoria_id` — **existe en el esquema pero no se usa**: la app guarda la subcategoría elegida directamente en `categoria_id`, este campo siempre es null
- `origen`: `manual` / `importado`
- `moneda` (texto, siempre `EUR` en la práctica — no hay conversión multi-moneda todavía)
- `traspaso_grupo_id` (uuid) — cuando `tipo = 'traspaso'`, agrupa las dos filas del mismo traspaso (una por cuenta, importes de signo opuesto)
- `tipo_original` (`ingreso`/`gasto`, nullable) — solo se rellena cuando un movimiento normal se **vincula** como traspaso con otro ya existente (en vez de crearse un traspaso desde cero); guarda su tipo previo para poder deshacer el vínculo sin tocar saldos
- `created_at`

### `reglas_categorizacion` — motor de aprendizaje de categorización
- `id`, `usuario_id`
- `patron_descripcion` (texto normalizado — minúsculas, recortado — de una descripción ya categorizada)
- `categoria_id` (a qué categoría se aprendió a asignar ese patrón)
- `subcategoria_id` — **no se usa**, siempre null (mismo caso que en `movimientos`)
- `veces_usada` (contador, sube cada vez que se reutiliza la regla)
- `ultima_fecha_uso`
- Una fila por patrón de descripción único; sirve para sugerir categoría en nuevos movimientos con descripción parecida (coincidencia por subcadena, no exacta)

### `inversiones` — posiciones de inversión
- `id`, `usuario_id`
- `tipo_activo` (texto libre: fondo, acción, cripto, etc.)
- `nombre`
- `valor_actual` (numérico) — **valor de mercado actualizado a mano por el usuario**, no hay serie histórica de valoración (no existe una tabla de "valor de la inversión en la fecha X"); solo se conoce el valor de hoy
- `moneda`
- `origen`: `manual` / `sync` (sync es para una futura sincronización automática con bróker, no implementada)
- `movimiento_origen_id` (referencia opcional a un movimiento)
- `fecha_actualizacion`, `created_at`

### `deudas` — modelo genérico de deuda/préstamo (hipoteca, préstamo, financiación con residual)
- `id`, `usuario_id`
- `tipo` (texto libre), `nombre`
- `capital_inicial`, `capital_pendiente` (numéricos) — pendiente se actualiza al aplicar amortizaciones
- `cuota` (numérico) — **cuota vigente actual**; si la cuota cambió alguna vez por una amortización tipo "reducir cuota", no se guarda el historial de cuotas anteriores, solo la vigente
- `periodicidad` (texto, por defecto `mensual`, no tiene más opciones hoy)
- `tipo_interes` (numérico, % anual, nullable — sin interés no se puede simular el cuadro de amortización)
- `modalidad_interes`: `fijo` / `variable` / `mixto` (capturado, no afecta al cálculo — se simula siempre como tipo fijo)
- `fecha_inicio`, `fecha_fin` (fecha_fin es estimada, se recalcula al aplicar amortizaciones)
- `valor_residual` (numérico, nullable) — para financiación tipo coche con pago final
- `categoria_id` — categoría de gasto creada automáticamente al dar de alta la deuda (p. ej. "Pago Hipoteca"), para categorizar sus cuotas
- `moneda`, `created_at`

### `amortizaciones_extra` — aportaciones extra a una deuda (calculadora)
- `id`, `usuario_id`, `deuda_id`
- `fecha`, `importe` (numérico) — cada fila es una aportación puntual y concreta, en una fecha concreta
- `tipo_reduccion`: `reducir_cuota` / `reducir_plazo`
- `recurrencia`: `puntual`/`mensual`/`anual` — **campo informativo, no dirige ningún cálculo**; cada fila siempre se trata como un evento puntual en su fecha
- `aplicado` (booleano) — false = plan futuro (no afecta todavía a `capital_pendiente`), true = ya aplicado (sí afecta)
- `aplicado_en` (timestamp de cuándo se aplicó)
- `created_at`

### `movimientos_previstos` — previsión de flujo de caja (manual o detectada automáticamente)
- `id`, `usuario_id`, `cuenta_id` (opcional)
- `descripcion`
- `categoria_id` (puede ser categoría padre o subcategoría directamente)
- `subcategoria_id` — **no se usa**
- `tipo`: `ingreso` / `gasto` / `traspaso`
- `importe_estimado` (numérico) — importe fijo estimado
- `importe_min` / `importe_max` (numéricos, opcionales) — si se rellenan ambos, el importe usado es el punto medio en vez de `importe_estimado`
- `tipo_recurrencia`: `unica_vez` / `recurrente`
- `periodicidad` (solo si es recurrente): `mensual` / `bimensual` / `trimestral` / `semestral` / `anual`
- `fecha` (solo si es única vez)
- `fecha_inicio` / `fecha_fin` (solo si es recurrente; fecha_fin opcional = sin fin)
- `estado`: `activo` / `pausado`
- `movimiento_real_id` (referencia opcional a un `movimiento` real) — conciliación: cuando se rellena, indica que esa previsión ya se materializó con ese movimiento concreto. **Importante**: es un único campo por previsión recurrente, así que solo puede recordar la conciliación del último mes vinculado, no una por cada instancia mensual
- `origen_calculo`: `fijo` / `media_categoria` — `fijo` = importe congelado (manual, o patrón de nivel 1 con importe estable); `media_categoria` = el importe se recalcula dinámicamente cada vez a partir de la media histórica reciente de esa categoría (nivel 2), en vez de quedarse con el valor con el que se aceptó la sugerencia
- `created_at`

### `objetivos_ahorro` — **tabla obsoleta, ya no se usa**
- Guardaba un objetivo de ahorro por periodo (mes). Sustituida por un único objetivo global en `configuracion_usuario.objetivo_ahorro_mensual`. Se conserva la tabla (con datos históricos) pero la app ya no lee ni escribe en ella.

### `configuracion_usuario` — una fila por usuario, preferencias globales
- `usuario_id` (clave primaria)
- `nombre` (opcional, solo informativo)
- `moneda_base` (texto, por defecto `EUR`) — moneda en la que se muestra todo en la app (no hay conversión real entre monedas distintas todavía)
- `idioma` (texto, por defecto `es`) — solo se guarda la preferencia, no cambia los textos de la interfaz
- `objetivo_ahorro_mensual` (numérico, opcional) — objetivo único y genérico, ya no por mes concreto
- `incluir_inversion_en_ahorro` (booleano) — si true, una aportación a inversión no resta del ahorro del mes (cuenta como ahorro); si false, resta como cualquier gasto
- `updated_at`

### `preferencias_tabla` — orden de columna elegido por el usuario en cada tabla de la app
- `usuario_id`, `tabla` (nombre lógico de la tabla en la UI, p. ej. `movimientos`, `cuentas`, `deudas`), `columna`, `direccion` (`asc`/`desc`), `updated_at`
- Puramente de UI (recordar cómo se ordenó cada tabla) — no tiene valor analítico para informes.

## Datos que NO se almacenan (se calculan siempre al vuelo, no hay tabla)

Estos son conceptos importantes que un informe podría querer mostrar, pero que **no existen como fila guardada en ningún sitio** — se recalculan cada vez a partir de las tablas de arriba:

- **Patrimonio total** (con/sin deuda) = suma de `saldo_actual` de cuentas activas + suma de `valor_actual` de inversiones − suma de `capital_pendiente` de deudas (si se incluye deuda). No hay snapshot histórico guardado del patrimonio en fechas pasadas — el "histórico" del Planificador se **reconstruye** matemáticamente a partir del histórico de `movimientos` (líquido exacto), de `deudas`/`amortizaciones_extra` (deuda pendiente simulada desde el origen) y de los movimientos categorizados como inversión (coste acumulado aportado, **no** el valor de mercado histórico real, que no se registra en ningún sitio).
- **Ahorro real del mes** = suma de movimientos del mes, excluyendo traspasos, con la aportación a inversión sumando o restando según `incluir_inversion_en_ahorro`.
- **Previsto vs. real** por categoría/mes = se cruza `movimientos_previstos` (aplicable ese mes) contra `movimientos` reales de esa categoría/mes.
- **Intereses previstos de cuentas remuneradas** = proyección mes a mes con interés compuesto a partir de `tipo_interes` y el saldo proyectado, no una fila guardada.
- **Cuadro de amortización de una deuda** (capital/interés/plazo mes a mes) = se simula al vuelo desde `capital_pendiente`/`tipo_interes`/`cuota`, no se guarda mes a mes.
- **Sugerencias de patrones automáticos** (nivel 1: patrón por descripción repetida; nivel 2: media por categoría) = se recalculan cada vez que se visita la pantalla de Sugerencias a partir del histórico de `movimientos`, no se guardan como tabla — solo lo que el usuario acepta explícitamente pasa a `movimientos_previstos`.

## Notas para quien diseñe los Informes

- No hay ninguna tabla de **snapshots/histórico de patrimonio o de valoración de inversión** en fechas concretas — cualquier informe de evolución pasada del patrimonio depende de reconstruir a partir de `movimientos` (exacto para líquido) y asume coste, no valor de mercado, para inversión.
- No hay **multi-moneda real**: aunque varias tablas tienen un campo `moneda`, todo se trata como si fuera la misma divisa (`EUR` en la práctica) — no existe tabla de tipos de cambio ni conversión.
- La jerarquía de categorías es de **como mucho 2 niveles** (padre/hija); los campos `subcategoria_id` sueltos en `movimientos`, `movimientos_previstos` y `reglas_categorizacion` están en el esquema pero no se usan — ignorarlos.
- Los traspasos entre cuentas propias **nunca se cuentan en ninguna categoría** — no aparecen en ningún desglose por categoría, ni en gasto ni en ingreso, están pensados para no afectar a ningún cálculo agregado.
