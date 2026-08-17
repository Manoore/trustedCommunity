import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ListingForm } from "@/components/listing-form";
import { createListingAction } from "@/app/actions/listings";
import { getCategoryOptions } from "@/lib/queries";
import { requireProvider } from "@/lib/guards";

export const metadata: Metadata = { title: "New listing" };

export default async function NewListingPage() {
  const { provider } = await requireProvider("/dashboard/listings/new");
  const groups = await getCategoryOptions();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New listing"
        description="One service, one category. Buyers search by category and distance, so pick the narrowest one that fits."
      />
      <ListingForm
        action={createListingAction}
        groups={groups}
        providerId={provider.id}
        defaults={{ zip: provider.zip }}
        submitLabel="Publish listing"
      />
    </div>
  );
}
