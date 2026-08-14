# Pick state machine implementation

- **Ticket**: #5
- **Status**: Research — recommendation only, no code
- **Date**: 2026-08-14

## Question

Pick one implementation for the timer state machine, weighing:

1. **Shape**: ~6–8 states plus pause. Likely set: `idle`, `focus_running`, `focus_paused`, `focus_completed`, `short_break_running`, `short_break_completed`, `long_break_running`, `long_break_completed`. Guards: "every fourth focus → long break" (per `CONTEXT.md` Pomodoro Cycle) and "early stop still counts as 1 pomodoro" (per Pomodoro glossary).
2. **Visualizer need**: not required, but useful while the guard logic is settling.
3. **Svelte 5 rune comfort**: how well do `$state` / `$derived` / `$effect` model an FSM-shaped problem?

## Options

### A. XState v5 + `@xstate/svelte`

- `xstate@5.32.5` (Aug 2026), `@xstate/svelte@5.0.0`, peer deps `svelte: ^3.24.1 || ^4 || ^5` and `xstate: ^5.20.0` — compatible with the project's `svelte@^5.56.1`.
- Canonical v5 pattern is `setup({ actors, actions, guards, delays }).createMachine({ … })` (`statelyai/xstate` `setup.ts`); the second-arg form on `createMachine` is deprecated in v5.
- Timer lifecycle fits `fromCallback(({ input, sendBack }) => { const i = setInterval(...sendBack({type:'tick'})..., input.interval); return () => clearInterval(i); })` invoked from the running state (`statelyai/xstate` `examples/workflow-check-inbox/main.ts`).
- Guards declared up front, evaluated in document order, first-match-wins (`statelyai/xstate` `StateNode.ts` `next()`). Named `delays` map to either a static number or a context-aware function (`statelyai/xstate` `setup.ts`, `actions/raise.ts`).
- `@xstate/svelte` exposes `useMachine(machine)` returning a Svelte store of the snapshot plus `send` and the actor ref (`statelyai/docs` `content/docs/xstate-svelte.mdx`).
- Visualization: `@statelyai/inspect` `createBrowserInspector()` plugs into `createActor(..., { inspect })` and lights up the live diagram in the browser; deprecated in favour of `@statelyai/inspect` package (`statelyai/docs` `content/blog/2024-01-15-introducing-stately-inspector/index.mdx`).
- xstate has zero runtime deps and v5 reduced bundle size vs v4 (`statelyai/docs` `content/blog/2023-12-01-xstate-v5/index.mdx`). xstate-store, a sibling library, is `<1kb` but that's a different product and out of scope here (`statelyai/docs` `content/blog/2024-04-10-xstate-store/index.mdx`).

### B. Hand-rolled with Svelte 5 runes

- `svelte@5.37.0` is already in the repo. Class instance fields with `$state(...)` initialisers are the runes-mode equivalent of stores for shared state (`sveltejs/svelte` `documentation/docs/02-runes/02-$state.md`).
- `$derived` / `$derived.by` model derived values like "is this the long break?" from context (`sveltejs/svelte` tests `class-state-derived/main.svelte`, `class-state-derived-private/main.svelte`).
- Official best-practices doc explicitly recommends: "use classes with `$state` fields instead of stores for sharing reactive state between components" (`sveltejs/svelte` `documentation/docs/07-misc/01-best-practices.md`).
- A single `$state.raw` controller class can hold the phase enum, remaining ms, an `$effect` that wires up `setInterval` only while in a `*_running` state, and methods (`start`, `pause`, `resume`, `stop`, `complete`) that switch on the current phase and apply the guards inline. Estimated ~150–200 LOC, fully typed.
- Debug visibility is `console.log` inside transitions plus `$inspect` for ad-hoc snapshots — no live diagram, but the FSM is small enough that logging is sufficient.

## Comparison against the stated criteria

| Criterion | XState v5 | Hand-rolled runes |
|---|---|---|
| Expressing 6–8 flat-ish states | First-class; one config object | First-class; one `type` union |
| `every 4th focus → long break` guard | Named guard declared in `setup({ guards })`, reused across transitions | Inline `if` in the auto-advance transition |
| `early stop still counts as 1` | `assign` in the `STOP` transition | Same: mutate `actuals` in the `stop()` method |
| Pause as flag vs state | Sub-state or eventless transition; both are idiomatic | Either is fine; pause-as-flag dodges a parallel region |
| Visualizer / Inspector | Yes, official, web-based | None — `$inspect` instead |
| Bundle / deps | +2 packages (`xstate`, `@xstate/svelte`); xstate-core itself is dependency-free, v5 reduced size vs v4; absolute KB not published on primary docs | Zero added deps |
| Mental-model symmetry with the rest of the app | Sits alongside the runes layer — two reactive systems in one app | One reactive system end-to-end |
| Migration risk if shape grows (nested states, parallel regions) | Absorbs growth cleanly | Would need a rewrite into a small interpreter |
| Testing | Snapshot-based, well-trodden (`@xstate/test` style but optional) | Plain Vitest against the controller class |

## Recommendation

**Hand-rolled Svelte 5 `$state` runes, in a small controller class.**

Reasoning, tied to the criteria:

- **Shape**: 6–8 flat-ish states with one counting guard and one early-stop rule is well inside the size where a typed enum + a transition function is clearer than a declarative config.
- **Visualizer**: nice-to-have but not required; the FSM is small enough that `$inspect` snapshots during the few weeks we will be tuning the "every-fourth" semantics are sufficient.
- **Rune comfort**: Svelte's own best-practices doc steers toward `$state`-in-a-class for shared state and `$derived` for projections; the rest of this app already uses runes, so staying in one reactive system is the lower-friction choice.
- **Dep cost**: the project already has a tight dependency list (Svelte, Drizzle, Tailwind, better-sqlite3). XState earns its keep more on apps where state machines are the **product**; here it's a subsystem.
- **Retreat plan**: if the machine grows nested states or parallel regions during later slices (e.g. settings-modal-on-top-of-running-timer), XState v5 absorbs that growth without a rewrite. Porting from a well-typed hand-rolled controller to `setup({...}).createMachine(...)` is a mechanical lift because the state set and event vocabulary are already named.

## When to revisit

- If a second consumer appears (e.g. a CLI or background worker that needs the same FSM off-UI): port to XState so the machine is decoupled from the Svelte runtime.
- If the FSM grows a second orthogonal dimension (e.g. "sound on / off" running in parallel with phase): that's a parallel region — port to XState.
- If we end up wanting a shareable, versioned, visual model for the timer: port to XState and route the inspector during dev.

## Sources (primary only)

- XState repo: github.com/statelyai/xstate — `packages/core/src/setup.ts`, `packages/core/src/StateNode.ts`, `packages/core/src/actions/raise.ts`, `examples/workflow-check-inbox/main.ts`.
- Stately docs: github.com/statelyai/docs — `content/docs/xstate-svelte.mdx`, `content/docs/inspector.mdx`, `content/blog/2024-01-15-introducing-stately-inspector/index.mdx`, `content/blog/2023-12-01-xstate-v5/index.mdx`, `content/blog/2024-04-10-xstate-store/index.mdx`.
- Svelte repo: github.com/sveltejs/svelte — `documentation/docs/02-runes/02-$state.md`, `documentation/docs/07-misc/01-best-practices.md`, `tests/runtime-runes/samples/class-state-derived/main.svelte`, `tests/runtime-runes/samples/class-state-derived-private/main.svelte`.
- npm registry: `xstate@5.32.5`, `@xstate/svelte@5.0.0` (peer deps verified via `npm view`).
- Project glossary: `CONTEXT.md` (Pomodoro, Focus Session, Pomodoro Cycle).
