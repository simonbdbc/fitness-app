import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import type { TextInputProps } from "react-native";
import { useThemeTokens } from "@shared/theme";
import {
  ActionButton,
  Badge,
  BodyText,
  Card,
  CardHeader,
  StatTile,
  SubtleText,
  TitleText,
} from "@shared/ui";

type AdminCatalogMessageVariant = "info" | "danger";

export function AdminCatalogPage({ children }: { children: ReactNode }) {
  return <View className="w-full max-w-full min-w-0 gap-4">{children}</View>;
}

export function AdminCatalogHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <View className="w-full max-w-full min-w-0 flex-row flex-wrap items-start justify-between gap-3">
      <View className="min-w-0 flex-1 gap-1">
        <TitleText>{title}</TitleText>
        <BodyText>{description}</BodyText>
      </View>
      {action}
    </View>
  );
}

export function AdminCatalogLoadingState({
  label = "Chargement du catalogue...",
}: {
  label?: string;
}) {
  const tokens = useThemeTokens();

  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <ActivityIndicator
          accessibilityLabel="Chargement du catalogue"
          color={tokens.colors.accent}
        />
        <BodyText>{label}</BodyText>
      </View>
    </Card>
  );
}

export function AdminCatalogErrorState({
  description,
  message,
  onRetry,
  title = "Catalogue indisponible",
}: {
  description: string;
  message: string;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <Card variant="danger">
      <CardHeader title={title} description={description} />
      {message ? <BodyText selectable>{message}</BodyText> : null}
      <ActionButton onPress={onRetry} variant="secondary">
        Réessayer
      </ActionButton>
    </Card>
  );
}

export function AdminCatalogMessage({
  message,
  variant = "info",
}: {
  message: string;
  variant?: AdminCatalogMessageVariant;
}) {
  if (!message) {
    return null;
  }

  return (
    <Card variant={variant}>
      <BodyText selectable>{message}</BodyText>
    </Card>
  );
}

export function AdminCatalogStats({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap gap-3">{children}</View>;
}

export function AdminCatalogStatTile({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "default" | "info" | "success" | "warning";
  value: string;
}) {
  return <StatTile label={label} tone={tone} value={value} />;
}

export function AdminCatalogToolbar({ children }: { children: ReactNode }) {
  return (
    <View className="w-full max-w-full min-w-0 flex-row flex-wrap items-center gap-2">
      {children}
    </View>
  );
}

export function AdminCatalogList({ children }: { children: ReactNode }) {
  return <View className="gap-3">{children}</View>;
}

export type AdminCatalogCrudListItem = {
  action?: ReactNode;
  badges?: ReactNode;
  content?: ReactNode;
  description?: string;
  editLabel?: string;
  id: string | number;
  onEdit?: () => void;
  title: string;
};

export function AdminCatalogCrudList({
  actionLabel,
  disabled,
  emptyDescription,
  emptyTitle,
  items,
  onAction,
}: {
  actionLabel?: string;
  disabled?: boolean;
  emptyDescription: string;
  emptyTitle: string;
  items: AdminCatalogCrudListItem[];
  onAction?: () => void;
}) {
  return (
    <AdminCatalogList>
      {actionLabel && onAction ? (
        <ActionButton disabled={disabled} onPress={onAction} variant="primary">
          {actionLabel}
        </ActionButton>
      ) : null}

      {items.length === 0 ? (
        <AdminCatalogEmptyState
          description={emptyDescription}
          title={emptyTitle}
        />
      ) : null}

      {items.map((item) => (
        <AdminCatalogItemCard
          action={item.action}
          badges={item.badges}
          description={item.description}
          key={item.id}
          title={item.title}
        >
          {item.content}
          {item.onEdit ? (
            <View className="flex-row flex-wrap gap-2">
              <ActionButton
                className="w-full"
                disabled={disabled}
                onPress={item.onEdit}
                variant="secondary"
              >
                {item.editLabel ?? "Éditer"}
              </ActionButton>
            </View>
          ) : null}
        </AdminCatalogItemCard>
      ))}
    </AdminCatalogList>
  );
}

export function AdminCatalogEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <Card variant="muted">
      <CardHeader title={title} description={description} />
    </Card>
  );
}

export function AdminCatalogItemCard({
  action,
  badges,
  children,
  description,
  title,
}: {
  action?: ReactNode;
  badges?: ReactNode;
  children?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} action={action} />
      {badges ? (
        <View className="flex-row flex-wrap gap-2">{badges}</View>
      ) : null}
      {children}
    </Card>
  );
}

export function AdminCatalogModal({
  children,
  onClose,
  title,
  visible,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
}) {
  const tokens = useThemeTokens();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View
        className="flex-1 items-center justify-end px-3"
        style={{ backgroundColor: tokens.colors.overlay }}
      >
        <Pressable
          accessibilityRole="button"
          className="absolute inset-0"
          onPress={onClose}
        />
        <View
          className="max-h-[88%] w-full max-w-3xl rounded-t border p-4"
          style={{
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
          }}
        >
          <View className="flex-row items-start justify-between gap-3 pb-3">
            <TitleText className="min-w-0 flex-1 text-xl leading-7">
              {title}
            </TitleText>
            <ActionButton
              className="px-3 py-2"
              onPress={onClose}
              textClassName="text-xs"
              variant="secondary"
            >
              Fermer
            </ActionButton>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function AdminCatalogTextInput({
  label,
  multiline,
  onChangeText,
  value,
  ...props
}: TextInputProps & {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  const tokens = useThemeTokens();

  return (
    <View className="gap-1">
      <SubtleText>{label}</SubtleText>
      <TextInput
        {...props}
        className="min-h-10 rounded border px-3 py-2"
        multiline={multiline}
        onChangeText={onChangeText}
        placeholderTextColor={tokens.colors.textMuted}
        style={[
          {
            borderColor: tokens.colors.border,
            color: tokens.colors.textPrimary,
            textAlignVertical: multiline ? "top" : "center",
          },
          props.style,
        ]}
        value={value}
      />
    </View>
  );
}

export function AdminCatalogSelectionChips<TValue extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: TValue }[];
  value: TValue | null;
  onChange: (value: TValue) => void;
}) {
  return (
    <View className="gap-2">
      <SubtleText>{label}</SubtleText>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
          >
            <Badge variant={value === option.value ? "dark" : "muted"}>
              {option.label}
            </Badge>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function AdminCatalogMultiSelectionChips<
  TValue extends string | number,
>({
  label,
  onChange,
  options,
  values,
}: {
  label: string;
  onChange: (values: TValue[]) => void;
  options: { label: string; value: TValue }[];
  values: TValue[];
}) {
  return (
    <View className="gap-2">
      <SubtleText>{label}</SubtleText>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option.value);

          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() =>
                onChange(
                  selected
                    ? values.filter((value) => value !== option.value)
                    : [...values, option.value],
                )
              }
            >
              <Badge variant={selected ? "dark" : "muted"}>
                {option.label}
              </Badge>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function AdminCatalogDisclosure({
  badge,
  children,
  description,
  title,
}: {
  badge: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card variant="muted">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
      >
        <View className="flex-row flex-wrap items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <TitleText className="text-lg leading-6">{title}</TitleText>
            <SubtleText>{description}</SubtleText>
          </View>
          {badge}
        </View>
      </Pressable>
      {expanded ? (
        <View className="gap-2 border-t pt-3">{children}</View>
      ) : null}
    </Card>
  );
}

export function AdminCatalogBooleanChips({
  falseLabel,
  label,
  trueLabel,
  value,
  onChange,
}: {
  falseLabel: string;
  label: string;
  trueLabel: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <AdminCatalogSelectionChips
      label={label}
      options={[
        { label: trueLabel, value: "true" },
        { label: falseLabel, value: "false" },
      ]}
      value={value ? "true" : "false"}
      onChange={(nextValue) => onChange(nextValue === "true")}
    />
  );
}

export function AdminCatalogFormActions({
  deleteDisabled,
  disabled,
  onCancel,
  onDelete,
  onSave,
}: {
  deleteDisabled?: boolean;
  disabled: boolean;
  onCancel: () => void;
  onDelete?: () => void;
  onSave: () => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      <ActionButton disabled={disabled} onPress={onSave} variant="primary">
        Enregistrer
      </ActionButton>
      <ActionButton disabled={disabled} onPress={onCancel} variant="secondary">
        Annuler
      </ActionButton>
      {onDelete ? (
        <ActionButton
          disabled={disabled || deleteDisabled}
          onPress={onDelete}
          variant="danger"
        >
          Supprimer
        </ActionButton>
      ) : null}
    </View>
  );
}
