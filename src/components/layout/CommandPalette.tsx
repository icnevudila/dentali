"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  User,
  Calendar,
  Pill,
  FileText,
  Sparkles,
  FlaskConical,
  Plus,
  CreditCard,
  Building,
  Command,
  X,
  ChevronRight,
} from "lucide-react"

interface NavigationItem {
  id: string
  title: string
  subtitle?: string
  category: "Hastalar" | "Klinik İşlemler text-xs" | "Hızlı Eylemler" | "Modüller"
  icon: React.ComponentType<{ className?: string }>
  action: () => void
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  // Toggle command palette on Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      } else if (e.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const navigateTo = useCallback(
    (path: string) => {
      setIsOpen(false)
      setSearchQuery("")
      router.push(path)
    },
    [router]
  )

  const items: NavigationItem[] = [
    {
      id: "nav-patients",
      title: "Hasta Listesi & Detay Arama",
      subtitle: "Tüm kayıtlı diş hastalarını görüntüleyin",
      category: "Modüller",
      icon: User,
      action: () => navigateTo("/patients"),
    },
    {
      id: "nav-appointments",
      title: "Randevu Takvimi & Çizelge",
      subtitle: "Günlük ve haftalık diş hekimi randevuları",
      category: "Modüller",
      icon: Calendar,
      action: () => navigateTo("/appointments"),
    },
    {
      id: "act-new-patient",
      title: "Yeni Diş Hastası Kaydı Oluştur",
      subtitle: "Hızlı hasta kaydı ve onam formu",
      category: "Hızlı Eylemler",
      icon: Plus,
      action: () => navigateTo("/patients/new"),
    },
    {
      id: "nav-prescriptions",
      title: "e-Reçete & Protokol Dökümü",
      subtitle: "Diş ağrısı ve antibiyotik reçete şablonları",
      category: "Klinik İşlemler text-xs",
      icon: Pill,
      action: () => navigateTo("/prescriptions"),
    },
    {
      id: "nav-lab",
      title: "Diş Laboratuvar Siparişleri",
      subtitle: "Kron, zirkonyum ve prova takipleri",
      category: "Klinik İşlemler text-xs",
      icon: FlaskConical,
      action: () => navigateTo("/lab-cases"),
    },
    {
      id: "nav-billing",
      title: "Kasa & Fatura Yönetimi",
      subtitle: "Ödemeler, faturalar ve finansal özet",
      category: "Modüller",
      icon: CreditCard,
      action: () => navigateTo("/billing"),
    },
    {
      id: "nav-branches",
      title: "Şube & Klinik Yönetimi",
      subtitle: "Poliklinik şubeleri arası geçiş",
      category: "Modüller",
      icon: Building,
      action: () => navigateTo("/branches"),
    },
  ]

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-md transition-all">
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-3.5">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hasta adı, işlem veya sayfa ara... (örn: Reçete, Hasta, Randevu)"
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none font-medium"
            autoFocus
          />
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
              ESC
            </kbd>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-[360px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Aradığınız kriterlere uygun sonuç bulunamadı.
            </div>
          ) : (
            filteredItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition-colors hover:bg-teal-50 dark:hover:bg-slate-800/80 group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-teal-600 group-hover:text-white transition-colors shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-300 truncate">
                        {item.title}
                      </h4>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      {item.category}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Command Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <Command className="h-3.5 w-3.5 text-teal-600" />
            <span>Dentali Akıllı Arama & Hızlı İşlem Paleti</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Aç: <kbd className="font-bold">Ctrl+K</kbd></span>
            <span>Kapat: <kbd className="font-bold font-mono">ESC</kbd></span>
          </div>
        </div>
      </div>
    </div>
  )
}
