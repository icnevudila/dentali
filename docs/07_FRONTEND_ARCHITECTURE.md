# Frontend Architecture

## Önerilen stack

### Admin Web

- Next.js App Router
- TypeScript strict
- Tailwind CSS
- React Hook Form
- Zod
- TanStack Query
- shadcn/ui veya custom headless component system

### Mobile / Tablet

- Expo React Native
- TypeScript
- React Navigation
- React Query
- Native signature capture component

### Kiosk

- Next.js veya Expo Web
- Büyük touch targets
- Scoped kiosk token
- Offline-friendly draft

### Queue Display

- Next.js fullscreen route
- SSE/WebSocket support
- Local cache fallback

## Folder structure

```txt
src/
  app/
    admin/
    kiosk/
    queue-display/
  components/
    app-shell/
    ui/
    data-table/
    forms/
    odontogram/
    empty-state/
    error-state/
    metric-card/
    status-badge/
  modules/
    appointments/
    patients/
    dental-chart/
    billing/
    hmo/
    queue/
    consent/
  lib/
    api-client.ts
    auth.ts
    permissions.ts
    format.ts
    i18n.ts
    errors.ts
    timezone.ts
  styles/
    globals.css
    tokens.css
```

## API client standard

```ts
export type ApiResponse<T> =
  | { ok: true; data: T; meta: ApiMeta }
  | { ok: false; error: ApiError; meta: ApiMeta }

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' })
  const json = (await res.json()) as ApiResponse<T>

  if (!json.ok) throw new AppApiError(json.error, json.meta)
  return json.data
}
```

## Formatting helpers

```ts
export function formatCurrencyMinor(valueMinor: number, currency = 'PHP') {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format((valueMinor || 0) / 100)
}
```

```ts
export function formatDatePH(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value))
}
```

## State management

- Server state: React Query
- Local UI state: component state
- Long forms: React Hook Form
- Global auth/clinic state: small store or context
- Do not put full patient medical record into global store

## Form standard

Her form:

- Zod schema
- Field-level errors
- Submit loading state
- Success toast
- Dirty state warning where needed
- Autosave for long clinical notes

## Odontogram component

Props:

```ts
type OdontogramProps = {
  dentition: 'permanent' | 'primary' | 'mixed'
  findings: ToothFinding[]
  selectedToothNo?: string
  mode: 'view' | 'edit'
  onToothSelect?: (toothNo: string) => void
  onFindingChange?: (finding: ToothFinding) => void
}
```

UX:

- Tooth click opens side drawer
- Surface selection inside drawer
- Condition code chip list
- Legend always visible
- Changes save as draft first

## Loading / empty / error standard

```tsx
if (query.isLoading) return <TableSkeleton />
if (query.isError) return <ErrorState title="Couldn’t load patients" onRetry={query.refetch} />
if (!query.data.length) return <EmptyState title="No patients yet" primaryAction="Add patient" />
return <PatientTable data={query.data} />
```

## Kiosk offline strategy

- Persist draft intake locally until submit succeeds
- Show calm retry screen
- Never show raw server message
- Staff override option available behind staff login

## Queue display realtime strategy

Initial MVP:

- Poll every 5–10 seconds
- Cache last successful response in localStorage

Better v2:

- Server-Sent Events
- Heartbeat indicator
- Reconnect with backoff

## Frontend test requirements

- Component smoke tests for critical components
- Form validation tests
- Integration tests for appointment and invoice flow
- Kiosk error state test
- Queue API down test
