export const NOTIFICATIONS_REFRESH_EVENT = "cliro:notifications-refresh";

// Lets any mutation (a new follow-up date, a closed deal) update the bell's
// badge right away instead of waiting for its next poll.
export function requestNotificationsRefresh() {
  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}
