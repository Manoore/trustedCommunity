import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ProviderForm } from "@/components/provider-form";
import { updateProviderAction } from "@/app/actions/providers";
import { requireProvider } from "@/lib/guards";

export const metadata: Metadata = { title: "Provider profile" };

export default async function ProviderProfilePage() {
  const { provider } = await requireProvider("/dashboard/profile");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Provider profile"
        description="Shown on every listing you post. Contact details stay masked until you reply to an inquiry."
      />
      <ProviderForm
        action={updateProviderAction}
        submitLabel="Save profile"
        defaults={{
          id: provider.id,
          type: provider.type,
          displayName: provider.displayName,
          legalName: provider.legalName,
          headline: provider.headline,
          bio: provider.bio,
          contactEmail: provider.contactEmail,
          contactPhone: provider.contactPhone,
          websiteUrl: provider.websiteUrl,
          zip: provider.zip,
          yearsExperience: provider.yearsExperience,
        }}
      />
    </div>
  );
}
