import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Alert, Card, PageHeader } from "@/components/ui";
import { PhoneVerifyForm } from "@/components/phone-verify-form";
import { requireUser } from "@/lib/guards";
import { formatPhone } from "@/lib/phone";
import { safeNext } from "@/lib/phone-verify";

export const metadata: Metadata = { title: "Verify your number" };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function VerifyPhonePage({ searchParams }: Props) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const user = await requireUser(`/verify/phone?next=${encodeURIComponent(next)}`);

  const [row] = await db
    .select({ phone: users.verifiedPhone })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Verify your number"
        description="We send a 6-digit code on WhatsApp. It proves the number is yours, so the people you recommend, and who recommend you, are real."
      />

      {row?.phone && (
        <Alert tone="success">
          Verified: {formatPhone(row.phone)}. You can verify a different number below.
        </Alert>
      )}

      <Card className="mt-4">
        <PhoneVerifyForm next={next} />
      </Card>

      <p className="mt-4 text-xs text-ink-muted">
        We use your number only to check you are a real person. It is not shown to other
        members, and we do not message you on it for anything else.
      </p>
    </div>
  );
}
