import type { ReactNode } from "react"

type MarkdownContentProps = {
  content: string
}

/** Lightweight markdown renderer for marketing articles (headings, lists, bold, hr). */
export function MarkdownContent({ content }: MarkdownContentProps) {
  const lines = content.split("\n")
  const elements: ReactNode[] = []
  let listItems: string[] = []

  const flushList = (key: number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="my-6 list-disc space-y-2 pl-6 text-neutral-700">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed text-neutral-700">
              {item}
            </li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2))
      return
    }

    flushList(index)

    if (trimmed === "---") {
      elements.push(<hr key={index} className="my-8 border-neutral-200" />)
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h1
          key={index}
          className="mb-4 mt-8 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl"
        >
          {trimmed.slice(2)}
        </h1>
      )
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2
          key={index}
          className="mb-4 mt-10 border-b border-neutral-100 pb-2 text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl"
        >
          {trimmed.slice(3)}
        </h2>
      )
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={index} className="mb-3 mt-8 text-lg font-semibold tracking-tight text-neutral-900">
          {trimmed.slice(4)}
        </h3>
      )
    } else if (trimmed) {
      const parts = trimmed.split(/(\*\*[^*]+\*\*)/g)
      const formattedLine = parts.map((part, partIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={partIdx} className="font-bold text-neutral-950">
              {part.slice(2, -2)}
            </strong>
          )
        }
        return part
      })

      elements.push(
        <p key={index} className="my-4 text-base leading-relaxed text-neutral-700">
          {formattedLine}
        </p>
      )
    }
  })

  flushList(lines.length)

  return <div className="prose prose-neutral max-w-none">{elements}</div>
}
