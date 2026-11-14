import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email.");

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "That password is too long.")
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
    message: "Include at least one letter and one number.",
  });

export const zipSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "Enter a 5-digit US ZIP code.");

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[\d\s().+-]{7,20}$/, "Enter a valid phone number.");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const providerOnboardingSchema = z
  .object({
    type: z.enum(["individual", "entity"]),
    displayName: z.string().trim().min(2, "Enter a name buyers will recognize.").max(120),
    legalName: z.string().trim().max(160).optional().or(z.literal("")),
    headline: z.string().trim().max(160).optional().or(z.literal("")),
    bio: z.string().trim().min(40, "Write at least a couple of sentences.").max(4000),
    contactEmail: emailSchema,
    contactPhone: phoneSchema.optional().or(z.literal("")),
    websiteUrl: z.string().trim().url("Enter a full URL.").optional().or(z.literal("")),
    zip: zipSchema,
    yearsExperience: z.coerce.number().int().min(0).max(80).optional(),
  })
  .superRefine((val, ctx) => {
    // An entity is a legal person; we need the registered name on file for it.
    if (val.type === "entity" && !val.legalName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["legalName"],
        message: "Registered legal name is required for a business account.",
      });
    }
  });

export const listingSchema = z
  .object({
    categoryId: z.string().uuid("Pick a category."),
    title: z.string().trim().min(6, "Give the listing a clear title.").max(140),
    description: z
      .string()
      .trim()
      .min(80, "Describe the work in at least a few sentences.")
      .max(8000),
    priceType: z.enum(["hourly", "fixed", "starting_at", "quote"]),
    priceMin: z.string().trim().optional().or(z.literal("")),
    priceMax: z.string().trim().optional().or(z.literal("")),
    remoteOk: z.coerce.boolean().optional(),
    zip: z.string().trim().optional().or(z.literal("")),
    serviceRadiusMiles: z.coerce.number().int().min(1).max(3000).default(25),
    licenseNumber: z.string().trim().max(60).optional().or(z.literal("")),
    licenseState: z.string().trim().length(2).optional().or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    if (!val.remoteOk && !/^\d{5}$/.test(val.zip ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["zip"],
        message: "On-site work needs a 5-digit ZIP so buyers can find you.",
      });
    }
    if (val.priceType !== "quote" && !val.priceMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceMin"],
        message: "Enter a price, or switch to 'Request a quote'.",
      });
    }
  });

export const inquirySchema = z.object({
  listingId: z.string().uuid(),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  zip: zipSchema.optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(20, "Tell the provider what you need - at least a sentence.")
    .max(4000),
});

export const messageSchema = z.object({
  inquiryId: z.string().uuid(),
  body: z.string().trim().min(1, "Write a message.").max(4000),
});

export const reviewSchema = z.object({
  inquiryId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  body: z.string().trim().min(20, "Say a little about the work.").max(4000),
});

export const reportSchema = z.object({
  targetType: z.enum(["listing", "review", "provider", "message", "help_post"]),
  targetId: z.string().uuid(),
  reason: z.enum([
    "spam",
    "scam-or-fraud",
    "wrong-category",
    "offensive",
    "unlicensed-work",
    "impersonation",
    "unsafe",
    "asked-for-money",
    "other",
  ]),
  details: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const teamInviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["manager", "staff"]),
});

/* -------------------------------------------------- recommendation layer */

export const relationshipValues = [
  "used_personally",
  "worked_with",
  "know_personally",
  "trusted_referral",
  "know_of",
] as const;

export const strengthValues = ["recommend", "highly_recommend", "go_to"] as const;

export const visibilityValues = ["private", "connections", "groups", "link"] as const;

export const RELATIONSHIP_LABELS: Record<(typeof relationshipValues)[number], string> = {
  used_personally: "I used them personally",
  worked_with: "I worked with them",
  know_personally: "I know them personally",
  trusted_referral: "Someone I trust recommended them",
  know_of: "I know of them",
};

export const STRENGTH_LABELS: Record<(typeof strengthValues)[number], string> = {
  recommend: "Recommend",
  highly_recommend: "Highly recommend",
  go_to: "My go-to",
};

export const VISIBILITY_LABELS: Record<(typeof visibilityValues)[number], string> = {
  private: "Just me",
  connections: "People I'm connected to",
  groups: "Groups I'm in",
  link: "Anyone with the link",
};

export const recommendationSchema = z.object({
  name: z.string().trim().min(2, "Who are you recommending?").max(140),
  // The identity key. Validated properly in the action via libphonenumber.
  phone: z.string().trim().min(7, "A phone number is how we avoid duplicates."),
  kind: z.enum(["business", "individual"]),
  categoryId: z.string().uuid("Pick a category."),
  zip: z.string().trim().optional().or(z.literal("")),
  /** ISO country of the contact. US unless they are somewhere else. */
  country: z.string().trim().max(2).optional().or(z.literal("")),
  /** Free-text city, used instead of a ZIP outside the US. */
  city: z.string().trim().max(80).optional().or(z.literal("")),
  websiteUrl: z.string().trim().url("Enter a full URL.").optional().or(z.literal("")),
  relationship: z.enum(relationshipValues),
  strength: z.enum(strengthValues),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  visibility: z.enum(visibilityValues),
});

export const claimRequestSchema = z
  .object({
    providerId: z.string().uuid(),
    kind: z.enum(["claim", "removal"]),
    contactEmail: emailSchema.optional().or(z.literal("")),
    contactPhone: z.string().trim().max(40).optional().or(z.literal("")),
    message: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    if (!val.contactEmail && !val.contactPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contactEmail"],
        message: "Leave an email or phone so we can confirm it is you.",
      });
    }
  });

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const idleState: ActionState = { ok: false };

/** Flattens a ZodError into the shape our forms render. */
export function zodToState(error: z.ZodError): ActionState {
  const flat = error.flatten();
  return {
    ok: false,
    message: flat.formErrors[0],
    fieldErrors: flat.fieldErrors as Record<string, string[]>,
  };
}
