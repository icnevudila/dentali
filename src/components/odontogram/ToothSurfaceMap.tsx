"use client"

import * as React from "react"
import { ToothFinding, ToothSurface } from "@/lib/types/dental"

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
  size = 40 
}: ToothSurfaceMapProps) {
  
  const isMissing = finding?.condition === "missing_caries" || finding?.condition === "missing_other" || finding?.surgery_type === "extraction_caries" || finding?.surgery_type === "extraction_other"
  
  const getSurfaceColor = (surface: ToothSurface) => {
    if (isMissing) return "#fef3c7" // amber-100 base for missing
    const hasSurface = finding?.surfaces?.includes(surface)
    if (!hasSurface) return "#ffffff"
    if (finding?.condition === "decayed") return "#dc2626" 
    if (finding?.restoration_type) return "#2563eb"
    return "#ffffff"
  }

  const getStrokeColor = (surface: ToothSurface) => {
    if (isMissing) return "#d97706" 
    const hasSurface = finding?.surfaces?.includes(surface)
    if (!hasSurface) return "#94a3b8" 
    if (finding?.condition === "decayed") return "#991b1b" 
    if (finding?.restoration_type) return "#1d4ed8" 
    return "#94a3b8" 
  }

  const handleInteraction = (surface: ToothSurface, e: React.MouseEvent) => {
    if (isInteractive && onSurfaceClick) {
      e.stopPropagation()
      onSurfaceClick(surface)
    }
  }

  // Determine Tooth Type
  const lastDigit = toothNumber % 10
  let toothType = "molar"
  if (lastDigit === 1 || lastDigit === 2) toothType = "incisor"
  if (lastDigit === 3) toothType = "canine"
  if (lastDigit === 4 || lastDigit === 5) toothType = "premolar"

  // Paths based on tooth type
  let paths = { top: "", bottom: "", left: "", right: "", center: "" }

  if (toothType === "incisor") {
    paths = {
      // Facial
      top: "M 20 25 L 80 25 L 70 45 L 30 45 Z",
      // Lingual
      bottom: "M 20 75 L 80 75 L 70 55 L 30 55 Z",
      // Mesial/Distal
      left: "M 20 25 L 30 45 L 30 55 L 20 75 Z",
      // Distal/Mesial
      right: "M 80 25 L 70 45 L 70 55 L 80 75 Z",
      // Incisal edge
      center: "M 30 45 L 70 45 L 70 55 L 30 55 Z"
    }
  } else if (toothType === "canine") {
    paths = {
      top: "M 50 15 L 80 35 L 65 45 L 35 45 L 20 35 Z",
      bottom: "M 50 85 L 80 65 L 65 55 L 35 55 L 20 65 Z",
      left: "M 20 35 L 35 45 L 35 55 L 20 65 Z",
      right: "M 80 35 L 65 45 L 65 55 L 80 65 Z",
      center: "M 35 45 L 65 45 L 65 55 L 35 55 Z"
    }
  } else {
    // Premolars and Molars (Organic Square)
    paths = {
      top: "M 20 20 Q 50 5 80 20 L 65 35 Q 50 28 35 35 Z",
      bottom: "M 20 80 Q 50 95 80 80 L 65 65 Q 50 72 35 65 Z",
      left: "M 20 20 Q 5 50 20 80 L 35 65 Q 28 50 35 35 Z",
      right: "M 80 20 Q 95 50 80 80 L 65 65 Q 72 50 65 35 Z",
      center: "M 35 35 Q 50 28 65 35 Q 72 50 65 65 Q 50 72 35 65 Q 28 50 35 35 Z"
    }
  }

  const baseStyle = isInteractive 
    ? "cursor-pointer hover:opacity-80 transition-opacity duration-150" 
    : "transition-colors duration-200"

  // Scale based on tooth type so molars look bigger than incisors
  let scaleTransform = 'scale(1)'
  if (toothType === 'incisor') scaleTransform = 'scale(0.85) scaleY(0.6)'
  if (toothType === 'canine') scaleTransform = 'scale(0.9) scaleY(0.8)'
  if (toothType === 'premolar') scaleTransform = 'scale(0.95)'

  return (
    <div className="relative flex items-center justify-center">
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        className={`transition-all ${isSelected && !isInteractive ? 'drop-shadow-lg' : 'drop-shadow-sm'}`}
      >
        <g style={{ transformOrigin: 'center', transform: isInteractive ? 'scale(1)' : scaleTransform }}>
          <path d={paths.top} fill={getSurfaceColor('top')} stroke={getStrokeColor('top')} strokeWidth="3" strokeLinejoin="round" className={baseStyle} onClick={(e) => handleInteraction('top', e)} />
          <path d={paths.bottom} fill={getSurfaceColor('bottom')} stroke={getStrokeColor('bottom')} strokeWidth="3" strokeLinejoin="round" className={baseStyle} onClick={(e) => handleInteraction('bottom', e)} />
          <path d={paths.left} fill={getSurfaceColor('left')} stroke={getStrokeColor('left')} strokeWidth="3" strokeLinejoin="round" className={baseStyle} onClick={(e) => handleInteraction('left', e)} />
          <path d={paths.right} fill={getSurfaceColor('right')} stroke={getStrokeColor('right')} strokeWidth="3" strokeLinejoin="round" className={baseStyle} onClick={(e) => handleInteraction('right', e)} />
          <path d={paths.center} fill={getSurfaceColor('center')} stroke={getStrokeColor('center')} strokeWidth="3" strokeLinejoin="round" className={baseStyle} onClick={(e) => handleInteraction('center', e)} />
        </g>
      </svg>
      
      {/* Overlay X for missing teeth */}
      {isMissing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <svg width={size} height={size} viewBox="0 0 100 100" className="opacity-90 drop-shadow-md">
             <line x1="20" y1="20" x2="80" y2="80" stroke="#ea580c" strokeWidth="8" strokeLinecap="round" />
             <line x1="80" y1="20" x2="20" y2="80" stroke="#ea580c" strokeWidth="8" strokeLinecap="round" />
           </svg>
        </div>
      )}
    </div>
  )
}
