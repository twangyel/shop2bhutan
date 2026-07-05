import { supabase } from '@/lib/supabase'

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function isMissingSetupError(error: unknown) {
  const message = cleanText((error as { message?: string })?.message).toLowerCase()

  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('function') ||
    message.includes('column') ||
    message.includes('relation')
  )
}

export async function deactivateMyAccount(reason?: string) {
  const cleanReason = cleanText(reason) || null

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user?.id) throw new Error('Please sign in to deactivate your account.')

  const { error: rpcError } = await supabase.rpc('deactivate_my_account', {
    p_reason: cleanReason,
  })

  if (!rpcError) return

  if (!isMissingSetupError(rpcError)) {
    throw new Error(rpcError.message || 'Failed to deactivate account.')
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({
      account_status: 'deactivated',
      is_active: false,
      deactivated_at: now,
      deactivation_reason: cleanReason,
      updated_at: now,
    })
    .eq('id', user.id)

  if (error) {
    if (isMissingSetupError(error)) {
      throw new Error(
        'Account deactivation is not set up yet. Please run the Step 10A SQL patch first.',
      )
    }

    throw new Error(error.message || 'Failed to deactivate account.')
  }
}
