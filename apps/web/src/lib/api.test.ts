import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

describe("client API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("n’envoie pas de content-type JSON lorsque la requête n’a pas de corps", async () => {
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      expect(new Headers(options.headers).has("content-type")).toBe(false);
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await api("/sync", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("conserve le content-type JSON lorsqu’un corps JSON est présent", async () => {
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      expect(new Headers(options.headers).get("content-type")).toBe("application/json");
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await api("/auth/login", { method: "POST", body: JSON.stringify({ username: "association" }) });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
