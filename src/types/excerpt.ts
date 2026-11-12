/** Trích dẫn trực tiếp từ một cuốn sách, kèm số trang để dẫn nguồn khi viết nghiên cứu. */
export type Excerpt = {
  id: string
  bookId: string
  /** Nguyên văn đoạn trích */
  text: string
  /** Trang: "45", "45-46", "xii"… */
  page?: string
  /** Số trang theo bản nào: sách giấy (mặc định) hay số trang trong tệp PDF/ebook */
  pageSource?: 'print' | 'ebook'
  /** Chủ đề để gom các trích dẫn của nhiều sách lại với nhau */
  topics?: string[]
  /** Ghi chú, bình luận của bạn */
  note?: string
  createdAt: string
  updatedAt: string
}
