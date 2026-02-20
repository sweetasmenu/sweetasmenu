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
 * Mobile (RawBT): Renders receipt HTML to a PNG image via html2canvas,
 *   then sends it to RawBT app as rawbt:data:image/png;base64,...
 *   RawBT prints the image to the connected Bluetooth thermal printer.
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
 *
 * RawBT only supports image/pdf data URIs — NOT text/html.
 * So we render the receipt HTML to a PNG image using html2canvas,
 * then send the image via rawbt:data:image/png;base64,...
 *
 * Requires: RawBT app installed from Google Play Store.
 * https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter
 */
async function printViaRawBT(htmlContent: string): Promise<void> {
  try {
    // Dynamic import — html2canvas is already in package.json
    const html2canvas = (await import('html2canvas')).default;

    // Strip <script> tags
    const cleanHtml = htmlContent.replace(/<script[\s\S]*?<\/script>/gi, '');

    // Extract <style> and <body> content from the receipt HTML
    const styleMatch = cleanHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

    if (!bodyMatch) throw new Error('Invalid receipt HTML');

    // Create off-screen container to render the receipt
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '384px'; // ~58mm at 203dpi, safe for 80mm printers
    container.style.background = '#fff';
    container.style.fontFamily = "'Courier New', Courier, monospace";
    container.style.fontSize = '12px';
    container.style.lineHeight = '1.4';
    container.style.color = '#000';
    container.style.padding = '0 4px';

    // Inject receipt styles
    if (styleMatch) {
      const style = document.createElement('style');
      style.textContent = styleMatch[1];
      container.appendChild(style);
    }

    // Inject receipt body content
    const content = document.createElement('div');
    content.innerHTML = bodyMatch[1];
    container.appendChild(content);

    document.body.appendChild(container);

    // Wait for fonts and layout to settle
    await new Promise(resolve => setTimeout(resolve, 300));

    // Render receipt to canvas image
    const canvas = await html2canvas(container, {
      width: 384,
      background: '#ffffff',
      logging: false,
    });

    // Clean up temporary DOM element
    document.body.removeChild(container);

    // Convert canvas to base64 PNG
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];

    // Send image to RawBT — rawbt:data:image/png;base64,... is the supported format
    const rawbtUrl = `rawbt:data:image/png;base64,${base64Data}`;
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
