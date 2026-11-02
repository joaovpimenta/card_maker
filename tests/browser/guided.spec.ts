import { expect, test } from "@playwright/test"
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64"
)
async function start(page: import("@playwright/test").Page) {
  await page.goto("./")
  await page.getByRole("button", { name: /Fantasia Habilidades/ }).click()
  await expect(
    page.getByRole("heading", { name: "Crie sua carta" })
  ).toBeVisible()
}
test("first card: preset, editable text, embedded image, framing and PNG download", async ({
  page
}) => {
  await start(page)
  await page.getByLabel("Nome", { exact: true }).fill("Killua teste")
  await page
    .getByLabel("Imagem da carta", { exact: true })
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png })
  await expect(
    page.getByAltText("Prévia de Killua teste").first()
  ).toBeVisible()
  await page
    .getByLabel("Enquadramento", { exact: true })
    .selectOption("contain")
  const project = await page.evaluate(() => window.cardMaker!.getProject())
  expect(project.template.guided?.id).toBe("fantasy")
  expect(project.cards[0].image).toMatch(/^data:image\/png;base64,/)
  expect(
    project.template.elements.find((e) => e.id === "preset-image")?.fit
  ).toBe("contain")
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Baixar carta", exact: true }).click()
  expect((await download).suggestedFilename()).toBe("carta.png")
  await page.reload()
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
    "Killua teste"
  )
})
test("CSV maps aliases and unknown columns without erasing current project before confirmation", async ({
  page
}) => {
  await start(page)
  await page.getByLabel("Abrir arquivo", { exact: true }).setInputFiles({
    name: "cards.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("nome,descricao,extra\nAda,Uma exploradora,keep")
  })
  await expect(
    page.getByRole("heading", { name: "Transforme seus dados em cartas" })
  ).toBeVisible()
  expect(
    (await page.evaluate(() => window.cardMaker!.getProject())).cards[0].name
  ).toBe("Killua")
  await page.getByRole("button", { name: "Criar 1 carta(s)" }).click()
  expect(
    (await page.evaluate(() => window.cardMaker!.getProject())).cards[0]
  ).toMatchObject({
    name: "Ada",
    description: "Uma exploradora",
    extra: "keep"
  })
  await page.getByRole("button", { name: "Desfazer", exact: true }).click()
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Killua")
})
test("project JSON opens all elements, survives invalid imports and keeps metadata in saved project", async ({
  page
}) => {
  await start(page)
  const original = await page.evaluate(() => window.cardMaker!.getProject())
  await page.getByLabel("Abrir arquivo", { exact: true }).setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(original))
  })
  await page.getByRole("button", { name: "Abrir este projeto" }).click()
  expect(await page.evaluate(() => window.cardMaker!.getProject())).toEqual(
    original
  )
  await page.getByLabel("Abrir arquivo", { exact: true }).setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{")
  })
  expect(await page.evaluate(() => window.cardMaker!.getProject())).toEqual(
    original
  )
  const d = page.waitForEvent("download")
  await page.getByRole("button", { name: "Salvar projeto" }).click()
  expect((await d).suggestedFilename()).toBe("projeto.cardmaker.json")
})
for (const width of [360, 390, 768, 1440])
  test(`guided layout fits ${width}px and supports preview and duplication`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await start(page)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page
      .getByRole("button", { name: "Duplicar carta", exact: true })
      .click()
    expect(
      (await page.evaluate(() => window.cardMaker!.getProject())).cards
    ).toHaveLength(2)
    await page
      .getByRole("button", {
        name: width < 900 ? "Ver carta" : "Ampliar prévia",
        exact: true
      })
      .click()
    await expect(
      page.getByRole("dialog", { name: "Prévia ampliada" })
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })
test("sparse JSON rows retain fields from later cards and model switches preserve edited names", async ({
  page
}) => {
  await start(page)
  await page.getByLabel("Abrir arquivo", { exact: true }).setInputFiles({
    name: "rows.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        { nome: "Old" },
        { nome: "Other", description: "Later detail" }
      ])
    )
  })
  await page.getByRole("button", { name: "Criar 2 carta(s)" }).click()
  expect(
    (await page.evaluate(() => window.cardMaker!.getProject())).cards[1]
      .description
  ).toBe("Later detail")
  await page.getByLabel("Nome", { exact: true }).fill("Edited")
  await page.getByRole("button", { name: "Trocar modelo" }).click()
  await page.getByRole("button", { name: /Produto Imagem, descrição/ }).click()
  await page.getByRole("button", { name: "Abrir este projeto" }).click()
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Edited")
})
test("legacy projects open after switching from advanced to the model gallery", async ({
  page
}) => {
  await start(page)
  await page.getByRole("button", { name: "Personalizar layout" }).click()
  await page.getByRole("button", { name: "Criar com um modelo" }).click()
  const project = {
    version: 1,
    template: {
      width: 300,
      height: 420,
      customFonts: [],
      elements: [
        {
          id: "custom",
          type: "staticText",
          text: "Custom",
          x: 20,
          y: 20,
          width: 250,
          height: 50,
          fontSize: 24,
          fontFamily: "Arial",
          color: "#000",
          align: "left"
        }
      ]
    },
    cards: [{ name: "Custom" }],
    processRules: []
  }
  await page.getByLabel("Abrir arquivo", { exact: true }).setInputFiles({
    name: "custom.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project))
  })
  await page.getByRole("button", { name: "Abrir este projeto" }).click()
  await expect(page.getByTestId("canvas-card")).toBeVisible()
  expect(
    (await page.evaluate(() => window.cardMaker!.getProject())).template
      .elements[0].id
  ).toBe("custom")
})
test("API structural edits materialize guided projects instead of silently ignoring changes", async ({
  page
}) => {
  await start(page)
  const result = await page.evaluate(async () => {
    const updated = await window.cardMaker!.execute({
      type: "updateElement",
      id: "preset-name",
      updates: { fontSize: 20, x: 75 }
    })
    return { updated, project: window.cardMaker!.getProject() }
  })
  expect(result.updated.ok).toBe(true)
  expect(result.project.template.guided).toBeUndefined()
  expect(
    result.project.template.elements.find((e) => e.id === "preset-name")
  ).toMatchObject({ fontSize: 20, x: 75 })
  await expect(page.getByTestId("canvas-card")).toBeVisible()
})
test("typing while an image decodes does not lose text edits", async ({
  page
}) => {
  await start(page)
  await page.evaluate(() => {
    const original = HTMLImageElement.prototype.decode
    HTMLImageElement.prototype.decode = async function () {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return original.call(this)
    }
  })
  await page
    .getByLabel("Imagem da carta", { exact: true })
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png })
  await page.getByLabel("Nome", { exact: true }).fill("Keep this edit")
  await expect
    .poll(() =>
      page.evaluate(() => window.cardMaker!.getProject().cards[0].image)
    )
    .toMatch(/^data:image\/png/)
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
    "Keep this edit"
  )
})
test('crop-only API updates retain the guided form',async({page})=>{
 await start(page)
 const result=await page.evaluate(async()=>{
  await window.cardMaker!.execute({type:'updateElement',id:'preset-image',updates:{fit:'contain',cropX:.2}})
  return window.cardMaker!.getProject()
 })
 expect(result.template.guided?.id).toBe('fantasy')
 expect(result.template.elements.find(e=>e.id==='preset-image')).toMatchObject({fit:'contain',cropX:.2})
 await expect(page.getByRole('heading',{name:'Crie sua carta'})).toBeVisible()
})
