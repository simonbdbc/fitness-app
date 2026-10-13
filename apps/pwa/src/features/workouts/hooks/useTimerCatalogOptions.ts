import { useCallback, useEffect, useRef, useState } from "react";

import {
  listCatalogTimerOptions,
  type CatalogTimerOptions,
} from "@features/catalog";
import { useTimerScreenFocusEffect } from "./useTimerScreenFocusEffect";
import {
  readTimerScreenPreferences,
  writeTimerScreenPreferences,
  type TimerScreenPreferences,
} from "../services/timerScreenPreferences";

const preferredCodes = {
  series: "series-03",
  repetitions: "reps-10",
  interval: "interval-60s",
  rest: "rest-60s",
} as const;

export function useTimerCatalogOptions(userId: string | null | undefined) {
  const [options, setOptions] = useState<CatalogTimerOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [formatType, setFormatType] =
    useState<TimerScreenPreferences["formatType"]>("repetitions");
  const [seriesId, setSeriesId] = useState<number | null>(null);
  const [repetitionId, setRepetitionId] = useState<number | null>(null);
  const [intervalId, setIntervalId] = useState<number | null>(null);
  const [restId, setRestId] = useState<number | null>(null);
  const restoredUserIdRef = useRef<string | null | undefined>(undefined);

  useTimerScreenFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadError(null);
      const shouldRestorePreferences = restoredUserIdRef.current !== userId;

      void Promise.all([
        listCatalogTimerOptions(),
        shouldRestorePreferences
          ? readTimerScreenPreferences(userId)
          : Promise.resolve(null),
      ])
        .then(([catalogOptions, preferences]) => {
          if (!active) return;

          setOptions(catalogOptions);
          if (shouldRestorePreferences) {
            setFormatType(preferences?.formatType ?? "repetitions");
            setSeriesId(
              restoredOptionId(
                catalogOptions.series,
                preferences?.seriesCode,
                preferredCodes.series,
              ),
            );
            setRepetitionId(
              restoredOptionId(
                catalogOptions.repetitions,
                preferences?.repetitionCode,
                preferredCodes.repetitions,
              ),
            );
            setIntervalId(
              restoredOptionId(
                catalogOptions.intervals,
                preferences?.intervalCode,
                preferredCodes.interval,
              ),
            );
            setRestId(
              restoredOptionId(
                catalogOptions.rests,
                preferences?.restCode,
                preferredCodes.rest,
              ),
            );
            restoredUserIdRef.current = userId;
            return;
          }

          setSeriesId((currentId) =>
            refreshedOptionId(
              catalogOptions.series,
              currentId,
              preferredCodes.series,
            ),
          );
          setRepetitionId((currentId) =>
            refreshedOptionId(
              catalogOptions.repetitions,
              currentId,
              preferredCodes.repetitions,
            ),
          );
          setIntervalId((currentId) =>
            refreshedOptionId(
              catalogOptions.intervals,
              currentId,
              preferredCodes.interval,
            ),
          );
          setRestId((currentId) =>
            refreshedOptionId(
              catalogOptions.rests,
              currentId,
              preferredCodes.rest,
            ),
          );
        })
        .catch((error) => {
          if (active) setLoadError(errorMessageFromUnknown(error));
        });

      return () => {
        active = false;
      };
    }, [reloadToken, userId]),
  );

  useEffect(() => {
    if (
      !options ||
      !userId ||
      restoredUserIdRef.current !== userId
    ) {
      return;
    }

    void writeTimerScreenPreferences(userId, {
      formatType,
      intervalCode: optionCode(options.intervals, intervalId),
      repetitionCode: optionCode(options.repetitions, repetitionId),
      restCode: optionCode(options.rests, restId),
      seriesCode: optionCode(options.series, seriesId),
    });
  }, [
    formatType,
    intervalId,
    options,
    repetitionId,
    restId,
    seriesId,
    userId,
  ]);

  const optionsForCurrentUser =
    restoredUserIdRef.current === userId ? options : null;

  return {
    formatType,
    intervalId,
    loadError,
    options: optionsForCurrentUser,
    reload: () => setReloadToken((token) => token + 1),
    repetitionId,
    restId,
    seriesId,
    setIntervalId,
    setFormatType,
    setRepetitionId,
    setRestId,
    setSeriesId,
  };
}

function restoredOptionId(
  options: Array<{ id: number; code: string }>,
  storedCode: string | null | undefined,
  preferredCode: string,
) {
  return (
    options.find((option) => option.code === storedCode)?.id ??
    preferredOptionId(options, preferredCode)
  );
}

function refreshedOptionId(
  options: Array<{ id: number; code: string }>,
  currentId: number | null,
  preferredCode: string,
) {
  return options.some((option) => option.id === currentId)
    ? currentId
    : preferredOptionId(options, preferredCode);
}

function preferredOptionId(
  options: Array<{ id: number; code: string }>,
  preferredCode: string,
) {
  return options.find((option) => option.code === preferredCode)?.id ??
    options[0]?.id ??
    null;
}

function optionCode(
  options: Array<{ id: number; code: string }>,
  selectedId: number | null,
) {
  return options.find((option) => option.id === selectedId)?.code ?? null;
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Lecture du catalogue impossible.";
}
