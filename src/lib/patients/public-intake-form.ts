import type { KioskIntakePayload } from "@/lib/kiosk/kiosk-service"
import {
  emptyPatientIntakeProfile,
  parsePatientIntakeProfile,
  serializePatientIntakeProfile,
  type PatientIntakeProfile,
} from "@/lib/patients/patient-intake-profile"
import type { PatientFormValues } from "@/lib/validations/patient"

export type PublicIntakeFormState = {
  firstName: string
  lastName: string
  phone: string
  email: string
  dateOfBirth: string
  gender: string
  addressLine1: string
  city: string
  emergencyContactName: string
  emergencyContactPhone: string
  medicalAlerts: string
  intakeProfile: PatientIntakeProfile
}

export function emptyPublicIntakeFormState(): PublicIntakeFormState {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    dateOfBirth: "",
    gender: "other",
    addressLine1: "",
    city: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    medicalAlerts: "",
    intakeProfile: emptyPatientIntakeProfile(),
  }
}

export function publicIntakeToKioskPayload(state: PublicIntakeFormState): KioskIntakePayload {
  const profile = serializePatientIntakeProfile(state.intakeProfile)
  return {
    first_name: state.firstName.trim(),
    last_name: state.lastName.trim(),
    phone: state.phone.trim() || undefined,
    email: state.email.trim() || undefined,
    date_of_birth: state.dateOfBirth || undefined,
    gender: state.gender || undefined,
    address_line1: state.addressLine1.trim() || undefined,
    city: state.city.trim() || undefined,
    emergency_contact_name: state.emergencyContactName.trim() || undefined,
    emergency_contact_phone: state.emergencyContactPhone.trim() || undefined,
    medical_alerts: state.medicalAlerts.trim() || undefined,
  ...(Object.keys(profile).length > 0 ? { intake_profile: profile } : {}),
  }
}

export function payloadToPublicIntakeForm(payload: Record<string, unknown>): PublicIntakeFormState {
  return {
    firstName: String(payload.first_name ?? ""),
    lastName: String(payload.last_name ?? ""),
    phone: String(payload.phone ?? ""),
    email: String(payload.email ?? ""),
    dateOfBirth: String(payload.date_of_birth ?? ""),
    gender: String(payload.gender ?? "other"),
    addressLine1: String(payload.address_line1 ?? ""),
    city: String(payload.city ?? ""),
    emergencyContactName: String(payload.emergency_contact_name ?? ""),
    emergencyContactPhone: String(payload.emergency_contact_phone ?? ""),
    medicalAlerts: String(payload.medical_alerts ?? ""),
    intakeProfile: parsePatientIntakeProfile(payload.intake_profile),
  }
}

export function publicIntakeToPatientFormValues(state: PublicIntakeFormState): PatientFormValues {
  return {
    firstName: state.firstName,
    lastName: state.lastName,
    dateOfBirth: state.dateOfBirth,
    gender:
      state.gender === "other" || !state.gender
        ? "prefer_not_to_say"
        : (state.gender as PatientFormValues["gender"]),
    email: state.email,
    phoneNumber: state.phone,
    addressLine1: state.addressLine1,
    city: state.city,
    emergencyContactName: state.emergencyContactName,
    emergencyContactPhone: state.emergencyContactPhone,
    medicalAlerts: state.medicalAlerts,
  }
}

export function patientFormValuesToPublicIntake(
  values: Partial<PatientFormValues>,
  intakeProfile?: PatientIntakeProfile
): PublicIntakeFormState {
  return {
    ...emptyPublicIntakeFormState(),
    firstName: values.firstName ?? "",
    lastName: values.lastName ?? "",
    phone: values.phoneNumber ?? "",
    email: values.email ?? "",
    dateOfBirth: values.dateOfBirth ?? "",
    gender: values.gender ?? "prefer_not_to_say",
    addressLine1: values.addressLine1 ?? "",
    city: values.city ?? "",
    emergencyContactName: values.emergencyContactName ?? "",
    emergencyContactPhone: values.emergencyContactPhone ?? "",
    medicalAlerts: values.medicalAlerts ?? "",
    intakeProfile: intakeProfile ?? emptyPatientIntakeProfile(),
  }
}
