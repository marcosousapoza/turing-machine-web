export type TapeEncoding = 'auto' | 'text' | 'binary' | 'hex' | 'decimal'
export type TapeFormat = 'string' | 'binary' | 'hex' | 'decimal'

export function decodeTape(value: string, encoding: TapeEncoding): string {
  const selected = encoding === 'auto'
    ? value.trim().toLowerCase().startsWith('0x') ? 'hex'
      : value.trim().toLowerCase().startsWith('0b') ? 'binary'
        : 'text'
    : encoding

  if (selected === 'text') return value
  const compact = value.replaceAll(/\s|_/g, '')
  if (selected === 'binary') {
    const binary = compact.replace(/^0b/i, '')
    if (!binary || /[^01]/.test(binary)) throw new Error('Binary input may only contain 0 and 1.')
    return binary
  }
  if (selected === 'hex') {
    const hex = compact.replace(/^0x/i, '')
    if (!hex || /[^0-9a-f]/i.test(hex)) throw new Error('Hex input must contain hexadecimal digits.')
    return [...hex].map((digit) => Number.parseInt(digit, 16).toString(2).padStart(4, '0')).join('')
  }
  if (!compact || /\D/.test(compact)) throw new Error('Decimal input must be a non-negative integer.')
  return BigInt(compact).toString(2)
}

export function tapeContent(tape: string[], blank = '⊔'): string {
  return tape.join('').replace(new RegExp(`${escapeRegex(blank)}+$`), '')
}

export function formatTape(tape: string[], format: TapeFormat, blank = '⊔'): string {
  const content = tapeContent(tape, blank)
  if (format === 'string') return content || '∅'
  if (!content || /[^01]/.test(content)) return 'Not a binary tape'
  if (format === 'binary') return `0b${content}`
  const value = BigInt(`0b${content}`)
  if (format === 'decimal') return value.toString(10)
  return `0x${value.toString(16).padStart(Math.ceil(content.length / 4), '0')}`
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
