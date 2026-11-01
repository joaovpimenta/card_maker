import type { CardTemplate } from "../models/Template"

const loadedFonts = new Map<string, Promise<void>>()

export function parseGoogleFontName(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" || parsed.hostname !== "fonts.googleapis.com" || !["/css", "/css2"].includes(parsed.pathname)) return null
    return parsed.searchParams.get("family")?.split(":")[0]?.trim() || null
  } catch { return null }
}

export function loadGoogleFont(url: string): Promise<void> {
  if (!parseGoogleFontName(url)) return Promise.reject(new Error("Use um link HTTPS de fonts.googleapis.com/css ou /css2 com o parâmetro family."))
  const existing = loadedFonts.get(url)
  if (existing) return existing
  const promise = new Promise<void>((resolve, reject) => {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = url
    const timeout = window.setTimeout(() => fail(), 15000)
    const fail = () => {
      window.clearTimeout(timeout)
      link.remove()
      loadedFonts.delete(url)
      reject(new Error(`Não foi possível carregar a fonte “${parseGoogleFontName(url)}”. Verifique a conexão ou use uma fonte do sistema.`))
    }
    link.onload = () => { window.clearTimeout(timeout); resolve() }
    link.onerror = fail
    document.head.appendChild(link)
  })
  loadedFonts.set(url, promise)
  return promise
}

/** Only Google Fonts are added by the UI; persist family names and rebuild their CSS on import/reload. */
export async function ensureTemplateFonts(template: CardTemplate): Promise<void> {
  await Promise.all(template.customFonts.map(family => {
    const query = new URLSearchParams({ family, display: "swap" })
    return loadGoogleFont(`https://fonts.googleapis.com/css2?${query}`)
  }))
}
