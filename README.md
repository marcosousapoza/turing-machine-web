# Turing Machine Studio

A Svelte 5 and TypeScript workbench for deterministic, single-tape Turing machines. Execution is powered by the Rust/WASM package [`@marcosousapoza/turing-machine-wasm`](https://www.npmjs.com/package/@marcosousapoza/turing-machine-wasm).

The core machine model and notation follow Michael Sipser's *Introduction to the Theory of Computation*, 3rd edition, Section 3.1. Imports and documentation comments are explicit Studio extensions.

## Features

- Sipser-compatible machine definitions with validated input and tape alphabets
- One-way-infinite tape with explicit accept and reject states
- Step, run, pause, reset, and speed controls
- String, binary, decimal, and hexadecimal tape views
- Text, binary, decimal, and hexadecimal initial input
- Local `.tm` files and a remote community program explorer
- Recursive `import "program.tm";` resolution
- Hover documentation from `///` comments
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
npm run build
```
