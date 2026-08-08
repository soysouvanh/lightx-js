export type TokenType =
  | "Text"
  | "PrintSafe" // {%%= TS_EXPRESSION %}
  | "PrintRaw" // {%= TS_EXPRESSION %}
  | "Script" // {% JS/TS_CODE %} (Ex: if (view_data.x) { )
  | "Include"
  | "Extends"
  | "Block"
  | "EndBlock";

export interface Token {
  type: TokenType;
  value: string; // Ex: chaine extraite, ou code TS d'origine
  line: number;
}
