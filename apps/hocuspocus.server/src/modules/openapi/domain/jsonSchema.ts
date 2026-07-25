import { z } from 'zod'

import type { JsonSchema, OpenApiParameter } from '../types'

/**
 * `io: 'input'` is the request view: fields with a `.default()` stay optional and
 * no `additionalProperties: false` is stamped on. `unrepresentable: 'any'` keeps a
 * future `z.custom()` from crashing the REST server at boot over a docs page.
 */
export const toJsonSchema = (schema: z.ZodType): JsonSchema => {
  const { $schema: _unused, ...rest } = z.toJSONSchema(schema, {
    io: 'input',
    unrepresentable: 'any'
  }) as JsonSchema & { $schema?: string }
  return rest
}

/** Zod hands back one object schema; OpenAPI wants one entry per key. */
export const toParameters = (
  schema: z.ZodType,
  location: 'query' | 'path',
  descriptions: Record<string, string> = {}
): OpenApiParameter[] => {
  const root = toJsonSchema(schema)
  const properties = (root.properties ?? {}) as Record<string, JsonSchema>
  const required = new Set((root.required as string[] | undefined) ?? [])

  return Object.entries(properties).map(([name, propertySchema]) => {
    const description = descriptions[name]
    return {
      name,
      in: location,
      required: location === 'path' || required.has(name),
      ...(description ? { description } : {}),
      schema: propertySchema
    }
  })
}

export const pathParam = (
  name: string,
  description: string,
  schema: JsonSchema = { type: 'string' }
): OpenApiParameter => ({ name, in: 'path', required: true, description, schema })

/** The `{ success: true, data }` shape the documents controller emits. */
export const dataEnvelope = (data: JsonSchema): JsonSchema => ({
  type: 'object',
  properties: { success: { type: 'boolean', const: true }, data },
  required: ['success', 'data']
})
