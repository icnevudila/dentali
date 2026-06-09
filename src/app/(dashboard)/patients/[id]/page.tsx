"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Edit, FileText, Activity, AlertTriangle, Calendar, Phone, Mail, MapPin, Printer, ShieldCheck, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// Mock Data
const patient = {
  id: "P-1001",
  firstName: "Maria",
  lastName: "Garcia",
  dateOfBirth: "1985-04-12 (39 y/o)",
  gender: "Female",
  phone: "+63 917 123 4567",
  email: "maria.garcia@example.com",
  address: "123 Ayala Ave, Makati City",
  emergencyContact: "Jose Garcia (Husband) - +63 918 000 0000",
  status: "Active",
  lastVisit: "May 10, 2024",
  alerts: ["Penicillin Allergy", "Hypertensive"],
}

export default function PatientProfilePage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = React.useState("overview")

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "medical-history", label: "Medical History" },
    { id: "dental-chart", label: "Dental Chart" },
    { id: "treatment-plans", label: "Treatment Plans" },
    { id: "appointments", label: "Appointments" },
    { id: "consents", label: "Consents & Forms" },
  ]

  return (
    <div className="space-y-6 pb-10 flex flex-col h-full max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="mt-1">
            <Link href="/patients"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="relative group flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-700 text-2xl font-bold overflow-hidden cursor-pointer">
            MG
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-950">Maria Garcia</h1>
              <Badge variant="success">Active</Badge>
            </div>
            <p className="text-sm text-neutral-500">ID: {patient.id} • {patient.dateOfBirth} • {patient.gender}</p>
            
            {patient.alerts.length > 0 && (
              <div className="flex gap-2 mt-2">
                {patient.alerts.map(alert => (
                  <Badge key={alert} variant="danger" className="flex items-center gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    {alert}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2"><Printer className="h-4 w-4"/> Print</Button>
          <Button variant="outline" className="gap-2"><Edit className="h-4 w-4"/> Edit Profile</Button>
          <Button className="gap-2"><Calendar className="h-4 w-4"/> Book Appt</Button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="border-b border-neutral-200 overflow-x-auto hide-scrollbar">
        <nav className="flex space-x-6 min-w-max px-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 pt-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id 
                  ? "border-primary-500 text-primary-600" 
                  : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB CONTENT */}
      <div className="mt-6">
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-neutral-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{patient.phone}</p>
                      <p className="text-xs text-neutral-500">Mobile</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-neutral-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{patient.email}</p>
                      <p className="text-xs text-neutral-500">Personal</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-neutral-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{patient.address}</p>
                      <p className="text-xs text-neutral-500">Home</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-neutral-900">Jose Garcia (Husband)</p>
                  <p className="text-sm text-neutral-500">+63 918 000 0000</p>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">Recent Clinical Notes</CardTitle>
                    <CardDescription>Latest updates from providers.</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm">View All</Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border-l-2 border-primary-500 pl-4 py-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-semibold text-neutral-900">Routine Checkup & Prophylaxis</span>
                        <span className="text-xs text-neutral-500">May 10, 2024</span>
                      </div>
                      <p className="text-sm text-neutral-600">Patient presented for routine cleaning. Mild gingivitis noted on lower anteriors. Oral hygiene instructions given. Recommended follow-up in 6 months.</p>
                      <p className="text-xs font-medium text-primary-600 mt-2">Dr. Sarah Connor</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* CONSENTS TAB */}
        {activeTab === "consents" && (
          <Card>
            <CardHeader>
              <CardTitle>Consent Forms & Legal Documents</CardTitle>
              <CardDescription>Manage signed agreements and DPA consent.</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b text-neutral-500">
                    <th className="pb-3 font-medium">Document Name</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Date Signed</th>
                    <th className="pb-3 font-medium">Version</th>
                    <th className="pb-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  <tr>
                    <td className="py-4 font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success-500"/> Data Privacy Act (DPA) Consent</td>
                    <td className="py-4"><Badge variant="success">Signed</Badge></td>
                    <td className="py-4 text-neutral-500">Jan 12, 2024</td>
                    <td className="py-4 text-neutral-500">v2.1</td>
                    <td className="py-4 text-right"><Button variant="outline" size="sm">View PDF</Button></td>
                  </tr>
                  <tr>
                    <td className="py-4 font-medium flex items-center gap-2"><FileText className="h-4 w-4 text-neutral-400"/> General Treatment Consent</td>
                    <td className="py-4"><Badge variant="success">Signed</Badge></td>
                    <td className="py-4 text-neutral-500">Jan 12, 2024</td>
                    <td className="py-4 text-neutral-500">v1.0</td>
                    <td className="py-4 text-right"><Button variant="outline" size="sm">View PDF</Button></td>
                  </tr>
                  <tr>
                    <td className="py-4 font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-danger-500"/> Orthodontic Agreement</td>
                    <td className="py-4"><Badge variant="danger">Pending</Badge></td>
                    <td className="py-4 text-neutral-500">--</td>
                    <td className="py-4 text-neutral-500">v1.2</td>
                    <td className="py-4 text-right"><Button size="sm">Sign Now</Button></td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* OTHER TABS PLACEHOLDERS */}
        {["medical-history", "dental-chart", "treatment-plans", "appointments"].includes(activeTab) && (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50">
            <Activity className="h-10 w-10 text-neutral-300 mb-4" />
            <h3 className="text-lg font-medium text-neutral-900">Detailed {TABS.find(t => t.id === activeTab)?.label}</h3>
            <p className="text-neutral-500 text-center max-w-sm mt-2">
              This module will be fully activated in the upcoming waves according to the roadmap. It will integrate directly with the patient's records.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
