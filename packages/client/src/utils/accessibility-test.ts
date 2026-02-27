/**
 * Accessibility Testing Utilities
 * Helper functions for testing accessibility features
 */

/**
 * Check if all interactive elements have accessible labels
 */
export function checkAccessibleLabels(): {
  passed: number;
  failed: number;
  issues: Array<{ element: string; issue: string }>;
} {
  const issues: Array<{ element: string; issue: string }> = [];
  let passed = 0;
  let failed = 0;

  // Check all buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach((btn, i) => {
    const hasLabel =
      btn.getAttribute('aria-label') ||
      btn.getAttribute('title') ||
      btn.textContent?.trim() ||
      btn.querySelector('[aria-label]');

    if (!hasLabel) {
      failed++;
      issues.push({
        element: `button[${i}]`,
        issue: 'Button missing accessible label',
      });
    } else {
      passed++;
    }
  });

  // Check all inputs
  const inputs = document.querySelectorAll('input');
  inputs.forEach((input, i) => {
    const hasLabel =
      input.getAttribute('aria-label') ||
      input.getAttribute('aria-labelledby') ||
      document.querySelector(`label[for="${input.id}"]`);

    if (!hasLabel) {
      failed++;
      issues.push({
        element: `input[${i}]`,
        issue: 'Input missing accessible label',
      });
    } else {
      passed++;
    }
  });

  // Check all images
  const images = document.querySelectorAll('img');
  images.forEach((img, i) => {
    const hasAlt = img.getAttribute('alt') !== null;

    if (!hasAlt) {
      failed++;
      issues.push({
        element: `img[${i}]`,
        issue: 'Image missing alt attribute',
      });
    } else {
      passed++;
    }
  });

  return { passed, failed, issues };
}

/**
 * Check if all ARIA attributes are valid
 */
export function checkAriaAttributes(): {
  passed: number;
  failed: number;
  issues: Array<{ element: string; issue: string }>;
} {
  const issues: Array<{ element: string; issue: string }> = [];
  let passed = 0;
  let failed = 0;

  // Check aria-live regions
  const liveRegions = document.querySelectorAll('[aria-live]');
  liveRegions.forEach((region) => {
    const value = region.getAttribute('aria-live');
    if (value && !['polite', 'assertive', 'off'].includes(value)) {
      failed++;
      issues.push({
        element: region.tagName.toLowerCase(),
        issue: `Invalid aria-live value: ${value}`,
      });
    } else {
      passed++;
    }
  });

  // Check aria-modal
  const modals = document.querySelectorAll('[aria-modal]');
  modals.forEach((modal) => {
    const value = modal.getAttribute('aria-modal');
    if (value && !['true', 'false'].includes(value)) {
      failed++;
      issues.push({
        element: modal.tagName.toLowerCase(),
        issue: `Invalid aria-modal value: ${value}`,
      });
    } else {
      passed++;
    }
  });

  return { passed, failed, issues };
}

/**
 * Check keyboard accessibility
 */
export function checkKeyboardAccessibility(): {
  canTab: boolean;
  canFocusButtons: boolean;
  focusableElements: number;
} {
  // Count focusable elements
  const focusableElements = document.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  return {
    canTab: focusableElements.length > 0,
    canFocusButtons: document.querySelectorAll('button').length > 0,
    focusableElements: focusableElements.length,
  };
}

/**
 * Check for skip links
 */
export function checkSkipLinks(): {
  hasSkipLink: boolean;
  skipLinkTarget: string | null;
} {
  const skipLink = document.querySelector('.skip-link, [class*="skip"]');

  if (!skipLink) {
    return { hasSkipLink: false, skipLinkTarget: null };
  }

  const href = skipLink instanceof HTMLAnchorElement ? skipLink.getAttribute('href') : null;
  const target = href?.replace('#', '') || null;

  return { hasSkipLink: true, skipLinkTarget: target };
}

/**
 * Run all accessibility checks
 */
export function runAccessibilityTests() {
  const results = {
    labels: checkAccessibleLabels(),
    aria: checkAriaAttributes(),
    keyboard: checkKeyboardAccessibility(),
    skipLinks: checkSkipLinks(),
    timestamp: new Date().toISOString(),
  };

  // Log results to console
  console.group('🔍 Accessibility Test Results');
  console.log(`📅 ${results.timestamp}`);

  console.group('Labels');
  console.log(`✅ Passed: ${results.labels.passed}`);
  console.log(`❌ Failed: ${results.labels.failed}`);
  if (results.labels.issues.length > 0) {
    console.table(results.labels.issues);
  }
  console.groupEnd();

  console.group('ARIA Attributes');
  console.log(`✅ Passed: ${results.aria.passed}`);
  console.log(`❌ Failed: ${results.aria.failed}`);
  if (results.aria.issues.length > 0) {
    console.table(results.aria.issues);
  }
  console.groupEnd();

  console.group('Keyboard Accessibility');
  console.log(`🎯 Focusable Elements: ${results.keyboard.focusableElements}`);
  console.log(`⌨️ Can Tab: ${results.keyboard.canTab ? 'Yes' : 'No'}`);
  console.log(`🔘 Buttons Focusable: ${results.keyboard.canFocusButtons ? 'Yes' : 'No'}`);
  console.groupEnd();

  console.group('Skip Links');
  console.log(`⏭️ Has Skip Link: ${results.skipLinks.hasSkipLink ? 'Yes' : 'No'}`);
  if (results.skipLinks.skipLinkTarget) {
    console.log(`🎯 Target: #${results.skipLinks.skipLinkTarget}`);
  }
  console.groupEnd();

  console.groupEnd();

  return results;
}

/**
 * Enable accessibility testing in development
 */
export function enableAccessibilityTesting() {
  if (import.meta.env.DEV) {
    (window as any).testA11y = runAccessibilityTests;
    console.log(
      '✅ Accessibility testing enabled. Run testA11y() in console to check.'
    );
  }
}
