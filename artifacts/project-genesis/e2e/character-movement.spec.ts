import { test, expect } from '@playwright/test'

test.describe('Character Movement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000')
  })

  test('should render character on screen', async ({ page }) => {
    const character = page.locator('.character')
    await expect(character).toBeVisible()
  })

  test('should move character with arrow keys', async ({ page }) => {
    const character = page.locator('.character').first()

    const initialBox = await character.boundingBox()
    expect(initialBox).toBeDefined()

    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)

    const afterBox = await character.boundingBox()
    expect(afterBox).toBeDefined()
    expect(afterBox?.x).toBeGreaterThan(initialBox?.x!)
  })

  test('should move character with WASD keys', async ({ page }) => {
    const character = page.locator('.character').first()

    const initialBox = await character.boundingBox()

    await page.keyboard.press('w')
    await page.waitForTimeout(100)

    const afterBox = await character.boundingBox()
    expect(afterBox?.y).toBeLessThan(initialBox?.y!)
  })

  test('should have animation class while moving', async ({ page }) => {
    const character = page.locator('.character').first()

    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(100)

    const classes = await character.getAttribute('class')
    expect(classes).toContain('walk-frame')

    await page.keyboard.up('ArrowRight')
  })
})
