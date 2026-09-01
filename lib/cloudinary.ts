import { v2 as cloudinary } from "cloudinary";

const getCloudinaryConfig = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Thiếu CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY hoặc CLOUDINARY_API_SECRET",
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
  return { cloudName, apiKey, apiSecret };
};

export const getCloudinaryFolder = (): string => {
  const folder =
    process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || "local-products";
  return folder.replace(/^\/+|\/+$/gu, "");
};

export const createCloudinaryUploadSignature = () => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = getCloudinaryFolder();
  const uploadParams = {
    folder,
    overwrite: false,
    timestamp,
    unique_filename: true,
    use_filename: false,
  } as const;

  return {
    cloudName,
    apiKey,
    timestamp,
    folder,
    overwrite: false,
    uniqueFilename: true,
    useFilename: false,
    signature: cloudinary.utils.api_sign_request(uploadParams, apiSecret),
  };
};

export const isManagedCloudinaryPublicId = (publicId: string): boolean => {
  const folder = getCloudinaryFolder();
  const normalizedPublicId = publicId.trim().replace(/^\/+|\/+$/gu, "");
  return normalizedPublicId.startsWith(`${folder}/`);
};

type CloudinaryDeletedImage = {
  publicId: string;
  result: string;
};

type CloudinaryFailedImage = {
  publicId: string;
  message: string;
};

type CloudinaryCleanupResult = {
  deleted: CloudinaryDeletedImage[];
  failed: CloudinaryFailedImage[];
};

const CLOUDINARY_DELETE_BATCH_SIZE = 100;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Cloudinary không trả về thông tin lỗi";
};

const getAdminDeletionStatus = (payload: unknown, publicId: string): string => {
  if (!payload || typeof payload !== "object") return "";

  const deleted = (payload as Record<string, unknown>).deleted;
  if (!deleted || typeof deleted !== "object") return "";

  const status = (deleted as Record<string, unknown>)[publicId];
  return typeof status === "string" ? status.toLowerCase() : "";
};

const destroyWithUploadApi = async (
  publicId: string,
): Promise<CloudinaryDeletedImage> => {
  const response = await cloudinary.uploader.destroy(publicId, {
    invalidate: true,
    resource_type: "image",
    type: "upload",
  });
  const status = String(response.result ?? "unknown").toLowerCase();

  if (status !== "ok" && status !== "not found" && status !== "not_found") {
    throw new Error(`Cloudinary trả về trạng thái ${status}`);
  }

  return { publicId, result: status };
};

const destroyCloudinaryBatch = async (
  publicIds: string[],
): Promise<CloudinaryCleanupResult> => {
  let adminResponse: unknown;

  try {
    adminResponse = await cloudinary.api.delete_resources(publicIds, {
      invalidate: true,
      resource_type: "image",
      type: "upload",
    });
  } catch {
    adminResponse = null;
  }

  const deleted: CloudinaryDeletedImage[] = [];
  const fallbackPublicIds: string[] = [];

  publicIds.forEach((publicId) => {
    const status = getAdminDeletionStatus(adminResponse, publicId);

    if (
      status === "deleted" ||
      status === "not_found" ||
      status === "not found"
    ) {
      deleted.push({ publicId, result: status });
      return;
    }

    fallbackPublicIds.push(publicId);
  });

  const fallbackResults = await Promise.allSettled(
    fallbackPublicIds.map(destroyWithUploadApi),
  );
  const failed: CloudinaryFailedImage[] = [];

  fallbackResults.forEach((result, index) => {
    const publicId = fallbackPublicIds[index] ?? "";

    if (result.status === "fulfilled") {
      deleted.push(result.value);
      return;
    }

    failed.push({ publicId, message: getErrorMessage(result.reason) });
  });

  return { deleted, failed };
};

export const destroyCloudinaryImages = async (
  publicIds: string[],
): Promise<CloudinaryCleanupResult> => {
  getCloudinaryConfig();
  const requestedPublicIds = Array.from(
    new Set(
      publicIds
        .filter((publicId): publicId is string => typeof publicId === "string")
        .map((publicId) => publicId.trim().replace(/^\/+|\/+$/gu, ""))
        .filter(Boolean),
    ),
  );
  const managedPublicIds = requestedPublicIds.filter(
    isManagedCloudinaryPublicId,
  );
  const failed: CloudinaryFailedImage[] = requestedPublicIds
    .filter((publicId) => !isManagedCloudinaryPublicId(publicId))
    .map((publicId) => ({
      publicId,
      message: `public_id nằm ngoài thư mục ${getCloudinaryFolder()}`,
    }));
  const deleted: CloudinaryDeletedImage[] = [];

  for (
    let startIndex = 0;
    startIndex < managedPublicIds.length;
    startIndex += CLOUDINARY_DELETE_BATCH_SIZE
  ) {
    const batch = managedPublicIds.slice(
      startIndex,
      startIndex + CLOUDINARY_DELETE_BATCH_SIZE,
    );
    const result = await destroyCloudinaryBatch(batch);
    deleted.push(...result.deleted);
    failed.push(...result.failed);
  }

  return { deleted, failed };
};
