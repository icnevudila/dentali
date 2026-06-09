import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function RolesSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Roles & Permissions</h2>
          <p className="text-sm text-neutral-500">Define access control levels for different staff roles.</p>
        </div>
        <Button variant="outline">Create Custom Role</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Owner <Badge variant="danger">Full Access</Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-500 mb-4">Complete control over the organization, billing, and all branches.</p>
            <Button variant="secondary" size="sm" className="w-full">View Permissions</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Dentist / Provider</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-500 mb-4">Can view and edit patient clinical records, treatments, and appointments.</p>
            <Button variant="secondary" size="sm" className="w-full">View Permissions</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Receptionist</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-500 mb-4">Can manage appointments, basic patient registry, and check-ins.</p>
            <Button variant="secondary" size="sm" className="w-full">View Permissions</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Dental Assistant</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-500 mb-4">Can view patient records, assist with charting, but cannot finalize bills.</p>
            <Button variant="secondary" size="sm" className="w-full">View Permissions</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
