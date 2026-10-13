import { Platform, Share } from "react-native";

import { exportLocalCatalogSeedSnapshot } from "./catalogRepository";

export async function exportLocalCatalogSeedSnapshotFile() {
  const seed = await exportLocalCatalogSeedSnapshot();
  const json = `${JSON.stringify(seed, null, 2)}\n`;
  const filename = `acrea-fitness-catalogSeed-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  if (Platform.OS === "web" && typeof document !== "undefined") {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    return filename;
  }

  await Share.share({
    message: json,
    title: filename,
  });

  return filename;
}
