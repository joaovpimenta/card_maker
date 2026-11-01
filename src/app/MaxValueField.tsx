
interface BindFieldProps {
  label: string
  numberValue: number | undefined
  fieldValue: string | undefined
  tab: 'number' | 'field'
  setTab: (tab: 'number' | 'field') => void
  onNumberChange: (value: number) => void
  onFieldChange: (value: string | undefined) => void
  availableFields: string[]
  fallbackNumber?: number
}

export function BindField({
  label,
  numberValue,
  fieldValue,
  tab,
  setTab,
  onNumberChange,
  onFieldChange,
  availableFields,
  fallbackNumber
}: BindFieldProps) {
  return (
    <fieldset style={{ padding: 0, border: 0, margin: 0, minWidth: 0 }}>
      <legend style={{ marginBottom: 4 }}>{label}</legend>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        <button
          type="button"
          style={{
            flex: 1,
            fontWeight: tab === 'number' ? 'bold' : 'normal',
            borderBottom: tab === 'number' ? '2px solid #333' : '1px solid #ccc',
            background: tab === 'number' ? '#f5f5f5' : '#fff',
            borderRadius: '4px 0 0 4px',
            cursor: 'pointer',
            padding: '4px 0',
          }}
          onClick={() => setTab('number')}
        >
          Número
        </button>
        <button
          type="button"
          style={{
            flex: 1,
            fontWeight: tab === 'field' ? 'bold' : 'normal',
            borderBottom: tab === 'field' ? '2px solid #333' : '1px solid #ccc',
            background: tab === 'field' ? '#f5f5f5' : '#fff',
            borderRadius: '0 4px 4px 0',
            cursor: 'pointer',
            padding: '4px 0',
          }}
          onClick={() => setTab('field')}
        >
          Campo dos dados
        </button>
      </div>
      {tab === 'number' ? (
        <input
          aria-label={label}
          type="number"
          min={1}
          value={numberValue ?? fallbackNumber ?? ''}
          onChange={e => onNumberChange(parseInt(e.target.value))}
          disabled={fieldValue !== undefined}
        />
      ) : (
        <select
          aria-label={label}
          value={fieldValue || ''}
          onChange={e => onFieldChange(e.target.value || undefined)}
        >
          <option value="">Escolha um campo</option>
          {availableFields.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      )}
    </fieldset>
  )
}

