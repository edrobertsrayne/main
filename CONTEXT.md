# Pomodoro

A local-only web app for managing focused work time using the Pomodoro Technique. Built with SvelteKit 5, Tailwind, and Drizzle/SQLite.

## Language

**Pomodoro**:
A 25-minute focus session, the fundamental unit of focused work in the Pomodoro Technique. A pomodoro counts as 1 whether it runs to completion or is stopped early.
_Avoid_: focus block, focus session (used below for a different sense), timer session

**Focus Session**:
The active period a user is running a pomodoro against a specific task. A focus session is _against_ a task; the task is what gets the credit.
_Avoid_: active pomodoro, running timer

**Break Session**:
A short break (5 min) or long break (20 min) between focus sessions. Either focus-end cause (`ring` or `stop`) routes to a short break; long breaks occur only after every fourth **consecutive completed** focus session — i.e. four `ring`s in a row with no `stop` breaking the chain. Break sessions are not associated with tasks and do not count toward any task's actuals.
_Avoid_: rest, idle

**Task**:
A unit of work the user wants to track. Has a name and an estimated number of pomodoros. Tasks are never deleted — archiving hides them from active lists while preserving history.
_Avoid_: todo, item, entry

**Estimate**:
The number of pomodoros a user expects to spend on a task. Set when the task is created and editable later.
_Avoid_: planned, target, expected

**Actuals**:
The number of focus sessions that have been counted against a task. Derived from the focus-session history; never stored as a counter on the task. In v1, actuals are displayed per-task only; per-day aggregates are the future productivity-overview map's territory.
_Avoid_: completed, done, spent

**Primary Task**:
A task the user has marked as one of today's main focuses. A subset of all (non-archived) tasks, scoped to a single day in the user's local timezone. Carries no extra weight in actuals — the marker is for planning, not measurement. Whether (and how) the primary marker gates the future streak-tracking map's daily-target rule is left for that effort to decide.
_Avoid_: today task, focus task, important task

**Done**:
A user-marked boolean flag on a task, indicating the user considers the work finished. Independent of archive — a task can be done without being archived, or archived without being done (abandoned, deprioritised).
_Avoid_: completed (overloaded with archive in user mental models)

**Archived Task**:
A task hidden from active lists. Independent of `done` — a task can be archived without being done (abandoned, deprioritised) or done without being archived (still visible). The task row and its focus-session history are preserved either way.
_Avoid_: deleted, removed, hidden, completed

**Local Day**:
The calendar day in the user's browser timezone. A focus session is attributed to the single local day on which it _started_. Worked example: a focus session started at 11:30pm Monday and stopped at 12:15am Tuesday is attributed to Monday — its +1 to actuals is recorded against the focused task on Monday. Tuesday records nothing for this session.
_Avoid_: today, current day

**Workday**, **Daily Target**, **Streak**:
_Deferred to the streak-tracking effort. Not part of the first vertical slice._

**Pomodoro Cycle**:
The classic 25 / 5 / 20 rhythm: a focus session, a short break, four *consecutive completed* focuses to a long break. In this app the cycle is half-auto — finishing a focus auto-starts the next break, but a break ending does _not_ auto-start the next focus: the timer returns to idle and waits for an explicit `start focus` gesture. An interrupted (`stop`ped) focus still routes to a short break but **resets** the consecutive-completed counter to 0, so a `stop` one focus short of the long break wipes the streak.
_Avoid_: round, sequence