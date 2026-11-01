import JSZip from "jszip"
import { saveAs } from "file-saver"
import { useEditorStore } from "../store/editorStore"
import { renderCardToDataURL } from "./renderCardsToCanvas"

export function saveJson(value: unknown, filename: string) {
  saveAs(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), filename)
}

export async function exportCards(options?: {
  download?: boolean
  onProgress?: (current: number, total: number) => void
}): Promise<{ filename: string; blob: Blob; count: number }> {
  const { template, sampleCards } = useEditorStore.getState()
  if (!template.elements.length) throw new Error("Adicione ao menos um elemento ao design antes de exportar.")
  const snapshot = structuredClone(template)
  const cards = structuredClone(sampleCards.length ? sampleCards : [{}])
  const zip = new JSZip()
  options?.onProgress?.(0, cards.length)
  for (let i = 0; i < cards.length; i++) {
    try {
      const dataURL = await renderCardToDataURL(snapshot, cards[i]!)
      zip.file(`carta_${String(i + 1).padStart(3, "0")}.png`, dataURL.split(",")[1]!, { base64: true })
    } catch (error) {
      throw new Error(`Carta ${i + 1}: ${error instanceof Error ? error.message : "falha ao renderizar imagem ou fonte."}`)
    }
    options?.onProgress?.(i + 1, cards.length)
    await new Promise<void>(resolve => window.setTimeout(resolve, 0))
  }
  const blob = await zip.generateAsync({ type: "blob" })
  const filename = "cartas.zip"
  if (options?.download !== false) saveAs(blob, filename)
  return { filename, blob, count: cards.length }
}
