import { LandingContent } from "@/components/landing/landing-content"
import { loadShowcaseData } from "@/lib/showcase/load-showcase-data"

export default async function WelcomePage() {
  const showcase = await loadShowcaseData()
  return <LandingContent showcase={showcase} />
}
