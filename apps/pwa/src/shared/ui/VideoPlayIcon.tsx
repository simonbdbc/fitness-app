import { Path, Svg } from "react-native-svg";

type VideoPlayIconProps = {
  color: string;
};

/** Filled video-player play icon, matching public/icons/video-play.svg. */
export function VideoPlayIcon({ color }: VideoPlayIconProps) {
  return (
    <Svg
      aria-hidden
      fill="none"
      focusable={false}
      height="100%"
      viewBox="0 0 24 24"
      width="100%"
    >
      <Path
        d="M7.75 5.29a1 1 0 0 1 1.53-.85l10.05 6.71a1.02 1.02 0 0 1 0 1.7L9.28 19.56a1 1 0 0 1-1.53-.85V5.29Z"
        fill={color}
      />
    </Svg>
  );
}
