import { Machine } from '@marcosousapoza/turing-machine-wasm'

export type Snapshot = {
  state: string
  head: number
  tape: string[]
  halted: boolean
  accepted: boolean
  rejected: boolean
  steps: number
  paused?: boolean
  block?: string
}

export type Definition = {
  model: string
  kind: 'program' | 'function'
  name: string
  docs?: string
  imports?: string[]
  input_alphabet: string[]
  tape_alphabet: string[]
  blank: string
  start: string
  accept: string
  reject: string
  states: { name: string; docs?: string }[]
}

export type ModuleResolver = (path: string) => Promise<string>

type ImportDeclaration = { path: string; alias: string; namespace: string }
type CompositionPlan = {
  name: string
  docs?: string
  imports: ImportDeclaration[]
  includes: Map<string, string>
  blocks: Map<string, ImportDeclaration>
  pauses: Set<string>
  start: string
  accept: string
  reject: string
}

type LoadableMachine = Machine & { load(source: string): string; set_head(head: number): string; set_tape(tape: string): string }

const IDENTIFIER = '[a-zA-Z_][a-zA-Z0-9_]*'
const BLOCK_STEP_LIMIT = 1_000_000

export function isComposition(source: string): boolean {
  return /^\s*import\s+"/m.test(source)
}

export class CompositeMachine {
  private machine: LoadableMachine
  private current: Snapshot
  private boundary = false
  private active?: ImportDeclaration

  private constructor(
    private readonly plan: CompositionPlan,
    private readonly resolveModule: ModuleResolver,
    private readonly firstConcrete: string,
    machine: LoadableMachine,
    initial: Snapshot,
  ) {
    this.machine = machine
    this.current = initial
  }

  static async create(source: string, tape: string, resolveModule: ModuleResolver): Promise<CompositeMachine> {
    const plan = parseComposition(source)
    const first = plan.blocks.get(plan.start)
    if (!first) throw new Error(`No function starts at program state \`${plan.start}\`.`)
    const concrete = buildConcreteBlock(plan, first, await resolveModule(first.path))
    const machine = new Machine(concrete, tape) as LoadableMachine
    const initial = withBlock(readSnapshot(machine.snapshot()), first.alias)
    const composite = new CompositeMachine(plan, resolveModule, concrete, machine, initial)
    composite.active = first
    return composite
  }

  snapshot(): string {
    return JSON.stringify(this.current)
  }

  definition(): string {
    const states = new Set([this.plan.start, this.plan.accept, this.plan.reject, ...this.plan.pauses])
    for (const state of this.plan.includes.values()) states.add(state)
    const concrete = JSON.parse(this.machine.definition()) as Definition
    const definition: Definition = {
      model: 'sipser-3e',
      kind: 'program',
      name: this.plan.name,
      docs: this.plan.docs,
      imports: this.plan.imports.map((item) => item.path),
      input_alphabet: concrete.input_alphabet,
      tape_alphabet: concrete.tape_alphabet,
      blank: concrete.blank,
      start: this.plan.start,
      accept: this.plan.accept,
      reject: this.plan.reject,
      states: [...states].sort().map((name) => ({ name })),
    }
    return JSON.stringify(definition)
  }

  async step(): Promise<string> {
    if (this.current.halted) return this.snapshot()
    await this.enterCurrentBlock()
    const before = this.current.steps
    const result = readSnapshot(this.machine.run(BLOCK_STEP_LIMIT))
    if (!result.halted) {
      this.current = withBlock(result, this.active?.alias)
      throw new Error(`Function \`${this.active?.alias}\` exceeded the ${BLOCK_STEP_LIMIT.toLocaleString()}-step safety limit.`)
    }
    this.finishBlock(result)
    if (this.current.steps === before) throw new Error(`Function \`${this.active?.alias}\` halted without executing.`)
    return this.snapshot()
  }

  async run(maxSteps: number): Promise<string> {
    if (this.current.paused) this.current = { ...this.current, paused: false }
    const target = this.current.steps + maxSteps
    while (!this.current.halted && this.current.steps < target) {
      await this.enterCurrentBlock()
      const result = readSnapshot(this.machine.run(Math.min(target - this.current.steps, 0xffff_ffff)))
      if (!result.halted) {
        this.current = withBlock(result, this.active?.alias)
        break
      }
      this.finishBlock(result)
      if (this.current.paused) this.current = { ...this.current, paused: false }
    }
    return this.snapshot()
  }

  async setTape(tape: string): Promise<string> {
    const first = this.plan.blocks.get(this.plan.start)
    if (!first) throw new Error(`No function starts at program state \`${this.plan.start}\`.`)
    this.machine.load(this.firstConcrete)
    this.current = withBlock(readSnapshot(this.machine.set_tape(tape)), first.alias)
    this.active = first
    this.boundary = false
    return this.snapshot()
  }

  setHead(head: number): string {
    const first = this.plan.blocks.get(this.plan.start)
    if (!first) throw new Error(`No function starts at program state \`${this.plan.start}\`.`)
    this.machine.load(this.firstConcrete)
    this.current = withBlock(readSnapshot(this.machine.set_head(head)), first.alias)
    this.active = first
    this.boundary = false
    return this.snapshot()
  }

  free(): void {
    this.machine.free()
  }

  private async enterCurrentBlock(): Promise<void> {
    if (!this.boundary && !this.current.paused) return
    this.current = { ...this.current, paused: false }
    const block = this.plan.blocks.get(this.current.state)
    if (!block) throw new Error(`No function starts at program state \`${this.current.state}\`.`)
    const concrete = buildConcreteBlock(this.plan, block, await this.resolveModule(block.path))
    this.current = withBlock(readSnapshot(this.machine.load(concrete)), block.alias)
    this.active = block
    this.boundary = false
  }

  private finishBlock(result: Snapshot): void {
    const state = result.rejected ? this.plan.reject : result.state
    const halted = state === this.plan.accept || state === this.plan.reject
    this.current = {
      ...result,
      state,
      halted,
      accepted: state === this.plan.accept,
      rejected: state === this.plan.reject,
      paused: !halted && this.plan.pauses.has(state),
      block: this.active?.alias,
    }
    this.boundary = !halted
  }
}

export function parseComposition(source: string): CompositionPlan {
  let model = false
  let name: string | undefined
  let docs: string | undefined
  let start: string | undefined
  let accept: string | undefined
  let reject: string | undefined
  const imports: ImportDeclaration[] = []
  const includes = new Map<string, string>()
  const pauses = new Set<string>()
  let pendingDocs: string[] = []

  for (const [offset, original] of source.split(/\r?\n/).entries()) {
    const lineNumber = offset + 1
    const trimmed = original.trim()
    if (trimmed.startsWith('///')) {
      pendingDocs.push(trimmed.slice(3).trim())
      continue
    }
    const line = trimmed.split('//')[0].trim().replace(/;$/, '').trim()
    if (!line) continue
    const lineDocs = pendingDocs.length ? pendingDocs.join('\n') : undefined
    pendingDocs = []

    if (line === 'model sipser-3e') {
      if (model) fail(lineNumber, 'duplicate `model` declaration')
      model = true
      continue
    }
    let match = line.match(new RegExp(`^program (${IDENTIFIER})$`))
    if (match) {
      if (name) fail(lineNumber, 'duplicate `program` declaration')
      name = match[1]
      docs = lineDocs
      continue
    }
    match = line.match(new RegExp(`^import "([^"]+)" as (${IDENTIFIER})$`))
    if (match) {
      if (imports.some((item) => item.alias === match![2])) fail(lineNumber, `duplicate import alias \`${match[2]}\``)
      imports.push({ path: match[1], alias: match[2], namespace: `__tm_${imports.length}_${match[2]}__` })
      continue
    }
    match = line.match(new RegExp(`^include (${IDENTIFIER})\\.(start|accept) as (${IDENTIFIER})$`))
    if (match) {
      const key = `${match[1]}.${match[2]}`
      if (includes.has(key)) fail(lineNumber, `duplicate include for \`${key}\``)
      assertPublicState(match[3], lineNumber)
      includes.set(key, match[3])
      continue
    }
    if (/^include\s+/.test(line)) {
      fail(lineNumber, 'only function `start` and `accept` states can be included')
    }
    match = line.match(new RegExp(`^pause (${IDENTIFIER})$`))
    if (match) {
      assertPublicState(match[1], lineNumber)
      if (pauses.has(match[1])) fail(lineNumber, `duplicate pause state \`${match[1]}\``)
      pauses.add(match[1])
      continue
    }
    match = line.match(new RegExp(`^(start|accept|reject) (${IDENTIFIER})$`))
    if (match) {
      assertPublicState(match[2], lineNumber)
      if (match[1] === 'start') {
        if (start) fail(lineNumber, 'duplicate `start` declaration')
        start = match[2]
      } else if (match[1] === 'accept') {
        if (accept) fail(lineNumber, 'duplicate `accept` declaration')
        accept = match[2]
      } else {
        if (reject) fail(lineNumber, 'duplicate `reject` declaration')
        reject = match[2]
      }
      continue
    }
    fail(lineNumber, `invalid composite declaration \`${line}\``)
  }

  if (!model) throw new Error('Missing `model sipser-3e;` declaration.')
  if (!name) throw new Error('Missing `program <Name>;` declaration.')
  if (!start || !accept || !reject) throw new Error('Composite programs require `start`, `accept`, and `reject` states.')
  if (new Set([start, accept, reject]).size !== 3) throw new Error('Start, accept, and reject states must be distinct.')
  if (pauses.has(start) || pauses.has(accept) || pauses.has(reject)) throw new Error('A pause state must be a nonhalting program state.')

  const aliases = new Set(imports.map((item) => item.alias))
  for (const key of includes.keys()) {
    const alias = key.slice(0, key.indexOf('.'))
    if (!aliases.has(alias)) throw new Error(`Include references unknown import alias \`${alias}\`.`)
  }
  const blocks = new Map<string, ImportDeclaration>()
  for (const item of imports) {
    const blockStart = includes.get(`${item.alias}.start`)
    const blockAccept = includes.get(`${item.alias}.accept`)
    if (!blockStart) throw new Error(`Missing \`include ${item.alias}.start as state;\`.`)
    if (!blockAccept) throw new Error(`Missing \`include ${item.alias}.accept as state;\`.`)
    if (blockStart === accept || blockStart === reject) throw new Error(`Function \`${item.alias}\` cannot start at a halting program state.`)
    if (blockAccept === reject) throw new Error(`Function \`${item.alias}\` cannot return to the program reject state.`)
    if (blockStart === blockAccept) throw new Error(`Function \`${item.alias}\` must have distinct start and return states.`)
    if (blocks.has(blockStart)) throw new Error(`More than one function starts at program state \`${blockStart}\`.`)
    blocks.set(blockStart, item)
  }
  if (!blocks.has(start)) throw new Error(`No function starts at program state \`${start}\`.`)
  for (const item of imports) {
    const state = includes.get(`${item.alias}.accept`)!
    if (state !== accept && !blocks.has(state)) {
      throw new Error(`Function \`${item.alias}\` returns to state \`${state}\`, where no function starts.`)
    }
  }

  return { name, docs, imports, includes, blocks, pauses, start, accept, reject }
}

export function buildConcreteBlock(plan: CompositionPlan, block: ImportDeclaration, source: string): string {
  let kind: string | undefined
  let localStart: string | undefined
  let localAccept: string | undefined
  let localReject: string | undefined
  let model = false
  const setOnce = (current: string | undefined, value: string, declaration: string): string => {
    if (current) throw new Error(`Function \`${block.path}\` has duplicate \`${declaration}\` declarations.`)
    return value
  }
  for (const [offset, original] of source.split(/\r?\n/).entries()) {
    const line = original.trim().split('//')[0].trim().replace(/;$/, '').trim()
    if (line.startsWith('model ')) {
      if (line !== 'model sipser-3e') fail(offset + 1, 'model must be `sipser-3e`')
      if (model) fail(offset + 1, 'duplicate `model` declaration')
      model = true
    }
    let match = line.match(new RegExp(`^(program|function) (${IDENTIFIER})$`))
    if (match) kind = setOnce(kind, match[1], 'unit')
    match = line.match(new RegExp(`^start (${IDENTIFIER})$`))
    if (match) localStart = setOnce(localStart, match[1], 'start')
    match = line.match(new RegExp(`^accept (${IDENTIFIER})$`))
    if (match) localAccept = setOnce(localAccept, match[1], 'accept')
    match = line.match(new RegExp(`^reject (${IDENTIFIER})$`))
    if (match) localReject = setOnce(localReject, match[1], 'reject')
  }
  if (!model) throw new Error(`Function \`${block.path}\` is missing \`model sipser-3e;\`.`)
  if (kind !== 'function') throw new Error(`\`${block.path}\` is not a function.`)
  if (!localStart || !localAccept || !localReject) throw new Error(`Function \`${block.path}\` has incomplete interface states.`)
  if (new Set([localStart, localAccept, localReject]).size !== 3) {
    throw new Error(`Function \`${block.path}\` must have distinct start, accept, and reject states.`)
  }

  const mappedStart = plan.includes.get(`${block.alias}.start`)!
  const mappedAccept = plan.includes.get(`${block.alias}.accept`)!
  const mapState = (state: string): string => {
    if (state === localStart) return mappedStart
    if (state === localAccept) return mappedAccept
    if (state === localReject) return plan.reject
    return `${block.namespace}${state}`
  }
  const body: string[] = []
  const transition = new RegExp(`^(\\s*)(${IDENTIFIER})(\\s*,\\s*(?:"(?:\\\\.|[^"\\\\])*"|blank)\\s*->\\s*)(${IDENTIFIER})(\\s*,.*)$`)
  const stateDeclaration = new RegExp(`^state (${IDENTIFIER})$`)
  for (const original of source.split(/\r?\n/)) {
    const line = original.trim().split('//')[0].trim().replace(/;$/, '').trim()
    if (/^model\s+/.test(line) || /^(program|function)\s+/.test(line) || /^(start|accept|reject)\s+/.test(line)) continue
    let match = original.match(transition)
    if (match) {
      body.push(`${match[1]}${mapState(match[2])}${match[3]}${mapState(match[4])}${match[5]}`)
      continue
    }
    match = line.match(stateDeclaration)
    if (match) {
      body.push(`state ${mapState(match[1])};`)
      continue
    }
    body.push(original)
  }
  return [
    'model sipser-3e;',
    `program ${block.namespace}block;`,
    `start ${mappedStart};`,
    `accept ${mappedAccept};`,
    `reject ${plan.reject};`,
    ...body,
  ].join('\n')
}

function readSnapshot(value: string): Snapshot {
  return JSON.parse(value) as Snapshot
}

function withBlock(snapshot: Snapshot, block?: string): Snapshot {
  return { ...snapshot, block }
}

function assertPublicState(state: string, line: number): void {
  if (state.startsWith('__tm_')) fail(line, 'state names beginning with `__tm_` are reserved')
}

function fail(line: number, message: string): never {
  throw new Error(`Line ${line}: ${message}`)
}
