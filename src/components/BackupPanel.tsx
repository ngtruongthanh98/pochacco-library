import { useEffect, useState } from 'react'
import {
  booksToCsv, buildBackup, diffBackup, downloadBytes, libraryXlsx, listCloudBackups, readBackup, stamp,
} from '../data/backup'
import { saveExcerpts } from '../data/excerptStore'
import { saveBatch, type StoreConfig } from '../data/githubStore'
import type { Book } from '../types/book'
import type { Excerpt } from '../types/excerpt'

export const LAST_BACKUP_KEY = 'pochacco-library:last-backup'
const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`)
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })

/** Tải bản sao lưu nén về máy (dùng ở cả trang Cài đặt và lời nhắc hằng tuần). */
export async function downloadBackup(cfg: StoreConfig, covers: boolean, progress?: (m: string) => void) {
  const { zip, manifest } = await buildBackup(cfg, { covers }, progress)
  downloadBytes(zip, `thu-vien-sao-luu-${stamp()}.zip`, 'application/zip')
  localStorage.setItem(LAST_BACKUP_KEY, manifest.createdAt)
  return manifest
}

type Restore = {
  name: string
  createdAt?: string
  books: Book[]
  excerpts: Excerpt[]
  diff: ReturnType<typeof diffBackup>
}

/** Mục Sao lưu và xuất dữ liệu trong trang Cài đặt. */
export default function BackupPanel({
  cfg,
  books,
  excerpts,
  onRestored,
}: {
  cfg: StoreConfig
  books: Book[]
  excerpts: Excerpt[]
  onRestored: () => void
}) {
  const [covers, setCovers] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [last, setLast] = useState(() => localStorage.getItem(LAST_BACKUP_KEY))
  const [cloud, setCloud] = useState<{ name: string; date: string; url: string; size: number }[] | null>(null)
  const [restore, setRestore] = useState<Restore | null>(null)
  const [opt, setOpt] = useState({ missing: true, changed: false, excerpts: true })

  useEffect(() => {
    listCloudBackups(cfg).then(setCloud).catch(() => setCloud([]))
  }, [cfg])

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const backupNow = () =>
    run('Đang chuẩn bị bản sao lưu…', async () => {
      const m = await downloadBackup(cfg, covers, (t) => setBusy(t))
      setLast(m.createdAt)
      setMsg({ ok: true, text: `Đã tải bản sao lưu: ${m.books} sách, ${m.excerpts} trích dẫn${m.covers ? `, ${m.covers} ảnh bìa` : ''}.` })
    })

  const pickFile = async (f: File) => {
    setMsg(null)
    setRestore(null)
    try {
      const data = readBackup(f.name, new Uint8Array(await f.arrayBuffer()))
      const diff = diffBackup(books, data.books, excerpts, data.excerpts)
      setRestore({ name: f.name, ...data, diff })
      setOpt({ missing: true, changed: false, excerpts: true })
    } catch (e) {
      setMsg({ ok: false, text: `Không đọc được tệp: ${(e as Error).message}` })
    }
  }

  const doRestore = () =>
    run('Đang khôi phục…', async () => {
      const r = restore!
      const adds = opt.missing ? r.diff.missing : []
      const updates = opt.changed ? r.diff.changed : []
      if (adds.length || updates.length) await saveBatch(cfg, adds, updates, `Khôi phục từ bản sao lưu ${r.createdAt ? stamp(new Date(r.createdAt)) : r.name}: thêm lại ${adds.length}, đưa về ${updates.length}`)
      if (opt.excerpts && r.diff.missingEx.length) await saveExcerpts(cfg, { upserts: r.diff.missingEx }, `Khôi phục ${r.diff.missingEx.length} trích dẫn`)
      setMsg({ ok: true, text: `Đã khôi phục: thêm lại ${adds.length} cuốn, đưa về ${updates.length} cuốn${opt.excerpts ? `, ${r.diff.missingEx.length} trích dẫn` : ''}.` })
      setRestore(null)
      onRestored()
    })

  const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000) : null
  return (
    <section className="card backup">
      <h2>Sao lưu và xuất dữ liệu</h2>

      <div className="backup-block">
        <h3>Xuất danh mục</h3>
        <p className="muted small">Toàn bộ {books.length} cuốn (và {excerpts.length} trích dẫn ở trang thứ hai của tệp Excel), mỗi cuốn một dòng, đủ các cột thông tin.</p>
        <div className="backup-actions">
          <button onClick={() => downloadBytes(libraryXlsx(books, excerpts), `thu-vien-${stamp()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}>Tải tệp Excel (.xlsx)</button>
          <button className="secondary" onClick={() => downloadBytes(booksToCsv(books), `thu-vien-${stamp()}.csv`, 'text/csv;charset=utf-8')}>
            Tải tệp CSV
          </button>
        </div>
      </div>

      <div className="backup-block">
        <h3>Sao lưu về máy</h3>
        <p className="muted small">
          Một tệp .zip chứa toàn bộ dữ liệu: danh mục sách, trích dẫn, cấu hình (phân loại, danh mục tài liệu, trò chơi…), giữ nguyên cấu trúc thư mục của repo. Dùng để khôi phục khi lỡ xóa nhầm, hoặc tạo lại repo nếu repo gặp sự cố.
        </p>
        <p className={`backup-last ${days === null || days >= 7 ? 'due' : ''}`}>
          {last ? `Lần tải về máy gần nhất: ${fmtDay(last)}${days ? ` (${days} ngày trước)` : ' (hôm nay)'}` : 'Chưa tải bản sao lưu nào về máy này.'}
        </p>
        <label className="check">
          <input type="checkbox" checked={covers} onChange={(e) => setCovers(e.target.checked)} /> Kèm ảnh bìa đã tải lên (tệp lớn hơn, lâu hơn)
        </label>
        <div className="backup-actions">
          <button onClick={backupNow} disabled={!!busy}>
            Tải bản sao lưu (.zip)
          </button>
        </div>
      </div>

      <div className="backup-block">
        <h3>Sao lưu tự động hằng tuần</h3>
        <p className="muted small">
          Mỗi Chủ nhật, repo dữ liệu tự nén toàn bộ dữ liệu thành một bản phát hành (GitHub Release) có tên <code>backup-năm-tháng-ngày</code>, giữ 12 bản gần nhất. Các bản này nằm tách khỏi lịch sử tệp nên không mất khi lỡ xóa hay ghi đè dữ liệu.
        </p>
        {cloud === null ? (
          <p className="muted small">Đang xem các bản sao lưu…</p>
        ) : cloud.length ? (
          <ul className="backup-cloud">
            {cloud.map((c) => (
              <li key={c.url}>
                <span>
                  {fmtDay(c.date)} · {fmtSize(c.size)}
                </span>
                <a href={c.url} target="_blank" rel="noopener noreferrer">
                  Mở trên GitHub để tải
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Chưa có bản sao lưu tự động nào. Bản đầu tiên sẽ được tạo vào Chủ nhật tới (hoặc chạy tay trong mục Actions của repo dữ liệu).</p>
        )}
      </div>

      <div className="backup-block">
        <h3>Khôi phục từ bản sao lưu</h3>
        <p className="muted small">Chọn tệp .zip đã tải về (từ nút trên, hoặc từ bản sao lưu tự động trên GitHub). App sẽ so sánh với dữ liệu hiện tại và hỏi trước khi ghi. Khôi phục không xóa những cuốn anh thêm sau bản sao lưu.</p>
        <input type="file" accept=".zip,.json" onChange={(e) => e.target.files?.[0] && void pickFile(e.target.files[0])} />
        {restore && (
          <div className="backup-restore">
            <b>
              Bản sao lưu {restore.createdAt ? fmtDay(restore.createdAt) : restore.name}: {restore.books.length} sách, {restore.excerpts.length} trích dẫn
            </b>
            <label className="check">
              <input type="checkbox" checked={opt.missing} onChange={(e) => setOpt({ ...opt, missing: e.target.checked })} disabled={!restore.diff.missing.length} /> Thêm lại {restore.diff.missing.length} cuốn hiện không còn trong thư viện
            </label>
            {restore.diff.missing.length > 0 && (
              <p className="muted small backup-titles">{restore.diff.missing.slice(0, 8).map((b) => b.title).join('; ')}{restore.diff.missing.length > 8 ? '…' : ''}</p>
            )}
            <label className="check">
              <input type="checkbox" checked={opt.changed} onChange={(e) => setOpt({ ...opt, changed: e.target.checked })} disabled={!restore.diff.changed.length} /> Đưa {restore.diff.changed.length} cuốn đã sửa về đúng như trong bản sao lưu (mất các chỉnh sửa sau đó)
            </label>
            <label className="check">
              <input type="checkbox" checked={opt.excerpts} onChange={(e) => setOpt({ ...opt, excerpts: e.target.checked })} disabled={!restore.diff.missingEx.length} /> Thêm lại {restore.diff.missingEx.length} trích dẫn đã mất
            </label>
            {restore.diff.newer.length > 0 && <p className="muted small">{restore.diff.newer.length} cuốn thêm sau bản sao lưu sẽ được giữ nguyên.</p>}
            <div className="backup-actions">
              <button
                onClick={doRestore}
                disabled={!!busy || !((opt.missing && restore.diff.missing.length) || (opt.changed && restore.diff.changed.length) || (opt.excerpts && restore.diff.missingEx.length))}
              >
                Khôi phục
              </button>
              <button className="secondary" onClick={() => setRestore(null)}>
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>

      {busy && <p className="backup-busy">{busy}</p>}
      {msg && <p className={msg.ok ? 'ok-text' : 'error'}>{msg.text}</p>}
    </section>
  )
}
