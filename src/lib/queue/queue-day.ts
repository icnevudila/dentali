const CLINIC_TIME_ZONE = "Asia/Manila"

export function clinicDateKey(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: CLINIC_TIME_ZONE })
}

export function isPriorClinicDay(value: string | Date, reference: string | Date = new Date()): boolean {
  return clinicDateKey(value) < clinicDateKey(reference)
}
