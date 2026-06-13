import { RouteNotFound } from "@/components/layout/RouteNotFound"

export default function SettingsNotFound() {
  return (
    <RouteNotFound
      title="Settings page not found"
      description="This settings screen does not exist. Open Settings from the sidebar to manage your clinic."
      homeHref="/settings"
      homeLabel="Back to settings"
    />
  )
}
