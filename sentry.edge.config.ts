import * as Sentry from "@sentry/nextjs";

// Se activa solo cuando existe NEXT_PUBLIC_SENTRY_DSN — hasta entonces, no-op.
// Cubre el proxy/middleware, que corre en el runtime edge.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
