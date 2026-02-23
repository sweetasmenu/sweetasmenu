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
 *
 * Cloud Print Queue: Sends print jobs to Supabase print_queue table.
 *   A Print Agent page running on a PC picks up jobs and prints them.
 *   Works from any device (iPad, Android, desktop) without direct printer connection.
 */

import { supabase } from '@/lib/supabase/client';

/** Print method preference key in localStorage */
const PRINT_METHOD_KEY = 'thermal_print_method';

/** Available print methods */
export type PrintMethod = 'system' | 'rawbt' | 'cloud';

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
 * 'cloud' = send to cloud print queue (for iPad → PC printing)
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

  // System print (default) — also used by Print Agent for cloud jobs
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
 * Send a print job to the cloud print queue (Supabase).
 * The Print Agent page on a PC will pick it up and print it.
 */
export async function printViaCloud(
  htmlContent: string,
  jobType: 'receipt' | 'kitchen_ticket',
  restaurantId: string,
  orderId?: string
): Promise<boolean> {
  try {
    console.log('[CloudPrint] Inserting job:', { jobType, restaurantId, orderId });
    const { data, error } = await supabase
      .from('print_queue')
      .insert({
        restaurant_id: restaurantId,
        order_id: orderId || null,
        job_type: jobType,
        html_content: htmlContent,
        status: 'pending',
      })
      .select();

    if (error) {
      console.error('[CloudPrint] Insert failed:', error.message, error.details, error.hint);
      return false;
    }
    console.log('[CloudPrint] Job inserted successfully:', data);
    return true;
  } catch (e) {
    console.error('[CloudPrint] Exception:', e);
    return false;
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
    // Match desktop print CSS: 72mm width, bold, same font sizes
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '72mm';
    container.style.background = '#fff';
    container.style.fontFamily = "Arial, Helvetica, sans-serif";
    container.style.fontSize = '12px';
    container.style.fontWeight = 'bold';
    container.style.lineHeight = '1.3';
    container.style.color = '#000';
    container.style.padding = '0 3mm 0 0';

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

    // Render receipt to canvas image (use container's natural width from 72mm CSS)
    const canvas = await html2canvas(container, {
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
