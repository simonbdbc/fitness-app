import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from "expo-keep-awake";
import { useEffect, useId, useRef } from "react";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";

export function useScreenWakeLock(active: boolean) {
  const instanceId = useId();
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const tag = `acrea-session-timer-${instanceId}`;

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    operationQueueRef.current = operationQueueRef.current
      .then(() => activateKeepAwakeAsync(tag))
      .catch((error: unknown) => {
        reportTechnicalDegradationOnce("screen-wake-lock-activate", error);
      });

    return () => {
      operationQueueRef.current = operationQueueRef.current
        .then(() => deactivateKeepAwake(tag))
        .catch((error: unknown) => {
          reportTechnicalDegradationOnce("screen-wake-lock-deactivate", error);
        });
    };
  }, [active, tag]);
}
