import { expect, test } from '@playwright/test';

test.describe('controles de toque no viewport mobile', () => {
  test('atravessa fisicamente todos os portais e preserva a campanha', async ({ page }) => {
    // Andar por toque leva mais passos que o joystick antigo: cada toque move o
    // jogador no máximo meia tela, então atravessar quatro mapas leva mais tempo.
    test.setTimeout(180_000);
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.getByTestId('button-hub-play').click();
    await page.getByTestId('button-faction-awakened').click();
    await page.getByRole('button', { name: 'Colosso de Musgo' }).click();
    await expect(page.getByTestId('screen-game')).toBeVisible();

    const playerName = await page.getByTestId('status-player').locator('.player-name').textContent();
    expect(playerName).toContain('Colosso de Musgo');
    const playerLevel = await page.getByTestId('status-player').locator('.level-chip').textContent();
    await page.getByTestId('button-inventory').click();
    await expect(page.getByTestId('inventory-item-sword1')).toContainText('Adaga Prática');
    await expect(page.getByTestId('inventory-item-flask')).toContainText('Frasco de Vida');
    await page.getByTestId('panel-inventory').getByRole('button', { name: 'Fechar bolsa' }).last().click();

    const walkThroughExit = async (destination: string) => {
      // A câmera segue o jogador, então tocar no meio vertical do canvas mantém
      // o destino na mesma linha horizontal do portal de saída. Variar a altura
      // faz o jogador desviar e passar longe do raio do portal.
      const canvas = page.getByTestId('canvas-game');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      const clientX = box!.x + box!.width * 0.05;
      const clientY = box!.y + box!.height / 2;

      await expect(async () => {
        await canvas.dispatchEvent('pointerdown', { pointerId: 21, clientX, clientY, bubbles: true });
        await expect(page.locator('.log-stack')).toContainText(`Entrou em ${destination}`, { timeout: 1_500 });
      }).toPass({ timeout: 30_000 });

      await expect.poll(async () => page.evaluate(() => {
        const raw = localStorage.getItem('genesis-save');
        return raw ? JSON.parse(raw) : null;
      })).toMatchObject({
        avatar: 'moss',
        inventory: { sword1: 1, clotharmor: 1, flask: 2 },
      });
      await expect(page.getByTestId('status-player').locator('.player-name')).toContainText('Colosso de Musgo');
      await expect(page.getByTestId('status-player').locator('.level-chip')).toHaveText(playerLevel!);
    };

    await walkThroughExit('Cavernas de Cristal');
    await walkThroughExit('Geleira do Silêncio');
    await walkThroughExit('Caldeira Rubra');
    await walkThroughExit('Florestas Brilhantes');

    expect(consoleErrors).toEqual([]);
  });

  test('aciona e fecha combate, navegação e painéis sem sair da área de toque', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.goto('/');
    await page.getByTestId('button-hub-play').click();
    await page.getByTestId('button-faction-awakened').click();
    await page.getByRole('button', { name: 'Espreitador de Espinhos' }).click();
    await expect(page.getByTestId('screen-game')).toBeVisible();

    const controls = page.locator('button, canvas');
    const count = await controls.count();
    for (let index = 0; index < count; index += 1) {
      const element = controls.nth(index);
      if (await element.isVisible()) {
        const box = await element.boundingBox();
        expect(box, `controle ${index} deve ter uma caixa`).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(360);
        expect(box!.y + box!.height).toBeLessThanOrEqual(740);
      }
    }

    await page.getByTestId('canvas-game').click({ position: { x: 180, y: 320 } });
    await page.keyboard.press('1');
    await page.locator('.skill-button:not([disabled])').first().click();
    await page.getByTestId('button-flask').click();
    await page.getByTestId('button-minimap-region-1').click();
    await page.getByTestId('button-journal').click();
    await expect(page.getByTestId('panel-journal')).toBeVisible();
    await page.getByTestId('panel-journal').getByLabel('Fechar diário').click();
    await page.getByTestId('button-achievements').click();
    await expect(page.getByTestId('panel-achievements')).toBeVisible();
    await page.getByTestId('button-close-achievements').click();
    await page.getByTestId('button-weapon').click();
    await expect(page.getByTestId('panel-equipment')).toBeVisible();
    await page.getByRole('button', { name: 'Fechar equipamento' }).click();
    await page.getByTestId('button-inventory').click();
    await expect(page.getByTestId('panel-inventory')).toBeVisible();
    await expect(page.getByTestId('inventory-item-sword1')).toContainText('Adaga Prática');
    await expect(page.getByTestId('inventory-item-flask')).toContainText('Frasco de Vida');
    await page.getByTestId('panel-inventory').getByRole('button', { name: 'Fechar bolsa' }).last().click();
    await page.getByLabel('Ver detalhes das habilidades').click();
    await expect(page.locator('.skills-panel')).toBeVisible();
    await page.getByRole('button', { name: 'Fechar habilidades' }).click();

    expect(consoleErrors).toEqual([]);
  });

  test('seleciona item e oferece usar ou jogar fora na bolsa', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.getByTestId('button-hub-play').click();
    await page.getByTestId('button-faction-awakened').click();
    await page.getByRole('button', { name: 'Colosso de Musgo' }).click();
    await expect(page.getByTestId('screen-game')).toBeVisible();

    await page.getByTestId('button-inventory').click();
    await page.getByTestId('inventory-item-flask').click();
    await expect(page.getByTestId('inventory-action-bar')).toContainText('Frasco de Vida');
    await expect(page.getByTestId('inventory-action-bar').getByRole('button', { name: 'Usar' })).toBeVisible();
    await expect(page.getByTestId('inventory-action-bar').getByRole('button', { name: 'Jogar fora' })).toBeVisible();

    await page.getByTestId('inventory-item-sword1').click();
    await page.getByTestId('inventory-action-bar').getByRole('button', { name: 'Jogar fora' }).click();
    await expect(page.locator('.log-stack')).toContainText('protegido porque está equipado');
  });

  test('abre equipamentos pelo menu e permite trocar o slot', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.getByTestId('button-hub-play').click();
    await page.getByTestId('button-faction-awakened').click();
    await page.getByRole('button', { name: 'Colosso de Musgo' }).click();
    await expect(page.getByTestId('screen-game')).toBeVisible();

    await page.locator('.menu-trigger-dom').click();
    await page.getByTestId('panel-menu').getByRole('button', { name: /Equipamento/ }).click();
    await expect(page.getByTestId('equipment-loadout')).toBeVisible();
    await expect(page.getByTestId('equipment-loadout')).toContainText('Arma');
    await expect(page.getByTestId('equipment-loadout')).toContainText('Armadura');
    await expect(page.getByTestId('equipment-loadout').getByRole('button', { name: 'Tirar' }).first()).toBeEnabled();

    await page.getByTestId('equipment-loadout').locator('[data-remove-equipment="weapon"]').click();
    await expect(page.getByTestId('equipment-loadout').locator('[data-remove-equipment="weapon"]')).toBeVisible();
    await page.getByTestId('equipment-loadout').locator('button.equipment-option[data-equip-kind="weapon"]').first().click();
    await expect(page.getByTestId('equipment-loadout').locator('button.equipment-option[data-equip-kind="weapon"]').first()).toBeVisible();
  });

  test('preserva transferências do cofre depois de fechar e recarregar a campanha', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.getByTestId('button-hub-play').click();
    await page.getByTestId('button-faction-awakened').click();
    await page.getByRole('button', { name: 'Colosso de Musgo' }).click();
    await expect(page.getByTestId('screen-game')).toBeVisible();

    await page.getByTestId('button-bank').click();
    const bank = page.getByTestId('panel-bank');
    await expect(bank).toContainText('Cofre do Limiar');
    const flask = bank.locator('.bank-item').filter({ hasText: 'Frasco de Vida' });
    await expect(flask.getByRole('button', { name: 'Guardar tudo' })).toBeEnabled();
    await flask.getByRole('button', { name: 'Guardar tudo' }).click();
    await expect(flask).toContainText('bolsa 0 · cofre 2');
    await expect.poll(async () => page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('genesis-save') ?? '{}');
      return { inventoryFlask: save.inventory?.flask ?? 0, bankFlask: save.bank?.flask ?? 0 };
    })).toEqual({ inventoryFlask: 0, bankFlask: 2 });

    await bank.getByRole('searchbox', { name: 'Buscar item' }).fill('adaga');
    await expect(bank.locator('.bank-grid .bank-item')).toHaveCount(1);
    await expect(bank.locator('.bank-grid .bank-item')).toContainText('Adaga Prática');
    await expect(bank.locator('[data-bank-id="sword1"][data-bank-action="deposit"]')).toBeDisabled();
    await bank.getByRole('searchbox', { name: 'Buscar item' }).fill('');
    await bank.locator('.bank-item').filter({ hasText: 'Frasco de Vida' }).getByRole('button', { name: 'Retirar tudo' }).click();
    await expect.poll(async () => page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('genesis-save') ?? '{}');
      return { inventoryFlask: save.inventory?.flask ?? 0, bankFlask: save.bank?.flask ?? 0 };
    })).toEqual({ inventoryFlask: 2, bankFlask: 0 });
    await bank.locator('button.bank-close').click();

    await page.reload();
    await page.getByTestId('button-hub-play').click();
    await page.getByTestId('button-faction-awakened').click();
    await page.getByRole('button', { name: 'Colosso de Musgo' }).click();
    await expect(page.getByTestId('screen-game')).toBeVisible();
    await page.getByTestId('button-bank').click();
    await expect(page.getByTestId('panel-bank')).toContainText('Frasco de Vida');
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('genesis-save') ?? '{}'))).toMatchObject({
      inventory: { flask: 2 },
      bank: {},
    });
  });
});