export const cronCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

export function isCronAuthorized(req: Request): boolean {
  const cronSecret = Deno.env.get("CRON_SECRET")
  const headerSecret = req.headers.get("x-cron-secret")
  const authHeader = req.headers.get("Authorization") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

  return (
    (Boolean(cronSecret) && headerSecret === cronSecret) ||
    authHeader === `Bearer ${serviceRoleKey}`
  )
}

export function cronUnauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...cronCorsHeaders, "Content-Type": "application/json" },
  })
}

export function cronJsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cronCorsHeaders, "Content-Type": "application/json" },
  })
}

export function cronErrorResponse(message: string, status = 500): Response {
  return cronJsonResponse({ error: message }, status)
}
