// Ghi chú và lựa chọn trang Wikipedia cho từng người, lưu ở config/people.json trong repo dữ liệu.
import { readConfigFile, writeConfigFile } from './configStore'
import type { StoreConfig } from './githubStore'

export type PersonNote = {
  /** Mã Wikidata đã chọn; null là "không tra cứu người này" */
  qid?: string | null
  note?: string
  updatedAt: string
}
export type PeopleFile = { v: 1; people: Record<string, PersonNote> }

export async function loadPeople(cfg: StoreConfig): Promise<{ sha: string | null; people: Record<string, PersonNote> }> {
  const r = await readConfigFile<PeopleFile>(cfg, 'people')
  return { sha: r?.sha ?? null, people: r?.data?.people && typeof r.data.people === 'object' ? r.data.people : {} }
}

export async function savePeople(cfg: StoreConfig, people: Record<string, PersonNote>, sha: string | null, message: string): Promise<string> {
  const data: PeopleFile = { v: 1, people }
  try {
    return await writeConfigFile(cfg, 'people', data, sha, message)
  } catch {
    const r = await readConfigFile<PeopleFile>(cfg, 'people')
    return writeConfigFile(cfg, 'people', data, r?.sha ?? null, message)
  }
}
