// Shared CORS headers for all Supabase Edge Functions

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

/**
 * Returns a CORS preflight response for OPTIONS requests.
 */
export function handleCorsPreFlight(): Response {
  return new Response('ok', { headers: corsHeaders })
}

/**
 * Creates a JSON response with CORS headers.
 */
export function jsonResponse(
  body: unknown,
  status = 200,
  extra: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extra,
    },
  })
}

/**
 * Creates an error JSON response with CORS headers.
 */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status)
}
