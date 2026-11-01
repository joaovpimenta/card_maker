import { useRef, useState } from "react"
import { useEditorStore } from "../store/editorStore"
import { executeCommand, getProject } from "../project/commands"
import { saveJson } from "../utils/exportCards"
import styles from "./MenuBar.module.css"
import { CardSizeModal } from "../modal/CardSizeModal"
import { AddFontModal } from "../modal/AddFontModal"

export default function MenuBar() {
  const [dialog, setDialog] = useState<"size" | "font" | null>(null)
  const [error, setError] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)
  const state = useEditorStore()
  const run = async (command: Parameters<typeof executeCommand>[0]) => {
    const result = await executeCommand(command)
    setError(result.ok ? "" : result.errors.map(e => e.message).join("; "))
  }
  return <header className={styles.menuBar}>
    <a className={styles.brand} href="#" aria-label="Card Maker">Card Maker <small>estúdio de cartas</small></a>
    <nav className={styles.actions} aria-label="Ações do projeto" onKeyDown={event => {
      if (event.key === "Escape") event.currentTarget.querySelectorAll("details[open]").forEach(d => d.removeAttribute("open"))
    }}>
      <details className={styles.menu}>
        <summary>Projeto</summary>
        <div className={styles.dropdown}>
          <button onClick={() => {
            if ((state.template.elements.length || state.sampleCards.length) && !window.confirm("Criar um projeto vazio? Você poderá desfazer esta ação. Para guardar uma cópia, baixe o projeto antes.")) return
            void run({ type: "newProject" })
          }}>Novo projeto</button>
          <button onClick={() => fileInput.current?.click()}>Abrir projeto ou template…</button>
          <button onClick={() => saveJson(getProject(), "projeto.cardmaker.json")}>Baixar projeto completo</button>
          <p>Inclui design, dados e regras. O salvamento automático fica apenas neste navegador.</p>
        </div>
      </details>
      <details className={styles.menu}>
        <summary>Opções</summary>
        <div className={styles.dropdown}>
          <button onClick={() => setDialog("size")}>Tamanho da carta…</button>
          <button onClick={() => setDialog("font")}>Adicionar fonte…</button>
          <button aria-pressed={state.showGuides} onClick={state.toggleGuides}>{state.showGuides ? "✓ " : ""}Margem de segurança</button>
          <button aria-pressed={state.showGrid} onClick={state.toggleGrid}>{state.showGrid ? "✓ " : ""}Grade de alinhamento</button>
          <a href={`${import.meta.env.BASE_URL}agents/README.md`} target="_blank" rel="noreferrer">Como usar com agentes de IA ↗</a>
        </div>
      </details>
      <button aria-label="Desfazer" title="Desfazer (Ctrl/Cmd+Z)" disabled={state.historyIndex <= 0} onClick={() => void run({ type: "undo" })}>↶ <span>Desfazer</span></button>
      <button aria-label="Refazer" title="Refazer (Ctrl/Cmd+Shift+Z)" disabled={state.historyIndex >= state.history.length - 1} onClick={() => void run({ type: "redo" })}>↷ <span>Refazer</span></button>
    </nav>
    <input ref={fileInput} tabIndex={-1} type="file" accept=".json" className={styles.fileInput} aria-label="Abrir projeto ou template" onChange={async event => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file) return
      try { await run({ type: "importProject", project: await file.text() }) }
      catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo.") }
    }} />
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {dialog === "size" && <CardSizeModal onClose={() => setDialog(null)} />}
    {dialog === "font" && <AddFontModal onClose={() => setDialog(null)} />}
  </header>
}
