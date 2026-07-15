---
name: playwright-e2e-writer
description: Writes robust Playwright E2E test scenarios and ensures features are automatically verified. Use this skill when asked to write or update E2E tests, or when adding a major feature that requires end-to-end verification.
---

# Playwright E2E Writer Skill

You are an expert in writing robust, reliable, and maintainable End-to-End (E2E) tests using [Playwright](https://playwright.dev/). Your goal is to verify that user workflows function correctly from start to finish.

## Core Principles

1. **User-Centric Testing**: Test the application the way a real user interacts with it. Rely on user-visible behavior, ARIA roles, and visible text rather than internal CSS selectors or implementation details.
2. **Resilience**: Avoid hardcoded waits (`page.waitForTimeout()`). Use Playwright's auto-waiting features and explicit state assertions (e.g., `expect(locator).toBeVisible()`).
3. **Isolation**: Every test should be independent. Ensure tests clean up after themselves or use isolated browser contexts so they don't impact subsequent tests.
4. **Strict UI Testing Only**: Do NOT write tests that directly call backend APIs (e.g., `page.request.post('/api/something')`). You must strictly interact with the application through its User Interface (clicks, typing, assertions) exactly as a human user would.

## Locators Strategy

- **Prefer**: `getByRole`, `getByText`, `getByLabel`, `getByPlaceholder`.
- **Fallback**: `getByTestId` (e.g., `data-testid`).
- **Avoid**: CSS/XPath selectors tied to styling (`.btn-primary`, `#header-div`) unless absolutely necessary.

## Standard E2E Workflow

When asked to write or update E2E tests for a feature, follow these steps:

1. **Understand the Feature**: Read the feature's code or documentation to understand the happy paths and critical edge cases.
2. **Setup/Teardown**: Keep it simple. Avoid complex API interception unless absolutely necessary. Rely on UI-driven setup and assertions.
3. **Draft the Scenario**:
   - Navigate to the page.
   - Perform actions (click, fill, check).
   - Assert the expected outcomes (`expect(page).toHaveURL()`, `expect(locator).toContainText()`).
4. **Refactor**: Abstract repeated logic into Page Object Models (POM) or helper functions if the test grows complex.

## Example Playwright Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto('/');
  });

  test('should allow a guest to login automatically', async ({ page }) => {
    // 1. Click the guest login button
    await page.getByRole('button', { name: '비회원으로 시작하기' }).click();

    // 2. Expect a success toast message
    await expect(page.locator('.toast.success')).toBeVisible();

    // 3. Expect redirection to dashboard
    await expect(page.getByRole('heading', { name: 'CODE CLASH PORTAL' })).toBeVisible();

    // 4. Verify localStorage has the credentials
    const credentials = await page.evaluate(() => window.localStorage.getItem('guest_credentials'));
    expect(credentials).not.toBeNull();
  });
});
```

## Actionable Instructions

- When triggered, review the target feature and propose the test scenarios in a short list.
- **Proactive Coverage**: You MUST proactively analyze the project's features, UI components, and API routes to identify core workflows that lack E2E test coverage (e.g., chat systems, stat training, equipment systems, authentication flows). Do not just test a subset of features. If you find uncovered scenarios, you MUST write tests for them to ensure 100% functional UI coverage.
- Generate the `.spec.ts` files containing the tests.
- If Playwright is not yet installed in the project, provide the user with the setup command (`npm init playwright@latest`) or run it if you have permission.
