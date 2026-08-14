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
A short break (5 min) or long break (15 min) between focus sessions. Long breaks occur after every fourth focus session; the rest are short breaks. Break sessions are not associated with tasks and do not count toward any task's actuals.
_Avoid_: rest, idle

**Task**:
A unit of work the user wants to track. Has a name and an estimated number of pomodoros. Tasks are never deleted — archiving hides them from active lists while preserving history.
_Avoid_: todo, item, entry

**Estimate**:
The number of pomodoros a user expects to spend on a task. Set when the task is created and editable later.
_Avoid_: planned, target, expected

**Actuals**:
The number of focus sessions that have been counted against a task. Derived from the focus-session history; never stored as a counter on the task.
_Avoid_: completed, done, spent

**Primary Task**:
A task the user has marked as one of today's main focuses. A subset of all (non-archived) tasks, scoped to a single day in the user's local timezone. Carries no extra weight in actuals — the marker is for planning, not measurement.
_Avoid_: today task, focus task, important task

**Archived Task**:
A task hidden from active lists. The task row and its focus-session history are preserved.
_Avoid_: deleted, removed, hidden

**Local Day**:
The calendar day in the user's browser timezone. A focus session started at 11:30pm and stopped at 12:15am belongs to two local days; it is attributed to the day on which it _started_.
_Avoid_: today, current day

**Workday**, **Daily Target**, **Streak**:
_Deferred to the streak-tracking effort. Not part of the first vertical slice._

**Pomodoro Cycle**:
The classic 25 / 5 / 15 rhythm: a focus session, a short break, four focuses to a long break. In this app the cycle is auto-running — finishing a focus auto-starts the next break.
_Avoid_: round, sequence