"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function DentalLegend() {
  return (
    <Card className="shadow-sm border-neutral-200">
      <CardHeader className="py-3 bg-neutral-50 border-b border-neutral-100">
        <CardTitle className="text-sm font-semibold">Legend & Indicators</CardTitle>
      </CardHeader>
      <CardContent className="py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-neutral-600">
        
        {/* Conditions */}
        <div className="space-y-2 border-r border-neutral-100 pr-4">
           <h4 className="font-bold text-neutral-900 mb-2 uppercase tracking-wider text-[10px]">Conditions</h4>
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-white border border-neutral-300 rounded-sm"></div> Healthy
           </div>
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-red-100 border border-red-500 rounded-sm"></div> Caries / Decayed
           </div>
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-amber-100 border border-amber-500 rounded-sm flex items-center justify-center">
                <div className="w-full h-0.5 bg-amber-600 rotate-45"></div>
             </div> 
             Missing
           </div>
        </div>

        {/* Restorations & surgery */}
        <div className="space-y-2 border-r border-neutral-100 pr-4 md:col-span-1">
           <h4 className="font-bold text-neutral-900 mb-2 uppercase tracking-wider text-[10px]">Restorations</h4>
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-blue-100 border border-blue-500 rounded-sm"></div> Filling / crown
           </div>
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-violet-100 border border-violet-500 rounded-sm"></div> Impacted
           </div>
           <div className="flex items-center gap-2">
             <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 ring-2 ring-white" />
             Surface marked (decay)
           </div>
        </div>

        <div className="space-y-2">
           <h4 className="font-bold text-neutral-900 mb-2 uppercase tracking-wider text-[10px]">Surfaces</h4>
           <p className="text-[11px] leading-relaxed text-neutral-500">
             F/B = Facial · L = Lingual · M/D = Mesial/Distal · O = Occlusal. Dots on chart show marked surfaces.
           </p>
        </div>
      </CardContent>
    </Card>
  )
}
