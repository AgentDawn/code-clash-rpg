import { test, expect } from '@playwright/test';

test.describe('Guest Registration and SSR Hydration Flow', () => {
  test('should allow a guest to register, preserve session via SSR, and logout', async ({ page }) => {
    // 1. Visit root
    await page.goto('/');

    // 2. Fill out character name with a dynamic suffix
    const heroName = `TestHero_${Date.now()}`;
    await page.getByLabel('캐릭터 이름').fill(heroName);

    // 3. Select a class (e.g. Go Warrior, which is visible by default)
    await page.getByText('고퍼 전사').click();

    // 4. Click the start button
    await page.getByRole('button', { name: '비회원으로 시작하기' }).click();

    // 5. Expect success toast message
    const toast = page.locator('.toast.success');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('비회원 계정으로 새로운 모험이 시작되었습니다!');

    // 6. Expect redirection to dashboard
    await expect(page.locator('#game-dashboard')).not.toHaveClass(/hidden/);
    await expect(page.getByText('CODE CLASH PORTAL')).toBeVisible();
    await expect(page.locator('#char-name')).toContainText(heroName);

    // 7. Test Hydration (Auto-login on refresh via session cookie)
    await page.reload();

    // Expect dashboard to be visible without having to login again
    await expect(page.locator('#game-dashboard')).not.toHaveClass(/hidden/);
    await expect(page.getByRole('heading', { name: '캐릭터 상태창' })).toBeVisible();

    // Expect a welcome back toast
    const welcomeToast = page.locator('.toast.success');
    await expect(welcomeToast).toBeVisible();
    await expect(welcomeToast).toContainText('접속을 환영합니다!');

    // 8. Logout
    await page.getByRole('button', { name: '로그아웃' }).click();
    
    // Expect auth panel to be visible again
    await expect(page.locator('#auth-panel')).not.toHaveClass(/hidden/);
  });
});
