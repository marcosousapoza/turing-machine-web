export type TapeFormat = 'symbols' | 'string' | 'binary' | 'hex' | 'decimal'

export function tapeContent(tape: string[], blank = '⊔'): string {
  return tape.join('').replace(new RegExp(`${escapeRegex(blank)}+$`), '')
}

export function formatTape(tape: string[], format: TapeFormat, blank = '⊔'): string {
  const content = tapeContent(tape, blank)
  if (!content) return 'Empty'
  if (format === 'symbols') return content
  if (content.includes(blank)) return 'Contains internal blanks'

  return content.split('#').map((word) => formatWord(word, format)).join('#')
}

export function replaceTape(tape: string[], index: number, value: string, blank = '⊔'): string {
  const next = [...tape]
  while (next.length <= index) next.push(blank)
  next[index] = value
  while (next.at(-1) === blank) next.pop()
  return next.join('')
}

export function pasteTape(tape: string[], index: number, value: string, blank = '⊔'): string {
  const symbols = [...value.replaceAll(/\s/g, '')]
  const invalid = symbols.find((symbol) => !['0', '1', '#', blank].includes(symbol))
  if (invalid) throw new Error(`Tape symbol \`${invalid}\` is invalid. Use 0, 1, #, or ${blank}.`)
  const next = [...tape]
  while (next.length < index) next.push(blank)
  next.splice(index, symbols.length, ...symbols)
  while (next.at(-1) === blank) next.pop()
  return next.join('')
}

function formatWord(word: string, format: Exclude<TapeFormat, 'symbols'>): string {
  if (!word) return ''
  if (/[^01]/.test(word)) return 'Not a binary word'
  if (format === 'string') {
    if (word.length % 8 !== 0) return `Incomplete UTF-8 byte (${word.length} bits)`
    const bytes = Uint8Array.from(word.match(/.{8}/g) ?? [], (byte) => Number.parseInt(byte, 2))
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes) || 'Empty'
    } catch {
      return 'Invalid UTF-8 sequence'
    }
  }
  if (format === 'binary') return `0b${word}`
  const value = BigInt(`0b${word}`)
  if (format === 'decimal') return value.toString(10)
  return `0x${value.toString(16).padStart(Math.ceil(word.length / 4), '0')}`
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
