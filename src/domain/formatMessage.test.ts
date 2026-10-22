import { describe, expect, it } from 'vitest'
import { ERROR_MESSAGE } from '../constants/errorMessages'
import { formatMessage } from './formatMessage'

describe('formatMessage', () => {
  it('fills placeholders', () => {
    expect(formatMessage(ERROR_MESSAGE.COUNTRY_INVALID, { value: 'Germany', example: 'DE' })).toBe(
      'Country "Germany" should be a 2-letter code like DE.',
    )
  })

  it('formats numbers', () => {
    expect(formatMessage(ERROR_MESSAGE.FILE_TOO_LARGE, { maxMb: 100 })).toBe(
      'This file is larger than 100 MB. Please split it into smaller files.',
    )
  })

  it('fills a placeholder used more than once', () => {
    expect(formatMessage('{a} and {a}', { a: 'x' })).toBe('x and x')
  })

  it('returns templates without placeholders unchanged', () => {
    expect(formatMessage(ERROR_MESSAGE.FILE_EMPTY)).toBe(ERROR_MESSAGE.FILE_EMPTY)
  })

  it('keeps placeholders that have no value', () => {
    // Types forbid this, but params can come from untyped data at runtime
    const params = { a: 'x' } as unknown as { a: string; b: string }
    expect(formatMessage('{a} {b}', params)).toBe('x {b}')
  })

  it('does not reinterpret placeholders inside values', () => {
    expect(formatMessage('{a} {b}', { a: '{b}', b: 'y' })).toBe('{b} y')
  })
})
