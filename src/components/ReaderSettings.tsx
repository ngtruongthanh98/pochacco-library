import { useState } from 'react'
import { testDriveKey, writeConfigFile, type ReaderConfig } from '../data/configStore'
import type { StoreConfig } from '../data/githubStore'
import type { Book } from '../types/book'

export function ReaderSettings({
  cfg,
  books,
  config,
  sha,
  onSaved,
}: {
  cfg: StoreConfig
  books: Book[]
  config: ReaderConfig
  sha: string | null
  onSaved: (c: ReaderConfig, sha: string) => void
}) {
  const [key, setKey] = useState(config.driveApiKey ?? '')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const sample = books.flatMap((b) => b.holdings.map((h) => ({ b, h }))).find((x) => x.h.kind === 'ebook' && x.h.fileId)
  const changed = key.trim() !== (config.driveApiKey ?? '')

  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const k = key.trim()
      let warn = ''
      if (k && sample?.h.kind === 'ebook') {
        // Thử đọc thông tin một tệp có thật để bắt lỗi khóa ngay khi lưu.
        try {
          await testDriveKey(k, sample.h.fileId!)
        } catch (e) {
          const m = (e as Error).message
          // Khóa đúng nhưng tệp thử chưa chia sẻ công khai: vẫn lưu, chỉ nhắc.
          if (!m.includes('chia sẻ')) throw e
          warn = ` Lưu ý: tệp “${sample.b.title}” chưa chia sẻ bằng đường liên kết nên chưa đọc được.`
        }
      }
      const next: ReaderConfig = k ? { driveApiKey: k } : {}
      const newSha = await writeConfigFile(cfg, 'reader', next, sha, k ? 'Cập nhật khóa Google Drive API cho trình đọc' : 'Gỡ khóa Google Drive API')
      onSaved(next, newSha)
      setMsg({ ok: true, text: k ? (warn ? `Đã lưu khóa.${warn}` : sample ? `Đã lưu. Khóa đọc được tệp “${sample.b.title}”.` : 'Đã lưu khóa.') : 'Đã gỡ khóa. Trình đọc quay về dùng Google Drive.' })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card settings">
      <h3>Đọc sách điện tử</h3>
      <p className="muted">
        Trình xem của Google Drive không mở được tệp quá lớn (“Tệp này quá lớn không thể xem trước”). Khi có khóa Google Drive API, ứng dụng dùng trình đọc PDF riêng: tải dần từng
        trang nên mở được tệp vài trăm MB, bôi đen chữ để ghi trích dẫn kèm số trang. Tệp vẫn cần chia sẻ ở chế độ “Bất kỳ ai có đường liên kết”.
      </p>
      <label className="api-key">
        Khóa Google Drive API
        <div className="api-key-row">
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="secondary" onClick={() => setShow(!show)}>
            {show ? 'Ẩn' : 'Hiện'}
          </button>
          <button type="button" onClick={() => void save()} disabled={busy || !changed}>
            {busy ? 'Đang kiểm tra…' : 'Lưu'}
          </button>
        </div>
      </label>
      {msg && <p className={msg.ok ? 'ok-text' : 'error'}>{msg.text}</p>}
      <details className="howto">
        <summary>Cách tạo khóa (miễn phí, khoảng 5 phút)</summary>
        <ol>
          <li>
            Vào{' '}
            <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener noreferrer">
              Google Cloud Console → Google Drive API
            </a>
            , tạo một dự án mới nếu được hỏi, rồi bấm <b>Enable</b>.
          </li>
          <li>
            Vào{' '}
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
              APIs &amp; Services → Credentials
            </a>
            , chọn <b>Create credentials → API key</b>.
          </li>
          <li>
            Bấm vào khóa vừa tạo để giới hạn: <b>Application restrictions</b> chọn <i>Websites</i>, thêm <code>{location.origin}/*</code>; <b>API restrictions</b> chọn{' '}
            <i>Restrict key</i> và tích <i>Google Drive API</i>. Bấm Save.
          </li>
          <li>Chép khóa (bắt đầu bằng AIza) dán vào ô trên rồi bấm Lưu.</li>
        </ol>
        <p className="muted small">
          Khóa được lưu trong repo dữ liệu riêng tư của bạn. Nhờ hai giới hạn ở bước 3, khóa chỉ dùng được trên trang này và chỉ đọc được những tệp bạn đã chia sẻ bằng đường liên
          kết, không truy cập được phần còn lại của Drive.
        </p>
      </details>
    </section>
  )
}
