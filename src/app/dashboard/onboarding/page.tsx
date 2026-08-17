import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ProviderForm } from "@/components/provider-form";
import { createProviderAction } from "@/app/actions/providers";
import { getCurrentUser, getMemberships } from "@/lib/auth";

export const metadata: Metadata = { title: "List your service" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/onboarding");

  const memberships = await getMemberships(user.id);
  if (memberships.length) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Set up your provider account"
        description="Takes a couple of minutes. You can post your first listing straight after."
      />
      <ProviderForm
        action={createProviderAction}
        defaults={{ contactEmail: user.email, displayName: user.name }}
        submitLabel="Create account and continue"
      />
    </div>
  );
}
