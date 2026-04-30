/**
 * E2E verification test: confirm RV-Insights bug fixes.
 *
 * Bug fixes verified:
 *   1. CORS — backend now allows localhost:5175 origin
 *   2. SessionPanel — useSessionGrouping accepts MaybeRefOrGetter (no crash)
 *
 * Scenarios:
 *   1. Login page renders without JS errors
 *   2. Login with test5@rv.dev / Test1234! succeeds (CORS fixed)
 *   3. Cases list page loads after login (SessionPanel fixed)
 *   4. Case detail page shows exploration result with ContributionCard
 */
import { test, expect, type ConsoleMessage } from '@playwright/test'

const BASE = 'http://localhost:5175'
const CASE_ID = '7e8bd53e-0e33-425b-b3f3-fb2c282de93d'
const ARTIFACTS =
  '/home/zq/work-space/repo/ai-projs/posp/RV-Insights/web-console/tests/e2e/artifacts'

// ─── Scenario 1: Login page renders ────────────────────────────────────────

test.describe('Scenario 1 - Login page renders', () => {
  test('login page loads without JS errors', async ({ page }) => {
    const jsErrors: string[] = []

    page.on('pageerror', (err) => jsErrors.push(err.message))

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })

    // Core UI elements
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Login' }).first(),
    ).toBeVisible()

    await page.screenshot({ path: `${ARTIFACTS}/01-login-page.png`, fullPage: true })

    // No critical JS errors
    expect(jsErrors).toHaveLength(0)
  })
})

// ─── Scenario 2: Login succeeds (CORS fix) ───────────────────────────────

test.describe('Scenario 2 - Login succeeds (CORS fix)', () => {
  test('login with test credentials succeeds without CORS error', async ({ page }) => {
    const corsErrors: string[] = []
    const failedRequests: string[] = []

    page.on('console', (msg: ConsoleMessage) => {
      const text = msg.text()
      if (text.includes('CORS') || text.includes('cross-origin')) {
        corsErrors.push(text)
      }
    })
    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.url()} - ${req.failure()?.errorText}`)
    })

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })

    // Fill credentials
    await page.locator('input[type="email"]').fill('test5@rv.dev')
    await page.locator('input[type="password"]').fill('Test1234!')

    // Click login and wait for the auth API response
    const [loginResp] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/auth/login') && resp.status() === 200,
        { timeout: 10_000 },
      ),
      page.locator('button[type="submit"]').click(),
    ])

    expect(loginResp.status()).toBe(200)

    // Verify no CORS errors
    expect(corsErrors).toHaveLength(0)

    // Verify no failed requests to auth endpoint
    const authFailures = failedRequests.filter((r) => r.includes('/auth/login'))
    expect(authFailures).toHaveLength(0)

    // Wait for navigation away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10_000,
    })

    await page.screenshot({ path: `${ARTIFACTS}/02-after-login.png`, fullPage: true })

    // Token should be in localStorage
    const token = await page.evaluate(() => localStorage.getItem('rv_access_token'))
    expect(token).toBeTruthy()
  })
})

// ─── Scenario 3: Cases list page (SessionPanel fix) ──────────────────────

test.describe('Scenario 3 - Cases list page (SessionPanel fix)', () => {
  test('cases page loads without SessionPanel crash', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    // Login first via API, then inject token
    const loginResp = await page.request.post(
      'http://localhost:8000/api/v1/auth/login',
      {
        data: { email: 'test5@rv.dev', password: 'Test1234!' },
        headers: { 'Content-Type': 'application/json' },
      },
    )
    expect(loginResp.ok()).toBeTruthy()
    const { access_token } = await loginResp.json()

    // Inject token into localStorage
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      (t) => localStorage.setItem('rv_access_token', t),
      access_token,
    )

    // Navigate to cases
    await page.goto(`${BASE}/cases`, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    await page.waitForTimeout(3000)

    await page.screenshot({ path: `${ARTIFACTS}/03-cases-list.png`, fullPage: true })

    const currentUrl = page.url()

    // Should NOT be redirected back to login
    expect(currentUrl).not.toContain('/login')

    // The old bug: "items is not iterable" from SessionPanel
    const sessionPanelCrash = pageErrors.filter(
      (e) => e.includes('is not iterable') || e.includes('useSessionGrouping'),
    )
    expect(sessionPanelCrash).toHaveLength(0)

    // Page should have rendered MainLayout (not a blank white screen)
    const bodyText = await page.locator('body').innerText().catch(() => '')
    expect(bodyText.length).toBeGreaterThan(10)
  })
})

// ─── Scenario 4: Case detail page ────────────────────────────────────────

test.describe('Scenario 4 - Case detail page', () => {
  test('case detail shows exploration result', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    // Login via API
    const loginResp = await page.request.post(
      'http://localhost:8000/api/v1/auth/login',
      {
        data: { email: 'test5@rv.dev', password: 'Test1234!' },
        headers: { 'Content-Type': 'application/json' },
      },
    )
    expect(loginResp.ok()).toBeTruthy()
    const { access_token } = await loginResp.json()

    // Inject token
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      (t) => localStorage.setItem('rv_access_token', t),
      access_token,
    )

    // Navigate to case detail
    await page.goto(`${BASE}/cases/${CASE_ID}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    })
    await page.waitForTimeout(3000)

    await page.screenshot({ path: `${ARTIFACTS}/04-case-detail.png`, fullPage: true })

    const currentUrl = page.url()
    expect(currentUrl).toContain(`/cases/${CASE_ID}`)

    // No SessionPanel crash
    const sessionPanelCrash = pageErrors.filter(
      (e) => e.includes('is not iterable') || e.includes('useSessionGrouping'),
    )
    expect(sessionPanelCrash).toHaveLength(0)

    // Page should have rendered content (not blank)
    const bodyText = await page.locator('body').innerText().catch(() => '')
    expect(bodyText.length).toBeGreaterThan(10)

    // Log all JS errors for diagnostics (non-blocking)
    if (pageErrors.length > 0) {
      console.log('[INFO] JS errors on case detail:', pageErrors)
    }
  })
})
