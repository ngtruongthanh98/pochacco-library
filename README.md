# pochacco-library

Ứng dụng web quản lý thư viện sách cá nhân (sách giấy và sách điện tử). Giao diện tĩnh chạy trên GitHub Pages; dữ liệu nằm trong repo riêng tư `pochacco-library-data` và được đọc ghi qua GitHub API bằng token của chủ sở hữu.

## Chạy thử trên máy

```bash
npm install
npm run dev
```

Mở trang, nhập chủ repo, tên repo dữ liệu và một fine-grained personal access token chỉ cấp cho `pochacco-library-data` với quyền Contents (Read and write).

## Triển khai

Mỗi lần push lên nhánh `main`, workflow `.github/workflows/deploy.yml` build và đăng lên GitHub Pages. Workflow đẩy bản build lên nhánh `gh-pages`; Pages phục vụ trang từ nhánh này (Settings > Pages > Deploy from a branch: `gh-pages`, thư mục `/ (root)`).

## Cấu trúc

- `src/types/book.ts`: mô hình dữ liệu, khớp với `schema/book.schema.json` của repo dữ liệu
- `src/search/`: chuẩn hóa tiếng Việt không dấu và chỉ mục MiniSearch
- `src/data/githubStore.ts`: đọc danh mục từ repo dữ liệu qua GitHub REST API

## Lộ trình

Theo tài liệu "Kế hoạch và thiết kế hệ thống Thư viện sách cá nhân": giai đoạn 0 (khởi tạo) đã xong; tiếp theo là bộ nhớ IndexedDB, PWA offline, biểu mẫu thêm/sửa và commit dữ liệu.

## Hình ảnh

Bộ hình minh họa Pochacco trong `public/assets/` và biểu tượng ứng dụng do chủ repo cung cấp, chỉ dùng cho mục đích cá nhân, phi thương mại. Pochacco là nhân vật thuộc bản quyền của Sanrio.
