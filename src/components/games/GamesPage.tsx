import { useState } from 'react'
import type { Book } from '../../types/book'
import CatchGame from './CatchGame'
import QuizGame from './QuizGame'

export default function GamesPage({ books, onOpenBook }: { books: Book[]; onOpenBook: (b: Book) => void }) {
  const [tab, setTab] = useState<'catch' | 'quiz'>(() => (sessionStorage.getItem('pochacco-library:game-tab') === 'quiz' ? 'quiz' : 'catch'))
  const pick = (t: 'catch' | 'quiz') => {
    setTab(t)
    sessionStorage.setItem('pochacco-library:game-tab', t)
  }
  return (
    <section className="card games">
      <div className="games-head">
        <h2>Góc giải trí của Pochacco</h2>
        <div className="fmt-filter" role="tablist">
          <button role="tab" aria-selected={tab === 'catch'} className={`fmt-pill ${tab === 'catch' ? 'active' : ''}`} onClick={() => pick('catch')}>
            Hứng sách
          </button>
          <button role="tab" aria-selected={tab === 'quiz'} className={`fmt-pill ${tab === 'quiz' ? 'active' : ''}`} onClick={() => pick('quiz')}>
            Đố vui tủ sách
          </button>
        </div>
      </div>
      {tab === 'catch' ? <CatchGame /> : <QuizGame books={books} onOpenBook={onOpenBook} />}
    </section>
  )
}
