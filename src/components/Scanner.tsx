import { useEffect, useRef, useState } from 'react'
import { parseIsbn } from '../search/isbn'

type Controls = { stop: () => void }

/** Tiếng bíp ngắn + rung nhẹ khi đọc được mã. */
const feedback = () => {
  try {
    navigator.vibrate?.(60)
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 1200
    g.gain.value = 0.08
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.09)
    o.onended = () => void ctx.close()
  } catch {
    /* không có âm thanh cũng không sao */
  }
}

/**
 * Camera đọc mã vạch EAN-13 của ISBN (978/979). Thư viện ZXing chỉ được tải khi mở camera.
 * Cùng một mã trong 4 giây chỉ báo một lần, để giữ máy trên một cuốn không bị đếm nhiều lần.
 */
export default function Scanner({
  onIsbn,
  paused = false,
  hint,
}: {
  onIsbn: (isbn13: string) => void
  paused?: boolean
  hint?: string
}) {
  const video = useRef<HTMLVideoElement>(null)
  const controls = useRef<Controls | null>(null)
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const cb = useRef(onIsbn)
  cb.current = onIsbn
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const [state, setState] = useState<'starting' | 'live' | 'error'>('starting')
  const [errMsg, setErrMsg] = useState('')
  const [manual, setManual] = useState('')
  const [manualErr, setManualErr] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)

  const accept = (raw: string) => {
    const r = parseIsbn(raw)
    if (!r.ok) return false
    const now = Date.now()
    if (last.current.code === r.isbn13 && now - last.current.at < 4000) return true
    last.current = { code: r.isbn13, at: now }
    feedback()
    setFlash(true)
    setTimeout(() => setFlash(false), 350)
    cb.current(r.isbn13)
    return true
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('error')
        setErrMsg('Trình duyệt này không mở được camera. Hãy nhập ISBN bên dưới.')
        return
      }
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13])
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })
        const c = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          video.current!,
          (result) => {
            if (result && !pausedRef.current) {
              const text = result.getText()
              if (/^97[89]\d{10}$/.test(text)) accept(text)
            }
          },
        )
        if (cancelled) return c.stop()
        controls.current = c
        setState('live')
      } catch (e) {
        if (cancelled) return
        setState('error')
        const name = (e as Error).name
        setErrMsg(
          name === 'NotAllowedError'
            ? 'Chưa được cấp quyền camera. Cho phép camera trong cài đặt trình duyệt, hoặc nhập ISBN bên dưới.'
            : name === 'NotFoundError'
              ? 'Không tìm thấy camera trên thiết bị này. Hãy nhập ISBN bên dưới.'
              : 'Không mở được camera. Hãy nhập ISBN bên dưới.',
        )
      }
    })()
    return () => {
      cancelled = true
      controls.current?.stop()
      controls.current = null
    }
  }, [])

  return (
    <div className="scanner">
      <div className={`viewfinder${flash ? ' flash' : ''}`}>
        <video ref={video} muted playsInline />
        {state === 'live' && <div className="aim" />}
        {state === 'starting' && <div className="vf-msg">Đang mở camera...</div>}
        {state === 'error' && <div className="vf-msg">{errMsg}</div>}
        {paused && state === 'live' && <div className="vf-msg dim">Tạm dừng</div>}
      </div>
      {hint && state === 'live' && <p className="hint center">{hint}</p>}
      <form
        className="manual"
        onSubmit={(e) => {
          e.preventDefault()
          setManualErr(null)
          const r = parseIsbn(manual)
          if (!r.ok) return setManualErr(r.message)
          last.current = { code: '', at: 0 }
          accept(manual)
          setManual('')
        }}
      >
        <input inputMode="numeric" placeholder="Hoặc gõ ISBN" value={manual} onChange={(e) => setManual(e.target.value)} />
        <button type="submit" className="secondary">
          Tra
        </button>
      </form>
      {manualErr && <p className="error">{manualErr}</p>}
    </div>
  )
}
