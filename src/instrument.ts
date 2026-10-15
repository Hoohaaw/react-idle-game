import * as Sentry from '@sentry/react'

// Must be imported FIRST in main.tsx, before React or the app — Sentry can't capture errors
// from code that ran before it initialized. Session replay deliberately omitted: it records
// real user sessions, a meaningfully bigger privacy disclosure than plain error capture, and
// would need its own PrivacyPage.tsx update first.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
})
