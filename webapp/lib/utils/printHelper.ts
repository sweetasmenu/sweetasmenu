/**
 * Mobile-friendly print utility using hidden iframe instead of popup windows.
 * Popup windows are blocked by most mobile browsers, while iframes work reliably.
 *
 * Key design decisions:
 * - Uses `srcdoc` instead of `document.write()` so `onload` fires reliably on mobile
 * - Iframe has 302px width (~80mm at 96dpi) so thermal-printer content renders correctly
 * - Strips all <script> tags from the HTML to prevent auto-print/close conflicts
 */

const PRINT_IFRAME_ID = 'print-helper-iframe';

/**
 * Prints HTML content via a hidden iframe — works on mobile, tablet, and desktop.
 *
 * @param htmlContent - Full HTML document string to print
 * @returns Promise that resolves after print dialog is triggered
 */
export function printViaIframe(htmlContent: string): Promise<void> {
  return new Promise((resolve) => {
    // Remove any existing print iframe
    const existing = document.getElementById(PRINT_IFRAME_ID);
    if (existing) existing.remove();

    // Strip all <script> tags from the HTML since we handle printing from the parent.
    // Using [\s\S]*? to match across newlines (nested braces, setTimeout, etc.)
    const cleanHtml = htmlContent.replace(/<script[\s\S]*?<\/script>/gi, '');

    // Create iframe positioned off-screen but with proper width for content rendering.
    // Width of 302px ≈ 80mm at 96 DPI — matches thermal printer paper width.
    const iframe = document.createElement('iframe');
    iframe.id = PRINT_IFRAME_ID;
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '302px';
    iframe.style.height = '900px';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    // Set onload BEFORE setting srcdoc so the event is captured reliably.
    iframe.onload = () => {
      // Wait for content to fully render before triggering print
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Iframe print failed:', e);
          // Fallback: open in new tab (for browsers that block iframe printing)
          const blob = new Blob([cleanHtml], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
        // Clean up after a delay to let print dialog finish
        setTimeout(() => {
          iframe.remove();
          resolve();
        }, 1000);
      }, 500);
    };

    // Use srcdoc to load content — this reliably triggers onload on all browsers
    // including mobile, unlike document.write() which may not trigger onload.
    iframe.srcdoc = cleanHtml;
  });
}
