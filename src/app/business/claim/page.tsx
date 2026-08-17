import type { Metadata } from "next";
import { Alert, PageHeader } from "@/components/ui";
import { ClaimBusinessForm } from "@/components/claim-business-form";
import { requireUser } from "@/lib/guards";

export const metadata: Metadata = { title: "List your business" };

export default async function ClaimBusinessPage() {
  const user = await requireUser("/business/claim");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="List your business"
        description="Get a profile here even before anyone has recommended you, so you have somewhere to send happy customers."
      />

      <Alert tone="info">
        This is not the same as being recommended. Your profile starts with zero
        recommendations and is clearly marked &ldquo;self-listed&rdquo; until a real
        customer vouches for you — that distinction is the whole point of this site.
      </Alert>

      <ClaimBusinessForm defaultEmail={user.email} />
    </div>
  );
}
