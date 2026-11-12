import { useEffect, useRef } from 'react'

export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  cancelLabel = 'Ở lại',
  danger,
  onConfirm,
  onCancel,
}: {
  title: string
  text: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [onCancel])

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-text">
        <h3 id="dlg-title">{title}</h3>
        <p id="dlg-text">{text}</p>
        <div className="dialog-actions">
          <button ref={cancelRef} className="secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={danger ? 'danger' : undefined} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
