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

## Separación local / producción

El desarrollo local y producción usan **proyectos de Supabase distintos** (base de datos y Auth
completamente separados) — nunca se comparte proyecto entre ambos:

- **Producción** (Vercel): proyecto `seguimiento-financiero` (ref `ctyqpyznqhcauufoiqam`).
- **Desarrollo local**: proyecto `seguimiento-financiero-dev` (ref `vyxhujahqhpkskjbalzg`), con las
  mismas migraciones aplicadas y un usuario propio.

`.env.local` apunta siempre al proyecto **dev**; las variables de entorno de Vercel apuntan al de
**producción**. Cualquier cuenta/movimiento/etc. que crees con `npm run dev` va al proyecto dev y
nunca toca los datos reales.

Al añadir una migración nueva en `supabase/migrations/`, aplícala a los dos proyectos:

```bash
npx supabase db push --project-ref vyxhujahqhpkskjbalzg   # dev
npx supabase db push --project-ref ctyqpyznqhcauufoiqam   # producción
```

(usa `--linked` en vez de `--project-ref` si tienes el CLI enlazado al proyecto correspondiente).

## Puesta en marcha en local

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Si vas a levantar el proyecto por primera vez, crea un proyecto Supabase de **dev** en
   [supabase.com](https://supabase.com) (plan gratuito) y aplica todas las migraciones de
   `supabase/migrations/` (en orden, o con `supabase db push --project-ref <ref>`). No reutilices
   el proyecto de producción para esto.

3. Copia `.env.local.example` a `.env.local` y rellena, como mínimo:
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` del proyecto **dev**
     (Project Settings → API).
   - `NEXT_PUBLIC_SENTRY_DSN` es opcional (monitorización de errores) — sin ella la app funciona
     igual, solo que Sentry no recibe nada.

4. Crea tu usuario en el Dashboard del proyecto **dev** → Authentication → Users → Add user (con
   email y contraseña) — no hay pantalla de alta en la app.

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
