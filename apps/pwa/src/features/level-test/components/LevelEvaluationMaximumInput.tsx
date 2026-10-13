export function LevelEvaluationMaximumInput({
  colors,
  onChangeText,
  value,
}: {
  colors: { background: string; border: string; text: string };
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <input
      aria-label="Maximum de répétitions strictes"
      inputMode="numeric"
      onChange={(event) => onChangeText(event.currentTarget.value)}
      pattern="[0-9]*"
      style={{
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        color: colors.text,
        minHeight: 44,
        padding: "8px 12px",
        width: "100%",
      }}
      type="text"
      value={value}
    />
  );
}
