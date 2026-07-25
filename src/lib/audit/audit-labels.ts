import type { AuditLogRecord } from "@/lib/audit/audit-log-service"

type Translate = (key: string, fallback: string) => string

/** English staff-facing labels for known audit actions (DB still stores technical keys). */
export const AUDIT_ACTION_LABELS_EN: Record<string, string> = {
  "patient.create": "Patient file created",
  "patient.update": "Patient file updated",
  "organization.update": "Organization profile updated",
  "branch.create": "Branch created",
  "branch.update": "Branch updated",
  "branch.deactivate": "Branch deactivated",
  "staff.deactivate": "Staff deactivated",
  "staff.reactivate": "Staff reactivated",
  "staff.assign": "Staff assigned to branch",
  "staff.unassign": "Staff removed from branch",
  "staff.invite": "Staff invited / added",
  "staff.invite.revoke": "Staff invitation revoked",
  "invoice.create": "Invoice created",
  "invoice.payment": "Payment collected",
  "invoice.void": "Invoice voided",
  "invoice.payment_delete": "Payment deleted",
  "appointment.create": "Appointment booked",
  "treatment_plan.create": "Treatment plan created",
  "medical_history.ocr_import": "Medical history imported from paper",
  "checkin.consent_override": "Check-in consent override",
  "session.login": "Signed in",
  "session.logout": "Signed out",
  "encounter.auto_close": "Today’s visit closed automatically",
  "encounter.reopen": "Visit reopened (undo discharge)",
  "encounter.cancel": "Visit cancelled",
  "encounter.close": "Visit discharged",
  "invoice.auto_draft_from_plan": "Invoice drafted from treatment plan",
  "treatment_plan.approved": "Treatment plan approved",
  "treatment_plan.item_add": "Treatment plan item added",
  "consent.signed": "Consent signed",
  "consent.pdf_stored": "Consent PDF stored",
  "consent.ensure": "Consent record verified",
  "queue.status_change": "Queue status updated",
  "queue_entry.status_change": "Queue status updated",
}

export const AUDIT_ENTITY_LABELS_EN: Record<string, string> = {
  patient: "Patient",
  patients: "Patient",
  invoice: "Invoice",
  invoices: "Invoice",
  appointment: "Appointment",
  appointments: "Appointment",
  branch: "Branch",
  branches: "Branch",
  organization: "Organization",
  staff: "Staff",
  profile: "Staff",
  treatment_plan: "Treatment plan",
  treatment_plan_item: "Treatment plan item",
  patient_consent: "Consent",
  patient_medical_history: "Medical history",
  medical_history: "Medical history",
  queue_entry: "Queue",
  queue: "Queue",
  consent: "Consent",
  session: "Session",
  patient_encounter: "Visit",
  encounter: "Visit",
}

function actionMessageKey(action: string): string {
  return action.replace(/\./g, "_")
}

/** Title-case unknown keys: checkin.consent_override → Check-in consent override */
export function humanizeAuditActionKey(action: string): string {
  const spaced = action
    .replace(/[._]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase()
  if (!spaced) return action
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bCheckin\b/g, "Check-in")
}

export function formatAuditActionLabel(action: string, t: Translate): string {
  const fallback = AUDIT_ACTION_LABELS_EN[action] ?? humanizeAuditActionKey(action)
  return t(`auditLog.action.${actionMessageKey(action)}`, fallback)
}

export function formatAuditEntityLabel(entityType: string | null | undefined, t: Translate): string {
  if (!entityType) return ""
  const key = entityType.toLowerCase()
  const fallback = AUDIT_ENTITY_LABELS_EN[key] ?? humanizeAuditActionKey(entityType)
  return t(`auditLog.entity.${actionMessageKey(key)}`, fallback)
}

export function formatAuditDetailsLabel(log: AuditLogRecord, t: Translate): string {
  const meta = log.metadata || {}

  switch (log.action) {
    case "staff.invite": {
      const email = String(meta.email || "")
      const mode = String(meta.mode || "")
      if (mode === "direct") {
        return t("auditLog.details.staff_invite_direct", `Email: {email} (Direct add)`).replace(
          "{email}",
          email
        )
      }
      return t("auditLog.details.staff_invite_sent", `Email: {email} (Invitation sent)`).replace(
        "{email}",
        email
      )
    }
    case "staff.invite.revoke": {
      const email = String(meta.email || "—")
      return t(
        "auditLog.details.staff_invite_revoke",
        `Revoked invitation for email: {email}`
      ).replace("{email}", email)
    }
    case "staff.deactivate":
      return t("auditLog.details.staff_deactivate", "Staff account deactivated.")
    case "staff.reactivate":
      return t("auditLog.details.staff_reactivate", "Staff account reactivated.")
    case "staff.assign": {
      const branchId = String(meta.branch_id || "—")
      const roleName = String(meta.role_name || "—")
      return t("auditLog.details.staff_assign", `Branch: {branch_id} (Role: {role_name})`)
        .replace("{branch_id}", branchId)
        .replace("{role_name}", roleName)
    }
    case "staff.unassign": {
      const branchId = String(meta.branch_id || "—")
      return t(
        "auditLog.details.staff_unassign",
        `Removed assignment from branch: {branch_id}`
      ).replace("{branch_id}", branchId)
    }
    case "patient.create":
      return t("auditLog.details.patient_create", "New patient record created.")
    case "patient.update": {
      if (meta.from_plan) {
        const fromPlan = String(meta.from_plan)
        return t(
          "auditLog.details.patient_update_invoice",
          `Invoice generated from treatment plan ({from_plan})`
        ).replace("{from_plan}", fromPlan)
      }
      if (meta.note_id) {
        return t("auditLog.details.patient_update_note", "Clinical note added to patient.")
      }
      return t("auditLog.details.patient_update_profile", "Patient profile information updated.")
    }
    case "treatment_plan.item_add": {
      const procName = String(meta.item_name || meta.procedure_name || meta.name || meta.description || "")
      const tooth = meta.tooth_number ? ` (Tooth #${meta.tooth_number})` : ""
      const price = meta.estimated_price || meta.price
        ? ` — ₱${Number(meta.estimated_price || meta.price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : ""
      if (procName) {
        return `Added procedure to plan: ${procName}${tooth}${price}`
      }
      return "New procedure item added to treatment plan."
    }
    case "treatment_plan.approved": {
      const totalEstimated = meta.total_estimated != null
        ? ` (est. ₱${Number(meta.total_estimated).toLocaleString("en-PH", { minimumFractionDigits: 2 })})`
        : ""
      return `Treatment plan approved by clinician${totalEstimated}.`
    }
    case "invoice.auto_draft_from_plan": {
      return "Draft invoice auto-generated from approved treatment plan."
    }
    case "consent.signed": {
      const title = String(meta.form_title || meta.title || meta.template_name || "")
      return title ? `Patient signed consent form: ${title}` : "Informed consent form signed by patient."
    }
    case "consent.pdf_stored":
      return "Signed consent form PDF generated and archived."
    case "consent.ensure":
      return "Consent form verified and attached to patient record."
    case "queue.status_change":
    case "queue_entry.status_change": {
      const status = String(meta.to_status || meta.status || "").replace(/_/g, " ")
      const statusUpper = status ? status.replace(/\b\w/g, (c) => c.toUpperCase()) : ""
      return statusUpper ? `Patient queue status updated to: ${statusUpper}` : "Patient queue status updated."
    }
    case "encounter.auto_close":
    case "encounter.close":
      return "Patient visit session completed and discharged."
    case "encounter.reopen":
      return "Patient visit session reopened for clinical updates."
    case "encounter.cancel":
      return "Patient visit session cancelled."
    case "invoice.payment": {
      const amount = Number(meta.amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
      })
      const method = String(meta.payment_method || "cash").toUpperCase()
      return t(
        "auditLog.details.invoice_payment",
        `Payment amount: ₱{amount} ({method})`
      )
        .replace("{amount}", amount)
        .replace("{method}", method)
    }
    case "invoice.void": {
      const reason = String(meta.reason || "—")
      return t("auditLog.details.invoice_void", `Invoice voided. Reason: {reason}`).replace(
        "{reason}",
        reason
      )
    }
    case "invoice.payment_delete": {
      return t("auditLog.details.invoice_payment_delete", "Payment record deleted.")
    }
    case "branch.create": {
      const name = String(meta.name || "—")
      return t("auditLog.details.branch_create", `New branch created: {name}`).replace("{name}", name)
    }
    case "branch.update": {
      const name = String(meta.name || "—")
      return t("auditLog.details.branch_update", `Branch updated: {name}`).replace("{name}", name)
    }
    case "organization.update":
      return t("auditLog.details.organization_update", "Organization settings updated.")
    case "session.login":
      return t("auditLog.details.session_login", "Signed in successfully.")
    case "session.logout":
      return t("auditLog.details.session_logout", "Signed out successfully.")
    case "treatment_plan.create": {
      const itemCount = String(meta.item_count || "0")
      const totalEstimated = Number(meta.total_estimated || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
      })
      return t(
        "auditLog.details.treatment_plan_create",
        `Treatment plan created ({item_count} items, est. ₱{total_estimated})`
      )
        .replace("{item_count}", itemCount)
        .replace("{total_estimated}", totalEstimated)
    }
    case "invoice.create": {
      const amount = Number(meta.amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
      })
      return t("auditLog.details.invoice_create", `Invoice created (₱{amount})`).replace(
        "{amount}",
        amount
      )
    }
    case "appointment.create": {
      const date = String(meta.to || meta.date || "—")
      return t("auditLog.details.appointment_create", `Appointment booked ({date})`).replace(
        "{date}",
        date
      )
    }
    case "medical_history.ocr_import": {
      const version = meta.version != null ? String(meta.version) : null
      return version
        ? t(
            "auditLog.details.medical_history_ocr_import",
            `Paper form imported as medical history version {version}`
          ).replace("{version}", version)
        : t(
            "auditLog.details.medical_history_ocr_import_plain",
            "Paper form imported into medical history."
          )
    }
    case "checkin.consent_override":
      return t(
        "auditLog.details.checkin_consent_override",
        "Staff overrode a missing consent during check-in."
      )
    default: {
      // Smart metadata extraction instead of generic boilerplate
      if (meta.title || meta.name || meta.item_name || meta.description) {
        const text = String(meta.title || meta.name || meta.item_name || meta.description)
        return `Record updated: ${text}`
      }
      if (meta.reason) return `Reason: ${String(meta.reason)}`
      if (meta.status) return `Status changed to: ${String(meta.status)}`
      const keys = Object.keys(meta)
      if (keys.length === 0) return "—"
      return t("auditLog.details.generic", "Clinical audit event logged.")
    }
  }
}
