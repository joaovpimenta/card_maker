import { useEffect, useRef } from "react"

export function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title?: string }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const first = dialog?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')
    first?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); closeRef.current(); return }
      if (event.key !== "Tab" || !dialog) return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]'))
      if (!items.length) { event.preventDefault(); return }
      const firstItem = items[0]!
      const lastItem = items[items.length - 1]!
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus() }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus() }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => { document.removeEventListener("keydown", onKeyDown); previousFocus.current?.focus() }
  }, [])

  return <div className="modalBackdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialogRef} className="modalDialog" role="dialog" aria-modal="true" aria-label={title || "Janela modal"} tabIndex={-1}>
      <button className="modalClose" type="button" aria-label="Fechar janela" onClick={onClose}>×</button>
      {children}
    </div>
    <style>{`.modalBackdrop{position:fixed;inset:0;background:rgba(15,23,42,.52);display:flex;align-items:center;justify-content:center;padding:16px;z-index:1000}.modalDialog{position:relative;background:#fff;padding:24px;border-radius:14px;width:min(600px,100%);max-height:min(85dvh,800px);overflow:auto;box-shadow:0 18px 60px rgba(15,23,42,.25)}.modalClose{position:sticky;float:right;top:0;min-width:44px;min-height:44px;margin:-12px -12px 0 8px;border:0;border-radius:8px;background:#f1f4f7;font-size:24px;cursor:pointer}.modalDialog button,.modalDialog input,.modalDialog select,.modalDialog textarea{min-height:44px;box-sizing:border-box}@media(max-width:600px){.modalBackdrop{align-items:flex-end;padding:0}.modalDialog{width:100%;max-height:90dvh;border-radius:16px 16px 0 0;padding:20px}}`}</style>
  </div>
}
