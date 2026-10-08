import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error(error, info.componentStack)
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }
    if (this.props.fallback !== undefined) {
      return this.props.fallback
    }
    return (
      <div className="container error-fallback" role="alert">
        <h1>Something went wrong</h1>
        <p>This part of the page could not be displayed. Please try again.</p>
        <button type="button" className="btn btn--primary" onClick={this.handleRetry}>
          Try again
        </button>
      </div>
    )
  }
}
