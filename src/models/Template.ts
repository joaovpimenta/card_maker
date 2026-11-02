import type { CardElement } from "./Element"

export interface CardTemplate {
  width: number
  height: number
  elements: CardElement[]
  customFonts: string[]
  guided?: { id: "fantasy" | "character" | "education" | "product"; version: 1; color: string }
}

export type ProcessRule = {
  key: string
  comparator: "=" | "!=" | "~" | "!~" | ">" | "<" | ">=" | "<=" | "null" | "not null" | "custom"
  value: string
  new_key: string
  content: string
}