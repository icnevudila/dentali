"use client"

import * as React from "react"
import { ToothFinding, ToothSurface } from "@/lib/types/dental"
import { cn } from "@/lib/utils"

interface ToothSurfaceMapProps {
  toothNumber: number
  finding?: Partial<ToothFinding>
  isSelected?: boolean
  isInteractive?: boolean
  onSurfaceClick?: (surface: ToothSurface) => void
  size?: number
}

export function ToothSurfaceMap({ 
  toothNumber,
  finding, 
  isSelected, 
  isInteractive = false, 
  onSurfaceClick,
  size = 180 
}: ToothSurfaceMapProps) {
  
  const isMissing = finding?.condition === "missing_caries" || finding?.condition === "missing_other" || finding?.surgery_type === "extraction_caries" || finding?.surgery_type === "extraction_other"
  const isImplant = finding?.restoration_type === "implant"
  const isCrown = finding?.restoration_type === "jacket_crown"
  const isRootFragment = finding?.condition === "root_fragment"
  const surfacesDisabled = isMissing

  const hasSurface = (surface: ToothSurface) => finding?.surfaces?.includes(surface)

  // Interactive logic mapping anatomical layers to surfaces:
  // - Enamel (Crown Outer) -> toggles 'center' (Occlusal) surface
  // - Dentin (Crown Inner) -> toggles 'top' (Facial) surface
  // - Pulp (Nerve Chamber) -> toggles 'bottom' (Lingual) surface
  // - Nerves (Root Canals) -> toggles 'left' / 'right' (Mesial / Distal) surfaces
  const handleLayerClick = (layer: "enamel" | "dentin" | "pulp" | "nerves") => {
    if (!isInteractive || surfacesDisabled) return
    if (!onSurfaceClick) return

    if (layer === "enamel") onSurfaceClick("center")
    else if (layer === "dentin") onSurfaceClick("top")
    else if (layer === "pulp") onSurfaceClick("bottom")
    else if (layer === "nerves") onSurfaceClick("left")
  }

  // Dynamic colors based on condition and restoration
  const getEnamelColor = () => {
    if (isMissing && !isImplant) return "#f1f5f9"
    if (hasSurface("center")) {
      if (finding?.condition === "decayed") return "#fecaca" // red light
      if (finding?.restoration_type) return "#dbeafe" // blue light
      return "#ccfbf1" // teal light (healthy selected)
    }
    return "#ffffff" // healthy white
  }

  const getDentinColor = () => {
    if (isMissing && !isImplant) return "#cbd5e1"
    if (hasSurface("top")) {
      if (finding?.condition === "decayed") return "#fca5a5"
      if (finding?.restoration_type) return "#bfdbfe"
    }
    return "#fee2e2" // natural dentin pinkish-orange
  }

  const getPulpColor = () => {
    if (isMissing && !isImplant) return "#94a3b8"
    if (isRootFragment || hasSurface("bottom")) {
      return "#dc2626" // red pulp (infected/treated)
    }
    return "#fca5a5" // natural pulp pink
  }

  const getNerveStroke = () => {
    if (isMissing && !isImplant) return "#475569"
    if (isRootFragment || hasSurface("left") || hasSurface("right")) {
      return "#dc2626" // red nerve
    }
    return "#fee2e2" // natural nerve light pink
  }

  return (
    <div className="relative flex flex-col items-center justify-center w-full">
      <svg 
        width={size} 
        height={size * 1.88} 
        viewBox="0 0 345 650" 
        className={`transition-all select-none ${isSelected ? 'drop-shadow-md' : ''}`}
      >
        <style>{`
          .anatomy-bg { fill: #f8fafc; stroke: #e2e8f0; stroke-width: 1.5; }
          .gum { fill: #fecdd3; opacity: 0.35; }
          .bone { fill: #fef3c7; opacity: 0.7; stroke: #d97706; stroke-width: 1.5; }
          .outline { fill: none; stroke: #374151; stroke-width: 3.5; stroke-linejoin: round; }
          .label-line { stroke: #64748b; stroke-width: 1.2; stroke-dasharray: 2 2; }
          .label-text { font-family: Inter, Arial, sans-serif; font-size: 13px; font-weight: 700; fill: #475569; }
        `}</style>

        {/* Card Border Background */}
        <rect x="2" y="2" width="341" height="646" rx="18" className="anatomy-bg" />

        <g transform="translate(48, 65)">
          {/* Gum & Bone Background */}
          <path d="M -30 135 C 25 108, 72 126, 105 116 C 155 101, 193 117, 250 135 L 250 398 L -30 398 Z" className="gum" />
          <path d="M -30 252 C 20 235, 78 245, 128 236 C 178 227, 215 236, 250 252 L 250 398 L -30 398 Z" className="bone" />
          
          {/* Tooth structures */}
          {isImplant ? (
            <g transform="translate(60, 50) scale(1.1)" stroke="#475569" strokeWidth="4" fill="none" strokeLinecap="round">
              <rect x="0" y="5" width="100" height="35" rx="8" fill="#cbd5e1" strokeWidth="6" />
              <line x1="15" y1="55" x2="85" y2="55" strokeWidth="10" />
              <line x1="20" y1="80" x2="80" y2="80" strokeWidth="10" />
              <line x1="25" y1="105" x2="75" y2="105" strokeWidth="10" />
              <line x1="30" y1="130" x2="70" y2="130" strokeWidth="10" />
              <line x1="50" y1="20" x2="50" y2="280" strokeWidth="16" />
            </g>
          ) : (
            <>
              {/* Enamel (Mine / Crown) */}
              <path 
                d="M 34 40 C 52 12, 101 21, 122 45 C 143 20, 192 10, 211 40 C 231 73, 205 147, 181 183 C 161 212, 152 258, 143 330 C 136 387, 121 389, 113 331 C 104 260, 94 214, 75 184 C 50 146, 14 76, 34 40 Z" 
                fill={getEnamelColor()} 
                stroke={hasSurface("center") ? (finding?.condition === "decayed" ? "#b91c1c" : "#1d4ed8") : "#cbd5e1"}
                strokeWidth={hasSurface("center") ? 3 : 2}
                className={cn("transition-colors duration-150", isInteractive && !surfacesDisabled && "cursor-pointer hover:opacity-95")} 
                onClick={() => handleLayerClick("enamel")} 
              />
              
              {/* Dentin */}
              <path 
                d="M 54 65 C 76 45, 103 62, 122 84 C 141 61, 172 46, 192 66 C 207 105, 177 154, 161 181 C 145 210, 138 255, 132 311 C 128 346, 119 347, 114 312 C 107 256, 99 211, 83 181 C 67 153, 37 104, 54 65 Z" 
                fill={getDentinColor()} 
                className={cn("transition-colors duration-150", isInteractive && !surfacesDisabled && "cursor-pointer hover:opacity-95")} 
                onClick={() => handleLayerClick("dentin")} 
              />
              
              {/* Pulp (Pulpa) */}
              <path 
                d="M 88 115 C 101 99, 115 108, 122 126 C 130 108, 145 99, 157 116 C 164 139, 145 174, 139 198 C 132 225, 128 263, 125 318 C 123 350, 120 350, 117 318 C 113 263, 109 225, 102 198 C 95 174, 79 139, 88 115 Z" 
                fill={getPulpColor()} 
                className={cn("transition-colors duration-150", isInteractive && !surfacesDisabled && "cursor-pointer hover:opacity-95")} 
                onClick={() => handleLayerClick("pulp")} 
              />
              
              {/* Root Nerves / Canals */}
              <path d="M 122 150 C 119 205, 120 267, 121 342" stroke={getNerveStroke()} strokeWidth="3" strokeLinecap="round" fill="none" className={cn("transition-colors duration-150", isInteractive && !surfacesDisabled && "cursor-pointer")} onClick={() => handleLayerClick("nerves")} />
              <path d="M 104 145 C 101 187, 96 236, 89 302" stroke={getNerveStroke()} strokeWidth="2.5" strokeLinecap="round" fill="none" className={cn("transition-colors duration-150", isInteractive && !surfacesDisabled && "cursor-pointer")} onClick={() => handleLayerClick("nerves")} />
              <path d="M 142 145 C 146 187, 151 236, 157 302" stroke={getNerveStroke()} strokeWidth="2.5" strokeLinecap="round" fill="none" className={cn("transition-colors duration-150", isInteractive && !surfacesDisabled && "cursor-pointer")} onClick={() => handleLayerClick("nerves")} />
              
              {/* Outline */}
              <path d="M 34 40 C 52 12, 101 21, 122 45 C 143 20, 192 10, 211 40 C 231 73, 205 147, 181 183 C 161 212, 152 258, 143 330 C 136 387, 121 389, 113 331 C 104 260, 94 214, 75 184 C 50 146, 14 76, 34 40 Z" className="outline" />
            </>
          )}
        </g>

        {/* Labels & pointer lines */}
        <g className="select-none pointer-events-none text-xs">
          {/* Enamel Label */}
          <line x1="220" y1="120" x2="278" y2="120" className="label-line" />
          <circle cx="218" cy="120" r="3" fill="#64748b" />
          <text x="286" y="124" className="label-text">Enamel (Mine)</text>

          {/* Dentin Label */}
          <line x1="205" y1="165" x2="278" y2="165" className="label-line" />
          <circle cx="203" cy="165" r="3" fill="#64748b" />
          <text x="286" y="169" className="label-text">Dentin</text>

          {/* Pulp Label */}
          <line x1="175" y1="235" x2="278" y2="235" className="label-line" />
          <circle cx="173" cy="235" r="3" fill="#64748b" />
          <text x="286" y="239" className="label-text">Pulp (Pulpa)</text>

          {/* Root Label */}
          <line x1="170" y1="390" x2="278" y2="390" className="label-line" />
          <circle cx="168" cy="390" r="3" fill="#64748b" />
          <text x="286" y="394" className="label-text">Root (Kök)</text>

          {/* Bone Label */}
          <line x1="180" y1="450" x2="278" y2="450" className="label-line" />
          <circle cx="178" cy="450" r="3" fill="#64748b" />
          <text x="286" y="454" className="label-text">Bone (Kemik)</text>
        </g>
      </svg>
      
      {/* Overlay X for missing/extracted state */}
      {isMissing && !isImplant && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <svg width={size} height={size * 1.88} viewBox="0 0 345 650" className="opacity-95 drop-shadow-lg">
             <line x1="50" y1="120" x2="295" y2="450" stroke="#ea580c" strokeWidth="12" strokeLinecap="round" />
             <line x1="295" y1="120" x2="50" y2="450" stroke="#ea580c" strokeWidth="12" strokeLinecap="round" />
           </svg>
        </div>
      )}
    </div>
  )
}
