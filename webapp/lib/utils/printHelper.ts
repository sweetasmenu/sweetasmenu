/**
 * Print utility for thermal receipt printers (80mm).
 *
 * Two strategies based on device:
 *
 * Desktop: Hidden iframe + iframe.contentWindow.print()
 *   - The iframe has its own document with @page { size: 80mm auto }
 *   - Print is scoped to the iframe content only
 *   - Thermal printer receives correctly-sized 80mm content
 *
 * Mobile/Tablet: Opens receipt in new tab via blob URL + <a> click
 *   - Bypasses popup blockers (programmatic <a> click from user gesture)
 *   - Receipt HTML contains auto-print script that triggers window.print()
 *   - New tab has its own @page rules → prints correctly on thermal printer
 */

const PRINT_IFRAME_ID = 'print-helper-iframe';

/**
 * Prints HTML content for thermal printers — works on mobile, tablet, and desktop.
 */
export function printViaIframe(htmlContent: string): Promise<void> {
  return new Promise((resolve) => {
    // Clean up any previous print iframe
    document.getElementById(PRINT_IFRAME_ID)?.remove();

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                     ('ontouchstart' in window && window.innerWidth < 1024);

    if (isMobile) {
      // === MOBILE: Open receipt in new tab ===
      // Keep the original HTML with <script> tags so it auto-prints
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      // Use <a> click instead of window.open() to avoid popup blockers
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Revoke blob URL after a delay (receipt page needs time to load)
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      resolve();
      return;
    }

    // === DESKTOP: Hidden iframe + iframe.contentWindow.print() ===
    // Strip <script> tags since we manually trigger print from parent
    const cleanHtml = htmlContent.replace(/<script[\s\S]*?<\/script>/gi, '');

    const iframe = document.createElement('iframe');
    iframe.id = PRINT_IFRAME_ID;
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '302px'; // ~80mm at 96 DPI
    iframe.style.height = '900px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Print failed:', e);
        }
        // Clean up after print dialog closes
        setTimeout(() => {
          iframe.remove();
          resolve();
        }, 1000);
      }, 500);
    };

    iframe.srcdoc = cleanHtml;
  });
}
