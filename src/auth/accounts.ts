import type { StoreConfig } from '../data/githubStore'
import { seal, unseal, type Sealed } from './crypto'

export type AccountFile = { version: 1; accounts: Record<string, Sealed> }

const ACCOUNTS_URL = `${import.meta.env.BASE_URL}accounts.json`

export const normalizeUsername = (u: string) => u.trim().toLowerCase()

export const isValidUsername = (u: string) => /^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizeUsername(u))

export const loadAccounts = async (): Promise<AccountFile> => {
  try {
    const res = await fetch(ACCOUNTS_URL, { cache: 'no-store' })
    if (!res.ok) return { version: 1, accounts: {} }
    return (await res.json()) as AccountFile
  } catch {
    return { version: 1, accounts: {} }
  }
}

export class LoginError extends Error {}

export const login = async (username: string, password: string): Promise<StoreConfig> => {
  const name = normalizeUsername(username)
  const file = await loadAccounts()
  const sealed = file.accounts[name]
  // Cùng một thông báo cho "không có tài khoản" và "sai mật khẩu".
  if (!sealed) throw new LoginError('Sai tên đăng nhập hoặc mật khẩu.')
  try {
    return await unseal<StoreConfig>(sealed, password, `pochacco-library:${name}`)
  } catch {
    throw new LoginError('Sai tên đăng nhập hoặc mật khẩu.')
  }
}

/** Tạo (hoặc thay) một tài khoản, trả về toàn bộ tệp accounts.json mới để đưa lên repo. */
export const buildAccountFile = async (
  username: string,
  password: string,
  cfg: StoreConfig,
): Promise<AccountFile> => {
  const name = normalizeUsername(username)
  const file = await loadAccounts()
  const sealed = await seal(cfg, password, `pochacco-library:${name}`)
  return { version: 1, accounts: { ...file.accounts, [name]: sealed } }
}
