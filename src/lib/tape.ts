export function replaceTape(tape: string[], index: number, value: string, blank = '⊔'): string {
  const next = [...tape]
  while (next.length <= index) next.push(blank)
  next[index] = value
  while (next.at(-1) === blank) next.pop()
  return next.join('')
}

export function pasteTape(tape: string[], index: number, value: string, blank = '⊔'): string {
  const symbols = [...value]
  const next = [...tape]
  while (next.length < index) next.push(blank)
  next.splice(index, symbols.length, ...symbols)
  while (next.at(-1) === blank) next.pop()
  return next.join('')
}
