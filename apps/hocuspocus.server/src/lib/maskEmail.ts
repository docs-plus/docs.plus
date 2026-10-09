/** Same output as SQL `internal.mask_email`: `john.doe@example.com` becomes `j***@example.com`. */
export function maskEmail(address: string | null | undefined): string {
  if (!address) return ''
  const at = address.indexOf('@')
  if (at === -1) return '***'
  // split_part(p_email, '@', 2): the text between the first and the second '@'.
  const domain = address.slice(at + 1).split('@')[0]
  return `${address.slice(0, Math.min(1, at))}***@${domain}`
}

const ADDRESS_IN_TEXT = /[^\s<>"'`,;:()[\]]+@[^\s<>"'`,;:()[\]]+/g

/** Provider error text can quote a recipient, and logs and DLQ entries must never hold one. */
export const maskEmailsIn = (text: string): string => text.replace(ADDRESS_IN_TEXT, maskEmail)
