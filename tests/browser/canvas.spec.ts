import { expect, test, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"

async function openSampleDesign(page: Page) {
  await page.goto("./")
  await page.getByRole("button", { name: "Usar projeto de exemplo" }).click()
  await page.getByRole("button", { name: /Continuar para o design/ }).click()
  await expect(page.getByTestId("canvas-card")).toBeVisible()
}

for (const width of [360, 390, 768, 1280]) {
  test(`fits the card inside the available canvas at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await openSampleDesign(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)

    const viewport = await page.getByTestId("canvas-viewport").boundingBox()
    const card = await page.getByTestId("canvas-card").boundingBox()
    expect(viewport).not.toBeNull()
    expect(card).not.toBeNull()
    expect(card!.x).toBeGreaterThanOrEqual(viewport!.x - 1)
    expect(card!.y).toBeGreaterThanOrEqual(viewport!.y - 1)
    expect(card!.x + card!.width).toBeLessThanOrEqual(viewport!.x + viewport!.width + 1)
    expect(card!.y + card!.height).toBeLessThanOrEqual(viewport!.y + viewport!.height + 1)

    if (width <= 800) {
      const nav = await page.getByLabel("Navegação entre cartões").boundingBox()
      expect(card!.y).toBeGreaterThanOrEqual(nav!.y + nav!.height - 1)
    }
  })
}

test("touch selection works, and zooming and panning preserve project coordinates and export size", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  try {
  await openSampleDesign(page)

  const card = page.getByTestId("canvas-card")
  const initialCard = await card.boundingBox()
  await page.touchscreen.tap(initialCard!.x + initialCard!.width / 2, initialCard!.y + initialCard!.height * 0.39)
  await page.getByRole("button", { name: "Ajustes" }).click()
  await expect(page.getByRole("heading", { name: "cargo" })).toBeVisible()
  await page.getByRole("button", { name: "Cartão" }).click()

  const before = await downloadProject(page)
  const viewport = page.getByTestId("canvas-viewport")
  await page.getByRole("button", { name: "Aumentar zoom" }).click()
  await page.getByRole("button", { name: "Selecionar" }).click()
  const box = await viewport.boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2 + 30, box!.y + box!.height / 2 + 20)
  await page.mouse.up()
  await page.getByRole("button", { name: "Mover cartão" }).click()
  const after = await downloadProject(page)

  expect(after.template.elements.map(({ x, y }) => ({ x, y }))).toEqual(before.template.elements.map(({ x, y }) => ({ x, y })))
  await page.getByRole("navigation", { name: "Etapas do projeto" }).getByRole("button", { name: /Exportação/ }).click()
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Baixar primeira carta" }).click()
  const png = await downloadPromise
  const bytes = await readFile(await png.path())
  expect(bytes.toString("ascii", 1, 4)).toBe("PNG")
  expect(bytes.readUInt32BE(16)).toBe(before.template.width * 2)
  expect(bytes.readUInt32BE(20)).toBe(before.template.height * 2)
  } finally {
    await context.close()
  }
})

test("reports a failed image request during export", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.route("https://blocked.invalid/**", route => route.abort())
  await page.goto("./")
  const project = {
    version: 1,
    template: { width: 600, height: 825, customFonts: [], elements: [{ id: "remote", type: "image", x: 20, y: 20, width: 200, height: 200, src: "https://blocked.invalid/fail.png" }] },
    cards: [{}],
    processRules: [],
  }
  await page.getByText("Projeto", { exact: true }).click()
  await page.getByLabel("Abrir projeto ou template").setInputFiles({ name: "remote.cardmaker.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) })
  await expect.poll(() => page.evaluate(() => window.cardMaker?.getProject().template.elements[0]?.id)).toBe("remote")
  await expect(page.getByRole("button", { name: "Novo projeto" })).not.toBeVisible()
  await page.getByRole("navigation", { name: "Etapas do projeto" }).getByRole("button", { name: /Design/ }).click()
  await page.getByRole("navigation", { name: "Etapas do projeto" }).getByRole("button", { name: /Exportação/ }).click()
  await page.getByRole("button", { name: "Baixar primeira carta" }).click()
  await expect(page.getByRole("alert")).toContainText(/não foi possível carregar a imagem|CORS/i)
})

async function downloadProject(page: Page) {
  await page.getByText("Projeto", { exact: true }).click()
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Baixar projeto completo" }).click()
  const download = await downloadPromise
  const project = JSON.parse(await readFile(await download.path(), "utf8"))
  return project
}

test("stalled external images produce an actionable export error", async ({ page }) => {
  await page.route("https://stalled.invalid/**", () => { /* Keep the image request pending. */ })
  await page.goto("./")
  await page.evaluate(async () => {
    await window.cardMaker!.ready
    await window.cardMaker!.execute({ type: "importProject", project: {
      version: 1,
      template: { width: 200, height: 300, customFonts: [], elements: [{ id: "slow", type: "staticImage", x: 10, y: 10, width: 100, height: 100, src: "https://stalled.invalid/image.png" }] },
      cards: [], processRules: [],
    } })
  })
  await page.getByRole("navigation", { name: "Etapas do projeto" }).getByRole("button", { name: /Exportação/ }).click()
  await page.getByRole("button", { name: "Baixar primeira carta" }).click()
  await expect(page.getByRole("alert")).toContainText(/CORS/, { timeout: 20000 })
  await expect(page.getByRole("button", { name: "Baixar primeira carta" })).toBeEnabled()
})
