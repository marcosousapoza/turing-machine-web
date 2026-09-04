const REGISTRY_ROOT = 'https://raw.githubusercontent.com/marcosousapoza/turing-machine-programs/main/'
export function createModuleResolver(localFiles: ReadonlyMap<string, string>): (path: string) => Promise<string> {
  return async (path: string) => {
    validateImportPath(path)
    const local = localFiles.get(path)
    return local ?? fetchProgram(path)
  }
}

export async function fetchProgram(path: string): Promise<string> {
  validateImportPath(path)
  const response = await fetch(new URL(path, REGISTRY_ROOT))
  if (!response.ok) throw new Error(`Could not import ${path} (${response.status}).`)
  return response.text()
}

export function libraryPath(relativePath: string, fileName: string): string {
  const parts = (relativePath || fileName).split('/').filter(Boolean)
  if (parts.length > 1) parts.shift()
  const relative = parts.join('/')
  return relative.startsWith('lib/') ? relative : `lib/${relative}`
}

function validateImportPath(path: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.tm$/.test(path) || path.includes('..')) {
    throw new Error(`Invalid import path: ${path}`)
  }
}
