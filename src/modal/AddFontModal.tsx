import { useState } from "react"
import { useEditorStore } from "../store/editorStore"
import { Modal } from "./Modal"
import { loadGoogleFont, parseGoogleFontName } from "../utils/googleFonts"

export function AddFontModal({ onClose }: { onClose: () => void }) {
  const addCustomFont = useEditorStore(s => s.addCustomFont)
  const [fontUrl, setFontUrl] = useState("")
  const [fontError, setFontError] = useState("")
  const [busy, setBusy] = useState(false)

  const apply = async () => {
    const name = parseGoogleFontName(fontUrl)
    if (!name) { setFontError("Cole um link HTTPS de fonts.googleapis.com/css ou /css2 com um parâmetro family válido."); return }
    setBusy(true); setFontError("")
    try {
      await loadGoogleFont(fontUrl)
      addCustomFont(name)
      onClose()
    } catch (error) {
      setFontError(error instanceof Error ? error.message : "Não foi possível carregar a fonte.")
    } finally { setBusy(false) }
  }

  return <Modal onClose={onClose} title="Adicionar fonte">
    <div className="fontForm">
      <h2>Adicionar fonte do Google Fonts</h2>
      <p>A fonte será carregada agora e restaurada ao reabrir o projeto.</p>
      <label>Link do Google Fonts
        <input type="url" placeholder="https://fonts.googleapis.com/css2?family=Roboto" value={fontUrl} onChange={event => setFontUrl(event.target.value)} />
      </label>
      {fontError && <p role="alert">{fontError}</p>}
      <div><button disabled={busy} onClick={() => void apply()}>{busy ? "Carregando…" : "Adicionar fonte"}</button><button disabled={busy} onClick={onClose}>Cancelar</button></div>
    </div>
    <style>{`.fontForm{display:flex;flex-direction:column;gap:12px}.fontForm h2{margin:0}.fontForm p{margin:0;color:#5f6b78}.fontForm label{display:flex;flex-direction:column;gap:6px}.fontForm input,.fontForm button{min-height:44px;padding:8px 12px;border:1px solid #cbd2db;border-radius:8px}.fontForm div{display:flex;justify-content:flex-end;gap:8px}`}</style>
  </Modal>
}
