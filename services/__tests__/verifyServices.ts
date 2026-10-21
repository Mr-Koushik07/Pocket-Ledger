import { parseBatchSms, parseSmsText } from '../smsParser';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- Testing SMS Parser ---');

// 1. PhonePe Swiggy debit
const t1 = parseSmsText('Paid ₹450.00 via PhonePe UPI to Swiggy on 19-Oct-2026. Txn ID: 4291829031. Bal: ₹12,450.00');
assert(t1 !== null, 't1 should be parsed');
assert(t1?.amount === 450, `Amount should be 450, got ${t1?.amount}`);
assert(t1?.direction === 'spent', `Direction should be spent, got ${t1?.direction}`);
assert(t1?.category === 'Food', `Category should be Food, got ${t1?.category}`);
assert(t1?.sourceApp === 'PhonePe', `Source should be PhonePe, got ${t1?.sourceApp}`);
console.log('✓ PhonePe Swiggy debit parsed correctly');

// 2. SBI Transfer to Person via PhonePe
const t2 = parseSmsText('Dear SBI User, your A/c ending 4821 is debited by Rs.1200.00 on 18-Oct-26 by transfer to Rahul via PhonePe UPI. Ref No 4298172901.');
assert(t2 !== null, 't2 should be parsed');
assert(t2?.amount === 1200, `Amount should be 1200, got ${t2?.amount}`);
assert(t2?.person === 'Rahul', `Person should be Rahul, got ${t2?.person}`);
assert(t2?.sourceApp === 'PhonePe', `Source should be PhonePe, got ${t2?.sourceApp}`);
console.log('✓ SBI transfer to Rahul via PhonePe parsed correctly');

// 3. HDFC Card Netflix
const t3 = parseSmsText('Rs. 199.00 spent on your HDFC Bank Card ending 1092 at NETFLIX on 17-Oct-26. Avl bal: Rs 48,200.00');
assert(t3 !== null, 't3 should be parsed');
assert(t3?.amount === 199, `Amount should be 199, got ${t3?.amount}`);
assert(Boolean(t3?.merchant.toLowerCase().includes('netflix')), `Merchant should be Netflix, got ${t3?.merchant}`);
console.log('✓ HDFC Card Netflix parsed correctly');

// 4. Inflow Credit
const t4 = parseSmsText('A/c *3910 Credited with Rs. 2,500.00 on 19-Oct-26 by VPA priya@okaxis (PhonePe UPI). UPI Ref: 9812739012');
assert(t4 !== null, 't4 should be parsed');
assert(t4?.amount === 2500, `Amount should be 2500, got ${t4?.amount}`);
assert(t4?.direction === 'received', `Direction should be received, got ${t4?.direction}`);
console.log('✓ Credit inflow parsed correctly');

// 5. Batch parsing
const batchText = `
Paid ₹450.00 via PhonePe UPI to Swiggy on 19-Oct-2026. Txn ID: 4291829031.

Dear SBI User, your A/c ending 4821 is debited by Rs.1200.00 on 18-Oct-26 by transfer to Rahul via PhonePe UPI. Ref No 4298172901.
`;
const batch = parseBatchSms(batchText);
assert(batch.length === 2, `Batch should find 2 transactions, got ${batch.length}`);
console.log('✓ Batch SMS parsing works correctly');

console.log('\nALL SMS PARSER TESTS PASSED! 🎉');
