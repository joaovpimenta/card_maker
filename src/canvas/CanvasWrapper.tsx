import { v4 as uuidv4 } from "uuid"
import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import style from "./CanvasWrapper.module.css"
import { CanvasViewportContext } from "./CanvasViewportContext"
import { executeCommand } from "../project/commands"
import { parseDataset } from "../project/project"

export default function CanvasWrapper({ children, width, height }: { children: React.ReactNode, width: number, height: number }) {
  const [dragOver, setDragOver] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [navHeight, setNavHeight] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [panMode, setPanMode] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dropError, setDropError] = useState("")
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null)
  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const updateSize = () => {
      const rect = node.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
      const nav = node.querySelector<HTMLElement>('[aria-label="Navegação entre cartões"]')
      setNavHeight(nav?.getBoundingClientRect().height ?? 0)
    }
    const observer = new ResizeObserver(updateSize)
    observer.observe(node)
    let observedNav: HTMLElement | null = null
    const watchNav = () => {
      const nav = node.querySelector<HTMLElement>('[aria-label="Navegação entre cartões"]')
      if (nav !== observedNav) {
        if (observedNav) observer.unobserve(observedNav)
        observedNav = nav
        if (observedNav) observer.observe(observedNav)
      }
      updateSize()
    }
    const mutations = new MutationObserver(watchNav)
    mutations.observe(node, { childList: true, subtree: true })
    watchNav()
    return () => { mutations.disconnect(); observer.disconnect() }
  }, [])
  const availableHeight = Math.max(0, size.height - navHeight)
  const fit = size.width && availableHeight ? Math.max(0.01, Math.min((size.width - 32) / width, (availableHeight - 32) / height, 1)) : 1
  const scale = fit * zoom
  const viewport = useMemo(() => ({ scale, x: (size.width - width * scale) / 2 + pan.x, y: navHeight + (availableHeight - height * scale) / 2 + pan.y, panMode }), [scale, size, width, height, pan, panMode, navHeight, availableHeight])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)

    const file = e.dataTransfer.files[0]
      if (!file) return
    setDropError("")

    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = async () => {
        const result = await executeCommand({ type: "addElement", element: {
          id: uuidv4(),
          type: "staticImage",
          x: 50,
          y: 50,
          width: 400,
          height: 600,
          src: reader.result as string,
          zIndex: 0,
        } })
        if (!result.ok) setDropError(result.errors.map(error => error.message).join("; "))
      }
      reader.onerror = () => setDropError("Não foi possível ler o arquivo de imagem.")
      reader.readAsDataURL(file)
    } else if (/\.(json|csv|tsv)$/i.test(file.name)) {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          if(file.name.toLowerCase().endsWith(".json")) {
            const data = JSON.parse(reader.result as string)
            if (Array.isArray(data)) {
              const result = await executeCommand({ type: "setDataset", cards: data })
              if (!result.ok) throw new Error(result.errors.map(error => error.message).join("; "))
            } else {
              const result = await executeCommand({ type: "importProject", project: data })
              if (!result.ok) throw new Error(result.errors.map(error => error.message).join("; "))
            }
          } else {
            const data = parseDataset(reader.result as string, file.name)
            const result = await executeCommand({ type: "setDataset", cards: data })
            if (!result.ok) throw new Error(result.errors.map(error => error.message).join("; "))
          }
        } 
        catch (err) 
        {
          setDropError(err instanceof Error ? err.message : "Não foi possível importar o arquivo.")
        }
      }
      reader.onerror = () => setDropError("Não foi possível ler o arquivo.")
      reader.readAsText(file)
    } else {
      setDropError("Solte um arquivo de imagem, CSV, TSV ou JSON.")
    }
  }, [])

  return (
    <div
      className={style.canvasWrapper}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className={style.controls}>
        <button type="button" onClick={() => setPanMode(value => !value)} aria-pressed={panMode}>{panMode ? "Mover cartão" : "Selecionar"}</button>
        <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom(value => Math.max(0.5, Math.round((value - 0.1) * 10) / 10))}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom(value => Math.min(3, Math.round((value + 0.1) * 10) / 10))}>+</button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>Ajustar</button>
      </div>
      {dropError && <p className={style.dropError} role="alert">{dropError}</p>}
      <div ref={viewportRef} data-testid="canvas-viewport" className={`${style.viewport} ${panMode ? style.panning : ""}`} onPointerDown={(event) => { if (!panMode) return; pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={(event) => { const pointer = pointerRef.current; if (!pointer || pointer.id !== event.pointerId) return; setPan(current => ({ x: current.x + event.clientX - pointer.x, y: current.y + event.clientY - pointer.y })); pointerRef.current = { ...pointer, x: event.clientX, y: event.clientY } }} onPointerUp={() => { pointerRef.current = null }} onPointerCancel={() => { pointerRef.current = null }}>
        <CanvasViewportContext.Provider value={viewport}>{children}</CanvasViewportContext.Provider>
      </div>
      {dragOver && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,170,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: "bold",
          color: "#00aaff",
          pointerEvents: "none",
        }}>
          Drop file here
        </div>
      )}
    </div>
  )
}

