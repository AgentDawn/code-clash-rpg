import { test, expect } from '@playwright/test';

test.describe('Equipment System E2E', () => {
  async function loginAsGuest(page: any) {
    await page.goto('/');
    const heroName = `Equipper_${Date.now()}`;
    await page.getByLabel('캐릭터 이름').fill(heroName);
    await page.getByText('고퍼 전사').click();
    await page.getByRole('button', { name: '비회원으로 시작하기' }).click();
    await expect(page.locator('#game-dashboard')).not.toHaveClass(/hidden/);
    return heroName;
  }

  test('should buy, equip, and unequip an item', async ({ page }) => {
    await loginAsGuest(page);

    const strText = await page.locator('#stat-strength').innerText();
    const initialStr = parseInt(strText);

    // Initial gold is 30. Armor costs 75. Hunt planner 5 times to get 50 gold.
    const plannerCard = page.locator('.hunt-card[data-monster="planner"]');
    for (let i = 0; i < 5; i++) {
      await plannerCard.locator('button', { hasText: '사냥하기' }).click();
      await expect(page.locator('.toast.success').filter({ hasText: '사냥 성공' }).first()).toBeVisible();
      await page.waitForTimeout(600);
    }

    // Buy Rust Safe Shield (cost 75, strength +2)
    const shopArmor = page.locator('.shop-item-card').filter({ hasText: 'Rust Safe Shield' });
    await shopArmor.locator('.buy-btn').click();

    // Expect success toast
    await expect(page.locator('.toast.success').filter({ hasText: '아이템 구매 성공' }).first()).toBeVisible();

    // Find in inventory and equip
    const invSlot = page.locator('.inv-slot[title*="Rust Safe Shield"]').first();
    await expect(invSlot).toBeVisible();
    await invSlot.click();

    // Expect equip success toast
    await expect(page.locator('.toast.success').filter({ hasText: '장비를 장착했습니다.' }).first()).toBeVisible();
    await page.waitForTimeout(500); // Wait for stats to update

    // Check strength increased (Armor adds 2 STR)
    const eqStrText = await page.locator('#stat-strength').innerText();
    const eqStr = parseInt(eqStrText);
    expect(eqStr).toBe(initialStr + 2);

    // Check armor slot shows the item
    const armorEqSlot = page.locator('#eq-armor');
    await expect(armorEqSlot).not.toHaveClass(/empty/);
    await expect(armorEqSlot.locator('.eq-name')).toHaveText('Rust Safe Shield');

    // Unequip
    await armorEqSlot.click();

    // Expect unequip success toast
    await expect(page.locator('.toast.info').filter({ hasText: '장비를 장착 해제했습니다.' }).first()).toBeVisible();
    await page.waitForTimeout(500);

    // Check strength reverted
    const finalStrText = await page.locator('#stat-strength').innerText();
    const finalStr = parseInt(finalStrText);
    expect(finalStr).toBe(initialStr);

    // Check armor slot is empty again
    await expect(armorEqSlot).toHaveClass(/empty/);
  });
});
