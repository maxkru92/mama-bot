const encoder = new TextEncoder()

function hexToArrayBuffer(value: string): ArrayBuffer | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null
  const buffer = new ArrayBuffer(32)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }
  return buffer
}

export async function verifyMetaSignature(
  body: ArrayBuffer,
  header: string | null,
  secret: string
): Promise<boolean> {
  if (!header?.startsWith('sha256=') || !secret) return false
  const expected = hexToArrayBuffer(header.slice('sha256='.length))
  if (!expected) return false
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  return crypto.subtle.verify('HMAC', key, expected, body)
}
