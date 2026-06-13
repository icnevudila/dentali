"use client"

import * as React from "react"
import { Clock, Users, Timer, Activity, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { fetchQueueEntries } from "@/lib/queue/queue-service"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"

export default function ChairTimeReportPage() {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const [loading, setLoading] = React.useState(true)
  const [entries, setEntries] = React.useState<any[]>([])

  React.useEffect(() => {
    if (!activeBranch) return
    fetchQueueEntries(activeBranch.id, false).then(({ data }) => {
      setEntries(data || [])
      setLoading(false)
    })
  }, [activeBranch])

  // Calculate averages
  const servedEntries = entries.filter(e => e.status === "served" && e.in_chair_at && e.completed_at)
  
  const totalChairTimeMins = servedEntries.reduce((acc, entry) => {
    const start = new Date(entry.in_chair_at).getTime()
    const end = new Date(entry.completed_at).getTime()
    return acc + Math.max(0, (end - start) / 60000)
  }, 0)

  const totalWaitTimeMins = servedEntries.reduce((acc, entry) => {
    const start = new Date(entry.checked_in_at).getTime()
    const end = new Date(entry.in_chair_at || entry.completed_at).getTime()
    return acc + Math.max(0, (end - start) / 60000)
  }, 0)

  const avgChairTime = servedEntries.length > 0 ? Math.round(totalChairTimeMins / servedEntries.length) : 0
  const avgWaitTime = servedEntries.length > 0 ? Math.round(totalWaitTimeMins / servedEntries.length) : 0

  return (
    <PermissionGate permission={PERMISSIONS.REPORTS_READ}>
      <ModulePageShell
        eyebrow="Analytics · AI"
        title="Gerçek Zamanlı Koltuk Verimliliği (Chair-Time Tracker)"
        description="Hastaların bekleme salonunda ve tedavi koltuğunda geçirdiği ortalama sürelerin analizi."
        icon={Timer}
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-fade-rise">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam İşlem Sayısı</CardTitle>
              <Users className="h-4 w-4 text-neutral-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{servedEntries.length}</div>
              <p className="text-xs text-neutral-500">Tamamlanan toplam hasta kaydı</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ortalama Bekleme Süresi</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgWaitTime} dk</div>
              <p className="text-xs text-neutral-500">Kabulden koltuğa alınana kadar geçen süre</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700">Ortalama Koltuk Süresi</CardTitle>
              <Activity className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{avgChairTime} dk</div>
              <p className="text-xs text-neutral-500">Koltuğa oturmasından faturaya kadar geçen süre</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 border-primary-200 bg-primary-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary-800">
              <Info className="h-5 w-5" /> Nasıl Çalışır?
            </CardTitle>
            <CardDescription className="text-primary-600/80">
              Sistem bu süreleri "Queue (Bekleme Salonu)" ekranındaki hasta hareketlerinizden **tamamen otonom** olarak hesaplar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-primary-900/90">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">1</div>
              <p>Hasta kliniğe geldiğinde ve sekreter "Check-In" yaptığında bekleme kronometresi başlar.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">2</div>
              <p>Doktor hastayı Queue ekranından <strong>"In Chair" (Koltukta)</strong> durumuna geçirdiğinde bekleme kronometresi durur, <strong>Koltuk Verimliliği Kronometresi</strong> arka planda sessizce başlar.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">3</div>
              <p>İşlem bitip hasta <strong>"Served" (Tamamlandı)</strong> işaretlendiği an kronometre durur ve veriler bu rapora yansır. Hiçbir personelin el ile dakika girmesine gerek kalmaz!</p>
            </div>
          </CardContent>
        </Card>
      </ModulePageShell>
    </PermissionGate>
  )
}
