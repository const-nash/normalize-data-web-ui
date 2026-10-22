// Dates are parsed explicitly. `new Date(string)` guesses formats and rolls impossible dates
// over (2024-02-30 becomes March 1), so it is never used.

export type DateParse =
  | { kind: 'valid' } // already YYYY-MM-DD
  | { kind: 'convertible'; value: string; ambiguous: boolean }
  | { kind: 'impossible' }
  | { kind: 'unrecognized' }

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const YEAR_FIRST = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/
const YEAR_LAST = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

export function isRealDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1) return false
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= days[month - 1]
}

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

function convert(year: number, month: number, day: number, ambiguous: boolean): DateParse {
  return isRealDate(year, month, day)
    ? { kind: 'convertible', value: iso(year, month, day), ambiguous }
    : { kind: 'impossible' }
}

export function parseDate(raw: string): DateParse {
  const value = raw.trim()

  const isoMatch = ISO.exec(value)
  if (isoMatch) {
    const [year, month, day] = isoMatch.slice(1).map(Number)
    if (!isRealDate(year, month, day)) return { kind: 'impossible' }
    return value === raw ? { kind: 'valid' } : { kind: 'convertible', value, ambiguous: false }
  }

  const yearFirst = YEAR_FIRST.exec(value)
  if (yearFirst) {
    const [year, month, day] = yearFirst.slice(1).map(Number)
    return convert(year, month, day, false)
  }

  const yearLast = YEAR_LAST.exec(value)
  if (yearLast) {
    const [first, second, year] = yearLast.slice(1).map(Number)
    // A part above 12 can only be the day. Otherwise assume day/month, the European order.
    if (first > 12) return convert(year, second, first, false)
    if (second > 12) return convert(year, first, second, false)
    return convert(year, second, first, first !== second)
  }

  return { kind: 'unrecognized' }
}
