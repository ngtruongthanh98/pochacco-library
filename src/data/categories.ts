// Phân loại sách. Mã (id) được lưu trong dữ liệu sách nên không đổi; tên hiển thị sửa thoải mái.
// Bộ mặc định nằm dưới đây. Người dùng có thể tùy biến ở trang Cài đặt: bản tùy biến lưu trong repo dữ liệu
// (config/categories.json) và được nạp vào đây bằng applyTaxonomy().
import { foldVi } from '../search/normalizeVi'

export type Category = { id: string; label: string }
export type CategoryGroup = { id: string; label: string; items: Category[] }

export const slugify = (s: string) =>
  foldVi(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const DEFAULT_RAW: { label: string; items: Category[] }[] = [
  {
    label: 'Triết học',
    items: [
      { id: 'triet-phuong-dong', label: 'Triết học phương Đông' },
      { id: 'triet-phuong-tay', label: 'Triết học phương Tây' },
      { id: 'triet-mac-lenin', label: 'Triết học Mác - Lênin' },
      { id: 'triet-viet-nam', label: 'Tư tưởng Việt Nam' },
      { id: 'logic-hoc', label: 'Logic học' },
      { id: 'my-hoc', label: 'Mỹ học' },
      { id: 'dao-duc-hoc', label: 'Đạo đức học' },
    ],
  },
  {
    label: 'Tôn giáo',
    items: [
      { id: 'pg-nguyen-thuy', label: 'Phật giáo Nguyên thủy' },
      { id: 'pg-viet-nam', label: 'Phật giáo Việt Nam' },
      { id: 'pg-phat-trien', label: 'Phật giáo Phát triển' },
      { id: 'ton-giao-hoc', label: 'Tôn giáo học, tôn giáo khác' },
    ],
  },
  {
    label: 'Lịch sử',
    items: [
      { id: 'ls-viet-nam', label: 'Lịch sử Việt Nam' },
      { id: 'ls-the-gioi', label: 'Lịch sử Thế giới' },
      { id: 'khao-co-hoc', label: 'Khảo cổ học' },
    ],
  },
  {
    label: 'Chính trị, xã hội',
    items: [
      { id: 'tu-tuong-hcm', label: 'Tư tưởng Hồ Chí Minh' },
      { id: 'chinh-tri-hoc', label: 'Chính trị học, quan hệ quốc tế' },
      { id: 'xa-hoi-hoc', label: 'Xã hội học' },
      { id: 'van-hoa-hoc', label: 'Văn hóa học, dân tộc học' },
      { id: 'luat-hoc', label: 'Luật học' },
      { id: 'giao-duc', label: 'Giáo dục học' },
      { id: 'tam-ly-hoc', label: 'Tâm lý học' },
    ],
  },
  {
    label: 'Kinh tế',
    items: [
      { id: 'kinh-te-chinh-tri', label: 'Kinh tế chính trị' },
      { id: 'lich-su-kinh-te', label: 'Lịch sử kinh tế' },
      { id: 'lich-su-tu-tuong-kinh-te', label: 'Lịch sử tư tưởng kinh tế' },
      { id: 'kinh-te-hoc', label: 'Kinh tế học đại cương' },
      { id: 'kinh-te-micro', label: 'Kinh tế vi mô' },
      { id: 'kinh-te-macro', label: 'Kinh tế vĩ mô' },
      { id: 'kinh-te-phat-trien', label: 'Kinh tế phát triển' },
      { id: 'kinh-te-quoc-te', label: 'Kinh tế quốc tế' },
      { id: 'kinh-te-viet-nam', label: 'Kinh tế Việt Nam' },
      { id: 'tai-chinh-tien-te', label: 'Tài chính, tiền tệ' },
      { id: 'quan-tri-kinh-doanh', label: 'Quản trị, kinh doanh' },
    ],
  },
  {
    label: 'Văn học, ngôn ngữ',
    items: [
      { id: 'van-hoc-viet-nam', label: 'Văn học Việt Nam' },
      { id: 'van-hoc-nuoc-ngoai', label: 'Văn học nước ngoài' },
      { id: 'ngon-ngu-hoc', label: 'Ngôn ngữ học' },
      { id: 'nghe-thuat', label: 'Nghệ thuật' },
    ],
  },
  {
    label: 'Khoa học, công nghệ',
    items: [
      { id: 'cntt-ai', label: 'Công nghệ thông tin, AI' },
      { id: 'toan-hoc', label: 'Toán học' },
      { id: 'khoa-hoc-tu-nhien', label: 'Khoa học tự nhiên' },
    ],
  },
  {
    label: 'Tra cứu, khác',
    items: [
      { id: 'tu-dien-tra-cuu', label: 'Từ điển, sách tra cứu' },
      { id: 'phuong-phap-nc', label: 'Phương pháp nghiên cứu, viết học thuật' },
      { id: 'ky-nang-doi-song', label: 'Kỹ năng, đời sống' },
      { id: 'khac', label: 'Khác' },
    ],
  },
]


export const DEFAULT_GROUPS: CategoryGroup[] = DEFAULT_RAW.map((g) => ({ ...g, id: slugify(g.label) }))

const clone = (gs: CategoryGroup[]): CategoryGroup[] =>
  gs.map((g) => ({ id: g.id, label: g.label, items: g.items.map((c) => ({ id: c.id, label: c.label })) }))

/**
 * Danh sách nhóm đang dùng. Là mảng "sống": applyTaxonomy() thay nội dung tại chỗ nên mọi nơi
 * import CATEGORY_GROUPS đều thấy bản mới (giao diện render lại nhờ App tăng phiên bản phân loại).
 */
export const CATEGORY_GROUPS: CategoryGroup[] = clone(DEFAULT_GROUPS)

export const CATEGORY_LABEL: Record<string, string> = {}
const rebuildLabels = () => {
  for (const k of Object.keys(CATEGORY_LABEL)) delete CATEGORY_LABEL[k]
  for (const g of CATEGORY_GROUPS) for (const c of g.items) CATEGORY_LABEL[c.id] = c.label
}
rebuildLabels()

export const categoryLabel = (id: string) => CATEGORY_LABEL[id] ?? id

export const applyTaxonomy = (groups: CategoryGroup[]) => {
  CATEGORY_GROUPS.splice(0, CATEGORY_GROUPS.length, ...clone(groups))
  rebuildLabels()
}

export const cloneGroups = clone

/** Kiểm tra dữ liệu đọc từ tệp cấu hình; sai cấu trúc thì trả null (dùng bộ mặc định). */
export function parseTaxonomy(raw: unknown): CategoryGroup[] | null {
  const groups = (raw as { groups?: unknown } | null)?.groups
  if (!Array.isArray(groups) || groups.length === 0) return null
  const seenG = new Set<string>()
  const seenC = new Set<string>()
  const out: CategoryGroup[] = []
  for (const g of groups) {
    const gg = g as { id?: unknown; label?: unknown; items?: unknown }
    if (typeof gg.id !== 'string' || typeof gg.label !== 'string' || !gg.label.trim() || !Array.isArray(gg.items)) return null
    if (!/^[a-z0-9-]+$/.test(gg.id) || seenG.has(gg.id)) return null
    seenG.add(gg.id)
    const items: Category[] = []
    for (const c of gg.items) {
      const cc = c as { id?: unknown; label?: unknown }
      if (typeof cc.id !== 'string' || typeof cc.label !== 'string' || !cc.label.trim()) return null
      if (!/^[a-z0-9-]+$/.test(cc.id) || seenC.has(cc.id)) return null
      seenC.add(cc.id)
      items.push({ id: cc.id, label: cc.label.trim() })
    }
    out.push({ id: gg.id, label: gg.label.trim(), items })
  }
  return out
}

/** Tạo mã mới cho nhóm/mục: từ tên, thêm hậu tố ngẫu nhiên để không bao giờ trùng mã đã dùng trong dữ liệu sách. */
export function newId(label: string, taken: Set<string>): string {
  const base = (slugify(label) || 'muc').slice(0, 28)
  for (;;) {
    const id = `${base}-${Math.random().toString(36).slice(2, 6)}`
    if (!taken.has(id)) return id
  }
}
