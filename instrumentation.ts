// Registro de Sentry (server + edge). No hace nada mientras no exista
// NEXT_PUBLIC_SENTRY_DSN — ver sentry.server.config.ts / sentry.edge.config.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(...args);
};
