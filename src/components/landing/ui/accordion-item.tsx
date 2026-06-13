"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccordionItemProps {
  question: string
  answer: string
  defaultOpen?: boolean
}

export function AccordionItem({ question, answer, defaultOpen = false }: AccordionItemProps) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div className="border-b border-neutral-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-neutral-900">{question}</span>
        <Plus
          className={cn("landing-accordion-icon h-5 w-5 shrink-0 text-neutral-400")}
          data-open={open}
          aria-hidden
        />
      </button>
      <div className="landing-accordion-content" data-open={open}>
        <div>
          <p className="pb-5 text-sm leading-relaxed text-neutral-600">{answer}</p>
        </div>
      </div>
    </div>
  )
}
