import { cn } from "@/lib/utils"

type PageLoadingVariant =
  | "hub"
  | "detail"
  | "consent"
  | "list"
  | "inline"
  | "form"
  | "block"
  | "grid2"
  | "grid3"
  | "compact"
  | "cards"
  | "stack"
  | "listRows"
  | "borderedList"
  | "recordRow"

export function PageLoadingSkeleton({
  variant = "hub",
  className,
}: {
  variant?: PageLoadingVariant
  className?: string
}) {
  if (variant === "consent") {
    return (
      <div className={cn("mx-auto max-w-3xl space-y-6 animate-pulse", className)}>
        <div className="h-8 w-48 rounded-lg bg-neutral-200" />
        <div className="h-[28rem] rounded-xl bg-neutral-100" />
      </div>
    )
  }

  if (variant === "detail") {
    return (
      <div className={cn("mx-auto max-w-5xl space-y-6 animate-pulse", className)}>
        <div className="h-6 w-40 rounded bg-neutral-200" />
        <div className="h-20 rounded-xl bg-neutral-100" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-neutral-100" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-neutral-100" />
      </div>
    )
  }

  if (variant === "inline") {
    return (
      <div className={cn("space-y-2 animate-pulse", className)}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 rounded-lg bg-neutral-100" />
        ))}
      </div>
    )
  }

  if (variant === "block") {
    return <div className={cn("h-64 rounded-xl bg-neutral-100 animate-pulse", className)} />
  }

  if (variant === "grid2") {
    return (
      <div className={cn("grid gap-4 md:grid-cols-2 animate-pulse", className)}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-neutral-100" />
        ))}
      </div>
    )
  }

  if (variant === "grid3") {
    return (
      <div className={cn("grid gap-4 md:grid-cols-3 animate-pulse", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 rounded-lg bg-neutral-100" />
        ))}
      </div>
    )
  }

  if (variant === "compact") {
    return (
      <div
        className={cn("h-24 rounded-lg bg-neutral-100 animate-pulse", className)}
        aria-busy="true"
      />
    )
  }

  if (variant === "cards") {
    return (
      <div className={cn("grid gap-3 sm:grid-cols-2 animate-pulse", className)}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 rounded-xl bg-neutral-100" />
        ))}
      </div>
    )
  }

  if (variant === "stack") {
    return (
      <div className={cn("space-y-3 animate-pulse", className)}>
        <div className="h-12 rounded-md bg-neutral-100" />
        <div className="h-12 rounded-md bg-neutral-100" />
      </div>
    )
  }

  if (variant === "listRows") {
    return (
      <div className={cn("space-y-2 animate-pulse", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-neutral-100" />
        ))}
      </div>
    )
  }

  if (variant === "borderedList") {
    return (
      <div className={cn("space-y-4 animate-pulse", className)} aria-hidden>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-neutral-200 p-4 space-y-2">
            <div className="h-4 rounded bg-neutral-100 w-3/4" />
            <div className="h-3 rounded bg-neutral-100 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === "recordRow") {
    return (
      <div
        className={cn(
          "animate-pulse rounded-xl border border-neutral-200/80 px-4 py-3.5",
          className
        )}
      >
        <div className="h-4 w-1/3 rounded bg-neutral-100" />
        <div className="mt-2 h-3 w-1/2 rounded bg-neutral-100" />
      </div>
    )
  }

  if (variant === "form") {
    return (
      <div className={cn("mx-auto max-w-4xl space-y-4 animate-pulse px-4 py-8", className)}>
        <div className="h-8 w-48 rounded-lg bg-neutral-200" />
        <div className="h-72 rounded-xl bg-neutral-100" />
      </div>
    )
  }

  if (variant === "list") {
    return (
      <div className={cn("mx-auto max-w-7xl space-y-6 animate-pulse", className)}>
        <div className="h-10 w-56 rounded-lg bg-neutral-200" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-neutral-100" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-neutral-100" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("mx-auto max-w-7xl space-y-6 animate-pulse", className)}>
      <div className="h-6 w-32 rounded bg-neutral-200" />
      <div className="h-10 w-56 rounded-lg bg-neutral-200" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-neutral-100" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-neutral-100" />
    </div>
  )
}
