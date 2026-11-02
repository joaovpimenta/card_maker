import { useEffect, useRef, useState } from "react"
import { saveAs } from "file-saver"
import { useEditorStore } from "../store/editorStore"
import { executeCommand, getProject, exportCards } from "../project/commands"
import { renderCardToDataURL } from "../utils/renderCardsToCanvas"
import { saveJson } from "../utils/exportCards"
import {
  presets,
  presetIds,
  labels,
  suggestMapping,
  createPresetProject,
  classifyFile,
  mapRows,
  layoutElements,
  datasetFields,
  type PresetId
} from "./presets"
import { fitText } from "./rendering"
import type { Project } from "../project/project"
import styles from "./GuidedEditor.module.css"
import { CardPreview } from "./CardPreview"
import { ImageControls } from "./ImageControls"
import RuntimeNotices from "../app/RuntimeNotices"
import { Modal } from "../modal/Modal"

type Pending = {
  cards: Record<string, string>[]
  id: PresetId
  mapping: Record<string, string>
}
export default function GuidedEditor({
  onAdvanced,
  initialFile,
  onApplied
}: {
  onAdvanced: () => void
  initialFile?: File
  onApplied: () => void
}) {
  const template = useEditorStore((s) => s.template),
    cards = useEditorStore((s) => s.sampleCards),
    originals = useEditorStore((s) => s.originalSampleCards)
  const undo = useEditorStore((s) => s.undo),
    redo = useEditorStore((s) => s.redo),
    historyIndex = useEditorStore((s) => s.historyIndex),
    history = useEditorStore((s) => s.history)
  const hydration = useEditorStore((s) => s.hydrationStatus),
    storageError = useEditorStore((s) => s.storageError)
  const [index, setIndex] = useState(0),
    [gallery, setGallery] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null),
    [candidate, setCandidate] = useState<Project | null>(null)
  const [saved, setSaved] = useState("Salvo neste dispositivo")
  const fileRef = useRef<HTMLInputElement>(null),
    previewRef = useRef<HTMLDivElement>(null)
  const idx = Math.min(index, Math.max(0, cards.length - 1)),
    row = cards[idx] ?? {},
    original = originals[idx] ?? {}
  const id = template.guided?.id ?? "fantasy",
    preset = presets[id]
  const openGallery = gallery || !template.guided
  const save = () => saveJson(getProject(), "projeto.cardmaker.json")
  const uploadVersion = useRef(0)
  useEffect(
    () => () => {
      uploadVersion.current++
    },
    []
  )
  const apply = async (p: Project) => {
    uploadVersion.current++
    const result = await executeCommand({ type: "importProject", project: p })
    if (!result.ok) {
      setNotice(result.errors.map((e) => e.message).join("; "))
      return
    }
    setGallery(false)
    setCandidate(null)
    setPending(null)
    setIndex(0)
    onApplied()
    setNotice(
      `Projeto aberto: ${p.cards.length} carta(s), ${p.template.elements.length} elementos. Imagens incorporadas incluídas.`
    )
  }
  const change = (key: string, value: string) => {
    const p = getProject()
    p.cards[idx] = { ...p.cards[idx], [key]: value }
    useEditorStore.getState().replaceProject(p)
  }
  const upload = async (file?: File) => {
    if (!file) return
    try {
      const result = classifyFile(await file.text(), file.name)
      if (result.kind === "project") {
        setCandidate(result.project)
        setNotice(
          "Confira o projeto antes de abrir. O atual poderá ser recuperado com Desfazer."
        )
        return
      }
      const mapping = suggestMapping(result.cards, id)
      setPending({ cards: result.cards, id, mapping })
      setGallery(false)
      setCandidate(null)
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Não foi possível abrir o arquivo."
      )
    }
  }
  const uploadImage = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setNotice("Escolha uma imagem PNG, JPG, WebP ou SVG.")
      return
    }
    const version = ++uploadVersion.current,
      target = idx
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () =>
          reject(new Error("Não foi possível ler a imagem."))
        reader.readAsDataURL(file)
      })
      // Decode before changing the current project.
      const image = new Image()
      image.src = data
      await image.decode()
      if (version !== uploadVersion.current) return
      const project = getProject()
      if (!project.cards[target]) return
      project.cards[target] = { ...project.cards[target], image: data }
      useEditorStore.getState().replaceProject(project)
      setNotice("Imagem adicionada à carta selecionada.")
    } catch {
      setNotice("Imagem inválida ou não suportada. Tente PNG ou JPG.")
    }
  }
  const initialUpload = useRef<File | undefined>(undefined)
  useEffect(() => {
    if (initialFile && initialUpload.current !== initialFile) {
      initialUpload.current = initialFile
      void upload(initialFile)
    }
  })
  useEffect(() => {
    const receive = (event: Event) => {
      const file = (event as CustomEvent<File>).detail
      void upload(file)
    }
    window.addEventListener("card-maker-open-file", receive)
    return () => window.removeEventListener("card-maker-open-file", receive)
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const editing =
        e.target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
          e.target.isContentEditable)
      if (e.key === "Escape") {
        setExpanded(false)
        return
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "s") {
          e.preventDefault()
          save()
        }
        if (!editing && e.key.toLowerCase() === "z") {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        }
        if (!editing && e.key.toLowerCase() === "d") {
          e.preventDefault()
          duplicate()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })
  useEffect(() => {
    const saving = () => setSaved("Salvando…"),
      done = () => setSaved("Salvo neste dispositivo"),
      error = () => setSaved("Falha ao salvar neste dispositivo")
    window.addEventListener("card-maker-storage-saving", saving)
    window.addEventListener("card-maker-storage-saved", done)
    window.addEventListener("card-maker-storage-error", error)
    return () => {
      window.removeEventListener("card-maker-storage-saving", saving)
      window.removeEventListener("card-maker-storage-saved", done)
      window.removeEventListener("card-maker-storage-error", error)
    }
  }, [])
  const duplicate = () => {
    uploadVersion.current++
    const p = getProject()
    p.cards.splice(idx + 1, 0, { ...p.cards[idx] })
    useEditorStore.getState().replaceProject(p)
    setIndex(idx + 1)
  }
  const download = async (all = false) => {
    setBusy(true)
    setNotice("Preparando download…")
    try {
      if (all) await exportCards()
      else {
        const url = await renderCardToDataURL(template, row)
        const blob = await (await fetch(url)).blob()
        saveAs(blob, "carta.png")
      }
      setNotice("Download pronto.")
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao exportar.")
    } finally {
      setBusy(false)
    }
  }
  const art = template.elements.find((e) => e.id === "preset-image")
  const crop = (updates: Partial<NonNullable<typeof art>>) => {
    if (art) useEditorStore.getState().updateElement(art.id, updates)
  }
  const pendingProject = pending
    ? createPresetProject(
        pending.id,
        mapRows(pending.cards, pending.id, pending.mapping)
      )
    : null
  const focusField = (key: string) => {
    const field = document.getElementById(`field-${key}`)
    field?.focus()
    field?.scrollIntoView({ block: "center", behavior: "smooth" })
  }
  const fields = preset.fields
  const warnings = layoutElements(template, row).flatMap((el) =>
    el.type === "text" &&
    el.autoFit &&
    fitText(
      row[el.bind ?? ""] ?? "",
      el.fontFamily,
      el.fontSize,
      el.width,
      el.height
    ).overflow
      ? [labels[el.bind ?? ""] ?? el.bind]
      : []
  )
  return (
    <div className={styles.root}>
      <RuntimeNotices />
      <header className={styles.header}>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            setGallery(true)
          }}
        >
          Card Maker <small>crie sua próxima carta</small>
        </a>
        <div className={styles.actions}>
          <button onClick={() => fileRef.current?.click()}>
            Abrir arquivo
          </button>
          <button onClick={save} disabled={!template.elements.length}>
            Salvar projeto
          </button>
          <button onClick={undo} disabled={historyIndex <= 0}>
            Desfazer
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1}>
            Refazer
          </button>
          <button onClick={onAdvanced}>Personalizar layout</button>
          {template.guided&&!openGallery&&<button className={styles.desktopDownload} disabled={busy} onClick={()=>void download()}>Baixar carta</button>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,.tsv"
          aria-label="Abrir arquivo"
          className={styles.fileInput}
          onChange={(e) => {
            void upload(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </header>
      <div className={styles.status} role="status">
        {storageError || hydration === "error"
          ? "Falha no salvamento local. Salve uma cópia do projeto."
          : saved}
        {notice && <p>{notice}</p>}
      </div>
      {candidate ? (
        <section className={styles.importPanel}>
          <h1>Confira o projeto</h1>
          <p>
            {candidate.cards.length} carta(s) ·{" "}
            {candidate.template.elements.length} elementos. O arquivo inclui o
            layout.
          </p>
          <CardPreview
            template={candidate.template}
            row={candidate.cards[0] ?? {}}
          />
          <button onClick={() => void apply(candidate)}>
            Abrir este projeto
          </button>
          <button onClick={() => setCandidate(null)}>Cancelar</button>
        </section>
      ) : pending && pendingProject ? (
        <section className={styles.importPanel}>
          <h1>Transforme seus dados em cartas</h1>
          <label>
            Modelo
            <select
              value={pending.id}
              onChange={(e) => {
                const next = e.target.value as PresetId
                const mapping = suggestMapping(pending.cards, next)
                setPending({ ...pending, id: next, mapping })
              }}
            >
              {presetIds.map((key) => (
                <option key={key} value={key}>
                  {presets[key].name}
                </option>
              ))}
            </select>
          </label>
          <p>
            Escolha a coluna de cada informação. As outras colunas serão
            preservadas.
          </p>
          <div className={styles.mapping}>
            {[...presets[pending.id].fields, "image"].map((key) => (
              <label key={key}>
                {labels[key]}
                <select
                  value={pending.mapping[key] ?? ""}
                  onChange={(e) =>
                    setPending({
                      ...pending,
                      mapping: { ...pending.mapping, [key]: e.target.value }
                    })
                  }
                >
                  <option value="">Sem coluna</option>
                  {datasetFields(pending.cards).map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <CardPreview
            template={pendingProject.template}
            row={pendingProject.cards[0]}
          />
          <button onClick={() => void apply(pendingProject)}>
            Criar {pending.cards.length} carta(s)
          </button>
          <button onClick={() => setPending(null)}>Cancelar</button>
        </section>
      ) : openGallery ? (
        <section className={styles.gallery}>
          <p className={styles.eyebrow}>ESCOLHA • PREENCHA • BAIXE</p>
          <h1>Que carta você quer criar?</h1>
          <p>
            Escolha um modelo pronto. Depois, troque o texto e adicione sua
            imagem.
          </p>
          {template.guided && (
            <button onClick={() => setGallery(false)}>
              Continuar editando {row.name || "sua carta"}
            </button>
          )}
          <div className={styles.presetGrid}>
            {presetIds.map((key) => {
              const p = createPresetProject(key)
              return (
                <button
                  className={styles.preset}
                  key={key}
                  onClick={() => {
                    const next = createPresetProject(
                      key,
                      originals.length ? mapRows(originals, key) : undefined,
                      template.guided?.color
                    )
                    next.processRules = getProject().processRules
                    if (!template.elements.length && !originals.length)
                      void apply(next)
                    else setCandidate(next)
                  }}
                >
                  <CardPreview template={p.template} row={p.cards[0]} />
                  <strong>{presets[key].name}</strong>
                  <span>{presets[key].description}</span>
                </button>
              )
            })}
            <button
              className={styles.preset}
              onClick={() => {
                if (
                  template.elements.length &&
                  !window.confirm(
                    "Criar um projeto em branco? Você pode desfazer."
                  )
                )
                  return
                void executeCommand({ type: "newProject" }).then(onAdvanced)
              }}
            >
              <div className={styles.blank}>＋</div>
              <strong>Em branco</strong>
              <span>Monte seu próprio layout no editor livre.</span>
            </button>
          </div>
        </section>
      ) : (
        <>
          <main className={styles.editor}>
            <div className={styles.form}>
              <div className={styles.sectionHead}>
                <div>
                  <p className={styles.eyebrow}>{preset.name}</p>
                  <h1>Crie sua carta</h1>
                </div>
                <button onClick={() => setGallery(true)}>Trocar modelo</button>
              </div>
              <section>
                <h2>Conteúdo</h2>
                <p>
                  Preencha o que quiser mostrar. Campos vazios são opcionais.
                </p>
                {fields.map((key) => (
                  <label key={key} htmlFor={`field-${key}`}>
                    {labels[key]}{" "}
                    <small>{key === "name" ? "" : "opcional"}</small>
                    {[
                      "description",
                      "flavor",
                      "question",
                      "answer",
                      "abilities"
                    ].includes(key) ? (
                      <textarea
                        id={`field-${key}`}
                        value={original[key] ?? ""}
                        onChange={(e) => change(key, e.target.value)}
                        rows={key === "description" ? 3 : 2}
                      />
                    ) : (
                      <input
                        id={`field-${key}`}
                        inputMode={
                          ["power", "toughness"].includes(key)
                            ? "numeric"
                            : undefined
                        }
                        value={original[key] ?? ""}
                        onChange={(e) => change(key, e.target.value)}
                      />
                    )}
                  </label>
                ))}
                {warnings.length > 0 && (
                  <p role="alert">
                    Texto ainda não cabe: {warnings.join(", ")}. Reduza o
                    conteúdo; a fonte já foi ajustada automaticamente.
                  </p>
                )}
              </section>
              <ImageControls
                image={row.image}
                art={art}
                uploadImage={uploadImage}
                crop={crop}
              />
              <section>
                <h2>Aparência</h2>
                <p>O modelo e as cores se aplicam a todas as cartas.</p>
                <div className={styles.actions}>
                  {["#244c63", "#375344", "#713e50", "#77542f"].map((color) => (
                    <button
                      key={color}
                      aria-label={`Cor ${color}`}
                      aria-pressed={template.guided?.color === color}
                      style={{ borderBottom: `8px solid ${color}` }}
                      onClick={() => {
                        const p = getProject()
                        p.template.guided!.color = color
                        useEditorStore.getState().replaceProject(p)
                      }}
                    >
                      ●
                    </button>
                  ))}
                  <label>
                    Cor personalizada
                    <input
                      type="color"
                      value={template.guided?.color}
                      onChange={(e) => {
                        const p = getProject()
                        p.template.guided!.color = e.target.value
                        useEditorStore.getState().replaceProject(p)
                      }}
                    />
                  </label>
                </div>
              </section>
            </div>
            <div
              className={styles.previewPane}
              ref={previewRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                void uploadImage(e.dataTransfer.files[0])
              }}
            >
              <div className={styles.previewHead}>
                <h2>Prévia da carta</h2>
                <button onClick={() => setExpanded(true)}>
                  Ampliar prévia
                </button>
              </div>
              <CardPreview template={template} row={row} onField={focusField} />
              <nav aria-label="Cartas" className={styles.cardList}>
                {cards.map((card, i) => (
                  <button
                    key={i}
                    aria-current={i === idx ? "true" : undefined}
                    onClick={() => {
                      uploadVersion.current++
                      setIndex(i)
                    }}
                  >
                    <CardPreview template={template} row={card} />
                    <span>
                      {i + 1}. {card.name || "Sem nome"}
                    </span>
                  </button>
                ))}
              </nav>
              <div className={styles.actions}>
                <button
                  onClick={() => {
                    uploadVersion.current++
                    const p = getProject()
                    p.cards.push({ name: "Nova carta", image: "" })
                    useEditorStore.getState().replaceProject(p)
                    setIndex(p.cards.length - 1)
                  }}
                >
                  Nova carta
                </button>
                <button onClick={duplicate}>Duplicar carta</button>
                {cards.length > 1 && (
                  <button disabled={busy} onClick={() => void download(true)}>
                    Baixar todas
                  </button>
                )}
              </div>
            </div>
          </main>
          <div className={styles.mobileBar}>
            <button onClick={() => setExpanded(true)}>Ver carta</button>
            <button disabled={busy} onClick={() => void download()}>
              Baixar
            </button>
          </div>
        </>
      )}
      {expanded && (
        <Modal title="Prévia ampliada" onClose={() => setExpanded(false)}>
          <button onClick={() => setExpanded(false)}>Voltar à edição</button>
          <CardPreview template={template} row={row} />
        </Modal>
      )}
    </div>
  )
}
