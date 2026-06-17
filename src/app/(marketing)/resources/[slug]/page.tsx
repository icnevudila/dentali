import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ARTICLES } from "@/lib/marketing/resources-data"
import { MarketingShell } from "@/components/marketing/MarketingShell"
import { BlogCoverImage } from "@/components/marketing/BlogCoverImage"
import { MarkdownContent } from "@/components/marketing/MarkdownContent"
import { BlogArticleJsonLd } from "@/components/marketing/BlogArticleJsonLd"
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
      images: [
        {
          url: article.coverImage,
          width: 1200,
          height: 675,
          alt: article.coverImageAlt,
        },
      ],
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const article = ARTICLES.find((a) => a.slug === slug)

  if (!article) {
    notFound()
  }

  return (
    <MarketingShell>
      <BlogArticleJsonLd post={article} urlPath={`/resources/${slug}`} />

      <div className="bg-white py-12 md:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <nav
            className="mb-8 flex items-center space-x-2 text-xs font-medium text-neutral-500"
            aria-label="Breadcrumb"
          >
            <Link href="/welcome" className="transition-colors hover:text-primary-700">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <Link href="/resources" className="transition-colors hover:text-primary-700">
              Resources
            </Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="max-w-[200px] truncate text-neutral-900 sm:max-w-sm" aria-current="page">
              {article.title}
            </span>
          </nav>

          <Link
            href="/resources"
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 transition-colors hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to resources
          </Link>

          <header className="border-b border-neutral-200 pb-8">
            <span className="inline-flex items-center rounded-md bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-800 ring-1 ring-primary-600/10 mb-4">
              {article.category}
            </span>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-neutral-900 sm:text-4xl md:text-5xl">
              {article.title}
            </h1>
            <p className="mt-4 text-lg font-normal leading-relaxed text-neutral-600">
              {article.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-neutral-500">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-neutral-400" aria-hidden />
                By {article.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-neutral-400" aria-hidden />
                {article.publishedAt}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-neutral-400" aria-hidden />
                {article.readTime}
              </span>
            </div>
          </header>

          <BlogCoverImage
            src={article.coverImage}
            alt={article.coverImageAlt}
            priority
            className="-mx-4 mt-8 aspect-[16/9] w-[calc(100%+2rem)] sm:mx-0 sm:mt-10 sm:w-full sm:rounded-2xl"
          />

          <main className="max-w-none pt-10">
            <MarkdownContent content={article.content} />
          </main>
        </div>
      </div>
    </MarketingShell>
  )
}
