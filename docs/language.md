# Turing Machine Language

## Machine model

Execution follows Michael Sipser's deterministic, single-tape Turing machine from *Introduction to the Theory of Computation*, 3rd edition, Section 3.1.

- The tape has a left endpoint and is infinite to the right.
- The head starts on the leftmost tape symbol, or the leftmost blank for an empty tape.
- Moving left at the tape boundary leaves the head in place.
- `#` delimits data values and `blank`, displayed as `⊔`, represents an unused cell.
- Accept and reject states are distinct and halt immediately.
- The transition function is defined for every nonhalting state and all four tape symbols.
- Transitions use only `L` and `R`; Sipser's core model has no stay-put move.

The data alphabet is implicit and cannot be changed:

```text
input = { 0, 1, # }
tape = { 0, 1, #, blank }
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

/// Negates a 32-bit MSB-first word twice.
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
/// Reads two 32-bit words beginning at the head.
///
/// Writes the result into the next word and moves the head there.
function And32;
```

Machine and current-state documentation opens in a sanitized Markdown dialog. Use `//` for comments that should not become documentation.

## Tape editing

The visual tape is the input editor. Click a cell to cycle through blank, `0`, `1`, and `#`; focus a cell and type a symbol to set it directly. Delete, Backspace, or Space writes blank. Pasting writes a raw sequence of `0`, `1`, `#`, and `⊔` beginning at the focused cell. Shift-click places the initial head for function contracts that begin away from cell zero. Editing stops and resets execution, and the edited tape and head become the baseline used by Reset.

Use Previous cells and Next cells to navigate the right-infinite tape. Editing is disabled while the machine runs.

## Registry word ABI

Standard registry functions operate on fixed 32-bit words ordered most-significant bit first. Every word has a trailing delimiter, producing layouts such as `word#word#`.

Unary transforming operations such as NOT and increment update the word under the head and return to its most-significant bit. Binary operations read two adjacent words, preserve the first, write the result into the second, and finish on the second word's most-significant bit. This allows subsequent binary operations to consume the result and the following word without moving existing tape data. Predicates and navigation primitives define their head movement in their individual contracts.

The `lib/primitives/` category provides functions for moving to adjacent words, clearing a word, and validating word width.

## Execution and output

`Run` animates execution at the selected speed and stops at declared pauses. `Run to completion` bypasses pauses and executes immediately with a one-million-transition safety limit. For a standalone machine, Step performs one transition. For a composition, Step executes the current function through its accepting or rejecting state.

The value inspector at the top of the tape is both the live value and final output. It supports raw symbols, UTF-8 characters, binary, decimal, and hexadecimal formats. Numeric and character formats convert every `#`-delimited word independently, so delimiters and leading hexadecimal zeroes remain visible. UTF-8 requires complete valid bytes. Trailing blanks are omitted; use Symbols to inspect internal blanks.

The visual tape shows a navigable 16-cell window that follows the head during execution. This is only a viewport over the right-infinite tape.

## References

- [Michael Sipser, Introduction to the Theory of Computation](https://math.mit.edu/~sipser/book.html)
- [MIT OpenCourseWare 18.404J readings](https://ocw.mit.edu/courses/18-404j-theory-of-computation-fall-2020/pages/readings/)
- [MIT OpenCourseWare Lecture 5: Turing Machines](https://ocw.mit.edu/courses/18-404j-theory-of-computation-fall-2020/resources/mit18_404f20_lec5-1/)
