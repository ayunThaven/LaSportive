import { extname } from "node:path";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { config } from "../config.js";
import type { AppRepository } from "../domain/types.js";

export const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
export const maxDocumentSize = 10 * 1024 * 1024;

export function validateDocument(mimeType: string, size: number) {
  if (!allowedMimeTypes.has(mimeType)) throw new Error("Seuls les fichiers PDF, JPEG et PNG sont autorisés.");
  if (size > maxDocumentSize) throw new Error("Le fichier dépasse la taille maximale de 10 Mo.");
}

function safeDriveName(value: string, fallback: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || fallback;
}

export function correctionFileName(fieldLabel: string, uploadedName: string) {
  return `${safeDriveName(fieldLabel, "Correction")}${extname(uploadedName)}`;
}

export class DriveStorage {
  constructor(private repository: AppRepository) {}

  async upload(input: { name: string; mimeType: string; buffer: Buffer; memberName: string; campaignName: string; fieldLabel: string }) {
    validateDocument(input.mimeType, input.buffer.byteLength);
    const fileName = correctionFileName(input.fieldLabel, input.name);
    if (config.DEMO_MODE) {
      const id = `demo-${Date.now()}`;
      return { driveFileId: id, driveUrl: `https://drive.google.com/file/d/${id}/view`, name: fileName };
    }
    const connection = await this.repository.getGoogleDriveConnection();
    if (!connection.refreshToken || !connection.folderId || !config.GOOGLE_OAUTH_CLIENT_ID || !config.GOOGLE_OAUTH_CLIENT_SECRET) throw new Error("La connexion Google Drive n’est pas configurée.");
    const auth = new google.auth.OAuth2(config.GOOGLE_OAUTH_CLIENT_ID, config.GOOGLE_OAUTH_CLIENT_SECRET, config.GOOGLE_OAUTH_REDIRECT_URL);
    auth.setCredentials({ refresh_token: connection.refreshToken });
    const drive = google.drive({ version: "v3", auth });

    const findOrCreateFolder = async (parentId: string, name: string) => {
      const queryName = name.replace(/'/g, "\\'");
      const found = await drive.files.list({ q: `'${parentId}' in parents and name = '${queryName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`, fields: "files(id)", pageSize: 1 });
      return found.data.files?.[0]?.id ?? (await drive.files.create({ requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }, fields: "id" })).data.id;
    };

    const campaignFolderId = await findOrCreateFolder(connection.folderId, safeDriveName(input.campaignName, "Campagne"));
    if (!campaignFolderId) throw new Error("Google Drive n’a pas créé le dossier de la campagne.");
    const memberFolderId = await findOrCreateFolder(campaignFolderId, safeDriveName(input.memberName, "Adhérent"));
    if (!memberFolderId) throw new Error("Google Drive n’a pas créé le dossier de l’adhérent.");

    const response = await drive.files.create({
      requestBody: { name: fileName, parents: [memberFolderId], description: `Correction ${input.campaignName}` },
      media: { mimeType: input.mimeType, body: Readable.from(input.buffer) }, fields: "id,webViewLink",
    });
    if (!response.data.id) throw new Error("Google Drive n’a pas retourné d’identifiant de fichier.");
    return { driveFileId: response.data.id, driveUrl: response.data.webViewLink ?? `https://drive.google.com/file/d/${response.data.id}/view`, name: fileName };
  }
}
