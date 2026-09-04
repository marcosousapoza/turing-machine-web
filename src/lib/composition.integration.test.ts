import { readFile } from 'node:fs/promises'
import initWasm from '@marcosousapoza/turing-machine-wasm'
import { beforeAll, expect, it } from 'vitest'
import { CompositeMachine, type Snapshot } from './composition'

const composition = `model sipser-3e;
program DoubleNot;
import "not.tm" as first;
import "not.tm" as second;
include first.start as q0;
include first.accept as q1;
include second.start as q1;
include second.accept as q_accept;
pause q1;
start q0;
accept q_accept;
reject q_reject;`

const not = `model sipser-3e;
function Not;
start q0;
accept q_accept;
reject q_reject;
q0, "0" -> q_return, "1", R;
q0, "1" -> q_return, "0", R;
q0, "#" -> q_reject, "#", R;
q0, blank -> q_reject, blank, R;
q_return, "0" -> q_reject, "0", R;
q_return, "1" -> q_reject, "1", R;
q_return, "#" -> q_accept, "#", L;
q_return, blank -> q_accept, blank, L;`

beforeAll(async () => {
  const module = await readFile(new URL('../../node_modules/@marcosousapoza/turing-machine-wasm/turing_machine_wasm_bg.wasm', import.meta.url))
  await initWasm({ module_or_path: module })
})

it('honors pauses when stepping through a composition', async () => {
  const machine = await CompositeMachine.create(composition, '1#', async () => not)
  const snapshot = JSON.parse(await machine.step()) as Snapshot

  expect(snapshot).toMatchObject({ state: 'q1', paused: true, halted: false })
  machine.free()
})

it('bypasses pauses and reports the terminal state when run to completion', async () => {
  const machine = await CompositeMachine.create(composition, '1#', async () => not)
  const snapshot = JSON.parse(await machine.run(1_000_000)) as Snapshot

  expect(snapshot).toMatchObject({
    state: 'q_accept',
    paused: false,
    halted: true,
    accepted: true,
    rejected: false,
  })
  machine.free()
})

it('resets a composition onto an edited tape without resolving its first block again', async () => {
  let resolutions = 0
  const machine = await CompositeMachine.create(composition, '1#', async () => {
    resolutions += 1
    return not
  })
  await machine.step()
  const snapshot = JSON.parse(await machine.setTape('0#')) as Snapshot

  expect(snapshot).toMatchObject({ state: 'q0', head: 0, steps: 0, tape: ['0', '#'] })
  expect(JSON.parse(machine.setHead(1))).toMatchObject({ state: 'q0', head: 1, steps: 0 })
  expect(resolutions).toBe(1)
  machine.free()
})
