import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from "react-native";

import { subscribeDisplaySessionCheckpoint } from "./displaySessionLifecycle";
import {
  readCachedDisplaySessionState,
  readDisplaySessionState,
  writeDisplaySessionState,
} from "./displaySessionPersistence";

const scrollWriteDelayMs = 150;
const zeroOffsetSettleDelayMs = 120;
const scrollRestoreRetryDelaysMs = [0, 50, 150, 350, 750, 1_500] as const;

function parseScrollPosition(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function usePersistentScrollPosition(storageKey: string | null) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const restoredOffsetRef = useRef<number | null>(null);
  const isRestorePendingRef = useRef(false);
  const hasUserScrollRef = useRef(false);
  const restoreRequestRevisionRef = useRef(0);
  const restoreTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const zeroOffsetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistNow = useCallback(() => {
    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current);
      writeTimeoutRef.current = null;
    }
    if (storageKey) {
      const liveOffset = readScrollOffset(scrollRef);
      clearDeferredZeroOffset(zeroOffsetTimeoutRef);
      const restoredOffset = restoredOffsetRef.current;
      if (
        liveOffset !== null &&
        restoredOffset !== null &&
        liveOffset > 0 &&
        Math.abs(liveOffset - restoredOffset) > 1
      ) {
        hasUserScrollRef.current = true;
        isRestorePendingRef.current = false;
        cancelScheduledRestore(
          restoreTimeoutsRef,
          restoreRequestRevisionRef,
        );
      }
      if (
        liveOffset !== null &&
        (!isRestorePendingRef.current || hasUserScrollRef.current)
      ) {
        offsetRef.current = liveOffset;
      }
      const offsetToPersist = isRestorePendingRef.current
        ? (restoredOffsetRef.current ?? offsetRef.current)
        : offsetRef.current;
      void writeDisplaySessionState(storageKey, offsetToPersist);
    }
  }, [storageKey]);

  const schedulePersist = useCallback(() => {
    if (!storageKey || writeTimeoutRef.current) return;
    writeTimeoutRef.current = setTimeout(() => {
      writeTimeoutRef.current = null;
      void writeDisplaySessionState(storageKey, offsetRef.current);
    }, scrollWriteDelayMs);
  }, [storageKey]);

  const recordScrollOffset = useCallback(
    (nextOffset: number) => {
      if (nextOffset === 0 && offsetRef.current > 0) {
        if (!zeroOffsetTimeoutRef.current) {
          zeroOffsetTimeoutRef.current = setTimeout(() => {
            zeroOffsetTimeoutRef.current = null;
            offsetRef.current = 0;
            hasUserScrollRef.current = true;
            isRestorePendingRef.current = false;
            cancelScheduledRestore(
              restoreTimeoutsRef,
              restoreRequestRevisionRef,
            );
            schedulePersist();
          }, zeroOffsetSettleDelayMs);
        }
        return;
      }
      clearDeferredZeroOffset(zeroOffsetTimeoutRef);
      offsetRef.current = nextOffset;
      const restoredOffset = restoredOffsetRef.current;
      if (
        restoredOffset !== null &&
        (nextOffset > 0 || hasUserScrollRef.current) &&
        Math.abs(nextOffset - restoredOffset) > 1
      ) {
        hasUserScrollRef.current = true;
        if (isRestorePendingRef.current) {
          isRestorePendingRef.current = false;
          cancelScheduledRestore(
            restoreTimeoutsRef,
            restoreRequestRevisionRef,
          );
        }
      }
      if (!isRestorePendingRef.current) schedulePersist();
    },
    [schedulePersist],
  );

  useLayoutEffect(() => {
    let active = true;
    cancelScheduledRestore(restoreTimeoutsRef, restoreRequestRevisionRef);
    const cached = readCachedDisplaySessionState(
      storageKey,
      parseScrollPosition,
    );
    clearDeferredZeroOffset(zeroOffsetTimeoutRef);
    offsetRef.current = cached ?? 0;
    restoredOffsetRef.current = cached ?? 0;
    hasUserScrollRef.current = false;
    isRestorePendingRef.current = true;
    scheduleRestore(
      scrollRef,
      restoredOffsetRef,
      isRestorePendingRef,
      restoreRequestRevisionRef,
      restoreTimeoutsRef,
    );

    if (storageKey && cached === null) {
      void readDisplaySessionState(storageKey, parseScrollPosition).then(
        (offset) => {
          if (!active || hasUserScrollRef.current) return;
          offsetRef.current = offset ?? 0;
          restoredOffsetRef.current = offset ?? 0;
          isRestorePendingRef.current = true;
          scheduleRestore(
            scrollRef,
            restoredOffsetRef,
            isRestorePendingRef,
            restoreRequestRevisionRef,
            restoreTimeoutsRef,
          );
        },
      );
    }

    return () => {
      active = false;
      clearDeferredZeroOffset(zeroOffsetTimeoutRef);
      cancelScheduledRestore(restoreTimeoutsRef, restoreRequestRevisionRef);
      persistNow();
    };
  }, [persistNow, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    return subscribeDisplaySessionCheckpoint(persistNow);
  }, [persistNow, storageKey]);

  useLayoutEffect(() => {
    const scrollableNode = getScrollableNode(scrollRef);
    if (!scrollableNode?.addEventListener) return;

    const handleNativeScroll = () => {
      const offset = readScrollOffset(scrollRef);
      if (offset !== null) recordScrollOffset(offset);
    };
    scrollableNode.addEventListener("scroll", handleNativeScroll, {
      passive: true,
    });
    return () => {
      scrollableNode.removeEventListener?.("scroll", handleNativeScroll);
    };
  }, [recordScrollOffset, storageKey]);

  return {
    onContentSizeChange: () =>
      scheduleRestore(
        scrollRef,
        restoredOffsetRef,
        isRestorePendingRef,
        restoreRequestRevisionRef,
        restoreTimeoutsRef,
      ),
    onMomentumScrollEnd: () => {
      if (!isRestorePendingRef.current) persistNow();
    },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextOffset = Math.max(0, event.nativeEvent.contentOffset.y);
      recordScrollOffset(nextOffset);
    },
    onScrollBeginDrag: () => {
      hasUserScrollRef.current = true;
      isRestorePendingRef.current = false;
      cancelScheduledRestore(restoreTimeoutsRef, restoreRequestRevisionRef);
    },
    onScrollEndDrag: () => {
      if (!isRestorePendingRef.current) persistNow();
    },
    scrollRef,
  };
}

function cancelScheduledRestore(
  timeoutsRef: MutableRefObject<ReturnType<typeof setTimeout>[]>,
  restoreRequestRevisionRef: MutableRefObject<number>,
) {
  restoreRequestRevisionRef.current += 1;
  for (const timeout of timeoutsRef.current) clearTimeout(timeout);
  timeoutsRef.current = [];
}

function clearDeferredZeroOffset(
  timeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
) {
  if (!timeoutRef.current) return;
  clearTimeout(timeoutRef.current);
  timeoutRef.current = null;
}

function scheduleRestore(
  scrollRef: RefObject<ScrollView | null>,
  restoredOffsetRef: MutableRefObject<number | null>,
  isRestorePendingRef: MutableRefObject<boolean>,
  restoreRequestRevisionRef: MutableRefObject<number>,
  restoreTimeoutsRef: MutableRefObject<ReturnType<typeof setTimeout>[]>,
) {
  const offset = restoredOffsetRef.current;
  if (offset === null || !isRestorePendingRef.current) {
    return;
  }

  cancelScheduledRestore(restoreTimeoutsRef, restoreRequestRevisionRef);
  const requestRevision = restoreRequestRevisionRef.current;
  restoreTimeoutsRef.current = scrollRestoreRetryDelaysMs.map(
    (delay, index) =>
      setTimeout(() => {
        if (
          restoreRequestRevisionRef.current !== requestRevision ||
          !isRestorePendingRef.current
        ) {
          return;
        }
        applyScrollOffset(scrollRef, offset);
        if (
          offset === 0 ||
          index === scrollRestoreRetryDelaysMs.length - 1
        ) {
          isRestorePendingRef.current = false;
        }
      }, delay),
  );
}

function applyScrollOffset(
  scrollRef: RefObject<ScrollView | null>,
  offset: number,
) {
  const scrollView = scrollRef.current;
  scrollView?.scrollTo({ animated: false, y: offset });

  // React Native Web can replace the host node while route content settles.
  // Applying the same offset to that node makes the restoration deterministic
  // without introducing a browser-storage implementation alongside AsyncStorage.
  const scrollableNode = getScrollableNode(scrollRef);
  if (scrollableNode && scrollableNode.scrollTop !== offset) {
    scrollableNode.scrollTop = offset;
  }
}

function readScrollOffset(scrollRef: RefObject<ScrollView | null>) {
  const scrollableNode = getScrollableNode(scrollRef);
  const offset = scrollableNode?.scrollTop;
  return typeof offset === "number" && Number.isFinite(offset)
    ? Math.max(0, offset)
    : null;
}

type ScrollableNode = {
  addEventListener?: (
    type: "scroll",
    listener: () => void,
    options?: { passive?: boolean },
  ) => void;
  removeEventListener?: (type: "scroll", listener: () => void) => void;
  scrollTop?: unknown;
};

function getScrollableNode(scrollRef: RefObject<ScrollView | null>) {
  return scrollRef.current?.getScrollableNode?.() as ScrollableNode | undefined;
}
