import type { CardElement } from "../models/Element"
import type { ProcessRule } from "../models/Template"
import { exportCards as exportCardFiles } from "../utils/exportCards"
import { useEditorStore, editorHydrated } from "../store/editorStore"
import { parseProject, projectSchema, type Project } from "./project"

export type ProjectCommand =
  | { type: "importProject"; project: unknown }
  | { type: "newProject" }
  | { type: "addElement"; element: CardElement }
  | { type: "updateElement"; id: string; updates: Partial<CardElement> }
  | { type: "deleteElement"; id: string }
  | { type: "setDataset"; cards: Record<string, unknown>[] }
  | { type: "setTemplate"; template: Project["template"] }
  | { type: "setProcessRules"; processRules: ProcessRule[] }
  | { type: "addProcessRule"; rule: ProcessRule }
  | { type: "updateProcessRule"; index: number; updates: Partial<ProcessRule> }
  | { type: "removeProcessRule"; index: number }
  | { type: "setCardSize"; width: number; height: number }
  | { type: "undo" }
  | { type: "redo" }

export type CommandError = { message: string; path?: string }
export type CommandResult =
  | { ok: true; data?: unknown; warnings?: string[] }
  | { ok: false; errors: CommandError[]; warnings?: string[] }

export async function waitForHydration(): Promise<void> {
  await editorHydrated
}

export function getProject(): Project {
  const state = useEditorStore.getState()
  return parseProject({
    version: 1,
    template: state.template,
    cards: state.originalSampleCards,
    processRules: state.processRules,
  })
}

export function validateProject(input: unknown) {
  try {
    const candidate = typeof input === "string" ? JSON.parse(input) : input
    const result = projectSchema.safeParse(candidate)
    return result.success
      ? { ok: true as const, errors: [] }
      : { ok: false as const, errors: result.error.issues.map(issue => ({ message: issue.message, path: issue.path.join(".") })) }
  } catch (error) {
    return { ok: false as const, errors: [{ message: errorMessage(error) }] }
  }
}

function successful(): CommandResult {
  return { ok: true, data: getProject() }
}

function failed(error: unknown): CommandResult {
  if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues)) {
    return {
      ok: false,
      errors: error.issues.map((issue: { message: string; path?: PropertyKey[] }) => ({
        message: issue.message,
        path: issue.path?.join("."),
      })),
    }
  }
  return { ok: false, errors: [{ message: errorMessage(error) }] }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function executeCommand(command: ProjectCommand): Promise<CommandResult> {
  try {
    await waitForHydration()
    const store = useEditorStore.getState()
    const current = getProject()

    switch (command.type) {
      case "importProject": {
        const project = parseProject(command.project)
        store.replaceProject(project)
        return successful()
      }
      case "newProject":
        store.replaceProject({
          template: { width: 600, height: 825, elements: [], customFonts: [] },
          cards: [],
          processRules: [],
        })
        return successful()
      case "addElement": {
        const project = parseProject({
          ...current,
          template: { ...current.template, elements: [...current.template.elements, command.element] },
        })
        store.addElement(project.template.elements.at(-1)!)
        return successful()
      }
      case "updateElement": {
        const existing = current.template.elements.find(element => element.id === command.id)
        if (!existing) {
          throw new Error(`Element not found: ${command.id}`)
        }
        if (command.updates.id !== undefined && command.updates.id !== command.id) {
          throw new Error("Element ids are immutable")
        }
        if (command.updates.type !== undefined && command.updates.type !== existing.type) {
          throw new Error("Element types are immutable")
        }
        const project = parseProject({
          ...current,
          template: {
            ...current.template,
            elements: current.template.elements.map(element =>
              element.id === command.id ? { ...element, ...command.updates } : element,
            ),
          },
        })
        const updated = project.template.elements.find(element => element.id === command.id)
        if (!updated) throw new Error(`Element not found: ${command.id}`)
        store.updateElement(command.id, updated)
        return successful()
      }
      case "deleteElement":
        if (!current.template.elements.some(element => element.id === command.id)) {
          throw new Error(`Element not found: ${command.id}`)
        }
        store.deleteElement(command.id)
        return successful()
      case "setDataset": {
        const project = parseProject({ ...current, cards: command.cards })
        store.replaceProject({ ...current, cards: project.cards })
        return successful()
      }
      case "setTemplate": {
        const project = parseProject({ ...current, template: command.template })
        store.replaceProject(project)
        return successful()
      }
      case "setProcessRules": {
        const project = parseProject({ ...current, processRules: command.processRules })
        store.replaceProject(project)
        return successful()
      }
      case "addProcessRule": {
        const project = parseProject({ ...current, processRules: [...current.processRules, command.rule] })
        store.replaceProject(project)
        return successful()
      }
      case "updateProcessRule": {
        assertRuleIndex(command.index, current.processRules)
        const processRules = current.processRules.map((rule, index) =>
          index === command.index ? { ...rule, ...command.updates } : rule,
        )
        store.replaceProject(parseProject({ ...current, processRules }))
        return successful()
      }
      case "removeProcessRule": {
        assertRuleIndex(command.index, current.processRules)
        const processRules = current.processRules.filter((_, index) => index !== command.index)
        store.replaceProject(parseProject({ ...current, processRules }))
        return successful()
      }
      case "setCardSize": {
        const project = parseProject({
          ...current,
          template: { ...current.template, width: command.width, height: command.height },
        })
        store.setCardSize(project.template.width, project.template.height)
        return successful()
      }
      case "undo":
        store.undo()
        return successful()
      case "redo":
        store.redo()
        return successful()
      default:
        throw new Error("Unknown project command")
    }
  } catch (error) {
    return failed(error)
  }
}

function assertRuleIndex(index: number, rules: ProcessRule[]): void {
  if (!Number.isInteger(index) || index < 0 || index >= rules.length) {
    throw new Error("Rule index out of range")
  }
}

export function exportProject(): Project {
  return getProject()
}

export function exportTemplate(): string {
  const { template, processRules } = getProject()
  return JSON.stringify({ template, processRules }, null, 2)
}

export async function exportCards(options?: {
  download?: boolean
  onProgress?: (current: number, total: number) => void
}) {
  await waitForHydration()
  return exportCardFiles(options)
}
