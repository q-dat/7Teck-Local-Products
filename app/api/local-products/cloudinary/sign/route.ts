import { createCloudinaryUploadSignature } from "@/lib/cloudinary";
import { apiError, jsonNoStore } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    return jsonNoStore({ ok: true, ...createCloudinaryUploadSignature() });
  } catch (error) {
    return apiError(error, 500);
  }
}
