import { useState } from "react"
import { executeCommand } from "../project/commands"
import { BindField } from "./MaxValueField"
import type { ImageElement, StaticTextElement, TextElement } from "../models/Element"
import { useEditorStore } from "../store/editorStore"
import styles from "./PropertiesPanel.module.css"

export default function PropertiesPanel() {
  const template = useEditorStore((s) => s.template)
  const selectedElementId = useEditorStore((s) => s.selectedElementId)
  const [editError, setEditError] = useState("")
  const updateElement = (id: string, updates: Record<string, unknown>) => {
    void executeCommand({ type: "updateElement", id, updates }).then(result => setEditError(result.ok ? "" : result.errors.map(item => item.message).join("; ")))
  }
  const deleteElement = (id: string) => { void executeCommand({ type: "deleteElement", id }).then(result => setEditError(result.ok ? "" : result.errors.map(item => item.message).join("; "))) }
  const customFonts = useEditorStore((s) => s.template.customFonts)
  const [maxWidthTab, setMaxWidthTab] = useState<'number' | 'field'>('number');
  const [maxHeightTab, setMaxHeightTab] = useState<'number' | 'field'>('number');
  const baseFonts = ["Arial", "Georgia", "Times New Roman", "Courier New", "sans-serif"]

  const allFonts = [...baseFonts, ...customFonts]

  // Get available fields from sampleCards
  const sampleCards = useEditorStore((s) => s.sampleCards)
  const sampleFields = Array.from(new Set(sampleCards.flatMap(card => Object.keys(card))))

  const selectedElement = template.elements.find((el) => el.id === selectedElementId)
  const elementLabel = (el: typeof template.elements[number]) => el.type === "staticText" ? el.text : el.type === "staticImage" ? "Imagem estática" : el.bind || (el.type === "image" ? "Imagem dinâmica" : "Texto sem campo")
  if (!selectedElement) return <div className={styles.panel}><h3>Elementos</h3><p className={styles.hint}>Selecione um elemento para ajustar suas propriedades.</p>{template.elements.length === 0 ? <p className={styles.hint}>Ainda não há elementos no cartão.</p> : <ul className={styles.elementList}>{[...template.elements].reverse().map((el) => <li key={el.id}><button className={styles.elementButton} aria-label={`Selecionar ${elementLabel(el)}`} onClick={() => useEditorStore.getState().setSelectedElement(el.id)}><span aria-hidden="true">{el.type.toLowerCase().includes("image") ? "▧" : "T"}</span><span>{elementLabel(el)}</span></button></li>)}</ul>}</div>

  const isText = selectedElement.type === "text" || selectedElement.type === "staticText"
  const isImage = selectedElement.type === "image" || selectedElement.type === "staticImage"

  let identifier = ""
  switch (selectedElement.type) {
    case "text":
      identifier = (selectedElement as TextElement).bind || "Texto sem campo"
      break
    case "staticText":
      {
        const staticText = (selectedElement as StaticTextElement).text
        identifier = staticText.length > 20 ? staticText.slice(0, 20) + "..." : staticText
      }
      break
    case "image":
      identifier = (selectedElement as ImageElement).bind || "Imagem sem campo"
      break
    case "staticImage":
      {
        const displayedText = selectedElement.src ? selectedElement.src.split("/").pop() || "Imagem" : "Imagem"
        identifier = displayedText.length > 20 ? displayedText.slice(0, 20) + "..." : displayedText
      }
      break
    default:
      identifier = ""
  }

  return (
    <div className={styles.panel}>
      <h3>Ajustes</h3>
      <p className={styles.hint}>{selectedElement.type === "staticText" || selectedElement.type === "staticImage" ? "Elemento fixo: igual em todos os cartões." : "Elemento vinculado: pode mudar conforme os dados."}</p>
      {editError && <p role="alert" className={styles.hint}>{editError}</p>}
      <fieldset className={styles.geometry}><legend>Posição e tamanho</legend>
        {([ ["x","Posição X",selectedElement.x], ["y","Posição Y",selectedElement.y], ["width","Largura",selectedElement.width], ["height","Altura",selectedElement.height] ] as const).map(([key,label,value]) => <label key={key}>{label}<input type="number" min={key === "width" || key === "height" ? 1 : 0} value={value} onChange={event => { const next = event.target.valueAsNumber; if (Number.isFinite(next) && next >= 0 && ((key !== "width" && key !== "height") || next > 0)) updateElement(selectedElement.id, { [key]: next }) }} /></label>)}
      </fieldset>

      {/* Text Properties */}
      {isText && (
        <>
          <h4>{identifier}</h4>
          {selectedElement.type === "staticText" && <label>Texto fixo<textarea rows={3} value={selectedElement.text} onChange={event => updateElement(selectedElement.id, { text: event.target.value })} /></label>}
          {selectedElement.type === "text" && <label>Campo de dados<select disabled={!sampleFields.length} value={selectedElement.bind || ""} onChange={event => updateElement(selectedElement.id, { bind: event.target.value || undefined })}><option value="">Sem campo</option>{sampleFields.map(field => <option key={field} value={field}>{field}</option>)}</select>{!sampleFields.length && <small>Carregue dados para escolher um campo.</small>}</label>}
          <label>Fonte:
            <select
              value={selectedElement.fontFamily}
              onChange={(e) =>
                updateElement(selectedElement.id, { fontFamily: e.target.value })
              }
            >
              {Array.from(new Set([...allFonts, selectedElement.fontFamily])).map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </label>

          <label>Cor:
            <input
              type="color"
              value={selectedElement.color}
              onChange={(e) =>
                updateElement(selectedElement.id, { color: e.target.value })
              }
            />
          </label>

          <label>Tamanho da letra:
            <input
              type="number"
              value={selectedElement.fontSize}
              onChange={(e) =>
                updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) })
              }
            />
          </label>

          <label>Opacidade:
            <input
              type="number"
              value={selectedElement.opacity ?? 1}
              max={1}
              min={0}
              step={0.01}
              onChange={(e) =>
                updateElement(selectedElement.id, { opacity: parseFloat(e.target.value) })
              }
            />
          </label>

          <label>Alinhamento:
            <select
              value={selectedElement.align}
              onChange={(e) =>
                updateElement(selectedElement.id, { align: e.target.value as "left" | "center" | "right" })
              }
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </label>

          <BindField
            label="Largura máxima:"
            numberValue={selectedElement.maxWidth}
            fieldValue={selectedElement.width_bind}
            tab={maxWidthTab}
            setTab={setMaxWidthTab}
            onNumberChange={value => updateElement(selectedElement.id, { maxWidth: value, width_bind: undefined })}
            onFieldChange={value => updateElement(selectedElement.id, { width_bind: value, maxWidth: undefined })}
            availableFields={sampleFields}
            fallbackNumber={selectedElement.width}
          />

          <BindField
            label="Altura máxima:"
            numberValue={selectedElement.maxHeight}
            fieldValue={selectedElement.height_bind}
            tab={maxHeightTab}
            setTab={setMaxHeightTab}
            onNumberChange={value => updateElement(selectedElement.id, { maxHeight: value, height_bind: undefined })}
            onFieldChange={value => updateElement(selectedElement.id, { height_bind: value, maxHeight: undefined })}
            availableFields={sampleFields}
            fallbackNumber={selectedElement.height}
          />
        </>
      )}

      {/* Image Properties */}
      {isImage && (
        <>
          <h4>{identifier}</h4>
          {selectedElement.type === "image" && <label>Campo de dados<select disabled={!sampleFields.length} value={selectedElement.bind || ""} onChange={event => updateElement(selectedElement.id, { bind: event.target.value || undefined })}><option value="">Sem campo</option>{sampleFields.map(field => <option key={field} value={field}>{field}</option>)}</select>{!sampleFields.length && <small>Carregue dados para escolher um campo.</small>}</label>}

          <label>Opacidade:
            <input
              type="number"
              value={selectedElement.opacity ?? 1}
              max={1}
              min={0}
              step={0.01}
              onChange={(e) =>
                updateElement(selectedElement.id, { opacity: parseFloat(e.target.value) })
              }
            />
          </label>

          <BindField
            label="Largura:"
            numberValue={selectedElement.width}
            fieldValue={selectedElement.width_bind}
            tab={maxWidthTab}
            setTab={setMaxWidthTab}
            onNumberChange={value => updateElement(selectedElement.id, { width: value, width_bind: undefined })}
            onFieldChange={value => updateElement(selectedElement.id, { width_bind: value})}
            availableFields={sampleFields}
            fallbackNumber={selectedElement.width}
          />

          <BindField
            label="Altura:"
            numberValue={selectedElement.height}
            fieldValue={selectedElement.height_bind}
            tab={maxHeightTab}
            setTab={setMaxHeightTab}
            onNumberChange={value => updateElement(selectedElement.id, { height: value, height_bind: undefined })}
            onFieldChange={value => updateElement(selectedElement.id, { height_bind: value })}
            availableFields={sampleFields}
            fallbackNumber={selectedElement.height}
          />
        </>
      )}
      <hr />
      <label>Camadas</label>
      {/* Z-Index Controls */}
      <button onClick={() => updateElement(selectedElement.id, { zIndex: (selectedElement.zIndex ?? 0) + 1 })}>
        Trazer para frente
      </button>

      <button onClick={() => updateElement(selectedElement.id, { zIndex: (selectedElement.zIndex ?? 0) - 1 })}>
        Enviar para trás
      </button>

      <hr />
      <details className={styles.layerList} open>
        <summary>Elementos ({template.elements.length})</summary>
        <ul className={styles.elementList}>{[...template.elements].reverse().map((el) => <li key={el.id}><button className={`${styles.elementButton} ${el.id === selectedElement.id ? styles.currentElement : ""}`} aria-label={`Selecionar ${elementLabel(el)}`} onClick={() => useEditorStore.getState().setSelectedElement(el.id)}><span aria-hidden="true">{el.type.toLowerCase().includes("image") ? "▧" : "T"}</span><span>{elementLabel(el)}</span></button></li>)}</ul>
      </details>
      <button onClick={() => deleteElement(selectedElement.id)}>
        Excluir elemento
      </button>
    </div>
  )
}

