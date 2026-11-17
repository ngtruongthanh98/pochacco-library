// Phát tệp nghe đi kèm sách (giáo trình ngoại ngữ...).
// Có khóa Drive API và tệp chia sẻ công khai: phát thẳng bằng thẻ <audio>, tự chuyển bài.
// Không thì nhúng trình phát của Google Drive (dùng phiên đăng nhập Google của trình duyệt).
import { useEffect, useMemo, useRef, useState } from 'react'
import { driveMediaUrl } from '../data/configStore'
import type { AudioHolding, AudioTrack } from '../types/book'

const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`
const previewUrl = (id: string) => `https://drive.google.com/file/d/${id}/preview`

export default function AudioPanel({ holding, driveApiKey }: { holding: AudioHolding; driveApiKey?: string }) {
  const tracks = useMemo(() => (holding.tracks ?? []).filter((t) => t.fileId || t.url), [holding.tracks])
  const groups = useMemo(() => {
    const m = new Map<string, { t: AudioTrack; i: number }[]>()
    tracks.forEach((t, i) => m.set(t.group ?? '', [...(m.get(t.group ?? '') ?? []), { t, i }]))
    return [...m.entries()]
  }, [tracks])
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState<number | null>(null)
  const [embed, setEmbed] = useState(!driveApiKey)
  const audio = useRef<HTMLAudioElement>(null)
  const t = cur === null ? null : tracks[cur]
  const src = t ? (t.url ?? (t.fileId && driveApiKey && !embed ? driveMediaUrl(t.fileId, driveApiKey) : null)) : null

  useEffect(() => {
    if (src && audio.current) audio.current.play().catch(() => {})
  }, [src])

  const external = holding.folderId ? folderUrl(holding.folderId) : holding.url
  return (
    <div className="audio-panel">
      <div className="ebook-li">
        <span className="tag audio">File nghe</span> {holding.label ?? 'Tệp nghe kèm sách'}
        {tracks.length > 0 && `, ${tracks.length} bài`}
        {tracks.length > 0 && (
          <button className="open-drive" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'Thu gọn' : 'Nghe'}
          </button>
        )}
        {external && (
          <a className="drive-link" href={external} target="_blank" rel="noopener noreferrer">
            {holding.folderId ? 'Mở thư mục trên Drive' : 'Mở liên kết'}
          </a>
        )}
      </div>
      {open && (
        <div className="audio-body">
          {t && (
            <div className="audio-now">
              <div className="small">
                Đang nghe: <b>{[t.group, t.title].filter(Boolean).join(' · ')}</b>
              </div>
              {src ? (
                <audio
                  ref={audio}
                  src={src}
                  controls
                  preload="auto"
                  onEnded={() => cur !== null && cur + 1 < tracks.length && setCur(cur + 1)}
                  onError={() => setEmbed(true)}
                />
              ) : t.fileId ? (
                <iframe className="audio-embed" src={previewUrl(t.fileId)} title={t.title} allow="autoplay" />
              ) : null}
              <div className="audio-nav">
                <button className="link" disabled={!cur} onClick={() => setCur((cur ?? 1) - 1)}>‹ Bài trước</button>
                <button className="link" disabled={cur === null || cur + 1 >= tracks.length} onClick={() => setCur((cur ?? -1) + 1)}>Bài sau ›</button>
              </div>
              {embed && driveApiKey && (
                <p className="muted small">Tệp chưa chia sẻ công khai nên đang phát qua trình phát của Google Drive (cần đăng nhập tài khoản có quyền xem).</p>
              )}
            </div>
          )}
          {groups.map(([g, items]) => (
            <div key={g} className="audio-group">
              {g && <div className="audio-group-title">{g}</div>}
              <div className="audio-tracks">
                {items.map(({ t: x, i }) => (
                  <button key={i} className={`chip-btn${i === cur ? ' active' : ''}`} onClick={() => setCur(i)}>
                    {x.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
