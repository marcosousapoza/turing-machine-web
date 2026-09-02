# Turing Machine Studio

A Svelte and TypeScript workbench for writing, running, and sharing deterministic Turing machines. Execution is powered by the Rust package [`@marcosousapoza/turing-machine-wasm`](https://www.npmjs.com/package/@marcosousapoza/turing-machine-wasm).

## Run locally

```sh
npm install
npm run dev
```

## Machine syntax

```text
start scan
halt done
blank _

scan 0 -> scan 0 R
scan 1 -> scan 1 R
scan _ -> done _ S
```

Transitions use `state read -> next-state write movement`. Movement may be `L`, `R`, or `S`. The tape starts at cell zero and is infinite to the right.

Machine files can be opened and saved from the editor. To contribute a reusable machine, add its `.tm` file to [`machines/`](./machines) in a pull request.

## Checks

```sh
npm run check
npm run build
```
