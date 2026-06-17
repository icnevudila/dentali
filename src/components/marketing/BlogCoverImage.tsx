import Image from "next/image"
import { cn } from "@/lib/utils"

type BlogCoverImageProps = {
  src: string
  alt: string
  priority?: boolean
  className?: string
  sizes?: string
}

export function BlogCoverImage({
  src,
  alt,
  priority = false,
  className,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
}: BlogCoverImageProps) {
  return (
    <div className={cn("relative overflow-hidden bg-neutral-100", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </div>
  )
}
