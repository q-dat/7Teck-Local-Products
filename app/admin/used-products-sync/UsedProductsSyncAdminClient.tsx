"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  FolderTree,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

const PAGE_SIZE = 50;

interface LocalImage {
  dataUrl?: string;
  url?: string;
  src?: string;
  name?: string;
  publicId?: string;
}

interface LocalProduct {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  price?: number;
  priceText?: string;
  category?: string;
  images?: unknown[];
  createdAt?: string;
  updatedAt?: string;
  isDone?: boolean;
  doneAt?: string | null;
}

interface LocalProductDoneStatus {
  _id: string;
  id?: string;
  isDone: boolean;
  doneAt?: string | null;
  updatedAt?: string;
}

interface UsedProductSyncSummary {
  _id: string;
  name: string;
  slug: string;
  sourceProductId?: string | null;
  __v?: number;
  updatedAt?: string;
  isDone?: boolean;
  doneAt?: string | null;
}

interface UsedProduct {
  _id: string;
  __v?: number;
  name: string;
  slug: string;
  sourceProductId?: string | null;
  description?: string;
  price?: number;
  priceText?: string;
  category?: string;
  parentCategory?: string | null;
  parentCategorySlug?: string | null;
  images?: unknown[];
  status?: string;
  isDone?: boolean;
  doneAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface CategoryTreeItem {
  _id: string;
  name: string;
  slug: string;
  parentSlug: string | null;
  description?: string;
  order: number;
  children: CategoryTreeItem[];
  createdAt?: string;
  updatedAt?: string;
}

interface ApiResponse<T = unknown> {
  ok?: boolean;
  message?: string;
  error?: string;
  products?: T[];
  categories?: T[];
  tree?: CategoryTreeItem[];
  product?: T;
  category?: T;
  insertedCount?: number;
  skippedCount?: number;
  childrenDeleted?: number;
  count?: number;
  requestedCount?: number;
  matchedCount?: number;
  modifiedCount?: number;
  deletedCount?: number;
  conflictCount?: number;
}

interface Notice {
  type: "success" | "error" | "info";
  text: string;
}

interface ProductFormState {
  _id?: string;
  __v?: number;
  slug?: string;
  name: string;
  sourceProductId: string;
  description: string;
  price: number;
  priceText: string;
  categoryId: string;
  status: string;
  isDone: boolean;
}

interface CategoryFormState {
  _id?: string;
  originalSlug?: string;
  name: string;
  slug: string;
  parentSlug: string | null;
  currentParentSlug: string | null;
  description: string;
  order: number;
}

interface BulkEditState {
  applyCategory: boolean;
  categoryId: string;
  applyStatus: boolean;
  status: string;
  applyPrice: boolean;
  price: string;
  applyPriceText: boolean;
  priceText: string;
  applyDescription: boolean;
  description: string;
  applyDone: boolean;
  isDone: boolean;
}

type AdminTab = "sync" | "products" | "categories";
type ProductSelectionItem = Pick<UsedProduct, "_id" | "name" | "slug" | "__v">;
type DeleteTarget =
  | { kind: "products"; items: ProductSelectionItem[] }
  | { kind: "category"; item: CategoryTreeItem }
  | null;

const inputClass =
  "w-full min-w-0 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50";
const selectClass = inputClass;
const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const buttonSecondary =
  `${buttonBase} border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700`;
const buttonPrimary =
  `${buttonBase} bg-sky-600 text-white hover:bg-sky-500`;
const buttonDanger =
  `${buttonBase} bg-rose-600 text-white hover:bg-rose-500`;
const checkboxClass =
  "h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-500 focus:ring-sky-500 focus:ring-offset-0";

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const data = (await response.json()) as ApiResponse<T>;
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || data.error || `Yêu cầu thất bại (${response.status})`);
  }
  return data;
}

function getImageUrl(images?: unknown[]): string | undefined {
  if (!images?.length) return undefined;
  const first = images[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object") {
    const image = first as LocalImage;
    const candidate = image.dataUrl || image.url || image.src;
    return typeof candidate === "string" ? candidate : undefined;
  }
  return undefined;
}

function formatPrice(price?: number, priceText?: string): string {
  if (typeof price === "number" && Number.isFinite(price) && price > 0) {
    return `${price.toLocaleString("vi-VN")} ₫`;
  }
  return priceText?.trim() || "Chưa có giá";
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function PaginationBar({
  total,
  page,
  pageSize = PAGE_SIZE,
  onPageChange,
}: {
  total: number;
  page: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  if (total <= pageSize) return null;

  const start = safePage * pageSize + 1;
  const end = Math.min(total, (safePage + 1) * pageSize);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
      <span>
        {start}–{end} / {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Trang trước"
          className="rounded p-1.5 hover:bg-slate-800 disabled:opacity-30"
          disabled={safePage === 0}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-14 text-center">
          {safePage + 1} / {pageCount}
        </span>
        <button
          type="button"
          aria-label="Trang sau"
          className="rounded p-1.5 hover:bg-slate-800 disabled:opacity-30"
          disabled={safePage >= pageCount - 1}
          onClick={() => onPageChange(safePage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  description,
  children,
  onClose,
  width = "max-w-xl",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  width?: string;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[92dvh] w-full ${width} flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-slate-400">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Đóng cửa sổ"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="overflow-y-auto px-4 py-3">{children}</div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  tone = "sky",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "sky" | "emerald" | "amber" | "violet";
}) {
  const tones: Record<typeof tone, string> = {
    sky: "text-sky-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
  };

  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2.5">
      <div className="truncate text-xs text-slate-400">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold tabular-nums ${tones[tone]}`}>
        {value.toLocaleString("vi-VN")}
      </div>
      <div className="truncate text-[11px] text-slate-500">{detail}</div>
    </div>
  );
}

export default function UsedProductsSyncAdminClient() {
  const [activeTab, setActiveTab] = useState<AdminTab>("sync");
  const [localProducts, setLocalProducts] = useState<LocalProduct[]>([]);
  const [usedProducts, setUsedProducts] = useState<UsedProduct[]>([]);
  const [usedSyncItems, setUsedSyncItems] = useState<UsedProductSyncSummary[]>([]);
  const [usedTotalCount, setUsedTotalCount] = useState(0);
  const [productResultCount, setProductResultCount] = useState(0);
  const [selectedProductMeta, setSelectedProductMeta] = useState<Record<string, ProductSelectionItem>>({});
  const [categoryTree, setCategoryTree] = useState<CategoryTreeItem[]>([]);
  const [flatCategories, setFlatCategories] = useState<CategoryTreeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductListLoading, setIsProductListLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [syncSearch, setSyncSearch] = useState("");
  const [syncDoneFilter, setSyncDoneFilter] = useState<"done" | "not-done">("not-done");
  const [selectedLocalIds, setSelectedLocalIds] = useState<Set<string>>(() => new Set());
  const [syncPage, setSyncPage] = useState(0);

  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productStatusFilter, setProductStatusFilter] = useState("all");
  const [productDoneFilter, setProductDoneFilter] = useState<"all" | "done" | "not-done">("all");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set());
  const [productPage, setProductPage] = useState(0);
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEdit, setBulkEdit] = useState<BulkEditState>({
    applyCategory: false,
    categoryId: "",
    applyStatus: false,
    status: "active",
    applyPrice: false,
    price: "",
    applyPriceText: false,
    priceText: "",
    applyDescription: false,
    description: "",
    applyDone: false,
    isDone: false,
  });

  const [categorySearch, setCategorySearch] = useState("");
  const [categoryPage, setCategoryPage] = useState(0);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [localResponse, syncResponse, categoryResponse] = await Promise.all([
        fetch("/api/local-products/products?contentType=technology", { cache: "no-store" }),
        fetch("/api/used-products?view=sync", { cache: "no-store" }),
        fetch("/api/used-product-categories", { cache: "no-store" }),
      ]);

      const [localData, syncData, categoryData] = await Promise.all([
        readApi<LocalProduct>(localResponse),
        readApi<UsedProductSyncSummary>(syncResponse),
        readApi<CategoryTreeItem>(categoryResponse),
      ]);

      setLocalProducts(Array.isArray(localData.products) ? localData.products : []);
      setUsedSyncItems(Array.isArray(syncData.products) ? syncData.products : []);
      setUsedTotalCount(typeof syncData.count === "number" ? syncData.count : (syncData.products?.length ?? 0));
      setFlatCategories(Array.isArray(categoryData.categories) ? categoryData.categories : []);
      setCategoryTree(Array.isArray(categoryData.tree) ? categoryData.tree : []);
      setNotice(null);
    } catch (error: unknown) {
      setNotice({ type: "error", text: getErrorMessage(error, "Không thể tải dữ liệu quản trị.") });
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  const refreshSourceDoneStatus = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/local-products/products?view=done-status&contentType=technology",
        { cache: "no-store" },
      );
      const data = await readApi<LocalProductDoneStatus>(response);
      const statuses = Array.isArray(data.products) ? data.products : [];
      const statusById = new Map<string, LocalProductDoneStatus>();

      for (const status of statuses) {
        if (status._id) statusById.set(status._id, status);
        if (status.id) statusById.set(status.id, status);
      }

      setLocalProducts((current) =>
        current.map((product) => {
          const latest = statusById.get(product._id) ??
            (product.id ? statusById.get(product.id) : undefined);

          if (!latest) return product;

          const nextIsDone = latest.isDone === true;
          const nextDoneAt = nextIsDone ? latest.doneAt ?? null : null;
          const nextUpdatedAt = latest.updatedAt ?? product.updatedAt;

          if (
            product.isDone === nextIsDone &&
            product.doneAt === nextDoneAt &&
            product.updatedAt === nextUpdatedAt
          ) {
            return product;
          }

          return {
            ...product,
            isDone: nextIsDone,
            doneAt: nextDoneAt,
            updatedAt: nextUpdatedAt,
          };
        }),
      );
    } catch {
      // Keep the last known source status during temporary network errors.
    }
  }, []);

  const fetchProductPage = useCallback(async (showLoading = true) => {
    if (activeTab !== "products") return;
    if (showLoading) setIsProductListLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(productPage + 1),
        limit: String(PAGE_SIZE),
      });
      if (debouncedProductSearch.trim()) params.set("search", debouncedProductSearch.trim());
      if (productCategoryFilter !== "all") params.set("category", productCategoryFilter);
      if (productStatusFilter !== "all") params.set("status", productStatusFilter);
      if (productDoneFilter !== "all") params.set("isDone", productDoneFilter === "done" ? "true" : "false");

      const response = await fetch(`/api/used-products?${params.toString()}`, { cache: "no-store" });
      const data = await readApi<UsedProduct>(response);
      const pageItems = Array.isArray(data.products) ? data.products : [];

      setUsedProducts(pageItems);
      setProductResultCount(typeof data.count === "number" ? data.count : pageItems.length);
    } catch (error: unknown) {
      setNotice({ type: "error", text: getErrorMessage(error, "Không thể tải danh sách sản phẩm.") });
    } finally {
      if (showLoading) setIsProductListLoading(false);
    }
  }, [activeTab, productPage, debouncedProductSearch, productCategoryFilter, productStatusFilter, productDoneFilter]);

  const refreshCurrentData = useCallback(async (showLoading = true) => {
    const jobs: Promise<void>[] = [fetchData(showLoading)];
    if (activeTab === "products") jobs.push(fetchProductPage(false));
    await Promise.all(jobs);
  }, [activeTab, fetchData, fetchProductPage]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab !== "sync") return;

    let disposed = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      await refreshSourceDoneStatus();
      if (!disposed) {
        timeoutId = window.setTimeout(() => void poll(), 5_000);
      }
    };

    timeoutId = window.setTimeout(() => void poll(), 1_000);

    return () => {
      disposed = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [activeTab, refreshSourceDoneStatus]);

  useEffect(() => {
    if (activeTab === "products") void fetchProductPage();
  }, [activeTab, fetchProductPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedProductSearch(productSearch);
      setProductPage(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  const usedSourceMap = useMemo(() => {
    const map = new Map<string, UsedProductSyncSummary>();
    for (const product of usedSyncItems) {
      if (product.sourceProductId) map.set(product.sourceProductId, product);
    }
    return map;
  }, [usedSyncItems]);

  const parentCategoryBySlug = useMemo(() => {
    const map = new Map<string, CategoryTreeItem>();
    for (const category of flatCategories) {
      if (!category.parentSlug) map.set(category.slug, category);
    }
    return map;
  }, [flatCategories]);

  const categoryById = useMemo(
    () => new Map(flatCategories.map((category) => [category._id, category])),
    [flatCategories],
  );

  const getSourceProductDone = useCallback(
    (product: LocalProduct): boolean => product.isDone === true,
    [],
  );

  const sourceDoneStats = useMemo(() => {
    let done = 0;
    for (const product of localProducts) {
      if (getSourceProductDone(product)) done += 1;
    }
    return {
      done,
      notDone: localProducts.length - done,
    };
  }, [localProducts, getSourceProductDone]);

  const stats = useMemo(() => {
    const synced = localProducts.reduce(
      (count, product) => count + (product._id && usedSourceMap.has(product._id) ? 1 : 0),
      0,
    );
    return {
      local: localProducts.length,
      synced,
      unsynced: localProducts.length - synced,
      used: usedTotalCount,
      categories: flatCategories.length,
    };
  }, [localProducts, usedSourceMap, usedTotalCount, flatCategories.length]);

  const filteredLocalProducts = useMemo(() => {
    const query = syncSearch.trim().toLocaleLowerCase("vi-VN");
    return localProducts.filter((product) => {
      const isDone = getSourceProductDone(product);
      if (syncDoneFilter === "done" && !isDone) return false;
      if (syncDoneFilter === "not-done" && isDone) return false;
      if (!query) return true;
      return [product.name, product._id, product.id, product.category]
        .some((value) => value?.toLocaleLowerCase("vi-VN").includes(query));
    });
  }, [localProducts, syncSearch, syncDoneFilter, getSourceProductDone]);

  const selectableFilteredLocalCount = useMemo(
    () => filteredLocalProducts.filter(
      (product) => Boolean(product._id && !usedSourceMap.has(product._id)),
    ).length,
    [filteredLocalProducts, usedSourceMap],
  );

  const filteredUsedProducts = usedProducts;

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLocaleLowerCase("vi-VN");
    if (!query) return flatCategories;
    return flatCategories.filter((category) => {
      const parentName = category.parentSlug
        ? parentCategoryBySlug.get(category.parentSlug)?.name || ""
        : "Danh mục cha";
      return [category.name, category.slug, category.parentSlug, parentName]
        .some((value) => value?.toLocaleLowerCase("vi-VN").includes(query));
    });
  }, [flatCategories, categorySearch, parentCategoryBySlug]);

  const visibleLocalProducts = useMemo(
    () => filteredLocalProducts.slice(syncPage * PAGE_SIZE, (syncPage + 1) * PAGE_SIZE),
    [filteredLocalProducts, syncPage],
  );
  const visibleUsedProducts = filteredUsedProducts;
  const visibleCategories = useMemo(
    () => filteredCategories.slice(categoryPage * PAGE_SIZE, (categoryPage + 1) * PAGE_SIZE),
    [filteredCategories, categoryPage],
  );

  useEffect(() => setSyncPage(0), [syncDoneFilter, syncSearch]);
  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(productResultCount / PAGE_SIZE) - 1);
    if (productPage > lastPage) setProductPage(lastPage);
  }, [productPage, productResultCount]);
  useEffect(() => setCategoryPage(0), [categorySearch]);

  const notify = (type: Notice["type"], text: string) => setNotice({ type, text });

  const toggleLocalSelection = (id: string) => {
    setSelectedLocalIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFilteredLocal = () => {
    const ids = filteredLocalProducts
      .filter((product) => product._id && !usedSourceMap.has(product._id))
      .map((product) => product._id);
    setSelectedLocalIds(new Set(ids));
  };

  const toggleCurrentLocalPage = (checked: boolean) => {
    setSelectedLocalIds((current) => {
      const next = new Set(current);
      for (const product of visibleLocalProducts) {
        if (!product._id || usedSourceMap.has(product._id)) continue;
        if (checked) next.add(product._id);
        else next.delete(product._id);
      }
      return next;
    });
  };

  const toggleProductSelection = (id: string) => {
    const wasSelected = selectedProductIds.has(id);
    const product = usedProducts.find((item) => item._id === id);

    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (wasSelected) next.delete(id);
      else next.add(id);
      return next;
    });

    setSelectedProductMeta((current) => {
      const next = { ...current };
      if (wasSelected) {
        delete next[id];
      } else if (product) {
        next[id] = { _id: product._id, name: product.name, slug: product.slug, __v: product.__v };
      }
      return next;
    });
  };

  const toggleCurrentProductPage = (checked: boolean) => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      for (const product of visibleUsedProducts) {
        if (checked) next.add(product._id);
        else next.delete(product._id);
      }
      return next;
    });

    setSelectedProductMeta((current) => {
      const next = { ...current };
      for (const product of visibleUsedProducts) {
        if (checked) {
          next[product._id] = {
            _id: product._id,
            name: product.name,
            slug: product.slug,
            __v: product.__v,
          };
        } else {
          delete next[product._id];
        }
      }
      return next;
    });
  };

  const selectedProducts = useMemo(
    () => Array.from(selectedProductIds)
      .map((id) => selectedProductMeta[id])
      .filter((product): product is ProductSelectionItem => Boolean(product)),
    [selectedProductIds, selectedProductMeta],
  );

  const handleSync = async (targets: LocalProduct[]) => {
    if (targets.length === 0) {
      notify("info", "Không có sản phẩm nào cần đồng bộ.");
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const payload = targets.map((product) => ({
        sourceProductId: product._id,
        name: product.name,
        description: product.description || "",
        price: typeof product.price === "number" ? product.price : 0,
        priceText: product.priceText || "",
        category: product.category || "",
        images: product.images || [],
        status: "active",
        isDone: product.isDone === true,
        doneAt: product.isDone === true ? product.doneAt ?? null : null,
      }));

      const response = await fetch("/api/used-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: payload }),
      });
      const result = await readApi<UsedProduct>(response);
      notify(
        "success",
        `Đã thêm ${result.insertedCount ?? 0} sản phẩm; bỏ qua ${result.skippedCount ?? 0} sản phẩm đã tồn tại.`,
      );
      setSelectedLocalIds(new Set());
      await refreshCurrentData(false);
    } catch (error: unknown) {
      notify("error", getErrorMessage(error, "Đồng bộ sản phẩm thất bại."));
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCategoryForProduct = (product: UsedProduct): CategoryTreeItem | undefined =>
    flatCategories.find((category) => {
      if (category.name !== product.category) return false;
      if (product.parentCategorySlug) return category.parentSlug === product.parentCategorySlug;
      return category.parentSlug === null;
    });

  const openCreateProduct = () => {
    setProductForm({
      name: "",
      sourceProductId: "",
      description: "",
      price: 0,
      priceText: "",
      categoryId: "",
      status: "active",
      isDone: false,
    });
  };

  const openEditProduct = (product: UsedProduct) => {
    const matchedCategory = selectedCategoryForProduct(product);
    setProductForm({
      _id: product._id,
      __v: product.__v,
      slug: product.slug,
      name: product.name,
      sourceProductId: product.sourceProductId || "",
      description: product.description || "",
      price: typeof product.price === "number" ? product.price : 0,
      priceText: product.priceText || "",
      categoryId: matchedCategory?._id || "",
      status: product.status || "active",
      isDone: product.isDone === true,
    });
  };

  const handleSaveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!productForm?.name.trim()) {
      notify("error", "Tên sản phẩm không được để trống.");
      return;
    }

    const category = categoryById.get(productForm.categoryId);
    const parent = category?.parentSlug ? parentCategoryBySlug.get(category.parentSlug) : undefined;
    const payload: Record<string, unknown> = {
      __v: productForm.__v,
      name: productForm.name.trim(),
      sourceProductId: productForm.sourceProductId.trim() || null,
      description: productForm.description,
      price: productForm.price,
      priceText: productForm.priceText,
      category: category?.name || "",
      parentCategory: parent?.name || null,
      parentCategorySlug: category?.parentSlug || null,
      status: productForm.status,
      isDone: productForm.isDone,
    };

    setIsSaving(true);
    try {
      const editing = Boolean(productForm._id);
      const endpoint = editing
        ? `/api/used-products/${encodeURIComponent(productForm.slug || productForm._id || "")}`
        : "/api/used-products";
      const response = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readApi<UsedProduct>(response);
      setProductForm(null);
      setSelectedProductIds(new Set());
      setSelectedProductMeta({});
      notify("success", editing ? "Đã cập nhật sản phẩm." : "Đã tạo sản phẩm mới.");
      await refreshCurrentData(false);
    } catch (error: unknown) {
      notify("error", getErrorMessage(error, "Không thể lưu sản phẩm."));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleProductDone = async (product: UsedProduct) => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/used-products/${encodeURIComponent(product.slug)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            __v: product.__v ?? 0,
            isDone: product.isDone !== true,
          }),
        },
      );

      await readApi<UsedProduct>(response);
      setSelectedProductIds(new Set());
      setSelectedProductMeta({});
      notify(
        "success",
        product.isDone ? `Đã bỏ trạng thái Done của “${product.name}”.` : `Đã đánh dấu Done cho “${product.name}”.`,
      );
      await refreshCurrentData(false);
    } catch (error: unknown) {
      notify("error", getErrorMessage(error, "Không thể cập nhật trạng thái Done."));
    } finally {
      setIsSaving(false);
    }
  };

  const openBulkEdit = () => {
    setBulkEdit({
      applyCategory: false,
      categoryId: "",
      applyStatus: false,
      status: "active",
      applyPrice: false,
      price: "",
      applyPriceText: false,
      priceText: "",
      applyDescription: false,
      description: "",
      applyDone: false,
      isDone: false,
    });
    setBulkEditOpen(true);
  };

  const handleBulkEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasChanges = bulkEdit.applyCategory || bulkEdit.applyStatus || bulkEdit.applyPrice ||
      bulkEdit.applyPriceText || bulkEdit.applyDescription || bulkEdit.applyDone;
    if (!hasChanges) {
      notify("info", "Hãy chọn ít nhất một trường muốn cập nhật.");
      return;
    }

    const category = categoryById.get(bulkEdit.categoryId);
    const parent = category?.parentSlug ? parentCategoryBySlug.get(category.parentSlug) : undefined;
    const patch: Record<string, unknown> = {};
    if (bulkEdit.applyCategory) {
      patch.category = category?.name || "";
      patch.parentCategory = parent?.name || null;
      patch.parentCategorySlug = category?.parentSlug || null;
    }
    if (bulkEdit.applyStatus) patch.status = bulkEdit.status;
    if (bulkEdit.applyPrice) {
      const price = Number(bulkEdit.price);
      if (bulkEdit.price.trim() === "" || !Number.isFinite(price) || price < 0) {
        notify("error", "Giá cập nhật phải là số không âm.");
        return;
      }
      patch.price = price;
    }
    if (bulkEdit.applyPriceText) patch.priceText = bulkEdit.priceText;
    if (bulkEdit.applyDescription) patch.description = bulkEdit.description;
    if (bulkEdit.applyDone) patch.isDone = bulkEdit.isDone;

    setIsSaving(true);
    try {
      const response = await fetch("/api/used-products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedProducts.map((product) => product._id),
          versions: Object.fromEntries(
            selectedProducts.map((product) => [product._id, product.__v ?? 0]),
          ),
          updates: patch,
        }),
      });
      const result = await readApi<{
        matchedCount?: number;
        modifiedCount?: number;
        conflictCount?: number;
      }>(response);
      setBulkEditOpen(false);
      setSelectedProductIds(new Set());
      setSelectedProductMeta({});
      notify(
        result.conflictCount ? "info" : "success",
        `Đã cập nhật ${result.modifiedCount ?? 0} sản phẩm${result.conflictCount ? `; ${result.conflictCount} sản phẩm đã thay đổi ở nơi khác nên được bỏ qua` : ""}.`,
      );
      await refreshCurrentData(false);
    } catch (error: unknown) {
      notify("error", getErrorMessage(error, "Không thể cập nhật hàng loạt."));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProducts = (products: ProductSelectionItem[]) => {
    if (products.length > 0) setDeleteTarget({ kind: "products", items: products });
  };

  const deleteCategory = (category: CategoryTreeItem) => {
    setDeleteTarget({ kind: "category", item: category });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    const target = deleteTarget;
    setDeleteTarget(null);

    try {
      if (target.kind === "products") {
        const response = await fetch("/api/used-products", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: target.items.map((product) => product._id),
            versions: Object.fromEntries(
              target.items.map((product) => [product._id, product.__v ?? 0]),
            ),
          }),
        });
        const result = await readApi<{ deletedCount?: number; conflictCount?: number }>(response);
        setSelectedProductIds(new Set());
        setSelectedProductMeta({});
        notify(
          result.conflictCount ? "info" : "success",
          `Đã xóa ${result.deletedCount ?? 0}/${target.items.length} sản phẩm${result.conflictCount ? `; ${result.conflictCount} sản phẩm đã thay đổi nên không bị xóa` : ""}.`,
        );
      } else {
        const category = target.item;
        const query = category.parentSlug
          ? `?parentSlug=${encodeURIComponent(category.parentSlug)}`
          : "";
        const response = await fetch(
          `/api/used-product-categories/${encodeURIComponent(category.slug)}${query}`,
          { method: "DELETE" },
        );
        const result = await readApi<{ childrenDeleted?: number }>(response);
        const childCount = result.childrenDeleted || 0;
        notify(
          "success",
          childCount
            ? `Đã xóa danh mục “${category.name}” và ${childCount} danh mục con.`
            : `Đã xóa danh mục “${category.name}”.`,
        );
      }
      await refreshCurrentData(false);
    } catch (error: unknown) {
      notify("error", getErrorMessage(error, "Không thể xóa dữ liệu."));
    } finally {
      setIsSaving(false);
    }
  };

  const openCreateCategory = (parentSlug: string | null = null) => {
    setCategoryForm({
      name: "",
      slug: "",
      parentSlug,
      currentParentSlug: parentSlug,
      description: "",
      order: 0,
    });
  };

  const openEditCategory = (category: CategoryTreeItem) => {
    setCategoryForm({
      _id: category._id,
      originalSlug: category.slug,
      name: category.name,
      slug: category.slug,
      parentSlug: category.parentSlug,
      currentParentSlug: category.parentSlug,
      description: category.description || "",
      order: category.order || 0,
    });
  };

  const handleSaveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!categoryForm?.name.trim()) {
      notify("error", "Tên danh mục không được để trống.");
      return;
    }

    const editing = Boolean(categoryForm._id);
    const payload: Record<string, unknown> = {
      name: categoryForm.name.trim(),
      slug: categoryForm.slug.trim(),
      parentSlug: categoryForm.parentSlug,
      description: categoryForm.description,
      order: categoryForm.order,
    };
    if (editing) payload.currentParentSlug = categoryForm.currentParentSlug;

    setIsSaving(true);
    try {
      const query = editing && categoryForm.parentSlug
        ? `?parentSlug=${encodeURIComponent(categoryForm.currentParentSlug || "")}`
        : "";
      const endpoint = editing
        ? `/api/used-product-categories/${encodeURIComponent(categoryForm.originalSlug || categoryForm.slug)}${query}`
        : "/api/used-product-categories";
      const response = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readApi<CategoryTreeItem>(response);
      setCategoryForm(null);
      notify("success", editing ? "Đã cập nhật danh mục." : "Đã tạo danh mục.");
      await refreshCurrentData(false);
    } catch (error: unknown) {
      notify("error", getErrorMessage(error, "Không thể lưu danh mục."));
    } finally {
      setIsSaving(false);
    }
  };

  const allVisibleLocalSelected = visibleLocalProducts
    .filter((product) => product._id && !usedSourceMap.has(product._id))
    .every((product) => selectedLocalIds.has(product._id));
  const selectableVisibleLocalCount = visibleLocalProducts.filter(
    (product) => product._id && !usedSourceMap.has(product._id),
  ).length;
  const allVisibleProductsSelected = visibleUsedProducts.length > 0 &&
    visibleUsedProducts.every((product) => selectedProductIds.has(product._id));

  return (
    <main className="min-h-screen bg-[#080d16] text-slate-100">
      <div className="mx-auto max-w-[1600px] px-3 py-3 xl:px-5 xl:py-4">
        <header className="mb-3 flex flex-col gap-3 border-b border-slate-800 pb-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-400">
              <span>7Teck Admin</span><span className="text-slate-600">/</span><span>Used Products</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white xl:text-2xl">
              Đồng bộ & quản lý sản phẩm cũ
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Đối chiếu sản phẩm Local, quản lý dữ liệu Used và danh mục theo cấu trúc cha/con.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={buttonSecondary} onClick={() => void refreshCurrentData()} disabled={isLoading || isProductListLoading || isSaving}>
              {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Làm mới
            </button>
            <Link href="/" className={buttonPrimary}>
              <ExternalLink className="h-4 w-4" /> Local page
            </Link>
          </div>
        </header>

        {notice ? (
          <div className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${notice.type === "success"
            ? "border-emerald-800 bg-emerald-950/50 text-emerald-200"
            : notice.type === "error"
              ? "border-rose-800 bg-rose-950/50 text-rose-200"
              : "border-sky-800 bg-sky-950/50 text-sky-200"
            }`}>
            {notice.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            {notice.type === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            {notice.type === "info" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            <span className="min-w-0 flex-1">{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Đóng thông báo" className="rounded p-0.5 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <section className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Stat label="Sản phẩm Local" value={stats.local} detail="Nguồn dữ liệu" tone="sky" />
          <Stat label="Đã đồng bộ" value={stats.synced} detail="Khớp sourceProductId" tone="emerald" />
          <Stat label="Chưa đồng bộ" value={stats.unsynced} detail="Có thể đồng bộ" tone="amber" />
          <Stat label="Used / Danh mục" value={stats.used} detail={`${stats.categories} danh mục`} tone="violet" />
        </section>

        <nav className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/70 p-1">
          {([
            { id: "sync", label: `Đồng bộ (${stats.unsynced})`, icon: ArrowRightLeft },
            { id: "products", label: `Sản phẩm (${stats.used})`, icon: Package },
            { id: "categories", label: `Danh mục (${stats.categories})`, icon: FolderTree },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${activeTab === tab.id
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  }`}
              >
                <Icon className="h-4 w-4" />{tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === "sync" ? (
          <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
            <div className="flex flex-col gap-2 border-b border-slate-800 p-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center">
                <div className="relative min-w-0 xl:w-72">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input className={`${inputClass} pl-8`} value={syncSearch} onChange={(event) => setSyncSearch(event.target.value)} placeholder="Tìm tên, ID, danh mục..." />
                </div>
                <div className="inline-flex w-full items-center gap-1 rounded-md border border-slate-800 bg-slate-950/70 p-1 xl:w-auto" role="group" aria-label="Lọc trạng thái Done của sản phẩm nguồn">
                  <button
                    type="button"
                    onClick={() => setSyncDoneFilter("not-done")}
                    aria-pressed={syncDoneFilter === "not-done"}
                    className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium transition ${syncDoneFilter === "not-done" ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}
                  >
                    Sản phẩm chưa Done {sourceDoneStats.notDone}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSyncDoneFilter("done")}
                    aria-pressed={syncDoneFilter === "done"}
                    className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium transition ${syncDoneFilter === "done" ? "bg-emerald-800/80 text-emerald-100" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}
                  >
                    Sản phẩm Done {sourceDoneStats.done}
                  </button>

                </div>
                <span className="text-[10px] text-slate-500">Trạng thái Done tự làm mới mỗi 5 giây</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" className={buttonSecondary} onClick={selectAllFilteredLocal} disabled={isSaving || selectableFilteredLocalCount === 0}>Chọn sản phẩm có thể đồng bộ ({selectableFilteredLocalCount})</button>
                {selectedLocalIds.size > 0 ? <button type="button" className={buttonSecondary} onClick={() => setSelectedLocalIds(new Set())}>Bỏ chọn {selectedLocalIds.size}</button> : null}
                <button type="button" className={buttonPrimary} disabled={isSaving || !filteredLocalProducts.some((product) => product._id && selectedLocalIds.has(product._id) && !usedSourceMap.has(product._id))} onClick={() => void handleSync(filteredLocalProducts.filter((product) => product._id && selectedLocalIds.has(product._id) && !usedSourceMap.has(product._id)))}>
                  {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                  Đồng bộ đã chọn
                </button>
                <button type="button" className={`${buttonBase} bg-emerald-700 text-white hover:bg-emerald-600`} disabled={isSaving || selectableFilteredLocalCount === 0} onClick={() => void handleSync(filteredLocalProducts.filter((product) => product._id && !usedSourceMap.has(product._id)))}>
                  <Check className="h-4 w-4" /> Đồng bộ kết quả ({selectableFilteredLocalCount})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-950/70 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-9 px-3 py-2.5">
                      <input type="checkbox" className={checkboxClass} checked={selectableVisibleLocalCount > 0 && allVisibleLocalSelected} onChange={(event) => toggleCurrentLocalPage(event.target.checked)} aria-label="Chọn sản phẩm trên trang" />
                    </th>
                    <th className="px-3 py-2.5">Sản phẩm nguồn</th>
                    <th className="px-3 py-2.5">ID nguồn</th>
                    <th className="px-3 py-2.5">Giá</th>
                    <th className="px-3 py-2.5">Danh mục</th>
                    <th className="px-3 py-2.5">Phân loại Done</th>
                    <th className="px-3 py-2.5">Đồng bộ</th>
                    <th className="px-3 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {isLoading ? (
                    <tr><td colSpan={8} className="px-3 py-12 text-center text-sm text-slate-500"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Đang tải dữ liệu...</td></tr>
                  ) : visibleLocalProducts.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">Không có sản phẩm phù hợp bộ lọc.</td></tr>
                  ) : visibleLocalProducts.map((product) => {
                    const matched = product._id ? usedSourceMap.get(product._id) : undefined;
                    const synced = Boolean(matched);
                    const isDone = getSourceProductDone(product);
                    const imageUrl = getImageUrl(product.images);
                    const selected = selectedLocalIds.has(product._id);
                    return (
                      <tr key={product._id || product.id} className={`transition hover:bg-slate-800/50 ${selected ? "bg-sky-950/20" : ""}`}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" className={checkboxClass} checked={selected} disabled={synced || !product._id} onChange={() => toggleLocalSelection(product._id)} aria-label={`Chọn ${product.name}`} />
                        </td>
                        <td className="max-w-sm px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-800 bg-slate-950">
                              {imageUrl ? <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon className="h-4 w-4 text-slate-600" />}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-slate-100">{product.name}</div>
                              <div className="mt-0.5 truncate text-xs text-slate-500">{product.description || "Không có mô tả"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><code className="text-[11px] text-sky-300">{product._id || product.id || "—"}</code></td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-emerald-300">{formatPrice(product.price, product.priceText)}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-400">{product.category || "Chưa phân loại"}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded px-2 py-1 text-[10px] font-medium ${isDone ? "bg-emerald-950/70 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                            {isDone ? "Đã Done" : "Chưa Done"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {synced ? <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Đã đồng bộ</span> : <span className="inline-flex items-center gap-1 text-xs text-amber-300"><AlertCircle className="h-3.5 w-3.5" />Chưa đồng bộ</span>}
                          {matched ? <div className="mt-0.5 max-w-40 truncate font-mono text-[10px] text-slate-500">{matched.slug}</div> : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          {!synced ? <button type="button" className="rounded-md border border-sky-800 px-2.5 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-950/50 disabled:opacity-50" onClick={() => void handleSync([product])} disabled={isSaving}>Đồng bộ ngay</button> : <span className="text-xs text-slate-600">Đã có dữ liệu</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar total={filteredLocalProducts.length} page={syncPage} onPageChange={setSyncPage} />
          </section>
        ) : null}

        {activeTab === "products" ? (
          <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
            <div className="flex flex-col gap-2 border-b border-slate-800 p-3">
              <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center">
                  <div className="relative min-w-0 xl:w-72">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input className={`${inputClass} pl-8`} value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Tìm tên, slug, source ID..." />
                  </div>
                  <select className={`${selectClass} xl:w-52`} value={productCategoryFilter} onChange={(event) => { setProductPage(0); setProductCategoryFilter(event.target.value); }}>
                    <option value="all">Tất cả danh mục</option>
                    {Array.from(new Set([
                      ...flatCategories.map((category) => category.name),
                      ...usedProducts.map((product) => product.category || ""),
                    ].filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi")).map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <select className={`${selectClass} xl:w-36`} value={productStatusFilter} onChange={(event) => { setProductPage(0); setProductStatusFilter(event.target.value); }}>
                    <option value="all">Mọi trạng thái</option><option value="active">Active</option><option value="draft">Draft</option><option value="inactive">Inactive</option>
                  </select>
                  <div className="inline-flex w-full items-center gap-1 rounded-md border border-slate-800 bg-slate-950/70 p-1 xl:w-auto" role="group" aria-label="Lọc trạng thái Done">
                    {([
                      { value: "all", label: "Tất cả" },
                      { value: "done", label: "Đã Done" },
                      { value: "not-done", label: "Chưa Done" },
                    ] as const).map((option) => {
                      const active = productDoneFilter === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setProductPage(0);
                            setProductDoneFilter(option.value);
                          }}
                          aria-pressed={active}
                          className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium transition ${active ? option.value === "done" ? "bg-emerald-800/80 text-emerald-100" : "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={`${buttonBase} ${productDoneFilter === "done" ? "border border-emerald-700 bg-emerald-800 text-emerald-50 hover:bg-emerald-700" : "border border-emerald-900/80 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/70"}`}
                    onClick={() => {
                      setProductPage(0);
                      setProductDoneFilter((current) => current === "done" ? "all" : "done");
                    }}
                    aria-pressed={productDoneFilter === "done"}
                    title={productDoneFilter === "done" ? "Bỏ lọc sản phẩm Done" : "Chỉ hiển thị sản phẩm đã Done"}
                    disabled={isSaving}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {productDoneFilter === "done" ? "Đang lọc: Đã Done" : "Lọc sản phẩm đã Done"}
                  </button>
                  <button type="button" className={buttonPrimary} onClick={openCreateProduct} disabled={isSaving}><Plus className="h-4 w-4" /> Thêm sản phẩm</button>
                </div>
              </div>
              {selectedProductIds.size > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-900/70 bg-sky-950/30 px-2.5 py-2">
                  <span className="mr-auto text-xs font-medium text-sky-200">Đã chọn {selectedProductIds.size} sản phẩm</span>
                  <button type="button" className={buttonSecondary} onClick={openBulkEdit} disabled={isSaving}><Edit3 className="h-3.5 w-3.5" /> Sửa hàng loạt</button>
                  <button type="button" className={buttonDanger} onClick={() => deleteProducts(selectedProducts)} disabled={isSaving}><Trash2 className="h-3.5 w-3.5" /> Xóa đã chọn</button>
                  <button type="button" className={buttonSecondary} onClick={() => { setSelectedProductIds(new Set()); setSelectedProductMeta({}); }}>Bỏ chọn</button>
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-950/70 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-9 px-3 py-2.5"><input type="checkbox" className={checkboxClass} checked={allVisibleProductsSelected} onChange={(event) => toggleCurrentProductPage(event.target.checked)} aria-label="Chọn sản phẩm trên trang" /></th>
                    <th className="px-3 py-2.5">Sản phẩm</th>
                    <th className="px-3 py-2.5">Nguồn</th>
                    <th className="px-3 py-2.5">Giá</th>
                    <th className="px-3 py-2.5">Danh mục</th>
                    <th className="px-3 py-2.5">Trạng thái</th>
                    <th className="px-3 py-2.5">Phân loại Done</th>
                    <th className="px-3 py-2.5">Phiên bản</th>
                    <th className="px-3 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {isLoading || isProductListLoading ? (
                    <tr><td colSpan={9} className="px-3 py-12 text-center text-slate-500"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Đang tải dữ liệu...</td></tr>
                  ) : visibleUsedProducts.length === 0 ? (
                    <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-500">Chưa có sản phẩm hoặc không khớp bộ lọc.</td></tr>
                  ) : visibleUsedProducts.map((product) => {
                    const imageUrl = getImageUrl(product.images);
                    const selected = selectedProductIds.has(product._id);
                    return (
                      <tr key={product._id} className={`transition hover:bg-slate-800/50 ${selected ? "bg-sky-950/20" : ""}`}>
                        <td className="px-3 py-2.5"><input type="checkbox" className={checkboxClass} checked={selected} onChange={() => toggleProductSelection(product._id)} aria-label={`Chọn ${product.name}`} /></td>
                        <td className="max-w-sm px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-800 bg-slate-950">
                              {imageUrl ? <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon className="h-4 w-4 text-slate-600" />}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-slate-100">{product.name}</div>
                              <div className="mt-0.5 max-w-64 truncate font-mono text-[11px] text-sky-400">/{product.slug}</div>
                              <div className="mt-0.5 text-[10px] text-slate-500">Sửa gần nhất: {formatDate(product.updatedAt)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-36 px-3 py-2.5">
                          {product.sourceProductId ? <code className="block truncate text-[10px] text-slate-400" title={product.sourceProductId}>{product.sourceProductId}</code> : <span className="text-xs text-slate-600">Thủ công</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-emerald-300">{formatPrice(product.price, product.priceText)}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-300">{product.category || "Chưa phân loại"}</td>
                        <td className="px-3 py-2.5"><span className={`rounded px-2 py-1 text-[10px] font-medium ${product.status === "active" || !product.status ? "bg-emerald-950/70 text-emerald-300" : product.status === "draft" ? "bg-amber-950/70 text-amber-300" : "bg-slate-800 text-slate-300"}`}>{product.status || "active"}</span></td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`rounded px-2 py-1 text-[10px] font-medium ${product.isDone ? "bg-emerald-950/70 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                              {product.isDone ? "Done" : "Chưa Done"}
                            </span>
                            <button
                              type="button"
                              onClick={() => void toggleProductDone(product)}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition disabled:opacity-50 ${product.isDone ? "border-slate-700 text-slate-400 hover:bg-slate-800" : "border-emerald-800 text-emerald-300 hover:bg-emerald-950/60"}`}
                              title={product.isDone ? "Bỏ đánh dấu Done" : "Đánh dấu Done"}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {product.isDone ? "Bỏ Done" : "Đánh dấu Done"}
                            </button>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span className="rounded bg-slate-800 px-1.5 py-1 text-[10px] text-slate-300">v{product.__v ?? 0}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => openEditProduct(product)} className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-sky-300" aria-label={`Sửa ${product.name}`} title="Sửa"><Edit3 className="h-4 w-4" /></button>
                            <button type="button" onClick={() => deleteProducts([product])} className="rounded-md p-2 text-slate-400 hover:bg-rose-950 hover:text-rose-300" aria-label={`Xóa ${product.name}`} title="Xóa"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar total={productResultCount} page={productPage} onPageChange={setProductPage} />
          </section>
        ) : null}

        {activeTab === "categories" ? (
          <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
            <div className="flex flex-col gap-2 border-b border-slate-800 p-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 xl:w-80">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className={`${inputClass} pl-8`} value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Tìm tên, slug, danh mục cha..." />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto text-xs text-slate-500">{categoryTree.length} danh mục cha · {Math.max(0, flatCategories.length - categoryTree.length)} danh mục con</span>
                <button type="button" className={buttonPrimary} onClick={() => openCreateCategory(null)}><Plus className="h-4 w-4" /> Thêm danh mục cha</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-950/70 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr><th className="px-3 py-2.5">Tên danh mục</th><th className="px-3 py-2.5">Slug</th><th className="px-3 py-2.5">Danh mục cha</th><th className="px-3 py-2.5">Thứ tự</th><th className="px-3 py-2.5">Cập nhật</th><th className="px-3 py-2.5 text-right">Thao tác</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {isLoading ? (
                    <tr><td colSpan={6} className="px-3 py-12 text-center text-slate-500"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Đang tải danh mục...</td></tr>
                  ) : visibleCategories.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">Chưa có danh mục phù hợp.</td></tr>
                  ) : visibleCategories.map((category) => {
                    const parent = category.parentSlug ? parentCategoryBySlug.get(category.parentSlug) : undefined;
                    const isParent = !category.parentSlug;
                    return (
                      <tr key={category._id} className="transition hover:bg-slate-800/50">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {isParent ? <Layers3 className="h-4 w-4 shrink-0 text-sky-400" /> : <ChevronRight className="ml-4 h-4 w-4 shrink-0 text-slate-500" />}
                            <div className="min-w-0">
                              <div className="font-medium text-slate-100">{category.name}</div>
                              {category.description ? <div className="max-w-sm truncate text-[11px] text-slate-500">{category.description}</div> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><code className="text-xs text-sky-300">{category.slug}</code></td>
                        <td className="px-3 py-2.5 text-xs text-slate-400">{parent?.name || (isParent ? "— Danh mục gốc —" : category.parentSlug)}</td>
                        <td className="px-3 py-2.5 text-xs tabular-nums text-slate-400">{category.order ?? 0}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-slate-500">{formatDate(category.updatedAt)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isParent ? <button type="button" onClick={() => openCreateCategory(category.slug)} className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-emerald-300" aria-label={`Thêm danh mục con cho ${category.name}`} title="Thêm danh mục con"><Plus className="h-4 w-4" /></button> : null}
                            <button type="button" onClick={() => openEditCategory(category)} className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-sky-300" aria-label={`Sửa ${category.name}`} title="Sửa"><Edit3 className="h-4 w-4" /></button>
                            <button type="button" onClick={() => deleteCategory(category)} className="rounded-md p-2 text-slate-400 hover:bg-rose-950 hover:text-rose-300" aria-label={`Xóa ${category.name}`} title="Xóa"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar total={filteredCategories.length} page={categoryPage} onPageChange={setCategoryPage} />
          </section>
        ) : null}

        <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <span>Used Products Admin · Theo dõi phiên bản dữ liệu bằng `__v` của Mongoose.</span>
          <span>{isSaving ? "Đang xử lý thay đổi…" : "Sẵn sàng"}</span>
        </footer>
      </div>

      {productForm ? (
        <ModalShell
          title={productForm._id ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}
          description={productForm._id ? `Slug hiện tại: ${productForm.slug || "—"}` : "Slug được API tạo từ tên sản phẩm."}
          onClose={() => setProductForm(null)}
        >
          <form className="space-y-3" onSubmit={(event) => void handleSaveProduct(event)}>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-300">Tên sản phẩm <span className="text-rose-400">*</span></span>
              <input className={inputClass} required autoFocus value={productForm.name} onChange={(event) => setProductForm((current) => current ? { ...current, name: event.target.value } : current)} placeholder="Nhập tên sản phẩm" />
            </label>
            {productForm._id ? <div className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-500">Slug: <code className="text-sky-300">{productForm.slug}</code></div> : null}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-300">ID sản phẩm nguồn</span>
              <input className={inputClass} value={productForm.sourceProductId} onChange={(event) => setProductForm((current) => current ? { ...current, sourceProductId: event.target.value } : current)} placeholder="Để trống nếu tạo thủ công" />
            </label>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">Giá (VNĐ)</span>
                <input className={inputClass} type="number" min={0} step="1" value={productForm.price} onChange={(event) => setProductForm((current) => current ? { ...current, price: event.target.value === "" ? 0 : Number(event.target.value) } : current)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">Giá hiển thị</span>
                <input className={inputClass} value={productForm.priceText} onChange={(event) => setProductForm((current) => current ? { ...current, priceText: event.target.value } : current)} placeholder="Ví dụ: Liên hệ" />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">Danh mục</span>
                <select className={selectClass} value={productForm.categoryId} onChange={(event) => setProductForm((current) => current ? { ...current, categoryId: event.target.value } : current)}>
                  <option value="">Chưa phân loại</option>
                  {flatCategories.map((category) => {
                    const parent = category.parentSlug ? parentCategoryBySlug.get(category.parentSlug) : undefined;
                    return <option key={category._id} value={category._id}>{parent ? `${parent.name} / ${category.name}` : category.name}</option>;
                  })}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">Trạng thái</span>
                <select className={selectClass} value={productForm.status} onChange={(event) => setProductForm((current) => current ? { ...current, status: event.target.value } : current)}>
                  <option value="active">Active</option><option value="draft">Draft</option><option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2.5">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={productForm.isDone}
                onChange={(event) => setProductForm((current) => current ? { ...current, isDone: event.target.checked } : current)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-200">Đánh dấu sản phẩm Done</span>
                <span className="block text-[11px] text-slate-500">Khi bật, API tự ghi nhận thời điểm hoàn thành.</span>
              </span>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-300">Mô tả</span>
              <textarea className={`${inputClass} resize-y`} rows={3} value={productForm.description} onChange={(event) => setProductForm((current) => current ? { ...current, description: event.target.value } : current)} placeholder="Mô tả sản phẩm" />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button type="button" className={buttonSecondary} onClick={() => setProductForm(null)}>Hủy</button>
              <button type="submit" className={buttonPrimary} disabled={isSaving}>{isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Lưu sản phẩm</button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {bulkEditOpen ? (
        <ModalShell
          title={`Sửa hàng loạt · ${selectedProducts.length} sản phẩm`}
          description="Chỉ các trường được tích chọn mới được ghi đè lên những sản phẩm đã chọn."
          onClose={() => setBulkEditOpen(false)}
        >
          <form className="space-y-3" onSubmit={(event) => void handleBulkEdit(event)}>
            <div className="space-y-2">
              <label className="flex items-start gap-2 rounded-md border border-slate-800 p-2.5">
                <input type="checkbox" className={`${checkboxClass} mt-0.5`} checked={bulkEdit.applyCategory} onChange={(event) => setBulkEdit((current) => ({ ...current, applyCategory: event.target.checked }))} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">Cập nhật danh mục</span><span className="mt-1 block"><select className={selectClass} disabled={!bulkEdit.applyCategory} value={bulkEdit.categoryId} onChange={(event) => setBulkEdit((current) => ({ ...current, categoryId: event.target.value }))}><option value="">Chưa phân loại</option>{flatCategories.map((category) => { const parent = category.parentSlug ? parentCategoryBySlug.get(category.parentSlug) : undefined; return <option key={category._id} value={category._id}>{parent ? `${parent.name} / ${category.name}` : category.name}</option>; })}</select></span></span>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-slate-800 p-2.5">
                <input type="checkbox" className={`${checkboxClass} mt-0.5`} checked={bulkEdit.applyStatus} onChange={(event) => setBulkEdit((current) => ({ ...current, applyStatus: event.target.checked }))} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">Cập nhật trạng thái</span><span className="mt-1 block"><select className={selectClass} disabled={!bulkEdit.applyStatus} value={bulkEdit.status} onChange={(event) => setBulkEdit((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="draft">Draft</option><option value="inactive">Inactive</option></select></span></span>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-slate-800 p-2.5">
                <input type="checkbox" className={`${checkboxClass} mt-0.5`} checked={bulkEdit.applyPrice} onChange={(event) => setBulkEdit((current) => ({ ...current, applyPrice: event.target.checked }))} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">Cập nhật giá (VNĐ)</span><input className={`${inputClass} mt-1`} type="number" min={0} step="1" disabled={!bulkEdit.applyPrice} value={bulkEdit.price} onChange={(event) => setBulkEdit((current) => ({ ...current, price: event.target.value }))} placeholder="Nhập giá áp dụng cho tất cả" /></span>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-slate-800 p-2.5">
                <input type="checkbox" className={`${checkboxClass} mt-0.5`} checked={bulkEdit.applyPriceText} onChange={(event) => setBulkEdit((current) => ({ ...current, applyPriceText: event.target.checked }))} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">Cập nhật giá hiển thị</span><input className={`${inputClass} mt-1`} disabled={!bulkEdit.applyPriceText} value={bulkEdit.priceText} onChange={(event) => setBulkEdit((current) => ({ ...current, priceText: event.target.value }))} placeholder="Ví dụ: Liên hệ" /></span>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-slate-800 p-2.5">
                <input type="checkbox" className={`${checkboxClass} mt-0.5`} checked={bulkEdit.applyDescription} onChange={(event) => setBulkEdit((current) => ({ ...current, applyDescription: event.target.checked }))} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">Ghi đè mô tả</span><textarea className={`${inputClass} mt-1 resize-y`} rows={2} disabled={!bulkEdit.applyDescription} value={bulkEdit.description} onChange={(event) => setBulkEdit((current) => ({ ...current, description: event.target.value }))} placeholder="Mô tả mới áp dụng cho tất cả" /></span>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-slate-800 p-2.5">
                <input type="checkbox" className={`${checkboxClass} mt-0.5`} checked={bulkEdit.applyDone} onChange={(event) => setBulkEdit((current) => ({ ...current, applyDone: event.target.checked }))} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-200">Phân loại Done cho các sản phẩm đã chọn</span>
                  <select className={`${selectClass} mt-1`} disabled={!bulkEdit.applyDone} value={bulkEdit.isDone ? "done" : "not-done"} onChange={(event) => setBulkEdit((current) => ({ ...current, isDone: event.target.value === "done" }))}>
                    <option value="done">Đã Done</option>
                    <option value="not-done">Chưa Done</option>
                  </select>
                </span>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button type="button" className={buttonSecondary} onClick={() => setBulkEditOpen(false)}>Hủy</button>
              <button type="submit" className={buttonPrimary} disabled={isSaving || selectedProducts.length === 0}>{isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />} Áp dụng thay đổi</button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {categoryForm ? (
        <ModalShell
          title={categoryForm._id ? "Chỉnh sửa danh mục" : categoryForm.parentSlug ? "Thêm danh mục con" : "Thêm danh mục cha"}
          description="Slug dùng để tra cứu danh mục; danh mục con được gắn với slug của danh mục cha."
          onClose={() => setCategoryForm(null)}
        >
          <form className="space-y-3" onSubmit={(event) => void handleSaveCategory(event)}>
            <label className="block space-y-1"><span className="text-xs font-medium text-slate-300">Tên danh mục <span className="text-rose-400">*</span></span><input className={inputClass} autoFocus required value={categoryForm.name} onChange={(event) => setCategoryForm((current) => current ? { ...current, name: event.target.value } : current)} placeholder="Tên danh mục" /></label>
            <label className="block space-y-1"><span className="text-xs font-medium text-slate-300">Slug</span><input className={inputClass} value={categoryForm.slug} onChange={(event) => setCategoryForm((current) => current ? { ...current, slug: event.target.value } : current)} placeholder="Để trống để API tạo từ tên" /></label>
            <label className="block space-y-1"><span className="text-xs font-medium text-slate-300">Danh mục cha</span><select className={selectClass} value={categoryForm.parentSlug || ""} onChange={(event) => setCategoryForm((current) => current ? { ...current, parentSlug: event.target.value || null } : current)}><option value="">Danh mục gốc</option>{categoryTree.filter((category) => category._id !== categoryForm._id).map((category) => <option key={category._id} value={category.slug}>{category.name}</option>)}</select></label>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <label className="block space-y-1"><span className="text-xs font-medium text-slate-300">Thứ tự</span><input className={inputClass} type="number" value={categoryForm.order} onChange={(event) => setCategoryForm((current) => current ? { ...current, order: Number(event.target.value) } : current)} /></label>
              <label className="block space-y-1"><span className="text-xs font-medium text-slate-300">Mô tả</span><input className={inputClass} value={categoryForm.description} onChange={(event) => setCategoryForm((current) => current ? { ...current, description: event.target.value } : current)} placeholder="Mô tả ngắn" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button type="button" className={buttonSecondary} onClick={() => setCategoryForm(null)}>Hủy</button>
              <button type="submit" className={buttonPrimary} disabled={isSaving}>{isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Lưu danh mục</button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {deleteTarget ? (
        <ModalShell
          title={deleteTarget.kind === "products" ? `Xóa ${deleteTarget.items.length} sản phẩm?` : `Xóa danh mục “${deleteTarget.item.name}”?`}
          description={deleteTarget.kind === "category" && !deleteTarget.item.parentSlug ? "Các danh mục con trực thuộc cũng sẽ bị xóa." : "Thao tác này không thể tự động hoàn tác."}
          width="max-w-lg"
          onClose={() => setDeleteTarget(null)}
        >
          {deleteTarget.kind === "products" ? (
            <div className="mb-3 max-h-48 overflow-y-auto rounded-md border border-slate-800 divide-y divide-slate-800">
              {deleteTarget.items.slice(0, 12).map((product) => <div key={product._id} className="px-3 py-2 text-sm text-slate-300">{product.name}</div>)}
              {deleteTarget.items.length > 12 ? <div className="px-3 py-2 text-xs text-slate-500">Và {deleteTarget.items.length - 12} sản phẩm khác…</div> : null}
            </div>
          ) : (
            <p className="mb-3 text-sm text-slate-300">Danh mục: <span className="font-medium text-white">{deleteTarget.item.name}</span> <code className="text-sky-300">/{deleteTarget.item.slug}</code></p>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
            <button type="button" className={buttonSecondary} onClick={() => setDeleteTarget(null)}>Hủy</button>
            <button type="button" className={buttonDanger} onClick={() => void handleConfirmDelete()} disabled={isSaving}><Trash2 className="h-4 w-4" /> Xác nhận xóa</button>
          </div>
        </ModalShell>
      ) : null}
    </main>
  );
}
