import { withSentryConfig } from "@sentry/nextjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
// El host de ingesta varía según la región del proyecto de Sentry (p.ej. EU usa
// *.ingest.de.sentry.io, no *.ingest.sentry.io) — se deriva de la propia DSN en
// vez de adivinar el patrón, para que la CSP sea exacta y no haya que tocarla si
// cambia de proyecto/región.
const sentryIngestOrigin = sentryDsn ? `https://${new URL(sentryDsn).host}` : "";

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl}${sentryIngestOrigin ? ` ${sentryIngestOrigin}` : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

// withSentryConfig sube source maps y envuelve el build; se deja siempre montado
// (es inerte sin NEXT_PUBLIC_SENTRY_DSN) para no tener dos ramas de configuración
// distintas antes/después de activarlo.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  sourcemaps: { disable: !sentryDsn },
});
