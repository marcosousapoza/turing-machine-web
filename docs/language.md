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

/// Negates a binary word twice.
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
  logic/
  math/
  predicates/
  primitives/
```

The catalog exposes each path, category, unit kind, example tape, and description. The Studio explorer groups entries by category. Opening an entry edits it directly; the plus button creates a program that imports and includes a function.

## Documentation

Lines beginning with `///` attach Markdown documentation to the following `program`, `function`, `state`, or transition. Consecutive lines form one documentation string.

```tm
/// ## Contract
/// Reads two binary words beginning at the head.
///
/// Writes the result into the next word and moves the head there.
function And32;
```

Machine and current-state documentation opens in a sanitized Markdown dialog. Use `//` for comments that should not become documentation.

## Tape editing

The visual tape is the input editor. Click a cell to cycle through blank and the symbols known from the current transition table; focus a cell and type any character to set it directly. Delete or Backspace writes blank. Pasting writes arbitrary characters beginning at the focused cell, including whitespace. Shift-click places the initial head for function contracts that begin away from cell zero. Editing stops and resets execution, and the edited tape and head become the baseline used by Reset.

The viewport follows the head automatically and renders only 17 cells, centered on the head except near the tape's left endpoint. Editing is disabled while the machine runs.

## Registry word ABI

Some registry functions define their own fixed-width binary contracts. Those contracts belong to the individual programs and do not constrain the runtime's symbol alphabet.

Unary transforming operations such as NOT and increment update the word under the head and return to its most-significant bit. Binary operations read two adjacent words, preserve the first, write the result into the second, and finish on the second word's most-significant bit. This allows subsequent binary operations to consume the result and the following word without moving existing tape data. Predicates and navigation primitives define their head movement in their individual contracts.

The `lib/primitives/` category provides functions for moving to adjacent words, clearing a word, and validating word width.

## Execution

`Run` animates execution at the selected speed and stops at declared pauses. `Run to completion` bypasses pauses and executes immediately with a one-million-transition safety limit. For a standalone machine, Step performs one transition. For a composition, Step executes the current function through its accepting or rejecting state.

The visual tape shows a bounded 17-cell window that follows the head during execution. This is only a viewport over the right-infinite tape; it never creates DOM elements for the full tape.

## References

- [Michael Sipser, Introduction to the Theory of Computation](https://math.mit.edu/~sipser/book.html)
- [MIT OpenCourseWare 18.404J readings](https://ocw.mit.edu/courses/18-404j-theory-of-computation-fall-2020/pages/readings/)
- [MIT OpenCourseWare Lecture 5: Turing Machines](https://ocw.mit.edu/courses/18-404j-theory-of-computation-fall-2020/resources/mit18_404f20_lec5-1/)
