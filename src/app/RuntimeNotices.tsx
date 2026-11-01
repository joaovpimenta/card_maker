import { useEffect, useState } from 'react'
import { useEditorStore } from '../store/editorStore'

export default function RuntimeNotices() {
  const [fontError, setFontError] = useState('')
  const storageError = useEditorStore(state => state.storageError)
  const warnings = useEditorStore(state => state.hydrationWarnings)
  useEffect(() => {
    const onError = (event: Event) => setFontError((event as CustomEvent<string>).detail)
    window.addEventListener('cardmaker:font-error', onError)
    return () => window.removeEventListener('cardmaker:font-error', onError)
  }, [])
  if (!fontError && !storageError && !warnings.length) return null
  return <aside role="alert" style={{padding:'10px 20px',background:'#fff6df',color:'#684908',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
    {storageError && <span>O salvamento local está indisponível ou os dados salvos precisam de recuperação. Baixe seu projeto para guardar uma cópia. {storageError}</span>}
    {warnings.map((warning, index) => <span key={index}>{warning}</span>)}
    {fontError && <><span>{fontError}</span><button style={{minHeight:44}} onClick={() => setFontError('')}>Fechar aviso de fonte</button></>}
  </aside>
}
