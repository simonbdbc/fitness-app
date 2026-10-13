export type ThemeFamily = "pulse" | "neon";
export type ThemeMode = "light" | "dark";
export type ThemeName =
    | "pulse-light"
    | "pulse-dark"
    | "neon-light"
    | "neon-dark";

export const defaultThemeName: ThemeName = "pulse-dark";

export type ThemeTokens = {
    family: ThemeFamily;
    mode: ThemeMode;
    name: ThemeName;
    colors: {
        background: string;
        surface: string;
        surfaceElevated: string;
        surfaceMuted: string;
        border: string;
        borderSoft: string;
        textPrimary: string;
        textSecondary: string;
        textMuted: string;
        accent: string;
        accentSoft: string;
        actionBackground: string;
        actionText: string;
        inputBackground: string;
        overlay: string;
        shadow: string;
        transparent: string;
        dangerText: string;
        dangerSurface: string;
        successText: string;
        successSurface: string;
        infoText: string;
        infoSurface: string;
        warningText: string;
        warningSurface: string;
    };
};

type ModeColors = Omit<
    ThemeTokens["colors"],
    "accent" | "accentSoft" | "actionBackground" | "actionText"
>;

const lightModeColors: ModeColors = {
    background: "#f3f7f6",
    surface: "#ffffff",
    surfaceElevated: "#ffffff",
    surfaceMuted: "#e8f1ef",
    border: "#cfe0dc",
    borderSoft: "#deebe8",
    textPrimary: "#0d1b1d",
    textSecondary: "#38504e",
    textMuted: "#687a77",
    inputBackground: "#ffffff",
    overlay: "rgba(13, 27, 29, 0.42)",
    shadow: "rgba(0, 77, 63, 0.16)",
    transparent: "transparent",
    dangerText: "#b4232f",
    dangerSurface: "#ffe3e8",
    successText: "#087547",
    successSurface: "#dcfce7",
    infoText: "#49606a",
    infoSurface: "#eef3f4",
    warningText: "#8a5200",
    warningSurface: "#fff0c2",
};

const darkModeColors: ModeColors = {
    background: "#090d10",
    surface: "#111820",
    surfaceElevated: "#18212a",
    surfaceMuted: "#1f2a33",
    border: "#30404a",
    borderSoft: "#24313a",
    textPrimary: "#f4f8fb",
    textSecondary: "#c5d3dc",
    textMuted: "#8fa2ad",
    inputBackground: "#0e151a",
    overlay: "rgba(0, 0, 0, 0.68)",
    shadow: "rgba(0, 0, 0, 0.5)",
    transparent: "transparent",
    dangerText: "#ff8aa0",
    dangerSurface: "#3b1821",
    successText: "#8dffb3",
    successSurface: "#123423",
    infoText: "#a6bcc4",
    infoSurface: "#17252a",
    warningText: "#ffcf65",
    warningSurface: "#332713",
};

export const themeTokensByName: Record<ThemeName, ThemeTokens> = {
    "pulse-light": {
        family: "pulse",
        mode: "light",
        name: "pulse-light",
        colors: {
            ...lightModeColors,
            accent: "#007f5f",
            accentSoft: "#d9f8ed",
            actionBackground: "#007f5f",
            actionText: "#ffffff",
        },
    },
    "pulse-dark": {
        family: "pulse",
        mode: "dark",
        name: "pulse-dark",
        colors: {
            ...darkModeColors,
            accent: "#2ee68d",
            accentSoft: "#12382a",
            actionBackground: "#2ee68d",
            actionText: "#07100a",
        },
    },
    "neon-light": {
        family: "neon",
        mode: "light",
        name: "neon-light",
        colors: {
            ...lightModeColors,
            background: "#f8faf2",
            surfaceMuted: "#eef4df",
            border: "#dfe9ca",
            borderSoft: "#edf4dc",
            textPrimary: "#11160d",
            textSecondary: "#3f4a33",
            textMuted: "#68745a",
            overlay: "rgba(17, 22, 13, 0.42)",
            shadow: "rgba(65, 80, 0, 0.16)",
            infoText: "#56634f",
            infoSurface: "#edf4e2",
            warningText: "#a24b00",
            warningSurface: "#fff0d0",
            accent: "#6f6000",
            accentSoft: "#f2ffd4",
            actionBackground: "#d7ff36",
            actionText: "#07100a",
        },
    },
    "neon-dark": {
        family: "neon",
        mode: "dark",
        name: "neon-dark",
        colors: {
            ...darkModeColors,
            background: "#070d0f",
            surface: "#101a1e",
            surfaceElevated: "#172327",
            surfaceMuted: "#1e2d31",
            border: "#31464c",
            borderSoft: "#24363b",
            textPrimary: "#f3fbf7",
            textSecondary: "#c4d9d1",
            textMuted: "#8fa69e",
            shadow: "rgba(0, 0, 0, 0.56)",
            successText: "#8bdba6",
            successSurface: "#143021",
            infoText: "#a4b7b0",
            infoSurface: "#172521",
            warningText: "#ff9a3d",
            warningSurface: "#3a2412",
            accent: "#d7ff36",
            accentSoft: "#283a10",
            actionBackground: "#d7ff36",
            actionText: "#07100a",
        },
    },
};
