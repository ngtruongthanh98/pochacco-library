import { useMemo, useState } from 'react'
import { categoryLabel } from '../../data/categories'
import { nameToString, type Book } from '../../types/book'

const asset = (n: string) => `${import.meta.env.BASE_URL}assets/${n}`
const BEST_KEY = 'pochacco-library:quiz-best'
const N = 10

type Q = { book: Book; prompt: string; options: string[]; answer: string; kind: string }

const shuffle = <T,>(a: T[]): T[] => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))]
const firstAuthor = (b: Book) => (b.authors?.length ? nameToString(b.authors[0]) : '')

/** Câu hỏi lấy từ chính tủ sách: tác giả, năm, nhà xuất bản, danh mục, dịch giả. */
function makeQuestions(books: Book[]): Q[] {
  const authors = uniq(books.map(firstAuthor))
  const pubs = uniq(books.map((b) => b.publisher?.trim() ?? ''))
  const translators = uniq(books.flatMap((b) => (b.translators ?? []).map(nameToString)))
  const cats = uniq(books.flatMap((b) => b.categories ?? []))
  const gens: ((b: Book) => Q | null)[] = [
    (b) => {
      const a = firstAuthor(b)
      if (!a || authors.length < 4) return null
      return { book: b, kind: 'tác giả', prompt: `Ai là tác giả của «${b.title}»?`, answer: a, options: shuffle([a, ...shuffle(authors.filter((x) => x !== a)).slice(0, 3)]) }
    },
    (b) => {
      if (!b.year) return null
      const y = b.year
      const near = shuffle([-12, -7, -4, -2, -1, 1, 2, 3, 5, 9].map((d) => y + d).filter((v) => v <= new Date().getFullYear())).slice(0, 3)
      if (near.length < 3) return null
      return { book: b, kind: 'năm xuất bản', prompt: `«${b.title}» (bản trong tủ của bạn) xuất bản năm nào?`, answer: String(y), options: shuffle([y, ...near]).map(String) }
    },
    (b) => {
      const p = b.publisher?.trim()
      if (!p || pubs.length < 4) return null
      return { book: b, kind: 'nhà xuất bản', prompt: `«${b.title}» do nhà xuất bản nào phát hành?`, answer: p, options: shuffle([p, ...shuffle(pubs.filter((x) => x !== p)).slice(0, 3)]) }
    },
    (b) => {
      const t = b.translators?.[0] ? nameToString(b.translators[0]) : ''
      if (!t || translators.length < 4) return null
      return { book: b, kind: 'dịch giả', prompt: `Ai đã dịch «${b.title}»?`, answer: t, options: shuffle([t, ...shuffle(translators.filter((x) => x !== t)).slice(0, 3)]) }
    },
    (b) => {
      const c = b.categories?.[0]
      if (!c || cats.length < 4) return null
      const a = categoryLabel(c)
      const others = cats.filter((x) => !b.categories!.includes(x)).map(categoryLabel)
      if (others.length < 3) return null
      return { book: b, kind: 'danh mục', prompt: `Bạn xếp «${b.title}» vào mục nào?`, answer: a, options: shuffle([a, ...shuffle(others).slice(0, 3)]) }
    },
  ]
  const out: Q[] = []
  const used = new Set<string>()
  for (const b of shuffle(books)) {
    if (out.length >= N) break
    if (used.has(b.id)) continue
    for (const gen of shuffle(gens)) {
      const q = gen(b)
      if (q && new Set(q.options).size === 4) {
        out.push(q)
        used.add(b.id)
        break
      }
    }
  }
  return out
}

export default function QuizGame({ books, onOpenBook }: { books: Book[]; onOpenBook: (b: Book) => void }) {
  const [round, setRound] = useState(0)
  const qs = useMemo(() => makeQuestions(books), [books, round]) // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) ?? 0) || 0)

  const restart = () => {
    setRound((r) => r + 1)
    setI(0)
    setChosen(null)
    setScore(0)
  }

  if (qs.length < 4)
    return (
      <div className="quiz state">
        <img src={asset('anim-sleepy.webp')} alt="" className="quiz-gif round" />
        <div>
          <div className="state-title">Tủ sách còn ít thông tin để ra đề</div>
          <div className="muted">Cần vài chục cuốn có tác giả, năm, nhà xuất bản hoặc danh mục. Bổ sung thông tin sách rồi quay lại nhé.</div>
        </div>
      </div>
    )

  if (i >= qs.length) {
    const ratio = score / qs.length
    return (
      <div className="quiz quiz-end">
        <img src={asset(ratio >= 0.7 ? 'anim-read.webp' : ratio >= 0.4 ? 'anim-carry.webp' : 'anim-sleepy.webp')} alt="" className={`quiz-gif ${ratio < 0.4 ? 'round' : ''}`} />
        <h3>
          {score}/{qs.length} câu đúng
        </h3>
        <p className="muted">
          {ratio >= 0.9 ? 'Bạn thuộc tủ sách như lòng bàn tay!' : ratio >= 0.7 ? 'Rất khá, Pochacco nể bạn đó.' : ratio >= 0.4 ? 'Cũng nhớ kha khá rồi.' : 'Pochacco ngủ gật mất rồi… thử lại nhé!'}
          {' '}Kỷ lục: {best}/{N}.
        </p>
        <button onClick={restart}>Chơi lượt mới</button>
      </div>
    )
  }

  const q = qs[i]
  const answered = chosen !== null
  return (
    <div className="quiz">
      <div className="quiz-top">
        <span className="muted">
          Câu {i + 1}/{qs.length} · hỏi về {q.kind}
        </span>
        <span>
          Đúng <b>{score}</b>
        </span>
      </div>
      <div className="quiz-progress">
        <div style={{ width: `${(i / qs.length) * 100}%` }} />
      </div>
      <h3 className="quiz-q">{q.prompt}</h3>
      <div className="quiz-options">
        {q.options.map((o) => (
          <button
            key={o}
            className={`quiz-opt ${answered ? (o === q.answer ? 'right' : o === chosen ? 'wrong' : 'dim') : ''}`}
            disabled={answered}
            onClick={() => {
              setChosen(o)
              if (o === q.answer) setScore((s) => s + 1)
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {answered && (
        <div className="quiz-feedback">
          <span className={chosen === q.answer ? 'ok' : 'no'}>{chosen === q.answer ? 'Chính xác!' : `Chưa đúng, đáp án là “${q.answer}”.`}</span>
          <button className="link" onClick={() => onOpenBook(q.book)}>
            Xem sách
          </button>
          <button
            onClick={() => {
              const last = i + 1 >= qs.length
              if (last) {
                const final = score
                if (final > best) {
                  localStorage.setItem(BEST_KEY, String(final))
                  setBest(final)
                }
              }
              setI(i + 1)
              setChosen(null)
            }}
            autoFocus
          >
            {i + 1 >= qs.length ? 'Xem kết quả' : 'Câu tiếp'}
          </button>
        </div>
      )}
    </div>
  )
}
