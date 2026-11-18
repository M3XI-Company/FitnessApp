import test from 'node:test'
import assert from 'node:assert/strict'
import { readRedirect } from '../src/lib/authUrl'

test('a sign-in that comes back with tokens starts a session', () => {
  assert.deepEqual(readRedirect('breeze://sign-in#access_token=abc&refresh_token=def&token_type=bearer'), { ok: true, accessToken: 'abc', refreshToken: 'def' })
  assert.deepEqual(readRedirect('exp://127.0.0.1:8081/--/sign-in?x=1#access_token=a%2Bb&refresh_token=r'), { ok: true, accessToken: 'a+b', refreshToken: 'r' })
})

test('a sign-in that was closed or refused says why and starts nothing', () => {
  assert.deepEqual(readRedirect(undefined), { ok: false, reason: 'cancelled' })
  assert.equal(readRedirect('breeze://sign-in?error=access_denied&error_description=User+said+no').ok, false)
  const refused = readRedirect('breeze://sign-in?error=access_denied&error_description=User+said+no')
  assert.ok(!refused.ok && refused.reason === 'cancelled' && refused.detail === 'User said no')
  const broken = readRedirect('breeze://sign-in#error=server_error&error_description=Unable+to+exchange+external+code')
  assert.ok(!broken.ok && broken.reason === 'failed')
  const empty = readRedirect('breeze://sign-in')
  assert.ok(!empty.ok && empty.reason === 'failed')
})
