/**
 * Mobile-friendly print utility using hidden iframe instead of popup windows.
 * Popup windows are blocked by most mobile browsers, while iframes work reliably.
 */

const PRINT_IFRAME_ID = 'print-helper-iframe';

/**
 * Prints HTML content via a hidden iframe — works on mobile, tablet, and desktop.
 *
 * @param htmlContent - Full HTML document string to print (without window.print/close scripts)
 * @returns Promise that resolves after print dialog is triggered
 */
export function printViaIframe(htmlContent: string): Promise<void> {
  return new Promise((resolve) => {
    // Remove any existing print iframe
    const existing = document.getElementById(PRINT_IFRAME_ID);
    if (existing) existing.remove();

    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.id = PRINT_IFRAME_ID;
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      console.error('Could not access iframe document');
      iframe.remove();
      resolve();
      return;
    }

    // Strip any window.print() / window.close() / window.onload scripts from the HTML
    // since we handle printing from the parent
    const cleanHtml = htmlContent
      .replace(/window\.onload\s*=\s*function\s*\(\)\s*\{[^}]*\}/g, '')
      .replace(/window\.print\(\)/g, '')
      .replace(/window\.close\(\)/g, '')
      .replace(/window\.onafterprint\s*=\s*function\s*\(\)\s*\{[^}]*\}/g, '');

    iframeDoc.open();
    iframeDoc.write(cleanHtml);
    iframeDoc.close();

    // Wait for content to render, then trigger print
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Print failed:', e);
          // Fallback: try opening in new tab (for browsers that block iframe printing)
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
      }, 300);
    };
  });
}

/**
 * Helper to strip auto-print scripts from existing HTML templates.
 * Use this when adapting existing popup-based print HTML.
 */
export function stripPrintScripts(html: string): string {
  return html
    .replace(/window\.onload\s*=\s*function\s*\(\)\s*\{[^}]*\}/g, '')
    .replace(/window\.print\(\)/g, '')
    .replace(/window\.close\(\)/g, '')
    .replace(/window\.onafterprint\s*=\s*function\s*\(\)\s*\{[^}]*\}/g, '');
}
