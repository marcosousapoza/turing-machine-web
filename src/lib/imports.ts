const REGISTRY_ROOT = 'https://raw.githubusercontent.com/marcosousapoza/turing-machine-programs/main/programs/'
export function createModuleResolver(localFiles: ReadonlyMap<string, string>): (path: string) => Promise<string> {
  return async (path: string) => {
    validateImportPath(path)
    const local = localFiles.get(path) ?? localFiles.get(path.split('/').at(-1) ?? path)
    return local ?? fetchProgram(path)
  }
}

export async function fetchProgram(path: string): Promise<string> {
  validateImportPath(path)
  const response = await fetch(new URL(path, REGISTRY_ROOT))
  if (!response.ok) throw new Error(`Could not import ${path} (${response.status}).`)
  return response.text()
}

function validateImportPath(path: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.tm$/.test(path) || path.includes('..')) {
    throw new Error(`Invalid import path: ${path}`)
  }
}
