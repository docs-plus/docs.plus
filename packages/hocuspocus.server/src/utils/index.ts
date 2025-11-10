export const checkEnvBolean = (value: string | undefined): boolean => {
  if (!value) return false
  return value.toLowerCase() === 'true' || value === '1'
}

export const generateRandomId = (length = 19): string => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export { verifyJWT, decodeJWT, extractUserFromToken } from './jwt'
