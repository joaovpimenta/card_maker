import { Stage, Layer, Text, Image as KonvaImage, Rect, Group } from "react-konva"
import type { KonvaEventObject } from "konva/lib/Node"
import type { ImageElement, StaticImageElement, StaticTextElement, TextElement } from "../models/Element"
import type { CardTemplate } from "../models/Template"
import { useEditorStore } from "../store/editorStore"
import { resolveImage, resolveText } from "../utils/jsonBinding"
import useImage from "use-image"
import { useEffect, useMemo, useState } from "react"
import SelectionBox from "./SelectionBox"
import { Grid } from "./Grid"
import { useCanvasViewport } from "./CanvasViewportContext"
import { ensureTemplateFonts } from "../utils/googleFonts"

export const SAFE_MARGIN = 24
const DRAG_SNAP_THRESHOLD = 5
interface CanvasStageProps {
    cardIndex?: number
}

function boundDimension(cardData: Record<string, unknown>, key: string | undefined, fallback: number) {
    if (!key) return fallback
    const bound = Number.parseInt(String(cardData[key] ?? ""), 10)
    return Number.isFinite(bound) && bound > 0 ? bound : fallback
}


function handleDragMoveWrap(el: { id: string; x: number; y: number }, template: CardTemplate) {
    return function handleDragMove(e: KonvaEventObject<DragEvent>) {
        if(e.evt.shiftKey) 
            return;
        
        const draggedY = e.target.y();
        let snapY = draggedY;
        for (const other of template.elements) {
            if (other.id === el.id) continue;
            if (Math.abs(other.y - draggedY) <= DRAG_SNAP_THRESHOLD) {
                snapY = other.y;
                break;
            }
        }
        if (snapY !== draggedY) {
            e.target.y(snapY);
        }
    }
}

function RenderTextElement({
    el,
    cardData,
    updateElement,
    isSelected,
    setSelectedElement,
    template
}: {
    el: TextElement
    cardData: Record<string, unknown>
    updateElement: (id: string, updates: Partial<TextElement>) => void
    isSelected: boolean
    setSelectedElement: (id?: string) => void
    template: CardTemplate
}) {
    const panMode = useCanvasViewport()?.panMode ?? false
    const width = boundDimension(cardData, el.width_bind, el.maxWidth ?? el.width)
    const height = boundDimension(cardData, el.height_bind, el.maxHeight ?? el.height)

    return (
        <Group
            x={el.x}
            y={el.y}
            draggable={!panMode}
            onDragMove={handleDragMoveWrap(el, template)}
            onDragEnd={(e) =>
                updateElement(el.id, { x: e.target.x(), y: e.target.y() })
            }
            onClick={() => { if (!panMode) setSelectedElement(el.id) }}
            onTap={() => { if (!panMode) setSelectedElement(el.id) }}
        >
            {/* Selection box */}
            {isSelected && (
               <SelectionBox width={width} height={height} />
            )}

            <Text
                width={width}
                height={height}
                fontSize={el.fontSize}
                fontFamily={el.fontFamily}
                fill={el.color}
                text={resolveText(el, cardData)}
                align={el.align}
                verticalAlign="top"
                opacity={el.opacity}
            />
        </Group>
    )
}

function RenderImageElement({
    el,
    cardData,
    updateElement,
    isSelected,
    setSelectedElement,
    template
}: {
    el: ImageElement
    cardData: Record<string, unknown>
    updateElement: (id: string, updates: Partial<ImageElement>) => void
    isSelected: boolean
    setSelectedElement: (id?: string) => void
    template: CardTemplate
}) {
    const panMode = useCanvasViewport()?.panMode ?? false
    const [img] = useImage(resolveImage(el, cardData))
    if (!img) return null

    const width = boundDimension(cardData, el.width_bind, el.width)
    const height = boundDimension(cardData, el.height_bind, el.height)

    const imgRatio = img.width / img.height
    const boxRatio = width / height

    let drawWidth = width
    let drawHeight = height
    let offsetX = 0
    let offsetY = 0

    if (imgRatio > boxRatio) {
        drawWidth = width
        drawHeight = width / imgRatio
        offsetY = (height - drawHeight) / 2
    } else {
        drawHeight = height
        drawWidth = height * imgRatio
        offsetX = (width - drawWidth) / 2
    }

    return (
        <Group
            x={el.x}
            y={el.y}
            draggable={!panMode}
            onDragMove={handleDragMoveWrap(el, template)}
            onDragEnd={(e) =>
                updateElement(el.id, { x: e.target.x(), y: e.target.y() })
            }
            onClick={() => { if (!panMode) setSelectedElement(el.id) }}
            onTap={() => { if (!panMode) setSelectedElement(el.id) }}
        >
            {/* Selection box */}
            {isSelected && (
                <SelectionBox width={width} height={height} />
            )}

            {/* Image bounding box (optional visual aid) */}
            {/* <Rect width={el.width} height={el.height} stroke="#ccc" /> */}

            <KonvaImage
                x={offsetX}
                y={offsetY}
                width={drawWidth}
                height={drawHeight}
                image={img}
                opacity={el.opacity}
            />
        </Group>
    )
}

function RenderStaticTextElement({
    el,
    cardData,
    updateElement,
    isSelected,
    setSelectedElement,
    template
}: {
    el: StaticTextElement
    cardData: Record<string, unknown>
    updateElement: (id: string, updates: Partial<StaticTextElement>) => void
    isSelected: boolean
    setSelectedElement: (id?: string) => void
    template: CardTemplate
}) {
    const panMode = useCanvasViewport()?.panMode ?? false
    const width = boundDimension(cardData, el.width_bind, el.maxWidth ?? el.width)
    const height = boundDimension(cardData, el.height_bind, el.maxHeight ?? el.height)

    return (
        <Group
            x={el.x}
            y={el.y}
            draggable={!panMode}
            onDragMove={handleDragMoveWrap(el, template)}
            onDragEnd={(e) =>
                updateElement(el.id, { x: e.target.x(), y: e.target.y() })
            }
            onClick={() => { if (!panMode) setSelectedElement(el.id) }}
            onTap={() => { if (!panMode) setSelectedElement(el.id) }}
        >
            {/* Selection border */}
            {isSelected && (
                <SelectionBox width={width} height={height} />
            )}

            <Text
                width={width}
                height={height}
                fontSize={el.fontSize}
                fontFamily={el.fontFamily}
                fill={el.color}
                text={el.text}
                align={el.align}
                verticalAlign="top"
                opacity={el.opacity}
            />
        </Group>
    )
}

function RenderStaticImageElement({
    el,
    cardData,
    updateElement,
    isSelected,
    setSelectedElement,
    template
}: {
    el: StaticImageElement
    cardData: Record<string, unknown>
    updateElement: (id: string, updates: Partial<StaticImageElement>) => void
    isSelected: boolean
    setSelectedElement: (id?: string) => void
    template: CardTemplate
}) {
    const panMode = useCanvasViewport()?.panMode ?? false
    const [img] = useImage(el.src)
    if (!img) return null

    const width = boundDimension(cardData, el.width_bind, el.width)
    const height = boundDimension(cardData, el.height_bind, el.height)

    const imgRatio = img.width / img.height
    const boxRatio = width / height

    let drawWidth = width
    let drawHeight = height
    let offsetX = 0
    let offsetY = 0

    if (imgRatio > boxRatio) {
        drawWidth = width
        drawHeight = width / imgRatio
        offsetY = (height - drawHeight) / 2
    } else {
        drawHeight = height
        drawWidth = height * imgRatio
        offsetX = (width - drawWidth) / 2
    }

    return (
        <Group
            x={el.x}
            y={el.y}
            draggable={!panMode}
            onDragMove={handleDragMoveWrap(el, template)}
            onDragEnd={(e) =>
                updateElement(el.id, { x: e.target.x(), y: e.target.y() })
            }
            onClick={() => { if (!panMode) setSelectedElement(el.id) }}
            onTap={() => { if (!panMode) setSelectedElement(el.id) }}
        >
            {isSelected && (
                <SelectionBox width={width} height={height} />
            )}

            <KonvaImage
                x={offsetX}
                y={offsetY}
                width={drawWidth}
                height={drawHeight}
                image={img}
                opacity={el.opacity}
            />
        </Group>
    )
}

export default function CanvasStage({ cardIndex = 0 }: CanvasStageProps) {
    const viewport = useCanvasViewport()
    const setSelectedElement = useEditorStore((s) => s.setSelectedElement)
    const template = useEditorStore((s) => s.template)
    const updateElement = useEditorStore((s) => s.updateElement)
    const showGuides = useEditorStore((s) => s.showGuides)
    const sampleCards = useEditorStore((s) => s.sampleCards)

    const selectedElementId = useEditorStore((s) => s.selectedElementId)
    const textFonts = useMemo(() => [...new Set(template.elements.flatMap(el => el.type === "text" || el.type === "staticText" ? [`${el.fontSize}px "${el.fontFamily}"`] : []))], [template.elements])
    const fontTemplate = useMemo(() => ({ width: template.width, height: template.height, elements: [], customFonts: template.customFonts }), [template.width, template.height, template.customFonts])
    const fontSignature = JSON.stringify([fontTemplate.customFonts, textFonts])
    const [readyFontSignature, setReadyFontSignature] = useState("")
    useEffect(() => {
        let current = true
        void ensureTemplateFonts(fontTemplate).then(() => Promise.all(textFonts.map(font => document.fonts.load(font)))).catch(error => {
            window.dispatchEvent(new CustomEvent("cardmaker:font-error", { detail: error instanceof Error ? error.message : "Não foi possível carregar uma fonte do cartão." }))
        }).finally(() => { if (current) setReadyFontSignature(fontSignature) })
        return () => { current = false }
    }, [fontTemplate, textFonts, fontSignature])

    useEffect(() => {
        if (!selectedElementId && template.elements.length > 0) {
            setSelectedElement(template.elements[0].id)
        }
    }, [selectedElementId, template.elements, setSelectedElement])
    const sortedElements = useMemo(
        () => [...template.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
        [template.elements]
    )

    const cardData = useMemo(
        () => sampleCards[cardIndex] || {},
        [sampleCards, cardIndex]
    )
    if (readyFontSignature !== fontSignature) return null
    return (
        <div data-testid="canvas-card" style={{ position: "absolute", left: 0, top: 0, transformOrigin: "top left", transform: `translate(${viewport?.x ?? 0}px, ${viewport?.y ?? 0}px) scale(${viewport?.scale ?? 1})` }}>
        <Stage width={template.width} height={template.height}>
            <Layer>
                <Grid width={template.width} height={template.height} step={5} color="#000" />
                <Rect
                    x={0}
                    y={0}
                    width={template.width}
                    height={template.height}
                    stroke="#555"
                    strokeWidth={2}
                    listening={false}
                />
                {sortedElements.map((el) => {
                    switch (el.type) {
                        case "text":
                            return <RenderTextElement key={el.id} el={el} cardData={cardData} updateElement={updateElement} isSelected={selectedElementId === el.id} setSelectedElement={setSelectedElement} template={template} />
                        case "image":
                            return <RenderImageElement key={el.id} el={el} cardData={cardData} updateElement={updateElement} isSelected={selectedElementId === el.id} setSelectedElement={setSelectedElement} template={template} />
                        case "staticText":
                            return <RenderStaticTextElement key={el.id} el={el} cardData={cardData} updateElement={updateElement} isSelected={selectedElementId === el.id} setSelectedElement={setSelectedElement} template={template} />
                        case "staticImage":
                            return <RenderStaticImageElement key={el.id} el={el} cardData={cardData} updateElement={updateElement}  isSelected={selectedElementId === el.id} setSelectedElement={setSelectedElement} template={template} />
                        default:
                            return null
                        }
                    })}
                <Rect
                    x={SAFE_MARGIN}
                    y={SAFE_MARGIN}
                    width={template.width - SAFE_MARGIN * 2}
                    height={template.height - SAFE_MARGIN * 2}
                    stroke="#00aaff"
                    strokeWidth={1}
                    dash={[6, 4]}
                    listening={false}
                    visible={showGuides}
                    zIndex={-1}
                />
            </Layer>
        </Stage>
        </div>
    )
}
