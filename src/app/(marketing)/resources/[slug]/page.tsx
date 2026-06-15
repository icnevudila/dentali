import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ARTICLES } from "@/lib/marketing/resources-data"
import { MarketingShell } from "@/components/marketing/MarketingShell"
import { getSiteUrl } from "@/lib/site-url"
import { Calendar, Clock, User, ArrowLeft, ChevronRight } from "lucide-react"

const siteUrl = getSiteUrl()

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return ARTICLES.map((article) => ({
    slug: article.slug,
  }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = ARTICLES.find((a) => a.slug === slug)

  if (!article) {
    return {
      title: "Article Not Found",
    }
  }

  const canonicalUrl = `${siteUrl}/resources/${slug}`

  return {
    title: `${article.title} | dentali. Resources`,
    description: article.description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: article.title,
      description: article.description,
      url: canonicalUrl,
      type: "article",
      publishedTime: new Date(article.publishedAt).toISOString(),
      authors: [article.author],
    },
  }
}

// Simple native markdown-to-JSX renderer to prevent build compilation errors
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let listItems: string[] = []

  const flushList = (key: number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="my-6 list-disc pl-6 space-y-2 text-neutral-700">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-neutral-700 leading-relaxed">{item}</li>
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

    // If we reach a non-list line, flush the collected list items first
    flushList(index)

    if (trimmed === "---") {
      elements.push(<hr key={index} className="my-8 border-neutral-200" />)
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={index} className="mt-8 mb-4 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
          {trimmed.slice(2)}
        </h1>
      )
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={index} className="mt-10 mb-4 text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl border-b border-neutral-100 pb-2">
          {trimmed.slice(3)}
        </h2>
      )
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={index} className="mt-8 mb-3 text-lg font-semibold tracking-tight text-neutral-900">
          {trimmed.slice(4)}
        </h3>
      )
    } else if (trimmed) {
      // Inline formatting replacements for bold text: **text**
      const parts = trimmed.split(/(\*\*[^*]+\*\*)/g)
      const formattedLine = parts.map((part, partIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={partIdx} className="font-bold text-neutral-950">{part.slice(2, -2)}</strong>
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

  // Flush any final list items
  flushList(lines.length)

  return <div className="prose prose-neutral max-w-none">{elements}</div>
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const article = ARTICLES.find((a) => a.slug === slug)

  if (!article) {
    notFound()
  }

  return (
    <MarketingShell>
      <div className="bg-white py-12 md:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-xs font-medium text-neutral-500 mb-8" aria-label="Breadcrumb">
            <Link href="/welcome" className="hover:text-primary-700 transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/resources" className="hover:text-primary-700 transition-colors">Resources</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-neutral-900 truncate max-w-[200px] sm:max-w-sm" aria-current="page">
              {article.title}
            </span>
          </nav>

          {/* Back Button */}
          <Link
            href="/resources"
            className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-primary-700 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to resources
          </Link>

          {/* Article Header */}
          <header className="border-b border-neutral-200 pb-8 mb-10">
            <span className="inline-flex items-center rounded-md bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-800 ring-1 ring-primary-600/10 mb-4">
              {article.category}
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl md:text-5xl leading-tight">
              {article.title}
            </h1>
            <p className="mt-4 text-lg text-neutral-600 leading-relaxed font-normal">
              {article.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-neutral-500">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-neutral-400" />
                By {article.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-neutral-400" />
                {article.publishedAt}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-neutral-400" />
                {article.readTime}
              </span>
            </div>
          </header>

          {/* Article Body */}
          <main className="max-w-none">
            <MarkdownContent content={article.content} />
          </main>
        </div>
      </div>
    </MarketingShell>
  )
}
