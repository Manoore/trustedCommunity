import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ImportForm } from "@/components/import-form";
import { getCategoryOptions } from "@/lib/queries";
import { requireUser } from "@/lib/guards";

export const metadata: Metadata = { title: "Import contacts" };

type Props = {
  searchParams: Promise<{ title?: string; text?: string; url?: string }>;
};

/**
 * Doubles as the phone's share target: sharing a contact (or a message with a
 * number in it) from WhatsApp to the installed app lands here with the text
 * already filled in.
 */
export default async function ImportPage({ searchParams }: Props) {
  const sp = await searchParams;
  await requireUser("/import");
  const categoryGroups = await getCategoryOptions();

  const shared = [sp.title, sp.text]
    .filter((s): s is string => Boolean(s?.trim()))
    .join("\n")
    .slice(0, 5000);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Import contacts"
        description={
          shared
            ? "Here is what you shared. Check it, then bring it in."
            : "Bring in the people you already have saved, then tidy them up here."
        }
      />
      <ImportForm categoryGroups={categoryGroups} initialText={shared} />
    </div>
  );
}
