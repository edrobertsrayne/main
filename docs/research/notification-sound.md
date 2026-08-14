# Notification & sound strategy — research note

Resolves [#6](../../issues/6) ("Decide notification & sound strategy"). Investigates
the browser APIs we need to signal the end of a focus session, then recommends a
concrete v1 approach per channel tied to the local-only SvelteKit 5 build, the
warm-pastel aesthetic, and the locked-in glossary in `CONTEXT.md`.

All claims are tied back to a primary source. Primary sources used:

- MDN — *Using the Notifications API*
  <https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API>
- MDN — `Notification.permission`
  <https://developer.mozilla.org/en-US/docs/Web/API/Notification/permission_static>
- MDN — `Notification`
  <https://developer.mozilla.org/en-US/docs/Web/API/Notification>
- MDN — *Page Visibility API*
  <https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API>
- MDN — *Web Audio API*
  <https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API>
- MDN — *Autoplay guide for media and Web Audio APIs*
  <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay>
- MDN — `<audio>` element
  <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio>
- MDN — `prefers-reduced-motion`
  <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>

---

## 1. OS notification (Web Notifications API)

### What the spec actually gives us

The browser persists notification permission per origin. `Notification.permission`
is a read-only string with three values: `"default"` (haven't been asked),
`granted`, `"denied"` (act as if denied) — see
[`Notification.permission`](https://developer.mozilla.org/en-US/docs/Web/API/Notification/permission_static).
We do not need to persist this ourselves; the browser owns it. The check is
synchronous and survives reloads, restarts, and incognito→regular switches.

`Notification.requestPermission()` *must* be invoked in response to a user
gesture (a click/tap/keypress). The MDN guide is explicit:

> "You should only request consent to display notifications in response to a
> user gesture. This is not only best practice — you should not be spamming
> users with notifications they didn't agree to — but going forward browsers
> will explicitly disallow notification permission requests not triggered in
> response to a user gesture. Firefox is already doing this from version 72."

([Using the Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API))

So we can't pop the prompt on first page load, or after a focus completes — it
must be wired to a button click.

Permission requires a secure context (HTTPS) in Chrome and Firefox, with the
exception of `localhost` which counts as secure
([Using the Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)).
For dev on `bun run dev` against `localhost` we will be fine; for production
the SvelteKit deploy target needs HTTPS (already required by service-worker
features in any case).

### Useful options on `new Notification(title, options)`

From
[`Notification`](https://developer.mozilla.org/en-US/docs/Web/API/Notification):

- `body` — supporting text under the title.
- `icon` — small image shown next to the title (any URL; PNG/SVG/WEBP).
- `tag` — if a notification with the same tag is still pending, it is replaced
  rather than stacked. Critical for our case: prevents the notification tray
  from filling up with one stale entry per pomodoro.
- `silent` — suppress the OS-level sound when the notification appears. We
  want to play our own chime, so we set `silent: true` to avoid double sound.
- `renotify` — required to be `true` if a `tag`-replaced notification should
  still alert the user.
- `requireInteraction` — keep the notification visible until the user
  dismisses it. Probably off by default; we only need attention, not
  blocking.
- `navigate` — auto-open a URL on activation, bypassing `click` events.
  Convenient if we want "click the notification → return to the app tab".

### What we show

A two-line notification, in the warm-pastel voice, no marketing speak:

> **Pomodoro complete** — Time for a break.
> *(or, on break end:)* **Break over** — Ready when you are.

`body` carries the human sentence; the title is the literal product noun so
it stays consistent with the glossary (`Pomodoro`, `Focus Session`, `Break
Session` — see `CONTEXT.md`). We don't dump the task name in the body — a
notification is short-lived, the user already knows what they were working on,
and pushing the task name would leak whatever they typed into the OS
notification tray. (Worth reconsidering once we have a "what task did I just
do?" recap; not in v1.)

### When we ask for permission

The MDN guide shows the canonical flow: a settings-page or onboarding button
that calls `requestPermission()` on click, then hides itself once granted
([example](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)).
For v1 the most defensible spot is **a single toggle in the settings page**
that:

1. Reads `Notification.permission` on mount.
2. If `"default"`, renders an "Enable desktop notifications" button. Clicking
   it calls `Notification.requestPermission()` and reflects the new state.
3. If `"granted"`, shows the toggle as on.
4. If `"denied"`, shows the toggle as off and a one-line explanation pointing
   at the browser's site-settings panel (we can't re-prompt once denied).

We do **not** request permission on first focus start, after the first
complete, or on any timer event. That violates the user-gesture rule and
would be silently blocked by Firefox/Chrome anyway. The settings page is the
only acceptable surface.

### Behaviour when permission is denied or absent

If `permission !== "granted"`, the in-app visual flash + sound still fire.
The user just doesn't get the OS-level notification. No fallback needed in
v1 — the in-document flash covers the "they're looking at the tab" case and
sound covers the "audio on, but tab is in background" case. This matches the
"graceful degradation" pattern in MDN's reference example.

---

## 2. Sound (chime)

### Two viable sources

**(a) Generated tone via Web Audio API.** Spin up an `AudioContext`, build an
`OscillatorNode` into a `GainNode` into `destination`, schedule a short
envelope, start. Zero binary assets, perfectly tunable to the warm-pastel
aesthetic, and trivially CC0 (it's just code). The MDN overview describes
exactly this routing
([Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)).

**(b) Decoded audio file via `AudioBufferSourceNode`.** Ship a small `.wav`
or `.ogg` in `static/`, fetch and `decodeAudioData()` it once, then play it
through `AudioBufferSourceNode` on demand. More characterful sound (a real
bell, a real wooden chime), but adds a binary asset and a license obligation
to the repo. Per `<audio>`'s usage notes, multiple `<source>` elements can
be declared so the browser picks the format it supports
([`<audio>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio)).

### Autoplay is the real constraint

Neither approach escapes autoplay rules. From the
[Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay):

> "Browsers may additionally choose to block under other circumstances. … In
> Firefox `media.autoplay.block-webaudio` is `true` by default — Web Audio
> only plays once the page has sticky activation."

The MDN guide is unambiguous about the only ways to get audio out without a
user gesture: be muted, or have user interaction on the page, or be
allow-listed. The chime *must* be triggered by something the user has
already clicked — the "Start focus session" or "Start break" button. By the
time the timer ends the user *has* interacted, so we are fine.

If for any reason the chime is still blocked (rare, but possible if the
user navigates away mid-session and the page goes cold), `OscillatorNode.start()`
resolves through the same `Promise` shape as `HTMLMediaElement.play()` and
rejects with `NotAllowedError`. We catch it silently — the visual flash is
the backup channel.

### Recommendation: generated Web Audio chime

For v1, ship a **synthesised chime** rather than a file. Reasoning:

1. **No license to track.** We keep the "local-only, no auth, no
   third-party assets" property of the rest of the stack. A binary asset
   is the first thing that drags in a CC0/PRODUCER-fields requirement and
   a future PR review that has to verify attribution.
2. **Trivial to tune.** Two soft sine partials (e.g. a fundamental around
   880 Hz plus a quiet harmonic) through a `GainNode` envelope (attack ~10
   ms, decay ~600 ms, release ~400 ms) reads as "warm chime" without any
   sample library. No DSP beyond `OscillatorNode` + `GainNode` + a single
   envelope ramp.
3. **Latency.** Web Audio start latency is sub-frame
   ([Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
   describes timing as "high precision and low latency"); an `<audio>`
   element would need to be preloaded and might race the timer.
4. **Bundle stays clean.** No asset to hash, no MIME-type negotiation, no
   `<source>` fallback list.

If we ever want a richer sound (a recorded wooden bowl, a soft marimba), we
can swap to `AudioBufferSourceNode` + a CC0 file without touching anything
else — the call site is one function.

### Reduced-motion / system-mute handling

`prefers-reduced-motion` is a **CSS** feature
([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion));
it does *not* affect sound. A user who has reduced motion enabled may still
want sound, and a user who has reduced motion disabled may want silence.
So we **don't** couple sound to `prefers-reduced-motion`. We add a
**separate user setting** — a Sound on/off toggle in the same settings page
as the notifications toggle. Stored in `localStorage` (the app is local-only
and we already plan a settings table).

System mute is handled by the OS: if the user has muted the browser or the
device, our chime is muted too. There is no JS API to detect system mute,
and we should not invent one. This is the correct behaviour — mute means
mute.

---

## 3. Visual flash (in-tab attention)

### Three options on the table

1. **Title-bar pulsing** — swap `document.title` between `"⏰ 24:59 —
   Pomodoro"` and `"⏰ Pomodoro complete — Time for a break"` on an interval.
   The original tab title is restored when the user focuses the tab. Cheap
   and works without a favicon swap.
2. **Favicon swap** — alternate `<link rel="icon">` between the regular
   favicon and a warm-pastel "ring" or filled dot. Most browsers update the
   tab strip in real time.
3. **Full-document animation** — a CSS keyframe overlay (a soft pastel
   flash, a gentle scale-up of the timer card) over the whole document.

All three are CSS animations, so all three must respect
`prefers-reduced-motion: reduce`
([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion))
— the MDN guidance is explicit that scaling/panning animations can be
vestibular triggers, and the `reduce` keyword should swap them out for
"more muted" alternatives.

### Recommendation: title-bar + favicon, document animation only when focused

Combine **title-bar pulse** and **favicon swap** for the tab-strip signal,
and add a **document-level CSS class** for the in-tab signal — but the
document animation only animates **when the page is already in the
foreground**. Use the
[Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
to gate it:

- `document.visibilityState === "visible"` and a focus session ends → a
  1.2 s pastel pulse on the timer card, plus an aria-live announcement
  ("Pomodoro complete — time for a break").
- `document.visibilityState === "hidden"` → no document animation. Rely on
  the OS notification + sound + favicon swap to get attention. This avoids
  burning CPU/GPU on a tab the user isn't looking at, and respects the
  policy in the MDN Page Visibility article: "A site has an image carousel
  that shouldn't advance to the next slide unless the user is viewing the
  page."

The `prefers-reduced-motion: reduce` media query turns the pulse off
entirely (the title and favicon swap are not animations and continue to
work). The chime continues — sound is independent of motion.

The favicon swap needs two PNGs (or one SVG referenced twice with different
fill). Keep them in `static/` — small enough that a hand-drawn pastel
tomato fits. (The icon can be the same "warm tomato" the brand picks for
the rest of the UI; we are not designing it in this ticket.)

---

## 4. Breaks vs focuses

Glossary note: a *focus session* ends into a *break session*, and a *break
session* ends into a *focus session* (see `CONTEXT.md`, "Pomodoro Cycle").

The user experience of a break ending is materially different from a focus
ending — the user is being asked to **stop resting**, not stop working.
The channel mix should reflect that:

| Channel              | Focus end              | Break end                  |
| -------------------- | ---------------------- | -------------------------- |
| OS notification      | Always (if granted)    | Always (if granted)        |
| Title-bar pulse      | Yes                    | Yes — same treatment       |
| Favicon swap         | Yes                    | Yes — same treatment       |
| Document animation   | Full pastel pulse      | **Quieter** — opacity-only |
| Chime                | "End of focus" tone    | **Quieter** — single soft partial, no harmonic |

Rationale: breaks are short (5–15 min) and the user is already in
"attentional slack" mode. A full-screen pulse + dual-partial chime at the
end of every break is too much. The notification and title-bar swap are
enough to break the user's attention back; the sound is reduced to a
single sine "ping" rather than the warmer two-partial chime.

The visual distinction also helps users build a Pavlovian cue: "full
pulse + warm chime" = work, "single ping + soft fade" = back to work.

---

## 5. Putting it together (concrete v1 plan)

Files / artefacts this ticket does **not** produce, but blocks:

- A `src/lib/audio.ts` module with `playChime(kind: "focus-end" |
  "break-end")` — wraps `AudioContext`, builds the oscillator chain,
  schedules the envelope, swallows `NotAllowedError`.
- A `src/lib/notify.ts` module with `notify(title, body, opts?)` — reads
  `Notification.permission`, returns silently if not granted, sets `silent:
  true` and a stable `tag` per kind ("focus-end" / "break-end") so
  repeated completions replace rather than stack.
- A `src/lib/flash.ts` module with `flash(kind)` — toggles a `data-flash`
  attribute on `<html>` that drives the CSS pulse. Reads
  `document.visibilityState` first to skip the animation when hidden.
- A favicon pair in `static/` — `favicon-idle.svg` and `favicon-alert.svg`,
  swapped by `<link rel="icon" href=...>` via the flash module.
- Two CSS files / blocks — one for `@keyframes` of the pulse, one for
  `@media (prefers-reduced-motion: reduce)` that turns the pulse into a
  400 ms opacity-only fade and disables any transforms.
- A settings page section (separate ticket) with two toggles: "Desktop
  notifications" (which on click requests permission) and "Chime sound".

This ticket only decides the strategy. Implementation tickets follow.

---

## Sources

- MDN — *Using the Notifications API* —
  <https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API>
- MDN — `Notification.permission` —
  <https://developer.mozilla.org/en-US/docs/Web/API/Notification/permission_static>
- MDN — `Notification` —
  <https://developer.mozilla.org/en-US/docs/Web/API/Notification>
- MDN — *Page Visibility API* —
  <https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API>
- MDN — *Web Audio API* —
  <https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API>
- MDN — *Autoplay guide for media and Web Audio APIs* —
  <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay>
- MDN — `<audio>` element —
  <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio>
- MDN — `prefers-reduced-motion` —
  <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>
- `CONTEXT.md` (repo glossary: Pomodoro, Focus Session, Break Session, Pomodoro
  Cycle) — <https://github.com/edrobertsrayne/pomodoro/blob/main/CONTEXT.md>
