(() => {
  const base = new URL('./', document.currentScript.src)
  const primary = [
    ['library', 'Thư viện', '#/', 'M4 19V5a2 2 0 0 1 2-2h13v17H6a2 2 0 1 1 0-4h13M8 7h7'],
    ['stats', 'Thống kê', '#/thong-ke', 'M4 20v-9m5 9V5m5 15v-7m5 7V8M2 20h20'],
    ['dhamma', 'Học Phật', 'hoc-phat/index.html', 'M12 7C9 5 6 4 3 5v14c3-1 6 0 9 2 3-2 6-3 9-2V5c-3-1-6 0-9 2Zm0 0v14'],
    ['quotes', 'Trích dẫn', '#/trich-dan', 'M5 7h5v5c0 3-2 5-4 5m8-10h5v5c0 3-2 5-4 5'],
    ['games', 'Trò chơi', '#/tro-choi', 'M7 7h10a5 5 0 0 1 0 10H7A5 5 0 0 1 7 7Zm0 2v6m-3-3h6m5 1h.01m3-2h.01'],
  ]
  const secondary = [
    ['people', 'Tác giả', '#/tac-gia'],
    ['suggest', 'Gợi ý', '#/goi-y'],
    ['shelves', 'Xếp kệ', '#/xep-ke'],
    ['refs', 'Tài liệu', '#/tai-lieu-tham-khao'],
    ['settings', 'Cài đặt', '#/cai-dat'],
  ]
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
    anchor.className = className
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

      const more = document.createElement('details')
      more.className = 'library-menu-more'
      const summary = document.createElement('summary')
      summary.className = 'library-menu-tab'
      summary.append(icon('M5 12h.01m7 0h.01m7 0h.01'))
      const label = document.createElement('span')
      label.textContent = 'Khác'
      summary.append(label)
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
      this.querySelector('summary')?.classList.toggle('is-current', secondary.some(([page]) => page === current))
    }
  }

  customElements.define('pochacco-nav', PochaccoNav)
})()
