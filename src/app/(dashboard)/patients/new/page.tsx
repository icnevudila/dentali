"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { patientSchema, type PatientFormValues } from "@/lib/validations/patient"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ArrowLeft, UserPlus, AlertCircle } from "lucide-react"
import Link from "next/link"

export default function NewPatientPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "prefer_not_to_say",
      email: "",
      phoneNumber: "",
      addressLine1: "",
      city: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      medicalAlerts: "",
    },
  })

  async function onSubmit(data: PatientFormValues) {
    setIsSubmitting(true)
    // TODO: Connect to Supabase to insert patient and check for duplicates (Wave 2 Backend)
    console.log("Submitting patient data:", data)
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false)
      router.push("/patients")
    }, 1000)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/patients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">Register New Patient</h1>
          <p className="text-sm text-neutral-500">Enter demographic and contact details for the new patient.</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* DEMOGRAPHICS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Demographics</CardTitle>
            <CardDescription>Basic patient identification details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-900">First Name <span className="text-red-500">*</span></label>
              <Input {...form.register("firstName")} placeholder="Juan" />
              {form.formState.errors.firstName && (
                <p className="text-xs text-red-500">{form.formState.errors.firstName.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-900">Last Name <span className="text-red-500">*</span></label>
              <Input {...form.register("lastName")} placeholder="Dela Cruz" />
              {form.formState.errors.lastName && (
                <p className="text-xs text-red-500">{form.formState.errors.lastName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-900">Date of Birth <span className="text-red-500">*</span></label>
              <Input type="date" {...form.register("dateOfBirth")} />
              {form.formState.errors.dateOfBirth && (
                <p className="text-xs text-red-500">{form.formState.errors.dateOfBirth.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-900">Gender <span className="text-red-500">*</span></label>
              <select 
                {...form.register("gender")}
                className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
              {form.formState.errors.gender && (
                <p className="text-xs text-red-500">{form.formState.errors.gender.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* CONTACT INFO */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-900">Phone Number <span className="text-red-500">*</span></label>
              <Input type="tel" {...form.register("phoneNumber")} placeholder="+63 900 000 0000" />
              {form.formState.errors.phoneNumber && (
                <p className="text-xs text-red-500">{form.formState.errors.phoneNumber.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-900">Email Address</label>
              <Input type="email" {...form.register("email")} placeholder="juan@example.com" />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-neutral-900">Street Address <span className="text-red-500">*</span></label>
              <Input {...form.register("addressLine1")} placeholder="123 Ayala Ave, Brgy San Lorenzo" />
              {form.formState.errors.addressLine1 && (
                <p className="text-xs text-red-500">{form.formState.errors.addressLine1.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-900">City / Municipality <span className="text-red-500">*</span></label>
              <Input {...form.register("city")} placeholder="Makati City" />
              {form.formState.errors.city && (
                <p className="text-xs text-red-500">{form.formState.errors.city.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* EMERGENCY & MEDICAL */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Emergency & Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-900">Emergency Contact Name</label>
              <Input {...form.register("emergencyContactName")} placeholder="Maria Dela Cruz" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-900">Emergency Phone</label>
              <Input type="tel" {...form.register("emergencyContactPhone")} placeholder="+63 900 111 2222" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-neutral-900">Critical Medical Alerts (Optional)</label>
              <Input {...form.register("medicalAlerts")} placeholder="e.g. Penicillin Allergy, Pacemaker" className="border-red-200 focus:border-red-500 focus:ring-red-500" />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-4">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {isSubmitting ? "Registering..." : "Register Patient"}
          </Button>
        </div>
      </form>
    </div>
  )
}
