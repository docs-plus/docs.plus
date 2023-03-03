export const checkEnvBolean = (env) => env.toLowerCase() === 'true'
export const checkEnvNull = (env) => env.toLowerCase() === 'null' || env.length === 0 ? false : env

export class NError extends Error {
  constructor (obj = { code: 'Unknown', detail: {}, error: null }, ...params) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(...params)

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NError)
    }
    this.name = 'NError'
    // Custom debugging information
    this.data = obj
    this.code = obj.code
    this.date = new Date()
  }
}

/**
 *
 * @param {*} array
 * @param {*} pageSize @description offset
 * @param {*} page_number @description limit
 */
export const queryStringPagination = (array, { queryString, pageSize = 10, pageNumber = 0 }) => {
  const { options } = q2m(queryString)

  if (options.hasOwnProperty('limit') && options.skip) { pageNumber = options.skip }

  if (options.hasOwnProperty('skip') && options.limit) { pageSize = options.limit }

  return {
    Total: array.length,
    Result: array.slice(pageNumber * pageSize, pageNumber * pageSize + pageSize)
  }
}
