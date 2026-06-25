const PROTOCOL_WHITELIST = ['http:', 'https:']

export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url, window.location.origin)
    if (!PROTOCOL_WHITELIST.includes(parsed.protocol)) return null
    return parsed.href
  } catch {
    return null
  }
}

export function sanitizeText(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function sanitizeNumeric(value) {
  const num = parseInt(String(value).replace(/\D/g, ''), 10)
  return isNaN(num) ? 0 : num
}
