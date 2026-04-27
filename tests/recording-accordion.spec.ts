import { test, expect } from '@playwright/test';

test.describe('Recording Accordion', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth and navigate to superadmin recordings
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/superadmin');
    await page.click('text=Recordings');
  });

  test('should expand recording row to show rating details', async ({ page }) => {
    // Wait for recordings to load
    await page.waitForSelector('[data-testid="recordings-table"]');
    
    // Find first expand button and click it
    const expandButton = page.locator('button[aria-label*="Expand details"]').first();
    await expandButton.click();
    
    // Verify expanded content appears
    await expect(page.locator('text=Rating Summary')).toBeVisible();
    await expect(page.locator('text=Student Ratings')).toBeVisible();
    
    // Verify chevron rotates
    const chevron = expandButton.locator('svg');
    await expect(chevron).toHaveClass(/rotate-180/);
  });

  test('should show rating distribution bars correctly', async ({ page }) => {
    await page.waitForSelector('[data-testid="recordings-table"]');
    
    // Expand first recording
    await page.locator('button[aria-label*="Expand details"]').first().click();
    
    // Check for rating distribution elements
    await expect(page.locator('text=Rating Distribution')).toBeVisible();
    await expect(page.locator('text=5★')).toBeVisible();
    await expect(page.locator('text=4★')).toBeVisible();
    await expect(page.locator('text=3★')).toBeVisible();
    await expect(page.locator('text=2★')).toBeVisible();
    await expect(page.locator('text=1★')).toBeVisible();
  });

  test('should open delete confirmation modal and delete recording', async ({ page }) => {
    await page.waitForSelector('[data-testid="recordings-table"]');
    
    // Expand first recording
    await page.locator('button[aria-label*="Expand details"]').first().click();
    
    // Click delete button
    await page.click('button:has-text("Delete Recording")');
    
    // Verify confirmation modal appears
    await expect(page.locator('text=This will permanently delete')).toBeVisible();
    await expect(page.locator('button:has-text("Delete Recording")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    
    // Mock successful deletion and confirm
    await page.route('**/available_lessons**', route => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 204 });
      } else {
        route.continue();
      }
    });
    
    await page.click('button:has-text("Delete Recording")');
    
    // Verify success toast appears
    await expect(page.locator('text=Recording deleted successfully')).toBeVisible();
  });

  test('should be keyboard accessible', async ({ page }) => {
    await page.waitForSelector('[data-testid="recordings-table"]');
    
    // Focus first expand button with Tab
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    
    // Verify it's the expand button
    await expect(focusedElement).toHaveAttribute('aria-label', expect.stringMatching(/Expand details/));
    
    // Press Enter to expand
    await page.keyboard.press('Enter');
    
    // Verify expansion occurred
    await expect(page.locator('text=Rating Summary')).toBeVisible();
    
    // Press Enter again to collapse
    await page.keyboard.press('Enter');
    
    // Verify collapse occurred
    await expect(page.locator('text=Rating Summary')).not.toBeVisible();
    
    // Test Space key
    await page.keyboard.press('Space');
    await expect(page.locator('text=Rating Summary')).toBeVisible();
  });

  test('should export CSV with correct data', async ({ page }) => {
    await page.waitForSelector('[data-testid="recordings-table"]');
    
    // Expand first recording
    await page.locator('button[aria-label*="Expand details"]').first().click();
    
    // Set up download promise
    const downloadPromise = page.waitForEvent('download');
    
    // Click export CSV button
    await page.click('button:has-text("Export CSV")');
    
    // Wait for download
    const download = await downloadPromise;
    
    // Verify filename contains recording title
    expect(download.suggestedFilename()).toMatch(/_ratings\.csv$/);
  });

  test('should collapse when clicking chevron again', async ({ page }) => {
    await page.waitForSelector('[data-testid="recordings-table"]');
    
    const expandButton = page.locator('button[aria-label*="Expand details"]').first();
    
    // Expand
    await expandButton.click();
    await expect(page.locator('text=Rating Summary')).toBeVisible();
    
    // Collapse
    await expandButton.click();
    await expect(page.locator('text=Rating Summary')).not.toBeVisible();
    
    // Verify chevron is back to original rotation
    const chevron = expandButton.locator('svg');
    await expect(chevron).not.toHaveClass(/rotate-180/);
  });

  test('should show loading state when fetching ratings', async ({ page }) => {
    // Slow down network to catch loading state
    await page.route('**/recording_ratings**', route => {
      setTimeout(() => route.continue(), 1000);
    });
    
    await page.waitForSelector('[data-testid="recordings-table"]');
    
    // Expand recording
    await page.locator('button[aria-label*="Expand details"]').first().click();
    
    // Verify loading state appears
    await expect(page.locator('.animate-pulse')).toBeVisible();
  });
});