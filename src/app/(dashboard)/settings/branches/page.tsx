import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function BranchesSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Branches</h2>
          <p className="text-sm text-neutral-500">Manage your clinic locations and their specific settings.</p>
        </div>
        <Button>Add Branch</Button>
      </div>

      <div className="grid gap-4">
        {/* Mock Branch Card - Will be populated from Supabase later */}
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-900">Makati Main Clinic</span>
                <Badge variant="success">Active</Badge>
              </div>
              <span className="text-sm text-neutral-500">Ayala Avenue, Makati City</span>
            </div>
            <Button variant="outline" size="sm">Manage Settings</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-900">BGC Branch</span>
                <Badge variant="success">Active</Badge>
              </div>
              <span className="text-sm text-neutral-500">High Street, Taguig</span>
            </div>
            <Button variant="outline" size="sm">Manage Settings</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
