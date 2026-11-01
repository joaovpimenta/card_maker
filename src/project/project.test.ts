import { describe, expect, it } from "vitest"
import { parseDataset, parseProject } from "./project"

describe("project parsing", () => {
  it("imports legacy templates as version 1 projects", () => {
    const project = parseProject({template:{width:100,height:200,elements:[],customFonts:[]},processRules:[]})
    expect(project).toMatchObject({version:1,cards:[],template:{width:100,height:200}})
  })
  it("normalizes JSON scalar dataset values", () => {
    expect(parseDataset('[{"name":"Ada","active":true,"age":37}]',"people.json")).toEqual([{name:"Ada",active:"true",age:"37"}])
  })
  it("parses quoted CSV delimiters, quotes and newlines", () => {
    expect(parseDataset('name,note\r\nAda,"a,b"\r\nLin,"line 1\nline 2"')).toEqual([{name:"Ada",note:"a,b"},{name:"Lin",note:"line 1\nline 2"}])
  })
  it("rejects malformed rows and executable rules", () => {
    expect(() => parseDataset("a,b\n1", "x.csv")).toThrow(/expected 2/)
    expect(() => parseProject({version:1,template:{width:1,height:1,elements:[],customFonts:[]},cards:[],processRules:[{key:"x",comparator:"custom",value:"",new_key:"y",content:"return 1"}]})).toThrow()
  })
  it("rejects unsafe keys from parsed JSON payloads", () => {
    const project = JSON.parse('{"version":1,"template":{"width":1,"height":1,"elements":[],"customFonts":[]},"cards":[{"__proto__":"bad"}],"processRules":[]}')
    expect(() => parseProject(project)).toThrow(/safe keys/)
  })
})
