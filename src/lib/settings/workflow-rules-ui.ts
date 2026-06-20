type Translate = (key: string, fallback: string) => string

export type WorkflowRuleUi = {
  key: string
  label: string
  description: string
}

export type WorkflowGroupUi = {
  title: string
  items: WorkflowRuleUi[]
}

export function getWorkflowGroups(t: Translate): WorkflowGroupUi[] {
  return [
    {
      title: t("settings.wfGroupQueue", "Queue & Appointments"),
      items: [
        {
          key: "auto_checkin_updates_appointment",
          label: t("settings.wfCheckinApptLabel", "Check-in updates appointment"),
          description: t(
            "settings.wfCheckinApptDesc",
            "When a patient is checked in from the queue, linked appointment moves to checked_in."
          ),
        },
        {
          key: "auto_served_completes_appointment",
          label: t("settings.wfServedApptLabel", "Served completes appointment"),
          description: t(
            "settings.wfServedApptDesc",
            "Marking queue entry as served completes the linked appointment."
          ),
        },
        {
          key: "consent_gate_checkin",
          label: t("settings.wfConsentGateLabel", "Consent gate on check-in"),
          description: t(
            "settings.wfConsentGateDesc",
            "Block check-in when intake consents are unsigned; staff can override with audit. Procedure consents are collected at the chair."
          ),
        },
        {
          key: "auto_waitlist_on_slot_open",
          label: t("settings.wfWaitlistLabel", "No-show opens waitlist slot"),
          description: t(
            "settings.wfWaitlistDesc",
            "Cancelled or no-show appointments notify matching waitlist entries."
          ),
        },
        {
          key: "auto_no_show_after_grace",
          label: t("settings.wfNoShowLabel", "Auto no-show after 15 min"),
          description: t(
            "settings.wfNoShowDesc",
            "Marks scheduled/confirmed appointments as no-show when check-in is missing. Runs on queue page refresh and appointment-reminders-cron."
          ),
        },
      ],
    },
    {
      title: t("settings.wfGroupBilling", "Billing & Claims"),
      items: [
        {
          key: "auto_approve_creates_invoice",
          label: t("settings.wfPlanApproveLabel", "Plan approval automation event"),
          description: t(
            "settings.wfPlanApproveDesc",
            "Emit workflow automation when a plan is approved. Invoice draft is always created on approval regardless of this toggle."
          ),
        },
        {
          key: "auto_hmo_claim_on_invoice",
          label: t("settings.wfHmoClaimLabel", "Invoice creates HMO claim draft"),
          description: t(
            "settings.wfHmoClaimDesc",
            "Issued invoice with HMO coverage spawns a draft HMO claim."
          ),
        },
        {
          key: "auto_payment_reminder",
          label: t("settings.wfPaymentReminderLabel", "Payment balance reminders"),
          description: t(
            "settings.wfPaymentReminderDesc",
            "Overdue balances enqueue SMS reminders via payment-reminder-cron."
          ),
        },
        {
          key: "billing_gate_block_services",
          label: t("settings.wfBillingGateLabel", "Billing gate on booking and check-in"),
          description: t(
            "settings.wfBillingGateDesc",
            "At check-in and booking: block only overdue balances or totals ≥ ₱5,000. At checkout and clinical steps: full clearance. Staff can override with audit."
          ),
        },
      ],
    },
    {
      title: t("settings.wfGroupClinical", "Visits & Clinical"),
      items: [
        {
          key: "auto_draft_soap_on_chair",
          label: t("settings.wfDraftSoapLabel", "Draft SOAP when in chair"),
          description: t(
            "settings.wfDraftSoapDesc",
            "When a patient moves to the chair, create a draft clinical note — optionally pre-filled from the last signed SOAP."
          ),
        },
        {
          key: "auto_served_creates_invoice",
          label: t("settings.wfServedInvoiceLabel", "Served creates invoice draft"),
          description: t(
            "settings.wfServedInvoiceDesc",
            "When queue entry is marked served, spawn an invoice draft from the encounter's approved treatment plan."
          ),
        },
        {
          key: "auto_close_encounter_on_payment",
          label: t("settings.wfCloseVisitLabel", "Payment closes visit"),
          description: t(
            "settings.wfCloseVisitDesc",
            "When an encounter-linked invoice is fully paid, automatically close the open visit."
          ),
        },
      ],
    },
    {
      title: t("settings.wfGroupInventory", "Clinical Inventory"),
      items: [
        {
          key: "auto_deduct_procedure_bom",
          label: t("settings.wfBomLabel", "Auto-deduct procedure BOM"),
          description: t(
            "settings.wfBomDesc",
            "When queue entry is served, deduct linked inventory materials from approved treatment plan procedures."
          ),
        },
      ],
    },
    {
      title: t("settings.wfGroupNotifications", "Notifications"),
      items: [
        {
          key: "auto_sms_reminders",
          label: t("settings.wfSmsRemindersLabel", "SMS appointment reminders"),
          description: t(
            "settings.wfSmsRemindersDesc",
            "T-24h and T-2h appointment reminders via appointment-reminders-cron."
          ),
        },
        {
          key: "auto_hygiene_recall",
          label: t("settings.wfHygieneRecallLabel", "Hygiene recall SMS (6 months)"),
          description: t(
            "settings.wfHygieneRecallDesc",
            "Patients due for check-up receive SMS with booking link via recall-reminder-cron."
          ),
        },
        {
          key: "auto_owner_digest_sms",
          label: t("settings.wfOwnerDigestLabel", "Owner daily digest SMS"),
          description: t(
            "settings.wfOwnerDigestDesc",
            "End-of-day branch summary SMS to owner/admin phones via owner-digest-sms-cron."
          ),
        },
        {
          key: "auto_review_request_sms",
          label: t("settings.wfReviewSmsLabel", "Google review SMS after visit"),
          description: t(
            "settings.wfReviewSmsDesc",
            "When a queue entry is marked served, send a one-time SMS asking for a Google review (30-day dedupe). Set google_review_url in branch settings."
          ),
        },
      ],
    },
  ]
}
