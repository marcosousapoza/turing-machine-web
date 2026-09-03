import { describe, expect, it } from 'vitest'
import { buildConcreteBlock, parseComposition } from './composition'

const composition = `model sipser-3e;
/// Runs two functions with a review boundary.
program Main;
import "one.tm" as first;
import "two.tm" as second;
include first.start as q0;
include first.accept as q1;
include second.start as q1;
include second.accept as q_accept;
pause q1;
start q0;
accept q_accept;
reject q_reject;`

const functionSource = `model sipser-3e;
function Example;
start q0;
accept q_accept;
reject q_reject;
state q_work;
q0, "0" -> q_work, "0", R;
q0, "1" -> q_work, "1", R;
q0, blank -> q_reject, blank, R;
q_work, "0" -> q_reject, "0", R;
q_work, "1" -> q_reject, "1", R;
q_work, blank -> q_accept, blank, L;`

describe('composition compiler', () => {
  it('builds a lazy block graph and pause boundary', () => {
    const plan = parseComposition(composition)

    expect(plan.blocks.get('q0')?.alias).toBe('first')
    expect(plan.blocks.get('q1')?.alias).toBe('second')
    expect(plan.pauses.has('q1')).toBe(true)
  })

  it('namespaces internal states and maps rejection globally', () => {
    const plan = parseComposition(composition)
    const block = plan.imports[0]
    const concrete = buildConcreteBlock(plan, block, functionSource)

    expect(concrete).toContain('start q0;')
    expect(concrete).toContain('accept q1;')
    expect(concrete).toContain('reject q_reject;')
    expect(concrete).toContain('__tm_0_first__q_work')
    expect(concrete).toContain('q0, blank -> q_reject, blank, R;')
    expect(concrete).not.toContain('include ')
  })

  it('does not allow reject states to be exported', () => {
    expect(() => parseComposition(composition.replace(
      'include first.accept as q1;',
      'include first.accept as q1;\ninclude first.reject as q_reject;',
    ))).toThrow('only function `start` and `accept` states can be included')
  })

  it('rejects interface mappings onto halting states', () => {
    expect(() => parseComposition(composition.replace(
      'include second.start as q1;',
      'include second.start as q_accept;',
    ))).toThrow('cannot start at a halting program state')
  })

  it('validates function interfaces before rewriting them', () => {
    const plan = parseComposition(composition)
    const invalid = functionSource.replace('reject q_reject;', 'reject q_accept;')

    expect(() => buildConcreteBlock(plan, plan.imports[0], invalid)).toThrow(
      'must have distinct start, accept, and reject states',
    )
  })

  it('namespaces documented states with trailing comments', () => {
    const plan = parseComposition(composition)
    const concrete = buildConcreteBlock(
      plan,
      plan.imports[0],
      functionSource.replace('state q_work;', 'state q_work; // internal'),
    )

    expect(concrete).toContain('state __tm_0_first__q_work;')
    expect(concrete).not.toContain('state q_work;')
  })
})
