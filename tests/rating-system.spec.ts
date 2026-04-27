import { test, expect } from '@playwright/test';

test.describe('Recording Rating System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page and login as a student
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'student@test.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL('/dashboard');
  });

  test('rating modal appears when video ends', async ({ page }) => {
    // Navigate to a video
    await page.click('[data-testid="video-card"]');
    await page.waitForSelector('[data-testid="video-player"]');
    
    // Simulate video completion by triggering the completion event
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = video.duration;
        video.dispatchEvent(new Event('ended'));
      }
    });
    
    // Check that rating modal appears
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text=Rate this Recording')).toBeVisible();
    
    // Check that star rating is present
    await expect(page.locator('[aria-label="Rate 1 stars"]')).toBeVisible();
    await expect(page.locator('[aria-label="Rate 5 stars"]')).toBeVisible();
  });

  test('student cannot close modal without rating', async ({ page }) => {
    // Navigate to video and trigger completion
    await page.click('[data-testid="video-card"]');
    await page.waitForSelector('[data-testid="video-player"]');
    
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = video.duration;
        video.dispatchEvent(new Event('ended'));
      }
    });
    
    // Wait for modal to appear
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Try to close modal with Escape key - should not close
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Try to click outside modal - should not close
    await page.click('body', { position: { x: 50, y: 50 } });
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Submit button should be disabled without rating
    await expect(page.locator('text=Submit Rating')).toBeDisabled();
  });

  test('rating persists and reopens pre-selected on re-watch', async ({ page }) => {
    // Navigate to video and complete it
    await page.click('[data-testid="video-card"]');
    await page.waitForSelector('[data-testid="video-player"]');
    
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = video.duration;
        video.dispatchEvent(new Event('ended'));
      }
    });
    
    // Rate the video with 4 stars
    await page.click('[aria-label="Rate 4 stars"]');
    await page.click('text=Submit Rating');
    
    // Wait for modal to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    
    // Navigate away and back to the same video
    await page.click('[data-testid="dashboard-link"]');
    await page.click('[data-testid="video-card"]');
    
    // Complete video again
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = video.duration;
        video.dispatchEvent(new Event('ended'));
      }
    });
    
    // Check that rating modal shows previous rating
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text=Your Rating')).toBeVisible();
    
    // Check that 4th star is selected
    const fourthStar = page.locator('[aria-label="Rate 4 stars"] svg');
    await expect(fourthStar).toHaveClass(/fill-yellow-400/);
  });

  test('keyboard navigation works for rating', async ({ page }) => {
    // Navigate to video and trigger completion
    await page.click('[data-testid="video-card"]');
    await page.waitForSelector('[data-testid="video-player"]');
    
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = video.duration;
        video.dispatchEvent(new Event('ended'));
      }
    });
    
    // Wait for modal and test keyboard navigation
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Press number keys to select rating
    await page.keyboard.press('3');
    
    // Check that 3rd star is selected
    const thirdStar = page.locator('[aria-label="Rate 3 stars"] svg');
    await expect(thirdStar).toHaveClass(/fill-yellow-400/);
    
    // Submit button should now be enabled
    await expect(page.locator('text=Submit Rating')).toBeEnabled();
  });
});

test.describe('Admin Rating Analytics', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@test.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    await page.waitForURL('/admin');
  });

  test('admin average recalculates after new rating', async ({ page }) => {
    // Navigate to content management or recordings section
    await page.click('[data-testid="content-management-tab"]');
    await page.waitForSelector('[data-testid="recording-analytics"]');
    
    // Check initial average rating
    const initialAverage = await page.locator('[data-testid="average-rating"]').textContent();
    
    // Open a new tab to submit a rating as student
    const studentPage = await page.context().newPage();
    await studentPage.goto('/login');
    await studentPage.fill('[data-testid="email-input"]', 'student@test.com');
    await studentPage.fill('[data-testid="password-input"]', 'password123');
    await studentPage.click('[data-testid="login-button"]');
    
    // Complete video and rate it
    await studentPage.click('[data-testid="video-card"]');
    await studentPage.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = video.duration;
        video.dispatchEvent(new Event('ended'));
      }
    });
    
    await studentPage.click('[aria-label="Rate 5 stars"]');
    await studentPage.click('text=Submit Rating');
    
    // Go back to admin page and check that average updated
    await page.waitForTimeout(2000); // Wait for real-time update
    
    const newAverage = await page.locator('[data-testid="average-rating"]').textContent();
    expect(newAverage).not.toBe(initialAverage);
    
    await studentPage.close();
  });

  test('CSV export works correctly', async ({ page }) => {
    await page.click('[data-testid="content-management-tab"]');
    await page.waitForSelector('[data-testid="recording-analytics"]');
    
    // Set up download promise before clicking
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.click('text=Export CSV');
    
    // Wait for download to complete
    const download = await downloadPromise;
    
    // Check filename
    expect(download.suggestedFilename()).toMatch(/.*_ratings\.csv$/);
    
    // Check that success toast appears
    await expect(page.locator('text=Download Started')).toBeVisible();
  });
});