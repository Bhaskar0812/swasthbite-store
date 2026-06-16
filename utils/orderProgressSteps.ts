export type ProgressStep = {
  key: string;
  label: string;
  shortLabel: string;
};

export const STORE_ORDER_STEPS: ProgressStep[] = [
  { key: "received", label: "Received", shortLabel: "Recv" },
  { key: "preparing", label: "Start Preparing", shortLabel: "Prep" },
  { key: "prepared", label: "Prepared", shortLabel: "Ready" },
  { key: "handover", label: "Hand Over", shortLabel: "Hand" },
];

export type OrderProgressState = {
  steps: ProgressStep[];
  completedCount: number;
  activeIndex: number;
  headline: string;
};

export const resolveStoreOrderProgress = (status?: string): OrderProgressState => {
  const value = String(status || "").toLowerCase();

  if (["delivered", "completed"].includes(value)) {
    return {
      steps: STORE_ORDER_STEPS,
      completedCount: STORE_ORDER_STEPS.length,
      activeIndex: STORE_ORDER_STEPS.length - 1,
      headline: "Delivered",
    };
  }

  if (["out_for_delivery", "picked_up"].includes(value)) {
    return {
      steps: STORE_ORDER_STEPS,
      completedCount: STORE_ORDER_STEPS.length,
      activeIndex: 3,
      headline: "Handed to delivery partner",
    };
  }

  if (["preparing", "assigned", "accepted", "ready"].includes(value)) {
    return {
      steps: STORE_ORDER_STEPS,
      completedCount: 2,
      activeIndex: 2,
      headline: "Prepared — ready to hand over",
    };
  }

  if (["pending", "scheduled"].includes(value)) {
    return {
      steps: STORE_ORDER_STEPS,
      completedCount: 1,
      activeIndex: 1,
      headline: "Start preparing",
    };
  }

  return {
    steps: STORE_ORDER_STEPS,
    completedCount: 0,
    activeIndex: 0,
    headline: "Order received",
  };
};

export const formatStoreProgressSubtitle = (status?: string, customerName?: string) => {
  const progress = resolveStoreOrderProgress(status);
  const step = progress.steps[progress.activeIndex]?.label || progress.headline;
  const who = customerName ? ` • ${customerName}` : "";
  return `${step}${who}`;
};

export const formatProgressStepLine = (progress: OrderProgressState) =>
  progress.steps
    .map((step, index) => {
      if (index < progress.completedCount) return `${step.shortLabel} ✓`;
      if (index === progress.activeIndex) return `→ ${step.shortLabel}`;
      return step.shortLabel;
    })
    .join(" • ");
