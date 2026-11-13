import { useMemo, useState } from 'react'
import { FIELD_LABEL, parseBookText, type Parsed } from '../data/pasteParse'
import { foldVi } from '../search/normalizeVi'
import type { Option } from './Suggest'

type Key = keyof Parsed
export type PastePatch = Partial<Record<Key, string>>

const ORDER: Key[] = ['title', 'authors', 'translators', 'editors', 'publisher', 'partner', 'place', 'year', 'pages', 'sizeCm', 'isbn', 'language', 'description']
const LANG_LABEL: Record<string, string> = { vi: 'Tiếng Việt', en: 'Tiếng Anh', fr: 'Tiếng Pháp', zh: 'Tiếng Trung', ja: 'Tiếng Nhật', ko: 'Tiếng Hàn', de: 'Tiếng Đức', ru: 'Tiếng Nga' }

/**
 * Tra trên các trang sách Việt Nam rồi dán phần "Thông tin chi tiết" vào đây: ứng dụng tách ra từng ô,
 * bạn chọn mục nào điền. Không tự lấy từ trang (các trang này chặn truy cập tự động), nên thông tin là đúng
 * những gì bạn thấy và đã chép.
 */
export function PasteInfo({
  query,
  isbn,
  current,
  publishers,
  onApply,
  onClose,
}: {
  query: string
  isbn: string
  current: Record<Key, string>
  publishers: Option[]
  onApply: (patch: PastePatch, source: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [picked, setPicked] = useState<Partial<Record<Key, boolean>>>({})
  const [copied, setCopied] = useState(false)

  const parsed = useMemo(() => parseBookText(text), [text])
  // Dùng lại cách viết NXB đã có trong thư viện ("NXB Tôn giáo" thay vì "NXB Tôn Giáo") để khỏi tách đôi.
  const values = useMemo(() => {
    const v: PastePatch = {}
    for (const k of ORDER) {
      const x = parsed[k]
      if (!x || (Array.isArray(x) && !x.length)) continue
      v[k] = Array.isArray(x) ? x.join('\n') : x
    }
    if (v.publisher) v.publisher = publishers.find((o) => foldVi(o.value) === foldVi(v.publisher!))?.value ?? v.publisher
    return v
  }, [parsed, publishers])
  const keys = ORDER.filter((k) => values[k])
  const isOn = (k: Key) => picked[k] ?? !current[k]?.trim()
  const same = (k: Key) => foldVi(current[k] ?? '') === foldVi(values[k] ?? '')

  const q = encodeURIComponent(query)
  const links = [
    { label: 'Fahasa', href: `https://www.fahasa.com/searchengine?q=${q}` },
    { label: 'Tiki', href: `https://tiki.vn/search?q=${q}` },
    { label: 'Google', href: `https://www.google.com/search?q=${encodeURIComponent(isbn ? `"${isbn}"` : `${query} nhà xuất bản`)}` },
  ]

  return (
    <div className="paste-info">
      <div className="paste-head">
        <b>Lấy thông tin từ trang sách Việt Nam</b>
        <button type="button" className="link" onClick={onClose}>
          Đóng
        </button>
      </div>
      <ol className="paste-steps">
        <li>
          Mở trang tìm:{' '}
          {links.map((l, i) => (
            <span key={l.label}>
              {i > 0 && ' · '}
              <a href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
            </span>
          ))}
          {' · '}
          <a
            href="https://ppdvn.gov.vn/web/guest/ke-hoach-xuat-ban"
            target="_blank"
            rel="noopener noreferrer"
            title="Dữ liệu đăng ký xuất bản của Cục Xuất bản, In và Phát hành: ISBN, tác giả, dịch giả, đối tác liên kết"
            onClick={() => {
              if (isbn) void navigator.clipboard?.writeText(isbn).then(() => setCopied(true), () => undefined)
            }}
          >
            Cục Xuất bản
          </a>
          {copied && <span className="muted small"> (đã chép ISBN, dán vào ô tìm của trang)</span>}
          <span className="muted small"> · tìm theo: {query || 'nhập nhan đề hoặc ISBN trước'}</span>
        </li>
        <li>Mở đúng cuốn, bôi đen phần “Thông tin chi tiết” (cả phần giới thiệu nếu muốn) rồi chép.</li>
        <li>Dán vào ô dưới. Cũng dán được dòng kết quả của Cục Xuất bản, hoặc chữ trên trang thông tin xuất bản cuối sách.</li>
      </ol>
      <textarea
        rows={5}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setPicked({})
        }}
        placeholder={'Tác giả\tYuval Noah Harari\nNgười Dịch\tNguyễn Thủy Chung\nNXB\tNXB Thế Giới\nNăm XB\t2021\nSố trang\t556\n…'}
      />
      <label>
        Link trang đã chép (để đối chiếu sau, sẽ ghi vào ghi chú)
        <input type="url" value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://www.fahasa.com/…" />
      </label>

      {text.trim() && !keys.length && <p className="muted small">Chưa nhận ra thông tin nào. Hãy chép cả nhãn (như “NXB”, “Số trang”) cùng giá trị.</p>}
      {keys.length > 0 && (
        <>
          <table className="paste-table">
            <thead>
              <tr>
                <th />
                <th>Mục</th>
                <th>Đọc được</th>
                <th>Đang có</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k} className={same(k) ? 'same' : current[k]?.trim() ? 'differs' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isOn(k) && !same(k)}
                      disabled={same(k)}
                      onChange={(e) => setPicked((p) => ({ ...p, [k]: e.target.checked }))}
                      aria-label={`Điền ${FIELD_LABEL[k]}`}
                    />
                  </td>
                  <td>{FIELD_LABEL[k]}</td>
                  <td className="val">{k === 'language' ? LANG_LABEL[values[k]!] ?? values[k] : k === 'description' ? `${values[k]!.slice(0, 160)}${values[k]!.length > 160 ? '…' : ''}` : values[k]}</td>
                  <td className="cur">
                    {same(k) ? 'giống' : current[k]?.trim() ? (k === 'description' ? 'đã có mô tả' : current[k]) : <span className="muted">trống</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Mặc định chỉ điền ô đang trống. Ô đã có giá trị khác được tô vàng; tích vào nếu muốn thay.</p>
          <div className="actions">
            <button
              type="button"
              disabled={!keys.some((k) => isOn(k) && !same(k))}
              onClick={() => {
                const patch: PastePatch = {}
                for (const k of keys) if (isOn(k) && !same(k)) patch[k] = values[k]
                onApply(patch, source.trim())
                setText('')
                setPicked({})
              }}
            >
              Điền {keys.filter((k) => isOn(k) && !same(k)).length} mục đã chọn
            </button>
          </div>
        </>
      )}
    </div>
  )
}
