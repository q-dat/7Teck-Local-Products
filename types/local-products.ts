export type CloudinaryProductImage = {
  id: string;
  name: string;
  dataUrl: string;
  size: number;
  type: string;
  createdAt: string;
  publicId: string;
  version: number;
};

export type ProductRecord = {
  id: string;
  name: string;
  description: string;
  pin: string;
  status: string;
  price: number;
  priceText: string;
  category: string;
  contentType: "technology" | "realEstate";
  realEstateComment: string;
  images: CloudinaryProductImage[];
  internalImages: CloudinaryProductImage[];
  isDone: boolean;
  doneAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AppStateRecord = {
  settings?: unknown;
  scheduleConfig?: unknown;
  scheduleAssignments?: Record<string, string>;
  postedRecords?: unknown[];
};

export type BootstrapResponse = AppStateRecord & {
  products: ProductRecord[];
};
