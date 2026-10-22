// Monthly spend: a number of 0 or more, dot as decimal separator, no currency.

export type AmountParse =
  | { kind: 'valid' }
  | { kind: 'cleaned'; value: string } // currency signs or spaces removed
  | { kind: 'separator'; value: string } // comma decimals or thousands separators converted
  | { kind: 'negative' }
  | { kind: 'invalid' }

const NUMBER = /^-?\d+(\.\d+)?$/
const CURRENCY = /[€$£¥]|\b(?:eur|usd|gbp|chf)\b/gi
// 1.234,56 (European thousands and decimals)
const DOT_THOUSANDS_COMMA_DECIMAL = /^-?\d{1,3}(\.\d{3})+,\d+$/
// 1,5 or 49,90: a comma followed by 1 or 2 digits is a decimal comma
const COMMA_DECIMAL = /^-?\d+,\d{1,2}$/
// 1,234 or 1,234.50: commas between groups of 3 digits are thousands separators
const COMMA_THOUSANDS = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/

const withSign = (value: string): AmountParse =>
  value.startsWith('-') ? { kind: 'negative' } : { kind: 'separator', value }

export function parseAmount(raw: string): AmountParse {
  if (NUMBER.test(raw)) return raw.startsWith('-') ? { kind: 'negative' } : { kind: 'valid' }

  const cleaned = raw.replaceAll(CURRENCY, '').replaceAll(/\s/g, '')
  if (NUMBER.test(cleaned)) {
    return cleaned.startsWith('-') ? { kind: 'negative' } : { kind: 'cleaned', value: cleaned }
  }
  if (DOT_THOUSANDS_COMMA_DECIMAL.test(cleaned)) {
    return withSign(cleaned.replaceAll('.', '').replace(',', '.'))
  }
  if (COMMA_DECIMAL.test(cleaned)) return withSign(cleaned.replace(',', '.'))
  if (COMMA_THOUSANDS.test(cleaned)) return withSign(cleaned.replaceAll(',', ''))
  return { kind: 'invalid' }
}
