import { View } from "react-native";

import { useAuth } from "@features/auth";
import { BodyText, TitleText } from "@shared/ui";

import { ErrorState, LoadingState } from "../components/CatalogLibrary";
import { CatalogLibraryContent } from "../components/CatalogLibraryContent";
import { useCatalogLibraryScreen } from "../hooks/useCatalogLibraryScreen";

export function CatalogScreen() {
  const { user } = useAuth();
  const library = useCatalogLibraryScreen(user?.id);

  return (
    <View className="w-full max-w-full min-w-0 gap-4">
      <View className="gap-2">
        <TitleText>Bibliothèque</TitleText>
        <BodyText>
          Tous les exercices disponibles, organisés par pilier ACREA puis par
          famille.
        </BodyText>
      </View>

      {library.isLoading ? (
        <LoadingState />
      ) : library.status === "error" ? (
        <ErrorState message={library.errorMessage} onRetry={library.reload} />
      ) : (
        <CatalogLibraryContent library={library} />
      )}
    </View>
  );
}
