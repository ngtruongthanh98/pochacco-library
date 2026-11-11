// ULID: 48 bit thời gian + 80 bit ngẫu nhiên, mã Crockford Base32 (26 ký tự, sắp xếp được theo thời gian).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const ulid = (now = Date.now()): string => {
  let time = ''
  let t = now
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time
    t = Math.floor(t / 32)
  }
  const rand = crypto.getRandomValues(new Uint8Array(16))
  let r = ''
  for (let i = 0; i < 16; i++) r += ALPHABET[rand[i] % 32]
  return time + r
}
