/**
 * Email Unsubscribe Page
 *
 * Handles one-click email unsubscribe via signed tokens.
 * No authentication required - token contains user ID and action.
 *
 * Flow:
 * 1. User clicks unsubscribe link in email
 * 2. Page calls API to verify token and process unsubscribe
 * 3. Shows confirmation with options to manage preferences
 */

import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

// Disable static generation - this page uses useRouter
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}

interface UnsubscribeResult {
  success: boolean
  action?: string
  action_description?: string
  email?: string
  message?: string
  error?: string
}

type UnsubscribeState = 'loading' | 'success' | 'error'

export default function UnsubscribePage() {
  const router = useRouter()
  const { token } = router.query

  const [state, setState] = useState<UnsubscribeState>('loading')
  const [result, setResult] = useState<UnsubscribeResult | null>(null)

  useEffect(() => {
    if (!router.isReady) return

    if (!token || typeof token !== 'string') {
      setState('error')
      setResult({
        success: false,
        error: 'missing_token',
        message: 'This unsubscribe link is missing required information.'
      })
      return
    }

    processUnsubscribe(token)
  }, [router.isReady, token])

  async function processUnsubscribe(token: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(
        `${apiUrl}/api/email/unsubscribe?token=${encodeURIComponent(token)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json'
          }
        }
      )

      // The API might return HTML for GET requests, but we'll try JSON first
      const contentType = response.headers.get('content-type')

      if (contentType?.includes('application/json')) {
        const data = await response.json()
        setResult(data)
        setState(data.success ? 'success' : 'error')
      } else {
        // API returned HTML, which means it processed via GET
        // Call POST for programmatic access
        const postResponse = await fetch(
          `${apiUrl}/api/email/unsubscribe?token=${encodeURIComponent(token)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'List-Unsubscribe=One-Click'
          }
        )

        if (postResponse.ok) {
          const data = await postResponse.json()
          setResult({
            success: true,
            message: 'You have been successfully unsubscribed from email notifications.',
            ...data
          })
          setState('success')
        } else {
          // Parse error from response
          const errorData = await postResponse.json().catch(() => ({}))
          setResult({
            success: false,
            error: errorData.error || 'unknown',
            message:
              'Unable to process your unsubscribe request. The link may be invalid or expired.'
          })
          setState('error')
        }
      }
    } catch (err) {
      console.error('Unsubscribe error:', err)
      setResult({
        success: false,
        error: 'network_error',
        message: 'Unable to connect to the server. Please try again later.'
      })
      setState('error')
    }
  }

  return (
    <>
      <Head>
        <title>
          {state === 'loading'
            ? 'Processing...'
            : state === 'success'
              ? 'Unsubscribed'
              : 'Unsubscribe Failed'}{' '}
          - docs.plus
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="from-base-200 to-base-300 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
        <div className="card bg-base-100 w-full max-w-md shadow-xl">
          <div className="card-body items-center text-center">
            {/* Icon */}
            <div className="mb-4">
              {state === 'loading' && (
                <span className="loading loading-spinner loading-lg text-primary" />
              )}
              {state === 'success' && (
                <div className="text-success">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-16 w-16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              )}
              {state === 'error' && (
                <div className="text-error">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-16 w-16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Title */}
            <h1 className="card-title text-2xl">
              {state === 'loading' && 'Processing...'}
              {state === 'success' && 'Unsubscribed'}
              {state === 'error' && 'Unable to Unsubscribe'}
            </h1>

            {/* Message */}
            <p className="text-base-content/70 mt-2">
              {state === 'loading' && 'Please wait while we process your request.'}
              {(state === 'success' || state === 'error') && result?.message}
            </p>

            {/* Email display for success */}
            {state === 'success' && result?.email && (
              <p className="text-base-content/50 mt-1 text-sm">{result.email}</p>
            )}

            {/* Actions */}
            <div className="card-actions mt-6 w-full flex-col gap-2">
              <Link href="/settings/notifications" className="btn btn-primary btn-block">
                Manage Preferences
              </Link>
              <Link href="/" className="btn btn-ghost btn-block">
                Go to docs.plus
              </Link>
            </div>

            {/* Footer */}
            <div className="divider mt-6" />
            <p className="text-base-content/40 text-xs">docs.plus</p>
          </div>
        </div>
      </div>
    </>
  )
}
