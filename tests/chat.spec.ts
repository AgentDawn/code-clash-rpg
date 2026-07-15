import { test, expect } from '@playwright/test';

test.describe('Town Square Chat E2E', () => {
  async function loginAsGuest(page: any) {
    await page.goto('/');
    const heroName = `Chatter_${Date.now()}`;
    await page.getByLabel('캐릭터 이름').fill(heroName);
    await page.getByText('고퍼 전사').click();
    await page.getByRole('button', { name: '비회원으로 시작하기' }).click();
    await expect(page.locator('#game-dashboard')).not.toHaveClass(/hidden/);
    return heroName;
  }

  test('should be able to send a chat message and see it in the chat box', async ({ page }) => {
    const myName = await loginAsGuest(page);

    // Enter a message
    const testMessage = `Hello World from Playwright! ${Date.now()}`;
    await page.locator('#chat-input').fill(testMessage);
    await page.locator('#chat-form').locator('button', { hasText: '전송' }).click();

    // Wait for the message to appear in the chat box
    const chatMessages = page.locator('#chat-messages');
    
    // Check if my name and message are visible
    const chatMsgBlock = chatMessages.locator('.chat-msg', { hasText: testMessage }).first();
    await expect(chatMsgBlock).toBeVisible();
    await expect(chatMsgBlock.locator('.chat-author')).toHaveText(myName);
  });
});
