# Turing Machine Studio

A Svelte 5 and TypeScript workbench for deterministic, single-tape Turing machines. Execution is powered by the Rust/WASM package [`@marcosousapoza/turing-machine-wasm`](https://www.npmjs.com/package/@marcosousapoza/turing-machine-wasm).

The core machine model and notation follow Michael Sipser's *Introduction to the Theory of Computation*, 3rd edition, Section 3.1. Imports and documentation comments are explicit Studio extensions.

## Features

- Arbitrary Unicode character symbols with alphabets inferred from transitions
- One-way-infinite tape with explicit accept and reject states
- Transition-level stepping for standalone machines and function-level stepping for compositions
- Binary and hexadecimal word input such as `xFFFF#b0011#`
- A bounded 17-cell tape viewport centered on the head
- Path-preserving local library folders and a remote community program explorer
- Lazily fetched, automatically namespaced function imports
- Declarative pause states at composition boundaries
- Collapsible registry categories
- Sanitized Markdown documentation dialogs from `///` comments
- Animated execution and immediate run-to-completion
- Light and dark themes matching the shadcn-svelte Claude theme

The WASM API supports arbitrary character symbols. The Studio and standard library use nonempty, variable-width binary words separated by `#`; their public input alphabet is `{ 0, 1, # }` and their public tape alphabet adds blank (`⊔`).

## Run locally

```sh
npm install
npm run dev
```

See the [language reference](docs/language.md) for the complete syntax and semantics.

Community machines live in [`turing-machine-programs`](https://github.com/marcosousapoza/turing-machine-programs).

## Checks

```sh
npm run check
npm test
npm run build
```
