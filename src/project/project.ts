import { z } from "zod"

const baseElement = z.object({
  id: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  opacity: z.number().min(0).max(1).optional(),
  zIndex: z.number().finite().optional(),
  autoFit: z.boolean().optional(),
  fit: z.enum(["contain", "cover"]).optional(),
  cropX: z.number().min(0).max(1).optional(),
  cropY: z.number().min(0).max(1).optional(),
  zoom: z.number().min(1).max(4).optional(),
  x_bind: z.string().optional(),
  y_bind: z.string().optional(),
  width_bind: z.string().optional(),
  height_bind: z.string().optional(),
})
const textElement = baseElement.extend({
  type: z.literal("text"), fontSize: z.number().positive().finite(), fontFamily: z.string(), color: z.string(),
  align: z.enum(["left", "center", "right"]), bind: z.string().optional(),
  staticText: z.string().optional(), maxWidth: z.number().positive().finite().optional(), maxHeight: z.number().positive().finite().optional(),
})
const imageElement = baseElement.extend({ type: z.literal("image"), src: z.string().optional(), bind: z.string().optional() })
const staticTextElement = baseElement.extend({
  type: z.literal("staticText"), text: z.string(), fontSize: z.number().positive().finite(), fontFamily: z.string(),
  color: z.string(), align: z.enum(["left", "center", "right"]), maxWidth: z.number().positive().finite().optional(), maxHeight: z.number().positive().finite().optional(),
})
const staticImageElement = baseElement.extend({ type: z.literal("staticImage"), src: z.string() })
const elementSchema = z.discriminatedUnion("type", [textElement, imageElement, staticTextElement, staticImageElement])
const safeKey = z.string().refine(key => !["__proto__", "constructor", "prototype"].includes(key), "Unsafe object key")
const cardRow = z.custom<Record<string, string | number | boolean | null>>(value =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.entries(value).every(([key, cell]) =>
    !["__proto__", "constructor", "prototype"].includes(key) &&
    (cell === null || (typeof cell === "number" ? Number.isFinite(cell) : ["string", "boolean"].includes(typeof cell))),
  ),
  "Dataset rows must contain safe keys and scalar values",
)
const scalarCards = z.array(cardRow).transform(cards => cards.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)])) as Record<string, string>))
export const projectSchema = z.object({
  version: z.literal(1),
  template: z.object({
    width: z.number().positive().finite(), height: z.number().positive().finite(),
    elements: z.array(elementSchema).superRefine((items, ctx) => {
      const ids = new Set<string>()
      items.forEach((item, index) => {
        if (ids.has(item.id)) ctx.addIssue({ code: "custom", message: "Element ids must be unique", path: [index, "id"] })
        ids.add(item.id)
      })
    }),
    customFonts: z.array(z.string()),
    guided: z.object({id:z.enum(["fantasy","character","education","product"]),version:z.literal(1),color:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).optional(),
  }),
  cards: scalarCards,
  processRules: z.array(z.object({
    key: safeKey,
    comparator: z.enum(["=", "!=", "~", "!~", ">", "<", ">=", "<=", "null", "not null"]),
    value: z.string(), new_key: safeKey, content: z.string(),
  })),
})
export type Project = z.infer<typeof projectSchema>
export function parseProject(input: unknown): Project {
  if (typeof input === "string") input = JSON.parse(input)
  if (input && typeof input === "object" && !Array.isArray(input) && !("version" in input)) {
    input = { version: 1, cards: [], ...(input as object) }
  }
  return projectSchema.parse(input)
}

/** RFC4180-style CSV parser supporting quoted delimiters, escaped quotes and embedded newlines. */
export function parseDataset(text: string, filename = "dataset.csv"): Record<string,string>[] {
  if (filename.toLowerCase().endsWith(".json")) {
    const value: unknown = JSON.parse(text)
    if (!Array.isArray(value) || value.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
      throw new Error("JSON dataset must be an array of objects")
    }
    return value.map((row: Record<string, unknown>, index) => Object.fromEntries(
      Object.entries(row).map(([key, cell]) => {
        if (["__proto__", "constructor", "prototype"].includes(key)) {
          throw new Error(`Row ${index + 1}, field ${key} is unsafe`)
        }
        if (cell !== null && !["string", "number", "boolean"].includes(typeof cell)) {
          throw new Error(`Row ${index + 1}, field ${key} must be a scalar value`)
        }
        if (typeof cell === "number" && !Number.isFinite(cell)) {
          throw new Error(`Row ${index + 1}, field ${key} must be finite`)
        }
        return [key, cell == null ? "" : String(cell)]
      }),
    ))
  }
  const delimiter = filename.toLowerCase().endsWith(".tsv") ? "\t" : ","
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < text.length; index++) {
    const character = text[index]!
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"'
        index++
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
    } else if (character === '"' && cell === "") {
      quoted = true
    } else if (character === delimiter) {
      row.push(cell)
      cell = ""
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else {
      cell += character
    }
  }

  if (quoted) throw new Error("Unclosed quoted field in dataset")
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  while (rows.length && rows.at(-1)!.every(value => value === "")) rows.pop()
  if (!rows.length) return []

  const headers = rows.shift()!.map(header => header.trim())
  if (headers.some(header => !header)) throw new Error("Dataset headers must not be empty")
  if (headers.some(header => ["__proto__", "constructor", "prototype"].includes(header))) {
    throw new Error("Dataset contains an unsafe header")
  }
  if (new Set(headers).size !== headers.length) throw new Error("Dataset headers must be unique")

  return rows.map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`Row ${index + 2} has ${values.length} fields; expected ${headers.length}`)
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column]!]))
  })
}
