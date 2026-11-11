// Danh mục phân loại cố định. Mã (slug) được lưu trong dữ liệu nên không đổi;
// tên hiển thị có thể sửa thoải mái. Thêm danh mục mới: thêm một dòng vào nhóm phù hợp.

export type Category = { id: string; label: string }
export type CategoryGroup = { label: string; items: Category[] }

export const CATEGORY_GROUPS: CategoryGroup[] = [
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
      { id: 'kinh-te-chinh-tri', label: 'Kinh tế chính trị' },
      { id: 'chinh-tri-hoc', label: 'Chính trị học, quan hệ quốc tế' },
      { id: 'xa-hoi-hoc', label: 'Xã hội học' },
      { id: 'van-hoa-hoc', label: 'Văn hóa học, dân tộc học' },
      { id: 'kinh-te-hoc', label: 'Kinh tế học, quản trị' },
      { id: 'luat-hoc', label: 'Luật học' },
      { id: 'giao-duc', label: 'Giáo dục học' },
      { id: 'tam-ly-hoc', label: 'Tâm lý học' },
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

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_GROUPS.flatMap((g) => g.items.map((c) => [c.id, c.label])),
)

export const categoryLabel = (id: string) => CATEGORY_LABEL[id] ?? id
