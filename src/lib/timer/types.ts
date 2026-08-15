/**
 * Why a focus ended. Lives at the boundary between the timer FSM and the
 * `focus_session` insert: ring is the natural 25:00 completion, stop is any
 * interruption (anything other than the timer hitting zero). A stopped focus
 * still counts as 1 toward actuals per ADR 0001.
 */
export type EndCause = 'ring' | 'stop';
