# Seguimiento Financiero — contexto para Claude Code

Este proyecto se planificó en una sesión de Claude (Cowork) antes de moverlo aquí. Este archivo
resume ese contexto para que Claude Code pueda continuar sin perder el hilo.

## Qué es

App personal de seguimiento financiero (web, pensada para extenderse a móvil más adelante):
cuentas multi-banco, movimientos, categorización con aprendizaje automático de patrones,
inversión (independiente del saldo de cuentas pero sumando al patrimonio), deuda modelada de
forma genérica (hipoteca, préstamos, financiación con valor residual) con calculadora de
amortización anticipada, patrimonio global con toggle con/sin deuda, y objetivo de ahorro
mensual con cálculo automático de cumplimiento.

Sustituye a un Excel manual que el usuario ya usaba (múltiples hojas por año, saldos por
cuenta/plataforma, objetivo vs real, detalle de movimientos por categoría).

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Postgres + Auth con Row Level
Security). Pensado para desplegar en Vercel. Prioridad: mantener costes de hosting/herramientas
en el nivel gratuito mientras sea posible.

## Estado actual (última sesión de Cowork)

- Repo de GitHub creado: `PabloBallesterosTorre/seguimiento-financiero` (privado).
- Scaffold inicial escrito: autenticación por email/contraseña, alta y listado de cuentas,
  dashboard de patrimonio global (cuentas + inversión − deuda, con toggle). Ver `README.md` para
  cómo arrancarlo.
- Esquema SQL completo ya escrito en `supabase/migrations/0001_init.sql`: cuentas, categorías
  (con subcategorías y flag de categoría-inversión), movimientos, reglas de categorización
  (aprendizaje por patrón), inversiones, deudas (modelo genérico con valor residual opcional),
  amortizaciones extra, objetivos de ahorro. Todas las tablas tienen RLS por `usuario_id`.
- **Pendiente inmediato**: hacer push de este scaffold a GitHub, crear el proyecto de Supabase y
  rellenar `.env.local`, y desplegar en Vercel.
- **Pendiente de desarrollo** (por orden lógico): pantallas de movimientos (alta manual +
  importación CSV/Excel), motor de categorización con aprendizaje, módulo de inversión, módulo
  de deuda con la calculadora de amortización, objetivo de ahorro en el dashboard.
- **Fase 2** (no bloqueante para el MVP): sincronización bancaria automática (Plaid/Tink),
  sincronización automática de inversión con bróker/exchange, detección automática de traspasos
  a inversión en el extracto, presupuestos más completos, informes y gráficos, alertas y
  notificaciones, multi-moneda funcional completo (el modelo de datos ya soporta moneda por
  registro; falta la conversión/consolidación).

## Decisiones ya tomadas (no las reabras sin que el usuario lo pida)

- No hay mecanismo de reconciliación/ajuste de saldo: la importación de movimientos debe cuadrar
  exacta.
- El banco se guarda como texto libre en `cuentas.banco_nombre` (no hay tabla `bancos` aparte),
  simplificación deliberada para el MVP.
- La deuda es un modelo único y genérico (tabla `deudas`), no una tabla por tipo de préstamo.
- El objetivo de ahorro (`objetivos_ahorro`) solo guarda el importe objetivo; el importe real y
  si se cumplió se calculan siempre a partir de los movimientos, nunca se guardan.

## Dónde está el resto del contexto

El análisis funcional completo (con más detalle y el razonamiento detrás de cada decisión) vive
en el proyecto de Claude "Seguimiento Financiero", documento `analisis-funcional.md`.
