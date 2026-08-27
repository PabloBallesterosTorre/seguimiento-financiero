# Seguimiento Financiero

App personal de seguimiento financiero: cuentas multi-banco, movimientos con categorización por
aprendizaje de patrones, inversión (aportaciones recurrentes, evolución diaria estimada,
rentabilidad asumida), deuda con calculadora de amortización, previsión de flujo de caja,
planificador de patrimonio (histórico + proyección) e informes. Ver el análisis funcional completo
en el proyecto de Claude "Seguimiento Financiero".

Stack: Next.js 16 (App Router) + TypeScript + Tailwind + Supabase (Postgres + Auth con RLS),
monitorización de errores con Sentry.

App de un único usuario: el alta pública está cerrada (sin botón de registro); el usuario se crea
directamente en el Dashboard de Supabase (Authentication → Users → Add user).

## Puesta en marcha en local

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito) y aplica todas las
   migraciones de `supabase/migrations/` (en orden, o con `supabase db push` si tienes el CLI
   enlazado al proyecto — ver `supabase link`).

3. Copia `.env.local.example` a `.env.local` y rellena, como mínimo:
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API).
   - `NEXT_PUBLIC_SENTRY_DSN` es opcional (monitorización de errores) — sin ella la app funciona
     igual, solo que Sentry no recibe nada.

4. Crea tu usuario en Supabase Dashboard → Authentication → Users → Add user (con email y
   contraseña) — no hay pantalla de alta en la app.

5. Arranca el servidor de desarrollo:

   ```bash
   npm run dev
   ```

6. Abre [http://localhost:3000](http://localhost:3000) e inicia sesión con el usuario creado en
   el paso 4.

**Importante**: no ejecutes `npm run build` mientras `npm run dev` está corriendo — comparten la
carpeta `.next` y pueden interferir entre sí.

## Despliegue en Vercel

1. Importa este repositorio de GitHub en [vercel.com](https://vercel.com) (New Project → Import).
   Vercel detecta Next.js automáticamente, no hace falta configuración adicional.
2. En las variables de entorno del proyecto de Vercel, añade las mismas que en `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SENTRY_DSN` (opcional, recomendado)
   - `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` (opcionales, solo para que el build
     suba source maps a Sentry y los stacktraces en producción muestren código real en vez de
     minificado — se generan en Sentry → Settings → Auth Tokens)
3. Despliega. Una vez tengas la URL definitiva de producción, actualiza en Supabase Dashboard →
   Authentication → URL Configuration el `Site URL` (y añade la URL a los Redirect URLs) — si no,
   los enlaces de los emails de Supabase Auth (cambio de contraseña, etc.) seguirán apuntando a
   `localhost`. (El alta pública ya está desactivada a nivel de proyecto — `disable_signup: true`
   confirmado vía la Management API — no hace falta tocar nada más ahí.)

Las nuevas versiones se siguen desarrollando en local (`npm run dev`) y se despliegan haciendo
`git push` a `main` — Vercel vuelve a construir y desplegar automáticamente en cada push.
