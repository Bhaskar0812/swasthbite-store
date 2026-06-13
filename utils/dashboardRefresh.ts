let dashboardRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let dashboardRefreshInFlight = false;
let dashboardRefreshQueued = false;

export const debouncedDashboardRefresh = (
  refresh: () => Promise<void>,
  delayMs = 2500,
) => {
  if (dashboardRefreshTimer) {
    clearTimeout(dashboardRefreshTimer);
  }

  dashboardRefreshTimer = setTimeout(async () => {
    dashboardRefreshTimer = null;
    if (dashboardRefreshInFlight) {
      dashboardRefreshQueued = true;
      return;
    }

    dashboardRefreshInFlight = true;
    try {
      await refresh();
    } finally {
      dashboardRefreshInFlight = false;
      if (dashboardRefreshQueued) {
        dashboardRefreshQueued = false;
        debouncedDashboardRefresh(refresh, delayMs);
      }
    }
  }, delayMs);
};
