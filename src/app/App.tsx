import { useEffect, useState } from "react"
import CanvasStage from "../canvas/CanvasStage"
import Toolbar from "./Toolbar"
import PropertiesPanel from "./PropertiesPanel"
import { useEditorStore } from "../store/editorStore"
import styles from "./App.module.css"
import MenuBar from "./MenuBar"
import CanvasWrapper from "../canvas/CanvasWrapper"
import { CardsPreviewGrid } from "../preview/CardsPreviewGrid"
import ExportPanel from "./ExportPanel"
import { executeCommand } from "../project/commands"
import { editorHydrated } from "../store/editorStore"
import { reviewProject } from "../utils/projectReview"
import RuntimeNotices from "./RuntimeNotices"
import { parseDataset } from "../project/project"

const stages = ["Dados", "Design", "Revisão", "Exportação"] as const
export default function App() {
  const sampleCards = useEditorStore(s => s.sampleCards)
  const elements = useEditorStore(s => s.template.elements)
  const [cardIndex, setCardIndex] = useState(0)
  const [stage, setStage] = useState<(typeof stages)[number] | null>(null)
  const [mobilePanel, setMobilePanel] = useState<"tools" | "canvas" | "properties">("canvas")
  const showPreview = useEditorStore(s => s.showPreview)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const template = useEditorStore(s => s.template)
  const hydrationStatus = useEditorStore(s => s.hydrationStatus)

  useEffect(() => {
    let active = true
    void editorHydrated.then(() => { if (active) setStage(useEditorStore.getState().sampleCards.length ? "Design" : "Dados") })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMobilePanel("canvas"); return }
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo() }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo() }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [undo, redo])

  if (hydrationStatus === "loading" || !stage) return <div className={styles.root} role="status" aria-live="polite">Carregando projeto salvo…</div>

  const dataReady = sampleCards.length > 0
  const designReady = elements.length > 0
  const warnings = reviewProject(template, sampleCards)
  const completed = [dataReady, designReady, dataReady && designReady && warnings.length === 0, false]
  const progress = Math.round((completed.filter(Boolean).length / 3) * 100)
  const panel = stage === "Design" ? mobilePanel : "canvas"

  return <div className={styles.root}>
    <MenuBar />
    <RuntimeNotices />
    <nav className={styles.journey} aria-label="Etapas do projeto">
      <div className={styles.journeyTitle}><strong>Seu cartão</strong><span>Crie, revise e exporte</span></div>
      <ol>{stages.map((item, i) => <li key={item}><button className={`${styles.step} ${item === stage ? styles.activeStep : ""} ${completed[i] ? styles.doneStep : ""}`} aria-current={item === stage ? "step" : undefined} onClick={() => setStage(item)}><span className={styles.stepNumber}>{completed[i] ? "✓" : i + 1}</span>{item}</button></li>)}</ol>
      <div className={styles.progress}><span style={{ width: `${progress}%` }} /></div>
    </nav>
    {stage === "Dados" && <section className={styles.stageIntro}><h1>Prepare seus dados</h1><p>Importe uma lista ou comece com o exemplo. Cada linha gera um cartão.</p></section>}
    <div className={`${styles.app} ${styles[stage.toLowerCase()]}`}>
      <aside className={`${styles.toolsPane} ${panel === "tools" ? styles.mobileVisible : ""}`}><Toolbar /></aside>
      <main className={`${styles.canvasPane} ${panel === "canvas" ? styles.mobileVisible : ""}`}>
        {stage === "Dados" && <DatasetTable onContinue={() => setStage("Design")} />}
        {stage === "Design" && (showPreview ? <CardsPreviewGrid /> : <CanvasWrapper width={template.width} height={template.height}>
          {sampleCards.length > 0 && <div className={styles.cardNav} aria-label="Navegação entre cartões"><button aria-label="Cartão anterior" onClick={() => setCardIndex(i => Math.max(i - 1, 0))} disabled={cardIndex === 0}>← Anterior</button><span>Cartão {Math.min(cardIndex + 1, sampleCards.length)} de {sampleCards.length}</span><button aria-label="Próximo cartão" onClick={() => setCardIndex(i => Math.min(i + 1, sampleCards.length - 1))} disabled={cardIndex >= sampleCards.length - 1}>Próximo →</button></div>}
          {sampleCards.length || elements.length ? <CanvasStage cardIndex={sampleCards.length ? Math.min(cardIndex, sampleCards.length - 1) : 0} /> : <div className={styles.emptyCanvas}><div aria-hidden="true">✦</div><h2>Seu cartão começa aqui</h2><p>Adicione um texto ou imagem. Você pode importar dados na etapa Dados.</p><button onClick={() => setStage("Dados")}>Preparar dados</button></div>}
        </CanvasWrapper>)}
        {stage === "Revisão" && <ReviewStage onAddData={() => setStage("Dados")} />}
        {stage === "Exportação" && <ExportPanel />}
      </main>
      <aside className={`${styles.propertiesPane} ${panel === "properties" ? styles.mobileVisible : ""}`}><PropertiesPanel /></aside>
    </div>
    {stage === "Design" && <nav className={styles.mobileNav} aria-label="Painéis">{([["tools","Adicionar"],["canvas","Cartão"],["properties","Ajustes"]] as const).map(([key,label]) => <button key={key} className={mobilePanel === key ? styles.mobileActive : ""} onClick={() => setMobilePanel(key)} aria-pressed={mobilePanel === key}>{label}</button>)}</nav>}
  </div>
}

function ReviewStage({ onAddData }: { onAddData: () => void }) {
  const template = useEditorStore(s => s.template)
  const cards = useEditorStore(s => s.sampleCards)
  const warnings = reviewProject(template, cards)
  return <section className={styles.review}><h1>Revise seus cartões</h1><p>{cards.length ? `${cards.length} cartões prontos para conferir.` : "Adicione dados para visualizar os cartões."}</p>
    {warnings.length > 0 && <div className={styles.reviewWarnings} role="status"><h2>Itens para conferir ({warnings.length})</h2><ul>{warnings.map((warning, i) => <li key={`${warning.elementId}-${i}`}>{warning.message}</li>)}</ul></div>}
    {cards.length || template.elements.length ? <CardsPreviewGrid /> : <button onClick={onAddData}>Adicionar dados</button>}
  </section>
}

function DatasetTable({ onContinue }: { onContinue: () => void }) {
  const cards = useEditorStore(s => s.sampleCards)
  const [error, setError] = useState("")
  const importDataset = async (file?: File) => {
    if (!file) return
    if (cards.length && !window.confirm("Substituir os dados atuais pelo arquivo selecionado?")) return
    try {
      let rows: Record<string, string>[]
      const content = await file.text()
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed: unknown = JSON.parse(content)
        if (!Array.isArray(parsed)) throw new Error("O JSON precisa conter uma lista de registros.")
        rows = parsed
      } else rows = parseDataset(content, file.name)
      const result = await executeCommand({ type: "setDataset", cards: rows })
      setError(result.ok ? "" : result.errors.map(item => item.message).join("; "))
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo.") }
  }
  const loadExample = async () => {
    const current = useEditorStore.getState()
    const hasProjectContent = cards.length || current.template.elements.length || current.template.customFonts.length || current.processRules.length || current.template.width !== 600 || current.template.height !== 825
    if (hasProjectContent && !window.confirm("Substituir o projeto atual pelo exemplo? Você poderá desfazer esta ação.")) return
    const project = { version: 1, template: { width: 600, height: 825, customFonts: [], elements: [
      { id: "sample-name", type: "text", x: 48, y: 220, width: 504, height: 70, fontSize: 42, fontFamily: "Arial", color: "#172554", align: "center", bind: "nome", zIndex: 1 },
      { id: "sample-role", type: "text", x: 48, y: 300, width: 504, height: 48, fontSize: 26, fontFamily: "Arial", color: "#334155", align: "center", bind: "cargo", zIndex: 1 },
      { id: "sample-company", type: "text", x: 48, y: 365, width: 504, height: 40, fontSize: 20, fontFamily: "Arial", color: "#64748b", align: "center", bind: "empresa", zIndex: 1 },
    ] }, processRules: [], cards: [
      { nome: "Ana Costa", cargo: "Designer", empresa: "Estúdio Aurora", cidade: "Lisboa" },
      { nome: "Rui Martins", cargo: "Fotógrafo", empresa: "Luz & Forma", cidade: "Porto" },
      { nome: "Inês Rocha", cargo: "Ilustradora", empresa: "Papel Vivo", cidade: "Coimbra" },
    ] }
    const result = await executeCommand({ type: "importProject", project })
    setError(result.ok ? "" : result.errors.map(item => item.message).join("; "))
  }
  if (!cards.length) return <div className={styles.dataEmpty}><span aria-hidden="true">▤</span><h2>Seus dados aparecem aqui</h2><p>Carregue um arquivo CSV, TSV ou JSON, ou escolha o exemplo para conhecer o fluxo.</p><label className={styles.uploadDataset}>Carregar arquivo<input type="file" accept=".csv,.tsv,.json" onChange={event => { void importDataset(event.target.files?.[0]); event.target.value = "" }} /></label><button onClick={() => void loadExample()}>Usar projeto de exemplo</button>{error && <p role="alert">{error}</p>}</div>
  const fields = Array.from(new Set(cards.flatMap(card => Object.keys(card))))
  return <section className={styles.dataset}>{error && <p role="alert">{error}</p>}<header><div><h1>Dados do projeto</h1><p>{cards.length} registros · {fields.length} campos</p></div><div><button onClick={onContinue}>Continuar para o design →</button><label className={styles.uploadDataset}>Trocar arquivo<input type="file" accept=".csv,.tsv,.json" onChange={event => { void importDataset(event.target.files?.[0]); event.target.value = "" }} /></label></div></header><div className={styles.tableScroll}><table><thead><tr><th>#</th>{fields.map(field => <th key={field}>{field}</th>)}</tr></thead><tbody>{cards.slice(0, 30).map((card, i) => <tr key={i}><th scope="row">{i + 1}</th>{fields.map(field => <td key={field}>{card[field] || <span className={styles.missing}>Vazio</span>}</td>)}</tr>)}</tbody></table></div>{cards.length > 30 && <p className={styles.tableNote}>Mostrando 30 de {cards.length} registros.</p>}</section>
}
