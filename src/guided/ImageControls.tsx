import { useRef } from "react"
import type { CardElement } from "../models/Element"
import styles from "./GuidedEditor.module.css"
export function ImageControls({
  image,
  art,
  uploadImage,
  crop
}: {
  image: string
  art?: CardElement
  uploadImage: (file?: File) => Promise<void>
  crop: (updates: Partial<CardElement>) => void
}) {
  const imageRef = useRef<HTMLInputElement>(null)
  return (
    <section
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void uploadImage(e.dataTransfer.files[0])
      }}
      onPaste={(e) => {
        const file = Array.from(e.clipboardData.files)[0]
        if (file) {
          e.preventDefault()
          void uploadImage(file)
        }
      }}
    >
      <h2>Imagem</h2>
      <button
        id="field-image"
        className={styles.upload}
        onClick={() => imageRef.current?.click()}
      >
        {image ? "Trocar imagem" : "Toque para escolher uma imagem"}
      </button>
      <input
        ref={imageRef}
        className={styles.fileInput}
        type="file"
        accept="image/*"
        aria-label="Imagem da carta"
        onChange={(e) => {
          void uploadImage(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <label className={styles.camera}>
        Usar câmera
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            void uploadImage(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </label>
      <p>Você também pode arrastar ou colar uma imagem aqui.</p>
      {!image && <p>Imagem provisória. Envie sua imagem quando quiser.</p>}
      <label>
        Enquadramento
        <select
          aria-label="Enquadramento"
          value={art?.fit ?? "cover"}
          onChange={(e) => crop({ fit: e.target.value as "cover" | "contain" })}
        >
          <option value="cover">Preencher</option>
          <option value="contain">Mostrar inteira</option>
        </select>
      </label>
      <h3>Reposicionar</h3>
      <p>O enquadramento se aplica a todas as cartas.</p>
      {[
        ["zoom", "Zoom", 1, 4, 0.05],
        ["cropX", "Horizontal", 0, 1, 0.01],
        ["cropY", "Vertical", 0, 1, 0.01]
      ].map(([key, label, min, max, step]) => (
        <label key={key}>
          {label}
          <input
            type="range"
            aria-label={String(label)}
            min={Number(min)}
            max={Number(max)}
            step={Number(step)}
            value={
              art?.[key as "zoom" | "cropX" | "cropY"] ??
              (key === "zoom" ? 1 : 0.5)
            }
            onChange={(e) => crop({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <button
        onClick={() => crop({ fit: "cover", zoom: 1, cropX: 0.5, cropY: 0.5 })}
      >
        Restaurar enquadramento
      </button>
    </section>
  )
}
