import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useEditorStore } from "../store/editorStore"
import { renderCardToDataURL } from "../utils/renderCardsToCanvas"
import styles from "./CardsPreviewGrid.module.css"

type RenderState = { status: "queued" | "rendering" | "ready" | "error"; url?: string; message?: string }
export function CardsPreviewGrid() {
  const template = useEditorStore(s => s.template)
  const sampleCards = useEditorStore(s => s.sampleCards)
  const cards = useMemo(() => sampleCards.length ? sampleCards : [{}], [sampleCards])
  const containerRef = useRef<HTMLDivElement>(null)
  const projectToken = useMemo(() => ({ template, cards }), [template, cards])
  const activeProject = useRef(projectToken)
  const queue = useRef<number[]>([])
  const running = useRef(0)
  const pumpRef = useRef<() => void>(() => {})
  const [stateStore, setStateStore] = useState<{ token: typeof projectToken; items: Record<number, RenderState> }>({ token: projectToken, items: {} })
  const states = useMemo(() => stateStore.token === projectToken ? stateStore.items : {}, [stateStore, projectToken])
  const updateState = useCallback((index: number, value: RenderState) => setStateStore(previous => {
    const items = previous.token === projectToken ? previous.items : {}
    return { token: projectToken, items: { ...items, [index]: value } }
  }), [projectToken])
  const cardWidth = 150
  const cardHeight = template.width > 0 ? template.height / template.width * cardWidth : 210

  useEffect(() => {
    activeProject.current = projectToken
    queue.current = []
    running.current = 0
  }, [projectToken])

  const pump = useCallback(() => {
    if (activeProject.current !== projectToken) return
    while (activeProject.current === projectToken && running.current < 3 && queue.current.length) {
      const index = queue.current.shift()!
      running.current++
      updateState(index, { status: "rendering" })
      void renderCardToDataURL(structuredClone(template), cards[index] || {}).then(url => {
        if (activeProject.current === projectToken) updateState(index, { status: "ready", url })
      }).catch(error => {
        if (activeProject.current === projectToken) updateState(index, { status: "error", message: error instanceof Error ? error.message : "Falha ao renderizar." })
      }).finally(() => {
        if (activeProject.current === projectToken) {
          running.current = Math.max(0, running.current - 1)
          pumpRef.current()
        }
      })
    }
  }, [cards, template, projectToken, updateState])
  useEffect(() => { pumpRef.current = pump }, [pump])

  const enqueue = useCallback((index: number, retry = false) => {
    const current = states[index]
    if (!retry && current) return
    if (queue.current.includes(index)) return
    queue.current.push(index)
    pump()
  }, [pump, states])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    if (!("IntersectionObserver" in window)) {
      cards.slice(0, 12).forEach((_, i) => enqueue(i))
      return
    }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const index = Number((entry.target as HTMLElement).dataset.index)
        enqueue(index)
        observer.unobserve(entry.target)
      }
    }, { root, rootMargin: "250px" })
    root.querySelectorAll<HTMLElement>("[data-index]").forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [cards, enqueue, template])

  return <div className={styles.gridContainer} ref={containerRef} aria-label="Prévia dos cartões">
    {cards.map((_, i) => {
      const state = states[i]
      return <article key={i} className={styles.cardWrapper} style={{ width: cardWidth, height: cardHeight }} data-index={i} aria-label={`Cartão ${i + 1}`}>
        {state?.status === "ready" && state.url ? <img src={state.url} alt={`Prévia do cartão ${i + 1}`} loading="lazy" /> : state?.status === "error" ? <div className={styles.renderError}><span>Não foi possível criar a prévia.</span><button onClick={() => enqueue(i, true)}>Tentar novamente</button><small>{state.message}</small></div> : <div className={styles.placeholder} role="status">{state?.status === "rendering" ? "Criando prévia…" : "Prévia pendente"}</div>}
      </article>
    })}
  </div>
}
