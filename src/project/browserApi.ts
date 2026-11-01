import { executeCommand, exportCards, getProject, validateProject, waitForHydration, type ProjectCommand } from "./commands"

export function installBrowserApi() {
  const api = {
    ready: waitForHydration(),
    getProject,
    validateProject,
    execute: (command: ProjectCommand) => executeCommand(command),
    exportCards,
  }
  Object.defineProperty(window, "cardMaker", { value: api, configurable: true })
  return api
}

declare global {
  interface Window {
    cardMaker?: {
      ready: Promise<void>
      getProject: typeof getProject
      validateProject: typeof validateProject
      execute: (command: ProjectCommand) => ReturnType<typeof executeCommand>
      exportCards: typeof exportCards
    }
  }
}
