# Turing Machine Language

## Machine model

Execution follows Michael Sipser's deterministic, single-tape Turing machine from *Introduction to the Theory of Computation*, 3rd edition, Section 3.1.

- The tape has a left endpoint and is infinite to the right.
- The head starts on the leftmost tape symbol, or the leftmost blank for an empty tape.
- Moving left at the tape boundary leaves the head in place.
- `blank`, displayed as `⊔`, represents an unused cell.
- Accept and reject states are distinct and halt immediately.
- A missing transition is reported when execution encounters that state and symbol.
- Transitions use only `L` and `R`; Sipser's core model has no stay-put move.

Symbols are Unicode scalar characters. Rust stores each symbol as a four-byte `char`, and the WASM API serializes symbols as JavaScript strings. The input and tape alphabets reported by the runtime are inferred from the characters used in transitions; blank is always included in the tape alphabet.

Quoted symbols use JSON string escaping and must contain exactly one character. This supports arbitrary letters, punctuation, whitespace, and escaped control characters, for example `"λ"`, `","`, `" "`, and `"\n"`. Use the keyword `blank` for the blank symbol.

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
q0, "#" -> q_reject, "#", R;
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

/// Moves one cell to the right without changing the tape.
function NextBit;

start q0;
accept q_accept;
reject q_reject;

q0, "0" -> q_accept, "0", R;
q0, "1" -> q_accept, "1", R;
q0, "#" -> q_accept, "#", R;
q0, blank -> q_accept, blank, R;
```

Every function must document its tape and head contract. A function receives the tape and head exactly as the previous function left them. It may rewrite any cells. The write and movement of the transition that enters its accept state happen before the next function begins.

## Loading and composition

Each `.tm` file contains exactly one program or function. Imports name functions without copying their states into the source file:

```tm
model sipser-3e;

/// Moves to the next word, then returns to the first.
program RoundTrip;

import "lib/primitives/next-word.tm" as next;
import "lib/primitives/previous-word.tm" as previous;

include next.start as q0;
include next.accept as q1;
include previous.start as q1;
include previous.accept as q_accept;

pause q1;

start q0;
accept q_accept;
reject q_reject;
```

The loader performs these steps:

1. Parse the composite declarations without fetching imported files.
2. Resolve a function by exact path from an opened local library folder or the public registry only when execution reaches its included start state.
3. Assign the import instance a generated namespace and parse it as one concrete machine.
4. Rename internal states, such as `__tm_0_first__q_return`, so lazily loaded functions cannot collide.
5. Replace the previous transition table while retaining the tape, head position, and cumulative step count.
6. Release the fetched source and previous function after the replacement.

Every import includes its `start` and `accept` interface states. Giving two endpoints the same name merges them. In the example, `first.accept` and `second.start` both become `q1`, joining the two functions. A function's reject state always rejects the complete program and is not exported. The same file may be imported more than once under different aliases.

The composite program declares its public `start`, `accept`, and `reject` states. `pause state;` stops after the preceding function accepts and before the function mapped to that state begins. Step or Run resumes from that boundary.

## Repository hierarchy

Registry paths encode categories:

```text
lib/
  primitives/
```

The catalog exposes each path, category, unit kind, example tape, and description. The Studio explorer groups entries by category. Opening an entry edits it directly; the plus button creates a program that imports and includes a function.

## Documentation

Lines beginning with `///` attach Markdown documentation to the following `program`, `function`, `state`, or transition. Consecutive lines form one documentation string.

```tm
/// ## Contract
/// Deletes the current word and separator.
///
/// Compacts later words and moves the head to the next word.
function DeleteWord;
```

Machine and current-state documentation opens in a sanitized Markdown dialog. Use `//` for comments that should not become documentation.

## Tape input

The Studio accepts encoded binary and hexadecimal words. Every word requires a prefix and trailing separator:

```text
tape = (binary | hexadecimal)*
binary = "b" [01]+ "#"
hexadecimal = "x" [0-9a-fA-F]+ "#"
```

For example, `xFFFF#b0011#` expands to `1111111111111111#0011#`. Each hexadecimal digit always contributes four bits, so leading zeroes and word widths are preserved. An empty field creates a blank tape. Whitespace, unprefixed words, empty words, missing separators, and invalid digits are rejected.

The Head cell field is a zero-based index into the expanded tape. Apply tape validates both fields and establishes the baseline used by Reset. The notation remains exactly as entered after it is applied. Rendered tape cells are read-only.

The viewport follows the head automatically and renders only 17 cells, centered on the head except near the tape's left endpoint. Editing is disabled while the machine runs.

## Standard library

The standard library uses nonempty, variable-width, MSB-first words matching `[01]+#`. Its public input alphabet is `{ 0, 1, # }`; its successful output alphabet adds blank (`⊔`). Implementations may use private marker characters while running, but remove them before accepting. This restriction applies to library contracts and the Studio tape parser, not to the lower-level WASM API.

- `NextWord` validates the current and next words and stops on the next word's MSB.
- `PreviousWord` stops on the preceding word's MSB and rejects when no preceding word exists.
- `ValidateWord` validates the current word and stops immediately after its separator.
- `DeleteWord` removes the current word and separator, compacts later words, and stops where the deleted word began.

The library currently provides structural primitives only. Arithmetic and logical operations are intentionally left for later layers built from these contracts.

## Execution

`Run` animates execution at the selected speed and stops at declared pauses. `Run to completion` bypasses pauses and executes immediately with a one-million-transition safety limit. For a standalone machine, Step performs one transition. For a composition, Step executes the current function through its accepting or rejecting state.

The visual tape shows a bounded 17-cell window that follows the head during execution. This is only a viewport over the right-infinite tape; it never creates DOM elements for the full tape.

## References

- [Michael Sipser, Introduction to the Theory of Computation](https://math.mit.edu/~sipser/book.html)
- [MIT OpenCourseWare 18.404J readings](https://ocw.mit.edu/courses/18-404j-theory-of-computation-fall-2020/pages/readings/)
- [MIT OpenCourseWare Lecture 5: Turing Machines](https://ocw.mit.edu/courses/18-404j-theory-of-computation-fall-2020/resources/mit18_404f20_lec5-1/)
