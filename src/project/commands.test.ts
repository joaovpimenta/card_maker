import "fake-indexeddb/auto"
import { beforeAll, describe, expect, it } from "vitest"
import { executeCommand, getProject, validateProject } from "./commands"
import { editorHydrated, useEditorStore } from "../store/editorStore"

beforeAll(async () => {
  await editorHydrated
  useEditorStore.getState().replaceProject({template:{width:600,height:825,elements:[],customFonts:[]},cards:[],processRules:[]})
  useEditorStore.getState().clearHistory()
})

describe("project commands", () => {
  it("rejects invalid import atomically and reports JSON parse errors", async () => {
    const before=getProject()
    const result=await executeCommand({type:"importProject",project:{version:1,template:{width:-1,height:825,elements:[],customFonts:[]},cards:[],processRules:[]}})
    expect(result.ok).toBe(false)
    expect(getProject()).toEqual(before)
    expect(validateProject("{").ok).toBe(false)
  })

  it("routes direct store mutations and commands through shared undo and redo", async () => {
    const el={id:"e1",type:"staticText" as const,x:0,y:0,width:100,height:20,text:"before",fontSize:12,fontFamily:"Arial",color:"#000",align:"left" as const}
    useEditorStore.getState().addElement(el)
    useEditorStore.getState().updateElement("e1",{text:"after"})
    expect((getProject().template.elements[0] as typeof el).text).toBe("after")
    expect((await executeCommand({type:"undo"})).ok).toBe(true)
    expect((getProject().template.elements[0] as typeof el).text).toBe("before")
    await executeCommand({type:"setDataset",cards:[{name:"Ada"}]})
    await executeCommand({type:"setCardSize",width:400,height:500})
    expect(getProject().template.width).toBe(400)
    await executeCommand({type:"undo"})
    expect(getProject().template.width).toBe(600)
    await executeCommand({type:"undo"})
    expect(getProject().cards).toEqual([])
    await executeCommand({type:"redo"})
    expect(getProject().cards).toEqual([{name:"Ada"}])
  })

  it("validates rule indexes and rejects custom code before changing state", async () => {
    const before=getProject()
    const invalid=await executeCommand({type:"addProcessRule",rule:{key:"x",comparator:"custom",value:"",new_key:"out",content:"return 1"}})
    expect(invalid.ok).toBe(false)
    const outOfRange=await executeCommand({type:"removeProcessRule",index:0})
    expect(outOfRange.ok).toBe(false)
    expect(getProject()).toEqual(before)
  })

  it("applies numeric comparisons numerically and reapplies rules to replacement datasets", () => {
    const store = useEditorStore.getState()
    store.replaceProject({
      template: { width: 600, height: 825, elements: [], customFonts: [] },
      cards: [{ score: "10" }, { score: "2" }],
      processRules: [{ key: "score", comparator: ">", value: "2", new_key: "qualified", content: "yes" }],
    })
    expect(useEditorStore.getState().sampleCards).toEqual([
      { score: "10", qualified: "yes" },
      { score: "2" },
    ])
    useEditorStore.getState().setSampleCards([{ score: "3" }])
    expect(useEditorStore.getState().sampleCards).toEqual([{ score: "3", qualified: "yes" }])
  })

  it("keeps invalid direct store mutations from changing project state", () => {
    const before = getProject()
    expect(() => useEditorStore.getState().setCardSize(-10, 100)).toThrow()
    expect(() => useEditorStore.getState().setSampleCards([{ nested: { value: "bad" } } as unknown as Record<string, string>])).toThrow()
    expect(getProject().template.width).toBe(before.template.width)
  })

  it("keeps element ids and kinds immutable", async () => {
    const element = { id: "fixed", type: "staticText" as const, x: 0, y: 0, width: 100, height: 20, text: "x", fontSize: 12, fontFamily: "Arial", color: "#000", align: "left" as const }
    await executeCommand({ type: "addElement", element })
    const before = getProject()
    const result = await executeCommand({ type: "updateElement", id: "fixed", updates: { id: "changed" } })
    expect(result.ok).toBe(false)
    expect(getProject()).toEqual(before)
    expect(() => useEditorStore.getState().updateElement("fixed", { id: "changed" })).toThrow(/immutable/)
  })
})
