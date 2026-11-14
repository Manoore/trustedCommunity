import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ enums */

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const providerTypeEnum = pgEnum("provider_type", ["individual", "entity"]);
export const providerStatusEnum = pgEnum("provider_status", [
  "draft",
  "active",
  "suspended",
]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "manager", "staff"]);
export const priceTypeEnum = pgEnum("price_type", [
  "hourly",
  "fixed",
  "starting_at",
  "quote",
]);
export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "pending",
  "active",
  "paused",
  "rejected",
  "suspended",
]);
export const inquiryStatusEnum = pgEnum("inquiry_status", [
  "new",
  "replied",
  "closed",
  "spam",
]);
export const reviewStatusEnum = pgEnum("review_status", [
  "published",
  "pending",
  "removed",
]);
export const verificationKindEnum = pgEnum("verification_kind", [
  "identity",
  "license",
  "insurance",
  "business",
]);
export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "approved",
  "rejected",
]);
export const reportTargetEnum = pgEnum("report_target", [
  "listing",
  "review",
  "provider",
  "message",
  "help_post",
]);

/* ------------------------------------------------------ arrival-help enums */

/** What kind of help: a ride from the airport, a first-week bed, a room, belongings. */
export const helpKindEnum = pgEnum("help_kind", [
  "pickup",
  "temp_stay",
  "room",
  "item",
]);

/** An `offer` is a helper saying "I can"; a `need` is a newcomer saying "I need". */
export const helpDirectionEnum = pgEnum("help_direction", ["offer", "need"]);

export const helpStatusEnum = pgEnum("help_status", ["open", "closed", "suspended"]);

export const helpResponseStatusEnum = pgEnum("help_response_status", [
  "pending",
  "accepted",
  "declined",
  "completed",
  "cancelled",
]);
export const reportStatusEnum = pgEnum("report_status", [
  "open",
  "actioned",
  "dismissed",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

/* --------------------------------------------- recommendation-layer enums */

/** A recommended contact is either a business or a private individual. */
export const contactKindEnum = pgEnum("contact_kind", ["business", "individual"]);

/** How the recommender knows them - weights the recommendation. */
export const relationshipEnum = pgEnum("relationship", [
  "used_personally",
  "worked_with",
  "know_personally",
  "trusted_referral",
  "know_of",
]);

export const strengthEnum = pgEnum("recommendation_strength", [
  "recommend",
  "highly_recommend",
  "go_to",
]);

/** Who a recommendation is visible to. Private is the default. */
export const visibilityEnum = pgEnum("visibility", [
  "private",
  "connections",
  "groups",
  "link",
]);

export const groupKindEnum = pgEnum("group_kind", [
  "temple",
  "church",
  "neighborhood",
  "social",
  "school",
  "workplace",
  "other",
]);

export const joinPolicyEnum = pgEnum("join_policy", ["invite", "link", "approval"]);

export const memberStatusEnum = pgEnum("member_status", [
  "owner",
  "admin",
  "member",
]);

export const connectionStatusEnum = pgEnum("connection_status", [
  "pending",
  "accepted",
  "blocked",
]);

export const shareKindEnum = pgEnum("share_kind", ["recommendation", "list"]);

export const askStatusEnum = pgEnum("ask_status", ["open", "answered", "closed"]);

export const askAudienceEnum = pgEnum("ask_audience", ["connections", "group"]);

export const claimKindEnum = pgEnum("claim_kind", ["claim", "removal"]);

export const claimStatusEnum = pgEnum("claim_status", [
  "open",
  "resolved",
  "rejected",
]);

/* ------------------------------------------------------------------ users */

/* --------------------------------------------------------------- colleges */

/**
 * A university, used to anchor arrival help. Groups are defined by college, not
 * by nationality or religion: that keeps the community useful and keeps housing
 * posts clear of anything resembling a protected-class preference.
 */
export const colleges = pgTable(
  "colleges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    country: text("country").notNull().default("US"),
    /** e.g. utdallas.edu - the proof a student belongs here is an address on it. */
    domain: text("domain"),
    /** Nearest major airport, shown on arrival posts. */
    airport: text("airport"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("colleges_slug_unique").on(t.slug),
    unique("colleges_domain_unique").on(t.domain),
  ],
);

/* ------------------------------------------------------------------ users */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    role: userRoleEnum("role").notNull().default("user"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    // TCPA: SMS may only be sent after an explicit, recorded opt-in.
    smsOptInAt: timestamp("sms_opt_in_at", { withTimezone: true }),
    /** The college they say they attend. Claiming it unlocks nothing by itself. */
    collegeId: uuid("college_id").references(() => colleges.id, {
      onDelete: "set null",
    }),
    /** The address they proved they control. One student address, one account. */
    eduEmail: text("edu_email"),
    eduVerifiedAt: timestamp("edu_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("users_email_unique").on(t.email),
    unique("users_edu_email_unique").on(t.eduEmail),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/* -------------------------------------------------------------- providers */

/**
 * One table for both individuals and entities. `type` drives which fields are
 * required and how many members may be attached - it is a permission and
 * validation difference, not a schema fork.
 */
export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: providerTypeEnum("type").notNull(),

    /**
     * A business profile is public within a community. A private individual -
     * a babysitter, a tutor - is not: their details are only ever shown to
     * people the recommender is directly connected to, and they get a
     * claim-or-remove path that works without them signing up.
     */
    kind: contactKindEnum("kind").notNull().default("business"),

    /**
     * E.164. The identity key for deduplication: two people adding the same
     * plumber must land on one profile. Unique, nullable for records that
     * predate a phone number.
     */
    normalizedPhone: text("normalized_phone"),

    /**
     * ISO country the contact is in. Defaults to the US, but the diaspora also
     * needs trusted people back home - a doctor for parents, someone to look
     * after a property - so a contact is not assumed to be American.
     */
    country: text("country").notNull().default("US"),

    /** Who first added them. Null for self-registered providers. */
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    /**
     * Set only when a business owner created this profile themselves, rather
     * than someone recommending them. Kept separate from `claimedAt` (which
     * also fires when an admin approves a claim on a friend-added profile) so
     * the UI can say "this business listed itself" without guessing from
     * whether it has zero recommendations yet.
     */
    selfListedAt: timestamp("self_listed_at", { withTimezone: true }),
    removalRequestedAt: timestamp("removal_requested_at", { withTimezone: true }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),

    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    legalName: text("legal_name"),
    dbaName: text("dba_name"),
    headline: text("headline"),
    bio: text("bio"),

    // Contact details stay masked in public views until an inquiry is replied to.
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    websiteUrl: text("website_url"),

    addressLine1: text("address_line1"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),

    yearsExperience: integer("years_experience"),
    status: providerStatusEnum("status").notNull().default("draft"),
    ratingAvg: real("rating_avg").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    suspendedReason: text("suspended_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("providers_slug_unique").on(t.slug),
    unique("providers_phone_unique").on(t.normalizedPhone),
    index("providers_status_idx").on(t.status),
    index("providers_geo_idx").on(t.lat, t.lng),
    index("providers_kind_idx").on(t.kind),
  ],
);

export const providerMembers = pgTable(
  "provider_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("provider_members_unique").on(t.providerId, t.userId),
    index("provider_members_user_idx").on(t.userId),
  ],
);

/* ------------------------------------------------------------- categories */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** Trades that need a state licence before a listing can go live. */
    licenseRequired: boolean("license_required").notNull().default(false),
    /** Categories we refuse to host (regulated or FOSTA/SESTA exposure). */
    restricted: boolean("restricted").notNull().default(false),
    /**
     * Healthcare and legal. Contact-only and outbound-link-only, and switched
     * off at runtime until ENABLE_PROFESSIONAL_CATEGORIES is set, because
     * whether a free list of lawyers counts as a "referral service" is a
     * question for counsel in each state.
     */
    professional: boolean("professional").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("categories_slug_unique").on(t.slug),
    index("categories_parent_idx").on(t.parentId),
  ],
);

/* --------------------------------------------------------------- listings */

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),

    priceType: priceTypeEnum("price_type").notNull().default("quote"),
    priceMinCents: integer("price_min_cents"),
    priceMaxCents: integer("price_max_cents"),

    status: listingStatusEnum("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),

    /** Remote work carries nationwide reach and ignores the radius filter. */
    remoteOk: boolean("remote_ok").notNull().default(false),
    zip: text("zip"),
    city: text("city"),
    state: text("state"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    serviceRadiusMiles: integer("service_radius_miles").notNull().default(25),

    licenseNumber: text("license_number"),
    licenseState: text("license_state"),

    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    inquiryCount: integer("inquiry_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("listings_slug_unique").on(t.slug),
    index("listings_provider_idx").on(t.providerId),
    index("listings_category_idx").on(t.categoryId),
    index("listings_status_idx").on(t.status),
    index("listings_geo_idx").on(t.lat, t.lng),
    index("listings_featured_idx").on(t.featuredUntil),
  ],
);

export const listingMedia = pgTable(
  "listing_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("listing_media_listing_idx").on(t.listingId)],
);

/* -------------------------------------------------------------- inquiries */

export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    buyerUserId: uuid("buyer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    buyerName: text("buyer_name").notNull(),
    buyerEmail: text("buyer_email").notNull(),
    buyerPhone: text("buyer_phone"),
    buyerZip: text("buyer_zip"),
    status: inquiryStatusEnum("status").notNull().default("new"),
    /**
     * Set when the provider first replies. Until then the buyer never sees the
     * provider's phone or email - this is what keeps the transaction on-platform.
     */
    contactUnlockedAt: timestamp("contact_unlocked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inquiries_listing_idx").on(t.listingId),
    index("inquiries_provider_idx").on(t.providerId),
    index("inquiries_buyer_idx").on(t.buyerUserId),
  ],
);

export const inquiryMessages = pgTable(
  "inquiry_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inquiry_messages_inquiry_idx").on(t.inquiryId)],
);

/* ---------------------------------------------------------------- reviews */

/** One review per inquiry: you cannot review someone you never contacted. */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    status: reviewStatusEnum("status").notNull().default("published"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("reviews_inquiry_unique").on(t.inquiryId),
    index("reviews_provider_idx").on(t.providerId),
  ],
);

/* ---------------------------------------------------------- verifications */

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    kind: verificationKindEnum("kind").notNull(),
    licenseNumber: text("license_number"),
    licenseState: text("license_state"),
    documentUrl: text("document_url"),
    status: verificationStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verifications_provider_idx").on(t.providerId)],
);

/* ---------------------------------------------------------------- reports */

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: reportTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("open"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reports_status_idx").on(t.status),
    index("reports_target_idx").on(t.targetType, t.targetId),
  ],
);

/* -------------------------------------------------------- featured orders */

export const featuredOrders = pgTable(
  "featured_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeSessionId: text("stripe_session_id"),
    amountCents: integer("amount_cents").notNull(),
    days: integer("days").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("featured_orders_listing_idx").on(t.listingId),
    index("featured_orders_session_idx").on(t.stripeSessionId),
  ],
);

/* -------------------------------------------------------- recommendations */

/**
 * An attributed recommendation: "AJ recommends Mike's Plumbing".
 *
 * Deliberately positive-only. There is no rating and no negative review - you
 * either vouch for someone or you say nothing. That removes almost all of the
 * moderation burden and the defamation surface, and it matches how people
 * actually pass on a contact.
 */
export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recommenderUserId: uuid("recommender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id),
    relationship: relationshipEnum("relationship").notNull().default("used_personally"),
    strength: strengthEnum("strength").notNull().default("recommend"),
    note: text("note"),
    visibility: visibilityEnum("visibility").notNull().default("private"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One recommendation per person per contact. Editing replaces it.
    unique("recommendations_unique").on(t.recommenderUserId, t.providerId),
    index("recommendations_provider_idx").on(t.providerId),
    index("recommendations_user_idx").on(t.recommenderUserId),
    index("recommendations_category_idx").on(t.categoryId),
  ],
);

/** Group scoping for a recommendation whose visibility is `groups`. */
export const recommendationGroups = pgTable(
  "recommendation_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recommendationId: uuid("recommendation_id")
      .notNull()
      .references(() => recommendations.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (t) => [unique("recommendation_groups_unique").on(t.recommendationId, t.groupId)],
);

/* ---------------------------------------------------------------- groups */

/**
 * A community: a temple, a street, a social circle. Lightweight and
 * self-serve on purpose - no admin tier and no procurement, because the
 * groups worth reaching (a 300-family temple, an HOA) have neither.
 */
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: groupKindEnum("kind").notNull().default("other"),
    description: text("description"),
    city: text("city"),
    state: text("state"),
    joinPolicy: joinPolicyEnum("join_policy").notNull().default("invite"),
    /** Set for a college's community group, so the two stay linked. */
    collegeId: uuid("college_id").references(() => colleges.id, {
      onDelete: "set null",
    }),
    welcomeMessage: text("welcome_message"),
    /** Optional cap, so a small close-knit group can stay small. */
    memberLimit: integer("member_limit"),
    inviteToken: text("invite_token"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("groups_slug_unique").on(t.slug),
    unique("groups_invite_token_unique").on(t.inviteToken),
  ],
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberStatusEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("group_members_unique").on(t.groupId, t.userId),
    index("group_members_user_idx").on(t.userId),
  ],
);

/* ----------------------------------------------------------- connections */

/** Mutual-accept link between two users. Stored once, ordered by user id. */
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: uuid("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: connectionStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    unique("connections_pair_unique").on(t.requesterId, t.addresseeId),
    index("connections_addressee_idx").on(t.addresseeId),
  ],
);

/* ---------------------------------------------------------- share links */

/**
 * A tokenised public view of one recommendation or a whole list. Viewing needs
 * no account - that is the growth loop.
 */
export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull(),
    kind: shareKindEnum("kind").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recommendationId: uuid("recommendation_id").references(() => recommendations.id, {
      onDelete: "cascade",
    }),
    categoryId: uuid("category_id").references(() => categories.id),
    viewCount: integer("view_count").notNull().default(0),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("share_links_token_unique").on(t.token),
    index("share_links_user_idx").on(t.userId),
  ],
);

/* ------------------------------------------------------------------ asks */

/**
 * "Does anyone know a good electrician?" broadcast to chosen circles.
 *
 * An ask is not a public classified — it only reaches the connections and
 * groups the author picked, and answers come back as real recommendations.
 */
export const asks = pgTable(
  "asks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id),
    title: text("title").notNull(),
    body: text("body"),
    zip: text("zip"),
    city: text("city"),
    state: text("state"),
    status: askStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [index("asks_user_idx").on(t.userId), index("asks_status_idx").on(t.status)],
);

/** Who an ask was sent to: all my connections, and/or specific groups. */
export const askTargets = pgTable(
  "ask_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    askId: uuid("ask_id")
      .notNull()
      .references(() => asks.id, { onDelete: "cascade" }),
    audience: askAudienceEnum("audience").notNull(),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  },
  (t) => [index("ask_targets_ask_idx").on(t.askId)],
);

export const askResponses = pgTable(
  "ask_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    askId: uuid("ask_id")
      .notNull()
      .references(() => asks.id, { onDelete: "cascade" }),
    responderUserId: uuid("responder_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The contact being suggested. */
    providerId: uuid("provider_id").references(() => providers.id, {
      onDelete: "cascade",
    }),
    note: text("note"),
    /** Set when the asker says they actually hired this person. */
    hiredAt: timestamp("hired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("ask_responses_unique").on(t.askId, t.responderUserId, t.providerId),
    index("ask_responses_ask_idx").on(t.askId),
  ],
);

/* --------------------------------------------------------- arrival help */

/**
 * One table for both directions of help. "I can pick someone up from DFW on
 * Aug 18" (offer) and "I land at DFW on Aug 18 and need a pickup" (need) are the
 * same shape, and a response to either works the same way.
 *
 * Deliberately no price, no deposit, no payment. Money moving through the app
 * would turn a favour between students into a regulated service, and is how
 * rental scams work.
 */
export const helpPosts = pgTable(
  "help_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id, { onDelete: "cascade" }),
    direction: helpDirectionEnum("direction").notNull(),
    kind: helpKindEnum("kind").notNull(),
    title: text("title").notNull(),
    details: text("details"),
    /** An airport, or a neighbourhood near campus. */
    area: text("area"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    /** How many people an offer can take. A need is satisfied by one. */
    capacity: integer("capacity").notNull().default(1),
    /** Shared only with the person whose response is accepted. */
    contactPhone: text("contact_phone"),
    status: helpStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("help_posts_college_status_idx").on(t.collegeId, t.status),
    index("help_posts_user_idx").on(t.userId),
  ],
);

export const helpResponses = pgTable(
  "help_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => helpPosts.id, { onDelete: "cascade" }),
    responderUserId: uuid("responder_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: text("message"),
    contactPhone: text("contact_phone"),
    status: helpResponseStatusEnum("status").notNull().default("pending"),
    /** Left by the newcomer once the help happened. This is the helper's reputation. */
    endorsement: text("endorsement"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    unique("help_responses_unique").on(t.postId, t.responderUserId),
    index("help_responses_post_idx").on(t.postId),
    index("help_responses_responder_idx").on(t.responderUserId),
  ],
);

/* ---------------------------------------------------------- notifications */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.readAt)],
);

/* ------------------------------------------------- student email verification */

/** A one-time code sent to a student address. Only its hash is stored. */
export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_verifications_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------- group pins */

/** A starter list: the contacts an owner pins so a newcomer sees them first. */
export const groupPins = pgTable(
  "group_pins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    note: text("note"),
    pinnedByUserId: uuid("pinned_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("group_pins_unique").on(t.groupId, t.providerId)],
);

/* -------------------------------------------------------- claim requests */

/**
 * How a private individual gets themselves out of the system, or takes over
 * their own profile, without having to sign up first. Someone listed as a
 * babysitter by a neighbour never chose to be here, so this path has to exist
 * from day one rather than being retrofitted.
 */
export const claimRequests = pgTable(
  "claim_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    kind: claimKindEnum("kind").notNull(),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    message: text("message"),
    status: claimStatusEnum("status").notNull().default("open"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("claim_requests_status_idx").on(t.status),
    index("claim_requests_provider_idx").on(t.providerId),
  ],
);

/* ------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  memberships: many(providerMembers),
  inquiries: many(inquiries),
  reviews: many(reviews),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const providersRelations = relations(providers, ({ many }) => ({
  members: many(providerMembers),
  listings: many(listings),
  reviews: many(reviews),
  verifications: many(verifications),
}));

export const providerMembersRelations = relations(providerMembers, ({ one }) => ({
  provider: one(providers, {
    fields: [providerMembers.providerId],
    references: [providers.id],
  }),
  user: one(users, { fields: [providerMembers.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_parent",
  }),
  children: many(categories, { relationName: "category_parent" }),
  listings: many(listings),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  provider: one(providers, {
    fields: [listings.providerId],
    references: [providers.id],
  }),
  category: one(categories, {
    fields: [listings.categoryId],
    references: [categories.id],
  }),
  media: many(listingMedia),
  inquiries: many(inquiries),
  reviews: many(reviews),
}));

export const listingMediaRelations = relations(listingMedia, ({ one }) => ({
  listing: one(listings, {
    fields: [listingMedia.listingId],
    references: [listings.id],
  }),
}));

export const inquiriesRelations = relations(inquiries, ({ one, many }) => ({
  listing: one(listings, {
    fields: [inquiries.listingId],
    references: [listings.id],
  }),
  provider: one(providers, {
    fields: [inquiries.providerId],
    references: [providers.id],
  }),
  buyer: one(users, { fields: [inquiries.buyerUserId], references: [users.id] }),
  messages: many(inquiryMessages),
}));

export const inquiryMessagesRelations = relations(inquiryMessages, ({ one }) => ({
  inquiry: one(inquiries, {
    fields: [inquiryMessages.inquiryId],
    references: [inquiries.id],
  }),
  sender: one(users, {
    fields: [inquiryMessages.senderUserId],
    references: [users.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  inquiry: one(inquiries, {
    fields: [reviews.inquiryId],
    references: [inquiries.id],
  }),
  listing: one(listings, { fields: [reviews.listingId], references: [listings.id] }),
  provider: one(providers, {
    fields: [reviews.providerId],
    references: [providers.id],
  }),
  author: one(users, { fields: [reviews.authorUserId], references: [users.id] }),
}));

/* ------------------------------------------------------------ index setup */

/**
 * Statements drizzle-kit cannot express. Run once after migrating - see
 * `npm run db:setup`.
 */
export const extraIndexStatements = [
  sql`CREATE INDEX IF NOT EXISTS listings_search_idx ON listings USING GIN (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
      )`,
  sql`CREATE INDEX IF NOT EXISTS providers_search_idx ON providers USING GIN (
        to_tsvector('english', coalesce(display_name, '') || ' ' || coalesce(headline, ''))
      )`,
  sql`DO $$ BEGIN
        ALTER TABLE reviews ADD CONSTRAINT reviews_rating_range
          CHECK (rating BETWEEN 1 AND 5);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

/* ----------------------------------------------------------------- types */

export const recommendationsRelations = relations(recommendations, ({ one, many }) => ({
  recommender: one(users, {
    fields: [recommendations.recommenderUserId],
    references: [users.id],
  }),
  provider: one(providers, {
    fields: [recommendations.providerId],
    references: [providers.id],
  }),
  category: one(categories, {
    fields: [recommendations.categoryId],
    references: [categories.id],
  }),
  groups: many(recommendationGroups),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export type College = typeof colleges.$inferSelect;
export type HelpPost = typeof helpPosts.$inferSelect;
export type HelpResponse = typeof helpResponses.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Ask = typeof asks.$inferSelect;
export type AskResponse = typeof askResponses.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
export type ClaimRequest = typeof claimRequests.$inferSelect;

export type User = typeof users.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type ListingMedia = typeof listingMedia.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
export type InquiryMessage = typeof inquiryMessages.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type FeaturedOrder = typeof featuredOrders.$inferSelect;
