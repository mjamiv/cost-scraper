/**
 * Tests for ErrorBoundary component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, InlineErrorFallback, withErrorBoundary } from './ErrorBoundary'

// Mock Sentry
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(() => 'test-event-id'),
  showReportDialog: vi.fn()
}))

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.error for expected errors
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('renders fallback UI when an error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error UI')).toBeInTheDocument()
  })

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn()

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    )
  })

  it('shows retry button that resets error state', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Click retry
    fireEvent.click(screen.getByText('Try Again'))

    // After retry, re-render with no error
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('shows reload button', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Reload Page')).toBeInTheDocument()
  })
})

describe('withErrorBoundary HOC', () => {
  it('wraps component with ErrorBoundary', () => {
    const TestComponent = () => <div>Test</div>
    const WrappedComponent = withErrorBoundary(TestComponent)

    render(<WrappedComponent />)

    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('catches errors in wrapped component', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    
    const WrappedError = withErrorBoundary(ThrowError)

    render(<WrappedError shouldThrow={true} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })
})

describe('InlineErrorFallback', () => {
  it('renders error message', () => {
    const error = new Error('Inline error')

    render(<InlineErrorFallback error={error} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Inline error')).toBeInTheDocument()
  })

  it('shows retry button when onRetry is provided', () => {
    const onRetry = vi.fn()

    render(<InlineErrorFallback onRetry={onRetry} />)

    const retryButton = screen.getByText('Try again')
    expect(retryButton).toBeInTheDocument()

    fireEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalled()
  })

  it('hides retry button when onRetry is not provided', () => {
    render(<InlineErrorFallback />)

    expect(screen.queryByText('Try again')).not.toBeInTheDocument()
  })
})
