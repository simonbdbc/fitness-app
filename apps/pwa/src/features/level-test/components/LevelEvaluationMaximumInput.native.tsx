import { TextInput } from "react-native";

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
    <TextInput
      accessibilityLabel="Maximum de répétitions strictes"
      keyboardType="numeric"
      onChangeText={onChangeText}
      style={{
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
      value={value}
    />
  );
}
