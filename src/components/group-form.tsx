"use client";


import { createGroupAction } from "@/app/actions/groups";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { idleState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

const KINDS = [
  { value: "neighborhood", label: "Neighbourhood or street" },
  { value: "temple", label: "Temple" },
  { value: "church", label: "Church" },
  { value: "school", label: "School or parent group" },
  { value: "social", label: "Social circle" },
  { value: "workplace", label: "Workplace" },
  { value: "other", label: "Something else" },
];

export function GroupForm() {
  const [state, formProps, pending] = useFormAction(createGroupAction, idleState);

  return (
    <form {...formProps} className="space-y-4">
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field label="Group name" htmlFor="name" errors={state.fieldErrors?.name} required>
        <Input id="name" name="name" placeholder="Maple Street neighbours" required />
      </Field>

      <Field label="What kind of group?" htmlFor="kind" required>
        <Select id="kind" name="kind" defaultValue="neighborhood">
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        errors={state.fieldErrors?.description}
      >
        <Textarea id="description" name="description" rows={3} />
      </Field>

      <Field
        label="ZIP code"
        htmlFor="zip"
        hint="Optional. Helps members see it is their local group."
        errors={state.fieldErrors?.zip}
      >
        <Input id="zip" name="zip" inputMode="numeric" maxLength={5} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create group"}
      </Button>
    </form>
  );
}
