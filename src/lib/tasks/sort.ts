/**
 * Default-view sort comparator for the task list.
 *
 * The order is `isPrimaryToday DESC, createdAt ASC` — primaries are floated
 * to the top of the default view, and within each group rows are ranked
 * by creation order so the ordering is stable and predictable. There is
 * no `position` column on tasks in v1; drag-to-reorder is deferred.
 *
 * The soft-nudge threshold lives here too: `shouldShowSoftNudge` reports
 * whether the primary count has crossed the recommended cap. The sort
 * itself always runs the same way regardless of the count — the nudger
 * is a separate visual concern that never reorders the list.
 */

export const SOFT_NUDGE_THRESHOLD = 5;

export type TaskLike = {
	id: string;
	createdAt: number;
	isPrimaryToday: boolean;
};

export function compareTasksForDefaultView(a: TaskLike, b: TaskLike): number {
	if (a.isPrimaryToday !== b.isPrimaryToday) {
		return a.isPrimaryToday ? -1 : 1;
	}
	return a.createdAt - b.createdAt;
}

export function shouldShowSoftNudge(primaryCount: number): boolean {
	return primaryCount > SOFT_NUDGE_THRESHOLD;
}
