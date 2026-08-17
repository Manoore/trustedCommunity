"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { idleState, type ActionState } from "@/lib/validation";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function AuthForm({ mode, action }: { mode: "login" | "signup"; action: Action }) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const isSignup = mode === "signup";

  return (
    <Card className="warm-wash mx-auto w-full max-w-md p-7">
      <span
        aria-hidden="true"
        className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl text-white shadow-sm"
      >
        ♥
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">
        {isSignup ? "Start your list" : "Welcome back"}
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {isSignup
          ? "Free, and your list stays private until you decide to share it."
          : "Pick up where you left off."}
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />

        {state.message && <Alert tone="error">{state.message}</Alert>}

        {isSignup && (
          <Field label="Full name" htmlFor="name" errors={state.fieldErrors?.name} required>
            <Input id="name" name="name" autoComplete="name" required />
          </Field>
        )}

        <Field label="Email" htmlFor="email" errors={state.fieldErrors?.email} required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          errors={state.fieldErrors?.password}
          hint={isSignup ? "At least 10 characters, with a letter and a number." : undefined}
          required
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Working…" : isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-sm text-ink-muted">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-brand-600 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </Card>
  );
}
