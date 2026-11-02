import { create } from "zustand"
import type { CardTemplate, ProcessRule } from "../models/Template"
import type { CardElement } from "../models/Element"
import { persist, createJSONStorage } from "zustand/middleware"
import { indexedDbStorage, setPersistenceEnabled } from "./indexedDbStorage"
import { detachGuided } from "../guided/presets"
import { parseProject } from "../project/project"

interface EditorState {
    selectedElementId?: string
    setSelectedElement: (id?: string) => void

    template: CardTemplate
    setCardSize: (width: number, height: number) => void
    addElement: (el: CardElement) => void
    deleteElement: (id: string) => void
    updateElement: (id: string, updates: Partial<CardElement>) => void
    addCustomFont: (font: string) => void

    showGuides: boolean
    showGrid: boolean
    showPreview: boolean
    toggleGuides: () => void
    toggleGrid: () => void
    togglePreview: () => void

    originalSampleCards: Record<string, string>[]
    sampleCards: Record<string, string>[]
    setSampleCards: (cards: Record<string, string>[]) => void

    exportTemplate: () => string
    importTemplate: (json: string) => void
    replaceProject: (project: {template:CardTemplate;cards:Record<string,string>[];processRules:ProcessRule[]}) => void

    processRules: ProcessRule[]
    addProcessRule: (rule: ProcessRule) => void
    updateProcessRule: (index: number, rule: Partial<ProcessRule>) => void
    removeProcessRule: (index: number) => void

    history: ProjectSnapshot[]
    historyIndex: number

    undo: () => void
    redo: () => void
    clearHistory: () => void
    hydrationStatus: "loading" | "ready" | "error"
    hydrationWarnings: string[]
    storageError?: string
}
type ProjectSnapshot = {template:CardTemplate;cards:Record<string,string>[];processRules:ProcessRule[]}
function snapshot(state: Pick<EditorState, "template" | "originalSampleCards" | "processRules">): ProjectSnapshot {
    return structuredClone({
        template: state.template,
        cards: state.originalSampleCards,
        processRules: state.processRules,
    })
}

function appendHistory(state: EditorState, next: ProjectSnapshot) {
    const history = state.history.slice(0, state.historyIndex + 1)
    history.push(structuredClone(next))
    const trimmed = history.slice(-50)
    return { history: trimmed, historyIndex: trimmed.length - 1 }
}

function validateState(template: CardTemplate, cards: Record<string, unknown>[], processRules: ProcessRule[]) {
    return parseProject({ version: 1, template, cards, processRules })
}

let hydrationResolve!: () => void
export const editorHydrated = new Promise<void>(resolve => { hydrationResolve=resolve })
export const useEditorStore = create<EditorState>()(
    persist((set, get) => ({
        template: {
            width: 600,
            height: 825,
            elements: [],
            customFonts: []
        },
        selectedElementId: undefined,
        setSelectedElement: (id) => set({ selectedElementId: id }),
        hydrationStatus: "loading",
        hydrationWarnings: [],

        addElement: (el) =>
            set((state) => {
                const editable=detachGuided(state.template,state.sampleCards)
                const validated = validateState({...editable,elements:[...editable.elements,el]},state.originalSampleCards,state.processRules)
                const newTemplate = {
                    ...validated.template,
                }

                const nextHistory = state.history.slice(0, state.historyIndex + 1)
                nextHistory.push(snapshot({...state,template:newTemplate}))

                return {
                    template: newTemplate,
                    history: nextHistory.slice(-50),
                    historyIndex: Math.min(nextHistory.length - 1, 49),
                }
            }),

        deleteElement: (id) =>
            set((state) => {
                const editable=detachGuided(state.template,state.sampleCards)
                const validated = validateState({...editable,elements:editable.elements.filter(el=>el.id!==id)},state.originalSampleCards,state.processRules)
                const newTemplate = {
                    ...validated.template,
                }

                const nextHistory = state.history.slice(0, state.historyIndex + 1)
                nextHistory.push(snapshot({...state,template:newTemplate}))

                return {
                    template: newTemplate,
                    selectedElementId: state.selectedElementId === id ? undefined : state.selectedElementId,
                    history: nextHistory.slice(-50),
                    historyIndex: Math.min(nextHistory.length - 1, 49),
                }
            }),

        updateElement: (id, updates) =>
            set((state) => {
                const existing = state.template.elements.find(el=>el.id===id)
                if (!existing) throw new Error(`Element not found: ${id}`)
                if (updates.id !== undefined && updates.id !== id) throw new Error("Element ids are immutable")
                if (updates.type !== undefined && updates.type !== existing.type) throw new Error("Element types are immutable")
                const isCrop=id==="preset-image"&&Object.keys(updates).every(key=>["fit","cropX","cropY","zoom"].includes(key))
                const editable=isCrop?state.template:detachGuided(state.template,state.sampleCards)
                const validated = validateState({...editable,elements:editable.elements.map(el=>el.id===id?{...el,...updates} as CardElement:el)},state.originalSampleCards,state.processRules)
                const newTemplate = {
                    ...validated.template,
                }

                const nextHistory = state.history.slice(0, state.historyIndex + 1)
                nextHistory.push(snapshot({...state,template:newTemplate}))

                return {
                    template: newTemplate,
                    history: nextHistory.slice(-50),
                    historyIndex: Math.min(nextHistory.length - 1, 49),
                }
            }),

        addCustomFont: (font) =>
            set((state) => {
                if (state.template.customFonts.includes(font)) {
                    return {}
                }

                const newTemplate = {
                    ...state.template,
                    customFonts: [...state.template.customFonts, font],
                }
                validateState(newTemplate,state.originalSampleCards,state.processRules)

                const nextHistory = state.history.slice(0, state.historyIndex + 1)
                nextHistory.push(snapshot({...state,template:newTemplate}))

                return {
                    template: newTemplate,
                    history: nextHistory.slice(-50),
                    historyIndex: Math.min(nextHistory.length - 1, 49),
                }
            }),



        showGuides: true,
        showGrid: false,
        showPreview: false,

        toggleGuides: () =>
            set((state) => ({
                showGuides: !state.showGuides
            })),
        toggleGrid: () =>
            set((state) => ({
                showGrid: !state.showGrid
            })),
        togglePreview: () =>
            set((state) => ({
                showPreview: !state.showPreview
            })),

        setCardSize: (width, height) => set(state => {
            const template = validateState(
                { ...detachGuided(state.template,state.sampleCards), width, height },
                state.originalSampleCards,
                state.processRules,
            ).template
            return { template, ...appendHistory(state, { ...snapshot(state), template }) }
        }),

        // Sample cards state management
        originalSampleCards: [],
        sampleCards: [],

        setSampleCards: (cards) => set(state => {
            const project = validateState(state.template, cards, state.processRules)
            return {
                sampleCards: applyProcessRules(project.cards, state.processRules),
                originalSampleCards: project.cards,
                ...appendHistory(state, { ...snapshot(state), cards: project.cards }),
            }
        }),

        // Export template as JSON string
        exportTemplate: () => {
            const template = get().template
            const processRules = get().processRules
            const bundle = { template, processRules }
            return JSON.stringify(bundle, null, 2)
        },

        // Import template from JSON string
        importTemplate: (json: string) => {
            const imported = parseProject(json)
            get().replaceProject({template:imported.template,cards:imported.cards,processRules:imported.processRules})
        },
        replaceProject: (project) => {
            const validated = parseProject({version:1,...project})
            setPersistenceEnabled(true)
            set(state=>({template:validated.template,processRules:validated.processRules,originalSampleCards:validated.cards,sampleCards:applyProcessRules(validated.cards,validated.processRules),selectedElementId:undefined,...appendHistory(state,{template:validated.template,cards:validated.cards,processRules:validated.processRules})}))
        },

        processRules: [],

        addProcessRule: (rule) =>
            set((s) => {
                const nextRules = validateState(s.template,s.originalSampleCards,[...s.processRules,rule]).processRules
                const transformed = applyProcessRules(
                    s.originalSampleCards,
                    nextRules
                )

                return {
                    processRules: nextRules,
                    sampleCards: transformed,
                    ...appendHistory(s,{...snapshot(s),processRules:nextRules}),
                }
            }),

        updateProcessRule: (index, updates) =>
            set((s) => {
                if(!Number.isInteger(index)||index<0||index>=s.processRules.length) throw new Error("Rule index out of range")
                const nextRules = validateState(s.template,s.originalSampleCards,s.processRules.map((r, i) =>
                    i === index ? { ...r, ...updates } : r
                )).processRules

                const transformed = applyProcessRules(
                    s.originalSampleCards,
                    nextRules
                )

                return {
                    processRules: nextRules,
                    sampleCards: transformed,
                    ...appendHistory(s,{...snapshot(s),processRules:nextRules}),
                }
            }),

        removeProcessRule: (index) =>
            set((s) => {
                if(!Number.isInteger(index)||index<0||index>=s.processRules.length) throw new Error("Rule index out of range")
                const nextRules = validateState(s.template,s.originalSampleCards,s.processRules.filter((_, i) => i !== index)).processRules

                const transformed = applyProcessRules(
                    s.originalSampleCards,
                    nextRules
                )

                return {
                    processRules: nextRules,
                    sampleCards: transformed,
                    ...appendHistory(s,{...snapshot(s),processRules:nextRules}),
                }
            }),

        history: [structuredClone({template:{width:600,height:825,elements:[],customFonts:[]},cards:[],processRules:[]})],
        historyIndex: 0,

        undo: () =>
            set((state) => {
                if (state.historyIndex <= 0) return {}
                const index = state.historyIndex - 1
                return {
                    historyIndex: index,
                    template: structuredClone(state.history[index]!.template),
                    originalSampleCards: structuredClone(state.history[index]!.cards),
                    sampleCards: applyProcessRules(state.history[index]!.cards,state.history[index]!.processRules),
                    processRules: structuredClone(state.history[index]!.processRules),
                    selectedElementId: state.history[index]!.template.elements.some(element=>element.id===state.selectedElementId)?state.selectedElementId:undefined,
                }
            }),

        redo: () =>
            set((state) => {
                if (state.historyIndex >= state.history.length - 1) return {}
                const index = state.historyIndex + 1
                return {
                    historyIndex: index,
                    template: structuredClone(state.history[index]!.template),
                    originalSampleCards: structuredClone(state.history[index]!.cards),
                    sampleCards: applyProcessRules(state.history[index]!.cards,state.history[index]!.processRules),
                    processRules: structuredClone(state.history[index]!.processRules),
                    selectedElementId: state.history[index]!.template.elements.some(element=>element.id===state.selectedElementId)?state.selectedElementId:undefined,
                }
            }),
        clearHistory: () =>
            set({
                history: [snapshot(get())],
                historyIndex: 0,
            }),
    }),
        {
            name: "card_storage",
            storage: createJSONStorage(() => indexedDbStorage),
            partialize: (state) => ({
                template: state.template,
                processRules: state.processRules,
                sampleCards: state.sampleCards,
                originalSampleCards: state.originalSampleCards,
            }),
            onRehydrateStorage: () => (state, error) => {
                if (error) {
                    useEditorStore.setState({ hydrationStatus: "error", storageError: error instanceof Error ? error.message : String(error) })
                    hydrationResolve()
                    return
                }
                if (state) {
                    try {
                        const warnings: string[] = []
                        const rules = state.processRules.filter(rule => {
                            if ((rule.comparator as string) === "custom") {
                                warnings.push(`A regra antiga com JavaScript para o campo “${rule.key}” foi desativada. Use comparações simples em Regras de dados.`)
                                return false
                            }
                            return true
                        })
                        const project = validateState(state.template,state.originalSampleCards,rules)
                        useEditorStore.setState({
                            template: project.template,
                            originalSampleCards: project.cards,
                            sampleCards: applyProcessRules(project.cards,project.processRules),
                            processRules: project.processRules,
                            history: [{template:project.template,cards:project.cards,processRules:project.processRules}],
                            historyIndex: 0,
                            hydrationStatus: "ready",
                            hydrationWarnings: warnings,
                        })
                        setPersistenceEnabled(true)
                    } catch (hydrationError) {
                        setPersistenceEnabled(false)
                        useEditorStore.setState({
                            template: {width:600,height:825,elements:[],customFonts:[]},
                            originalSampleCards: [], sampleCards: [], processRules: [],
                            history: [{template:{width:600,height:825,elements:[],customFonts:[]},cards:[],processRules:[]}],
                            historyIndex: 0, hydrationStatus: "error",
                            storageError: hydrationError instanceof Error ? hydrationError.message : String(hydrationError),
                        })
                    }
                } else {
                    useEditorStore.setState({hydrationStatus:"ready"})
                    setPersistenceEnabled(true)
                }
                hydrationResolve()
            },
        }
    )
)

if (typeof window !== "undefined") {
    window.addEventListener("card-maker-storage-error", event => {
        const detail = (event as CustomEvent<string>).detail
        setPersistenceEnabled(false)
        useEditorStore.setState({ hydrationStatus: "error", storageError: detail })
    })
}


function applyProcessRules(
    originalCards: Record<string, string>[],
    rules: ProcessRule[]
): Record<string, string>[] {
    return originalCards.map((card) => {
        let result = { ...card }

        for (const rule of rules) {

            let sourceValue;
            if(rule.key !== "*") {
                sourceValue = result[rule.key]
            } else {
                sourceValue = result;
            }

            let matches = false

            switch (rule.comparator) {
                case "=":
                    matches = sourceValue == rule.value
                    break
                case "!=":
                    matches = sourceValue != rule.value
                    break
                case "~":   
                    matches = `${sourceValue}`.includes(rule.value)
                    break
                case "!~":
                    matches = !`${sourceValue}`.includes(rule.value)
                    break
                case ">":
                    matches = Number(sourceValue) > Number(rule.value)
                    break
                case "<":
                    matches = Number(sourceValue) < Number(rule.value)
                    break
                case ">=":
                    matches = Number(sourceValue) >= Number(rule.value)
                    break
                case "<=":
                    matches = Number(sourceValue) <= Number(rule.value)
                    break
                case "null":
                    matches = sourceValue === undefined || sourceValue === null || sourceValue === ""
                    break
                case "not null":
                    matches = sourceValue !== undefined && sourceValue !== null && sourceValue !== ""
                    break
                    case "custom":
                        // Custom JavaScript rules are deliberately disabled for imported and agent supplied data.
                        matches = false
                        break
            }

            if (matches) {
                result = {
                    ...result,
                    [rule.new_key]: rule.content,
                }
            }
        }

        return result
    })
}
