"use client";

import { useActionState } from "react";
import { startFeatureCheckoutAction } from "@/app/actions/billing";
import { Alert, Button } from "@/components/ui";
import { idleState } from "@/lib/validation";

export function FeatureCheckoutButton({ listingId }: { listingId: string }) {
  const [state, formAction, pending] = useActionState(
    startFeatureCheckoutAction,
    idleState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Redirecting…" : "Continue to checkout"}
      </Button>
    </form>
  );
}
