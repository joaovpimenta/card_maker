import { classifyFile } from "./presets"
import { executeCommand } from "../project/commands"
/** Every legacy upload uses the same content recognition as the guided editor. */
export async function openEditorFile(file: File) {
  const result = classifyFile(await file.text(), file.name)
  if (result.kind === "project") {
    const imported = await executeCommand({
      type: "importProject",
      project: result.project
    })
    if (!imported.ok)
      throw new Error(imported.errors.map((e) => e.message).join("; "))
  } else
    window.dispatchEvent(
      new CustomEvent("card-maker-open-file", { detail: file })
    )
}
