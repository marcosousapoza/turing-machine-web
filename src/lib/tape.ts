export function parseTapeNotation(notation: string): string {
  if (!notation) return ''

  let tape = ''
  let position = 0
  while (position < notation.length) {
    const prefix = notation[position]
    if (prefix !== 'b' && prefix !== 'x') {
      throw syntaxError(position, 'expected a binary (`b`) or hexadecimal (`x`) word')
    }

    const wordStart = position
    const separator = notation.indexOf('#', position + 1)
    if (separator === -1) {
      throw syntaxError(notation.length, `word starting at character ${wordStart + 1} needs a trailing \`#\``)
    }
    const digits = notation.slice(position + 1, separator)
    if (!digits) throw syntaxError(position + 1, `\`${prefix}\` must be followed by at least one digit`)

    const validDigit = prefix === 'b' ? /[01]/ : /[0-9a-fA-F]/
    const invalidOffset = [...digits].findIndex((digit) => !validDigit.test(digit))
    if (invalidOffset !== -1) {
      throw syntaxError(position + 1 + invalidOffset, `invalid ${prefix === 'b' ? 'binary' : 'hexadecimal'} digit \`${digits[invalidOffset]}\``)
    }

    tape += prefix === 'b'
      ? digits
      : [...digits].map((digit) => Number.parseInt(digit, 16).toString(2).padStart(4, '0')).join('')
    tape += '#'
    position = separator + 1
  }
  return tape
}

function syntaxError(position: number, message: string): Error {
  return new Error(`Tape syntax error at character ${position + 1}: ${message}.`)
}
