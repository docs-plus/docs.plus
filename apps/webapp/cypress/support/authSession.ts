/// <reference types="cypress" />

import { createChunks, stringToBase64URL } from '@supabase/ssr'

/**
 * A real local Supabase session for signed-in specs. It creates the user with the
 * service-role key, signs in with a password, and writes the session cookie the way
 * @supabase/ssr does (see packages/document-swarm/src/actors/sessionInject.ts).
 */

// The Supabase CLI's public local demo keys, the same values as .env.example.
// They work only against a local stack, and the host guard below enforces that.
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabaseUrl = (): string => {
  const url = new URL(Cypress.expose('SUPABASE_URL') ?? 'http://localhost:54321')
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error(`authSession runs only against a local Supabase, not ${url.host}`)
  }
  return url.origin
}

// supabase-js default storage key: `sb-<first host label>-auth-token`.
const authCookieName = (): string =>
  `sb-${new URL(supabaseUrl()).hostname.split('.')[0]}-auth-token`

/** Matches the session cookie and its chunks, for any project ref. */
export const AUTH_COOKIE_PATTERN = /^sb-.+-auth-token(\.\d+)?$/

/** Creates the user once; a later run finds it already there. */
export const ensureLocalUser = (email: string, password: string) =>
  cy
    .env(['SUPABASE_SERVICE_ROLE_KEY'])
    .then(({ SUPABASE_SERVICE_ROLE_KEY }) => {
      const serviceKey = SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_KEY
      return cy.request({
        method: 'POST',
        url: `${supabaseUrl()}/auth/v1/admin/users`,
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        body: { email, password, email_confirm: true },
        failOnStatusCode: false
      })
    })
    .then((res) => {
      if (res.status !== 200 && res.status !== 422) {
        throw new Error(`Could not create ${email}: ${res.status} ${JSON.stringify(res.body)}`)
      }
    })

/** Signs in with a password and sets the session cookie on the app host. Yields the user id. */
export const signInLocalUser = (email: string, password: string) =>
  cy
    .env(['SUPABASE_ANON_KEY'])
    .then(({ SUPABASE_ANON_KEY }) =>
      cy.request({
        method: 'POST',
        url: `${supabaseUrl()}/auth/v1/token?grant_type=password`,
        headers: { apikey: SUPABASE_ANON_KEY ?? LOCAL_ANON_KEY },
        body: { email, password }
      })
    )
    .then(({ body }) => {
      const session = {
        ...body,
        expires_at: body.expires_at ?? Math.floor(Date.now() / 1000) + body.expires_in
      }
      const value = `base64-${stringToBase64URL(JSON.stringify(session))}`
      const domain = new URL(Cypress.config('baseUrl')!).hostname
      // Host-only, like the cookie @supabase/ssr writes, so its sign-out delete matches it.
      for (const chunk of createChunks(authCookieName(), value)) {
        cy.setCookie(chunk.name, chunk.value, {
          domain,
          hostOnly: true,
          path: '/',
          sameSite: 'lax'
        })
      }
      return cy.wrap<string>(body.user.id)
    })
