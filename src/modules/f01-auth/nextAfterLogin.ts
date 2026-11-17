/** Where to go once the session is complete: forced password change first, then authenticator setup, else the app (null). */
export function nextAfterLogin(session: { totp_setup_required: boolean; must_change_password: boolean }): string | null {
  if (session.must_change_password) return '/change-password'
  if (session.totp_setup_required) return '/totp/setup'
  return null
}
