(() => {
  const base = new URL('./', document.currentScript.src)
  const primary = [
    ['library', 'Thư viện', '#/', 'M4 19V5a2 2 0 0 1 2-2h13v17H6a2 2 0 1 1 0-4h13M8 7h7'],
    ['stats', 'Thống kê', '#/thong-ke', 'M4 20v-9m5 9V5m5 15v-7m5 7V8M2 20h20'],
    ['dhamma', 'Học Phật', 'hoc-phat/index.html', 'M12 7C9 5 6 4 3 5v14c3-1 6 0 9 2 3-2 6-3 9-2V5c-3-1-6 0-9 2Zm0 0v14'],
    ['quotes', 'Trích dẫn', '#/trich-dan', 'M5 7h5v5c0 3-2 5-4 5m8-10h5v5c0 3-2 5-4 5'],
    ['games', 'Trò chơi', '#/tro-choi', 'M7 7h10a5 5 0 0 1 0 10H7A5 5 0 0 1 7 7Zm0 2v6m-3-3h6m5 1h.01m3-2h.01'],
  ]
  // Trên máy tính: mọi mục nằm trên một hàng theo đúng thứ tự này.
  // Trên điện thoại: các mục phụ gom vào nút "Khác"; khi đang ở một mục phụ, nút hiện tên mục đó.
  const secondary = [
    ['people', 'Tác giả', '#/tac-gia', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9c0-4 4-6 8-6s8 2 8 6'],
    ['suggest', 'Gợi ý', '#/goi-y', 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z'],
    ['shelves', 'Xếp kệ', '#/xep-ke', 'M4 3h16v18H4ZM4 9h16M4 15h16M8 4v4m3-4v4m3 2v4M8 16v4m4-4v4'],
    ['refs', 'Tài liệu', '#/tai-lieu-tham-khao', 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'],
    ['settings', 'Cài đặt', '#/cai-dat', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4 0a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z'],
  ]
  // Mục hiện kèm biểu tượng ngay cả trên máy tính (như thiết kế cũ).
  const deskIcon = new Set(['games', 'settings'])
  const DOTS = 'M5 12h.01m7 0h.01m7 0h.01'
  const svg = 'http://www.w3.org/2000/svg'

  function icon(data) {
    const element = document.createElementNS(svg, 'svg')
    element.setAttribute('viewBox', '0 0 24 24')
    element.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS(svg, 'path')
    path.setAttribute('d', data)
    element.append(path)
    return element
  }

  function link([page, label, path, glyph], className) {
    const anchor = document.createElement('a')
    anchor.className = className + (deskIcon.has(page) ? ' desk-icon' : '')
    anchor.href = new URL(path, base).href
    anchor.dataset.page = page
    if (glyph) anchor.append(icon(glyph))
    const text = document.createElement('span')
    text.textContent = label
    anchor.append(text)
    return anchor
  }

  class PochaccoNav extends HTMLElement {
    static observedAttributes = ['active-page']

    connectedCallback() {
      const nav = document.createElement('nav')
      nav.className = 'library-menu'
      nav.setAttribute('aria-label', 'Điều hướng Pochacco Library')
      nav.append(...primary.map(entry => link(entry, 'library-menu-tab')))
      nav.append(...secondary.map(entry => link(entry, 'library-menu-tab library-menu-desk')))

      const more = document.createElement('details')
      more.className = 'library-menu-more'
      const summary = document.createElement('summary')
      summary.className = 'library-menu-tab'
      summary.setAttribute('aria-label', 'Các mục khác')
      summary.append(icon(DOTS))
      const label = document.createElement('span')
      label.textContent = 'Khác'
      summary.append(label)
      this.summaryLabel = label
      const panel = document.createElement('div')
      panel.className = 'library-menu-panel'
      panel.append(...secondary.map(entry => link(entry, 'library-menu-item')))
      if (this.hasAttribute('library-session')) {
        const logout = document.createElement('button')
        logout.type = 'button'
        logout.className = 'library-menu-item library-menu-logout'
        logout.dataset.action = 'logout'
        logout.textContent = 'Đăng xuất'
        panel.append(logout)
      }
      more.append(summary, panel)
      nav.append(more)
      if (this.hasAttribute('library-session')) {
        // Nút đăng xuất tròn ở cuối hàng (chỉ trên máy tính; điện thoại dùng mục trong "Khác").
        const out = document.createElement('button')
        out.type = 'button'
        out.className = 'library-menu-out'
        out.dataset.action = 'logout'
        out.title = 'Đăng xuất'
        out.setAttribute('aria-label', 'Đăng xuất')
        out.append(icon('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9'))
        nav.append(out)
      }
      this.replaceChildren(nav)

      this.listeners = new AbortController()
      const options = { signal: this.listeners.signal }
      document.addEventListener('click', event => {
        if (!more.contains(event.target)) more.open = false
      }, options)
      panel.addEventListener('click', event => {
        if (event.target instanceof Element && event.target.closest('a, button')) more.open = false
      }, options)
      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !more.open) return
        more.open = false
        summary.focus()
      }, options)
      this.updateCurrent()
    }

    disconnectedCallback() {
      this.listeners?.abort()
    }

    attributeChangedCallback() {
      this.updateCurrent()
    }

    updateCurrent() {
      const current = this.getAttribute('active-page')
      for (const anchor of this.querySelectorAll('a[data-page]')) {
        if (anchor.dataset.page === current) anchor.setAttribute('aria-current', 'page')
        else anchor.removeAttribute('aria-current')
      }
      const summary = this.querySelector('summary')
      if (!summary) return
      const cur = secondary.find(([page]) => page === current)
      summary.classList.toggle('is-current', !!cur)
      summary.querySelector('svg')?.replaceWith(icon(cur ? cur[3] : DOTS))
      if (this.summaryLabel) this.summaryLabel.textContent = cur ? cur[1] : 'Khác'
    }
  }

  customElements.define('pochacco-nav', PochaccoNav)
})()
