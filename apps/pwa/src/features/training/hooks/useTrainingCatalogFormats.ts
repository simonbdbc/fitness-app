import { useCallback, useEffect, useState } from "react";

import {
  listCatalogFormats,
  resolveTrainingCatalogTimerFormat,
  type CatalogFormat,
  type TrainingCatalogFormatReference,
  type TrainingCatalogTimerFormat,
} from "@features/catalog";

export type ResolveTrainingCatalogFormat = (
  reference: TrainingCatalogFormatReference,
) => TrainingCatalogTimerFormat | null;

export function useTrainingCatalogFormats() {
  const [formats, setFormats] = useState<CatalogFormat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    void listCatalogFormats()
      .then((nextFormats) => {
        if (active) setFormats(nextFormats);
      })
      .catch((unknownError: unknown) => {
        if (active) setError(errorMessageFromUnknown(unknownError));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const resolveFormat = useCallback<ResolveTrainingCatalogFormat>(
    (reference) => resolveTrainingCatalogTimerFormat(formats, reference),
    [formats],
  );

  return { error, isLoading, resolveFormat };
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Formats du catalogue indisponibles.";
}
