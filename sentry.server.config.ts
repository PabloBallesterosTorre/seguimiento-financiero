import * as Sentry from "@sentry/nextjs";

// Se activa solo cuando existe NEXT_PUBLIC_SENTRY_DSN (crear cuenta gratuita en
// sentry.io y pegar la DSN en las variables de entorno) — hasta entonces, no-op.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
