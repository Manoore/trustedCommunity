import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ImportForm } from "@/components/import-form";
import { getCategoryOptions } from "@/lib/queries";
import { requireUser } from "@/lib/guards";

export const metadata: Metadata = { title: "Import contacts" };

export default async function ImportPage() {
  await requireUser("/import");
  const categoryGroups = await getCategoryOptions();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Import contacts"
        description="Bring in the people you already have saved, then tidy them up here."
      />
      <ImportForm categoryGroups={categoryGroups} />
    </div>
  );
}
