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

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  return { cloudName, apiKey, apiSecret };
};

export const getCloudinaryFolder = (): string => {
  const folder = process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || "local-products";
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
  return publicId === folder || publicId.startsWith(`${folder}/`);
};

export const destroyCloudinaryImages = async (publicIds: string[]) => {
  getCloudinaryConfig();
  const uniquePublicIds = Array.from(new Set(publicIds.filter(Boolean))).filter(
    isManagedCloudinaryPublicId,
  );

  const results = await Promise.allSettled(
    uniquePublicIds.map(async (publicId) => {
      const result = await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: "image",
        type: "upload",
      });
      return { publicId, result: String(result.result ?? "unknown") };
    }),
  );

  return {
    deleted: results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    ),
    failed: results.flatMap((result, index) =>
      result.status === "rejected"
        ? [{ publicId: uniquePublicIds[index] ?? "", message: String(result.reason) }]
        : [],
    ),
  };
};
