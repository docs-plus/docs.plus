import type { connectedPayload, Extension, onDisconnectPayload } from '@hocuspocus/server'

/** Hocuspocus's ConnectionTimeout code, which the webapp already treats as self-healing. */
const TOKEN_EXPIRED_CLOSE_CODE = 4408

// Guards an issuer whose token lifetime exceeds the setTimeout maximum. A longer delay
// overflows, fires at once and loops the reconnect. The Supabase CLI caps it at one week.
const MAX_TIMER_MS = 2 ** 31 - 1

interface TokenExpiryContext {
  tokenExp?: number
  tokenExpiryTimer?: ReturnType<typeof setTimeout>
}

export class TokenExpiryExtension implements Extension {
  // Close the socket, never connection.close(): that sends a document Close, and the
  // provider then keeps the socket open and never reconnects. A socket close makes it
  // reconnect with a fresh token, so onAuthenticate decides the identity again.
  async connected({ context, connection }: connectedPayload) {
    const ctx = context as TokenExpiryContext
    if (typeof ctx.tokenExp !== 'number') return

    const delay = Math.min(Math.max(0, ctx.tokenExp * 1000 - Date.now()), MAX_TIMER_MS)
    ctx.tokenExpiryTimer = setTimeout(() => {
      connection.webSocket.close(TOKEN_EXPIRED_CLOSE_CODE, 'Access token expired')
    }, delay)
  }

  async onDisconnect({ context }: onDisconnectPayload) {
    clearTimeout((context as TokenExpiryContext).tokenExpiryTimer)
  }
}

export default TokenExpiryExtension
