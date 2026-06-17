import type { BlogPost } from "@/lib/marketing/blog-data"
import { getSiteUrl } from "@/lib/site-url"

type BlogArticleJsonLdProps = {
  post: BlogPost
  urlPath: string
}

export function BlogArticleJsonLd({ post, urlPath }: BlogArticleJsonLdProps) {
  const siteUrl = getSiteUrl()
  const url = `${siteUrl}${urlPath}`

  const payload = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    image: [post.coverImage],
    datePublished: new Date(post.publishedAt).toISOString(),
    author: {
      "@type": "Person",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: "dentali.",
      url: siteUrl,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    articleSection: post.category,
    url,
  }

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }} />
  )
}
