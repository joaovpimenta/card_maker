import { describe, expect, it } from "vitest"
import { createPresetProject, classifyFile, mapRows } from "./presets"
import { parseProject } from "../project/project"
describe("guided projects", () => {
  it("creates an editable fantasy card and roundtrips its preset", () => {
    const p = createPresetProject("fantasy")
    expect(p.cards[0].name).toBe("Killua")
    expect(
      p.template.elements.some((e) => e.type === "text" && e.bind === "name")
    ).toBe(true)
    expect(parseProject(JSON.stringify(p))).toEqual(p)
  })
  it("recognizes projects even when uploaded as data and rejects invalid project shapes", () => {
    expect(
      classifyFile(JSON.stringify(createPresetProject("fantasy")), "x.json")
        .kind
    ).toBe("project")
    expect(classifyFile("nome,imagem\nAda,photo.png", "x.csv").kind).toBe(
      "dataset"
    )
    expect(() => classifyFile('{"version":1}', "x.json")).toThrow()
  })
  it("maps aliases while retaining unknown columns and explicit empty cells", () => {
    expect(
      mapRows([{ nome: "Ada", imagem: "", extra: "keep" }], "fantasy")[0]
    ).toMatchObject({ name: "Ada", image: "", extra: "keep" })
  })
})
it("keeps edited canonical values when switching presets, including cleared values", () => {
  expect(
    mapRows(
      [
        { nome: "Old", name: "New" },
        { nome: "Old", name: "" }
      ],
      "product"
    ).map((r) => r.name)
  ).toEqual(["New", ""])
})
it("does not display combat stats on products and educational cards", () => {
  for (const id of ["product", "education"] as const) {
    const p = createPresetProject(id)
    expect(p.template.elements.some((e) => e.id === "preset-power")).toBe(false)
  }
})
it("materializes optional fields from every card before advanced editing", async () => {
  const { detachGuided } = await import("./presets")
  const p = createPresetProject("fantasy", [
    { name: "A" },
    { name: "B", description: "Only on B" }
  ])
  const template = detachGuided(p.template, p.cards)
  expect(template.guided).toBeUndefined()
  expect(
    template.elements.some((e) => e.type === "text" && e.bind === "description")
  ).toBe(true)
})
it('suggests canonical columns before aliases even in heterogeneous JSON rows',async()=>{
 const {suggestMapping}=await import('./presets')
 expect(suggestMapping([{nome:'Old',name:'New'},{description:'Only later'}],'fantasy')).toMatchObject({name:'name',description:'description'})
})
