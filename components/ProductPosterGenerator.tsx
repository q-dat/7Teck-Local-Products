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

type TextLayout = {
    lines: string[];
    fontSize: number;
    lineHeight: number;
};

const POSTER_SIZE = 1600;
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

const findAlphaBounds = (bitmap: ImageBitmap): AlphaBounds => {
    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = bitmap.width;
    scanCanvas.height = bitmap.height;

    const context = scanCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Không thể đọc dữ liệu ảnh đã tách nền.');

    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const stride = Math.max(1, Math.floor(Math.max(bitmap.width, bitmap.height) / 1800));
    let minimumX = bitmap.width;
    let minimumY = bitmap.height;
    let maximumX = -1;
    let maximumY = -1;

    for (let y = 0; y < bitmap.height; y += stride) {
        for (let x = 0; x < bitmap.width; x += stride) {
            const alpha = pixels[(y * bitmap.width + x) * 4 + 3] ?? 0;
            if (alpha <= 12) continue;
            minimumX = Math.min(minimumX, x);
            minimumY = Math.min(minimumY, y);
            maximumX = Math.max(maximumX, x);
            maximumY = Math.max(maximumY, y);
        }
    }

    scanCanvas.width = 0;
    scanCanvas.height = 0;

    if (maximumX < minimumX || maximumY < minimumY) {
        return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    }

    const paddingX = Math.max(2, Math.round((maximumX - minimumX + 1) * 0.025));
    const paddingY = Math.max(2, Math.round((maximumY - minimumY + 1) * 0.025));
    const x = Math.max(0, minimumX - paddingX);
    const y = Math.max(0, minimumY - paddingY);
    const right = Math.min(bitmap.width, maximumX + paddingX + 1);
    const bottom = Math.min(bitmap.height, maximumY + paddingY + 1);

    return { x, y, width: right - x, height: bottom - y };
};

const wrapText = (
    context: CanvasRenderingContext2D,
    value: string,
    maximumWidth: number,
): string[] => {
    const words = value.trim().split(/\s+/u).filter(Boolean);
    const lines: string[] = [];
    let line = '';

    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (context.measureText(candidate).width <= maximumWidth || !line) {
            line = candidate;
            continue;
        }
        lines.push(line);
        line = word;
    }

    if (line) lines.push(line);
    return lines;
};

const fitTextLayout = (
    context: CanvasRenderingContext2D,
    value: string,
    maximumWidth: number,
    maximumHeight: number,
    preferredFontSize: number,
    maximumLines: number,
): TextLayout => {
    for (let fontSize = Math.max(24, preferredFontSize); fontSize >= 24; fontSize -= 2) {
        context.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
        const lines = wrapText(context, value, maximumWidth);
        const lineHeight = Math.round(fontSize * 0.94);
        const fitsWidth = lines.every((line) => context.measureText(line).width <= maximumWidth);
        if (fitsWidth && lines.length <= maximumLines && lineHeight * lines.length <= maximumHeight) {
            return { lines, fontSize, lineHeight };
        }
    }

    const fontSize = 24;
    context.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
    return {
        lines: wrapText(context, value, maximumWidth).slice(0, maximumLines),
        fontSize,
        lineHeight: 23,
    };
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

const drawTextLayer = (
    context: CanvasRenderingContext2D,
    value: string,
    layer: PosterLayer,
    kind: 'title' | 'price',
): void => {
    const x = (layer.x / 100) * POSTER_SIZE;
    const y = (layer.y / 100) * POSTER_SIZE;
    const width = (layer.width / 100) * POSTER_SIZE;
    const height = (layer.height / 100) * POSTER_SIZE;
    const textLayout = fitTextLayout(
        context,
        value,
        width * 0.96,
        height * 0.9,
        layer.fontSize,
        kind === 'title' ? 2 : 1,
    );

    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `900 ${textLayout.fontSize}px Arial, Helvetica, sans-serif`;
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

    const totalHeight = textLayout.lines.length * textLayout.lineHeight;
    const firstBaseline = y + height / 2 - totalHeight / 2 + textLayout.lineHeight / 2;
    textLayout.lines.forEach((line, index) => {
        context.fillText(
            line,
            x + width / 2,
            firstBaseline + index * textLayout.lineHeight,
            width * 0.96,
        );
    });
    context.restore();
};

const createPosterBlob = async (
    name: string,
    price: string,
    cutout: Blob,
    background: Blob | null,
    layout: PosterLayout,
): Promise<Blob> => {
    const [productBitmap, backgroundBitmap] = await Promise.all([
        loadImageBitmap(cutout),
        background ? loadImageBitmap(background) : Promise.resolve(null),
    ]);

    try {
        const canvas = document.createElement('canvas');
        canvas.width = POSTER_SIZE;
        canvas.height = POSTER_SIZE;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Không thể khởi tạo Canvas tạo poster.');

        if (backgroundBitmap) {
            drawImageCover(context, backgroundBitmap);
        } else {
            drawDefaultBackground(context);
        }

        const productBounds = findAlphaBounds(productBitmap);
        const productLayer = layout.product;
        const area = {
            x: (productLayer.x / 100) * POSTER_SIZE,
            y: (productLayer.y / 100) * POSTER_SIZE,
            width: (productLayer.width / 100) * POSTER_SIZE,
            height: (productLayer.height / 100) * POSTER_SIZE,
        };
        const scale = Math.min(
            area.width / productBounds.width,
            area.height / productBounds.height,
        );
        const drawWidth = productBounds.width * scale;
        const drawHeight = productBounds.height * scale;
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

        context.drawImage(
            productBitmap,
            productBounds.x,
            productBounds.y,
            productBounds.width,
            productBounds.height,
            drawX,
            drawY,
            drawWidth,
            drawHeight,
        );

        drawTextLayer(context, name.trim(), layout.title, 'title');
        drawTextLayer(context, price.trim(), layout.price, 'price');

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
                canvas.width = 0;
                canvas.height = 0;
                if (blob) resolve(blob);
                else reject(new Error('Không thể xuất poster PNG.'));
            }, 'image/png');
        });
    } finally {
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
}: ProductPosterGeneratorProps) {
    const productInputRef = useRef<HTMLInputElement | null>(null);
    const backgroundInputRef = useRef<HTMLInputElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const sourcePreviewUrlRef = useRef<string>('');
    const cutoutPreviewUrlRef = useRef<string>('');
    const backgroundPreviewUrlRef = useRef<string>('');
    const posterPreviewUrlRef = useRef<string>('');
    const pointerActionRef = useRef<PosterPointerAction | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);

    const [productName, setProductName] = useState<string>('');
    const [price, setPrice] = useState<string>('');
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
        revokeUrl(posterPreviewUrlRef.current);
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
            const result = await removeBackground(file, {
                model: 'lite',
                quality: 'quality',
                signal: controller.signal,
                onProgress: ({ stage, progress: currentProgress }) => {
                    const normalizedProgress = currentProgress <= 1
                        ? currentProgress * 100
                        : currentProgress;
                    setProgress({
                        label: getProgressLabel(stage),
                        percent: clamp(Math.round(normalizedProgress), 0, 100),
                    });
                },
            });

            if (controller.signal.aborted) return;
            const nextUrl = URL.createObjectURL(result.blob);
            cutoutPreviewUrlRef.current = nextUrl;
            setCutoutBlob(result.blob);
            setCutoutPreviewUrl(nextUrl);
            setProgress({ label: 'Đã tách nền xong', percent: 100 });
        } catch (error) {
            if (controller.signal.aborted) return;
            setErrorMessage(
                error instanceof Error ? error.message : 'Không thể tách nền ảnh. Vui lòng thử lại.',
            );
        } finally {
            if (!controller.signal.aborted) setIsRemovingBackground(false);
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

    const handleStagePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
        const action = pointerActionRef.current;
        if (!action || action.pointerId !== event.pointerId) return;

        const deltaX = ((event.clientX - action.startClientX) / action.stageWidth) * 100;
        const deltaY = ((event.clientY - action.startClientY) / action.stageHeight) * 100;

        setLayout((current) => {
            const initial = action.initial;
            const nextLayer = { ...initial };

            if (action.mode === 'move') {
                nextLayer.x = clamp(initial.x + deltaX, 0, 100 - initial.width);
                nextLayer.y = clamp(initial.y + deltaY, 0, 100 - initial.height);
            } else {
                const nextWidth = clamp(initial.width + deltaX, 8, 100 - initial.x);
                const nextHeight = clamp(initial.height + deltaY, 6, 100 - initial.y);
                nextLayer.width = nextWidth;
                nextLayer.height = nextHeight;
                if (action.layerId !== 'product') {
                    const widthScale = nextWidth / Math.max(initial.width, 1);
                    const heightScale = nextHeight / Math.max(initial.height, 1);
                    nextLayer.fontSize = clamp(
                        initial.fontSize * Math.min(widthScale, heightScale),
                        30,
                        420,
                    );
                }
            }

            return { ...current, [action.layerId]: nextLayer };
        });
        invalidateExport();
    }, [invalidateExport]);

    const handleStagePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
        if (pointerActionRef.current?.pointerId !== event.pointerId) return;
        pointerActionRef.current = null;
    }, []);

    const handleGeneratePoster = useCallback(async (): Promise<void> => {
        if (
            !cutoutBlob ||
            !productName.trim() ||
            !price.trim() ||
            isGeneratingPoster ||
            isRemovingBackground
        ) return;

        setIsGeneratingPoster(true);
        setErrorMessage('');

        try {
            const posterBlob = await createPosterBlob(
                productName.trim(),
                price.trim(),
                cutoutBlob,
                useUploadedBackground ? backgroundBlob : null,
                layout,
            );
            const nextUrl = URL.createObjectURL(posterBlob);
            revokeUrl(posterPreviewUrlRef.current);
            posterPreviewUrlRef.current = nextUrl;
            setPosterPreviewUrl(nextUrl);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Không thể tạo poster.');
        } finally {
            setIsGeneratingPoster(false);
        }
    }, [
        backgroundBlob,
        cutoutBlob,
        isGeneratingPoster,
        isRemovingBackground,
        layout,
        price,
        productName,
        revokeUrl,
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

    const updateProductName = (value: string): void => {
        setProductName(value);
        invalidateExport();
    };

    const updatePrice = (value: string): void => {
        setPrice(value);
        invalidateExport();
    };

    const resetLayout = (): void => {
        setLayout(INITIAL_LAYOUT);
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
        return () => {
            abortControllerRef.current?.abort();
            revokeUrl(sourcePreviewUrlRef.current);
            revokeUrl(cutoutPreviewUrlRef.current);
            revokeUrl(backgroundPreviewUrlRef.current);
            revokeUrl(posterPreviewUrlRef.current);
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

    const getPreviewFontSize = (
        value: string,
        layer: PosterLayer,
        maximumLines: number,
    ): number => {
        if (typeof document === 'undefined') return layer.fontSize;
        const measureCanvas = document.createElement('canvas');
        const context = measureCanvas.getContext('2d');
        if (!context) return layer.fontSize;

        return fitTextLayout(
            context,
            value || 'Tên sản phẩm',
            ((layer.width / 100) * POSTER_SIZE) * 0.96,
            ((layer.height / 100) * POSTER_SIZE) * 0.9,
            layer.fontSize,
            maximumLines,
        ).fontSize;
    };

    const textLayerStyle = (
        value: string,
        layer: PosterLayer,
        kind: 'title' | 'price',
    ): CSSProperties => ({
        fontSize: `${(getPreviewFontSize(value, layer, kind === 'title' ? 2 : 1) / POSTER_SIZE) * 100}cqw`,
        lineHeight: 0.94,
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
                        className="absolute -bottom-2 -right-2 z-30 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-full border-2 border-white bg-cyan-400 text-slate-950 shadow-lg touch-none"
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
                            <label className="flex min-w-0 flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tên sản phẩm</span>
                                <input
                                    value={productName}
                                    onChange={(event) => updateProductName(event.target.value)}
                                    placeholder="Ví dụ: Dell Latitude 5440"
                                    maxLength={90}
                                    className="h-9 w-full min-w-0 rounded-lg border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60"
                                />
                            </label>

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
                                        <img src={backgroundPreviewUrl} alt="Ảnh nền đã tải" className="h-8 w-8 shrink-0 rounded-md object-cover" />
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
                                            <img src={sourcePreviewUrl} alt="Ảnh gốc sản phẩm" className="h-full w-full object-contain" />
                                        </div>
                                    </div>
                                    <div className="min-w-0 rounded-lg border border-white/10 bg-black/20 p-1.5">
                                        <p className="mb-1 text-[8px] font-bold text-slate-500">ĐÃ TÁCH NỀN</p>
                                        <div className="flex h-12 items-center justify-center overflow-hidden rounded-md bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%),linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%)] bg-[position:0_0,8px_8px] bg-[size:16px_16px]">
                                            {cutoutPreviewUrl ? (
                                                <img src={cutoutPreviewUrl} alt="Ảnh sản phẩm đã tách nền" className="h-full w-full object-contain" />
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
                                        <img src={backgroundPreviewUrl} alt="Nền poster" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover" />
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
                                            <img src={cutoutPreviewUrl} alt="Sản phẩm đã tách nền" draggable={false} className="pointer-events-none h-full w-full select-none object-contain drop-shadow-[0_20px_18px_rgba(20,35,50,0.20)]" />
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
                                        <span className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden whitespace-nowrap text-center font-black" style={textLayerStyle(price || 'Giá sản phẩm', layout.price, 'price')}>
                                            {price || 'Giá sản phẩm'}
                                        </span>,
                                        layerStyle(layout.price),
                                    )}

                                    {renderLayerControls(
                                        'title',
                                        <span className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden break-words text-center font-black" style={textLayerStyle(productName || 'Tên sản phẩm', layout.title, 'title')}>
                                            {productName || 'Tên sản phẩm'}
                                        </span>,
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
                            </div>

                            <footer className="flex shrink-0 min-w-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
                                <span className="text-[10px] text-slate-500">PNG · 1600 × 1600 · Tỷ lệ 1:1</span>
                                <div className="flex flex-wrap items-center gap-2">
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
