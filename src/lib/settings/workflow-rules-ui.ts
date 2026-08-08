type Translate = (key: string, fallback: string) => string

/** How honest the toggle is about what the product actually does. */
export type WorkflowRuleHonesty =
  /** Toggle is enforced by backend / cron / UI gates. */
  | "live"
  /** Toggle only emits an analytics/audit event; core side effect always runs. */
  | "event_only"
  /** Setting is stored but no front-desk or queue UI reads it yet. */
  | "not_wired"

export type WorkflowRuleUi = {
  key: string
  label: string
  description: string
  honesty: WorkflowRuleHonesty
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
          honesty: "live",
          label: t("settings.wfCheckinApptLabel", "Check-in updates appointment"),
          description: t(
            "settings.wfCheckinApptDesc",
            "When a patient is checked in from the queue, linked appointment moves to checked_in."
          ),
        },
        {
          key: "auto_served_completes_appointment",
          honesty: "live",
          label: t("settings.wfServedApptLabel", "Served completes appointment"),
          description: t(
            "settings.wfServedApptDesc",
            "Marking queue entry as served completes the linked appointment."
          ),
        },
        {
          key: "consent_gate_checkin",
          honesty: "live",
          label: t("settings.wfConsentGateLabel", "Consent gate on check-in"),
          description: t(
            "settings.wfConsentGateDesc",
            "Block check-in when intake consents are unsigned; staff can override with audit. Procedure consents are collected at the chair."
          ),
        },
        {
          key: "auto_waitlist_on_slot_open",
          honesty: "live",
          label: t("settings.wfWaitlistLabel", "No-show opens waitlist slot"),
          description: t(
            "settings.wfWaitlistDesc",
            "Cancelled or no-show appointments notify matching waitlist entries."
          ),
        },
        {
          key: "auto_no_show_after_grace",
          honesty: "live",
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
          honesty: "event_only",
          label: t("settings.wfPlanApproveLabel", "Log plan-approval automation"),
          description: t(
            "settings.wfPlanApproveDesc",
            "When on, plan approval writes an automation event for analytics. An invoice draft is always created on approval — this toggle does not skip billing."
          ),
        },
        {
          key: "auto_hmo_claim_on_invoice",
          honesty: "live",
          label: t("settings.wfHmoClaimLabel", "Invoice creates HMO claim draft"),
          description: t(
            "settings.wfHmoClaimDesc",
            "Issued invoice with HMO coverage spawns a draft HMO claim."
          ),
        },
        {
          key: "auto_payment_reminder",
          honesty: "live",
          label: t("settings.wfPaymentReminderLabel", "Payment balance reminders"),
          description: t(
            "settings.wfPaymentReminderDesc",
            "Overdue balances enqueue SMS reminders via payment-reminder-cron."
          ),
        },
        {
          key: "billing_gate_block_services",
          honesty: "live",
          label: t("settings.wfBillingGateLabel", "Billing gate on booking and check-in"),
          description: t(
            "settings.wfBillingGateDesc",
            "At check-in and booking: block only overdue balances or totals ≥ ₱5,000. At checkout and clinical steps: full clearance. Staff can override with audit."
          ),
        },
        {
          key: "require_deposit_on_book",
          honesty: "not_wired",
          label: t("settings.wfDepositLabel", "Warn when booking without deposit"),
          description: t(
            "settings.wfDepositDesc",
            "Planned policy reminder for bookings without a deposit. Not shown in the booking UI yet — toggle is stored only."
          ),
        },
        {
          key: "no_show_fee_policy",
          honesty: "not_wired",
          label: t("settings.wfNoShowFeeLabel", "No-show fee policy reminder"),
          description: t(
            "settings.wfNoShowFeeDesc",
            "Planned reminder when marking no-show. Not shown in appointments or queue yet — toggle is stored only."
          ),
        },
      ],
    },
    {
      title: t("settings.wfGroupClinical", "Visits & Clinical"),
      items: [
        {
          key: "auto_draft_soap_on_chair",
          honesty: "live",
          label: t("settings.wfDraftSoapLabel", "Draft SOAP when in chair"),
          description: t(
            "settings.wfDraftSoapDesc",
            "When a patient moves to the chair, create a draft clinical note — optionally pre-filled from the last signed SOAP."
          ),
        },
        {
          key: "auto_served_creates_invoice",
          honesty: "live",
          label: t("settings.wfServedInvoiceLabel", "Treatment done creates invoice draft"),
          description: t(
            "settings.wfServedInvoiceDesc",
            "When a queue entry is marked treatment done, spawn an invoice draft from the visit's approved treatment plan."
          ),
        },
        {
          key: "auto_close_encounter_on_payment",
          honesty: "live",
          label: t("settings.wfCloseVisitLabel", "Payment closes visit"),
          description: t(
            "settings.wfCloseVisitDesc",
            "When a visit-linked invoice is fully paid, automatically close the open visit."
          ),
        },
      ],
    },
    {
      title: t("settings.wfGroupInventory", "Clinical Inventory"),
      items: [
        {
          key: "auto_deduct_procedure_bom",
          honesty: "live",
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
          honesty: "live",
          label: t("settings.wfSmsRemindersLabel", "SMS appointment reminders"),
          description: t(
            "settings.wfSmsRemindersDesc",
            "T-24h and T-2h appointment reminders via appointment-reminders-cron."
          ),
        },
        {
          key: "auto_hygiene_recall",
          honesty: "live",
          label: t("settings.wfHygieneRecallLabel", "Hygiene recall SMS"),
          description: t(
            "settings.wfHygieneRecallDesc",
            "Patients due for check-up receive SMS with booking link via recall-reminder-cron. Interval months are set below (default 6) and also drive the Recare worklist."
          ),
        },
        {
          key: "auto_owner_digest_sms",
          honesty: "live",
          label: t("settings.wfOwnerDigestLabel", "Owner daily digest SMS"),
          description: t(
            "settings.wfOwnerDigestDesc",
            "End-of-day branch summary SMS to owner/admin phones via owner-digest-sms-cron."
          ),
        },
        {
          key: "auto_review_request_sms",
          honesty: "live",
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
