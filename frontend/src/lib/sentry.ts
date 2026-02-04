/**
 * Sentry Error Tracking Configuration
 * 
 * This module initializes Sentry for error tracking and performance monitoring.
 * Configure your Sentry DSN in the environment variables.
 */

import * as Sentry from '@sentry/react';

// Get configuration from environment variables
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const ENVIRONMENT = import.meta.env.MODE || 'development';
const RELEASE = import.meta.env.VITE_APP_VERSION || '2.0.0';

/**
 * Initialize Sentry error tracking.
 * Should be called once at application startup.
 */
export function initSentry(): void {
  // Only initialize if DSN is configured
  if (!SENTRY_DSN) {
    console.info('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: `cost-scraper@${RELEASE}`,
    
    // Set trace sample rate for performance monitoring
    // In production, consider lowering this for high-traffic apps
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Capture 100% of errors
    sampleRate: 1.0,
    
    // Configure which URLs to trace
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/.*\.github\.io/,
      /^https:\/\/api\./
    ],
    
    // Integrations
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration(),
      
      // Replay for session recording (errors only)
      Sentry.replayIntegration({
        // Only record sessions with errors
        maskAllText: true,
        blockAllMedia: true
      })
    ],
    
    // Session replay sample rates
    replaysSessionSampleRate: 0,  // Don't record normal sessions
    replaysOnErrorSampleRate: 1.0, // Record all sessions with errors
    
    // Filter out known non-critical errors
    beforeSend(event, hint) {
      const error = hint?.originalException;
      
      // Ignore network errors that are expected
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        // Ignore common non-critical errors
        if (
          message.includes('network error') ||
          message.includes('failed to fetch') ||
          message.includes('load failed') ||
          message.includes('cancelled')
        ) {
          // Still log to console but don't send to Sentry
          console.warn('Suppressed non-critical error:', error.message);
          return null;
        }
      }
      
      return event;
    },
    
    // Add additional context to errors
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      return breadcrumb;
    }
  });

  console.info('Sentry initialized for environment:', ENVIRONMENT);
}

/**
 * Set user context for error tracking.
 * Call this after user authentication.
 */
export function setUser(user: {
  id?: string;
  username?: string;
  email?: string;
}): void {
  Sentry.setUser(user);
}

/**
 * Clear user context (on logout).
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Add custom context to errors.
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  Sentry.setContext(name, context);
}

/**
 * Set a tag for filtering errors.
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Capture an exception manually.
 */
export function captureException(error: Error, context?: Record<string, unknown>): string {
  return Sentry.captureException(error, {
    extra: context
  });
}

/**
 * Capture a message (non-error event).
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): string {
  return Sentry.captureMessage(message, level);
}

/**
 * Add a breadcrumb for debugging.
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  Sentry.addBreadcrumb(breadcrumb);
}

export { Sentry };
