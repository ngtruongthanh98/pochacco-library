// Danh mục tài liệu tham khảo theo từng bài viết, lưu ở config/reflists.json trong repo dữ liệu.
import { readConfigFile, writeConfigFile } from './configStore'
import type { StoreConfig } from './githubStore'
import type { StyleId } from './references'

export type RefList = {
  id: string
  name: string
  style: StyleId
  numbered: boolean
  books: string[]
  note?: string
  createdAt: string
  updatedAt: string
}
type FileShape = { v: 1; lists: RefList[] }

const FILE = 'reflists'

export async function loadRefLists(cfg: StoreConfig): Promise<{ sha: string | null; lists: RefList[] }> {
  const r = await readConfigFile<FileShape>(cfg, FILE)
  const lists = r && Array.isArray(r.data?.lists) ? r.data.lists.filter((l) => l && l.id && Array.isArray(l.books)) : []
  return { sha: r?.sha ?? null, lists }
}

/** Ghi cả tệp; nếu sha cũ (lưu từ máy khác) thì đọc sha mới rồi ghi lại một lần. */
export async function saveRefLists(cfg: StoreConfig, lists: RefList[], sha: string | null, message: string): Promise<string> {
  const data: FileShape = { v: 1, lists }
  try {
    return await writeConfigFile(cfg, FILE, data, sha, message)
  } catch {
    const r = await readConfigFile<FileShape>(cfg, FILE)
    return writeConfigFile(cfg, FILE, data, r?.sha ?? null, message)
  }
}

export const newListId = () => `dm-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
