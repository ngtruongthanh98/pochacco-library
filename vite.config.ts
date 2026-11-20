import { createReadStream, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const BASE = '/pochacco-library/'

/**
 * Tài nguyên PDF.js cần tải lúc chạy: bộ giải mã ảnh JPEG 2000/JBIG2 (wasm, thiếu thì trang sách scan bị trắng),
 * bảng mã CMap cho phông CJK, phông chuẩn khi PDF không nhúng phông, và hồ sơ màu ICC.
 * Phục vụ tại <base>pdfjs/<thư mục>/ cả khi chạy dev lẫn khi build.
 */
const PDFJS_DIRS = ['wasm', 'cmaps', 'standard_fonts', 'iccs']
const pdfjsRoot = join(import.meta.dirname, 'node_modules/pdfjs-dist')
const pdfjsAssets = (): Plugin => ({
  name: 'pdfjs-assets',
  configureServer(server) {
    server.middlewares.use(`${BASE}pdfjs/`, (req, res, next) => {
      const [dir, file] = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\//, '').split('/')
      if (!PDFJS_DIRS.includes(dir) || !file || file.includes('..')) return next()
      const path = join(pdfjsRoot, dir, file)
      try {
        if (!statSync(path).isFile()) return next()
      } catch {
        return next()
      }
      if (file.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm')
      createReadStream(path).pipe(res)
    })
  },
  async generateBundle() {
    for (const dir of PDFJS_DIRS)
      for (const file of readdirSync(join(pdfjsRoot, dir))) {
        if (file.startsWith('LICENSE')) continue
        this.emitFile({ type: 'asset', fileName: `pdfjs/${dir}/${file}`, source: await readFile(join(pdfjsRoot, dir, file)) })
      }
  },
})

// GitHub Pages phục vụ tại https://<user>.github.io/pochacco-library/
export default defineConfig({
  base: BASE,
  plugins: [react(), pdfjsAssets()],
})
