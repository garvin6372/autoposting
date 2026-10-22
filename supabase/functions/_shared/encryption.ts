// AES-256-GCM Encryption and Decryption using Web Crypto API

function getEncryptionKey(): string {
  const key = Deno.env.get('TOKEN_ENCRYPTION_KEY')
  if (!key) {
    throw new Error('Missing environment variable: TOKEN_ENCRYPTION_KEY')
  }
  return key
}

async function getKeyMaterial(keyString: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(keyString)
  // Use SHA-256 to ensure a consistent 256-bit key length
  const hash = await crypto.subtle.digest('SHA-256', keyData)
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes.buffer
}

export interface EncryptedData {
  encrypted: string
  iv: string
  tag: string
}

export async function encrypt(plaintext: string): Promise<EncryptedData> {
  const keyString = getEncryptionKey()
  const key = await getKeyMaterial(keyString)
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV standard for GCM
  const encodedText = new TextEncoder().encode(plaintext)

  // In Web Crypto AES-GCM, the 16-byte authentication tag is automatically appended to the ciphertext
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    encodedText
  )

  const cipherBytes = new Uint8Array(cipherBuffer)
  // Separate ciphertext and 16-byte authentication tag
  const tagBytes = cipherBytes.slice(cipherBytes.length - 16)
  const dataBytes = cipherBytes.slice(0, cipherBytes.length - 16)

  return {
    encrypted: arrayBufferToHex(dataBytes.buffer),
    iv: arrayBufferToHex(iv.buffer),
    tag: arrayBufferToHex(tagBytes.buffer),
  }
}

export async function decrypt(data: EncryptedData): Promise<string> {
  const keyString = getEncryptionKey()
  const key = await getKeyMaterial(keyString)
  const ivBuffer = hexToArrayBuffer(data.iv)
  const dataBytes = new Uint8Array(hexToArrayBuffer(data.encrypted))
  const tagBytes = new Uint8Array(hexToArrayBuffer(data.tag))

  // Recombine ciphertext and tag for Web Crypto subtle.decrypt
  const combined = new Uint8Array(dataBytes.length + tagBytes.length)
  combined.set(dataBytes, 0)
  combined.set(tagBytes, dataBytes.length)

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer), tagLength: 128 },
    key,
    combined
  )

  return new TextDecoder().decode(decryptedBuffer)
}

export function packEncrypted(data: EncryptedData): string {
  return `${data.iv}:${data.tag}:${data.encrypted}`
}

export async function decryptPacked(
  packedOrCipher: string,
  fallbackIv?: string,
  fallbackTag?: string
): Promise<string> {
  if (packedOrCipher.includes(':')) {
    const [iv, tag, encrypted] = packedOrCipher.split(':')
    return decrypt({ iv, tag, encrypted })
  }
  return decrypt({
    encrypted: packedOrCipher,
    iv: fallbackIv || '',
    tag: fallbackTag || '',
  })
}

// Self-test helper function
export async function testEncryption(): Promise<boolean> {
  const sample = 'test-token-value-' + Date.now()
  const encrypted = await encrypt(sample)
  const decrypted = await decrypt(encrypted)
  return sample === decrypted
}
