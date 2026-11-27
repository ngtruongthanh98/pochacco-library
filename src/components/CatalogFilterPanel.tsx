import { useState } from 'react'
import { CATALOG_FILTERS, type CatalogFilters, type catalogFacets } from '../search/catalogFilters'
import { foldVi } from '../search/normalizeVi'

export function MetadataFilters({ facets, filters, onChange }: {
  facets: ReturnType<typeof catalogFacets>
  filters: CatalogFilters
  onChange: (next: CatalogFilters) => void
}) {
  return (
    <section className="adv-sec">
      <h4>Thông tin sách</h4>
      <div className="catalog-facets">
        {CATALOG_FILTERS.map(({ key, label }) => {
          const options = facets.get(key) ?? []
          const selected = filters[key] ?? ''
          return (
            <label key={key}>
              {label}
              <select value={selected} onChange={(e) => {
                const next = { ...filters }
                if (e.target.value) next[key] = e.target.value
                else delete next[key]
                onChange(next)
              }}>
                <option value="">Tất cả</option>
                {selected && !options.some((option) => option.value === selected) && (
                  <option value={selected}>Giá trị đã lưu · hiện không có sách</option>
                )}
                {options.map(({ value, label: option }) => <option key={value} value={value}>{option}</option>)}
              </select>
            </label>
          )
        })}
      </div>
    </section>
  )
}

type SavedFilter = { name: string; hash: string }
const readFilters = (key: string): SavedFilter[] => {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(data) ? data.filter((item) => typeof item?.name === 'string' && typeof item.hash === 'string' && item.hash.startsWith('#/?')) : []
  } catch {
    return []
  }
}

export function SavedFilters({ scope, hash, active, onApply }: {
  scope: string
  hash: string
  active: boolean
  onApply: (hash: string) => void
}) {
  const key = `pochacco-library:saved-filters:${scope}`
  const [saved, setSaved] = useState(() => readFilters(key))
  const [name, setName] = useState('')
  const [choice, setChoice] = useState('')
  const [notice, setNotice] = useState('')
  const selected = saved.find((item) => item.name === choice)
  const persist = (next: SavedFilter[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(next))
      setSaved(next)
      return true
    } catch {
      setNotice('Trình duyệt không lưu được bộ lọc.')
      return false
    }
  }

  return (
    <section className="adv-sec">
      <h4>Bộ lọc đã lưu</h4>
      {saved.length > 0 && (
        <div className="catalog-preset-row">
          <select aria-label="Bộ lọc đã lưu" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">Chọn bộ lọc</option>
            {saved.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>
          <button type="button" className="secondary small-btn" disabled={!selected} onClick={() => {
            if (selected) onApply(selected.hash)
          }}>Áp dụng</button>
          <button type="button" className="link" disabled={!selected} onClick={() => {
            if (persist(readFilters(key).filter((item) => item.name !== choice))) {
              setChoice('')
              setNotice('Đã xóa bộ lọc.')
            }
          }}>Xóa bộ lọc đã lưu</button>
        </div>
      )}
      {active && (
        <form className="catalog-preset-row" onSubmit={(e) => {
          e.preventDefault()
          const clean = name.trim()
          if (!clean) return
          const latest = readFilters(key)
          if (latest.some((item) => foldVi(item.name) === foldVi(clean))) {
            setNotice('Tên này đã được dùng. Hãy chọn tên khác.')
            return
          }
          if (persist([...latest, { name: clean, hash }])) {
            setName('')
            setChoice(clean)
            setNotice(`Đã lưu bộ lọc “${clean}” trên trình duyệt này.`)
          }
        }}>
          <input aria-label="Tên bộ lọc mới" placeholder="Đặt tên cho bộ lọc hiện tại" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          <button className="small-btn" type="submit">Lưu bộ lọc</button>
        </form>
      )}
      {!active && !saved.length && <p className="muted small">Chọn điều kiện lọc để lưu và dùng lại.</p>}
      {notice && <p className="muted small" role="status">{notice}</p>}
    </section>
  )
}
