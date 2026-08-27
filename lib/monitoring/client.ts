"use client";

// Reporta un error capturado por un error boundary de React: siempre a la consola
// (visible en los logs de Vercel), y a Sentry si NEXT_PUBLIC_SENTRY_DSN está
// configurado (ver instrumentation-client.ts) — si no, esta parte no hace nada.
export function reportError(error: Error & { digest?: string }) {
  console.error(error);
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
  }
}
