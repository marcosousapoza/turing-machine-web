# Turing Machine Language

## Model

The execution model follows Michael Sipser's deterministic, single-tape Turing machine from *Introduction to the Theory of Computation*, 3rd edition, Section 3.1:

\[
M = (Q, \Sigma, \Gamma, \delta, q_0, q_{accept}, q_{reject})
\]

- The tape has a left endpoint and is infinite to the right.
- The head starts on the leftmost input symbol, or the leftmost blank for empty input.
- Moving left at the tape boundary leaves the head in place.
- `blank` is in the tape alphabet Γ and not in the input alphabet Σ.
- The input alphabet Σ must be a subset of Γ.
- The accept and reject states are distinct and halt immediately.
- The transition function is defined for every nonhalting state and tape-alphabet symbol.
- The transition function uses only `L` and `R`. Sipser's core model has no stay-put move.

The notation deliberately distinguishes two concepts commonly used in textbooks:

- `ε` is the empty word, a string of length zero. It is displayed by formatted input and output helpers but never occupies a tape cell.
- `blank` is the reserved language token for a blank tape cell and is displayed as `⊔`.

Imports and documentation comments are Studio language extensions and do not change the machine model.

## Complete example

```tm
model sipser-3e;

/// Decides whether a binary input contains at least one 1.
machine ContainsOne;

input_alphabet { "0", "1" };
tape_alphabet { "0", "1", blank };

start q0;
accept q_accept;
reject q_reject;

/// Search the input from left to right.
state q0;

q0, "0" -> q0, "0", R;
q0, "1" -> q_accept, "1", R;
q0, blank -> q_reject, blank, R;
```

The transition notation mirrors Sipser's tuple order:

```text
current_state, read_symbol -> next_state, write_symbol, direction;
```

This represents `δ(current_state, read_symbol) = (next_state, write_symbol, direction)`.

## Declarations

| Declaration | Meaning |
| --- | --- |
| `model sipser-3e;` | Selects the language's Sipser-compatible profile. |
| `machine Name;` | Gives the machine an identifier. |
| `input_alphabet { "0", "1" };` | Defines Σ. Symbols contain exactly one Unicode character. |
| `tape_alphabet { "0", "1", blank };` | Defines Γ. It must include `blank` and every input symbol. |
| `start q0;` | Declares the initial state. |
| `accept q_accept;` | Declares the accepting halt state. |
| `reject q_reject;` | Declares the rejecting halt state. |
| `state q0;` | Optionally declares a state so documentation can be attached. |

State identifiers begin with an ASCII letter or underscore and may contain ASCII letters, digits, and underscores.

## Documentation

Lines beginning with `///` attach documentation to the following `machine`, `state`, or transition declaration. Consecutive lines form one documentation string.

```tm
/// Scan right until the first blank.
/// This state preserves every input symbol.
state q_scan;
```

Machine and current-state documentation appears as a styled hover tooltip in the Studio. Use `//` for comments that should not become documentation.

## Imports

```tm
import "binary-complement.tm";
```

Imports are textual includes resolved before WASM compilation. Resolution checks uploaded local files first and then the public [`turing-machine-programs`](https://github.com/marcosousapoza/turing-machine-programs) registry. Relative paths are allowed, `..` traversal is rejected, nested imports are supported, and cycles produce an error.

A source containing only one import runs the imported standalone machine. Imported fragments may also contribute declarations and transitions, but duplicate machine-level declarations are rejected.

## Tape input

The input control accepts an explicit encoding or auto-detects `0b` and `0x` prefixes:

| Input | Decoded tape |
| --- | --- |
| `hello` as String | `0110100001100101011011000110110001101111` (UTF-8) |
| `0b1010` | `1010` |
| `0x2a` | `00101010` |
| `42` as Decimal | `101010` |

String input is encoded as UTF-8 bytes and written as eight binary symbols per byte. This lets machines compose around one binary representation instead of placing JavaScript characters directly on the tape. Hexadecimal input preserves four bits per digit, including leading zeroes. Decoded symbols must belong to the machine's input alphabet.

## Tape output

The live tape and halted output can independently be displayed as String, Binary, Decimal, or Hexadecimal. String output decodes complete groups of eight bits as UTF-8 and reports incomplete or invalid sequences. Numeric formats require a tape containing only `0` and `1`; trailing blank symbols are omitted. A tape with no nonblank content is displayed as `ε`.

The visual tape always shows a 16-cell window. It begins at cell zero and follows the head once execution moves beyond the first eight cells; this is only a viewport over the right-infinite tape.

## References

- [Michael Sipser, Introduction to the Theory of Computation](https://math.mit.edu/~sipser/book.html)
- [MIT OpenCourseWare 18.404J readings](https://ocw.mit.edu/courses/18-404j-theory-of-computation-fall-2020/pages/readings/)
- [MIT OpenCourseWare Lecture 5: Turing Machines](https://ocw.mit.edu/courses/18-404j-theory-of-computation-fall-2020/resources/mit18_404f20_lec5-1/)
