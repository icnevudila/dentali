import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function OrganizationSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Organization Profile</h2>
          <p className="text-sm text-neutral-500">Update your clinic's primary information.</p>
        </div>
        <Button>Save Changes</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">General Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Organization Name</label>
            <Input defaultValue="Dentali Main Clinic" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Contact Number</label>
            <Input placeholder="+63 900 000 0000" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Primary Address</label>
            <Input placeholder="Manila, Philippines" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Timezone</label>
            <Input defaultValue="Asia/Manila" disabled />
            <p className="text-xs text-neutral-500">Timezone is locked to Philippines for compliance.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
