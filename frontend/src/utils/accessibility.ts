/**
 * Accessibility utilities for WCAG AA compliance.
 * 
 * This module provides helper functions for:
 * - Keyboard navigation
 * - Focus management
 * - ARIA live announcements
 * - Skip links
 */

// ============================================================================
// Keyboard Navigation
// ============================================================================

/**
 * Handle keyboard navigation for a list of items.
 * Supports Arrow keys, Home, End, Enter, and Space.
 */
export function handleListKeyDown(
  event: React.KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  onSelect?: (index: number) => void
): number {
  let newIndex = currentIndex;

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      event.preventDefault();
      newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
      event.preventDefault();
      newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      break;
    case 'Home':
      event.preventDefault();
      newIndex = 0;
      break;
    case 'End':
      event.preventDefault();
      newIndex = items.length - 1;
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (onSelect) {
        onSelect(currentIndex);
      }
      return currentIndex;
    default:
      return currentIndex;
  }

  items[newIndex]?.focus();
  return newIndex;
}

/**
 * Get all focusable elements within a container.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

/**
 * Trap focus within a container (for modals, dialogs).
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    if (event.shiftKey) {
      // Shift + Tab: Going backwards
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab: Going forwards
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return () => container.removeEventListener('keydown', handleKeyDown);
}

// ============================================================================
// Focus Management
// ============================================================================

/**
 * Manage focus when a dialog opens.
 * Stores previous focus and restores it on close.
 */
export function useFocusReturn(): [
  () => void, // saveFocus
  () => void  // restoreFocus
] {
  let previousFocus: HTMLElement | null = null;

  const saveFocus = () => {
    previousFocus = document.activeElement as HTMLElement;
  };

  const restoreFocus = () => {
    previousFocus?.focus();
    previousFocus = null;
  };

  return [saveFocus, restoreFocus];
}

// ============================================================================
// Live Announcements
// ============================================================================

let liveRegion: HTMLElement | null = null;

/**
 * Initialize the ARIA live region for announcements.
 */
function initLiveRegion(): HTMLElement {
  if (liveRegion) return liveRegion;

  liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  liveRegion.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  document.body.appendChild(liveRegion);

  return liveRegion;
}

/**
 * Announce a message to screen readers.
 * 
 * @param message - The message to announce
 * @param priority - 'polite' for non-urgent, 'assertive' for urgent
 */
export function announce(
  message: string, 
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const region = initLiveRegion();
  region.setAttribute('aria-live', priority);
  
  // Clear and re-set to trigger announcement
  region.textContent = '';
  
  // Use requestAnimationFrame to ensure DOM update
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

/**
 * Announce loading state changes.
 */
export function announceLoading(isLoading: boolean, itemName = 'data'): void {
  if (isLoading) {
    announce(`Loading ${itemName}...`);
  } else {
    announce(`${itemName} loaded`);
  }
}

/**
 * Announce error messages.
 */
export function announceError(message: string): void {
  announce(message, 'assertive');
}

// ============================================================================
// Skip Links
// ============================================================================

/**
 * Create skip link functionality.
 * Returns props to spread on the skip link element.
 */
export function createSkipLink(targetId: string): {
  href: string;
  onClick: (e: React.MouseEvent) => void;
} {
  return {
    href: `#${targetId}`,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      const target = document.getElementById(targetId);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus();
        target.removeAttribute('tabindex');
      }
    }
  };
}

// ============================================================================
// Color Contrast Helpers
// ============================================================================

/**
 * Calculate relative luminance of a color.
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors.
 * WCAG AA requires 4.5:1 for normal text, 3:1 for large text.
 */
export function getContrastRatio(
  color1: [number, number, number],
  color2: [number, number, number]
): number {
  const l1 = getLuminance(...color1);
  const l2 = getLuminance(...color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color combination meets WCAG AA standards.
 */
export function meetsContrastAA(
  foreground: [number, number, number],
  background: [number, number, number],
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

// ============================================================================
// Reduced Motion Detection
// ============================================================================

/**
 * Check if user prefers reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get animation duration based on user preference.
 */
export function getAnimationDuration(defaultMs: number): number {
  return prefersReducedMotion() ? 0 : defaultMs;
}
