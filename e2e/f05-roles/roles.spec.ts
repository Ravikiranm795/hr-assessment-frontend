import { expect, test } from '@playwright/test'
import { apiLogin, createInvite, createOpenRole, createRole, signIn, unique } from './helpers'

const HR = 'hana@one.demo.example.com'

test('golden: create role, link assessment, open, invite one candidate, URL is shown once', async ({ page }) => {
  const title = unique('E2E golden')
  await signIn(page, HR)
  await page.goto('/roles')
  await page.getByRole('button', { name: 'Create role' }).click()
  await page.getByRole('dialog').getByLabel('Title').fill(title)
  await page.getByRole('dialog').getByRole('button', { name: 'Create role' }).click()
  await expect(page).toHaveURL(/\/roles\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  // Draft role with no assessment: invites are blocked with a reason.
  await expect(page.getByText('Open the role before inviting candidates.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Invite candidate' })).toBeDisabled()

  await page.getByRole('button', { name: 'Link assessment' }).click()
  await page.getByRole('button', { name: /^Select / }).first().click()
  await expect(page.getByText('Not linked')).toHaveCount(0)
  await expect(page.getByText(/^Version \d+/)).toBeVisible()

  await page.getByRole('button', { name: 'Open role' }).click()
  await expect(page.getByText('The role is open.')).toBeVisible()

  await page.getByRole('button', { name: 'Invite candidate' }).click()
  await page.getByLabel('Candidate name').fill('Golden Candidate')
  await page.getByLabel('Email', { exact: true }).fill(`golden.${Date.now()}@candidates.example.com`)
  await page.getByRole('button', { name: 'Create invite' }).click()

  const link = page.getByRole('textbox', { name: 'Exam link' })
  await expect(link).toHaveValue(/\/exam\/[A-Za-z0-9_-]{20,}$/)
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  // The invite is listed, and the link is not shown again anywhere on the page.
  await expect(page.getByRole('link', { name: 'Golden Candidate' }).or(page.getByText('Golden Candidate', { exact: true }))).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Exam link' })).toHaveCount(0)
  await expect(page.getByText(/\/exam\//)).toHaveCount(0)
})

test('non-owner HR sees limited columns on a role owned by someone else', async ({ page }) => {
  await signIn(page, HR)
  await page.goto('/roles')
  await page.getByLabel('Search by title').fill('QA Engineer') // the list grows with test data
  await page.getByRole('link', { name: 'QA Engineer', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'QA Engineer' })).toBeVisible()
  await expect(page.getByText(/you see names, status and decision only/)).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Candidate' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Decision' })).toBeVisible()
  for (const hidden of ['Score', 'Flags', 'Expires']) {
    await expect(page.getByRole('columnheader', { name: hidden })).toHaveCount(0)
  }
  await expect(page.getByRole('button', { name: 'Invite candidate' })).toHaveCount(0)
})

test('invites are blocked with the reason when the role is not open', async ({ page, request }) => {
  const auth = await apiLogin(request, HR)
  const role = await createRole(request, auth)
  await signIn(page, HR)
  await page.goto(`/roles/${role.id}`)
  await expect(page.getByText('Open the role before inviting candidates.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Invite candidate' })).toBeDisabled()
})

test('duplicate email is a warning with an invite anyway choice', async ({ page, request }) => {
  const auth = await apiLogin(request, HR)
  const role = await createOpenRole(request, auth)
  const email = `dup.${Date.now()}@candidates.example.com`
  await createInvite(request, auth, role.id, 'First Dup', email)
  await signIn(page, HR)
  await page.goto(`/roles/${role.id}`)
  await page.getByRole('button', { name: 'Invite candidate' }).click()
  await page.getByLabel('Candidate name').fill('Second Dup')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Create invite' }).click()
  await expect(page.getByText('This email already has an invite for this role')).toBeVisible()
  await page.getByRole('button', { name: 'Invite anyway' }).click()
  await expect(page.getByRole('textbox', { name: 'Exam link' })).toHaveValue(/\/exam\//)
})

test('CSV upload reports each row and shows links once', async ({ page, request }) => {
  const auth = await apiLogin(request, HR)
  const role = await createOpenRole(request, auth)
  await signIn(page, HR)
  await page.goto(`/roles/${role.id}`)
  await page.getByRole('button', { name: 'Upload CSV' }).click()
  const stamp = Date.now()
  const csv = `name,email,phone\nCsv Good,csv.${stamp}@candidates.example.com,\nCsv Formula,=cmd@candidates.example.com,\n`
  await page.locator('#bulk-csv').setInputFiles({ name: 'invites.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: 'Upload and invite' }).click()
  await expect(page.getByText('2 rows: 1 invited, 1 failed.')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Invited' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(1)
})

test('reset binding and revoke from the invite actions menu', async ({ page, request }) => {
  const auth = await apiLogin(request, HR)
  const role = await createOpenRole(request, auth)
  await createInvite(request, auth, role.id, 'Menu Candidate', `menu.${Date.now()}@candidates.example.com`)
  await signIn(page, HR)
  await page.goto(`/roles/${role.id}`)
  await page.getByRole('button', { name: 'Actions for Menu Candidate' }).click()
  await page.getByRole('menuitem', { name: 'Reset binding' }).click()
  await page.getByLabel('Reason').fill('Candidate switched laptop')
  await page.getByRole('dialog').getByRole('button', { name: 'Reset binding' }).click()
  await expect(page.getByText('The browser binding was reset.')).toBeVisible()

  await page.getByRole('button', { name: 'Actions for Menu Candidate' }).click()
  await page.getByRole('menuitem', { name: 'Revoke invite' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Revoke invite' }).click()
  await expect(page.getByText('The invite was revoked.')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Revoked' })).toBeVisible()
})

test('an organization without CSV bulk invite does not see the upload button', async ({ page, request }) => {
  const auth = await apiLogin(request, 'admin@acme.demo.example.com')
  const role = await createRole(request, auth)
  await signIn(page, 'admin@acme.demo.example.com')
  await page.goto(`/roles/${role.id}`)
  await expect(page.getByRole('button', { name: 'Invite candidate' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload CSV' })).toHaveCount(0)
})
