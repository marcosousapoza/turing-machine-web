# Turing Machine Studio

A Svelte 5 and TypeScript workbench for deterministic, single-tape Turing machines. Execution is powered by the Rust/WASM package [`@marcosousapoza/turing-machine-wasm`](https://www.npmjs.com/package/@marcosousapoza/turing-machine-wasm).

The core machine model and notation follow Michael Sipser's *Introduction to the Theory of Computation*, 3rd edition, Section 3.1. Imports and documentation comments are explicit Studio extensions.

## Features

- Sipser-compatible machines with the implicit input alphabet `{ 0, 1, # }`
- One-way-infinite tape with explicit accept and reject states
- Transition-level stepping for standalone machines and function-level stepping for compositions
- Symbol, UTF-8, binary, decimal, and hexadecimal tape views
- Direct cell editing and raw-symbol paste on the tape
- A navigable 16-cell tape viewport that follows the head
- Path-preserving local library folders and a remote community program explorer
- Lazily fetched, automatically namespaced function imports
- Declarative pause states at composition boundaries
- A `word#word#` 32-bit MSB-first registry ABI with composable word primitives
- Collapsible registry categories
- Sanitized Markdown documentation dialogs from `///` comments
- Animated execution and immediate run-to-completion
- Light and dark themes matching the shadcn-svelte Claude theme

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
