import { expect, test } from '@playwright/test'

test('agent project roundtrip, undo, persistence and mobile stage access', async ({ page }) => {
  await page.setViewportSize({width:390,height:844})
  await page.goto('./')
  await page.evaluate(async () => { await window.cardMaker!.ready })
  const sample = await (await page.request.get('agents/sample-project.json')).json()
  const imported = await page.evaluate(async project => window.cardMaker!.execute({type:'importProject',project}), sample)
  expect(imported.ok).toBe(true)
  const initial = await page.evaluate(() => window.cardMaker!.getProject())
  await page.evaluate(async () => {
    await window.cardMaker!.execute({type:'setCardSize',width:400,height:600})
    await window.cardMaker!.execute({type:'undo'})
  })
  expect(await page.evaluate(() => window.cardMaker!.getProject())).toEqual(initial)
  await page.getByRole('navigation', {name:'Etapas do projeto'}).getByRole('button',{name:'Dados'}).click()
  await expect(page.getByRole('heading',{name:'Dados do projeto'})).toBeVisible()
  await page.getByRole('navigation', {name:'Etapas do projeto'}).getByRole('button',{name:'Revisão'}).click()
  await expect(page.getByRole('heading',{name:'Revise seus cartões'})).toBeVisible()
  await expect(page.getByRole('img',{name:/Cart[aã]o? 1|Carta 1/i}).first()).toBeVisible()
  await page.getByRole('navigation', {name:'Etapas do projeto'}).getByRole('button',{name:'Exportação'}).click()
  await expect(page.getByRole('button',{name:'Baixar cartas em ZIP'})).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button',{name:'Baixar projeto completo',exact:true}).last().click(),
  ])
  expect(download.suggestedFilename()).toBe('projeto.cardmaker.json')
  await page.reload()
  await page.evaluate(async () => { await window.cardMaker!.ready })
  expect(await page.evaluate(() => window.cardMaker!.getProject())).toEqual(initial)
  const invalid = await page.evaluate(async () => window.cardMaker!.execute({type:'importProject',project:'{'}))
  expect(invalid.ok).toBe(false)
  expect(await page.evaluate(() => window.cardMaker!.getProject())).toEqual(initial)
})

test('static-only card stays editable and sample completes the guided workflow', async ({page}) => {
  await page.setViewportSize({width:360,height:800})
  await page.goto('./')
  await page.evaluate(async () => {
    await window.cardMaker!.ready
    await window.cardMaker!.execute({type:'importProject',project:{version:1,template:{width:600,height:825,elements:[{id:'title',type:'staticText',x:50,y:50,width:400,height:80,text:'Carta sem dados',fontSize:30,fontFamily:'Arial',color:'#000',align:'left'}],customFonts:[]},cards:[],processRules:[]}})
  })
  await page.getByRole('navigation',{name:'Etapas do projeto'}).getByRole('button',{name:'Design'}).click()
  await expect(page.getByTestId('canvas-card')).toBeVisible()
  await page.getByRole('navigation',{name:'Etapas do projeto'}).getByRole('button',{name:'Exportação'}).click()
  const [download] = await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Baixar primeira carta',exact:true}).click()])
  expect(download.suggestedFilename()).toBe('carta_001.png')
})

test('custom font stylesheets are reconstructed when a saved project is restored', async ({page}) => {
  let fontRequests = 0
  await page.route('https://fonts.googleapis.com/**', async route => {
    fontRequests++
    await route.fulfill({status:200,contentType:'text/css',body:'/* mock font catalog */'})
  })
  await page.goto('./')
  await page.evaluate(async () => {
    await window.cardMaker!.ready
    const project = window.cardMaker!.getProject()
    project.template.customFonts = ['Roboto']
    await window.cardMaker!.execute({type:'importProject',project})
  })
  await expect.poll(() => fontRequests).toBeGreaterThan(0)
  const requestsBeforeReload = fontRequests
  await page.reload()
  await page.evaluate(async () => { await window.cardMaker!.ready })
  await expect.poll(() => fontRequests).toBeGreaterThan(requestsBeforeReload)
})

test('corrupt saved data is preserved and reported without blocking recovery', async ({page}) => {
  await page.goto('./')
  await page.evaluate(async () => {
    await window.cardMaker!.ready
    await new Promise<void>((resolve,reject) => {
      const request = indexedDB.open('keyval-store')
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction('keyval','readwrite')
        transaction.objectStore('keyval').put({state:{template:{width:-1},originalSampleCards:[],processRules:[]},version:0},'card_storage')
        transaction.oncomplete = () => { db.close(); resolve() }
        transaction.onerror = () => reject(transaction.error)
      }
      request.onerror = () => reject(request.error)
    })
  })
  await page.reload()
  await page.evaluate(async () => { await window.cardMaker!.ready })
  await expect(page.getByRole('alert')).toContainText(/salvamento local/i)
  const stored = await page.evaluate(() => new Promise<unknown>((resolve,reject) => {
    const request = indexedDB.open('keyval-store')
    request.onsuccess = () => {
      const db = request.result
      const read = db.transaction('keyval','readonly').objectStore('keyval').get('card_storage')
      read.onsuccess = () => { db.close(); resolve(read.result) }
      read.onerror = () => reject(read.error)
    }
  }))
  expect(stored).toMatchObject({state:{template:{width:-1}}})
  expect(await page.evaluate(async () => window.cardMaker!.execute({type:'newProject'}))).toMatchObject({ok:true})
  await page.reload()
  await page.evaluate(async () => { await window.cardMaker!.ready })
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a first-time user can load the example, edit properties and open options by keyboard', async ({page}) => {
  await page.setViewportSize({width:360,height:800})
  await page.goto('./')
  await page.getByRole('button',{name:'Usar projeto de exemplo'}).click()
  await page.getByRole('button',{name:'Continuar para o design'}).click()
  await expect(page.getByTestId('canvas-card')).toBeVisible()
  await page.getByRole('button',{name:'Ajustes',exact:true}).click()
  await expect(page.getByRole('spinbutton',{name:'Posição X'})).toBeVisible()
  await page.getByRole('spinbutton',{name:'Posição X'}).fill('70')
  await expect.poll(async () => (await page.evaluate(() => window.cardMaker!.getProject())).template.elements[0]?.x).toBe(70)
  const options = page.locator('summary').filter({hasText:'Opções'})
  await options.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button',{name:'Tamanho da carta…'}).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Tamanho da carta…'})).toBeFocused()
})
