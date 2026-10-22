import type { CustomerRow } from '../domain/customer'

// TEMPORARY: deterministic mock rows with typical mistakes, used until real parsing is wired up

const FIRST_NAMES = [
  'Anna',
  'Lukas',
  ' Maria',
  'Jonas',
  'Sofia',
  '',
  'Noah',
  'Emma ',
  'Liam',
  'Mia',
]
const LAST_NAMES = [
  'Muller',
  'Schmidt',
  'Garcia',
  'Rossi',
  ' Dubois',
  'Novak',
  'Smith',
  '',
  'Kowalski',
]
const COUNTRIES = [
  'DE',
  'Germany',
  'fr',
  'France',
  'ES',
  'Spain ',
  'IT',
  'Deutschland',
  'U.S.',
  'PL',
]
const PLANS = ['free', 'pro', 'Pro', 'enterprise', 'FREE', 'premium', 'pro ', '']
const SPENDS = ['0', '19.99', '€49', '1,5', '120.00', '-5', 'abc', '']

const pick = <T>(list: readonly T[], i: number) => list[i % list.length]

function signupDate(i: number) {
  const day = String((i % 28) + 1).padStart(2, '0')
  const month = String((i % 12) + 1).padStart(2, '0')
  if (i % 11 === 0) return `${day}/${month}/2024`
  if (i % 17 === 0) return '2024-02-30'
  return `2024-${month}-${day}`
}

export function createMockCustomers(count: number): CustomerRow[] {
  return Array.from({ length: count }, (_, i) => {
    const first = pick(FIRST_NAMES, i)
    const last = pick(LAST_NAMES, i * 7)
    const emailId = i % 23 === 0 ? i - 1 : i // occasional duplicate emails
    return {
      customer_id: i % 31 === 0 ? '' : `C${String(10000 + i)}`,
      first_name: first,
      last_name: last,
      email: i % 13 === 0 ? 'not-an-email' : `user${emailId}@example.com`,
      signup_date: signupDate(i),
      country: pick(COUNTRIES, i * 3),
      plan: pick(PLANS, i * 5),
      monthly_spend: pick(SPENDS, i * 11),
    }
  })
}
