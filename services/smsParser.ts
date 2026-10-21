/**
 * Smart SMS & Transaction Notification Parser for Indian Banks & UPI (PhonePe, GPay, Paytm, etc.)
 */

export interface ParsedTransaction {
  id: string;
  amount: number;
  direction: 'spent' | 'received';
  merchant: string;
  category: string;
  subContext: string;
  person?: string;
  account?: string;
  reference?: string;
  date: string; // ISO format
  sourceApp?: string; // 'PhonePe' | 'Google Pay' | 'Paytm' | 'Bank'
  rawText: string;
  confidence: 'high' | 'medium' | 'low';
}

// Category keyword mappings for auto-categorization
const CATEGORY_RULES: { category: string; subContext?: string; keywords: string[] }[] = [
  {
    category: 'Developer',
    subContext: 'Developer',
    keywords: [
      'aws', 'amazon web services', 'google cloud', 'gcp', 'digitalocean', 'github', 'gitlab',
      'vercel', 'netlify', 'supabase', 'openai', 'anthropic', 'jetbrains', 'hostinger', 'godaddy',
      'namecheap', 'cloudflare', 'stripe', 'cursor', 'postman', 'docker', 'huggingface'
    ],
  },
  {
    category: 'Food',
    keywords: [
      'swiggy', 'zomato', 'starbucks', 'mcdonald', 'kfc', 'burger king', 'domino', 'pizza hut',
      'subway', 'chaayos', 'chai point', 'barbeque', 'cafe', 'restaurant', 'dhaba', 'bakery',
      'eats', 'blinkit', 'zepto', 'instamart', 'bigbasket', 'bb daily', 'haldiram', 'sweet',
      'biryani', 'kitchen', 'hotel', 'food', 'dining', 'bake'
    ],
  },
  {
    category: 'Transport',
    keywords: [
      'uber', 'ola', 'rapido', 'irctc', 'redbus', 'makemytrip', 'yatra', 'goibibo', 'indigo',
      'air india', 'spicejet', 'akasa', 'metro', 'dmrc', 'bmrc', 'fastag', 'toll', 'fuel',
      'petrol', 'diesel', 'cng', 'indian oil', 'bharat petroleum', 'hindustan petroleum',
      'hpcl', 'iocl', 'bpcl', 'shell', 'parking', 'cab', 'auto'
    ],
  },
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'zara', 'h&m', 'uniqlo',
      'croma', 'reliance digital', 'reliance retail', 'dmart', 'decathlon', 'ikea', 'lifestyle',
      'westside', 'pantaloons', 'max fashion', 'tatacliq', 'lenskart', 'urbanic', 'mall', 'store'
    ],
  },
  {
    category: 'Home',
    keywords: [
      'rent', 'society', 'maintenance', 'electricity', 'bescom', 'tata power', 'adani electricity',
      'uppcl', 'mahadiscom', 'broadband', 'wifi', 'airtel broadband', 'jio fiber', 'act fibernet',
      'hathaway', 'water bill', 'lpg', 'indane', 'bharat gas', 'hp gas', 'urban company', 'maid',
      'cook', 'groceries'
    ],
  },
  {
    category: 'Health',
    keywords: [
      'apollo', 'pharmeasy', '1mg', 'tata 1mg', 'netmeds', 'medplus', 'pharmacy', 'hospital',
      'clinic', 'doctor', 'diagnostic', 'lal pathlabs', 'metropolis', 'practo', 'dental', 'chemist'
    ],
  },
];

// Well-known Indian Banks and Payment Apps
const SOURCE_APPS: { name: string; patterns: RegExp[] }[] = [
  { name: 'PhonePe', patterns: [/phonepe/i, /ybl\b/i, /ibl\b/i, /axl\b/i] },
  { name: 'Google Pay', patterns: [/google\s*pay/i, /gpay/i, /okaxis/i, /okhdfcbank/i, /oksbi/i, /okicici/i] },
  { name: 'Paytm', patterns: [/paytm/i, /ptyes\b/i] },
  { name: 'CRED', patterns: [/cred/i] },
  { name: 'HDFC Bank', patterns: [/hdfc/i] },
  { name: 'SBI', patterns: [/sbi\b/i, /state\s*bank/i] },
  { name: 'ICICI Bank', patterns: [/icici/i] },
  { name: 'Axis Bank', patterns: [/axis\b/i] },
  { name: 'Kotak Bank', patterns: [/kotak/i] },
  { name: 'IndusInd Bank', patterns: [/indusind/i] },
  { name: 'Punjab National Bank', patterns: [/pnb\b/i] },
  { name: 'Bank of Baroda', patterns: [/bob\b/i, /baroda/i] },
];

/**
 * Predict category and context from merchant name or SMS text
 */
export function inferCategoryAndContext(merchant: string, text: string): { category: string; subContext: string } {
  const combined = `${merchant} ${text}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (combined.includes(kw)) {
        return {
          category: rule.category,
          subContext: rule.subContext || 'Personal',
        };
      }
    }
  }

  return { category: 'Other', subContext: 'Personal' };
}

/**
 * Parse an individual SMS or notification string
 */
export function parseSmsText(rawSms: string): ParsedTransaction | null {
  const text = rawSms.trim();
  if (!text || text.length < 15) return null;

  // 1. Determine Direction: Spent (outflow) vs Received (inflow)
  const spentKeywords = /\b(debited|spent|paid|sent|withdrawn|purchase of|transferred to|deducted|vpa debited)\b/i;
  const receivedKeywords = /\b(credited|received|deposited|refunded|refund|cashback|vpa credited)\b/i;

  let direction: 'spent' | 'received' = 'spent';
  if (receivedKeywords.test(text) && !spentKeywords.test(text)) {
    direction = 'received';
  } else if (spentKeywords.test(text)) {
    direction = 'spent';
  } else {
    // If neither explicit keyword is found, return null (probably OTP or promotional SMS)
    return null;
  }

  // 2. Extract Amount
  // Matches: "Rs. 450", "Rs 450.50", "INR 1,249", "₹ 500", "Rs.1,200.00"
  const amountRegexes = [
    /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:debited|credited|spent|withdrawn|paid)/i,
    /(?:amount|amt)\s*(?:of)?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  ];

  let rawAmount = '';
  for (const regex of amountRegexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      rawAmount = match[1].replace(/,/g, '');
      break;
    }
  }

  const amount = parseFloat(rawAmount);
  if (!amount || isNaN(amount) || amount <= 0) {
    return null;
  }

  // 3. Extract Merchant / Beneficiary / Person
  // Patterns like: "to Rahul", "at Swiggy", "to VPA rahul@ybl", "info: SWIGGY", "sent to STARBUCKS"
  let merchant = '';
  const merchantPatterns = [
    /(?:paid to|transfer to|transferred to|sent to|spent on|to vpa|to)\s+([A-Za-z0-9\s._&'-]+?)(?:\s+(?:on|ref|via|using|from|bal|avl|clear|thru|dated|\.|\,|\n|$))/i,
    /(?:at|info\/|info:)\s+([A-Za-z0-9\s._&'-]+?)(?:\s+(?:on|ref|via|using|from|bal|avl|clear|thru|\.|\,|\n|$))/i,
    /(?:from|credited by|received from)\s+([A-Za-z0-9\s._&'-]+?)(?:\s+(?:on|ref|via|to|bal|avl|\.|\,|\n|$))/i,
  ];

  for (const pattern of merchantPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Clean up false positives like 'your account' or 'account'
      if (!candidate.match(/^(your|a\/c|account|vpa|card|bank)$/i) && candidate.length > 1) {
        merchant = candidate;
        break;
      }
    }
  }

  if (!merchant) {
    merchant = direction === 'spent' ? 'Expense' : 'Received';
  }

  // 4. Identify Source App / Bank
  let sourceApp = 'Bank';
  for (const src of SOURCE_APPS) {
    if (src.patterns.some((p) => p.test(text))) {
      sourceApp = src.name;
      break;
    }
  }

  // 5. Extract Reference / UPI Ref number
  let reference = '';
  const refMatch = text.match(/(?:upi\s*(?:ref|reference)?|ref\s*no|rrn|txn\s*id)\s*[:#\-]?\s*([0-9A-Za-z]{6,20})/i);
  if (refMatch && refMatch[1]) {
    reference = refMatch[1];
  }

  // 6. Extract Account / Card ending
  let account = '';
  const accMatch = text.match(/(?:a\/c|acct|acc|card)\s*(?:no\.?)?\s*(?:ending\s*)?(?:with\s*)?(?:xx|x+|\*+)?([0-9]{3,4})/i);
  if (accMatch && accMatch[1]) {
    account = `••${accMatch[1]}`;
  }

  // 7. Auto-categorize
  const { category, subContext } = inferCategoryAndContext(merchant, text);

  // 8. Check if merchant is likely a person name for P2P tracking
  let person: string | undefined = undefined;
  if (
    merchant &&
    !CATEGORY_RULES.some((r) => r.keywords.some((k) => merchant.toLowerCase().includes(k))) &&
    merchant.split(' ').length <= 3 &&
    /^[A-Za-z\s]+$/.test(merchant) &&
    !/^(expense|received|bank|card|online|upi|pos|atm|transfer)$/i.test(merchant)
  ) {
    person = merchant;
  }

  // 9. Extract Date if present, or fallback to current
  let date = new Date().toISOString();
  const dateMatch = text.match(/\b([0-9]{1,2})[-/]([0-9]{1,2}|[A-Za-z]{3})[-/]([0-9]{2,4})\b/);
  if (dateMatch) {
    try {
      const d = new Date(dateMatch[0]);
      if (!isNaN(d.getTime())) {
        date = d.toISOString();
      }
    } catch {
      // fallback
    }
  }

  return {
    id: `sms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    amount,
    direction,
    merchant,
    category,
    subContext,
    person,
    account,
    reference,
    date,
    sourceApp,
    rawText: text,
    confidence: merchant !== 'Expense' && merchant !== 'Received' ? 'high' : 'medium',
  };
}

/**
 * Parse multiple SMS messages from a copied pasteboard or batch export
 */
export function parseBatchSms(bulkText: string): ParsedTransaction[] {
  // Split on double newlines, or lines that begin with typical SMS sender headers or prefixes
  const blocks = bulkText
    .split(/(?:\r?\n\s*\r?\n)|(?:(?<=\.)\s*(?=[A-Z0-9-]{3,10}:))/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const results: ParsedTransaction[] = [];
  const seenRefs = new Set<string>();

  for (const block of blocks) {
    const parsed = parseSmsText(block);
    if (parsed) {
      const key = parsed.reference || `${parsed.amount}-${parsed.merchant}-${parsed.date.slice(0, 10)}`;
      if (!seenRefs.has(key)) {
        seenRefs.add(key);
        results.push(parsed);
      }
    }
  }

  return results;
}
