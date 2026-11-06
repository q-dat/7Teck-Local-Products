declare module "@bg0/browser" {
  export type BackgroundRemovalProgress = {
    stage: string;
    progress: number;
    message?: string;
  };

  export type BackgroundRemovalResult = {
    blob: Blob;
    sourceBlob?: Blob;
    width: number;
    height: number;
    provider: "webgpu" | "wasm";
    model: "birefnet" | "birefnet-lite";
    quality: "fast" | "quality";
    durationMs: number;
  };

  export type RemoveBackgroundOptions = {
    model?: "auto" | "lite" | "full";
    quality?: "fast" | "quality";
    signal?: AbortSignal;
    onProgress?: (progress: BackgroundRemovalProgress) => void;
  };

  export function removeBackground(
    input: Blob,
    options?: RemoveBackgroundOptions,
  ): Promise<BackgroundRemovalResult>;
}
