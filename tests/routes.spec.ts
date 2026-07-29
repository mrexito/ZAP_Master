import { test, expect, type Page } from '@playwright/test'

// Abschnitt 10.1/10.3 des Architektur-Briefings: Routentabelle fuer alle aktivierten
// oeffentlichen DE-Seiten, /kurse, Auth-Seiten und geschuetzte Bestandsrouten. Deckt Redirects mit
// Status/Location, Rollen-/Auth-Trennung, die SiteNav-/Login-CTA-Invariante sowie die
// Cache-Regression aus Abschnitt 7 (Buchung/Verfügbarkeit ungecacht, Preisänderung nach
// updateTag() sofort sichtbar) ab.
//
// Die Kurs-Fixtures fuer die Cache-Regression (AVAILABILITY_KURS_ID/PRICE_TEST_KURS_ID unten)
// werden bewusst NICHT hier eingefuegt, sondern in scripts/seed-e2e-course-fixtures.mjs, das VOR
// `npm run build:test` laufen muss -- siehe die ausfuehrliche Begruendung dort: die Zielgruppen-
// Katalogseiten sind PPR-vorgerendert und backen 'use cache'-Ergebnisse (u.a.
// getExistingCoursesForAudience) bereits beim Build ein. Eine erst hier zur Testlaufzeit per
// service_role eingefuegte Zeile wuerde in der Shell nie erscheinen.

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL!
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD!
const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!

// Die Buchungs-/Verfügbarkeitstests unten identifizieren "Kurs B" per sichtbarem Text -- die
// zugehörige kursId=9001 lebt nur in scripts/seed-e2e-course-fixtures.mjs (matcht die editoriale
// Session-Fixture "Kurs B" in sechsKlasseIntensivkursSessions, types/marketing.fixtures.ts).
// PRICE_TEST_KURS_ID muss mit der ID dort übereinstimmen.
const PRICE_TEST_KURS_ID = 9100

test.beforeAll(() => {
  for (const [name, value] of Object.entries({ E2E_USER_EMAIL, E2E_USER_PASSWORD, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD })) {
    if (!value) {
      throw new Error(`${name} fehlt. .env.test.local.example nach .env.test.local kopieren und scripts/seed-e2e-users.mjs ausfuehren.`)
    }
  }
})

async function loginAs(page: Page, email: string, password: string, callbackUrl?: string) {
  const target = callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login'
  await page.goto(target)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: /Anmelden/i }).click()
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 15_000 })
}

/**
 * requireAdmin()/requireContentManager() rufen redirect() innerhalb einer unter Cache Components
 * (PPR) dynamisch/gestreamt gerenderten Seite auf: die anfängliche Server-Antwort für die
 * ANGEFORDERTE (nicht erlaubte) Route committet bereits mit HTTP 200, bevor der redirect() im
 * gestreamten Teil ausgeführt wird und den Client per Skript zur Zielroute navigiert. page.url()
 * unmittelbar nach page.goto() zeigt deshalb kurzzeitig noch die ursprüngliche URL -- erst nach
 * Abschluss dieser clientseitigen Navigation stimmt sie mit dem tatsächlichen Redirect-Ziel
 * überein. Kein Sicherheitsproblem (siehe Body-Assertion in den aufrufenden Tests), aber ein
 * Timing-Detail, das hier einmal zentral abgefangen wird.
 */
async function waitForRedirectAway(page: Page, from: string) {
  await page.waitForURL((url) => url.pathname !== from, { timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// 1) Oeffentliche DE-Marketingseiten: erfolgreich erreichbar.
// ---------------------------------------------------------------------------

const publicMarketingRoutes = [
  '/de',
  '/de/kontakt',
  '/de/impressum',
  '/de/agb',
  '/de/datenschutz',
  '/de/standorte',
  '/de/lerncoaching',
  '/de/nachhilfe',
  '/de/distance-learning',
  '/de/pruefungssimulation',
  '/de/tipps',
  '/de/ueber-uns',
]

for (const route of publicMarketingRoutes) {
  test(`öffentliche Marketingseite ${route} lädt erfolgreich`, async ({ page }) => {
    const response = await page.goto(route)
    expect(response?.status(), `${route} sollte 200 liefern`).toBe(200)
  })
}

const audienceOverviewRoutes = ['4-klasse', '5-klasse', '6-klasse', '1-sek', '2-3-sek', 'bms', 'matura'].map(
  (slug) => `/de/kurse/${slug}`
)

for (const route of audienceOverviewRoutes) {
  test(`Zielgruppen-Hauptseite ${route} lädt erfolgreich`, async ({ page }) => {
    const response = await page.goto(route)
    expect(response?.status(), `${route} sollte 200 liefern`).toBe(200)
  })
}

for (const { overviewRoute, detailRoute, price } of [
  {
    overviewRoute: '/de/kurse/5-klasse',
    detailRoute: '/de/kurse/5-klasse/halbjahreskurs',
    price: /CHF\s*3['’]490/,
  },
  {
    overviewRoute: '/de/kurse/1-sek',
    detailRoute: '/de/kurse/1-sek/vorkurs',
    price: /CHF\s*990/,
  },
  {
    overviewRoute: '/de/kurse/2-3-sek',
    detailRoute: '/de/kurse/2-3-sek/halbjahreskurs',
    price: /CHF\s*3['’]490/,
  },
]) {
  // Betreiberentscheid 27.07.2026: kein manuell gepflegter Frühbucherpreis/-Stichtag mehr (siehe
  // supabase/migrations/20260727170000_automatic_early_bird_discount.sql) -- Karte/Hero zeigen
  // seither immer den Regulärpreis plus einen generischen, datumsunabhängigen Hinweistext statt
  // eines fest hinterlegten Frühbucher-Stichtags/-Preises (lib/pricing.ts#formatOfferPrice).
  test(`Regulärpreis + Frühbucher-Hinweistext erscheinen konsistent auf ${overviewRoute} und der Unterseite`, async ({ page }) => {
    await page.goto(overviewRoute)
    // .first(): auf der Detailseite wiederholt sich derselbe Preis pro Terminzeile.
    await expect(page.getByText(price).first()).toBeVisible()
    // .first(): derselbe Hinweistext wiederholt sich pro Terminzeile in der SessionTable.
    await expect(
      page.getByText('10% Rabatt bei Anmeldung mindestens 6 Wochen vor Kursstart').first()
    ).toBeVisible()
    await expect(page.getByText('Frühbucherrabatt bis 31. Juli', { exact: true })).not.toBeVisible()

    await page.goto(detailRoute)
    // .first(): auf der Detailseite wiederholt sich derselbe Preis pro Terminzeile.
    await expect(page.getByText(price).first()).toBeVisible()
    // .first(): derselbe Hinweistext wiederholt sich pro Terminzeile in der SessionTable.
    await expect(
      page.getByText('10% Rabatt bei Anmeldung mindestens 6 Wochen vor Kursstart').first()
    ).toBeVisible()
  })
}

for (const { route, includesKw8 } of [
  { route: '/de/kurse/4-klasse/lerncamp-sportferien', includesKw8: true },
  { route: '/de/kurse/5-klasse/lerncamp-sportferien', includesKw8: true },
  { route: '/de/kurse/6-klasse/intensivkurs-sportferien', includesKw8: true },
  { route: '/de/kurse/1-sek/lerncamp-sportferien', includesKw8: true },
  { route: '/de/kurse/2-3-sek/intensivkurs-sportferien', includesKw8: true },
  { route: '/de/kurse/bms/intensivkurs', includesKw8: true },
  { route: '/de/kurse/matura/intensivwoche', includesKw8: false },
]) {
  test(`Intensivkursperioden stammen auf ${route} aus den administrativen Fixwochen`, async ({ page }) => {
    await page.goto(route)

    await expect(page.getByText('KW 6 · 08.02.27–12.02.27', { exact: true })).toBeVisible()
    await expect(page.getByText('KW 7 · 15.02.27–19.02.27', { exact: true })).toBeVisible()

    const kw8 = page.getByText('KW 8 · 22.02.27–26.02.27', { exact: true })
    if (includesKw8) {
      await expect(kw8).toBeVisible()
    } else {
      await expect(kw8).toHaveCount(0)
    }

    await expect(page.getByText(/15\.02\.27 – 19\.02\.27/).first()).toBeVisible()
  })
}

test('BMS übernimmt die Standortbelegung der Fixwochen aus den Kursangeboten', async ({ page }) => {
  await page.goto('/de/kurse/bms/intensivkurs')

  const booking = page.locator('#buchung')
  const table = booking.locator('table')

  await booking.getByRole('radio', { name: /^KW 6 ·/ }).click()
  await expect(table.locator('tbody tr')).toHaveCount(1)
  await expect(table.getByText('Winterthur', { exact: true })).toHaveCount(1)
  await expect(table.getByText('Zürich HB', { exact: true })).toHaveCount(0)

  await booking.getByRole('radio', { name: /^KW 7 ·/ }).click()
  await expect(table.locator('tbody tr')).toHaveCount(2)
  await expect(table.getByText('Winterthur', { exact: true })).toHaveCount(1)
  await expect(table.getByText('Zürich HB', { exact: true })).toHaveCount(1)

  await booking.getByRole('radio', { name: /^KW 8 ·/ }).click()
  await expect(table.locator('tbody tr')).toHaveCount(1)
  await expect(table.getByText('Zürich HB', { exact: true })).toHaveCount(1)
  await expect(table.getByText('Winterthur', { exact: true })).toHaveCount(0)
})

test('Zusatzangebote haben eigene Markenfarben auf den Kursübersichten', async ({ page }) => {
  await page.goto('/de/kurse/6-klasse')

  const examSimulation = page.locator('[data-offer-kind="pruefungssimulation"]')
  const selfStudy = page.locator('[data-offer-kind="selbststudium"]')

  await expect(examSimulation).toHaveCount(1)
  await expect(selfStudy).toHaveCount(1)
  await expect(examSimulation.locator('.bg-gradient-to-br')).toHaveClass(/from-steel/)
  await expect(examSimulation.locator('.bg-gradient-to-br')).toHaveClass(/to-tertiary/)
  await expect(selfStudy.locator('.bg-gradient-to-br')).toHaveClass(/from-rust/)
  await expect(selfStudy.locator('.bg-gradient-to-br')).toHaveClass(/to-subject-fr/)
  await expect(
    selfStudy.getByText('Flexible Vorbereitung im eigenen Tempo', { exact: true })
  ).toBeVisible()

  await page.goto('/de/kurse/2-3-sek')
  await expect(
    page
      .locator('[data-offer-kind="selbststudium"]')
      .getByText('Flexible Vorbereitung im eigenen Tempo', { exact: true })
  ).toBeVisible()
})

const courseDetailRoutes = [
  '/de/kurse/4-klasse/halbjahreskurs',
  '/de/kurse/4-klasse/lerncamp-sportferien',
  '/de/kurse/5-klasse/halbjahreskurs',
  '/de/kurse/5-klasse/lerncamp-sportferien',
  '/de/kurse/6-klasse/halbjahreskurs',
  '/de/kurse/6-klasse/intensivkurs-sportferien',
  '/de/kurse/6-klasse/pruefungssimulation',
  '/de/kurse/6-klasse/selbststudium',
  '/de/kurse/1-sek/vorkurs',
  '/de/kurse/1-sek/lerncamp-sportferien',
  '/de/kurse/2-3-sek/halbjahreskurs',
  '/de/kurse/2-3-sek/intensivkurs-sportferien',
  '/de/kurse/2-3-sek/pruefungssimulation',
  '/de/kurse/2-3-sek/selbststudium',
  '/de/kurse/bms/halbjahreskurs',
  '/de/kurse/bms/intensivkurs',
  '/de/kurse/bms/pruefungssimulation',
  '/de/kurse/bms/selbststudium',
  '/de/kurse/matura/halbjahreskurs',
  '/de/kurse/matura/intensivwoche',
]

for (const route of courseDetailRoutes) {
  test(`Kursdetailseite ${route} lädt erfolgreich`, async ({ page }) => {
    const response = await page.goto(route)
    expect(response?.status(), `${route} sollte 200 liefern`).toBe(200)
  })
}

for (const { route, audience } of [
  { route: '/de/kurse/6-klasse/selbststudium', audience: '6. Klasse' },
  { route: '/de/kurse/2-3-sek/selbststudium', audience: '2./3. Sek' },
  { route: '/de/kurse/bms/selbststudium', audience: 'BMS' },
]) {
  test(`Selbststudium-Vorlage wird für ${audience} vollständig gerendert`, async ({ page }) => {
    await page.goto(route)

    await expect(page.getByText(`Selbststudium · ${audience}`, { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Alle Materialien an einem Ort' })).toBeVisible()
    await expect(page.getByText('3 Aufsätze mit Feedback', { exact: true })).toBeVisible()
    await expect(page.getByText('CHF 190', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Häufige Fragen' })).toBeVisible()
    await expect(page.getByRole('link', { name: `Zurück zur Übersicht ${audience}` })).toHaveAttribute(
      'href',
      route.replace('/selbststudium', '')
    )
  })
}

// Bekannte, dokumentierte Einschränkung (siehe Kommentar bei dynamicParams in
// kurse/[audience]/page.tsx): `dynamicParams = false` ist inkompatibel mit
// `nextConfig.cacheComponents`, daher kann der anfängliche HTTP-Status unter PPR 200 bleiben,
// obwohl notFound() korrekt greift und die reguläre Next.js-404-UI gerendert wird. Diese Tests
// prüfen deshalb den tatsächlichen Inhalt statt eines garantierten HTTP-Status.
test('unbekannte Zielgruppe rendert die 404-Seite', async ({ page }) => {
  await page.goto('/de/kurse/unbekannte-zielgruppe')
  await expect(page.getByText('404')).toBeVisible()
})

test('unbekannte Angebotskombination rendert die 404-Seite', async ({ page }) => {
  await page.goto('/de/kurse/4-klasse/nicht-vorhandenes-angebot')
  await expect(page.getByText('404')).toBeVisible()
})

test('bestehende unlokalisierte Route /kurse bleibt erreichbar', async ({ page }) => {
  const response = await page.goto('/kurse')
  expect(response?.status()).toBe(200)
})

// ---------------------------------------------------------------------------
// 2) Root-Redirect: "/" -> "/de" (next-intl, localePrefix "always").
// ---------------------------------------------------------------------------

test('"/" leitet auf "/de" weiter', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  expect(new URL(page.url()).pathname).toBe('/de')
})

// ---------------------------------------------------------------------------
// 3) Auth-Seiten sind unlokalisiert und anonym erreichbar.
// ---------------------------------------------------------------------------

test('/login ist anonym erreichbar und unlokalisiert', async ({ page }) => {
  const response = await page.goto('/login')
  expect(response?.status()).toBe(200)
  expect(new URL(page.url()).pathname).toBe('/login')
})

test('/register ist anonym erreichbar und unlokalisiert', async ({ page }) => {
  const response = await page.goto('/register')
  expect(response?.status()).toBe(200)
  expect(new URL(page.url()).pathname).toBe('/register')
})

// ---------------------------------------------------------------------------
// 4) Anonyme Redirects fuer geschuetzte Routen: exakter callbackUrl-Pfad.
// ---------------------------------------------------------------------------

const protectedRoutesForAnonymousRedirect = [
  '/dashboard',
  '/profil',
  '/trainer',
  '/uebungen',
  '/pruefung',
  '/aufsaetze',
  '/intensivkurse',
  '/materialien',
  '/materialien/langzeitgymi',
  '/arbeitszeiten',
  '/dashboard/finanzen',
  '/dashboard/kurse/tagesfreigaben',
  '/dashboard/arbeitszeiten',
]

for (const route of protectedRoutesForAnonymousRedirect) {
  test(`anonymer Zugriff auf ${route} leitet mit exaktem callbackUrl nach /login`, async ({ page }) => {
    await page.goto(route)
    const url = new URL(page.url())
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('callbackUrl')).toBe(route)
  })
}

// ---------------------------------------------------------------------------
// 5) Authentifizierte Redirects: /login, /register -> /dashboard; validierter callbackUrl hat
//    Vorrang.
// ---------------------------------------------------------------------------

test.describe('authentifiziert als E2E-Nutzer (Rolle "user")', () => {
  test.use({ storageState: undefined })

  test('Simulationsprüfung zeigt Mathematik und die geplante Deutschprüfung', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD, '/pruefung')

    await expect(
      page.getByRole('heading', { name: 'Welches Fach möchtest du simulieren?' })
    ).toBeVisible()
    // CardTitle rendert als <div>, nicht als Heading-Element (shadcn-Konvention) -- getByText statt
    // getByRole('heading') matcht deshalb den tatsächlichen Kartentitel.
    await expect(page.getByText('Mathematik', { exact: true })).toBeVisible()
    await expect(page.getByText('Deutsch', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: 'Deutsche Simulationsprüfung – bald verfügbar',
        exact: true,
      })
    ).toBeDisabled()
  })

  test('/login ohne Rücksprungziel führt nach erfolgreichem Login zu /dashboard', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)
    expect(new URL(page.url()).pathname).toBe('/dashboard')
  })

  test('Schüler sieht weder den Kursabschnitt noch den Intensivkurs-Link in der Sidebar', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)

    await expect(page.getByRole('button', { name: 'Kurse', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Intensivkurse', exact: true })).toHaveCount(0)
  })

  test('Schüler erreicht den Aufsatz-Upload direkt vom Dashboard und über das mobile Menü', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)

    await page.getByRole('link', { name: 'Neuer Aufsatz', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/aufsaetze' && url.searchParams.get('neu') === '1')
    await expect(page.getByRole('heading', { name: 'Neuen Aufsatz hochladen' })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Menü öffnen' }).click()
    await expect(
      page.locator('nav').first().getByRole('link', { name: 'Aufsätze', exact: true })
    ).toBeVisible()
  })

  test('gültiger interner callbackUrl wird nach Login exakt übernommen', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD, '/profil')
    expect(new URL(page.url()).pathname).toBe('/profil')
  })

  test('bereits angemeldeter Nutzer wird von /login sofort weitergeleitet (callbackUrl übernommen)', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)
    await page.goto('/login?callbackUrl=/profil')
    expect(new URL(page.url()).pathname).toBe('/profil')
  })

  test('externe/protokoll-relative callbackUrl wird verworfen (Open-Redirect-Schutz)', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)
    await page.goto('/login?callbackUrl=' + encodeURIComponent('//evil.example.com'))
    const url = new URL(page.url())
    expect(url.hostname).not.toBe('evil.example.com')
    expect(url.pathname).toBe('/dashboard')
  })

  test('Nicht-Admin wird von /dashboard/finanzen weggeleitet', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)
    await page.goto('/dashboard/finanzen')
    await waitForRedirectAway(page, '/dashboard/finanzen')
    const url = new URL(page.url())
    expect(url.pathname).toBe('/dashboard')
    expect(url.searchParams.get('error')).toBe('unauthorized')
    await expect(page.getByText('Bruttogewinn')).toHaveCount(0)
  })

  test('Nicht-Admin wird von /dashboard/kurse/tagesfreigaben weggeleitet', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)
    await page.goto('/dashboard/kurse/tagesfreigaben')
    await waitForRedirectAway(page, '/dashboard/kurse/tagesfreigaben')
    const url = new URL(page.url())
    expect(url.pathname).toBe('/dashboard')
    expect(url.searchParams.get('error')).toBe('unauthorized')
  })

  test('Nicht-Admin wird von den administrativen Kursübersichten weggeleitet', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)

    for (const route of ['/dashboard/kurse/intensivkurse', '/dashboard/kurse/vorkurse']) {
      await page.goto(route)
      await waitForRedirectAway(page, route)
      const url = new URL(page.url())
      expect(url.pathname).toBe('/dashboard')
      expect(url.searchParams.get('error')).toBe('unauthorized')
    }
  })

  test('Nicht-Admin wird von /dashboard/arbeitszeiten weggeleitet', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)
    await page.goto('/dashboard/arbeitszeiten')
    await waitForRedirectAway(page, '/dashboard/arbeitszeiten')
    const url = new URL(page.url())
    expect(url.pathname).toBe('/dashboard')
    expect(url.searchParams.get('error')).toBe('unauthorized')
  })

  test('Nicht-Lehrperson wird von /arbeitszeiten (Lehrpersonen-Dashboard) weggeleitet', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)
    await page.goto('/arbeitszeiten')
    await waitForRedirectAway(page, '/arbeitszeiten')
    const url = new URL(page.url())
    expect(url.pathname).toBe('/dashboard')
    expect(url.searchParams.get('error')).toBe('unauthorized')
  })

  test('Zugriff auf einen geschützten Materialbereich ohne aktiven Grant zeigt "Kein Zugang"', async ({ page }) => {
    await loginAs(page, E2E_USER_EMAIL, E2E_USER_PASSWORD)
    const response = await page.goto('/materialien/bms')
    expect(response?.status()).toBe(200)
    expect(new URL(page.url()).pathname).toBe('/materialien/bms')
    await expect(page.getByText('Kein Zugang')).toBeVisible()
  })

  test('callbackUrl aus einem geschützten Materialbereich führt nach Login dorthin zurück', async ({ page }) => {
    await page.goto('/materialien/bms')
    expect(new URL(page.url()).pathname).toBe('/login')
    await page.getByLabel('Email').fill(E2E_USER_EMAIL)
    await page.getByLabel('Passwort').fill(E2E_USER_PASSWORD)
    await page.getByRole('button', { name: /Anmelden/i }).click()
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 15_000 })
    expect(new URL(page.url()).pathname).toBe('/materialien/bms')
  })
})

test.describe('authentifiziert als E2E-Admin', () => {
  test('Klassennavigation öffnet den passenden Materialbereich und übernimmt die Klasse beim Upload', async ({ page }) => {
    await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
    await page.getByRole('button', { name: '4.Kl', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/dashboard/materialien')

    await page.getByRole('link', { name: /Neues Material/ }).first().click()
    await expect(page.getByRole('button', { name: '4. Klasse', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('Admin erreicht /dashboard/finanzen', async ({ page }) => {
    await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
    const response = await page.goto('/dashboard/finanzen')
    expect(response?.status()).toBe(200)
    expect(new URL(page.url()).pathname).toBe('/dashboard/finanzen')
  })

  test('Admin erreicht /dashboard/kurse/tagesfreigaben', async ({ page }) => {
    await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
    const response = await page.goto('/dashboard/kurse/tagesfreigaben')
    expect(response?.status()).toBe(200)
    expect(new URL(page.url()).pathname).toBe('/dashboard/kurse/tagesfreigaben')
  })

  test('Admin sieht Intensivkurse und Vorkurse im Kursabschnitt nach der Administration', async ({ page }) => {
    await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)

    const administrationButton = page.getByRole('button', { name: 'Administration', exact: true })
    const coursesButton = page.getByRole('button', { name: 'Kurse', exact: true })
    await expect(administrationButton).toBeVisible()
    await expect(coursesButton).toBeVisible()

    const administrationBox = await administrationButton.boundingBox()
    const coursesBox = await coursesButton.boundingBox()
    expect(administrationBox).not.toBeNull()
    expect(coursesBox).not.toBeNull()
    expect(coursesBox!.y).toBeGreaterThan(administrationBox!.y)

    await coursesButton.click()
    await expect(page.getByRole('link', { name: 'Kursverwaltung', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Intensivkurse', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Intensivkurse', exact: true })).toBeVisible()
    await expect(page.getByRole('row')).toHaveCount(8)

    await page.goto('/dashboard/kurse/vorkurse')
    await expect(page.getByRole('heading', { name: 'Vorkurse', exact: true })).toBeVisible()
    await expect(page.getByRole('row')).toHaveCount(8)
  })

  test('Admin erreicht /dashboard/arbeitszeiten', async ({ page }) => {
    await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
    const response = await page.goto('/dashboard/arbeitszeiten')
    expect(response?.status()).toBe(200)
    expect(new URL(page.url()).pathname).toBe('/dashboard/arbeitszeiten')
  })

  test('Admin sieht das Admin-Panel im geschützten Materialbereich', async ({ page }) => {
    await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
    await page.goto('/materialien/bms')
    await expect(page.getByText('Zugriff verwalten (Admin)')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 6) SiteNav: genau einmal gerendert, Login-CTA zeigt immer auf /login (nie lokalisiert).
// ---------------------------------------------------------------------------

test('SiteNav rendert genau einmal auf der Startseite mit Login-Link zu /login', async ({ page }) => {
  await page.goto('/de')
  const nav = page.locator('nav')
  await expect(nav).toHaveCount(1)
  const serviceNav = page.getByRole('list', { name: 'Service-Navigation' })
  await expect(serviceNav).toContainText('EN')
  await expect(serviceNav.getByRole('link', { name: 'Kontakt' })).toHaveAttribute('href', '/de/kontakt')
  const loginLink = page.getByRole('link', { name: /login/i })
  await expect(loginLink).toHaveAttribute('href', '/login')

  const serviceText = await serviceNav.innerText()
  expect(serviceText.indexOf('EN')).toBeLessThan(serviceText.indexOf('Kontakt'))
  expect(serviceText.indexOf('Kontakt')).toBeLessThan(serviceText.indexOf('Login'))
})

test('mobiler Login-CTA übernimmt das Marketing-Theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/de')
  await page.getByRole('button', { name: 'Menü öffnen' }).click()

  const navigationSheet = page.getByRole('dialog')
  await expect(navigationSheet).toHaveClass(/brand-marketing/)
  await expect(navigationSheet.getByText('EN', { exact: true })).toBeVisible()
  await expect(navigationSheet.getByRole('link', { name: 'Kontakt' })).toHaveAttribute('href', '/de/kontakt')
  await expect(navigationSheet.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login')
})

test('SiteNav erscheint nicht auf /login', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('link', { name: '4.Kl' })).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// 7) Cache-Regression (Abschnitt 7): Verfügbarkeit ist ungecacht (connection() + Suspense),
//    stabile Katalogdaten sind gecacht und werden erst nach updateTag() aktualisiert. Beide
//    Pfade müssen ohne Wartezeit/Reload jenseits der normalen Navigation korrekt sein.
// ---------------------------------------------------------------------------

test.describe('Cache-Regression: Buchung und Verfügbarkeit', () => {
  for (const examPage of [
    {
      route: '/de/kurse/6-klasse/pruefungssimulation',
      audience: '6. Klasse · Langgymnasium',
      duration: '60 Minuten',
      expectedRows: 4,
    },
    {
      route: '/de/kurse/2-3-sek/pruefungssimulation',
      audience: 'Sekundarschule · Kurzgymnasium',
      duration: '90 Minuten',
      expectedRows: 4,
    },
  ]) {
    test(`Prüfungssimulation ${examPage.route} entspricht der Detailvorlage`, async ({ page }) => {
      await page.goto(examPage.route)

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Prüfungssimulation unter realistischen Bedingungen',
        })
      ).toBeVisible()
      await expect(page.getByText(examPage.audience, { exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Ablauf der Prüfungssimulation' })).toBeVisible()
      await expect(page.getByText(examPage.duration, { exact: true }).first()).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Auswertung und Aufsatzkorrektur' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Aufsatzkorrektur im persönlichen Portal' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Termine und Buchung' })).toBeVisible()
      await expect(page.locator('table tbody tr')).toHaveCount(examPage.expectedRows)
      await expect(page.getByRole('heading', { name: 'Häufige Fragen' })).toBeVisible()
    })
  }

  test('Lerncamp der 1. Sek lässt sich nach Kurswoche filtern', async ({ page }) => {
    await page.goto('/de/kurse/1-sek/lerncamp-sportferien')

    // Label-Format seit den administrativen Fixwochen (school_holiday_weeks): "KW <Nr> ·
    // <Mo>–<Fr>", nicht mehr das alte "<Tag>.–<Tag>. Februar".
    await expect(page.getByRole('radio', { name: 'Alle Kurswochen' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'KW 6 · 08.02.27–12.02.27' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'KW 7 · 15.02.27–19.02.27' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'KW 8 · 22.02.27–26.02.27' })).toBeVisible()

    await page.getByRole('radio', { name: 'KW 7 · 15.02.27–19.02.27' }).click()
    // 3 parallele Kursgruppen pro Kurswoche (Kurs A/B/C, verschiedene Standorte/Zeiten) --
    // die Filterung schliesst KW 6/8 korrekt aus, reduziert aber nicht auf eine einzelne Zeile.
    await expect(page.locator('table tbody tr')).toHaveCount(3)
    // "table tbody" statt "table tbody tr": Mehrere Zeilen widersprechen sonst toContainText's
    // Ein-Element-Anforderung (Strict-Mode-Fehler bei 3 tr-Elementen).
    const tbody = page.locator('table tbody')
    await expect(tbody).toContainText('15.02.27 – 19.02.27')
    await expect(tbody).not.toContainText('08.02.27 – 12.02.27')
  })

  test('konkret gewählte Session öffnet ohne Umweg ihr Anmeldeformular', async ({ page }) => {
    await page.goto('/de/kurse/4-klasse/halbjahreskurs')

    const selectedRow = page.locator('table tbody tr', { hasText: 'Kurs A' })
    await expect(selectedRow.getByText('freie Plätze')).toBeVisible()
    await selectedRow.getByRole('button', { name: 'Anmelden' }).click()

    await expect(page).toHaveURL(/\/de\/kurse\/4-klasse\/halbjahreskurs$/)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Anmeldung: Kurs A' })).toBeVisible()
    await expect(page.locator('input[name="kurs_id"]')).toHaveValue('8001')
    await expect(page.locator('[name="child_class_level"]')).toHaveCount(0)
    await expect(page.getByText('Klassenstufe *', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Samstag, 13:15–15:00')).toBeVisible()
  })

  test('Kursinhalt startet mit eingeklappten Fachabschnitten', async ({ page }) => {
    await page.goto('/de/kurse/6-klasse/halbjahreskurs')

    const mathematik = page.locator('details').filter({
      has: page.getByRole('heading', { name: 'Mathematik', exact: true }),
    })
    const deutsch = page.locator('details').filter({
      has: page.getByRole('heading', { name: 'Deutsch', exact: true }),
    })

    await expect(mathematik).not.toHaveAttribute('open', '')
    await expect(deutsch).not.toHaveAttribute('open', '')
  })

  test('Buchung reduziert die sichtbare Verfügbarkeit sofort, ohne Wartezeit oder manuellen Reload', async ({ page }) => {
    await page.goto('/de/kurse/6-klasse/intensivkurs-sportferien')

    // "table" grenzt auf den Desktop-Renderpfad ein -- SessionTable rendert Tabelle und
    // Mobile-Kartenliste gleichzeitig ins DOM (hidden/md:hidden statt display:none), ohne diese
    // Eingrenzung träfe der Locator auf zwei Elemente (Strict-Mode-Fehler).
    // max_teilnehmer=1 in der Fixture unten: 0 Buchungen -> remainingPlaces=1 -> "wenige Plätze"
    // (Abschnitt 2.10: "wenige" bei 1-2 Restplätzen), nicht "freie Plätze" -- erst >2 Restplätze
    // wären "frei". Der Punkt des Tests ist der Sprung auf "keine Plätze" nach der Buchung.
    const row = page.locator('table tbody tr', { hasText: 'Kurs B' })
    await expect(row.getByText('wenige Plätze')).toBeVisible()
    await expect(row.getByRole('button', { name: 'Anmelden' })).toBeEnabled()

    await row.getByRole('button', { name: 'Anmelden' }).click()

    await page.locator('input[name="child_firstname"]').fill('Test')
    await page.locator('input[name="child_lastname"]').fill('Kind')
    await page.locator('input[name="child_gender"][value="d"]').check()
    await page.locator('input[name="parent_email"]').fill(`e2e-booking-${Date.now()}@example.test`)
    await page.locator('input[name="parent_phone"]').fill('+41 79 123 45 67')
    await page.getByRole('button', { name: 'Verbindlich anmelden' }).click()

    await expect(page.getByText('Anmeldung erfolgreich!')).toBeVisible({ timeout: 10_000 })

    // onClose ruft router.refresh() auf (Abschnitt 7, Punkt 3) -- kein revalidateTag/Timeout nötig.
    // Der Response-Listener muss VOR dem Klick registriert werden (Promise.all), sonst kann die
    // RSC-Antwort unter guten Bedingungen schneller zurückkommen, als waitForResponse zu lauschen
    // beginnt, und der Test würde sie verpassen (race).
    // router.refresh() muss den ungecachten Suspense-Abschnitt (BookingSectionLoader) neu vom
    // Server laden und streamen -- kein manueller Reload/Timer, aber echte Netzwerk-/Renderzeit
    // (vgl. die ähnliche, dokumentierte Verzögerung bei Redirects unter PPR weiter oben). Der
    // RSC-Refetch ist explizit abwartbar (eigene Netzwerk-Response auf denselben Pfad) -- das
    // trennt "Netzwerk-Rundreise war langsam" von "DOM hat trotz frischer Daten nicht
    // aktualisiert" und macht Fehlschläge unter Systemlast diagnostizierbar, statt nur einen
    // einzigen groben Timeout auf das Endergebnis zu setzen.
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/de/kurse/6-klasse/intensivkurs-sportferien') && resp.ok(),
        { timeout: 45_000 }
      ),
      page.getByRole('button', { name: 'Schliessen' }).click(),
    ])

    // Die zugrunde liegende DB-Buchung ist zu diesem Zeitpunkt bereits abgeschlossen (mehrfach per
    // direktem DB-Query bestätigt); das Rendern der bereits eingetroffenen Antwort ins DOM braucht
    // nur noch normale Client-Zeit.
    await expect(row.getByText('keine Plätze')).toBeVisible({ timeout: 10_000 })
    await expect(row.getByRole('button', { name: 'Anmelden' })).toBeDisabled()
  })

  test('Admin-Preisänderung an einem Bestandskurs ist nach dem Speichern sofort auf /kurse sichtbar', async ({ page }) => {
    // Die Zielgruppen-Hauptseite zeigt seit der Entfernung von ExistingCourseBooking keine
    // Bestandskurse (intensivwoche_kurse) mehr -- die einzige verbleibende öffentliche Anzeige
    // dieser Preise ist die unlokalisierte Bestandsroute /kurse (app/(public)/kurse).
    await page.goto('/kurse')
    await expect(page.getByText('E2E Preistest-Kurs')).toBeVisible()
    await expect(page.getByText(/CHF\s*888/)).toBeVisible()

    await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
    await page.goto(`/dashboard/kurse/${PRICE_TEST_KURS_ID}`)
    await expect(page.locator('select[name="fach"]')).not.toHaveValue('')
    // Das preis-<input> hat step={10} (natives HTML5-Constraint, kurs-formular.tsx) -- ein Wert,
    // der kein Vielfaches von 10 ist, lässt checkValidity() fehlschlagen und blockiert die
    // Formularübermittlung bereits auf Browser-Ebene, BEVOR der submit-Event überhaupt an React
    // weitergereicht wird (kein onSubmit-Aufruf, keine sichtbare Fehlermeldung, kein Netzwerk-
    // Request -- ausführlich diagnostiziert). Deshalb hier zwingend ein Vielfaches von 10.
    await page.locator('input[name="preis"]').fill('780')
    await page.getByRole('button', { name: 'Änderungen speichern' }).click()
    // updateKurs() ruft invalidateCourseCaches() synchron vor der Erfolgsantwort auf -- die
    // sichtbare Erfolgsmeldung beweist bereits, dass updateTag('courses') gelaufen ist. Wir warten
    // bewusst NICHT auf die anschliessende router.push()-Weiterleitung (setTimeout(1000) +
    // clientseitige Navigation zu /dashboard/kurse): das haengt zusaetzlich von der Ladezeit dieser
    // unabhaengigen Seite ab und macht den Test unter Systemlast unnoetig flakey, ohne mehr über
    // die Cache-Invalidierung selbst auszusagen.
    await expect(page.getByText('Kurs erfolgreich aktualisiert!')).toBeVisible({ timeout: 15_000 })

    // Frische Navigation, kein Reload/Wartezeit -- prüft, dass updateTag('courses') in
    // app/(dashboard)/dashboard/kurse/actions.ts den 'use cache'-Katalogeintrag sofort invalidiert
    // (Abschnitt 7, Punkt 3), statt bis cacheLife('hours') abzulaufen.
    await page.goto('/kurse')
    await expect(page.getByText(/CHF\s*780/)).toBeVisible()
    await expect(page.getByText(/CHF\s*888/)).toHaveCount(0)
  })

  test('offer_editions-Preisänderung über die neue Admin-Maske ist sofort auf der Kursdetailseite sichtbar', async ({ page }) => {
    // Deckt einen zweiten, unabhängigen Preis-/Cache-Pfad ab: lib/kurse/catalog.ts überschreibt seit
    // 20260722130621_seed_published_offer_editions.sql den statischen Fixture-Preis mit dem
    // zugehörigen offer_editions-Datensatz; app/(dashboard)/dashboard/kurse/durchfuehrungen/actions.ts
    // ruft dafür jetzt updateTag('offers') auf (vorher: gar keine Invalidierung, siehe Kommentar dort).
    await page.goto('/de/kurse/6-klasse/halbjahreskurs')
    // .first(): derselbe Preis erscheint zusätzlich pro Terminzeile in der SessionTable -- der
    // Locator matcht deshalb mehrere Elemente, nicht nur den einen Überblicks-Preis.
    await expect(page.getByText(/CHF\s*3['’]?490/).first()).toBeVisible()

    await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
    await page.goto('/dashboard/kurse/angebote')

    // Die Admin-Maske ist ein einzelnes kombiniertes Formular (edition-workspace.tsx) mit einem
    // "Kursangebot"-<select>, dessen onChange direkt zur gewählten Durchführung navigiert -- keine
    // separaten Zielgruppen-Gruppen mit Geschwister-Links mehr.
    await page.getByLabel('Kursangebot').selectOption({ label: '6. Klasse · Vorkurs' })

    await expect(page.locator('input[name="regularPriceChf"]')).toHaveValue('3490')
    await page.locator('input[name="regularPriceChf"]').fill('4001')
    await page.getByRole('button', { name: 'Entwurf speichern' }).click()
    await expect(page.getByText(/gespeichert/i)).toBeVisible({ timeout: 15_000 })

    // Frische Navigation, kein Reload/Wartezeit -- prüft updateTag('offers') statt cacheLife('hours')
    // abzuwarten. Der Preis wird als CHF 4'001.00 formatiert (formatChfRappen, lib/pricing.ts).
    await page.goto('/de/kurse/6-klasse/halbjahreskurs')
    await expect(page.getByText(/CHF\s*4['’]?001/).first()).toBeVisible()
    await expect(page.getByText(/CHF\s*3['’]?490/)).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// 8) SEO (Abschnitt 10.4): sitemap.xml/robots.txt und Canonical-/OpenGraph-Metadata.
// ---------------------------------------------------------------------------

test.describe('SEO', () => {
  test('robots.txt sperrt standardmässig alles (Fail-closed ohne NEXT_PUBLIC_ALLOW_INDEXING)', async ({ page }) => {
    const response = await page.goto('/robots.txt')
    expect(response?.status()).toBe(200)
    const body = await response!.text()
    expect(body).toContain('Disallow: /')
  })

  test('sitemap.xml enthält reale Zielgruppen-/Kursrouten, aber keine inhaltlich noch leeren Seiten', async ({ page }) => {
    const response = await page.goto('/sitemap.xml')
    expect(response?.status()).toBe(200)
    const body = await response!.text()

    expect(body).toContain('<loc>http://localhost:3000/de</loc>')
    expect(body).toContain('<loc>http://localhost:3000/de/kurse/6-klasse</loc>')
    expect(body).toContain('<loc>http://localhost:3000/de/kurse/6-klasse/intensivkurs-sportferien</loc>')

    // /kontakt, /impressum, /agb, /datenschutz haben jetzt echte, vom Betreiber bestätigte Inhalte
    // (siehe app/sitemap.ts) und sind Teil der sitemap.
    expect(body).toContain('<loc>http://localhost:3000/de/kontakt</loc>')
    expect(body).toContain('<loc>http://localhost:3000/de/impressum</loc>')
    expect(body).toContain('<loc>http://localhost:3000/de/agb</loc>')
    expect(body).toContain('<loc>http://localhost:3000/de/datenschutz</loc>')

    // /standorte nennt zwar echte Ortsnamen, aber keine vollständigen Adressen -- bewusst nicht in
    // der sitemap.
    expect(body).not.toContain('/standorte')
  })

  test('Startseite hat Canonical-URL und OpenGraph-/Twitter-Metadata', async ({ page }) => {
    await page.goto('/de')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/de$/)
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /\/de$/)
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary')
  })

  test('Kursdetailseite hat eine eigene, abweichende Canonical-URL', async ({ page }) => {
    await page.goto('/de/kurse/6-klasse/intensivkurs-sportferien')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/de\/kurse\/6-klasse\/intensivkurs-sportferien$/
    )
  })
})
