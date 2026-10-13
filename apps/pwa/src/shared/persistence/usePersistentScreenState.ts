import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { subscribeDisplaySessionCheckpoint } from "./displaySessionLifecycle";
import {
  readCachedDisplaySessionState,
  readDisplaySessionState,
  removeDisplaySessionState,
  writeDisplaySessionState,
} from "./displaySessionPersistence";

type PersistentScreenStateOptions<TValue> = {
  initialValue: TValue;
  parse: (value: unknown) => TValue | null;
  storageKey: string | null;
};

export function usePersistentScreenState<TValue>({
  initialValue,
  parse,
  storageKey,
}: PersistentScreenStateOptions<TValue>) {
  const cachedInitialValue = readCachedDisplaySessionState(storageKey, parse);
  const [value, setValue] = useState<TValue>(cachedInitialValue ?? initialValue);
  const [restoredKey, setRestoredKey] = useState<string | null>(
    cachedInitialValue === null ? null : storageKey,
  );
  const initialValueRef = useRef(initialValue);
  const parseRef = useRef(parse);
  const valueRef = useRef(value);
  initialValueRef.current = initialValue;
  parseRef.current = parse;
  valueRef.current = value;
  const isRestoring = storageKey !== null && restoredKey !== storageKey;

  useEffect(() => {
    let active = true;
    const cached = readCachedDisplaySessionState(storageKey, parseRef.current);
    setValue(cached ?? initialValueRef.current);

    if (!storageKey) {
      setRestoredKey(null);
      return () => {
        active = false;
      };
    }

    if (cached !== null) setRestoredKey(storageKey);
    else setRestoredKey(null);

    void readDisplaySessionState(storageKey, parseRef.current).then(
      (restored) => {
        if (!active) return;
        if (restored !== null) setValue(restored);
        setRestoredKey(storageKey);
      },
    );

    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || restoredKey !== storageKey) return;
    void writeDisplaySessionState(storageKey, value);
  }, [restoredKey, storageKey, value]);

  useEffect(
    () => () => {
      if (storageKey && restoredKey === storageKey) {
        void writeDisplaySessionState(storageKey, valueRef.current);
      }
    },
    [restoredKey, storageKey],
  );

  useEffect(() => {
    if (!storageKey || restoredKey !== storageKey) return;
    const persistCurrentValue = () =>
      void writeDisplaySessionState(storageKey, valueRef.current);
    return subscribeDisplaySessionCheckpoint(persistCurrentValue);
  }, [restoredKey, storageKey]);

  return {
    clear: () => removeDisplaySessionState(storageKey),
    isRestoring,
    setValue: setValue as Dispatch<SetStateAction<TValue>>,
    value,
  };
}
