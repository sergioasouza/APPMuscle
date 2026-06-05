import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : ''
const isProduction = process.env.NODE_ENV === 'production'
const cspReportUri = process.env.SENTRY_CSP_REPORT_URI
const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline' ${isProduction ? '' : "'unsafe-eval' "}https://va.vercel-scripts.com`,
    `connect-src 'self' ${supabaseOrigin} https://*.supabase.co https://*.ingest.sentry.io https://vitals.vercel-insights.com https://va.vercel-scripts.com${isProduction ? '' : ' ws: wss:'}`,
].join('; ')

const reportOnlyContentSecurityPolicy = cspReportUri
    ? [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        `script-src 'self' ${isProduction ? '' : "'unsafe-eval' "}https://va.vercel-scripts.com`,
        `connect-src 'self' ${supabaseOrigin} https://*.supabase.co https://*.ingest.sentry.io https://vitals.vercel-insights.com https://va.vercel-scripts.com${isProduction ? '' : ' ws: wss:'}`,
        `report-uri ${cspReportUri}`,
        'report-to csp-endpoint',
    ].join('; ')
    : null

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy,
  },
  ...(reportOnlyContentSecurityPolicy
    ? [
        {
          key: 'Content-Security-Policy-Report-Only',
          value: reportOnlyContentSecurityPolicy,
        },
        {
          key: 'Reporting-Endpoints',
          value: `csp-endpoint="${cspReportUri}"`,
        },
      ]
    : []),
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
