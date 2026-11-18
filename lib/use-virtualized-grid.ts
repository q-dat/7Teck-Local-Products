"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";

type VirtualizedGridSegment = {
  startIndex: number;
  endIndex: number;
  beforeSpacerHeight: number;
};

type RangeState = {
  key: unknown;
  ready: boolean;
  segments: VirtualizedGridSegment[];
  trailingSpacerHeight: number;
};

type GridMetrics = {
  key: unknown;
  itemCount: number;
  rowCount: number;
  columns: number;
  rowGap: number;
  estimatedRowHeight: number;
  tree: Float64Array;
  measuredHeights: Map<number, number>;
};

type UseVirtualizedGridOptions = {
  itemCount: number;
  resetKey: unknown;
  initialItemCount: number;
  virtualizeAfter: number;
  estimatedRowHeight: number;
  overscanRows?: number;
  scrollTarget?: "window" | "element" | "closest";
  scrollContainerSelector?: string;
  pinnedIndexes?: readonly number[];
  getItemKey?: (index: number) => string | undefined;
};

type VirtualizedGridWindow = {
  gridRef: RefObject<HTMLDivElement | null>;
  renderSegments: readonly VirtualizedGridSegment[];
  trailingSpacerHeight: number;
  wasRenderedBefore: (index: number) => boolean;
};

type VirtualizedGridHostProps = UseVirtualizedGridOptions & {
  children: (window: VirtualizedGridWindow) => ReactNode;
};

const addFenwickValue = (
  tree: Float64Array,
  oneBasedIndex: number,
  delta: number,
): void => {
  for (
    let index = oneBasedIndex;
    index < tree.length;
    index += index & -index
  ) {
    tree[index] += delta;
  }
};

const getFenwickPrefix = (tree: Float64Array, rowCount: number): number => {
  let total = 0;

  for (let index = rowCount; index > 0; index -= index & -index) {
    total += tree[index];
  }

  return total;
};

const findRowAtOffset = (
  tree: Float64Array,
  rowCount: number,
  offset: number,
): number => {
  if (rowCount <= 1 || offset <= 0) return 0;

  let rowCountBeforeOffset = 0;
  let measuredOffset = 0;
  let step = 1;

  while (step * 2 <= rowCount) step *= 2;

  for (; step > 0; step = Math.floor(step / 2)) {
    const nextRowCount = rowCountBeforeOffset + step;
    if (
      nextRowCount <= rowCount &&
      measuredOffset + tree[nextRowCount] <= offset
    ) {
      rowCountBeforeOffset = nextRowCount;
      measuredOffset += tree[nextRowCount];
    }
  }

  return Math.min(rowCount - 1, rowCountBeforeOffset);
};

const buildMetrics = (
  key: unknown,
  itemCount: number,
  columns: number,
  rowGap: number,
  estimatedRowHeight: number,
): GridMetrics => {
  const rowCount = Math.ceil(itemCount / columns);
  const tree = new Float64Array(rowCount + 1);
  const defaultRowSize = estimatedRowHeight + rowGap;

  for (let index = 1; index <= rowCount; index += 1) {
    tree[index] = defaultRowSize * (index & -index);
  }

  return {
    key,
    itemCount,
    rowCount,
    columns,
    rowGap,
    estimatedRowHeight,
    tree,
    measuredHeights: new Map<number, number>(),
  };
};

const getSkippedRowsHeight = (
  metrics: GridMetrics,
  startRow: number,
  endRow: number,
): number => {
  if (endRow <= startRow) return 0;

  const rowsHeight =
    getFenwickPrefix(metrics.tree, endRow) -
    getFenwickPrefix(metrics.tree, startRow);

  return Math.max(0, rowsHeight - metrics.rowGap);
};

const buildSegments = (
  metrics: GridMetrics,
  firstRow: number,
  endRow: number,
  pinnedIndexes: readonly number[],
): { segments: VirtualizedGridSegment[]; trailingSpacerHeight: number } => {
  const rowRanges: Array<{ startRow: number; endRow: number }> = [
    { startRow: firstRow, endRow },
  ];

  pinnedIndexes.forEach((index) => {
    if (!Number.isInteger(index) || index < 0 || index >= metrics.itemCount) {
      return;
    }

    const row = Math.floor(index / metrics.columns);
    if (row < firstRow || row >= endRow) {
      rowRanges.push({ startRow: row, endRow: row + 1 });
    }
  });

  rowRanges.sort((first, second) => first.startRow - second.startRow);

  const mergedRanges = rowRanges.reduce<Array<{ startRow: number; endRow: number }>>(
    (ranges, range) => {
      const previous = ranges[ranges.length - 1];
      if (previous && range.startRow <= previous.endRow) {
        previous.endRow = Math.max(previous.endRow, range.endRow);
      } else {
        ranges.push({ ...range });
      }
      return ranges;
    },
    [],
  );

  let previousEndRow = 0;
  const segments = mergedRanges.map((range) => {
    const beforeSpacerHeight = getSkippedRowsHeight(
      metrics,
      previousEndRow,
      range.startRow,
    );
    previousEndRow = range.endRow;

    return {
      startIndex: range.startRow * metrics.columns,
      endIndex: Math.min(metrics.itemCount, range.endRow * metrics.columns),
      beforeSpacerHeight,
    };
  });

  return {
    segments,
    trailingSpacerHeight: getSkippedRowsHeight(
      metrics,
      previousEndRow,
      metrics.rowCount,
    ),
  };
};

const areSegmentsEqual = (
  first: readonly VirtualizedGridSegment[],
  second: readonly VirtualizedGridSegment[],
): boolean =>
  first.length === second.length &&
  first.every((segment, index) => {
    const other = second[index];
    return (
      other !== undefined &&
      segment.startIndex === other.startIndex &&
      segment.endIndex === other.endIndex &&
      Math.abs(segment.beforeSpacerHeight - other.beforeSpacerHeight) < 1
    );
  });

export function useVirtualizedGrid({
  itemCount,
  resetKey,
  initialItemCount,
  virtualizeAfter,
  estimatedRowHeight,
  overscanRows = 2,
  scrollTarget = "window",
  scrollContainerSelector,
  pinnedIndexes = [],
  getItemKey,
}: UseVirtualizedGridOptions) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const metricsRef = useRef<GridMetrics | null>(null);
  const refreshRef = useRef<(() => void) | null>(null);
  const pinnedIndexesRef = useRef(pinnedIndexes);
  const renderedAtRef = useRef(new Map<string, number>());
  const itemKeyRef = useRef(getItemKey);
  const [rangeState, setRangeState] = useState<RangeState>(() => ({
    key: resetKey,
    ready: false,
    segments: [{
      startIndex: 0,
      endIndex: Math.min(itemCount, initialItemCount),
      beforeSpacerHeight: 0,
    }],
    trailingSpacerHeight: 0,
  }));

  const enabled = itemCount > virtualizeAfter;
  const pinnedSignature = pinnedIndexes.join(",");
  pinnedIndexesRef.current = pinnedIndexes;
  itemKeyRef.current = getItemKey;

  const wasRenderedBefore = (index: number): boolean => {
    const itemKey = itemKeyRef.current?.(index) ?? String(index);
    const renderedAt = renderedAtRef.current.get(itemKey);
    const animationDuration = Math.min(index * 34, 340) + 680;
    return renderedAt !== undefined && Date.now() - renderedAt >= animationDuration;
  };

  useEffect(() => {
    if (!enabled) {
      metricsRef.current = null;
      setRangeState({
        key: resetKey,
        ready: true,
        segments: itemCount > 0
          ? [{ startIndex: 0, endIndex: itemCount, beforeSpacerHeight: 0 }]
          : [],
        trailingSpacerHeight: 0,
      });
      return;
    }

    const grid = gridRef.current;
    if (!grid) return;

    const targetWindow = grid.ownerDocument.defaultView ?? window;
    let animationFrame = 0;
    let metrics: GridMetrics;

    const readGridGeometry = (): { columns: number; rowGap: number } => {
      const style = targetWindow.getComputedStyle(grid);
      const columns = Math.max(
        1,
        style.gridTemplateColumns
          .trim()
          .split(/\s+/u)
          .filter(Boolean).length,
      );
      const parsedRowGap = Number.parseFloat(style.rowGap);

      return {
        columns,
        rowGap: Number.isFinite(parsedRowGap) ? parsedRowGap : 0,
      };
    };

    const calculateRange = (): void => {
      if (metrics.rowCount === 0) {
        setRangeState({
          key: resetKey,
          ready: true,
          segments: [],
          trailingSpacerHeight: 0,
        });
        return;
      }

      let scrollOffset: number;
      let viewportSize: number;

      if (scrollTarget === "element") {
        scrollOffset = grid.scrollTop;
        viewportSize = grid.clientHeight;
      } else if (scrollTarget === "closest" && scrollElement) {
        const gridTopWithinScroll =
          grid.getBoundingClientRect().top -
          scrollElement.getBoundingClientRect().top;
        scrollOffset = Math.max(0, -gridTopWithinScroll);
        viewportSize = scrollElement.clientHeight;
      } else {
        const gridTop = grid.getBoundingClientRect().top + targetWindow.scrollY;
        scrollOffset = Math.max(0, targetWindow.scrollY - gridTop);
        viewportSize = targetWindow.innerHeight;
      }

      const firstVisibleRow = findRowAtOffset(
        metrics.tree,
        metrics.rowCount,
        scrollOffset,
      );
      const lastVisibleRow = findRowAtOffset(
        metrics.tree,
        metrics.rowCount,
        scrollOffset + Math.max(viewportSize, metrics.estimatedRowHeight),
      );
      const firstRow = Math.max(0, firstVisibleRow - overscanRows);
      const endRow = Math.min(
        metrics.rowCount,
        lastVisibleRow + overscanRows + 1,
      );
      const next = buildSegments(
        metrics,
        firstRow,
        endRow,
        pinnedIndexesRef.current,
      );

      setRangeState((current) => {
        if (
          current.key === resetKey &&
          current.ready &&
          areSegmentsEqual(current.segments, next.segments) &&
          Math.abs(
            current.trailingSpacerHeight - next.trailingSpacerHeight,
          ) < 1
        ) {
          return current;
        }

        return {
          key: resetKey,
          ready: true,
          ...next,
        };
      });
    };

    const rebuildMetrics = (): void => {
      const geometry = readGridGeometry();
      const rowCount = Math.ceil(itemCount / geometry.columns);
      const current = metricsRef.current;

      if (
        !current ||
        current.key !== resetKey ||
        current.itemCount !== itemCount ||
        current.columns !== geometry.columns ||
        Math.abs(current.rowGap - geometry.rowGap) >= 0.5
      ) {
        metrics = buildMetrics(
          resetKey,
          itemCount,
          geometry.columns,
          geometry.rowGap,
          estimatedRowHeight,
        );
        metricsRef.current = metrics;
      } else {
        metrics = current;
      }

      if (metrics.rowCount !== rowCount) {
        metrics = buildMetrics(
          resetKey,
          itemCount,
          geometry.columns,
          geometry.rowGap,
          estimatedRowHeight,
        );
        metricsRef.current = metrics;
      }

      calculateRange();
    };

    const scheduleRefresh = (): void => {
      if (animationFrame !== 0) return;

      animationFrame = targetWindow.requestAnimationFrame(() => {
        animationFrame = 0;
        const geometry = readGridGeometry();
        if (
          geometry.columns !== metrics.columns ||
          Math.abs(geometry.rowGap - metrics.rowGap) >= 0.5
        ) {
          rebuildMetrics();
          return;
        }

        calculateRange();
      });
    };

    const measureMountedRows = (): void => {
      const rowHeights = new Map<number, number>();
      const cards = grid.querySelectorAll<HTMLElement>(
        ":scope > [data-virtual-index]",
      );

      cards.forEach((card) => {
        const itemIndex = Number(card.dataset.virtualIndex);
        if (!Number.isInteger(itemIndex) || itemIndex < 0) return;

        const height = card.getBoundingClientRect().height;
        if (!Number.isFinite(height) || height <= 0) return;

        const row = Math.floor(itemIndex / metrics.columns);
        rowHeights.set(row, Math.max(rowHeights.get(row) ?? 0, height));
      });

      let changed = false;
      rowHeights.forEach((height, row) => {
        const previous = metrics.measuredHeights.get(row);
        if (previous !== undefined && Math.abs(previous - height) < 1) return;

        const currentHeight = previous ?? metrics.estimatedRowHeight;
        metrics.measuredHeights.set(row, height);
        addFenwickValue(metrics.tree, row + 1, height - currentHeight);
        changed = true;
      });

      if (changed) scheduleRefresh();
    };

    const onScroll = (): void => scheduleRefresh();
    const scrollElement = scrollTarget === "element"
      ? grid
      : scrollTarget === "closest" && scrollContainerSelector
        ? grid.closest<HTMLElement>(scrollContainerSelector)
        : null;
    const scrollEventTarget: EventTarget = scrollElement ?? targetWindow;

    metricsRef.current = null;
    rebuildMetrics();
    refreshRef.current = scheduleRefresh;

    scrollEventTarget.addEventListener("scroll", onScroll, { passive: true });
    targetWindow.addEventListener("resize", rebuildMetrics, { passive: true });

    const gridResizeObserver = new ResizeObserver(() => {
      const geometry = readGridGeometry();
      if (
        geometry.columns !== metrics.columns ||
        Math.abs(geometry.rowGap - metrics.rowGap) >= 0.5
      ) {
        rebuildMetrics();
      } else {
        scheduleRefresh();
      }
    });
    gridResizeObserver.observe(grid);

    const itemResizeObserver = new ResizeObserver(measureMountedRows);
    const observeMountedItems = (): void => {
      itemResizeObserver.disconnect();
      grid.querySelectorAll<HTMLElement>(":scope > [data-virtual-index]")
        .forEach((item) => itemResizeObserver.observe(item));
      measureMountedRows();
    };

    const itemMutationObserver = new MutationObserver(observeMountedItems);
    itemMutationObserver.observe(grid, { childList: true });

    observeMountedItems();

    return () => {
      scrollEventTarget.removeEventListener("scroll", onScroll);
      targetWindow.removeEventListener("resize", rebuildMetrics);
      targetWindow.cancelAnimationFrame(animationFrame);
      gridResizeObserver.disconnect();
      itemResizeObserver.disconnect();
      itemMutationObserver.disconnect();
      refreshRef.current = null;
    };
  }, [
    enabled,
    estimatedRowHeight,
    initialItemCount,
    itemCount,
    overscanRows,
    resetKey,
    scrollTarget,
    scrollContainerSelector,
    virtualizeAfter,
  ]);

  useEffect(() => {
    if (enabled) refreshRef.current?.();
  }, [enabled, pinnedSignature]);

  const rangeIsCurrent = rangeState.key === resetKey && rangeState.ready;
  const renderSegments = useMemo(() => {
    if (!enabled) {
      return itemCount > 0
        ? [{ startIndex: 0, endIndex: itemCount, beforeSpacerHeight: 0 }]
        : [];
    }

    if (!rangeIsCurrent) {
      return itemCount > 0
        ? [{
            startIndex: 0,
            endIndex: Math.min(itemCount, initialItemCount),
            beforeSpacerHeight: 0,
          }]
        : [];
    }

    return rangeState.segments;
  }, [
    enabled,
    initialItemCount,
    itemCount,
    rangeIsCurrent,
    rangeState.segments,
  ]);

  useEffect(() => {
    const renderedAt = Date.now();
    renderSegments.forEach((segment) => {
      for (
        let index = segment.startIndex;
        index < segment.endIndex;
        index += 1
      ) {
        const itemKey = itemKeyRef.current?.(index) ?? String(index);
        if (!renderedAtRef.current.has(itemKey)) {
          renderedAtRef.current.set(itemKey, renderedAt);
          if (renderedAtRef.current.size > 2_000) {
            const oldestKey = renderedAtRef.current.keys().next().value;
            if (oldestKey !== undefined) renderedAtRef.current.delete(oldestKey);
          }
        }
      }
    });
  }, [renderSegments]);

  return {
    gridRef,
    renderSegments,
    trailingSpacerHeight:
      enabled && rangeIsCurrent ? rangeState.trailingSpacerHeight : 0,
    wasRenderedBefore,
  };
}

export function VirtualizedGridHost({
  children,
  ...options
}: VirtualizedGridHostProps) {
  const window = useVirtualizedGrid(options);
  return children(window);
}
