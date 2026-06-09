import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function StaffSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Staff & Team</h2>
          <p className="text-sm text-neutral-500">Manage your clinic staff, their roles, and branch assignments.</p>
        </div>
        <Button>Invite Staff Member</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Branches</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                <tr className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-neutral-900">Dr. Sarah Connor</span>
                      <span className="text-neutral-500">sarah@dentali.com</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="info">Dentist</Badge>
                  </td>
                  <td className="px-6 py-4 text-neutral-600">Makati Main, BGC</td>
                  <td className="px-6 py-4">
                    <Badge variant="success">Active</Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </td>
                </tr>
                <tr className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-neutral-900">John Smith</span>
                      <span className="text-neutral-500">john@dentali.com</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline">Receptionist</Badge>
                  </td>
                  <td className="px-6 py-4 text-neutral-600">Makati Main</td>
                  <td className="px-6 py-4">
                    <Badge variant="success">Active</Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
