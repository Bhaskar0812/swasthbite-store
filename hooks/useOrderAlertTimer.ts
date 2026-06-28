import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useStoreStore } from 'store/storeStore';
import {
  pulseIncomingOrderAlerts,
  refreshIncomingOrderActivity,
} from 'services/incomingOrderAlertService';
import { tickOngoingOrderActivity } from 'services/ongoingOrderActivityService';

const TICK_MS = 15_000;

/** Keeps sticky order notifications + live countdown updated while app is open or backgrounded. */
export function useOrderAlertTimer(enabled: boolean) {
  const dashboard = useStoreStore((s) => s.dashboard);
  const isOnline = useStoreStore((s) => s.isOnline);
  const refreshDashboardAndActivity = useStoreStore((s) => s.refreshDashboardAndActivity);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      const currentDashboard = useStoreStore.getState().dashboard;
      const online = useStoreStore.getState().isOnline;
      if (!currentDashboard) {
        await refreshDashboardAndActivity().catch(() => null);
        return;
      }

      await pulseIncomingOrderAlerts(currentDashboard);
      await refreshIncomingOrderActivity(currentDashboard);
      await tickOngoingOrderActivity(currentDashboard, { isOnline: online });
    };

    const startTimer = () => {
      if (timerRef.current) return;
      void tick();
      timerRef.current = setInterval(() => {
        void tick();
      }, TICK_MS);
    };

    const stopTimer = () => {
      if (!timerRef.current) return;
      clearInterval(timerRef.current);
      timerRef.current = null;
    };

    const handleAppState = (nextState: AppStateStatus) => {
      appStateRef.current = nextState;
      if (nextState === 'active' || nextState === 'background') {
        startTimer();
      } else {
        stopTimer();
      }
    };

    startTimer();
    const sub = AppState.addEventListener('change', handleAppState);
    return () => {
      sub.remove();
      stopTimer();
    };
  }, [enabled, dashboard, isOnline, refreshDashboardAndActivity]);
}
