---
title: Ideas de seguridad, monitorización y tests para más adelante
description: Lista de mejoras que se me han ocurrido durante el trabajo de fiabilización (seguridad + monitorización + Server Actions), no implementadas — para revisar y priorizar cuando haya tiempo. No son bloqueantes para el despliegue de esta noche.
---

# Ideas para más adelante (no implementadas)

Todo esto ha ido surgiendo mientras se dejaba la app lista para producción. Ninguna es
urgente ni bloquea el despliegue de hoy — quedan aquí para que las revises con calma.

## Seguridad

- **Desactivar el alta pública también en Supabase Dashboard** (Authentication →
  Providers → Email → "Allow new users to sign up"). Ya se quitó el botón de la UI y
  la Server Action, pero esa es la segunda capa de defensa que falta — no se pudo
  hacer por CLI sin arriesgarse a pisar `site_url` de producción a ciegas.
- **2FA/MFA para tu propia cuenta**: Supabase Auth lo soporta (TOTP), y en una app
  con datos financieros personales es una capa extra barata de añadir. Se activaría
  igualmente desde el Dashboard (no hace falta cambiar código de la app salvo la
  pantalla de login, que habría que ampliar).
- **Timeout de sesión**: hoy la sesión dura lo que dure el JWT (`jwt_expiry`, 1h, con
  refresh automático indefinido). Para datos financieros podría interesar forzar
  cierre de sesión tras N días de inactividad (`auth.sessions.inactivity_timeout`
  en `supabase/config.toml`, disponible en Supabase pero comentado hoy).
- **Backups**: no se ha verificado qué política de backup tiene el proyecto de
  Supabase (plan gratuito vs. con Point-in-Time Recovery). Merece la pena revisarlo
  en el dashboard y, si el plan gratuito no lo cubre, valorar un `pg_dump`
  periódico a mano mientras siga en el nivel gratuito.
- **Rotar la ANON_KEY / revisar el JWT secret** si en algún momento se sospecha que
  se ha filtrado (por ejemplo, si alguna vez se sube sin querer un `.env` a un
  repo público). No es necesario ahora, solo un procedimiento a tener en mente.
- **Rate limiting a nivel de aplicación**: Supabase Auth ya limita intentos de
  login/signup por IP, pero las Server Actions de la propia app (crear movimiento,
  etc.) no tienen ningún límite propio. Con un solo usuario real no es prioritario,
  pero si la URL es pública alguien podría intentar abusar del formulario de login
  con fuerza bruta contra un email conocido — Supabase ya lo frena (30 intentos/5
  min por IP), así que es una capa redundante más que una urgencia.

## Monitorización

- **Vercel Analytics / Speed Insights** (`@vercel/analytics`, `@vercel/speed-insights`):
  gratis en el plan Hobby, dan una idea de rendimiento real sin montar nada.
- **Alertas de Sentry**: por defecto Sentry solo junta los errores; conviene entrar
  al proyecto y configurar una alerta por email/Slack cuando salte un error nuevo,
  si no una monitorización pasiva no te avisa activamente.
- **Sourcemaps de Sentry**: hoy están desactivados hasta que definas `SENTRY_ORG`,
  `SENTRY_PROJECT` y `SENTRY_AUTH_TOKEN` — sin ellos, los stacktraces de Sentry en
  producción muestran código minificado en vez de tu código fuente real. Vale la
  pena rellenarlos cuando tengas un rato (Sentry → Settings → Auth Tokens).
- **Un endpoint de health-check** (`/api/health`) que compruebe la conexión a
  Supabase, útil si algún día se añade un monitor externo tipo UptimeRobot/Better
  Uptime (gratis) que te avise si la app cae, no solo si lanza errores mientras la
  usas.

## Tests

- **Tests de integración de las Server Actions** contra una base de datos de
  pruebas real (hoy solo hay tests unitarios de funciones puras en `lib/`) — cubriría
  justo la clase de bug que se acaba de arreglar (saldo desincronizado si una
  lectura intermedia falla), de forma automática y no solo verificado a mano una vez.
- **CI en GitHub Actions**: un workflow que ejecute `npx tsc --noEmit` y
  `npx vitest run` en cada push/PR, para no depender de acordarme de correrlos a
  mano antes de cada commit.
- **Tests end-to-end con Playwright** para los flujos completos que hoy solo se han
  verificado manualmente en esta sesión (alta de movimiento + reversión de saldo,
  importación de CSV, ciclo completo de una deuda con amortización) — el propio
  MCP de Playwright que se ha usado para verificar en vivo podría convertirse en una
  suite de tests real con poco esfuerzo adicional.
- **Dependabot/Renovate**: para que las dependencias (y sus vulnerabilidades, como
  la de Next 14 que se acaba de arreglar) no se acumulen en silencio otra vez.
