/**
 * Print utility for thermal receipt printers (80mm / 53mm).
 *
 * Desktop: window.open() + document.write() — opens a new popup window
 *   with the receipt HTML. The receipt's own @page / CSS rules apply.
 *   Auto-print script in the HTML triggers the print dialog automatically.
 *
 * Mobile: blob URL + <a target="_blank"> click — bypasses popup blockers.
 *   Opens the receipt HTML in a new tab. Same auto-print behavior.
 */

/**
 * Opens receipt HTML in a new window/tab and triggers printing.
 * Works on both desktop and mobile, optimized for thermal printers.
 */
export function printViaIframe(htmlContent: string): void {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                   ('ontouchstart' in window && window.innerWidth < 1024);

  if (isMobile) {
    // Mobile: open via <a> click (not blocked as popup)
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    // Desktop: window.open + document.write
    const printWindow = window.open('', '', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      // Fallback if popup is still blocked
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }
}
