import { toast } from "sonner"

export const TOASTER_OPTIONS = {
  position: "bottom-right" as const,
  richColors: true,
  closeButton: true,
  duration: 4500,
}

type ToastExtras = {
  description?: string
  duration?: number
}

type ConfirmOptions = {
  confirmLabel?: string
  cancelLabel?: string
  title?: string
}

/** App-wide user feedback — use instead of alert(), confirm(), or inline error banners. */
export const notify = {
  success(message: string, extras?: ToastExtras) {
    return toast.success(message, {
      description: extras?.description,
      duration: extras?.duration ?? TOASTER_OPTIONS.duration,
    })
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

  info(message: string, extras?: ToastExtras) {
    return toast.info(message, {
      description: extras?.description,
      duration: extras?.duration ?? TOASTER_OPTIONS.duration,
    })
  },

  warning(message: string) {
    return toast.warning(message)
  },

  loading(message: string) {
    return toast.loading(message, { duration: Infinity })
  },

  dismiss(id?: string | number) {
    toast.dismiss(id)
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
