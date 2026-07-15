import { test, expect } from '@playwright/test';

test.describe('Training System E2E', () => {
  async function loginAsGuest(page: any) {
    await page.goto('/');
    const heroName = `Trainer_${Date.now()}`;
    await page.getByLabel('캐릭터 이름').fill(heroName);
    await page.getByText('고퍼 전사').click();
    await page.getByRole('button', { name: '비회원으로 시작하기' }).click();
    await expect(page.locator('#game-dashboard')).not.toHaveClass(/hidden/);
    return heroName;
  }

  test('should gain stat points on level up and spend them to increase stats', async ({ page }) => {
    await loginAsGuest(page);

    // Initial Strength
    const strText = await page.locator('#stat-strength').innerText();
    const initialStr = parseInt(strText);

    // Hunt '기획자 연합' 5 times to get 100 XP (level up requires 100)
    const plannerCard = page.locator('.hunt-card[data-monster="planner"]');
    for (let i = 0; i < 5; i++) {
      await plannerCard.locator('button', { hasText: '사냥하기' }).click();
      await expect(page.locator('.toast.success').filter({ hasText: '사냥 성공' }).first()).toBeVisible();
      await page.waitForTimeout(600); // Wait for toast to disappear or allow next click
    }

    // Check level up: we should have 5 stat points now.
    const statPointsBadge = page.locator('.points-badge');
    await expect(statPointsBadge).toBeVisible();
    await expect(statPointsBadge).toContainText('5');

    // The train buttons should now be visible
    const trainStrBtn = page.locator('.train-btn[data-stat="strength"]');
    await expect(trainStrBtn).toBeVisible();

    // Click train strength
    await trainStrBtn.click();
    await page.waitForTimeout(500); // Allow API and DOM update

    // Check strength increased
    const newStrText = await page.locator('#stat-strength').innerText();
    const newStr = parseInt(newStrText);
    expect(newStr).toBe(initialStr + 1);

    // Check stat points decreased
    await expect(page.locator('.points-badge')).toContainText('4');
  });
});
