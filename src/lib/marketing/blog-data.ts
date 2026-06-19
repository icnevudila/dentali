export interface BlogPost {
  slug: string
  title: string
  description: string
  category: string
  readTime: string
  publishedAt: string
  author: string
  coverImage: string
  coverImageAlt: string
  content: string
}

/** Unsplash cover URLs — optimized for OG cards (1200×675). */
const cover = (id: string) =>
  `https://images.unsplash.com/${id}?w=1200&h=675&fit=crop&q=80&auto=format`

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-often-dental-checkup",
    title: "How Often Should You Visit the Dentist? A Practical Guide for Filipino Families",
    description:
      "Learn the recommended dental check-up schedule for children, adults, and seniors — and when to book sooner than twice a year.",
    category: "Preventive Care",
    readTime: "4 min read",
    publishedAt: "June 10, 2026",
    author: "Dr. Elena Santos, DMD",
    coverImage: cover("photo-1606811841689-23dfddce3e95"),
    coverImageAlt: "Dentist examining a patient during a routine check-up",
    content: `
# How Often Should You Visit the Dentist?

Most dental associations recommend a **professional check-up and cleaning every six months** for healthy adults. In the Philippines, where sweet snacks and bottled drinks are part of daily life, that rhythm helps catch cavities and gum inflammation before they become painful emergencies.

---

## Children (ages 1–12)

- First visit within **six months of the first tooth** or by age one.
- Every **6 months** once primary teeth are in, unless your dentist suggests more frequent visits for braces or high cavity risk.
- Sealants and fluoride treatments often happen at these visits — they are among the most cost-effective preventive steps.

---

## Teens and adults

- **Twice yearly** cleanings for patients with stable gum health and no active treatment.
- **Every 3–4 months** if you have history of gum disease, heavy tartar buildup, smoking, or uncontrolled diabetes.
- Pregnant patients should maintain regular visits; hormonal changes can worsen gingivitis.

---

## When to book sooner

Do not wait for your next routine appointment if you notice:
- Persistent toothache or sensitivity to hot/cold
- Bleeding gums when brushing or flossing
- Swelling in the cheek or jaw
- A broken filling, crown, or orthodontic wire

---

## Making visits easier

Clinics that use digital charting, SMS reminders, and clear queue displays reduce no-shows and help families stay on schedule. Consistent prevention almost always costs less than emergency treatment.
    `,
  },
  {
    slug: "signs-you-need-root-canal",
    title: "7 Signs You May Need a Root Canal (And What Happens Next)",
    description:
      "Throbbing pain, lingering sensitivity, and gum swelling can signal deep infection. Here is how dentists decide when root canal therapy is the right choice.",
    category: "Treatments",
    readTime: "6 min read",
    publishedAt: "June 8, 2026",
    author: "Dr. Marco Reyes, DMD",
    coverImage: cover("photo-1752842936210-dd34c42ff484"),
    coverImageAlt: "Dental instruments prepared for endodontic treatment",
    content: `
# 7 Signs You May Need a Root Canal

A **root canal** treats infection inside the tooth pulp — the soft tissue containing nerves and blood vessels. Modern techniques make the procedure far more comfortable than its reputation suggests, and it often saves a tooth that would otherwise need extraction.

---

## Common warning signs

1. **Severe toothache** that wakes you at night or throbs without a clear trigger
2. **Prolonged sensitivity** after hot, cold, or sweet foods
3. **Darkening** of a single tooth compared to neighbors
4. **Swollen, tender gums** near one tooth
5. **A pimple-like bump** on the gum (dental abscess)
6. **Pain when biting down** on a specific tooth
7. **Recent deep decay** or a crack reaching the nerve

---

## What the dentist does

- Digital X-rays confirm how far infection has spread.
- Local anesthesia numbs the area; many patients compare the visit to a long filling appointment.
- Infected pulp is removed, canals are shaped and disinfected, then sealed.
- A crown is often recommended afterward to protect the weakened tooth.

---

## Alternatives and timing

If the tooth cannot be restored, extraction and implant or bridge options are discussed. **Earlier treatment** usually means less pain, lower cost, and higher success rates — do not ignore symptoms for weeks hoping they will pass.
    `,
  },
  {
    slug: "braces-vs-clear-aligners-philippines",
    title: "Braces vs Clear Aligners in the Philippines: Cost, Comfort, and Results",
    description:
      "Metal braces, ceramic braces, and invisible aligners each fit different lifestyles. Compare timelines, pricing factors, and maintenance in local clinics.",
    category: "Orthodontics",
    readTime: "7 min read",
    publishedAt: "June 5, 2026",
    author: "Dr. Ana Villanueva, DMD",
    coverImage: cover("photo-1588776814546-1ffcf47267a5"),
    coverImageAlt: "Patient smiling during orthodontic consultation",
    content: `
# Braces vs Clear Aligners in the Philippines

Orthodontic treatment is more accessible than ever in Metro Manila and provincial cities. The right system depends on **case complexity**, **budget**, and how disciplined you are about wear time.

---

## Traditional metal braces

- Best for **complex bite corrections** and significant crowding.
- Fixed appliances — no risk of forgetting to wear them.
- Adjustments every 4–6 weeks; some dietary limits (sticky, very hard foods).

---

## Ceramic braces

- Tooth-colored brackets blend better for adults in client-facing jobs.
- Similar mechanics to metal; slightly higher material cost.

---

## Clear aligners

- Removable trays changed every 1–2 weeks; popular with professionals.
- Require **20–22 hours daily wear** — non-compliance slows results.
- Excellent for mild-to-moderate spacing and alignment issues.

---

## Cost factors in PH clinics

Pricing varies by clinic tier, orthodontist experience, case length, and whether retainers and records are bundled. Ask for a written treatment plan with **down payment**, **monthly schedule**, and what happens if a tray is lost.

---

## Digital workflows

Clinics using 3D scans and treatment-plan software can show projected outcomes before you commit — and track progress visit by visit in the patient chart.
    `,
  },
  {
    slug: "teeth-whitening-safety-guide",
    title: "Is Teeth Whitening Safe? Professional vs Over-the-Counter Options",
    description:
      "Whitening toothpastes, salon kits, and in-clinic bleaching differ in strength and safety. Learn what works and what can damage enamel or gums.",
    category: "Cosmetic Dentistry",
    readTime: "5 min read",
    publishedAt: "June 3, 2026",
    author: "Dr. Elena Santos, DMD",
    coverImage: cover("photo-1654373535457-383a0a4d00f9"),
    coverImageAlt: "Bright healthy smile after dental care",
    content: `
# Is Teeth Whitening Safe?

Whitening is one of the most requested cosmetic dental procedures. Done correctly, it is **safe for most healthy adults**; done incorrectly, it can cause sensitivity or gum irritation.

---

## Professional in-clinic whitening

- Uses controlled peroxide concentrations with gum barriers.
- Fastest results — often noticeable in a single session.
- Dentist screens for cavities, cracks, and existing restorations that will not lighten evenly.

---

## Take-home trays from your dentist

- Custom-fitted trays reduce gel contact with gums.
- Gradual whitening over 1–2 weeks; generally less sensitivity than one-shot power bleaching.

---

## Over-the-counter products

- Whitening toothpastes remove surface stains; they rarely change natural tooth shade dramatically.
- Generic strips may fit poorly, leading to **uneven color** or gum burns.
- Avoid non-dental "whitening bars" using unregulated chemicals.

---

## Who should wait or avoid whitening

- Pregnant or nursing patients (defer unless dentist advises)
- Active cavities, severe erosion, or untreated gum disease
- Patients under 16 unless supervised

---

## Maintaining results

Limit dark beverages (coffee, cola, soy sauce), rinse after meals, and keep regular cleanings. Touch-up kits from your clinic are safer than repeating unknown online products.
    `,
  },
  {
    slug: "child-first-dental-visit",
    title: "Your Child's First Dental Visit: Ages, Tips, and What to Expect",
    description:
      "A positive first appointment builds lifelong habits. Prepare toddlers and school-age kids with these age-specific strategies used in Philippine family clinics.",
    category: "Pediatric Dentistry",
    readTime: "5 min read",
    publishedAt: "May 28, 2026",
    author: "Dr. Sofia Mendoza, DMD",
    coverImage: cover("photo-1609840114035-3c981b782dfe"),
    coverImageAlt: "Child at a friendly pediatric dental appointment",
    content: `
# Your Child's First Dental Visit

The Philippine Pediatric Dental Society recommends the **first dental visit by age one** or within six months of the first tooth erupting. Early visits focus on guidance for parents as much as treatment for the child.

---

## What happens at the first appointment

- Knee-to-knee exam for infants; chair ride for older toddlers
- Counting teeth, checking bite and soft tissues
- Fluoride varnish when appropriate
- Coaching on brushing, bottle use, and snack timing

---

## Reducing fear

- Schedule morning appointments when children are rested
- Avoid threatening language ("shot", "pain") — clinics trained in child behavior use tell-show-do techniques
- Bring a comfort toy; reward cooperation with praise, not candy

---

## Common parent questions

**Thumb sucking?** Monitor after age four; persistent habits may affect alignment.

**Baby bottle at night?** Milk or juice pooling on teeth raises cavity risk — water only after brushing.

**When to start flossing?** When two teeth touch — usually around ages 2–3.

---

## Clinic features that help families

Digital charting, SMS reminders, and kid-friendly waiting areas make return visits predictable. Consistency matters more than a single perfect appointment.
    `,
  },
  {
    slug: "gum-disease-prevention",
    title: "Gum Disease Prevention: Gingivitis, Periodontitis, and Daily Habits",
    description:
      "Bleeding gums are not normal. Understand stages of gum disease, professional deep cleaning, and home care that protects Filipino adults at higher diabetes risk.",
    category: "Preventive Care",
    readTime: "6 min read",
    publishedAt: "May 25, 2026",
    author: "Dr. Marco Reyes, DMD",
    coverImage: cover("photo-1598256989800-fe5f95da9787"),
    coverImageAlt: "Dental professional discussing oral hygiene with a patient",
    content: `
# Gum Disease Prevention

**Gingivitis** is reversible inflammation of the gums. **Periodontitis** damages bone and ligaments supporting teeth — the leading cause of tooth loss in adults worldwide, including the Philippines.

---

## Early signs

- Bleeding when brushing or flossing
- Persistent bad breath
- Red, puffy gum margins
- Receding gums or longer-looking teeth

---

## Risk factors

- Irregular professional cleanings
- Smoking and vaping
- Uncontrolled diabetes
- Certain medications that reduce saliva flow
- Family history of periodontal disease

---

## Treatment ladder

1. **Prophylaxis** (routine cleaning) for healthy gums
2. **Scaling and root planing** (deep cleaning) for pockets and tartar below the gum line
3. **Maintenance visits** every 3–4 months for periodontitis patients
4. Referral to a periodontist for advanced cases

---

## Home care that works

- Brush twice daily with fluoride toothpaste — angle bristles toward the gum line
- Clean between teeth daily (floss, picks, or water flosser)
- Replace toothbrushes every 3 months or after illness

Gum health is linked to heart disease and glycemic control — treating gums is preventive medicine, not just cosmetics.
    `,
  },
  {
    slug: "dental-implants-guide-philippines",
    title: "Dental Implants in the Philippines: Candidacy, Healing, and Long-Term Care",
    description:
      "Missing teeth? Implants replace roots with titanium posts and custom crowns. Learn evaluation steps, healing timelines, and how clinics document implant cases.",
    category: "Restorative Dentistry",
    readTime: "8 min read",
    publishedAt: "May 20, 2026",
    author: "Dr. Ana Villanueva, DMD",
    coverImage: cover("photo-1606811971618-4486d14f3f99"),
    coverImageAlt: "Modern dental clinic treatment room",
    content: `
# Dental Implants in the Philippines

A **dental implant** is a titanium post surgically placed in the jawbone, topped with an abutment and crown after healing. Implants feel and function like natural teeth when planning and hygiene are excellent.

---

## Are you a candidate?

Dentists evaluate:
- Bone volume (CBCT scan when needed)
- Gum health and bite forces
- Medical history — uncontrolled diabetes, heavy smoking, or certain medications may require coordination with your physician
- Commitment to oral hygiene and follow-up

---

## Typical timeline

1. Extraction and grafting (if required) — healing weeks to months
2. Implant placement — osseointegration often **3–6 months** in the lower jaw, sometimes longer upstairs
3. Abutment and crown delivery
4. Annual review of bite and peri-implant tissues

---

## Costs and documentation

Philippine clinics may bundle surgical, prosthetic, and lab fees differently. Request itemized quotes and warranty terms on the crown and hardware. Reputable practices document every stage in the digital chart for medico-legal clarity.

---

## Caring for implants

Brush and floss around implants like natural teeth; use interdental brushes for tight spaces. Peri-implantitis (inflammation around implants) is preventable with professional maintenance — skip cleanings and bone loss can follow.
    `,
  },
  {
    slug: "clinic-queue-display",
    title: "How Clinic Queue Displays Transform the Patient Experience in the Philippines",
    description:
      "Learn how modern digital TV queue boards reduce perceived wait times, eliminate waiting room anxiety, and optimize clinic workflow.",
    category: "Practice Operations",
    readTime: "5 min read",
    publishedAt: "June 15, 2026",
    author: "Dr. Elena Santos, DMD",
    coverImage: cover("photo-1519494026892-80bbd2d6fd0d"),
    coverImageAlt: "Modern clinic waiting area with comfortable seating",
    content: `
# How Clinic Queue Displays Transform the Patient Experience in the Philippines

Waiting rooms in Philippine dental clinics are undergoing a digital revolution. Long wait times, confusing verbal queue calls, and overcrowded seating areas are being replaced by sleek, dynamic **TV display boards** that keep patients informed, relaxed, and engaged.

---

## 1. Eliminating Waiting Room Anxiety

For many patients, dental anxiety starts the moment they sit in the waiting room. The uncertainty of when they will be called only heightens this stress.

A live TV display board addresses this directly:
- **Visual Assurance**: Patients can see exactly where they stand in the queue.
- **Masked Names for Privacy**: Displays balance transparency with patient privacy.
- **Audio Prompts**: Gentle chime alerts followed by localized voice announcements.

---

## 2. Reducing Perceived Wait Time

Studies show that **occupied time feels shorter than unoccupied time**. Educational slides, weather, and oral health tips shift attention away from the clock.

---

## 3. Seamless Integration with Clinic Workflows

With modern clinic operating systems, the display syncs with the doctor's dashboard — real-time status updates without duplicate admin work.

---

## 4. Establishing a Premium Brand Image

A state-of-the-art display signals **professionalism, efficiency, and premium care** from the first minute patients arrive.
    `,
  },
  {
    slug: "dental-clinic-software-philippines",
    title: "Selecting the Best Dental Clinic Software in the Philippines: A Comprehensive Guide",
    description:
      "What to look for in a dental clinic operating system in the Philippines, from PhilHealth eClaims integration to PayMongo payment processing.",
    category: "Technology",
    readTime: "7 min read",
    publishedAt: "June 12, 2026",
    author: "dentali Engineering Team",
    coverImage: cover("photo-1576091160399-112ba8d25d1d"),
    coverImageAlt: "Healthcare professional using digital clinic software on a tablet",
    content: `
# Selecting the Best Dental Clinic Software in the Philippines

Running a successful dental practice in the Philippines requires efficient scheduling, robust billing, inventory tracking, and seamless compliance with local regulations.

---

## 1. Compliance with Philippine Regulatory Frameworks

- **PhilHealth eClaims Integration**
- **BIR-Compliant Invoicing**
- **Data Privacy Act (DPA) Compliance** with RBAC

---

## 2. Localized Payment & SMS Solutions

- **SMS Reminders via Semaphore**
- **PayMongo Integration** for GCash, Maya, and cards

---

## 3. Interactive Graphical Odontogram

Modern software should feature a responsive digital **odontogram** linked to treatment plans and billing.

---

## 4. Multi-Branch Operations

Centralized registry, staff permissions per branch, and aggregated analytics for growing dental groups.

---

## Conclusion

Choosing the right dental clinic software is an investment in your clinic's growth. Prioritize local compliance, patient-facing features, and seamless clinical workflow.
    `,
  },
]

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug)
}
