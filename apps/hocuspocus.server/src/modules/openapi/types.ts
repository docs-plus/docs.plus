/**
 * Structural subset of OpenAPI 3.1 — only the keywords this module emits.
 * A full model is a day of yak-shaving that buys nothing the builder uses.
 */
export type JsonSchema = Record<string, unknown>

export interface SchemaRef {
  $ref: string
}

export interface OpenApiServer {
  url: string
  description?: string
}

export interface OpenApiParameter {
  name: string
  in: 'path' | 'query' | 'header'
  required?: boolean
  description?: string
  schema: JsonSchema
}

export interface OpenApiMediaType {
  schema: JsonSchema | SchemaRef
  example?: unknown
}

export interface OpenApiHeader {
  description?: string
  schema: JsonSchema
}

export interface OpenApiResponse {
  description: string
  headers?: Record<string, OpenApiHeader>
  content?: Record<string, OpenApiMediaType>
}

export interface OpenApiRequestBody {
  description?: string
  required?: boolean
  content: Record<string, OpenApiMediaType>
}

/** An empty object means "no credentials"; list it alongside a scheme for optional auth. */
export type SecurityRequirement = Record<string, string[]>

export interface OpenApiOperation {
  operationId: string
  summary: string
  description?: string
  tags: string[]
  security?: SecurityRequirement[]
  parameters?: OpenApiParameter[]
  requestBody?: OpenApiRequestBody
  responses: Record<string, OpenApiResponse | SchemaRef>
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

export type OpenApiPathItem = Partial<Record<HttpMethod, OpenApiOperation>>

export type OpenApiPaths = Record<string, OpenApiPathItem>

export interface OpenApiComponents {
  securitySchemes: Record<string, JsonSchema>
  schemas: Record<string, JsonSchema>
  responses: Record<string, OpenApiResponse>
}

export interface OpenApiDocument {
  openapi: '3.1.1'
  info: {
    title: string
    version: string
    description: string
    license?: { name: string; identifier?: string }
  }
  servers: OpenApiServer[]
  tags: Array<{ name: string; description: string }>
  paths: OpenApiPaths
  components: OpenApiComponents
}
