import { describe, expect, it } from 'vitest'
import { parseTapeNotation } from './tape'

describe('tape notation', () => {
  it('parses mixed binary and hexadecimal words', () => {
    expect(parseTapeNotation('xFFFF#b0011#')).toBe('1111111111111111#0011#')
  })

  it('preserves leading zeroes and hexadecimal nibble width', () => {
    expect(parseTapeNotation('x00aF#b001#')).toBe('0000000010101111#001#')
  })

  it('allows an empty tape', () => {
    expect(parseTapeNotation('')).toBe('')
  })

  it.each([
    ['101#', 'character 1'],
    ['b101', 'character 5'],
    ['b#', 'character 2'],
    ['b102#', 'character 4'],
    ['xFG#', 'character 3'],
    ['b1##', 'character 4'],
    ['b1# xF#', 'character 4'],
  ])('rejects malformed notation %s', (notation, location) => {
    expect(() => parseTapeNotation(notation)).toThrow(location)
  })
})
