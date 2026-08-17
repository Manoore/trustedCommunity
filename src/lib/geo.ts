import { sql, type SQL } from "drizzle-orm";
import zipcodes from "zipcodes";

export type GeoPoint = {
  zip: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

const ZIP_RE = /^\d{5}$/;

export function normalizeZip(input: string | null | undefined): string | null {
  if (!input) return null;
  const zip = input.trim().slice(0, 5);
  return ZIP_RE.test(zip) ? zip : null;
}

/** Resolve a US ZIP to its centroid. Returns null for unknown or malformed ZIPs. */
export function lookupZip(input: string | null | undefined): GeoPoint | null {
  const zip = normalizeZip(input);
  if (!zip) return null;
  const rec = zipcodes.lookup(zip);
  if (!rec) return null;
  return {
    zip: rec.zip,
    city: rec.city,
    state: rec.state,
    lat: rec.latitude,
    lng: rec.longitude,
  };
}

/** Resolve a "City, ST" or bare city string to a representative centroid. */
export function lookupCityState(input: string): GeoPoint | null {
  const parts = input.split(",").map((p) => p.trim());
  if (parts.length < 2) return null;
  const [city, state] = parts;
  const matches = zipcodes.lookupByName(city, state.toUpperCase());
  if (!matches?.length) return null;
  const rec = matches[0];
  return {
    zip: rec.zip,
    city: rec.city,
    state: rec.state,
    lat: rec.latitude,
    lng: rec.longitude,
  };
}

/**
 * Accepts a ZIP, a "City, ST" string, or null. Used to turn whatever the user
 * typed into the search box into a point we can measure distance from.
 */
export function resolveLocation(input: string | null | undefined): GeoPoint | null {
  if (!input?.trim()) return null;
  return lookupZip(input) ?? lookupCityState(input);
}

const EARTH_RADIUS_MILES = 3958.8;

/** Great-circle distance in miles between two points. */
export function milesBetween(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/**
 * Haversine distance as a SQL expression, in miles.
 *
 * PostGIS would be faster, but plain trigonometry keeps the stack to stock
 * Postgres. The bounding-box prefilter in `withinRadius` is what keeps this
 * from turning into a full table scan.
 */
export function distanceMilesSql(
  latCol: SQL | unknown,
  lngCol: SQL | unknown,
  origin: GeoPoint,
): SQL<number> {
  // Radius is a literal, not a bind param: Postgres types `$n * 2` as integer
  // and then rejects a fractional value.
  const R = sql.raw(EARTH_RADIUS_MILES.toFixed(4));
  const oLat = sql`${origin.lat}::double precision`;
  const oLng = sql`${origin.lng}::double precision`;
  return sql<number>`(
    ${R} * 2 * asin(sqrt(
      power(sin(radians(${latCol} - ${oLat}) / 2), 2) +
      cos(radians(${oLat})) * cos(radians(${latCol})) *
      power(sin(radians(${lngCol} - ${oLng}) / 2), 2)
    ))
  )`;
}

const MILES_PER_DEG_LAT = 69.0;

/**
 * Bounding box around a point, so the index on (lat, lng) can be used before
 * the expensive trig runs.
 */
export function boundingBox(origin: GeoPoint, miles: number) {
  const latDelta = miles / MILES_PER_DEG_LAT;
  const cosLat = Math.max(Math.cos((origin.lat * Math.PI) / 180), 0.01);
  const lngDelta = miles / (MILES_PER_DEG_LAT * cosLat);
  return {
    minLat: origin.lat - latDelta,
    maxLat: origin.lat + latDelta,
    minLng: origin.lng - lngDelta,
    maxLng: origin.lng + lngDelta,
  };
}

export { RADIUS_LADDER, MIN_RESULTS_BEFORE_EXPANDING } from "@/lib/geo-constants";
