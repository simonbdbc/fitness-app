import { useLocalSearchParams } from "expo-router";

import { AdminCatalogScreen } from "@features/catalog";

export default function AdminCatalogExercisesRoute() {
  const { exerciseId } = useLocalSearchParams<{
    exerciseId?: string | string[];
  }>();
  const initialExerciseId = Array.isArray(exerciseId)
    ? exerciseId[0]
    : exerciseId;

  return <AdminCatalogScreen initialExerciseId={initialExerciseId} />;
}
