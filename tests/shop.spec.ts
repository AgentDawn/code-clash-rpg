import { test, expect } from '@playwright/test';

test.describe('Shop and Inventory E2E', () => {
  // Helper to login as guest
  async function loginAsGuest(page: any) {
    await page.goto('/');
    const heroName = `Shopper_${Date.now()}`;
    await page.getByLabel('캐릭터 이름').fill(heroName);
    await page.getByText('고퍼 전사').click();
    await page.getByRole('button', { name: '비회원으로 시작하기' }).click();
    await expect(page.locator('#game-dashboard')).not.toHaveClass(/hidden/);
    return heroName;
  }

  test('should buy items and use them from inventory', async ({ page }) => {
    await loginAsGuest(page);

    // Get initial HP
    const hpText = await page.locator('#hp-text').innerText();
    const initialHP = parseInt(hpText.split('/')[0]); // e.g. "120" from "120 / 120"

    // 1. Take damage by attacking a strong monster (QA 군단, req 300)
    const qaCard = page.locator('.hunt-card[data-monster="qa"]');
    await qaCard.locator('button', { hasText: '사냥하기' }).click();
    
    // Wait for the error toast indicating damage taken
    await expect(page.locator('.toast.error')).toBeVisible();
    await page.waitForTimeout(500); // Give time for HP bar to update

    // Verify HP decreased
    const hpAfterDmgText = await page.locator('#hp-text').innerText();
    const hpAfterDmg = parseInt(hpAfterDmgText.split('/')[0]);
    expect(hpAfterDmg).toBeLessThan(initialHP);

    // 2. Use a potion from inventory
    const potionSlot = page.locator('.inv-slot[title="체력 물약 (클릭 시 복용)"]').first();
    await potionSlot.click();
    
    // Expect success toast for item usage
    const successToast = page.locator('.toast.success').filter({ hasText: '물약을 사용하여 회복했습니다' });
    await expect(successToast).toBeVisible();

    // Verify HP increased
    const hpAfterHealText = await page.locator('#hp-text').innerText();
    const hpAfterHeal = parseInt(hpAfterHealText.split('/')[0]);
    expect(hpAfterHeal).toBeGreaterThan(hpAfterDmg);

    // 3. Buy a potion from the shop
    const initialGoldText = await page.locator('.gold-text').first().innerText();
    const initialGold = parseInt(initialGoldText.replace(/[^0-9]/g, ''));

    // Potion shop item card
    const shopPotion = page.locator('.shop-item-card').filter({ hasText: 'Health Potion' });
    await shopPotion.locator('.buy-btn').click();

    // Expect success toast for shop buy
    const buySuccessToast = page.locator('.toast.success').filter({ hasText: '아이템 구매 성공' });
    await expect(buySuccessToast).toBeVisible();

    // Verify Gold decreased
    const goldAfterBuyText = await page.locator('.gold-text').first().innerText();
    const goldAfterBuy = parseInt(goldAfterBuyText.replace(/[^0-9]/g, ''));
    expect(goldAfterBuy).toBeLessThan(initialGold);

    // Verify potion is back in the inventory
    await expect(page.locator('.inv-slot[title="체력 물약 (클릭 시 복용)"]').first()).toBeVisible();
  });
});
