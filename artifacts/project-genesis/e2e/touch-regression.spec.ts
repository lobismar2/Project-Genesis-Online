import { test, expect } from '@playwright/test';

test.describe('Project Genesis Touch Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Joystick touch with pointerup and pointercancel', async ({ page, browserName }) => {
    // Start game by clicking hub-play button
    await page.click('[data-testid="button-hub-play"]');
    await page.waitForSelector('[data-testid="game-screen"]', { timeout: 5000 });

    // Select faction
    const factionButton = page.locator('[data-testid="faction-select"]').first();
    await factionButton.click();
    await page.waitForLoadState('networkidle');

    // Test joystick pointerup event
    const joystick = page.locator('[data-testid="joystick"]');
    await joystick.dispatchEvent('pointerdown', { pointerId: 1 });
    await page.waitForTimeout(100);
    await joystick.dispatchEvent('pointerup', { pointerId: 1 });

    // Test joystick pointercancel event
    await joystick.dispatchEvent('pointerdown', { pointerId: 2 });
    await page.waitForTimeout(100);
    await joystick.dispatchEvent('pointercancel', { pointerId: 2 });

    // Verify game is still running
    const gameScreen = page.locator('[data-testid="game-screen"]');
    await expect(gameScreen).toBeVisible();
  });

  test('Combat, navigation and panel open/close', async ({ page }) => {
    // Start game by clicking hub-play button
    await page.click('[data-testid="button-hub-play"]');
    await page.waitForSelector('[data-testid="game-screen"]', { timeout: 5000 });

    // Select faction
    const factionButton = page.locator('[data-testid="faction-select"]').first();
    await factionButton.click();
    await page.waitForLoadState('networkidle');

    // Test navigation
    const leftButton = page.locator('[data-testid="nav-left"]');
    const rightButton = page.locator('[data-testid="nav-right"]');

    await leftButton.click();
    await page.waitForTimeout(300);
    await rightButton.click();
    await page.waitForTimeout(300);

    // Test panel open
    const panelButton = page.locator('[data-testid="open-panel"]');
    await panelButton.click();
    const panel = page.locator('[data-testid="panel"]');
    await expect(panel).toBeVisible();

    // Test panel close
    const closeButton = page.locator('[data-testid="close-panel"]');
    await closeButton.click();
    await expect(panel).not.toBeVisible();

    // Test combat interaction
    const enemyButton = page.locator('[data-testid="enemy"]').first();
    if (await enemyButton.isVisible()) {
      await enemyButton.click();
      const combatUI = page.locator('[data-testid="combat-ui"]');
      await expect(combatUI).toBeVisible({ timeout: 3000 });
    }

    // Verify game is still responsive
    const gameScreen = page.locator('[data-testid="game-screen"]');
    await expect(gameScreen).toBeVisible();
  });
});
