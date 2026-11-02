import { useEffect, useState } from "react"
import type { Project } from "../project/project"
import { renderCardToDataURL } from "../utils/renderCardsToCanvas"
import { layoutElements, labels } from "./presets"
import styles from "./GuidedEditor.module.css"
export function CardPreview({
  template,
  row,
  onField
}: {
  template: Project["template"]
  row: Record<string, string>
  onField?: (key: string) => void
}) {
  const [preview, setPreview] = useState<{ url: string; error: string }>({
    url: "",
    error: ""
  })
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      void renderCardToDataURL(template, row)
        .then((url) => {
          if (active) setPreview({ url, error: "" })
        })
        .catch((e) => {
          if (active)
            setPreview({
              url: "",
              error: e instanceof Error ? e.message : "Erro na prévia"
            })
        })
    }, 100)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [template, row])
  return (
    <div
      className={styles.cardPreview}
      style={{ aspectRatio: `${template.width}/${template.height}` }}
    >
      {preview.url ? (
        <img src={preview.url} alt={`Prévia de ${row.name || "carta"}`} />
      ) : (
        <p role={preview.error ? "alert" : "status"}>
          {preview.error || "Preparando prévia…"}
        </p>
      )}
      {onField &&
        layoutElements(template, row)
          .filter((e) => e.type === "text" || e.type === "image")
          .map((el) =>
            "bind" in el && el.bind ? (
              <button
                key={el.id}
                className={styles.hitArea}
                aria-label={`Editar ${labels[el.bind] ?? el.bind}`}
                style={{
                  left: `${(el.x / template.width) * 100}%`,
                  top: `${(el.y / template.height) * 100}%`,
                  width: `${(el.width / template.width) * 100}%`,
                  height: `${(el.height / template.height) * 100}%`
                }}
                onClick={() => onField(el.bind!)}
              />
            ) : null
          )}
    </div>
  )
}
