"use client"

import * as React from "react"
import { useBranch } from "@/hooks/use-branch"
import { Building2 } from "lucide-react"

export function BranchSwitcher() {
  const { activeBranch, availableBranches, setActiveBranch } = useBranch()
  const [isOpen, setIsOpen] = React.useState(false)

  // In a real app, this would use a proper Radix or Shadcn Dropdown/Select component
  // For the MVP scaffold, we'll build a simplified native-like dropdown or just a styled button
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
      >
        <Building2 className="h-4 w-4 text-primary-500" />
        {activeBranch ? activeBranch.name : "Select Branch"}
      </button>

      {isOpen && availableBranches.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-48 rounded-md border border-neutral-200 bg-white shadow-lg z-50 py-1">
          {availableBranches.map(branch => (
            <button
              key={branch.id}
              onClick={() => {
                setActiveBranch(branch)
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              {branch.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
