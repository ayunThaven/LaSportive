import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Mailer", () => {
  it("envoie les relances avec l’API HTTPS de Brevo", async () => {
    vi.stubEnv("BREVO_API_KEY", "brevo-test-key");
    vi.stubEnv("EMAIL_FROM", "La Sportive <contact@lasportive.test>");
    vi.stubEnv("EMAIL_REPLY_TO", "contact@lasportive.test");
    vi.stubEnv("DEMO_MODE", "false");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "message-1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const { Mailer } = await import("./mailer.js");
    await new Mailer().send({ to: "adhérent@example.org", subject: "Dossier à compléter", text: "Bonjour" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(options.headers).toMatchObject({ "api-key": "brevo-test-key", "content-type": "application/json" });
    expect(JSON.parse(options.body as string)).toMatchObject({
      sender: { name: "La Sportive", email: "contact@lasportive.test" },
      replyTo: { email: "contact@lasportive.test" },
      to: [{ email: "adhérent@example.org" }],
      subject: "Dossier à compléter",
      textContent: "Bonjour",
    });
  });
});
