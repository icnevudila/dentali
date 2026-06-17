import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BLOG_POSTS, getBlogPost } from "@/lib/marketing/blog-data"
import { BlogCoverImage } from "@/components/marketing/BlogCoverImage"
import { MarkdownContent } from "@/components/marketing/MarkdownContent"
import { BlogArticleJsonLd } from "@/components/marketing/BlogArticleJsonLd"
import { BlogPostCard } from "@/components/marketing/BlogPostCard"
import { getSiteUrl } from "@/lib/site-url"
import { Calendar, Clock, User, ArrowLeft, ChevronRight } from "lucide-react"

const siteUrl = getSiteUrl()

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    return { title: "Article Not Found" }
  }

  const canonicalUrl = `${siteUrl}/blog/${slug}`

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonicalUrl,
      type: "article",
      publishedTime: new Date(post.publishedAt).toISOString(),
      authors: [post.author],
      images: [
        {
          url: post.coverImage,
          width: 1200,
          height: 675,
          alt: post.coverImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [post.coverImage],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    notFound()
  }

  const related = BLOG_POSTS.filter((p) => p.slug !== slug && p.category === post.category).slice(0, 2)
  const moreRelated =
    related.length >= 2
      ? related
      : [
          ...related,
          ...BLOG_POSTS.filter((p) => p.slug !== slug && !related.some((r) => r.slug === p.slug)).slice(
            0,
            2 - related.length
          ),
        ]

  return (
    <>
      <BlogArticleJsonLd post={post} urlPath={`/blog/${slug}`} />

      <article className="bg-white">
        <div className="relative mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
          <nav
            className="mb-6 flex items-center space-x-2 text-xs font-medium text-neutral-500"
            aria-label="Breadcrumb"
          >
            <Link href="/welcome" className="transition-colors hover:text-primary-700">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <Link href="/blog" className="transition-colors hover:text-primary-700">
              Blog
            </Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="max-w-[200px] truncate text-neutral-900 sm:max-w-sm" aria-current="page">
              {post.title}
            </span>
          </nav>

          <Link
            href="/blog"
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 transition-colors hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to blog
          </Link>

          <header className="max-w-3xl">
            <span className="inline-flex items-center rounded-md bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-800 ring-1 ring-primary-600/10">
              {post.category}
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-neutral-900 sm:text-4xl md:text-5xl">
              {post.title}
            </h1>
            <p className="mt-4 text-lg font-normal leading-relaxed text-neutral-600">{post.description}</p>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-500">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-neutral-400" aria-hidden />
                {post.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-neutral-400" aria-hidden />
                {post.publishedAt}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-neutral-400" aria-hidden />
                {post.readTime}
              </span>
            </div>
          </header>
        </div>

        <div className="mx-auto mt-8 max-w-5xl px-4 sm:mt-10 sm:px-6">
          <BlogCoverImage
            src={post.coverImage}
            alt={post.coverImageAlt}
            priority
            className="aspect-[21/9] w-full rounded-2xl"
            sizes="(max-width: 1200px) 100vw, 1024px"
          />
        </div>

        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <MarkdownContent content={post.content} />
        </div>

        {moreRelated.length > 0 ? (
          <aside className="border-t border-neutral-200 bg-neutral-50/60 py-12 md:py-16">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <h2 className="text-lg font-bold text-neutral-900">Continue reading</h2>
              <div className="mt-6 grid gap-8 sm:grid-cols-2">
                {moreRelated.map((relatedPost) => (
                  <BlogPostCard key={relatedPost.slug} post={relatedPost} />
                ))}
              </div>
            </div>
          </aside>
        ) : null}
      </article>
    </>
  )
}
