<script lang="ts">
  import { onMount } from 'svelte'
  import { ModeWatcher } from 'mode-watcher'
  import BookOpen from '@lucide/svelte/icons/book-open'
  import ChevronLeft from '@lucide/svelte/icons/chevron-left'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import CircleStop from '@lucide/svelte/icons/circle-stop'
  import Download from '@lucide/svelte/icons/download'
  import FastForward from '@lucide/svelte/icons/fast-forward'
  import FileCode from '@lucide/svelte/icons/file-code'
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import GitFork from '@lucide/svelte/icons/git-fork'
  import Info from '@lucide/svelte/icons/info'
  import Pause from '@lucide/svelte/icons/pause'
  import Play from '@lucide/svelte/icons/play'
  import Plus from '@lucide/svelte/icons/plus'
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw'
  import StepForward from '@lucide/svelte/icons/step-forward'
  import X from '@lucide/svelte/icons/x'
  import DOMPurify from 'dompurify'
  import { marked } from 'marked'
  import initWasm, { Machine } from '@marcosousapoza/turing-machine-wasm'
  import ThemeToggle from './lib/ThemeToggle.svelte'
  import { CompositeMachine, isComposition, type Definition, type Snapshot } from './lib/composition'
  import { createModuleResolver, fetchProgram, libraryPath } from './lib/imports'
  import { formatTape, pasteTape, replaceTape, type TapeFormat } from './lib/tape'

  type Runtime = {
    step(): string | Promise<string>
    run(maxSteps: number): string | Promise<string>
    snapshot(): string
    definition(): string
    set_tape?(tape: string): string
    setTape?(tape: string): string | Promise<string>
    set_head?(head: number): string
    setHead?(head: number): string
    free(): void
  }

  type CatalogProgram = {
    path: string
    name: string
    description: string
    tape: string
    head?: number
    category: string
    kind: 'program' | 'function'
  }

  type Catalog = { version: number; programs: CatalogProgram[] }

  const CATALOG_URL = 'https://raw.githubusercontent.com/marcosousapoza/turing-machine-programs/main/catalog.json'
  const starter = `model sipser-3e;

/// Negates one 32-bit MSB-first word twice.
program DoubleNot;

import "lib/logic/not.tm" as first;
import "lib/logic/not.tm" as second;

include first.start as q0;
include first.accept as q1;
include second.start as q1;
include second.accept as q_accept;

pause q1;

start q0;
accept q_accept;
reject q_reject;`

  let source = starter
  let mainSource = starter
  let activeFile = 'main.tm'
  let tape = '00000000000000000000000000000001#'
  let tapeHead = 0
  let tapeFormat: TapeFormat = 'binary'
  let machine: Runtime | null = null
  let snapshot: Snapshot | null = null
  let definition: Definition | null = null
  let catalog: CatalogProgram[] = []
  let openCategories = new Set<string>()
  let localFiles = new Map<string, string>()
  let error = ''
  let ready = false
  let compiling = false
  let advancing = false
  let running = false
  let speed = 300
  let compileGeneration = 0
  let sourceLoadGeneration = 0
  let runtimeQueue: Promise<void> = Promise.resolve()
  let timer: ReturnType<typeof setInterval> | undefined
  let fileInput: HTMLInputElement
  let folderInput: HTMLInputElement
  let viewportStart = 0
  let docsTitle = ''
  let docsHtml = ''

  $: currentStateDocs = definition?.states.find((state) => state.name === snapshot?.state)?.docs
  $: currentTape = snapshot ? formatTape(snapshot.tape, tapeFormat, definition?.blank) : '—'
  $: visibleTape = tapeWindow(snapshot, definition?.blank ?? '⊔', viewportStart)
  $: categories = [...new Set(catalog.map((program) => program.category))]

  onMount(() => {
    void initWasm().then(async () => {
      ready = true
      await compile()
    }).catch((value: unknown) => {
      error = message(value)
    })
    void loadCatalog().catch((value: unknown) => {
      error = message(value)
    })
    return () => {
      stop()
      void serializeRuntime(async () => {
        machine?.free()
        machine = null
      })
    }
  })

  async function loadCatalog(): Promise<void> {
    const response = await fetch(CATALOG_URL)
    if (!response.ok) throw new Error(`Could not load program catalog (${response.status}).`)
    const next = (await response.json()) as Catalog
    if (next.version !== 4) throw new Error(`Program catalog version ${next.version} is incompatible; expected version 4.`)
    catalog = next.programs
  }

  function toggleCategory(category: string): void {
    const next = new Set(openCategories)
    if (next.has(category)) next.delete(category)
    else next.add(category)
    openCategories = next
  }

  function message(value: unknown): string {
    return value instanceof Error ? value.message : String(value)
  }

  function readSnapshot(value: string): Snapshot {
    return JSON.parse(value) as Snapshot
  }

  function tapeWindow(current: Snapshot | null, blank: string, start: number): { index: number; symbol: string }[] {
    return Array.from({ length: 16 }, (_, offset) => {
      const index = start + offset
      return { index, symbol: current?.tape[index] ?? blank }
    })
  }

  function serializeRuntime<T>(operation: () => Promise<T>): Promise<T> {
    const result = runtimeQueue.then(operation, operation)
    runtimeQueue = result.then(() => undefined, () => undefined)
    return result
  }

  async function compile(): Promise<void> {
    const generation = ++compileGeneration
    let nextMachine: Runtime | undefined
    stop()
    persistActive()
    error = ''
    compiling = true
    await serializeRuntime(async () => {
      try {
        nextMachine = isComposition(source)
          ? await CompositeMachine.create(source, tape, createModuleResolver(localFiles))
          : new Machine(source, tape)
        if (tapeHead > 0) {
          if (nextMachine.setHead) await nextMachine.setHead(tapeHead)
          else if (nextMachine.set_head) nextMachine.set_head(tapeHead)
          else throw new Error('The loaded runtime does not support head editing.')
        }
        if (generation !== compileGeneration) {
          nextMachine.free()
          return
        }
        machine?.free()
        machine = nextMachine
        snapshot = readSnapshot(machine.snapshot())
        definition = JSON.parse(machine.definition()) as Definition
        viewportStart = 0
        followHead()
      } catch (value) {
        if (generation !== compileGeneration) return
        if (nextMachine && machine !== nextMachine) nextMachine.free()
        machine?.free()
        machine = null
        snapshot = null
        definition = null
        error = message(value)
      } finally {
        if (generation === compileGeneration) compiling = false
      }
    })
  }

  async function step(): Promise<void> {
    if (!machine || snapshot?.halted || advancing) return
    advancing = true
    await serializeRuntime(async () => {
      try {
        if (!machine || snapshot?.halted) return
        snapshot = readSnapshot(await machine.step())
        followHead()
        if (snapshot.halted || snapshot.paused) stop()
      } catch (value) {
        error = message(value)
        stop()
      } finally {
        advancing = false
      }
    })
  }

  async function toggleRun(): Promise<void> {
    if (running) return stop()
    if (!machine) await compile()
    else if (snapshot?.halted) await resetTape()
    if (!machine) return
    running = true
    timer = setInterval(() => void step(), speed)
  }

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = undefined
    running = false
  }

  function applySpeed(): void {
    if (!running) return
    stop()
    void toggleRun()
  }

  async function runToCompletion(): Promise<void> {
    stop()
    if (!machine) await compile()
    else if (snapshot?.halted) await resetTape()
    if (!machine || advancing) return
    advancing = true
    await serializeRuntime(async () => {
      try {
        if (!machine) return
        snapshot = readSnapshot(await machine.run(1_000_000))
        followHead()
        if (!snapshot.halted && !snapshot.paused) error = 'Execution stopped after the 1,000,000-step safety limit.'
      } catch (value) {
        error = message(value)
      } finally {
        advancing = false
      }
    })
  }

  function showDocs(title: string, docs: string): void {
    docsTitle = title
    docsHtml = DOMPurify.sanitize(marked.parse(docs, { async: false }) as string)
  }

  function closeDocs(): void {
    docsTitle = ''
    docsHtml = ''
  }

  function download(): void {
    const blob = new Blob([source], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = activeFile
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function upload(event: Event): Promise<void> {
    const files = [...((event.currentTarget as HTMLInputElement).files ?? [])]
    for (const file of files) {
      localFiles = new Map(localFiles).set(file.name, await file.text())
    }
    if (files[0]) openLocal(files[0].name)
    fileInput.value = ''
  }

  async function uploadFolder(event: Event): Promise<void> {
    const files = [...((event.currentTarget as HTMLInputElement).files ?? [])].filter((file) => file.name.endsWith('.tm'))
    const next = new Map(localFiles)
    let first = ''
    for (const file of files) {
      const path = libraryPath(file.webkitRelativePath, file.name)
      next.set(path, await file.text())
      if (!first) first = path
    }
    localFiles = next
    if (first) openLocal(first)
    folderInput.value = ''
  }

  function persistActive(): void {
    if (activeFile === 'main.tm') {
      mainSource = source
    } else if (localFiles.has(activeFile)) {
      localFiles = new Map(localFiles).set(activeFile, source)
    }
  }

  function openMain(): void {
    sourceLoadGeneration += 1
    persistActive()
    activeFile = 'main.tm'
    source = mainSource
  }

  function openLocal(name: string): void {
    sourceLoadGeneration += 1
    persistActive()
    const file = localFiles.get(name)
    if (file === undefined) return
    activeFile = name
    source = file
  }

  async function openProgram(program: CatalogProgram): Promise<void> {
    const generation = ++sourceLoadGeneration
    try {
      const nextSource = await fetchProgram(program.path)
      if (generation !== sourceLoadGeneration) return
      persistActive()
      source = nextSource
      activeFile = program.path
      tape = program.tape
      tapeHead = program.head ?? 0
      await compile()
    } catch (value) {
      error = message(value)
    }
  }

  async function importProgram(program: CatalogProgram): Promise<void> {
    sourceLoadGeneration += 1
    persistActive()
    if (program.kind !== 'function') return openProgram(program)
    const alias = program.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '_')
    source = `model sipser-3e;\n\n/// Runs the imported ${program.name} function.\nprogram Main;\n\nimport "${program.path}" as ${alias};\ninclude ${alias}.start as q0;\ninclude ${alias}.accept as q_accept;\n\nstart q0;\naccept q_accept;\nreject q_reject;`
    mainSource = source
    activeFile = 'main.tm'
    tape = program.tape
    tapeHead = program.head ?? 0
    await compile()
  }

  function followHead(): void {
    if (!snapshot) return
    if (snapshot.head < viewportStart) viewportStart = snapshot.head
    else if (snapshot.head >= viewportStart + 16) viewportStart = snapshot.head - 15
  }

  async function setRuntimeTape(value: string): Promise<void> {
    if (!machine) return compile()
    const result = machine.setTape ? await machine.setTape(value) : machine.set_tape?.(value)
    if (!result) throw new Error('The loaded runtime does not support tape editing.')
    snapshot = readSnapshot(result)
    viewportStart = 0
  }

  async function applyTape(value: string): Promise<void> {
    stop()
    error = ''
    tape = value
    if (snapshot && definition) {
      snapshot = {
        ...snapshot,
        state: definition.start,
        head: tapeHead,
        tape: [...(value || definition.blank)],
        halted: false,
        accepted: false,
        rejected: false,
        paused: false,
        steps: 0,
      }
      viewportStart = 0
    }
    if (!machine) {
      await compile()
      return
    }
    await serializeRuntime(async () => {
      try {
        await setRuntimeTape(value)
      } catch (value) {
        error = message(value)
      }
    })
  }

  async function resetTape(): Promise<void> {
    await applyTape(tape)
  }

  function cycleTapeCell(index: number): void {
    if (running) return
    const blank = definition?.blank ?? '⊔'
    const symbols = [blank, '0', '1', '#']
    const current = snapshot?.tape[index] ?? blank
    void applyTape(replaceTape(snapshot?.tape ?? [], index, symbols[(symbols.indexOf(current) + 1) % symbols.length], blank))
  }

  function editTapeCell(event: KeyboardEvent, index: number): void {
    if (running) return
    const blank = definition?.blank ?? '⊔'
    let symbol = event.key
    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === ' ') symbol = blank
    if (!['0', '1', '#', blank].includes(symbol)) return
    event.preventDefault()
    void applyTape(replaceTape(snapshot?.tape ?? [], index, symbol, blank))
  }

  function pasteIntoTape(event: ClipboardEvent, index: number): void {
    if (running) return
    event.preventDefault()
    try {
      void applyTape(pasteTape(snapshot?.tape ?? [], index, event.clipboardData?.getData('text') ?? '', definition?.blank ?? '⊔'))
    } catch (value) {
      error = message(value)
    }
  }

  async function setTapeHead(index: number): Promise<void> {
    if (!machine || running) return
    stop()
    tapeHead = index
    await serializeRuntime(async () => {
      const result = machine?.setHead ? machine.setHead(index) : machine?.set_head?.(index)
      if (result) snapshot = readSnapshot(result)
    })
  }
</script>

<svelte:head>
  <title>Turing Machine Studio</title>
  <meta name="description" content="Write and run Sipser-compatible Turing machines." />
</svelte:head>

<ModeWatcher />
<svelte:window onkeydown={(event) => event.key === 'Escape' && closeDocs()} />

<div class="min-h-screen bg-background text-foreground">
  <header class="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
    <div class="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
      <div class="flex size-9 items-center justify-center rounded-xl bg-primary font-mono text-xs font-semibold text-primary-foreground">TM</div>
      <div class="min-w-0">
        <h1 class="truncate text-sm font-semibold tracking-tight">Turing Machine Studio</h1>
        <p class="hidden text-xs text-muted-foreground sm:block">Sipser-compatible · Rust/WASM runtime</p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <a class="icon-button" href="https://github.com/marcosousapoza/turing-machine-web/blob/main/docs/language.md" target="_blank" rel="noreferrer" aria-label="Language documentation"><BookOpen class="size-4" /></a>
        <a class="icon-button" href="https://github.com/marcosousapoza/turing-machine-web" target="_blank" rel="noreferrer" aria-label="GitHub repository"><GitFork class="size-4" /></a>
        <ThemeToggle />
      </div>
    </div>
  </header>

  <main class="mx-auto grid max-w-[1600px] gap-4 p-4 sm:p-6 lg:grid-cols-[250px_minmax(0,1fr)]">
    <aside class="card h-fit overflow-hidden lg:sticky lg:top-22">
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">Files</h2>
          <p class="text-xs text-muted-foreground">Local and community</p>
        </div>
        <button class="icon-button" onclick={() => folderInput.click()} aria-label="Open library folder"><FolderOpen class="size-4" /></button>
        <input bind:this={fileInput} class="hidden" type="file" multiple accept=".tm,text/plain" onchange={upload} />
        <input bind:this={folderInput} class="hidden" type="file" webkitdirectory multiple onchange={uploadFolder} />
      </div>

      <div class="p-2">
        <p class="section-label"><FolderOpen class="size-3.5" /> Workspace</p>
        <button class:active-file={activeFile === 'main.tm'} class="file-row" onclick={openMain}>
          <FileCode class="size-4" /><span>main.tm</span>
        </button>
        {#each [...localFiles.keys()] as name}
          <button class:active-file={activeFile === name} class="file-row" onclick={() => openLocal(name)}>
            <FileCode class="size-4" /><span>{name}</span>
          </button>
        {/each}
      </div>

      <div class="border-t border-border p-2">
        <div class="mb-1 flex items-center justify-between px-2 py-1.5">
          <p class="section-label !m-0"><GitFork class="size-3.5" /> Programs</p>
          <a class="text-xs text-primary hover:underline" href="https://github.com/marcosousapoza/turing-machine-programs" target="_blank" rel="noreferrer">Contribute</a>
        </div>
        {#if catalog.length === 0}
          <p class="px-2 py-3 text-xs text-muted-foreground">Loading registry…</p>
        {/if}
        {#each categories as category}
          <button class="file-row mt-1 font-semibold" onclick={() => toggleCategory(category)} aria-expanded={openCategories.has(category)}>
            <ChevronRight class={`size-4 shrink-0 text-muted-foreground transition-transform ${openCategories.has(category) ? 'rotate-90' : ''}`} />
            <span>{category}</span>
            <span class="ml-auto text-[10px] text-muted-foreground">{catalog.filter((program) => program.category === category).length}</span>
          </button>
          {#if openCategories.has(category)}
            <div class="ml-3 border-l border-border pl-1">
              {#each catalog.filter((program) => program.category === category) as program}
                <div class="group flex items-center gap-1 rounded-lg hover:bg-accent">
                  <button class="file-row min-w-0 flex-1 hover:!bg-transparent" onclick={() => openProgram(program)} title={program.description}>
                    <FileCode class="size-4 shrink-0 text-muted-foreground" />
                    <span class="truncate">{program.name}</span>
                    <span class="ml-auto text-[9px] uppercase text-muted-foreground">{program.kind}</span>
                  </button>
                  {#if program.kind === 'function'}
                    <button class="mr-1 hidden size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground group-hover:flex" onclick={() => importProgram(program)} aria-label={`Import ${program.name}`} title={`Create a program with ${program.path}`}><Plus class="size-3.5" /></button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    </aside>

    <div class="min-w-0 space-y-4">
      <section class="card overflow-hidden">
        <div class="toolbar">
          <div class="flex min-w-0 items-center gap-2">
            <FileCode class="size-4 text-primary" />
            <span class="truncate font-mono text-xs">{activeFile}</span>
            {#if definition?.docs}
              <button class="inline-flex text-muted-foreground hover:text-foreground" onclick={() => showDocs(definition?.name ?? 'Documentation', definition?.docs ?? '')} aria-label="Open program documentation"><Info class="size-3.5" /></button>
            {/if}
          </div>
          <div class="flex items-center gap-1">
            <button class="small-button" onclick={() => fileInput.click()}><FolderOpen class="size-3.5" /> Open</button>
            <button class="small-button" onclick={download}><Download class="size-3.5" /> Save</button>
            <button class="primary-button" onclick={compile} disabled={!ready || compiling}>
              <RotateCcw class={compiling ? 'size-4 animate-spin' : 'size-4'} />
              {compiling ? 'Compiling' : 'Compile'}
            </button>
          </div>
        </div>
        <textarea class="source-editor" bind:value={source} spellcheck="false" aria-label="Machine source"></textarea>
        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-2 font-mono text-[11px] text-muted-foreground">
          <span>δ(q, a) → (r, b, L|R)</span>
          <span><code>///</code> Markdown documentation · <code>include first.accept as q1;</code></span>
        </div>
      </section>

      {#if error}<div class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 font-mono text-xs text-destructive" role="alert">{error}</div>{/if}

      <section class="card overflow-hidden">
        <div class="toolbar">
          <div class="flex items-center gap-3">
            <div>
              <h2 class="text-sm font-semibold">Tape</h2>
              <p class="text-xs text-muted-foreground">Click to cycle · type or paste <span class="font-mono">0 1 # ⊔</span> · Shift-click to move head</p>
            </div>
            {#if snapshot}
              <span class:accepted={snapshot.accepted} class:rejected={snapshot.rejected} class="status-pill">{snapshot.accepted ? 'Accepted' : snapshot.rejected ? 'Rejected' : snapshot.paused ? 'Paused' : running ? 'Running' : 'Ready'}</span>
            {/if}
          </div>
          <div class="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {#if snapshot?.block}<span>{snapshot.block}</span><span>·</span>{/if}<span>{snapshot?.steps ?? 0} steps</span><span>·</span>
            <button class="state-badge" onclick={() => showDocs(snapshot?.state ?? 'State', currentStateDocs ?? 'No documentation for this state.')}>{snapshot?.state ?? '—'}</button>
          </div>
        </div>

        <div class="grid gap-3 border-b border-border bg-muted/30 p-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
          <select class="compact-select" bind:value={tapeFormat} aria-label="Tape representation"><option value="symbols">Symbols</option><option value="string">Characters (UTF-8)</option><option value="binary">Binary</option><option value="decimal">Decimal</option><option value="hex">Hexadecimal</option></select>
          <output class="min-w-0 overflow-x-auto whitespace-nowrap rounded-md bg-background px-3 py-2 font-mono text-xs">{currentTape}</output>
        </div>

        <div class="tape-scroll">
          <div class="flex min-w-max gap-1 p-6 sm:p-8">
            {#each visibleTape as cell}
              <button class:head-cell={cell.index === snapshot?.head} class:blank-cell={cell.symbol === (definition?.blank ?? '⊔')} class="tape-cell" disabled={running} onclick={(event) => event.shiftKey ? void setTapeHead(cell.index) : cycleTapeCell(cell.index)} onkeydown={(event) => editTapeCell(event, cell.index)} onpaste={(event) => pasteIntoTape(event, cell.index)} aria-label={`Tape cell ${cell.index}: ${cell.symbol}`}><span>{cell.index}</span><strong>{cell.symbol}</strong></button>
            {/each}
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 border-t border-border p-3">
          <button class="secondary-button" onclick={() => viewportStart = Math.max(0, viewportStart - 16)} disabled={viewportStart === 0}><ChevronLeft class="size-4" /> Previous cells</button>
          <button class="secondary-button" onclick={() => viewportStart += 16}>Next cells <ChevronRight class="size-4" /></button>
          <button class="primary-button" onclick={toggleRun} disabled={!machine}>{#if running}<Pause class="size-4" /> Pause{:else}<Play class="size-4" /> Run{/if}</button>
          <button class="secondary-button" onclick={runToCompletion} disabled={!machine}><FastForward class="size-4" /> Run to completion</button>
          <button class="secondary-button" onclick={step} disabled={!machine || snapshot?.halted || advancing}><StepForward class="size-4" /> Step</button>
          <button class="secondary-button" onclick={resetTape} disabled={!machine}><RotateCcw class="size-4" /> Reset tape</button>
          <label class="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Speed <input class="w-24 accent-primary" type="range" min="50" max="1000" step="50" bind:value={speed} onchange={applySpeed} /></label>
        </div>
      </section>

      <footer class="flex flex-col justify-between gap-3 py-3 text-xs text-muted-foreground sm:flex-row">
        <span>Core semantics follow Sipser, <em>Introduction to the Theory of Computation</em>, 3rd ed., §3.1.</span>
        <a class="inline-flex items-center gap-1 text-primary hover:underline" href="https://github.com/marcosousapoza/turing-machine-programs" target="_blank" rel="noreferrer"><CircleStop class="size-3.5" /> Submit a program</a>
      </footer>
    </div>
  </main>
</div>

{#if docsTitle}
  <div class="docs-backdrop" role="presentation" onclick={(event) => event.target === event.currentTarget && closeDocs()}>
    <div class="docs-dialog" role="dialog" aria-modal="true" aria-labelledby="docs-title">
      <div class="toolbar">
        <div><p class="text-xs text-muted-foreground">Documentation</p><h2 id="docs-title" class="font-semibold">{docsTitle}</h2></div>
        <button class="icon-button" onclick={closeDocs} aria-label="Close documentation"><X class="size-4" /></button>
      </div>
      <div class="markdown-body">{@html docsHtml}</div>
    </div>
  </div>
{/if}
