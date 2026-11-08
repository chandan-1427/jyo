import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { toDateTimeInput } from "@/lib/format";
import { DIET_LABEL, DIETS, type Diet } from "@/lib/food";
import { cn } from "@/lib/utils";
import { Checkbox } from "../ui/Checkbox";
import { DateTimeField } from "../ui/DateTimeField";
import { TextField } from "../ui/TextField";

// The marks people in India already read on food packets: green for veg,
// brown for non-veg (FSSAI), and yellow, the usual convention, for egg.
// These three colours are the exception to the app's cool palette, because
// their meaning comes from the convention.
const MARK_COLOUR: Record<Diet, string> = { veg: "#3DBB6E", egg: "#E0B341", non_veg: "#C2703D" };

export function DietMark({ diet, className }: { diet: Diet; className?: string }) {
  const colour = MARK_COLOUR[diet];
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5 shrink-0", className)} aria-hidden="true">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke={colour} strokeWidth="1.6" />
      {diet === "non_veg" ? <path d="M8 4.2 L11.6 11 H4.4 Z" fill={colour} /> : <circle cx="8" cy="8" r="3.3" fill={colour} />}
    </svg>
  );
}

export type FoodDetailsValues = {
  diet: Diet;
  servings: number;
  cookedAt: string;
  bringContainer: boolean;
};

function useDayRange() {
  // Fixed when the form opens; the API re-checks both ends on submit.
  const [range] = useState(() => ({
    now: toDateTimeInput(new Date()),
    dayAgo: toDateTimeInput(new Date(Date.now() - 24 * 3_600_000)),
  }));
  return range;
}

export function DietField() {
  const { register, formState: { errors } } = useFormContext<FoodDetailsValues>();
  return (
    <fieldset aria-describedby={errors.diet ? "diet-error" : undefined}>
      <legend className="text-sm font-medium text-fg">Veg or non-veg?</legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {DIETS.map((diet) => (
          <label
            key={diet}
            className={cn(
              "flex h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-raised px-2 text-[13px] font-medium text-fg-muted ring-1 ring-inset ring-fg/[0.08] transition-colors sm:gap-2 sm:text-sm",
              "hover:text-fg has-[:checked]:bg-lifted has-[:checked]:text-fg has-[:checked]:ring-2 has-[:checked]:ring-leaf",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf"
            )}
          >
            <input type="radio" value={diet} className="peer sr-only" {...register("diet")} />
            <span
              aria-hidden="true"
              className="grid size-4 shrink-0 place-items-center rounded-full ring-[1.5px] ring-inset ring-fg/30 peer-checked:ring-leaf after:size-2 after:scale-0 after:rounded-full after:bg-leaf after:transition-transform after:duration-150 after:content-[''] peer-checked:after:scale-100 motion-reduce:after:transition-none"
            />
            {/* Room for the mark only from tablet width; cards show it everywhere. */}
            <DietMark diet={diet} className="hidden sm:block" />
            <span className="truncate">{DIET_LABEL[diet]}</span>
          </label>
        ))}
      </div>
      {errors.diet && (
        <p id="diet-error" className="mt-1.5 text-[13px] leading-snug text-danger">
          {errors.diet.message}
        </p>
      )}
    </fieldset>
  );
}

export function ServesField() {
  const { register, formState: { errors } } = useFormContext<FoodDetailsValues>();
  return (
    <TextField
      label="Serves"
      type="number"
      inputMode="numeric"
      min={1}
      max={50}
      placeholder="2"
      error={errors.servings?.message}
      {...register("servings", { valueAsNumber: true })}
    />
  );
}

export function CookedAtField() {
  const { control, formState: { errors } } = useFormContext<FoodDetailsValues>();
  const { now, dayAgo } = useDayRange();
  return (
    <Controller
      control={control}
      name="cookedAt"
      render={({ field }) => (
        <DateTimeField
          label="Cooked at"
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          min={dayAgo}
          max={now}
          error={errors.cookedAt?.message}
        />
      )}
    />
  );
}

// The food fields in one block, for the edit dialog, inside a FormProvider.
export function FoodDetailsFields() {
  return (
    <>
      <DietField />
      <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-5">
        <ServesField />
        <CookedAtField />
      </div>
    </>
  );
}

// Asked last on the form, just before it's sent.
export function ContainerCheckbox() {
  const { register } = useFormContext<FoodDetailsValues>();
  return <Checkbox {...register("bringContainer")} label="Ask them to bring their own container" />;
}
