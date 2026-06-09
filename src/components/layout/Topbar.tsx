import * as React from "react"

export function Topbar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <div className="flex items-center gap-4">
        {/* BranchSwitcher will go here in Wave 1 */}
        <div className="text-sm font-medium text-neutral-500">
          Main Branch
        </div>
      </div>
      <div className="flex items-center gap-4">
        {/* User profile dropdown will go here */}
        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
          A
        </div>
      </div>
    </header>
  )
}
