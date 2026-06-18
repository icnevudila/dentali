/** Official PDA dental chart — print layout constants */

export const PDA_MEDICAL_HISTORY_QUESTIONS: {
  num: number
  text: string
  detail?: string
  womenOnly?: boolean
}[] = [
  { num: 1, text: "Are you in good health?" },
  { num: 2, text: "Are you under medical treatment now?", detail: "If so, what is the condition being treated?" },
  { num: 3, text: "Have you ever had serious illness or surgical operation?", detail: "If so, what illness or operation?" },
  { num: 4, text: "Have you ever been hospitalized?", detail: "If so, when and why?" },
  { num: 5, text: "Are you taking any prescription/non-prescription medication?", detail: "If so, please specify" },
  { num: 6, text: "Do you use tobacco products?" },
  { num: 7, text: "Do you use alcohol, cocaine or other dangerous drugs?" },
  { num: 8, text: "Are you allergic to any of the following:" },
  { num: 9, text: "Bleeding Time" },
  { num: 10, text: "For women only:", womenOnly: true },
  { num: 11, text: "Blood Type" },
  { num: 12, text: "Blood Pressure" },
]

export const PDA_ALLERGY_OPTIONS = [
  { key: "lidocaine", label: "Local Anesthetic" },
  { key: "penicillin", label: "Penicillin" },
  { key: "sulfa", label: "Sulfa drugs" },
  { key: "aspirin", label: "Aspirin" },
  { key: "latex", label: "Latex" },
] as const

export const PDA_WOMEN_OPTIONS = ["Pregnant", "Nursing", "Birth control pills"]

export const PDA_CONDITION_CHECKLIST: { label: string; patterns: string[] }[] = [
  { label: "High Blood Pressure", patterns: ["hypertension", "high blood"] },
  { label: "Low Blood Pressure", patterns: ["hypotension", "low blood"] },
  { label: "Epilepsy / Convulsions", patterns: ["epilepsy", "convulsion", "seizure"] },
  { label: "AIDS or HIV Infection", patterns: ["aids", "hiv"] },
  { label: "Sexually Transmitted disease", patterns: ["std", "sexually transmitted"] },
  { label: "Stomach Troubles / Ulcers", patterns: ["stomach", "ulcer", "gerd"] },
  { label: "Fainting Seizure", patterns: ["fainting", "syncope"] },
  { label: "Rapid Weight Loss", patterns: ["weight loss"] },
  { label: "Radiation Therapy", patterns: ["radiation"] },
  { label: "Joint Replacement / Implant", patterns: ["joint replacement", "implant"] },
  { label: "Heart Surgery", patterns: ["heart surgery"] },
  { label: "Heart Attack", patterns: ["heart attack", "myocardial"] },
  { label: "Thyroid Problem", patterns: ["thyroid"] },
  { label: "Heart Disease", patterns: ["heart disease"] },
  { label: "Heart Murmur", patterns: ["murmur"] },
  { label: "Hepatitis / Liver Disease", patterns: ["hepatitis", "liver"] },
  { label: "Rheumatic Fever", patterns: ["rheumatic"] },
  { label: "Hay Fever / Allergies", patterns: ["hay fever", "allerg"] },
  { label: "Respiratory Problems", patterns: ["respiratory", "copd", "breathing"] },
  { label: "Hepatitis / Jaundice", patterns: ["jaundice"] },
  { label: "Tuberculosis", patterns: ["tuberculosis", "tb"] },
  { label: "Swollen ankles", patterns: ["swollen ankle", "edema"] },
  { label: "Kidney disease", patterns: ["kidney", "renal"] },
  { label: "Diabetes", patterns: ["diabetes", "diabetic"] },
  { label: "Chest pain", patterns: ["chest pain", "angina"] },
  { label: "Stroke", patterns: ["stroke", "cva"] },
  { label: "Cancer / Tumors", patterns: ["cancer", "tumor", "malignan"] },
  { label: "Anemia", patterns: ["anemia"] },
  { label: "Angina", patterns: ["angina"] },
  { label: "Asthma", patterns: ["asthma"] },
  { label: "Emphysema", patterns: ["emphysema"] },
  { label: "Bleeding Problems", patterns: ["bleeding", "hemophilia"] },
  { label: "Blood Diseases", patterns: ["blood disease", "leukemia"] },
  { label: "Head Injuries", patterns: ["head injur"] },
  { label: "Arthritis / Rheumatism", patterns: ["arthritis", "rheumatism"] },
  { label: "Other", patterns: [] },
]

export const PDA_CONSENT_SECTIONS: { title: string; body: string }[] = [
  {
    title: "TREATMENT TO BE DONE",
    body: "I understand and consent to have any treatment done by the dentist after the procedure, the risks and benefits and costs have been fully explained. I understand that dentistry is not an exact science and that no dentist can properly guarantee accurate results all the time.",
  },
  {
    title: "DRUGS & MEDICATIONS",
    body: "I understand that antibiotics, analgesics and other medications can cause allergic reactions causing redness and swelling of tissues, pain, itching, vomiting, and/or anaphylactic shock.",
  },
  {
    title: "CHANGES IN TREATMENT PLAN",
    body: "I understand that during treatment it may be necessary to change or add procedures because of conditions found while working on the teeth that were not discovered during examination. For example root canal therapy may be needed following routine restorative procedures.",
  },
  {
    title: "RADIOGRAPH",
    body: "I understand that an x-ray shot or a radiograph is necessary to make a diagnosis and that no guarantee can be made regarding the accuracy of the diagnosis.",
  },
  {
    title: "REMOVAL OF TEETH",
    body: "I understand that alternatives to tooth removal include root canal therapy, crowns, and periodontal surgery. I understand that removing teeth does not always remove the infection and that pain, swelling, infection, and/or numbness of the lip, tongue and chin may occur.",
  },
  {
    title: "CROWNS (CAPS) & BRIDGES",
    body: "I understand that sometimes it is not possible to match the color of natural teeth exactly with artificial teeth. I understand that I must return for permanent cementation within 30 days from tooth preparation.",
  },
  {
    title: "ENDODONTICS (ROOT CANAL)",
    body: "I understand there is no guarantee that root canal treatment will save a tooth and that complications can occur from the treatment. I understand that occasionally root canal instruments may break in the canal.",
  },
  {
    title: "PERIODONTAL DISEASE",
    body: "I understand that periodontal disease is a serious condition causing gum and bone inflammation and/or loss and can lead to eventual tooth loss. I understand that procedures may have adverse effects on periodontal health.",
  },
  {
    title: "FILLINGS",
    body: "I understand that care must be exercised in chewing on fillings, especially during the first 24 hours. I understand that a crown or root canal may be needed if decay is deeper than expected.",
  },
  {
    title: "DENTURES",
    body: "I understand that wearing dentures can be difficult. Sore spots, altered speech, and difficulty in eating are common problems. Immediate dentures may require repeated adjustments and relines.",
  },
]

export const PDA_UPPER_PRIMARY = ["55", "54", "53", "52", "51", "61", "62", "63", "64", "65"]
export const PDA_UPPER_PERMANENT = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"]
export const PDA_LOWER_PERMANENT = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"]
export const PDA_LOWER_PRIMARY = ["85", "84", "83", "82", "81", "71", "72", "73", "74", "75"]

export const PDA_LEGEND_CONDITION = [
  "✓ — Present Teeth",
  "D — Decayed (Caries Indicated for Filling)",
  "M — Missing due to Caries",
  "MO — Missing due to Other Causes",
  "Im — Impacted Tooth",
  "Sp — Supernumerary Tooth",
  "Rf — Root Fragment",
  "Un — Unerupted",
]

export const PDA_LEGEND_RESTORATION = [
  "Am — Amalgam Filling",
  "Co — Composite Filling",
  "JC — Jacket Crown",
  "Ab — Abutment",
  "P — Pontic",
  "In — Inlay",
  "Imp — Implant",
  "S — Sealants",
  "Rm — Removable Denture",
]

export const PDA_LEGEND_SURGERY = [
  "X — Extraction due to Caries",
  "XO — Extraction due to Other Causes",
]
