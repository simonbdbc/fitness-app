import { Path, Svg } from "react-native-svg";

const iconPaths = {
  close: ["M6 6 18 18", "M18 6 6 18"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
} as const;

export type IconName = keyof typeof iconPaths;

type IconProps = {
  color: string;
  name: IconName;
  size?: number;
  strokeWidth?: number;
};

export function Icon({
  color,
  name,
  size = 24,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      aria-hidden
      fill="none"
      focusable={false}
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name].map((path) => (
        <Path
          d={path}
          key={path}
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      ))}
    </Svg>
  );
}
