# Medical history phone OCR precision (Phase 1)

## Goal

Improve “Import from paper” for real clinic phone photos (skew, glare, imperfect framing)—not only flat aligned samples—without building a full document-scanner pipeline yet.

## Approach

1. **Better capture input** — tips + visual guide overlay before photo.
2. **Client image prep** — orientation-safe downscale, mild contrast, JPEG quality tune (max edge ~2048).
3. **Stronger Gemini extraction prompt** — phone-photo rules, checked checkboxes only, no invented meds/allergies, per-field confidence.
4. **Review safety** — highlight low-confidence fields; staff must Apply → Save new version (no silent overwrite).

## Out of scope (Phase 2)

- Perspective warp / edge detection
- Multi-page PDF OCR
- Dedicated scanner SDK

## Safety

- No PHI in logs.
- Sample form hash shortcut remains for QA.
- Medical history stays versioned; OCR never overwrites silently.
