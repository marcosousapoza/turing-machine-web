const REGISTRY_ROOT = 'https://raw.githubusercontent.com/marcosousapoza/turing-machine-programs/main/programs/'
const IMPORT_PATTERN = /^\s*import\s+"([^"]+)"\s*;?\s*$/gm

export async function resolveImports(
  source: string,
  localFiles: ReadonlyMap<string, string>,
  chain: string[] = [],
): Promise<string> {
  const paths = [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1])
  const imported: string[] = []
  for (const path of paths) {
    if (chain.includes(path)) throw new Error(`Import cycle: ${[...chain, path].join(' → ')}`)
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.tm$/.test(path) || path.includes('..')) {
      throw new Error(`Invalid import path: ${path}`)
    }
    const local = localFiles.get(path) ?? localFiles.get(path.split('/').at(-1) ?? path)
    const importedSource = local ?? await fetchProgram(path)
    imported.push(await resolveImports(importedSource, localFiles, [...chain, path]))
  }
  return [source, ...imported].join('\n\n')
}

export async function fetchProgram(path: string): Promise<string> {
  const response = await fetch(new URL(path, REGISTRY_ROOT))
  if (!response.ok) throw new Error(`Could not import ${path} (${response.status}).`)
  return response.text()
}
