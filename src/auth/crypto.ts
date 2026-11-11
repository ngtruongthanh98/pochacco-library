// Mã hóa bí mật (token GitHub) bằng mật khẩu, chạy hoàn toàn trong trình duyệt bằng Web Crypto.
// Khóa: PBKDF2-SHA256 (600.000 vòng) từ mật khẩu + salt ngẫu nhiên. Mã hóa: AES-256-GCM.
// Tên đăng nhập được gắn làm dữ liệu xác thực bổ sung (AAD), nên không thể đem bản mã của
// tài khoản này gán sang tên khác.

export type Sealed = {
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  iv: string
  data: string
}

export const ITERATIONS = 600_000

const enc = new TextEncoder()
const dec = new TextDecoder()

const toB64 = (bytes: Uint8Array) => {
  let s = ''
  bytes.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s)
}
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

const deriveKey = async (password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) => {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const seal = async (value: unknown, password: string, context: string): Promise<Sealed> => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, ITERATIONS)
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(context) },
    key,
    enc.encode(JSON.stringify(value)),
  )
  return {
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(new Uint8Array(data)),
  }
}

/** Ném lỗi nếu sai mật khẩu (AES-GCM không xác thực được bản mã). */
export const unseal = async <T,>(sealed: Sealed, password: string, context: string): Promise<T> => {
  const key = await deriveKey(password, fromB64(sealed.salt), sealed.iterations)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(sealed.iv), additionalData: enc.encode(context) },
    key,
    fromB64(sealed.data),
  )
  return JSON.parse(dec.decode(plain)) as T
}
