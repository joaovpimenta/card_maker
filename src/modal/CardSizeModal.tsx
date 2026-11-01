import { useState } from "react"
import { useEditorStore } from "../store/editorStore"
import { executeCommand } from "../project/commands"
import { Modal } from "./Modal"

const presets = [[600, 825], [750, 1125], [825, 1125], [900, 1500]] as const
export function CardSizeModal({ onClose }: { onClose: () => void }) {
  const template = useEditorStore(s => s.template)
  const [width, setWidth] = useState(template.width)
  const [height, setHeight] = useState(template.height)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const apply = async () => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 50 || height < 50) { setError("A largura e a altura devem ser números de pelo menos 50 px."); return }
    setBusy(true); setError("")
    const result = await executeCommand({ type: "setCardSize", width, height })
    setBusy(false)
    if (!result.ok) { setError(result.errors.map(item => item.message).join("; ")); return }
    onClose()
  }
  return <Modal onClose={onClose} title="Tamanho da carta"><section className="sizeForm">
    <h2>Tamanho da carta</h2><p>Escolha um tamanho comum ou informe as medidas em pixels.</p>
    <div className="presets">{presets.map(([w,h]) => <button key={`${w}x${h}`} aria-pressed={width===w&&height===h} onClick={() => { setWidth(w); setHeight(h); setError("") }}>{w} × {h}</button>)}</div>
    <div className="sizeInputs"><label>Largura (px)<input type="number" min={50} value={width} onChange={e => setWidth(e.target.valueAsNumber)} /></label><label>Altura (px)<input type="number" min={50} value={height} onChange={e => setHeight(e.target.valueAsNumber)} /></label></div>
    {error && <p role="alert">{error}</p>}<footer><button onClick={onClose}>Cancelar</button><button disabled={busy} onClick={() => void apply()}>{busy ? "Salvando…" : "Aplicar tamanho"}</button></footer>
  </section><style>{`.sizeForm{display:flex;flex-direction:column;gap:12px}.sizeForm h2,.sizeForm p{margin:0}.sizeForm p{color:#5f6b78}.presets,.sizeInputs,.sizeForm footer{display:flex;gap:8px;flex-wrap:wrap}.presets button,.sizeInputs input,.sizeForm footer button{min-height:44px;padding:8px 12px;border:1px solid #cbd2db;border-radius:8px;background:#fff}.presets button[aria-pressed=true]{border-color:#3158c9;background:#edf1ff}.sizeInputs label{flex:1;min-width:120px;display:flex;flex-direction:column;gap:4px}.sizeInputs input{width:100%}.sizeForm footer{justify-content:flex-end}`}</style></Modal>
}
