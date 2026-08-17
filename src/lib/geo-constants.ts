/**
 * Geo constants with no dependencies.
 *
 * Kept apart from `geo.ts` on purpose: that module pulls in the `zipcodes`
 * dataset, which is close to a megabyte. Client components need these numbers
 * but must never drag the dataset into the browser bundle.
 */

/** Radius ladder used when a search comes back thin. */
export const RADIUS_LADDER = [25, 50, 100, 250, 500] as const;

/** Below this many results, widen to the next rung instead of showing an empty page. */
export const MIN_RESULTS_BEFORE_EXPANDING = 8;
