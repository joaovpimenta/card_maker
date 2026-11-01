import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import { installBrowserApi } from './project/browserApi'
import './app/global.css'
import { ensureTemplateFonts } from './utils/googleFonts'
import { useEditorStore } from './store/editorStore'

installBrowserApi()
let previousFonts = ''
useEditorStore.subscribe(state => {
  const key = JSON.stringify(state.template.customFonts)
  if (key === previousFonts) return
  previousFonts = key
  void ensureTemplateFonts(state.template).catch(error => {
    window.dispatchEvent(new CustomEvent('cardmaker:font-error', { detail: String(error.message) }))
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

