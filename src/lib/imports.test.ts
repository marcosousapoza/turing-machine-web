import { describe, expect, it } from 'vitest'
import { createModuleResolver, libraryPath } from './imports'

describe('library imports', () => {
  it('mounts an opened folder at lib while preserving its internal paths', () => {
    expect(libraryPath('my-library/logic/not.tm', 'not.tm')).toBe('lib/logic/not.tm')
    expect(libraryPath('project/lib/math/add.tm', 'add.tm')).toBe('lib/math/add.tm')
  })

  it('resolves exact local paths without basename collisions', async () => {
    const resolve = createModuleResolver(new Map([
      ['lib/first/not.tm', 'first'],
      ['lib/second/not.tm', 'second'],
    ]))
    await expect(resolve('lib/first/not.tm')).resolves.toBe('first')
    await expect(resolve('lib/second/not.tm')).resolves.toBe('second')
  })
})
