/**
 * Centralized logging utility
 * Replaces console.* calls with structured logging
 * Supports both client and server environments
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isClient = typeof window !== 'undefined'

  private formatMessage(level: LogLevel, message: string, _context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const prefix = this.isClient ? '[CLIENT]' : '[SERVER]'
    return `${prefix} [${level.toUpperCase()}] ${timestamp} - ${message}`
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, only log warnings and errors
    if (!this.isDevelopment && (level === 'debug' || level === 'info')) {
      return false
    }
    return true
  }

  debug(message: string, _context?: LogContext): void {
    if (!this.shouldLog('debug')) return
    const formatted = this.formatMessage('debug', message, _context)
    console.debug(formatted, _context || '')
  }

  info(message: string, _context?: LogContext): void {
    if (!this.shouldLog('info')) return
    const formatted = this.formatMessage('info', message, _context)
    console.info(formatted, _context || '')
  }

  warn(message: string, _context?: LogContext): void {
    const formatted = this.formatMessage('warn', message, _context)
    console.warn(formatted, _context || '')
  }

  error(message: string, error?: Error | unknown, _context?: LogContext): void {
    const formatted = this.formatMessage('error', message, _context)

    if (error instanceof Error) {
      console.error(formatted, {
        error: {
          name: error.name,
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined
        },
        ..._context
      })
    } else {
      console.error(formatted, error, _context || '')
    }
  }

  /**
   * Structured logging for production (JSON format)
   * Useful for log aggregation tools
   */
  structured(level: LogLevel, message: string, _context?: LogContext): void {
    if (!this.shouldLog(level)) return

    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      environment: this.isClient ? 'client' : 'server',
      ..._context
    }

    if (this.isDevelopment) {
      // Pretty print in development
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        JSON.stringify(logEntry, null, 2)
      )
    } else {
      // JSON in production for log aggregation
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        JSON.stringify(logEntry)
      )
    }
  }
}

// Export singleton instance
export const logger = new Logger()

// Export types for use in other files
export type { LogLevel, LogContext }
