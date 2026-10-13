import { useEffect, useMemo, useState } from "react";

import { ActionButton, Badge, Card, CardHeader } from "@shared/ui";

import {
  catalogReviewBatchSignature,
  errorMessageFromUnknown,
  isCatalogReviewBatchArmed,
} from "../domain/adminCatalogExercise";
import { reviewCatalogReleaseExercises } from "../services/catalogRemote";
import type { CatalogExercise } from "../types";
import { AdminCatalogToolbar } from "./AdminCatalogUi";

type ReviewInput = {
  programmingStatus: "library_only" | "eligible";
  reviewStatus: "a_verifier" | "valide";
  translationStatus: "translated" | "validated";
};

export function AdminCatalogReviewBatchCard({
  exercises,
  isBusy,
  onBusyChange,
  onMessage,
  onReviewed,
}: {
  exercises: CatalogExercise[];
  isBusy: boolean;
  onBusyChange: (isBusy: boolean) => void;
  onMessage: (message: string) => void;
  onReviewed: () => Promise<void>;
}) {
  const [armedSignature, setArmedSignature] = useState<string | null>(null);
  const preparedExercises = useMemo(
    () =>
      exercises.filter(
        (exercise) =>
          exercise.releaseStatus === "prepared" &&
          exercise.slug.trim().length > 0,
      ),
    [exercises],
  );
  const releaseCodes = useMemo(
    () => new Set(preparedExercises.map((exercise) => exercise.releaseCode)),
    [preparedExercises],
  );
  const batchSignature = useMemo(
    () => catalogReviewBatchSignature(preparedExercises),
    [preparedExercises],
  );
  const isArmed = isCatalogReviewBatchArmed(
    armedSignature,
    batchSignature,
  );

  useEffect(() => {
    setArmedSignature((currentSignature) =>
      currentSignature !== null && currentSignature !== batchSignature
        ? null
        : currentSignature,
    );
  }, [batchSignature]);

  if (preparedExercises.length === 0) {
    return null;
  }

  async function reviewBatch(input: ReviewInput) {
    const releaseCode = [...releaseCodes][0];
    if (
      !releaseCode ||
      releaseCodes.size !== 1 ||
      !isArmed ||
      armedSignature !== batchSignature
    ) {
      onMessage(
        "Choisis un lot filtré appartenant à une seule release préparée.",
      );
      return;
    }

    onBusyChange(true);
    onMessage("");
    try {
      const updated = await reviewCatalogReleaseExercises({
        releaseCode,
        exerciseSlugs: preparedExercises.map((exercise) => exercise.slug),
        ...input,
      });
      await onReviewed();
      setArmedSignature(null);
      onMessage(
        `${updated} fiche(s) mises à jour. L’activation reste soumise à tous les contrôles.`,
      );
    } catch (error) {
      onMessage(errorMessageFromUnknown(error));
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Validation éditoriale du lot filtré"
        description={`${preparedExercises.length} fiche(s) de release préparée. Les actions ne créent aucune prescription et n’activent pas le catalogue.`}
        action={
          <Badge variant="warning">
            {releaseCodes.size === 1
              ? [...releaseCodes][0]
              : "Plusieurs releases"}
          </Badge>
        }
      />
      <AdminCatalogToolbar>
        {!isArmed ? (
          <ActionButton
            disabled={isBusy || releaseCodes.size !== 1}
            onPress={() => setArmedSignature(batchSignature)}
            variant="secondary"
          >
            Préparer ce lot
          </ActionButton>
        ) : (
          <>
            <ActionButton
              disabled={isBusy}
              onPress={() =>
                void reviewBatch({
                  reviewStatus: "a_verifier",
                  translationStatus: "translated",
                  programmingStatus: "library_only",
                })
              }
              variant="secondary"
            >
              Marquer traduit
            </ActionButton>
            <ActionButton
              disabled={isBusy}
              onPress={() =>
                void reviewBatch({
                  reviewStatus: "valide",
                  translationStatus: "validated",
                  programmingStatus: "library_only",
                })
              }
              variant="secondary"
            >
              Valider en bibliothèque
            </ActionButton>
            <ActionButton
              disabled={isBusy}
              onPress={() =>
                void reviewBatch({
                  reviewStatus: "valide",
                  translationStatus: "validated",
                  programmingStatus: "eligible",
                })
              }
              variant="secondary"
            >
              Valider et rendre éligible
            </ActionButton>
            <ActionButton
              disabled={isBusy}
              onPress={() => setArmedSignature(null)}
              variant="secondary"
            >
              Annuler
            </ActionButton>
          </>
        )}
      </AdminCatalogToolbar>
    </Card>
  );
}
