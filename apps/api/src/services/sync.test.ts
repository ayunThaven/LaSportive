import { describe, expect, it, vi } from "vitest";
import type { AppRepository, CampaignRecord, SourceEnrollment } from "../domain/types.js";
import { SyncService } from "./sync.js";

const campaign: CampaignRecord = { id: "campaign", title: "Adhésions", season: "2026", organizationSlug: "club", formSlug: "adhesions", active: true, archived: false, mappings: [] };
const enrollment: SourceEnrollment = { externalItemId: "item-present", externalOrderId: "order", campaignId: campaign.id, firstName: "Ana", lastName: "Martin", contactEmail: "ana@example.org", sourceData: {}, active: true };

describe("synchronisation complète", () => {
  it("masque les adhésions absentes de la réponse HelloAsso", async () => {
    const repository = {
      getActiveCampaign: vi.fn().mockResolvedValue(campaign),
      createSyncRun: vi.fn().mockResolvedValue("run"),
      upsertSourceEnrollment: vi.fn().mockResolvedValue("updated"),
      deactivateMissingEnrollments: vi.fn().mockResolvedValue(1),
      finishSyncRun: vi.fn(),
    } as unknown as AppRepository;
    const helloAsso = { getEnrollments: vi.fn().mockResolvedValue([enrollment]) };
    await new SyncService(repository, helloAsso as never).run();
    expect(repository.deactivateMissingEnrollments).toHaveBeenCalledWith(campaign.id, ["item-present"]);
  });
});
