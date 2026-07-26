import { notFound } from "next/navigation"

/**
 * Guarantee certificates were placeholder-only (no DB record).
 * Re-enable when treatment_guarantees persistence ships.
 */
export default function GuaranteeCertificatePrintPage() {
  notFound()
}
