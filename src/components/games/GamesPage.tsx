import { useState } from 'react'
import type { Book } from '../../types/book'
import type { StoreConfig } from '../../data/githubStore'
import FarmGame from './FarmGame'
import CatchGame from './CatchGame'
import QuizGame from './QuizGame'
import ArcheryGame from './ArcheryGame'

type Tab = 'farm' | 'archery' | 'catch' | 'quiz'
export default function GamesPage({ cfg, books, onOpenBook }: { cfg: StoreConfig; books: Book[]; onOpenBook: (b: Book) => void }) {
  const [tab, setTab] = useState<Tab>(() => {
    const v = sessionStorage.getItem('pochacco-library:game-tab')
    return v === 'catch' || v === 'quiz' || v === 'archery' ? v : 'farm'
  })
  const pick = (t: Tab) => {
    setTab(t)
    sessionStorage.setItem('pochacco-library:game-tab', t)
  }
  return (
    <section className="card games">
      <div className="games-head">
        <h2>Góc giải trí của Pochacco</h2>
        <div className="fmt-filter" role="tablist">
          <button role="tab" aria-selected={tab === 'farm'} className={`fmt-pill ${tab === 'farm' ? 'active' : ''}`} onClick={() => pick('farm')}>
            Nông trại
          </button>
          <button role="tab" aria-selected={tab === 'archery'} className={`fmt-pill ${tab === 'archery' ? 'active' : ''}`} onClick={() => pick('archery')}>
            Bắn cung
          </button>
          <button role="tab" aria-selected={tab === 'catch'} className={`fmt-pill ${tab === 'catch' ? 'active' : ''}`} onClick={() => pick('catch')}>
            Hứng sách
          </button>
          <button role="tab" aria-selected={tab === 'quiz'} className={`fmt-pill ${tab === 'quiz' ? 'active' : ''}`} onClick={() => pick('quiz')}>
            Đố vui tủ sách
          </button>
        </div>
      </div>
      {tab === 'farm' ? <FarmGame cfg={cfg} /> : tab === 'archery' ? <ArcheryGame /> : tab === 'catch' ? <CatchGame /> : <QuizGame books={books} onOpenBook={onOpenBook} />}
    </section>
  )
}
