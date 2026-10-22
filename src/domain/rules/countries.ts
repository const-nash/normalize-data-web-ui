// Generic country lookup: ISO 3166-1 alpha-2 codes and names from Intl.DisplayNames in a few
// locales, plus a short alias list. Values that match nothing are never guessed.

const NAME_LOCALES = ['en', 'de', 'fr', 'es', 'it']

// Region codes Intl knows that are not assigned ISO 3166-1 country codes: groupings, user
// assigned and reserved codes (UK is reserved; the code for the United Kingdom is GB)
const NOT_COUNTRIES = new Set([
  'EU',
  'EZ',
  'UN',
  'QO',
  'XA',
  'XB',
  'XK',
  'ZZ',
  'AC',
  'CP',
  'CQ',
  'DG',
  'EA',
  'IC',
  'TA',
  'UK',
])

const ALIASES: Record<string, string> = {
  usa: 'US',
  'united states of america': 'US',
  america: 'US',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  holland: 'NL',
  'czech republic': 'CZ',
}

// Lowercase, no accents, no dots, single spaces: " U.S. " and "us" give the same key
export const countryKey = (value: string) =>
  value
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .replaceAll('.', '')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .toLowerCase()

function buildLookup() {
  const codes = new Set<string>()
  const byName = new Map<string, string>()
  const regionNames = NAME_LOCALES.map(
    (locale) => new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }),
  )
  const A = 'A'.charCodeAt(0)

  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i, A + j)
      if (NOT_COUNTRIES.has(code)) continue
      // Deprecated codes canonicalize to their successor (SU becomes RU), so they are skipped
      if (new Intl.Locale(`und-${code}`).region !== code) continue
      const names = regionNames
        .map((display) => display.of(code))
        .filter((name) => name !== undefined)
      if (names.length === 0) continue
      codes.add(code)
      for (const name of names) byName.set(countryKey(name), code)
    }
  }
  for (const [alias, code] of Object.entries(ALIASES)) byName.set(alias, code)
  return { codes, byName }
}

export const { codes: COUNTRY_CODES, byName: CODE_BY_NAME } = buildLookup()

export type CountryMatch =
  | { kind: 'valid' }
  | { kind: 'code'; code: string } // a code with wrong case, spaces or dots
  | { kind: 'name'; code: string } // a country name or alias
  | { kind: 'unknown' }

export function matchCountry(raw: string): CountryMatch {
  if (COUNTRY_CODES.has(raw)) return { kind: 'valid' }
  const key = countryKey(raw)
  const asCode = key.toUpperCase()
  if (key.length === 2 && COUNTRY_CODES.has(asCode)) return { kind: 'code', code: asCode }
  const code = CODE_BY_NAME.get(key)
  return code ? { kind: 'name', code } : { kind: 'unknown' }
}
