import { ShieldOff } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface PermissionDeniedProps {
  permission?: string
  message?: string
}

export function PermissionDenied({ permission, message }: PermissionDeniedProps) {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <ShieldOff className="h-10 w-10 text-amber-600" />
        <div>
          <h3 className="font-semibold text-neutral-900">Permission denied</h3>
          <p className="mt-1 text-sm text-neutral-600 max-w-md">
            {message ??
              "You do not have access to this action. Contact your clinic administrator if you need this permission."}
          </p>
          {permission && (
            <p className="mt-2 text-xs font-mono text-neutral-400">{permission}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
