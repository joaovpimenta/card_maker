import { useState, useMemo } from "react"
import { v4 as uuidv4 } from "uuid"
import { useEditorStore } from "../store/editorStore"
import styles from "./Toolbar.module.css"
import { ProcessRulesModal } from "../modal/ProcessRuleModal"
import { SAFE_MARGIN } from "../canvas/CanvasStage"
import { openEditorFile } from "../guided/openFile"

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

  const activeField=jsonFields.includes(selectedField)?selectedField:jsonFields[0]??""

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
    void openEditorFile(file).then(()=>setDatasetError("")).catch(err=>setDatasetError(err instanceof Error?err.message:"Não foi possível abrir o arquivo."))
    e.target.value = ""
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
        <select id="element-binding" disabled={!jsonFields.length} value={activeField} onChange={(e) => setSelectedField(e.target.value)}>
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
        bind: activeField,
        zIndex: 1
      })} disabled={!jsonFields.length}>Adicionar texto vinculado</button>

      <button onClick={() => addElement({
        id: uuidv4(),
        type: "image",
        x: SAFE_MARGIN + 2,
        y: SAFE_MARGIN + 2,
        width: width / 2,
        height: height / 2,
        bind: activeField,
        zIndex: 1
      })} disabled={!jsonFields.length}>Adicionar imagem vinculada</button>

      {showRules && <ProcessRulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}

