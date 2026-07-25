export default function MedicalCertificatesLoading() {
  return (
    <div className="flex items-center justify-center p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
        <span>Tıbbi istirahat raporları yükleniyor...</span>
      </div>
    </div>
  )
}
