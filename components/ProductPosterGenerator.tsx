'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type ClipboardEvent as ReactClipboardEvent,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from 'react';
import {
    FiAlignCenter,
    FiAlignLeft,
    FiAlignRight,
    FiCheck,
    FiDownload,
    FiImage,
    FiLoader,
    FiMove,
    FiRefreshCw,
    FiUploadCloud,
    FiX,
} from 'react-icons/fi';

type ProductPosterGeneratorProps = {
    onClose: () => void;
    initialProductName?: string;
    initialPrice?: string;
    initialImageUrl?: string;
    initialImageName?: string;
    onSavePoster?: (posterBlob: Blob, fileName: string, posterName: string) => Promise<void>;
};

type RemovalProgress = {
    label: string;
    percent: number;
};

type AlphaBounds = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type PosterLayerId = 'title' | 'price' | 'product';
type PosterLayer = {
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
};
type PosterLayout = Record<PosterLayerId, PosterLayer>;
type PointerMode = 'move' | 'resize';
type PosterPointerAction = {
    pointerId: number;
    layerId: PosterLayerId;
    mode: PointerMode;
    startClientX: number;
    startClientY: number;
    stageWidth: number;
    stageHeight: number;
    initial: PosterLayer;
};

type TextAlignment = 'left' | 'center' | 'right';


const POSTER_SIZE = 1600;
const MAX_PROCESSING_IMAGE_DIMENSION = 3200;
const ALPHA_SCAN_MAX_DIMENSION = 1600;
const PRODUCT_LAYER_MIN_SCALE = 0.2;
const PRODUCT_LAYER_MAX_SCALE = 7;
const PRODUCT_LAYER_MIN_VISIBLE_PERCENT = 8;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const MAX_BACKGROUND_BYTES = 24 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
]);

const INITIAL_LAYOUT: PosterLayout = {
    title: { x: 4, y: 2.5, width: 92, height: 15, fontSize: 145 },
    price: { x: 8, y: 19, width: 84, height: 18, fontSize: 255 },
    product: { x: 8, y: 38, width: 84, height: 59, fontSize: 0 },
};

const LAYER_LABELS: Record<PosterLayerId, string> = {
    title: 'Tên sản phẩm',
    price: 'Giá',
    product: 'Ảnh sản phẩm',
};

const clamp = (value: number, minimum: number, maximum: number): number =>
    Math.min(maximum, Math.max(minimum, value));

const getProgressLabel = (stage: string): string => {
    switch (stage) {
        case 'preparing':
            return 'Đang khởi tạo AI...';
        case 'downloading':
            return 'Đang tải mô hình AI...';
        case 'processing':
            return 'Đang tách nền sản phẩm...';
        case 'finishing':
            return 'Đang hoàn thiện ảnh PNG...';
        default:
            return 'Đang xử lý ảnh...';
    }
};

const loadImageBitmap = async (blob: Blob): Promise<ImageBitmap> => {
    if (typeof createImageBitmap !== 'function') {
        throw new Error('Trình duyệt chưa hỗ trợ xử lý ảnh này.');
    }

    return createImageBitmap(blob);
};

const resizeImageBlob = async (
    blob: Blob,
    maxDimension: number,
): Promise<Blob> => {
    const bitmap = await loadImageBitmap(blob);
    const longestSide = Math.max(bitmap.width, bitmap.height);

    if (longestSide <= maxDimension) {
        bitmap.close();
        return blob;
    }

    const scale = maxDimension / longestSide;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    try {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Không thể chuẩn hóa kích thước ảnh.');

        context.drawImage(bitmap, 0, 0, width, height);
        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (value) => {
                    if (value) resolve(value);
                    else reject(new Error('Không thể tối ưu ảnh đầu vào.'));
                },
                'image/webp',
                0.95,
            );
        });
    } finally {
        canvas.width = 0;
        canvas.height = 0;
        bitmap.close();
    }
};

const prepareBackgroundRemovalFile = async (file: File): Promise<File> => {
    const resizedBlob = await resizeImageBlob(
        file,
        MAX_PROCESSING_IMAGE_DIMENSION,
    );
    if (resizedBlob === file) return file;

    const baseName = file.name.replace(/\.[^.]+$/u, '') || 'product-image';
    const extension = resizedBlob.type === 'image/webp' ? 'webp' : 'png';
    const outputType = resizedBlob.type || 'image/png';

    return new File([resizedBlob], `${baseName}.${extension}`, {
        type: outputType,
        lastModified: file.lastModified,
    });
};

const loadPosterBackgroundBitmap = async (blob: Blob): Promise<ImageBitmap> => {
    const bitmap = await loadImageBitmap(blob);
    const longestSide = Math.max(bitmap.width, bitmap.height);

    if (longestSide <= MAX_PROCESSING_IMAGE_DIMENSION) return bitmap;

    const scale = MAX_PROCESSING_IMAGE_DIMENSION / longestSide;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    try {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Không thể chuẩn hóa ảnh nền poster.');

        context.drawImage(bitmap, 0, 0, width, height);
        return await createImageBitmap(canvas);
    } finally {
        canvas.width = 0;
        canvas.height = 0;
        bitmap.close();
    }
};

const findAlphaBounds = (bitmap: ImageBitmap): AlphaBounds => {
    const scale = Math.min(
        1,
        ALPHA_SCAN_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const scanWidth = Math.max(1, Math.round(bitmap.width * scale));
    const scanHeight = Math.max(1, Math.round(bitmap.height * scale));
    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = scanWidth;
    scanCanvas.height = scanHeight;

    try {
        const context = scanCanvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Không thể đọc dữ liệu ảnh đã tách nền.');

        context.drawImage(bitmap, 0, 0, scanWidth, scanHeight);
        const pixels = context.getImageData(0, 0, scanWidth, scanHeight).data;
        let minimumX = scanWidth;
        let minimumY = scanHeight;
        let maximumX = -1;
        let maximumY = -1;

        for (let y = 0; y < scanHeight; y += 1) {
            for (let x = 0; x < scanWidth; x += 1) {
                const alpha = pixels[(y * scanWidth + x) * 4 + 3] ?? 0;
                if (alpha <= 12) continue;
                minimumX = Math.min(minimumX, x);
                minimumY = Math.min(minimumY, y);
                maximumX = Math.max(maximumX, x);
                maximumY = Math.max(maximumY, y);
            }
        }

        if (maximumX < minimumX || maximumY < minimumY) {
            return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
        }

        const scaleX = bitmap.width / scanWidth;
        const scaleY = bitmap.height / scanHeight;
        const sourceMinimumX = Math.floor(minimumX * scaleX);
        const sourceMinimumY = Math.floor(minimumY * scaleY);
        const sourceMaximumX = Math.min(
            bitmap.width - 1,
            Math.ceil((maximumX + 1) * scaleX) - 1,
        );
        const sourceMaximumY = Math.min(
            bitmap.height - 1,
            Math.ceil((maximumY + 1) * scaleY) - 1,
        );
        const contentWidth = sourceMaximumX - sourceMinimumX + 1;
        const contentHeight = sourceMaximumY - sourceMinimumY + 1;
        const paddingX = Math.max(2, Math.round(contentWidth * 0.025));
        const paddingY = Math.max(2, Math.round(contentHeight * 0.025));
        const x = Math.max(0, sourceMinimumX - paddingX);
        const y = Math.max(0, sourceMinimumY - paddingY);
        const right = Math.min(bitmap.width, sourceMaximumX + paddingX + 1);
        const bottom = Math.min(bitmap.height, sourceMaximumY + paddingY + 1);

        return { x, y, width: right - x, height: bottom - y };
    } finally {
        scanCanvas.width = 0;
        scanCanvas.height = 0;
    }
};

const cropBlobToAlphaBounds = async (blob: Blob): Promise<Blob> => {
    const bitmap = await loadImageBitmap(blob);
    const canvas = document.createElement('canvas');

    try {
        const bounds = findAlphaBounds(bitmap);
        const outputScale = Math.min(
            1,
            MAX_PROCESSING_IMAGE_DIMENSION / Math.max(bounds.width, bounds.height),
        );
        const outputWidth = Math.max(1, Math.round(bounds.width * outputScale));
        const outputHeight = Math.max(1, Math.round(bounds.height * outputScale));
        canvas.width = outputWidth;
        canvas.height = outputHeight;

        const context = canvas.getContext('2d');
        if (!context) throw new Error('Không thể chuẩn hóa vùng ảnh sản phẩm.');

        context.drawImage(
            bitmap,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            0,
            0,
            outputWidth,
            outputHeight,
        );

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((value) => {
                if (value) resolve(value);
                else reject(new Error('Không thể tạo ảnh PNG đã căn vùng trong suốt.'));
            }, 'image/png');
        });
    } finally {
        canvas.width = 0;
        canvas.height = 0;
        bitmap.close();
    }
};

const splitLongWord = (
    context: CanvasRenderingContext2D,
    word: string,
    maximumWidth: number,
): string[] => {
    const chunks: string[] = [];
    let chunk = '';

    for (const character of Array.from(word)) {
        const candidate = `${chunk}${character}`;
        if (chunk && context.measureText(candidate).width > maximumWidth) {
            chunks.push(chunk);
            chunk = character;
        } else {
            chunk = candidate;
        }
    }

    if (chunk) chunks.push(chunk);
    return chunks.length > 0 ? chunks : [''];
};

const wrapText = (
    context: CanvasRenderingContext2D,
    value: string,
    maximumWidth: number,
): string[] => {
    const paragraphs = value.replace(/\r\n?/gu, '\n').split('\n');
    const lines: string[] = [];

    paragraphs.forEach((paragraph) => {
        const words = paragraph.trim().split(/\s+/u).filter(Boolean);
        if (words.length === 0) {
            lines.push('');
            return;
        }

        let line = '';
        words.forEach((word) => {
            if (context.measureText(word).width > maximumWidth) {
                if (line) {
                    lines.push(line);
                    line = '';
                }

                const chunks = splitLongWord(context, word, maximumWidth);
                lines.push(...chunks.slice(0, -1));
                line = chunks[chunks.length - 1] ?? '';
                return;
            }

            const candidate = line ? `${line} ${word}` : word;
            if (!line || context.measureText(candidate).width <= maximumWidth) {
                line = candidate;
                return;
            }

            lines.push(line);
            line = word;
        });

        lines.push(line);
    });

    return lines.length > 0 ? lines : [''];
};

const drawDefaultBackground = (context: CanvasRenderingContext2D): void => {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, POSTER_SIZE, POSTER_SIZE);

    const leftGlow = context.createRadialGradient(0, 900, 40, 0, 900, 760);
    leftGlow.addColorStop(0, 'rgba(68, 187, 255, 0.20)');
    leftGlow.addColorStop(0.55, 'rgba(105, 207, 255, 0.09)');
    leftGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = leftGlow;
    context.fillRect(0, 0, POSTER_SIZE, POSTER_SIZE);

    const rightGlow = context.createRadialGradient(
        POSTER_SIZE,
        900,
        40,
        POSTER_SIZE,
        900,
        760,
    );
    rightGlow.addColorStop(0, 'rgba(48, 165, 245, 0.18)');
    rightGlow.addColorStop(0.55, 'rgba(105, 207, 255, 0.08)');
    rightGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = rightGlow;
    context.fillRect(0, 0, POSTER_SIZE, POSTER_SIZE);

    const drawRibbon = (
        side: 'left' | 'right',
        offset: number,
        width: number,
        alpha: number,
    ): void => {
        context.save();
        context.globalAlpha = alpha;
        context.lineWidth = width;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        const gradient = context.createLinearGradient(0, 400, POSTER_SIZE, 1350);
        gradient.addColorStop(0, 'rgba(255,255,255,0.12)');
        gradient.addColorStop(0.42, '#86d9ff');
        gradient.addColorStop(0.74, '#159ce9');
        gradient.addColorStop(1, 'rgba(0,91,190,0.04)');
        context.strokeStyle = gradient;
        context.shadowColor = 'rgba(24, 151, 231, 0.28)';
        context.shadowBlur = 22;
        context.beginPath();

        if (side === 'left') {
            context.moveTo(-180, 430 + offset);
            context.bezierCurveTo(120, 650 + offset, 220, 950 + offset, 660, 1110 + offset);
            context.bezierCurveTo(360, 1300 + offset, 110, 1430 + offset, -160, 1580 + offset);
        } else {
            context.moveTo(POSTER_SIZE + 180, 430 + offset);
            context.bezierCurveTo(
                POSTER_SIZE - 120,
                650 + offset,
                POSTER_SIZE - 220,
                950 + offset,
                POSTER_SIZE - 660,
                1110 + offset,
            );
            context.bezierCurveTo(
                POSTER_SIZE - 360,
                1300 + offset,
                POSTER_SIZE - 110,
                1430 + offset,
                POSTER_SIZE + 160,
                1580 + offset,
            );
        }

        context.stroke();
        context.restore();
    };

    for (let index = 0; index < 5; index += 1) {
        const offset = index * 58;
        drawRibbon('left', offset, index === 0 ? 34 : 14, index === 0 ? 0.42 : 0.28);
        drawRibbon('right', offset, index === 0 ? 34 : 14, index === 0 ? 0.42 : 0.28);
    }
};

const drawImageCover = (
    context: CanvasRenderingContext2D,
    bitmap: ImageBitmap,
): void => {
    const scale = Math.max(POSTER_SIZE / bitmap.width, POSTER_SIZE / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    context.drawImage(
        bitmap,
        (POSTER_SIZE - width) / 2,
        (POSTER_SIZE - height) / 2,
        width,
        height,
    );
};

const getCanvasTextFont = (kind: 'title' | 'price', fontSize: number): string =>
    kind === 'price'
        ? `950 ${fontSize}px "Arial Black", Impact, Arial, sans-serif`
        : `900 ${fontSize}px Arial, Helvetica, sans-serif`;

const drawTextLayer = (
    context: CanvasRenderingContext2D,
    value: string,
    layer: PosterLayer,
    kind: 'title' | 'price',
    alignment: TextAlignment = 'center',
): void => {
    const x = (layer.x / 100) * POSTER_SIZE;
    const y = (layer.y / 100) * POSTER_SIZE;
    const width = (layer.width / 100) * POSTER_SIZE;
    const height = (layer.height / 100) * POSTER_SIZE;
    const fontSize = Math.max(12, layer.fontSize);
    const lineHeight = fontSize * 1.08;

    context.save();
    context.textAlign = alignment;
    context.textBaseline = 'middle';
    context.font = getCanvasTextFont(kind, fontSize);
    context.lineJoin = 'round';
    context.shadowColor = kind === 'title'
        ? 'rgba(0,0,0,0.12)'
        : 'rgba(205,0,0,0.14)';
    context.shadowBlur = kind === 'title' ? 4 : 7;
    context.shadowOffsetY = 3;

    const gradient = context.createLinearGradient(x, 0, x + width, 0);
    if (kind === 'title') {
        gradient.addColorStop(0, '#050505');
        gradient.addColorStop(0.58, '#030303');
        gradient.addColorStop(0.78, '#064fc0');
        gradient.addColorStop(1, '#0876e8');
    } else {
        gradient.addColorStop(0, '#ff1717');
        gradient.addColorStop(0.55, '#e90000');
        gradient.addColorStop(1, '#ff3030');
    }
    context.fillStyle = gradient;

    const lines = wrapText(context, value, Math.max(1, width * 0.96));
    const totalHeight = lines.length * lineHeight;
    const firstBaseline = y + height / 2 - totalHeight / 2 + lineHeight / 2;
    const textAnchorX = alignment === 'left'
        ? x + width * 0.02
        : alignment === 'right'
            ? x + width * 0.98
            : x + width / 2;

    lines.forEach((line, index) => {
        const baseline = firstBaseline + index * lineHeight;

        if (kind === 'price') {
            context.strokeStyle = '#dc0000';
            context.lineWidth = Math.max(2, fontSize * 0.022);
            context.strokeText(line, textAnchorX, baseline);
        }

        context.fillText(line, textAnchorX, baseline);
    });

    context.restore();
};

const createPosterBlob = async (
    name: string,
    price: string,
    cutout: Blob,
    background: Blob | null,
    layout: PosterLayout,
    titleAlignment: TextAlignment,
): Promise<Blob> => {
    const productBitmap = await loadImageBitmap(cutout);
    let backgroundBitmap: ImageBitmap | null = null;
    const canvas = document.createElement('canvas');

    try {
        if (background) backgroundBitmap = await loadPosterBackgroundBitmap(background);

        canvas.width = POSTER_SIZE;
        canvas.height = POSTER_SIZE;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Không thể khởi tạo Canvas tạo poster.');

        if (backgroundBitmap) {
            drawImageCover(context, backgroundBitmap);
        } else {
            drawDefaultBackground(context);
        }

        const productLayer = layout.product;
        const area = {
            x: (productLayer.x / 100) * POSTER_SIZE,
            y: (productLayer.y / 100) * POSTER_SIZE,
            width: (productLayer.width / 100) * POSTER_SIZE,
            height: (productLayer.height / 100) * POSTER_SIZE,
        };
        const scale = Math.min(
            area.width / productBitmap.width,
            area.height / productBitmap.height,
        );
        const drawWidth = productBitmap.width * scale;
        const drawHeight = productBitmap.height * scale;
        const drawX = area.x + (area.width - drawWidth) / 2;
        const drawY = area.y + (area.height - drawHeight) / 2;

        const shadowGradient = context.createRadialGradient(
            drawX + drawWidth / 2,
            Math.min(POSTER_SIZE - 24, drawY + drawHeight * 0.98),
            10,
            drawX + drawWidth / 2,
            Math.min(POSTER_SIZE - 24, drawY + drawHeight * 0.98),
            Math.max(120, drawWidth * 0.48),
        );
        shadowGradient.addColorStop(0, 'rgba(20, 35, 50, 0.18)');
        shadowGradient.addColorStop(0.45, 'rgba(20, 35, 50, 0.07)');
        shadowGradient.addColorStop(1, 'rgba(20, 35, 50, 0)');
        context.fillStyle = shadowGradient;
        context.beginPath();
        context.ellipse(
            drawX + drawWidth / 2,
            Math.min(POSTER_SIZE - 24, drawY + drawHeight * 0.98),
            Math.max(100, drawWidth * 0.48),
            Math.max(18, drawHeight * 0.035),
            0,
            0,
            Math.PI * 2,
        );
        context.fill();

        context.drawImage(productBitmap, drawX, drawY, drawWidth, drawHeight);
        drawTextLayer(context, name, layout.title, 'title', titleAlignment);
        drawTextLayer(context, price.trim(), layout.price, 'price');

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Không thể xuất poster PNG.'));
            }, 'image/png');
        });
    } finally {
        canvas.width = 0;
        canvas.height = 0;
        productBitmap.close();
        backgroundBitmap?.close();
    }
};

const createSafeFilename = (value: string): string => {
    const normalized = value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/gu, '')
        .replace(/đ/giu, 'd')
        .replace(/[^a-zA-Z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '')
        .toLowerCase();

    return `${normalized || 'product-poster'}.png`;
};

const createClipboardImageFile = (
    clipboardData: DataTransfer,
): File | null => {
    // Match the Local product form: read File objects from clipboardData.files
    // first, then fall back to DataTransfer.items for browser-specific clipboard
    // implementations. Do not rebuild the File unless it is actually a Blob.
    const directFiles = Array.from(clipboardData.files ?? []);
    const itemFiles = Array.from(clipboardData.items ?? [])
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

    return [...directFiles, ...itemFiles].find((file) =>
        SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase()),
    ) ?? null;
};

export default function ProductPosterGenerator({
    onClose,
    initialProductName,
    initialPrice,
    initialImageUrl,
    initialImageName,
    onSavePoster,
}: ProductPosterGeneratorProps) {
    const productInputRef = useRef<HTMLInputElement | null>(null);
    const backgroundInputRef = useRef<HTMLInputElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const sourcePreviewUrlRef = useRef<string>('');
    const cutoutPreviewUrlRef = useRef<string>('');
    const backgroundPreviewUrlRef = useRef<string>('');
    const posterPreviewUrlRef = useRef<string>('');
    const posterBlobRef = useRef<Blob | null>(null);
    const pointerActionRef = useRef<PosterPointerAction | null>(null);
    const pendingPointerPositionRef = useRef<{
        pointerId: number;
        clientX: number;
        clientY: number;
    } | null>(null);
    const pointerFrameRef = useRef<number | null>(null);
    const previewTextMeasureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const posterRevisionRef = useRef<number>(0);
    const isGeneratingPosterRef = useRef<boolean>(false);
    const isMountedRef = useRef<boolean>(true);
    const stageRef = useRef<HTMLDivElement | null>(null);

    const [productName, setProductName] = useState<string>(initialProductName ?? '');
    const [titleAlignment, setTitleAlignment] = useState<TextAlignment>('center');
    const [price, setPrice] = useState<string>(initialPrice ?? '');
    const [isSavingPoster, setIsSavingPoster] = useState<boolean>(false);
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string>('');
    const [cutoutBlob, setCutoutBlob] = useState<Blob | null>(null);
    const [cutoutPreviewUrl, setCutoutPreviewUrl] = useState<string>('');
    const [backgroundBlob, setBackgroundBlob] = useState<File | null>(null);
    const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string>('');
    const [useUploadedBackground, setUseUploadedBackground] = useState<boolean>(false);
    const [layout, setLayout] = useState<PosterLayout>(INITIAL_LAYOUT);
    const [selectedLayer, setSelectedLayer] = useState<PosterLayerId>('product');
    const [posterPreviewUrl, setPosterPreviewUrl] = useState<string>('');
    const [isRemovingBackground, setIsRemovingBackground] = useState<boolean>(false);
    const [isGeneratingPoster, setIsGeneratingPoster] = useState<boolean>(false);
    const [progress, setProgress] = useState<RemovalProgress>({ label: '', percent: 0 });
    const [errorMessage, setErrorMessage] = useState<string>('');

    const revokeUrl = useCallback((url: string): void => {
        if (url) URL.revokeObjectURL(url);
    }, []);

    const invalidateExport = useCallback((): void => {
        posterRevisionRef.current += 1;
        posterBlobRef.current = null;
        const currentUrl = posterPreviewUrlRef.current;
        if (!currentUrl) return;

        revokeUrl(currentUrl);
        posterPreviewUrlRef.current = '';
        setPosterPreviewUrl('');
    }, [revokeUrl]);

    const processBackground = useCallback(async (file: File): Promise<void> => {
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsRemovingBackground(true);
        setProgress({ label: 'Đang khởi tạo AI...', percent: 0 });
        setErrorMessage('');
        setCutoutBlob(null);
        revokeUrl(cutoutPreviewUrlRef.current);
        cutoutPreviewUrlRef.current = '';
        setCutoutPreviewUrl('');
        invalidateExport();

        try {
            const { removeBackground } = await import('@bg0/browser');
            if (controller.signal.aborted || !isMountedRef.current) return;

            setProgress({ label: 'Đang chuẩn hóa kích thước ảnh...', percent: 2 });
            const processingFile = await prepareBackgroundRemovalFile(file);
            if (controller.signal.aborted || !isMountedRef.current) return;

            const result = await removeBackground(processingFile, {
                model: 'lite',
                quality: 'quality',
                signal: controller.signal,
                onProgress: ({ stage, progress: currentProgress }) => {
                    if (controller.signal.aborted || !isMountedRef.current) return;
                    const normalizedProgress = currentProgress <= 1
                        ? currentProgress * 100
                        : currentProgress;
                    setProgress({
                        label: getProgressLabel(stage),
                        percent: clamp(Math.round(normalizedProgress), 0, 100),
                    });
                },
            });

            if (controller.signal.aborted || !isMountedRef.current) return;
            setProgress({ label: 'Đang căn vùng sản phẩm...', percent: 96 });
            const normalizedCutout = await cropBlobToAlphaBounds(result.blob);
            if (controller.signal.aborted || !isMountedRef.current) return;

            const nextUrl = URL.createObjectURL(normalizedCutout);
            revokeUrl(cutoutPreviewUrlRef.current);
            cutoutPreviewUrlRef.current = nextUrl;
            setCutoutBlob(normalizedCutout);
            setCutoutPreviewUrl(nextUrl);
            setProgress({ label: 'Đã tách nền và căn vùng sản phẩm', percent: 100 });
        } catch (error) {
            if (controller.signal.aborted) return;
            setErrorMessage(
                error instanceof Error ? error.message : 'Không thể tách nền ảnh. Vui lòng thử lại.',
            );
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
                if (!controller.signal.aborted && isMountedRef.current) {
                    setIsRemovingBackground(false);
                }
            }
        }
    }, [invalidateExport, revokeUrl]);

    const applyProductFile = useCallback((file: File | null): void => {
        if (!file) return;

        if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
            setErrorMessage('Chỉ hỗ trợ ảnh PNG, JPG hoặc WEBP.');
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            setErrorMessage('Ảnh sản phẩm vượt quá giới hạn bốn mươi MB.');
            return;
        }

        revokeUrl(sourcePreviewUrlRef.current);
        const nextSourceUrl = URL.createObjectURL(file);
        sourcePreviewUrlRef.current = nextSourceUrl;
        setSourcePreviewUrl(nextSourceUrl);
        setSourceFile(file);
        setErrorMessage('');
        void processBackground(file);
    }, [processBackground, revokeUrl]);

    useEffect(() => {
        if (!initialImageUrl) return;

        let isActive = true;

        const loadInitialImage = async (): Promise<void> => {
            try {
                const response = await fetch(initialImageUrl, { cache: 'force-cache' });
                if (!response.ok) throw new Error('Không thể tải ảnh sản phẩm.');

                const blob = await response.blob();
                const extension = initialImageName?.split('.').pop()?.toLowerCase();
                const detectedType = blob.type.toLowerCase();
                const imageType = SUPPORTED_IMAGE_TYPES.has(detectedType)
                    ? detectedType
                    : extension === 'png'
                        ? 'image/png'
                        : extension === 'webp'
                            ? 'image/webp'
                            : 'image/jpeg';
                const file = new File(
                    [blob],
                    initialImageName || 'product-image.jpg',
                    { type: imageType },
                );

                if (isActive) applyProductFile(file);
            } catch {
                if (isActive) {
                    setErrorMessage('Không tự tải được ảnh từ máy chủ. Hãy chọn ảnh sản phẩm thủ công.');
                }
            }
        };

        void loadInitialImage();
        return () => {
            isActive = false;
        };
    }, [applyProductFile, initialImageName, initialImageUrl]);

    const handleProductFileChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files?.[0] ?? null;
        event.target.value = '';
        applyProductFile(file);
    }, [applyProductFile]);

    const handleProductPaste = useCallback((event: ReactClipboardEvent<HTMLDivElement>): void => {
        const pastedFile = createClipboardImageFile(event.clipboardData);
        if (!pastedFile) return;

        event.preventDefault();
        event.stopPropagation();
        applyProductFile(pastedFile);
    }, [applyProductFile]);

    const applyBackgroundFile = useCallback((file: File | null): void => {
        if (!file) return;

        if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
            setErrorMessage('Ảnh nền chỉ hỗ trợ PNG, JPG hoặc WEBP.');
            return;
        }
        if (file.size > MAX_BACKGROUND_BYTES) {
            setErrorMessage('Ảnh nền vượt quá giới hạn hai mươi bốn MB.');
            return;
        }

        revokeUrl(backgroundPreviewUrlRef.current);
        const nextUrl = URL.createObjectURL(file);
        backgroundPreviewUrlRef.current = nextUrl;
        setBackgroundPreviewUrl(nextUrl);
        setBackgroundBlob(file);
        setUseUploadedBackground(true);
        invalidateExport();
        setErrorMessage('');
    }, [invalidateExport, revokeUrl]);

    const handleBackgroundFileChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files?.[0] ?? null;
        event.target.value = '';
        applyBackgroundFile(file);
    }, [applyBackgroundFile]);

    const handleBackgroundPaste = useCallback((event: ReactClipboardEvent<HTMLDivElement>): void => {
        const pastedFile = createClipboardImageFile(event.clipboardData);
        if (!pastedFile) return;

        event.preventDefault();
        event.stopPropagation();
        applyBackgroundFile(pastedFile);
    }, [applyBackgroundFile]);

    const handlePosterPaste = useCallback((event: ReactClipboardEvent<HTMLDivElement>): void => {
        const pastedFile = createClipboardImageFile(event.clipboardData);
        if (!pastedFile) return;

        event.preventDefault();
        event.stopPropagation();

        const target = event.target;
        const pasteTarget = target instanceof Element
            ? target.closest<HTMLElement>('[data-poster-paste-target]')?.dataset.posterPasteTarget
            : undefined;

        if (pasteTarget === 'background') {
            applyBackgroundFile(pastedFile);
            return;
        }

        // Pasting anywhere else in the poster dialog uses the product image slot,
        // including when focus is in the name or price input.
        applyProductFile(pastedFile);
    }, [applyBackgroundFile, applyProductFile]);

    const handleLayerPointerDown = useCallback((
        event: ReactPointerEvent<HTMLElement>,
        layerId: PosterLayerId,
        mode: PointerMode,
    ): void => {
        if (event.button !== 0 && event.pointerType === 'mouse') return;
        const stage = stageRef.current;
        if (!stage) return;

        const rect = stage.getBoundingClientRect();
        const initial = layout[layerId];
        event.preventDefault();
        event.stopPropagation();
        setSelectedLayer(layerId);
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerActionRef.current = {
            pointerId: event.pointerId,
            layerId,
            mode,
            startClientX: event.clientX,
            startClientY: event.clientY,
            stageWidth: rect.width,
            stageHeight: rect.height,
            initial: { ...initial },
        };
    }, [layout]);

    const applyStagePointerPosition = useCallback((
        pointerId: number,
        clientX: number,
        clientY: number,
    ): void => {
        const action = pointerActionRef.current;
        if (!action || action.pointerId !== pointerId) return;

        const deltaX = ((clientX - action.startClientX) / action.stageWidth) * 100;
        const deltaY = ((clientY - action.startClientY) / action.stageHeight) * 100;

        setLayout((current) => {
            const initial = action.initial;
            const nextLayer = { ...initial };

            if (action.mode === 'move') {
                if (action.layerId === 'product') {
                    nextLayer.x = clamp(
                        initial.x + deltaX,
                        PRODUCT_LAYER_MIN_VISIBLE_PERCENT - initial.width,
                        100 - PRODUCT_LAYER_MIN_VISIBLE_PERCENT,
                    );
                    nextLayer.y = clamp(
                        initial.y + deltaY,
                        PRODUCT_LAYER_MIN_VISIBLE_PERCENT - initial.height,
                        100 - PRODUCT_LAYER_MIN_VISIBLE_PERCENT,
                    );
                } else {
                    nextLayer.x = clamp(initial.x + deltaX, 0, 100 - initial.width);
                    nextLayer.y = clamp(initial.y + deltaY, 0, 100 - initial.height);
                }
            } else if (action.layerId === 'product') {
                const widthDeltaRatio = deltaX / Math.max(initial.width, 1);
                const heightDeltaRatio = deltaY / Math.max(initial.height, 1);
                const dominantDeltaRatio = Math.abs(widthDeltaRatio) >= Math.abs(heightDeltaRatio)
                    ? widthDeltaRatio
                    : heightDeltaRatio;
                const minimumWidth = INITIAL_LAYOUT.product.width * PRODUCT_LAYER_MIN_SCALE;
                const maximumWidth = INITIAL_LAYOUT.product.width * PRODUCT_LAYER_MAX_SCALE;
                const nextWidth = clamp(
                    initial.width * (1 + dominantDeltaRatio),
                    minimumWidth,
                    maximumWidth,
                );
                const scale = nextWidth / Math.max(initial.width, 1);
                nextLayer.width = nextWidth;
                nextLayer.height = initial.height * scale;
                nextLayer.x = clamp(
                    initial.x,
                    PRODUCT_LAYER_MIN_VISIBLE_PERCENT - nextLayer.width,
                    100 - PRODUCT_LAYER_MIN_VISIBLE_PERCENT,
                );
                nextLayer.y = clamp(
                    initial.y,
                    PRODUCT_LAYER_MIN_VISIBLE_PERCENT - nextLayer.height,
                    100 - PRODUCT_LAYER_MIN_VISIBLE_PERCENT,
                );
            } else {
                const nextWidth = clamp(initial.width + deltaX, 8, 100 - initial.x);
                const nextHeight = clamp(initial.height + deltaY, 6, 100 - initial.y);
                nextLayer.width = nextWidth;
                nextLayer.height = nextHeight;
                const widthScale = nextWidth / Math.max(initial.width, 1);
                const heightScale = nextHeight / Math.max(initial.height, 1);
                nextLayer.fontSize = clamp(
                    initial.fontSize * Math.min(widthScale, heightScale),
                    12,
                    1200,
                );
            }

            return { ...current, [action.layerId]: nextLayer };
        });
        invalidateExport();
    }, [invalidateExport]);

    const handleStagePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
        const action = pointerActionRef.current;
        if (!action || action.pointerId !== event.pointerId) return;

        pendingPointerPositionRef.current = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
        };

        if (pointerFrameRef.current !== null) return;
        pointerFrameRef.current = window.requestAnimationFrame(() => {
            pointerFrameRef.current = null;
            const pending = pendingPointerPositionRef.current;
            pendingPointerPositionRef.current = null;
            if (pending) {
                applyStagePointerPosition(
                    pending.pointerId,
                    pending.clientX,
                    pending.clientY,
                );
            }
        });
    }, [applyStagePointerPosition]);

    const handleStagePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
        if (pointerActionRef.current?.pointerId !== event.pointerId) return;

        if (pointerFrameRef.current !== null) {
            window.cancelAnimationFrame(pointerFrameRef.current);
            pointerFrameRef.current = null;
        }
        pendingPointerPositionRef.current = null;
        applyStagePointerPosition(event.pointerId, event.clientX, event.clientY);
        pointerActionRef.current = null;
    }, [applyStagePointerPosition]);

    const handleGeneratePoster = useCallback(async (): Promise<void> => {
        if (
            !cutoutBlob ||
            !productName.trim() ||
            !price.trim() ||
            isGeneratingPosterRef.current ||
            isRemovingBackground
        ) return;

        isGeneratingPosterRef.current = true;
        const generationRevision = posterRevisionRef.current;
        setIsGeneratingPoster(true);
        setErrorMessage('');

        try {
            const posterBlob = await createPosterBlob(
                productName.replace(/\r\n?/gu, '\n'),
                price.trim(),
                cutoutBlob,
                useUploadedBackground ? backgroundBlob : null,
                layout,
                titleAlignment,
            );
            if (
                !isMountedRef.current ||
                generationRevision !== posterRevisionRef.current
            ) return;

            posterBlobRef.current = posterBlob;
            const nextUrl = URL.createObjectURL(posterBlob);
            revokeUrl(posterPreviewUrlRef.current);
            posterPreviewUrlRef.current = nextUrl;
            setPosterPreviewUrl(nextUrl);
        } catch (error) {
            if (
                isMountedRef.current &&
                generationRevision === posterRevisionRef.current
            ) {
                setErrorMessage(
                    error instanceof Error ? error.message : 'Không thể tạo poster.',
                );
            }
        } finally {
            isGeneratingPosterRef.current = false;
            if (isMountedRef.current) setIsGeneratingPoster(false);
        }
    }, [
        backgroundBlob,
        cutoutBlob,
        isRemovingBackground,
        layout,
        price,
        productName,
        revokeUrl,
        titleAlignment,
        useUploadedBackground,
    ]);

    const handleDownloadPoster = useCallback((): void => {
        if (!posterPreviewUrl) return;
        const anchor = document.createElement('a');
        anchor.href = posterPreviewUrl;
        anchor.download = createSafeFilename(productName);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }, [posterPreviewUrl, productName]);

    const handleSavePoster = useCallback(async (): Promise<void> => {
        const posterBlob = posterBlobRef.current;
        if (!posterBlob || !onSavePoster || !productName.trim() || isSavingPoster) return;

        setIsSavingPoster(true);
        setErrorMessage('');

        try {
            await onSavePoster(
                posterBlob,
                createSafeFilename(productName),
                productName.trim(),
            );
            onClose();
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : 'Không thể lưu poster vào sản phẩm.',
            );
        } finally {
            if (isMountedRef.current) setIsSavingPoster(false);
        }
    }, [isSavingPoster, onClose, onSavePoster, productName]);

    const updateProductName = (value: string): void => {
        setProductName(value);
        invalidateExport();
    };

    const updatePrice = (value: string): void => {
        setPrice(value);
        invalidateExport();
    };

    const updateTitleAlignment = (value: TextAlignment): void => {
        setTitleAlignment(value);
        invalidateExport();
    };

    const updateTextFontSize = (layerId: 'title' | 'price', fontSize: number): void => {
        const nextFontSize = clamp(Math.round(fontSize), 12, 1200);
        setLayout((current) => ({
            ...current,
            [layerId]: { ...current[layerId], fontSize: nextFontSize },
        }));
        invalidateExport();
    };

    const updateProductScale = (scalePercent: number): void => {
        const scale = clamp(
            scalePercent / 100,
            PRODUCT_LAYER_MIN_SCALE,
            PRODUCT_LAYER_MAX_SCALE,
        );

        setLayout((current) => {
            const product = current.product;
            const nextWidth = INITIAL_LAYOUT.product.width * scale;
            const nextHeight = INITIAL_LAYOUT.product.height * scale;
            const centerX = product.x + product.width / 2;
            const centerY = product.y + product.height / 2;

            return {
                ...current,
                product: {
                    ...product,
                    width: nextWidth,
                    height: nextHeight,
                    x: clamp(
                        centerX - nextWidth / 2,
                        PRODUCT_LAYER_MIN_VISIBLE_PERCENT - nextWidth,
                        100 - PRODUCT_LAYER_MIN_VISIBLE_PERCENT,
                    ),
                    y: clamp(
                        centerY - nextHeight / 2,
                        PRODUCT_LAYER_MIN_VISIBLE_PERCENT - nextHeight,
                        100 - PRODUCT_LAYER_MIN_VISIBLE_PERCENT,
                    ),
                },
            };
        });
        invalidateExport();
    };

    const resetLayout = (): void => {
        setLayout(INITIAL_LAYOUT);
        setTitleAlignment('center');
        setSelectedLayer('product');
        invalidateExport();
    };

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent): void => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            posterRevisionRef.current += 1;
            abortControllerRef.current?.abort();
            abortControllerRef.current = null;

            if (pointerFrameRef.current !== null) {
                window.cancelAnimationFrame(pointerFrameRef.current);
                pointerFrameRef.current = null;
            }
            pendingPointerPositionRef.current = null;
            pointerActionRef.current = null;

            revokeUrl(sourcePreviewUrlRef.current);
            revokeUrl(cutoutPreviewUrlRef.current);
            revokeUrl(backgroundPreviewUrlRef.current);
            revokeUrl(posterPreviewUrlRef.current);
            sourcePreviewUrlRef.current = '';
            cutoutPreviewUrlRef.current = '';
            backgroundPreviewUrlRef.current = '';
            posterPreviewUrlRef.current = '';
            posterBlobRef.current = null;

            if (previewTextMeasureCanvasRef.current) {
                previewTextMeasureCanvasRef.current.width = 0;
                previewTextMeasureCanvasRef.current.height = 0;
                previewTextMeasureCanvasRef.current = null;
            }
        };
    }, [revokeUrl]);

    const canGenerate = Boolean(
        sourceFile &&
        cutoutBlob &&
        productName.trim() &&
        price.trim() &&
        !isRemovingBackground &&
        !isGeneratingPoster,
    );

    const layerStyle = (layer: PosterLayer): CSSProperties => ({
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        width: `${layer.width}%`,
        height: `${layer.height}%`,
    });

    const getPreviewTextLines = (
        value: string,
        layer: PosterLayer,
        kind: 'title' | 'price',
    ): string[] => {
        if (typeof document === 'undefined') return [value];
        let measureCanvas = previewTextMeasureCanvasRef.current;
        if (!measureCanvas) {
            measureCanvas = document.createElement('canvas');
            previewTextMeasureCanvasRef.current = measureCanvas;
        }
        const context = measureCanvas.getContext('2d');
        if (!context) return [value];

        context.font = getCanvasTextFont(kind, Math.max(12, layer.fontSize));
        return wrapText(
            context,
            value,
            Math.max(1, ((layer.width / 100) * POSTER_SIZE) * 0.96),
        );
    };

    const textLayerStyle = (
        layer: PosterLayer,
        kind: 'title' | 'price',
        alignment: TextAlignment = 'center',
    ): CSSProperties => ({
        fontSize: `${(Math.max(12, layer.fontSize) / POSTER_SIZE) * 100}cqw`,
        lineHeight: 1.08,
        fontFamily: kind === 'price' ? '"Arial Black", Impact, Arial, sans-serif' : 'Arial, Helvetica, sans-serif',
        fontWeight: kind === 'price' ? 950 : 900,
        WebkitTextStroke: kind === 'price' ? '1.1px #e00000' : undefined,
        textAlign: alignment,
        backgroundImage: kind === 'title'
            ? 'linear-gradient(90deg,#050505 0%,#030303 58%,#064fc0 78%,#0876e8 100%)'
            : 'linear-gradient(90deg,#ff1717 0%,#e90000 55%,#ff3030 100%)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        textShadow: kind === 'title'
            ? '0 2px 3px rgba(0,0,0,0.10)'
            : '0 3px 6px rgba(205,0,0,0.12)',
    });

    const renderLayerControls = (
        id: PosterLayerId,
        content: ReactNode,
        style: CSSProperties,
    ) => {
        const isSelected = selectedLayer === id;
        return (
            <div
                key={id}
                role="group"
                aria-label={`Chọn và kéo ${LAYER_LABELS[id]}`}
                onClick={(event) => {
                    event.stopPropagation();
                    setSelectedLayer(id);
                }}
                onPointerDown={(event) => handleLayerPointerDown(event, id, 'move')}
                className={`absolute z-10 flex cursor-grab select-none items-center justify-center touch-none active:cursor-grabbing ${isSelected ? 'outline outline-2 outline-dashed outline-cyan-400/90 outline-offset-2' : 'hover:outline hover:outline-1 hover:outline-dashed hover:outline-cyan-300/60'}`}
                style={style}
            >
                {content}
                {isSelected ? (
                    <button
                        type="button"
                        aria-label={`Thay đổi kích thước ${LAYER_LABELS[id]}`}
                        onPointerDown={(event) => handleLayerPointerDown(event, id, 'resize')}
                        onClick={(event) => event.stopPropagation()}
                        className={`absolute z-30 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-full border-2 border-white bg-cyan-400 text-slate-950 shadow-lg touch-none ${id === 'product' ? 'bottom-1 right-1' : '-bottom-2 -right-2'}`}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
                    </button>
                ) : null}
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 z-[2147483010] flex h-dvh w-full items-center justify-center overflow-hidden overscroll-none bg-black/80 p-2 backdrop-blur-md xl:p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Tạo poster sản phẩm"
            onPaste={handlePosterPaste}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section className="relative flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] min-h-0 w-full max-w-7xl flex-col overflow-hidden rounded-2xl xl:h-[calc(100dvh-2.5rem)] xl:max-h-[calc(100dvh-2.5rem)] border border-[#d8c99f]/25 bg-[linear-gradient(145deg,#0b1722,#050a11)] shadow-[0_28px_100px_rgba(0,0,0,0.75)]">
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 xl:px-5">
                    <div className="min-w-0">
                        <h2 className="text-sm font-black text-white xl:text-base">Tạo Poster</h2>
                        <p className="mt-0.5 text-[9px] text-slate-400">Paste ảnh · Kéo layer · Poster 1:1</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white"
                        aria-label="Đóng tạo poster"
                    >
                        <FiX className="h-4 w-4" aria-hidden="true" />
                    </button>
                </header>

                <div className="min-h-0 flex-1 overflow-hidden p-2 xl:p-3">
                    <div className="grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-2 xl:grid-cols-[300px_minmax(0,1fr)] xl:grid-rows-1 xl:gap-4">
                        <div className="grid min-h-0 min-w-0 grid-cols-2 content-start gap-2 overflow-hidden xl:flex xl:flex-col xl:gap-2.5">
                            <div className="flex min-w-0 flex-col gap-1">
                                <label htmlFor="poster-product-name" className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tên sản phẩm</label>
                                <textarea
                                    id="poster-product-name"
                                    value={productName}
                                    onChange={(event) => updateProductName(event.target.value)}
                                    placeholder="Nhập tên sản phẩm. Enter để xuống dòng..."
                                    rows={3}
                                    spellCheck={false}
                                    className="min-h-[76px] w-full min-w-0 resize-y rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm leading-5 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60"
                                />
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[8px] text-slate-500">Không giới hạn ký tự · Enter để xuống dòng</span>
                                    <span className="text-[8px] tabular-nums text-slate-500">{productName.length.toLocaleString('vi-VN')} ký tự</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1" aria-label="Căn chỉnh tên sản phẩm trên poster">
                                    {([
                                        { value: 'left', label: 'Trái', Icon: FiAlignLeft },
                                        { value: 'center', label: 'Giữa', Icon: FiAlignCenter },
                                        { value: 'right', label: 'Phải', Icon: FiAlignRight },
                                    ] as const).map(({ value, label, Icon }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => updateTitleAlignment(value)}
                                            aria-pressed={titleAlignment === value}
                                            className={`flex min-h-7 items-center justify-center gap-1 rounded-md border px-1.5 text-[9px] font-bold transition ${titleAlignment === value ? 'border-cyan-300/45 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.06]'}`}
                                        >
                                            <Icon className="h-3 w-3" aria-hidden="true" />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="flex min-w-0 flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Giá</span>
                                <input
                                    value={price}
                                    onChange={(event) => updatePrice(event.target.value)}
                                    placeholder="Ví dụ: 12.5tr"
                                    maxLength={24}
                                    className="h-9 w-full min-w-0 rounded-lg border border-white/10 bg-slate-950/80 px-3 text-sm font-black text-rose-400 outline-none transition placeholder:font-normal placeholder:text-slate-600 focus:border-cyan-300/60"
                                />
                            </label>

                            <div
                                data-poster-paste-target="product"
                                className="col-span-2 flex min-w-0 flex-col gap-1 xl:col-span-1"
                                onPaste={handleProductPaste}
                                tabIndex={0}
                                aria-label="Dán ảnh sản phẩm từ clipboard"
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Ảnh sản phẩm</span>
                                <input
                                    ref={productInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="sr-only"
                                    onChange={handleProductFileChange}
                                />
                                <button
                                    type="button"
                                    disabled={isRemovingBackground || isGeneratingPoster}
                                    onClick={() => productInputRef.current?.click()}
                                    className="flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/[0.025] px-2 py-1.5 text-[10px] font-bold text-slate-200 transition hover:border-cyan-300/50 hover:bg-cyan-300/[0.06] disabled:opacity-40"
                                >
                                    <FiUploadCloud className="h-4 w-4" aria-hidden="true" />
                                    {sourceFile ? 'Chọn ảnh khác' : 'Tải / Paste ảnh'}
                                </button>
                                <span className="text-[8px] text-slate-600">Focus khu vực này rồi nhấn Ctrl + V</span>
                            </div>

                            <div
                                data-poster-paste-target="background"
                                className="col-span-2 flex min-w-0 flex-col gap-1.5 rounded-xl border border-white/10 bg-black/15 p-2 xl:col-span-1"
                                onPaste={handleBackgroundPaste}
                                tabIndex={0}
                                aria-label="Dán ảnh nền poster từ clipboard"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-300">Nền poster</span>
                                    {backgroundBlob ? (
                                        <span className="text-[9px] text-emerald-300">Đã tải ảnh nền</span>
                                    ) : null}
                                </div>
                                <input
                                    ref={backgroundInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="sr-only"
                                    onChange={handleBackgroundFileChange}
                                />
                                <button
                                    type="button"
                                    onClick={() => backgroundInputRef.current?.click()}
                                    className="flex min-h-8 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/[0.025] px-2 py-1.5 text-[10px] font-bold text-slate-200 transition hover:border-cyan-300/50 hover:bg-cyan-300/[0.06]"
                                >
                                    <FiUploadCloud className="h-4 w-4" aria-hidden="true" />
                                    {backgroundBlob ? 'Thay ảnh nền' : 'Tải ảnh nền'}
                                </button>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUseUploadedBackground(false);
                                            invalidateExport();
                                        }}
                                        aria-pressed={!useUploadedBackground}
                                        className={`min-h-7 rounded-lg border px-1.5 text-[9px] font-bold transition ${!useUploadedBackground ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.06]'}`}
                                    >
                                        Nền mặc định
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!backgroundBlob}
                                        onClick={() => {
                                            setUseUploadedBackground(true);
                                            invalidateExport();
                                        }}
                                        aria-pressed={useUploadedBackground}
                                        className={`min-h-7 rounded-lg border px-1.5 text-[9px] font-bold transition disabled:cursor-not-allowed disabled:opacity-30 ${useUploadedBackground ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.06]'}`}
                                    >
                                        Ảnh nền đã tải
                                    </button>
                                </div>
                                {backgroundPreviewUrl ? (
                                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-1.5">
                                        <img src={backgroundPreviewUrl} alt="Ảnh nền đã tải" decoding="async" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                                        <span className="min-w-0 flex-1 truncate text-[10px] text-slate-400">{backgroundBlob?.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                revokeUrl(backgroundPreviewUrlRef.current);
                                                backgroundPreviewUrlRef.current = '';
                                                setBackgroundPreviewUrl('');
                                                setBackgroundBlob(null);
                                                setUseUploadedBackground(false);
                                                invalidateExport();
                                            }}
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-white"
                                            aria-label="Xóa ảnh nền đã tải"
                                        >
                                            <FiX className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    </div>
                                ) : null}
                            </div>

                            {sourcePreviewUrl ? (
                                <div className="col-span-2 grid min-w-0 grid-cols-2 gap-1.5 xl:col-span-1">
                                    <div className="min-w-0 rounded-lg border border-white/10 bg-black/20 p-1.5">
                                        <p className="mb-1 text-[8px] font-bold text-slate-500">ẢNH GỐC</p>
                                        <div className="flex h-12 items-center justify-center overflow-hidden rounded-md bg-white/[0.04]">
                                            <img src={sourcePreviewUrl} alt="Ảnh gốc sản phẩm" decoding="async" className="h-full w-full object-contain" />
                                        </div>
                                    </div>
                                    <div className="min-w-0 rounded-lg border border-white/10 bg-black/20 p-1.5">
                                        <p className="mb-1 text-[8px] font-bold text-slate-500">ĐÃ TÁCH NỀN</p>
                                        <div className="flex h-12 items-center justify-center overflow-hidden rounded-md bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%),linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%)] bg-[position:0_0,8px_8px] bg-[size:16px_16px]">
                                            {cutoutPreviewUrl ? (
                                                <img src={cutoutPreviewUrl} alt="Ảnh sản phẩm đã tách nền" decoding="async" className="h-full w-full object-contain" />
                                            ) : isRemovingBackground ? (
                                                <FiLoader className="h-5 w-5 animate-spin text-cyan-200" aria-hidden="true" />
                                            ) : (
                                                <FiImage className="h-5 w-5 text-slate-600" aria-hidden="true" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {isRemovingBackground ? (
                                <div className="col-span-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.05] p-2 xl:col-span-1">
                                    <div className="flex items-center justify-between gap-3 text-[10px] font-semibold text-cyan-100">
                                        <span>{progress.label}</span>
                                        <span>{progress.percent}%</span>
                                    </div>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                                        <div className="h-full rounded-full bg-cyan-300 transition-[width] duration-300" style={{ width: `${progress.percent}%` }} />
                                    </div>
                                    <p className="mt-1 text-[8px] leading-3 text-slate-500">Xử lý trực tiếp trên thiết bị.</p>
                                </div>
                            ) : cutoutBlob ? (
                                <p className="col-span-2 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] px-2 py-1.5 text-[9px] font-semibold text-emerald-200 xl:col-span-1">Đã tách nền.</p>
                            ) : null}

                            {errorMessage ? (
                                <div className="col-span-2 rounded-lg border border-rose-300/20 bg-rose-300/[0.06] p-2 text-[9px] leading-4 text-rose-100 xl:col-span-1">
                                    <p>{errorMessage}</p>
                                    {sourceFile ? (
                                        <button
                                            type="button"
                                            disabled={isRemovingBackground}
                                            onClick={() => void processBackground(sourceFile)}
                                            className="mt-2 inline-flex items-center gap-1.5 font-black text-rose-200 underline underline-offset-2 disabled:opacity-50"
                                        >
                                            <FiRefreshCw className="h-3 w-3" aria-hidden="true" />
                                            Thử tách nền lại
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}

                            <button
                                type="button"
                                onClick={resetLayout}
                                className="col-span-2 flex min-h-8 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-2 py-1.5 text-[9px] font-bold text-slate-300 transition hover:bg-white/[0.08] xl:col-span-1"
                            >
                                <FiRefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                                Đặt lại bố cục
                            </button>
                        </div>

                        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
                            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="text-[11px] font-black text-white">Bản xem trước</h3>
                                    <p className="mt-0.5 text-[8px] text-slate-500">Kéo để di chuyển · Nắm góc để đổi kích thước.</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold text-slate-400">1600 × 1600</span>
                                    <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] px-2 py-1 text-[9px] font-bold text-cyan-200">1:1</span>
                                </div>
                            </div>

                            <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
                                <div
                                    ref={stageRef}
                                    style={{ width: 'auto', height: 'min(100%, 54vh, 560px)', aspectRatio: '1 / 1' }}
                                    className="poster-stage relative isolate max-h-full max-w-full shrink-0 overflow-hidden border border-white/15 bg-white shadow-[0_18px_55px_rgba(0,0,0,0.4)] [container-type:inline-size] touch-none"
                                    onPointerMove={handleStagePointerMove}
                                    onPointerUp={handleStagePointerUp}
                                    onPointerCancel={handleStagePointerUp}
                                    onClick={() => setSelectedLayer('product')}
                                >
                                    {useUploadedBackground && backgroundPreviewUrl ? (
                                        <img src={backgroundPreviewUrl} alt="Nền poster" draggable={false} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover" />
                                    ) : (
                                        <>
                                            <div className="pointer-events-none absolute inset-0 bg-white" />
                                            <div className="pointer-events-none absolute -left-[30%] top-[28%] h-[75%] w-[75%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(68,187,255,0.22),rgba(105,207,255,0.07)_48%,transparent_72%)]" />
                                            <div className="pointer-events-none absolute -right-[30%] top-[28%] h-[75%] w-[75%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(48,165,245,0.2),rgba(105,207,255,0.06)_48%,transparent_72%)]" />
                                            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1600 1600" preserveAspectRatio="none" aria-hidden="true">
                                                {Array.from({ length: 5 }, (_, index) => {
                                                    const offset = index * 58;
                                                    return (
                                                        <g key={index} fill="none" stroke="url(#poster-ribbon-gradient)" strokeLinecap="round" strokeLinejoin="round" opacity={index === 0 ? 0.42 : 0.28} strokeWidth={index === 0 ? 34 : 14}>
                                                            <path d={`M -180 ${430 + offset} C 120 ${650 + offset}, 220 ${950 + offset}, 660 ${1110 + offset} C 360 ${1300 + offset}, 110 ${1430 + offset}, -160 ${1580 + offset}`} />
                                                            <path d={`M 1780 ${430 + offset} C 1480 ${650 + offset}, 1380 ${950 + offset}, 940 ${1110 + offset} C 1240 ${1300 + offset}, 1490 ${1430 + offset}, 1760 ${1580 + offset}`} />
                                                        </g>
                                                    );
                                                })}
                                                <defs>
                                                    <linearGradient id="poster-ribbon-gradient" x1="0" y1="400" x2="1600" y2="1350" gradientUnits="userSpaceOnUse">
                                                        <stop offset="0" stopColor="#ffffff" stopOpacity="0.12" />
                                                        <stop offset="0.42" stopColor="#86d9ff" />
                                                        <stop offset="0.74" stopColor="#159ce9" />
                                                        <stop offset="1" stopColor="#005bbe" stopOpacity="0.04" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                        </>
                                    )}

                                    {renderLayerControls(
                                        'product',
                                        cutoutPreviewUrl ? (
                                            <img src={cutoutPreviewUrl} alt="Sản phẩm đã tách nền" draggable={false} decoding="async" className="pointer-events-none h-full w-full select-none object-contain drop-shadow-[0_20px_18px_rgba(20,35,50,0.20)]" />
                                        ) : (
                                            <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-2 border border-dashed border-slate-300/70 bg-white/35 text-slate-500">
                                                <FiImage className="h-[10%] w-[10%]" aria-hidden="true" />
                                                <span className="text-[1.5cqw] font-bold">Ảnh sản phẩm</span>
                                            </div>
                                        ),
                                        layerStyle(layout.product),
                                    )}

                                    {renderLayerControls(
                                        'price',
                                        <span
                                            className="pointer-events-none flex h-full w-full flex-col items-center justify-center overflow-visible text-center font-black"
                                            style={textLayerStyle(layout.price, 'price')}
                                        >
                                            {getPreviewTextLines(price || 'Giá sản phẩm', layout.price, 'price').map((line, index) => (
                                                <span key={`${index}-${line}`} className="block w-full whitespace-pre">{line || '\u00a0'}</span>
                                            ))}
                                        </span>,
                                        layerStyle(layout.price),
                                    )}

                                    {renderLayerControls(
                                        'title',
                                        <div
                                            className="pointer-events-none flex h-full w-full items-center overflow-visible font-black"
                                            style={{ justifyContent: titleAlignment === 'left' ? 'flex-start' : titleAlignment === 'right' ? 'flex-end' : 'center' }}
                                        >
                                            <span
                                                className="block w-full whitespace-normal"
                                                style={{ ...textLayerStyle(layout.title, 'title', titleAlignment), paddingInline: '2%', boxSizing: 'border-box' }}
                                            >
                                                {getPreviewTextLines(productName || 'Tên sản phẩm', layout.title, 'title').map((line, index) => (
                                                    <span key={`${index}-${line}`} className="block w-full whitespace-pre">{line || '\u00a0'}</span>
                                                ))}
                                            </span>
                                        </div>,
                                        layerStyle(layout.title),
                                    )}
                                </div>
                            </div>

                            <div className="flex shrink-0 min-w-0 flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-1.5">
                                <span className="mr-auto text-[10px] font-semibold text-slate-400">Đang chọn: {LAYER_LABELS[selectedLayer]}</span>
                                {(['title', 'price', 'product'] as const).map((id) => (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setSelectedLayer(id)}
                                        aria-pressed={selectedLayer === id}
                                        className={`min-h-8 rounded-md border px-2.5 text-[9px] font-bold transition ${selectedLayer === id ? 'border-cyan-300/45 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.06]'}`}
                                    >
                                        {LAYER_LABELS[id]}
                                    </button>
                                ))}
                                {selectedLayer === 'title' || selectedLayer === 'price' ? (
                                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-md border border-cyan-300/15 bg-cyan-300/[0.035] px-2 py-1.5">
                                        <label htmlFor="poster-text-size" className="shrink-0 text-[9px] font-semibold text-slate-300">Cỡ chữ (px)</label>
                                        <input
                                            id="poster-text-size"
                                            type="range"
                                            min={12}
                                            max={1200}
                                            step={1}
                                            value={Math.round(layout[selectedLayer].fontSize)}
                                            onChange={(event) => updateTextFontSize(selectedLayer, Number(event.target.value))}
                                            className="min-w-[90px] flex-1 accent-cyan-300"
                                            aria-label={`Cỡ chữ ${LAYER_LABELS[selectedLayer]} theo pixel`}
                                        />
                                        <input
                                            type="number"
                                            min={12}
                                            max={1200}
                                            step={1}
                                            value={Math.round(layout[selectedLayer].fontSize)}
                                            onChange={(event) => updateTextFontSize(selectedLayer, Number(event.target.value))}
                                            className="h-7 w-[68px] rounded-md border border-white/10 bg-slate-950 px-1.5 text-right text-[10px] font-bold tabular-nums text-cyan-100 outline-none focus:border-cyan-300/50"
                                            aria-label={`Nhập cỡ chữ ${LAYER_LABELS[selectedLayer]} theo pixel`}
                                        />
                                        <span className="text-[8px] text-slate-500">Kéo tay nắm để zoom</span>
                                    </div>
                                ) : null}
                                {selectedLayer === 'product' ? (
                                    <label className="flex min-w-[150px] flex-1 items-center gap-2 px-1">
                                        <span className="shrink-0 text-[9px] font-semibold text-slate-400">Zoom</span>
                                        <input
                                            type="range"
                                            min={PRODUCT_LAYER_MIN_SCALE * 100}
                                            max={PRODUCT_LAYER_MAX_SCALE * 100}
                                            step={5}
                                            value={Math.round((layout.product.width / INITIAL_LAYOUT.product.width) * 100)}
                                            onChange={(event) => updateProductScale(Number(event.target.value))}
                                            className="min-w-0 flex-1 accent-cyan-300"
                                            aria-label="Phóng to hoặc thu nhỏ ảnh sản phẩm"
                                        />
                                        <span className="w-10 shrink-0 text-right text-[9px] tabular-nums text-cyan-200">
                                            {Math.round((layout.product.width / INITIAL_LAYOUT.product.width) * 100)}%
                                        </span>
                                    </label>
                                ) : null}
                            </div>

                            <footer className="flex shrink-0 min-w-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
                                <span className="text-[10px] text-slate-500">PNG · 1600 × 1600 · Tỷ lệ 1:1</span>
                                <div className="flex flex-wrap items-center gap-2">
                                    {posterPreviewUrl && onSavePoster ? (
                                        <button
                                            type="button"
                                            disabled={isSavingPoster}
                                            onClick={() => void handleSavePoster()}
                                            className="flex min-h-10 items-center justify-center rounded-lg bg-emerald-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-45"
                                        >
                                            {isSavingPoster ? 'Đang lưu...' : 'Lưu vào sản phẩm'}
                                        </button>
                                    ) : null}
                                    {posterPreviewUrl ? (
                                        <button
                                            type="button"
                                            onClick={handleDownloadPoster}
                                            className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-200"
                                        >
                                            <FiDownload className="h-4 w-4" aria-hidden="true" />
                                            Tải PNG
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        disabled={!canGenerate}
                                        onClick={() => void handleGeneratePoster()}
                                        className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-35"
                                    >
                                        {isGeneratingPoster ? <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" /> : posterPreviewUrl ? <FiCheck className="h-4 w-4" aria-hidden="true" /> : <FiImage className="h-4 w-4" aria-hidden="true" />}
                                        {isGeneratingPoster ? 'Đang tạo...' : posterPreviewUrl ? 'Đã tạo Poster' : 'Tạo Poster'}
                                    </button>
                                </div>
                            </footer>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
