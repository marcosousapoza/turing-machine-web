# Turing Machine Language

## Machine model

Execution follows Michael Sipser's deterministic, single-tape Turing machine from *Introduction to the Theory of Computation*, 3rd edition, Section 3.1.

- The tape has a left endpoint and is infinite to the right.
- The head starts on the leftmost input bit, or the leftmost blank for empty input.
- Moving left at the tape boundary leaves the head in place.
- `blank`, displayed as `⊔`, is the only nonbinary tape symbol.
- Accept and reject states are distinct and halt immediately.
- The transition function is defined for every nonhalting state and all three tape symbols.
- Transitions use only `L` and `R`; Sipser's core model has no stay-put move.

The binary data alphabet is implicit and cannot be changed:

```text
input = output = { 0, 1 }
tape = { 0, 1, blank }
```

Imports, endpoint inclusion, functions, and Markdown documentation are Studio extensions around that machine model.

## Programs

A program is directly executable and owns its transitions:

```tm
model sipser-3e;

/// Accepts when the input contains a `1`.
program ContainsOne;

start q0;
accept q_accept;
reject q_reject;

/// Search from left to right.
state q0;

q0, "0" -> q0, "0", R;
q0, "1" -> q_accept, "1", R;
q0, blank -> q_reject, blank, R;
```

The transition notation is `δ(q, a) = (r, b, direction)`:

```text
current_state, read_symbol -> next_state, write_symbol, L|R;
```

## Functions

A function has the same state-machine structure but declares `function` instead of `program`:

```tm
model sipser-3e;

/// Negates one bit and returns the head to that bit.
function Not;

start q0;
accept q_accept;
reject q_reject;

q0, "0" -> q_return, "1", R;
q0, "1" -> q_return, "0", R;
q0, blank -> q_reject, blank, R;
q_return, "0" -> q_reject, "0", R;
q_return, "1" -> q_reject, "1", R;
q_return, blank -> q_accept, blank, L;
```

Every function must document its tape and head contract. A function receives the tape and head exactly as the previous function left them. It may rewrite any cells. The write and movement of the transition that enters its accept state happen before the next function begins.

## Loading and composition

Each `.tm` file contains exactly one program or function. Imports name functions without copying their states into the source file:

```tm
model sipser-3e;

/// Negates a bit twice.
program DoubleNot;

import "logic/not.tm" as first;
import "logic/not.tm" as second;

include first.start as q0;
include first.accept as q1;
include second.start as q1;
include second.accept as q_accept;

pause q1;

start q0;
accept q_accept;
reject q_reject;
```

The loader performs these steps:

1. Parse the composite declarations without fetching imported files.
2. Resolve a function from uploaded local files or the public registry only when execution reaches its included start state.
3. Assign the import instance a generated namespace and parse it as one concrete machine.
4. Rename internal states, such as `__tm_0_first__q_return`, so lazily loaded functions cannot collide.
5. Replace the previous transition table while retaining the tape, head position, and cumulative step count.
6. Release the fetched source and previous function after the replacement.

Every import includes its `start` and `accept` interface states. Giving two endpoints the same name merges them. In the example, `first.accept` and `second.start` both become `q1`, joining the two functions. A function's reject state always rejects the complete program and is not exported. The same file may be imported more than once under different aliases.

The composite program declares its public `start`, `accept`, and `reject` states. `pause state;` stops after the preceding function accepts and before the function mapped to that state begins. Step or Run resumes from that boundary.

## Repository hierarchy

Registry paths encode categories:

```text
programs/
  examples/
  logic/
  math/
  predicates/
```

The catalog exposes each path, category, unit kind, example input, and description. The Studio explorer groups entries by category. Opening an entry edits it directly; the plus button creates a program that imports and includes a function.

## Documentation

Lines beginning with `///` attach Markdown documentation to the following `program`, `function`, `state`, or transition. Consecutive lines form one documentation string.

```tm
/// ## Contract
/// Reads two bits beginning at the head.
///
/// Returns one result bit with the head on that bit.
function And;
```

Machine and current-state documentation opens in a sanitized Markdown dialog. Use `//` for comments that should not become documentation.

## Tape input

The input control accepts an explicit encoding or auto-detects `0b` and `0x` prefixes:

| Input | Binary tape |
| --- | --- |
| `hello` as UTF-8 | `0110100001100101011011000110110001101111` |
| `0b1010` | `1010` |
| `0x2a` | `00101010` |
| `42` as Decimal | `101010` |

All encodings produce only binary tape data. Hexadecimal input preserves four bits per digit, including leading zeroes.

## Execution and output

`Run` animates execution at the selected speed. `Run to completion` executes immediately with a one-million-transition safety limit and stops at declared pauses. For a standalone machine, Step performs one transition. For a composition, Step executes the current function through its accepting or rejecting state.

The single Tape value inspector is both the live value and final output. It supports UTF-8, binary, decimal, and hexadecimal formats. UTF-8 requires complete valid bytes. Blank cells at the end are omitted, and a tape without binary content is displayed as `Empty`.

The visual tape always shows a 16-cell window that follows the head. This is only a viewport over the right-infinite tape.

## References

- [Michael Sipser, Introduction to the Theory of Computation](https://math.mit.edu/~sipser/book.html)
- [MIT OpenCourseWare 18.404J readings](https://ocw.mit.edu/courses/18-404j-theory-of-computation-fall-2020/pages/readings/)
- [MIT OpenCourseWare Lecture 5: Turing Machines](https://ocw.mit.edu/courses/18-404j-theory-of-computation-fall-2020/resources/mit18_404f20_lec5-1/)
