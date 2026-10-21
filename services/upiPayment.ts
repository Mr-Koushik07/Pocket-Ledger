import { Linking, Platform } from 'react-native';

export type UpiApp = 'phonepe' | 'gpay' | 'paytm' | 'generic';

export interface UpiPaymentParams {
  upiId: string;
  name: string;
  amount: number;
  note?: string;
  transactionRef?: string;
}

/**
 * Generate standard NPCI UPI Intent URI
 */
export function buildUpiUri(params: UpiPaymentParams, app: UpiApp = 'phonepe'): string {
  const { upiId, name, amount, note, transactionRef } = params;
  const cleanId = upiId.trim();
  const cleanName = encodeURIComponent(name.trim() || 'Pocket Ledger');
  const cleanNote = encodeURIComponent(note?.trim() || 'Settlement');
  const formattedAmount = amount.toFixed(2);
  const ref = transactionRef || `PL${Date.now()}`;

  const queryParams = `pa=${cleanId}&pn=${cleanName}&am=${formattedAmount}&cu=INR&tn=${cleanNote}&tr=${ref}`;

  switch (app) {
    case 'phonepe':
      return `phonepe://pay?${queryParams}`;
    case 'gpay':
      return `gpay://upi/pay?${queryParams}`;
    case 'paytm':
      return `paytmmp://pay?${queryParams}`;
    case 'generic':
    default:
      return `upi://pay?${queryParams}`;
  }
}

/**
 * Launch PhonePe directly with fallback to generic UPI app selector
 */
export async function launchPhonePePayment(params: UpiPaymentParams): Promise<{
  success: boolean;
  openedWith: 'phonepe' | 'upi' | 'none';
  error?: string;
}> {
  if (Platform.OS === 'web') {
    return {
      success: false,
      openedWith: 'none',
      error: 'UPI payments must be launched from a mobile device (Android or iOS).',
    };
  }

  const phonePeUrl = buildUpiUri(params, 'phonepe');
  const genericUpiUrl = buildUpiUri(params, 'generic');

  try {
    // Try opening PhonePe app directly
    const canOpenPhonePe = await Linking.canOpenURL(phonePeUrl).catch(() => false);
    if (canOpenPhonePe) {
      await Linking.openURL(phonePeUrl);
      return { success: true, openedWith: 'phonepe' };
    }

    // Fallback to generic UPI chooser (will list PhonePe, GPay, Paytm if installed)
    const canOpenGeneric = await Linking.canOpenURL(genericUpiUrl).catch(() => false);
    if (canOpenGeneric) {
      await Linking.openURL(genericUpiUrl);
      return { success: true, openedWith: 'upi' };
    }

    // Force open generic intent anyway on native Android
    if (Platform.OS === 'android') {
      await Linking.openURL(genericUpiUrl);
      return { success: true, openedWith: 'upi' };
    }

    return {
      success: false,
      openedWith: 'none',
      error: 'No UPI app (PhonePe, GPay, or Paytm) found on this device.',
    };
  } catch (err) {
    // Try opening generic intent if PhonePe direct failed
    try {
      await Linking.openURL(genericUpiUrl);
      return { success: true, openedWith: 'upi' };
    } catch (fallbackErr) {
      return {
        success: false,
        openedWith: 'none',
        error: (fallbackErr as Error)?.message || (err as Error)?.message || 'Failed to open UPI app',
      };
    }
  }
}

/**
 * Generate a friendly payment request message for WhatsApp / SMS / Telegram
 */
export function generateUpiRequestMessage(params: {
  myUpiId: string;
  myName: string;
  amount: number;
  reason?: string;
}): string {
  const { myUpiId, myName, amount, reason } = params;
  const deepLink = `upi://pay?pa=${myUpiId.trim()}&pn=${encodeURIComponent(myName.trim())}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(reason || 'Settlement')}`;
  
  return (
    `🪙 *Payment Request via Pocket Ledger*\n\n` +
    `Hey! Please settle *₹${amount.toLocaleString('en-IN')}*${reason ? ` for ${reason}` : ''}.\n\n` +
    `👉 *Pay via PhonePe / GPay / UPI:*\n` +
    `${deepLink}\n\n` +
    `Or use UPI ID: \`${myUpiId.trim()}\``
  );
}
