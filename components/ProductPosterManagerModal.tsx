'use client';

import { lazy, Suspense, useMemo, useState } from 'react';
import type { ProductPosterRecord } from '@/types/local-products';

const ProductPosterGenerator = lazy(
    () => import('@/components/ProductPosterGenerator'),
);

type PosterManagerProduct = {
    id: string;
    name: string;
    priceText: string;
    category: string;
    categoryGroup: string;
    isDone: boolean;
    images: Array<{
        name: string;
        dataUrl: string;
    }>;
    posters: ProductPosterRecord[];
};

type ProductPosterManagerModalProps = {
    products: PosterManagerProduct[];
    onClose: () => void;
    onSaveCategoryGroup: (productId: string, categoryGroup: string) => Promise<void>;
    onSavePoster: (
        productId: string,
        posterName: string,
        posterBlob: Blob,
        fileName: string,
    ) => Promise<void>;
};

type DoneFilter = 'pending' | 'done' | 'all';
type PosterFilter = 'missing' | 'hasPoster' | 'all';
type ManagerView = 'manage' | 'list';

type CategoryGroup = {
    name: string;
    categories: Array<{
        name: string;
        products: PosterManagerProduct[];
    }>;
};

const toUnicodeBoldText = (value: string): string => {
    return Array.from(value)
        .map((character) => {
            const code = character.codePointAt(0);
            if (code === undefined) return character;

            if (code >= 65 && code <= 90) {
                return String.fromCodePoint(0x1d400 + code - 65);
            }

            if (code >= 97 && code <= 122) {
                return String.fromCodePoint(0x1d41a + code - 97);
            }

            if (code >= 48 && code <= 57) {
                return String.fromCodePoint(0x1d7ce + code - 48);
            }

            return character;
        })
        .join('');
};

const getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : 'Không thể lưu dữ liệu poster.';
};

export default function ProductPosterManagerModal({
    products,
    onClose,
    onSaveCategoryGroup,
    onSavePoster,
}: ProductPosterManagerModalProps) {
    const [doneFilter, setDoneFilter] = useState<DoneFilter>('pending');
    const [posterFilter, setPosterFilter] = useState<PosterFilter>('missing');
    const [managerView, setManagerView] = useState<ManagerView>('manage');
    const [search, setSearch] = useState('');
    const [categoryGroupDrafts, setCategoryGroupDrafts] = useState<Record<string, string>>({});
    const [savingProductIds, setSavingProductIds] = useState<Set<string>>(() => new Set());
    const [feedback, setFeedback] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');

    const filteredProducts = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase('vi-VN');

        return products.filter((product) => {
            if (doneFilter === 'pending' && product.isDone) return false;
            if (doneFilter === 'done' && !product.isDone) return false;

            const posterCount = product.posters?.length ?? 0;
            if (posterFilter === 'missing' && posterCount > 0) return false;
            if (posterFilter === 'hasPoster' && posterCount === 0) return false;

            if (!normalizedSearch) return true;

            const searchableContent = [
                product.name,
                product.category,
                product.categoryGroup,
                product.priceText,
                ...(product.posters ?? []).flatMap((poster) => [
                    poster.posterName,
                    poster.fileName,
                ]),
            ]
                .join(' ')
                .toLocaleLowerCase('vi-VN');

            return searchableContent.includes(normalizedSearch);
        });
    }, [doneFilter, posterFilter, products, search]);

    const groupedProducts = useMemo<CategoryGroup[]>(() => {
        const largeGroups = new Map<string, Map<string, PosterManagerProduct[]>>();

        filteredProducts.forEach((product) => {
            const largeCategory = product.categoryGroup.trim() || 'Chưa phân danh mục lớn';
            const productCategory = product.category.trim() || 'Chưa phân danh mục';

            if (!largeGroups.has(largeCategory)) {
                largeGroups.set(largeCategory, new Map<string, PosterManagerProduct[]>());
            }

            const categories = largeGroups.get(largeCategory);
            if (!categories) return;

            if (!categories.has(productCategory)) {
                categories.set(productCategory, []);
            }

            categories.get(productCategory)?.push(product);
        });

        return Array.from(largeGroups.entries())
            .sort(([first], [second]) => first.localeCompare(second, 'vi'))
            .map(([name, categories]) => ({
                name,
                categories: Array.from(categories.entries())
                    .sort(([first], [second]) => first.localeCompare(second, 'vi'))
                    .map(([categoryName, categoryProducts]) => ({
                        name: categoryName,
                        products: categoryProducts,
                    })),
            }));
    }, [filteredProducts]);

    const selectedProduct = products.find(
        (product) => product.id === selectedProductId,
    ) ?? null;

    const saveCategoryGroup = async (product: PosterManagerProduct): Promise<void> => {
        const nextValue = (categoryGroupDrafts[product.id] ?? product.categoryGroup).trim();
        if (nextValue === product.categoryGroup.trim()) return;

        setFeedback('');
        setSavingProductIds((current) => new Set(current).add(product.id));

        try {
            await onSaveCategoryGroup(product.id, nextValue);
            setCategoryGroupDrafts((current) => ({
                ...current,
                [product.id]: nextValue,
            }));
            setFeedback('Đã lưu danh mục lớn.');
        } catch (error) {
            setFeedback(getErrorMessage(error));
        } finally {
            setSavingProductIds((current) => {
                const next = new Set(current);
                next.delete(product.id);
                return next;
            });
        }
    };

    const saveGeneratedPoster = async (
        posterBlob: Blob,
        fileName: string,
        posterName: string,
    ): Promise<void> => {
        if (!selectedProduct) return;

        setSavingProductIds((current) => new Set(current).add(selectedProduct.id));
        setFeedback('');

        try {
            await onSavePoster(selectedProduct.id, posterName, posterBlob, fileName);
            setSelectedProductId('');
            setFeedback('Đã lưu poster vào sản phẩm.');
        } catch (error) {
            setFeedback(getErrorMessage(error));
            throw error;
        } finally {
            setSavingProductIds((current) => {
                const next = new Set(current);
                next.delete(selectedProduct.id);
                return next;
            });
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 z-[2147483000] flex h-dvh w-full items-center justify-center overflow-hidden bg-black/80 p-2 backdrop-blur-md xl:p-5"
                role="dialog"
                aria-modal="true"
                aria-label="Quản lý poster sản phẩm"
                onMouseDown={(event) => {
                    if (event.target === event.currentTarget) onClose();
                }}
            >
                <section className="flex h-[calc(100dvh-1rem)] w-full max-w-6xl min-w-0 flex-col overflow-hidden rounded-xl border border-cyan-300/20 bg-[linear-gradient(145deg,#0b1722,#050a11)] shadow-[0_28px_100px_rgba(0,0,0,0.75)] xl:h-[calc(100dvh-2.5rem)]">
                    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-3 xl:px-4">
                        <div className="min-w-0">
                            <h2 className="text-sm font-black text-white">Quản lý Poster sản phẩm</h2>
                            <p className="mt-1 text-[10px] text-slate-400">
                                Mặc định lọc sản phẩm chưa DONE và chưa có poster. Trạng thái DONE chỉ dùng để lọc.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                        >
                            Đóng
                        </button>
                    </header>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 p-2.5 xl:p-3">
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Tìm sản phẩm hoặc danh mục..."
                            className="min-h-9 min-w-[180px] flex-1 rounded-lg border border-white/10 bg-black/25 px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                        />

                        <select
                            value={doneFilter}
                            onChange={(event) => setDoneFilter(event.target.value as DoneFilter)}
                            aria-label="Lọc trạng thái DONE"
                            className="min-h-9 rounded-lg border border-white/10 bg-slate-950 px-2.5 text-xs font-semibold text-white outline-none focus:border-cyan-300/50"
                        >
                            <option value="pending">Chưa DONE</option>
                            <option value="done">Đã DONE</option>
                            <option value="all">Tất cả trạng thái</option>
                        </select>

                        <select
                            value={posterFilter}
                            onChange={(event) => setPosterFilter(event.target.value as PosterFilter)}
                            aria-label="Lọc trạng thái poster"
                            className="min-h-9 rounded-lg border border-white/10 bg-slate-950 px-2.5 text-xs font-semibold text-white outline-none focus:border-cyan-300/50"
                        >
                            <option value="missing">Chưa có Poster</option>
                            <option value="hasPoster">Đã có Poster</option>
                            <option value="all">Tất cả Poster</option>
                        </select>

                        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
                            <button
                                type="button"
                                aria-pressed={managerView === 'manage'}
                                onClick={() => setManagerView('manage')}
                                className={managerView === 'manage' ? 'min-h-7 rounded-md bg-cyan-300 px-3 text-[10px] font-black text-slate-950' : 'min-h-7 rounded-md px-3 text-[10px] font-black text-slate-300 transition hover:bg-white/10'}
                            >
                                Quản lý
                            </button>
                            <button
                                type="button"
                                aria-pressed={managerView === 'list'}
                                onClick={() => setManagerView('list')}
                                className={managerView === 'list' ? 'min-h-7 rounded-md bg-cyan-300 px-3 text-[10px] font-black text-slate-950' : 'min-h-7 rounded-md px-3 text-[10px] font-black text-slate-300 transition hover:bg-white/10'}
                            >
                                Danh sách
                            </button>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2 text-[10px] text-slate-400 xl:px-4">
                        <span>{filteredProducts.length} / {products.length} sản phẩm phù hợp bộ lọc</span>
                        <span>Không thay đổi trạng thái DONE</span>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-2.5 xl:p-4">
                        {managerView === 'manage' ? (
                            filteredProducts.length > 0 ? (
                                <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                                    {filteredProducts.map((product) => {
                                        const draftCategoryGroup = categoryGroupDrafts[product.id] ?? product.categoryGroup;
                                        const isSaving = savingProductIds.has(product.id);

                                        return (
                                            <article
                                                key={product.id}
                                                className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-2.5"
                                            >
                                                <div className="flex min-w-0 gap-3">
                                                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/25">
                                                        {product.images[0]?.dataUrl ? (
                                                            <img
                                                                src={product.images[0].dataUrl}
                                                                alt={product.name}
                                                                loading="lazy"
                                                                decoding="async"
                                                                className="h-full w-full object-contain"
                                                            />
                                                        ) : (
                                                            <div className="flex h-full items-center justify-center px-2 text-center text-[9px] text-slate-500">
                                                                Chưa có ảnh
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="break-words text-xs font-black text-white">
                                                            {product.name}
                                                        </h3>
                                                        <p className="mt-1 text-[10px] text-slate-400">
                                                            {product.category || 'Chưa phân danh mục'}
                                                            {product.priceText ? ' · ' + product.priceText : ''}
                                                        </p>
                                                        <p className="mt-1 text-[9px] font-semibold text-cyan-200">
                                                            {product.isDone ? 'DONE' : 'CHƯA DONE'} · {(product.posters?.length ?? 0)} Poster
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-2 flex flex-col gap-1.5">
                                                    <label className="text-[9px] font-bold text-slate-400">
                                                        Danh mục lớn
                                                    </label>
                                                    <div className="flex min-w-0 gap-2">
                                                        <input
                                                            value={draftCategoryGroup}
                                                            onChange={(event) => setCategoryGroupDrafts((current) => ({
                                                                ...current,
                                                                [product.id]: event.target.value,
                                                            }))}
                                                            placeholder="Ví dụ: Laptop Văn Phòng"
                                                            aria-label={'Danh mục lớn của ' + product.name}
                                                            className="min-h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-2.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
                                                        />
                                                        <button
                                                            type="button"
                                                            disabled={isSaving || draftCategoryGroup.trim() === product.categoryGroup.trim()}
                                                            onClick={() => void saveCategoryGroup(product)}
                                                            className="min-h-9 shrink-0 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 text-[10px] font-black text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-35"
                                                        >
                                                            Lưu
                                                        </button>
                                                    </div>
                                                </div>

                                                {(product.posters?.length ?? 0) > 0 ? (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {product.posters.map((poster) => (
                                                            <a
                                                                key={poster.id}
                                                                href={poster.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex min-w-0 max-w-full items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-1.5 text-[9px] text-emerald-100 hover:bg-emerald-300/10"
                                                            >
                                                                <img
                                                                    src={poster.url}
                                                                    alt={poster.posterName}
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                    className="h-10 w-10 shrink-0 rounded object-cover"
                                                                />
                                                                <span className="min-w-0">
                                                                    <span className="block truncate font-bold">{poster.posterName}</span>
                                                                    <span className="block truncate text-emerald-200/60">{poster.fileName}</span>
                                                                </span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : null}

                                                <div className="mt-2 flex justify-end">
                                                    <button
                                                        type="button"
                                                        disabled={isSaving}
                                                        onClick={() => setSelectedProductId(product.id)}
                                                        className="min-h-9 rounded-md bg-cyan-300 px-4 text-[10px] font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-40"
                                                    >
                                                        Tạo Poster
                                                    </button>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-white/15 text-center text-xs text-slate-400">
                                    Không có sản phẩm phù hợp bộ lọc.
                                </div>
                            )
                        ) : (
                            <div className="space-y-2">
                                {groupedProducts.length > 0 ? groupedProducts.map((largeGroup) => (
                                    <details
                                        key={largeGroup.name}
                                        open
                                        className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.035]"
                                    >
                                        <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-black text-cyan-100">
                                            {toUnicodeBoldText(largeGroup.name)}
                                            <span className="ml-2 text-[9px] font-semibold text-cyan-200/60">
                                                {largeGroup.categories.reduce((total, category) => total + category.products.length, 0)} sản phẩm
                                            </span>
                                        </summary>

                                        <div className="space-y-2 border-t border-white/10 p-2">
                                            {largeGroup.categories.map((category) => (
                                                <details
                                                    key={largeGroup.name + '-' + category.name}
                                                    open
                                                    className="rounded-md border border-white/10 bg-black/20"
                                                >
                                                    <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-black text-white">
                                                        {toUnicodeBoldText(category.name)}
                                                        <span className="ml-2 text-[9px] font-semibold text-slate-500">
                                                            {category.products.length}
                                                        </span>
                                                    </summary>

                                                    <div className="space-y-1 border-t border-white/10 p-2">
                                                        {category.products.map((product) => (
                                                            <div
                                                                key={product.id}
                                                                className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-white/[0.035] px-2.5 py-2"
                                                            >
                                                                <span className="min-w-0 break-words text-[10px] font-semibold text-slate-200">
                                                                    {product.name}
                                                                </span>
                                                                <span className="shrink-0 text-[9px] text-slate-500">
                                                                    {product.posters.length} poster
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            ))}
                                        </div>
                                    </details>
                                )) : (
                                    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-white/15 text-center text-xs text-slate-400">
                                        Không có nhóm sản phẩm phù hợp bộ lọc.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {feedback ? (
                        <p className="shrink-0 border-t border-white/10 px-3 py-2 text-[10px] text-cyan-100 xl:px-4">
                            {feedback}
                        </p>
                    ) : null}
                </section>
            </div>

            {selectedProduct ? (
                <Suspense
                    fallback={
                        <div className="fixed inset-0 z-[2147483010] flex items-center justify-center bg-black/85 p-4 text-xs font-semibold text-white">
                            Đang tải công cụ tạo Poster...
                        </div>
                    }
                >
                    <ProductPosterGenerator
                        key={selectedProduct.id}
                        initialProductName={selectedProduct.name}
                        initialPrice={selectedProduct.priceText}
                        initialImageUrl={selectedProduct.images[0]?.dataUrl ?? ''}
                        initialImageName={selectedProduct.images[0]?.name ?? ''}
                        onSavePoster={saveGeneratedPoster}
                        onClose={() => setSelectedProductId('')}
                    />
                </Suspense>
            ) : null}
        </>
    );
}
