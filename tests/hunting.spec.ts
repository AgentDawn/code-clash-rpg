import { test, expect } from '@playwright/test';

test.describe('Hunting System E2E', () => {
  // Helper to login as guest
  async function loginAsGuest(page: any) {
    await page.goto('/');
    const heroName = `Hunter_${Date.now()}`;
    await page.getByLabel('캐릭터 이름').fill(heroName);
    await page.getByText('고퍼 전사').click();
    await page.getByRole('button', { name: '비회원으로 시작하기' }).click();
    await expect(page.locator('#game-dashboard')).not.toHaveClass(/hidden/);
    return heroName;
  }

  test('should allow hunting a weak monster and gaining XP/Gold', async ({ page }) => {
    await loginAsGuest(page);

    // Initial stats
    const initialGoldText = await page.locator('.gold-text').first().innerText();
    const initialGold = parseInt(initialGoldText.replace(/[^0-9]/g, ''));

    // Hunt '기획자 연합' (Planner) which requires 20 power. 
    // New character has 10(lvl)*10 + 5*4 = 120 power. So they will easily win.
    // Ensure we click the specific button inside the planner card.
    const plannerCard = page.locator('.hunt-card[data-monster="planner"]');
    await plannerCard.locator('button', { hasText: '사냥하기' }).click();

    // Expect success toast
    const successToast = page.locator('.toast.success').filter({ hasText: '사냥 성공' }).first();
    await expect(successToast).toBeVisible();

    // Check Gold increased
    const newGoldText = await page.locator('.gold-text').first().innerText();
    const newGold = parseInt(newGoldText.replace(/[^0-9]/g, ''));
    expect(newGold).toBeGreaterThan(initialGold);
  });

  test('should lose HP and eventually die when fighting a boss', async ({ page }) => {
    await loginAsGuest(page);

    // Hunt '임원진 의회' (Executive) which requires 1000 power.
    // New character has 120 power. So they will lose.
    const bossCard = page.locator('.hunt-card[data-monster="executive"]');
    
    // First attack - should lose HP
    await bossCard.locator('button', { hasText: '사냥하기 (보스전)' }).click();
    const errorToast = page.locator('.toast.error');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText('사냥 실패');
    
    // Attack a few more times to drop HP to 0. Damage is ~30 per hit. HP is 100.
    for (let i = 0; i < 7; i++) {
      await bossCard.locator('button', { hasText: '사냥하기 (보스전)' }).click();
      // wait a bit for the toast to update/re-appear
      await page.waitForTimeout(500); 
    }

    // Now HP should be 0. We expect the death message.
    await expect(page.locator('.toast.error').filter({ hasText: '패배하여 쓰러졌습니다' }).first()).toBeVisible();
  });
});
