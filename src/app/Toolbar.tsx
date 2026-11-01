import { useState, useMemo, useEffect } from "react"
import { v4 as uuidv4 } from "uuid"
import { useEditorStore } from "../store/editorStore"
import styles from "./Toolbar.module.css"
import { ProcessRulesModal } from "../modal/ProcessRuleModal"
import { SAFE_MARGIN } from "../canvas/CanvasStage"
import { executeCommand } from "../project/commands"
import { parseDataset } from "../project/project"

export default function Toolbar() {
  const addElement = useEditorStore((s) => s.addElement)
  const sampleCards = useEditorStore((s) => s.sampleCards)
  const width = useEditorStore((s) => s.template.width)
  const height = useEditorStore((s) => s.template.height)

  const jsonFields = useMemo(() => {
    const allKeys = new Set<string>()
    sampleCards.forEach(card => Object.keys(card).forEach(key => allKeys.add(key)))
    return Array.from(allKeys)
  }, [sampleCards])
  const [selectedField, setSelectedField] = useState<string>("")
  const [showRules, setShowRules] = useState(false)
  const [datasetError, setDatasetError] = useState("")

  useEffect(() => {
    if (jsonFields.length === 0) return
    if (!selectedField || !jsonFields.includes(selectedField)) setSelectedField(jsonFields[0])
  }, [jsonFields, selectedField])

  const handleStaticImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      addElement({
        id: uuidv4(),
        type: "staticImage",
        x: SAFE_MARGIN + 2,
        y: SAFE_MARGIN + 2,
        width: width / 2,
        height: height / 2,
        src: reader.result as string,
        zIndex: 0
      })
    }
    reader.readAsDataURL(file)
  }

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file)
      return
    if (sampleCards.length && !window.confirm("Substituir os dados atuais pelo arquivo selecionado?")) { e.target.value = ""; return }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        let data: Record<string, string>[] = [];
        if (file.name.toLowerCase().endsWith(".json")) {
          data = JSON.parse(reader.result as string)
          if (!Array.isArray(data)) throw new Error("O JSON precisa conter uma lista de registros.")
        } else if (/\.(csv|tsv)$/i.test(file.name)) {
          data = parseDataset(reader.result as string, file.name)
        } else throw new Error("Use um arquivo CSV, TSV ou JSON.")
        void executeCommand({ type: "setDataset", cards: data }).then(result => setDatasetError(result.ok ? "" : result.errors.map(item => item.message).join("; ")))
      }
      catch (err) {
        setDatasetError(err instanceof Error ? err.message : "Não foi possível ler o arquivo.")
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className={styles.toolbar}>
      <h2>Adicionar ao cartão</h2>

      <h3>Elementos fixos</h3>
      <p className={styles.hint}>Texto e imagens iguais em todas as cartas, como o nome do jogo ou uma moldura.</p>
      <button onClick={() => {
        const text = prompt("Digite o texto")
        if (!text) return
        addElement({
          id: uuidv4(),
          type: "staticText",
          x: SAFE_MARGIN + 2,
          y: SAFE_MARGIN + 2,
          width: width - ((SAFE_MARGIN + 4) * 2),
          height: 30,
          fontSize: 30,
          fontFamily: "Arial",
          color: "black",
          align: "center",
          text,
          zIndex: 2
        })
      }}>Adicionar texto fixo</button>

      <label>
        Carregar imagem fixa
        <input type="file" accept="image/*" onChange={handleStaticImageUpload} />
      </label>

      <hr />

      <h3>Elementos com dados</h3>
      <p className={styles.hint}>Escolha um campo para variar o conteúdo em cada carta. Por exemplo: nome, custo ou imagem.</p>
      <label>
        Carregar CSV, TSV ou JSON
        <input type="file" accept=".json,.csv,.tsv" onChange={handleJsonUpload} />
      </label>

      {datasetError && <p role="alert">{datasetError}</p>}
      <button onClick={() => setShowRules(true)}>
        Regras de dados
      </button>

      <div>
        <label htmlFor="element-binding">Campo para vincular</label>
        <select id="element-binding" disabled={!jsonFields.length} value={selectedField} onChange={(e) => setSelectedField(e.target.value)}>
          {jsonFields.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      {!jsonFields.length && <p className={styles.hint}>Carregue dados na etapa Dados para habilitar os elementos vinculados.</p>}

      <button onClick={() => addElement({
        id: uuidv4(),
        type: "text",
        x: SAFE_MARGIN + 2,
        y: SAFE_MARGIN,
        width: width - ((SAFE_MARGIN + 4) * 2),
        height: 40,
        fontSize: 30,
        fontFamily: "Arial",
        color: "black",
        align: "center",
        bind: selectedField,
        zIndex: 1
      })} disabled={!jsonFields.length}>Adicionar texto vinculado</button>

      <button onClick={() => addElement({
        id: uuidv4(),
        type: "image",
        x: SAFE_MARGIN + 2,
        y: SAFE_MARGIN + 2,
        width: width / 2,
        height: height / 2,
        bind: selectedField,
        zIndex: 1
      })} disabled={!jsonFields.length}>Adicionar imagem vinculada</button>

      {showRules && <ProcessRulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}

