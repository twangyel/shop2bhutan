import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function isDeactivatedProfile(profile: Record<string, unknown> | null) {
  const status = cleanText(profile?.account_status).toLowerCase()
  return status === 'deactivated' || profile?.is_active === false
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const cryptoValues = new Uint32Array(10)
  crypto.getRandomValues(cryptoValues)

  const suffix = Array.from(cryptoValues)
    .map((value) => alphabet[value % alphabet.length])
    .join('')

  return `S2B-${suffix}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase Edge Function secrets are missing.' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')

  if (!jwt) {
    return jsonResponse({ error: 'Missing admin authorization.' }, 401)
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const {
    data: { user: caller },
    error: callerError,
  } = await service.auth.getUser(jwt)

  if (callerError || !caller?.id) {
    return jsonResponse({ error: 'Invalid admin session.' }, 401)
  }

  const { data: roleRow, error: roleError } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', caller.id)
    .in('role', ['admin', 'super_admin'])
    .maybeSingle()

  if (roleError || !roleRow) {
    return jsonResponse({ error: 'Only admins can reset customer passwords.' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400)
  }

  const userId = cleanText(body.userId ?? body.user_id)
  if (!isUuid(userId)) {
    return jsonResponse({ error: 'Valid customer user ID is required.' }, 400)
  }

  if (userId === caller.id) {
    return jsonResponse({ error: 'Use Change Password for your own admin account.' }, 400)
  }

  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id, full_name, phone, account_status, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500)
  }

  if (!profile) {
    return jsonResponse({ error: 'Customer profile not found.' }, 404)
  }

  if (isDeactivatedProfile(profile as Record<string, unknown>)) {
    return jsonResponse({ error: 'Reactivate this customer before resetting the password.' }, 409)
  }

  const temporaryPassword = generateTemporaryPassword()

  const { error: authUpdateError } = await service.auth.admin.updateUserById(
    userId,
    {
      password: temporaryPassword,
    },
  )

  if (authUpdateError) {
    return jsonResponse({ error: authUpdateError.message }, 500)
  }

  const now = new Date().toISOString()
  const { error: profileUpdateError } = await service
    .from('profiles')
    .update({
      must_change_password: true,
      password_reset_by_admin_at: now,
      password_reset_by_admin_id: caller.id,
      updated_at: now,
    })
    .eq('id', userId)

  if (profileUpdateError) {
    return jsonResponse(
      {
        error:
          'Password was changed in Auth, but profile flag could not be saved. Run Step 10C SQL and reset again.',
        details: profileUpdateError.message,
      },
      500,
    )
  }

  return jsonResponse({
    userId,
    temporaryPassword,
    mustChangePassword: true,
  })
})
