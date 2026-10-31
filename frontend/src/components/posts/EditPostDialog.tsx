import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller } from "react-hook-form";
import { ImagePlus } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { useImageUpload } from "@/lib/uploads";
import { editPostSchema, MAX_PICKUP_DAYS_AHEAD } from "@/lib/validation";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { toDateTimeInput } from "@/lib/format";
import type { FoodPost } from "@/types/api";
import { Dialog } from "../ui/Dialog";
import { TextAreaField, TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { PhotoField } from "../ui/PhotoField";
import { DateTimeField } from "../ui/DateTimeField";

type EditValues = {
  title: string;
  description: string;
  photo?: File;
  pickupWindowStart: string;
  pickupWindowEnd: string;
};

// Edits a post that nobody has asked for yet (the page only offers it then,
// and the API refuses otherwise). The pickup spot isn't editable.
export function EditPostDialog({ post, onClose }: { post: FoodPost; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { register, control, handleSubmit, setValue, setError, watch, formState: { errors, isDirty } } = useZodForm(editPostSchema, {
    title: post.title,
    description: post.description ?? "",
    pickupWindowStart: toDateTimeInput(post.pickupWindowStart),
    pickupWindowEnd: toDateTimeInput(post.pickupWindowEnd),
  });
  const uploadPhoto = useImageUpload("food-photos");
  const save = useMutation({
    mutationFn: async (values: EditValues) => {
      const photoUrl = values.photo ? await uploadPhoto(values.photo) : undefined;
      return apiFetch(`/posts/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          photoUrl,
          pickupWindowStart: new Date(values.pickupWindowStart).toISOString(),
          pickupWindowEnd: new Date(values.pickupWindowEnd).toISOString(),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      onClose();
    },
    onError: (err) => {
      applyServerFieldErrors(err, setError, ["title", "description", "pickupWindowEnd"]);
    },
  });

  const fieldLevel = Object.values(errors).some((e) => e?.type === "server");
  const error = !fieldLevel ? save.error?.message ?? "" : "";

  const onSubmit = handleSubmit((values) => save.mutate(values));

  // All "YYYY-MM-DDTHH:mm", so they compare correctly as strings. Nothing in
  // the past, nothing more than a week out, and the end no earlier than the start.
  const start = watch("pickupWindowStart");
  const now = toDateTimeInput(new Date());
  // Fixed when the dialog opens.
  const [latest] = useState(() => toDateTimeInput(new Date(Date.now() + MAX_PICKUP_DAYS_AHEAD * 86_400_000)));

  return (
    <Dialog title="Edit post" size="lg" onClose={onClose}>
      {error && <Notice tone="error" className="mb-5">{error}</Notice>}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {/* The current photo stays unless a new one is chosen. */}
        <PhotoField
          emptyText="Add a photo"
          chosenText="Change photo"
          hint="Leave it to keep the current one."
          currentUrl={post.photoUrl}
          icon={<ImagePlus aria-hidden="true" />}
          onSelect={(file) => setValue("photo", file, { shouldValidate: true, shouldDirty: true })}
        />

        <TextField label="Title" error={errors.title?.message} {...register("title")} />

        <TextAreaField label="Description" rows={4} error={errors.description?.message} {...register("description")} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            control={control}
            name="pickupWindowStart"
            render={({ field }) => (
              <DateTimeField
                label="Pickup starts"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                min={now}
                max={latest}
                error={errors.pickupWindowStart?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="pickupWindowEnd"
            render={({ field }) => (
              <DateTimeField
                label="Pickup ends"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                min={start > now ? start : now}
                max={latest}
                error={errors.pickupWindowEnd?.message}
              />
            )}
          />
        </div>

        <p className="text-sm text-fg-subtle">The pickup spot can't be changed. To move it, delete this post and post again.</p>

        <Button type="submit" size="lg" fullWidth loading={save.isPending} disabled={!isDirty}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Dialog>
  );
}
