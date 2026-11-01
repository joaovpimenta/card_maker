import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { projectSchema } from "../src/project/project"

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as T

type JsonSchema = {
  $schema?: string
  type?: string
  const?: unknown
  exclusiveMinimum?: number
  minLength?: number
  minimum?: number
  maximum?: number
  required?: string[]
  enum?: unknown[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  oneOf?: JsonSchema[]
  allOf?: JsonSchema[]
  $ref?: string
  $defs?: Record<string, JsonSchema>
  additionalProperties?: JsonSchema | boolean
}

type CapabilityCatalog = {
  version: number
  transport: string
  api: {
    root: string
    ready: { type: string }
    methods: {
      exportCards: { input: { download: { default: boolean } }; limitations: string[] }
      execute: { input: { $ref: string } }
    }
  }
  $defs: {
    command: {
      oneOf: Array<{
        required: string[]
        properties: { type: { const: string }; project?: { $ref: string } }
      }>
    }
  }
}

describe("published agent project schema", () => {
  const published = readJson<JsonSchema>("../public/agents/project.schema.json")
  const runtime = z.toJSONSchema(projectSchema, { io: "input", unrepresentable: "any" }) as JsonSchema

  it("tracks the runtime Zod input contract", () => {
    expect(published.$schema).toBe("https://json-schema.org/draft/2020-12/schema")
    expect(published.type).toBe(runtime.type)
    expect(published.required).toEqual(runtime.required)
    expect(published.properties?.version?.const).toBe(runtime.properties?.version?.const)

    const publishedTemplate = published.properties?.template
    const runtimeTemplate = runtime.properties?.template
    expect(publishedTemplate?.required).toEqual(runtimeTemplate?.required)
    expect(publishedTemplate?.properties?.width?.exclusiveMinimum).toBe(runtimeTemplate?.properties?.width?.exclusiveMinimum)
    expect(publishedTemplate?.properties?.height?.exclusiveMinimum).toBe(runtimeTemplate?.properties?.height?.exclusiveMinimum)

    const publishedTypes = published.$defs?.element?.oneOf?.map((variant) => {
      const subtype = variant.allOf?.find((part) => !part.$ref)
      return subtype?.properties?.type?.const
    }).sort()
    const runtimeTypes = runtimeTemplate?.properties?.elements?.items?.oneOf?.map(
      (variant) => variant.properties?.type?.const,
    ).sort()
    expect(publishedTypes).toEqual(runtimeTypes)

    const baseElement = published.$defs?.baseElement
    expect(baseElement?.required?.sort()).toEqual(["height", "id", "width", "x", "y"])
    expect(baseElement?.properties?.id?.minLength).toBe(1)
    expect(baseElement?.properties?.opacity?.minimum).toBe(0)
    expect(baseElement?.properties?.opacity?.maximum).toBe(1)
    expect(baseElement?.properties?.width?.exclusiveMinimum).toBe(0)
    expect(baseElement?.properties?.height?.exclusiveMinimum).toBe(0)
    for (const variant of published.$defs?.element?.oneOf ?? []) {
      const subtype = variant.allOf?.find((part) => !part.$ref)
      if (subtype?.properties?.type?.const === "text" || subtype?.properties?.type?.const === "staticText") {
        expect(subtype.properties?.fontSize?.exclusiveMinimum).toBe(0)
        expect(subtype.properties?.maxWidth?.exclusiveMinimum).toBe(0)
        expect(subtype.properties?.maxHeight?.exclusiveMinimum).toBe(0)
      }
    }
    const publishedElementRequirements = published.$defs?.element?.oneOf?.map((variant) => {
      const base = published.$defs?.baseElement?.required ?? []
      const subtype = variant.allOf?.find((part) => !part.$ref)?.required ?? []
      return new Set([...base, ...subtype])
    })
    const runtimeElementRequirements = runtimeTemplate?.properties?.elements?.items?.oneOf?.map(
      (variant) => new Set(variant.required ?? []),
    )
    expect(publishedElementRequirements?.map((required) => [...required].sort())).toEqual(
      runtimeElementRequirements?.map((required) => [...required].sort()),
    )

    const cardValueSchema = published.properties?.cards?.items?.additionalProperties
    const cardValueTypes = Array.isArray(cardValueSchema?.type)
      ? cardValueSchema.type
      : cardValueSchema?.anyOf?.map((part) => part.type)
    expect(cardValueTypes?.sort()).toEqual(["boolean", "null", "number", "string"])
    expect(published.properties?.processRules?.items?.properties?.comparator?.enum).toEqual(
      runtime.properties?.processRules?.items?.properties?.comparator?.enum,
    )
  })

  it("accepts the published project and normalizes scalar card values like runtime", () => {
    const sampleProject = readJson<unknown>("../public/agents/sample-project.json")
    const parsed = projectSchema.parse(sampleProject)
    expect(parsed.version).toBe(1)
    expect(parsed.cards).toHaveLength(2)
    expect(parsed.cards[0]?.name).toBe("Sunstone Golem")

    const sampleData = readJson<Array<Record<string, unknown>>>("../public/agents/sample-data.json")
    const withScalars = projectSchema.parse({
      ...sampleProject as object,
      cards: [...sampleData, { title: 42, active: true, missing: null }],
    })
    expect(withScalars.cards.at(-1)).toEqual({ title: "42", active: "true", missing: "" })
  })

  it("documents runtime safety constraints that JSON Schema cannot fully express", () => {
    const sampleProject = readJson<Record<string, unknown>>("../public/agents/sample-project.json")
    const duplicate = structuredClone(sampleProject) as { template: { elements: Array<Record<string, unknown>> } }
    duplicate.template.elements[1] = { ...duplicate.template.elements[1], id: duplicate.template.elements[0]?.id }
    expect(projectSchema.safeParse(duplicate).success).toBe(false)

    const unsafeRule = { key: "__proto__", comparator: "=", value: "bad", new_key: "safe", content: "" }
    expect(projectSchema.safeParse({ ...sampleProject, processRules: [unsafeRule] }).success).toBe(false)

    const unsafeCard = JSON.parse('{"__proto__":"removed"}') as Record<string, unknown>
    expect(projectSchema.safeParse({ ...sampleProject, cards: [unsafeCard] }).success).toBe(false)
  })

  it("publishes the browser API catalog with all runtime command names", () => {
    const catalog = readJson<CapabilityCatalog>("../public/agents/capabilities.json")
    expect(catalog.version).toBe(1)
    expect(catalog.transport).toBe("browser-window")
    expect(catalog.api.root).toBe("window.cardMaker")
    expect(catalog.api.ready.type).toBe("Promise<void>")
    expect(catalog.api.methods.execute.input.$ref).toBe("#/$defs/command")
    expect(catalog.api.methods.exportCards.input.download.default).toBe(true)
    expect(catalog.api.methods.exportCards.limitations.length).toBeGreaterThan(0)

    expect(catalog.$defs.command.oneOf.map((command) => command.properties.type.const).sort()).toEqual([
      "addElement", "addProcessRule", "deleteElement", "importProject", "newProject", "redo",
      "removeProcessRule", "setCardSize", "setDataset", "setProcessRules", "setTemplate", "undo",
      "updateElement", "updateProcessRule",
    ])
    const imports = catalog.$defs.command.oneOf.find((command) => command.properties.type.const === "importProject")
    expect(imports?.required).toEqual(["type", "project"])
    expect(imports?.properties.project).toEqual({ $ref: "project.schema.json" })
  })
})
