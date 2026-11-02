import Konva from "konva"
import type { BaseElement } from "../models/Element"
export function imageGeometry(
  el: BaseElement,
  iw: number,
  ih: number,
  width = el.width,
  height = el.height
) {
  const scale =
    (el.fit === "cover"
      ? Math.max(width / iw, height / ih)
      : Math.min(width / iw, height / ih)) * (el.zoom ?? 1)
  const w = iw * scale,
    h = ih * scale
  return {
    width: w,
    height: h,
    x: (width - w) * (el.cropX ?? 0.5),
    y: (height - h) * (el.cropY ?? 0.5)
  }
}
export function fitText(
  text: string,
  fontFamily: string,
  size: number,
  width: number,
  height: number
) {
  const node = new Konva.Text({
    text,
    fontFamily,
    fontSize: size,
    width,
    wrap: "word"
  })
  const min = Math.min(size, Math.max(14, Math.round(size * 0.65)))
  while (node.height() > height && node.fontSize() > min)
    node.fontSize(node.fontSize() - 1)
  const result = { fontSize: node.fontSize(), overflow: node.height() > height }
  node.destroy()
  return result
}
