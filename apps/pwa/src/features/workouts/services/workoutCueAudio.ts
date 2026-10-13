import {
    createAudioPlayer,
    preload,
    setAudioModeAsync,
    type AudioPlayer,
    type AudioSource,
} from "expo-audio";
import { Asset } from "expo-asset";
import { Platform } from "react-native";

import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";

import countdownTickSource from "../../../../assets/audio/workout-cues/countdown_tick.mp3";
import exerciseStartSource from "../../../../assets/audio/workout-cues/exercise_start.mp3";
import restStartSource from "../../../../assets/audio/workout-cues/rest_start.mp3";
import sessionCompleteSource from "../../../../assets/audio/workout-cues/session_complete.mp3";
import voiceCountdown1Source from "../../../../assets/audio/workout-voices/fr-FR/default/countdown_1.wav";
import voiceCountdown2Source from "../../../../assets/audio/workout-voices/fr-FR/default/countdown_2.wav";
import voiceCountdown3Source from "../../../../assets/audio/workout-voices/fr-FR/default/countdown_3.wav";
import voiceExerciseStartSource from "../../../../assets/audio/workout-voices/fr-FR/default/exercise_start.wav";
import voiceWarmUpStartSource from "../../../../assets/audio/workout-voices/fr-FR/default/warm_up_start.wav";
import voiceColdDownStartSource from "../../../../assets/audio/workout-voices/fr-FR/default/cold_dowm_start.wav";
import voiceLetsGoSource from "../../../../assets/audio/workout-voices/fr-FR/default/letsGo.wav";
import voiceRestStartSource from "../../../../assets/audio/workout-voices/fr-FR/default/rest_start.wav";
import voiceSeries1Source from "../../../../assets/audio/workout-voices/fr-FR/default/series1.wav";
import voiceSeries2Source from "../../../../assets/audio/workout-voices/fr-FR/default/series2.wav";
import voiceSeries3Source from "../../../../assets/audio/workout-voices/fr-FR/default/series3.wav";
import voiceSeries4Source from "../../../../assets/audio/workout-voices/fr-FR/default/series4.wav";
import voiceSeries5Source from "../../../../assets/audio/workout-voices/fr-FR/default/series5.wav";
import voiceSeries6Source from "../../../../assets/audio/workout-voices/fr-FR/default/series6.wav";
import voiceSeries7Source from "../../../../assets/audio/workout-voices/fr-FR/default/series7.wav";
import voiceSeries8Source from "../../../../assets/audio/workout-voices/fr-FR/default/series8.wav";
import voiceSeries9Source from "../../../../assets/audio/workout-voices/fr-FR/default/series9.wav";
import voiceSeries10Source from "../../../../assets/audio/workout-voices/fr-FR/default/series10.wav";
import voiceSeries11Source from "../../../../assets/audio/workout-voices/fr-FR/default/series11.wav";
import voiceSeries12Source from "../../../../assets/audio/workout-voices/fr-FR/default/series12.wav";
import voiceSessionCompleteSource from "../../../../assets/audio/workout-voices/fr-FR/default/session_complete.wav";

export type WorkoutAudioMode = "sound" | "voice" | "silent";
export type WorkoutAudioCue =
    | "countdown1"
    | "countdown2"
    | "countdown3"
    | "exerciseStart"
    | "warmUpStart"
    | "coldDownStart"
    | "letsGo"
    | "restStart"
    | "series1"
    | "series2"
    | "series3"
    | "series4"
    | "series5"
    | "series6"
    | "series7"
    | "series8"
    | "series9"
    | "series10"
    | "series11"
    | "series12"
    | "sessionComplete";

type PlayableWorkoutAudioMode = Exclude<WorkoutAudioMode, "silent">;
type CuePlayerKey = `${PlayableWorkoutAudioMode}:${WorkoutAudioCue}`;

const cueSourcesByMode: Record<
    PlayableWorkoutAudioMode,
    Record<WorkoutAudioCue, number>
> = {
    sound: {
        countdown1: countdownTickSource,
        countdown2: countdownTickSource,
        countdown3: countdownTickSource,
        exerciseStart: exerciseStartSource,
        warmUpStart: exerciseStartSource,
        coldDownStart: exerciseStartSource,
        letsGo: exerciseStartSource,
        restStart: restStartSource,
        series1: exerciseStartSource,
        series2: exerciseStartSource,
        series3: exerciseStartSource,
        series4: exerciseStartSource,
        series5: exerciseStartSource,
        series6: exerciseStartSource,
        series7: exerciseStartSource,
        series8: exerciseStartSource,
        series9: exerciseStartSource,
        series10: exerciseStartSource,
        series11: exerciseStartSource,
        series12: exerciseStartSource,
        sessionComplete: sessionCompleteSource,
    },
    voice: {
        countdown1: voiceCountdown1Source,
        countdown2: voiceCountdown2Source,
        countdown3: voiceCountdown3Source,
        exerciseStart: voiceExerciseStartSource,
        warmUpStart: voiceWarmUpStartSource,
        coldDownStart: voiceColdDownStartSource,
        letsGo: voiceLetsGoSource,
        restStart: voiceRestStartSource,
        series1: voiceSeries1Source,
        series2: voiceSeries2Source,
        series3: voiceSeries3Source,
        series4: voiceSeries4Source,
        series5: voiceSeries5Source,
        series6: voiceSeries6Source,
        series7: voiceSeries7Source,
        series8: voiceSeries8Source,
        series9: voiceSeries9Source,
        series10: voiceSeries10Source,
        series11: voiceSeries11Source,
        series12: voiceSeries12Source,
        sessionComplete: voiceSessionCompleteSource,
    },
};

const cuePlayers = new Map<CuePlayerKey, AudioPlayer>();
const webCueElements = new Map<CuePlayerKey, HTMLAudioElement>();
const preloadPromises = new Map<PlayableWorkoutAudioMode, Promise<void>>();
let audioModePromise: Promise<void> | null = null;

export function preloadWorkoutCueAudio(mode: WorkoutAudioMode) {
    if (mode === "silent") {
        return Promise.resolve();
    }

    let preloadPromise = preloadPromises.get(mode);

    if (!preloadPromise) {
        preloadPromise =
            Platform.OS === "web"
                ? preloadWebCueAudio(mode)
                : Promise.all(getUniqueCueSources(mode).map(preloadCueSource))
                      .then(() => undefined)
                      .catch((error: unknown) => {
                          reportTechnicalDegradationOnce(
                              `workout-audio-preload-${mode}`,
                              error,
                          );
                      });
        preloadPromises.set(mode, preloadPromise);
    }

    return preloadPromise;
}

export function playWorkoutCueAudio(
    cue: WorkoutAudioCue,
    mode: WorkoutAudioMode,
) {
    if (mode === "silent") {
        return;
    }

    void playWorkoutCueAudioAsync(cue, mode);
}

export async function playWorkoutCueAudioAndWait(
    cue: WorkoutAudioCue,
    mode: WorkoutAudioMode,
) {
    if (mode === "silent") {
        return;
    }

    await playWorkoutCueAudioAsync(cue, mode, { waitForEnd: true });
}

async function playWorkoutCueAudioAsync(
    cue: WorkoutAudioCue,
    mode: PlayableWorkoutAudioMode,
    options: { waitForEnd?: boolean } = {},
) {
    try {
        if (Platform.OS === "web") {
            await playWebCueAudio(cue, mode, options);
            return;
        }

        await ensureAudioMode();
        void preloadWorkoutCueAudio(mode);

        const player = getCuePlayer(cue, mode);

        try {
            await player.seekTo(0);
        } catch (error) {
            reportTechnicalDegradationOnce("workout-audio-seek", error, {
                cue,
                mode,
            });
        }

        const playbackEnded = options.waitForEnd
            ? waitForNativePlayerEnd(player, cue, mode)
            : null;

        player.play();

        if (playbackEnded) {
            await playbackEnded;
        }
    } catch (error) {
        reportTechnicalDegradationOnce("workout-audio-playback", error, {
            cue,
            mode,
        });
    }
}

function getCuePlayer(cue: WorkoutAudioCue, mode: PlayableWorkoutAudioMode) {
    const key = getCueKey(cue, mode);
    const existingPlayer = cuePlayers.get(key);

    if (existingPlayer) {
        return existingPlayer;
    }

    const player = createAudioPlayer(cueSourcesByMode[mode][cue], {
        downloadFirst: true,
        keepAudioSessionActive: true,
        updateInterval: 1000,
    });

    player.volume = 1;
    cuePlayers.set(key, player);

    return player;
}

function preloadCueSource(source: AudioSource) {
    try {
        const preloadResult = preload(source, {
            preferredForwardBufferDuration: 1,
        }) as Promise<void> | void;

        return Promise.resolve(preloadResult).then(
            () => undefined,
            (error: unknown) => {
                reportTechnicalDegradationOnce(
                    "workout-audio-source-preload",
                    error,
                );
            },
        );
    } catch (error) {
        reportTechnicalDegradationOnce("workout-audio-source-preload", error);
        return Promise.resolve();
    }
}

function preloadWebCueAudio(mode: PlayableWorkoutAudioMode) {
    Object.keys(cueSourcesByMode[mode]).forEach((cue) => {
        const element = getWebCueElement(cue as WorkoutAudioCue, mode);

        if (element) {
            element.preload = "auto";
            element.load();
        }
    });

    return Promise.resolve();
}

async function playWebCueAudio(
    cue: WorkoutAudioCue,
    mode: PlayableWorkoutAudioMode,
    options: { waitForEnd?: boolean } = {},
) {
    try {
        void preloadWorkoutCueAudio(mode);

        const element = getWebCueElement(cue, mode);

        if (!element) {
            return;
        }

        element.pause();
        element.currentTime = 0;

        if (options.waitForEnd) {
            await playWebCueAudioAndWait(element, cue, mode);
            return;
        }

        const playResult = element.play();

        if (playResult) {
            void playResult.catch((error: unknown) => {
                reportTechnicalDegradationOnce(
                    "workout-audio-web-playback",
                    error,
                    {
                        cue,
                        mode,
                    },
                );
            });
        }
    } catch (error) {
        reportTechnicalDegradationOnce("workout-audio-web-playback", error, {
            cue,
            mode,
        });
    }
}

function playWebCueAudioAndWait(
    element: HTMLAudioElement,
    cue: WorkoutAudioCue,
    mode: PlayableWorkoutAudioMode,
) {
    return new Promise<void>((resolve) => {
        let didResolve = false;
        const timeoutId = setTimeout(
            resolvePlayback,
            getCuePlaybackFallbackMs(cue, mode, element.duration),
        );

        function resolvePlayback() {
            if (didResolve) {
                return;
            }

            didResolve = true;
            element.removeEventListener("ended", resolvePlayback);
            element.removeEventListener("error", resolvePlayback);
            clearTimeout(timeoutId);
            resolve();
        }

        element.addEventListener("ended", resolvePlayback, { once: true });
        element.addEventListener("error", resolvePlayback, { once: true });

        const playResult = element.play();

        if (playResult) {
            void playResult.catch((error: unknown) => {
                reportTechnicalDegradationOnce(
                    "workout-audio-web-playback",
                    error,
                    {
                        cue,
                        mode,
                    },
                );
                resolvePlayback();
            });
        }
    });
}

function waitForNativePlayerEnd(
    player: AudioPlayer,
    cue: WorkoutAudioCue,
    mode: PlayableWorkoutAudioMode,
) {
    return new Promise<void>((resolve) => {
        let didResolve = false;
        const subscription = player.addListener(
            "playbackStatusUpdate",
            (status) => {
                if (status.didJustFinish) {
                    resolvePlayback();
                }
            },
        );
        const timeoutId = setTimeout(
            resolvePlayback,
            getCuePlaybackFallbackMs(cue, mode, player.duration),
        );

        function resolvePlayback() {
            if (didResolve) {
                return;
            }

            didResolve = true;
            subscription.remove();
            clearTimeout(timeoutId);
            resolve();
        }
    });
}

function getWebCueElement(
    cue: WorkoutAudioCue,
    mode: PlayableWorkoutAudioMode,
) {
    if (typeof Audio === "undefined") {
        return null;
    }

    const key = getCueKey(cue, mode);
    const existingElement = webCueElements.get(key);

    if (existingElement) {
        return existingElement;
    }

    const sourceUri = getCueAssetUri(cue, mode);

    if (!sourceUri) {
        return null;
    }

    const element = new Audio(sourceUri);
    element.volume = 1;
    webCueElements.set(key, element);

    return element;
}

function getCueAssetUri(cue: WorkoutAudioCue, mode: PlayableWorkoutAudioMode) {
    return Asset.fromModule(cueSourcesByMode[mode][cue]).uri;
}

function getCueKey(
    cue: WorkoutAudioCue,
    mode: PlayableWorkoutAudioMode,
): CuePlayerKey {
    return `${mode}:${cue}`;
}

function getUniqueCueSources(mode: PlayableWorkoutAudioMode) {
    return Array.from(new Set(Object.values(cueSourcesByMode[mode])));
}

function getCuePlaybackFallbackMs(
    cue: WorkoutAudioCue,
    mode: PlayableWorkoutAudioMode,
    durationSeconds: number,
) {
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return Math.ceil(durationSeconds * 1000) + 300;
    }

    if (mode === "voice" && cue === "exerciseStart") {
        return 3000;
    }

    return 2000;
}

function ensureAudioMode() {
    if (!audioModePromise) {
        audioModePromise = setAudioModeAsync({
            allowsRecording: false,
            interruptionMode: "mixWithOthers",
            playsInSilentMode: true,
            shouldPlayInBackground: false,
            shouldRouteThroughEarpiece: false,
        }).catch((error: unknown) => {
            audioModePromise = null;
            reportTechnicalDegradationOnce("workout-audio-mode", error);
        });
    }

    return audioModePromise;
}
