import { Sidebar, MobileNavProvider } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { BranchBootstrap } from "@/components/layout/BranchBootstrap"
import { OperationalRealtimeProvider } from "@/components/operational/OperationalRealtimeProvider"
import { TurkishDomTranslator } from "@/components/i18n/TurkishDomTranslator"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <BranchBootstrap>
      <OperationalRealtimeProvider>
        <MobileNavProvider>
          <TurkishDomTranslator />
          <div className="flex min-h-screen w-full bg-neutral-50">
            <Sidebar />
            <div className="flex flex-1 flex-col min-w-0">
              <Topbar />
              <main className="min-w-0 flex-1 overflow-x-clip overflow-y-auto p-4 sm:p-6 lg:p-8">
                {children}
              </main>
            </div>
          </div>
        </MobileNavProvider>
      </OperationalRealtimeProvider>
    </BranchBootstrap>
  )
}
