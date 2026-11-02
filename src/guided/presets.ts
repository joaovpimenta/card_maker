import { parseDataset, parseProject, type Project } from "../project/project"
import type { CardTemplate } from "../models/Template"
import type { CardElement } from "../models/Element"
export const presetIds = [
  "fantasy",
  "character",
  "education",
  "product"
] as const
export type PresetId = (typeof presetIds)[number]
export const presets = {
  fantasy: {
    name: "Fantasia",
    description: "Habilidades, custo e ataque/defesa.",
    fields: [
      "name",
      "mana",
      "type",
      "abilities",
      "description",
      "flavor",
      "power",
      "toughness"
    ]
  },
  character: {
    name: "Personagem",
    description: "Nome, classe, história e atributos.",
    fields: ["name", "type", "description", "power", "toughness"]
  },
  education: {
    name: "Educativo",
    description: "Uma pergunta e sua resposta ilustrada.",
    fields: ["name", "question", "answer"]
  },
  product: {
    name: "Produto",
    description: "Imagem, descrição e preço.",
    fields: ["name", "description", "price"]
  }
} satisfies Record<
  PresetId,
  { name: string; description: string; fields: string[] }
>
export const labels: Record<string, string> = {
  name: "Nome",
  image: "Imagem",
  mana: "Custo",
  type: "Tipo / classe",
  abilities: "Habilidades",
  description: "Descrição",
  flavor: "Frase",
  power: "Ataque",
  toughness: "Defesa",
  question: "Pergunta",
  answer: "Resposta",
  price: "Preço"
}
export const aliases: Record<string, string[]> = {
  name: ["nome", "title", "titulo", "título"],
  image: ["imagem", "foto", "art", "image_url"],
  mana: ["custo", "mana_cost"],
  type: ["tipo", "classe"],
  description: ["descricao", "descrição", "summary"],
  abilities: ["habilidades"],
  flavor: ["frase", "flavor_text"],
  power: ["ataque"],
  toughness: ["defesa"],
  question: ["pergunta"],
  answer: ["resposta"],
  price: ["preco", "preço"]
}
const svgUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`
export const placeholder = svgUri(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#dbe7e9"/><path d="m100 310 130-150 100 100 65-70 110 120" fill="#8ca8ac"/><circle cx="390" cy="95" r="35" fill="#f5f0dd"/><text x="300" y="365" font-family="Arial" font-size="22" text-anchor="middle" fill="#38545b">Sua imagem aqui</text></svg>'
)
export function createPresetProject(
  id: PresetId,
  cards?: Record<string, string>[],
  color = "#244c63"
): Project {
  const guided = { id, version: 1 as const, color }
  const template: CardTemplate = {
    width: 630,
    height: 880,
    customFonts: [],
    elements: [],
    guided
  }
  const row = {
    name:
      id === "fantasy"
        ? "Killua"
        : id === "character"
          ? "Sua personagem"
          : id === "education"
            ? "Descubra a natureza"
            : "Seu produto",
    image: "",
    mana: "2 U U",
    type: "Criatura Lendária — Assassino",
    abilities: "Iniciativa, ímpeto",
    description:
      "Velocidade divina — Ao atacar, vire uma criatura do oponente.",
    flavor: "Um amigo vale mais que qualquer missão.",
    power: "3",
    toughness: "2",
    question: "O que as plantas precisam para crescer?",
    answer: "Água, luz e nutrientes.",
    price: "R$ 29,90"
  }
  const rows = cards ?? [row]
  template.elements = layoutElements(template, rows[0] ?? {})
  return parseProject({ version: 1, template, cards: rows, processRules: [] })
}
/** Reflow optional fields for each row, using a single layout for preview and export. */
export function layoutElements(
  template: CardTemplate,
  row: Record<string, string>
): CardElement[] {
  if (!template.guided) return template.elements
  const { id, color } = template.guided
  const frame = svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880"><rect width="630" height="880" rx="28" fill="#101c28"/><rect x="15" y="15" width="600" height="850" rx="22" fill="${color}"/><rect x="30" y="30" width="570" height="64" rx="15" fill="#f3eddc"/><rect x="30" y="108" width="570" height="425" rx="10" fill="#fff"/><rect x="30" y="550" width="570" height="300" rx="16" fill="#f3eddc"/></svg>`
  )
  const e: CardElement[] = [
    {
      id: "preset-frame",
      type: "staticImage",
      src: frame,
      x: 0,
      y: 0,
      width: 630,
      height: 880
    },
    {
      id: "preset-image",
      type: "image",
      bind: "image",
      src: placeholder,
      x: 30,
      y: 108,
      width: 570,
      height: 425,
      fit: "cover",
      ...Object.fromEntries(
        Object.entries(
          template.elements.find((el) => el.id === "preset-image") ?? {}
        ).filter(([k]) => ["fit", "cropX", "cropY", "zoom"].includes(k))
      )
    }
  ]
  const text = (
    key: string,
    y: number,
    height: number,
    size: number,
    x = 48,
    width = 534
  ) =>
    e.push({
      id: `preset-${key}`,
      type: "text",
      bind: key,
      x,
      y,
      width,
      height,
      fontSize: size,
      fontFamily: "Georgia",
      color: "#152b3a",
      align: "left",
      autoFit: true
    })
  text("name", 45, 45, 36, 48, id === "fantasy" ? 370 : 534)
  if (id === "fantasy" && row.mana) text("mana", 48, 40, 25, 440, 140)
  let y = 570
  const keys = presets[id].fields.filter(
    (key) => !["name", "mana", "power", "toughness"].includes(key) && !!row[key]
  )
  const heights: Record<string, number> = {
    type: 40,
    abilities: 42,
    description: 100,
    flavor: 55,
    question: 85,
    answer: 95,
    price: 65
  }
  const hasStats =
    presets[id].fields.includes("power") && !!(row.power || row.toughness)
  const bottom = hasStats ? 790 : 830
  const available = bottom - y - Math.max(0, keys.length - 1) * 10
  const weight = keys.reduce((sum, key) => sum + (heights[key] ?? 60), 0)
  for (const key of keys) {
    const h = (available * (heights[key] ?? 60)) / weight
    text(
      key,
      y,
      h,
      key === "type" ? 22 : key === "price" ? 32 : key === "flavor" ? 18 : 23
    )
    y += h + 10
  }
  if (hasStats) {
    text("power", 812, 30, 25, 490, 45)
    text("toughness", 812, 30, 25, 552, 45)
    if (row.power && row.toughness)
      e.push({
        id: "preset-divider",
        type: "staticText",
        text: "/",
        x: 535,
        y: 812,
        width: 15,
        height: 30,
        fontSize: 25,
        fontFamily: "Georgia",
        color: "#152b3a",
        align: "center"
      })
  }
  return e
}
export function mapRows(
  rows: Record<string, string>[],
  id: PresetId,
  mapping?: Record<string, string>
): Record<string, string>[] {
  return rows.map((row) => {
    const result = { ...row }
    for (const key of [...presets[id].fields, "image"]) {
      const source = mapping
        ? mapping[key]
        : Object.hasOwn(row, key)
          ? key
          : Object.keys(row).find((k) =>
              [key, ...(aliases[key] ?? [])].includes(k.toLowerCase().trim())
            )
      result[key] = source ? (row[source] ?? "") : ""
    }
    return result
  })
}
export function classifyFile(
  text: string,
  name: string
):
  | { kind: "project"; project: Project }
  | { kind: "dataset"; cards: Record<string, string>[] } {
  if (name.toLowerCase().endsWith(".json")) {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return { kind: "project", project: parseProject(parsed) }
  }
  const cards = parseDataset(text.replace(/^\uFEFF/, ""), name)
  if (!cards.length) throw new Error("O arquivo não contém cartas.")
  return { kind: "dataset", cards }
}

/** Materialize every populated field before entering the unrestricted editor. */
export function detachGuided(
  template: CardTemplate,
  cards: Record<string, string>[]
): CardTemplate {
  if (!template.guided) return template
  const union: Record<string, string> = {}
  for (const row of cards)
    for (const [key, value] of Object.entries(row))
      if (value) union[key] = value
  const plain = { ...template, elements: layoutElements(template, union) }
  delete plain.guided
  return plain
}
export function datasetFields(cards: Record<string, string>[]) {
  return [...new Set(cards.flatMap((row) => Object.keys(row)))]
}

export function suggestMapping(cards: Record<string, string>[], id: PresetId) {
  const fields = datasetFields(cards)
  return Object.fromEntries(
    [...presets[id].fields, "image"].map((key) => [
      key,
      fields.includes(key)
        ? key
        : (fields.find((field) =>
            [key, ...(aliases[key] ?? [])].includes(field.toLowerCase().trim())
          ) ?? "")
    ])
  )
}
