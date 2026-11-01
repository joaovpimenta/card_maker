import { useState } from "react"
import { saveAs } from "file-saver"
import { useEditorStore } from "../store/editorStore"
import { getProject } from "../project/commands"
import { exportCards, saveJson } from "../utils/exportCards"
import { renderCardToDataURL } from "../utils/renderCardsToCanvas"
import { reviewProject } from "../utils/projectReview"
import styles from "./ExportPanel.module.css"

export default function ExportPanel() {
  const template = useEditorStore(s => s.template)
  const cards = useEditorStore(s => s.sampleCards)
  const processRules = useEditorStore(s => s.processRules)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const warnings = reviewProject(template, cards)
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(""); setMessage(""); setProgress({current:0,total:0})
    try { await action(); setMessage("Arquivo pronto. O download foi solicitado ao navegador.") }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível exportar.") }
    finally { setBusy(false) }
  }
  return <section className={styles.panel} aria-labelledby="export-heading">
    <h2 id="export-heading">Seu baralho está pronto para sair do editor</h2>
    <p>Guarde uma cópia editável do projeto e baixe as imagens para testar ou imprimir.</p>
    <div className={styles.options}>
      <article><span className={styles.tag}>Backup recomendado</span><h3>Projeto completo</h3><p>Design, dados originais e regras em um único arquivo JSON. Abra novamente para continuar editando.</p><button disabled={busy} onClick={() => saveJson(getProject(), "projeto.cardmaker.json")}>Baixar projeto completo</button></article>
      <article><span className={styles.tag}>Reutilizar o design</span><h3>Template</h3><p>Design e regras sem os dados das cartas. Use como ponto de partida para outro baralho.</p><button disabled={busy} onClick={() => saveJson({ template, processRules }, "template.json")}>Baixar template</button></article>
      <article><span className={styles.tag}>{cards.length || 1} imagem(ns)</span><h3>Baralho em PNG</h3><p>Um ZIP com todas as cartas na resolução original de exportação. Sem dados, exporta uma carta com o conteúdo fixo.</p><button disabled={busy || !template.elements.length} onClick={() => void run(async () => { await exportCards({ onProgress: (current, total) => setProgress({ current, total }) }) })}>Baixar cartas em ZIP</button></article>
      <article><span className={styles.tag}>Conferir uma amostra</span><h3>Primeira carta em PNG</h3><p>Baixe uma amostra antes de exportar o baralho inteiro. O zoom da tela não altera a qualidade do arquivo.</p><button disabled={busy || !template.elements.length} onClick={() => void run(async () => {
        const dataURL = await renderCardToDataURL(structuredClone(template), cards[0] || {})
        const binary = atob(dataURL.split(",")[1]!)
        saveAs(new Blob([Uint8Array.from(binary, c => c.charCodeAt(0))], { type: "image/png" }), "carta_001.png")
      })}>Baixar primeira carta</button></article>
    </div>
    {!template.elements.length && <p role="status">Adicione texto ou imagem na etapa Design para habilitar a exportação de imagens.</p>}
    {warnings.length > 0 && <aside className={styles.warnings}><h3>Confira antes de exportar</h3><ul>{warnings.map((w, i) => <li key={`${w.elementId}-${i}`}>{w.message}</li>)}</ul></aside>}
    {busy && <div role="status"><p>Preparando arquivos… {progress.total > 0 && `${progress.current} de ${progress.total} cartas`}</p><progress max={progress.total || 1} value={progress.current} aria-label="Progresso da exportação" /></div>}
    {error && <p role="alert" className={styles.error}>{error} Imagens externas precisam permitir CORS; tente importar a imagem como arquivo.</p>}
    {message && <p role="status">{message}</p>}
    <p className={styles.help}>Para agentes de IA: <a href={`${import.meta.env.BASE_URL}agents/README.md`}>instruções e exemplos</a> · <a href={`${import.meta.env.BASE_URL}agents/project.schema.json`}>schema do projeto</a> · <a href={`${import.meta.env.BASE_URL}llms.txt`}>llms.txt</a></p>
  </section>
}
