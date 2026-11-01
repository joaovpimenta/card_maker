import React from "react"
import { useEditorStore } from "../store/editorStore"
import { Modal } from "./Modal"
import { executeCommand } from "../project/commands"
import type { ProcessRule } from "../models/Template"

export function ProcessRulesModal({ onClose }: { onClose: () => void }) {
    const rules = useEditorStore((s) => s.processRules)
    const [error, setError] = React.useState("")
    const addRule = (rule: ProcessRule) => void executeCommand({type:"addProcessRule",rule}).then(r=>setError(r.ok?"":r.errors.map(e=>e.message).join("; ")))
    const updateRule = (index:number, updates:Record<string,unknown>) => void executeCommand({type:"updateProcessRule",index,updates}).then(r=>setError(r.ok?"":r.errors.map(e=>e.message).join("; ")))
    const removeRule = (index:number) => void executeCommand({type:"removeProcessRule",index}).then(r=>setError(r.ok?"":r.errors.map(e=>e.message).join("; ")))

    return (
        <Modal onClose={onClose} title="Regras de dados">
            <h2>Regras de dados</h2>
            <p>Regras simples transformam valores conforme uma comparação. JavaScript personalizado não está disponível.</p>
            {error && <p role="alert">{error}</p>}

            {rules.map((rule, i) => {

                let content = rule.content;
                if (content && content.length > 20) {
                    content = content.substring(0, 10) + ".." + content.substring(content.length - 10);
                }
                return (
                <div
                    key={i}
                    style={{
                        border: "1px solid #ddd",
                        borderRadius: 6,
                        padding: 10,
                        marginBottom: 10,
                    }}
                >
                    <p>Se o valor do campo <b>{rule.key||"<key>"}</b> <b>{rule.comparator}</b> <b>{rule.value||"<value>"}</b>, adicione um campo chamado <b>{rule.new_key||"<new_key>"}</b> com o valor <b>{content || "<content>"}</b></p>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 80px minmax(0,1fr)", gap: 8 }}>
                        <input
                            aria-label={`Campo da regra ${i + 1}`}
                            style={{ minWidth: 0, width: "100%" }}
                            placeholder="campo"
                            value={rule.key}
                            onChange={(e) => updateRule(i, { key: e.target.value })}
                        />

                        <select
                            aria-label={`Comparação da regra ${i + 1}`}
                            style={{ minWidth: 0, width: "100%" }}
                            value={rule.comparator}
                            onChange={(e) =>
                                updateRule(i, { comparator: e.target.value as "=" | "!=" | "~" | "!~" | ">" | "<" | ">=" | "<=" | "null" | "not null" | "custom"})
                            }
                        >
                            <option value="=">=</option>
                            <option value="!=">!=</option>
                            <option value="~">~</option>
                            <option value="!~">!~</option>
                            <option value=">">&gt;</option>
                            <option value="<">&lt;</option>
                            <option value=">=">&gt;=</option>
                            <option value="<=">&lt;=</option>
                            <option value="null">null</option>
                            <option value="not null">not null</option>
                            {rule.comparator === "custom" && <option value="custom" disabled>JavaScript desativado</option>}
                        </select>

                        <input
                            aria-label={`Valor da regra ${i + 1}`}
                            style={{ minWidth: 0, width: "100%" }}
                            placeholder="valor para comparar"
                            value={rule.value}
                            onChange={(e) => updateRule(i, { value: e.target.value })}
                        />
                    </div>

                    <div style={{ marginTop: 8 }}>
                        <input
                            aria-label={`Campo de destino da regra ${i + 1}`}
                            placeholder="nome do novo campo"
                            value={rule.new_key}
                            onChange={(e) => updateRule(i, { new_key: e.target.value })}
                            style={{ width: "100%", marginBottom: 6 }}
                        />

                        {rule.comparator === "custom" ? <p role="alert">Esta regra legada contém JavaScript e foi desativada. Remova-a para continuar.</p> : <textarea
                            aria-label={`Conteúdo da regra ${i + 1}`}
                            placeholder="conteúdo a definir"
                            value={rule.content}
                            onChange={(e) => updateRule(i, { content: e.target.value })}
                            rows={3}
                            style={{ width: "100%" }}
                        />}
                    </div>

                    <button
                        style={{ marginTop: 6, color: "red" }}
                        onClick={() => removeRule(i)}
                    >
                        Remover regra
                    </button>
                </div>
            )})}

            <button
                onClick={() =>
                    addRule({
                        key: "",
                        comparator: "=",
                        value: "",
                        new_key: "",
                        content: "",
                    })
                }
            >
                + Adicionar regra
            </button>

            <div style={{ marginTop: 16, textAlign: "right" }}>
                <button onClick={onClose}>Fechar</button>
            </div>
        </Modal>
    )
}

