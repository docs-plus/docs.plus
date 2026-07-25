import type { MiddlewareHandler } from 'hono'

/**
 * Maintainer decision: Swagger UI is loaded from jsDelivr because bundling it
 * would mean a new dependency. Pinned to an exact version with SRI hashes taken
 * from those exact bytes — bump the version and the hashes together or the page
 * silently stops rendering.
 */
const SWAGGER_UI_VERSION = '5.32.11'
const CDN_ORIGIN = 'https://cdn.jsdelivr.net'
const CDN_BASE = `${CDN_ORIGIN}/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`

const CSS_URL = `${CDN_BASE}/swagger-ui.css`
const CSS_INTEGRITY = 'sha384-9Q2fpS+xeS4ffJy6CagnwoUl+4ldAYhOs9pgZuEKxypVModhmZFzeMlvVsAjf7uT'
const BUNDLE_URL = `${CDN_BASE}/swagger-ui-bundle.js`
const BUNDLE_INTEGRITY = 'sha384-vfl/klfTFrIz5urj0HnhcXLAbzPdRHezizfy+XgFB6GqcKkhlk0lS3bIbyB39NLA'

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${CDN_ORIGIN}`,
  `style-src 'self' 'unsafe-inline' ${CDN_ORIGIN}`,
  "img-src 'self' data: https:",
  `font-src 'self' data: ${CDN_ORIGIN}`,
  // Try-it-out targets whatever `servers` entry is selected, which need not be
  // this origin; 'self' alone also makes DevTools' sourcemap fetch log an error.
  "connect-src 'self' https:",
  "base-uri 'self'",
  "frame-ancestors 'none'"
].join('; ')

/**
 * `secureHeaders` rewrites the CSP *after* `next()`, so only a middleware
 * registered above `setupMiddleware(app)` can widen it for this one page.
 * Path-scoped, so no other route loses the strict policy.
 */
export const swaggerUiCsp: MiddlewareHandler = async (c, next) => {
  await next()
  c.header('Content-Security-Policy', CSP)
}

export const renderSwaggerUiPage = (specUrl: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>docs.plus Backend API</title>
    <link rel="stylesheet" href="${CSS_URL}" integrity="${CSS_INTEGRITY}" crossorigin="anonymous" />
    <style>
      body { margin: 0; background: #fafafa; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${BUNDLE_URL}" integrity="${BUNDLE_INTEGRITY}" crossorigin="anonymous"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(specUrl)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
        docExpansion: 'none',
        tryItOutEnabled: true
      })
    </script>
  </body>
</html>
`
