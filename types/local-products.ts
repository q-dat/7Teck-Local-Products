export type ProductContentType =
  "technology" | "realEstate" | "rental" | "propertyRental";

export type CloudinaryProductImage = {
  id?: string;
  name?: string;
  dataUrl: string;
  size?: number;
  type?: string;
  createdAt?: string;
  publicId?: string;
  version?: number;
};

export type ProductRecord = {
  _id?: string;
  id: string;
  name: string;
  description: string;
  pin: string;
  status: string;
  price: number;
  priceText: string;
  category: string;
  contentType: ProductContentType;
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
};

export type BootstrapResponse = AppStateRecord & {
  products: ProductRecord[];
};

export type UsedProductRecord = {
  _id?: string;
  name: string;
  slug: string;
  sourceProductId?: string | null;
  description?: string;
  price?: number;
  priceText?: string;
  category?: string;
  categorySlug?: string;
  parentCategorySlug?: string | null;
  images?: CloudinaryProductImage[];
  status?: string;
  pin?: string;
  contentType?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type UsedProductCategoryRecord = {
  _id?: string;
  name: string;
  slug: string;
  parentSlug?: string | null;
  description?: string;
  order?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  children?: UsedProductCategoryRecord[];
};
