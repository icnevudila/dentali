import Link from "next/link"
import { Calendar, Clock, ArrowRight } from "lucide-react"
import type { BlogPost } from "@/lib/marketing/blog-data"
import { BlogCoverImage } from "@/components/marketing/BlogCoverImage"

type BlogPostCardProps = {
  post: BlogPost
  hrefPrefix?: string
  priorityImage?: boolean
}

export function BlogPostCard({ post, hrefPrefix = "/blog", priorityImage = false }: BlogPostCardProps) {
  const href = `${hrefPrefix}/${post.slug}`

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-md">
      <BlogCoverImage
        src={post.coverImage}
        alt={post.coverImageAlt}
        priority={priorityImage}
        className="aspect-[16/10] w-full"
      />

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex rounded-md bg-primary-50 px-2 py-1 font-medium text-primary-800 ring-1 ring-primary-600/10">
            {post.category}
          </span>
          <span className="text-neutral-400">•</span>
          <span className="flex items-center gap-1 text-neutral-500">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {post.readTime}
          </span>
        </div>

        <h2 className="mt-3 text-lg font-bold leading-snug text-neutral-900 transition-colors group-hover:text-primary-700 sm:text-xl">
          <Link href={href} className="focus:outline-none after:absolute after:inset-0">
            {post.title}
          </Link>
        </h2>

        <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600 line-clamp-3">
          {post.description}
        </p>

        <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
            {post.publishedAt}
          </span>
          <span className="flex items-center gap-1 font-semibold text-primary-700 transition-transform group-hover:translate-x-0.5">
            Read
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </article>
  )
}
