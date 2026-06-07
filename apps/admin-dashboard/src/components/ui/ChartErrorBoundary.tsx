import { Component, type ReactNode } from 'react'
import { LuCircleAlert, LuRefreshCw } from 'react-icons/lu'

interface Props {
  children: ReactNode
  fallbackHeight?: number
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chart error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const height = this.props.fallbackHeight || 200

      return (
        <div
          className="bg-base-200/50 border-base-300 flex flex-col items-center justify-center gap-3 rounded-lg border"
          style={{ height }}>
          <LuCircleAlert className="text-error h-8 w-8" />
          <p className="text-base-content/60 text-sm">Failed to load chart</p>
          <button onClick={this.handleRetry} className="btn btn-sm btn-ghost gap-1">
            <LuRefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
