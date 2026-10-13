import type { ReactNode } from "react";
import { View } from "react-native";
import { Badge } from "@shared/ui/Badge";
import { ActionButton } from "@shared/ui/Button";
import { BodyText } from "@shared/ui/Typography";

export function OptionGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <View className="gap-2">
      <BodyText>{label}</BodyText>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

export function Stepper({
  initialValue,
  label,
  maximum,
  minimum,
  onChange,
  step = 1,
  value,
}: {
  initialValue: number;
  label: string;
  maximum: number;
  minimum: number;
  onChange: (value: number) => void;
  step?: number;
  value: number | null;
}) {
  return (
    <View className="min-w-[180px] flex-1 gap-2">
      <BodyText>{label}</BodyText>
      <View className="flex-row items-center gap-2">
        {value === null ? (
          <>
            <Badge>À renseigner</Badge>
            <ActionButton onPress={() => onChange(initialValue)}>
              Définir
            </ActionButton>
          </>
        ) : (
          <>
            <ActionButton
              disabled={value <= minimum}
              onPress={() => onChange(Math.max(minimum, value - step))}
            >
              -
            </ActionButton>
            <Badge>{value}</Badge>
            <ActionButton
              disabled={value >= maximum}
              onPress={() => onChange(Math.min(maximum, value + step))}
            >
              +
            </ActionButton>
          </>
        )}
      </View>
    </View>
  );
}
