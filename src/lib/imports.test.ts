import { describe, expect, it } from 'vitest'
import { createModuleResolver, libraryPath } from './imports'

describe('library imports', () => {
  it('mounts an opened folder at lib while preserving its internal paths', () => {
    expect(libraryPath('my-library/primitives/next-word.tm', 'next-word.tm')).toBe('lib/primitives/next-word.tm')
    expect(libraryPath('project/lib/primitives/delete-word.tm', 'delete-word.tm')).toBe('lib/primitives/delete-word.tm')
  })

  it('resolves exact local paths without basename collisions', async () => {
    const resolve = createModuleResolver(new Map([
      ['lib/first/move.tm', 'first'],
      ['lib/second/move.tm', 'second'],
    ]))
    await expect(resolve('lib/first/move.tm')).resolves.toBe('first')
    await expect(resolve('lib/second/move.tm')).resolves.toBe('second')
  })
})
