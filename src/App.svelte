<script lang="ts">
  import { onMount } from 'svelte'
  import { ModeWatcher } from 'mode-watcher'
  import BookOpen from '@lucide/svelte/icons/book-open'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import CircleStop from '@lucide/svelte/icons/circle-stop'
  import Download from '@lucide/svelte/icons/download'
  import FileCode from '@lucide/svelte/icons/file-code'
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import GitFork from '@lucide/svelte/icons/git-fork'
  import Info from '@lucide/svelte/icons/info'
  import Pause from '@lucide/svelte/icons/pause'
  import Play from '@lucide/svelte/icons/play'
  import Plus from '@lucide/svelte/icons/plus'
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw'
  import StepForward from '@lucide/svelte/icons/step-forward'
  import Upload from '@lucide/svelte/icons/upload'
  import initWasm, { Machine } from '@marcosousapoza/turing-machine-wasm'
  import ThemeToggle from './lib/ThemeToggle.svelte'
  import { fetchProgram, resolveImports } from './lib/imports'
  import { decodeTape, formatTape, type TapeEncoding, type TapeFormat } from './lib/tape'

  type Snapshot = {
    state: string
    head: number
    tape: string[]
    halted: boolean
    accepted: boolean
    rejected: boolean
    steps: number
  }

  type Definition = {
    model: string
    name: string
    docs?: string
    imports: string[]
    blank: string
    start: string
    accept: string
    reject: string
    states: { name: string; docs?: string }[]
  }

  type CatalogProgram = {
    path: string
    name: string
    description: string
    input: string
    tags: string[]
  }

  type Catalog = { version: number; programs: CatalogProgram[] }

  const CATALOG_URL = 'https://raw.githubusercontent.com/marcosousapoza/turing-machine-programs/main/catalog.json'
  const starter = `/// Loads a machine from the shared program registry.
import "binary-complement.tm";`

  let source = starter
  let mainSource = starter
  let activeFile = 'main.tm'
  let input = '0x2d'
  let inputEncoding: TapeEncoding = 'auto'
  let tapeFormat: TapeFormat = 'binary'
  let outputFormat: TapeFormat = 'hex'
  let machine: Machine | null = null
  let snapshot: Snapshot | null = null
  let definition: Definition | null = null
  let catalog: CatalogProgram[] = []
  let localFiles = new Map<string, string>()
  let error = ''
  let ready = false
  let compiling = false
  let running = false
  let speed = 300
  let timer: ReturnType<typeof setInterval> | undefined
  let fileInput: HTMLInputElement

  $: currentStateDocs = definition?.states.find((state) => state.name === snapshot?.state)?.docs
  $: currentTape = snapshot ? formatTape(snapshot.tape, tapeFormat, definition?.blank) : '—'
  $: output = snapshot?.halted ? formatTape(snapshot.tape, outputFormat, definition?.blank) : 'Run the machine to completion'
  $: visibleTape = tapeWindow(snapshot, definition?.blank ?? '⊔')

  onMount(() => {
    void Promise.all([initWasm(), loadCatalog()]).then(async () => {
      ready = true
      await compile()
    }).catch((value: unknown) => {
      error = message(value)
    })
    return stop
  })

  async function loadCatalog(): Promise<void> {
    const response = await fetch(CATALOG_URL)
    if (!response.ok) throw new Error(`Could not load program catalog (${response.status}).`)
    catalog = ((await response.json()) as Catalog).programs
  }

  function message(value: unknown): string {
    return value instanceof Error ? value.message : String(value)
  }

  function readSnapshot(value: string): Snapshot {
    return JSON.parse(value) as Snapshot
  }

  function tapeWindow(current: Snapshot | null, blank: string): { index: number; symbol: string }[] {
    const start = Math.max(0, (current?.head ?? 0) - 7)
    return Array.from({ length: 16 }, (_, offset) => {
      const index = start + offset
      return { index, symbol: current?.tape[index] ?? blank }
    })
  }

  async function compile(): Promise<void> {
    stop()
    persistActive()
    error = ''
    compiling = true
    try {
      const resolvedSource = await resolveImports(source, localFiles)
      const decodedInput = decodeTape(input, inputEncoding)
      machine?.free()
      machine = new Machine(resolvedSource, decodedInput)
      snapshot = readSnapshot(machine.snapshot())
      definition = JSON.parse(machine.definition()) as Definition
    } catch (value) {
      machine = null
      snapshot = null
      definition = null
      error = message(value)
    } finally {
      compiling = false
    }
  }

  function step(): void {
    if (!machine || snapshot?.halted) return
    try {
      snapshot = readSnapshot(machine.step())
      if (snapshot.halted) stop()
    } catch (value) {
      error = message(value)
      stop()
    }
  }

  async function toggleRun(): Promise<void> {
    if (running) return stop()
    if (!machine || snapshot?.halted) await compile()
    if (!machine) return
    running = true
    timer = setInterval(step, speed)
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

  function persistActive(): void {
    if (activeFile === 'main.tm') {
      mainSource = source
    } else if (localFiles.has(activeFile)) {
      localFiles = new Map(localFiles).set(activeFile, source)
    }
  }

  function openMain(): void {
    persistActive()
    activeFile = 'main.tm'
    source = mainSource
  }

  function openLocal(name: string): void {
    persistActive()
    const file = localFiles.get(name)
    if (file === undefined) return
    activeFile = name
    source = file
  }

  async function openProgram(program: CatalogProgram): Promise<void> {
    try {
      persistActive()
      source = await fetchProgram(program.path)
      activeFile = program.path
      input = program.input
      inputEncoding = 'auto'
      await compile()
    } catch (value) {
      error = message(value)
    }
  }

  async function importProgram(program: CatalogProgram): Promise<void> {
    persistActive()
    source = `/// Imported from the community program registry.\nimport "${program.path}";`
    mainSource = source
    activeFile = 'main.tm'
    input = program.input
    inputEncoding = 'auto'
    await compile()
  }
</script>

<svelte:head>
  <title>Turing Machine Studio</title>
  <meta name="description" content="Write and run Sipser-compatible Turing machines." />
</svelte:head>

<ModeWatcher />

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
        <button class="icon-button" onclick={() => fileInput.click()} aria-label="Upload machine files"><Upload class="size-4" /></button>
        <input bind:this={fileInput} class="hidden" type="file" multiple accept=".tm,text/plain" onchange={upload} />
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
        {#each catalog as program}
          <div class="group flex items-center gap-1 rounded-lg hover:bg-accent">
            <button class="file-row min-w-0 flex-1 hover:!bg-transparent" onclick={() => openProgram(program)} title={program.description}>
              <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
              <span class="truncate">{program.name}</span>
            </button>
            <button class="mr-1 hidden size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground group-hover:flex" onclick={() => importProgram(program)} aria-label={`Import ${program.name}`} title={`Import ${program.path}`}><Plus class="size-3.5" /></button>
          </div>
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
              <span class="tooltip" data-tooltip={definition.docs}><Info class="size-3.5 text-muted-foreground" /></span>
            {/if}
          </div>
          <div class="flex items-center gap-1">
            <button class="small-button" onclick={() => fileInput.click()}><FolderOpen class="size-3.5" /> Open</button>
            <button class="small-button" onclick={download}><Download class="size-3.5" /> Save</button>
          </div>
        </div>
        <textarea class="source-editor" bind:value={source} spellcheck="false" aria-label="Machine source"></textarea>
        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-2 font-mono text-[11px] text-muted-foreground">
          <span>δ(q, a) → (r, b, L|R)</span>
          <span><code>///</code> documentation · <code>import "file.tm";</code></span>
        </div>
      </section>

      <section class="card overflow-hidden">
        <div class="toolbar">
          <div>
            <h2 class="text-sm font-semibold">Input</h2>
            <p class="text-xs text-muted-foreground">Text or numeric tape data</p>
          </div>
          <button class="primary-button" onclick={compile} disabled={!ready || compiling}>
            <RotateCcw class={compiling ? 'size-4 animate-spin' : 'size-4'} />
            {compiling ? 'Compiling' : 'Compile'}
          </button>
        </div>
        <div class="grid gap-3 p-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <label class="field-label">Encoding
            <select bind:value={inputEncoding}>
              <option value="auto">Auto-detect</option><option value="text">String (UTF-8)</option><option value="binary">Binary</option><option value="hex">Hexadecimal</option><option value="decimal">Decimal</option>
            </select>
          </label>
          <label class="field-label">Initial tape
            <input class="font-mono" bind:value={input} spellcheck="false" placeholder="0x2d" />
          </label>
        </div>
        {#if error}<div class="border-t border-destructive/30 bg-destructive/10 px-4 py-3 font-mono text-xs text-destructive" role="alert">{error}</div>{/if}
      </section>

      <section class="card overflow-hidden">
        <div class="toolbar">
          <div class="flex items-center gap-3">
            <div>
              <h2 class="text-sm font-semibold">Tape</h2>
              <p class="text-xs text-muted-foreground">16-cell viewport · <span class="font-mono">⊔</span> blank · <span class="font-mono">ε</span> empty word</p>
            </div>
            {#if snapshot}
              <span class:accepted={snapshot.accepted} class:rejected={snapshot.rejected} class="status-pill">{snapshot.accepted ? 'Accepted' : snapshot.rejected ? 'Rejected' : running ? 'Running' : 'Ready'}</span>
            {/if}
          </div>
          <div class="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span>{snapshot?.steps ?? 0} steps</span><span>·</span>
            <span class="tooltip state-badge" data-tooltip={currentStateDocs ?? 'No documentation for this state'}>{snapshot?.state ?? '—'}</span>
          </div>
        </div>

        <div class="tape-scroll">
          <div class="flex min-w-max gap-1 p-6 sm:p-8">
            {#each visibleTape as cell}
              <div class:head-cell={cell.index === snapshot?.head} class:blank-cell={cell.symbol === (definition?.blank ?? '⊔')} class="tape-cell"><span>{cell.index}</span><strong>{cell.symbol}</strong></div>
            {/each}
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 border-t border-border p-3">
          <button class="primary-button" onclick={toggleRun} disabled={!machine}>{#if running}<Pause class="size-4" /> Pause{:else}<Play class="size-4" /> Run{/if}</button>
          <button class="secondary-button" onclick={step} disabled={!machine || snapshot?.halted}><StepForward class="size-4" /> Step</button>
          <button class="secondary-button" onclick={compile} disabled={!ready}><RotateCcw class="size-4" /> Reset</button>
          <label class="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Speed <input class="w-24 accent-primary" type="range" min="50" max="1000" step="50" bind:value={speed} onchange={applySpeed} /></label>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-2">
        <article class="card p-4">
          <div class="mb-4 flex items-center justify-between"><div><h2 class="text-sm font-semibold">Current tape</h2><p class="text-xs text-muted-foreground">String uses UTF-8</p></div><select class="compact-select" bind:value={tapeFormat}><option value="string">String (UTF-8)</option><option value="binary">Binary</option><option value="decimal">Decimal</option><option value="hex">Hex</option></select></div>
          <output class="value-output">{currentTape}</output>
        </article>
        <article class="card p-4">
          <div class="mb-4 flex items-center justify-between"><div><h2 class="text-sm font-semibold">Output</h2><p class="text-xs text-muted-foreground">Available after halt</p></div><select class="compact-select" bind:value={outputFormat}><option value="string">String (UTF-8)</option><option value="binary">Binary</option><option value="decimal">Decimal</option><option value="hex">Hex</option></select></div>
          <output class:muted-output={!snapshot?.halted} class="value-output">{output}</output>
        </article>
      </section>

      <footer class="flex flex-col justify-between gap-3 py-3 text-xs text-muted-foreground sm:flex-row">
        <span>Core semantics follow Sipser, <em>Introduction to the Theory of Computation</em>, 3rd ed., §3.1.</span>
        <a class="inline-flex items-center gap-1 text-primary hover:underline" href="https://github.com/marcosousapoza/turing-machine-programs" target="_blank" rel="noreferrer"><CircleStop class="size-3.5" /> Submit a program</a>
      </footer>
    </div>
  </main>
</div>
