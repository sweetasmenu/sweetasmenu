/**
 * Print utility for thermal receipt printers (80mm / 53mm).
 *
 * Desktop: window.open() + document.write() — opens a new popup window
 *   with the receipt HTML. The receipt's own @page / CSS rules apply.
 *   Auto-print script in the HTML triggers the print dialog automatically.
 *
 * Mobile (System Print): blob URL + <a target="_blank"> click — bypasses popup blockers.
 *   Opens the receipt HTML in a new tab. Same auto-print behavior.
 *   Works with AirPrint (iOS) or Android system print dialog.
 *
 * Mobile (RawBT): rawbt: URL scheme — sends HTML directly to RawBT app
 *   which renders and prints to Bluetooth thermal printer.
 *   Requires RawBT app installed on Android (free on Play Store).
 */

/** Print method preference key in localStorage */
const PRINT_METHOD_KEY = 'thermal_print_method';

/** Available print methods */
export type PrintMethod = 'system' | 'rawbt';

/**
 * Get the current print method preference.
 * Returns 'system' by default.
 */
export function getPrintMethod(): PrintMethod {
  if (typeof localStorage === 'undefined') return 'system';
  return (localStorage.getItem(PRINT_METHOD_KEY) as PrintMethod) || 'system';
}

/**
 * Set the print method preference.
 * 'system' = regular browser print (default)
 * 'rawbt' = send to RawBT app for Bluetooth thermal printing
 */
export function setPrintMethod(method: PrintMethod): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PRINT_METHOD_KEY, method);
}

/**
 * Check if the device is Android (for RawBT compatibility).
 */
export function isAndroidDevice(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * Check if the device is mobile/tablet.
 */
export function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    ('ontouchstart' in window && window.innerWidth < 1024);
}

/**
 * Opens receipt HTML in a new window/tab and triggers printing.
 * Automatically uses RawBT on Android if the user has enabled it.
 */
export function printViaIframe(htmlContent: string): void {
  const printMethod = getPrintMethod();
  const isMobile = isMobileDevice();

  // Use RawBT if enabled
  if (printMethod === 'rawbt' && isMobile) {
    printViaRawBT(htmlContent);
    return;
  }

  // System print (default)
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

/**
 * Print via RawBT app (Android Bluetooth thermal printing).
 * Uses the rawbt: URL scheme to send HTML directly to the app.
 * RawBT renders the HTML and sends it to the connected Bluetooth printer.
 *
 * Requires: RawBT app installed from Google Play Store.
 * https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter
 */
function printViaRawBT(htmlContent: string): void {
  try {
    // Strip <script> tags — RawBT renders HTML only, no JS execution needed
    const cleanHtml = htmlContent.replace(/<script[\s\S]*?<\/script>/gi, '');

    // Encode HTML to base64 (handle Unicode characters like Thai text)
    const base64Content = btoa(unescape(encodeURIComponent(cleanHtml)));

    // Open RawBT via URL scheme
    const rawbtUrl = `rawbt:base64,${base64Content}`;
    const a = document.createElement('a');
    a.href = rawbtUrl;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error('RawBT print failed:', e);
    // Fallback to system print
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
  }
}
