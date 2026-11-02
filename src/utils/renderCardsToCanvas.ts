import type { CardTemplate } from "../models/Template"

// Renders one card to a canvas and returns a data URL
import Konva from "konva"
import { layoutElements, placeholder } from "../guided/presets"
import { imageGeometry, fitText } from "../guided/rendering"
import { resolveText, resolveImage } from "./jsonBinding"
import type { CardElement } from "../models/Element"
import { ensureTemplateFonts } from "./googleFonts"

const STATIC_IMAGE_PROXY = import.meta.env.VITE_STATIC_IMAGE_PROXY

function boundDimension(
  cardData: Record<string, string>,
  key: string | undefined,
  fallback: number
) {
  if (!key) return fallback
  const bound = Number.parseInt(cardData[key] ?? "", 10)
  return Number.isFinite(bound) && bound > 0 ? bound : fallback
}

export async function renderCardToDataURL(
  template: CardTemplate,
  cardData: Record<string, string>
): Promise<string> {
  const stage = new Konva.Stage({
    width: template.width,
    height: template.height,
    container: document.createElement("div")
  })

  const layer = new Konva.Layer()
  stage.add(layer)

  try {
    await ensureTemplateFonts(template)
    const fonts = [
      ...new Set(
        template.elements
          .filter((el) => el.type === "text" || el.type === "staticText")
          .map((el) => `${el.fontSize}px "${el.fontFamily}"`)
      )
    ]
    await Promise.all(fonts.map((font) => document.fonts.load(font)))
    for (const el of [...layoutElements(template, cardData)].sort(
      (a: CardElement, b: CardElement) => (a.zIndex ?? 0) - (b.zIndex ?? 0)
    )) {
      if (el.type === "text" || el.type === "staticText") {
        const width = boundDimension(
          cardData,
          el.width_bind,
          el.maxWidth ?? el.width
        )
        const height = boundDimension(
          cardData,
          el.height_bind,
          el.maxHeight ?? el.height
        )

        layer.add(
          new Konva.Text({
            x: el.x,
            y: el.y,
            width: width,
            height: height,
            text:
              el.type === "staticText" ? el.text : resolveText(el, cardData),
            fontSize: el.autoFit
              ? fitText(
                  el.type === "staticText"
                    ? el.text
                    : resolveText(el, cardData),
                  el.fontFamily,
                  el.fontSize,
                  width,
                  height
                ).fontSize
              : el.fontSize,
            fontFamily: el.fontFamily,
            fill: el.color,
            align: el.align ?? "left",
            verticalAlign: "top",
            wrap: "word",
            opacity: el.opacity
          })
        )
      }

      if (el.type === "image" || el.type === "staticImage") {
        const img = new Image()
        img.crossOrigin = "anonymous"
        let imageUrl =
          el.type === "staticImage" ? el.src : resolveImage({ ...el }, cardData)
        if (!imageUrl) imageUrl = placeholder
        if (
          el.type === "image" &&
          STATIC_IMAGE_PROXY &&
          !imageUrl.startsWith("data:")
        )
          imageUrl = STATIC_IMAGE_PROXY + encodeURIComponent(imageUrl)
        img.src = imageUrl

        let imageTimeout: ReturnType<typeof setTimeout> | undefined
        try {
          await Promise.race([
            img.decode(),
            new Promise<never>((_, reject) => {
              imageTimeout = setTimeout(
                () =>
                  reject(new Error("A imagem demorou demais para carregar.")),
                15000
              )
            })
          ])
        } catch {
          img.src = ""
          throw new Error(
            `Não foi possível carregar a imagem do elemento ${el.id}. Verifique a URL e a permissão de acesso (CORS).`
          )
        } finally {
          clearTimeout(imageTimeout)
        }

        const width = boundDimension(cardData, el.width_bind, el.width)
        const height = boundDimension(cardData, el.height_bind, el.height)

        const geometry = imageGeometry(el, img.width, img.height, width, height)
        const group = new Konva.Group({
          x: el.x,
          y: el.y,
          clipX: 0,
          clipY: 0,
          clipWidth: width,
          clipHeight: height
        })
        group.add(
          new Konva.Image({ ...geometry, opacity: el.opacity, image: img })
        )
        layer.add(group)
      }
    }

    layer.draw()

    return stage.toDataURL({ pixelRatio: 2 })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("taint")
    ) {
      throw new Error(
        "Uma imagem não pôde ser exportada porque o servidor não permite acesso entre origens (CORS).",
        { cause: error }
      )
    }
    throw error
  } finally {
    stage.destroy()
  }
}
