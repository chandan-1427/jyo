import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProvider } from "react-hook-form";
import { z } from "zod";
import { fields } from "@/lib/validation";
import { useZodForm } from "@/lib/forms";
import { ContainerCheckbox, FoodDetailsFields, type FoodDetailsValues } from "./FoodDetails";

const schema = z.object({
  diet: fields.diet,
  servings: fields.servings,
  cookedAt: z.string().min(1, "Choose when it was cooked"),
  bringContainer: z.boolean(),
});

const onSubmit = vi.fn<(values: FoodDetailsValues) => void>();

function Harness() {
  const form = useZodForm(schema, { cookedAt: "2026-11-08T10:00", bringContainer: false });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FoodDetailsFields />
        <ContainerCheckbox />
        <button type="submit">Post</button>
      </form>
    </FormProvider>
  );
}

afterEach(() => {
  cleanup();
  onSubmit.mockReset();
});

describe("FoodDetailsFields", () => {
  it("asks for veg or not and how many it serves before it can be submitted", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    expect(await screen.findByText("Choose veg, egg or non-veg")).toBeTruthy();
    expect(screen.getByText("Enter how many people it serves")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("offers the three choices as radio buttons and submits what was picked", async () => {
    render(<Harness />);
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["veg", "egg", "non_veg"]);

    fireEvent.click(screen.getByLabelText("Egg"));
    fireEvent.change(screen.getByLabelText("Serves"), { target: { value: "3" } });
    fireEvent.click(screen.getByLabelText("Ask them to bring their own container"));
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ diet: "egg", servings: 3, bringContainer: true });
  });
});
