import { toast } from "sonner"

export const TOASTER_OPTIONS = {
  position: "bottom-right" as const,
  richColors: true,
  closeButton: true,
  duration: 4500,
}

type ConfirmOptions = {
  confirmLabel?: string
  cancelLabel?: string
  title?: string
}

/** App-wide user feedback — use instead of alert(), confirm(), or inline error banners. */
export const notify = {
  success(message: string) {
    return toast.success(message)
  },

  error(message: string, retry?: () => void) {
    if (!message) return
    return toast.error(message, {
      duration: 6000,
      action: retry
        ? {
            label: "Retry",
            onClick: retry,
          }
        : undefined,
    })
  },

  info(message: string) {
    return toast.info(message)
  },

  warning(message: string) {
    return toast.warning(message)
  },

  /** Promise-based replacement for window.confirm(). */
  confirm(message: string, options?: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false
      const settle = (value: boolean) => {
        if (settled) return
        settled = true
        resolve(value)
      }

      toast.warning(options?.title ?? "Please confirm", {
        description: message,
        duration: Infinity,
        closeButton: true,
        action: {
          label: options?.confirmLabel ?? "Confirm",
          onClick: () => settle(true),
        },
        cancel: {
          label: options?.cancelLabel ?? "Cancel",
          onClick: () => settle(false),
        },
        onDismiss: () => settle(false),
      })
    })
  },
}

export function notifyIfError(message: string | null | undefined, retry?: () => void) {
  if (message) notify.error(message, retry)
}
