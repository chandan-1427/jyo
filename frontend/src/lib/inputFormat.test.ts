import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInputFormat, type InputFormat } from "./inputFormat";

function setup(format: InputFormat, maxLength?: number, value = "") {
  const field = document.createElement("input");
  document.body.append(field);
  field.value = value;
  field.setSelectionRange(value.length, value.length);
  renderHook(() => useInputFormat({ current: field }, format, maxLength));
  return field;
}

// Returns whether the browser would let the text in.
function insert(field: HTMLInputElement, data: string, inputType = "insertText") {
  const event = new InputEvent("beforeinput", { data, inputType, cancelable: true, bubbles: true });
  return field.dispatchEvent(event);
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useInputFormat", () => {
  it("refuses a letter typed into a number field", () => {
    const field = setup("digits", 2, "1");
    expect(insert(field, "a")).toBe(false);
    expect(field.value).toBe("1");
  });

  it("lets a digit through, up to the length limit", () => {
    const field = setup("digits", 2, "5");
    expect(insert(field, "0")).toBe(true);
    field.value = "50";
    field.setSelectionRange(2, 2);
    expect(insert(field, "1")).toBe(false);
    expect(field.value).toBe("50");
  });

  it("keeps only the digits of a paste", () => {
    const field = setup("digits", 3);
    insert(field, "about 15 min", "insertFromPaste");
    expect(field.value).toBe("15");
  });

  it("turns a pasted +91 number into the 10 digits", () => {
    const field = setup("phone", 10);
    insert(field, "+91 98765 43210", "insertFromPaste");
    expect(field.value).toBe("9876543210");
  });

  it("drops a leading 0 from a pasted number", () => {
    const field = setup("phone", 10);
    insert(field, "098765 43210", "insertFromPaste");
    expect(field.value).toBe("9876543210");
  });

  it("cleans up a value that arrived without a beforeinput, like autofill", () => {
    const field = setup("phone", 10);
    field.value = "+91 98765-43210";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    expect(field.value).toBe("9876543210");
  });

  it("refuses a space in an email address", () => {
    const field = setup("email", undefined, "a");
    expect(insert(field, " ")).toBe(false);
    insert(field, " me@example.com ", "insertFromPaste");
    expect(field.value).toBe("ame@example.com");
  });
});
