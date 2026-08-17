declare module "zipcodes" {
  export interface ZipRecord {
    zip: string;
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    country: string;
  }

  export function lookup(zip: string | number): ZipRecord | undefined;
  export function lookupByName(city: string, state: string): ZipRecord[];
  export function lookupByState(state: string): ZipRecord[];
  export function distance(zipA: string, zipB: string): number | null;
  export function radius(zip: string, miles: number): string[];
  export function toMiles(km: number): number;
  export function toKilometers(miles: number): number;
}
