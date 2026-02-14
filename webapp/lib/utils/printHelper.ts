/**
 * Mobile-friendly print utility for thermal receipt printers (80mm).
 *
 * Strategy: inject print content into the parent page as an iframe,
 * then call window.print() with @media print CSS that hides everything
 * except the receipt. This works reliably on Android/iOS/Desktop because
 * window.print() is universally supported, unlike iframe.contentWindow.print()
 * which fails on many mobile browsers.
 */

const PRINT_IFRAME_ID = 'print-helper-iframe';
const PRINT_STYLE_ID = 'print-helper-style';

/**
 * Prints HTML content for thermal printers — works on mobile, tablet, and desktop.
 *
 * How it works:
 * 1. Creates a hidden iframe with the receipt HTML (srcdoc)
 * 2. Injects @media print CSS into parent to hide all page content except the iframe
 * 3. Calls window.print() on the parent (reliable on all browsers)
 * 4. Cleans up after the print dialog closes
 *
 * @param htmlContent - Full HTML document string to print
 * @returns Promise that resolves after print dialog is triggered
 */
export function printViaIframe(htmlContent: string): Promise<void> {
  return new Promise((resolve) => {
    // Clean up any existing print elements
    document.getElementById(PRINT_IFRAME_ID)?.remove();
    document.getElementById(PRINT_STYLE_ID)?.remove();

    // Strip all <script> tags (handles nested braces, setTimeout, etc.)
    const cleanHtml = htmlContent.replace(/<script[\s\S]*?<\/script>/gi, '');

    // Inject @media print CSS into parent page:
    // - Hides ALL page content when printing
    // - Shows ONLY the receipt iframe
    // - Sets @page size to 80mm for thermal printers
    const style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    style.textContent = `
      @media print {
        @page {
          size: 80mm auto;
          margin: 0;
        }
        /* Hide everything on the page */
        body > *:not(#${PRINT_IFRAME_ID}) {
          display: none !important;
        }
        /* Reset body for clean print */
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          overflow: visible !important;
        }
        /* Show the receipt iframe */
        #${PRINT_IFRAME_ID} {
          display: block !important;
          position: static !important;
          visibility: visible !important;
          width: 100% !important;
          height: auto !important;
          border: none !important;
          opacity: 1 !important;
        }
      }
    `;
    document.head.appendChild(style);

    // Create iframe off-screen (invisible on screen, visible only during print)
    // Width 302px ≈ 80mm at 96 DPI for correct content layout
    const iframe = document.createElement('iframe');
    iframe.id = PRINT_IFRAME_ID;
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '302px';
    iframe.style.height = '900px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    const cleanup = () => {
      iframe.remove();
      style.remove();
      resolve();
    };

    // Set onload BEFORE srcdoc so the event is captured
    iframe.onload = () => {
      // Wait for content to fully render
      setTimeout(() => {
        // Listen for print dialog close to clean up
        const afterPrint = () => {
          window.removeEventListener('afterprint', afterPrint);
          cleanup();
        };
        window.addEventListener('afterprint', afterPrint);

        // Trigger print on the parent page
        // @media print CSS ensures only the iframe is visible
        window.print();

        // Safety timeout: clean up even if afterprint doesn't fire
        setTimeout(() => {
          window.removeEventListener('afterprint', afterPrint);
          if (document.getElementById(PRINT_IFRAME_ID)) {
            cleanup();
          }
        }, 30000);
      }, 500);
    };

    // Use srcdoc to load content — reliably triggers onload on all browsers
    iframe.srcdoc = cleanHtml;
  });
}
