<script lang="ts">
  import { onMount } from 'svelte'
  import initWasm, { Machine } from '@marcosousapoza/turing-machine-wasm'

  type Snapshot = {
    state: string
    head: number
    tape: string[]
    halted: boolean
    steps: number
  }

  type Transition = {
    from: string
    read: string
    to: string
    write: string
    movement: 'L' | 'R' | 'S'
  }

  type Definition = {
    start: string
    halt: string[]
    blank: string
    states: string[]
    transitions: Transition[]
  }

  const starter = `# Binary increment
start scan
halt done
blank _

scan 0 -> scan 0 R
scan 1 -> scan 1 R
scan _ -> carry _ L
carry 0 -> done 1 S
carry 1 -> carry 0 L
carry _ -> done 1 S`

  let source = starter
  let input = '1011'
  let machine: Machine | null = null
  let snapshot: Snapshot | null = null
  let definition: Definition | null = null
  let error = ''
  let ready = false
  let running = false
  let speed = 350
  let timer: ReturnType<typeof setInterval> | undefined
  let fileInput: HTMLInputElement

  onMount(() => {
    void initWasm().then(() => {
      ready = true
      compile()
    }).catch((value: unknown) => {
      error = message(value)
    })
    return stop
  })

  function message(value: unknown): string {
    return value instanceof Error ? value.message : String(value)
  }

  function readSnapshot(value: string): Snapshot {
    return JSON.parse(value) as Snapshot
  }

  function compile(): void {
    stop()
    error = ''
    try {
      machine?.free()
      machine = new Machine(source, input)
      snapshot = readSnapshot(machine.snapshot())
      definition = JSON.parse(machine.definition()) as Definition
    } catch (value) {
      machine = null
      snapshot = null
      definition = null
      error = message(value)
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

  function toggleRun(): void {
    if (running) {
      stop()
      return
    }
    if (!machine || snapshot?.halted) compile()
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
    if (running) {
      stop()
      toggleRun()
    }
  }

  function download(): void {
    const blob = new Blob([source], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'machine.tm'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function upload(event: Event): Promise<void> {
    const file = (event.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    source = await file.text()
    compile()
    fileInput.value = ''
  }
</script>

<svelte:head>
  <title>Turing Machine Studio</title>
  <meta name="description" content="Write, run, and share composable Turing machines." />
</svelte:head>

<header>
  <div class="brand"><span class="mark">TM</span> Turing Machine Studio</div>
  <a class="github" href="https://github.com/marcosousapoza/turing-machine-web" target="_blank" rel="noreferrer">GitHub</a>
</header>

<main>
  <section class="intro">
    <div>
      <p class="eyebrow">ONE-WAY INFINITE TAPE / WASM CORE</p>
      <h1>Build a machine.<br /><em>Watch it think.</em></h1>
    </div>
    <p class="lede">A compact workbench for deterministic Turing machines. Write transitions, inspect the tape, and step through execution.</p>
  </section>

  <section class="workbench">
    <article class="panel editor-panel">
      <div class="panel-head">
        <div><span class="number">01</span><h2>Program</h2></div>
        <div class="file-actions">
          <button class="quiet" onclick={() => fileInput.click()}>Open</button>
          <button class="quiet" onclick={download}>Save</button>
          <input bind:this={fileInput} class="hidden" type="file" accept=".tm,.txt,text/plain" onchange={upload} />
        </div>
      </div>
      <textarea bind:value={source} spellcheck="false" aria-label="Machine source"></textarea>
      <div class="syntax"><code>state read -&gt; next write L|R|S</code><span># starts a comment</span></div>
      <div class="input-row">
        <label for="tape-input">Initial tape</label>
        <input id="tape-input" bind:value={input} spellcheck="false" />
        <button class="compile" onclick={compile} disabled={!ready}>{ready ? 'Compile' : 'Loading WASM'}</button>
      </div>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </article>

    <article class="panel runtime-panel">
      <div class="panel-head">
        <div><span class="number">02</span><h2>Runtime</h2></div>
        <span class:halted={snapshot?.halted} class="status">{snapshot?.halted ? 'Halted' : running ? 'Running' : 'Ready'}</span>
      </div>

      <div class="readout">
        <div><small>STATE</small><strong>{snapshot?.state ?? '--'}</strong></div>
        <div><small>STEPS</small><strong>{snapshot?.steps ?? 0}</strong></div>
        <div><small>HEAD</small><strong>{snapshot?.head ?? 0}</strong></div>
      </div>

      <div class="tape" aria-label="Machine tape">
        {#each snapshot?.tape ?? ['_'] as symbol, index}
          <div class:active={index === snapshot?.head} class="cell">
            <span>{index}</span><b>{symbol}</b>
          </div>
        {/each}
        {#each Array(3) as _, offset}
          <div class="cell ghost"><span>{(snapshot?.tape.length ?? 1) + offset}</span><b>{definition?.blank ?? '_'}</b></div>
        {/each}
      </div>

      <div class="controls">
        <button class="run" onclick={toggleRun} disabled={!machine}>{running ? 'Pause' : 'Run'}</button>
        <button onclick={step} disabled={!machine || snapshot?.halted}>Step</button>
        <button onclick={compile} disabled={!ready}>Reset</button>
        <label>Speed <input type="range" min="50" max="1000" step="50" bind:value={speed} onchange={applySpeed} /></label>
      </div>
    </article>
  </section>

  <section class="panel graph-panel">
    <div class="panel-head">
      <div><span class="number">03</span><h2>State map</h2></div>
      <span class="hint">Current state is highlighted</span>
    </div>
    <div class="state-map">
      {#each definition?.states ?? [] as state}
        <div class:current={snapshot?.state === state} class:final={definition?.halt.includes(state)} class="state-node">
          <b>{state}</b>
          <small>{definition?.halt.includes(state) ? 'HALT' : state === definition?.start ? 'START' : 'STATE'}</small>
        </div>
      {/each}
    </div>
    <div class="transitions">
      {#each definition?.transitions ?? [] as transition}
        <code class:active-transition={snapshot?.state === transition.from}>{transition.from} · {transition.read} → {transition.to} · {transition.write} {transition.movement}</code>
      {/each}
    </div>
  </section>

  <section class="share">
    <div><p class="eyebrow">COMPOSABLE BY DESIGN</p><h2>Built something useful?</h2></div>
    <p>Save your machine and add it to the community collection through a pull request.</p>
    <a href="https://github.com/marcosousapoza/turing-machine-web/new/main/machines" target="_blank" rel="noreferrer">Submit a machine ↗</a>
  </section>
</main>

<footer>Rust + WebAssembly engine · Svelte + TypeScript interface · MIT licensed</footer>
