import { expect, test, type Browser, type Page } from '@playwright/test'

/** Every browser context is a separate person (own localStorage = own clientId). */
async function person(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  return context.newPage()
}

async function setNickname(page: Page, name: string) {
  const dialog = page.getByRole('dialog', { name: /call you/i })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nickname').fill(name)
  await dialog.getByRole('button', { name: "Let's go" }).click()
  await expect(dialog).toBeHidden()
}

function column(page: Page, title: string) {
  return page.getByRole('region', { name: title })
}

test('two people collaborate on a board in real time', async ({ browser }) => {
  const alice = await person(browser)
  const bob = await person(browser)

  // Alice creates a board and gets a share link
  await alice.goto('/')
  await alice.getByLabel('Board title').fill('E2E Retro')
  await alice.getByRole('button', { name: 'Create retro board' }).click()
  await expect(alice).toHaveURL(/\/b\/[A-Za-z0-9]{12}$/)
  const share = alice.getByRole('dialog', { name: /ready/i })
  await expect(share.getByLabel('Board link')).toHaveValue(alice.url())
  // …and picks a nickname in the same dialog
  await share.getByLabel('Nickname').fill('Alice')
  await share.getByRole('button', { name: "Let's retro" }).click()
  await expect(share).toBeHidden()

  // Bob joins via the link
  await bob.goto(alice.url())
  await setNickname(bob, 'Bob')
  await expect(bob.getByRole('heading', { name: 'E2E Retro' })).toBeVisible()

  // Alice posts with her nickname; Bob sees it live
  const aliceWell = column(alice, 'What went well')
  await aliceWell.getByLabel('Add to What went well').fill('Shipped the new onboarding')
  await aliceWell.getByLabel('Add to What went well').press('Enter')
  const bobWell = column(bob, 'What went well')
  await expect(bobWell.getByText('Shipped the new onboarding')).toBeVisible()
  await expect(bobWell.getByText('👤 Alice')).toBeVisible()

  // Bob posts anonymously; Alice can't tell who it was
  const bobImprove = column(bob, 'To improve')
  await bobImprove.getByRole('radio', { name: '🥷 Anonymous' }).click()
  await bobImprove.getByLabel('Add to To improve').fill('Standups run too long')
  await bobImprove.getByRole('button', { name: 'Add' }).click()
  const aliceImprove = column(alice, 'To improve')
  const anonCard = aliceImprove.getByRole('button', { name: /Standups run too long/ })
  await expect(anonCard).toBeVisible()
  await expect(anonCard.getByText('🥷 Anonymous')).toBeVisible()
  await expect(anonCard.getByText('(you)')).toHaveCount(0)

  // Bob votes; Alice sees the count, Bob's column budget goes down
  await bobWell.getByRole('button', { name: 'Vote (0 votes)', exact: true }).click()
  await expect(aliceWell.getByRole('button', { name: 'Vote (1 vote)', exact: true })).toBeVisible()
  await expect(bobWell.getByText('4 votes left')).toBeVisible()
  await expect(column(bob, 'To improve').getByText('5 votes left')).toBeVisible()

  // Only the owner sees settings; locking makes the board read-only for everyone
  await expect(bob.getByRole('button', { name: 'Board settings' })).toHaveCount(0)
  await alice.getByRole('button', { name: 'Board settings' }).click()
  await alice.getByRole('switch').click()
  await expect(bob.getByText('This board is locked.')).toBeVisible()
  await expect(bob.getByLabel('Add to What went well')).toHaveCount(0)
})
