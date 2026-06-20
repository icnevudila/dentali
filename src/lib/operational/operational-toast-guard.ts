/** Suppress redundant "patient checked in" realtime toasts after a check-in we initiated. */
let suppressQueueToastUntil = 0

export function suppressOperationalQueueToast(durationMs = 8000) {
  suppressQueueToastUntil = Date.now() + durationMs
}

export function shouldShowOperationalQueueToast() {
  return Date.now() > suppressQueueToastUntil
}
