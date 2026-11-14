"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useTransition,
  type FormEvent,
} from "react";

type Result = { ok?: boolean };

/**
 * `useActionState` for forms, minus the part that wipes what the user typed.
 *
 * React 19 resets a form after its `action` runs, successful or not, so a
 * server-side error ("note too long") clears every field. Here the submit is
 * intercepted and the action dispatched by hand, which leaves the fields alone.
 * The form is cleared only when the action reports `ok`, for forms that stay
 * on the page after a success (a chat box, an invite field).
 *
 * `action` stays on the returned props, so the form still submits with
 * JavaScript off or before hydration; only the enhanced path differs.
 *
 * Usage: `const [state, form, pending] = useFormAction(myAction, idleState);`
 * then `<form {...form}>`.
 */
export function useFormAction<S extends Result>(
  action: (prev: S, formData: FormData) => Promise<S>,
  initialState: S,
  options: { resetOnSuccess?: boolean } = {},
) {
  const { resetOnSuccess = true } = options;
  // React's own typings wrap the state in Awaited<>, which TypeScript cannot
  // see through for a generic S. S is always a plain object here.
  const [state, dispatch, actionPending] = (
    useActionState as unknown as (
      action: (prev: S, formData: FormData) => Promise<S>,
      initialState: S,
    ) => [S, (payload: FormData) => void, boolean]
  )(action, initialState);
  const [transitionPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (resetOnSuccess && state.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | HTMLInputElement
      | null;
    event.preventDefault();
    formRef.current = form;
    // Passing the submitter keeps a clicked button's own name/value in the data.
    const data = new FormData(form, submitter);
    startTransition(() => dispatch(data));
  }

  return [
    state,
    { action: dispatch, onSubmit },
    actionPending || transitionPending,
  ] as const;
}
