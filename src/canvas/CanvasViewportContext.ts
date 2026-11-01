import { createContext, useContext } from "react"

export interface CanvasViewport {
  scale: number
  x: number
  y: number
  panMode: boolean
}

export const CanvasViewportContext = createContext<CanvasViewport | null>(null)

export function useCanvasViewport() {
  return useContext(CanvasViewportContext)
}
