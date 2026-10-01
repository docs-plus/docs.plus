import { Component, type ReactNode } from 'react'
import { LuCircleAlert, LuRefreshCw } from 'react-icons/lu'

import { logError } from '@/utils/logger'

interface Props {
  children: ReactNode
  fallbackHeight?: number
}

interface State {
  hasError: boolean
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('Chart error:', { error, errorInfo })
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      const height = this.props.fallbackHeight || 200

      return (
        <div
          className="border-base-300 rounded-box flex flex-col items-center justify-center gap-3 border"
          style={{ height }}>
          <LuCircleAlert className="text-error h-8 w-8" />
          <p className="text-base-content/60 text-sm">Failed to load chart</p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="text-primary text-meta rounded-field focus-visible:outline-primary -my-2.5 inline-flex cursor-pointer items-center gap-1.5 py-2.5 font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
            <LuRefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
