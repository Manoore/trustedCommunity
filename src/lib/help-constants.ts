/**
 * Labels and kinds for arrival help, in their own module with no server-only
 * imports. The post form is a client component and needs these; `lib/help.ts`
 * touches the database and must stay on the server.
 */
export type HelpKind = "pickup" | "temp_stay" | "room" | "item";
export type HelpDirection = "offer" | "need";

export const KIND_LABELS: Record<HelpKind, string> = {
  pickup: "Airport pickup",
  temp_stay: "First-week stay",
  room: "Room or sublet",
  item: "Belongings handover",
};

export const KIND_EMOJI: Record<HelpKind, string> = {
  pickup: "🚗",
  temp_stay: "🛏️",
  room: "🏠",
  item: "📦",
};

/** Stays and rooms are the risky kinds: they get extra gates and warnings. */
export const ACCOMMODATION_KINDS: HelpKind[] = ["temp_stay", "room"];
