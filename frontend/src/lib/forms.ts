import { useForm, type DefaultValues, type FieldValues, type Path, type UseFormSetError } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ApiError } from "@/lib/api/api";

// Every form in the app validates the same way:
// - a field is checked when you leave it, then re-checked as you type, so an
//   error disappears the moment it's fixed ("onTouched")
// - on submit, all fields are checked and focus jumps to the first bad one
// The <form> must also set noValidate, so the browser's own "Please fill out
// this field" bubbles never show — every error comes from the Zod schema.
export function useZodForm<Input extends FieldValues, Output extends FieldValues>(
  schema: z.ZodType<Output, Input>,
  defaultValues?: DefaultValues<Input>
) {
  return useForm<Input, unknown, Output>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues,
  });
}

// The API returns per-field errors as `details` ({ field: [messages] }) when
// its own schema rejects a request. Show them under the matching fields, and
// report whether any matched so the caller can skip the generic message.
export function applyServerFieldErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  known: readonly Path<T>[]
): boolean {
  if (!(err instanceof ApiError) || !err.details) return false;
  let matched = false;
  for (const [field, messages] of Object.entries(err.details)) {
    if (messages?.[0] && (known as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: "server", message: messages[0] });
      matched = true;
    }
  }
  return matched;
}
