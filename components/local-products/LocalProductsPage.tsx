"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Geist } from "next/font/google";
import {
  FiArrowUp,
  FiArchive,
  FiBattery,
  FiBell,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiClipboard,
  FiCopy,
  FiDatabase,
  FiDownload,
  FiEdit3,
  FiFileText,
  FiImage,
  FiMenu,
  FiMonitor,
  FiPhone,
  FiPlus,
  FiRefreshCcw,
  FiRotateCw,
  FiSearch,
  FiShare2,
  FiTrash2,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";
import { toast, ToastContainer, type ToastOptions } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type ProductImage = {
  id: string;
  name: string;
  originalName: string;
  dataUrl: string;
  size: number;
  type: string;
  createdAt: string;
  publicId: string;
  assetId: string;
  version: number;
  format: string;
  width: number;
  height: number;
  bytes: number;
  etag: string;
  sha256: string;
  resourceType: "image";
};

type ProductContentType = "technology" | "realEstate";

type LocalProduct = {
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
  images: ProductImage[];
  internalImages: ProductImage[];
  isDone: boolean;
  doneAt: string;
  createdAt: string;
  updatedAt: string;
};

type ProductDraft = {
  name: string;
  description: string;
  pin: string;
  status: string;
  priceText: string;
  category: string;
  contentType: ProductContentType;
  realEstateComment: string;
  images: ProductImage[];
  internalImages: ProductImage[];
};

type ProductImageField = "images" | "internalImages";

const DRAFT_IMAGE_ID_DATA_TYPE =
  "application/x-local-product-draft-image-id";
const DRAFT_IMAGE_FIELD_DATA_TYPE =
  "application/x-local-product-draft-image-field";

type ContactOption = {
  id: string;
  text: string;
};

type FacebookPageOption = {
  id: string;
  name: string;
  assetId: string;
};

type FacebookGroupOption = {
  id: string;
  name: string;
  category: string;
  url: string;
};

type FacebookDuplicatePostOption = {
  id: string;
  name: string;
  category: string;
  url: string;
};

type AutoCopyShareMode = "post" | "comment";
type CategoryDropPosition = "before" | "after";

type AutoCopyContentSource = {
  postText: string;
  commentText: string;
};

type CategoryColorMap = Record<string, string>;

type CategoryColorStyle = CSSProperties & {
  "--category-color": string;
  "--category-contrast": string;
};

type GlobalSettings = {
  commonDescription: string;
  globalNote: string;
  contactOptions: ContactOption[];
  facebookPages: FacebookPageOption[];
  facebookDuplicatePosts: FacebookDuplicatePostOption[];
  facebookGroups: FacebookGroupOption[];
  selectedFacebookGroupIds: string[];
  categoryColors: CategoryColorMap;
  categoryOrder: string[];
  autoCopyShareMode: AutoCopyShareMode;
  updatedAt: string;
};

type DevicePreferences = {
  includeSocialTags: boolean;
  isCopyNfkcEnabled: boolean;
  selectedContactId: string;
};

type ExportPayload = {
  version: 21;
  settings: GlobalSettings;
  products: LocalProduct[];
  scheduleConfig: ScheduleConfig;
  scheduleAssignments: ScheduleAssignmentMap;
  postedRecords: PostedRecord[];
};

type ParsedImportPayload = {
  settings?: GlobalSettings;
  products: LocalProduct[];
  scheduleConfig?: ScheduleConfig;
  scheduleAssignments?: ScheduleAssignmentMap;
  postedRecords?: PostedRecord[];
};

type ConfirmTone = "default" | "danger" | "warning";

type ConfirmRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  secondaryLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  onSecondary?: () => void | Promise<void>;
};

type ScheduleConfig = {
  dateFrom: string;
  dateTo: string;
  startTime: string;
  endTime: string;
  gapHours: number;
  taskCount: number;
  taskNames: string[];
  selectedCategories: string[];
};

type ScheduleSlot = {
  id: string;
  date: string;
  time: string;
  productId: string;
  productName: string;
  category: string;
  image?: string;
  images: ProductImage[];
  priceText: string;
  description: string;
  postText: string;
};

type ScheduleWarning = {
  type:
  | "emptyProducts"
  | "emptyCategory"
  | "notEnoughProducts"
  | "overflow"
  | "invalidTime";
  message: string;
};

type BuildScheduleResult = {
  slots: ScheduleSlot[];
  warnings: ScheduleWarning[];
};

type PostedRecord = {
  slotId: string;
  postedAt: string;
};

type ScheduleAssignmentMap = Record<string, string>;

type AlbumSource = {
  productId: string;
  title: string;
  description: string;
  priceText: string;
  contentType: ProductContentType;
  realEstateComment: string;
  images: ProductImage[];
  internalImages?: ProductImage[];
};

type ModalName =
  | "product"
  | "productList"
  | "schedule"
  | "hourlyNotification"
  | "globalNote"
  | "globalDescription"
  | "shareCopyOption"
  | "contactSelection"
  | "contact"
  | "facebookPages"
  | "facebookDuplicatePosts"
  | "importExport"
  | "slotDetail"
  | "imageAlbum"
  | "imageDownload"
  | "localImageManager"
  | "";

type CategoryTab = "all" | string;

type DownloadMode = "single" | "multiple";

type DownloadRequest = {
  productIds?: string[];
  productIdsWhenSkippingInternal?: string[];
  title: string;
  description: string;
  mode: DownloadMode;
  images: ProductImage[];
  internalImages?: ProductImage[];
  startIndex: number;
  copyContent?: AutoCopyContentSource;
};

type SelectedDescriptionCopy = {
  productId: string;
  text: string;
};

type NativeShareData = {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
};

type NativeShareNavigator = Navigator & {
  share?: (data: NativeShareData) => Promise<void>;
  canShare?: (data: NativeShareData) => boolean;
};

type ShareContentMode = "post" | "comment" | "imagesOnly";

type ShareDialogStep = "share" | "facebookGroup";

type ShareRequest = {
  productId: string;
  title: string;
  images: ProductImage[];
  internalImages?: ProductImage[];
  postText: string;
  commentText: string;
  shareKey: string;
  successMessage: string;
};

type PreparedBackup = {
  blob: Blob;
  filename: string;
  label: string;
};

type DocumentPictureInPictureApi = {
  window: Window | null;
  requestWindow: () => Promise<Window>;
};

type WindowWithDocumentPictureInPicture = Window & {
  documentPictureInPicture?: DocumentPictureInPictureApi;
};

type ClipboardItemConstructor = new (
  items: Record<string, Blob | PromiseLike<Blob>>,
) => ClipboardItem;

type ClipboardCapableWindow = Window & {
  ClipboardItem?: ClipboardItemConstructor;
};

type ScreenWithAvailablePosition = Screen & {
  availLeft?: number;
  availTop?: number;
};

const API_BASE_URL = "/api/local-products";
const DEVICE_PREFERENCES_STORAGE_KEY =
  "local-products-device-preferences-v1";
const defaultDevicePreferences: DevicePreferences = {
  includeSocialTags: false,
  isCopyNfkcEnabled: false,
  selectedContactId: "",
};

const normalizeDevicePreferences = (value: unknown): DevicePreferences => {
  if (!value || typeof value !== "object") return defaultDevicePreferences;

  const record = value as Record<string, unknown>;

  return {
    includeSocialTags: record.includeSocialTags === true,
    isCopyNfkcEnabled: record.isCopyNfkcEnabled === true,
    selectedContactId:
      typeof record.selectedContactId === "string"
        ? record.selectedContactId.trim()
        : "",
  };
};

const loadDevicePreferences = (): DevicePreferences => {
  if (typeof window === "undefined") return defaultDevicePreferences;

  try {
    const raw = window.localStorage.getItem(DEVICE_PREFERENCES_STORAGE_KEY);
    return raw
      ? normalizeDevicePreferences(JSON.parse(raw) as unknown)
      : defaultDevicePreferences;
  } catch {
    return defaultDevicePreferences;
  }
};

const saveDevicePreferences = (preferences: DevicePreferences): void => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      DEVICE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    return;
  }
};

const DOWNLOADED_PRODUCT_IDS_SESSION_KEY =
  "local_product_meta_downloaded_product_ids_v1";
const FACEBOOK_SEARCH_BASE_URL = "https://www.facebook.com/search/top";
const FACEBOOK_RECENT_POSTS_FILTER =
  "eyJyZWNlbnRfcG9zdHM6MCI6IntcIm5hbWVcIjpcInJlY2VudF9wb3N0c1wiLFwiYXJnc1wiOlwiXCJ9In0=";
const DEFAULT_FACEBOOK_SEARCH_QUERY = "";
const FACEBOOK_SEARCH_POPUP_COUNT = 4;

const loadDownloadedProductIds = (): Set<string> => {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = window.sessionStorage.getItem(
      DOWNLOADED_PRODUCT_IDS_SESSION_KEY,
    );
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return new Set<string>();

    return new Set(
      parsed.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      ),
    );
  } catch {
    return new Set<string>();
  }
};

const saveDownloadedProductIds = (productIds: Set<string>): void => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      DOWNLOADED_PRODUCT_IDS_SESSION_KEY,
      JSON.stringify(Array.from(productIds)),
    );
  } catch {
    return;
  }
};

const createFacebookRecentPostsSearchUrl = (query: string): string => {
  const searchUrl = new URL(FACEBOOK_SEARCH_BASE_URL);

  searchUrl.searchParams.set("q", query.trim());
  searchUrl.searchParams.set("filters", FACEBOOK_RECENT_POSTS_FILTER);

  return searchUrl.toString();
};

const emptyDraft: ProductDraft = {
  name: "",
  description: "",
  pin: "",
  status: "",
  priceText: "",
  category: "",
  contentType: "technology",
  realEstateComment: "",
  images: [],
  internalImages: [],
};

const defaultSettings: GlobalSettings = {
  commonDescription: "",
  globalNote: "",
  contactOptions: [],
  facebookPages: [],
  facebookDuplicatePosts: [],
  facebookGroups: [],
  selectedFacebookGroupIds: [],
  categoryColors: {},
  categoryOrder: [],
  autoCopyShareMode: "post",
  updatedAt: "",
};

const defaultScheduleConfig: ScheduleConfig = {
  dateFrom: "",
  dateTo: "",
  startTime: "08:00",
  endTime: "22:00",
  gapHours: 3,
  taskCount: 1,
  taskNames: ["Task 1"],
  selectedCategories: [],
};

const iconClassName =
  "h-3.5 w-3.5 shrink-0 transition-transform duration-300 group-hover:scale-110";

const productActionButtonBaseClassName =
  "group relative flex min-h-7 items-center justify-center gap-1 overflow-hidden whitespace-nowrap border px-1.5 py-1 text-[9px] font-black tracking-[0.025em] [clip-path:polygon(6px_0,calc(100%_-_6px)_0,100%_6px,100%_calc(100%_-_6px),calc(100%_-_6px)_100%,6px_100%,0_calc(100%_-_6px),0_6px)] transition-[color,background-color,border-color,transform,box-shadow,filter] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8c99f]/[0.45] active:scale-[0.97] active:brightness-95";

const headerActionButtonBaseClassName =
  "group relative flex min-h-5 cursor-pointer items-center justify-start gap-1 overflow-hidden whitespace-nowrap border p-1.5 text-[10px] font-semibold [clip-path:polygon(7px_0,calc(100%_-_7px)_0,100%_7px,100%_calc(100%_-_7px),calc(100%_-_7px)_100%,7px_100%,0_calc(100%_-_7px),0_7px)] transition-[color,background-color,border-color,transform,box-shadow,filter] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8c99f]/[0.45] active:scale-[0.97] active:brightness-95 xl:min-w-0 xl:w-full xl:justify-center";

const headerNeutralButtonClassName =
  "border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] hover:-translate-y-px hover:border-[#d8c99f]/40 hover:bg-[#d8c99f]/[0.075] hover:text-[#f3e7c6] hover:shadow-[0_8px_20px_rgba(0,0,0,0.26)]";

const headerPrimaryButtonClassName =
  "border-[#f0e3c0]/80 bg-[linear-gradient(135deg,#f2e8cd_0%,#c9b47c_52%,#eadcb8_100%)] !text-[#17130a] shadow-[inset_0_1px_0_rgba(255,255,255,0.62),0_6px_18px_rgba(190,164,99,0.16)] hover:border-[#fff4d7] hover:brightness-105";

const headerActiveButtonClassName =
  "border-[#e8d9ae]/75 bg-[linear-gradient(135deg,#e8dbb9_0%,#bda66d_100%)] !text-[#18140b] shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_5px_16px_rgba(190,164,99,0.13)] hover:border-[#f5e8c5] hover:brightness-105";

const albumActionButtonBaseClassName =
  "group flex min-h-8 shrink-0 items-center justify-center gap-1 overflow-hidden border px-1.5 py-1 text-[9px] font-black tracking-[0.025em] transition-[color,background-color,border-color,transform,box-shadow,filter] duration-200 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40";

const scheduleFieldClassName =
  "rounded-md border border-white/10 bg-slate-950/80 p-2 text-xs text-white outline-none transition focus:border-cyan-300/60";

const secondaryActionButtonClassName =
  "flex items-center justify-center gap-2 rounded-md border border-white/10 bg-slate-800 p-2 whitespace-nowrap text-xs font-bold text-white transition hover:bg-slate-700";

const compactLuxuryDialogClassName =
  "luxury-dialog w-full max-w-md border p-3";

const fullCardItemNameClassName =
  "min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]";

const getActiveInteractionWindow = (): Window => {
  if (typeof window === "undefined") {
    throw new Error("Cửa sổ trình duyệt chưa sẵn sàng");
  }

  const browserWindow = window as WindowWithDocumentPictureInPicture;
  const pictureInPictureWindow = browserWindow.documentPictureInPicture?.window;

  if (pictureInPictureWindow && !pictureInPictureWindow.closed) {
    return pictureInPictureWindow;
  }

  return window;
};

type FacebookWindowOpenMode = "popup" | "tab";

type FacebookWindowOpenResult = {
  window: Window | null;
  mode: FacebookWindowOpenMode;
  usedPopupFallback: boolean;
};

const focusOpenedWindow = (openedWindow: Window): void => {
  try {
    openedWindow.opener = null;
  } catch {
    // Cross-origin WindowProxy có thể không cho thay đổi opener.
  }

  try {
    openedWindow.focus();
  } catch {
    // focus() chỉ tối ưu UX, không ảnh hưởng kết quả điều hướng.
  }
};

const hasActivePictureInPictureWindow = (): boolean => {
  if (typeof window === "undefined") return false;

  const browserWindow = window as WindowWithDocumentPictureInPicture;
  const pictureInPictureWindow = browserWindow.documentPictureInPicture?.window;

  return Boolean(pictureInPictureWindow && !pictureInPictureWindow.closed);
};

const openFacebookPopupWindow = (
  openerWindow: Window,
  url: string,
  popupId: string,
): FacebookWindowOpenResult => {
  // Khi Local Product Manager đang ở Document PiP, mở Share bằng _blank
  // để Chrome xử lý như tab bình thường thay vì sinh thêm popup từ PiP.
  if (hasActivePictureInPictureWindow()) {
    const newTab = openerWindow.open(url, "_blank");

    if (!newTab) {
      return { window: null, mode: "tab", usedPopupFallback: false };
    }

    focusOpenedWindow(newTab);
    return { window: newTab, mode: "tab", usedPopupFallback: false };
  }

  const safePopupId = popupId.replace(/[^a-zA-Z0-9_-]/gu, "-");
  const popupName = `facebook-${safePopupId}-${crypto.randomUUID()}`;

  // Chế độ bình thường luôn ưu tiên cửa sổ popup riêng.
  // Không truyền width/height/position; Chrome tự quyết định kích thước.
  const popupWindow = openerWindow.open(url, popupName, "popup");

  if (popupWindow) {
    focusOpenedWindow(popupWindow);
    return { window: popupWindow, mode: "popup", usedPopupFallback: false };
  }

  // Popup bị chặn/lỗi: thử _blank đúng theo fallback mong muốn.
  const fallbackTab = openerWindow.open(url, "_blank");

  if (!fallbackTab) {
    return { window: null, mode: "tab", usedPopupFallback: true };
  }

  focusOpenedWindow(fallbackTab);
  return { window: fallbackTab, mode: "tab", usedPopupFallback: true };
};

const IMPORT_BACKUP_INPUT_ID = "local-products-backup-input";
const RESTORE_BACKUP_AFTER_RELOAD_KEY =
  "local-products-restore-backup-after-reload";
type HourlyNotificationConfig = {
  enabled: boolean;
  minuteOffset: number;
  intervalHours: number;
  dailyLimit: number;
  anchorAt: string;
};

const HOURLY_NOTIFICATION_ENABLED_KEY =
  "local-products-hourly-notification-enabled-v1";
const HOURLY_NOTIFICATION_CONFIG_KEY =
  "local-products-hourly-notification-config-v2";
const HOURLY_NOTIFICATION_LAST_SLOT_KEY =
  "local-products-hourly-notification-last-slot-v2";
const HOURLY_NOTIFICATION_MAX_LATE_MS = 90_000;

const defaultHourlyNotificationConfig: HourlyNotificationConfig = {
  enabled: false,
  minuteOffset: 0,
  intervalHours: 1,
  dailyLimit: 0,
  anchorAt: "",
};

const clampInteger = (value: number, minimum: number, maximum: number): number => {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
};

const normalizeHourlyNotificationConfig = (
  value: unknown,
): HourlyNotificationConfig => {
  if (typeof value !== "object" || value === null) {
    return defaultHourlyNotificationConfig;
  }

  const record = value as Record<string, unknown>;

  return {
    enabled: record.enabled === true,
    minuteOffset:
      typeof record.minuteOffset === "number"
        ? clampInteger(record.minuteOffset, 0, 59)
        : 0,
    intervalHours:
      typeof record.intervalHours === "number"
        ? clampInteger(record.intervalHours, 1, 24)
        : 1,
    dailyLimit:
      typeof record.dailyLimit === "number"
        ? clampInteger(record.dailyLimit, 0, 24)
        : 0,
    anchorAt: typeof record.anchorAt === "string" ? record.anchorAt : "",
  };
};

const loadHourlyNotificationConfig = (): HourlyNotificationConfig => {
  if (typeof window === "undefined") return defaultHourlyNotificationConfig;

  const rawConfig = window.localStorage.getItem(HOURLY_NOTIFICATION_CONFIG_KEY);

  if (rawConfig) {
    try {
      return normalizeHourlyNotificationConfig(JSON.parse(rawConfig) as unknown);
    } catch {
      return defaultHourlyNotificationConfig;
    }
  }

  const legacyEnabled =
    window.localStorage.getItem(HOURLY_NOTIFICATION_ENABLED_KEY) === "1";

  return {
    ...defaultHourlyNotificationConfig,
    enabled: legacyEnabled,
  };
};

const saveHourlyNotificationConfig = (
  config: HourlyNotificationConfig,
): void => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    HOURLY_NOTIFICATION_CONFIG_KEY,
    JSON.stringify(config),
  );
  window.localStorage.setItem(
    HOURLY_NOTIFICATION_ENABLED_KEY,
    config.enabled ? "1" : "0",
  );
};

const formatLocalClockTime = (date: Date): string => {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
};

const formatLocalDateTime = (date: Date): string => {
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1,
  ).padStart(2, "0")} ${formatLocalClockTime(date)}`;
};

const createScheduledNotificationKey = (date: Date): string => {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join("-");
};

const createNextNotificationAnchor = (
  now: Date,
  minuteOffset: number,
): Date => {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(clampInteger(minuteOffset, 0, 59));

  if (next.getTime() <= now.getTime()) {
    next.setHours(next.getHours() + 1);
  }

  return next;
};

const getNextScheduledNotification = (
  now: Date,
  config: HourlyNotificationConfig,
): Date | null => {
  const anchorMs = new Date(config.anchorAt).getTime();

  if (!Number.isFinite(anchorMs)) return null;

  const intervalMs =
    clampInteger(config.intervalHours, 1, 24) * 60 * 60 * 1000;
  const nowMs = now.getTime();
  let occurrenceIndex = Math.max(
    0,
    Math.ceil((nowMs - anchorMs) / intervalMs),
  );

  for (let attempts = 0; attempts < 24 * 31; attempts += 1) {
    const candidateMs = anchorMs + occurrenceIndex * intervalMs;
    const candidate = new Date(candidateMs);

    if (candidateMs > nowMs) {
      if (config.dailyLimit <= 0) return candidate;

      const dayStartMs = new Date(
        candidate.getFullYear(),
        candidate.getMonth(),
        candidate.getDate(),
        0,
        0,
        0,
        0,
      ).getTime();
      const firstIndexInDay = Math.max(
        0,
        Math.ceil((dayStartMs - anchorMs) / intervalMs),
      );
      const ordinalInDay = occurrenceIndex - firstIndexInDay + 1;

      if (ordinalInDay <= config.dailyLimit) return candidate;
    }

    occurrenceIndex += 1;
  }

  return null;
};

const LOADING_PARTICLES = Array.from({ length: 32 }, (_, index) => ({
  angle: index * 11.25,
  delay: -((index % 8) * 0.19),
  duration: 1.45 + (index % 5) * 0.17,
  size: 2 + (index % 3),
}));

const LoadingOverlay = ({ text }: { text: string }) => {
  return (
    <div
      className="fixed inset-0 z-[999998] flex h-dvh w-full flex-col items-center justify-center gap-4 bg-[#03070d]/[0.9] px-6 backdrop-blur-xl"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <style>{`
        @keyframes localProductsParticleDrift {
          0% { opacity: 0; transform: translateX(22px) scale(0.25); }
          28% { opacity: 0.95; }
          74% { opacity: 0.52; }
          100% { opacity: 0; transform: translateX(82px) scale(0.15); }
        }
        @keyframes localProductsLoadingHalo {
          0%, 100% { opacity: 0.24; transform: scale(0.82); }
          50% { opacity: 0.68; transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          .local-products-loading-particle,
          .local-products-loading-halo {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>

      <div aria-hidden="true" className="relative h-44 w-44">
        <div className="local-products-loading-halo absolute inset-4 rounded-full border border-[#e6cf8b]/10 shadow-[0_0_70px_rgba(230,207,139,0.14)] [animation:localProductsLoadingHalo_2.2s_ease-in-out_infinite]" />
        {LOADING_PARTICLES.map((particle, index) => (
          <span
            key={particle.angle}
            className="absolute inset-0 flex items-center justify-center"
            style={{ transform: `rotate(${particle.angle}deg)` }}
          >
            <span
              className={`local-products-loading-particle block rounded-full ${index % 4 === 0
                ? "bg-cyan-200 shadow-[0_0_10px_rgba(165,243,252,0.9)]"
                : "bg-[#f3e5ba] shadow-[0_0_10px_rgba(243,229,186,0.9)]"
                }`}
              style={{
                width: particle.size,
                height: particle.size,
                animationName: "localProductsParticleDrift",
                animationDuration: `${particle.duration}s`,
                animationDelay: `${particle.delay}s`,
                animationTimingFunction: "ease-out",
                animationIterationCount: "infinite",
              }}
            />
          </span>
        ))}

        <div className="absolute inset-10">
          <div className="absolute inset-0 animate-[spin_2.4s_linear_infinite] border-2 border-[#e6cf8b]/80 border-r-transparent shadow-[0_0_30px_rgba(230,207,139,0.24)] [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]" />
          <div className="absolute inset-[10px] animate-[spin_1.8s_linear_infinite_reverse] border border-[#f3e5ba]/55 border-b-transparent [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]" />
          <div className="absolute inset-[24px] animate-[spin_1.2s_linear_infinite] border border-slate-300/40 border-l-transparent [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]" />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#e6cf8b]/40 to-transparent" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-[#f3e5ba]/35 to-transparent" />
          <div className="absolute inset-[39px] animate-pulse bg-[#f3e5ba] shadow-[0_0_24px_rgba(230,207,139,0.7)] [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]" />
        </div>
      </div>
      <div className="max-w-sm text-center text-[11px] font-bold tracking-[0.08em] text-[#eadfbe]">
        {text}
      </div>
    </div>
  );
};

const waitForUiPaint = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.resolve();

  const interactionWindow = getActiveInteractionWindow();

  return new Promise((resolve) => {
    interactionWindow.requestAnimationFrame(() => {
      interactionWindow.setTimeout(resolve, 0);
    });
  });
};

const isAbortError = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === "AbortError";
};

const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";

  const units = ["B", "KB", "MB", "GB"] as const;
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

const copyStylesToDocument = (
  sourceDocument: Document,
  targetDocument: Document,
): void => {
  const styleNodes = sourceDocument.querySelectorAll(
    'link[rel="stylesheet"], style',
  );

  styleNodes.forEach((node) => {
    targetDocument.head.appendChild(node.cloneNode(true));
  });

  Array.from(sourceDocument.documentElement.attributes).forEach((attribute) => {
    targetDocument.documentElement.setAttribute(attribute.name, attribute.value);
  });

  const viewport = targetDocument.createElement("meta");

  viewport.name = "viewport";
  viewport.content = "width=device-width, initial-scale=1";
  targetDocument.head.appendChild(viewport);

  targetDocument.documentElement.style.backgroundColor = "#0b1220";
  targetDocument.body.style.margin = "0";
  targetDocument.body.style.minWidth = "320px";
  targetDocument.body.style.backgroundColor = "#0b1220";
};

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!target) return false;

  const editableTarget = target as EventTarget & {
    tagName?: string;
    isContentEditable?: boolean;
    closest?: (selector: string) => Element | null;
  };

  const tagName = editableTarget.tagName?.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    editableTarget.isContentEditable === true ||
    Boolean(editableTarget.closest?.('[contenteditable="true"]'))
  );
};

const Toastify = (
  message: string | Record<string, string>,
  statusCode: number,
): void => {
  const toastOptions: ToastOptions = {
    position: "top-right",
    autoClose: 2000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "light",
    style: {
      zIndex: 999999,
      marginTop: "0",
    },
  };

  const showToast = (text: string): void => {
    if (statusCode >= 200 && statusCode < 300) {
      toast.success(text, toastOptions);
      return;
    }

    if (statusCode >= 300 && statusCode < 400) {
      toast.warning(text, toastOptions);
      return;
    }

    if (statusCode >= 400) {
      toast.error(text, toastOptions);
      return;
    }

    toast.info(text, toastOptions);
  };

  if (typeof message === "string") {
    showToast(message);
    return;
  }

  Object.values(message).forEach(showToast);
};


const getTodayString = (): string => {
  return new Date().toISOString().slice(0, 10);
};

const normalizeTextKey = (value: string): string => {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
};

const normalizeCategoryName = (value: string): string => {
  return value.trim().replace(/\s+/g, " ");
};

const normalizeCopiedText = (value: string): string => {
  return value.normalize("NFKC");
};

const normalizeCategoryOrder = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const categoriesByKey = new Map<string, string>();

  value.forEach((item) => {
    if (typeof item !== "string") return;

    const category = normalizeCategoryName(item);
    const categoryKey = normalizeTextKey(category);

    if (!category || categoriesByKey.has(categoryKey)) return;
    categoriesByKey.set(categoryKey, category);
  });

  return Array.from(categoriesByKey.values());
};

const DEFAULT_CATEGORY_COLOR = "#d8c99f";
const CATEGORY_COLOR_PATTERN = /^#[\da-f]{6}$/iu;

const normalizeCategoryColors = (value: unknown): CategoryColorMap => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const result: CategoryColorMap = {};

  Object.entries(value as Record<string, unknown>).forEach(
    ([category, color]) => {
      const categoryKey = normalizeTextKey(category);

      if (
        categoryKey &&
        typeof color === "string" &&
        CATEGORY_COLOR_PATTERN.test(color)
      ) {
        result[categoryKey] = color.toLowerCase();
      }
    },
  );

  return result;
};

const getCategoryColor = (
  category: string,
  categoryColors: CategoryColorMap,
): string => {
  return (
    categoryColors[normalizeTextKey(category)] ?? DEFAULT_CATEGORY_COLOR
  );
};

const getCategoryContrastColor = (color: string): string => {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance >= 150 ? "#111827" : "#ffffff";
};

const createCategoryColorStyle = (
  category: string,
  categoryColors: CategoryColorMap,
): CategoryColorStyle => {
  const color = getCategoryColor(category, categoryColors);

  return {
    "--category-color": color,
    "--category-contrast": getCategoryContrastColor(color),
  };
};

type FacebookGroupCategoryGroup = {
  category: string;
  options: Array<{
    option: FacebookGroupOption;
    index: number;
  }>;
};

const groupFacebookGroupOptionsByCategory = (
  options: FacebookGroupOption[],
): FacebookGroupCategoryGroup[] => {
  const groupedOptions = new Map<string, FacebookGroupCategoryGroup>();

  options.forEach((option, index) => {
    const category =
      normalizeCategoryName(option.category) || "Chưa phân loại";
    const categoryKey = normalizeTextKey(category);
    const currentGroup = groupedOptions.get(categoryKey);

    if (currentGroup) {
      currentGroup.options.push({ option, index });
      return;
    }

    groupedOptions.set(categoryKey, {
      category,
      options: [{ option, index }],
    });
  });

  return Array.from(groupedOptions.values());
};

const DONE_PRODUCT_PREFIX = "✅";

const hasDoneProductPrefix = (name: string): boolean => {
  return name.trim().startsWith(DONE_PRODUCT_PREFIX);
};

const removeDoneProductPrefix = (name: string): string => {
  return name.replace(/^✅\s*/u, "").trim();
};

const addDoneProductPrefix = (name: string): string => {
  const cleanName = removeDoneProductPrefix(name);

  return cleanName
    ? `${DONE_PRODUCT_PREFIX} ${cleanName}`
    : DONE_PRODUCT_PREFIX;
};

const normalizeDoneProductName = (name: string, isDone: boolean): string => {
  return isDone ? addDoneProductPrefix(name) : removeDoneProductPrefix(name);
};

const getTaskName = (config: ScheduleConfig, taskIndex: number): string => {
  const name = config.taskNames[taskIndex]?.trim();

  return name || `Task ${taskIndex + 1}`;
};

const createScheduleAssignmentKey = (
  date: string,
  slotIndex: number,
  taskIndex: number,
): string => {
  return `${date}::task${taskIndex + 1}::slot${slotIndex + 1}`;
};

const createLegacyScheduleAssignmentKey = (
  date: string,
  time: string,
  taskIndex: number,
): string => {
  return `${date}::task${taskIndex + 1}::${time}`;
};

const createPostedKey = (
  date: string,
  slotIndex: number,
  taskIndex = 0,
): string => {
  return createScheduleAssignmentKey(date, slotIndex, taskIndex);
};

type ApiErrorPayload = { message?: string };

const apiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    throw new Error(payload?.message || `Yêu cầu thất bại (${response.status})`);
  }

  return response.json() as Promise<T>;
};

type BootstrapPayload = {
  products: unknown[];
  settings?: unknown;
  scheduleConfig?: unknown;
  scheduleAssignments?: unknown;
  postedRecords?: unknown;
};

const sortProductsByUpdatedAt = (
  products: LocalProduct[],
): LocalProduct[] => {
  return [...products].sort(
    (first, second) =>
      new Date(second.updatedAt).getTime() -
      new Date(first.updatedAt).getTime(),
  );
};

type BootstrapCacheRecord = {
  version: 1;
  cachedAt: string;
  payload: BootstrapPayload;
};

const BOOTSTRAP_CACHE_DATABASE_NAME = "local-products-cloud-cache";
const BOOTSTRAP_CACHE_DATABASE_VERSION = 1;
const BOOTSTRAP_CACHE_STORE_NAME = "snapshots";
const BOOTSTRAP_CACHE_RECORD_KEY = "latest-bootstrap";
const BOOTSTRAP_CACHE_FALLBACK_KEY = "local-products-bootstrap-cache-v1";
const BOOTSTRAP_HOT_CACHE_MAX_CHARACTERS = 2_750_000;
const INITIAL_PRODUCT_RENDER_LIMIT = 24;
const PRODUCT_RENDER_BATCH_SIZE = 20;

const normalizeBootstrapCacheRecord = (
  value: unknown,
): BootstrapCacheRecord | null => {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const payload = record.payload;

  if (
    record.version !== 1 ||
    typeof record.cachedAt !== "string" ||
    !payload ||
    typeof payload !== "object"
  ) {
    return null;
  }

  const payloadRecord = payload as Record<string, unknown>;

  if (!Array.isArray(payloadRecord.products)) return null;

  return {
    version: 1,
    cachedAt: record.cachedAt,
    payload: {
      products: payloadRecord.products,
      settings: payloadRecord.settings,
      scheduleConfig: payloadRecord.scheduleConfig,
      scheduleAssignments: payloadRecord.scheduleAssignments,
      postedRecords: payloadRecord.postedRecords,
    },
  };
};

const openBootstrapCacheDatabase = async (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB không khả dụng"));
      return;
    }

    const request = window.indexedDB.open(
      BOOTSTRAP_CACHE_DATABASE_NAME,
      BOOTSTRAP_CACHE_DATABASE_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(BOOTSTRAP_CACHE_STORE_NAME)) {
        database.createObjectStore(BOOTSTRAP_CACHE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Không thể mở cache IndexedDB"));
    request.onblocked = () =>
      reject(new Error("Cache IndexedDB đang bị tab khác khóa"));
  });
};

const readBootstrapCacheFromIndexedDb = async (): Promise<BootstrapCacheRecord | null> => {
  const database = await openBootstrapCacheDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        BOOTSTRAP_CACHE_STORE_NAME,
        "readonly",
      );
      const request = transaction
        .objectStore(BOOTSTRAP_CACHE_STORE_NAME)
        .get(BOOTSTRAP_CACHE_RECORD_KEY);

      request.onsuccess = () =>
        resolve(normalizeBootstrapCacheRecord(request.result as unknown));
      request.onerror = () =>
        reject(request.error ?? new Error("Không thể đọc cache IndexedDB"));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Đọc cache IndexedDB bị hủy"));
    });
  } finally {
    database.close();
  }
};

const writeBootstrapCacheToIndexedDb = async (
  record: BootstrapCacheRecord,
): Promise<void> => {
  const database = await openBootstrapCacheDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        BOOTSTRAP_CACHE_STORE_NAME,
        "readwrite",
      );

      transaction
        .objectStore(BOOTSTRAP_CACHE_STORE_NAME)
        .put(record, BOOTSTRAP_CACHE_RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Không thể ghi cache IndexedDB"));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Ghi cache IndexedDB bị hủy"));
    });
  } finally {
    database.close();
  }
};

const readBootstrapHotCache = (): BootstrapCacheRecord | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(BOOTSTRAP_CACHE_FALLBACK_KEY);
    return raw
      ? normalizeBootstrapCacheRecord(JSON.parse(raw) as unknown)
      : null;
  } catch {
    window.localStorage.removeItem(BOOTSTRAP_CACHE_FALLBACK_KEY);
    return null;
  }
};

const writeBootstrapHotCache = (record: BootstrapCacheRecord): boolean => {
  if (typeof window === "undefined") return false;

  try {
    const serializedRecord = JSON.stringify(record);

    if (serializedRecord.length > BOOTSTRAP_HOT_CACHE_MAX_CHARACTERS) {
      window.localStorage.removeItem(BOOTSTRAP_CACHE_FALLBACK_KEY);
      return false;
    }

    window.localStorage.setItem(
      BOOTSTRAP_CACHE_FALLBACK_KEY,
      serializedRecord,
    );
    return true;
  } catch {
    window.localStorage.removeItem(BOOTSTRAP_CACHE_FALLBACK_KEY);
    return false;
  }
};

const readBootstrapCache = async (): Promise<BootstrapCacheRecord | null> => {
  const hotCacheRecord = readBootstrapHotCache();

  if (hotCacheRecord) return hotCacheRecord;

  try {
    const indexedDbRecord = await readBootstrapCacheFromIndexedDb();

    if (indexedDbRecord) return indexedDbRecord;
  } catch {
    // localStorage chỉ là phương án dự phòng khi IndexedDB không khả dụng.
  }
  return null;
};

const writeBootstrapCache = async (
  payload: BootstrapPayload,
): Promise<void> => {
  const record: BootstrapCacheRecord = {
    version: 1,
    cachedAt: new Date().toISOString(),
    payload,
  };

  let indexedDbError: unknown;

  try {
    await writeBootstrapCacheToIndexedDb(record);
  } catch (error) {
    indexedDbError = error;
  }

  const hotCacheWritten = writeBootstrapHotCache(record);

  if (indexedDbError && !hotCacheWritten) {
    throw indexedDbError;
  }
};

const clearBootstrapCache = async (): Promise<void> => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(BOOTSTRAP_CACHE_FALLBACK_KEY);
  }

  try {
    const database = await openBootstrapCacheDatabase();

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          BOOTSTRAP_CACHE_STORE_NAME,
          "readwrite",
        );

        transaction
          .objectStore(BOOTSTRAP_CACHE_STORE_NAME)
          .delete(BOOTSTRAP_CACHE_RECORD_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("Không thể xóa cache IndexedDB"));
        transaction.onabort = () =>
          reject(transaction.error ?? new Error("Xóa cache IndexedDB bị hủy"));
      });
    } finally {
      database.close();
    }
  } catch {
    return;
  }
};

type CloudinaryCleanupPayload = {
  deleted: Array<{ publicId: string; result: string }>;
  failed: Array<{ publicId: string; message: string }>;
};

type ProductMutationPayload = {
  cleanup?: CloudinaryCleanupPayload;
};

const emptyCloudinaryCleanup = (): CloudinaryCleanupPayload => ({
  deleted: [],
  failed: [],
});

const getBootstrapData = async (): Promise<BootstrapPayload> => {
  return apiRequest<BootstrapPayload>("/bootstrap");
};

const saveProductToDb = async (
  product: LocalProduct,
): Promise<CloudinaryCleanupPayload> => {
  const payload = await apiRequest<ProductMutationPayload>(
    `/products/${encodeURIComponent(product.id)}`,
    {
      method: "PUT",
      body: JSON.stringify(product),
    },
  );

  return payload.cleanup ?? emptyCloudinaryCleanup();
};

const deleteProductFromDb = async (
  id: string,
): Promise<CloudinaryCleanupPayload> => {
  const payload = await apiRequest<ProductMutationPayload>(
    `/products/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

  return payload.cleanup ?? emptyCloudinaryCleanup();
};

const replaceAllProductsInDb = async (products: LocalProduct[]): Promise<void> => {
  await apiRequest("/products", {
    method: "PUT",
    body: JSON.stringify({ products }),
  });
};

const saveAppStatePatch = async (patch: Record<string, unknown>): Promise<void> => {
  await apiRequest("/state", { method: "PATCH", body: JSON.stringify(patch) });
};

let pendingStatePatch: Record<string, unknown> = {};
let statePatchTimer: ReturnType<typeof setTimeout> | null = null;

const queueAppStatePatch = (patch: Record<string, unknown>): void => {
  pendingStatePatch = { ...pendingStatePatch, ...patch };
  if (statePatchTimer) clearTimeout(statePatchTimer);

  statePatchTimer = setTimeout(() => {
    const payload = pendingStatePatch;
    pendingStatePatch = {};
    statePatchTimer = null;
    void saveAppStatePatch(payload).catch((error) => {
      console.error("Không thể lưu trạng thái lên MongoDB", error);
    });
  }, 450);
};

const flushQueuedAppStatePatch = async (): Promise<void> => {
  if (statePatchTimer) clearTimeout(statePatchTimer);
  statePatchTimer = null;

  const payload = pendingStatePatch;
  pendingStatePatch = {};

  if (Object.keys(payload).length > 0) {
    await saveAppStatePatch(payload);
  }
};

const clearAllLocalProductData = async (): Promise<void> => {
  if (statePatchTimer) clearTimeout(statePatchTimer);
  statePatchTimer = null;
  pendingStatePatch = {};
  await apiRequest("/reset", { method: "DELETE" });
};

const normalizeContactOptions = (value: unknown): ContactOption[] => {
  if (!Array.isArray(value)) return [];

  const usedIds = new Set<string>();

  return value.reduce<ContactOption[]>((options, item, index) => {
    if (typeof item !== "object" || item === null) return options;

    const record = item as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text.trim() : "";
    const rawId = typeof record.id === "string" ? record.id.trim() : "";
    const id = rawId || `contact-${index + 1}`;

    if (!text || usedIds.has(id)) return options;

    usedIds.add(id);
    options.push({ id, text });

    return options;
  }, []);
};

const normalizeFacebookAssetId = (value: string): string => {
  return value.replace(/\D/gu, "").slice(0, 32);
};

const normalizeFacebookPageOptions = (
  value: unknown,
): FacebookPageOption[] => {
  if (!Array.isArray(value)) return [];

  const usedAssetIds = new Set<string>();

  return value.reduce<FacebookPageOption[]>((options, item, index) => {
    if (typeof item !== "object" || item === null) return options;

    const record = item as Record<string, unknown>;
    const assetId = normalizeFacebookAssetId(
      typeof record.assetId === "string" ? record.assetId : "",
    );
    const rawId = typeof record.id === "string" ? record.id.trim() : "";
    const id = rawId || `facebook-page-${index + 1}`;
    const name =
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : `Fanpage ${index + 1}`;

    if (!assetId || usedAssetIds.has(assetId)) return options;

    usedAssetIds.add(assetId);
    options.push({ id, name, assetId });

    return options;
  }, []);
};

const createMetaBusinessPageUrl = (
  pathname: string,
  assetId: string,
  createSearchParams: (
    normalizedAssetId: string,
  ) => ReadonlyArray<readonly [string, string]>,
): string => {
  const normalizedAssetId = normalizeFacebookAssetId(assetId);

  if (!normalizedAssetId) return "";

  const url = new URL(pathname, "https://business.facebook.com");

  createSearchParams(normalizedAssetId).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
};

const createMetaBusinessComposerUrl = (assetId: string): string => {
  return createMetaBusinessPageUrl(
    "/latest/composer",
    assetId,
    (normalizedAssetId) => [["asset_id", normalizedAssetId]],
  );
};

const createMetaBusinessStoryComposerUrl = (assetId: string): string => {
  return createMetaBusinessPageUrl(
    "/latest/story_composer/",
    assetId,
    (normalizedAssetId) => [
      ["ref", "biz_web_content_managers_published_posts"],
      ["asset_id", normalizedAssetId],
      ["context_ref", "POSTS"],
    ],
  );
};

const FACEBOOK_PAGE_URL_TOOLS = [
  {
    id: "post",
    title: "Tạo bài viết",
    description: "Mở Meta Business Composer để tạo bài viết mới.",
    shortLabel: "Bài viết",
    copyLabel: "Copy tạo bài",
    openLabel: "Mở tạo bài",
    copyMessage: "Đã copy URL tạo bài viết",
    popupNamePrefix: "composer",
    containerClassName: "border-cyan-300/20 bg-cyan-300/[0.055]",
    badgeClassName: "border-cyan-200/30 bg-cyan-300/10 text-cyan-100",
    copyButtonClassName:
      "border-cyan-300/35 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20",
    openButtonClassName:
      "border-[#d8c99f]/35 bg-[#d8c99f]/10 text-[#eadfbe] hover:bg-[#d8c99f]/20",
    createUrl: createMetaBusinessComposerUrl,
  },
  {
    id: "story",
    title: "Tạo tin",
    description: "Mở trình tạo Story của Fanpage đang chọn.",
    shortLabel: "Story",
    copyLabel: "Copy tạo tin",
    openLabel: "Mở tạo tin",
    copyMessage: "Đã copy URL tạo tin",
    popupNamePrefix: "story-composer",
    containerClassName: "border-violet-300/20 bg-violet-300/[0.055]",
    badgeClassName:
      "border-violet-200/30 bg-violet-300/10 text-violet-100",
    copyButtonClassName:
      "border-violet-300/35 bg-violet-300/10 text-violet-100 hover:bg-violet-300/20",
    openButtonClassName:
      "border-amber-300/35 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20",
    createUrl: createMetaBusinessStoryComposerUrl,
  },
] as const;

const normalizeMetaBusinessDuplicateUrl = (value: string): string => {
  return value.trim();
};

const createMetaBusinessDuplicateUrl = (
  templateUrl: string,
  assetId: string,
): string => {
  const normalizedTemplateUrl = normalizeMetaBusinessDuplicateUrl(templateUrl);
  const normalizedAssetId = normalizeFacebookAssetId(assetId);

  if (!normalizedTemplateUrl || !normalizedAssetId) {
    return normalizedTemplateUrl;
  }

  try {
    const url = new URL(
      /^https?:\/\//iu.test(normalizedTemplateUrl)
        ? normalizedTemplateUrl
        : `https://${normalizedTemplateUrl}`,
    );

    url.searchParams.set("asset_id", normalizedAssetId);

    return url.toString();
  } catch {
    return normalizedTemplateUrl;
  }
};

const getFacebookDuplicateContentId = (value: string): string => {
  try {
    return new URL(value.trim()).searchParams.get("business_content_id") ?? "";
  } catch {
    return "";
  }
};

const normalizeFacebookDuplicatePostOptions = (
  value: unknown,
): FacebookDuplicatePostOption[] => {
  if (!Array.isArray(value)) return [];

  return value.reduce<FacebookDuplicatePostOption[]>((options, item, index) => {
    if (typeof item !== "object" || item === null) return options;

    const record = item as Record<string, unknown>;
    const url = normalizeMetaBusinessDuplicateUrl(
      typeof record.url === "string" ? record.url : "",
    );
    const rawId = typeof record.id === "string" ? record.id.trim() : "";
    const id = rawId || `facebook-duplicate-post-${index + 1}`;
    const name =
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : `Bản sao ${index + 1}`;
    const category =
      typeof record.category === "string" && record.category.trim()
        ? normalizeCategoryName(record.category)
        : "Chưa phân loại";

    if (!url) return options;

    options.push({ id, name, category, url });

    return options;
  }, []);
};

const normalizeFacebookGroupUrl = (value: string): string => {
  const trimmedValue = value.trim();

  if (!trimmedValue) return "";

  try {
    const url = new URL(
      /^https?:\/\//iu.test(trimmedValue)
        ? trimmedValue
        : `https://${trimmedValue}`,
    );
    const hostname = url.hostname.toLowerCase();
    const isFacebookHostname =
      hostname === "facebook.com" || hostname.endsWith(".facebook.com");
    const groupPathMatch = url.pathname.match(/^\/groups\/([^/?#]+)/iu);

    if (!isFacebookHostname || !groupPathMatch?.[1]) return "";

    return `https://www.facebook.com/groups/${groupPathMatch[1]}`;
  } catch {
    return "";
  }
};

const normalizeFacebookGroupOptions = (
  value: unknown,
): FacebookGroupOption[] => {
  if (!Array.isArray(value)) return [];

  const usedUrls = new Set<string>();

  return value.reduce<FacebookGroupOption[]>((options, item, index) => {
    if (typeof item !== "object" || item === null) return options;

    const record = item as Record<string, unknown>;
    const url = normalizeFacebookGroupUrl(
      typeof record.url === "string" ? record.url : "",
    );
    const rawId = typeof record.id === "string" ? record.id.trim() : "";
    const id = rawId || `facebook-group-${index + 1}`;
    const name =
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : `Group ${index + 1}`;
    const category =
      typeof record.category === "string"
        ? normalizeCategoryName(record.category) || "Chưa phân loại"
        : "Chưa phân loại";

    if (!url || usedUrls.has(url)) return options;

    usedUrls.add(url);
    options.push({ id, name, category, url });

    return options;
  }, []);
};

const normalizeSelectedFacebookGroupIds = (
  value: unknown,
  groups: FacebookGroupOption[],
): string[] => {
  if (!Array.isArray(value)) return [];

  const validIds = new Set(groups.map((group) => group.id));

  return Array.from(
    new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" && validIds.has(item),
      ),
    ),
  );
};

const extractSocialTagText = (value: string): string => {
  const matches = value.match(/#[\p{L}\p{N}_]+/gu) ?? [];

  return Array.from(new Set(matches)).join(" ");
};

const removeSocialTags = (value: string): string => {
  return value
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
};

const loadGlobalSettings = (): GlobalSettings => {
  return defaultSettings;
};

const saveGlobalSettings = (settings: GlobalSettings): void => {
  queueAppStatePatch({ settings });
};

const loadPostedRecords = (): PostedRecord[] => {
  return [];
};

const savePostedRecords = (records: PostedRecord[]): void => {
  queueAppStatePatch({ postedRecords: records });
};

const loadScheduleConfig = (): ScheduleConfig => {
  const today = getTodayString();

  return {
    ...defaultScheduleConfig,
    dateFrom: today,
    dateTo: today,
  };
};

const saveScheduleConfig = (config: ScheduleConfig): void => {
  queueAppStatePatch({ scheduleConfig: config });
};

const loadScheduleAssignments = (): ScheduleAssignmentMap => {
  return {};
};

const saveScheduleAssignments = (assignments: ScheduleAssignmentMap): void => {
  queueAppStatePatch({ scheduleAssignments: assignments });
};

const parsePriceNumber = (
  priceText: string,
  contentType: ProductContentType = "technology",
): number => {
  const normalized = priceText
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/,/g, ".")
    .replace("triệu", "tr")
    .replace("ty", "tỷ");

  if (!normalized) return 0;

  if (normalized.includes("tr")) {
    const value = Number(normalized.replace("tr", ""));
    return Number.isFinite(value) ? Math.round(value * 1_000_000) : 0;
  }

  if (normalized.includes("tỷ")) {
    const value = Number(normalized.replace("tỷ", ""));
    return Number.isFinite(value) ? Math.round(value * 1_000_000_000) : 0;
  }

  if (contentType === "realEstate" && normalized.endsWith("đ")) {
    const value = Number(normalized.slice(0, -1));
    return Number.isFinite(value) ? Math.round(value * 1_000_000_000) : 0;
  }

  const value = Number(normalized.replace(/[^\d.]/g, ""));
  return Number.isFinite(value) ? value : 0;
};

const getSortablePrice = (product: LocalProduct): number => {
  if (product.price > 0) return product.price;

  return Number.MAX_SAFE_INTEGER;
};

const getProductDoneSortValue = (
  product: LocalProduct,
  pendingDoneProductIds: Set<string>,
): number => {
  if (!product.isDone) return 0;

  return pendingDoneProductIds.has(product.id) ? 0 : 1;
};

const sortProductsByDoneThenPrice = (
  items: LocalProduct[],
  pendingDoneProductIds: Set<string> = new Set<string>(),
): LocalProduct[] => {
  return [...items].sort((firstProduct, secondProduct) => {
    const doneDiff =
      getProductDoneSortValue(firstProduct, pendingDoneProductIds) -
      getProductDoneSortValue(secondProduct, pendingDoneProductIds);

    if (doneDiff !== 0) return doneDiff;

    const priceDiff =
      getSortablePrice(firstProduct) - getSortablePrice(secondProduct);

    if (priceDiff !== 0) return priceDiff;

    return normalizeTextKey(firstProduct.name).localeCompare(
      normalizeTextKey(secondProduct.name),
      "vi",
    );
  });
};

const sortProductsByCategoryThenDoneThenPrice = (
  items: LocalProduct[],
  pendingDoneProductIds: Set<string> = new Set<string>(),
  categoryOrder: string[] = [],
): LocalProduct[] => {
  const categoryIndexes = new Map(
    categoryOrder.map((category, index) => [normalizeTextKey(category), index]),
  );

  return [...items].sort((firstProduct, secondProduct) => {
    const firstCategoryKey = normalizeTextKey(
      firstProduct.category || "Chưa phân loại",
    );
    const secondCategoryKey = normalizeTextKey(
      secondProduct.category || "Chưa phân loại",
    );
    const orderDiff =
      (categoryIndexes.get(firstCategoryKey) ?? Number.MAX_SAFE_INTEGER) -
      (categoryIndexes.get(secondCategoryKey) ?? Number.MAX_SAFE_INTEGER);

    if (orderDiff !== 0) return orderDiff;

    const categoryDiff = normalizeTextKey(
      firstProduct.category || "Chưa phân loại",
    ).localeCompare(
      normalizeTextKey(secondProduct.category || "Chưa phân loại"),
      "vi",
    );

    if (categoryDiff !== 0) return categoryDiff;

    const doneDiff =
      getProductDoneSortValue(firstProduct, pendingDoneProductIds) -
      getProductDoneSortValue(secondProduct, pendingDoneProductIds);

    if (doneDiff !== 0) return doneDiff;

    const priceDiff =
      getSortablePrice(firstProduct) - getSortablePrice(secondProduct);

    if (priceDiff !== 0) return priceDiff;

    return normalizeTextKey(firstProduct.name).localeCompare(
      normalizeTextKey(secondProduct.name),
      "vi",
    );
  });
};

const createGroupedProducts = (
  items: LocalProduct[],
  pendingDoneProductIds: Set<string> = new Set<string>(),
): {
  category: string;
  products: LocalProduct[];
  lowestPrice: number;
}[] => {
  const groupedMap = new Map<
    string,
    { category: string; products: LocalProduct[] }
  >();

  items.forEach((product) => {
    const category =
      normalizeCategoryName(product.category) || "Chưa phân loại";
    const categoryKey = normalizeTextKey(category);
    const currentGroup = groupedMap.get(categoryKey);

    if (!currentGroup) {
      groupedMap.set(categoryKey, {
        category,
        products: [product],
      });
      return;
    }

    currentGroup.products.push(product);
  });

  return Array.from(groupedMap.values())
    .map((group) => {
      const sortedProducts = sortProductsByDoneThenPrice(
        group.products,
        pendingDoneProductIds,
      );

      return {
        category: group.category,
        products: sortedProducts,
        lowestPrice: Math.min(...sortedProducts.map(getSortablePrice)),
      };
    })
    .sort((firstGroup, secondGroup) =>
      normalizeTextKey(firstGroup.category).localeCompare(
        normalizeTextKey(secondGroup.category),
        "vi",
      ),
    );
};

const orderGroupsByCategories = <Group extends { category: string }>(
  groups: Group[],
  categories: string[],
): Group[] => {
  const categoryIndexes = new Map(
    categories.map((category, index) => [normalizeTextKey(category), index]),
  );

  return [...groups].sort((firstGroup, secondGroup) => {
    const firstCategoryKey = normalizeTextKey(firstGroup.category);
    const secondCategoryKey = normalizeTextKey(secondGroup.category);
    const orderDiff =
      (categoryIndexes.get(firstCategoryKey) ?? Number.MAX_SAFE_INTEGER) -
      (categoryIndexes.get(secondCategoryKey) ?? Number.MAX_SAFE_INTEGER);

    if (orderDiff !== 0) return orderDiff;

    return firstCategoryKey.localeCompare(secondCategoryKey, "vi");
  });
};

const buildCopyableProductListText = (
  groups: {
    category: string;
    products: LocalProduct[];
  }[],
): string => {
  return groups
    .map((group) => {
      const lines = group.products.map((product, index) => {
        const price = product.priceText.trim();

        return [
          `${index + 1}. ${removeDoneProductPrefix(product.name)}`,
          price ? `Giá: ${price}` : "",
        ]
          .filter(Boolean)
          .join(" | ");
      });

      return [`📌 ${group.category}`, ...lines].join("\n");
    })
    .join("\n\n");
};

const escapeCsvCell = (value: string): string => {
  return `"${value.replace(/"/g, '""')}"`;
};

const buildProductsCsvContent = (
  groups: {
    category: string;
    products: LocalProduct[];
  }[],
): string => {
  const rows = [["Danh mục", "STT", "Tên sản phẩm", "Giá"]];

  groups.forEach((group) => {
    group.products.forEach((product, index) => {
      rows.push([
        group.category,
        String(index + 1),
        removeDoneProductPrefix(product.name),
        product.priceText,
      ]);
    });
  });

  return `\ufeffsep=,\n${rows
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n")}`;
};

type CloudinarySignaturePayload = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  overwrite: boolean;
  uniqueFilename: boolean;
  useFilename: boolean;
  signature: string;
};

type CloudinaryUploadPayload = {
  public_id: string;
  asset_id: string;
  secure_url: string;
  version: number;
  format: string;
  width: number;
  height: number;
  bytes: number;
  etag?: string;
  resource_type: string;
};

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const createFileSha256 = async (file: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return bytesToHex(new Uint8Array(digest));
};

const deleteUnattachedCloudinaryImages = async (publicIds: string[]): Promise<void> => {
  if (publicIds.length === 0) return;
  await apiRequest("/cloudinary/delete", {
    method: "DELETE",
    body: JSON.stringify({ publicIds }),
  });
};

const uploadOriginalImageToCloudinary = async (file: File): Promise<ProductImage> => {
  const maxBytes = Number(process.env.NEXT_PUBLIC_MAX_IMAGE_BYTES || 0);
  if (Number.isFinite(maxBytes) && maxBytes > 0 && file.size > maxBytes) {
    throw new Error(`Ảnh ${file.name} vượt giới hạn ${formatFileSize(maxBytes)}`);
  }

  const [signature, sha256] = await Promise.all([
    apiRequest<CloudinarySignaturePayload>("/cloudinary/sign", { method: "POST" }),
    createFileSha256(file),
  ]);
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("api_key", signature.apiKey);
  formData.append("timestamp", String(signature.timestamp));
  formData.append("folder", signature.folder);
  formData.append("overwrite", String(signature.overwrite));
  formData.append("unique_filename", String(signature.uniqueFilename));
  formData.append("use_filename", String(signature.useFilename));
  formData.append("signature", signature.signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`,
    { method: "POST", body: formData },
  );
  const result = (await response.json()) as CloudinaryUploadPayload & { error?: { message?: string } };

  if (!response.ok || !result.secure_url || !result.public_id) {
    throw new Error(result.error?.message || `Không thể upload ảnh ${file.name}`);
  }

  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: file.name,
    originalName: file.name,
    dataUrl: result.secure_url,
    size: file.size,
    type: file.type || `image/${result.format}`,
    createdAt: now,
    publicId: result.public_id,
    assetId: result.asset_id,
    version: result.version,
    format: result.format,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    etag: result.etag || "",
    sha256,
    resourceType: "image",
  };
};

const convertFilesToImages = async (files: File[]): Promise<ProductImage[]> => {
  const validFiles = files.filter((file) => file.type.startsWith("image/"));
  const uploaded: ProductImage[] = [];

  try {
    for (const file of validFiles) {
      uploaded.push(await uploadOriginalImageToCloudinary(file));
    }
    return uploaded;
  } catch (error) {
    await deleteUnattachedCloudinaryImages(uploaded.map((image) => image.publicId)).catch(() => undefined);
    throw error;
  }
};

const normalizeImages = (value: unknown): ProductImage[] => {
  if (!Array.isArray(value)) return [];

  return value.reduce<ProductImage[]>((images, item) => {
    if (typeof item !== "object" || item === null) return images;
    const record = item as Record<string, unknown>;

    if (
      typeof record.id !== "string" ||
      typeof record.name !== "string" ||
      typeof record.dataUrl !== "string" ||
      typeof record.size !== "number" ||
      typeof record.type !== "string" ||
      typeof record.createdAt !== "string"
    ) {
      return images;
    }

    images.push({
      id: record.id,
      name: record.name,
      originalName:
        typeof record.originalName === "string" ? record.originalName : record.name,
      dataUrl: record.dataUrl,
      size: record.size,
      type: record.type,
      createdAt: record.createdAt,
      publicId: typeof record.publicId === "string" ? record.publicId : "",
      assetId: typeof record.assetId === "string" ? record.assetId : "",
      version: typeof record.version === "number" ? record.version : 0,
      format: typeof record.format === "string" ? record.format : "",
      width: typeof record.width === "number" ? record.width : 0,
      height: typeof record.height === "number" ? record.height : 0,
      bytes: typeof record.bytes === "number" ? record.bytes : record.size,
      etag: typeof record.etag === "string" ? record.etag : "",
      sha256: typeof record.sha256 === "string" ? record.sha256 : "",
      resourceType: "image",
    });
    return images;
  }, []);
};

const normalizeProduct = (value: unknown): LocalProduct | null => {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string") return null;
  if (typeof record.name !== "string") return null;

  const priceText =
    typeof record.priceText === "string" ? record.priceText : "";
  const description =
    typeof record.description === "string" ? record.description : "";
  const pin = typeof record.pin === "string" ? record.pin : "";
  const status = typeof record.status === "string" ? record.status : "";
  const category = typeof record.category === "string" ? record.category : "";
  const contentType: ProductContentType =
    record.contentType === "realEstate" ? "realEstate" : "technology";
  const realEstateComment =
    typeof record.realEstateComment === "string"
      ? record.realEstateComment
      : "";
  const isDone =
    typeof record.isDone === "boolean"
      ? record.isDone
      : hasDoneProductPrefix(record.name);

  return {
    id: record.id,
    name: normalizeDoneProductName(record.name, isDone),
    description,
    pin,
    status,
    price:
      typeof record.price === "number"
        ? record.price
        : parsePriceNumber(priceText, contentType),
    priceText,
    category,
    contentType,
    realEstateComment,
    images: normalizeImages(record.images),
    internalImages: normalizeImages(record.internalImages),
    isDone,
    doneAt: typeof record.doneAt === "string" ? record.doneAt : "",
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
  };
};

const normalizeProductsArray = (value: unknown): LocalProduct[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => normalizeProduct(item))
    .filter((item): item is LocalProduct => item !== null);
};

const normalizeGlobalSettings = (
  value: unknown,
): GlobalSettings | undefined => {
  if (typeof value !== "object" || value === null) return undefined;

  const record = value as Record<string, unknown>;
  const contactOptions = normalizeContactOptions(record.contactOptions);
  const facebookPages = normalizeFacebookPageOptions(record.facebookPages);
  const facebookDuplicatePosts = normalizeFacebookDuplicatePostOptions(
    record.facebookDuplicatePosts,
  );
  const facebookGroups = normalizeFacebookGroupOptions(record.facebookGroups);
  const selectedFacebookGroupIds = normalizeSelectedFacebookGroupIds(
    record.selectedFacebookGroupIds,
    facebookGroups,
  );
  const categoryColors = normalizeCategoryColors(record.categoryColors);
  const categoryOrder = normalizeCategoryOrder(record.categoryOrder);

  return {
    commonDescription:
      typeof record.commonDescription === "string"
        ? record.commonDescription
        : "",
    globalNote: typeof record.globalNote === "string" ? record.globalNote : "",
    contactOptions,
    facebookPages,
    facebookDuplicatePosts,
    facebookGroups,
    selectedFacebookGroupIds,
    categoryColors,
    categoryOrder,
    autoCopyShareMode:
      record.autoCopyShareMode === "comment" ? "comment" : "post",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
};

const normalizeScheduleConfig = (
  value: unknown,
): ScheduleConfig | undefined => {
  if (typeof value !== "object" || value === null) return undefined;

  const record = value as Record<string, unknown>;
  const taskNames = Array.isArray(record.taskNames)
    ? record.taskNames.filter(
      (item): item is string => typeof item === "string",
    )
    : defaultScheduleConfig.taskNames;
  const selectedCategories = Array.isArray(record.selectedCategories)
    ? Array.from(
      new Map(
        record.selectedCategories
          .filter((item): item is string => typeof item === "string")
          .map((item) => [
            normalizeTextKey(item),
            normalizeCategoryName(item),
          ]),
      ).values(),
    ).filter(Boolean)
    : [];

  return {
    dateFrom:
      typeof record.dateFrom === "string" && record.dateFrom
        ? record.dateFrom
        : getTodayString(),
    dateTo:
      typeof record.dateTo === "string" && record.dateTo
        ? record.dateTo
        : getTodayString(),
    startTime:
      typeof record.startTime === "string" && record.startTime
        ? record.startTime
        : defaultScheduleConfig.startTime,
    endTime:
      typeof record.endTime === "string" && record.endTime
        ? record.endTime
        : defaultScheduleConfig.endTime,
    gapHours:
      typeof record.gapHours === "number" && Number.isFinite(record.gapHours)
        ? record.gapHours
        : defaultScheduleConfig.gapHours,
    taskCount:
      typeof record.taskCount === "number" && Number.isFinite(record.taskCount)
        ? Math.max(1, Math.min(64, Math.round(record.taskCount)))
        : defaultScheduleConfig.taskCount,
    taskNames,
    selectedCategories,
  };
};

const normalizeScheduleAssignments = (
  value: unknown,
): ScheduleAssignmentMap | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const result: ScheduleAssignmentMap = {};

  Object.entries(record).forEach(([key, assignmentValue]) => {
    if (typeof assignmentValue === "string") {
      result[key] = assignmentValue;
    }
  });

  return result;
};

const normalizePostedRecords = (value: unknown): PostedRecord[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  return value.filter((item): item is PostedRecord => {
    if (typeof item !== "object" || item === null) return false;

    const record = item as Record<string, unknown>;

    return (
      typeof record.slotId === "string" && typeof record.postedAt === "string"
    );
  });
};

const parseImportPayload = (value: unknown): ParsedImportPayload | null => {
  if (Array.isArray(value)) {
    const products = normalizeProductsArray(value);

    if (products.length === 0) return null;

    return {
      products,
    };
  }

  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const products = normalizeProductsArray(record.products);

  if (products.length === 0) return null;

  return {
    settings: normalizeGlobalSettings(record.settings),
    products,
    scheduleConfig: normalizeScheduleConfig(record.scheduleConfig),
    scheduleAssignments: normalizeScheduleAssignments(
      record.scheduleAssignments,
    ),
    postedRecords: normalizePostedRecords(record.postedRecords),
  };
};

const copyTextWithExecCommand = (
  interactionWindow: Window,
  value: string,
): boolean => {
  const targetDocument = interactionWindow.document;
  const textarea = targetDocument.createElement("textarea");

  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";

  targetDocument.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = targetDocument.execCommand("copy");

  textarea.remove();
  return copied;
};

const writeClipboardText = async (value: string): Promise<void> => {
  const interactionWindow = getActiveInteractionWindow();
  const clipboard = interactionWindow.navigator.clipboard;

  if (clipboard) {
    try {
      await clipboard.writeText(value);
      return;
    } catch {
      // Dùng fallback trong chính cửa sổ đang nhận thao tác.
    }
  }

  if (copyTextWithExecCommand(interactionWindow, value)) {
    return;
  }

  throw new Error("Không thể copy. Hãy kiểm tra quyền clipboard của trình duyệt.");
};

const getSelectedContactText = (
  contactOptions: ContactOption[],
  selectedContactId: string,
): string => {
  return (
    contactOptions.find(
      (option) => option.id === selectedContactId,
    )?.text.trim() ?? ""
  );
};

const composeCopyText = (
  value: string,
  contactText: string,
  includeSocialTags: boolean,
  socialTagSource = value,
): string => {
  const cleanValue = removeSocialTags(value);
  const cleanContactText = contactText.trim();
  const cleanSocialTagText = includeSocialTags
    ? extractSocialTagText(socialTagSource)
    : "";
  const sections = cleanValue ? [cleanValue] : [];

  if (
    cleanContactText &&
    !sections.join("\n\n").endsWith(cleanContactText)
  ) {
    sections.push(cleanContactText);
  }

  if (
    cleanSocialTagText &&
    !sections.join("\n\n").endsWith(cleanSocialTagText)
  ) {
    sections.push(cleanSocialTagText);
  }

  return sections.join("\n\n");
};

const buildPostText = (
  product: LocalProduct,
  commonDescription: string,
  contactText: string,
  includeSocialTags: boolean,
): string => {
  const description = product.description.trim() || commonDescription.trim();

  if (product.contentType === "realEstate") {
    return composeCopyText(
      description,
      contactText,
      includeSocialTags,
    );
  }

  const lines = [
    product.name,
    product.priceText ? `Giá: ${product.priceText}` : "",
    product.category ? `Danh mục: ${product.category}` : "",
    description,
  ].filter(Boolean);

  return composeCopyText(lines.join("\n"), contactText, includeSocialTags);
};

const normalizeCommentPrice = (priceText: string): string => {
  const cleanPrice = priceText
    .trim()
    .replace(/^📌?\s*giá\s*:\s*/iu, "")
    .trim();

  if (!cleanPrice) return "";

  if (/liên\s*hệ/iu.test(cleanPrice)) {
    return cleanPrice;
  }

  const normalizedPrice = cleanPrice
    .replace(/\s*(triệu|trieu)\s*$/iu, "tr")
    .replace(/\s*tr\s*$/iu, "tr")
    .replace(/,/g, ".")
    .replace(/\s+/g, "");

  return /tr$/iu.test(normalizedPrice)
    ? normalizedPrice
    : `${normalizedPrice}tr`;
};

const normalizeRealEstateCommentPrice = (priceText: string): string => {
  return priceText
    .trim()
    .replace(/^(?:💰|📌)?\s*giá(?:\s*bán)?\s*:\s*/iu, "")
    .trim();
};

const buildCommentContentText = (
  title: string,
  description: string,
  priceText: string,
  contactText: string,
  contentType: ProductContentType = "technology",
  realEstateComment = "",
): string => {
  const cleanTitle = title.trim();

  if (contentType === "realEstate") {
    const realEstatePrice = normalizeRealEstateCommentPrice(priceText);
    const heading = [
      cleanTitle,
      realEstatePrice ? `GIÁ ${realEstatePrice}` : "",
    ]
      .filter(Boolean)
      .join(" - ");
    const content = [heading, realEstateComment.trim()]
      .filter(Boolean)
      .join("\n\n");

    return composeCopyText(
      content,
      contactText,
      false,
      realEstateComment,
    );
  }

  const commentPrice = normalizeCommentPrice(priceText);
  const plusLines = description
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("+"));

  const headingLines = [
    cleanTitle,
    commentPrice ? `📌Giá: ${commentPrice}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const content = [
    headingLines,
    plusLines.length > 0 ? plusLines.join("\n") : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return composeCopyText(
    content,
    contactText,
    false,
    description,
  );
};

const createImageFilenameSuffix = (imageId: string): string => {
  const normalizedId = imageId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);

  if (normalizedId) return normalizedId;

  return String(Math.floor(Math.random() * 900) + 100);
};

const normalizeImageExtension = (image: Pick<ProductImage, "format" | "type" | "name">): string => {
  const fromFormat = image.format.replace(/[^a-zA-Z0-9]/gu, "").toLowerCase();
  if (fromFormat) return fromFormat === "jpeg" ? "jpg" : fromFormat;
  const fromType = image.type.split("/").at(-1)?.replace(/[^a-zA-Z0-9]/gu, "").toLowerCase();
  if (fromType) return fromType === "jpeg" ? "jpg" : fromType;
  const fromName = image.name.split(".").at(-1)?.replace(/[^a-zA-Z0-9]/gu, "").toLowerCase();
  return fromName || "img";
};

const createCloudinaryThumbnailUrl = (sourceUrl: string): string => {
  try {
    const url = new URL(sourceUrl);
    const uploadPathMarker = "/image/upload/";

    if (
      url.hostname !== "res.cloudinary.com" ||
      !url.pathname.includes(uploadPathMarker)
    ) {
      return sourceUrl;
    }

    url.pathname = url.pathname.replace(
      uploadPathMarker,
      `${uploadPathMarker}f_auto,q_auto:good,c_limit,w_640,dpr_auto/`,
    );
    return url.toString();
  } catch {
    return sourceUrl;
  }
};

const createSystemImageFilename = (
  index: number,
  imageId: string,
  extension = "jpg",
): string => {
  return `sanpham${index + 1}-${createImageFilenameSuffix(imageId)}.${extension}`;
};

const renameImagesByOrder = (images: ProductImage[]): ProductImage[] => {
  return images.map((image, index) => ({
    ...image,
    name: createSystemImageFilename(index, image.id, normalizeImageExtension(image)),
  }));
};

const renameInternalImagesByOrder = (
  images: ProductImage[],
): ProductImage[] => {
  return images.map((image, index) => ({
    ...image,
    name: `anh-noi-bo-${index + 1}-${createImageFilenameSuffix(image.id)}.${normalizeImageExtension(image)}`,
  }));
};

const renameDraftImagesByField = (
  images: ProductImage[],
  imageField: ProductImageField,
): ProductImage[] => {
  return imageField === "internalImages"
    ? renameInternalImagesByOrder(images)
    : renameImagesByOrder(images);
};

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl, {
    cache: "no-store",
    credentials: "omit",
    mode: "cors",
  });

  if (!response.ok) {
    throw new Error(`Không thể tải ảnh (${response.status})`);
  }

  const blob = await response.blob();

  if (blob.size === 0) {
    throw new Error("Ảnh tải về không có dữ liệu");
  }

  if (blob.type && !blob.type.startsWith("image/")) {
    throw new Error("Nguồn Cloudinary không trả về tệp ảnh hợp lệ");
  }

  return blob;
};

const getNativeShareNavigator = (): NativeShareNavigator | null => {
  if (typeof navigator === "undefined") return null;

  return navigator as NativeShareNavigator;
};

const dataUrlToShareFile = async (
  dataUrl: string,
  fileName: string,
): Promise<File> => {
  const blob = await dataUrlToBlob(dataUrl);
  const fallbackType = dataUrl.startsWith("data:image/png")
    ? "image/png"
    : "image/jpeg";

  return new File([blob], fileName || "sanpham.jpg", {
    type: blob.type || fallbackType,
  });
};

const imageBlobToPngBlob = async (
  sourceBlob: Blob,
  targetDocument: Document,
): Promise<Blob> => {
  if (sourceBlob.type.toLowerCase() === "image/png") {
    return sourceBlob;
  }

  const targetUrl = targetDocument.defaultView?.URL ?? URL;
  const objectUrl = targetUrl.createObjectURL(sourceBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = targetDocument.createElement("img");

      candidate.onload = () => resolve(candidate);
      candidate.onerror = () =>
        reject(new Error("Trình duyệt không thể giải mã ảnh Cloudinary"));
      candidate.decoding = "async";
      candidate.src = objectUrl;
    });

    if (image.naturalWidth === 0 || image.naturalHeight === 0) {
      throw new Error("Ảnh Cloudinary không có kích thước hợp lệ");
    }

    const canvas = targetDocument.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Không thể xử lý ảnh để copy");
    }

    // Ảnh được vẽ từ Blob nội bộ nên canvas không bị khóa CORS dù nguồn là Cloudinary.
    context.drawImage(image, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Không thể tạo ảnh PNG để copy"));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
  } finally {
    targetUrl.revokeObjectURL(objectUrl);
  }
};

const dataUrlToPngBlob = async (
  dataUrl: string,
  targetDocument: Document,
): Promise<Blob> => {
  const sourceBlob = await dataUrlToBlob(dataUrl);
  return imageBlobToPngBlob(sourceBlob, targetDocument);
};

const blobToDataUrl = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Không thể chuẩn bị ảnh cho clipboard"));
    };
    reader.onerror = () =>
      reject(new Error("Không thể chuẩn bị ảnh cho clipboard"));
    reader.readAsDataURL(blob);
  });
};

const copyImageWithLegacyClipboard = async (
  imageBlob: Blob,
  interactionWindow: Window,
  imageName: string,
): Promise<boolean> => {
  const targetDocument = interactionWindow.document;
  const dataUrl = await blobToDataUrl(imageBlob);
  const container = targetDocument.createElement("div");
  const image = targetDocument.createElement("img");

  container.contentEditable = "true";
  container.style.position = "fixed";
  container.style.left = "-100000px";
  container.style.top = "0";
  container.style.opacity = "0";
  container.style.pointerEvents = "none";
  image.alt = imageName || "Ảnh sản phẩm";
  image.src = dataUrl;
  container.appendChild(image);
  targetDocument.body.appendChild(container);

  try {
    await new Promise<void>((resolve, reject) => {
      if (image.complete && image.naturalWidth > 0) {
        resolve();
        return;
      }

      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Không thể đọc ảnh để copy"));
    });

    const selection = interactionWindow.getSelection();

    if (!selection) return false;

    const range = targetDocument.createRange();
    range.selectNode(image);
    selection.removeAllRanges();
    selection.addRange(range);
    container.focus({ preventScroll: true });

    const copied = targetDocument.execCommand("copy");
    selection.removeAllRanges();
    return copied;
  } finally {
    container.remove();
  }
};

const copyImageToClipboard = async (image: ProductImage): Promise<void> => {
  if (typeof window === "undefined") {
    throw new Error("Clipboard chỉ hoạt động trên trình duyệt");
  }

  const interactionWindow =
    getActiveInteractionWindow() as ClipboardCapableWindow;
  const clipboard =
    interactionWindow.navigator.clipboard ?? window.navigator.clipboard;
  const ClipboardItemClass =
    interactionWindow.ClipboardItem ??
    (typeof ClipboardItem !== "undefined"
      ? (ClipboardItem as ClipboardItemConstructor)
      : undefined);

  const pngBlobPromise = dataUrlToPngBlob(
    image.dataUrl,
    interactionWindow.document,
  );
  let clipboardError: unknown;

  if (clipboard?.write && ClipboardItemClass) {
    try {
      // Gọi write ngay trong thao tác bấm và truyền Promise để Safari/iPhone
      // không làm mất user activation trong lúc đang tải ảnh Cloudinary.
      await clipboard.write([
        new ClipboardItemClass({
          "image/png": pngBlobPromise,
        }),
      ]);
      return;
    } catch (error) {
      clipboardError = error;
    }

    try {
      // Một số Chromium cũ không nhận Promise trong ClipboardItem.
      const pngBlob = await pngBlobPromise;
      await clipboard.write([
        new ClipboardItemClass({
          "image/png": pngBlob,
        }),
      ]);
      return;
    } catch (error) {
      clipboardError = error;
    }
  }

  const pngBlob = await pngBlobPromise;

  if (
    await copyImageWithLegacyClipboard(
      pngBlob,
      interactionWindow,
      image.name,
    )
  ) {
    return;
  }

  const errorMessage =
    clipboardError instanceof Error && clipboardError.name === "NotAllowedError"
      ? "Trình duyệt đang chặn quyền ghi ảnh vào clipboard"
      : "Trình duyệt này chưa hỗ trợ copy ảnh tự động";
  throw new Error(errorMessage);
};

const downloadOriginalImage = async (
  image: ProductImage,
  index: number,
): Promise<void> => {
  const blob = await dataUrlToBlob(image.dataUrl);
  downloadBlob(
    blob,
    createSystemImageFilename(index, image.id, normalizeImageExtension(image)),
  );
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const interactionWindow = getActiveInteractionWindow();
  const targetDocument = interactionWindow.document;
  const link = targetDocument.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";

  targetDocument.body.appendChild(link);
  link.click();
  link.remove();

  // Safari iPhone có thể chưa tiếp nhận xong Blob nếu URL bị thu hồi ngay.
  interactionWindow.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
};

const saveBackupBlob = async (
  blob: Blob,
  filename: string,
): Promise<"shared" | "downloaded"> => {
  const shareNavigator = getNativeShareNavigator();

  if (shareNavigator?.share && shareNavigator.canShare) {
    const file = new File([blob], filename, {
      type: blob.type || "application/octet-stream",
      lastModified: Date.now(),
    });
    const shareData: NativeShareData = {
      title: filename,
      files: [file],
    };

    try {
      if (shareNavigator.canShare(shareData)) {
        await shareNavigator.share(shareData);
        return "shared";
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
      // Nếu Share Sheet không mở được, chuyển sang tải Blob thông thường.
    }
  }

  downloadBlob(blob, filename);
  return "downloaded";
};

const createExportPayload = (params: {
  settings: GlobalSettings;
  products: LocalProduct[];
  scheduleConfig: ScheduleConfig;
  scheduleAssignments: ScheduleAssignmentMap;
  postedRecords: PostedRecord[];
}): ExportPayload => {
  return {
    version: 21,
    settings: params.settings,
    products: params.products,
    scheduleConfig: params.scheduleConfig,
    scheduleAssignments: params.scheduleAssignments,
    postedRecords: params.postedRecords,
  };
};

const createBackupFileName = (extension: "json" | "json.gz"): string => {
  const safeDate = new Date().toISOString().replace(/[:.]/g, "-");

  return `local-products-${safeDate}.${extension}`;
};

const textToGzipBlob = async (text: string): Promise<Blob> => {
  if (typeof CompressionStream === "undefined") {
    throw new Error("Trình duyệt chưa hỗ trợ nén gzip");
  }

  const stream = new Blob([text], {
    type: "application/json;charset=utf-8",
  })
    .stream()
    .pipeThrough(new CompressionStream("gzip"));

  return new Response(stream).blob();
};

const gzipBlobToText = async (blob: Blob): Promise<string> => {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Trình duyệt chưa hỗ trợ giải nén gzip");
  }

  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));

  return new Response(stream).text();
};

const isGzipFile = (file: File): boolean => {
  const fileName = file.name.toLowerCase();

  return (
    fileName.endsWith(".gz") ||
    fileName.endsWith(".json.gz") ||
    file.type === "application/gzip" ||
    file.type === "application/x-gzip"
  );
};

const readJsonOrGzipFileText = async (file: File): Promise<string> => {
  if (isGzipFile(file)) {
    return gzipBlobToText(file);
  }

  return file.text();
};

const parseJsonTextToPayload = (text: string): ParsedImportPayload | null => {
  const parsed: unknown = JSON.parse(text);

  return parseImportPayload(parsed);
};

const migrateBackupImageToCloudinary = async (image: ProductImage): Promise<ProductImage> => {
  if (image.publicId && !image.dataUrl.startsWith("data:")) return image;

  const response = await fetch(image.dataUrl);
  if (!response.ok) throw new Error(`Không thể đọc ảnh backup ${image.name}`);
  const blob = await response.blob();
  const file = new File([blob], image.name || `backup-${image.id}`, {
    type: image.type || blob.type || "application/octet-stream",
    lastModified: Date.parse(image.createdAt) || Date.now(),
  });
  const uploaded = await uploadOriginalImageToCloudinary(file);

  return { ...uploaded, id: image.id, name: image.name || uploaded.name, createdAt: image.createdAt };
};

const migrateBackupProductsToCloudinary = async (
  products: LocalProduct[],
): Promise<LocalProduct[]> => {
  const newlyUploadedPublicIds: string[] = [];

  try {
    const migrated: LocalProduct[] = [];
    for (const product of products) {
      const migrateImages = async (images: ProductImage[]) => {
        const result: ProductImage[] = [];
        for (const image of images) {
          const migratedImage = await migrateBackupImageToCloudinary(image);
          if (migratedImage.publicId !== image.publicId) {
            newlyUploadedPublicIds.push(migratedImage.publicId);
          }
          result.push(migratedImage);
        }
        return result;
      };

      migrated.push({
        ...product,
        images: await migrateImages(product.images),
        internalImages: await migrateImages(product.internalImages),
      });
    }
    return migrated;
  } catch (error) {
    await deleteUnattachedCloudinaryImages(newlyUploadedPublicIds).catch(() => undefined);
    throw error;
  }
};

const restorePayloadToLocal = async (
  payload: ParsedImportPayload,
  params: {
    setSettings: (settings: GlobalSettings) => void;
    setScheduleConfig: (config: ScheduleConfig) => void;
    setScheduleAssignments: (assignments: ScheduleAssignmentMap) => void;
    setPostedRecords: (records: PostedRecord[]) => void;
    setProducts: (products: LocalProduct[]) => void;
  },
): Promise<void> => {
  const today = getTodayString();
  const nextSettings = payload.settings ?? {
    ...defaultSettings,
    contactOptions: [],
  };
  const nextScheduleConfig = payload.scheduleConfig ?? {
    ...defaultScheduleConfig,
    dateFrom: today,
    dateTo: today,
    taskNames: [...defaultScheduleConfig.taskNames],
    selectedCategories: [],
  };
  const nextScheduleAssignments = payload.scheduleAssignments ?? {};
  const nextPostedRecords = payload.postedRecords ?? [];

  const cloudProducts = await migrateBackupProductsToCloudinary(payload.products);
  await replaceAllProductsInDb(cloudProducts);
  await saveAppStatePatch({
    settings: nextSettings,
    scheduleConfig: nextScheduleConfig,
    scheduleAssignments: nextScheduleAssignments,
    postedRecords: nextPostedRecords,
  });

  params.setSettings(nextSettings);
  params.setScheduleConfig(nextScheduleConfig);
  params.setScheduleAssignments(nextScheduleAssignments);
  params.setPostedRecords(nextPostedRecords);
  params.setProducts(sortProductsByUpdatedAt(cloudProducts));
};

type LocalFileSystemPermissionState = "granted" | "denied" | "prompt";
type LocalFileSystemPermissionDescriptor = { mode: "read" | "readwrite" };

type LocalFileSystemHandle = {
  kind: "file" | "directory";
  name: string;
  queryPermission?: (
    descriptor: LocalFileSystemPermissionDescriptor,
  ) => Promise<LocalFileSystemPermissionState>;
  requestPermission?: (
    descriptor: LocalFileSystemPermissionDescriptor,
  ) => Promise<LocalFileSystemPermissionState>;
};

type LocalFileSystemWritable = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
};

type LocalFileSystemFileHandle = LocalFileSystemHandle & {
  kind: "file";
  getFile: () => Promise<File>;
  createWritable: () => Promise<LocalFileSystemWritable>;
};

type LocalFileSystemDirectoryHandle = LocalFileSystemHandle & {
  kind: "directory";
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<LocalFileSystemFileHandle>;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<LocalFileSystemDirectoryHandle>;
  removeEntry: (
    name: string,
    options?: { recursive?: boolean },
  ) => Promise<void>;
  values: () => AsyncIterableIterator<LocalFileSystemHandle>;
};

type DirectoryPickerOptions = {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?:
  | "desktop"
  | "documents"
  | "downloads"
  | "music"
  | "pictures"
  | "videos"
  | LocalFileSystemHandle;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (
    options?: DirectoryPickerOptions,
  ) => Promise<LocalFileSystemDirectoryHandle>;
};

type LocalManagedImage = {
  name: string;
  size: number;
  lastModified: number;
};

type LocalImageDirectorySnapshot = {
  active: LocalManagedImage[];
  trash: LocalManagedImage[];
};

type LocalImageMoveResult = {
  moved: number;
  failed: number;
};

const LOCAL_IMAGE_DIRECTORY_DATABASE_NAME = "local-products-file-system";
const LOCAL_IMAGE_DIRECTORY_DATABASE_VERSION = 1;
const LOCAL_IMAGE_DIRECTORY_STORE_NAME = "handles";
const LOCAL_IMAGE_DIRECTORY_HANDLE_KEY = "image-directory";
const LOCAL_IMAGE_TRASH_DIRECTORY_NAME = "_trash";
const LOCAL_IMAGE_RENDER_LIMIT = 250;
const LOCAL_IMAGE_EXTENSION_PATTERN = /\.(?:jpe?g|png|webp|heic|heif)$/iu;

const canUseDirectoryPicker = (): boolean => {
  if (typeof window === "undefined" || !window.isSecureContext) return false;

  const interactionWindow = getActiveInteractionWindow();

  return (
    typeof (interactionWindow as DirectoryPickerWindow).showDirectoryPicker ===
    "function"
  );
};

const openLocalImageDirectoryDatabase = async (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB không khả dụng"));
      return;
    }

    const request = window.indexedDB.open(
      LOCAL_IMAGE_DIRECTORY_DATABASE_NAME,
      LOCAL_IMAGE_DIRECTORY_DATABASE_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(LOCAL_IMAGE_DIRECTORY_STORE_NAME)) {
        database.createObjectStore(LOCAL_IMAGE_DIRECTORY_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Không thể mở IndexedDB của thư mục ảnh"),
      );
  });
};

const readStoredLocalImageDirectoryHandle = async (): Promise<LocalFileSystemDirectoryHandle | null> => {
  const database = await openLocalImageDirectoryDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        LOCAL_IMAGE_DIRECTORY_STORE_NAME,
        "readonly",
      );
      const request = transaction
        .objectStore(LOCAL_IMAGE_DIRECTORY_STORE_NAME)
        .get(LOCAL_IMAGE_DIRECTORY_HANDLE_KEY);

      request.onsuccess = () => {
        const value = request.result as unknown;

        if (
          value &&
          typeof value === "object" &&
          (value as LocalFileSystemHandle).kind === "directory"
        ) {
          resolve(value as LocalFileSystemDirectoryHandle);
          return;
        }

        resolve(null);
      };
      request.onerror = () =>
        reject(
          request.error ?? new Error("Không thể đọc thư mục ảnh đã lưu"),
        );
    });
  } finally {
    database.close();
  }
};

const storeLocalImageDirectoryHandle = async (
  handle: LocalFileSystemDirectoryHandle,
): Promise<void> => {
  const database = await openLocalImageDirectoryDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        LOCAL_IMAGE_DIRECTORY_STORE_NAME,
        "readwrite",
      );

      transaction
        .objectStore(LOCAL_IMAGE_DIRECTORY_STORE_NAME)
        .put(handle, LOCAL_IMAGE_DIRECTORY_HANDLE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error("Không thể lưu quyền thư mục ảnh"),
        );
    });
  } finally {
    database.close();
  }
};

const clearStoredLocalImageDirectoryHandle = async (): Promise<void> => {
  const database = await openLocalImageDirectoryDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        LOCAL_IMAGE_DIRECTORY_STORE_NAME,
        "readwrite",
      );

      transaction
        .objectStore(LOCAL_IMAGE_DIRECTORY_STORE_NAME)
        .delete(LOCAL_IMAGE_DIRECTORY_HANDLE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error("Không thể bỏ liên kết thư mục ảnh"),
        );
    });
  } finally {
    database.close();
  }
};

const queryLocalImageDirectoryPermission = async (
  handle: LocalFileSystemDirectoryHandle,
): Promise<LocalFileSystemPermissionState> => {
  if (!handle.queryPermission) return "prompt";

  try {
    return await handle.queryPermission({ mode: "readwrite" });
  } catch {
    return "prompt";
  }
};

const requestLocalImageDirectoryPermission = async (
  handle: LocalFileSystemDirectoryHandle,
): Promise<LocalFileSystemPermissionState> => {
  const currentPermission = await queryLocalImageDirectoryPermission(handle);

  if (currentPermission === "granted") return currentPermission;
  if (!handle.requestPermission) return currentPermission;

  return handle.requestPermission({ mode: "readwrite" });
};

const chooseLocalImageDirectory = async (): Promise<LocalFileSystemDirectoryHandle> => {
  const interactionWindow = getActiveInteractionWindow();
  const directoryPicker = (interactionWindow as DirectoryPickerWindow)
    .showDirectoryPicker;

  if (!directoryPicker) {
    throw new Error("Trình duyệt chưa hỗ trợ chọn thư mục lưu");
  }

  return directoryPicker.call(interactionWindow, {
    id: "local-product-images",
    mode: "readwrite",
    startIn: "downloads",
  });
};

const isLocalManagedImageName = (name: string): boolean => {
  return LOCAL_IMAGE_EXTENSION_PATTERN.test(name.trim());
};

const readLocalImagesFromDirectory = async (
  directoryHandle: LocalFileSystemDirectoryHandle,
): Promise<LocalManagedImage[]> => {
  const images: LocalManagedImage[] = [];

  for await (const entry of directoryHandle.values()) {
    if (entry.kind !== "file" || !isLocalManagedImageName(entry.name)) continue;

    const file = await (entry as LocalFileSystemFileHandle).getFile();

    images.push({
      name: entry.name,
      size: file.size,
      lastModified: file.lastModified,
    });
  }

  return images.sort((first, second) => second.lastModified - first.lastModified);
};

const getLocalImageTrashDirectory = async (
  rootHandle: LocalFileSystemDirectoryHandle,
  create: boolean,
): Promise<LocalFileSystemDirectoryHandle | null> => {
  try {
    return await rootHandle.getDirectoryHandle(LOCAL_IMAGE_TRASH_DIRECTORY_NAME, {
      create,
    });
  } catch (error) {
    if (!create && error instanceof DOMException && error.name === "NotFoundError") {
      return null;
    }

    throw error;
  }
};

const readLocalImageDirectorySnapshot = async (
  rootHandle: LocalFileSystemDirectoryHandle,
): Promise<LocalImageDirectorySnapshot> => {
  const active = await readLocalImagesFromDirectory(rootHandle);
  const trashHandle = await getLocalImageTrashDirectory(rootHandle, false);
  const trash = trashHandle
    ? await readLocalImagesFromDirectory(trashHandle)
    : [];

  return { active, trash };
};

const splitLocalFileName = (name: string): { base: string; extension: string } => {
  const dotIndex = name.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return { base: name, extension: "" };
  }

  return {
    base: name.slice(0, dotIndex),
    extension: name.slice(dotIndex),
  };
};

const localDirectoryHasFile = async (
  directoryHandle: LocalFileSystemDirectoryHandle,
  name: string,
): Promise<boolean> => {
  try {
    await directoryHandle.getFileHandle(name);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return false;
    }

    throw error;
  }
};

const createAvailableLocalImageName = async (
  directoryHandle: LocalFileSystemDirectoryHandle,
  preferredName: string,
): Promise<string> => {
  if (!(await localDirectoryHasFile(directoryHandle, preferredName))) {
    return preferredName;
  }

  const { base, extension } = splitLocalFileName(preferredName);

  for (let index = 1; index <= 10_000; index += 1) {
    const candidate = `${base} (${index})${extension}`;

    if (!(await localDirectoryHasFile(directoryHandle, candidate))) {
      return candidate;
    }
  }

  throw new Error("Không thể tạo tên file không trùng");
};

const copyLocalImageThenRemoveSource = async (
  sourceDirectory: LocalFileSystemDirectoryHandle,
  targetDirectory: LocalFileSystemDirectoryHandle,
  sourceName: string,
): Promise<string> => {
  const sourceHandle = await sourceDirectory.getFileHandle(sourceName);
  const sourceFile = await sourceHandle.getFile();
  const targetName = await createAvailableLocalImageName(
    targetDirectory,
    sourceName,
  );
  const targetHandle = await targetDirectory.getFileHandle(targetName, {
    create: true,
  });
  const writable = await targetHandle.createWritable();

  try {
    await writable.write(sourceFile);
    await writable.close();
  } catch (error) {
    try {
      await writable.close();
    } catch {
      // Giữ lỗi ghi file ban đầu.
    }
    await targetDirectory.removeEntry(targetName).catch(() => undefined);
    throw error;
  }

  const copiedFile = await targetHandle.getFile();

  if (copiedFile.size !== sourceFile.size) {
    await targetDirectory.removeEntry(targetName).catch(() => undefined);
    throw new Error(`Không thể xác minh bản sao của ${sourceName}`);
  }

  await sourceDirectory.removeEntry(sourceName);
  return targetName;
};

const moveLocalImagesToTrash = async (
  rootHandle: LocalFileSystemDirectoryHandle,
  names: string[],
): Promise<LocalImageMoveResult> => {
  const trashHandle = await getLocalImageTrashDirectory(rootHandle, true);

  if (!trashHandle) return { moved: 0, failed: names.length };

  let moved = 0;
  let failed = 0;

  for (const name of names) {
    try {
      await copyLocalImageThenRemoveSource(rootHandle, trashHandle, name);
      moved += 1;
    } catch {
      failed += 1;
    }
  }

  return { moved, failed };
};

const restoreLocalImagesFromTrash = async (
  rootHandle: LocalFileSystemDirectoryHandle,
  names: string[],
): Promise<LocalImageMoveResult> => {
  const trashHandle = await getLocalImageTrashDirectory(rootHandle, false);

  if (!trashHandle) return { moved: 0, failed: names.length };

  let moved = 0;
  let failed = 0;

  for (const name of names) {
    try {
      await copyLocalImageThenRemoveSource(trashHandle, rootHandle, name);
      moved += 1;
    } catch {
      failed += 1;
    }
  }

  return { moved, failed };
};

const permanentlyDeleteLocalTrashImages = async (
  rootHandle: LocalFileSystemDirectoryHandle,
  names: string[],
): Promise<LocalImageMoveResult> => {
  const trashHandle = await getLocalImageTrashDirectory(rootHandle, false);

  if (!trashHandle) return { moved: 0, failed: names.length };

  let moved = 0;
  let failed = 0;

  for (const name of names) {
    try {
      await trashHandle.removeEntry(name);
      moved += 1;
    } catch {
      failed += 1;
    }
  }

  return { moved, failed };
};

const saveImagesToDirectory = async (
  request: DownloadRequest,
  directoryHandle: LocalFileSystemDirectoryHandle,
): Promise<void> => {
  for (let index = 0; index < request.images.length; index += 1) {
    const image = request.images[index];

    if (!image) continue;

    const blob = await dataUrlToBlob(image.dataUrl);
    const preferredName = createSystemImageFilename(
      request.startIndex + index,
      image.id,
      normalizeImageExtension(image),
    );
    const fileName = await createAvailableLocalImageName(
      directoryHandle,
      preferredName,
    );
    const fileHandle = await directoryHandle.getFileHandle(fileName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();

    await writable.write(blob);
    await writable.close();
  }
};

const toMinutes = (time: string): number => {
  const [hour, minute] = time.split(":").map(Number);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;

  return hour * 60 + minute;
};

const toTimeString = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const getDatesBetween = (dateFrom: string, dateTo: string): string[] => {
  if (!dateFrom || !dateTo) return [];

  const result: string[] = [];
  const current = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);

  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) return [];
  if (current > end) return [];

  while (current <= end) {
    result.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return result;
};

const createDailyTimes = (
  startTime: string,
  endTime: string,
  gapHours: number,
): {
  times: string[];
  warning?: string;
} => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const gap = gapHours * 60;

  if (start > end) {
    return {
      times: [],
      warning: "Mốc đầu đang lớn hơn mốc cuối. Vui lòng chọn lại khung giờ.",
    };
  }

  const times: string[] = [];
  let cursor = start;

  while (cursor <= end) {
    times.push(toTimeString(cursor));
    cursor += gap;
  }

  const lastValid = times[times.length - 1];
  const nextTime = toTimeString(cursor);

  const warning =
    cursor > end && lastValid && toMinutes(lastValid) !== end
      ? `Thông báo giờ: khung giờ hiện tại không chia đều. Mốc gần nhất theo khoảng cách đang chọn là ${lastValid}; mốc kế tiếp sẽ là ${nextTime}.`
      : undefined;

  return {
    times,
    warning,
  };
};

const shuffleProducts = <T,>(items: T[]): T[] => {
  const cloned = [...items];

  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = cloned[index];

    cloned[index] = cloned[randomIndex];
    cloned[randomIndex] = current;
  }

  return cloned;
};

const createCategoryBalancedProducts = (
  items: LocalProduct[],
): LocalProduct[] => {
  const groupedProducts = new Map<string, LocalProduct[]>();

  shuffleProducts(items).forEach((product) => {
    const categoryKey = normalizeTextKey(product.category || "Chưa phân loại");
    const currentProducts = groupedProducts.get(categoryKey) ?? [];

    groupedProducts.set(categoryKey, [...currentProducts, product]);
  });

  const categoryQueues = Array.from(groupedProducts.entries()).map(
    ([categoryKey, products]) => ({
      categoryKey,
      products: shuffleProducts(products),
    }),
  );
  const result: LocalProduct[] = [];
  let previousCategoryKey = "";

  while (categoryQueues.some((item) => item.products.length > 0)) {
    const availableQueues = categoryQueues
      .filter((item) => item.products.length > 0)
      .sort((first, second) => second.products.length - first.products.length);
    const preferredQueue =
      availableQueues.find(
        (item) => item.categoryKey !== previousCategoryKey,
      ) ?? availableQueues[0];

    if (!preferredQueue) break;

    const product = preferredQueue.products.shift();

    if (!product) continue;

    result.push(product);
    previousCategoryKey = preferredQueue.categoryKey;
  }

  return result;
};

const buildRandomSchedule = (
  products: LocalProduct[],
  config: ScheduleConfig,
  commonDescription: string,
  contactText: string,
  includeSocialTags: boolean,
): BuildScheduleResult => {
  const activeProducts = products.filter((product) => !product.isDone);

  if (activeProducts.length === 0) {
    return {
      slots: [],
      warnings: [],
    };
  }

  const warnings: ScheduleWarning[] = [];

  const selectedCategoryKeys = new Set(
    config.selectedCategories.map((category) => normalizeTextKey(category)),
  );

  const usableProducts =
    config.selectedCategories.length === 0
      ? activeProducts
      : activeProducts.filter((product) =>
        selectedCategoryKeys.has(normalizeTextKey(product.category)),
      );

  if (usableProducts.length === 0) {
    return {
      slots: [],
      warnings: [
        {
          type: "emptyCategory",
          message: "Không có sản phẩm phù hợp để chia lịch.",
        },
      ],
    };
  }

  const dates = getDatesBetween(config.dateFrom, config.dateTo);

  if (dates.length === 0) {
    return {
      slots: [],
      warnings: [
        {
          type: "invalidTime",
          message: "Khoảng ngày chưa hợp lệ.",
        },
      ],
    };
  }

  const dailyTimeResult = createDailyTimes(
    config.startTime,
    config.endTime,
    config.gapHours,
  );

  if (dailyTimeResult.warning) {
    warnings.push({
      type: "overflow",
      message: dailyTimeResult.warning,
    });
  }

  const times = dailyTimeResult.times;

  if (usableProducts.length < times.length) {
    warnings.push({
      type: "notEnoughProducts",
      message: `Mỗi ngày có ${times.length} mốc đăng nhưng chỉ có ${usableProducts.length} sản phẩm khả dụng.`,
    });
  }

  const slots: ScheduleSlot[] = [];
  let previousDayLastTwoProductIds: string[] = [];

  for (const date of dates) {
    const dailyUsedProductIds = new Set<string>();
    let dailyPool = shuffleProducts(usableProducts);

    for (const time of times) {
      const isFirstSlotOfDay = dailyUsedProductIds.size === 0;

      let candidate = dailyPool.find((product) => {
        const duplicatedToday = dailyUsedProductIds.has(product.id);
        const duplicatedWithPreviousDay =
          isFirstSlotOfDay && previousDayLastTwoProductIds.includes(product.id);

        return !duplicatedToday && !duplicatedWithPreviousDay;
      });

      if (!candidate) {
        candidate = dailyPool.find(
          (product) => !dailyUsedProductIds.has(product.id),
        );
      }

      if (!candidate) {
        break;
      }

      const description =
        candidate.description.trim() || commonDescription.trim();
      const postText = buildPostText(
        candidate,
        commonDescription,
        contactText,
        includeSocialTags,
      );

      dailyUsedProductIds.add(candidate.id);

      slots.push({
        id: `${date}-${time}-${candidate.id}`,
        date,
        time,
        productId: candidate.id,
        productName: candidate.name,
        category: candidate.category,
        image: candidate.images[0]?.dataUrl,
        images: candidate.images,
        priceText: candidate.priceText,
        description,
        postText,
      });

      dailyPool = dailyPool.filter((product) => product.id !== candidate.id);
    }

    const currentDayProductIds = slots
      .filter((slot) => slot.date === date)
      .map((slot) => slot.productId);

    previousDayLastTwoProductIds = currentDayProductIds.slice(-2);
  }

  return {
    slots,
    warnings,
  };
};

export default function LocalProductsPage() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const persistedDraftPublicIdsRef = useRef<Set<string>>(new Set<string>());
  const contactSelectionPromptedRef = useRef<boolean>(false);
  const previousContactOptionCountRef = useRef<number>(0);
  const persistedAppStateSignaturesRef = useRef<{
    settings: string;
    scheduleConfig: string;
    scheduleAssignments: string;
  }>({
    settings: "",
    scheduleConfig: "",
    scheduleAssignments: "",
  });
  const handleLocalWorkspaceKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): void => {
      if (event.key.toLowerCase() !== "f" || !isTypingTarget(event.target)) {
        return;
      }

      event.stopPropagation();
    },
    [],
  );
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [settings, setSettings] = useState<GlobalSettings>(defaultSettings);
  const [contactDraft, setContactDraft] = useState<string>("");
  const [editingContactOptionId, setEditingContactOptionId] =
    useState<string>("");
  const [facebookPageNameDraft, setFacebookPageNameDraft] =
    useState<string>("");
  const [facebookPageAssetIdDraft, setFacebookPageAssetIdDraft] =
    useState<string>("");
  const [editingFacebookPageOptionId, setEditingFacebookPageOptionId] =
    useState<string>("");
  const [selectedFacebookPageId, setSelectedFacebookPageId] =
    useState<string>("");
  const [facebookDuplicateNameDraft, setFacebookDuplicateNameDraft] =
    useState<string>("");
  const [facebookDuplicateCategoryDraft, setFacebookDuplicateCategoryDraft] =
    useState<string>("");
  const [facebookDuplicateUrlDraft, setFacebookDuplicateUrlDraft] =
    useState<string>("");
  const [editingFacebookDuplicatePostId, setEditingFacebookDuplicatePostId] =
    useState<string>("");
  const [facebookGroupNameDraft, setFacebookGroupNameDraft] =
    useState<string>("");
  const [facebookGroupCategoryDraft, setFacebookGroupCategoryDraft] =
    useState<string>("");
  const [facebookGroupUrlDraft, setFacebookGroupUrlDraft] =
    useState<string>("");
  const [facebookGroupActiveIndex, setFacebookGroupActiveIndex] =
    useState<number>(0);
  const [facebookSearchQuery, setFacebookSearchQuery] = useState<string>(
    DEFAULT_FACEBOOK_SEARCH_QUERY,
  );
  const [isFacebookSearchDialogOpen, setIsFacebookSearchDialogOpen] =
    useState<boolean>(false);
  const [editingId, setEditingId] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [productRenderState, setProductRenderState] = useState<{
    key: string;
    limit: number;
  }>({ key: "", limit: INITIAL_PRODUCT_RENDER_LIMIT });
  const [activeCategoryTab, setActiveCategoryTab] =
    useState<CategoryTab>("all");
  const [draggingCategoryKey, setDraggingCategoryKey] =
    useState<string>("");
  const [categoryDropTarget, setCategoryDropTarget] = useState<{
    key: string;
    position: CategoryDropPosition;
  } | null>(null);
  const [isMobileCategoryMenuOpen, setIsMobileCategoryMenuOpen] =
    useState<boolean>(false);
  const [isHeaderActionsMenuOpen, setIsHeaderActionsMenuOpen] =
    useState<boolean>(false);
  const [isScrollTopVisible, setIsScrollTopVisible] =
    useState<boolean>(false);
  const [isCopyNfkcEnabled, setIsCopyNfkcEnabled] =
    useState<boolean>(false);
  const [includeSocialTags, setIncludeSocialTags] =
    useState<boolean>(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [isDevicePreferencesReady, setIsDevicePreferencesReady] =
    useState<boolean>(false);
  const prefersReducedMotion = useReducedMotion();
  const [imageDownloadCategory, setImageDownloadCategory] =
    useState<CategoryTab>("all");
  const [localImageDirectoryHandle, setLocalImageDirectoryHandle] =
    useState<LocalFileSystemDirectoryHandle | null>(null);
  const [localImageDirectoryPermission, setLocalImageDirectoryPermission] =
    useState<LocalFileSystemPermissionState>("prompt");
  const [localImageFiles, setLocalImageFiles] = useState<LocalManagedImage[]>([]);
  const [localTrashImageFiles, setLocalTrashImageFiles] =
    useState<LocalManagedImage[]>([]);
  const [localImageView, setLocalImageView] =
    useState<"active" | "trash">("active");
  const [localImageQuery, setLocalImageQuery] = useState<string>("");
  const [selectedLocalImageNames, setSelectedLocalImageNames] = useState<
    Set<string>
  >(() => new Set<string>());
  const [isLocalImageManagerBusy, setIsLocalImageManagerBusy] =
    useState<boolean>(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [scheduleQuery, setScheduleQuery] = useState<string>("");
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [compactScheduleConfig, setCompactScheduleConfig] =
    useState<boolean>(true);
  const [activeScheduleTaskIndex, setActiveScheduleTaskIndex] =
    useState<number>(0);
  const [draggingProductId, setDraggingProductId] = useState<string>("");
  const [draggingDraftImageId, setDraggingDraftImageId] = useState<string>("");
  const [draggingDraftImageField, setDraggingDraftImageField] = useState<
    ProductImageField | ""
  >("");
  const [pendingRemoveTaskIndex, setPendingRemoveTaskIndex] = useState<
    number | null
  >(null);
  const [pendingDownload, setPendingDownload] =
    useState<DownloadRequest | null>(null);
  const [pendingShare, setPendingShare] = useState<ShareRequest | null>(null);
  const [downloadedProductIds, setDownloadedProductIds] = useState<
    Set<string>
  >(() => new Set<string>());
  const [includeInternalShareImages, setIncludeInternalShareImages] =
    useState<boolean>(true);
  const [skipInternalDownloadImages, setSkipInternalDownloadImages] =
    useState<boolean>(false);
  const [shareDialogStep, setShareDialogStep] =
    useState<ShareDialogStep>("share");
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmRequest | null>(
    null,
  );
  const [pendingBackup, setPendingBackup] =
    useState<PreparedBackup | null>(null);
  const [isConfirmExecuting, setIsConfirmExecuting] = useState<boolean>(false);
  const [isShareExecuting, setIsShareExecuting] = useState<boolean>(false);
  const [isBackupSaving, setIsBackupSaving] = useState<boolean>(false);
  const [isBackupRestoreReady, setIsBackupRestoreReady] =
    useState<boolean>(false);
  const [scheduleAssignments, setScheduleAssignments] =
    useState<ScheduleAssignmentMap>({});
  const [dragOverImageField, setDragOverImageField] = useState<
    ProductImageField | ""
  >("");
  const [isProcessingImages, setIsProcessingImages] = useState<boolean>(false);
  const [isSettingsReady, setIsSettingsReady] = useState<boolean>(false);
  const [pageLoadingText, setPageLoadingText] = useState<string>("");
  const [modalStack, setModalStack] = useState<ModalName[]>([]);
  const activeModal = modalStack[modalStack.length - 1] ?? "";
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [selectedAlbumImageId, setSelectedAlbumImageId] = useState<string>("");
  const [selectedAlbumImageIds, setSelectedAlbumImageIds] = useState<
    Set<string>
  >(() => new Set<string>());
  const [albumSource, setAlbumSource] = useState<AlbumSource | null>(null);
  const [copiedKey, setCopiedKey] = useState<string>("");
  const [selectedDescriptionCopy, setSelectedDescriptionCopy] =
    useState<SelectedDescriptionCopy | null>(null);
  const [pendingDoneProductIds, setPendingDoneProductIds] = useState<
    Set<string>
  >(() => new Set<string>());
  const [postedRecords, setPostedRecords] = useState<PostedRecord[]>([]);
  const [nowTick, setNowTick] = useState<Date>(new Date());
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(() => loadScheduleConfig());
  const [pictureInPictureWindow, setPictureInPictureWindow] =
    useState<Window | null>(null);
  const [hourlyNotificationConfig, setHourlyNotificationConfig] =
    useState<HourlyNotificationConfig>(() => loadHourlyNotificationConfig());
  const [hourlyNotificationDraft, setHourlyNotificationDraft] =
    useState<HourlyNotificationConfig>(() => loadHourlyNotificationConfig());
  const hourlyNotificationTimeoutRef = useRef<number | null>(null);
  const hourlyAudioContextRef = useRef<AudioContext | null>(null);

  const currentLocalImageFiles =
    localImageView === "trash" ? localTrashImageFiles : localImageFiles;
  const filteredLocalImageFiles = useMemo(() => {
    const normalizedQuery = normalizeTextKey(localImageQuery);

    if (!normalizedQuery) return currentLocalImageFiles;

    return currentLocalImageFiles.filter((file) =>
      normalizeTextKey(file.name).includes(normalizedQuery),
    );
  }, [currentLocalImageFiles, localImageQuery]);
  const localImageTotalSize = useMemo(
    () => localImageFiles.reduce((total, file) => total + file.size, 0),
    [localImageFiles],
  );
  const localTrashImageTotalSize = useMemo(
    () => localTrashImageFiles.reduce((total, file) => total + file.size, 0),
    [localTrashImageFiles],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const storedHandle = await readStoredLocalImageDirectoryHandle();

        if (!storedHandle || cancelled) return;

        const permission = await queryLocalImageDirectoryPermission(storedHandle);

        if (cancelled) return;

        setLocalImageDirectoryHandle(storedHandle);
        setLocalImageDirectoryPermission(permission);

        if (permission !== "granted") return;

        const snapshot = await readLocalImageDirectorySnapshot(storedHandle);

        if (cancelled) return;

        setLocalImageFiles(snapshot.active);
        setLocalTrashImageFiles(snapshot.trash);
      } catch {
        if (!cancelled) {
          setLocalImageDirectoryPermission("prompt");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const applyPreferences = (preferences: DevicePreferences): void => {
      setIncludeSocialTags(preferences.includeSocialTags);
      setIsCopyNfkcEnabled(preferences.isCopyNfkcEnabled);
      setSelectedContactId(preferences.selectedContactId);
    };

    applyPreferences(loadDevicePreferences());
    setIsDevicePreferencesReady(true);

    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== DEVICE_PREFERENCES_STORAGE_KEY) return;

      try {
        applyPreferences(
          event.newValue
            ? normalizeDevicePreferences(JSON.parse(event.newValue) as unknown)
            : defaultDevicePreferences,
        );
      } catch {
        applyPreferences(defaultDevicePreferences);
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!isDevicePreferencesReady) return;

    saveDevicePreferences({
      includeSocialTags,
      isCopyNfkcEnabled,
      selectedContactId,
    });
  }, [
    includeSocialTags,
    isCopyNfkcEnabled,
    isDevicePreferencesReady,
    selectedContactId,
  ]);

  const copyText = useCallback(
    async (value: string): Promise<void> => {
      await writeClipboardText(
        isCopyNfkcEnabled ? normalizeCopiedText(value) : value,
      );
    },
    [isCopyNfkcEnabled],
  );

  useEffect(() => {
    setDownloadedProductIds(loadDownloadedProductIds());

    const storedConfig = loadHourlyNotificationConfig();

    if (!storedConfig.enabled) return;

    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      const configWithAnchor = storedConfig.anchorAt
        ? storedConfig
        : {
          ...storedConfig,
          anchorAt: createNextNotificationAnchor(
            new Date(),
            storedConfig.minuteOffset,
          ).toISOString(),
        };

      setHourlyNotificationConfig(configWithAnchor);
      setHourlyNotificationDraft(configWithAnchor);
      saveHourlyNotificationConfig(configWithAnchor);
      return;
    }

    const disabledConfig = { ...storedConfig, enabled: false };
    setHourlyNotificationConfig(disabledConfig);
    setHourlyNotificationDraft(disabledConfig);
    saveHourlyNotificationConfig(disabledConfig);
  }, []);

  const prepareHourlyNotificationSound = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined" || typeof AudioContext === "undefined") {
      return;
    }

    const audioContext =
      hourlyAudioContextRef.current ??
      new AudioContext({ latencyHint: "interactive" });

    hourlyAudioContextRef.current = audioContext;

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  }, []);

  const playHourlyNotificationSound = useCallback(async (): Promise<void> => {
    try {
      await prepareHourlyNotificationSound();

      const audioContext = hourlyAudioContextRef.current;
      if (!audioContext || audioContext.state !== "running") return;

      const startAt = audioContext.currentTime;
      const gain = audioContext.createGain();
      const firstTone = audioContext.createOscillator();
      const secondTone = audioContext.createOscillator();

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.72);
      gain.connect(audioContext.destination);

      firstTone.type = "sine";
      firstTone.frequency.setValueAtTime(880, startAt);
      firstTone.connect(gain);
      firstTone.start(startAt);
      firstTone.stop(startAt + 0.24);

      secondTone.type = "sine";
      secondTone.frequency.setValueAtTime(1174.66, startAt + 0.3);
      secondTone.connect(gain);
      secondTone.start(startAt + 0.3);
      secondTone.stop(startAt + 0.72);
    } catch {
      return;
    }
  }, [prepareHourlyNotificationSound]);

  const showBrowserSystemNotification = useCallback(
    async (title: string, body: string, tag: string): Promise<boolean> => {
      if (
        typeof window === "undefined" ||
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
      ) {
        return false;
      }

      const options: NotificationOptions = {
        body,
        tag,
        requireInteraction: true,
        silent: false,
      };

      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();

          if (registration) {
            await registration.showNotification(title, options);
            return true;
          }
        } catch {
          // Chuyển sang Notification API của trang hiện tại.
        }
      }

      try {
        const notification = new Notification(title, options);

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const showHourlyNotification = useCallback(
    (scheduledAt: Date): void => {
      if (
        typeof window === "undefined" ||
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
      ) {
        return;
      }

      const currentTime = new Date();
      const latenessMs = currentTime.getTime() - scheduledAt.getTime();

      if (latenessMs < -1_000 || latenessMs > HOURLY_NOTIFICATION_MAX_LATE_MS) {
        return;
      }

      const notificationKey = createScheduledNotificationKey(scheduledAt);
      const previousNotificationKey = window.localStorage.getItem(
        HOURLY_NOTIFICATION_LAST_SLOT_KEY,
      );

      if (previousNotificationKey === notificationKey) return;

      window.localStorage.setItem(
        HOURLY_NOTIFICATION_LAST_SLOT_KEY,
        notificationKey,
      );

      const clockTime = formatLocalClockTime(currentTime);

      void showBrowserSystemNotification(
        `Bây giờ là ${clockTime}`,
        `Mốc nhắc ${formatLocalClockTime(scheduledAt)} · Local Product Manager`,
        `local-products-hourly-${notificationKey}`,
      ).then((wasShown) => {
        if (wasShown) {
          void playHourlyNotificationSound();
        }
      });
    },
    [playHourlyNotificationSound, showBrowserSystemNotification],
  );

  const applyHourlyNotificationConfig = useCallback(
    (enabled: boolean): HourlyNotificationConfig => {
      const nextConfig: HourlyNotificationConfig = {
        enabled,
        minuteOffset: clampInteger(hourlyNotificationDraft.minuteOffset, 0, 59),
        intervalHours: clampInteger(hourlyNotificationDraft.intervalHours, 1, 24),
        dailyLimit: clampInteger(hourlyNotificationDraft.dailyLimit, 0, 24),
        anchorAt: enabled
          ? createNextNotificationAnchor(
            new Date(),
            hourlyNotificationDraft.minuteOffset,
          ).toISOString()
          : hourlyNotificationConfig.anchorAt,
      };

      setHourlyNotificationConfig(nextConfig);
      setHourlyNotificationDraft(nextConfig);
      saveHourlyNotificationConfig(nextConfig);
      return nextConfig;
    },
    [hourlyNotificationConfig.anchorAt, hourlyNotificationDraft],
  );

  const handleSaveHourlyNotificationConfig = useCallback((): void => {
    const nextConfig = applyHourlyNotificationConfig(
      hourlyNotificationConfig.enabled,
    );

    Toastify(
      nextConfig.enabled
        ? "Đã lưu lịch và tính lại mốc kế tiếp theo thời gian hiện tại"
        : "Đã lưu cấu hình thông báo",
      200,
    );
  }, [applyHourlyNotificationConfig, hourlyNotificationConfig.enabled]);

  const handleEnableHourlyNotification = useCallback(async (): Promise<void> => {
    if (typeof Notification === "undefined") {
      Toastify("Trình duyệt không hỗ trợ thông báo hệ thống", 400);
      return;
    }

    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;

    if (permission !== "granted") {
      applyHourlyNotificationConfig(false);
      Toastify(
        permission === "denied"
          ? "Chrome đang chặn quyền thông báo cho trang này"
          : "Chưa cấp quyền thông báo cho trang này",
        400,
      );
      return;
    }

    await prepareHourlyNotificationSound();
    const enabledConfig = applyHourlyNotificationConfig(true);
    const nextAt = getNextScheduledNotification(new Date(), enabledConfig);

    Toastify(
      nextAt
        ? `Đã bật · mốc kế tiếp ${formatLocalDateTime(nextAt)}`
        : "Đã bật thông báo",
      200,
    );
  }, [applyHourlyNotificationConfig, prepareHourlyNotificationSound]);

  const handleTestHourlyNotification = useCallback(async (): Promise<void> => {
    if (typeof Notification === "undefined") {
      Toastify("Trình duyệt không hỗ trợ thông báo hệ thống", 400);
      return;
    }

    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;

    if (permission !== "granted") {
      Toastify(
        permission === "denied"
          ? "Chrome đang chặn quyền thông báo cho trang này"
          : "Chưa cấp quyền thông báo cho trang này",
        400,
      );
      return;
    }

    await prepareHourlyNotificationSound();

    const currentTime = new Date();
    const wasShown = await showBrowserSystemNotification(
      `Thông báo thử · ${formatLocalClockTime(currentTime)}`,
      "Thông báo sẽ nổi khi đang ở tab hoặc ứng dụng khác nếu trang vẫn còn chạy.",
      `local-products-hourly-test-${currentTime.getTime()}`,
    );

    if (!wasShown) {
      Toastify("Không thể hiển thị thông báo hệ thống", 400);
      return;
    }

    await playHourlyNotificationSound();
    Toastify("Đã gửi thông báo thử và phát âm báo", 200);
  }, [
    playHourlyNotificationSound,
    prepareHourlyNotificationSound,
    showBrowserSystemNotification,
  ]);

  const handleDisableHourlyNotification = useCallback((): void => {
    if (hourlyNotificationTimeoutRef.current !== null) {
      window.clearTimeout(hourlyNotificationTimeoutRef.current);
      hourlyNotificationTimeoutRef.current = null;
    }

    applyHourlyNotificationConfig(false);
    Toastify("Đã tắt thông báo thời gian", 200);
  }, [applyHourlyNotificationConfig]);

  useEffect(() => {
    if (!hourlyNotificationConfig.enabled) return;

    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      const disabledConfig = {
        ...hourlyNotificationConfig,
        enabled: false,
      };
      setHourlyNotificationConfig(disabledConfig);
      setHourlyNotificationDraft(disabledConfig);
      saveHourlyNotificationConfig(disabledConfig);
      return;
    }

    let isCancelled = false;

    const scheduleNextNotification = (): void => {
      if (isCancelled) return;

      const now = new Date();
      const nextAt = getNextScheduledNotification(now, hourlyNotificationConfig);

      if (!nextAt) return;

      const delay = Math.max(50, nextAt.getTime() - now.getTime());

      hourlyNotificationTimeoutRef.current = window.setTimeout(() => {
        if (isCancelled) return;

        showHourlyNotification(nextAt);
        scheduleNextNotification();
      }, delay);
    };

    const rescheduleFromRealtime = (): void => {
      if (hourlyNotificationTimeoutRef.current !== null) {
        window.clearTimeout(hourlyNotificationTimeoutRef.current);
        hourlyNotificationTimeoutRef.current = null;
      }

      scheduleNextNotification();
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        rescheduleFromRealtime();
      }
    };

    scheduleNextNotification();
    window.addEventListener("focus", rescheduleFromRealtime);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      window.removeEventListener("focus", rescheduleFromRealtime);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (hourlyNotificationTimeoutRef.current !== null) {
        window.clearTimeout(hourlyNotificationTimeoutRef.current);
        hourlyNotificationTimeoutRef.current = null;
      }
    };
  }, [hourlyNotificationConfig, showHourlyNotification]);

  useEffect(() => {
    if (!hourlyNotificationConfig.enabled) return;

    const unlockSound = (): void => {
      window.removeEventListener("pointerdown", unlockSound, true);
      window.removeEventListener("keydown", unlockSound, true);
      void prepareHourlyNotificationSound();
    };

    window.addEventListener("pointerdown", unlockSound, {
      capture: true,
      once: true,
    });
    window.addEventListener("keydown", unlockSound, {
      capture: true,
      once: true,
    });

    return () => {
      window.removeEventListener("pointerdown", unlockSound, true);
      window.removeEventListener("keydown", unlockSound, true);
    };
  }, [hourlyNotificationConfig.enabled, prepareHourlyNotificationSound]);

  useEffect(() => {
    return () => {
      const audioContext = hourlyAudioContextRef.current;

      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close();
      }
    };
  }, []);

  const nextHourlyNotificationAt = useMemo(() => {
    if (!hourlyNotificationConfig.enabled) return null;
    return getNextScheduledNotification(nowTick, hourlyNotificationConfig);
  }, [hourlyNotificationConfig, nowTick]);

  const activeContactOption = useMemo(
    () =>
      settings.contactOptions.find(
        (option) => option.id === selectedContactId,
      ) ?? null,
    [selectedContactId, settings.contactOptions],
  );
  const activeContactText = useMemo(
    () => getSelectedContactText(settings.contactOptions, selectedContactId),
    [selectedContactId, settings.contactOptions],
  );
  const activeContactLabel = useMemo(() => {
    if (!activeContactOption) return "Chưa chọn";

    const activeIndex = settings.contactOptions.findIndex(
      (option) => option.id === activeContactOption.id,
    );

    return activeIndex >= 0 ? `Liên hệ ${activeIndex + 1}` : "Đã chọn";
  }, [activeContactOption, settings.contactOptions]);
  const activeFacebookPage = useMemo(
    () =>
      settings.facebookPages.find(
        (option) => option.id === selectedFacebookPageId,
      ) ?? null,
    [selectedFacebookPageId, settings.facebookPages],
  );
  const facebookDuplicatePostTemplates = settings.facebookDuplicatePosts;
  const facebookDuplicatePostGroups = useMemo(() => {
    const groupedOptions = new Map<
      string,
      { category: string; options: FacebookDuplicatePostOption[] }
    >();

    facebookDuplicatePostTemplates.forEach((option) => {
      const category = normalizeCategoryName(option.category) || "Chưa phân loại";
      const categoryKey = normalizeTextKey(category);
      const currentGroup = groupedOptions.get(categoryKey);

      if (currentGroup) {
        currentGroup.options.push(option);
        return;
      }

      groupedOptions.set(categoryKey, {
        category,
        options: [option],
      });
    });

    return Array.from(groupedOptions.values());
  }, [facebookDuplicatePostTemplates]);
  const facebookGroupOptionGroups = useMemo(
    () => groupFacebookGroupOptionsByCategory(settings.facebookGroups),
    [settings.facebookGroups],
  );
  const selectedFacebookGroups = useMemo(
    () => {
      const selectedIds = new Set(settings.selectedFacebookGroupIds);

      return settings.facebookGroups.filter((group) =>
        selectedIds.has(group.id),
      );
    }, [settings.facebookGroups, settings.selectedFacebookGroupIds],
  );
  const selectedFacebookGroupGroups = useMemo(
    () => groupFacebookGroupOptionsByCategory(selectedFacebookGroups),
    [selectedFacebookGroups],
  );
  const activeFacebookGroup =
    selectedFacebookGroups.length > 0
      ? (selectedFacebookGroups[
        facebookGroupActiveIndex % selectedFacebookGroups.length
      ] ?? null)
      : null;

  const today = useMemo(() => nowTick.toISOString().slice(0, 10), [nowTick]);

  useEffect(() => {
    const interactionWindow =
      pictureInPictureWindow && !pictureInPictureWindow.closed
        ? pictureInPictureWindow
        : window;
    const updateScrollTopVisibility = (): void => {
      const shouldShowFloatingControls = interactionWindow.scrollY > 240;

      setIsScrollTopVisible(shouldShowFloatingControls);
      if (!shouldShowFloatingControls) {
        setIsHeaderActionsMenuOpen(false);
      }
    };

    updateScrollTopVisibility();
    interactionWindow.addEventListener("scroll", updateScrollTopVisibility, {
      passive: true,
    });

    return () => {
      interactionWindow.removeEventListener(
        "scroll",
        updateScrollTopVisibility,
      );
    };
  }, [pictureInPictureWindow]);

  const handleScrollToTop = useCallback((): void => {
    const interactionWindow = getActiveInteractionWindow();

    setIsMobileCategoryMenuOpen(false);
    setIsHeaderActionsMenuOpen(false);
    interactionWindow.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [prefersReducedMotion]);

  const handleOpenPictureInPicture = useCallback(async (): Promise<void> => {
    const browserWindow = window as WindowWithDocumentPictureInPicture;
    const pictureInPictureApi = browserWindow.documentPictureInPicture;

    if (!pictureInPictureApi) {
      Toastify(
        "Trình duyệt chưa hỗ trợ cửa sổ nổi. Vui lòng dùng Chrome hoặc Edge phiên bản mới.",
        400,
      );
      return;
    }

    const existingWindow =
      pictureInPictureWindow ?? pictureInPictureApi.window;

    if (existingWindow && !existingWindow.closed) {
      existingWindow.focus();
      setPictureInPictureWindow(existingWindow);
      return;
    }

    try {
      const nextWindow = await pictureInPictureApi.requestWindow();

      nextWindow.document.title = "Local Product Manager";
      nextWindow.document.body.replaceChildren();
      copyStylesToDocument(document, nextWindow.document);

      nextWindow.addEventListener(
        "pagehide",
        () => {
          setPictureInPictureWindow((currentWindow) =>
            currentWindow === nextWindow ? null : currentWindow,
          );
        },
        { once: true },
      );

      setPictureInPictureWindow(nextWindow);
      nextWindow.focus();
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        Toastify("Hãy nhấn trực tiếp nút Cửa sổ nổi để mở", 400);
        return;
      }

      Toastify("Không thể mở cửa sổ nổi", 400);
    }
  }, [pictureInPictureWindow]);

  const handleClosePictureInPicture = useCallback((): void => {
    const browserWindow = window as WindowWithDocumentPictureInPicture;
    const activeWindow =
      pictureInPictureWindow ?? browserWindow.documentPictureInPicture?.window;

    if (activeWindow && !activeWindow.closed) {
      activeWindow.close();
    }

    setPictureInPictureWindow(null);
  }, [pictureInPictureWindow]);

  const handleFocusPictureInPicture = useCallback((): void => {
    if (!pictureInPictureWindow || pictureInPictureWindow.closed) {
      setPictureInPictureWindow(null);
      return;
    }

    pictureInPictureWindow.focus();
  }, [pictureInPictureWindow]);

  const handleOpenFacebookSearchPopups = useCallback(
    (searchQuery: string): boolean => {
      const interactionWindow = getActiveInteractionWindow();
      const facebookSearchUrl =
        createFacebookRecentPostsSearchUrl(searchQuery);
      const availableScreen =
        interactionWindow.screen as ScreenWithAvailablePosition;
      const availableWidth = Math.max(
        320,
        availableScreen.availWidth || interactionWindow.innerWidth,
      );
      const availableHeight = Math.max(
        480,
        availableScreen.availHeight || interactionWindow.innerHeight,
      );

      if (availableWidth < 768) {
        const searchWindow = interactionWindow.open(
          facebookSearchUrl,
          "facebook-search-mobile",
          "popup=yes,resizable=yes,scrollbars=yes",
        );

        if (!searchWindow) {
          Toastify("Trình duyệt đã chặn tab Facebook Search", 400);
          return false;
        }

        searchWindow.opener = null;
        searchWindow.focus();
        Toastify("Đã mở Facebook Search", 200);
        return true;
      }

      const columnCount = 2;
      const rowCount = 2;
      const gap = 10;
      const popupWidth = Math.floor(
        (availableWidth - gap * (columnCount - 1)) / columnCount,
      );
      const popupHeight = Math.floor(
        (availableHeight - gap * (rowCount - 1)) / rowCount,
      );
      const availableLeft =
        availableScreen.availLeft ?? interactionWindow.screenX;
      const availableTop =
        availableScreen.availTop ?? interactionWindow.screenY;
      const openedWindows: Window[] = [];

      for (let index = 0; index < FACEBOOK_SEARCH_POPUP_COUNT; index += 1) {
        const columnIndex = index % columnCount;
        const rowIndex = Math.floor(index / columnCount);
        const popupLeft = availableLeft + columnIndex * (popupWidth + gap);
        const popupTop = availableTop + rowIndex * (popupHeight + gap);
        const popupFeatures = [
          "popup=yes",
          `width=${popupWidth}`,
          `height=${popupHeight}`,
          `left=${popupLeft}`,
          `top=${popupTop}`,
          "resizable=yes",
          "scrollbars=yes",
          "toolbar=no",
          "menubar=no",
          "status=no",
        ].join(",");
        const searchWindow = interactionWindow.open(
          facebookSearchUrl,
          `facebook-search-${index + 1}`,
          popupFeatures,
        );

        if (!searchWindow) continue;

        try {
          searchWindow.opener = null;
          searchWindow.moveTo(popupLeft, popupTop);
          searchWindow.resizeTo(popupWidth, popupHeight);
        } catch {
          searchWindow.focus();
        }

        openedWindows.push(searchWindow);
      }

      if (openedWindows.length === 0) {
        Toastify(
          "Trình duyệt đã chặn popup Facebook Search. Hãy cho phép cửa sổ bật lên.",
          400,
        );
        return false;
      }

      openedWindows[0]?.focus();

      Toastify(
        openedWindows.length === FACEBOOK_SEARCH_POPUP_COUNT
          ? `Đã mở và sắp xếp ${openedWindows.length} popup Facebook Search`
          : `Đã mở ${openedWindows.length}/${FACEBOOK_SEARCH_POPUP_COUNT} popup; hãy cho phép cửa sổ bật lên để mở đủ`,
        openedWindows.length === FACEBOOK_SEARCH_POPUP_COUNT ? 200 : 300,
      );

      return true;
    }, []);

  const handleSubmitFacebookSearch = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();

    const cleanQuery = facebookSearchQuery.trim();

    if (!cleanQuery) {
      Toastify("Nhập nội dung cần tìm trên Facebook", 300);
      return;
    }

    const opened = handleOpenFacebookSearchPopups(cleanQuery);

    if (opened) {
      setFacebookSearchQuery(cleanQuery);
      setIsFacebookSearchDialogOpen(false);
    }
  };

  useEffect(() => {
    return () => {
      const browserWindow = window as WindowWithDocumentPictureInPicture;
      const activeWindow = browserWindow.documentPictureInPicture?.window;

      if (activeWindow && !activeWindow.closed) {
        activeWindow.close();
      }
    };
  }, []);

  const discoveredCategories = useMemo(() => {
    const categoryMap = new Map<string, string>();

    products.forEach((product) => {
      const category = normalizeCategoryName(product.category);
      const key = normalizeTextKey(category);

      if (!category || categoryMap.has(key)) return;
      categoryMap.set(key, category);
    });

    return Array.from(categoryMap.values());
  }, [products]);

  const categories = useMemo(() => {
    const categoryMap = new Map(
      discoveredCategories.map((category) => [
        normalizeTextKey(category),
        category,
      ]),
    );
    const orderedCategories = settings.categoryOrder
      .map((category) => categoryMap.get(normalizeTextKey(category)))
      .filter((category): category is string => Boolean(category));
    const orderedCategoryKeys = new Set(
      orderedCategories.map((category) => normalizeTextKey(category)),
    );

    discoveredCategories.forEach((category) => {
      if (!orderedCategoryKeys.has(normalizeTextKey(category))) {
        orderedCategories.push(category);
      }
    });

    return orderedCategories;
  }, [discoveredCategories, settings.categoryOrder]);

  const draggingCategory = useMemo(() => {
    return (
      categories.find(
        (category) => normalizeTextKey(category) === draggingCategoryKey,
      ) ?? ""
    );
  }, [categories, draggingCategoryKey]);

  // Danh sách tab theo thứ tự: "all" + các danh mục
  const orderedCategoryTabs = useMemo<CategoryTab[]>(
    () => ["all", ...categories],
    [categories],
  );

  useEffect(() => {
    if (discoveredCategories.length === 0) return;

    setSettings((current) => {
      const currentKeys = current.categoryOrder.map((category) =>
        normalizeTextKey(category),
      );
      const nextKeys = categories.map((category) =>
        normalizeTextKey(category),
      );
      const orderUnchanged =
        currentKeys.length === nextKeys.length &&
        currentKeys.every((categoryKey, index) =>
          categoryKey === nextKeys[index]
        );

      if (orderUnchanged) return current;

      return {
        ...current,
        categoryOrder: categories,
      };
    });
  }, [categories, discoveredCategories.length]);

  // Chuyển sang danh mục kế tiếp / trước đó (dùng cho vuốt ngang)
  const goToAdjacentCategory = useCallback(
    (direction: 1 | -1) => {
      setActiveCategoryTab((current) => {
        if (orderedCategoryTabs.length <= 1) return current;

        const currentKey = normalizeTextKey(current);
        const currentIndex = orderedCategoryTabs.findIndex(
          (tab) => normalizeTextKey(tab) === currentKey,
        );
        const safeIndex = currentIndex < 0 ? 0 : currentIndex;
        const nextIndex =
          (safeIndex + direction + orderedCategoryTabs.length) %
          orderedCategoryTabs.length;

        return orderedCategoryTabs[nextIndex];
      });
    },
    [orderedCategoryTabs],
  );

  // Lưu điểm chạm để phát hiện thao tác vuốt ngang
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Thanh tab danh mục — giữ lại một tab phía trước tab đang chọn
  const categoryTabsRef = useRef<HTMLDivElement | null>(null);
  const previousCategoryTabRef = useRef(activeCategoryTab);

  useEffect(() => {
    const previousCategoryKey = normalizeTextKey(
      previousCategoryTabRef.current,
    );
    const activeCategoryKey = normalizeTextKey(activeCategoryTab);

    if (previousCategoryKey === activeCategoryKey) return;
    previousCategoryTabRef.current = activeCategoryTab;

    const interactionWindow = getActiveInteractionWindow();
    interactionWindow.requestAnimationFrame(() => {
      interactionWindow.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    });
  }, [activeCategoryTab, prefersReducedMotion]);

  useEffect(() => {
    const container = categoryTabsRef.current;
    if (!container) return;

    const categoryButtons = Array.from(
      container.querySelectorAll<HTMLElement>("[data-category-tab]"),
    );
    const activeCategoryKey = normalizeTextKey(activeCategoryTab);
    const activeButtonIndex = categoryButtons.findIndex(
      (button) => button.dataset.categoryTab === activeCategoryKey,
    );
    if (activeButtonIndex < 0) return;

    const leadingButton =
      categoryButtons[Math.max(0, activeButtonIndex - 1)] ??
      categoryButtons[activeButtonIndex];
    if (!leadingButton) return;

    const maximumScrollLeft = Math.max(
      0,
      container.scrollWidth - container.clientWidth,
    );
    const targetScrollLeft =
      activeButtonIndex === 0
        ? 0
        : Math.min(leadingButton.offsetLeft, maximumScrollLeft);

    // Khi về Tất cả luôn cuộn hẳn về đầu; các tab khác chừa một tab phía trước.
    container.scrollTo({
      left: targetScrollLeft,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activeCategoryTab, prefersReducedMotion]);

  useEffect(() => {
    const container = categoryTabsRef.current;
    if (!container) return;

    const handleDesktopCategoryWheel = (event: WheelEvent) => {
      const maximumScrollLeft = Math.max(
        0,
        container.scrollWidth - container.clientWidth,
      );
      if (maximumScrollLeft === 0) return;

      const horizontalDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (horizontalDelta === 0) return;

      event.preventDefault();
      event.stopPropagation();
      container.scrollLeft = Math.min(
        maximumScrollLeft,
        Math.max(0, container.scrollLeft + horizontalDelta),
      );
    };

    container.addEventListener("wheel", handleDesktopCategoryWheel, {
      passive: false,
    });

    return () => {
      container.removeEventListener("wheel", handleDesktopCategoryWheel);
    };
  }, []);

  const resetCategoryDrag = useCallback((): void => {
    setDraggingCategoryKey("");
    setCategoryDropTarget(null);
  }, []);

  const commitCategoryOrder = useCallback(
    (
      sourceKey: string,
      targetKey?: string,
      position: CategoryDropPosition = "after",
    ): void => {
      const sourceCategory = categories.find(
        (category) => normalizeTextKey(category) === sourceKey,
      );

      if (!sourceCategory) return;

      const nextCategories = categories.filter(
        (category) => normalizeTextKey(category) !== sourceKey,
      );
      const targetIndex = targetKey
        ? nextCategories.findIndex(
          (category) => normalizeTextKey(category) === targetKey,
        )
        : -1;
      const insertionIndex =
        targetIndex < 0
          ? nextCategories.length
          : targetIndex + (position === "after" ? 1 : 0);

      nextCategories.splice(insertionIndex, 0, sourceCategory);

      const orderUnchanged = nextCategories.every(
        (category, index) =>
          normalizeTextKey(category) === normalizeTextKey(categories[index] ?? ""),
      );

      if (orderUnchanged) return;

      setSettings((current) => ({
        ...current,
        categoryOrder: nextCategories,
      }));
      Toastify("Đã lưu thứ tự danh mục", 200);
    },
    [categories],
  );

  const handleCategoryDragStart = (
    event: DragEvent<HTMLButtonElement>,
    category: string,
  ): void => {
    const categoryKey = normalizeTextKey(category);
    const categoryColor = getCategoryColor(
      category,
      settings.categoryColors,
    );
    const targetDocument = event.currentTarget.ownerDocument;
    const dragPreview = event.currentTarget.cloneNode(true) as HTMLElement;
    const targetRect = event.currentTarget.getBoundingClientRect();

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", categoryKey);

    dragPreview.removeAttribute("id");
    dragPreview.style.position = "fixed";
    dragPreview.style.top = "-1000px";
    dragPreview.style.left = "-1000px";
    dragPreview.style.width = `${targetRect.width}px`;
    dragPreview.style.height = `${targetRect.height}px`;
    dragPreview.style.opacity = "0.96";
    dragPreview.style.transform = "rotate(-2deg) scale(1.04)";
    dragPreview.style.border = `1px solid ${categoryColor}`;
    dragPreview.style.background = `linear-gradient(135deg, color-mix(in srgb, ${categoryColor} 82%, white 18%), color-mix(in srgb, ${categoryColor} 68%, black 32%))`;
    dragPreview.style.color = getCategoryContrastColor(categoryColor);
    dragPreview.style.boxShadow = `0 18px 46px color-mix(in srgb, ${categoryColor} 28%, transparent)`;
    dragPreview.style.clipPath =
      "polygon(8px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 4px 100%, 0 calc(100% - 4px), 0 8px)";
    dragPreview.style.pointerEvents = "none";
    dragPreview.style.zIndex = "100000";
    targetDocument.body.appendChild(dragPreview);
    event.dataTransfer.setDragImage(
      dragPreview,
      targetRect.width / 2,
      targetRect.height / 2,
    );
    targetDocument.defaultView?.requestAnimationFrame(() => {
      dragPreview.remove();
    });

    setDraggingCategoryKey(categoryKey);
    setCategoryDropTarget(null);
  };

  const handleCategoryDragOver = (
    event: DragEvent<HTMLButtonElement>,
    category: string,
  ): void => {
    if (!draggingCategoryKey) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const targetKey = normalizeTextKey(category);

    if (targetKey === draggingCategoryKey) {
      setCategoryDropTarget(null);
      return;
    }

    const targetRect = event.currentTarget.getBoundingClientRect();
    const position: CategoryDropPosition =
      event.clientX < targetRect.left + targetRect.width / 2
        ? "before"
        : "after";

    setCategoryDropTarget((current) =>
      current?.key === targetKey && current.position === position
        ? current
        : { key: targetKey, position },
    );

    const container = categoryTabsRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const edgeSize = 64;

    if (event.clientX < containerRect.left + edgeSize) {
      container.scrollLeft = Math.max(0, container.scrollLeft - 18);
    } else if (event.clientX > containerRect.right - edgeSize) {
      container.scrollLeft = Math.min(
        container.scrollWidth - container.clientWidth,
        container.scrollLeft + 18,
      );
    }
  };

  const handleCategoryDrop = (
    event: DragEvent<HTMLButtonElement>,
    category: string,
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    const targetKey = normalizeTextKey(category);

    if (targetKey === draggingCategoryKey) {
      resetCategoryDrag();
      return;
    }

    const targetRect = event.currentTarget.getBoundingClientRect();
    const fallbackPosition: CategoryDropPosition =
      event.clientX < targetRect.left + targetRect.width / 2
        ? "before"
        : "after";
    const position =
      categoryDropTarget?.key === targetKey
        ? categoryDropTarget.position
        : fallbackPosition;

    commitCategoryOrder(draggingCategoryKey, targetKey, position);
    resetCategoryDrag();
  };

  const handleCategoryBarDragOver = (
    event: DragEvent<HTMLDivElement>,
  ): void => {
    if (!draggingCategoryKey) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (event.target === event.currentTarget) {
      setCategoryDropTarget(null);
    }
  };

  const handleCategoryBarDrop = (
    event: DragEvent<HTMLDivElement>,
  ): void => {
    if (!draggingCategoryKey) return;

    event.preventDefault();
    commitCategoryOrder(draggingCategoryKey);
    resetCategoryDrag();
  };

  const handleProductsTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0];
      if (!touch) return;
      swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [],
  );

  const handleProductsTouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;
      if (!start) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      // Chỉ tính là vuốt ngang khi đủ dài và không phải cuộn dọc
      const MIN_SWIPE = 60;
      if (Math.abs(deltaX) < MIN_SWIPE) return;
      if (Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

      // Vuốt trái -> danh mục kế tiếp; vuốt phải -> danh mục trước đó
      goToAdjacentCategory(deltaX < 0 ? 1 : -1);
    },
    [goToAdjacentCategory],
  );

  const filteredProducts = useMemo(() => {
    const keyword = normalizeTextKey(query);
    const activeCategoryKey = normalizeTextKey(activeCategoryTab);
    const shouldSearchAllCategories = keyword.length > 0;

    const matchedProducts = products.filter((product) => {
      const productCategoryKey = normalizeTextKey(product.category);
      const matchesCategory =
        shouldSearchAllCategories ||
        activeCategoryTab === "all" ||
        productCategoryKey === activeCategoryKey;
      const content = normalizeTextKey(
        `${product.name} ${product.description} ${product.realEstateComment} ${product.priceText} ${product.category}`,
      );
      const matchesKeyword = !keyword || content.includes(keyword);

      return matchesCategory && matchesKeyword;
    });

    return sortProductsByCategoryThenDoneThenPrice(
      matchedProducts,
      pendingDoneProductIds,
      categories,
    );
  }, [activeCategoryTab, categories, pendingDoneProductIds, products, query]);

  const productRenderKey = useMemo(() => {
    return [
      activeCategoryTab,
      query,
      products.length,
      products[0]?.updatedAt ?? "",
      categories.join("\u0000"),
    ].join("\u0001");
  }, [activeCategoryTab, categories, products, query]);
  const visibleProductLimit =
    productRenderState.key === productRenderKey
      ? productRenderState.limit
      : INITIAL_PRODUCT_RENDER_LIMIT;
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleProductLimit);
  }, [filteredProducts, visibleProductLimit]);

  useEffect(() => {
    if (productRenderState.key !== productRenderKey) {
      setProductRenderState({
        key: productRenderKey,
        limit: INITIAL_PRODUCT_RENDER_LIMIT,
      });
      return;
    }

    if (productRenderState.limit >= filteredProducts.length) return;

    const timeoutId = window.setTimeout(() => {
      setProductRenderState((current) => {
        if (current.key !== productRenderKey) return current;

        return {
          ...current,
          limit: Math.min(
            current.limit + PRODUCT_RENDER_BATCH_SIZE,
            filteredProducts.length,
          ),
        };
      });
    }, 24);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [filteredProducts.length, productRenderKey, productRenderState]);

  const groupedProductsByCategory = useMemo(() => {
    return orderGroupsByCategories(
      createGroupedProducts(filteredProducts, pendingDoneProductIds),
      categories,
    );
  }, [categories, filteredProducts, pendingDoneProductIds]);

  const copyableProductGroups = useMemo(() => {
    return orderGroupsByCategories(
      createGroupedProducts(
        filteredProducts.filter((product) => !product.isDone),
        pendingDoneProductIds,
      ),
      categories,
    );
  }, [categories, filteredProducts, pendingDoneProductIds]);

  const copyableProductCount = useMemo(() => {
    return copyableProductGroups.reduce(
      (total, group) => total + group.products.length,
      0,
    );
  }, [copyableProductGroups]);

  const soldProductCount = useMemo(() => {
    return filteredProducts.filter((product) => product.isDone).length;
  }, [filteredProducts]);

  const activeProductCount = useMemo(() => {
    return filteredProducts.filter((product) => !product.isDone).length;
  }, [filteredProducts]);

  const downloadableProducts = useMemo(() => {
    return products.filter((product) => !product.isDone);
  }, [products]);

  const totalImages = useMemo(() => {
    return downloadableProducts.reduce(
      (total, product) =>
        total + product.images.length + product.internalImages.length,
      0,
    );
  }, [downloadableProducts]);

  const representativeImageCategoryOptions = useMemo(() => {
    const categoryMap = new Map<string, { name: string; count: number }>();
    const categoryIndexes = new Map(
      categories.map((category, index) => [
        normalizeTextKey(category),
        index,
      ]),
    );

    downloadableProducts.forEach((product) => {
      if (!product.images[0]) return;

      const categoryName =
        normalizeCategoryName(product.category) || "Chưa phân loại";
      const categoryKey = normalizeTextKey(categoryName);
      const currentCategory = categoryMap.get(categoryKey);

      categoryMap.set(categoryKey, {
        name: currentCategory?.name ?? categoryName,
        count: (currentCategory?.count ?? 0) + 1,
      });
    });

    return Array.from(categoryMap.values()).sort((first, second) => {
      const firstKey = normalizeTextKey(first.name);
      const secondKey = normalizeTextKey(second.name);
      const orderDiff =
        (categoryIndexes.get(firstKey) ?? Number.MAX_SAFE_INTEGER) -
        (categoryIndexes.get(secondKey) ?? Number.MAX_SAFE_INTEGER);

      return orderDiff || firstKey.localeCompare(secondKey, "vi");
    });
  }, [categories, downloadableProducts]);

  const totalRepresentativeImages = useMemo(() => {
    return representativeImageCategoryOptions.reduce(
      (total, category) => total + category.count,
      0,
    );
  }, [representativeImageCategoryOptions]);

  const representativeImageProducts = useMemo(() => {
    const selectedCategoryKey = normalizeTextKey(imageDownloadCategory);

    return downloadableProducts.filter((product) => {
      if (!product.images[0]) return false;
      if (imageDownloadCategory === "all") return true;

      const productCategory =
        normalizeCategoryName(product.category) || "Chưa phân loại";

      return normalizeTextKey(productCategory) === selectedCategoryKey;
    });
  }, [downloadableProducts, imageDownloadCategory]);

  useEffect(() => {
    if (imageDownloadCategory === "all") return;

    const selectedCategoryExists = representativeImageCategoryOptions.some(
      (category) =>
        normalizeTextKey(category.name) ===
        normalizeTextKey(imageDownloadCategory),
    );

    if (!selectedCategoryExists) {
      setImageDownloadCategory("all");
    }
  }, [imageDownloadCategory, representativeImageCategoryOptions]);

  const scheduleResult = useMemo(() => {
    return buildRandomSchedule(
      products,
      scheduleConfig,
      settings.commonDescription,
      activeContactText,
      includeSocialTags,
    );
  }, [
    activeContactText,
    products,
    scheduleConfig,
    settings.commonDescription,
    includeSocialTags,
  ]);

  const scheduleTaskIndexes = useMemo(() => {
    return Array.from(
      { length: Math.max(1, scheduleConfig.taskCount) },
      (_, index) => index,
    );
  }, [scheduleConfig.taskCount]);

  const scheduleTimes = useMemo(() => {
    return createDailyTimes(
      scheduleConfig.startTime,
      scheduleConfig.endTime,
      scheduleConfig.gapHours,
    ).times;
  }, [
    scheduleConfig.endTime,
    scheduleConfig.gapHours,
    scheduleConfig.startTime,
  ]);

  const postedIds = useMemo(() => {
    return new Set(postedRecords.map((record) => record.slotId));
  }, [postedRecords]);

  const albumImages = useMemo<ProductImage[]>(() => {
    if (!albumSource) return [];

    return [
      ...albumSource.images,
      ...(albumSource.internalImages ?? []),
    ];
  }, [albumSource]);

  const albumInternalImageIds = useMemo<Set<string>>(() => {
    return new Set(
      (albumSource?.internalImages ?? []).map((image) => image.id),
    );
  }, [albumSource]);

  const selectedAlbumImage = useMemo(() => {
    if (albumImages.length === 0) return null;

    return (
      albumImages.find((image) => image.id === selectedAlbumImageId) ??
      albumImages[0] ??
      null
    );
  }, [albumImages, selectedAlbumImageId]);

  const activeScheduleProducts = useMemo(() => {
    return products.filter((product) => !product.isDone);
  }, [products]);

  const scheduleProducts = useMemo(() => {
    if (scheduleConfig.selectedCategories.length === 0) {
      return activeScheduleProducts;
    }

    const selectedCategoryKeys = new Set(
      scheduleConfig.selectedCategories.map((category) =>
        normalizeTextKey(category),
      ),
    );

    return activeScheduleProducts.filter((product) =>
      selectedCategoryKeys.has(normalizeTextKey(product.category)),
    );
  }, [activeScheduleProducts, scheduleConfig.selectedCategories]);

  const filteredScheduleProducts = useMemo(() => {
    const keyword = normalizeTextKey(scheduleQuery);

    return activeScheduleProducts.filter((product) => {
      const content = normalizeTextKey(
        `${product.name} ${product.description} ${product.realEstateComment} ${product.priceText} ${product.category}`,
      );

      return !keyword || content.includes(keyword);
    });
  }, [activeScheduleProducts, scheduleQuery]);

  const todayPostedProductKeys = useMemo(() => {
    return new Set(
      postedRecords
        .map((record) => record.slotId)
        .filter((slotId) => slotId.startsWith(`${today}::task`)),
    );
  }, [postedRecords, today]);

  const todayPostedProductIds = useMemo(() => {
    const result = new Set<string>();

    postedRecords.forEach((record) => {
      if (!record.slotId.startsWith(`${today}::task`)) return;

      const assignedProductId = scheduleAssignments[record.slotId];

      if (assignedProductId) {
        result.add(assignedProductId);
        return;
      }

      const legacyProductId = record.slotId.split("::").at(-1) ?? "";

      if (legacyProductId && !legacyProductId.startsWith("slot")) {
        result.add(legacyProductId);
      }
    });

    return result;
  }, [postedRecords, scheduleAssignments, today]);

  const postedTodayCount = useMemo(() => {
    return todayPostedProductKeys.size;
  }, [todayPostedProductKeys]);

  const totalTodayTaskCount = useMemo(() => {
    return scheduleTimes.length * scheduleTaskIndexes.length;
  }, [scheduleTaskIndexes.length, scheduleTimes.length]);

  const remainingTodayCount = useMemo(() => {
    return Math.max(totalTodayTaskCount - postedTodayCount, 0);
  }, [postedTodayCount, totalTodayTaskCount]);

  const applyBootstrapPayload = useCallback((payload: BootstrapPayload): void => {
    const nextProducts = sortProductsByUpdatedAt(
      normalizeProductsArray(payload.products),
    );
    const nextSettings =
      normalizeGlobalSettings(payload.settings) ?? loadGlobalSettings();
    const nextScheduleConfig =
      normalizeScheduleConfig(payload.scheduleConfig) ?? loadScheduleConfig();
    const nextScheduleAssignments =
      normalizeScheduleAssignments(payload.scheduleAssignments) ??
      loadScheduleAssignments();
    const nextPostedRecords =
      normalizePostedRecords(payload.postedRecords) ?? loadPostedRecords();

    persistedAppStateSignaturesRef.current = {
      settings: JSON.stringify(nextSettings),
      scheduleConfig: JSON.stringify(nextScheduleConfig),
      scheduleAssignments: JSON.stringify(nextScheduleAssignments),
    };

    setProducts(nextProducts);
    setSettings(nextSettings);
    setScheduleConfig(nextScheduleConfig);
    setScheduleAssignments(nextScheduleAssignments);
    setPostedRecords(nextPostedRecords);
  }, []);

  const createCurrentBootstrapPayload = useCallback((): BootstrapPayload => {
    return {
      products,
      settings,
      scheduleConfig,
      scheduleAssignments,
      postedRecords,
    };
  }, [
    postedRecords,
    products,
    scheduleAssignments,
    scheduleConfig,
    settings,
  ]);

  const handleRefreshCloudData = async (): Promise<void> => {
    setPageLoadingText("Đang đồng bộ dữ liệu MongoDB...");
    await waitForUiPaint();

    try {
      await flushQueuedAppStatePatch();
      const payload = await getBootstrapData();

      applyBootstrapPayload(payload);
      await writeBootstrapCache(payload);
      Toastify("Đã lấy dữ liệu mới từ MongoDB và cập nhật cache", 200);
    } catch (error) {
      Toastify(
        error instanceof Error ? error.message : "Không thể đồng bộ dữ liệu MongoDB",
        400,
      );
    } finally {
      setPageLoadingText("");
    }
  };

  const handleReloadPage = async (): Promise<void> => {
    setPageLoadingText("Đang lưu cache và làm mới trang...");
    await waitForUiPaint();

    try {
      await writeBootstrapCache(createCurrentBootstrapPayload());
    } catch (error) {
      setPageLoadingText("");
      Toastify(
        error instanceof Error
          ? error.message
          : "Không thể lưu cache trước khi làm mới trang",
        400,
      );
      return;
    }

    await flushQueuedAppStatePatch().catch(() => undefined);
    window.location.reload();
  };

  useEffect(() => {
    let cancelled = false;
    setPageLoadingText("Đang đọc dữ liệu cache trên thiết bị...");

    void readBootstrapCache()
      .then((cacheRecord) => {
        if (cancelled) return;

        if (cacheRecord) {
          applyBootstrapPayload(cacheRecord.payload);
          return;
        }

        const initialScheduleConfig = loadScheduleConfig();
        persistedAppStateSignaturesRef.current = {
          settings: JSON.stringify(defaultSettings),
          scheduleConfig: JSON.stringify(initialScheduleConfig),
          scheduleAssignments: JSON.stringify({}),
        };
        Toastify("Thiết bị chưa có cache, nhấn Đồng bộ để lấy dữ liệu", 300);
      })
      .finally(() => {
        if (!cancelled) {
          setIsSettingsReady(true);
          setPageLoadingText("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyBootstrapPayload]);

  useEffect(() => {
    if (!isSettingsReady) return;

    const timeoutId = window.setTimeout(() => {
      void writeBootstrapCache(createCurrentBootstrapPayload()).catch((error) => {
        console.error("Không thể cập nhật cache thiết bị", error);
      });
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [createCurrentBootstrapPayload, isSettingsReady]);

  useEffect(() => {
    if (!isSettingsReady || !isDevicePreferencesReady) return;

    const contactOptionCount = settings.contactOptions.length;
    const receivedFirstContactList =
      previousContactOptionCountRef.current === 0 && contactOptionCount > 0;

    previousContactOptionCountRef.current = contactOptionCount;

    if (receivedFirstContactList && !selectedContactId) {
      contactSelectionPromptedRef.current = false;
    }

    const selectedContactExists = settings.contactOptions.some(
      (option) => option.id === selectedContactId,
    );

    if (selectedContactExists) {
      setModalStack((current) =>
        current.filter((modalName) => modalName !== "contactSelection"),
      );
      return;
    }

    if (selectedContactId) {
      contactSelectionPromptedRef.current = false;
      setSelectedContactId("");
    }

    if (contactSelectionPromptedRef.current) return;

    contactSelectionPromptedRef.current = true;
    setModalStack((current) =>
      current.includes("contactSelection")
        ? current
        : [...current, "contactSelection"],
    );
  }, [
    isDevicePreferencesReady,
    isSettingsReady,
    selectedContactId,
    settings.contactOptions,
  ]);

  useEffect(() => {
    if (!isSettingsReady) return;

    const shouldContinueBackupRestore =
      window.sessionStorage.getItem(RESTORE_BACKUP_AFTER_RELOAD_KEY) === "1";
    if (!shouldContinueBackupRestore) return;

    window.sessionStorage.removeItem(RESTORE_BACKUP_AFTER_RELOAD_KEY);
    setIsBackupRestoreReady(true);
    setModalStack(["importExport"]);
    setPendingConfirm({
      title: "Chọn tệp backup mới",
      description:
        "Dữ liệu hiện tại đã được xóa. Chọn tệp JSON hoặc JSON.GZ để khôi phục dữ liệu mới.",
      confirmLabel: "Chọn tệp backup",
      cancelLabel: "Để sau",
      tone: "default",
      onConfirm: () => {
        const input = window.document.getElementById(
          IMPORT_BACKUP_INPUT_ID,
        ) as HTMLInputElement | null;

        if (!input) {
          throw new Error("Không thể mở trình chọn tệp backup");
        }

        input.click();
      },
    });
  }, [isSettingsReady]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTick(new Date());
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isSettingsReady) return;
    const signature = JSON.stringify(scheduleConfig);

    if (
      persistedAppStateSignaturesRef.current.scheduleConfig === signature
    ) {
      return;
    }

    persistedAppStateSignaturesRef.current.scheduleConfig = signature;
    saveScheduleConfig(scheduleConfig);
  }, [isSettingsReady, scheduleConfig]);

  useEffect(() => {
    if (!isSettingsReady) return;
    const signature = JSON.stringify(scheduleAssignments);

    if (
      persistedAppStateSignaturesRef.current.scheduleAssignments === signature
    ) {
      return;
    }

    persistedAppStateSignaturesRef.current.scheduleAssignments = signature;
    saveScheduleAssignments(scheduleAssignments);
  }, [isSettingsReady, scheduleAssignments]);

  useEffect(() => {
    if (scheduleTimes.length === 0) return;

    setScheduleAssignments((current) => {
      let changed = false;
      const nextAssignments: ScheduleAssignmentMap = { ...current };

      Object.entries(current).forEach(([key, value]) => {
        const match = key.match(/^(\d{4}-\d{2}-\d{2})::task(\d+)::(.+)$/);

        if (!match) return;

        const [, date, taskNumberText, legacyTime] = match;

        if (!date || !taskNumberText || !legacyTime) return;
        if (legacyTime.startsWith("slot")) return;

        const slotIndex = scheduleTimes.indexOf(legacyTime);

        if (slotIndex < 0) return;

        const taskIndex = Number(taskNumberText) - 1;
        const nextKey = createScheduleAssignmentKey(date, slotIndex, taskIndex);

        if (!nextAssignments[nextKey]) {
          nextAssignments[nextKey] = value as string;
        }

        delete nextAssignments[key];
        changed = true;
      });

      return changed ? nextAssignments : current;
    });
  }, [scheduleTimes]);

  useEffect(() => {
    if (scheduleTimes.length === 0) return;

    setPostedRecords((current) => {
      let changed = false;
      const nextRecords = current.map((record) => {
        const match = record.slotId.match(
          /^(\d{4}-\d{2}-\d{2})::task(\d+)::(.+)$/,
        );

        if (!match) return record;

        const [, date, taskNumberText, legacyValue] = match;

        if (!date || !taskNumberText || !legacyValue) return record;
        if (legacyValue.startsWith("slot")) return record;

        const taskIndex = Number(taskNumberText) - 1;
        const legacyProduct = products.find(
          (product) => product.id === legacyValue,
        );

        if (!legacyProduct) return record;

        const matchedEntry = Object.entries(scheduleAssignments).find(
          ([key, value]) => {
            if (value !== legacyProduct.id) return false;
            return key.startsWith(`${date}::task${taskIndex + 1}::slot`);
          },
        );

        if (!matchedEntry) return record;

        changed = true;

        return {
          ...record,
          slotId: matchedEntry[0],
        };
      });

      if (changed) {
        const uniqueRecords = Array.from(
          new Map(
            nextRecords.map((record) => [record.slotId, record]),
          ).values(),
        ) as PostedRecord[];

        savePostedRecords(uniqueRecords);
        return uniqueRecords;
      }

      return current;
    });
  }, [products, scheduleAssignments, scheduleTimes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.code === "Space" &&
        !activeModal &&
        !pendingDownload &&
        !pendingShare &&
        !pendingBackup &&
        !pendingConfirm &&
        !isFacebookSearchDialogOpen &&
        !isHeaderActionsMenuOpen &&
        !isMobileCategoryMenuOpen &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key !== "Escape") return;

      if (isHeaderActionsMenuOpen) {
        setIsHeaderActionsMenuOpen(false);
        return;
      }

      if (isMobileCategoryMenuOpen) {
        setIsMobileCategoryMenuOpen(false);
        return;
      }

      if (isFacebookSearchDialogOpen) {
        setIsFacebookSearchDialogOpen(false);
        return;
      }

      if (pendingDownload) {
        setPendingDownload(null);
        setSkipInternalDownloadImages(false);
        return;
      }

      if (pendingConfirm) {
        if (!isConfirmExecuting) {
          pendingConfirm.onCancel?.();
          setPendingConfirm(null);
        }
        return;
      }

      if (pendingShare) {
        if (!isShareExecuting) {
          if (shareDialogStep === "facebookGroup") {
            setShareDialogStep("share");
            return;
          }

          setPendingShare(null);
          setIncludeInternalShareImages(true);
          setFacebookGroupActiveIndex(0);
        }
        return;
      }

      if (pendingBackup) {
        if (!isBackupSaving) setPendingBackup(null);
        return;
      }

      if (activeModal) {
        closeModal();
      }
    };

    const eventWindows = [window, pictureInPictureWindow].filter(
      (targetWindow, index, windowList): targetWindow is Window =>
        targetWindow !== null && windowList.indexOf(targetWindow) === index,
    );

    eventWindows.forEach((targetWindow) => {
      targetWindow.addEventListener("keydown", handleKeyDown);
    });

    return () => {
      eventWindows.forEach((targetWindow) => {
        targetWindow.removeEventListener("keydown", handleKeyDown);
      });
    };
  }, [
    activeModal,
    pendingDownload,
    pendingShare,
    shareDialogStep,
    isShareExecuting,
    pendingBackup,
    isBackupSaving,
    pendingConfirm,
    isConfirmExecuting,
    isFacebookSearchDialogOpen,
    isHeaderActionsMenuOpen,
    isMobileCategoryMenuOpen,
    pictureInPictureWindow,
  ]);

  useEffect(() => {
    if (!isSettingsReady) return;
    const signature = JSON.stringify(settings);

    if (persistedAppStateSignaturesRef.current.settings === signature) {
      return;
    }

    persistedAppStateSignaturesRef.current.settings = signature;

    saveGlobalSettings({
      ...settings,
      updatedAt: new Date().toISOString(),
    });
  }, [isSettingsReady, settings]);

  useEffect(() => {
    setFacebookGroupActiveIndex(0);
  }, [settings.selectedFacebookGroupIds]);

  useEffect(() => {
    if (!selectedFacebookPageId) return;

    const pageStillExists = settings.facebookPages.some(
      (option) => option.id === selectedFacebookPageId,
    );

    if (!pageStillExists) {
      setSelectedFacebookPageId("");
    }
  }, [selectedFacebookPageId, settings.facebookPages]);

  useEffect(() => {
    if (activeCategoryTab === "all") return;

    const categoryKeys = new Set(
      categories.map((category) => normalizeTextKey(category)),
    );

    if (categoryKeys.has(normalizeTextKey(activeCategoryTab))) return;

    setActiveCategoryTab("all");
  }, [activeCategoryTab, categories]);

  useEffect(() => {
    if (categories.length === 0) return;

    const categoryKeys = new Set(
      categories.map((category) => normalizeTextKey(category)),
    );

    setScheduleConfig((current) => {
      const keptCategories = current.selectedCategories.filter((category) =>
        categoryKeys.has(normalizeTextKey(category)),
      );

      const taskNames = Array.from(
        { length: Math.max(1, current.taskCount) },
        (_, index) => current.taskNames[index] || `Task ${index + 1}`,
      );

      if (
        keptCategories.length === current.selectedCategories.length &&
        taskNames.length === current.taskNames.length
      ) {
        return current;
      }

      return {
        ...current,
        taskNames,
        selectedCategories: keptCategories,
      };
    });
  }, [categories]);

  useEffect(() => {
    const activeScheduleProductIds = new Set(
      activeScheduleProducts.map((product) => product.id),
    );
    const removedAssignmentKeys: string[] = [];
    const nextAssignments: ScheduleAssignmentMap = {};

    Object.entries(scheduleAssignments).forEach(([key, value]) => {
      if (activeScheduleProductIds.has(value)) {
        nextAssignments[key] = value as string;
        return;
      }

      removedAssignmentKeys.push(key);
    });

    if (removedAssignmentKeys.length === 0) return;

    setScheduleAssignments(nextAssignments);

    setPostedRecords((current) => {
      const removedKeySet = new Set(removedAssignmentKeys);
      const nextRecords = current.filter(
        (record) => !removedKeySet.has(record.slotId),
      );

      if (nextRecords.length !== current.length) {
        savePostedRecords(nextRecords);
      }

      return nextRecords;
    });
  }, [activeScheduleProducts, scheduleAssignments]);

  const updateDraftField = <Key extends keyof ProductDraft>(
    key: Key,
    value: ProductDraft[Key],
  ): void => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateSettingField = <Key extends keyof GlobalSettings>(
    key: Key,
    value: GlobalSettings[Key],
  ): void => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateDraftCategoryColor = (color: string): void => {
    const categoryKey = normalizeTextKey(draft.category);

    if (!categoryKey || !CATEGORY_COLOR_PATTERN.test(color)) return;

    setSettings((current) => ({
      ...current,
      categoryColors: {
        ...current.categoryColors,
        [categoryKey]: color.toLowerCase(),
      },
    }));
  };

  const resetDraftCategoryColor = (): void => {
    const categoryKey = normalizeTextKey(draft.category);

    if (!categoryKey) return;

    setSettings((current) => {
      if (!(categoryKey in current.categoryColors)) return current;

      const nextCategoryColors = { ...current.categoryColors };
      delete nextCategoryColors[categoryKey];

      return {
        ...current,
        categoryColors: nextCategoryColors,
      };
    });
  };

  const resetContactEditor = (): void => {
    setContactDraft("");
    setEditingContactOptionId("");
  };

  const startEditingContactOption = (option: ContactOption): void => {
    setEditingContactOptionId(option.id);
    setContactDraft(option.text);
  };

  const saveContactOption = (): void => {
    const text = contactDraft.trim();

    if (!text) {
      Toastify("Vui lòng nhập nội dung liên hệ", 400);
      return;
    }

    const duplicatedOption = settings.contactOptions.find(
      (option) =>
        option.id !== editingContactOptionId && option.text.trim() === text,
    );

    if (duplicatedOption) {
      Toastify("Nội dung liên hệ này đã có trong danh sách", 300);
      return;
    }

    if (editingContactOptionId) {
      setSettings((current) => ({
        ...current,
        contactOptions: current.contactOptions.map((option) =>
          option.id === editingContactOptionId ? { ...option, text } : option,
        ),
      }));
      resetContactEditor();
      Toastify("Đã cập nhật liên hệ", 200);
      return;
    }

    const option: ContactOption = {
      id: crypto.randomUUID(),
      text,
    };

    setSettings((current) => ({
      ...current,
      contactOptions: [...current.contactOptions, option],
    }));

    if (!selectedContactId) {
      setSelectedContactId(option.id);
    }

    resetContactEditor();
    Toastify("Đã thêm liên hệ", 200);
  };

  const selectContactOption = (id: string): void => {
    setSelectedContactId(id);
    Toastify("Đã chọn liên hệ cho thiết bị này", 200);
  };

  const confirmInitialContactSelection = (id: string): void => {
    setSelectedContactId(id);
    contactSelectionPromptedRef.current = true;
    setModalStack((current) =>
      current.filter((modalName) => modalName !== "contactSelection"),
    );
    Toastify("Đã lưu liên hệ cho thiết bị này", 200);
  };

  const removeContactOption = (id: string): void => {
    const option = settings.contactOptions.find((item) => item.id === id);
    if (!option) return;

    requestConfirm({
      title: "Xóa nội dung liên hệ?",
      description: "Liên hệ sẽ bị xóa khỏi MongoDB và file backup tiếp theo. Thiết bị đang chọn liên hệ này sẽ phải chọn lại.",
      confirmLabel: "Xóa liên hệ",
      tone: "danger",
      onConfirm: () => {
        setSettings((current) => ({
          ...current,
          contactOptions: current.contactOptions.filter(
            (item) => item.id !== id,
          ),
        }));

        if (selectedContactId === id) {
          contactSelectionPromptedRef.current = false;
          setSelectedContactId("");
        }

        if (editingContactOptionId === id) {
          resetContactEditor();
        }

        Toastify("Đã xóa liên hệ", 200);
      },
    });
  };

  const resetFacebookPageEditor = (): void => {
    setFacebookPageNameDraft("");
    setFacebookPageAssetIdDraft("");
    setEditingFacebookPageOptionId("");
  };

  const startEditingFacebookPageOption = (
    option: FacebookPageOption,
  ): void => {
    setEditingFacebookPageOptionId(option.id);
    setFacebookPageNameDraft(option.name);
    setFacebookPageAssetIdDraft(option.assetId);
  };

  const saveFacebookPageOption = (): void => {
    const assetId = normalizeFacebookAssetId(facebookPageAssetIdDraft);
    const name = facebookPageNameDraft.trim() || `Fanpage ${assetId}`;

    if (!assetId) {
      Toastify("Vui lòng nhập Asset ID của Fanpage", 400);
      return;
    }

    const existingOption = settings.facebookPages.find(
      (option) =>
        option.id !== editingFacebookPageOptionId &&
        option.assetId === assetId,
    );

    if (existingOption) {
      Toastify("Asset ID này đã có trong danh sách", 300);
      return;
    }

    if (editingFacebookPageOptionId) {
      setSettings((current) => ({
        ...current,
        facebookPages: current.facebookPages.map((option) =>
          option.id === editingFacebookPageOptionId
            ? { ...option, name, assetId }
            : option,
        ),
      }));
      resetFacebookPageEditor();
      Toastify("Đã cập nhật Fanpage", 200);
      return;
    }

    setSettings((current) => {
      const option: FacebookPageOption = {
        id: crypto.randomUUID(),
        name,
        assetId,
      };

      return {
        ...current,
        facebookPages: [...current.facebookPages, option],
      };
    });

    resetFacebookPageEditor();
    Toastify("Đã thêm Fanpage", 200);
  };

  const removeFacebookPageOption = (id: string): void => {
    const option = settings.facebookPages.find((item) => item.id === id);
    if (!option) return;

    requestConfirm({
      title: "Xóa Fanpage?",
      description: `${option.name} và Asset ID ${option.assetId} sẽ bị xóa khỏi danh sách.`,
      confirmLabel: "Xóa Fanpage",
      tone: "danger",
      onConfirm: () => {
        setSettings((current) => ({
          ...current,
          facebookPages: current.facebookPages.filter(
            (item) => item.id !== id,
          ),
        }));

        if (editingFacebookPageOptionId === id) {
          resetFacebookPageEditor();
        }

        if (selectedFacebookPageId === id) {
          setSelectedFacebookPageId("");
        }

        Toastify("Đã xóa Fanpage", 200);
      },
    });
  };

  const resetFacebookDuplicatePostEditor = (): void => {
    setFacebookDuplicateNameDraft("");
    setFacebookDuplicateCategoryDraft("");
    setFacebookDuplicateUrlDraft("");
    setEditingFacebookDuplicatePostId("");
  };

  const startEditingFacebookDuplicatePostOption = (
    option: FacebookDuplicatePostOption,
  ): void => {
    setEditingFacebookDuplicatePostId(option.id);
    setFacebookDuplicateNameDraft(option.name);
    setFacebookDuplicateCategoryDraft(option.category);
    setFacebookDuplicateUrlDraft(option.url);
  };

  const saveFacebookDuplicatePostOption = (): void => {
    const url = normalizeMetaBusinessDuplicateUrl(facebookDuplicateUrlDraft);

    if (!url) return;

    const name =
      facebookDuplicateNameDraft.trim() ||
      `Bản sao ${facebookDuplicatePostTemplates.length + 1}`;
    const category =
      normalizeCategoryName(facebookDuplicateCategoryDraft) ||
      "Chưa phân loại";

    if (editingFacebookDuplicatePostId) {
      setSettings((current) => ({
        ...current,
        facebookDuplicatePosts: current.facebookDuplicatePosts.map((option) =>
          option.id === editingFacebookDuplicatePostId
            ? { ...option, name, category, url }
            : option,
        ),
      }));
      resetFacebookDuplicatePostEditor();
      Toastify("Đã cập nhật mẫu nhân bản", 200);
      return;
    }

    const option: FacebookDuplicatePostOption = {
      id: crypto.randomUUID(),
      name,
      category,
      url,
    };

    setSettings((current) => ({
      ...current,
      facebookDuplicatePosts: [...current.facebookDuplicatePosts, option],
    }));
    resetFacebookDuplicatePostEditor();
    Toastify("Đã lưu mẫu nhân bản", 200);
  };

  const removeFacebookDuplicatePostOption = (id: string): void => {
    const option = settings.facebookDuplicatePosts.find(
      (item) => item.id === id,
    );
    if (!option) return;

    requestConfirm({
      title: "Xóa mẫu nhân bản?",
      description: `${option.name} trong danh mục ${option.category} sẽ bị xóa khỏi danh sách.`,
      confirmLabel: "Xóa mẫu",
      tone: "danger",
      onConfirm: () => {
        setSettings((current) => ({
          ...current,
          facebookDuplicatePosts: current.facebookDuplicatePosts.filter(
            (item) => item.id !== id,
          ),
        }));

        if (editingFacebookDuplicatePostId === id) {
          resetFacebookDuplicatePostEditor();
        }

        Toastify("Đã xóa mẫu nhân bản", 200);
      },
    });
  };

  const createSelectedFacebookDuplicateUrl = (
    option: FacebookDuplicatePostOption,
  ): string => {
    if (!activeFacebookPage) {
      Toastify("Chưa chọn Fanpage", 300);
      return "";
    }

    const url = createMetaBusinessDuplicateUrl(
      option.url,
      activeFacebookPage.assetId,
    );

    return url || option.url.trim();
  };

  const copyFacebookUrl = async (
    url: string,
    successMessage: string,
  ): Promise<void> => {
    try {
      await copyText(url);
      Toastify(successMessage, 200);
    } catch {
      Toastify("Không thể copy URL", 400);
    }
  };

  const openFacebookUrl = (
    openerWindow: Window,
    url: string,
    popupId: string,
  ): void => {
    const openResult = openFacebookPopupWindow(
      openerWindow,
      url,
      popupId,
    );

    if (!openResult.window) {
      Toastify(
        "Không thể mở Facebook bằng cửa sổ mới hoặc tab mới.",
        400,
      );
      return;
    }

    if (openResult.usedPopupFallback) {
      Toastify(
        "Cửa sổ popup bị chặn, đã tự động chuyển sang tab mới.",
        300,
      );
    }
  };

  const copyFacebookDuplicateUrl = async (
    option: FacebookDuplicatePostOption,
  ): Promise<void> => {
    const url = createSelectedFacebookDuplicateUrl(option);

    if (!url) return;

    await copyFacebookUrl(url, "Đã copy URL nhân bản");
  };

  const openFacebookDuplicateUrl = (
    openerWindow: Window,
    option: FacebookDuplicatePostOption,
  ): void => {
    if (!activeFacebookPage) {
      Toastify("Chưa chọn Fanpage", 300);
      return;
    }

    const url = createSelectedFacebookDuplicateUrl(option);

    if (!url) return;

    openFacebookUrl(
      openerWindow,
      url,
      `duplicate-${activeFacebookPage.id}-${option.id}`,
    );
  };

  const addFacebookGroupOption = (): void => {
    const url = normalizeFacebookGroupUrl(facebookGroupUrlDraft);

    if (!url) {
      Toastify("Link Group Facebook không hợp lệ", 400);
      return;
    }

    const existingOption = settings.facebookGroups.find(
      (group) => group.url === url,
    );

    if (existingOption) {
      if (!settings.selectedFacebookGroupIds.includes(existingOption.id)) {
        updateSettingField("selectedFacebookGroupIds", [
          ...settings.selectedFacebookGroupIds,
          existingOption.id,
        ]);
      }

      Toastify("Group này đã có trong danh sách", 300);
      return;
    }

    const option: FacebookGroupOption = {
      id: crypto.randomUUID(),
      name:
        facebookGroupNameDraft.trim() ||
        `Group ${settings.facebookGroups.length + 1}`,
      category:
        normalizeCategoryName(facebookGroupCategoryDraft) ||
        "Chưa phân loại",
      url,
    };

    setSettings((current) => ({
      ...current,
      facebookGroups: [...current.facebookGroups, option],
      selectedFacebookGroupIds: [
        ...current.selectedFacebookGroupIds,
        option.id,
      ],
    }));

    setFacebookGroupNameDraft("");
    setFacebookGroupCategoryDraft("");
    setFacebookGroupUrlDraft("");
  };

  const updateFacebookGroupOptionName = (id: string, name: string): void => {
    setSettings((current) => ({
      ...current,
      facebookGroups: current.facebookGroups.map((group) =>
        group.id === id ? { ...group, name } : group,
      ),
    }));
  };

  const updateFacebookGroupOptionCategory = (
    id: string,
    category: string,
  ): void => {
    setSettings((current) => ({
      ...current,
      facebookGroups: current.facebookGroups.map((group) =>
        group.id === id ? { ...group, category } : group,
      ),
    }));
  };

  const toggleFacebookGroupSelection = (id: string): void => {
    setSettings((current) => {
      const selected = current.selectedFacebookGroupIds.includes(id);

      return {
        ...current,
        selectedFacebookGroupIds: selected
          ? current.selectedFacebookGroupIds.filter(
            (groupId) => groupId !== id,
          )
          : [...current.selectedFacebookGroupIds, id],
      };
    });
  };

  const removeFacebookGroupOption = (id: string): void => {
    setSettings((current) => ({
      ...current,
      facebookGroups: current.facebookGroups.filter(
        (group) => group.id !== id,
      ),
      selectedFacebookGroupIds: current.selectedFacebookGroupIds.filter(
        (groupId) => groupId !== id,
      ),
    }));
  };

  const updateScheduleField = <Key extends keyof ScheduleConfig>(
    key: Key,
    value: ScheduleConfig[Key],
  ): void => {
    setScheduleConfig((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const openModal = (modalName: Exclude<ModalName, "">): void => {
    setModalStack((current) => {
      const currentTopModal = current[current.length - 1];

      if (currentTopModal === modalName) return current;

      return [...current, modalName];
    });
  };

  const cleanupUnattachedDraftImages = (): void => {
    const publicIds = [...draft.images, ...draft.internalImages]
      .map((image) => image.publicId)
      .filter(
        (publicId) =>
          publicId && !persistedDraftPublicIdsRef.current.has(publicId),
      );
    void deleteUnattachedCloudinaryImages(publicIds).catch((error) => {
      console.error("Không thể dọn ảnh Cloudinary chưa gắn sản phẩm", error);
    });
  };

  const closeModal = (): void => {
    setModalStack((current) => {
      const closingModal = current[current.length - 1] ?? "";

      if (closingModal === "product") {
        cleanupUnattachedDraftImages();
        setDraft(emptyDraft);
        setEditingId("");
        persistedDraftPublicIdsRef.current = new Set<string>();
      }

      if (closingModal === "slotDetail") {
        setSelectedSlotId("");
      }

      if (closingModal === "imageAlbum") {
        setSelectedAlbumImageId("");
        setSelectedAlbumImageIds(new Set<string>());
        setAlbumSource(null);
      }

      if (closingModal === "imageDownload") {
        setImageDownloadCategory("all");
      }

      if (closingModal === "localImageManager") {
        setLocalImageQuery("");
        setLocalImageView("active");
        setSelectedLocalImageNames(new Set<string>());
      }

      if (closingModal === "contact") {
        resetContactEditor();
      }

      if (closingModal === "facebookPages") {
        resetFacebookPageEditor();
        setFacebookGroupNameDraft("");
        setFacebookGroupCategoryDraft("");
        setFacebookGroupUrlDraft("");
      }

      if (closingModal === "facebookDuplicatePosts") {
        resetFacebookDuplicatePostEditor();
        setSelectedFacebookPageId("");
      }

      return current.slice(0, -1);
    });
  };

  const closeAllModals = (): void => {
    if (modalStack.includes("product")) cleanupUnattachedDraftImages();
    persistedDraftPublicIdsRef.current = new Set<string>();
    setModalStack([]);
    setSelectedSlotId("");
    setSelectedAlbumImageId("");
    setSelectedAlbumImageIds(new Set<string>());
    setAlbumSource(null);
    setImageDownloadCategory("all");
    setLocalImageQuery("");
    setLocalImageView("active");
    setSelectedLocalImageNames(new Set<string>());
    setPendingConfirm(null);
    setPendingBackup(null);
    setPendingDownload(null);
    setSkipInternalDownloadImages(false);
    setPendingShare(null);
    setIncludeInternalShareImages(true);
    setShareDialogStep("share");
    resetContactEditor();
    resetFacebookPageEditor();
    resetFacebookDuplicatePostEditor();
    setSelectedFacebookPageId("");
    setFacebookGroupNameDraft("");
    setFacebookGroupCategoryDraft("");
    setFacebookGroupUrlDraft("");
    setFacebookGroupActiveIndex(0);
  };

  const openProductModalForCreate = (): void => {
    setEditingId("");
    setDraft(emptyDraft);
    persistedDraftPublicIdsRef.current = new Set<string>();
    openModal("product");
  };

  const appendImagesToDraft = async (
    files: File[],
    imageField: ProductImageField = "images",
  ): Promise<void> => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      Toastify("Không tìm thấy file ảnh phù hợp", 400);
      return;
    }

    setIsProcessingImages(true);

    try {
      const images = await convertFilesToImages(imageFiles);

      setDraft((current) => ({
        ...current,
        [imageField]: renameDraftImagesByField(
          [...images, ...current[imageField]],
          imageField,
        ),
      }));

      Toastify(
        `Đã thêm ${images.length} ${imageField === "internalImages" ? "ảnh nội bộ" : "ảnh chính"}`,
        200,
      );
    } catch {
      Toastify("Không thể xử lý ảnh", 400);
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleImageInput = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const files = Array.from(event.target.files ?? []) as File[];

    await appendImagesToDraft(files);

    event.target.value = "";
  };

  const handleInternalImageInput = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const files = Array.from(event.target.files ?? []) as File[];

    await appendImagesToDraft(files, "internalImages");

    event.target.value = "";
  };

  const handlePaste = async (
    event: ClipboardEvent<HTMLElement>,
  ): Promise<void> => {
    const files = Array.from(event.clipboardData.files) as File[];
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) return;

    await appendImagesToDraft(imageFiles);
  };

  const handleInternalImagePaste = async (
    event: ClipboardEvent<HTMLElement>,
  ): Promise<void> => {
    const files = Array.from(event.clipboardData.files) as File[];
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) return;

    event.stopPropagation();
    await appendImagesToDraft(imageFiles, "internalImages");
  };

  const moveDraftImageBetweenFields = (
    sourceImageId: string,
    sourceImageField: ProductImageField,
    targetImageField: ProductImageField,
    targetImageId?: string,
  ): void => {
    if (sourceImageField === targetImageField) return;

    setDraft((current) => {
      const sourceIndex = current[sourceImageField].findIndex(
        (image) => image.id === sourceImageId,
      );

      if (sourceIndex < 0) return current;

      const nextSourceImages = [...current[sourceImageField]];
      const [movedImage] = nextSourceImages.splice(sourceIndex, 1);

      if (!movedImage) return current;

      const nextTargetImages = [...current[targetImageField]];
      const targetIndex = targetImageId
        ? nextTargetImages.findIndex((image) => image.id === targetImageId)
        : -1;
      const insertIndex =
        targetIndex >= 0 ? targetIndex : nextTargetImages.length;

      nextTargetImages.splice(insertIndex, 0, movedImage);

      return {
        ...current,
        [sourceImageField]: renameDraftImagesByField(
          nextSourceImages,
          sourceImageField,
        ),
        [targetImageField]: renameDraftImagesByField(
          nextTargetImages,
          targetImageField,
        ),
      };
    });
  };

  const resetDraftImageDrag = (): void => {
    setDraggingDraftImageId("");
    setDraggingDraftImageField("");
    setDragOverImageField("");
  };

  const handleDrop = async (
    event: DragEvent<HTMLElement>,
    imageField: ProductImageField = "images",
    targetImageId?: string,
  ): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();

    const sourceImageId =
      event.dataTransfer.getData(DRAFT_IMAGE_ID_DATA_TYPE) ||
      draggingDraftImageId;
    const rawSourceImageField =
      event.dataTransfer.getData(DRAFT_IMAGE_FIELD_DATA_TYPE) ||
      draggingDraftImageField;
    const sourceImageField: ProductImageField | "" =
      rawSourceImageField === "images" ||
        rawSourceImageField === "internalImages"
        ? rawSourceImageField
        : "";

    if (sourceImageId && sourceImageField) {
      if (sourceImageField === imageField) {
        if (targetImageId) {
          reorderDraftImage(sourceImageId, targetImageId, imageField);
        }
      } else {
        moveDraftImageBetweenFields(
          sourceImageId,
          sourceImageField,
          imageField,
          targetImageId,
        );
        Toastify(
          imageField === "images"
            ? "Đã chuyển ảnh nội bộ lên ảnh chính"
            : "Đã chuyển ảnh chính xuống ảnh nội bộ",
          200,
        );
      }

      resetDraftImageDrag();
      return;
    }

    setDragOverImageField("");

    const files = Array.from(event.dataTransfer.files) as File[];

    await appendImagesToDraft(files, imageField);
  };

  const handleDragOver = (
    event: DragEvent<HTMLElement>,
    imageField: ProductImageField = "images",
  ): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = draggingDraftImageId ? "move" : "copy";
    setDragOverImageField(imageField);
  };

  const handleDragLeave = (): void => {
    setDragOverImageField("");
  };

  const removeDraftImage = (
    imageId: string,
    imageField: ProductImageField = "images",
  ): void => {
    const removedImage = draft[imageField].find((image) => image.id === imageId);
    if (
      removedImage?.publicId &&
      !persistedDraftPublicIdsRef.current.has(removedImage.publicId)
    ) {
      void deleteUnattachedCloudinaryImages([removedImage.publicId]).catch((error) => {
        console.error("Không thể xóa ảnh Cloudinary khỏi bản nháp", error);
      });
    }

    setDraft((current) => ({
      ...current,
      [imageField]: renameDraftImagesByField(
        current[imageField].filter((image) => image.id !== imageId),
        imageField,
      ),
    }));
  };

  const reorderDraftImage = (
    sourceImageId: string,
    targetImageId: string,
    imageField: ProductImageField = "images",
  ): void => {
    if (!sourceImageId || !targetImageId || sourceImageId === targetImageId)
      return;

    setDraft((current) => {
      const sourceIndex = current[imageField].findIndex(
        (image) => image.id === sourceImageId,
      );
      const targetIndex = current[imageField].findIndex(
        (image) => image.id === targetImageId,
      );

      if (sourceIndex < 0 || targetIndex < 0) return current;

      const nextImages = [...current[imageField]];
      const [movedImage] = nextImages.splice(sourceIndex, 1);

      if (!movedImage) return current;

      nextImages.splice(targetIndex, 0, movedImage);

      return {
        ...current,
        [imageField]: renameDraftImagesByField(nextImages, imageField),
      };
    });
  };

  const resetForm = (): void => {
    setDraft(emptyDraft);
    setEditingId("");
    persistedDraftPublicIdsRef.current = new Set<string>();
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    const now = new Date().toISOString();
    const rawName = draft.name.trim();
    const description = draft.description.trim();
    const pin = draft.pin.trim();
    const status = draft.status.trim();
    const priceText = draft.priceText.trim();
    const category = draft.category.trim();
    const contentType = draft.contentType;
    const realEstateComment = draft.realEstateComment.trim();

    if (!rawName) {
      Toastify("Vui lòng nhập tên sản phẩm", 400);
      return;
    }

    const currentProduct = products.find((product) => product.id === editingId);
    const name = normalizeDoneProductName(
      rawName,
      currentProduct?.isDone ?? false,
    );

    const product: LocalProduct = {
      id: currentProduct?.id ?? crypto.randomUUID(),
      name,
      description,
      pin,
      status,
      price: parsePriceNumber(priceText, contentType),
      priceText,
      category,
      contentType,
      realEstateComment,
      images: draft.images,
      internalImages: draft.internalImages,
      isDone: currentProduct?.isDone ?? false,
      doneAt: currentProduct?.doneAt ?? "",
      createdAt: currentProduct?.createdAt ?? now,
      updatedAt: now,
    };

    setPageLoadingText(editingId ? "Đang cập nhật sản phẩm..." : "Đang thêm sản phẩm...");

    try {
      const cleanup = await saveProductToDb(product);
      persistedDraftPublicIdsRef.current = new Set(
        [...product.images, ...product.internalImages].map((image) => image.publicId),
      );
      setProducts((current) =>
        sortProductsByUpdatedAt([
          product,
          ...current.filter((item) => item.id !== product.id),
        ]),
      );

      closeAllModals();
      resetForm();
      Toastify(
        cleanup.failed.length > 0
          ? `Đã lưu sản phẩm nhưng còn ${cleanup.failed.length} ảnh Cloudinary chưa xóa được`
          : editingId
            ? "Đã cập nhật sản phẩm"
            : "Đã thêm sản phẩm",
        cleanup.failed.length > 0 ? 300 : 200,
      );
    } catch {
      Toastify(editingId ? "Không thể cập nhật sản phẩm" : "Không thể thêm sản phẩm", 400);
    } finally {
      setPageLoadingText("");
    }
  };

  const handleEdit = (product: LocalProduct): void => {
    setEditingId(product.id);
    setDraft({
      name: product.name,
      description: product.description,
      pin: product.pin,
      status: product.status,
      priceText: product.priceText,
      category: product.category,
      contentType: product.contentType,
      realEstateComment: product.realEstateComment,
      images: product.images,
      internalImages: product.internalImages,
    });
    persistedDraftPublicIdsRef.current = new Set(
      [...product.images, ...product.internalImages].map((image) => image.publicId),
    );

    openModal("product");
  };

  const handleDelete = async (id: string): Promise<void> => {
    const product = products.find((item) => item.id === id);
    const productName = product?.name ?? "sản phẩm này";

    requestConfirm({
      title: "Xóa sản phẩm?",
      description: `Xóa vĩnh viễn ${productName}? Dữ liệu MongoDB và toàn bộ ảnh của sản phẩm trên Cloudinary sẽ bị xóa.`,
      confirmLabel: "Xóa sản phẩm",
      tone: "danger",
      onConfirm: async () => {
        const cleanup = await deleteProductFromDb(id);

        setSelectedProductId((current) => (current === id ? "" : current));
        setExpandedProductIds((current) => {
          if (!current.has(id)) return current;

          const nextIds = new Set(current);
          nextIds.delete(id);

          return nextIds;
        });
        setScheduleAssignments((current) => {
          const nextAssignments: ScheduleAssignmentMap = {};

          Object.entries(current).forEach(([key, value]) => {
            if (value !== id) {
              nextAssignments[key] = value as string;
            }
          });

          return nextAssignments;
        });
        setPostedRecords((current) => {
          const nextRecords = current.filter(
            (record) => !record.slotId.endsWith(`::${id}`),
          );

          if (nextRecords.length !== current.length) {
            savePostedRecords(nextRecords);
          }

          return nextRecords;
        });

        setProducts((current) =>
          current.filter((item) => item.id !== id),
        );
        Toastify(
          cleanup.failed.length > 0
            ? `Đã xóa sản phẩm khỏi MongoDB nhưng còn ${cleanup.failed.length} ảnh Cloudinary chưa xóa được`
            : `Đã xóa sản phẩm và ${cleanup.deleted.length} ảnh Cloudinary`,
          cleanup.failed.length > 0 ? 300 : 200,
        );
      },
    });
  };

  const updateProductDoneStatus = async (
    product: LocalProduct,
    nextIsDone: boolean,
  ): Promise<void> => {
    const productId = product.id;
    const now = new Date().toISOString();
    const nextProduct: LocalProduct = {
      ...product,
      name: normalizeDoneProductName(product.name, nextIsDone),
      isDone: nextIsDone,
      doneAt: nextIsDone ? now : "",
      updatedAt: now,
    };

    if (nextIsDone) {
      setPendingDoneProductIds((current) => {
        const nextIds = new Set(current);
        nextIds.add(productId);

        return nextIds;
      });

      window.setTimeout(() => {
        setPendingDoneProductIds((current) => {
          if (!current.has(productId)) return current;

          const nextIds = new Set(current);
          nextIds.delete(productId);

          return nextIds;
        });
      }, 2000);
    } else {
      setPendingDoneProductIds((current) => {
        if (!current.has(productId)) return current;

        const nextIds = new Set(current);
        nextIds.delete(productId);

        return nextIds;
      });
    }

    await saveProductToDb(nextProduct);

    setProducts((current) =>
      current.map((item) => (item.id === productId ? nextProduct : item)),
    );

    Toastify(
      nextIsDone
        ? "Đã đánh dấu DONE, sản phẩm sẽ tự xuống cuối sau 2 giây"
        : "Đã chuyển sản phẩm về Chưa bán",
      200,
    );
  };

  const toggleProductDone = (productId: string): void => {
    const product = products.find((item) => item.id === productId);

    if (!product) {
      Toastify("Không tìm thấy sản phẩm", 400);
      return;
    }

    const nextIsDone = !product.isDone;
    const productName = removeDoneProductPrefix(product.name).trim();

    requestConfirm({
      title: nextIsDone
        ? "Đánh dấu sản phẩm đã bán?"
        : "Chuyển sản phẩm về Chưa bán?",
      description: nextIsDone
        ? `${productName} sẽ chuyển sang DONE và tự xuống cuối danh sách sau 2 giây.`
        : `${productName} sẽ bỏ trạng thái DONE và trở lại danh sách sản phẩm đang bán.`,
      confirmLabel: nextIsDone
        ? "Đánh dấu DONE"
        : "Chuyển về Chưa bán",
      tone: "warning",
      onConfirm: async () => {
        await updateProductDoneStatus(product, nextIsDone);
      },
    });
  };

  const handleCopyField = async (
    key: string,
    label: string,
    value: string,
  ): Promise<void> => {
    if (!value.trim()) {
      Toastify(`${label} đang trống`, 300);
      return;
    }

    try {
      await copyText(value);
      setCopiedKey(key);
      Toastify(`Đã copy ${label}`, 200);

      getActiveInteractionWindow().setTimeout(() => {
        setCopiedKey((current) => (current === key ? "" : current));
      }, 1200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Không thể copy ${label}`;

      Toastify(message, 400);
    }
  };

  const handleCopyProductRepresentativeImage = async (
    product: LocalProduct,
  ): Promise<void> => {
    const representativeImage = product.images[0];

    if (!representativeImage) {
      Toastify("Sản phẩm chưa có ảnh đại diện để copy", 300);
      return;
    }

    const copyKey = `cover-${product.id}`;

    try {
      await copyImageToClipboard(representativeImage);
      setCopiedKey(copyKey);
      Toastify("Đã copy ảnh đại diện", 200);

      getActiveInteractionWindow().setTimeout(() => {
        setCopiedKey((current) => (current === copyKey ? "" : current));
      }, 1200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể copy ảnh đại diện";
      Toastify(message, 400);
    }
  };

  const handleCopyProductList = async (): Promise<void> => {
    if (copyableProductCount === 0) {
      Toastify("Không có sản phẩm đang hoạt động để copy", 300);
      return;
    }

    const textValue = buildCopyableProductListText(copyableProductGroups);

    try {
      await copyText(textValue);
      setCopiedKey("product-list-copy");
      Toastify(`Đã copy ${copyableProductCount} sản phẩm đang hoạt động`, 200);

      getActiveInteractionWindow().setTimeout(() => {
        setCopiedKey((current) =>
          current === "product-list-copy" ? "" : current,
        );
      }, 1200);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể copy danh sách sản phẩm";

      Toastify(message, 400);
    }
  };

  const handleExportProductsCsv = (): void => {
    if (copyableProductCount === 0) {
      Toastify("Không có sản phẩm đang hoạt động để xuất Excel", 300);
      return;
    }

    const csvContent = buildProductsCsvContent(copyableProductGroups);
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8",
    });

    downloadBlob(blob, `danh-sach-san-pham-${Date.now()}.csv`);
    Toastify(`Đã xuất ${copyableProductCount} sản phẩm sang Excel`, 200);
  };

  const prepareBackupFile = async (
    extension: "json" | "json.gz",
  ): Promise<void> => {
    const isCompressed = extension === "json.gz";

    setPageLoadingText(
      isCompressed
        ? "Đang tạo và nén file backup..."
        : "Đang tạo file backup JSON...",
    );
    await waitForUiPaint();

    try {
      const payload = createExportPayload({
        settings,
        products,
        scheduleConfig,
        scheduleAssignments,
        postedRecords,
      });

      // Dùng JSON compact để giảm bộ nhớ, thời gian và dung lượng trên iPhone.
      const content = JSON.stringify(payload);
      const blob = isCompressed
        ? await textToGzipBlob(content)
        : new Blob([content], {
          type: "application/json;charset=utf-8",
        });

      setPendingBackup({
        blob,
        filename: createBackupFileName(extension),
        label: isCompressed ? "JSON.GZ" : "JSON",
      });
    } finally {
      setPageLoadingText("");
    }
  };

  const handleExportJson = (): void => {
    requestConfirm({
      title: "Tạo file backup JSON?",
      description:
        "Hệ thống sẽ chuẩn bị file trước. Trên iPhone, nhấn Lưu file rồi chọn Lưu vào Tệp trong bảng chia sẻ.",
      confirmLabel: "Tạo file JSON",
      tone: "default",
      onConfirm: async () => {
        await prepareBackupFile("json");
      },
    });
  };

  const handleExportJsonGzip = (): void => {
    requestConfirm({
      title: "Tạo file backup JSON.GZ?",
      description:
        "Định dạng nén phù hợp hơn khi dữ liệu và ảnh lớn. Sau khi chuẩn bị xong, nhấn Lưu file để mở bảng chia sẻ trên iPhone.",
      confirmLabel: "Tạo file JSON.GZ",
      tone: "default",
      onConfirm: async () => {
        await prepareBackupFile("json.gz");
      },
    });
  };

  const handleSavePreparedBackup = async (): Promise<void> => {
    if (!pendingBackup || isBackupSaving) return;

    setIsBackupSaving(true);

    try {
      const result = await saveBackupBlob(
        pendingBackup.blob,
        pendingBackup.filename,
      );

      setPendingBackup(null);
      Toastify(
        result === "shared"
          ? "Đã mở bảng chia sẻ. Hãy chọn Lưu vào Tệp."
          : "Đã gửi file đến trình quản lý tải xuống.",
        200,
      );
    } catch (error) {
      if (isAbortError(error)) return;

      const message =
        error instanceof Error ? error.message : "Không thể lưu file backup";
      Toastify(message, 400);
    } finally {
      setIsBackupSaving(false);
    }
  };

  const openBackupFilePicker = (): void => {
    const input = getActiveInteractionWindow().document.getElementById(
      IMPORT_BACKUP_INPUT_ID,
    ) as HTMLInputElement | null;

    if (!input) {
      Toastify("Không thể mở trình chọn tệp backup", 400);
      return;
    }

    input.click();
  };

  const handleBeginBackupRestore = (): void => {
    if (isBackupRestoreReady) {
      openBackupFilePicker();
      return;
    }

    requestConfirm({
      title: "Xóa dữ liệu hiện tại trước khi khôi phục?",
      description:
        "Toàn bộ sản phẩm, ảnh và dữ liệu ứng dụng hiện tại sẽ bị xóa. Sau đó trang sẽ tải lại và mở bước chọn tệp backup mới.",
      confirmLabel: "Xóa và tiếp tục",
      tone: "danger",
      onConfirm: async () => {
        setPageLoadingText("Đang xóa toàn bộ dữ liệu hiện tại...");
        await waitForUiPaint();

        try {
          window.sessionStorage.setItem(
            RESTORE_BACKUP_AFTER_RELOAD_KEY,
            "1",
          );
          await clearAllLocalProductData();
          await clearBootstrapCache();
          window.location.reload();
        } catch (error) {
          window.sessionStorage.removeItem(RESTORE_BACKUP_AFTER_RELOAD_KEY);
          setPageLoadingText("");
          throw error;
        }
      },
    });
  };

  const handleClearAllLocalData = (): void => {
    requestConfirm({
      title: "Xóa toàn bộ dữ liệu hệ thống?",
      description:
        "Toàn bộ sản phẩm, cấu hình trong MongoDB và mọi ảnh sản phẩm thuộc thư mục quản lý trên Cloudinary sẽ bị xóa.",
      confirmLabel: "Xóa toàn bộ dữ liệu",
      tone: "danger",
      onConfirm: async () => {
        setPageLoadingText("Đang xóa MongoDB và ảnh Cloudinary...");
        await waitForUiPaint();

        try {
          await clearAllLocalProductData();
          await clearBootstrapCache();
          resetLocalProductState();
          closeAllModals();
          Toastify("Đã xóa toàn bộ dữ liệu MongoDB và Cloudinary", 200);
        } finally {
          setPageLoadingText("");
        }
      },
    });
  };

  const resetLocalProductState = (): void => {
    const today = getTodayString();
    const nextSettings: GlobalSettings = {
      ...defaultSettings,
      contactOptions: [],
    };
    const nextScheduleConfig: ScheduleConfig = {
      ...defaultScheduleConfig,
      dateFrom: today,
      dateTo: today,
      taskNames: [...defaultScheduleConfig.taskNames],
      selectedCategories: [],
    };

    persistedAppStateSignaturesRef.current = {
      settings: JSON.stringify(nextSettings),
      scheduleConfig: JSON.stringify(nextScheduleConfig),
      scheduleAssignments: JSON.stringify({}),
    };

    setProducts([]);
    setSettings(nextSettings);
    setContactDraft("");
    setPostedRecords([]);
    setScheduleConfig(nextScheduleConfig);
    setScheduleAssignments({});
    setDraft(emptyDraft);
    setEditingId("");
    setQuery("");
    setActiveCategoryTab("all");
  };

  const replaceLocalDataFromBackup = async (
    payload: ParsedImportPayload,
    clearExistingData = true,
  ): Promise<void> => {
    try {
      if (clearExistingData) {
        setPageLoadingText("Đang xóa dữ liệu hiện tại...");
        await waitForUiPaint();
        await clearAllLocalProductData();
        await clearBootstrapCache();
        resetLocalProductState();
      }

      setPageLoadingText(
        `Đang import ${payload.products.length} sản phẩm vào MongoDB và Cloudinary...`,
      );
      await waitForUiPaint();

      await restorePayloadToLocal(payload, {
        setSettings,
        setScheduleConfig,
        setScheduleAssignments,
        setPostedRecords,
        setProducts,
      });

      setContactDraft("");
      closeAllModals();
      Toastify(
        `Đã import ${payload.products.length} sản phẩm vào local`,
        200,
      );
    } finally {
      setPageLoadingText("");
    }
  };

  const handleImportJson = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    // Reset ngay để có thể chọn lại cùng một file, kể cả khi modal đổi trạng thái.
    input.value = "";

    if (!file) return;

    setPageLoadingText("Đang đọc và kiểm tra file backup...");
    await waitForUiPaint();

    try {
      const text = await readJsonOrGzipFileText(file);
      const payload = parseJsonTextToPayload(text);

      if (!payload || payload.products.length === 0) {
        throw new Error("File backup không đúng cấu trúc hoặc không có sản phẩm");
      }

      setPageLoadingText("");

      if (isBackupRestoreReady) {
        await replaceLocalDataFromBackup(payload, false);
        setIsBackupRestoreReady(false);
        return;
      }

      requestConfirm({
        title: "Thay thế bằng dữ liệu mới?",
        description: `File ${isGzipFile(file) ? "JSON.GZ" : "JSON"} có ${payload.products.length} sản phẩm (${formatFileSize(file.size)}). Khi đồng ý, toàn bộ dữ liệu hiện tại sẽ được xóa hoàn tất trước, sau đó tệp mới mới bắt đầu được import.`,
        confirmLabel: "Đồng ý, thay thế",
        tone: "warning",
        onConfirm: () => replaceLocalDataFromBackup(payload),
      });
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? "File JSON không hợp lệ hoặc đã bị hỏng"
          : error instanceof Error
            ? error.message
            : "Không thể import file backup";

      Toastify(message, 400);
      setPageLoadingText("");
    }
  };

  const markProductImagesDownloaded = (productIds: string[]): void => {
    const validProductIds = productIds.filter(
      (productId) => productId.trim().length > 0,
    );

    if (validProductIds.length === 0) return;

    const nextProductIds = loadDownloadedProductIds();

    validProductIds.forEach((productId) => nextProductIds.add(productId));
    saveDownloadedProductIds(nextProductIds);
    setDownloadedProductIds(nextProductIds);
  };

  const clearDownloadedProductSession = (): void => {
    if (typeof window === "undefined") return;

    try {
      window.sessionStorage.removeItem(
        DOWNLOADED_PRODUCT_IDS_SESSION_KEY,
      );
      setDownloadedProductIds(new Set<string>());
      Toastify("Đã xóa trạng thái ảnh đã tải trong phiên hiện tại", 200);
    } catch {
      Toastify("Không thể xóa trạng thái ảnh đã tải", 400);
    }
  };

  const applyLocalImageDirectorySnapshot = async (
    handle: LocalFileSystemDirectoryHandle,
  ): Promise<void> => {
    const snapshot = await readLocalImageDirectorySnapshot(handle);

    setLocalImageFiles(snapshot.active);
    setLocalTrashImageFiles(snapshot.trash);
    setSelectedLocalImageNames(new Set<string>());
  };

  const handleChooseLocalImageDirectory = async (): Promise<LocalFileSystemDirectoryHandle | null> => {
    if (!canUseDirectoryPicker()) {
      Toastify("Chỉ hỗ trợ Chrome/Edge desktop trên HTTPS", 400);
      return null;
    }

    setIsLocalImageManagerBusy(true);

    try {
      const handle = await chooseLocalImageDirectory();
      const permission = await queryLocalImageDirectoryPermission(handle);

      if (permission !== "granted") {
        Toastify("Chưa được cấp quyền đọc và ghi thư mục", 400);
        return null;
      }

      await storeLocalImageDirectoryHandle(handle);
      setLocalImageDirectoryHandle(handle);
      setLocalImageDirectoryPermission(permission);
      await applyLocalImageDirectorySnapshot(handle);
      Toastify(`Đã liên kết thư mục ${handle.name}`, 200);
      return handle;
    } catch (error) {
      if (isAbortError(error)) return null;

      const message =
        error instanceof Error ? error.message : "Không thể chọn thư mục ảnh";
      Toastify(message, 400);
      return null;
    } finally {
      setIsLocalImageManagerBusy(false);
    }
  };

  const getWritableLocalImageDirectory = async (): Promise<LocalFileSystemDirectoryHandle | null> => {
    if (!localImageDirectoryHandle) {
      return handleChooseLocalImageDirectory();
    }

    const permission = await requestLocalImageDirectoryPermission(
      localImageDirectoryHandle,
    );
    setLocalImageDirectoryPermission(permission);

    if (permission === "granted") {
      return localImageDirectoryHandle;
    }

    Toastify("Chrome cần cấp lại quyền thư mục ảnh", 300);
    return null;
  };

  const handleRefreshLocalImageDirectory = async (): Promise<void> => {
    const handle = await getWritableLocalImageDirectory();

    if (!handle) return;

    setIsLocalImageManagerBusy(true);

    try {
      await applyLocalImageDirectorySnapshot(handle);
      Toastify("Đã cập nhật danh sách ảnh trên máy", 200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể đọc thư mục ảnh";
      Toastify(message, 400);
    } finally {
      setIsLocalImageManagerBusy(false);
    }
  };

  const handleForgetLocalImageDirectory = (): void => {
    requestConfirm({
      title: "Bỏ liên kết thư mục ảnh?",
      description:
        "Chỉ xóa quyền liên kết đã lưu trong IndexedDB. Không xóa bất kỳ file nào trên ổ đĩa.",
      confirmLabel: "Bỏ liên kết",
      tone: "warning",
      onConfirm: async () => {
        await clearStoredLocalImageDirectoryHandle();
        setLocalImageDirectoryHandle(null);
        setLocalImageDirectoryPermission("prompt");
        setLocalImageFiles([]);
        setLocalTrashImageFiles([]);
        setSelectedLocalImageNames(new Set<string>());
        Toastify("Đã bỏ liên kết thư mục ảnh", 200);
      },
    });
  };

  const toggleLocalImageSelection = (name: string): void => {
    setSelectedLocalImageNames((current) => {
      const next = new Set(current);

      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }

      return next;
    });
  };

  const selectAllFilteredLocalImages = (): void => {
    setSelectedLocalImageNames(
      new Set<string>(filteredLocalImageFiles.map((file) => file.name)),
    );
  };

  const handleMoveSelectedLocalImagesToTrash = (): void => {
    const names = Array.from(selectedLocalImageNames);

    if (names.length === 0) {
      Toastify("Chưa chọn ảnh cần đưa vào _trash", 300);
      return;
    }

    requestConfirm({
      title: `Đưa ${names.length} ảnh vào _trash?`,
      description:
        "Ảnh sẽ được copy sang thư mục con _trash, xác minh dung lượng bản sao rồi mới xóa file gốc. Đây không phải Thùng rác Windows.",
      confirmLabel: "Đưa vào _trash",
      tone: "warning",
      onConfirm: async () => {
        const handle = await getWritableLocalImageDirectory();

        if (!handle) return;

        setIsLocalImageManagerBusy(true);

        try {
          const result = await moveLocalImagesToTrash(handle, names);
          await applyLocalImageDirectorySnapshot(handle);
          Toastify(
            result.failed > 0
              ? `Đã chuyển ${result.moved} ảnh, ${result.failed} ảnh lỗi`
              : `Đã chuyển ${result.moved} ảnh vào _trash`,
            result.failed > 0 ? 300 : 200,
          );
        } finally {
          setIsLocalImageManagerBusy(false);
        }
      },
    });
  };

  const handleRestoreSelectedLocalImages = (): void => {
    const names = Array.from(selectedLocalImageNames);

    if (names.length === 0) {
      Toastify("Chưa chọn ảnh cần khôi phục", 300);
      return;
    }

    requestConfirm({
      title: `Khôi phục ${names.length} ảnh?`,
      description:
        "Ảnh sẽ được copy từ _trash về thư mục chính, xác minh dung lượng rồi mới xóa bản trong _trash.",
      confirmLabel: "Khôi phục",
      tone: "default",
      onConfirm: async () => {
        const handle = await getWritableLocalImageDirectory();

        if (!handle) return;

        setIsLocalImageManagerBusy(true);

        try {
          const result = await restoreLocalImagesFromTrash(handle, names);
          await applyLocalImageDirectorySnapshot(handle);
          Toastify(
            result.failed > 0
              ? `Đã khôi phục ${result.moved} ảnh, ${result.failed} ảnh lỗi`
              : `Đã khôi phục ${result.moved} ảnh`,
            result.failed > 0 ? 300 : 200,
          );
        } finally {
          setIsLocalImageManagerBusy(false);
        }
      },
    });
  };

  const handlePermanentlyDeleteSelectedLocalImages = (): void => {
    const names = Array.from(selectedLocalImageNames);

    if (names.length === 0) {
      Toastify("Chưa chọn ảnh cần xóa vĩnh viễn", 300);
      return;
    }

    requestConfirm({
      title: `Xóa vĩnh viễn ${names.length} ảnh?`,
      description:
        "Các file trong _trash sẽ bị xóa trực tiếp bằng File System Access API và không đảm bảo xuất hiện trong Thùng rác Windows.",
      confirmLabel: "Xóa vĩnh viễn",
      tone: "danger",
      onConfirm: async () => {
        const handle = await getWritableLocalImageDirectory();

        if (!handle) return;

        setIsLocalImageManagerBusy(true);

        try {
          const result = await permanentlyDeleteLocalTrashImages(handle, names);
          await applyLocalImageDirectorySnapshot(handle);
          Toastify(
            result.failed > 0
              ? `Đã xóa ${result.moved} ảnh, ${result.failed} ảnh lỗi`
              : `Đã xóa vĩnh viễn ${result.moved} ảnh`,
            result.failed > 0 ? 300 : 200,
          );
        } finally {
          setIsLocalImageManagerBusy(false);
        }
      },
    });
  };

  const requestDownload = (request: DownloadRequest): void => {
    setSkipInternalDownloadImages(false);
    setPendingDownload(request);
  };

  const getDownloadImages = (request: DownloadRequest): ProductImage[] => {
    if (skipInternalDownloadImages) return request.images;

    return [...request.images, ...(request.internalImages ?? [])];
  };

  const getDownloadedProductIds = (request: DownloadRequest): string[] => {
    if (skipInternalDownloadImages) {
      return request.productIdsWhenSkippingInternal ?? request.productIds ?? [];
    }

    return request.productIds ?? [];
  };

  const getConfiguredAutoCopyContent = (
    source: AutoCopyContentSource,
  ): { label: "Post" | "Cmt"; text: string } => {
    if (settings.autoCopyShareMode === "comment") {
      return {
        label: "Cmt",
        text: composeCopyText(
          source.commentText,
          activeContactText,
          false,
        ),
      };
    }

    return {
      label: "Post",
      text: composeCopyText(
        source.postText,
        activeContactText,
        includeSocialTags,
      ),
    };
  };

  const copyDownloadTextIfNeeded = async (
    request: DownloadRequest,
  ): Promise<void> => {
    if (!request.copyContent) return;

    const { label, text: textToCopy } = getConfiguredAutoCopyContent(
      request.copyContent,
    );

    if (!textToCopy) return;

    try {
      await copyText(textToCopy);
      setCopiedKey("download-description");
      Toastify(`Đã tự động copy nội dung ${label}`, 200);

      window.setTimeout(() => {
        setCopiedKey((current) =>
          current === "download-description" ? "" : current,
        );
      }, 1200);
    } catch {
      Toastify(`Không thể tự động copy nội dung ${label}`, 300);
    }
  };

  const executeDownloadRequest = async (): Promise<void> => {
    if (!pendingDownload) return;

    const request = pendingDownload;
    const images = getDownloadImages(request);

    if (images.length === 0) {
      Toastify("Không còn ảnh phù hợp để tải", 300);
      return;
    }

    await copyDownloadTextIfNeeded(request);

    images.forEach((image, index) => {
      window.setTimeout(() => {
        void downloadOriginalImage(image, request.startIndex + index);
      }, index * 180);
    });

    markProductImagesDownloaded(getDownloadedProductIds(request));
    Toastify(`Đang tải ${images.length} ảnh nguyên bản`, 200);
    setPendingDownload(null);
    setSkipInternalDownloadImages(false);
  };

  const executeDownloadToFolder = async (): Promise<void> => {
    if (!pendingDownload) return;

    const request = pendingDownload;
    const images = getDownloadImages(request);

    if (images.length === 0) {
      Toastify("Không còn ảnh phù hợp để tải", 300);
      return;
    }

    try {
      const directoryHandle = await getWritableLocalImageDirectory();

      if (!directoryHandle) return;

      await copyDownloadTextIfNeeded(request);
      await saveImagesToDirectory({ ...request, images }, directoryHandle);
      await applyLocalImageDirectorySnapshot(directoryHandle).catch(() => undefined);
      markProductImagesDownloaded(getDownloadedProductIds(request));
      Toastify(
        `Đã lưu ${images.length} ảnh vào ${directoryHandle.name}`,
        200,
      );
      setPendingDownload(null);
      setSkipInternalDownloadImages(false);
    } catch (error) {
      if (isAbortError(error)) return;

      const message =
        error instanceof Error ? error.message : "Không thể lưu ảnh vào thư mục";
      Toastify(message, 400);
    }
  };

  const handleDownloadProductImages = (product: LocalProduct): void => {
    const totalProductImages =
      product.images.length + product.internalImages.length;

    if (totalProductImages === 0) {
      Toastify("Sản phẩm chưa có ảnh để tải", 300);
      return;
    }

    const postText =
      product.description.trim() || settings.commonDescription.trim();
    const autoCopyLabel =
      settings.autoCopyShareMode === "comment" ? "Cmt" : "Post";

    requestDownload({
      productIds: [product.id],
      title: "Tải ảnh sản phẩm",
      description: `Tải ảnh của sản phẩm này về máy? Nội dung ${autoCopyLabel} đã chọn sẽ được tự động copy trước khi tải.`,
      mode: "multiple",
      images: product.images,
      internalImages: product.internalImages,
      startIndex: 0,
      copyContent: {
        postText,
        commentText: buildCommentContentText(
          product.name,
          postText,
          product.priceText,
          "",
          product.contentType,
          product.realEstateComment,
        ),
      },
    });
  };

  const openImageAlbum = (source: AlbumSource): void => {
    const allImages = [
      ...source.images,
      ...(source.internalImages ?? []),
    ];

    if (allImages.length === 0) {
      Toastify("Chưa có ảnh để xem", 300);
      return;
    }

    const firstImageId = allImages[0]?.id ?? "";

    setAlbumSource(source);
    setSelectedAlbumImageId(firstImageId);
    setSelectedAlbumImageIds(
      firstImageId ? new Set<string>([firstImageId]) : new Set<string>(),
    );
    openModal("imageAlbum");
  };

  const toggleSelectedAlbumImage = (imageId: string): void => {
    setSelectedAlbumImageId(imageId);

    setSelectedAlbumImageIds((current) => {
      const nextIds = new Set(current);

      if (nextIds.has(imageId)) {
        nextIds.delete(imageId);
        return nextIds;
      }

      nextIds.add(imageId);
      return nextIds;
    });
  };

  const copyShareContentOnOpen = (
    shareKey: string,
    title: string,
    description: string,
    priceText: string,
    contentType: ProductContentType,
    realEstateComment: string,
  ): void => {
    const { label, text } = getConfiguredAutoCopyContent({
      postText: description,
      commentText: buildCommentContentText(
        title,
        description,
        priceText,
        "",
        contentType,
        realEstateComment,
      ),
    });

    void handleCopyField(
      shareKey,
      label.toLowerCase(),
      text,
    );
  };

  const handleShareProduct = (product: LocalProduct): void => {
    const descriptionText =
      product.description.trim() || settings.commonDescription.trim();
    const shareKey = `share-product-${product.id}`;

    setShareDialogStep("share");
    setIncludeInternalShareImages(true);
    setFacebookGroupActiveIndex(0);
    setPendingShare({
      productId: product.id,
      title: product.name,
      images: product.images,
      internalImages: product.internalImages,
      postText: descriptionText,
      commentText: buildCommentContentText(
        product.name,
        descriptionText,
        product.priceText,
        "",
        product.contentType,
        product.realEstateComment,
      ),
      shareKey,
      successMessage: "Đã mở bảng chia sẻ sản phẩm",
    });

    copyShareContentOnOpen(
      shareKey,
      product.name,
      descriptionText,
      product.priceText,
      product.contentType,
      product.realEstateComment,
    );
  };

  const handleShareSelectedAlbumImages = (): void => {
    if (!albumSource) {
      Toastify("Chưa có album để chia sẻ", 300);
      return;
    }

    const selectedImages = albumSource.images.filter((image) =>
      selectedAlbumImageIds.has(image.id),
    );
    const selectedInternalImages = (albumSource.internalImages ?? []).filter(
      (image) => selectedAlbumImageIds.has(image.id),
    );

    if (selectedImages.length + selectedInternalImages.length === 0) {
      Toastify("Chưa chọn ảnh để chia sẻ", 300);
      return;
    }

    const shareKey = `album-share-selected-${albumSource.productId}`;

    setShareDialogStep("share");
    setIncludeInternalShareImages(true);
    setFacebookGroupActiveIndex(0);
    setPendingShare({
      productId: albumSource.productId,
      title: albumSource.title,
      images: selectedImages,
      internalImages: selectedInternalImages,
      postText: albumSource.description,
      commentText: buildCommentContentText(
        albumSource.title,
        albumSource.description,
        albumSource.priceText,
        "",
        albumSource.contentType,
        albumSource.realEstateComment,
      ),
      shareKey,
      successMessage: "Đã mở bảng chia sẻ ảnh",
    });

    copyShareContentOnOpen(
      shareKey,
      albumSource.title,
      albumSource.description,
      albumSource.priceText,
      albumSource.contentType,
      albumSource.realEstateComment,
    );
  };

  const getShareRequestText = (
    request: ShareRequest,
    mode: Exclude<ShareContentMode, "imagesOnly">,
  ): string => {
    return mode === "post"
      ? composeCopyText(
        request.postText,
        activeContactText,
        includeSocialTags,
      )
      : composeCopyText(
        request.commentText,
        activeContactText,
        false,
      );
  };

  const queueMetaComposerImageDownloads = (images: ProductImage[]): void => {
    const interactionWindow = getActiveInteractionWindow();

    images.forEach((image, index) => {
      interactionWindow.setTimeout(() => {
        void downloadOriginalImage(image, index).catch(() => undefined);
      }, index * 180);
    });
  };

  const prepareMetaImageDownload = (
    request: ShareRequest,
    shouldDownload: boolean,
  ): string => {
    if (!shouldDownload) return "không tải lại ảnh";
    if (request.images.length === 0) return "không có ảnh chính để tải";

    queueMetaComposerImageDownloads(request.images);
    markProductImagesDownloaded([request.productId]);

    return `đang tải ${request.images.length} ảnh chính`;
  };

  const requestMetaImageDownloadDecision = (
    request: ShareRequest,
    onDecision: (shouldDownload: boolean) => void | Promise<void>,
  ): void => {
    const storedDownloadedProductIds = loadDownloadedProductIds();
    const wasDownloaded =
      downloadedProductIds.has(request.productId) ||
      storedDownloadedProductIds.has(request.productId);

    if (!wasDownloaded) {
      void onDecision(true);
      return;
    }

    requestConfirm({
      title: "Ảnh đã được đánh dấu tải về",
      description: `${request.title} đã tải ảnh chính trong phiên này. Có thể tiếp tục mà không tải hoặc tải lại ảnh.`,
      cancelLabel: "Hủy",
      confirmLabel: "Đồng ý, không tải lại",
      secondaryLabel: "Vẫn tải lại ảnh",
      tone: "warning",
      onConfirm: () => onDecision(false),
      onSecondary: () => onDecision(true),
    });
  };

  const executeOpenMetaBusinessComposer = async (
    openerWindow: Window,
    request: ShareRequest,
    page: FacebookPageOption,
    mode: Exclude<ShareContentMode, "imagesOnly">,
    shouldDownload: boolean,
  ): Promise<void> => {
    const composerUrl = createMetaBusinessComposerUrl(page.assetId);

    if (!composerUrl) {
      Toastify("Asset ID của Fanpage không hợp lệ", 400);
      return;
    }

    const composerOpenResult = openFacebookPopupWindow(
      openerWindow,
      composerUrl,
      `composer-${page.id}`,
    );
    const composerWindow = composerOpenResult.window;

    if (composerOpenResult.usedPopupFallback && composerWindow) {
      Toastify(
        "Cửa sổ Meta Business bị chặn, đã tự động chuyển sang tab mới.",
        300,
      );
    }

    const textValue = getShareRequestText(request, mode);
    const copyPromise = textValue
      ? copyText(textValue).then(
        () => true,
        () => false,
      )
      : Promise.resolve(false);

    setIsShareExecuting(true);
    const imageDownloadLabel = prepareMetaImageDownload(
      request,
      shouldDownload,
    );

    if (!composerWindow) {
      const copiedToClipboard = await copyPromise;

      Toastify(
        copiedToClipboard
          ? `Đã copy nội dung, ${imageDownloadLabel}; không thể mở Meta Business bằng cửa sổ mới hoặc tab mới`
          : `${imageDownloadLabel}; không thể mở Meta Business bằng cửa sổ mới hoặc tab mới`,
        copiedToClipboard ? 300 : 400,
      );
      setIsShareExecuting(false);
      return;
    }

    const copiedToClipboard = await copyPromise;
    const contentLabel = mode === "post" ? "Post" : "Cmt";

    if (copiedToClipboard) {
      setCopiedKey(request.shareKey);
      Toastify(
        `Đã copy ${contentLabel}, ${imageDownloadLabel} và mở ${page.name}`,
        200,
      );
    } else {
      Toastify(
        `${imageDownloadLabel} và đã mở ${page.name}, nhưng không thể tự động copy nội dung`,
        300,
      );
    }

    setPendingShare(null);
    setIncludeInternalShareImages(true);
    setShareDialogStep("share");
    setIsShareExecuting(false);
  };

  const handleOpenMetaBusinessComposer = (
    openerWindow: Window,
    page: FacebookPageOption,
    mode: Exclude<ShareContentMode, "imagesOnly">,
  ): void => {
    if (!pendingShare || isShareExecuting) return;

    const request = pendingShare;

    requestMetaImageDownloadDecision(request, (shouldDownload) =>
      executeOpenMetaBusinessComposer(
        openerWindow,
        request,
        page,
        mode,
        shouldDownload,
      ),
    );
  };

  const executeOpenFacebookGroup = async (
    openerWindow: Window,
    request: ShareRequest,
    group: FacebookGroupOption,
    groupIndex: number,
    mode: Exclude<ShareContentMode, "imagesOnly">,
    shouldDownload: boolean,
  ): Promise<void> => {
    const groupOpenResult = openFacebookPopupWindow(
      openerWindow,
      group.url,
      `group-${group.id}`,
    );
    const groupWindow = groupOpenResult.window;

    if (groupOpenResult.usedPopupFallback && groupWindow) {
      Toastify(
        "Cửa sổ Group bị chặn, đã tự động chuyển sang tab mới.",
        300,
      );
    }
    const textValue = getShareRequestText(request, mode);
    const copyPromise = textValue
      ? copyText(textValue).then(
        () => true,
        () => false,
      )
      : Promise.resolve(false);

    setIsShareExecuting(true);
    const imageDownloadLabel = prepareMetaImageDownload(
      request,
      shouldDownload,
    );

    if (!groupWindow) {
      const copiedToClipboard = await copyPromise;

      Toastify(
        copiedToClipboard
          ? `Đã copy nội dung, ${imageDownloadLabel}; không thể mở Group bằng cửa sổ mới hoặc tab mới`
          : `${imageDownloadLabel}; không thể mở Group bằng cửa sổ mới hoặc tab mới`,
        copiedToClipboard ? 300 : 400,
      );
      setIsShareExecuting(false);
      return;
    }

    const copiedToClipboard = await copyPromise;
    const contentLabel = mode === "post" ? "Post" : "Cmt";
    const groupLabel = group.name.trim() || `Group ${groupIndex + 1}`;

    if (copiedToClipboard) {
      setCopiedKey(request.shareKey);
      Toastify(
        `Đã copy ${contentLabel}, ${imageDownloadLabel} và mở ${groupLabel}`,
        200,
      );
    } else {
      Toastify(
        `${imageDownloadLabel} và đã mở ${groupLabel}, nhưng không thể tự động copy nội dung`,
        300,
      );
    }

    setIsShareExecuting(false);
  };

  const handleOpenFacebookGroup = (
    openerWindow: Window,
    groupIndex: number,
    mode: Exclude<ShareContentMode, "imagesOnly">,
  ): void => {
    if (!pendingShare || isShareExecuting) return;

    const group = selectedFacebookGroups[groupIndex];

    if (!group) {
      Toastify("Chưa chọn Group Facebook", 300);
      return;
    }

    const request = pendingShare;

    setFacebookGroupActiveIndex(groupIndex);
    requestMetaImageDownloadDecision(request, (shouldDownload) =>
      executeOpenFacebookGroup(
        openerWindow,
        request,
        group,
        groupIndex,
        mode,
        shouldDownload,
      ),
    );
  };

  const getShareRequestImages = (request: ShareRequest): ProductImage[] => {
    return includeInternalShareImages
      ? [...request.images, ...(request.internalImages ?? [])]
      : request.images;
  };

  const handleShareFacebookGroupImages = async (
    groupIndex: number,
    mode: Exclude<ShareContentMode, "imagesOnly">,
  ): Promise<void> => {
    if (!pendingShare || isShareExecuting) return;

    if (selectedFacebookGroups.length === 0) {
      Toastify("Chưa chọn Group Facebook", 300);
      return;
    }

    const group = selectedFacebookGroups[groupIndex];

    if (!group) return;

    setFacebookGroupActiveIndex(groupIndex);

    const request = pendingShare;
    const shareImages = getShareRequestImages(request);
    const textValue = getShareRequestText(request, mode);
    const contentLabel = mode === "post" ? "Post" : "Cmt";
    const groupLabel = group.name.trim() || `Group ${groupIndex + 1}`;
    const shareNavigator = getNativeShareNavigator();
    let copiedToClipboard = false;

    if (shareImages.length === 0) {
      Toastify("Chưa có ảnh để chia sẻ", 300);
      return;
    }

    const markCopied = (): void => {
      setCopiedKey(request.shareKey);
      getActiveInteractionWindow().setTimeout(() => {
        setCopiedKey((current) =>
          current === request.shareKey ? "" : current,
        );
      }, 1200);
    };

    const downloadShareImages = (): void => {
      const interactionWindow = getActiveInteractionWindow();

      shareImages.forEach((image, index) => {
        interactionWindow.setTimeout(() => {
          void downloadOriginalImage(image, index);
        }, index * 180);
      });
    };

    setIsShareExecuting(true);

    try {
      if (textValue) {
        try {
          await copyText(textValue);
          copiedToClipboard = true;
          markCopied();
        } catch {
          copiedToClipboard = false;
        }
      }

      const files = await Promise.all(
        shareImages.map((image, index) =>
          dataUrlToShareFile(
            image.dataUrl,
            image.name || createSystemImageFilename(index, image.id),
          ),
        ),
      );
      const shareData: NativeShareData = {
        title: request.title,
        text: textValue,
        files,
      };
      const canShareWithFiles =
        Boolean(shareNavigator?.share) &&
        (shareNavigator?.canShare?.(shareData) ?? true);

      if (canShareWithFiles && shareNavigator?.share) {
        await shareNavigator.share(shareData);
        Toastify(
          copiedToClipboard
            ? `Đã copy ${contentLabel} và mở chia sẻ ảnh cho ${groupLabel}`
            : `Đã mở chia sẻ ảnh cho ${groupLabel}`,
          copiedToClipboard ? 200 : 300,
        );
        return;
      }

      downloadShareImages();
      Toastify(
        copiedToClipboard
          ? `Đã copy ${contentLabel} và tải ${shareImages.length} ảnh; tiếp tục mở popup ${groupLabel}`
          : `Đang tải ${shareImages.length} ảnh; tiếp tục mở popup ${groupLabel}`,
        copiedToClipboard ? 300 : 400,
      );
    } catch (error: unknown) {
      if (isAbortError(error)) {
        if (copiedToClipboard) {
          Toastify(`Đã copy ${contentLabel}`, 200);
        }
        return;
      }

      downloadShareImages();
      Toastify(
        copiedToClipboard
          ? `Không thể mở Share Sheet; đã copy ${contentLabel} và tải ảnh`
          : "Không thể mở Share Sheet; ảnh đang được tải xuống",
        copiedToClipboard ? 300 : 400,
      );
    } finally {
      setIsShareExecuting(false);
    }
  };

  const executeShareRequest = async (
    mode: ShareContentMode,
    shareImagesOnly = mode === "imagesOnly",
  ): Promise<void> => {
    if (!pendingShare || isShareExecuting) return;

    const request = pendingShare;
    const shareImages = getShareRequestImages(request);
    const textValue =
      mode === "imagesOnly" ? "" : getShareRequestText(request, mode);
    const contentLabel = mode === "post" ? "Post" : "Cmt";
    const shouldCopyText = mode !== "imagesOnly";
    const shareNavigator = getNativeShareNavigator();
    let copiedToClipboard = false;

    const markShared = (): void => {
      setCopiedKey(request.shareKey);

      getActiveInteractionWindow().setTimeout(() => {
        setCopiedKey((current) =>
          current === request.shareKey ? "" : current,
        );
      }, 1200);
    };

    setIsShareExecuting(true);

    try {
      if (shouldCopyText && textValue) {
        try {
          await copyText(textValue);
          copiedToClipboard = true;
        } catch {
          copiedToClipboard = false;
        }
      }

      const files = await Promise.all(
        shareImages.map((image, index) =>
          dataUrlToShareFile(
            image.dataUrl,
            image.name || createSystemImageFilename(index, image.id),
          ),
        ),
      );

      if (shareImagesOnly && files.length === 0) {
        Toastify("Chưa có ảnh để chia sẻ", 300);
        return;
      }

      if (shareNavigator?.share) {
        const shareData: NativeShareData =
          shareImagesOnly
            ? { files }
            : { title: request.title, text: textValue, files };
        const canShareWithFiles =
          files.length > 0 &&
          (shareNavigator.canShare?.(shareData) ?? true);

        if (canShareWithFiles) {
          await shareNavigator.share(shareData);
          markShared();
          Toastify(
            shouldCopyText
              ? copiedToClipboard
                ? shareImagesOnly
                  ? `Đã copy ${contentLabel} và mở chia sẻ chỉ hình ảnh`
                  : `Đã copy ${contentLabel} và mở bảng chia sẻ`
                : "Đã mở bảng chia sẻ nhưng không thể tự động copy nội dung"
              : request.successMessage,
            shouldCopyText && !copiedToClipboard ? 300 : 200,
          );
          return;
        }

        if (shareImagesOnly) {
          Toastify(
            copiedToClipboard
              ? `Đã copy ${contentLabel} nhưng thiết bị chưa hỗ trợ chia sẻ ảnh đã chọn`
              : "Thiết bị chưa hỗ trợ chia sẻ ảnh đã chọn",
            copiedToClipboard ? 300 : 400,
          );
          return;
        }

        await shareNavigator.share({
          title: request.title,
          text: textValue,
        });
        markShared();
        Toastify(
          copiedToClipboard
            ? files.length > 0
              ? `Đã copy ${contentLabel}; thiết bị chỉ mở chia sẻ nội dung`
              : `Đã copy ${contentLabel} và mở bảng chia sẻ`
            : files.length > 0
              ? "Thiết bị chỉ mở chia sẻ nội dung và không thể tự động copy"
              : "Đã mở bảng chia sẻ nhưng không thể tự động copy nội dung",
          copiedToClipboard ? 200 : 300,
        );
        return;
      }

      if (shareImagesOnly) {
        Toastify(
          copiedToClipboard
            ? `Đã copy ${contentLabel} nhưng trình duyệt chưa hỗ trợ chia sẻ chỉ hình ảnh`
            : "Trình duyệt chưa hỗ trợ chia sẻ chỉ hình ảnh",
          copiedToClipboard ? 300 : 400,
        );
        return;
      }

      if (copiedToClipboard) {
        markShared();
        Toastify(
          `Trình duyệt chưa hỗ trợ chia sẻ, đã copy ${contentLabel}`,
          200,
        );
        return;
      }

      Toastify("Trình duyệt chưa hỗ trợ chia sẻ hoặc clipboard", 400);
    } catch (error) {
      if (isAbortError(error)) {
        if (copiedToClipboard) {
          markShared();
          Toastify(`Đã copy ${contentLabel}`, 200);
        }
        return;
      }

      if (shareImagesOnly) {
        Toastify(
          copiedToClipboard
            ? `Đã copy ${contentLabel} nhưng không thể chia sẻ ảnh đã chọn`
            : "Không thể chia sẻ ảnh đã chọn",
          copiedToClipboard ? 300 : 400,
        );
        return;
      }

      if (copiedToClipboard) {
        markShared();
        Toastify(`Không thể mở chia sẻ, đã copy ${contentLabel}`, 300);
        return;
      }

      Toastify("Không thể chia sẻ hoặc copy nội dung", 400);
    } finally {
      setPendingShare(null);
      setIncludeInternalShareImages(true);
      setShareDialogStep("share");
      setFacebookGroupActiveIndex(0);
      setIsShareExecuting(false);
    }
  };

  const handleDownloadSelectedAlbumImages = (): void => {
    if (!albumSource) {
      Toastify("Chưa có album để tải", 300);
      return;
    }

    const selectedImages = albumSource.images.filter((image) =>
      selectedAlbumImageIds.has(image.id),
    );
    const selectedInternalImages = (albumSource.internalImages ?? []).filter(
      (image) => selectedAlbumImageIds.has(image.id),
    );
    const selectedImageCount =
      selectedImages.length + selectedInternalImages.length;

    if (selectedImageCount === 0) {
      Toastify("Chưa chọn ảnh để tải", 300);
      return;
    }

    requestDownload({
      productIds: [albumSource.productId],
      title: "Tải ảnh đã chọn",
      description: `Tải ${selectedImageCount} ảnh đã chọn về máy? Nội dung ${settings.autoCopyShareMode === "comment" ? "Cmt" : "Post"} đã chọn sẽ được tự động copy trước khi tải.`,
      mode: selectedImageCount === 1 ? "single" : "multiple",
      images: selectedImages,
      internalImages: selectedInternalImages,
      startIndex: 0,
      copyContent: {
        postText: albumSource.description,
        commentText: buildCommentContentText(
          albumSource.title,
          albumSource.description,
          albumSource.priceText,
          "",
          albumSource.contentType,
          albumSource.realEstateComment,
        ),
      },
    });
  };

  const handleSelectAllAlbumImages = (): void => {
    if (!albumSource) return;

    setSelectedAlbumImageIds(
      new Set<string>(albumImages.map((image) => image.id)),
    );
  };

  const handleClearSelectedAlbumImages = (): void => {
    setSelectedAlbumImageIds(new Set<string>());
  };

  const handleDownloadAlbumImages = (): void => {
    const internalImages = albumSource?.internalImages ?? [];
    const totalAlbumImages =
      (albumSource?.images.length ?? 0) + internalImages.length;

    if (!albumSource || totalAlbumImages === 0) {
      Toastify("Album chưa có ảnh để tải", 300);
      return;
    }

    requestDownload({
      productIds: [albumSource.productId],
      title: "Tải toàn bộ album",
      description: `Tải toàn bộ ảnh trong album về máy? Nội dung ${settings.autoCopyShareMode === "comment" ? "Cmt" : "Post"} đã chọn sẽ được tự động copy trước khi tải.`,
      mode: totalAlbumImages === 1 ? "single" : "multiple",
      images: albumSource.images,
      internalImages,
      startIndex: 0,
      copyContent: {
        postText: albumSource.description,
        commentText: buildCommentContentText(
          albumSource.title,
          albumSource.description,
          albumSource.priceText,
          "",
          albumSource.contentType,
          albumSource.realEstateComment,
        ),
      },
    });
  };

  const handleDownloadRepresentativeImages = (): void => {
    const representativeImages = representativeImageProducts
      .map((product) => product.images[0])
      .filter((image): image is ProductImage => Boolean(image));

    if (representativeImages.length === 0) {
      Toastify("Danh mục đã chọn chưa có ảnh đại diện để tải", 300);
      return;
    }

    const categoryLabel =
      imageDownloadCategory === "all"
        ? "tất cả danh mục"
        : `danh mục ${imageDownloadCategory}`;

    requestDownload({
      productIds: representativeImageProducts.map((product) => product.id),
      title: "Tải ảnh đại diện",
      description: `Tải ${representativeImages.length} ảnh đại diện, là ảnh đầu tiên có index 0 của mỗi sản phẩm thuộc ${categoryLabel}, về máy?`,
      mode: representativeImages.length === 1 ? "single" : "multiple",
      images: representativeImages,
      startIndex: 0,
    });
  };

  const handleDownloadAllImages = (): void => {
    const allMainImages = downloadableProducts.flatMap(
      (product) => product.images,
    );
    const allInternalImages = downloadableProducts.flatMap(
      (product) => product.internalImages,
    );
    const totalDownloadImages =
      allMainImages.length + allInternalImages.length;

    if (totalDownloadImages === 0) {
      Toastify("Chưa có ảnh của sản phẩm chưa DONE để tải", 300);
      return;
    }

    const activeDescriptions = downloadableProducts
      .map((product) => {
        const description =
          product.description.trim() || settings.commonDescription.trim();

        return [product.name, description].filter(Boolean).join("\n");
      })
      .filter(Boolean)
      .join("\n\n---\n\n");
    const activeComments = downloadableProducts
      .map((product) => {
        const description =
          product.description.trim() || settings.commonDescription.trim();

        return buildCommentContentText(
          product.name,
          description,
          product.priceText,
          "",
          product.contentType,
          product.realEstateComment,
        );
      })
      .filter(Boolean)
      .join("\n\n---\n\n");

    requestDownload({
      productIds: downloadableProducts
        .filter(
          (product) =>
            product.images.length + product.internalImages.length > 0,
        )
        .map((product) => product.id),
      productIdsWhenSkippingInternal: downloadableProducts
        .filter((product) => product.images.length > 0)
        .map((product) => product.id),
      title: "Tải toàn bộ ảnh",
      description: `Tải ảnh của tất cả sản phẩm chưa DONE về máy? Toàn bộ nội dung ${settings.autoCopyShareMode === "comment" ? "Cmt" : "Post"} của các sản phẩm này sẽ được tự động copy trước khi tải.`,
      mode: "multiple",
      images: allMainImages,
      internalImages: allInternalImages,
      startIndex: 0,
      copyContent: {
        postText: activeDescriptions,
        commentText: activeComments,
      },
    });
  };

  const toggleScheduleCategory = (category: string): void => {
    setScheduleConfig((current) => {
      const categoryKey = normalizeTextKey(category);
      const exists = current.selectedCategories.some(
        (item) => normalizeTextKey(item) === categoryKey,
      );

      return {
        ...current,
        selectedCategories: exists
          ? current.selectedCategories.filter(
            (item) => normalizeTextKey(item) !== categoryKey,
          )
          : [...current.selectedCategories, normalizeCategoryName(category)],
      };
    });
  };

  const getAssignedProduct = (
    date: string,
    time: string,
    slotIndex: number,
    taskIndex: number,
  ): LocalProduct | undefined => {
    const assignmentKey = createScheduleAssignmentKey(
      date,
      slotIndex,
      taskIndex,
    );
    const legacyAssignmentKey = createLegacyScheduleAssignmentKey(
      date,
      time,
      taskIndex,
    );

    const productId =
      scheduleAssignments[assignmentKey] ??
      scheduleAssignments[legacyAssignmentKey];

    return products.find(
      (product) => product.id === productId && !product.isDone,
    );
  };

  const assignProductToSchedule = (
    date: string,
    time: string,
    slotIndex: number,
    taskIndex: number,
    productId: string,
  ): void => {
    const assignmentKey = createScheduleAssignmentKey(
      date,
      slotIndex,
      taskIndex,
    );
    const legacyAssignmentKey = createLegacyScheduleAssignmentKey(
      date,
      time,
      taskIndex,
    );
    const postedKey = createPostedKey(date, slotIndex, taskIndex);

    if (productId) {
      const selectedProduct = products.find(
        (product) => product.id === productId,
      );

      if (!selectedProduct) {
        Toastify("Không tìm thấy sản phẩm để xếp lịch", 400);
        return;
      }

      if (selectedProduct.isDone) {
        Toastify("Sản phẩm đã DONE nên không thể đưa vào lịch", 300);
        return;
      }
    }

    const currentProductId =
      scheduleAssignments[assignmentKey] ??
      scheduleAssignments[legacyAssignmentKey] ??
      "";

    if (currentProductId !== productId) {
      setPostedRecords((current) => {
        const nextRecords = current.filter(
          (record) => record.slotId !== postedKey,
        );

        if (nextRecords.length !== current.length) {
          savePostedRecords(nextRecords);
        }

        return nextRecords;
      });
    }

    setScheduleAssignments((current) => {
      const nextAssignments: ScheduleAssignmentMap = { ...current };

      delete nextAssignments[legacyAssignmentKey];

      if (!productId) {
        delete nextAssignments[assignmentKey];
        return nextAssignments;
      }

      const duplicatedInSameTask = Object.entries(nextAssignments).some(
        ([key, value]) => {
          if (key === assignmentKey) return false;
          if (value !== productId) return false;

          return key.startsWith(`${date}::task${taskIndex + 1}::`);
        },
      );

      if (duplicatedInSameTask) {
        Toastify("Sản phẩm này đã có trong task này hôm nay", 300);
        return current;
      }

      const duplicatedInSameTime = Object.entries(nextAssignments).some(
        ([key, value]) => {
          if (key === assignmentKey) return false;
          if (value !== productId) return false;

          return (
            key.match(
              new RegExp(`^${date}::task\\d+::slot${slotIndex + 1}$`),
            ) !== null
          );
        },
      );

      if (duplicatedInSameTime) {
        Toastify("Sản phẩm này đã có ở task khác trong cùng khung giờ", 300);
        return current;
      }

      nextAssignments[assignmentKey] = productId;
      setSelectedProductId(productId);

      return nextAssignments;
    });
  };

  const handleScheduleDrop = (
    event: DragEvent<HTMLElement>,
    date: string,
    time: string,
    slotIndex: number,
    taskIndex: number,
  ): void => {
    event.preventDefault();

    const productId =
      event.dataTransfer.getData("text/plain") || draggingProductId;
    const sourceAssignmentKey = event.dataTransfer.getData(
      "application/x-schedule-assignment-key",
    );
    const targetAssignmentKey = createScheduleAssignmentKey(
      date,
      slotIndex,
      taskIndex,
    );

    if (!productId) return;

    if (sourceAssignmentKey) {
      moveScheduleAssignment(
        sourceAssignmentKey,
        targetAssignmentKey,
        productId,
      );
      setDraggingProductId("");
      return;
    }

    assignProductToSchedule(date, time, slotIndex, taskIndex, productId);
    setDraggingProductId("");
  };

  const addScheduleTask = (): void => {
    setScheduleConfig((current) => {
      const nextTaskCount = Math.min(64, current.taskCount + 1);

      return {
        ...current,
        taskCount: nextTaskCount,
        taskNames: Array.from(
          { length: nextTaskCount },
          (_, index) => current.taskNames[index] || `Task ${index + 1}`,
        ),
      };
    });
  };

  const requestRemoveScheduleTask = (taskIndex: number): void => {
    if (scheduleConfig.taskCount <= 1) {
      Toastify("Cần giữ lại ít nhất một task", 300);
      return;
    }

    setPendingRemoveTaskIndex(taskIndex);
  };

  const removeScheduleTask = (taskIndexToRemove: number): void => {
    setScheduleConfig((current) => {
      const nextTaskCount = Math.max(1, current.taskCount - 1);
      const nextTaskNames = current.taskNames.filter(
        (_, index) => index !== taskIndexToRemove,
      );

      setScheduleAssignments((assignments) => {
        const nextAssignments: ScheduleAssignmentMap = {};

        Object.entries(assignments).forEach(([key, value]) => {
          const match = key.match(/::task(\d+)::/);
          const taskNumber = match ? Number(match[1]) : 0;
          const taskIndex = taskNumber - 1;

          if (taskIndex === taskIndexToRemove) return;

          if (taskIndex > taskIndexToRemove) {
            const shiftedKey = key.replace(
              `::task${taskNumber}::`,
              `::task${taskNumber - 1}::`,
            );
            nextAssignments[shiftedKey] = value as string;
            return;
          }

          nextAssignments[key] = value as string;
        });

        return nextAssignments;
      });

      return {
        ...current,
        taskCount: nextTaskCount,
        taskNames: Array.from(
          { length: nextTaskCount },
          (_, index) => nextTaskNames[index] || `Task ${index + 1}`,
        ),
      };
    });

    setActiveScheduleTaskIndex((current) =>
      Math.min(current, Math.max(0, scheduleConfig.taskCount - 2)),
    );
    setPendingRemoveTaskIndex(null);
    Toastify("Đã xoá đúng task đã chọn", 200);
  };

  const updateScheduleTaskName = (taskIndex: number, value: string): void => {
    setScheduleConfig((current) => {
      const taskNames = Array.from(
        { length: Math.max(1, current.taskCount) },
        (_, index) => current.taskNames[index] || `Task ${index + 1}`,
      );

      taskNames[taskIndex] = value;

      return {
        ...current,
        taskNames,
      };
    });
  };

  const duplicateFirstScheduleTask = (): void => {
    if (scheduleConfig.taskCount <= 1) {
      Toastify("Cần ít nhất hai task lịch để nhân bản", 300);
      return;
    }

    Toastify(
      "Không nên nhân bản task vì dễ trùng sản phẩm cùng khung giờ. Hãy dùng Tự rải lịch.",
      300,
    );
  };

  const autoFillScheduleAssignments = (): void => {
    const targetDate = today;
    const targetPrefix = `${targetDate}::task`;
    const slotCount = scheduleTimes.length;

    if (slotCount === 0) {
      Toastify("Khung giờ chưa hợp lệ để tự rải lịch", 400);
      return;
    }

    const availableProducts = scheduleProducts.filter(
      (product) => !product.isDone,
    );

    if (availableProducts.length === 0) {
      Toastify("Không có sản phẩm khả dụng để tự rải lịch", 400);
      return;
    }

    const orderedProducts = createCategoryBalancedProducts(availableProducts);
    const requiredTaskCount = Math.max(
      1,
      Math.ceil(orderedProducts.length / slotCount),
    );
    const nextTaskNames = Array.from(
      { length: requiredTaskCount },
      (_, index) => scheduleConfig.taskNames[index] || `Task ${index + 1}`,
    );
    const nextAssignments: ScheduleAssignmentMap = {};

    Object.entries(scheduleAssignments).forEach(([key, value]) => {
      if (!key.startsWith(targetPrefix)) {
        nextAssignments[key] = value as string;
      }
    });

    let productIndex = 0;

    for (let taskIndex = 0; taskIndex < requiredTaskCount; taskIndex += 1) {
      const usedProductIdsInTask = new Set<string>();

      for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
        const product = orderedProducts[productIndex];

        if (!product) break;

        if (usedProductIdsInTask.has(product.id)) {
          continue;
        }

        const assignmentKey = createScheduleAssignmentKey(
          targetDate,
          slotIndex,
          taskIndex,
        );
        nextAssignments[assignmentKey] = product.id;
        usedProductIdsInTask.add(product.id);
        productIndex += 1;
      }
    }

    const nextConfig: ScheduleConfig = {
      ...scheduleConfig,
      dateFrom: targetDate,
      dateTo: targetDate,
      taskCount: requiredTaskCount,
      taskNames: nextTaskNames,
    };

    const nextRecords = postedRecords.filter(
      (record) => !record.slotId.startsWith(targetPrefix),
    );

    setScheduleConfig(nextConfig);
    saveScheduleConfig(nextConfig);
    setActiveScheduleTaskIndex(0);
    setScheduleAssignments(nextAssignments);
    saveScheduleAssignments(nextAssignments);
    setPostedRecords(nextRecords);
    savePostedRecords(nextRecords);

    Toastify(
      `Đã rải đúng ${productIndex}/${orderedProducts.length} sản phẩm vào ${requiredTaskCount} task`,
      productIndex === orderedProducts.length ? 200 : 300,
    );
  };

  const resetActiveScheduleTaskAssignments = (): void => {
    const taskPrefix = `${today}::task${activeScheduleTaskIndex + 1}::`;

    setScheduleAssignments((current) => {
      const nextAssignments: ScheduleAssignmentMap = {};

      Object.entries(current).forEach(([key, value]) => {
        if (!key.startsWith(taskPrefix)) {
          nextAssignments[key] = value as string;
        }
      });

      return nextAssignments;
    });

    setPostedRecords((current) => {
      const nextRecords = current.filter(
        (record) => !record.slotId.startsWith(taskPrefix),
      );

      if (nextRecords.length !== current.length) {
        savePostedRecords(nextRecords);
      }

      return nextRecords;
    });

    Toastify(
      `Đã xóa sản phẩm khỏi ${getTaskName(scheduleConfig, activeScheduleTaskIndex)}`,
      200,
    );
  };

  const resetAllScheduleAssignments = (): void => {
    const todayPrefix = `${today}::`;

    setScheduleAssignments((current) => {
      const nextAssignments: ScheduleAssignmentMap = {};

      Object.entries(current).forEach(([key, value]) => {
        if (!key.startsWith(todayPrefix)) {
          nextAssignments[key] = value as string;
        }
      });

      return nextAssignments;
    });

    setPostedRecords((current) => {
      const nextRecords = current.filter(
        (record) => !record.slotId.startsWith(todayPrefix),
      );

      if (nextRecords.length !== current.length) {
        savePostedRecords(nextRecords);
      }

      return nextRecords;
    });

    Toastify("Đã xóa toàn bộ sản phẩm khỏi lịch hôm nay", 200);
  };

  const getTodayProductScheduleLabels = (productId: string): string[] => {
    return Object.entries(scheduleAssignments)
      .filter(
        ([key, value]) =>
          key.startsWith(`${today}::task`) && value === productId,
      )
      .map(([key]) => {
        const match = key.match(/^\d{4}-\d{2}-\d{2}::task(\d+)::slot(\d+)$/);

        if (!match) return "Đã xếp";

        const taskIndex = Number(match[1]) - 1;
        const slotIndex = Number(match[2]) - 1;
        const taskName = getTaskName(scheduleConfig, taskIndex);
        const time = scheduleTimes[slotIndex] ?? `Bài ${slotIndex + 1}`;

        return `${taskName} · ${time}`;
      });
  };

  const swapPostedRecordKeys = (sourceKey: string, targetKey: string): void => {
    setPostedRecords((current) => {
      const sourceRecord = current.find(
        (record) => record.slotId === sourceKey,
      );
      const targetRecord = current.find(
        (record) => record.slotId === targetKey,
      );
      const nextRecords = current.filter(
        (record) => record.slotId !== sourceKey && record.slotId !== targetKey,
      );

      if (sourceRecord) {
        nextRecords.push({
          ...sourceRecord,
          slotId: targetKey,
        });
      }

      if (targetRecord) {
        nextRecords.push({
          ...targetRecord,
          slotId: sourceKey,
        });
      }

      savePostedRecords(nextRecords);

      return nextRecords;
    });
  };

  const moveScheduleAssignment = (
    sourceKey: string,
    targetKey: string,
    productId: string,
  ): void => {
    if (!sourceKey || sourceKey === targetKey) return;

    setScheduleAssignments((current) => {
      const sourceProductId = current[sourceKey] ?? productId;
      const targetProductId = current[targetKey];

      if (!sourceProductId) return current;

      const nextAssignments: ScheduleAssignmentMap = { ...current };

      nextAssignments[targetKey] = sourceProductId;

      if (targetProductId) {
        nextAssignments[sourceKey] = targetProductId;
      } else {
        delete nextAssignments[sourceKey];
      }

      return nextAssignments;
    });

    swapPostedRecordKeys(sourceKey, targetKey);
    setSelectedProductId(productId);
    Toastify("Đã đổi vị trí bài trong task", 200);
  };

  const toggleExpandedProduct = (productId: string): void => {
    setExpandedProductIds((current) => {
      const next = new Set(current);

      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }

      return next;
    });
  };

  const togglePostedProduct = (
    date: string,
    slotIndex: number,
    taskIndex = 0,
  ): void => {
    const postedKey = createPostedKey(date, slotIndex, taskIndex);

    setPostedRecords((current) => {
      const exists = current.some((record) => record.slotId === postedKey);

      const nextRecords = exists
        ? current.filter((record) => record.slotId !== postedKey)
        : [
          ...current,
          {
            slotId: postedKey,
            postedAt: new Date().toISOString(),
          },
        ];

      savePostedRecords(nextRecords);
      Toastify(exists ? "Đã chuyển về chưa đăng" : "Đã đánh dấu DONE", 200);

      return nextRecords;
    });
  };

  const togglePostedSlot = (
    date: string,
    slotIndex: number,
    taskIndex = 0,
  ): void => {
    togglePostedProduct(date, slotIndex, taskIndex);
  };

  const openAssignedSlotModal = (
    date: string,
    slotIndex: number,
    taskIndex: number,
  ): void => {
    setSelectedSlotId(createScheduleAssignmentKey(date, slotIndex, taskIndex));
    openModal("slotDetail");
  };

  const selectedAssignedSlot = useMemo(() => {
    const match = selectedSlotId.match(
      /^(\d{4}-\d{2}-\d{2})::task(\d+)::slot(\d+)$/,
    );

    if (!match) return null;

    const [, date, taskNumberText, slotNumberText] = match;

    if (!date || !taskNumberText || !slotNumberText) return null;

    const taskIndex = Number(taskNumberText) - 1;
    const slotIndex = Number(slotNumberText) - 1;
    const time = scheduleTimes[slotIndex] ?? "";
    const product = getAssignedProduct(date, time, slotIndex, taskIndex);

    if (!product) return null;

    const description =
      product.description.trim() || settings.commonDescription.trim();

    return {
      key: selectedSlotId,
      date,
      time,
      slotIndex,
      taskIndex,
      taskName: getTaskName(scheduleConfig, taskIndex),
      product,
      description,
      postText: buildPostText(
        product,
        settings.commonDescription,
        activeContactText,
        includeSocialTags,
      ),
      done: postedIds.has(createPostedKey(date, slotIndex, taskIndex)),
    };
  }, [
    selectedSlotId,
    scheduleTimes,
    scheduleAssignments,
    products,
    activeContactText,
    includeSocialTags,
    settings.commonDescription,
    scheduleConfig,
    postedIds,
  ]);

  const requestConfirm = (request: ConfirmRequest): void => {
    setPendingConfirm(request);
  };

  const closeConfirm = (): void => {
    if (isConfirmExecuting) return;

    pendingConfirm?.onCancel?.();
    setPendingConfirm(null);
  };

  const executeConfirm = async (): Promise<void> => {
    if (!pendingConfirm || isConfirmExecuting) return;

    const request = pendingConfirm;

    setIsConfirmExecuting(true);

    try {
      await request.onConfirm();
      setPendingConfirm(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể thực hiện thao tác";
      Toastify(message, 400);
    } finally {
      setIsConfirmExecuting(false);
    }
  };

  const executeConfirmSecondary = async (): Promise<void> => {
    const onSecondary = pendingConfirm?.onSecondary;

    if (!pendingConfirm || !onSecondary || isConfirmExecuting) return;

    setIsConfirmExecuting(true);

    try {
      await onSecondary();
      setPendingConfirm(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể thực hiện thao tác";
      Toastify(message, 400);
    } finally {
      setIsConfirmExecuting(false);
    }
  };

  const getSelectedTextFromDescriptionContainer = (
    container: HTMLElement,
  ): string => {
    if (typeof window === "undefined") return "";

    const selection = getActiveInteractionWindow().getSelection();

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return "";
    }

    const selectedText = selection.toString().trim();

    if (!selectedText) return "";

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;

    if (!anchorNode || !focusNode) return "";
    if (!container.contains(anchorNode) || !container.contains(focusNode)) {
      return "";
    }

    const range = selection.getRangeAt(0);
    const lineElements = Array.from(
      container.querySelectorAll<HTMLElement>("[data-description-line='true']"),
    );

    const selectedLines = lineElements
      .filter((element) => range.intersectsNode(element))
      .map((element) => element.dataset.descriptionLineText ?? element.textContent ?? "")
      .map((line) => line.trim())
      .filter(Boolean);

    if (selectedLines.length === 0) return selectedText;

    return Array.from(new Set(selectedLines)).join("\n");
  };

  const updateSelectedDescriptionCopy = (
    productId: string,
    container: HTMLElement,
  ): boolean => {
    const selectedText = getSelectedTextFromDescriptionContainer(container);

    if (!selectedText) {
      setSelectedDescriptionCopy((current) =>
        current?.productId === productId ? null : current,
      );

      return false;
    }

    setSelectedDescriptionCopy({
      productId,
      text: selectedText,
    });

    return true;
  };

  const handleCopySelectedDescription = async (
    productId: string,
  ): Promise<void> => {
    if (!selectedDescriptionCopy || selectedDescriptionCopy.productId !== productId) {
      Toastify("Chưa có nội dung mô tả được chọn", 300);
      return;
    }

    const copyKey = `selected-description-${productId}`;

    await handleCopyField(copyKey, "nội dung đã chọn", selectedDescriptionCopy.text);
    getActiveInteractionWindow().getSelection()?.removeAllRanges();
    setSelectedDescriptionCopy(null);
  };

  const renderCopyIcon = (key: string) => {
    return copiedKey === key ? (
      <FiCheckCircle aria-hidden="true" className={iconClassName} />
    ) : (
      <FiCopy aria-hidden="true" className={iconClassName} />
    );
  };

  const renderDescriptionText = (
    productId: string,
    description: string,
    expanded: boolean,
  ) => {
    if (!expanded) {
      return description || "Chưa có mô tả";
    }

    const lines = description.split(/\r?\n/u);

    return lines.map((line, index) => {
      const trimmedLine = line.trim();
      const copyKey = `plus-line-${productId}-${index}`;
      const isPlusLine = trimmedLine.startsWith("+");

      if (!trimmedLine) {
        return <br key={`${productId}-empty-${index}`} />;
      }

      if (!isPlusLine) {
        return (
          <span
            key={`${productId}-line-${index}`}
            className="block min-w-0 max-w-full whitespace-pre-wrap [overflow-wrap:anywhere]"
            data-description-line="true"
            data-description-line-text={line}
          >
            {line}
          </span>
        );
      }

      return (
        <button
          key={`${productId}-plus-${index}`}
          type="button"
          data-description-line="true"
          data-description-line-text={trimmedLine}
          className={`my-0.5 block w-full min-w-0 max-w-full select-text whitespace-pre-wrap rounded-md px-0.5 py-1 text-left [overflow-wrap:anywhere] transition ${copiedKey === copyKey
            ? "bg-amber-200 text-slate-950"
            : "bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20"
            }`}
          onClick={(event) => {
            event.stopPropagation();
            void handleCopyField(copyKey, "dòng mô tả", trimmedLine);
          }}
        >
          {trimmedLine}
        </button>
      );
    });
  };

  const renderDraftImageCollection = (
    imageField: ProductImageField,
    label: string,
  ) => {
    const images = draft[imageField];

    if (images.length === 0) return null;

    return (
      <div
        className={`flex min-h-0 min-w-0 flex-col rounded-md border bg-slate-950/70 p-2.5 transition ${dragOverImageField === imageField
          ? imageField === "internalImages"
            ? "border-amber-300/70 bg-amber-300/[0.08]"
            : "border-cyan-300/70 bg-cyan-300/[0.08]"
          : "border-white/10"
          }`}
        onDragOver={(event) => handleDragOver(event, imageField)}
        onDragLeave={handleDragLeave}
        onDrop={(event) => void handleDrop(event, imageField)}
      >
        <div
          data-editor-toolbar="true"
          className="mb-2 flex min-w-0 items-center justify-between gap-2"
        >
          <span className="flex min-w-0 items-center gap-2 whitespace-nowrap text-xs font-black text-white">
            <FiImage aria-hidden="true" className={iconClassName} />
            {images.length} {label}
          </span>

          <button
            type="button"
            className="flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-slate-800 p-2 text-xs font-bold text-slate-300 transition hover:bg-slate-700"
            onClick={() => updateDraftField(imageField, [])}
            title={`Xóa toàn bộ ${label}`}
          >
            <FiTrash2 aria-hidden="true" className={iconClassName} />
          </button>
        </div>

        <div className="grid min-w-0 max-h-[260px] grid-cols-3 gap-1.5 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 sm:max-h-[320px] sm:grid-cols-4 md:grid-cols-5 xl:max-h-[calc(90dvh-190px)] xl:grid-cols-4 2xl:grid-cols-5">
          {images.map((image, index) => {
            const isDraggingImage =
              draggingDraftImageId === image.id &&
              draggingDraftImageField === imageField;

            return (
              <div
                key={image.id}
                draggable
                className={`group relative h-[88px] cursor-grab overflow-hidden rounded-md bg-slate-900 transition active:cursor-grabbing sm:h-[96px] xl:h-[108px] ${isDraggingImage ? "scale-95 opacity-60" : ""}`}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", image.id);
                  event.dataTransfer.setData(
                    DRAFT_IMAGE_ID_DATA_TYPE,
                    image.id,
                  );
                  event.dataTransfer.setData(
                    DRAFT_IMAGE_FIELD_DATA_TYPE,
                    imageField,
                  );
                  event.dataTransfer.effectAllowed = "move";
                  setDraggingDraftImageId(image.id);
                  setDraggingDraftImageField(imageField);
                }}
                onDragOver={(event) => handleDragOver(event, imageField)}
                onDrop={(event) => {
                  void handleDrop(event, imageField, image.id);
                }}
                onDragEnd={resetDraftImageDrag}
              >
                <img
                  src={image.dataUrl}
                  alt={image.name}
                  width={1200}
                  height={1200}
                  className="h-full w-full object-contain"
                />

                <div className="absolute left-1 top-1 rounded-md bg-black/70 px-1.5 py-0.5 whitespace-nowrap text-[10px] font-black text-white">
                  {index + 1}
                </div>

                <button
                  type="button"
                  data-image-control="true"
                  title={`Xóa ${label} ${index + 1}`}
                  aria-label={`Xóa ${label} ${index + 1}`}
                  className="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-md border border-white/35 bg-rose-500 text-xs text-white opacity-100 shadow-[0_6px_16px_rgba(0,0,0,0.45)] transition hover:border-white/60 hover:bg-rose-400"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeDraftImage(image.id, imageField);
                  }}
                >
                  <FiX aria-hidden="true" className={iconClassName} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isSettingsReady) {
    return (
      <main
        className={`min-h-dvh w-full bg-[#050a11] text-slate-100`}
      >
        <ToastContainer style={{ zIndex: 1000000 }} />
        <LoadingOverlay text={pageLoadingText || "Đang tải dữ liệu, vui lòng chờ..."} />
      </main>
    );
  }

  const localProductsWorkspace = (
    <main
      className={`local-products-workspace min-h-dvh w-full overflow-x-hidden bg-[#050a11] text-slate-100 ${pictureInPictureWindow
        ? "pb-[50px]"
        : "pb-[100px] xl:pb-[50px]"
        }`}
      onPaste={(event) => {
        void handlePaste(event);
      }}
      onKeyDown={handleLocalWorkspaceKeyDown}
    >
      <ToastContainer style={{ zIndex: 1000000 }} />


      <input
        id={IMPORT_BACKUP_INPUT_ID}
        type="file"
        accept=".json,.json.gz,.gz,application/json,application/gzip,application/x-gzip"
        className="sr-only"
        onChange={(event) => {
          void handleImportJson(event);
        }}
      />

      {pageLoadingText ? <LoadingOverlay text={pageLoadingText} /> : null}

      <style>{`
        .local-products-workspace {
          color-scheme: dark;
          background:
            linear-gradient(rgba(216, 201, 159, 0.011) 1px, transparent 1px),
            linear-gradient(90deg, rgba(216, 201, 159, 0.011) 1px, transparent 1px),
            radial-gradient(circle at 12% -8%, rgba(216, 201, 159, 0.085), transparent 31%),
            radial-gradient(circle at 92% 24%, rgba(87, 96, 117, 0.055), transparent 29%),
            linear-gradient(145deg, #07090d 0%, #0a0d13 52%, #07090d 100%) !important;
          background-attachment: fixed;
          background-size: 42px 42px, 42px 42px, auto, auto, auto;
        }

        .local-products-workspace ::selection {
          background: rgba(216, 201, 159, 0.92);
          color: #151109;
        }

        .local-products-workspace * {
          scrollbar-color: rgba(216, 201, 159, 0.42) rgba(255, 255, 255, 0.025);
          scrollbar-width: thin;
        }

        .local-products-workspace *::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .local-products-workspace *::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.025);
        }

        .local-products-workspace *::-webkit-scrollbar-thumb {
          border: 1px solid rgba(7, 9, 13, 0.8);
          background: linear-gradient(180deg, rgba(241, 229, 194, 0.68), rgba(154, 135, 88, 0.55));
        }

        .local-products-workspace button {
          min-width: 0;
          white-space: nowrap;
          flex-wrap: nowrap;
          -webkit-tap-highlight-color: transparent;
        }

        .local-products-workspace button:not([data-description-line="true"]):not([data-category-bubble="true"]):not([data-image-surface="true"]):not([data-image-control="true"]) {
          position: relative;
          isolation: isolate;
          border-radius: 0 !important;
          clip-path: polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px);
          transition: color 320ms ease, background-color 320ms ease, border-color 320ms ease, box-shadow 320ms ease, filter 320ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .local-products-workspace button:not([data-description-line="true"]):not([data-category-bubble="true"]):not([data-image-surface="true"]):not([data-image-control="true"])::after {
          content: "";
          position: absolute;
          z-index: 2;
          top: -90%;
          bottom: -90%;
          left: -28%;
          width: 10%;
          pointer-events: none;
          opacity: 0;
          transform: skewX(-18deg);
          background: linear-gradient(90deg, transparent, rgba(255, 248, 224, 0.26), transparent);
          animation: luxuryMetalGlint 5.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }

        .local-products-workspace button:nth-child(2n)::after {
          animation-delay: 460ms;
        }

        .local-products-workspace button:nth-child(3n)::after {
          animation-delay: 920ms;
        }

        .local-products-workspace button[data-luxury-accent] {
          letter-spacing: 0.035em;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.085), inset 0 -1px 0 rgba(0, 0, 0, 0.22), 0 8px 20px rgba(0, 0, 0, 0.2) !important;
        }

        .local-products-workspace button[data-luxury-accent]::before {
          content: "";
          position: absolute;
          z-index: 1;
          top: 0;
          right: 9px;
          left: 9px;
          height: 1px;
          pointer-events: none;
          opacity: 0.62;
          background: linear-gradient(90deg, transparent, rgba(255, 248, 224, 0.7), transparent);
        }

        .local-products-workspace button[data-luxury-accent="gold"] {
          border-color: rgba(250, 240, 211, 0.88) !important;
          background: linear-gradient(135deg, #f7efd9 0%, #cdbb89 52%, #eee3c4 100%) !important;
          color: #17130a !important;
        }

        .local-products-workspace button[data-luxury-accent="sapphire"] {
          border-color: rgba(142, 187, 225, 0.46) !important;
          background: linear-gradient(145deg, rgba(37, 79, 116, 0.43), rgba(13, 27, 43, 0.94)) !important;
          color: #e1f0fb !important;
        }

        .local-products-workspace button[data-luxury-accent="emerald"] {
          border-color: rgba(125, 202, 169, 0.46) !important;
          background: linear-gradient(145deg, rgba(29, 94, 70, 0.42), rgba(11, 36, 28, 0.94)) !important;
          color: #e1f5ec !important;
        }

        .local-products-workspace button[data-luxury-accent="emerald"][aria-pressed="true"] {
          border-color: rgba(203, 239, 221, 0.7) !important;
          background: linear-gradient(135deg, #d7eee2 0%, #7cab93 56%, #c3dfd0 100%) !important;
          color: #092319 !important;
        }

        .local-products-workspace button[data-luxury-accent="violet"] {
          border-color: rgba(184, 163, 226, 0.45) !important;
          background: linear-gradient(145deg, rgba(82, 60, 129, 0.42), rgba(31, 24, 49, 0.94)) !important;
          color: #f0eafa !important;
        }

        .local-products-workspace button[data-luxury-accent="amber"] {
          border-color: rgba(224, 190, 124, 0.47) !important;
          background: linear-gradient(145deg, rgba(122, 84, 32, 0.42), rgba(47, 33, 15, 0.94)) !important;
          color: #faebc9 !important;
        }

        .local-products-workspace button[data-luxury-accent="rose"] {
          border-color: rgba(220, 154, 169, 0.45) !important;
          background: linear-gradient(145deg, rgba(108, 50, 66, 0.42), rgba(47, 23, 30, 0.94)) !important;
          color: #fae6ea !important;
        }

        .local-products-workspace button[data-luxury-accent="indigo"] {
          border-color: rgba(151, 167, 222, 0.45) !important;
          background: linear-gradient(145deg, rgba(57, 69, 128, 0.42), rgba(24, 29, 58, 0.94)) !important;
          color: #e9ecf9 !important;
        }

        .local-products-workspace button[data-luxury-accent="cyan"] {
          border-color: rgba(121, 197, 206, 0.45) !important;
          background: linear-gradient(145deg, rgba(29, 97, 107, 0.42), rgba(11, 39, 44, 0.94)) !important;
          color: #e1f4f5 !important;
        }

        .local-products-workspace button[data-luxury-accent="amethyst"] {
          border-color: rgba(202, 154, 217, 0.45) !important;
          background: linear-gradient(145deg, rgba(98, 49, 112, 0.42), rgba(42, 21, 49, 0.94)) !important;
          color: #f4e7f7 !important;
        }

        .local-products-workspace button[data-luxury-accent="teal"] {
          border-color: rgba(115, 194, 182, 0.45) !important;
          background: linear-gradient(145deg, rgba(27, 92, 83, 0.42), rgba(11, 38, 35, 0.94)) !important;
          color: #e0f3ee !important;
        }

        .local-products-workspace button[data-luxury-accent="blue"] {
          border-color: rgba(128, 167, 221, 0.45) !important;
          background: linear-gradient(145deg, rgba(41, 81, 137, 0.42), rgba(16, 32, 61, 0.94)) !important;
          color: #e5eefb !important;
        }

        .local-products-workspace button[data-luxury-accent]:hover {
          border-color: rgba(245, 235, 205, 0.58) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.11), inset 0 -1px 0 rgba(0, 0, 0, 0.22), 0 11px 26px rgba(0, 0, 0, 0.28), 0 0 14px rgba(216, 201, 159, 0.07) !important;
        }

        .local-products-workspace button:not(:disabled),
        .local-products-workspace label[for],
        .local-products-workspace input[type="radio"],
        .local-products-workspace [role="button"] {
          cursor: pointer;
        }

        .local-products-workspace button:not(:disabled):not([data-description-line="true"]):not([data-image-surface="true"]):not([data-image-control="true"]):hover {
          transform: translateY(-1px);
          filter: brightness(1.035);
        }

        .local-products-workspace button[data-image-control="true"] {
          position: absolute !important;
          isolation: auto;
          clip-path: none !important;
        }

        .local-products-workspace button[data-image-control="true"]::before,
        .local-products-workspace button[data-image-control="true"]::after {
          display: none !important;
        }

        .local-products-workspace button:not(:disabled):active {
          transform: scale(0.975);
        }

        .local-products-workspace button:focus-visible,
        .local-products-workspace input:focus-visible,
        .local-products-workspace textarea:focus-visible,
        .local-products-workspace select:focus-visible,
        .local-products-workspace [role="button"]:focus-visible {
          outline: 1px solid rgba(241, 229, 194, 0.88);
          outline-offset: 2px;
        }

        .local-products-workspace button:disabled {
          cursor: not-allowed;
          filter: saturate(0.35);
        }

        .local-products-workspace button[class~="bg-cyan-300"],
        .local-products-workspace button[class~="bg-sky-300"],
        .local-products-workspace button[class~="bg-amber-300"],
        .local-products-workspace button[class~="bg-violet-200"] {
          border: 1px solid rgba(241, 229, 194, 0.76) !important;
          background: linear-gradient(135deg, #f2e8cd 0%, #c6b079 54%, #e8dab3 100%) !important;
          color: #17130a !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.58), 0 10px 26px rgba(190, 164, 99, 0.14);
        }

        .local-products-workspace button[class~="bg-cyan-300"]:hover,
        .local-products-workspace button[class~="bg-sky-300"]:hover,
        .local-products-workspace button[class~="bg-amber-300"]:hover,
        .local-products-workspace button[class~="bg-violet-200"]:hover {
          border-color: #fff2cf !important;
          filter: brightness(1.055);
        }

        .local-products-workspace button > span {
          min-width: 0;
          white-space: nowrap;
        }

        .local-products-workspace button[data-description-line="true"] {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
          flex-wrap: wrap;
        }

        .local-products-workspace button[data-description-line="true"] > span {
          min-width: 0;
          max-width: 100%;
          white-space: inherit;
          overflow-wrap: inherit;
          word-break: inherit;
        }

        .local-products-workspace input:not([type="radio"]):not([type="checkbox"]):not([type="file"]),
        .local-products-workspace textarea,
        .local-products-workspace select {
          border-radius: 2px !important;
          border-color: rgba(216, 201, 159, 0.24) !important;
          background: linear-gradient(145deg, rgba(13, 17, 23, 0.97), rgba(22, 28, 37, 0.94)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 8px 24px rgba(0, 0, 0, 0.14);
          transition: border-color 240ms ease, box-shadow 240ms ease, background-color 240ms ease;
        }

        .local-products-workspace input:not([type="radio"]):not([type="checkbox"]):not([type="file"]):focus,
        .local-products-workspace textarea:focus,
        .local-products-workspace select:focus {
          border-color: rgba(241, 229, 194, 0.62) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 0 0 3px rgba(216, 201, 159, 0.075), 0 14px 34px rgba(0, 0, 0, 0.2);
        }

        .local-products-workspace [class*="rounded-md"][class*="border"][class*="bg-slate-950"],
        .local-products-workspace [class*="rounded-xl"][class*="border"][class*="bg-slate-950"] {
          border-color: rgba(216, 201, 159, 0.23);
          background: linear-gradient(145deg, rgba(14, 18, 25, 0.99), rgba(21, 27, 36, 0.98));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 18px 42px rgba(0, 0, 0, 0.2);
        }

        .local-products-workspace [class*="rounded-md"][class*="border"][class*="bg-slate-900"],
        .local-products-workspace [class*="rounded-md"][class*="border"][class*="bg-slate-800"] {
          border-color: rgba(216, 201, 159, 0.22);
          background: linear-gradient(145deg, rgba(25, 31, 41, 0.96), rgba(15, 20, 27, 0.98));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045);
        }

        .luxury-header {
          clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%, 0 12px);
          border-color: rgba(216, 201, 159, 0.14) !important;
          background: linear-gradient(180deg, rgba(11, 13, 18, 0.975), rgba(7, 9, 13, 0.96)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025), 0 18px 52px rgba(0, 0, 0, 0.36) !important;
        }

        .luxury-header::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: -35%;
          width: 16%;
          pointer-events: none;
          background: linear-gradient(105deg, transparent, rgba(241, 229, 194, 0.04), transparent);
          animation: luxuryVectorSweep 7.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }

        .luxury-content-panel {
          position: relative;
          border-color: rgba(216, 201, 159, 0.2) !important;
          background: linear-gradient(180deg, rgba(16, 21, 29, 0.92), rgba(8, 12, 17, 0.82)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.022), inset 0 -1px 0 rgba(0, 0, 0, 0.3), 0 28px 76px rgba(0, 0, 0, 0.27);
        }

        .luxury-search {
          clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
          border-color: rgba(216, 201, 159, 0.28) !important;
          background: linear-gradient(135deg, rgba(14, 18, 24, 0.98), rgba(24, 30, 39, 0.94)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.24), 0 14px 36px rgba(0, 0, 0, 0.2);
        }

        .luxury-product-card {
          position: relative;
          clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
          border-color: rgba(226, 214, 180, 0.3) !important;
          background: linear-gradient(155deg, rgba(34, 42, 54, 0.99), rgba(16, 22, 30, 0.995)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.075), inset 0 -2px 0 rgba(0, 0, 0, 0.32), 0 3px 0 rgba(255, 255, 255, 0.015), 0 18px 42px rgba(0, 0, 0, 0.34), 0 8px 18px rgba(0, 0, 0, 0.24);
        }

        .luxury-product-card::before {
          content: "";
          position: absolute;
          z-index: 6;
          top: 0;
          right: 14px;
          left: 14px;
          height: 1px;
          pointer-events: none;
          background: linear-gradient(90deg, transparent, rgba(247, 237, 207, 0.62), transparent);
        }

        .luxury-product-card::after {
          content: "";
          position: absolute;
          z-index: 5;
          top: -40%;
          bottom: -40%;
          left: -42%;
          width: 9%;
          pointer-events: none;
          opacity: 0;
          transform: skewX(-17deg);
          background: linear-gradient(90deg, transparent, rgba(241, 229, 194, 0.1), transparent);
          animation: luxuryCardGlint 8.4s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }

        .local-products-workspace .luxury-product-card[data-active="true"] {
          border-color: rgba(247, 237, 207, 0.72) !important;
          background: linear-gradient(155deg, rgba(47, 47, 42, 0.99), rgba(22, 27, 33, 0.997)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.095), inset 0 -2px 0 rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(216, 201, 159, 0.14), 0 26px 58px rgba(0, 0, 0, 0.4), 0 9px 20px rgba(0, 0, 0, 0.25);
        }

        .luxury-product-card:hover {
          border-color: rgba(235, 224, 192, 0.48) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09), inset 0 -2px 0 rgba(0, 0, 0, 0.32), 0 28px 62px rgba(0, 0, 0, 0.4), 0 10px 22px rgba(0, 0, 0, 0.24);
        }

        .luxury-product-image {
          background:
            radial-gradient(circle at 50% 36%, rgba(216, 201, 159, 0.09), transparent 44%),
            linear-gradient(145deg, #1a212b, #0d1219) !important;
        }

        .luxury-category-bar {
          border-color: rgba(216, 201, 159, 0.18) !important;
          background: rgba(5, 7, 10, 0.94) !important;
          box-shadow: 0 -14px 38px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(18px);
        }

        .luxury-modal-overlay {
          background: rgba(3, 5, 8, 0.78) !important;
          backdrop-filter: blur(14px) saturate(0.8);
        }

        .luxury-modal,
        .luxury-dialog,
        .luxury-modal-overlay > div,
        .luxury-modal-overlay > form {
          animation: luxuryModalIn 440ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .luxury-modal,
        .luxury-dialog {
          clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
          border-color: rgba(216, 201, 159, 0.24) !important;
          background: linear-gradient(145deg, rgba(8, 10, 15, 0.995), rgba(14, 17, 23, 0.99)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035), 0 34px 90px rgba(0, 0, 0, 0.56);
        }

        .luxury-dialog[data-share-dialog="true"] {
          overflow-x: hidden !important;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
          contain: paint;
        }

        .luxury-dialog[data-share-dialog="true"] button::after {
          display: none !important;
        }

        .product-list-dialog {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          overflow-x: hidden;
          contain: paint;
        }

        .product-list-dialog button:not([data-description-line="true"]):not([data-category-bubble="true"]):not([data-image-surface="true"]):not([data-image-control="true"]) {
          overflow: hidden;
          contain: paint;
        }

        .product-list-scroll {
          min-width: 0;
          max-width: 100%;
          overscroll-behavior-x: contain;
          scrollbar-gutter: stable;
        }

        .luxury-modal-titlebar {
          position: relative;
          border-color: rgba(216, 201, 159, 0.14) !important;
          background: linear-gradient(90deg, rgba(216, 201, 159, 0.08), rgba(14, 17, 23, 0.96) 38%, rgba(7, 9, 13, 0.98)) !important;
        }

        .luxury-modal-titlebar::after {
          content: "";
          position: absolute;
          right: 2rem;
          bottom: -1px;
          left: 2rem;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(216, 201, 159, 0.48), transparent);
        }

        .local-products-workspace .Toastify__toast {
          border: 1px solid rgba(216, 201, 159, 0.22);
          border-radius: 2px;
          background: linear-gradient(145deg, rgba(13, 16, 22, 0.98), rgba(6, 8, 12, 0.99));
          color: #eef0f4;
          box-shadow: 0 20px 52px rgba(0, 0, 0, 0.42);
          clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
        }

        .local-products-workspace .Toastify__progress-bar {
          background: linear-gradient(90deg, #9f8b55, #f1e5c2, #b8a16a);
        }

        @keyframes luxuryVectorSweep {
          0%, 68% { transform: translateX(0); opacity: 0; }
          76% { opacity: 1; }
          100% { transform: translateX(620%); opacity: 0; }
        }

        @keyframes luxuryMetalGlint {
          0%, 48% { left: -34%; opacity: 0; }
          54% { opacity: 0.56; }
          72% { left: 122%; opacity: 0; }
          100% { left: 122%; opacity: 0; }
        }

        @keyframes luxuryCardGlint {
          0%, 42% { left: -42%; opacity: 0; }
          49% { opacity: 0.5; }
          69% { left: 126%; opacity: 0; }
          100% { left: 126%; opacity: 0; }
        }

        @keyframes luxuryModalIn {
          0% { opacity: 0; transform: translateY(14px) scale(0.985); filter: blur(5px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }

        @keyframes productWaveIn {
          0% { opacity: 0; transform: translateY(20px) scale(0.975); filter: blur(4px); }
          52% { opacity: 1; transform: translateY(-3px) scale(1); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }

        .product-wave-card {
          animation: productWaveIn 680ms cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }

        /* Tactical inventory HUD theme. */
        .local-products-workspace {
          color: #e6edf3;
          background:
            linear-gradient(rgba(230, 207, 139, 0.024) 1px, transparent 1px),
            linear-gradient(90deg, rgba(230, 207, 139, 0.024) 1px, transparent 1px),
            linear-gradient(rgba(139, 169, 178, 0.011) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 169, 178, 0.011) 1px, transparent 1px),
            radial-gradient(circle at 14% -6%, rgba(230, 207, 139, 0.14), transparent 29%),
            radial-gradient(circle at 92% 16%, rgba(169, 155, 242, 0.075), transparent 25%),
            linear-gradient(145deg, #050a11 0%, #08111b 52%, #04080e 100%) !important;
          background-attachment: fixed;
          background-size: 48px 48px, 48px 48px, 12px 12px, 12px 12px, auto, auto, auto;
        }

        .local-products-workspace ::selection {
          background: rgba(230, 207, 139, 0.88);
          color: #17130a;
        }

        .local-products-workspace * {
          scrollbar-color: rgba(230, 207, 139, 0.56) rgba(255, 255, 255, 0.025);
        }

        .local-products-workspace *::-webkit-scrollbar-thumb {
          border-color: rgba(5, 10, 17, 0.88);
          background: linear-gradient(180deg, rgba(230, 207, 139, 0.86), rgba(142, 116, 57, 0.72));
        }

        .local-products-workspace button[data-luxury-accent] {
          text-shadow: 0 0 12px currentColor;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -2px 0 rgba(0, 0, 0, 0.3), 0 7px 18px rgba(0, 0, 0, 0.28) !important;
        }

        .local-products-workspace button[data-luxury-accent]::before {
          height: 2px;
          opacity: 0.78;
          background: linear-gradient(90deg, transparent, currentColor, transparent);
        }

        .local-products-workspace button[data-luxury-accent]:hover {
          border-color: rgba(245, 233, 199, 0.76) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16), inset 0 -2px 0 rgba(0, 0, 0, 0.28), 0 10px 24px rgba(0, 0, 0, 0.34), 0 0 17px rgba(230, 207, 139, 0.14) !important;
        }

        .local-products-workspace button[class~="bg-cyan-300"],
        .local-products-workspace button[class~="bg-sky-300"],
        .local-products-workspace button[class~="bg-amber-300"],
        .local-products-workspace button[class~="bg-violet-200"] {
          border-color: rgba(245, 233, 199, 0.82) !important;
          background: linear-gradient(135deg, #f5e9c7 0%, #d6ba6b 58%, #b99a4e 100%) !important;
          color: #17130a !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72), inset 0 -2px 0 rgba(95, 68, 16, 0.32), 0 8px 22px rgba(154, 119, 42, 0.22) !important;
        }

        .local-products-workspace input:not([type="radio"]):not([type="checkbox"]):not([type="file"]),
        .local-products-workspace textarea,
        .local-products-workspace select {
          border-color: rgba(230, 207, 139, 0.27) !important;
          background:
            linear-gradient(90deg, rgba(230, 207, 139, 0.035) 1px, transparent 1px),
            linear-gradient(145deg, rgba(10, 20, 31, 0.99), rgba(15, 29, 43, 0.97)) !important;
          background-size: 18px 18px, auto;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.055), inset 3px 0 0 rgba(230, 207, 139, 0.2), 0 8px 24px rgba(0, 0, 0, 0.18);
        }

        .local-products-workspace input:not([type="radio"]):not([type="checkbox"]):not([type="file"]):focus,
        .local-products-workspace textarea:focus,
        .local-products-workspace select:focus {
          border-color: rgba(230, 207, 139, 0.72) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), inset 3px 0 0 rgba(230, 207, 139, 0.48), 0 0 0 2px rgba(230, 207, 139, 0.09), 0 14px 34px rgba(0, 0, 0, 0.24);
        }

        .local-products-workspace select {
          color-scheme: dark !important;
          color: #f8fafc !important;
          -webkit-text-fill-color: #f8fafc;
        }

        .local-products-workspace select option,
        .local-products-workspace select optgroup {
          color-scheme: dark !important;
          forced-color-adjust: none;
          background-color: #0a1420 !important;
          color: #f8fafc !important;
          -webkit-text-fill-color: #f8fafc;
        }

        .local-products-workspace select option:checked {
          background-color: #1d4ed8 !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff;
        }

        .local-products-workspace select option:disabled {
          color: #94a3b8 !important;
          -webkit-text-fill-color: #94a3b8;
        }

        .local-products-workspace [class*="rounded-md"][class*="border"][class*="bg-slate-950"],
        .local-products-workspace [class*="rounded-xl"][class*="border"][class*="bg-slate-950"],
        .local-products-workspace [class*="rounded-md"][class*="border"][class*="bg-slate-900"],
        .local-products-workspace [class*="rounded-md"][class*="border"][class*="bg-slate-800"] {
          border-color: rgba(230, 207, 139, 0.19);
          background: linear-gradient(145deg, rgba(14, 27, 41, 0.99), rgba(7, 15, 24, 0.995));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 16px 38px rgba(0, 0, 0, 0.25);
        }

        .luxury-header {
          clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 12px);
          border-color: rgba(230, 207, 139, 0.27) !important;
          background:
            linear-gradient(rgba(230, 207, 139, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(230, 207, 139, 0.025) 1px, transparent 1px),
            linear-gradient(180deg, rgba(12, 25, 38, 0.985), rgba(5, 11, 18, 0.98)) !important;
          background-size: 28px 28px, 28px 28px, auto;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.055), inset 0 -2px 0 rgba(230, 207, 139, 0.12), 0 18px 52px rgba(0, 0, 0, 0.42) !important;
        }

        .luxury-header::after {
          background: linear-gradient(105deg, transparent, rgba(230, 207, 139, 0.1), rgba(245, 233, 199, 0.05), transparent);
          animation-duration: 10.5s;
        }

        .luxury-content-panel {
          border-color: rgba(230, 207, 139, 0.2) !important;
          background: linear-gradient(180deg, rgba(10, 21, 33, 0.94), rgba(5, 11, 18, 0.88)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035), inset 0 -1px 0 rgba(0, 0, 0, 0.36), 0 28px 76px rgba(0, 0, 0, 0.32);
        }

        .luxury-search {
          border-color: rgba(230, 207, 139, 0.34) !important;
          background: linear-gradient(135deg, rgba(9, 19, 30, 0.99), rgba(18, 34, 49, 0.96)) !important;
          box-shadow: inset 3px 0 0 rgba(230, 207, 139, 0.46), inset 0 1px 0 rgba(255, 255, 255, 0.055), 0 13px 34px rgba(0, 0, 0, 0.24);
        }

        .luxury-product-card {
          clip-path: polygon(12px 0, calc(100% - 5px) 0, 100% 5px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 5px 100%, 0 calc(100% - 5px), 0 12px);
          border-color: rgba(230, 207, 139, 0.31) !important;
          background:
            linear-gradient(135deg, rgba(230, 207, 139, 0.065), transparent 28%),
            linear-gradient(155deg, rgba(22, 39, 55, 0.995), rgba(8, 17, 27, 0.998)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09), inset 3px 0 0 rgba(230, 207, 139, 0.1), inset 0 -2px 0 rgba(0, 0, 0, 0.38), 0 19px 44px rgba(0, 0, 0, 0.38), 0 8px 18px rgba(0, 0, 0, 0.25);
        }

        .luxury-product-card::before {
          right: 10px;
          left: 10px;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(230, 207, 139, 0.88), rgba(245, 233, 199, 0.62), transparent);
        }

        .luxury-product-card::after {
          background: linear-gradient(90deg, transparent, rgba(230, 207, 139, 0.13), transparent);
          animation-duration: 11.5s;
        }

        .local-products-workspace .luxury-product-card[data-active="true"] {
          border-color: rgba(245, 233, 199, 0.84) !important;
          background:
            linear-gradient(135deg, rgba(230, 207, 139, 0.12), transparent 34%),
            linear-gradient(155deg, rgba(49, 43, 28, 0.995), rgba(12, 21, 29, 0.998)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.13), inset 3px 0 0 rgba(230, 207, 139, 0.38), inset 0 -2px 0 rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(230, 207, 139, 0.17), 0 0 22px rgba(230, 207, 139, 0.13), 0 27px 60px rgba(0, 0, 0, 0.43);
        }

        .luxury-product-card:hover {
          border-color: rgba(245, 233, 199, 0.64) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 3px 0 0 rgba(230, 207, 139, 0.22), inset 0 -2px 0 rgba(0, 0, 0, 0.34), 0 0 18px rgba(230, 207, 139, 0.1), 0 29px 64px rgba(0, 0, 0, 0.42);
        }

        .luxury-product-image {
          background:
            linear-gradient(rgba(230, 207, 139, 0.026) 1px, transparent 1px),
            linear-gradient(90deg, rgba(230, 207, 139, 0.026) 1px, transparent 1px),
            radial-gradient(circle at 50% 38%, rgba(230, 207, 139, 0.11), transparent 47%),
            linear-gradient(145deg, #101e2b, #060d16) !important;
          background-size: 24px 24px, 24px 24px, auto, auto;
        }

        #mobile-category-menu button[data-category-bubble="true"] {
          border-color: rgba(230, 207, 139, 0.37) !important;
          background: linear-gradient(145deg, rgba(16, 34, 49, 0.98), rgba(6, 14, 23, 0.995)) !important;
          color: #f1e5c2 !important;
          box-shadow: inset 3px 0 0 rgba(230, 207, 139, 0.28), 0 16px 42px rgba(0, 0, 0, 0.48) !important;
        }

        #mobile-category-menu button[data-category-bubble="true"][data-active="true"] {
          border-color: rgba(245, 233, 199, 0.86) !important;
          background: linear-gradient(135deg, #f5e9c7, #d6ba6b) !important;
          color: #17130a !important;
          box-shadow: inset 3px 0 0 rgba(255, 248, 224, 0.58), 0 0 18px rgba(230, 207, 139, 0.22), 0 16px 42px rgba(0, 0, 0, 0.44) !important;
        }

        .local-products-workspace button[aria-controls="mobile-category-menu"] {
          border-color: rgba(230, 207, 139, 0.5) !important;
          background: linear-gradient(145deg, rgba(18, 39, 56, 0.99), rgba(7, 16, 26, 0.995)) !important;
          color: #f1e5c2 !important;
          box-shadow: inset 3px 0 0 rgba(230, 207, 139, 0.5), 0 14px 38px rgba(0, 0, 0, 0.48) !important;
        }

        .local-products-workspace button[aria-controls="mobile-category-menu"][aria-expanded="true"] {
          background: linear-gradient(135deg, #f5e9c7, #d6ba6b) !important;
          color: #17130a !important;
        }

        .luxury-category-bar {
          overflow-y: hidden !important;
          overscroll-behavior-x: contain;
          overscroll-behavior-y: none;
          scrollbar-width: none;
          touch-action: pan-x;
          white-space: nowrap;
          border-color: rgba(230, 207, 139, 0.34) !important;
          background: rgba(4, 10, 17, 0.97) !important;
          box-shadow: inset 0 2px 0 rgba(230, 207, 139, 0.1), 0 -14px 38px rgba(0, 0, 0, 0.42);
        }

        .luxury-category-bar::-webkit-scrollbar {
          width: 0;
          height: 0;
        }

        .luxury-category-bar button {
          flex: 0 0 auto;
          min-width: max-content;
          white-space: nowrap;
          border-color: rgba(230, 207, 139, 0.16) !important;
          background: rgba(10, 23, 35, 0.88) !important;
          color: #c6d7df !important;
        }

        .luxury-category-bar button[aria-pressed="true"] {
          background: linear-gradient(135deg, #f5e9c7, #d6ba6b) !important;
          color: #17130a !important;
          box-shadow: inset 0 -3px 0 rgba(255, 248, 224, 0.62) !important;
        }

        .local-products-workspace .luxury-product-card[data-content-type="realEstate"] {
          border-color: rgba(253, 230, 138, 0.62) !important;
          background:
            linear-gradient(135deg, rgba(255, 251, 235, 0.18), transparent 36%),
            linear-gradient(155deg, rgba(82, 82, 64, 0.995), rgba(30, 43, 49, 0.998)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), inset 3px 0 0 rgba(253, 230, 138, 0.42), inset 0 -2px 0 rgba(0, 0, 0, 0.28), 0 0 24px rgba(251, 191, 36, 0.12), 0 22px 48px rgba(0, 0, 0, 0.38) !important;
        }

        .local-products-workspace .luxury-product-card[data-content-type="realEstate"][data-active="true"] {
          border-color: rgba(254, 240, 138, 0.9) !important;
          background:
            linear-gradient(135deg, rgba(255, 251, 235, 0.25), transparent 38%),
            linear-gradient(155deg, rgba(105, 91, 55, 0.998), rgba(34, 47, 52, 0.998)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 3px 0 0 rgba(254, 240, 138, 0.72), inset 0 -2px 0 rgba(0, 0, 0, 0.26), 0 0 0 1px rgba(253, 230, 138, 0.2), 0 0 32px rgba(251, 191, 36, 0.2), 0 28px 58px rgba(0, 0, 0, 0.42) !important;
        }

        .local-products-workspace .luxury-product-card[data-content-type="realEstate"]:hover {
          border-color: rgba(254, 240, 138, 0.82) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 3px 0 0 rgba(254, 240, 138, 0.58), inset 0 -2px 0 rgba(0, 0, 0, 0.27), 0 0 30px rgba(251, 191, 36, 0.18), 0 30px 64px rgba(0, 0, 0, 0.42) !important;
        }

        .local-products-workspace .luxury-product-card[data-content-type="realEstate"] .luxury-product-image {
          background:
            linear-gradient(rgba(253, 230, 138, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(253, 230, 138, 0.035) 1px, transparent 1px),
            radial-gradient(circle at 50% 38%, rgba(253, 230, 138, 0.18), transparent 48%),
            linear-gradient(145deg, #2d3a3c, #131f24) !important;
          background-size: 24px 24px, 24px 24px, auto, auto;
        }

        .luxury-product-card[data-category-colored="true"]::before {
          background: linear-gradient(90deg, transparent, var(--category-color), color-mix(in srgb, var(--category-color) 72%, white), transparent) !important;
        }

        .category-color-label {
          border-color: color-mix(in srgb, var(--category-color) 45%, transparent) !important;
          background: color-mix(in srgb, var(--category-color) 14%, transparent) !important;
          color: color-mix(in srgb, var(--category-color) 76%, white) !important;
          box-shadow: inset 2px 0 0 color-mix(in srgb, var(--category-color) 75%, transparent);
        }

        .category-list-group-header {
          border-color: color-mix(in srgb, var(--category-color) 32%, transparent) !important;
          background: linear-gradient(90deg, color-mix(in srgb, var(--category-color) 14%, #0f172a), rgba(15, 23, 42, 0.82)) !important;
          color: color-mix(in srgb, var(--category-color) 76%, white) !important;
          box-shadow: inset 3px 0 0 color-mix(in srgb, var(--category-color) 68%, transparent);
        }

        .category-list-name {
          color: color-mix(in srgb, var(--category-color) 68%, white) !important;
          box-shadow: inset 2px 0 0 color-mix(in srgb, var(--category-color) 48%, transparent);
        }

        #mobile-category-menu button[data-category-bubble="true"][data-category-colored="true"] {
          border-color: color-mix(in srgb, var(--category-color) 42%, transparent) !important;
          background: linear-gradient(145deg, color-mix(in srgb, var(--category-color) 16%, #102231), rgba(6, 14, 23, 0.995)) !important;
          color: color-mix(in srgb, var(--category-color) 72%, white) !important;
          box-shadow: inset 3px 0 0 color-mix(in srgb, var(--category-color) 58%, transparent), 0 16px 42px rgba(0, 0, 0, 0.48) !important;
        }

        #mobile-category-menu button[data-category-bubble="true"][data-category-colored="true"][data-active="true"] {
          border-color: color-mix(in srgb, var(--category-color) 82%, white) !important;
          background: linear-gradient(135deg, color-mix(in srgb, var(--category-color) 82%, white 18%), color-mix(in srgb, var(--category-color) 68%, black 32%)) !important;
          color: var(--category-contrast) !important;
          box-shadow: inset 3px 0 0 color-mix(in srgb, var(--category-color) 55%, white), 0 0 20px color-mix(in srgb, var(--category-color) 24%, transparent), 0 16px 42px rgba(0, 0, 0, 0.44) !important;
        }

        #mobile-category-menu button[data-category-colored="true"] [data-category-tail="true"] {
          border-color: color-mix(in srgb, var(--category-color) 55%, transparent) !important;
          background: color-mix(in srgb, var(--category-color) 30%, #090c11) !important;
        }

        #mobile-category-menu button[data-category-colored="true"][data-active="true"] [data-category-tail="true"] {
          background: color-mix(in srgb, var(--category-color) 76%, black 24%) !important;
        }

        .luxury-category-bar button[data-category-colored="true"] {
          border-color: color-mix(in srgb, var(--category-color) 32%, transparent) !important;
          background: linear-gradient(145deg, color-mix(in srgb, var(--category-color) 12%, #0a1723), rgba(10, 23, 35, 0.9)) !important;
          color: color-mix(in srgb, var(--category-color) 72%, white) !important;
          box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--category-color) 38%, transparent) !important;
        }

        .luxury-category-bar button[data-category-colored="true"][aria-pressed="true"] {
          background: linear-gradient(135deg, color-mix(in srgb, var(--category-color) 82%, white 18%), color-mix(in srgb, var(--category-color) 68%, black 32%)) !important;
          color: var(--category-contrast) !important;
          box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--category-color) 55%, white), 0 0 18px color-mix(in srgb, var(--category-color) 22%, transparent) !important;
        }

        .luxury-category-bar[data-category-dragging="true"] {
          border-color: rgba(253, 230, 138, 0.72) !important;
          background: linear-gradient(90deg, rgba(18, 30, 42, 0.99), rgba(52, 44, 22, 0.98), rgba(18, 30, 42, 0.99)) !important;
          box-shadow: inset 0 2px 0 rgba(253, 230, 138, 0.35), 0 -8px 30px rgba(251, 191, 36, 0.18), 0 -18px 48px rgba(0, 0, 0, 0.45) !important;
          animation: categoryTaskbarPulse 1.6s ease-in-out infinite;
        }

        .luxury-category-bar button[data-category-dragging="true"] {
          opacity: 0.28;
          filter: saturate(0.55);
          transform: scale(0.94);
        }

        .luxury-category-bar button[data-category-drop-target] {
          z-index: 2;
          filter: brightness(1.14);
        }

        .category-drop-marker {
          background: color-mix(in srgb, var(--category-color) 78%, white);
          box-shadow: 0 0 12px color-mix(in srgb, var(--category-color) 75%, transparent), 0 0 24px color-mix(in srgb, var(--category-color) 38%, transparent);
          animation: categoryDropMarkerPulse 0.72s ease-in-out infinite alternate;
        }

        .category-drag-hud {
          border-color: color-mix(in srgb, var(--category-color) 48%, transparent);
          background: linear-gradient(145deg, color-mix(in srgb, var(--category-color) 16%, #111827), rgba(5, 10, 17, 0.94));
          box-shadow: inset 3px 0 0 color-mix(in srgb, var(--category-color) 68%, transparent), 0 18px 50px rgba(0, 0, 0, 0.5), 0 0 26px color-mix(in srgb, var(--category-color) 16%, transparent);
          clip-path: polygon(9px 0, calc(100% - 5px) 0, 100% 5px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 5px 100%, 0 calc(100% - 5px), 0 9px);
        }

        .category-drag-hud-block {
          border-color: color-mix(in srgb, var(--category-color) 58%, transparent);
          background: linear-gradient(135deg, color-mix(in srgb, var(--category-color) 82%, white 18%), color-mix(in srgb, var(--category-color) 68%, black 32%));
          color: var(--category-contrast);
          box-shadow: 0 0 14px color-mix(in srgb, var(--category-color) 22%, transparent);
        }

        @keyframes categoryTaskbarPulse {
          0%, 100% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.08);
          }
        }

        @keyframes categoryDropMarkerPulse {
          from {
            opacity: 0.72;
            transform: scaleY(0.78);
          }
          to {
            opacity: 1;
            transform: scaleY(1);
          }
        }

        .luxury-modal-overlay {
          background: rgba(2, 6, 11, 0.84) !important;
          backdrop-filter: blur(15px) saturate(0.88);
        }

        .luxury-modal,
        .luxury-dialog {
          border-color: rgba(230, 207, 139, 0.32) !important;
          background:
            linear-gradient(rgba(230, 207, 139, 0.019) 1px, transparent 1px),
            linear-gradient(90deg, rgba(230, 207, 139, 0.019) 1px, transparent 1px),
            linear-gradient(145deg, rgba(12, 25, 38, 0.998), rgba(4, 10, 17, 0.998)) !important;
          background-size: 32px 32px, 32px 32px, auto;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.055), inset 3px 0 0 rgba(230, 207, 139, 0.14), 0 34px 90px rgba(0, 0, 0, 0.62);
        }

        .luxury-modal-titlebar {
          border-color: rgba(230, 207, 139, 0.24) !important;
          background: linear-gradient(90deg, rgba(230, 207, 139, 0.13), rgba(10, 22, 34, 0.98) 42%, rgba(4, 10, 17, 0.995)) !important;
        }

        .luxury-modal-titlebar::after {
          background: linear-gradient(90deg, transparent, rgba(230, 207, 139, 0.74), rgba(245, 233, 199, 0.46), transparent);
        }

        .product-editor,
        .product-editor section,
        .product-editor label,
        .product-editor div {
          min-width: 0;
        }

        .product-editor input,
        .product-editor textarea {
          width: 100%;
          max-width: 100%;
        }

        .product-editor [data-editor-toolbar="true"] {
          flex-wrap: wrap;
        }

        .local-products-workspace .Toastify__toast {
          border-color: rgba(230, 207, 139, 0.37);
          background: linear-gradient(145deg, rgba(13, 28, 41, 0.99), rgba(4, 10, 17, 0.998));
          color: #f5edda;
          box-shadow: inset 3px 0 0 rgba(230, 207, 139, 0.44), 0 20px 52px rgba(0, 0, 0, 0.46);
        }

        .local-products-workspace .Toastify__progress-bar {
          background: linear-gradient(90deg, #8f763d, #e6cf8b, #f5e9c7);
        }

        @keyframes headerActionsMenuDrop {
          from {
            opacity: 0;
            transform: translateY(-14px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .local-products-workspace .header-actions-menu-open {
          animation: headerActionsMenuDrop 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .local-products-workspace *,
          .local-products-workspace *::before,
          .local-products-workspace *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
      <AnimatePresence initial={false}>
        {isHeaderActionsMenuOpen ? (
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
            className="fixed inset-0 z-[1190] bg-black/55 backdrop-blur-[2px]"
            onClick={() => setIsHeaderActionsMenuOpen(false)}
          />
        ) : null}
      </AnimatePresence>
      <section className="flex w-full flex-col xl:min-h-[calc(100dvh-4rem)]">
        <header
          data-actions-open={isHeaderActionsMenuOpen ? "true" : undefined}
          style={isHeaderActionsMenuOpen ? { clipPath: "none" } : undefined}
          className={`luxury-header overflow-visible border border-white/[0.08] bg-[#090b10]/95 shadow-[0_16px_46px_rgba(0,0,0,0.34)] backdrop-blur-xl ${isHeaderActionsMenuOpen
            ? "fixed inset-x-0 top-0 z-[1200]"
            : "relative z-30"
            }`}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#d8c99f]/[0.55] to-transparent"
          />

          <div className="relative grid w-full grid-cols-1 gap-2 xl:flex xl:flex-col xl:items-stretch xl:gap-1.5 xl:p-2">
            <div className="grid min-w-0 grid-cols-4 divide-x divide-[#d8c99f]/10 overflow-hidden border border-[#d8c99f]/[0.15] bg-[linear-gradient(135deg,rgba(216,201,159,0.055),rgba(255,255,255,0.012))] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] xl:hidden">
              <span className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap px-2 py-1.5 text-[9px] font-medium text-slate-500 xl:min-h-8 xl:justify-between xl:border-l xl:border-[#d8c99f]/20 xl:bg-black/20 xl:px-3 xl:py-2 xl:text-[8px] xl:font-bold xl:uppercase xl:tracking-[0.08em] xl:text-slate-400">
                <span className="font-bold tabular-nums text-[#d8c99f] xl:text-xs xl:font-black">
                  {activeProductCount}
                </span>
                đang bán
              </span>
              <span className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap px-2 py-1.5 text-[9px] font-medium text-slate-500 xl:min-h-8 xl:justify-between xl:border-l xl:border-[#d8c99f]/20 xl:bg-black/20 xl:px-3 xl:py-2 xl:text-[8px] xl:font-bold xl:uppercase xl:tracking-[0.08em] xl:text-slate-400">
                <span className="font-bold tabular-nums text-[#d8c99f] xl:text-xs xl:font-black">
                  {soldProductCount}
                </span>
                đã bán
              </span>
              <span className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap px-2 py-1.5 text-[9px] font-medium text-slate-500 xl:min-h-8 xl:justify-between xl:border-l xl:border-[#d8c99f]/20 xl:bg-black/20 xl:px-3 xl:py-2 xl:text-[8px] xl:font-bold xl:uppercase xl:tracking-[0.08em] xl:text-slate-400">
                <span className="font-bold tabular-nums text-[#d8c99f] xl:text-xs xl:font-black">
                  {totalImages}
                </span>
                ảnh
              </span>
              <span className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap px-2 py-1.5 text-[9px] font-medium text-slate-500 xl:min-h-8 xl:justify-between xl:border-l xl:border-r xl:border-[#d8c99f]/20 xl:bg-black/20 xl:px-3 xl:py-2 xl:text-[8px] xl:font-bold xl:uppercase xl:tracking-[0.08em] xl:text-slate-400">
                <span className="font-bold tabular-nums text-[#d8c99f] xl:text-xs xl:font-black">
                  {postedTodayCount}/{totalTodayTaskCount}
                </span>
                đã đăng
              </span>
            </div>

            <div
              id="header-action-menu"
              className={`${isHeaderActionsMenuOpen
                ? "header-actions-menu-open fixed inset-x-2 top-2 z-[1201] grid max-h-[calc(100dvh-1rem)] origin-top overflow-x-hidden overflow-y-auto overscroll-contain shadow-[0_24px_70px_rgba(0,0,0,0.68)]"
                : "grid"
                } grid-cols-4 gap-1 border border-[#d8c99f]/10 bg-[#070c13]/98 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] md:grid-cols-6 xl:inset-x-4 xl:grid-cols-[repeat(18,minmax(0,1fr))] xl:border-[#d8c99f]/[0.16] xl:bg-[linear-gradient(90deg,rgba(255,255,255,0.015),rgba(216,201,159,0.045))] xl:p-1.5 xl:shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_12px_30px_rgba(0,0,0,0.2)]`}
              onClickCapture={() => {
                if (isHeaderActionsMenuOpen) {
                  setIsHeaderActionsMenuOpen(false);
                }
              }}
            >
              <button
                type="button"
                data-luxury-accent="gold"
                title="Thêm sản phẩm"
                aria-label="Thêm sản phẩm"
                className={`${headerActionButtonBaseClassName} ${headerPrimaryButtonClassName}`}
                onClick={openProductModalForCreate}
              >
                <FiPlus aria-hidden="true" className={iconClassName} />
                Thêm
              </button>

              <button
                type="button"
                data-luxury-accent="sapphire"
                title="Import Export dữ liệu"
                aria-label="Import Export dữ liệu"
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => openModal("importExport")}
              >
                <FiArchive aria-hidden="true" className={iconClassName} />
                Data
              </button>

              <button
                type="button"
                data-luxury-accent="cyan"
                title={`${isCopyNfkcEnabled ? "Tắt" : "Bật"} chuẩn hóa NFKC tạm thời cho nội dung copy`}
                aria-label={`${isCopyNfkcEnabled ? "Tắt" : "Bật"} chuẩn hóa NFKC cho nội dung copy`}
                aria-pressed={isCopyNfkcEnabled}
                className={`${headerActionButtonBaseClassName} ${isCopyNfkcEnabled
                  ? headerActiveButtonClassName
                  : headerNeutralButtonClassName
                  }`}
                onClick={() => {
                  const nextEnabled = !isCopyNfkcEnabled;

                  setIsCopyNfkcEnabled(nextEnabled);
                  Toastify(
                    `Đã ${nextEnabled ? "bật" : "tắt"} NFKC cho nội dung copy`,
                    200,
                  );
                }}
              >
                <FiRefreshCcw aria-hidden="true" className={iconClassName} />
                NFKC {isCopyNfkcEnabled ? "Bật" : "Tắt"}
              </button>

              <button
                type="button"
                data-luxury-accent="emerald"
                title={includeSocialTags ? "Tắt Tag khi copy" : "Bật Tag khi copy"}
                aria-label={includeSocialTags ? "Tắt Tag khi copy" : "Bật Tag khi copy"}
                aria-pressed={includeSocialTags}
                className={`${headerActionButtonBaseClassName} min-w-0 ${includeSocialTags
                  ? headerActiveButtonClassName
                  : headerNeutralButtonClassName
                  }`}
                onClick={() => {
                  const nextEnabled = !includeSocialTags;

                  setIncludeSocialTags(nextEnabled);
                  Toastify(
                    `Đã ${nextEnabled ? "bật" : "tắt"} Tag cho thiết bị này`,
                    200,
                  );
                }}
              >
                <span
                  aria-hidden="true"
                  className={`relative h-3 w-[18px] flex-none overflow-hidden border transition-colors duration-200 ${includeSocialTags
                    ? "border-[#17130a]/45 bg-[#17130a]/20"
                    : "border-white/20 bg-black/30"
                    }`}
                >
                  <span
                    className={`absolute top-[2px] h-1.5 w-1.5 transition-[left,background-color] duration-200 ${includeSocialTags
                      ? "left-[10px] bg-[#17130a]"
                      : "left-[2px] bg-slate-400"
                      }`}
                  />
                </span>
                <span className="min-w-0 truncate">
                  {includeSocialTags ? "Bật Tag" : "Tắt Tag"}
                </span>
              </button>

              <button
                type="button"
                data-luxury-accent={
                  settings.autoCopyShareMode === "post" ? "sapphire" : "amber"
                }
                title={`Tùy chọn copy cho Chia sẻ và Tải ảnh · hiện đang chọn ${settings.autoCopyShareMode === "post" ? "Post" : "Cmt"}`}
                aria-label={`Mở tùy chọn copy cho Chia sẻ và Tải ảnh, hiện đang chọn ${settings.autoCopyShareMode === "post" ? "Post" : "Cmt"}`}
                className={`${headerActionButtonBaseClassName} ${headerActiveButtonClassName}`}
                onClick={() => openModal("shareCopyOption")}
              >
                <FiShare2 aria-hidden="true" className={iconClassName} />
                <span className="min-w-0 truncate">
                  Copy {settings.autoCopyShareMode === "post" ? "Post" : "Cmt"}
                </span>
              </button>

              <button
                type="button"
                data-luxury-accent="violet"
                title="Bảng sản phẩm"
                aria-label="Bảng sản phẩm"
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => openModal("productList")}
              >
                <FiDatabase aria-hidden="true" className={iconClassName} />
                List
              </button>

              <button
                type="button"
                data-luxury-accent="amber"
                title="Lịch đăng"
                aria-label="Lịch đăng"
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => openModal("schedule")}
              >
                <FiCalendar aria-hidden="true" className={iconClassName} />
                Lịch
              </button>

              <button
                type="button"
                data-luxury-accent="emerald"
                title={
                  hourlyNotificationConfig.enabled
                    ? `Thông báo đang bật${nextHourlyNotificationAt
                      ? ` · kế tiếp ${formatLocalDateTime(nextHourlyNotificationAt)}`
                      : ""
                    }`
                    : "Cấu hình thông báo theo thời gian"
                }
                aria-label="Cấu hình thông báo theo thời gian"
                aria-pressed={hourlyNotificationConfig.enabled}
                className={`${headerActionButtonBaseClassName} ${hourlyNotificationConfig.enabled
                  ? headerActiveButtonClassName
                  : headerNeutralButtonClassName
                  }`}
                onClick={() => {
                  setHourlyNotificationDraft(hourlyNotificationConfig);
                  openModal("hourlyNotification");
                }}
              >
                <FiBell aria-hidden="true" className={iconClassName} />
                {hourlyNotificationConfig.enabled ? "Giờ: Bật" : "Giờ: Tắt"}
              </button>

              <button
                type="button"
                data-luxury-accent="rose"
                title="Ghi chú"
                aria-label="Ghi chú"
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => openModal("globalNote")}
              >
                <FiClipboard aria-hidden="true" className={iconClassName} />
                Ghi chú
              </button>

              <button
                type="button"
                data-luxury-accent="indigo"
                title="Mô tả chung"
                aria-label="Mô tả chung"
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => openModal("globalDescription")}
              >
                <FiFileText aria-hidden="true" className={iconClassName} />
                Mô tả
              </button>

              <button
                type="button"
                data-luxury-accent="cyan"
                title="Tải ảnh"
                aria-label="Tải ảnh"
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => openModal("imageDownload")}
              >
                <FiDownload aria-hidden="true" className={iconClassName} />
                Ảnh
              </button>

              <button
                type="button"
                data-luxury-accent="emerald"
                title="Quản lý ảnh trong thư mục đã chọn"
                aria-label="Quản lý ảnh trên máy"
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => openModal("localImageManager")}
              >
                <FiArchive aria-hidden="true" className={iconClassName} />
                Ảnh máy
              </button>

              <button
                type="button"
                data-luxury-accent="rose"
                title={`Xóa ${downloadedProductIds.size} trạng thái ảnh đã tải trong phiên hiện tại`}
                aria-label="Xóa trạng thái ảnh đã tải trong sessionStorage"
                disabled={downloadedProductIds.size === 0}
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName} disabled:cursor-not-allowed disabled:opacity-40`}
                onClick={clearDownloadedProductSession}
              >
                <FiTrash2 aria-hidden="true" className={iconClassName} />
                Xóa phiên
              </button>

              <button
                type="button"
                data-luxury-accent="amethyst"
                title={
                  pictureInPictureWindow
                    ? "Đóng cửa sổ nổi và trở lại tab"
                    : "Mở Local Product Manager dạng cửa sổ nổi"
                }
                aria-label={
                  pictureInPictureWindow
                    ? "Đóng cửa sổ nổi và trở lại tab"
                    : "Mở Local Product Manager dạng cửa sổ nổi"
                }
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => {
                  if (pictureInPictureWindow) {
                    handleClosePictureInPicture();
                    return;
                  }

                  void handleOpenPictureInPicture();
                }}
              >
                <FiMonitor aria-hidden="true" className={iconClassName} />
                {pictureInPictureWindow ? "Về tab" : "Nổi"}
              </button>

              <button
                type="button"
                data-luxury-accent="sapphire"
                title="Quản lý Fanpage, Asset ID và Group"
                aria-label="Quản lý Fanpage, Asset ID và Group"
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => openModal("facebookPages")}
              >
                <FiShare2 aria-hidden="true" className={iconClassName} />
                Facebook
              </button>

              <button
                type="button"
                data-luxury-accent="amber"
                title="Mở công cụ đăng bài, tạo tin và nhân bản Fanpage"
                aria-label="Mở công cụ Fanpage"
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => openModal("facebookDuplicatePosts")}
              >
                <FiShare2 aria-hidden="true" className={iconClassName} />
                Fanpage
              </button>

              <button
                type="button"
                data-luxury-accent="indigo"
                title="Mở và sắp xếp nhiều popup Facebook Search"
                aria-label="Mở và sắp xếp nhiều popup Facebook Search"
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => setIsFacebookSearchDialogOpen(true)}
              >
                <FiSearch aria-hidden="true" className={iconClassName} />
                FB Search
              </button>

              <button
                type="button"
                data-luxury-accent="teal"
                title={
                  activeContactOption
                    ? `${activeContactLabel}: ${activeContactOption.text}`
                    : "Chưa chọn liên hệ cho thiết bị này"
                }
                aria-label={`Liên hệ khi copy Post hoặc Cmt: ${activeContactLabel}`}
                aria-pressed={Boolean(activeContactOption)}
                className={`${headerActionButtonBaseClassName} ${activeContactOption
                  ? headerActiveButtonClassName
                  : headerNeutralButtonClassName
                  }`}
                onClick={() => openModal("contact")}
              >
                <FiPhone aria-hidden="true" className={iconClassName} />
                <span className="min-w-0 truncate">{activeContactLabel}</span>
              </button>

              <button
                type="button"
                data-luxury-accent="cyan"
                title="Làm mới trang bằng dữ liệu cache trên thiết bị"
                aria-label="Làm mới trang bằng dữ liệu cache trên thiết bị"
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => void handleReloadPage()}
              >
                <FiRotateCw aria-hidden="true" className={iconClassName} />
                Làm mới
              </button>

              <button
                type="button"
                data-luxury-accent="blue"
                title="Lấy dữ liệu mới từ MongoDB và cập nhật cache thiết bị"
                aria-label="Lấy dữ liệu mới từ MongoDB và cập nhật cache thiết bị"
                className={`${headerActionButtonBaseClassName} ${headerNeutralButtonClassName}`}
                onClick={() => void handleRefreshCloudData()}
              >
                <FiRefreshCcw aria-hidden="true" className={iconClassName} />
                Đồng bộ
              </button>

            </div>
          </div>
        </header>

        <section className="luxury-content-panel border p-3">
          <div className="mb-3">
            <label className="luxury-search flex items-center gap-2 border px-3 py-2 text-slate-400 transition focus-within:text-[#eadfbe]">
              <FiSearch
                aria-hidden="true"
                className={`${iconClassName} shrink-0`}
              />
              <input
                ref={searchInputRef}
                // autoFocus
                type="text"
                value={query}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                className="w-full bg-transparent text-xs font-semibold text-white outline-none placeholder:text-slate-500"
                placeholder="Tìm tất cả sản phẩm"
              />
            </label>
          </div>

          <AnimatePresence initial={false}>
            {isMobileCategoryMenuOpen ? (
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: prefersReducedMotion ? 0.1 : 0.22,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="fixed inset-0 z-[999] touch-none bg-black/60 backdrop-blur-[2px] md:hidden"
                onClick={() => setIsMobileCategoryMenuOpen(false)}
              />
            ) : null}
          </AnimatePresence>

          <div className="fixed bottom-3 right-2 z-[1000] md:hidden">
            <AnimatePresence initial={false}>
              {isMobileCategoryMenuOpen ? (
                <motion.div
                  id="mobile-category-menu"
                  initial={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, x: 24, scale: 0.98 }
                  }
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, x: 20, scale: 0.98 }
                  }
                  transition={{
                    duration: prefersReducedMotion ? 0.12 : 0.3,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="absolute bottom-[calc(100%+0.65rem)] right-0 flex max-h-[68dvh] w-[min(84vw,320px)] touch-pan-y flex-col items-end gap-2 overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain py-2 pl-8 pr-1 [mask-image:linear-gradient(to_bottom,transparent,black_5%,black_95%,transparent)]"
                >
                  {orderedCategoryTabs.map((category, index) => {
                    const isActive =
                      normalizeTextKey(activeCategoryTab) ===
                      normalizeTextKey(category);

                    return (
                      <motion.button
                        key={category}
                        type="button"
                        data-category-bubble="true"
                        data-category-colored={
                          category === "all" ? undefined : "true"
                        }
                        data-active={isActive}
                        style={
                          category === "all"
                            ? undefined
                            : createCategoryColorStyle(
                              category,
                              settings.categoryColors,
                            )
                        }
                        initial={
                          prefersReducedMotion
                            ? { opacity: 0 }
                            : {
                              opacity: 0,
                              x: 48,
                              y: index % 2 === 0 ? 11 : -5,
                              scale: 0.92,
                            }
                        }
                        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        exit={
                          prefersReducedMotion
                            ? { opacity: 0 }
                            : { opacity: 0, x: 28, scale: 0.94 }
                        }
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.1 }
                            : {
                              delay: index * 0.045,
                              type: "spring",
                              stiffness: 270,
                              damping: 24,
                              mass: 0.78,
                            }
                        }
                        whileTap={
                          prefersReducedMotion ? undefined : { scale: 0.96, x: -3 }
                        }
                        className={`relative flex w-fit max-w-[calc(50vw-8px)] items-center justify-end rounded-[18px] border px-4 py-2.5 text-right text-xs font-black uppercase tracking-[0.055em] backdrop-blur-xl ${isActive
                          ? "border-[#f1e5c2]/75 bg-[linear-gradient(135deg,#f2e8cd,#bda66d)] text-[#17130a] shadow-[0_16px_42px_rgba(190,164,99,0.24)]"
                          : "border-[#d8c99f]/[0.18] bg-[linear-gradient(145deg,rgba(15,18,25,0.96),rgba(6,8,12,0.98))] text-slate-200 shadow-[0_16px_42px_rgba(0,0,0,0.48)]"
                          }`}
                        onClick={() => {
                          setActiveCategoryTab(category);
                          setIsMobileCategoryMenuOpen(false);
                        }}
                      >
                        <span className="block max-w-[calc(50vw-40px)] overflow-hidden text-ellipsis whitespace-nowrap">
                          {category === "all" ? "Tất cả" : category}
                        </span>
                        <span
                          aria-hidden="true"
                          data-category-tail="true"
                          className={`absolute -bottom-1 right-4 h-2.5 w-2.5 rotate-45 border-b border-r ${isActive
                            ? "border-[#f1e5c2]/70 bg-[#cdbb88]"
                            : "border-[#d8c99f]/[0.18] bg-[#090c11]"
                            }`}
                        />
                      </motion.button>
                    );
                  })}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <motion.button
              type="button"
              aria-controls="mobile-category-menu"
              aria-expanded={isMobileCategoryMenuOpen}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
              className={`flex min-h-11 min-w-24 items-center justify-center border px-4 text-xs font-black tracking-[0.08em] backdrop-blur-xl transition ${isMobileCategoryMenuOpen
                ? "border-[#f1e5c2]/80 bg-[linear-gradient(135deg,#f2e8cd,#bda66d)] text-[#17130a] shadow-[0_14px_38px_rgba(190,164,99,0.26)]"
                : "border-[#d8c99f]/25 bg-[linear-gradient(145deg,rgba(15,18,25,0.96),rgba(5,7,10,0.98))] text-[#eadfbe] shadow-[0_14px_38px_rgba(0,0,0,0.52)]"
                }`}
              onClick={() =>
                setIsMobileCategoryMenuOpen((current) => !current)
              }
            >
              {isMobileCategoryMenuOpen ? "Đóng" : "Danh mục"}
            </motion.button>
          </div>

          <div
            className={`fixed bottom-3 left-2 flex-row items-center gap-2 md:bottom-[72px] md:gap-1.5 ${isScrollTopVisible ? "flex" : "hidden"} ${isHeaderActionsMenuOpen ? "z-[1202]" : "z-[1000]"}`}
          >
            <motion.button
              type="button"
              aria-controls="header-action-menu"
              aria-expanded={isHeaderActionsMenuOpen}
              aria-label={
                isHeaderActionsMenuOpen
                  ? "Đóng menu chức năng header"
                  : "Mở menu chức năng header"
              }
              title={
                isHeaderActionsMenuOpen
                  ? "Đóng menu chức năng"
                  : "Mở menu chức năng"
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
              className={`flex h-11 w-11 shrink-0 items-center justify-center border backdrop-blur-xl transition md:h-9 md:w-9 ${isHeaderActionsMenuOpen
                ? "border-[#f1e5c2]/80 bg-[linear-gradient(135deg,#f2e8cd,#bda66d)] text-[#17130a] shadow-[0_14px_38px_rgba(190,164,99,0.26)]"
                : "border-[#d8c99f]/25 bg-[linear-gradient(145deg,rgba(15,18,25,0.96),rgba(5,7,10,0.98))] text-[#eadfbe] shadow-[0_14px_38px_rgba(0,0,0,0.52)]"
                }`}
              onClick={() => {
                setIsMobileCategoryMenuOpen(false);
                setIsHeaderActionsMenuOpen((current) => !current);
              }}
            >
              {isHeaderActionsMenuOpen ? (
                <FiX aria-hidden="true" className="h-5 w-5 md:h-4 md:w-4" />
              ) : (
                <FiMenu aria-hidden="true" className="h-5 w-5 md:h-4 md:w-4" />
              )}
            </motion.button>

            <AnimatePresence initial={false}>
              {isScrollTopVisible ? (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, x: -8, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -6, scale: 0.9 }}
                  transition={{
                    duration: prefersReducedMotion ? 0.1 : 0.2,
                  }}
                  aria-label="Cuộn lên đầu trang"
                  title="Lên đầu trang"
                  className="flex h-11 w-11 shrink-0 items-center justify-center border border-cyan-200/35 bg-[linear-gradient(145deg,rgba(14,37,50,0.97),rgba(5,13,20,0.98))] text-cyan-100 shadow-[0_12px_32px_rgba(0,0,0,0.42)] backdrop-blur-xl transition hover:border-cyan-200/60 hover:bg-cyan-300/15 active:scale-95 md:h-9 md:w-9"
                  onClick={handleScrollToTop}
                >
                  <FiArrowUp aria-hidden="true" className="h-5 w-5 md:h-4 md:w-4" />
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>

          <AnimatePresence initial={false}>
            {draggingCategory ? (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
                style={createCategoryColorStyle(
                  draggingCategory,
                  settings.categoryColors,
                )}
                className="category-drag-hud pointer-events-none fixed bottom-[48px] left-1/2 z-[1002] hidden -translate-x-1/2 items-center gap-2 border px-3 py-2 backdrop-blur-xl md:flex"
              >
                <span className="category-drag-hud-block border px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em]">
                  {draggingCategory}
                </span>
                <span className="whitespace-nowrap text-[10px] font-bold text-slate-200">
                  Thả vào taskbar để sắp xếp
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="fixed bottom-[36px] left-0 z-bar hidden h-[26px] w-fit items-stretch overflow-hidden border border-[#d8c99f]/25 bg-[linear-gradient(90deg,rgba(216,201,159,0.1),rgba(6,13,21,0.97))] shadow-[0_-8px_24px_rgba(0,0,0,0.28)] backdrop-blur-xl xl:flex">
            <span className="flex items-center gap-1 border-r border-[#d8c99f]/15 px-2 text-[7px] font-bold uppercase tracking-[0.03em] text-slate-400">
              <span className="text-[9px] font-black tabular-nums text-[#d8c99f]">
                {activeProductCount}
              </span>
              đang bán
            </span>
            <span className="flex items-center gap-1 border-r border-[#d8c99f]/15 px-2 text-[7px] font-bold uppercase tracking-[0.03em] text-slate-400">
              <span className="text-[9px] font-black tabular-nums text-[#d8c99f]">
                {soldProductCount}
              </span>
              đã bán
            </span>
            <span className="flex items-center gap-1 border-r border-[#d8c99f]/15 px-2 text-[7px] font-bold uppercase tracking-[0.03em] text-slate-400">
              <span className="text-[9px] font-black tabular-nums text-[#d8c99f]">
                {totalImages}
              </span>
              ảnh
            </span>
            <span className="flex items-center gap-1 px-2 text-[7px] font-bold uppercase tracking-[0.03em] text-slate-400">
              <span className="text-[9px] font-black tabular-nums text-[#d8c99f]">
                {postedTodayCount}/{totalTodayTaskCount}
              </span>
              đã đăng
            </span>
          </div>

          <div
            ref={categoryTabsRef}
            data-category-dragging={draggingCategoryKey ? "true" : undefined}
            className="luxury-category-bar fixed bottom-0 left-0 right-0 z-bar hidden h-[36px] items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain overscroll-y-none whitespace-nowrap border-t md:flex"
            onDragOver={handleCategoryBarDragOver}
            onDrop={handleCategoryBarDrop}
          >
            <button
              type="button"
              data-category-tab="all"
              aria-pressed={activeCategoryTab === "all"}
              className={`flex h-[35px] shrink-0 items-center justify-center border-r border-[#d8c99f]/10 px-5 text-xs font-black uppercase tracking-[0.08em] transition ${activeCategoryTab === "all"
                ? "bg-[linear-gradient(135deg,#f2e8cd,#bda66d)] text-[#17130a]"
                : "bg-black/20 text-slate-300 hover:bg-[#d8c99f]/10 hover:text-[#eadfbe]"
                }`}
              onClick={() => setActiveCategoryTab("all")}
            >
              Tất cả
            </button>

            {categories.map((category) => {
              const categoryKey = normalizeTextKey(category);
              const isDragging = draggingCategoryKey === categoryKey;
              const dropPosition =
                categoryDropTarget?.key === categoryKey
                  ? categoryDropTarget.position
                  : null;

              return (
                <button
                  key={category}
                  type="button"
                  draggable
                  data-category-tab={categoryKey}
                  data-category-colored="true"
                  data-category-dragging={isDragging ? "true" : undefined}
                  data-category-drop-target={dropPosition ?? undefined}
                  style={createCategoryColorStyle(
                    category,
                    settings.categoryColors,
                  )}
                  aria-pressed={
                    normalizeTextKey(activeCategoryTab) === categoryKey
                  }
                  aria-label={`${category}. Kéo để thay đổi thứ tự danh mục`}
                  title="Giữ và kéo để sắp xếp danh mục"
                  className={`relative flex h-[35px] shrink-0 cursor-grab select-none items-center justify-center border-r border-[#d8c99f]/10 px-5 text-xs font-black uppercase tracking-[0.08em] transition active:cursor-grabbing ${normalizeTextKey(activeCategoryTab) === categoryKey
                    ? "bg-[linear-gradient(135deg,#f2e8cd,#bda66d)] text-[#17130a]"
                    : "bg-black/20 text-slate-200 hover:bg-[#d8c99f]/10 hover:text-[#eadfbe]"
                    }`}
                  onDragStart={(event) =>
                    handleCategoryDragStart(event, category)
                  }
                  onDragOver={(event) =>
                    handleCategoryDragOver(event, category)
                  }
                  onDrop={(event) => handleCategoryDrop(event, category)}
                  onDragEnd={resetCategoryDrag}
                  onClick={() => setActiveCategoryTab(category)}
                >
                  {dropPosition ? (
                    <span
                      aria-hidden="true"
                      className={`category-drop-marker absolute bottom-1 top-1 w-1 ${dropPosition === "before"
                        ? "-left-0.5"
                        : "-right-0.5"
                        }`}
                    />
                  ) : null}
                  <span className="relative z-[1]">{category}</span>
                </button>
              );
            })}
          </div>

          <div
            onTouchStart={handleProductsTouchStart}
            onTouchEnd={handleProductsTouchEnd}
          >
            {filteredProducts.length === 0 ? (
              <div className="luxury-dialog border p-5 text-center text-xs font-semibold tracking-wide text-slate-400">
                Chưa có sản phẩm phù hợp.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 xl:gap-4 xl:[grid-template-columns:repeat(auto-fill,minmax(218px,1fr))]">
                {visibleProducts.map((product, index) => {
                  const descriptionPreview =
                    product.description.trim() ||
                    settings.commonDescription.trim();
                  const active = selectedProductId === product.id;
                  const expanded = expandedProductIds.has(product.id);
                  const productDone = product.isDone;
                  const pinText = product.pin.trim();
                  const statusText = product.status.trim();
                  const imagesDownloaded =
                    downloadedProductIds.has(product.id);

                  return (
                    <article
                      key={`${activeCategoryTab}-${product.id}`}
                      data-active={active}
                      data-done={productDone}
                      data-content-type={product.contentType}
                      data-category-colored={
                        product.category ? "true" : undefined
                      }
                      style={{
                        ...createCategoryColorStyle(
                          product.category,
                          settings.categoryColors,
                        ),
                        animationDelay: `${Math.min(index * 34, 340)}ms`,
                        contentVisibility: "auto",
                        containIntrinsicSize: "520px",
                      }}
                      className={`luxury-product-card product-wave-card group min-w-0 overflow-hidden border transition duration-300 hover:-translate-y-1 ${productDone ? "opacity-65" : ""
                        } ${active
                          ? "border-[#e8d9ae]/70 bg-[#15140f]"
                          : "border-[#d8c99f]/[0.15] bg-[#0b0e14]"
                        }`}
                      onClickCapture={() => setSelectedProductId(product.id)}
                      onClick={() => {
                        handleEdit(product);
                      }}
                    >
                      <button
                        type="button"
                        data-image-surface="true"
                        className={`luxury-product-image relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden ${productDone
                          ? "after:absolute after:inset-0 after:bg-slate-950/30"
                          : ""
                          }`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openImageAlbum({
                            productId: product.id,
                            title: product.name,
                            description: descriptionPreview,
                            priceText: product.priceText,
                            contentType: product.contentType,
                            realEstateComment: product.realEstateComment,
                            images: product.images,
                            internalImages: product.internalImages,
                          });
                        }}
                      >
                        {product.images[0] ? (
                          <img
                            src={createCloudinaryThumbnailUrl(
                              product.images[0].dataUrl,
                            )}
                            alt={product.name}
                            width={1200}
                            height={1200}
                            loading={index < 4 ? "eager" : "lazy"}
                            decoding="async"
                            className={`h-full w-full object-contain transition glass duration-500 group-hover:scale-105 ${productDone ? "blur-[2px] grayscale opacity-40" : ""
                              }`}
                          />
                        ) : (
                          <FiImage
                            aria-hidden="true"
                            className={`${iconClassName} text-slate-600`}
                          />
                        )}

                        <div className="absolute left-2 top-2 z-10 flex items-center gap-1 border border-[#d8c99f]/20 bg-black/70 px-2 py-0.5 text-[10px] font-black text-[#eadfbe] backdrop-blur-md [clip-path:polygon(5px_0,100%_0,100%_calc(100%_-_5px),calc(100%_-_5px)_100%,0_100%,0_5px)]">
                          <FiImage aria-hidden="true" className={iconClassName} />
                          {product.images.length}
                        </div>

                        {imagesDownloaded ? (
                          <span
                            title="Ảnh đã được đánh dấu tải về trong phiên này"
                            className="absolute left-2 top-9 z-10 border border-emerald-200/35 bg-emerald-300/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-emerald-100 backdrop-blur-md [clip-path:polygon(5px_0,100%_0,100%_calc(100%_-_5px),calc(100%_-_5px)_100%,0_100%,0_5px)]"
                          >
                            Ảnh đã tải
                          </span>
                        ) : null}

                        <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
                          {pinText ? (
                            <span
                              title={`Pin: ${pinText}`}
                              className="flex max-w-[120px] items-center gap-1 border border-emerald-200/25 bg-black/70 px-2 py-0.5 text-[10px] font-black text-emerald-100 backdrop-blur-md [clip-path:polygon(5px_0,100%_0,100%_calc(100%_-_5px),calc(100%_-_5px)_100%,0_100%,0_5px)]"
                            >
                              <FiBattery
                                aria-hidden="true"
                                className={iconClassName}
                              />
                              <span className="truncate">{pinText}</span>
                            </span>
                          ) : null}

                          {statusText ? (
                            <span
                              title={`Trạng thái: ${statusText}`}
                              className="max-w-[120px] truncate border border-[#d8c99f]/25 bg-black/70 px-2 py-0.5 text-[9px] font-black text-[#eadfbe] backdrop-blur-md [clip-path:polygon(5px_0,100%_0,100%_calc(100%_-_5px),calc(100%_-_5px)_100%,0_100%,0_5px)]"
                            >
                              {statusText}
                            </span>
                          ) : null}

                          {productDone ? (
                            <span className="border border-white/35 bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-950 [clip-path:polygon(5px_0,100%_0,100%_calc(100%_-_5px),calc(100%_-_5px)_100%,0_100%,0_5px)]">
                              DONE
                            </span>
                          ) : null}

                          {active ? (
                            <span className="border border-[#f1e5c2]/80 bg-[linear-gradient(135deg,#f2e8cd,#bda66d)] px-2 py-1 text-[10px] font-black text-[#17130a] [clip-path:polygon(5px_0,100%_0,100%_calc(100%_-_5px),calc(100%_-_5px)_100%,0_100%,0_5px)]">
                              ACTIVE
                            </span>
                          ) : null}
                        </div>
                      </button>

                      <div className="flex min-w-0 flex-col gap-2 p-2">
                        <div className="">
                          {product.contentType === "realEstate" || product.category ? (
                            <div className="mb-1 flex min-w-0 items-center gap-1.5">
                              {product.contentType === "realEstate" ? (
                                <span className="shrink-0 border border-amber-300/40 bg-amber-300/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-amber-100">
                                  BĐS
                                </span>
                              ) : null}
                              {product.category ? (
                                <span className="category-color-label min-w-0 truncate border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]">
                                  {product.category}
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          <h3 className={`${fullCardItemNameClassName} text-[12px] font-black leading-[18px] text-white`}>
                            {product.name}
                          </h3>
                          <div className="mt-1 truncate text-xs font-black text-[#f1e5c2]">
                            {product.priceText || "Chưa có giá"}
                          </div>
                        </div>

                        <div
                          role={descriptionPreview.length > 90 ? "button" : undefined}
                          tabIndex={descriptionPreview.length > 90 ? 0 : undefined}
                          aria-expanded={descriptionPreview.length > 90 ? expanded : undefined}
                          className={`w-full min-w-0 border border-[#d8c99f]/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))] p-2 [clip-path:polygon(7px_0,100%_0,100%_calc(100%_-_7px),calc(100%_-_7px)_100%,0_100%,0_7px)] ${descriptionPreview.length > 90
                            ? "cursor-pointer transition hover:border-[#d8c99f]/30 hover:bg-[#d8c99f]/[0.045]"
                            : ""
                            }`}
                          onMouseUp={(event) => {
                            event.stopPropagation();
                            updateSelectedDescriptionCopy(
                              product.id,
                              event.currentTarget,
                            );
                          }}
                          onTouchEnd={(event) => {
                            event.stopPropagation();
                            updateSelectedDescriptionCopy(
                              product.id,
                              event.currentTarget,
                            );
                          }}
                          onClick={(event) => {
                            event.stopPropagation();

                            const hasSelectedText = updateSelectedDescriptionCopy(
                              product.id,
                              event.currentTarget,
                            );

                            if (hasSelectedText) return;

                            if (descriptionPreview.length > 90) {
                              toggleExpandedProduct(product.id);
                            }
                          }}
                          onKeyDown={(event) => {
                            event.stopPropagation();

                            if (
                              descriptionPreview.length > 90 &&
                              (event.key === "Enter" || event.key === " ")
                            ) {
                              event.preventDefault();
                              toggleExpandedProduct(product.id);
                            }
                          }}
                        >
                          <div
                            className={`${expanded ? "line-clamp-none" : "line-clamp-2"
                              } w-full min-w-0 whitespace-pre-wrap p-1 text-[11px] leading-[18px] text-slate-300 [overflow-wrap:anywhere]`}
                          >
                            {renderDescriptionText(
                              product.id,
                              descriptionPreview,
                              expanded,
                            )}
                          </div>
                          {selectedDescriptionCopy?.productId === product.id &&
                            selectedDescriptionCopy.text ? (
                            <button
                              type="button"
                              data-luxury-accent="emerald"
                              className="mt-2 inline-flex w-full items-center justify-center gap-1 border border-emerald-300/40 bg-emerald-300/[0.07] px-1.5 py-1 text-[9px] font-black text-emerald-100 transition hover:border-emerald-200/60 hover:bg-emerald-300/[0.12] active:opacity-80"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleCopySelectedDescription(product.id);
                              }}
                            >
                              {renderCopyIcon(`selected-description-${product.id}`)}
                              Copy phần đã chọn
                            </button>
                          ) : null}
                          {descriptionPreview.length > 90 ? (
                            <button
                              type="button"
                              className="mt-2 text-[11px] font-black text-slate-300"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleExpandedProduct(product.id);
                              }}
                            >
                              {expanded ? "Thu gọn" : "Xem thêm"}
                            </button>
                          ) : null}
                        </div>

                        <div className="grid  grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            data-luxury-accent="cyan"
                            title="Copy ảnh chính"
                            aria-label="Copy ảnh chính"
                            className={`${productActionButtonBaseClassName} border-[#d8c99f]/[0.32] bg-[#d8c99f]/[0.055] text-[#eadfbe] hover:border-[#f1e5c2]/[0.55] hover:bg-[#d8c99f]/10`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCopyProductRepresentativeImage(product);
                            }}
                          >
                            {renderCopyIcon(`cover-${product.id}`)}
                            <span className=" truncate whitespace-nowrap">Ảnh Chính</span>
                          </button>

                          <button
                            type="button"
                            data-luxury-accent="sapphire"
                            title="Chia sẻ sản phẩm"
                            aria-label="Chia sẻ sản phẩm"
                            className={`${productActionButtonBaseClassName} border-[#d8c99f]/[0.32] bg-[#d8c99f]/[0.055] text-[#eadfbe] hover:border-[#f1e5c2]/[0.55] hover:bg-[#d8c99f]/10`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleShareProduct(product);
                            }}
                          >
                            {copiedKey === `share-product-${product.id}` ? (
                              <FiCheck
                                aria-hidden="true"
                                className={iconClassName}
                              />
                            ) : (
                              <FiShare2
                                aria-hidden="true"
                                className={iconClassName}
                              />
                            )}
                            <span className=" truncate whitespace-nowrap">Chia sẻ</span>
                          </button>

                          <button
                            type="button"
                            data-luxury-accent="indigo"
                            title="Copy nguyên bản mô tả"
                            aria-label="Copy nguyên bản mô tả"
                            className={`${productActionButtonBaseClassName} border-white/[0.12] bg-white/[0.025] text-slate-200 hover:border-[#d8c99f]/[0.35] hover:bg-[#d8c99f]/[0.055] hover:text-[#eadfbe]`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCopyField(
                                `post-${product.id}`,
                                "post",
                                composeCopyText(
                                  descriptionPreview,
                                  activeContactText,
                                  includeSocialTags,
                                ),
                              );
                            }}
                          >
                            {renderCopyIcon(`post-${product.id}`)}
                            <span className=" truncate whitespace-nowrap">Post</span>
                          </button>

                          <button
                            type="button"
                            data-luxury-accent="amber"
                            title="Copy comment sản phẩm"
                            aria-label="Copy comment sản phẩm"
                            className={`${productActionButtonBaseClassName} border-[#d8c99f]/[0.42] bg-[#d8c99f]/[0.07] text-[#f1e5c2] hover:border-[#f1e5c2]/[0.65] hover:bg-[#d8c99f]/[0.12]`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCopyField(
                                `cmt-${product.id}`,
                                "cmt",
                                buildCommentContentText(
                                  product.name,
                                  descriptionPreview,
                                  product.priceText,
                                  activeContactText,
                                  product.contentType,
                                  product.realEstateComment,
                                ),
                              );
                            }}
                          >
                            {renderCopyIcon(`cmt-${product.id}`)}
                            <span className=" truncate whitespace-nowrap">Cmt</span>
                          </button>

                          <button
                            type="button"
                            data-luxury-accent="violet"
                            title="Copy tên sản phẩm"
                            aria-label="Copy tên sản phẩm"
                            className={`${productActionButtonBaseClassName} border-white/[0.12] bg-white/[0.025] text-slate-200 hover:border-[#d8c99f]/[0.35] hover:bg-[#d8c99f]/[0.055] hover:text-[#eadfbe]`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCopyField(
                                `name-${product.id}`,
                                "tên",
                                product.name,
                              );
                            }}
                          >
                            {renderCopyIcon(`name-${product.id}`)}
                            <span className=" truncate whitespace-nowrap">Tên</span>
                          </button>

                          <button
                            type="button"
                            data-luxury-accent={productDone ? "sapphire" : "emerald"}
                            title={productDone ? "Bỏ DONE" : "Đánh dấu DONE"}
                            aria-label={productDone ? "Bỏ DONE" : "Đánh dấu DONE"}
                            className={`${productActionButtonBaseClassName} ${productDone
                              ? "border-white/20 bg-white/[0.055] text-slate-100 hover:border-white/35 hover:bg-white/[0.08]"
                              : "border-emerald-300/[0.38] bg-emerald-300/[0.06] text-emerald-100 hover:border-emerald-200/60 hover:bg-emerald-300/10"
                              }`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleProductDone(product.id);
                            }}
                          >
                            <FiCheckCircle
                              aria-hidden="true"
                              className={iconClassName}
                            />
                            <span className=" truncate whitespace-nowrap">
                              {productDone ? "DONE" : "Chưa bán"}
                            </span>
                          </button>
                          <button
                            type="button"
                            data-luxury-accent="teal"
                            title="Tải ảnh sản phẩm"
                            aria-label="Tải ảnh sản phẩm"
                            className={`${productActionButtonBaseClassName} border-[#b9c4d6]/25 bg-[#b9c4d6]/[0.045] text-[#d9e1ed] hover:border-[#d8c99f]/40 hover:bg-[#d8c99f]/[0.065] hover:text-[#eadfbe]`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDownloadProductImages(product);
                            }}
                          >
                            <FiDownload
                              aria-hidden="true"
                              className={iconClassName}
                            />
                            <span className=" truncate whitespace-nowrap">Tải ảnh</span>
                          </button>

                          <button
                            type="button"
                            data-luxury-accent="rose"
                            title="Xóa sản phẩm"
                            aria-label="Xóa sản phẩm"
                            className={`${productActionButtonBaseClassName} border-rose-300/[0.28] bg-rose-300/[0.045] text-rose-100 hover:border-rose-300/[0.55] hover:bg-rose-300/[0.08]`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDelete(product.id);
                            }}
                          >
                            <FiTrash2
                              aria-hidden="true"
                              className={iconClassName}
                            />
                            <span className=" truncate whitespace-nowrap">Xóa</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {visibleProducts.length < filteredProducts.length ? (
                  <div className="col-span-full flex items-center justify-center gap-2 border border-[#d8c99f]/10 bg-[#d8c99f]/[0.025] px-3 py-2 text-[10px] font-bold text-slate-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#e6cf8b]" />
                    Đang dựng {visibleProducts.length}/{filteredProducts.length} sản phẩm
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </section>

      {activeModal ? (
        <div className="luxury-modal-overlay fixed inset-0 z-modal flex h-dvh w-full items-center justify-center overflow-hidden p-2 xl:p-8">
          <div className="luxury-modal flex h-[calc(100dvh-1rem)] w-full min-w-0 flex-col overflow-hidden border xl:h-[calc(100dvh-4rem)]">
            <div className="luxury-modal-titlebar flex min-w-0 shrink-0 items-center justify-between gap-3 border-b p-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#d8c99f]/30 bg-[#d8c99f]/[0.07] text-[#eadfbe] [clip-path:polygon(7px_0,100%_0,100%_calc(100%_-_7px),calc(100%_-_7px)_100%,0_100%,0_7px)]">
                  {activeModal === "product" ? (
                    <FiPlus aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "productList" ? (
                    <FiDatabase aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "schedule" ? (
                    <FiCalendar aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "hourlyNotification" ? (
                    <FiBell aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "globalNote" ? (
                    <FiClipboard aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "globalDescription" ? (
                    <FiFileText aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "shareCopyOption" ? (
                    <FiShare2 aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "contact" ||
                    activeModal === "contactSelection" ? (
                    <FiPhone aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "facebookPages" ? (
                    <FiShare2 aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "facebookDuplicatePosts" ? (
                    <FiShare2 aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "importExport" ? (
                    <FiArchive aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "slotDetail" ? (
                    <FiClipboard aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "imageAlbum" ? (
                    <FiImage aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "imageDownload" ? (
                    <FiDownload aria-hidden="true" className={iconClassName} />
                  ) : null}
                  {activeModal === "localImageManager" ? (
                    <FiArchive aria-hidden="true" className={iconClassName} />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-xs font-black text-white">
                    {activeModal === "product"
                      ? editingId
                        ? "Sửa sản phẩm"
                        : "Thêm sản phẩm"
                      : null}
                    {activeModal === "productList"
                      ? "Bảng sản phẩm"
                      : null}
                    {activeModal === "schedule" ? "Cấu hình lịch đăng" : null}
                    {activeModal === "hourlyNotification" ? "Thông báo thời gian" : null}
                    {activeModal === "globalNote" ? "Ghi chú" : null}
                    {activeModal === "globalDescription" ? "Mô tả chung" : null}
                    {activeModal === "shareCopyOption"
                      ? "Tùy chọn tự copy"
                      : null}
                    {activeModal === "contactSelection"
                      ? "Chọn liên hệ của bạn"
                      : null}
                    {activeModal === "contact" ? "Liên hệ khi copy" : null}
                    {activeModal === "facebookPages"
                      ? "Fanpage và Group"
                      : null}
                    {activeModal === "facebookDuplicatePosts"
                      ? "Công cụ Fanpage"
                      : null}
                    {activeModal === "importExport"
                      ? "Quản lý dữ liệu"
                      : null}
                    {activeModal === "slotDetail" ? "Chi tiết bài đăng" : null}
                    {activeModal === "imageAlbum" ? "Album ảnh" : null}
                    {activeModal === "imageDownload" ? "Tải ảnh" : null}
                    {activeModal === "localImageManager"
                      ? "Quản lý ảnh trên máy"
                      : null}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                className="group flex h-8 w-8 shrink-0 items-center justify-center border border-[#d8c99f]/20 bg-white/[0.025] text-slate-300 transition hover:border-[#d8c99f]/[0.45] hover:bg-[#d8c99f]/[0.07] hover:text-[#eadfbe] active:opacity-80"
                onClick={closeModal}
              >
                <FiX aria-hidden="true" className={iconClassName} />
              </button>
            </div>

            <div
              className={`min-h-0 min-w-0 flex-1 overflow-x-hidden bg-[radial-gradient(circle_at_50%_0,rgba(216,201,159,0.035),transparent_36%)] p-2 ${activeModal === "imageAlbum" || activeModal === "productList" || activeModal === "product" ? "overflow-hidden" : "overflow-y-auto"}`}
            >
              {activeModal === "localImageManager" ? (
                <section className="mx-auto flex w-full max-w-5xl flex-col gap-3">
                  <article className="border border-white/10 bg-slate-900 p-3">
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                          Thư mục được cấp quyền
                        </p>
                        <h3 className={`${fullCardItemNameClassName} mt-1 text-sm font-black text-white`}>
                          {localImageDirectoryHandle?.name || "Chưa chọn thư mục ảnh"}
                        </h3>
                        <p className="mt-1 text-[10px] leading-4 text-slate-400">
                          Chỉ quản lý file JPG, JPEG, PNG, WebP, HEIC và HEIF ở ngay thư mục này. Không quét toàn ổ D và không quét thư mục con. Thư mục _trash là vùng an toàn của app, không phải Thùng rác Windows.
                        </p>
                        <p className="mt-1 text-[10px] font-black text-amber-100">
                          Quyền: {localImageDirectoryPermission === "granted"
                            ? "Đã cấp"
                            : localImageDirectoryPermission === "denied"
                              ? "Đã từ chối"
                              : "Cần xác nhận lại"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 xl:w-[300px]">
                        <button
                          type="button"
                          disabled={isLocalImageManagerBusy || !canUseDirectoryPicker()}
                          className="border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-[10px] font-black text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => void handleChooseLocalImageDirectory()}
                        >
                          Chọn thư mục ảnh
                        </button>
                        <button
                          type="button"
                          disabled={isLocalImageManagerBusy || !localImageDirectoryHandle}
                          className="border border-white/10 bg-slate-800 px-3 py-2 text-[10px] font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => void handleRefreshLocalImageDirectory()}
                        >
                          Làm mới
                        </button>
                        <button
                          type="button"
                          disabled={!localImageDirectoryHandle}
                          className="col-span-2 border border-rose-300/25 bg-rose-300/[0.05] px-3 py-2 text-[10px] font-black text-rose-100 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={handleForgetLocalImageDirectory}
                        >
                          Bỏ liên kết, không xóa file
                        </button>
                      </div>
                    </div>
                  </article>

                  {!canUseDirectoryPicker() ? (
                    <div className="border border-rose-300/30 bg-rose-300/[0.06] p-3 text-xs leading-5 text-rose-100">
                      File System Access API không khả dụng. Hãy dùng Chrome/Edge desktop và mở app bằng HTTPS.
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                    <div className="border border-white/10 bg-slate-900 p-2.5">
                      <p className="text-[9px] font-black uppercase text-slate-500">Ảnh chính</p>
                      <p className="mt-1 text-sm font-black text-white">{localImageFiles.length}</p>
                    </div>
                    <div className="border border-white/10 bg-slate-900 p-2.5">
                      <p className="text-[9px] font-black uppercase text-slate-500">Dung lượng</p>
                      <p className="mt-1 text-sm font-black text-white">{formatFileSize(localImageTotalSize)}</p>
                    </div>
                    <div className="border border-amber-300/20 bg-amber-300/[0.05] p-2.5">
                      <p className="text-[9px] font-black uppercase text-amber-100/70">Trong _trash</p>
                      <p className="mt-1 text-sm font-black text-amber-100">{localTrashImageFiles.length}</p>
                    </div>
                    <div className="border border-amber-300/20 bg-amber-300/[0.05] p-2.5">
                      <p className="text-[9px] font-black uppercase text-amber-100/70">Dung lượng _trash</p>
                      <p className="mt-1 text-sm font-black text-amber-100">{formatFileSize(localTrashImageTotalSize)}</p>
                    </div>
                  </div>

                  <article className="min-w-0 border border-white/10 bg-slate-900 p-3">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        aria-pressed={localImageView === "active"}
                        className={`border px-3 py-2 text-[10px] font-black transition ${localImageView === "active"
                          ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                          : "border-white/10 bg-slate-800 text-slate-300"}`}
                        onClick={() => {
                          setLocalImageView("active");
                          setSelectedLocalImageNames(new Set<string>());
                        }}
                      >
                        Ảnh đang dùng
                      </button>
                      <button
                        type="button"
                        aria-pressed={localImageView === "trash"}
                        className={`border px-3 py-2 text-[10px] font-black transition ${localImageView === "trash"
                          ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                          : "border-white/10 bg-slate-800 text-slate-300"}`}
                        onClick={() => {
                          setLocalImageView("trash");
                          setSelectedLocalImageNames(new Set<string>());
                        }}
                      >
                        _trash
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
                      <input
                        type="search"
                        value={localImageQuery}
                        onChange={(event) => {
                          setLocalImageQuery(event.target.value);
                          setSelectedLocalImageNames(new Set<string>());
                        }}
                        placeholder="Lọc theo tên file..."
                        className="min-h-9 min-w-0 border border-white/10 bg-slate-950 px-2 text-xs text-white outline-none transition focus:border-cyan-300/50"
                      />
                      <div className="grid grid-cols-2 gap-1.5 xl:flex">
                        <button
                          type="button"
                          disabled={filteredLocalImageFiles.length === 0}
                          className="border border-white/10 bg-slate-800 px-3 py-2 text-[10px] font-black text-white transition hover:bg-slate-700 disabled:opacity-40"
                          onClick={selectAllFilteredLocalImages}
                        >
                          Chọn tất cả lọc
                        </button>
                        <button
                          type="button"
                          disabled={selectedLocalImageNames.size === 0}
                          className="border border-white/10 bg-slate-800 px-3 py-2 text-[10px] font-black text-white transition hover:bg-slate-700 disabled:opacity-40"
                          onClick={() => setSelectedLocalImageNames(new Set<string>())}
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-1.5 xl:grid-cols-2">
                      {localImageView === "active" ? (
                        <button
                          type="button"
                          disabled={selectedLocalImageNames.size === 0 || isLocalImageManagerBusy}
                          className="border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-[10px] font-black text-amber-100 transition hover:bg-amber-300/20 disabled:opacity-40"
                          onClick={handleMoveSelectedLocalImagesToTrash}
                        >
                          Đưa {selectedLocalImageNames.size || "ảnh"} vào _trash
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={selectedLocalImageNames.size === 0 || isLocalImageManagerBusy}
                            className="border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-[10px] font-black text-emerald-100 transition hover:bg-emerald-300/20 disabled:opacity-40"
                            onClick={handleRestoreSelectedLocalImages}
                          >
                            Khôi phục {selectedLocalImageNames.size || "ảnh"}
                          </button>
                          <button
                            type="button"
                            disabled={selectedLocalImageNames.size === 0 || isLocalImageManagerBusy}
                            className="border border-rose-300/35 bg-rose-300/10 px-3 py-2 text-[10px] font-black text-rose-100 transition hover:bg-rose-300/20 disabled:opacity-40"
                            onClick={handlePermanentlyDeleteSelectedLocalImages}
                          >
                            Xóa vĩnh viễn
                          </button>
                        </>
                      )}
                    </div>

                    <div className="mt-3 max-h-[52dvh] min-w-0 overflow-y-auto border border-white/10 bg-slate-950/60">
                      {filteredLocalImageFiles.length === 0 ? (
                        <div className="p-5 text-center text-xs text-slate-500">
                          {localImageDirectoryHandle
                            ? "Không có ảnh phù hợp"
                            : "Chọn thư mục ảnh để bắt đầu quản lý"}
                        </div>
                      ) : (
                        filteredLocalImageFiles
                          .slice(0, LOCAL_IMAGE_RENDER_LIMIT)
                          .map((file) => (
                            <label
                              key={`${localImageView}-${file.name}`}
                              className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/[0.06] p-2.5 last:border-b-0 hover:bg-white/[0.025]"
                            >
                              <input
                                type="checkbox"
                                checked={selectedLocalImageNames.has(file.name)}
                                onChange={() => toggleLocalImageSelection(file.name)}
                                className="h-4 w-4"
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-[11px] font-black text-slate-100" title={file.name}>
                                  {file.name}
                                </span>
                                <span className="mt-0.5 block text-[9px] text-slate-500">
                                  {new Date(file.lastModified).toLocaleString("vi-VN")}
                                </span>
                              </span>
                              <span className="text-[10px] font-black text-slate-400">
                                {formatFileSize(file.size)}
                              </span>
                            </label>
                          ))
                      )}
                    </div>

                    {filteredLocalImageFiles.length > LOCAL_IMAGE_RENDER_LIMIT ? (
                      <p className="mt-2 text-[10px] text-slate-500">
                        Đang hiển thị {LOCAL_IMAGE_RENDER_LIMIT}/{filteredLocalImageFiles.length} file để giữ UI nhẹ. Nút Chọn tất cả lọc vẫn áp dụng cho toàn bộ kết quả.
                      </p>
                    ) : null}
                  </article>
                </section>
              ) : null}

              {activeModal === "imageDownload" ? (
                <section className="grid w-full grid-cols-1 gap-3 xl:grid-cols-2">
                  <article className="flex flex-col rounded-md border border-white/10 bg-slate-900 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-sky-300/20 bg-sky-300/10 text-sky-100">
                        <FiArchive
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      </div>

                      <div className="">
                        <h3 className="text-sm font-black text-white">
                          Tải tất cả ảnh
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          Tải toàn bộ ảnh của các sản phẩm chưa DONE. Sản phẩm
                          đã DONE sẽ luôn được loại khỏi danh sách tải.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-md border border-white/10 bg-slate-950 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Tổng ảnh chưa DONE
                      </p>
                      <p className="mt-1 text-xl font-black text-white">
                        {totalImages}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="mt-3 flex items-center justify-center gap-2 rounded-md bg-sky-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-sky-200 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={totalImages === 0}
                      onClick={handleDownloadAllImages}
                    >
                      <FiDownload
                        aria-hidden="true"
                        className={iconClassName}
                      />
                      Tải tất cả ảnh
                    </button>
                  </article>

                  <article className="flex flex-col rounded-md border border-white/10 bg-slate-900 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                        <FiImage aria-hidden="true" className="h-4 w-4" />
                      </div>

                      <div className="">
                        <h3 className="text-sm font-black text-white">
                          Tải ảnh đại diện
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          Chỉ tải ảnh index 0 của mỗi sản phẩm chưa DONE. Có
                          thể chọn một danh mục hoặc tải tất cả danh mục.
                        </p>
                      </div>
                    </div>

                    <label className="mt-3 block">
                      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-400">
                        Danh mục cần tải
                      </span>
                      <select
                        value={imageDownloadCategory}
                        className="min-h-10 w-full rounded-md border border-slate-600 bg-slate-950 px-2 text-xs font-bold text-white transition focus:border-cyan-300"
                        onChange={(event) =>
                          setImageDownloadCategory(event.target.value)
                        }
                      >
                        <option value="all">
                          Tất cả danh mục ({totalRepresentativeImages})
                        </option>
                        {representativeImageCategoryOptions.map((category) => (
                          <option key={category.name} value={category.name}>
                            {category.name} ({category.count})
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="mt-3 rounded-md border border-white/10 bg-slate-950 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Ảnh đại diện chưa DONE sẽ tải
                      </p>
                      <p className="mt-1 text-xl font-black text-white">
                        {representativeImageProducts.length}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="mt-3 flex items-center justify-center gap-2 rounded-md bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={representativeImageProducts.length === 0}
                      onClick={handleDownloadRepresentativeImages}
                    >
                      <FiDownload
                        aria-hidden="true"
                        className={iconClassName}
                      />
                      Tải ảnh đại diện
                    </button>
                  </article>

                </section>
              ) : null}

              {activeModal === "productList" ? (
                <section className="product-list-dialog flex h-full w-full min-w-0 max-w-full flex-col gap-2 overflow-x-hidden">
                  <div className="grid min-w-0 grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
                    <div className="">
                      <h3 className="text-xs font-black text-white">
                        Bảng sản phẩm
                      </h3>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-md border border-white/10 bg-slate-800 p-2">
                        <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">
                          Tổng
                        </p>
                        <p className="mt-1 text-sm font-black text-white">
                          {filteredProducts.length}
                        </p>
                      </div>

                      <div className="rounded-md border border-emerald-400/20 bg-emerald-400/10 p-2">
                        <p className="text-[9px] font-black uppercase tracking-wide text-slate-300/80">
                          Đã bán
                        </p>
                        <p className="mt-1 text-sm font-black text-emerald-100">
                          {soldProductCount}
                        </p>
                      </div>

                      <div className="rounded-md border border-cyan-400/20 bg-cyan-400/10 p-2">
                        <p className="text-[9px] font-black uppercase tracking-wide text-cyan-200/80">
                          Chưa bán
                        </p>
                        <p className="mt-1 text-sm font-black text-cyan-100">
                          {activeProductCount}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_110px_110px_90px]">
                    <label className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-950/70 px-2 py-1.5 text-slate-400 transition focus-within:border-slate-300 focus-within:bg-slate-950">
                      <FiSearch
                        aria-hidden="true"
                        className={`${iconClassName} shrink-0`}
                      />

                      <input
                        // autoFocus
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                        className="w-full bg-transparent text-xs font-semibold text-white outline-none placeholder:text-slate-500"
                        placeholder="Tìm tên, giá hoặc danh mục"
                      />
                    </label>

                    <button
                      type="button"
                      className="flex items-center justify-center gap-2 rounded-md border border-white/10 bg-slate-800 px-2 py-2 whitespace-nowrap text-xs font-black text-white transition hover:bg-slate-700 active:opacity-80"
                      onClick={() => void handleCopyProductList()}
                    >
                      {copiedKey === "product-list-copy" ? (
                        <FiCheck aria-hidden="true" className={iconClassName} />
                      ) : (
                        <FiCopy aria-hidden="true" className={iconClassName} />
                      )}
                      Copy
                    </button>

                    <button
                      type="button"
                      className="flex items-center justify-center gap-2 rounded-md border border-white/10 bg-slate-800 px-2 py-2 whitespace-nowrap text-xs font-black text-white transition hover:bg-slate-700 active:opacity-80"
                      onClick={handleExportProductsCsv}
                    >
                      <FiFileText
                        aria-hidden="true"
                        className={iconClassName}
                      />
                      Excel
                    </button>

                    <button
                      type="button"
                      className="flex items-center justify-center gap-2 rounded-md bg-cyan-300 px-2 py-2 whitespace-nowrap text-xs font-black text-slate-950 transition hover:bg-cyan-200 active:opacity-80"
                      onClick={openProductModalForCreate}
                    >
                      <FiPlus aria-hidden="true" className={iconClassName} />
                    </button>
                  </div>

                  <div className="product-list-scroll min-h-0 min-w-0 max-w-full flex-1 overflow-auto rounded-md border border-white/10 bg-slate-950">
                    {groupedProductsByCategory.length > 0 ? (
                      <div className="min-w-[860px]">
                        <div className="sticky top-0 z-10 grid grid-cols-[170px_minmax(360px,1fr)_120px_90px_140px] border-b border-white/10 bg-slate-900 text-[10px] font-black uppercase tracking-wide text-slate-400">
                          <div className="border-r border-white/10 px-2 py-2">
                            Danh mục
                          </div>

                          <div className="border-r border-white/10 px-2 py-2">
                            Sản phẩm / Giá
                          </div>

                          <div className="border-r border-white/10 px-2 py-2">
                            Trạng thái
                          </div>

                          <div className="border-r border-white/10 px-2 py-2">
                            Ảnh
                          </div>

                          <div className="px-2 py-2">Cập nhật</div>
                        </div>

                        {groupedProductsByCategory.map((group) => {
                          const groupSoldCount = group.products.filter(
                            (product) => product.isDone,
                          ).length;
                          const groupActiveCount =
                            group.products.length - groupSoldCount;

                          return (
                            <div
                              key={group.category}
                              style={createCategoryColorStyle(
                                group.category,
                                settings.categoryColors,
                              )}
                            >
                              <div className="category-list-group-header grid grid-cols-[170px_minmax(360px,1fr)_120px_90px_140px] border-b text-xs font-black">
                                <div className="border-r border-[#d8c99f]/20 px-2 py-2">
                                  {group.category}
                                </div>

                                <div className="border-r border-[#d8c99f]/20 px-2 py-2">
                                  {group.products.length} sản phẩm
                                </div>

                                <div className="border-r border-[#d8c99f]/20 px-2 py-2">
                                  {groupSoldCount} bán / {groupActiveCount} còn
                                </div>

                                <div className="border-r border-[#d8c99f]/20 px-2 py-2" />

                                <div className="px-2 py-2" />
                              </div>

                              {group.products.map((product) => {
                                const isSelected =
                                  selectedProductId === product.id;
                                const statusLabel = product.isDone
                                  ? "Đã bán"
                                  : "Chưa bán";

                                return (
                                  <div
                                    key={product.id}
                                    className={`grid grid-cols-[170px_minmax(360px,1fr)_120px_90px_140px] border-b border-white/10 text-xs transition ${isSelected
                                      ? "bg-cyan-300/10 text-white"
                                      : product.isDone
                                        ? "bg-emerald-400/[0.04] text-slate-300 hover:bg-emerald-400/10"
                                        : "bg-slate-950 text-slate-300 hover:bg-slate-800"
                                      }`}
                                    onClick={() =>
                                      setSelectedProductId(product.id)
                                    }
                                  >
                                    <div className="category-list-name flex items-center border-r border-white/10 px-2 py-2 text-[11px] font-bold">
                                      {group.category}
                                    </div>

                                    <button
                                      type="button"
                                      className=" border-r border-white/10 px-2 py-2 text-left transition hover:bg-slate-800"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleEdit(product);
                                      }}
                                    >
                                      <div className="flex  items-center gap-2">
                                        {product.contentType === "realEstate" ? (
                                          <span className="shrink-0 rounded-md border border-amber-300/40 bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-black text-amber-100">
                                            BĐS
                                          </span>
                                        ) : null}
                                        {product.isDone ? (
                                          <span className="shrink-0 rounded-md bg-emerald-300 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                                            Đã bán
                                          </span>
                                        ) : null}

                                        <p className={`${fullCardItemNameClassName} text-xs font-black leading-5 text-white xl:text-sm xl:leading-6`}>
                                          {product.name}
                                        </p>
                                      </div>

                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className="rounded-md bg-cyan-300 px-2 py-1 text-xs font-black text-slate-950">
                                          {product.priceText || "Chưa có giá"}
                                        </span>

                                        <span className="text-[10px] font-bold text-slate-500">
                                          Bấm vào tên để sửa
                                        </span>
                                      </div>
                                    </button>

                                    <div className="flex items-center border-r border-white/10 px-2 py-2">
                                      <button
                                        type="button"
                                        className={`w-full rounded-md px-2 py-1.5 text-[10px] font-black transition active:opacity-80 ${product.isDone
                                          ? "bg-emerald-300 text-slate-950 hover:bg-emerald-200"
                                          : "border border-slate-500/40 bg-slate-800 text-slate-300 hover:bg-slate-700"
                                          }`}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void toggleProductDone(product.id);
                                        }}
                                      >
                                        {statusLabel}
                                      </button>
                                    </div>

                                    <div className="flex items-center border-r border-white/10 px-2 py-2 text-xs font-black text-slate-300">
                                      {product.images.length}
                                    </div>

                                    <div className="flex flex-col justify-center px-2 py-1.5 text-[10px] text-slate-500">
                                      <span>
                                        {new Date(
                                          product.updatedAt,
                                        ).toLocaleDateString("vi-VN")}
                                      </span>

                                      {product.doneAt ? (
                                        <span className="mt-0.5 text-slate-300/80">
                                          Bán:{" "}
                                          {new Date(
                                            product.doneAt,
                                          ).toLocaleDateString("vi-VN")}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[260px] items-center justify-center p-2 text-center">
                        <div>
                          <p className="text-xs font-black text-white">
                            Chưa có sản phẩm
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Thêm sản phẩm hoặc đổi từ khóa tìm kiếm để xem danh
                            sách.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              {activeModal === "product" ? (
                <form
                  className="product-editor flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
                  onSubmit={(event) => void handleSubmit(event)}
                >
                  <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
                    <div className="grid min-h-full min-w-0 grid-cols-1 items-start gap-3 pb-24 xl:grid-cols-[minmax(320px,0.92fr)_minmax(360px,1.08fr)] xl:pb-2">
                      <section className="order-2 flex min-h-0 min-w-0 flex-col gap-3 xl:order-1">
                        <div className="grid min-w-0 gap-1.5 rounded-md border border-white/10 bg-slate-950/70 p-2">
                          <span className="text-xs font-bold text-slate-300">
                            Mác dữ liệu
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              aria-pressed={draft.contentType === "technology"}
                              className={`flex items-center justify-center rounded-md border px-3 py-2 text-xs font-black transition ${draft.contentType === "technology"
                                ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
                                : "border-white/10 bg-slate-900 text-slate-400 hover:border-white/25 hover:text-white"
                                }`}
                              onClick={() =>
                                updateDraftField("contentType", "technology")
                              }
                            >
                              Công nghệ
                            </button>
                            <button
                              type="button"
                              aria-pressed={draft.contentType === "realEstate"}
                              className={`flex items-center justify-center rounded-md border px-3 py-2 text-xs font-black transition ${draft.contentType === "realEstate"
                                ? "border-amber-300/60 bg-amber-300/15 text-amber-100"
                                : "border-white/10 bg-slate-900 text-slate-400 hover:border-white/25 hover:text-white"
                                }`}
                              onClick={() =>
                                updateDraftField("contentType", "realEstate")
                              }
                            >
                              Bất động sản
                            </button>
                          </div>
                          <span className="text-[10px] leading-4 text-slate-500">
                            Chỉ dữ liệu Bất động sản mới hiện mác BĐS và dùng CMT riêng.
                          </span>
                        </div>

                        <label className="flex min-w-0 flex-col gap-1.5">
                          <span className="text-xs font-bold text-slate-300">
                            {draft.contentType === "realEstate"
                              ? "Tên BĐS dùng cho tiêu đề CMT"
                              : "Tên sản phẩm"}
                          </span>
                          <input
                            value={draft.name}
                            onChange={(event) =>
                              updateDraftField("name", event.target.value)
                            }
                            className="w-full min-w-0 rounded-md border border-white/10 bg-slate-950/80 p-2 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60"
                            placeholder={
                              draft.contentType === "realEstate"
                                ? "PHÚ NHUẬN - 28.1M2 - CÔ BẮC P1 - CÁCH Ô TÔ 1 CĂN"
                                : "Dell Latitude 7440 i5 13th"
                            }
                          />
                        </label>

                        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="flex min-w-0 flex-col gap-1.5">
                            <span className="text-xs font-bold text-slate-300">
                              Giá
                            </span>
                            <input
                              value={draft.priceText}
                              onChange={(event) =>
                                updateDraftField(
                                  "priceText",
                                  event.target.value,
                                )
                              }
                              className="w-full min-w-0 rounded-md border border-white/10 bg-slate-950/80 p-2 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60"
                              placeholder={
                                draft.contentType === "realEstate"
                                  ? "4.6 Đ hoặc 4.6 Tỷ"
                                  : "13tr8"
                              }
                            />
                          </label>

                          <div className="flex min-w-0 flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-300">
                                Danh mục
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-slate-500">
                                Màu nhận diện
                              </span>
                            </div>

                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_42px_66px] gap-1.5">
                              <input
                                value={draft.category}
                                list="local-product-category-options"
                                onChange={(event) =>
                                  updateDraftField(
                                    "category",
                                    event.target.value,
                                  )
                                }
                                className="w-full min-w-0 rounded-md border border-white/10 bg-slate-950/80 p-2 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60"
                                placeholder="Laptop Dell"
                              />

                              <label
                                title={
                                  draft.category.trim()
                                    ? `Chọn màu cho ${normalizeCategoryName(draft.category)}`
                                    : "Nhập danh mục trước khi chọn màu"
                                }
                                className={`flex min-h-9 items-center justify-center overflow-hidden rounded-md border border-white/15 bg-slate-950 p-1 transition ${draft.category.trim()
                                  ? "cursor-pointer hover:border-white/35"
                                  : "cursor-not-allowed opacity-40"
                                  }`}
                              >
                                <input
                                  type="color"
                                  aria-label="Chọn màu danh mục"
                                  disabled={!draft.category.trim()}
                                  value={getCategoryColor(
                                    draft.category,
                                    settings.categoryColors,
                                  )}
                                  onChange={(event) =>
                                    updateDraftCategoryColor(
                                      event.target.value,
                                    )
                                  }
                                  className="h-7 w-full cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                                />
                              </label>

                              <button
                                type="button"
                                disabled={
                                  !draft.category.trim() ||
                                  !(
                                    normalizeTextKey(draft.category) in
                                    settings.categoryColors
                                  )
                                }
                                className="min-h-9 rounded-md border border-white/10 bg-slate-900 px-1 text-[9px] font-black text-slate-400 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                                onClick={resetDraftCategoryColor}
                              >
                                Mặc định
                              </button>
                            </div>

                            <datalist id="local-product-category-options">
                              {categories.map((category) => (
                                <option key={category} value={category} />
                              ))}
                            </datalist>
                          </div>
                        </div>

                        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="flex min-w-0 flex-col gap-1.5">
                            <span className="text-xs font-bold text-slate-300">
                              Pin
                            </span>
                            <input
                              value={draft.pin}
                              maxLength={20}
                              onChange={(event) =>
                                updateDraftField("pin", event.target.value)
                              }
                              className="w-full min-w-0 rounded-md border border-white/10 bg-slate-950/80 p-2 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/60"
                              placeholder="8x%, 9x%, New"
                            />
                          </label>

                          <label className="flex min-w-0 flex-col gap-1.5">
                            <span className="text-xs font-bold text-slate-300">
                              Trạng thái
                            </span>
                            <input
                              value={draft.status}
                              maxLength={40}
                              onChange={(event) =>
                                updateDraftField("status", event.target.value)
                              }
                              className="w-full min-w-0 rounded-md border border-white/10 bg-slate-950/80 p-2 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/60"
                              placeholder="Nguyên zin"
                            />
                          </label>
                        </div>

                        <label className="flex min-h-0 min-w-0 flex-col gap-1.5">
                          <span className="text-xs font-bold text-slate-300">
                            {draft.contentType === "realEstate"
                              ? "Post bất động sản"
                              : "Mô tả sản phẩm"}
                          </span>
                          <textarea
                            value={draft.description}
                            onChange={(event) =>
                              updateDraftField(
                                "description",
                                event.target.value,
                              )
                            }
                            rows={8}
                            className={`min-h-[220px] w-full min-w-0 resize-y rounded-md border border-white/10 bg-slate-950/80 p-2 text-xs leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 sm:min-h-[260px] ${draft.contentType === "realEstate"
                              ? "xl:min-h-[260px]"
                              : "xl:min-h-[calc(90dvh-260px)] xl:resize-none"
                              }`}
                            placeholder={
                              draft.contentType === "realEstate"
                                ? "Nhập toàn bộ nội dung Post BĐS..."
                                : "Để trống nếu muốn dùng mô tả chung..."
                            }
                          />
                        </label>

                        {draft.contentType === "realEstate" ? (
                          <label className="flex min-h-0 min-w-0 flex-col gap-1.5">
                            <span className="text-xs font-bold text-amber-100">
                              CMT riêng cho bất động sản
                            </span>
                            <textarea
                              value={draft.realEstateComment}
                              onChange={(event) =>
                                updateDraftField(
                                  "realEstateComment",
                                  event.target.value,
                                )
                              }
                              rows={7}
                              className="min-h-[210px] w-full min-w-0 resize-y rounded-md border border-amber-300/25 bg-slate-950/80 p-2 text-xs leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/60"
                              placeholder={"✅ Vị trí: ...\n✅ Diện tích: ...\n✅ Hiện trạng: ...\n✅ Ưu điểm: ..."}
                            />
                            <span className="text-[10px] leading-4 text-slate-500">
                              Khi copy Cmt, hệ thống tự ghép Tên - GIÁ theo giá nhập nguyên bản rồi thêm nội dung này và Liên hệ đang chọn.
                            </span>
                          </label>
                        ) : null}
                      </section>

                      <section className="order-1 flex min-h-0 min-w-0 flex-col gap-3 xl:order-2">
                        <label
                          className={`min-w-0 cursor-pointer rounded-md border border-dashed p-3 text-center transition ${dragOverImageField === "images"
                            ? "border-cyan-300/80 bg-cyan-300/10"
                            : "border-white/15 bg-slate-950/70 hover:border-cyan-300/50 hover:bg-cyan-300/5"
                            }`}
                          onDrop={(event) => void handleDrop(event)}
                          onDragOver={(event) => handleDragOver(event)}
                          onDragLeave={handleDragLeave}
                        >
                          <div className="flex items-center justify-center gap-2 text-xs font-black text-white">
                            <FiUploadCloud
                              aria-hidden="true"
                              className={iconClassName}
                            />
                            Ảnh chính
                          </div>
                          <div className="mt-1 break-words text-[11px] leading-5 text-slate-400">
                            {isProcessingImages
                              ? "Đang xử lý ảnh..."
                              : "Chọn, kéo thả hoặc paste ảnh sản phẩm. Có thể kéo ảnh nội bộ lên đây để chuyển."}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(event) => void handleImageInput(event)}
                          />
                        </label>

                        {renderDraftImageCollection("images", "ảnh chính")}

                        <label
                          tabIndex={0}
                          className={`min-w-0 cursor-pointer rounded-md border border-dashed p-3 text-center transition ${dragOverImageField === "internalImages"
                            ? "border-amber-300/80 bg-amber-300/10"
                            : "border-amber-300/20 bg-amber-300/[0.04] hover:border-amber-300/50 hover:bg-amber-300/[0.08]"
                            }`}
                          onDrop={(event) =>
                            void handleDrop(event, "internalImages")
                          }
                          onDragOver={(event) =>
                            handleDragOver(event, "internalImages")
                          }
                          onDragLeave={handleDragLeave}
                          onPaste={(event) =>
                            void handleInternalImagePaste(event)
                          }
                        >
                          <div className="flex items-center justify-center gap-2 text-xs font-black text-amber-100">
                            <FiUploadCloud
                              aria-hidden="true"
                              className={iconClassName}
                            />
                            Ảnh nội bộ
                          </div>
                          <div className="mt-1 break-words text-[11px] leading-5 text-slate-400">
                            {isProcessingImages
                              ? "Đang xử lý ảnh..."
                              : "Ảnh model, dung lượng pin hoặc thông tin kiểm tra máy. Có thể kéo ảnh chính xuống đây để chuyển."}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(event) =>
                              void handleInternalImageInput(event)
                            }
                          />
                        </label>

                        {renderDraftImageCollection(
                          "internalImages",
                          "ảnh nội bộ",
                        )}
                      </section>
                    </div>
                  </div>

                  <div className="min-w-0 shrink-0 border-t border-white/10 bg-slate-950/95 p-2">
                    <button
                      type="submit"
                      className="flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-cyan-300 p-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200 active:opacity-80"
                    >
                      {editingId ? (
                        <FiRefreshCcw
                          aria-hidden="true"
                          className={iconClassName}
                        />
                      ) : (
                        <FiPlus aria-hidden="true" className={iconClassName} />
                      )}
                      {editingId ? "Lưu thay đổi" : "Thêm sản phẩm"}
                    </button>
                  </div>
                </form>
              ) : null}

              {activeModal === "schedule" ? (
                <section className="flex min-h-full flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-8">
                    <div className="rounded-md border border-white/10 bg-slate-900 p-1">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Khung giờ
                      </div>
                      <div className="text-xs font-black text-white">
                        {scheduleTimes.length}
                      </div>
                    </div>

                    <div className="rounded-md border border-cyan-400/20 bg-cyan-400/10 p-1">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-cyan-200">
                        Tổng task
                      </div>
                      <div className="text-xs font-black text-white">
                        {totalTodayTaskCount}
                      </div>
                    </div>

                    <div className="rounded-md border border-emerald-400/20 bg-emerald-400/10 p-1">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-300">
                        DONE
                      </div>
                      <div className="text-xs font-black text-white">
                        {postedTodayCount}
                      </div>
                    </div>

                    <div className="rounded-md border border-rose-400/20 bg-rose-400/10 p-1">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-rose-200">
                        Còn lại
                      </div>
                      <div className="text-xs font-black text-white">
                        {remainingTodayCount}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded-md border border-white/10 bg-slate-800 p-1 text-left transition hover:bg-slate-700"
                      onClick={() =>
                        setCompactScheduleConfig((current) => !current)
                      }
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Cấu hình
                      </div>
                      <div className="text-xs font-black text-white">
                        {compactScheduleConfig ? "Mở" : "Thu gọn"}
                      </div>
                    </button>

                    <button
                      type="button"
                      className="rounded-md border border-violet-300/30 bg-violet-300/10 p-1 text-left transition hover:bg-violet-300/20"
                      onClick={autoFillScheduleAssignments}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wide text-violet-200">
                        Tự động
                      </div>
                      <div className="text-xs font-black text-white">
                        Rải lịch
                      </div>
                    </button>

                    <button
                      type="button"
                      className="rounded-md border border-white/10 bg-slate-800 p-1 text-left transition hover:bg-slate-700"
                      onClick={resetActiveScheduleTaskAssignments}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Task
                      </div>
                      <div className="text-xs font-black text-white">
                        Xóa task
                      </div>
                    </button>

                    <button
                      type="button"
                      className="rounded-md border border-rose-400/30 bg-rose-400/10 p-1 text-left transition hover:bg-rose-400/20"
                      onClick={resetAllScheduleAssignments}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wide text-rose-200">
                        Tất cả
                      </div>
                      <div className="text-xs font-black text-white">
                        Xóa lịch
                      </div>
                    </button>
                  </div>

                  {!compactScheduleConfig ? (
                    <div className="rounded-md border border-white/10 bg-slate-950/70 p-2">
                      <div className="grid grid-cols-2 gap-2 xl:grid-cols-8">
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-slate-300">
                            Từ ngày
                          </span>
                          <input
                            type="date"
                            value={scheduleConfig.dateFrom}
                            onChange={(event) =>
                              updateScheduleField(
                                "dateFrom",
                                event.target.value,
                              )
                            }
                            className={scheduleFieldClassName}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-slate-300">
                            Đến ngày
                          </span>
                          <input
                            type="date"
                            value={scheduleConfig.dateTo}
                            onChange={(event) =>
                              updateScheduleField("dateTo", event.target.value)
                            }
                            className={scheduleFieldClassName}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-slate-300">
                            Bài đầu
                          </span>
                          <input
                            type="time"
                            value={scheduleConfig.startTime}
                            onChange={(event) =>
                              updateScheduleField(
                                "startTime",
                                event.target.value,
                              )
                            }
                            className={scheduleFieldClassName}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-slate-300">
                            Bài cuối
                          </span>
                          <input
                            type="time"
                            value={scheduleConfig.endTime}
                            onChange={(event) =>
                              updateScheduleField("endTime", event.target.value)
                            }
                            className={scheduleFieldClassName}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-slate-300">
                            Khoảng cách
                          </span>
                          <select
                            value={scheduleConfig.gapHours}
                            onChange={(event) =>
                              updateScheduleField(
                                "gapHours",
                                Number(event.target.value),
                              )
                            }
                            className={scheduleFieldClassName}
                          >
                            {[1, 2, 3, 4, 5, 6].map((hour) => (
                              <option key={hour} value={hour}>
                                {hour} tiếng
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-slate-300">
                            Số task
                          </span>
                          <select
                            value={scheduleConfig.taskCount}
                            onChange={(event) => {
                              const taskCount = Number(event.target.value);
                              setScheduleConfig((current) => ({
                                ...current,
                                taskCount,
                                taskNames: Array.from(
                                  { length: taskCount },
                                  (_, index) =>
                                    current.taskNames[index] ||
                                    `Task ${index + 1}`,
                                ),
                              }));
                            }}
                            className={scheduleFieldClassName}
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                              <option key={count} value={count}>
                                {count} task
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 border-t border-white/10 pt-2">
                        <button
                          type="button"
                          className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-[11px] font-black text-cyan-100 transition hover:bg-cyan-300/20"
                          onClick={addScheduleTask}
                        >
                          Thêm task
                        </button>

                        <button
                          type="button"
                          className="rounded-md border border-violet-300/30 bg-violet-300/10 px-2 py-1 text-[11px] font-black text-violet-100 transition hover:bg-violet-300/20"
                          onClick={autoFillScheduleAssignments}
                        >
                          Tự rải đầy task
                        </button>

                        <button
                          type="button"
                          className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[11px] font-black text-slate-100 transition hover:bg-slate-700"
                          onClick={duplicateFirstScheduleTask}
                        >
                          Nhân bản task 1
                        </button>
                      </div>

                      <div className="mt-2 rounded-md border border-white/10 bg-black/20 p-2">
                        <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
                          Danh mục dùng để xếp lịch
                        </div>
                        {categories.length === 0 ? (
                          <p className="text-[10px] text-slate-400">
                            Chưa có danh mục. Thêm hoặc import sản phẩm trước.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {categories.map((category) => {
                              const active =
                                scheduleConfig.selectedCategories.some(
                                  (item) =>
                                    normalizeTextKey(item) ===
                                    normalizeTextKey(category),
                                );

                              return (
                                <button
                                  key={category}
                                  type="button"
                                  className={`rounded-md border px-2 py-1 text-[11px] font-black transition ${active
                                    ? "border-slate-200 bg-slate-100 text-slate-950"
                                    : "border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-400 hover:bg-slate-800"
                                    }`}
                                  onClick={() =>
                                    toggleScheduleCategory(category)
                                  }
                                >
                                  {category}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {scheduleResult.warnings.length > 0 ? (
                    <div className="rounded-md border border-amber-400/20 bg-amber-400/10 p-2 text-xs text-amber-100">
                      {scheduleResult.warnings.map((warning) => (
                        <p key={warning.message}>{warning.message}</p>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid min-h-0 flex-1 grid-cols-1 gap-1 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <section className=" rounded-md border border-white/10 bg-slate-950/70 p-1">
                      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                        {scheduleTaskIndexes.map((taskIndex) => {
                          const active = activeScheduleTaskIndex === taskIndex;

                          return (
                            <div
                              key={taskIndex}
                              className={`flex min-w-44 shrink-0 items-center gap-1 rounded-md border p-1 ${active
                                ? "border-cyan-300/60 bg-cyan-300/10"
                                : "border-white/10 bg-white/[0.03]"
                                }`}
                            >
                              <button
                                type="button"
                                className="shrink-0 rounded-md bg-slate-800 px-2 py-1 whitespace-nowrap text-[10px] font-black text-white"
                                onClick={() =>
                                  setActiveScheduleTaskIndex(taskIndex)
                                }
                              >
                                {taskIndex + 1}
                              </button>
                              <input
                                value={getTaskName(scheduleConfig, taskIndex)}
                                onChange={(event) =>
                                  updateScheduleTaskName(
                                    taskIndex,
                                    event.target.value,
                                  )
                                }
                                onFocus={() =>
                                  setActiveScheduleTaskIndex(taskIndex)
                                }
                                onKeyDown={(event) => event.stopPropagation()}
                                className=" flex-1 bg-transparent text-xs font-black text-white outline-none placeholder:text-slate-600"
                              />
                              <button
                                type="button"
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rose-400/30 bg-rose-400/10 text-rose-100 transition hover:bg-rose-400/20"
                                onClick={() =>
                                  requestRemoveScheduleTask(taskIndex)
                                }
                                title="Xoá task này"
                              >
                                <FiTrash2
                                  aria-hidden="true"
                                  className={iconClassName}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {scheduleTimes.length === 0 ? (
                        <div className="rounded-md border border-white/10 bg-slate-950/80 p-2 text-center text-xs text-slate-400">
                          Khung giờ chưa hợp lệ.
                        </div>
                      ) : (
                        <div className="max-h-[62dvh] overflow-auto pr-1">
                          <div className="grid grid-cols-1 gap-2">
                            {scheduleTimes.map((time, timeIndex) => {
                              const nextTime =
                                scheduleTimes[timeIndex + 1] ??
                                scheduleConfig.endTime;
                              const assignedProduct = getAssignedProduct(
                                today,
                                time,
                                timeIndex,
                                activeScheduleTaskIndex,
                              );
                              const postedKey = createPostedKey(
                                today,
                                timeIndex,
                                activeScheduleTaskIndex,
                              );
                              const done = postedIds.has(postedKey);

                              return (
                                <article
                                  key={`${time}-${activeScheduleTaskIndex}`}
                                  draggable={Boolean(assignedProduct)}
                                  className={`rounded-md border p-1 transition ${assignedProduct ? "cursor-grab active:cursor-grabbing" : ""} ${done
                                    ? "border-emerald-400/30 bg-emerald-400/10"
                                    : assignedProduct
                                      ? "border-cyan-300/30 bg-cyan-300/10"
                                      : "border-white/10 bg-slate-900"
                                    }`}
                                  onDragStart={(event) => {
                                    if (!assignedProduct) return;

                                    const assignmentKey =
                                      createScheduleAssignmentKey(
                                        today,
                                        timeIndex,
                                        activeScheduleTaskIndex,
                                      );

                                    event.dataTransfer.setData(
                                      "text/plain",
                                      assignedProduct.id,
                                    );
                                    event.dataTransfer.setData(
                                      "application/x-schedule-assignment-key",
                                      assignmentKey,
                                    );
                                    setDraggingProductId(assignedProduct.id);
                                  }}
                                  onDragEnd={() => setDraggingProductId("")}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) =>
                                    handleScheduleDrop(
                                      event,
                                      today,
                                      time,
                                      timeIndex,
                                      activeScheduleTaskIndex,
                                    )
                                  }
                                >
                                  <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-1 xl:grid-cols-[58px_160px_minmax(0,1fr)_82px] xl:items-center">
                                    <div className="rounded-md border border-white/10 bg-slate-950 p-1">
                                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                        Bài {timeIndex + 1}
                                      </div>
                                      <div className="text-xs font-black text-white">
                                        {time}
                                      </div>
                                      <div className="text-[9px] text-slate-500">
                                        đến {nextTime}
                                      </div>
                                    </div>

                                    <select
                                      value={assignedProduct?.id ?? ""}
                                      onChange={(event) =>
                                        assignProductToSchedule(
                                          today,
                                          time,
                                          timeIndex,
                                          activeScheduleTaskIndex,
                                          event.target.value,
                                        )
                                      }
                                      className="col-span-1 rounded-md border border-white/10 bg-slate-950 p-1.5 text-[11px] font-bold text-white outline-none focus:border-cyan-300/60 xl:col-span-1"
                                    >
                                      <option value="">Chọn sản phẩm</option>
                                      {activeScheduleProducts.map((product) => {
                                        const currentAssignmentKey =
                                          createScheduleAssignmentKey(
                                            today,
                                            timeIndex,
                                            activeScheduleTaskIndex,
                                          );
                                        const sameTimePattern = new RegExp(
                                          `^${today}::task\\d+::slot${timeIndex + 1}$`,
                                        );
                                        const usedProductIds = new Set(
                                          Object.entries(scheduleAssignments)
                                            .filter(([key]) => {
                                              if (key === currentAssignmentKey)
                                                return false;

                                              return (
                                                key.startsWith(
                                                  `${today}::task${activeScheduleTaskIndex + 1}::`,
                                                ) || sameTimePattern.test(key)
                                              );
                                            })
                                            .map(([, value]) => value),
                                        );

                                        return (
                                          <option
                                            key={product.id}
                                            value={product.id}
                                            disabled={usedProductIds.has(
                                              product.id,
                                            )}
                                          >
                                            {product.name}{" "}
                                            {product.priceText
                                              ? `- ${product.priceText}`
                                              : ""}
                                          </option>
                                        );
                                      })}
                                    </select>

                                    <div className="col-span-2 flex  gap-1 xl:col-span-1">
                                      <button
                                        type="button"
                                        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-900"
                                        onClick={() =>
                                          assignedProduct
                                            ? openImageAlbum({
                                              productId: assignedProduct.id,
                                              title: assignedProduct.name,
                                              description:
                                                assignedProduct.description.trim() ||
                                                settings.commonDescription.trim(),
                                              priceText: assignedProduct.priceText,
                                              contentType: assignedProduct.contentType,
                                              realEstateComment:
                                                assignedProduct.realEstateComment,
                                              images: assignedProduct.images,
                                              internalImages:
                                                assignedProduct.internalImages,
                                            })
                                            : undefined
                                        }
                                      >
                                        {assignedProduct?.images[0] ? (<img
                                          src={
                                            assignedProduct.images[0].dataUrl
                                          }
                                          alt={assignedProduct.name}
                                          width={1200}
                                          height={1200}
                                          className="h-full w-full object-contain"
                                        />
                                        ) : (
                                          <FiImage
                                            aria-hidden="true"
                                            className={`${iconClassName} text-slate-600`}
                                          />
                                        )}
                                      </button>

                                      <div className=" flex-1">
                                        <h4 className={`${fullCardItemNameClassName} text-[11px] font-black leading-4 text-white`}>
                                          {assignedProduct?.name ??
                                            "Kéo sản phẩm vào đây hoặc chọn từ danh sách"}
                                        </h4>
                                        <p className="mt-0.5 truncate text-[10px] font-black text-cyan-200">
                                          {assignedProduct?.priceText ??
                                            "Chưa có giá"}
                                        </p>
                                        <p className="mt-0.5 truncate text-[9px] font-bold text-slate-400">
                                          {assignedProduct?.category ??
                                            "Chưa có danh mục"}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="col-span-2 grid grid-cols-2 gap-1 xl:col-span-1 xl:grid-cols-1">
                                      <button
                                        type="button"
                                        title="Xem chi tiết lịch"
                                        aria-label="Xem chi tiết lịch"
                                        disabled={!assignedProduct}
                                        className={`flex items-center justify-center gap-2 rounded-md p-1.5 text-[10px] font-black transition ${done
                                          ? "bg-emerald-300 text-slate-950 hover:bg-emerald-200"
                                          : assignedProduct
                                            ? "border border-white/10 bg-slate-800 text-white hover:bg-slate-700"
                                            : "cursor-not-allowed border border-white/10 bg-white/[0.03] text-slate-600"
                                          }`}
                                        onClick={() =>
                                          assignedProduct &&
                                          togglePostedProduct(
                                            today,
                                            timeIndex,
                                            activeScheduleTaskIndex,
                                          )
                                        }
                                      >
                                        {done ? "DONE" : "Chưa đăng"}
                                      </button>

                                      <button
                                        type="button"
                                        title="Xem chi tiết lịch"
                                        aria-label="Xem chi tiết lịch"
                                        disabled={!assignedProduct}
                                        className={`flex items-center justify-center gap-2 rounded-md p-1.5 text-[10px] font-black transition ${assignedProduct
                                          ? "border border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20"
                                          : "cursor-not-allowed border border-white/10 bg-white/[0.03] text-slate-600"
                                          }`}
                                        onClick={() =>
                                          assignedProduct &&
                                          openAssignedSlotModal(
                                            today,
                                            timeIndex,
                                            activeScheduleTaskIndex,
                                          )
                                        }
                                      >
                                        <FiClipboard
                                          aria-hidden="true"
                                          className={iconClassName}
                                        />
                                      </button>
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </section>

                    <aside className=" rounded-md border border-white/10 bg-slate-950/70 p-1 ">
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <div>
                          <h3 className="text-xs font-black text-white">
                            Sản phẩm khả dụng
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Kéo thả vào khung giờ hoặc click để active.
                          </p>
                        </div>
                        <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-300">
                          {filteredScheduleProducts.length}
                        </span>
                      </div>

                      <label className="mb-1 flex items-center gap-1 rounded-md border border-white/10 bg-slate-950/80 p-1.5 text-slate-400">
                        <FiSearch
                          aria-hidden="true"
                          className={`${iconClassName} shrink-0`}
                        />
                        <input
                          value={scheduleQuery}
                          onChange={(event) =>
                            setScheduleQuery(event.target.value)
                          }
                          onKeyDown={(event) => event.stopPropagation()}
                          className="w-full bg-transparent text-xs font-semibold text-white outline-none placeholder:text-slate-500"
                          placeholder="Tìm tất cả sản phẩm"
                        />
                      </label>

                      <div className="grid max-h-[62dvh] grid-cols-1 gap-1 overflow-y-auto pr-1">
                        {filteredScheduleProducts.map((product, index) => {
                          const scheduleLabels = getTodayProductScheduleLabels(
                            product.id,
                          );
                          const doneToday = todayPostedProductIds.has(
                            product.id,
                          );
                          const active = selectedProductId === product.id;

                          return (
                            <article
                              key={`${activeCategoryTab}-${product.id}`}
                              style={{ animationDelay: `${Math.min(index * 34, 340)}ms` }}
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.setData(
                                  "text/plain",
                                  product.id,
                                );
                                setDraggingProductId(product.id);
                                setSelectedProductId(product.id);
                              }}
                              onDragEnd={() => setDraggingProductId("")}
                              onClick={() => setSelectedProductId(product.id)}
                              className={`cursor-grab rounded-md border p-1 transition active:cursor-grabbing ${active
                                ? "border-cyan-300/60 bg-cyan-300/10  "
                                : "border-white/10 bg-slate-950/80 hover:border-cyan-300/30"
                                }`}
                            >
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-900"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openImageAlbum({
                                      productId: product.id,
                                      title: product.name,
                                      description:
                                        product.description.trim() ||
                                        settings.commonDescription.trim(),
                                      priceText: product.priceText,
                                      contentType: product.contentType,
                                      realEstateComment:
                                        product.realEstateComment,
                                      images: product.images,
                                      internalImages: product.internalImages,
                                    });
                                  }}
                                >
                                  {product.images[0] ? (<img
                                    src={product.images[0].dataUrl}
                                    alt={product.name}
                                    width={1200}
                                    height={1200}
                                    className="h-full w-full object-contain"
                                  />
                                  ) : (
                                    <FiImage
                                      aria-hidden="true"
                                      className={`${iconClassName} text-slate-600`}
                                    />
                                  )}
                                </button>

                                <div className=" flex-1">
                                  <h4 className={`${fullCardItemNameClassName} text-[11px] font-black leading-4 text-white`}>
                                    {product.name}
                                  </h4>
                                  <p className="mt-0.5 truncate text-[10px] font-black text-cyan-200">
                                    {product.priceText || "Chưa có giá"}
                                  </p>
                                  <p className="mt-0.5 truncate text-[9px] font-bold text-slate-400">
                                    {product.category || "Chưa có danh mục"}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {product.contentType === "realEstate" ? (
                                  <span className="rounded-md border border-amber-300/40 bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-black text-amber-100">
                                    BĐS
                                  </span>
                                ) : null}
                                {active ? (
                                  <span className="rounded-md bg-cyan-300 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                                    ACTIVE
                                  </span>
                                ) : null}
                                {scheduleLabels.map((label) => (
                                  <span
                                    key={label}
                                    className="rounded-md bg-cyan-300/10 px-1.5 py-0.5 text-[9px] font-black text-cyan-100"
                                  >
                                    {label}
                                  </span>
                                ))}
                                {doneToday ? (
                                  <span className="rounded-md bg-emerald-300 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                                    DONE
                                  </span>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </aside>
                  </div>
                </section>
              ) : null}

              {activeModal === "hourlyNotification" ? (
                <section className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3">
                  <article className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-white">
                          Lịch nhắc theo thời gian thực
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          Mốc đã qua sẽ bị bỏ qua, không phát thông báo bù. Khi
                          tab quay lại hoạt động, lịch được tính tiếp từ giờ thực tế.
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-black ${hourlyNotificationConfig.enabled
                          ? "bg-emerald-300 text-slate-950"
                          : "border border-white/10 bg-slate-950 text-slate-400"
                          }`}
                      >
                        {hourlyNotificationConfig.enabled ? "ĐANG BẬT" : "ĐANG TẮT"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                          Phút trong giờ
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={59}
                          step={1}
                          value={hourlyNotificationDraft.minuteOffset}
                          onChange={(event) =>
                            setHourlyNotificationDraft((current) => ({
                              ...current,
                              minuteOffset: clampInteger(
                                event.target.valueAsNumber,
                                0,
                                59,
                              ),
                            }))
                          }
                          onFocus={(event) => event.currentTarget.select()}
                          onWheel={(event) => event.currentTarget.blur()}
                          className={scheduleFieldClassName}
                          aria-label="Nhập phút trong giờ từ 0 đến 59"
                        />
                        <span className="text-[10px] leading-4 text-slate-500">
                          Nhập 0–59. 0 = đúng đầu giờ, 10 = HH:10.
                        </span>
                      </label>

                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                          Lặp lại mỗi
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={24}
                          step={1}
                          value={hourlyNotificationDraft.intervalHours}
                          onChange={(event) =>
                            setHourlyNotificationDraft((current) => ({
                              ...current,
                              intervalHours: clampInteger(
                                event.target.valueAsNumber,
                                1,
                                24,
                              ),
                            }))
                          }
                          onFocus={(event) => event.currentTarget.select()}
                          onWheel={(event) => event.currentTarget.blur()}
                          className={scheduleFieldClassName}
                          aria-label="Nhập khoảng lặp từ 1 đến 24 giờ"
                        />
                        <span className="text-[10px] leading-4 text-slate-500">
                          Nhập 1–24 giờ. Ví dụ 5 = lặp lại mỗi 5 giờ.
                        </span>
                      </label>

                      <label className="grid gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                          Tối đa mỗi ngày
                        </span>
                        <select
                          value={hourlyNotificationDraft.dailyLimit}
                          onChange={(event) =>
                            setHourlyNotificationDraft((current) => ({
                              ...current,
                              dailyLimit: clampInteger(
                                Number(event.target.value),
                                0,
                                24,
                              ),
                            }))
                          }
                          className={scheduleFieldClassName}
                        >
                          <option value={0}>Không giới hạn</option>
                          <option value={1}>1 lần / ngày</option>
                          <option value={2}>2 lần / ngày</option>
                          <option value={3}>3 lần / ngày</option>
                          <option value={4}>4 lần / ngày</option>
                          <option value={6}>6 lần / ngày</option>
                          <option value={8}>8 lần / ngày</option>
                          <option value={12}>12 lần / ngày</option>
                          <option value={24}>24 lần / ngày</option>
                        </select>
                        <span className="text-[10px] leading-4 text-slate-500">
                          Giới hạn theo ngày dương lịch trên máy.
                        </span>
                      </label>
                    </div>
                  </article>

                  <article className="grid grid-cols-1 gap-3 rounded-md border border-white/10 bg-slate-950/70 p-3 xl:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Cấu hình
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        HH:{String(hourlyNotificationDraft.minuteOffset).padStart(2, "0")}
                        {" · "}mỗi {hourlyNotificationDraft.intervalHours} giờ
                        {hourlyNotificationDraft.dailyLimit > 0
                          ? ` · tối đa ${hourlyNotificationDraft.dailyLimit} lần/ngày`
                          : " · không giới hạn/ngày"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Mốc kế tiếp đang chạy
                      </p>
                      <p className="mt-1 text-sm font-black text-emerald-100">
                        {hourlyNotificationConfig.enabled && nextHourlyNotificationAt
                          ? formatLocalDateTime(nextHourlyNotificationAt)
                          : "Chưa bật"}
                      </p>
                    </div>
                  </article>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className={secondaryActionButtonClassName}
                      onClick={() => void handleTestHourlyNotification()}
                    >
                      <FiBell aria-hidden="true" className={iconClassName} />
                      Thử thông báo và âm thanh
                    </button>

                    <button
                      type="button"
                      className={secondaryActionButtonClassName}
                      onClick={handleSaveHourlyNotificationConfig}
                    >
                      Lưu cấu hình
                    </button>

                    {hourlyNotificationConfig.enabled ? (
                      <button
                        type="button"
                        className="flex items-center justify-center gap-2 rounded-md border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-300/20"
                        onClick={handleDisableHourlyNotification}
                      >
                        <FiBell aria-hidden="true" className={iconClassName} />
                        Tắt thông báo
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="flex items-center justify-center gap-2 rounded-md border border-emerald-200/50 bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-200"
                        onClick={() => void handleEnableHourlyNotification()}
                      >
                        <FiBell aria-hidden="true" className={iconClassName} />
                        Lưu và bật
                      </button>
                    )}
                  </div>

                  <p className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/80">
                    Thông báo hệ thống vẫn nổi khi đang ở tab hoặc ứng dụng
                    khác, miễn Chrome và trang này còn chạy. Âm thanh phụ thuộc
                    quyền phát âm thanh và cài đặt thông báo của Chrome/Windows.
                    Nếu máy ngủ, đóng hẳn trình duyệt hoặc callback trễ quá 90
                    giây, mốc đó sẽ bị bỏ qua và hệ thống chờ mốc kế tiếp.
                  </p>
                </section>
              ) : null}

              {activeModal === "globalNote" ? (
                <section className="flex h-full min-h-0 flex-col overflow-hidden">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 p-2">
                    <label
                      htmlFor="global-note-input"
                      className="text-xs font-black text-white"
                    >
                      Ghi chú
                    </label>

                    <button
                      type="button"
                      className="flex shrink-0 items-center justify-center gap-2 rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 whitespace-nowrap text-xs font-black text-white transition hover:bg-slate-700 active:opacity-80"
                      onClick={() =>
                        void handleCopyField(
                          "global-note",
                          "ghi chú",
                          settings.globalNote,
                        )
                      }
                    >
                      {renderCopyIcon("global-note")}
                      Copy
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 p-2">
                    <textarea
                      id="global-note-input"
                      value={settings.globalNote}
                      onChange={(event) =>
                        updateSettingField("globalNote", event.target.value)
                      }
                      className="h-full min-h-0 w-full resize-none rounded-md border border-white/10 bg-slate-900/70 p-2 text-sm leading-7 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:bg-slate-900 xl:text-xs xl:leading-6"
                      placeholder="Nhập ghi chú..."
                    />
                  </div>
                </section>
              ) : null}

              {activeModal === "globalDescription" ? (
                <section className="flex h-full min-h-0 flex-col overflow-hidden">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 p-2">
                    <label
                      htmlFor="global-description-input"
                      className="text-xs font-black text-white"
                    >
                      Mô tả chung
                    </label>

                    <button
                      type="button"
                      className="flex shrink-0 items-center justify-center gap-2 rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 whitespace-nowrap text-xs font-black text-white transition hover:bg-slate-700 active:opacity-80"
                      onClick={() =>
                        void handleCopyField(
                          "global-description",
                          "mô tả chung",
                          settings.commonDescription,
                        )
                      }
                    >
                      {renderCopyIcon("global-description")}
                      Copy
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 p-2">
                    <textarea
                      id="global-description-input"
                      value={settings.commonDescription}
                      onChange={(event) =>
                        updateSettingField(
                          "commonDescription",
                          event.target.value,
                        )
                      }
                      className="h-full min-h-0 w-full resize-none rounded-md border border-white/10 bg-slate-900/70 p-2 text-sm leading-7 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:bg-slate-900 xl:text-xs xl:leading-6"
                      placeholder="Nhập mô tả chung..."
                    />
                  </div>
                </section>
              ) : null}

              {activeModal === "shareCopyOption" ? (
                <section className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3">
                  <article className="rounded-md border border-white/10 bg-slate-950/70 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-white">
                          Nội dung được copy khi Chia sẻ hoặc Tải ảnh
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          Chọn một chế độ bên dưới. Thay đổi được lưu ngay và
                          áp dụng chung cho hai nút Chia sẻ và Tải ảnh sản phẩm.
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-black ${settings.autoCopyShareMode === "post"
                          ? "bg-cyan-300 text-slate-950"
                          : "bg-amber-300 text-slate-950"
                          }`}
                      >
                        Hiện tại: {settings.autoCopyShareMode === "post" ? "Post" : "Cmt"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                      <button
                        type="button"
                        aria-pressed={settings.autoCopyShareMode === "post"}
                        className={`group flex min-h-40 flex-col items-stretch rounded-md border p-3 text-left transition ${settings.autoCopyShareMode === "post"
                          ? "border-cyan-300/70 bg-cyan-300/15 shadow-[0_0_0_1px_rgba(103,232,249,0.15)]"
                          : "border-white/10 bg-slate-900/70 hover:border-cyan-300/35 hover:bg-cyan-300/[0.07]"
                          }`}
                        onClick={() =>
                          updateSettingField("autoCopyShareMode", "post")
                        }
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-md border ${settings.autoCopyShareMode === "post"
                              ? "border-cyan-300/50 bg-cyan-300/20 text-cyan-100"
                              : "border-white/10 bg-slate-950 text-slate-400"
                              }`}
                          >
                            <FiFileText aria-hidden="true" className="h-4 w-4" />
                          </span>
                          <span
                            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-black ${settings.autoCopyShareMode === "post"
                              ? "bg-cyan-300 text-slate-950"
                              : "border border-white/10 bg-slate-950 text-slate-500"
                              }`}
                          >
                            {settings.autoCopyShareMode === "post" ? (
                              <FiCheck aria-hidden="true" className="h-3 w-3" />
                            ) : null}
                            {settings.autoCopyShareMode === "post"
                              ? "ĐANG CHỌN"
                              : "BẤM ĐỂ CHỌN"}
                          </span>
                        </span>
                        <span className="mt-3 text-sm font-black text-white">
                          Tự copy Post
                        </span>
                        <span className="mt-1 text-xs leading-5 text-slate-400">
                          Copy nội dung bài đăng, kèm Liên hệ đang chọn và áp
                          dụng trạng thái Bật/Tắt Tag trên header.
                        </span>
                      </button>

                      <button
                        type="button"
                        aria-pressed={settings.autoCopyShareMode === "comment"}
                        className={`group flex min-h-40 flex-col items-stretch rounded-md border p-3 text-left transition ${settings.autoCopyShareMode === "comment"
                          ? "border-amber-300/70 bg-amber-300/15 shadow-[0_0_0_1px_rgba(252,211,77,0.15)]"
                          : "border-white/10 bg-slate-900/70 hover:border-amber-300/35 hover:bg-amber-300/[0.07]"
                          }`}
                        onClick={() =>
                          updateSettingField("autoCopyShareMode", "comment")
                        }
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-md border ${settings.autoCopyShareMode === "comment"
                              ? "border-amber-300/50 bg-amber-300/20 text-amber-100"
                              : "border-white/10 bg-slate-950 text-slate-400"
                              }`}
                          >
                            <FiClipboard aria-hidden="true" className="h-4 w-4" />
                          </span>
                          <span
                            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-black ${settings.autoCopyShareMode === "comment"
                              ? "bg-amber-300 text-slate-950"
                              : "border border-white/10 bg-slate-950 text-slate-500"
                              }`}
                          >
                            {settings.autoCopyShareMode === "comment" ? (
                              <FiCheck aria-hidden="true" className="h-3 w-3" />
                            ) : null}
                            {settings.autoCopyShareMode === "comment"
                              ? "ĐANG CHỌN"
                              : "BẤM ĐỂ CHỌN"}
                          </span>
                        </span>
                        <span className="mt-3 text-sm font-black text-white">
                          Tự copy Cmt
                        </span>
                        <span className="mt-1 text-xs leading-5 text-slate-400">
                          Copy nội dung bình luận, kèm Liên hệ đang chọn và luôn
                          bỏ qua Tag.
                        </span>
                      </button>
                    </div>
                  </article>

                  <p className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] p-3 text-xs leading-5 text-cyan-100/80">
                    Khi chọn Post hoặc Cmt, nút Chia sẻ và mọi lượt tải ảnh có
                    nội dung sản phẩm sẽ tự copy đúng chế độ đó. Các nút Post
                    và Cmt bên trong modal Chia sẻ vẫn hoạt động độc lập.
                  </p>
                </section>
              ) : null}

              {activeModal === "contactSelection" ? (
                <section className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3">
                  <article className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3">
                    <h3 className="text-sm font-black text-white">
                      Vui lòng chọn liên hệ của bạn
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-emerald-100/80">
                      Lựa chọn này chỉ được lưu trên thiết bị hiện tại và sẽ tự
                      động dùng khi copy Post hoặc Cmt.
                    </p>
                  </article>

                  <article className="grid grid-cols-1 gap-2 rounded-md border border-white/10 bg-slate-950/60 p-2">
                    {settings.contactOptions.length > 0 ? (
                      settings.contactOptions.map((option, index) => (
                        <button
                          key={option.id}
                          type="button"
                          className="flex min-w-0 items-start gap-3 rounded-md border border-white/10 bg-slate-900/80 p-3 text-left transition hover:border-emerald-300/50 hover:bg-emerald-300/10 focus-visible:border-emerald-200 focus-visible:outline-none"
                          onClick={() =>
                            confirmInitialContactSelection(option.id)
                          }
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-300/30 bg-emerald-300/10 text-[10px] font-black text-emerald-100">
                            {index + 1}
                          </span>
                          <span className="min-w-0 whitespace-pre-wrap text-xs leading-5 text-slate-100 [overflow-wrap:anywhere]">
                            {option.text}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed border-white/15 bg-slate-950/50 p-4 text-center">
                        <p className="text-xs leading-5 text-slate-400">
                          Chưa có liên hệ nào. Hãy tạo liên hệ trước khi chọn.
                        </p>
                        <button
                          type="button"
                          className="mt-3 rounded-md border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-300/20"
                          onClick={() => openModal("contact")}
                        >
                          Mở quản lý Liên hệ
                        </button>
                      </div>
                    )}
                  </article>
                </section>
              ) : null}

              {activeModal === "contact" ? (
                <section className="grid w-full grid-cols-1 gap-2">
                  <article className="rounded-md border border-cyan-300/25 bg-cyan-300/[0.07] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-cyan-200">
                      Liên hệ đang chọn trên thiết bị này
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-white [overflow-wrap:anywhere]">
                      {activeContactOption?.text || "Chưa chọn liên hệ"}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {activeContactOption
                        ? activeContactLabel
                        : "Hãy chọn một liên hệ trong danh sách bên dưới"}
                    </p>
                  </article>

                  <article className="rounded-md border border-emerald-300/20 bg-emerald-300/10 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-xs font-black text-white">
                          {editingContactOptionId
                            ? "Sửa nội dung liên hệ"
                            : "Thêm nội dung liên hệ"}
                        </h3>
                        <p className="mt-1 text-[10px] leading-4 text-emerald-100/80">
                          Danh sách liên hệ được lưu trong MongoDB và file backup.
                          Liên hệ đang chọn chỉ lưu trên thiết bị hiện tại.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-emerald-300 px-2 py-1 text-[9px] font-black text-slate-950">
                        Chọn 1
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
                      <textarea
                        value={contactDraft}
                        onChange={(event) => setContactDraft(event.target.value)}
                        className="min-h-24 w-full resize-y rounded-md border border-emerald-300/20 bg-slate-950/70 p-2 text-xs leading-5 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50"
                        placeholder="Nhập nội dung liên hệ..."
                      />
                      <div className="grid grid-cols-1 gap-2 xl:self-stretch">
                        <button
                          type="button"
                          className="flex items-center justify-center gap-2 rounded-md bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-200 active:opacity-80"
                          onClick={saveContactOption}
                        >
                          {editingContactOptionId ? (
                            <FiCheck aria-hidden="true" className={iconClassName} />
                          ) : (
                            <FiPlus aria-hidden="true" className={iconClassName} />
                          )}
                          {editingContactOptionId
                            ? "Lưu liên hệ"
                            : "Thêm liên hệ"}
                        </button>

                        {editingContactOptionId ? (
                          <button
                            type="button"
                            className="flex items-center justify-center gap-2 rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700 active:opacity-80"
                            onClick={resetContactEditor}
                          >
                            Hủy sửa
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>

                  <article className="grid grid-cols-1 gap-2 rounded-md border border-white/10 bg-slate-950/60 p-2">
                    {settings.contactOptions.length > 0 ? (
                      settings.contactOptions.map((option, index) => (
                        <div
                          key={option.id}
                          className={`grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-stretch gap-2 rounded-md border p-2 ${selectedContactId === option.id
                            ? "border-emerald-300/60 bg-emerald-300/15"
                            : "border-white/10 bg-slate-900/70"
                            }`}
                        >
                          <button
                            type="button"
                            aria-pressed={selectedContactId === option.id}
                            className="flex min-w-0 items-start gap-2 p-2 text-left"
                            onClick={() => selectContactOption(option.id)}
                            aria-label={`Chọn liên hệ ${index + 1}`}
                          >
                            <span
                              aria-hidden="true"
                              className={`mt-1 h-3 w-3 shrink-0 rounded-full border ${selectedContactId === option.id
                                ? "border-emerald-200 bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.45)]"
                                : "border-slate-500 bg-slate-950"
                                }`}
                            />
                            <span className="min-w-0 whitespace-pre-wrap text-xs leading-5 text-slate-100 [overflow-wrap:anywhere]">
                              {option.text}
                            </span>
                          </button>

                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center self-start rounded-md border border-cyan-300/30 bg-cyan-300/10 text-cyan-100 transition hover:bg-cyan-300/20 active:opacity-80"
                            onClick={() =>
                              void handleCopyField(
                                `contact-option-${option.id}`,
                                `liên hệ ${index + 1}`,
                                option.text,
                              )
                            }
                            title="Copy liên hệ"
                            aria-label={`Copy liên hệ ${index + 1}`}
                          >
                            {renderCopyIcon(`contact-option-${option.id}`)}
                          </button>

                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center self-start rounded-md border border-amber-300/30 bg-amber-300/10 text-amber-100 transition hover:bg-amber-300/20 active:opacity-80"
                            onClick={() => startEditingContactOption(option)}
                            title="Sửa liên hệ"
                            aria-label={`Sửa liên hệ ${index + 1}`}
                          >
                            <FiEdit3 aria-hidden="true" className={iconClassName} />
                          </button>

                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center self-start rounded-md border border-rose-300/30 bg-rose-300/10 text-rose-100 transition hover:bg-rose-300/20 active:opacity-80"
                            onClick={() => removeContactOption(option.id)}
                            title="Xóa liên hệ"
                            aria-label={`Xóa liên hệ ${index + 1}`}
                          >
                            <FiTrash2
                              aria-hidden="true"
                              className={iconClassName}
                            />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-md border border-dashed border-white/10 bg-slate-950/40 p-3 text-center text-[10px] text-slate-400">
                        Chưa có nội dung liên hệ.
                      </p>
                    )}
                  </article>
                </section>
              ) : null}

              {activeModal === "facebookPages" ? (
                <section className="grid w-full grid-cols-1 gap-2 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <article className="border border-[#d8c99f]/20 bg-[#d8c99f]/[0.06] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-xs font-black text-white">
                          {editingFacebookPageOptionId
                            ? "Sửa Fanpage"
                            : "Thêm Fanpage"}
                        </h3>
                        <p className="mt-1 text-[10px] leading-4 text-[#eadfbe]/80">
                          Chỉ lưu tên và Asset ID trong local và file backup. Không lưu tài khoản, mật khẩu hoặc Access Token.
                        </p>
                      </div>
                      <span className="shrink-0 bg-[#d8c99f] px-2 py-1 text-[9px] font-black text-[#17130a]">
                        Local
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <label className="grid gap-1">
                        <span className="text-[10px] font-black text-slate-300">
                          Tên Fanpage
                        </span>
                        <input
                          type="text"
                          value={facebookPageNameDraft}
                          onChange={(event) =>
                            setFacebookPageNameDraft(event.target.value)
                          }
                          onKeyDown={(event) => event.stopPropagation()}
                          className="w-full border border-white/10 bg-slate-950/80 px-2 py-2 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-[#d8c99f]/50"
                          placeholder="Ví dụ: Fanpage chính"
                        />
                      </label>

                      <label className="grid gap-1">
                        <span className="text-[10px] font-black text-slate-300">
                          Asset ID
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={facebookPageAssetIdDraft}
                          onChange={(event) =>
                            setFacebookPageAssetIdDraft(
                              normalizeFacebookAssetId(event.target.value),
                            )
                          }
                          onKeyDown={(event) => event.stopPropagation()}
                          className="w-full border border-white/10 bg-slate-950/80 px-2 py-2 font-mono text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-[#d8c99f]/50"
                          placeholder="Nhập Asset ID"
                        />
                      </label>

                      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                        <button
                          type="button"
                          className="flex items-center justify-center gap-2 border border-[#f0e3c0]/80 bg-[linear-gradient(135deg,#f2e8cd,#c9b47c)] px-3 py-2 text-xs font-black text-[#17130a] transition hover:brightness-105 active:opacity-80"
                          onClick={saveFacebookPageOption}
                        >
                          {editingFacebookPageOptionId ? (
                            <FiCheck aria-hidden="true" className={iconClassName} />
                          ) : (
                            <FiPlus aria-hidden="true" className={iconClassName} />
                          )}
                          {editingFacebookPageOptionId
                            ? "Lưu Fanpage"
                            : "Thêm Fanpage"}
                        </button>

                        {editingFacebookPageOptionId ? (
                          <button
                            type="button"
                            className="flex items-center justify-center gap-2 border border-white/15 bg-slate-800 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700 active:opacity-80"
                            onClick={resetFacebookPageEditor}
                          >
                            Hủy sửa
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>

                  <article className="grid content-start grid-cols-1 gap-2 border border-white/10 bg-slate-950/60 p-2">
                    {settings.facebookPages.length > 0 ? (
                      settings.facebookPages.map((option, index) => (
                        <div
                          key={option.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border border-white/10 bg-slate-900/70 p-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-white">
                              {option.name}
                            </p>
                            <p className="mt-1 truncate font-mono text-[9px] text-slate-400">
                              Asset ID: {option.assetId}
                            </p>
                          </div>

                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center border border-amber-300/30 bg-amber-300/10 text-amber-100 transition hover:bg-amber-300/20 active:opacity-80"
                            onClick={() => startEditingFacebookPageOption(option)}
                            title="Sửa Fanpage"
                            aria-label={`Sửa Fanpage ${index + 1}`}
                          >
                            <FiEdit3 aria-hidden="true" className={iconClassName} />
                          </button>

                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center border border-rose-300/30 bg-rose-300/10 text-rose-100 transition hover:bg-rose-300/20 active:opacity-80"
                            onClick={() => removeFacebookPageOption(option.id)}
                            title="Xóa Fanpage"
                            aria-label={`Xóa Fanpage ${index + 1}`}
                          >
                            <FiTrash2
                              aria-hidden="true"
                              className={iconClassName}
                            />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="border border-dashed border-white/10 bg-slate-950/40 p-4 text-center text-[10px] leading-5 text-slate-400">
                        Chưa có Fanpage. Có thể thêm nhiều Asset ID và chọn trực tiếp bằng nút khi mở Composer.
                      </p>
                    )}
                  </article>

                  <article className="border border-violet-300/20 bg-violet-300/[0.06] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-xs font-black text-white">
                          Thêm Group Facebook
                        </h3>
                        <p className="mt-1 text-[10px] leading-4 text-violet-100/75">
                          Lưu link Group để copy nội dung và mở lần lượt từng nhóm bằng popup trên PC.
                        </p>
                      </div>
                      <span className="shrink-0 bg-violet-200 px-2 py-1 text-[9px] font-black text-slate-950">
                        Link
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <label className="grid gap-1">
                        <span className="text-[10px] font-black text-slate-300">
                          Tên Group
                        </span>
                        <input
                          type="text"
                          value={facebookGroupNameDraft}
                          onChange={(event) =>
                            setFacebookGroupNameDraft(event.target.value)
                          }
                          onKeyDown={(event) => event.stopPropagation()}
                          className="w-full border border-white/10 bg-slate-950/80 px-2 py-2 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50"
                          placeholder="Ví dụ: Group iPhone"
                        />
                      </label>

                      <label className="grid gap-1">
                        <span className="text-[10px] font-black text-slate-300">
                          Danh mục Group
                        </span>
                        <input
                          type="text"
                          value={facebookGroupCategoryDraft}
                          onChange={(event) =>
                            setFacebookGroupCategoryDraft(event.target.value)
                          }
                          onKeyDown={(event) => event.stopPropagation()}
                          className="w-full border border-white/10 bg-slate-950/80 px-2 py-2 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50"
                          placeholder="Ví dụ: Laptop"
                        />
                      </label>

                      <label className="grid gap-1">
                        <span className="text-[10px] font-black text-slate-300">
                          Link Group
                        </span>
                        <input
                          type="url"
                          value={facebookGroupUrlDraft}
                          onChange={(event) =>
                            setFacebookGroupUrlDraft(event.target.value)
                          }
                          onKeyDown={(event) => event.stopPropagation()}
                          className="w-full border border-white/10 bg-slate-950/80 px-2 py-2 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50"
                          placeholder="https://www.facebook.com/groups/..."
                        />
                      </label>

                      <button
                        type="button"
                        className="flex items-center justify-center gap-2 border border-violet-300/40 bg-violet-300/15 px-3 py-2 text-xs font-black text-violet-50 transition hover:bg-violet-300/25 active:opacity-80"
                        onClick={addFacebookGroupOption}
                      >
                        <FiPlus aria-hidden="true" className={iconClassName} />
                        Thêm Group
                      </button>
                    </div>
                  </article>

                  <article className="grid content-start grid-cols-1 gap-2 border border-white/10 bg-slate-950/60 p-2">
                    {settings.facebookGroups.length > 0 ? (
                      facebookGroupOptionGroups.map((categoryGroup) => (
                        <section
                          key={normalizeTextKey(categoryGroup.category)}
                          className="min-w-0 border border-violet-300/15 bg-black/15 p-1.5"
                        >
                          <div className="flex min-w-0 items-center justify-between gap-2 border-b border-violet-300/15 px-1 pb-1.5">
                            <p className="truncate text-[10px] font-black text-violet-100">
                              {categoryGroup.category}
                            </p>
                            <span className="shrink-0 border border-violet-200/25 bg-violet-300/10 px-1.5 py-0.5 text-[8px] font-black text-violet-100">
                              {categoryGroup.options.length} Group
                            </span>
                          </div>

                          <div className="mt-1.5 grid min-w-0 gap-1.5">
                            {categoryGroup.options.map(({ option, index }) => (
                              <div
                                key={option.id}
                                className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border p-2 ${settings.selectedFacebookGroupIds.includes(option.id)
                                  ? "border-violet-300/55 bg-violet-300/10"
                                  : "border-white/10 bg-slate-900/70"
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={settings.selectedFacebookGroupIds.includes(
                                    option.id,
                                  )}
                                  onChange={() =>
                                    toggleFacebookGroupSelection(option.id)
                                  }
                                  className="h-4 w-4 accent-violet-300"
                                  aria-label={`Chọn Group ${index + 1}`}
                                />

                                <div className="min-w-0">
                                  <input
                                    type="text"
                                    value={option.name}
                                    onChange={(event) =>
                                      updateFacebookGroupOptionName(
                                        option.id,
                                        event.target.value,
                                      )
                                    }
                                    onKeyDown={(event) =>
                                      event.stopPropagation()
                                    }
                                    className="w-full min-w-0 bg-transparent text-xs font-black text-white outline-none"
                                    aria-label={`Tên Group ${index + 1}`}
                                  />
                                  <input
                                    type="text"
                                    defaultValue={option.category}
                                    onBlur={(event) => {
                                      updateFacebookGroupOptionCategory(
                                        option.id,
                                        normalizeCategoryName(
                                          event.currentTarget.value,
                                        ) || "Chưa phân loại",
                                      );
                                    }}
                                    onKeyDown={(event) =>
                                      event.stopPropagation()
                                    }
                                    className="mt-1 w-full min-w-0 border-t border-violet-300/15 bg-transparent pt-1 text-[9px] font-bold text-violet-200 outline-none placeholder:text-slate-600"
                                    placeholder="Danh mục Group"
                                    aria-label={`Danh mục Group ${index + 1}`}
                                  />
                                  <p className="mt-1 truncate text-[9px] text-slate-400">
                                    {option.url}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  className="flex h-8 w-8 items-center justify-center border border-rose-300/30 bg-rose-300/10 text-rose-100 transition hover:bg-rose-300/20 active:opacity-80"
                                  onClick={() =>
                                    removeFacebookGroupOption(option.id)
                                  }
                                  title="Xóa Group"
                                  aria-label={`Xóa Group ${index + 1}`}
                                >
                                  <FiTrash2
                                    aria-hidden="true"
                                    className={iconClassName}
                                  />
                                </button>
                              </div>
                            ))}
                          </div>
                        </section>
                      ))
                    ) : (
                      <p className="border border-dashed border-white/10 bg-slate-950/40 p-4 text-center text-[10px] leading-5 text-slate-400">
                        Chưa có Group Facebook. Thêm nhiều link và chọn các nhóm cần mở lần lượt bằng popup khi chia sẻ.
                      </p>
                    )}
                  </article>
                </section>
              ) : null}

              {activeModal === "facebookDuplicatePosts" ? (
                <section className="grid w-full min-w-0 grid-cols-1 gap-2 overflow-x-hidden xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <article className="min-w-0 max-w-full self-start overflow-x-hidden border border-[#d8c99f]/25 bg-[#d8c99f]/[0.055] p-3">
                    <div className="flex items-start justify-between gap-2 border-b border-[#d8c99f]/15 pb-2">
                      <div className="min-w-0">
                        <h3 className="text-xs font-black text-white">
                          Chọn Fanpage
                        </h3>
                        <p className="mt-1 text-[10px] leading-4 text-slate-400">
                          Asset ID của Fanpage được dùng chung cho các công cụ bên dưới.
                        </p>
                      </div>
                      <span className="shrink-0 border border-[#d8c99f]/30 bg-[#d8c99f]/10 px-2 py-1 text-[9px] font-black text-[#eadfbe]">
                        Fanpage
                      </span>
                    </div>

                    {settings.facebookPages.length > 0 ? (
                      <div className="mt-3 grid min-w-0 max-w-full gap-2 overflow-x-hidden">
                        <div className="grid min-w-0 max-w-full gap-1 overflow-x-hidden">
                          <span className="text-[10px] font-black text-slate-300">
                            Chọn Fanpage
                          </span>
                          <div className="grid max-h-40 min-w-0 max-w-full grid-cols-1 gap-1.5 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable] xl:grid-cols-2">
                            {settings.facebookPages.map((option) => (
                              <button
                                type="button"
                                key={option.id}
                                aria-pressed={selectedFacebookPageId === option.id}
                                className={`max-w-full min-w-0 overflow-hidden border px-2 py-2 text-left transition ${selectedFacebookPageId === option.id
                                  ? "border-[#d8c99f]/70 bg-[#d8c99f]/15 text-[#f4e8c7]"
                                  : "border-white/10 bg-slate-950/70 text-slate-300 hover:border-[#d8c99f]/35 hover:bg-[#d8c99f]/[0.06]"
                                  }`}
                                onClick={() => setSelectedFacebookPageId(option.id)}
                              >
                                <span className="block truncate text-[10px] font-black">
                                  {option.name}
                                </span>
                                <span className="mt-0.5 block truncate font-mono text-[8px] text-slate-500">
                                  {option.assetId}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {activeFacebookPage ? (
                          <div className="min-w-0 max-w-full overflow-hidden border border-[#d8c99f]/20 bg-slate-950/70 p-2.5">
                            <div className="flex min-w-0 items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-500">
                                  Fanpage đang chọn
                                </p>
                                <p className="mt-1 truncate text-[10px] font-black text-[#eadfbe]">
                                  {activeFacebookPage.name}
                                </p>
                                <p className="mt-0.5 truncate font-mono text-[8px] text-slate-500">
                                  Asset ID: {activeFacebookPage.assetId}
                                </p>
                              </div>
                              <span className="shrink-0 bg-[#d8c99f] px-2 py-1 text-[8px] font-black text-[#17130a]">
                                ACTIVE
                              </span>
                            </div>

                            <div className="mt-2 grid min-w-0 grid-cols-1 gap-2">
                              {FACEBOOK_PAGE_URL_TOOLS.map((tool) => {
                                const toolUrl = tool.createUrl(
                                  activeFacebookPage.assetId,
                                );

                                return (
                                  <section
                                    key={tool.id}
                                    className={`min-w-0 max-w-full overflow-hidden border p-2 ${tool.containerClassName}`}
                                  >
                                    <div className="flex min-w-0 items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <h4 className="text-[10px] font-black text-white">
                                          {tool.title}
                                        </h4>
                                        <p className="mt-0.5 text-[9px] leading-4 text-slate-400">
                                          {tool.description}
                                        </p>
                                      </div>
                                      <span
                                        className={`shrink-0 border px-1.5 py-0.5 text-[8px] font-black ${tool.badgeClassName}`}
                                      >
                                        {tool.shortLabel}
                                      </span>
                                    </div>

                                    <textarea
                                      readOnly
                                      rows={3}
                                      value={toolUrl}
                                      className="mt-2 block w-full min-w-0 max-w-full resize-none overflow-x-hidden border border-white/10 bg-black/30 p-2 font-mono text-[8px] leading-4 text-slate-300 outline-none"
                                      aria-label={`URL ${tool.title} của Fanpage`}
                                    />

                                    <div className="mt-2 grid min-w-0 grid-cols-2 gap-1.5 overflow-hidden">
                                      <button
                                        type="button"
                                        className={`min-h-9 min-w-0 overflow-hidden whitespace-nowrap border px-2 py-2 text-[9px] font-black transition active:opacity-80 ${tool.copyButtonClassName}`}
                                        onClick={() =>
                                          void copyFacebookUrl(
                                            toolUrl,
                                            tool.copyMessage,
                                          )
                                        }
                                      >
                                        {tool.copyLabel}
                                      </button>
                                      <button
                                        type="button"
                                        className={`min-h-9 min-w-0 overflow-hidden whitespace-nowrap border px-2 py-2 text-[9px] font-black transition active:opacity-80 ${tool.openButtonClassName}`}
                                        onClick={(event) => {
                                          const openerWindow =
                                            event.currentTarget.ownerDocument.defaultView ??
                                            window;

                                          openFacebookUrl(
                                            openerWindow,
                                            toolUrl,
                                            `${tool.popupNamePrefix}-${activeFacebookPage.id}`,
                                          );
                                        }}
                                      >
                                        {tool.openLabel}
                                      </button>
                                    </div>
                                  </section>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mt-3 w-full border border-dashed border-[#d8c99f]/35 bg-black/20 px-3 py-3 text-[10px] font-black text-[#eadfbe] transition hover:bg-[#d8c99f]/10"
                        onClick={() => openModal("facebookPages")}
                      >
                        Thêm Fanpage và Asset ID
                      </button>
                    )}
                  </article>

                  <div className="grid min-w-0 content-start gap-2">
                    <article className="border border-amber-300/20 bg-amber-300/[0.055] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-xs font-black text-white">
                            {editingFacebookDuplicatePostId
                              ? "Sửa mẫu nhân bản"
                              : "Nhân bản bài viết"}
                          </h3>
                          <p className="mt-1 text-[10px] leading-4 text-slate-400">
                            URL được lưu thành mẫu dùng chung. Asset ID được lấy từ Fanpage đang chọn khi Copy hoặc Mở.
                          </p>
                        </div>
                        <span className="shrink-0 border border-amber-200/30 bg-amber-200/10 px-2 py-1 text-[9px] font-black text-amber-100">
                          Nhân bản
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,0.45fr)_minmax(0,0.7fr)_minmax(0,1.35fr)_auto]">
                        <label className="grid min-w-0 gap-1">
                          <span className="text-[9px] font-black text-slate-300">
                            Danh mục
                          </span>
                          <input
                            type="text"
                            value={facebookDuplicateCategoryDraft}
                            onChange={(event) =>
                              setFacebookDuplicateCategoryDraft(
                                event.target.value,
                              )
                            }
                            onKeyDown={(event) => event.stopPropagation()}
                            className="min-h-10 w-full min-w-0 border border-white/10 bg-slate-950 px-2 py-2 text-[10px] font-bold text-white outline-none placeholder:text-slate-600 focus:border-amber-300/45"
                            placeholder="Laptop"
                          />
                        </label>

                        <label className="grid min-w-0 gap-1">
                          <span className="text-[9px] font-black text-slate-300">
                            Tên bài viết
                          </span>
                          <input
                            type="text"
                            value={facebookDuplicateNameDraft}
                            onChange={(event) =>
                              setFacebookDuplicateNameDraft(event.target.value)
                            }
                            onKeyDown={(event) => event.stopPropagation()}
                            className="min-h-10 w-full min-w-0 border border-white/10 bg-slate-950 px-2 py-2 text-[10px] font-bold text-white outline-none placeholder:text-slate-600 focus:border-amber-300/45"
                            placeholder="Bản sao của tên sản phẩm"
                          />
                        </label>

                        <label className="grid min-w-0 gap-1">
                          <span className="text-[9px] font-black text-slate-300">
                            URL mẫu từ Meta Business
                          </span>
                          <input
                            type="url"
                            value={facebookDuplicateUrlDraft}
                            onChange={(event) =>
                              setFacebookDuplicateUrlDraft(event.target.value)
                            }
                            onKeyDown={(event) => event.stopPropagation()}
                            className="min-h-10 w-full min-w-0 border border-white/10 bg-slate-950 px-2 py-2 font-mono text-[9px] text-white outline-none placeholder:text-slate-600 focus:border-amber-300/45"
                            placeholder="https://business.facebook.com/latest/composer?asset_id=...&business_content_id=..."
                          />
                        </label>

                        <div className="grid gap-1 self-end">
                          <button
                            type="button"
                            className="min-h-10 border border-amber-200/55 bg-amber-200/15 px-3 py-2 text-[10px] font-black text-amber-50 transition hover:bg-amber-200/25 active:opacity-80"
                            onClick={saveFacebookDuplicatePostOption}
                          >
                            <span className="flex items-center justify-center gap-1.5">
                              {editingFacebookDuplicatePostId ? (
                                <FiCheck aria-hidden="true" className={iconClassName} />
                              ) : (
                                <FiPlus aria-hidden="true" className={iconClassName} />
                              )}
                              {editingFacebookDuplicatePostId
                                ? "Lưu sửa"
                                : "Lưu mẫu"}
                            </span>
                          </button>

                          {editingFacebookDuplicatePostId ? (
                            <button
                              type="button"
                              className="min-h-9 border border-white/15 bg-slate-800 px-3 py-2 text-[9px] font-black text-white transition hover:bg-slate-700 active:opacity-80"
                              onClick={resetFacebookDuplicatePostEditor}
                            >
                              Hủy sửa
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>

                    <article className="border border-white/10 bg-slate-950/55 p-2">
                      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-1 pb-2">
                        <div className="min-w-0">
                          <h3 className="text-[10px] font-black text-white">
                            URL nhân bản đã lưu
                          </h3>
                          <p className="mt-0.5 text-[9px] text-slate-500">
                            Mọi mẫu đều dùng được với Fanpage đang chọn.
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-black text-slate-300">
                            {facebookDuplicatePostTemplates.length} mẫu
                          </span>
                        </div>
                      </div>

                      {facebookDuplicatePostTemplates.length > 0 ? (
                        <div className="mt-2 max-h-[52dvh] space-y-2 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                          {facebookDuplicatePostGroups.map((group) => (
                            <section
                              key={normalizeTextKey(group.category)}
                              className="border border-[#d8c99f]/15 bg-black/15 p-1.5"
                            >
                              <div className="flex items-center justify-between gap-2 border-b border-[#d8c99f]/15 px-1 pb-1.5">
                                <p className="truncate text-[10px] font-black text-[#eadfbe]">
                                  {group.category}
                                </p>
                                <span className="shrink-0 border border-[#d8c99f]/20 bg-[#d8c99f]/10 px-1.5 py-0.5 text-[8px] font-black text-[#eadfbe]">
                                  {group.options.length}
                                </span>
                              </div>

                              <div className="mt-1.5 space-y-1.5">
                                {group.options.map((option) => (
                                  <div
                                    key={option.id}
                                    className="grid min-w-0 grid-cols-1 gap-1.5 border border-white/10 bg-slate-900/65 p-2 transition hover:border-amber-300/30 hover:bg-amber-300/[0.05] xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-[10px] font-black text-white">
                                        {option.name}
                                      </p>
                                      <p className="mt-1 truncate font-mono text-[8px] text-slate-400">
                                        {activeFacebookPage
                                          ? createMetaBusinessDuplicateUrl(
                                            option.url,
                                            activeFacebookPage.assetId,
                                          )
                                          : option.url}
                                      </p>
                                      <p className="mt-0.5 truncate font-mono text-[8px] text-slate-600">
                                        ID: {getFacebookDuplicateContentId(option.url)}
                                      </p>
                                    </div>

                                    <div className="grid grid-cols-4 gap-1">
                                      <button
                                        type="button"
                                        disabled={!activeFacebookPage}
                                        className="min-h-8 border border-cyan-300/35 bg-cyan-300/10 px-2 py-1.5 text-[9px] font-black text-cyan-100 transition hover:bg-cyan-300/20 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                                        onClick={() =>
                                          void copyFacebookDuplicateUrl(option)
                                        }
                                      >
                                        Copy
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!activeFacebookPage}
                                        className="min-h-8 border border-amber-300/35 bg-amber-300/10 px-2 py-1.5 text-[9px] font-black text-amber-100 transition hover:bg-amber-300/20 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                                        onClick={(event) => {
                                          const openerWindow =
                                            event.currentTarget.ownerDocument.defaultView ??
                                            window;

                                          openFacebookDuplicateUrl(
                                            openerWindow,
                                            option,
                                          );
                                        }}
                                      >
                                        Mở
                                      </button>
                                      <button
                                        type="button"
                                        className="flex min-h-8 items-center justify-center border border-violet-300/30 bg-violet-300/10 text-violet-100 transition hover:bg-violet-300/20 active:opacity-80"
                                        onClick={() =>
                                          startEditingFacebookDuplicatePostOption(
                                            option,
                                          )
                                        }
                                        title="Sửa URL nhân bản"
                                        aria-label={`Sửa ${option.name}`}
                                      >
                                        <FiEdit3
                                          aria-hidden="true"
                                          className={iconClassName}
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        className="flex min-h-8 items-center justify-center border border-rose-300/30 bg-rose-300/10 text-rose-100 transition hover:bg-rose-300/20 active:opacity-80"
                                        onClick={() =>
                                          removeFacebookDuplicatePostOption(
                                            option.id,
                                          )
                                        }
                                        title="Xóa URL nhân bản"
                                        aria-label={`Xóa ${option.name}`}
                                      >
                                        <FiTrash2
                                          aria-hidden="true"
                                          className={iconClassName}
                                        />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </section>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 border border-dashed border-white/10 bg-black/20 p-4 text-center text-[10px] leading-5 text-slate-500">
                          Chưa có mẫu nhân bản. Thêm tên bài viết và URL có business_content_id để dùng chung cho các Fanpage.
                        </p>
                      )}
                    </article>
                  </div>
                </section>
              ) : null}

              {activeModal === "importExport" ? (
                <section className="flex w-full flex-col gap-3">
                  <article className="relative overflow-hidden rounded-md border border-amber-200/45 bg-[linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.08)_55%,rgba(15,23,42,0.9))] p-3 shadow-[0_18px_50px_rgba(245,158,11,0.1)] xl:p-4">
                    <div className="absolute inset-y-0 left-0 w-1 bg-amber-300" />

                    <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-amber-200/35 bg-amber-200/15 text-amber-100">
                          <FiUploadCloud
                            aria-hidden="true"
                            className="h-5 w-5"
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-black text-white">
                              Import dữ liệu
                            </h3>
                            <span className="rounded-md border border-amber-200/35 bg-amber-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-slate-950">
                              Thao tác chính
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] font-medium text-amber-50/75">
                            Khôi phục từ tệp JSON hoặc JSON.GZ
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-amber-100/60 bg-amber-300 px-4 py-2 text-xs font-black text-slate-950 shadow-[0_10px_30px_rgba(245,158,11,0.2)] transition hover:bg-amber-200 active:scale-[0.99] xl:w-auto xl:min-w-[260px]"
                        title="Import JSON hoặc JSON.GZ"
                        onClick={handleBeginBackupRestore}
                      >
                        <FiUploadCloud
                          aria-hidden="true"
                          className={iconClassName}
                        />
                        <span>
                          {isBackupRestoreReady
                            ? "Chọn tệp backup mới"
                            : "Import file backup"}
                        </span>
                      </button>
                    </div>
                  </article>

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,0.85fr)]">
                    <article className="flex min-w-0 flex-col rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] p-3">
                      <div className="flex items-center gap-2">
                        <FiDownload
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-cyan-200"
                        />
                        <div className="min-w-0">
                          <h3 className="text-xs font-black text-white">
                            Xuất bản sao
                          </h3>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Tải dữ liệu về thiết bị
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 xl:mt-auto xl:pt-3">
                        <button
                          type="button"
                          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-cyan-300 px-3 py-2 text-[11px] font-black text-slate-950 transition hover:bg-cyan-200 active:opacity-80"
                          onClick={handleExportJson}
                          title="Export JSON"
                        >
                          <FiDownload
                            aria-hidden="true"
                            className={iconClassName}
                          />
                          <span>JSON</span>
                        </button>

                        <button
                          type="button"
                          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-[11px] font-black text-cyan-100 transition hover:bg-cyan-300/20 active:opacity-80"
                          onClick={() => void handleExportJsonGzip()}
                          title="Export JSON.GZ"
                        >
                          <FiArchive
                            aria-hidden="true"
                            className={iconClassName}
                          />
                          <span>JSON.GZ</span>
                        </button>
                      </div>
                    </article>

                    <article className="flex min-w-0 flex-col rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-3">
                      <div className="flex items-center gap-2">
                        <FiUploadCloud
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-emerald-200"
                        />
                        <div className="min-w-0">
                          <h3 className="text-xs font-black text-white">
                            Dữ liệu Cloud
                          </h3>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Đồng bộ MongoDB và Cloudinary
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-[11px] font-black text-emerald-100 transition hover:bg-emerald-300/20 active:opacity-80 xl:mt-auto"
                        onClick={() => void handleRefreshCloudData()}
                        title="Đồng bộ dữ liệu mới nhất từ MongoDB"
                      >
                        <FiRefreshCcw
                          aria-hidden="true"
                          className={iconClassName}
                        />
                        <span>Đồng bộ Cloud</span>
                      </button>
                    </article>

                    <article className="flex min-w-0 flex-col rounded-md border border-rose-300/20 bg-rose-300/[0.05] p-3">
                      <div className="flex items-center gap-2">
                        <FiTrash2
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-rose-200"
                        />
                        <div className="min-w-0">
                          <h3 className="text-xs font-black text-white">
                            Xóa dữ liệu hệ thống
                          </h3>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Xóa MongoDB và ảnh Cloudinary
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-rose-300/40 bg-rose-300/10 px-3 py-2 text-[11px] font-black text-rose-100 transition hover:bg-rose-300/20 active:opacity-80 xl:mt-auto"
                        onClick={handleClearAllLocalData}
                        title="Xóa toàn bộ dữ liệu MongoDB và Cloudinary"
                      >
                        <FiTrash2
                          aria-hidden="true"
                          className={iconClassName}
                        />
                        <span>Xóa toàn bộ dữ liệu</span>
                      </button>
                    </article>
                  </div>
                </section>
              ) : null}

              {activeModal === "slotDetail" ? (
                selectedAssignedSlot ? (
                  <section className="grid grid-cols-1 gap-2 xl:grid-cols-[360px_1fr]">
                    <article className="rounded-md border border-white/10 bg-slate-950/70 p-2">
                      <button
                        type="button"
                        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-slate-900"
                        onClick={() =>
                          openImageAlbum({
                            productId: selectedAssignedSlot.product.id,
                            title: selectedAssignedSlot.product.name,
                            description: selectedAssignedSlot.description,
                            priceText: selectedAssignedSlot.product.priceText,
                            contentType:
                              selectedAssignedSlot.product.contentType,
                            realEstateComment:
                              selectedAssignedSlot.product.realEstateComment,
                            images: selectedAssignedSlot.product.images,
                            internalImages:
                              selectedAssignedSlot.product.internalImages,
                          })
                        }
                      >
                        {selectedAssignedSlot.product.images[0] ? (<img
                          src={selectedAssignedSlot.product.images[0].dataUrl}
                          alt={selectedAssignedSlot.product.name}
                          width={1200}
                          height={1200}
                          className="h-full w-full object-contain"
                        />
                        ) : (
                          <FiImage
                            aria-hidden="true"
                            className={`${iconClassName} text-slate-600`}
                          />
                        )}
                      </button>

                      {selectedAssignedSlot.product.images.length > 1 ? (
                        <div className="mt-2 grid grid-cols-5 gap-2">
                          {selectedAssignedSlot.product.images
                            .slice(0, 10)
                            .map((image) => (
                              <button
                                key={image.id}
                                type="button"
                                className="aspect-square overflow-hidden rounded-md bg-slate-900   transition "
                                onClick={() =>
                                  openImageAlbum({
                                    productId: selectedAssignedSlot.product.id,
                                    title: selectedAssignedSlot.product.name,
                                    description:
                                      selectedAssignedSlot.description,
                                    priceText: selectedAssignedSlot.product.priceText,
                                    contentType:
                                      selectedAssignedSlot.product.contentType,
                                    realEstateComment:
                                      selectedAssignedSlot.product.realEstateComment,
                                    images: selectedAssignedSlot.product.images,
                                    internalImages:
                                      selectedAssignedSlot.product.internalImages,
                                  })
                                }
                              > <img
                                  src={image.dataUrl}
                                  alt={image.name}
                                  width={1200}
                                  height={1200}
                                  className="h-full w-full object-contain"
                                />
                              </button>
                            ))}
                        </div>
                      ) : null}

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className={`flex items-center justify-center gap-2 rounded-md p-1.5 text-[10px] font-black transition ${selectedAssignedSlot.done
                            ? "bg-emerald-300 text-slate-950 hover:bg-emerald-200"
                            : "border border-white/10 bg-slate-800 text-white hover:bg-slate-700"
                            }`}
                          onClick={() =>
                            togglePostedSlot(
                              selectedAssignedSlot.date,
                              selectedAssignedSlot.slotIndex,
                              selectedAssignedSlot.taskIndex,
                            )
                          }
                        >
                          <FiCheck
                            aria-hidden="true"
                            className={iconClassName}
                          />
                        </button>

                        <button
                          type="button"
                          className={secondaryActionButtonClassName}
                          onClick={() =>
                            handleDownloadProductImages(
                              selectedAssignedSlot.product,
                            )
                          }
                        >
                          <FiDownload
                            aria-hidden="true"
                            className={iconClassName}
                          />
                        </button>
                      </div>
                    </article>

                    <article className="rounded-md border border-white/10 bg-slate-950/70 p-2">
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <div className="">
                          <div className="inline-flex rounded-md bg-cyan-300 px-3 py-1 text-xs font-black text-slate-950">
                            {selectedAssignedSlot.date} ·{" "}
                            {selectedAssignedSlot.time} ·{" "}
                            {selectedAssignedSlot.taskName} · Bài{" "}
                            {selectedAssignedSlot.slotIndex + 1}
                          </div>
                          <h3 className={`${fullCardItemNameClassName} mt-2 text-sm font-black text-white`}>
                            {selectedAssignedSlot.product.name}
                          </h3>
                          <p className="mt-1 text-xs text-slate-400">
                            {selectedAssignedSlot.product.category ||
                              "Chưa có danh mục"}
                          </p>
                          <p className="mt-1 text-xs font-black text-cyan-200">
                            {selectedAssignedSlot.product.priceText ||
                              "Chưa có giá"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                        <button
                          type="button"
                          className={secondaryActionButtonClassName}
                          onClick={() =>
                            void handleCopyField(
                              `slot-name-${selectedAssignedSlot.key}`,
                              "tên sản phẩm",
                              selectedAssignedSlot.product.name,
                            )
                          }
                        >
                          {renderCopyIcon(
                            `slot-name-${selectedAssignedSlot.key}`,
                          )}
                          Copy tên
                        </button>

                        <button
                          type="button"
                          className={secondaryActionButtonClassName}
                          onClick={() =>
                            void handleCopyField(
                              `slot-post-${selectedAssignedSlot.key}`,
                              "bài viết",
                              selectedAssignedSlot.postText,
                            )
                          }
                        >
                          {renderCopyIcon(
                            `slot-post-${selectedAssignedSlot.key}`,
                          )}
                          Copy bài
                        </button>

                        <button
                          type="button"
                          className="flex items-center justify-center gap-2 rounded-md bg-cyan-300 p-2 whitespace-nowrap text-xs font-black text-slate-950 transition hover:bg-cyan-200"
                          onClick={() =>
                            void handleCopyField(
                              `slot-desc-${selectedAssignedSlot.key}`,
                              "mô tả",
                              selectedAssignedSlot.description,
                            )
                          }
                        >
                          {renderCopyIcon(
                            `slot-desc-${selectedAssignedSlot.key}`,
                          )}
                          Copy mô tả
                        </button>

                        <button
                          type="button"
                          className={secondaryActionButtonClassName}
                          onClick={() =>
                            handleEdit(selectedAssignedSlot.product)
                          }
                        >
                          <FiEdit3
                            aria-hidden="true"
                            className={iconClassName}
                          />
                        </button>
                      </div>

                      <pre className="mt-2 max-h-[50dvh] overflow-y-auto whitespace-pre-wrap rounded-md border border-white/10 bg-slate-950 p-2 text-xs leading-6 text-slate-200">
                        {selectedAssignedSlot.postText ||
                          "Chưa có nội dung bài viết"}
                      </pre>
                    </article>
                  </section>
                ) : (
                  <div className="rounded-md border border-white/10 bg-slate-950/80 p-2 text-center text-xs text-slate-400">
                    Chưa tìm thấy bài đã xếp trong lịch.
                  </div>
                )
              ) : null}

              {activeModal === "imageAlbum" && albumSource ? (
                <section className="grid h-full min-h-0  grid-rows-[minmax(0,1fr)_minmax(170px,30dvh)] gap-2 overflow-hidden md:grid-rows-[minmax(0,1fr)_minmax(190px,28dvh)] xl:grid-cols-[minmax(0,1fr)_310px] xl:grid-rows-1">
                  <article className="flex min-h-0  flex-col overflow-hidden rounded-md border border-white/10 bg-slate-900 p-2 ">
                    <div className="mb-2 grid  grid-cols-1 gap-2 rounded-md border border-white/10 bg-slate-900 p-2   xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                      <div className=" rounded-md bg-black/20 px-2 py-1">
                        <h3 className={`${fullCardItemNameClassName} text-xs font-black text-white`}>
                          {albumSource.title}
                        </h3>
                        <p className="truncate whitespace-nowrap text-[10px] text-slate-400">
                          {albumImages.length} ảnh trong album · đang xem{" "}
                          {selectedAlbumImage
                            ? albumImages.findIndex(
                              (image) => image.id === selectedAlbumImage.id,
                            ) + 1
                            : 0}
                          /{albumImages.length} · đã chọn{" "}
                          {selectedAlbumImageIds.size}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-1 overflow-x-auto pb-1 xl:justify-end xl:overflow-visible xl:pb-0">
                        <button
                          type="button"
                          data-luxury-accent="indigo"
                          className={albumActionButtonBaseClassName}
                          onClick={() =>
                            void handleCopyField(
                              `album-post-${albumSource.title}`,
                              "post",
                              composeCopyText(
                                albumSource.description,
                                activeContactText,
                                includeSocialTags,
                              ),
                            )
                          }
                        >
                          {renderCopyIcon(`album-post-${albumSource.title}`)}
                          Post
                        </button>

                        <button
                          type="button"
                          data-luxury-accent="sapphire"
                          className={albumActionButtonBaseClassName}
                          onClick={() => void handleShareSelectedAlbumImages()}
                          title="Chia sẻ ảnh đã chọn"
                          aria-label="Chia sẻ ảnh đã chọn"
                          disabled={selectedAlbumImageIds.size === 0}
                        >
                          {copiedKey === "album-share-selected" ? (
                            <FiCheck
                              aria-hidden="true"
                              className={iconClassName}
                            />
                          ) : (
                            <FiShare2
                              aria-hidden="true"
                              className={iconClassName}
                            />
                          )}
                          Chia sẻ {selectedAlbumImageIds.size}
                        </button>

                        <button
                          type="button"
                          data-luxury-accent="emerald"
                          className={albumActionButtonBaseClassName}
                          onClick={handleDownloadSelectedAlbumImages}
                          title="Tải ảnh đã chọn"
                          aria-label="Tải ảnh đã chọn"
                        >
                          <FiDownload
                            aria-hidden="true"
                            className={iconClassName}
                          />
                          Tải đã chọn {selectedAlbumImageIds.size}
                        </button>

                        <button
                          type="button"
                          data-luxury-accent="gold"
                          className={albumActionButtonBaseClassName}
                          onClick={handleSelectAllAlbumImages}
                          title="Chọn tất cả ảnh"
                          aria-label="Chọn tất cả ảnh"
                        >
                          <FiCheckCircle
                            aria-hidden="true"
                            className={iconClassName}
                          />
                          Tất cả
                        </button>

                        <button
                          type="button"
                          data-luxury-accent="rose"
                          className={albumActionButtonBaseClassName}
                          onClick={handleClearSelectedAlbumImages}
                          title="Bỏ chọn ảnh"
                          aria-label="Bỏ chọn ảnh"
                        >
                          <FiX
                            aria-hidden="true"
                            className={iconClassName}
                          />
                          Bỏ
                        </button>

                        <button
                          type="button"
                          data-luxury-accent="amber"
                          className={albumActionButtonBaseClassName}
                          onClick={handleDownloadAlbumImages}
                          title="Tải toàn bộ album"
                          aria-label="Tải toàn bộ album"
                        >
                          <FiArchive
                            aria-hidden="true"
                            className={iconClassName}
                          />
                          Tải toàn bộ
                        </button>
                      </div>
                    </div>

                    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/35 p-2  ">
                      {selectedAlbumImage ? (
                        <div className="flex h-full min-h-0 w-full  items-center justify-center overflow-hidden">
                          <img
                            src={selectedAlbumImage.dataUrl}
                            alt={selectedAlbumImage.name}
                            width={1600}
                            height={1600}
                            className="block h-auto max-h-full w-auto max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <FiImage
                          aria-hidden="true"
                          className={`${iconClassName} text-slate-600`}
                        />
                      )}
                    </div>
                  </article>

                  <aside className="flex min-h-0  flex-col overflow-hidden rounded-md border border-white/10 bg-slate-900 p-2 ">
                    <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1.5">
                      <h3 className="text-xs font-black text-white">
                        Tất cả ảnh
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400">
                        {selectedAlbumImage
                          ? `${albumImages.findIndex((image) => image.id === selectedAlbumImage.id) + 1}/${albumImages.length}`
                          : `0/${albumImages.length}`}
                      </span>
                    </div>

                    <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-3 content-start gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-2">
                      {albumImages.map((image, index) => {
                        const active = image.id === selectedAlbumImage?.id;
                        const checked = selectedAlbumImageIds.has(image.id);
                        const internal = albumInternalImageIds.has(image.id);

                        return (
                          <button
                            key={image.id}
                            type="button"
                            className={`group relative aspect-square w-full shrink-0 overflow-hidden rounded-md bg-slate-900 transition active:opacity-80 ${checked
                              ? " "
                              : active
                                ? " "
                                : " "
                              }`}
                            onClick={() => toggleSelectedAlbumImage(image.id)}
                            title={`${internal ? "Ảnh nội bộ" : "Ảnh chính"} ${index + 1}`}
                          >
                            <img
                              src={image.dataUrl}
                              alt={image.name}
                              width={1200}
                              height={1200}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                            <span
                              className={`absolute left-1 top-1 rounded-md px-1.5 py-0.5 text-[10px] font-black ${active
                                ? "bg-amber-200 text-slate-950"
                                : "bg-black/70 text-white"
                                }`}
                            >
                              {index + 1}
                            </span>

                            {internal ? (
                              <span className="absolute bottom-1 left-1 rounded-md bg-violet-300 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                                Nội bộ
                              </span>
                            ) : null}

                            {checked ? (
                              <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-emerald-300 text-slate-950  ">
                                <FiCheck
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5"
                                />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </aside>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {pendingConfirm ? (
        <div className="luxury-modal-overlay fixed inset-0 z-[1000001] flex h-dvh w-full items-center justify-center p-2">
          <div className={compactLuxuryDialogClassName}>
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2">
              <div className="">
                <h3 className="text-xs font-black text-white">
                  {pendingConfirm.title}
                </h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {pendingConfirm.description}
                </p>
              </div>
              <button
                type="button"
                disabled={isConfirmExecuting}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-slate-800 text-slate-200 transition hover:bg-slate-700 active:opacity-80 disabled:cursor-wait disabled:opacity-50"
                onClick={closeConfirm}
              >
                <FiX aria-hidden="true" className={iconClassName} />
              </button>
            </div>

            <div
              className={`mt-2 grid gap-2 ${pendingConfirm.onSecondary
                ? "grid-cols-1 xl:grid-cols-3"
                : "grid-cols-2"
                }`}
            >
              <button
                type="button"
                disabled={isConfirmExecuting}
                className="rounded-md border border-white/10 bg-slate-800 p-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-50"
                onClick={closeConfirm}
              >
                {pendingConfirm.cancelLabel ?? "Hủy"}
              </button>

              <button
                type="button"
                disabled={isConfirmExecuting}
                className={`rounded-md p-2 text-xs font-black transition disabled:cursor-wait disabled:opacity-60 ${pendingConfirm.tone === "danger"
                  ? "bg-rose-500 text-white hover:bg-rose-400"
                  : pendingConfirm.tone === "warning"
                    ? "bg-amber-300 text-slate-950 hover:bg-amber-200"
                    : "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                  }`}
                onClick={() => void executeConfirm()}
              >
                {isConfirmExecuting
                  ? "Đang xử lý..."
                  : pendingConfirm.confirmLabel}
              </button>

              {pendingConfirm.onSecondary && pendingConfirm.secondaryLabel ? (
                <button
                  type="button"
                  disabled={isConfirmExecuting}
                  className="rounded-md border border-amber-200/50 bg-amber-300/15 p-2 text-xs font-black text-amber-50 transition hover:bg-amber-300/25 disabled:cursor-wait disabled:opacity-60"
                  onClick={() => void executeConfirmSecondary()}
                >
                  {isConfirmExecuting
                    ? "Đang xử lý..."
                    : pendingConfirm.secondaryLabel}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {pendingBackup ? (
        <div className="luxury-modal-overlay fixed inset-0 z-[999999] flex h-dvh w-full items-center justify-center p-2">
          <div className={compactLuxuryDialogClassName}>
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div className="">
                <h3 className="text-sm font-black text-white">
                  File {pendingBackup.label} đã sẵn sàng
                </h3>
                <p className="mt-2 break-all text-xs leading-5 text-slate-400">
                  {pendingBackup.filename}
                </p>
                <p className="mt-1 text-xs font-bold text-cyan-100">
                  Dung lượng: {formatFileSize(pendingBackup.blob.size)}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Trên iPhone, nhấn Lưu file rồi chọn Lưu vào Tệp trong bảng chia sẻ.
                </p>
              </div>

              <button
                type="button"
                disabled={isBackupSaving}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-slate-800 text-slate-200 transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-50"
                onClick={() => setPendingBackup(null)}
                aria-label="Đóng file backup"
              >
                <FiX aria-hidden="true" className={iconClassName} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isBackupSaving}
                className="rounded-md border border-white/10 bg-slate-800 p-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-50"
                onClick={() => setPendingBackup(null)}
              >
                Hủy
              </button>

              <button
                type="button"
                disabled={isBackupSaving}
                className="rounded-md bg-cyan-300 p-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
                onClick={() => void handleSavePreparedBackup()}
              >
                {isBackupSaving ? "Đang mở..." : "Lưu file"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingRemoveTaskIndex !== null ? (
        <div className="luxury-modal-overlay fixed inset-0 z-modal-top flex h-dvh w-full items-center justify-center p-2">
          <div className={compactLuxuryDialogClassName}>
            <h3 className="text-xs font-black text-white">Xoá task đã chọn?</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Thao tác này chỉ xoá{" "}
              {getTaskName(scheduleConfig, pendingRemoveTaskIndex)} và dồn các
              task phía sau lên đúng thứ tự.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-md border border-white/10 bg-slate-800 p-2 text-xs font-black text-white transition hover:bg-slate-700"
                onClick={() => setPendingRemoveTaskIndex(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="rounded-md bg-rose-500 p-2 text-xs font-black text-white transition hover:bg-rose-400"
                onClick={() => removeScheduleTask(pendingRemoveTaskIndex)}
              >
                Xoá task
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isFacebookSearchDialogOpen ? (
        <div
          className="luxury-modal-overlay fixed inset-0 z-modal-top flex h-dvh w-full items-center justify-center overflow-hidden p-2 xl:p-5"
          onClick={() => setIsFacebookSearchDialogOpen(false)}
        >
          <form
            className="luxury-dialog w-full max-w-xl border p-4 xl:p-5"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSubmitFacebookSearch}
          >
            <div className="flex min-w-0 items-start justify-between gap-3 border-b border-[#d8c99f]/20 pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#d8c99f]/30 bg-[#d8c99f]/10 text-[#eadfbe]">
                  <FiSearch aria-hidden="true" className={iconClassName} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-white">
                    Facebook Search
                  </h2>
                  <p className="mt-1 text-[10px] leading-5 text-slate-400">
                    Nhập nội dung cần tìm trước khi mở Facebook.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-slate-900/80 text-slate-300 transition hover:border-[#d8c99f]/40 hover:bg-[#d8c99f]/10 hover:text-[#eadfbe]"
                onClick={() => setIsFacebookSearchDialogOpen(false)}
                aria-label="Đóng Facebook Search"
              >
                <FiX aria-hidden="true" className={iconClassName} />
              </button>
            </div>

            <label className="mt-4 grid gap-1.5">
              <span className="text-[10px] font-black text-slate-300">
                Nội dung tìm kiếm
              </span>
              <input
                autoFocus
                type="search"
                value={facebookSearchQuery}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setFacebookSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setIsFacebookSearchDialogOpen(false);
                  }

                  event.stopPropagation();
                }}
                className="min-h-11 w-full border border-white/15 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-[#d8c99f]/60 focus:shadow-[0_0_0_3px_rgba(216,201,159,0.08)]"
                placeholder="Ví dụ: laptop"
              />
            </label>

            <div className="mt-3 flex items-center justify-between gap-3 border border-emerald-300/20 bg-emerald-300/[0.07] p-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-black text-emerald-100">
                  Bài viết gần đây nhất
                </p>
                <p className="mt-0.5 text-[9px] leading-4 text-slate-500">
                  Bộ lọc này được chèn tự động vào URL Facebook Search.
                </p>
              </div>
              <span className="shrink-0 border border-emerald-200/35 bg-emerald-200/10 px-2 py-1 text-[9px] font-black text-emerald-100">
                ĐANG BẬT
              </span>
            </div>

            <p className="mt-3 text-[9px] leading-4 text-slate-500">
              PC mở bốn popup theo lưới 2×2. Mobile chỉ mở một tab. Trình duyệt có thể yêu cầu cho phép cửa sổ bật lên.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#d8c99f]/15 pt-3">
              <button
                type="button"
                className="min-h-10 border border-white/15 bg-slate-900/80 px-3 py-2 text-xs font-black text-slate-200 transition hover:border-white/25 hover:bg-slate-800"
                onClick={() => setIsFacebookSearchDialogOpen(false)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-10 border border-[#f0e3c0]/80 bg-[linear-gradient(135deg,#f2e8cd,#c9b47c)] px-3 py-2 text-xs font-black text-[#17130a] transition hover:brightness-105 active:opacity-80"
              >
                Mở Facebook Search
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {pendingShare ? (
        <div className="luxury-modal-overlay fixed inset-0 z-modal-top flex h-dvh w-full items-center justify-center overflow-hidden p-2 xl:p-5">
          <div
            data-share-dialog="true"
            className="luxury-dialog max-h-[calc(100dvh-1rem)] w-full min-w-0 max-w-6xl overflow-x-hidden overflow-y-auto overscroll-contain border p-3 xl:max-h-[calc(100dvh-2.5rem)] xl:overflow-y-hidden xl:p-4"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#d8c99f]/20 pb-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black text-white">
                  {shareDialogStep === "facebookGroup"
                    ? "Chọn nội dung copy cho Group FB"
                    : "Chọn nội dung chia sẻ"}
                </h2>
                <p className="mt-1 text-[10px] leading-5 text-slate-400">
                  {shareDialogStep === "facebookGroup"
                    ? "Nội dung được copy vào clipboard, bảng chia sẻ chỉ gửi hình ảnh."
                    : `${pendingShare.title} · ${pendingShare.images.length + (includeInternalShareImages ? (pendingShare.internalImages?.length ?? 0) : 0)} ảnh`}
                </p>
              </div>

              <button
                type="button"
                disabled={isShareExecuting}
                className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#d8c99f]/25 bg-[#d8c99f]/[0.06] text-[#eadfbe] transition hover:border-[#d8c99f]/50 hover:bg-[#d8c99f]/10 active:opacity-80 disabled:cursor-wait disabled:opacity-50"
                onClick={() => {
                  setPendingShare(null);
                  setIncludeInternalShareImages(true);
                  setShareDialogStep("share");
                  setFacebookGroupActiveIndex(0);
                }}
                aria-label="Đóng chọn nội dung chia sẻ"
              >
                <FiX aria-hidden="true" className={iconClassName} />
              </button>
            </div>

            <button
              type="button"
              disabled={
                isShareExecuting ||
                (pendingShare.internalImages?.length ?? 0) === 0
              }
              aria-pressed={!includeInternalShareImages}
              className={`mt-2 flex w-full items-center justify-between gap-3 border p-2.5 text-left transition active:opacity-80 disabled:cursor-wait disabled:opacity-50 ${!includeInternalShareImages
                ? "border-rose-300/45 bg-rose-300/10 text-rose-50"
                : "border-amber-300/35 bg-amber-300/[0.07] text-amber-50"
                }`}
              onClick={() =>
                setIncludeInternalShareImages((current) => !current)
              }
            >
              <span className="min-w-0">
                <span className="block text-xs font-black">
                  Bỏ qua ảnh nội bộ
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-slate-400">
                  Mặc định tải toàn bộ ảnh chính và ảnh nội bộ
                </span>
                <span className="mt-0.5 block text-[9px] leading-4 text-slate-500">
                  Chỉ áp dụng cho các nút chia sẻ và Share Sheet, không thay
                  đổi tải ảnh Meta của Fanpage hoặc Group
                </span>
              </span>
              <span
                className={`relative h-5 w-9 shrink-0 border transition ${!includeInternalShareImages
                  ? "border-rose-200/70 bg-rose-300/40"
                  : "border-amber-200/50 bg-slate-800"
                  }`}
                aria-hidden="true"
              >
                <span
                  className={`absolute top-0.5 h-3.5 w-3.5 bg-white transition-transform ${!includeInternalShareImages
                    ? "translate-x-[17px]"
                    : "translate-x-0.5"
                    }`}
                />
              </span>
            </button>

            <section className="mt-2 border border-[#d8c99f]/20 bg-slate-950/45 p-2">
              {shareDialogStep === "facebookGroup" ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isShareExecuting}
                    className="min-h-11 border border-cyan-300/40 bg-cyan-300/10 p-3 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/20 active:opacity-80 disabled:cursor-wait disabled:opacity-50"
                    onClick={() => void executeShareRequest("post", true)}
                  >
                    Copy Post
                  </button>
                  <button
                    type="button"
                    disabled={isShareExecuting}
                    className="min-h-11 border border-amber-300/40 bg-amber-300/10 p-3 text-xs font-black text-amber-100 transition hover:bg-amber-300/20 active:opacity-80 disabled:cursor-wait disabled:opacity-50"
                    onClick={() => void executeShareRequest("comment", true)}
                  >
                    Copy Cmt
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                  <button
                    type="button"
                    disabled={isShareExecuting}
                    className="min-h-11 border border-cyan-300/40 bg-cyan-300/10 p-3 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/20 active:opacity-80 disabled:cursor-wait disabled:opacity-50"
                    onClick={() => void executeShareRequest("post")}
                  >
                    Post
                  </button>
                  <button
                    type="button"
                    disabled={isShareExecuting}
                    className="min-h-11 border border-amber-300/40 bg-amber-300/10 p-3 text-xs font-black text-amber-100 transition hover:bg-amber-300/20 active:opacity-80 disabled:cursor-wait disabled:opacity-50"
                    onClick={() => void executeShareRequest("comment")}
                  >
                    Cmt
                  </button>
                  <button
                    type="button"
                    disabled={isShareExecuting}
                    className="min-h-11 border border-white/15 bg-slate-800/80 p-3 text-xs font-black text-white transition hover:border-white/25 hover:bg-slate-700 active:opacity-80 disabled:cursor-wait disabled:opacity-50"
                    onClick={() => void executeShareRequest("imagesOnly")}
                  >
                    Chỉ hình ảnh
                  </button>
                  <button
                    type="button"
                    disabled={isShareExecuting}
                    className="min-h-11 border border-violet-300/30 bg-violet-300/10 p-3 text-[9px] font-black text-violet-100 transition hover:bg-violet-300/20 active:opacity-80 disabled:cursor-wait disabled:opacity-50"
                    onClick={() => setShareDialogStep("facebookGroup")}
                  >
                    Gruop FB(Dành cho iPhone)
                  </button>
                </div>
              )}
            </section>

            {shareDialogStep === "share" ? (
              <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 xl:grid-cols-2">
                <section className="flex min-w-0 flex-col border border-[#d8c99f]/25 bg-[#d8c99f]/[0.055] p-2.5">
                  {settings.facebookPages.length > 0 ? (
                    <>
                      <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#d8c99f]/15 pb-2">
                        <div>
                          <p className="text-[10px] font-black text-[#eadfbe]">
                            Fanpage Facebook
                          </p>
                          <p className="mt-0.5 text-[9px] text-slate-500">
                            Copy nội dung, tải ảnh chính và mở Meta Business
                            Composer
                          </p>
                        </div>
                        <span className="border border-[#d8c99f]/25 bg-[#d8c99f]/10 px-2 py-1 text-[9px] font-black text-[#eadfbe]">
                          Page
                        </span>
                      </div>
                      <div className="max-h-52 space-y-1.5 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                        {settings.facebookPages.map((option) => (
                          <article
                            key={option.id}
                            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-stretch gap-1.5 border border-white/10 bg-slate-950/55 p-1.5"
                          >
                            <div className="min-w-0 px-1.5 py-1">
                              <p className="truncate text-[10px] font-black text-[#eadfbe]">
                                {option.name}
                              </p>
                              <p className="mt-0.5 truncate font-mono text-[8px] text-slate-500">
                                {option.assetId}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={isShareExecuting}
                              className="min-w-16 border border-cyan-300/35 bg-cyan-300/10 px-2 py-2 text-[9px] font-black text-cyan-100 transition hover:bg-cyan-300/20 active:opacity-80 disabled:cursor-wait disabled:opacity-40"
                              onClick={(event) => {
                                const openerWindow =
                                  event.currentTarget.ownerDocument.defaultView ??
                                  window;

                                handleOpenMetaBusinessComposer(
                                  openerWindow,
                                  option,
                                  "post",
                                );
                              }}
                            >
                              Meta Post
                            </button>

                            <button
                              type="button"
                              disabled={isShareExecuting}
                              className="min-w-16 border border-amber-300/35 bg-amber-300/10 px-2 py-2 text-[9px] font-black text-amber-100 transition hover:bg-amber-300/20 active:opacity-80 disabled:cursor-wait disabled:opacity-40"
                              onClick={(event) => {
                                const openerWindow =
                                  event.currentTarget.ownerDocument.defaultView ??
                                  window;

                                handleOpenMetaBusinessComposer(
                                  openerWindow,
                                  option,
                                  "comment",
                                );
                              }}
                            >
                              Meta Cmt
                            </button>
                          </article>
                        ))}
                      </div>
                      <p className="mt-auto pt-3 text-[9px] leading-4 text-slate-400">
                        Meta Post/Cmt luôn tự tải ảnh chính và bỏ qua ảnh nội bộ. Mobile có thể dùng các nút chia sẻ bên dưới để gửi ảnh qua Share Sheet.
                      </p>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isShareExecuting}
                      className="w-full border border-dashed border-[#d8c99f]/30 bg-black/20 px-3 py-2 text-[10px] font-black text-[#eadfbe] transition hover:bg-[#d8c99f]/[0.08] disabled:opacity-40"
                      onClick={() => {
                        setPendingShare(null);
                        setIncludeInternalShareImages(true);
                        openModal("facebookPages");
                      }}
                    >
                      Cấu hình Fanpage và Asset ID
                    </button>
                  )}
                </section>

                <section className="flex min-w-0 flex-col border border-violet-300/25 bg-violet-300/[0.055] p-2.5">
                  {selectedFacebookGroups.length > 0 ? (
                    <>
                      <div className="flex min-w-0 items-start justify-between gap-2 border-b border-violet-300/15 pb-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-violet-100">
                            Danh sách Group Facebook
                          </p>
                          <p className="mt-0.5 text-[9px] leading-4 text-slate-500">
                            Meta Post/Cmt copy nội dung, tải ảnh chính và mở Group
                          </p>
                        </div>
                        <span className="shrink-0 border border-violet-200/35 bg-violet-200/10 px-2 py-1 text-[9px] font-black text-violet-100">
                          {selectedFacebookGroups.length} Group
                        </span>
                      </div>

                      <div className="mt-2 h-44 space-y-1.5 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable] xl:h-52">
                        {selectedFacebookGroupGroups.map((categoryGroup) => (
                          <section
                            key={normalizeTextKey(categoryGroup.category)}
                            className="min-w-0 border border-violet-300/15 bg-black/15 p-1.5"
                          >
                            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-violet-300/15 px-1 pb-1.5">
                              <p className="truncate text-[9px] font-black text-violet-100">
                                {categoryGroup.category}
                              </p>
                              <span className="shrink-0 border border-violet-200/25 bg-violet-300/10 px-1.5 py-0.5 text-[8px] font-black text-violet-100">
                                {categoryGroup.options.length}
                              </span>
                            </div>

                            <div className="mt-1.5 space-y-1.5">
                              {categoryGroup.options.map(
                                ({ option: group, index: groupIndex }) => {
                                  const isActiveGroup =
                                    groupIndex ===
                                    facebookGroupActiveIndex %
                                    selectedFacebookGroups.length;

                                  return (
                                    <article
                                      key={group.id}
                                      className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-stretch gap-1.5 border p-1.5 transition ${isActiveGroup
                                        ? "border-[#f0e3c0]/65 bg-[linear-gradient(135deg,rgba(216,201,159,0.16),rgba(139,92,246,0.08))] shadow-[inset_3px_0_0_rgba(240,227,192,0.75),0_8px_24px_rgba(0,0,0,0.18)]"
                                        : "border-white/10 bg-slate-950/55 hover:border-violet-300/30 hover:bg-violet-300/[0.06]"
                                        }`}
                                    >
                                      <button
                                        type="button"
                                        disabled={isShareExecuting}
                                        aria-pressed={isActiveGroup}
                                        className="flex min-w-0 cursor-pointer items-center gap-2 px-1.5 py-1 text-left disabled:cursor-wait disabled:opacity-50"
                                        onClick={() =>
                                          setFacebookGroupActiveIndex(groupIndex)
                                        }
                                      >
                                        <span
                                          aria-hidden="true"
                                          className={`h-2 w-2 shrink-0 border ${isActiveGroup
                                            ? "border-[#f0e3c0] bg-[#f0e3c0] shadow-[0_0_10px_rgba(240,227,192,0.55)]"
                                            : "border-slate-600 bg-slate-900"
                                            }`}
                                        />
                                        <span className="min-w-0 flex-1">
                                          <span className="mb-0.5 block truncate text-[8px] font-black uppercase tracking-[0.08em] text-violet-200/75">
                                            {normalizeCategoryName(group.category) ||
                                              "Chưa phân loại"}
                                          </span>
                                          <span className={`block truncate text-[10px] font-black ${isActiveGroup ? "text-[#f4e8c7]" : "text-slate-200"}`}>
                                            {group.name}
                                          </span>
                                          <span className="mt-0.5 block truncate text-[8px] text-slate-500">
                                            {group.url}
                                          </span>
                                        </span>
                                        {isActiveGroup ? (
                                          <span className="shrink-0 border border-[#f0e3c0]/40 bg-[#f0e3c0]/10 px-1.5 py-0.5 text-[8px] font-black text-[#f4e8c7]">
                                            ACTIVE
                                          </span>
                                        ) : null}
                                      </button>

                                      <button
                                        type="button"
                                        disabled={isShareExecuting}
                                        title={`Mở ${group.name}, copy Post và tải ảnh chính`}
                                        aria-label={`Mở ${group.name}, copy Post và tải ảnh chính`}
                                        className="min-w-14 border border-cyan-300/30 bg-cyan-300/[0.08] px-2 py-1.5 text-[9px] font-black text-cyan-100 transition hover:border-cyan-200/55 hover:bg-cyan-300/15 active:opacity-80 disabled:cursor-wait disabled:opacity-40"
                                        onClick={(event) => {
                                          const openerWindow =
                                            event.currentTarget.ownerDocument.defaultView ??
                                            window;

                                          handleOpenFacebookGroup(
                                            openerWindow,
                                            groupIndex,
                                            "post",
                                          );
                                        }}
                                      >
                                        Meta Post
                                      </button>

                                      <button
                                        type="button"
                                        disabled={isShareExecuting}
                                        title={`Mở ${group.name}, copy Cmt và tải ảnh chính`}
                                        aria-label={`Mở ${group.name}, copy Cmt và tải ảnh chính`}
                                        className="min-w-14 border border-amber-300/30 bg-amber-300/[0.08] px-2 py-1.5 text-[9px] font-black text-amber-100 transition hover:border-amber-200/55 hover:bg-amber-300/15 active:opacity-80 disabled:cursor-wait disabled:opacity-40"
                                        onClick={(event) => {
                                          const openerWindow =
                                            event.currentTarget.ownerDocument.defaultView ??
                                            window;

                                          handleOpenFacebookGroup(
                                            openerWindow,
                                            groupIndex,
                                            "comment",
                                          );
                                        }}
                                      >
                                        Meta Cmt
                                      </button>
                                    </article>
                                  );
                                },
                              )}
                            </div>
                          </section>
                        ))}
                      </div>

                      {activeFacebookGroup ? (
                        <div className="mt-2 border border-[#d8c99f]/20 bg-black/20 p-2">
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                                Share Sheet cho Group active
                              </p>
                              <p className="mt-1 truncate text-[10px] font-black text-[#f4e8c7]">
                                {activeFacebookGroup.name}
                              </p>
                              <p className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-[0.08em] text-violet-200/70">
                                {normalizeCategoryName(
                                  activeFacebookGroup.category,
                                ) || "Chưa phân loại"}
                              </p>
                            </div>
                            <span className="shrink-0 bg-[#d8c99f] px-2 py-1 text-[8px] font-black text-[#17130a]">
                              ACTIVE
                            </span>
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={isShareExecuting}
                              className="min-h-9 border border-emerald-300/35 bg-emerald-300/10 px-2 py-2 text-[9px] font-black text-emerald-100 transition hover:bg-emerald-300/20 active:opacity-80 disabled:cursor-wait disabled:opacity-40"
                              onClick={() =>
                                void handleShareFacebookGroupImages(
                                  facebookGroupActiveIndex % selectedFacebookGroups.length,
                                  "post",
                                )
                              }
                            >
                              Ảnh + Post
                            </button>
                            <button
                              type="button"
                              disabled={isShareExecuting}
                              className="min-h-9 border border-fuchsia-300/35 bg-fuchsia-300/10 px-2 py-2 text-[9px] font-black text-fuchsia-100 transition hover:bg-fuchsia-300/20 active:opacity-80 disabled:cursor-wait disabled:opacity-40"
                              onClick={() =>
                                void handleShareFacebookGroupImages(
                                  facebookGroupActiveIndex % selectedFacebookGroups.length,
                                  "comment",
                                )
                              }
                            >
                              Ảnh + Cmt
                            </button>
                          </div>

                          <p className="mt-2 text-[8px] leading-4 text-slate-500">
                            Meta Post/Cmt luôn tải ảnh chính và bỏ qua ảnh nội bộ. Share Sheet sử dụng trạng thái ở công tắc phía trên.
                          </p>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isShareExecuting}
                      className="w-full border border-dashed border-violet-300/30 bg-black/20 px-3 py-2 text-[10px] font-black text-violet-100 transition hover:bg-violet-300/[0.08] disabled:opacity-40"
                      onClick={() => {
                        setPendingShare(null);
                        setIncludeInternalShareImages(true);
                        openModal("facebookPages");
                      }}
                    >
                      Cấu hình link Group Facebook
                    </button>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {pendingDownload ? (
        <div className="luxury-modal-overlay fixed inset-0 z-modal-top flex h-dvh w-full items-center justify-center p-2">
          <div className="flex h-[90dvh] w-full items-center justify-center bg-transparent p-2">
            <div className={compactLuxuryDialogClassName}>
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="">
                  <h2 className={`${fullCardItemNameClassName} text-xs font-black text-white`}>
                    {pendingDownload.title}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {pendingDownload.description}
                  </p>
                  <p className="mt-1 text-[10px] font-black text-amber-100">
                    {getDownloadImages(pendingDownload).length} ảnh sẽ được tải
                  </p>
                </div>

                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-slate-800 text-slate-200  transition hover:bg-slate-700 active:opacity-80"
                  onClick={() => {
                    setPendingDownload(null);
                    setSkipInternalDownloadImages(false);
                  }}
                >
                  <FiX aria-hidden="true" className={iconClassName} />
                </button>
              </div>

              {(pendingDownload.internalImages?.length ?? 0) > 0 ? (
                <button
                  type="button"
                  aria-pressed={skipInternalDownloadImages}
                  className={`mt-2 flex w-full items-center justify-between gap-3 border p-2.5 text-left transition active:opacity-80 ${skipInternalDownloadImages
                    ? "border-rose-300/45 bg-rose-300/10 text-rose-50"
                    : "border-amber-300/35 bg-amber-300/[0.07] text-amber-50"
                    }`}
                  onClick={() =>
                    setSkipInternalDownloadImages((current) => !current)
                  }
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-black">
                      Bỏ qua ảnh nội bộ
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-slate-400">
                      Mặc định tải toàn bộ ảnh chính và ảnh nội bộ
                    </span>
                  </span>
                  <span
                    className={`relative h-5 w-9 shrink-0 border transition ${skipInternalDownloadImages
                      ? "border-rose-200/70 bg-rose-300/40"
                      : "border-amber-200/50 bg-slate-800"
                      }`}
                    aria-hidden="true"
                  >
                    <span
                      className={`absolute top-0.5 h-3.5 w-3.5 bg-white transition-transform ${skipInternalDownloadImages
                        ? "translate-x-[17px]"
                        : "translate-x-0.5"
                        }`}
                    />
                  </span>
                </button>
              ) : null}

              <div className="mt-2 grid grid-cols-1 gap-2">
                {canUseDirectoryPicker() ? (
                  <button
                    type="button"
                    disabled={getDownloadImages(pendingDownload).length === 0}
                    className="rounded-md bg-cyan-300 p-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void executeDownloadToFolder()}
                  >
                    {localImageDirectoryHandle
                      ? `Lưu vào ${localImageDirectoryHandle.name}`
                      : "Chọn thư mục & lưu ảnh"}
                  </button>
                ) : null}

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    className="rounded-md border border-white/10 bg-slate-800 p-2 text-xs font-bold text-white transition hover:bg-slate-700"
                    onClick={() => {
                      setPendingDownload(null);
                      setSkipInternalDownloadImages(false);
                    }}
                  >
                    Hủy
                  </button>

                  <button
                    type="button"
                    disabled={getDownloadImages(pendingDownload).length === 0}
                    className="rounded-md bg-cyan-300 p-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void executeDownloadRequest()}
                  >
                    Tải
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );

  if (!pictureInPictureWindow || pictureInPictureWindow.closed) {
    return localProductsWorkspace;
  }

  return (
    <>
      <main
        className={`flex min-h-dvh w-full items-center justify-center bg-[radial-gradient(circle_at_50%_0,rgba(230,207,139,0.15),transparent_34%),linear-gradient(rgba(230,207,139,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(230,207,139,0.025)_1px,transparent_1px),linear-gradient(145deg,#050a11,#0a1520)] bg-[length:auto,32px_32px,32px_32px,auto] p-4 text-slate-100`}
      >
        <section className="w-full max-w-md border border-[#e6cf8b]/35 bg-[linear-gradient(145deg,rgba(14,29,43,0.99),rgba(4,10,17,0.998))] p-5 text-center shadow-[inset_3px_0_0_rgba(230,207,139,0.16),0_32px_90px_rgba(0,0,0,0.6)] [clip-path:polygon(12px_0,calc(100%_-_5px)_0,100%_5px,100%_calc(100%_-_12px),calc(100%_-_12px)_100%,5px_100%,0_calc(100%_-_5px),0_12px)]">
          <div className="mx-auto flex h-10 w-10 items-center justify-center border border-[#f5e9c7]/75 bg-[linear-gradient(135deg,#f5e9c7,#d6ba6b)] text-[#17130a] shadow-[0_0_22px_rgba(230,207,139,0.24),0_12px_32px_rgba(0,0,0,0.28)] [clip-path:polygon(8px_0,100%_0,100%_calc(100%_-_8px),calc(100%_-_8px)_100%,0_100%,0_8px)]">
            <FiMonitor aria-hidden="true" className="h-5 w-5" />
          </div>
          <h1 className="mt-3 text-sm font-black text-white">
            Local Product Manager đang mở dạng cửa sổ nổi
          </h1>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Chuyển sang Facebook để tiếp tục thao tác trong cửa sổ nổi.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="border border-[#f5e9c7]/80 bg-[linear-gradient(135deg,#f5e9c7,#d6ba6b)] px-3 py-2 text-xs font-black text-[#17130a] shadow-[0_8px_24px_rgba(230,207,139,0.18)] transition hover:brightness-105 active:opacity-80 [clip-path:polygon(7px_0,calc(100%_-_7px)_0,100%_7px,100%_calc(100%_-_7px),calc(100%_-_7px)_100%,7px_100%,0_calc(100%_-_7px),0_7px)]"
              onClick={handleFocusPictureInPicture}
            >
              Hiện cửa sổ nổi
            </button>
            <button
              type="button"
              className="border border-[#e6cf8b]/30 bg-[#0b1824] px-3 py-2 text-xs font-black text-slate-200 transition hover:border-[#e6cf8b]/55 hover:bg-[#102536] hover:text-[#f1e5c2] active:opacity-80 [clip-path:polygon(7px_0,calc(100%_-_7px)_0,100%_7px,100%_calc(100%_-_7px),calc(100%_-_7px)_100%,7px_100%,0_calc(100%_-_7px),0_7px)]"
              onClick={handleClosePictureInPicture}
            >
              Đóng và trở lại tab
            </button>
          </div>
        </section>
      </main>

      {createPortal(
        localProductsWorkspace,
        pictureInPictureWindow.document.body,
      )}
    </>
  );
}