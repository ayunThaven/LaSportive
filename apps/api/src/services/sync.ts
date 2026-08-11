import type { AppRepository } from "../domain/types.js";
import { HelloAssoClient } from "../integrations/helloasso.js";

export class SyncService {
  private running = false;
  constructor(private repository: AppRepository, private helloAsso = new HelloAssoClient(repository)) {}

  async run() {
    if (this.running) throw new Error("Une synchronisation est déjà en cours.");
    const campaign = await this.repository.getActiveCampaign();
    if (!campaign) throw new Error("Aucune campagne active n’est configurée.");
    this.running = true;
    const runId = await this.repository.createSyncRun(campaign.id);
    let imported = 0;
    let updated = 0;
    try {
      const enrollments = await this.helloAsso.getEnrollments(campaign);
      for (const enrollment of enrollments) {
        const result = await this.repository.upsertSourceEnrollment(enrollment);
        result === "imported" ? imported += 1 : updated += 1;
      }
      await this.repository.deactivateMissingEnrollments(campaign.id, enrollments.map((enrollment) => enrollment.externalItemId));
      await this.repository.finishSyncRun(runId, { status: "SUCCESS", imported, updated });
      return { imported, updated };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de synchronisation inconnue";
      await this.repository.finishSyncRun(runId, { status: "FAILED", imported, updated, error: message });
      throw error;
    } finally {
      this.running = false;
    }
  }
}
