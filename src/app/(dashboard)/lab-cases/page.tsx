"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { FlaskConical, Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function LabCasesPage() {
  const { t } = useLocale()
  
  return (
    <DirectionalTransition className="mx-auto w-full max-w-7xl">
      <ContentPanel padding="lg" className="space-y-6">
        <SectionEyebrow icon={FlaskConical}>
          {t("labcases.eyebrow", "Clinical")} · {t("labcases.module", "Lab Cases")}
        </SectionEyebrow>

        <PageHeader
          title={t("labcases.title", "Laboratory Cases")}
          description={t("labcases.description", "Track impressions, crowns, and external lab orders.")}
          actions={
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              {t("labcases.new", "New Lab Case")}
            </Button>
          }
        />

        <Card>
          <CardContent className="pt-6 text-center py-16 text-neutral-500">
            <FlaskConical className="h-10 w-10 mx-auto mb-3 text-neutral-300" />
            <p className="font-medium text-neutral-800">No active lab cases</p>
            <p className="mt-1 text-sm text-neutral-500">
              When you send an impression to an external lab, track it here.
            </p>
          </CardContent>
        </Card>
      </ContentPanel>
    </DirectionalTransition>
  )
}
