import type { CardTemplate } from "../models/Template"

export type ReviewIssue = { elementId: string; message: string; card?: number }
export function reviewProject(template: CardTemplate, cards: Record<string, string>[]): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  for (const element of template.elements) {
    const name = element.type === "staticText" ? element.text.slice(0, 30) : element.id
    if (element.x < 0 || element.y < 0 || element.x + element.width > template.width || element.y + element.height > template.height) {
      issues.push({ elementId: element.id, message: `“${name}” ultrapassa os limites da carta.` })
    }
    if ((element.type === "text" || element.type === "image") && element.bind) {
      const missing = cards.findIndex(card => card[element.bind!] == null || card[element.bind!] === "")
      if (missing >= 0) issues.push({ elementId: element.id, card: missing + 1, message: `O campo “${element.bind}” está vazio na carta ${missing + 1}.` })
    }
    if ((element.type === "text" || element.type === "image") && !element.bind && !(element.type === "text" ? element.staticText : element.src)) {
      issues.push({ elementId: element.id, message: `“${name}” precisa de um campo de dados ou conteúdo.` })
    }
  }
  return issues
}
