// Placeholder names of a template, inferred from the string: 'a {x} b {y}' gives 'x' | 'y'
export type Placeholders<T extends string> = T extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never

export type MessageParams<T extends string> = Record<Placeholders<T>, string | number>

// Replaces every `{name}` in the template. Unknown placeholders are left as they are.
export function formatMessage<T extends string>(
  template: T,
  ...[params]: Placeholders<T> extends never ? [] : [MessageParams<T>]
): string {
  if (!params) return template
  const values: Record<string, string | number> = params
  return template.replaceAll(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}
