# Seguimiento Financiero

App personal de seguimiento financiero: cuentas multi-banco, movimientos, categorización con
aprendizaje, inversión, deuda con calculadora de amortización, patrimonio global y objetivo de
ahorro. Ver el análisis funcional completo en el proyecto de Claude "Seguimiento Financiero".

Stack: Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Postgres + Auth con RLS).

## Estado actual

Primer slice funcionando: autenticación (email/contraseña), alta y listado de cuentas, y patrimonio
global (cuentas + inversión − deuda, con toggle con/sin deuda). El resto de módulos (movimientos,
categorización, inversión, deuda, objetivo de ahorro) tienen ya su tabla en la base de datos pero
faltan las pantallas — se irán añadiendo de forma incremental.

## Puesta en marcha

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito).

3. En el SQL Editor de Supabase, ejecuta el contenido de `supabase/migrations/0001_init.sql`
   para crear las tablas y las políticas de seguridad (RLS).

4. Copia `.env.local.example` a `.env.local` y rellena `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los valores de tu proyecto (Project Settings → API).

5. Arranca el servidor de desarrollo:

   ```bash
   npm run dev
   ```

6. Abre [http://localhost:3000](http://localhost:3000), crea una cuenta de usuario y empieza a
   dar de alta tus cuentas bancarias.

## Despliegue

Pensado para desplegar en Vercel conectando este repositorio de GitHub, con las mismas dos
variables de entorno configuradas en el proyecto de Vercel.
