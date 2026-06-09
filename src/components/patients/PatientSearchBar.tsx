"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export function PatientSearchBar() {
  // In a real implementation, we would use a debounced value and sync it with URL query params
  // or a global state to trigger the search_patients RPC.

  return (
    <div className="relative max-w-md w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
      <Input 
        type="search" 
        placeholder="Search by name, ID, or phone number..." 
        className="pl-9 bg-neutral-50 border-neutral-200"
      />
    </div>
  )
}
