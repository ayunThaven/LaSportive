import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL est obligatoire pour initialiser la base.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const organizationSlug = process.env.HELLOASSO_ORGANIZATION_SLUG || "la-sportive";
const formSlug = process.env.HELLOASSO_CAMPAIGN_SLUG || "adhesions-2026-2027";

await prisma.campaign.updateMany({ data: { active: false, archived: true } });

const campaign = await prisma.campaign.upsert({
  where: { organizationSlug_formSlug: { organizationSlug, formSlug } },
  create: {
    title: `Campagne ${formSlug}`,
    season: "Saison de test",
    organizationSlug,
    formSlug,
    active: true,
  },
  update: { active: true, archived: false },
});

await prisma.fieldMapping.createMany({
  skipDuplicates: true,
  data: [
    { campaignId: campaign.id, sourceKey: "firstName", label: "Prénom", kind: "LICENCE", required: true, position: 1 },
    { campaignId: campaign.id, sourceKey: "lastName", label: "Nom", kind: "LICENCE", required: true, position: 2 },
    { campaignId: campaign.id, sourceKey: "Date de naissance", label: "Date de naissance", kind: "LICENCE", required: true, position: 3 },
    { campaignId: campaign.id, sourceKey: "contactEmail", label: "E-mail de contact", kind: "LICENCE", required: true, position: 4 },
    { campaignId: campaign.id, sourceKey: "Adresse postale complète", label: "Adresse", kind: "LICENCE", required: true, position: 5 },
    { campaignId: campaign.id, sourceKey: "Attestation de santé complétée ou, si une réponse « Oui » est cochée au questionnaire de santé, certificat médical établi par un médecin.", label: "Attestation de santé / certificat médical", kind: "DOCUMENT", required: true, position: 6 },
    { campaignId: campaign.id, sourceKey: "discountType", label: "Type d’aide", kind: "REDUCTION_TYPE", required: false, position: 7 },
    { campaignId: campaign.id, sourceKey: "discountCode", label: "Code de réduction", kind: "REDUCTION_CODE", required: false, position: 8 },
  ],
});

await prisma.appSetting.upsert({
  where: { id: "singleton" },
  create: {
    emailTemplate: "Bonjour {{prenom}},\n\nNous avons vérifié votre inscription. Merci de répondre à ce message avec les corrections suivantes :\n\n{{anomalies}}\n\nBien sportivement,\nLa Sportive",
  },
  update: {},
});

await prisma.$disconnect();
