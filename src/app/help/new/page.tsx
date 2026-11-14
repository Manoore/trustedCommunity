import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { HelpPostForm } from "@/components/help-post-form";
import { getCurrentUser } from "@/lib/auth";
import { getUserCollegeState } from "@/lib/colleges";
import type { HelpKind } from "@/lib/help";

export const metadata: Metadata = { title: "New post" };

type Props = { searchParams: Promise<{ direction?: string; kind?: string }> };

const KINDS: HelpKind[] = ["pickup", "temp_stay", "room", "item"];

export default async function NewHelpPostPage({ searchParams }: Props) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/help/new");

  const state = await getUserCollegeState(user.id);
  if (!state.college || !state.verified) redirect("/arrive");

  const direction = sp.direction === "offer" ? "offer" : "need";
  const kind = KINDS.includes(sp.kind as HelpKind) ? (sp.kind as HelpKind) : "pickup";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={direction === "offer" ? "Offer your help" : "Ask for help"}
        description={`Only verified ${state.college.name} students will see this.`}
      />
      <HelpPostForm
        defaultDirection={direction}
        defaultKind={kind}
        airport={state.college.airport?.split(" (")[0]}
      />
    </div>
  );
}
