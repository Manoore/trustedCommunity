"use client";


import { startFeatureCheckoutAction } from "@/app/actions/billing";
import { Alert, Button } from "@/components/ui";
import { idleState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

export function FeatureCheckoutButton({ listingId }: { listingId: string }) {
  const [state, formProps, pending] = useFormAction(
    startFeatureCheckoutAction,
    idleState,
  );

  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Redirecting…" : "Continue to checkout"}
      </Button>
    </form>
  );
}
