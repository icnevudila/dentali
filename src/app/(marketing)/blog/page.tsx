import type { Metadata } from "next"
import Link from "next/link"
import { BLOG_POSTS } from "@/lib/marketing/blog-data"
import { BlogPostCard } from "@/components/marketing/BlogPostCard"
import { BlogCoverImage } from "@/components/marketing/BlogCoverImage"
import { getSiteUrl } from "@/lib/site-url"
import { BookOpen, ArrowRight } from "lucide-react"

const siteUrl = getSiteUrl()
const [featured, ...rest] = BLOG_POSTS

export const metadata: Metadata = {
  title: "Dental Blog — Oral Health Tips & Clinic Insights",
  description:
    "Expert dental articles for patients and clinic teams in the Philippines — preventive care, treatments, orthodontics, implants, and practice operations.",
  alternates: { canonical: `${siteUrl}/blog` },
  openGraph: {
    title: "Dental Blog | dentali.",
    description:
      "Cover stories and guides on oral health, cosmetic dentistry, pediatric care, and running a modern Philippine dental clinic.",
    url: `${siteUrl}/blog`,
    type: "website",
    images: featured
      ? [{ url: featured.coverImage, width: 1200, height: 675, alt: featured.coverImageAlt }]
      : undefined,
  },
}

export default function BlogPage() {
  return (
    <div className="bg-neutral-50/50 py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-600/10">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              Dental Blog
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">
              Oral health & clinic insights
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-neutral-600">
              Practical guides for patients and dental teams — from check-ups and braces to queue flow
              and clinic software in the Philippines.
            </p>
          </div>

          {featured ? (
            <Link
              href={`/blog/${featured.slug}`}
              className="group relative mt-10 grid overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-primary-200 hover:shadow-md md:grid-cols-2"
            >
              <BlogCoverImage
                src={featured.coverImage}
                alt={featured.coverImageAlt}
                priority
                className="aspect-[16/10] min-h-[220px] md:aspect-auto md:min-h-full"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="flex flex-col justify-center p-6 sm:p-8">
                <span className="w-fit rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-800">
                  Featured · {featured.category}
                </span>
                <h2 className="mt-3 text-2xl font-bold text-neutral-900 transition-colors group-hover:text-primary-700 sm:text-3xl">
                  {featured.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600 line-clamp-3 sm:text-base">
                  {featured.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary-700">
                  Read article
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
            </Link>
          ) : null}

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post, index) => (
              <BlogPostCard key={post.slug} post={post} priorityImage={index < 2} />
            ))}
          </div>
        </div>
      </div>
  )
}
