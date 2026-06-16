import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { OrderProgressState, ProgressStep } from "utils/orderProgressSteps";

type Props = {
  progress: OrderProgressState;
  accent?: string;
  compact?: boolean;
  dark?: boolean;
};

const DEFAULT_ACCENT = "#22C55E";

export default function OrderProgressStepper({
  progress,
  accent = DEFAULT_ACCENT,
  compact = false,
  dark = false,
}: Props) {
  const { steps, completedCount, activeIndex } = progress;
  const trackBg = dark ? "rgba(255,255,255,0.15)" : "#E2E8F0";
  const labelColor = dark ? "rgba(255,255,255,0.75)" : "#64748B";
  const activeLabelColor = dark ? "#FFFFFF" : "#0F172A";

  const fillRatio =
    steps.length <= 1 ? 0 : Math.min(1, Math.max(0, completedCount / steps.length));

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {steps.map((step: ProgressStep, index: number) => {
          const isComplete = index < completedCount;
          const isActive = index === activeIndex && !isComplete;
          const dotColor = isComplete || isActive ? accent : trackBg;
          const iconName =
            isComplete ? "checkmark" : index === 3 ? "bicycle" : index === 2 ? "restaurant" : index === 1 ? "flame" : "bag-check";

          return (
            <View key={step.key} style={{ alignItems: "center", flex: 1 }}>
              <View
                style={{
                  width: compact ? 22 : 26,
                  height: compact ? 22 : 26,
                  borderRadius: 999,
                  backgroundColor: dotColor,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: isActive ? 2 : 0,
                  borderColor: dark ? "#FFFFFF" : accent,
                }}
              >
                {isComplete ? (
                  <Ionicons name="checkmark" size={compact ? 12 : 14} color="#fff" />
                ) : isActive ? (
                  <Ionicons name={iconName as any} size={compact ? 11 : 13} color={dark ? "#0F172A" : "#fff"} />
                ) : (
                  <View
                    style={{
                      width: compact ? 7 : 8,
                      height: compact ? 7 : 8,
                      borderRadius: 999,
                      backgroundColor: dark ? "rgba(255,255,255,0.35)" : "#94A3B8",
                    }}
                  />
                )}
              </View>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 6,
                  fontSize: compact ? 9 : 10,
                  fontWeight: isActive || isComplete ? "800" : "600",
                  color: isActive || isComplete ? activeLabelColor : labelColor,
                  textAlign: "center",
                }}
              >
                {compact ? step.shortLabel : step.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View
        style={{
          position: "absolute",
          top: compact ? 10 : 12,
          left: "12%",
          right: "12%",
          height: 4,
          borderRadius: 999,
          backgroundColor: trackBg,
          zIndex: -1,
        }}
      >
        <View
          style={{
            height: 4,
            borderRadius: 999,
            backgroundColor: accent,
            width: `${Math.max(8, fillRatio * 100)}%`,
          }}
        />
      </View>
    </View>
  );
}
