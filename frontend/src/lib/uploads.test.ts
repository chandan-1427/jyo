import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useImageUpload } from "./uploads";
import { ApiError } from "./api/api";

const fetchMock = vi.fn<typeof fetch>();
let stored = 0;

beforeEach(() => {
  stored = 0;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => {
    stored += 1;
    return new Response(JSON.stringify({ url: `https://storage.test/photo-${stored}.webp` }), { status: 201 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

const photo = (name: string) => new File(["bytes"], name, { type: "image/jpeg" });

describe("useImageUpload", () => {
  it("sends the file to the bucket's upload address", async () => {
    const { result } = renderHook(() => useImageUpload("selfies"));
    await result.current(photo("me.jpg"));
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/requests/selfies");
  });

  // A submit that failed after its upload, then retried: the image is
  // already stored, so it isn't stored again.
  it("reuses the stored image when the same file is submitted again", async () => {
    const { result } = renderHook(() => useImageUpload("food-photos"));
    const file = photo("rice.jpg");

    const first = await result.current(file);
    const second = await result.current(file);

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uploads a different file", async () => {
    const { result } = renderHook(() => useImageUpload("food-photos"));
    const first = await result.current(photo("rice.jpg"));
    const second = await result.current(photo("dal.jpg"));

    expect(second).not.toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tries again after an upload that failed", async () => {
    const { result } = renderHook(() => useImageUpload("food-photos"));
    const file = photo("rice.jpg");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Too many photos" }), { status: 429 }));

    await expect(result.current(file)).rejects.toBeInstanceOf(ApiError);
    expect(await result.current(file)).toMatch(/^https:\/\/storage\.test\//);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
