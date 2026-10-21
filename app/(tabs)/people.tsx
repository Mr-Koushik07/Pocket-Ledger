import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import { Expense, useExpenses } from '@/context/ExpenseContext';
import { EditExpenseModal } from '@/components/EditExpenseModal';
import { generateUpiRequestMessage, launchPhonePePayment } from '@/services/upiPayment';

const palette = colors.light;
const currency = (amount: number) =>
  `₹${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type PersonLedger = {
  name: string;
  transactions: Expense[];
  paid: number;
  received: number;
  balance: number;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function balanceCopy(balance: number) {
  if (balance > 0) return { label: 'owes you', color: palette.primary };
  if (balance < 0) return { label: 'you owe', color: palette.foreground };
  return { label: 'settled', color: palette.mutedForeground };
}

/**
 * Modal to configure the user's personal UPI ID for receiving payments
 */
function ConfigureMyUpiModal({
  visible,
  currentName,
  currentUpi,
  onClose,
  onSave,
}: {
  visible: boolean;
  currentName: string;
  currentUpi: string;
  onClose: () => void;
  onSave: (name: string, upi: string) => Promise<void>;
}) {
  const [name, setName] = useState(currentName);
  const [upi, setUpi] = useState(currentUpi);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setName(currentName);
      setUpi(currentUpi);
      setError('');
    }
  }, [visible, currentName, currentUpi]);

  const submit = async () => {
    const cleanUpi = upi.trim();
    if (!cleanUpi) {
      setError('Please enter your UPI ID (e.g. yourname@ybl)');
      return;
    }
    if (!cleanUpi.includes('@') && cleanUpi.length < 10) {
      setError('Enter a valid UPI ID (e.g. mobile@ybl or name@okaxis)');
      return;
    }
    await onSave(name.trim() || 'Pocket Ledger User', cleanUpi);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.modalBackdropCenter}>
        <Pressable style={styles.dialogBackdrop} onPress={onClose} />
        <View style={styles.dialogCard}>
          <View style={styles.dialogHeader}>
            <View>
              <Text style={styles.dialogKickerUpi}>RECEIVE PAYMENTS</Text>
              <Text style={styles.dialogTitle}>My UPI ID</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeCircle}>
              <Feather name="x" size={18} color={palette.foreground} />
            </Pressable>
          </View>

          <Text style={styles.dialogDescription}>
            Set your PhonePe / UPI handle so friends can pay you back with 1-tap payment requests.
          </Text>

          <Text style={styles.dialogFieldLabel}>YOUR DISPLAY NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Rahul Sharma"
            placeholderTextColor={palette.mutedForeground}
            style={styles.dialogInput}
          />

          <Text style={styles.dialogFieldLabel}>YOUR PHONEPE / UPI ID</Text>
          <TextInput
            autoFocus
            value={upi}
            onChangeText={(t) => {
              setUpi(t.replace(/\s/g, ''));
              setError('');
            }}
            placeholder="e.g. 9876543210@ybl, rahul@okaxis"
            placeholderTextColor={palette.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.dialogInput}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable onPress={() => void submit()} style={styles.dialogPhonePeBtn}>
            <Feather name="check-circle" size={18} color="#FFF" />
            <Text style={styles.dialogPrimaryBtnText}>Save My UPI ID</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Modal to configure a contact's UPI ID for direct 1-tap repayments
 */
function EditContactUpiModal({
  visible,
  personName,
  currentUpi,
  onClose,
  onSave,
}: {
  visible: boolean;
  personName: string;
  currentUpi: string;
  onClose: () => void;
  onSave: (upiId: string) => Promise<void>;
}) {
  const [upi, setUpi] = useState(currentUpi);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setUpi(currentUpi);
      setError('');
    }
  }, [visible, currentUpi]);

  const submit = async () => {
    const cleanUpi = upi.trim();
    if (!cleanUpi) {
      setError("Please enter this person's UPI ID or Phone number");
      return;
    }
    // If user enters 10 digits phone number, suggest phonepe handle
    let formatted = cleanUpi;
    if (/^[0-9]{10}$/.test(cleanUpi)) {
      formatted = `${cleanUpi}@ybl`;
    }
    await onSave(formatted);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.modalBackdropCenter}>
        <Pressable style={styles.dialogBackdrop} onPress={onClose} />
        <View style={styles.dialogCard}>
          <View style={styles.dialogHeader}>
            <View>
              <Text style={styles.dialogKickerUpi}>PHONEPE / UPI CONTACT</Text>
              <Text style={styles.dialogTitle}>{personName}&apos;s UPI</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeCircle}>
              <Feather name="x" size={18} color={palette.foreground} />
            </Pressable>
          </View>

          <Text style={styles.dialogDescription}>
            Save {personName}&apos;s UPI ID or phone number. When you owe them money, you can launch PhonePe in 1 tap!
          </Text>

          <Text style={styles.dialogFieldLabel}>UPI ID OR 10-DIGIT MOBILE</Text>
          <TextInput
            autoFocus
            value={upi}
            onChangeText={(t) => {
              setUpi(t.replace(/\s/g, ''));
              setError('');
            }}
            placeholder="e.g. 9876543210@ybl, rahul@okaxis"
            placeholderTextColor={palette.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.dialogInput}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable onPress={() => void submit()} style={styles.dialogPhonePeBtn}>
            <Feather name="check" size={18} color="#FFF" />
            <Text style={styles.dialogPrimaryBtnText}>Save Contact UPI</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RepaymentModal({
  visible,
  personName,
  defaultAmount,
  defaultCategory,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  personName: string;
  defaultAmount: number;
  defaultCategory: string;
  onClose: () => void;
  onConfirm: (amount: number, note: string, category: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setAmount(defaultAmount > 0 ? defaultAmount.toString() : '');
      setNote(`Repaid for ${defaultCategory}`);
      setError('');
    }
  }, [visible, defaultAmount, defaultCategory]);

  const submit = async () => {
    const numeric = Number(amount.replace(',', '.'));
    if (!numeric || numeric <= 0) {
      setError('Enter a valid repayment amount');
      return;
    }
    await onConfirm(numeric, note.trim() || `Repaid for ${defaultCategory}`, defaultCategory);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.modalBackdropCenter}>
        <Pressable style={styles.dialogBackdrop} onPress={onClose} />
        <View style={styles.dialogCard}>
          <View style={styles.dialogHeader}>
            <View>
              <Text style={styles.dialogKicker}>RECORD REPAYMENT</Text>
              <Text style={styles.dialogTitle}>From {personName}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeCircle}>
              <Feather name="x" size={18} color={palette.foreground} />
            </Pressable>
          </View>

          <Text style={styles.dialogDescription}>
            This reduces the amount {personName} owes you and logs a repayment in your ledger.
          </Text>

          <Text style={styles.dialogFieldLabel}>REPAYMENT AMOUNT</Text>
          <View style={styles.dialogAmountInputWrap}>
            <Text style={styles.dialogCurrencyPrefix}>₹</Text>
            <TextInput
              autoFocus
              value={amount}
              onChangeText={(t) => {
                setAmount(t.replace(/[^0-9.,]/g, ''));
                setError('');
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={palette.mutedForeground}
              style={styles.dialogAmountInput}
            />
          </View>

          {defaultAmount > 0 && defaultAmount !== Number(amount) && (
            <Pressable
              onPress={() => setAmount(defaultAmount.toString())}
              style={styles.fullBalanceChip}
            >
              <Text style={styles.fullBalanceChipText}>
                Settle full balance ({currency(defaultAmount)})
              </Text>
            </Pressable>
          )}

          <View style={styles.preservedCategoryRow}>
            <Text style={styles.preservedCategoryLabel}>Category: </Text>
            <View style={styles.preservedCategoryBadge}>
              <Feather name="tag" size={11} color={palette.foreground} />
              <Text style={styles.preservedCategoryText}>{defaultCategory}</Text>
            </View>
          </View>

          <Text style={styles.dialogFieldLabel}>NOTE / DETAILS</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Cash repayment, PhonePe, GPay"
            placeholderTextColor={palette.mutedForeground}
            style={styles.dialogInput}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable onPress={() => void submit()} style={styles.dialogPrimaryBtn}>
            <Feather name="check-circle" size={18} color={palette.primaryForeground} />
            <Text style={styles.dialogPrimaryBtnText}>Record Repayment</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PersonDetail({
  ledger,
  onClose,
  onOpenMyUpiModal,
}: {
  ledger: PersonLedger;
  onClose: () => void;
  onOpenMyUpiModal: () => void;
}) {
  const {
    addExpense,
    deleteExpense,
    getCategoryInfo,
    personContacts,
    setPersonContact,
    userProfile,
  } = useExpenses();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [showContactUpiModal, setShowContactUpiModal] = useState(false);

  // Contact's saved UPI ID
  const contactUpi = personContacts[ledger.name.toLowerCase()]?.upiId || '';

  // Preserve the category of what you paid for this person
  const preservedCategory = useMemo(() => {
    const spentTransaction = ledger.transactions.find((t) => t.direction === 'spent' && t.category);
    return spentTransaction?.category || ledger.transactions[0]?.category || 'Food';
  }, [ledger.transactions]);

  const balance = balanceCopy(ledger.balance);

  const handleRepayment = async (amount: number, note: string, category: string) => {
    await addExpense({
      amount,
      note,
      category,
      direction: 'received',
      person: ledger.name,
      subContext: 'Personal',
      date: new Date().toISOString(),
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  /**
   * Launch PhonePe to pay the person when you owe them
   */
  const handlePayViaPhonePe = async () => {
    if (!contactUpi) {
      setShowContactUpiModal(true);
      return;
    }

    const amountToPay = Math.abs(ledger.balance);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await launchPhonePePayment({
      upiId: contactUpi,
      name: ledger.name,
      amount: amountToPay,
      note: `Pocket Ledger: Settle ${preservedCategory}`,
    });

    if (!result.success && result.error) {
      Alert.alert('Payment Notice', result.error);
      return;
    }

    // After launching app, prompt user if they'd like to log it as settled
    setTimeout(() => {
      Alert.alert(
        'Payment Completed?',
        `Did you complete the payment of ${currency(amountToPay)} to ${ledger.name}?`,
        [
          { text: 'Not Yet', style: 'cancel' },
          {
            text: 'Yes, Settle Debt',
            style: 'default',
            onPress: () => {
              void addExpense({
                amount: amountToPay,
                note: `Paid via PhonePe (${contactUpi})`,
                category: preservedCategory,
                direction: 'spent',
                person: ledger.name,
                subContext: 'Personal',
                date: new Date().toISOString(),
              });
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ],
      );
    }, 1200);
  };

  /**
   * Request money from person via WhatsApp / PhonePe link
   */
  const handleRequestPayment = async () => {
    if (!userProfile.upiId) {
      Alert.alert(
        'Configure Your UPI ID',
        'Please enter your PhonePe / UPI ID first so friends know where to send money.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set Up Now', onPress: onOpenMyUpiModal },
        ],
      );
      return;
    }

    const message = generateUpiRequestMessage({
      myUpiId: userProfile.upiId,
      myName: userProfile.name || 'Friend',
      amount: ledger.balance,
      reason: preservedCategory,
    });

    try {
      void Haptics.selectionAsync();
      await Share.share({
        message,
        title: `Payment Request from ${userProfile.name || 'Pocket Ledger'}`,
      });
    } catch {
      // Ignored
    }
  };

  const confirmDeleteTransaction = (item: Expense) => {
    const doDelete = async () => {
      await deleteExpense(item.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete ${item.note || 'this transaction'} (${currency(item.amount)})?`)) {
        void doDelete();
      }
      return;
    }

    Alert.alert(
      'Delete transaction?',
      `Remove this ${item.direction === 'received' ? 'repayment' : 'expense'} (${currency(item.amount)}) from ${ledger.name}'s history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void doDelete() },
      ],
    );
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismiss} onPress={onClose} />
        <View style={styles.detailSheet}>
          <View style={styles.sheetHandle} />

          {/* HEADER */}
          <View style={styles.detailHeader}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{ledger.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.detailHeaderText}>
              <Text style={styles.detailKicker}>PERSONAL LEDGER</Text>
              <Text style={styles.detailTitle}>{ledger.name}</Text>
            </View>
            <Pressable testID="close-person-ledger" onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={19} color={palette.foreground} />
            </Pressable>
          </View>

          {/* BALANCE CARD */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
            <Text style={[styles.balanceAmount, { color: balance.color }]}>
              {currency(ledger.balance)}
            </Text>
            <View style={[styles.balanceBadge, { backgroundColor: `${balance.color}15` }]}>
              <Text style={[styles.balanceDirection, { color: balance.color }]}>
                {ledger.balance > 0
                  ? `${ledger.name} owes you`
                  : ledger.balance < 0
                    ? `You owe ${ledger.name}`
                    : 'All settled up'}
              </Text>
            </View>

            {/* CONTACT UPI PILL */}
            <Pressable
              onPress={() => setShowContactUpiModal(true)}
              style={styles.upiPill}
              hitSlop={6}
            >
              <View style={styles.upiIconMini}>
                <Feather name="send" size={10} color="#5F259F" />
              </View>
              <Text style={styles.upiPillText}>
                {contactUpi ? `UPI: ${contactUpi}` : '+ Link PhonePe / UPI ID'}
              </Text>
              <Feather name="edit-2" size={11} color="#5F259F" style={{ marginLeft: 3 }} />
            </Pressable>
          </View>

          {/* PHONEPE INTEGRATED ACTIONS */}
          <View style={styles.upiActionRow}>
            {ledger.balance < 0 ? (
              // YOU OWE -> PAY VIA PHONEPE BUTTON
              <Pressable
                onPress={() => void handlePayViaPhonePe()}
                style={({ pressed }) => [styles.phonePePayBtn, pressed && styles.pressed]}
              >
                <Feather name="external-link" size={16} color="#FFF" />
                <Text style={styles.phonePePayBtnText}>
                  Pay {currency(ledger.balance)} via PhonePe
                </Text>
              </Pressable>
            ) : ledger.balance > 0 ? (
              // THEY OWE -> REQUEST VIA PHONEPE / WHATSAPP LINK
              <Pressable
                onPress={() => void handleRequestPayment()}
                style={({ pressed }) => [styles.phonePeRequestBtn, pressed && styles.pressed]}
              >
                <Feather name="share-2" size={16} color="#5F259F" />
                <Text style={styles.phonePeRequestBtnText}>
                  Request Payment via WhatsApp
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* QUICK ACTIONS: REPAID ME / QUICK PAYMENT */}
          <View style={styles.quickActionRow}>
            <Pressable
              onPress={() => setShowRepaymentModal(true)}
              style={({ pressed }) => [styles.quickActionBtn, styles.repaymentBtn, pressed && styles.pressed]}
            >
              <Feather name="arrow-down-left" size={16} color="#166534" />
              <Text style={styles.repaymentBtnText}>
                {ledger.balance > 0 ? 'Repaid me' : 'Record received'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setEditingExpense({
                  id: '',
                  amount: 0,
                  category: preservedCategory,
                  note: `Paid for ${ledger.name}`,
                  date: new Date().toISOString(),
                  direction: 'spent',
                  person: ledger.name,
                  subContext: 'Personal',
                  eventTag: '',
                });
              }}
              style={({ pressed }) => [styles.quickActionBtn, styles.paidMoreBtn, pressed && styles.pressed]}
            >
              <Feather name="arrow-up-right" size={16} color={palette.primary} />
              <Text style={styles.paidMoreBtnText}>I paid {ledger.name}</Text>
            </Pressable>
          </View>

          {/* STATS OVERVIEW */}
          <View style={styles.detailStats}>
            <View style={styles.statCol}>
              <Text style={styles.detailStatLabel}>YOU PAID</Text>
              <Text style={styles.detailStatValue}>{currency(ledger.paid)}</Text>
            </View>
            <View style={styles.detailStatDivider} />
            <View style={styles.statCol}>
              <Text style={styles.detailStatLabel}>YOU RECEIVED</Text>
              <Text style={styles.detailStatValue}>{currency(ledger.received)}</Text>
            </View>
            <View style={styles.detailStatDivider} />
            <View style={styles.statCol}>
              <Text style={styles.detailStatLabel}>ENTRIES</Text>
              <Text style={styles.detailStatValue}>{ledger.transactions.length}</Text>
            </View>
          </View>

          {/* TRANSACTION HISTORY HEADER */}
          <View style={styles.historyHeaderRow}>
            <Text style={styles.historyLabel}>TRANSACTION HISTORY</Text>
            <Text style={styles.historyHelper}>Tap any item to edit</Text>
          </View>

          {/* TRANSACTION HISTORY LIST */}
          <FlatList
            data={ledger.transactions}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.historyList}
            renderItem={({ item }) => {
              return (
                <Pressable
                  onPress={() => setEditingExpense(item)}
                  style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
                >
                  <View
                    style={[
                      styles.historyIcon,
                      { backgroundColor: item.direction === 'received' ? '#E6F1EA' : '#F9DED7' },
                    ]}
                  >
                    <Feather
                      name={item.direction === 'received' ? 'arrow-down-left' : 'arrow-up-right'}
                      size={16}
                      color={item.direction === 'received' ? '#166534' : palette.primary}
                    />
                  </View>

                  <View style={styles.historyMain}>
                    <Text style={styles.historyTitle} numberOfLines={1}>
                      {item.note || (item.direction === 'received' ? 'Money received' : item.category)}
                    </Text>
                    <View style={styles.historyMetaRow}>
                      <Text style={styles.historyMetaText}>
                        {item.category} · {formatDate(item.date)}
                      </Text>
                      {item.subContext && item.subContext !== 'Personal' && (
                        <View style={styles.historySubBadge}>
                          <Text style={styles.historySubBadgeText}>{item.subContext}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.historyAmountWrap}>
                    <Text
                      style={[
                        styles.historyAmount,
                        item.direction === 'received' && styles.receivedAmount,
                      ]}
                    >
                      {item.direction === 'received' ? '+' : '−'}
                      {currency(item.amount)}
                    </Text>
                  </View>

                  {/* GRANULAR ROW ACTIONS: EDIT & DELETE */}
                  <View style={styles.rowActions}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setEditingExpense(item);
                      }}
                      hitSlop={8}
                      style={styles.actionIconBtn}
                    >
                      <Feather name="edit-2" size={14} color={palette.mutedForeground} />
                    </Pressable>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        confirmDeleteTransaction(item);
                      }}
                      hitSlop={8}
                      style={styles.actionIconBtn}
                    >
                      <Feather name="trash-2" size={14} color={palette.destructive} />
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      </View>

      {/* MODALS */}
      <RepaymentModal
        visible={showRepaymentModal}
        personName={ledger.name}
        defaultAmount={Math.max(ledger.balance, 0)}
        defaultCategory={preservedCategory}
        onClose={() => setShowRepaymentModal(false)}
        onConfirm={handleRepayment}
      />

      <EditContactUpiModal
        visible={showContactUpiModal}
        personName={ledger.name}
        currentUpi={contactUpi}
        onClose={() => setShowContactUpiModal(false)}
        onSave={async (newUpi) => {
          await setPersonContact(ledger.name, newUpi);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      {editingExpense && editingExpense.id ? (
        <EditExpenseModal
          expense={editingExpense}
          visible={!!editingExpense}
          onClose={() => setEditingExpense(null)}
        />
      ) : null}
    </Modal>
  );
}

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const { expenses, loading, reload, userProfile, setUserProfile } = useExpenses();
  const [selectedPersonName, setSelectedPersonName] = useState<string | null>(null);
  const [showMyUpiModal, setShowMyUpiModal] = useState<boolean>(false);

  const ledgers = useMemo(() => {
    const map = new Map<string, PersonLedger>();
    expenses
      .filter((expense) => expense.person && expense.person.trim())
      .forEach((expense) => {
        const name = expense.person.trim();
        const existing = map.get(name) ?? { name, transactions: [], paid: 0, received: 0, balance: 0 };
        existing.transactions.push(expense);
        if (expense.direction === 'received') existing.received += expense.amount;
        else existing.paid += expense.amount;
        existing.balance = existing.paid - existing.received;
        map.set(name, existing);
      });
    return Array.from(map.values()).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [expenses]);

  const activeLedger = useMemo(() => {
    if (!selectedPersonName) return null;
    return ledgers.find((l) => l.name.toLowerCase() === selectedPersonName.toLowerCase()) ?? null;
  }, [ledgers, selectedPersonName]);

  const totalReceivable = useMemo(() => {
    return ledgers.filter((l) => l.balance > 0).reduce((sum, l) => sum + l.balance, 0);
  }, [ledgers]);

  const totalPayable = useMemo(() => {
    return ledgers.filter((l) => l.balance < 0).reduce((sum, l) => sum + Math.abs(l.balance), 0);
  }, [ledgers]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={ledgers}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => {
          const balance = balanceCopy(item.balance);
          return (
            <Pressable
              testID={`person-${item.name}`}
              onPress={() => setSelectedPersonName(item.name)}
              style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.personMain}>
                <Text style={styles.personName}>{item.name}</Text>
                <Text style={styles.personMeta}>
                  {item.transactions.length}{' '}
                  {item.transactions.length === 1 ? 'transaction' : 'transactions'}
                </Text>
              </View>
              <View style={styles.personBalance}>
                <Text style={[styles.personAmount, { color: balance.color }]}>
                  {currency(item.balance)}
                </Text>
                <Text style={[styles.personDirection, { color: balance.color }]}>
                  {balance.label}
                </Text>
              </View>
              <Feather name="chevron-right" size={17} color={palette.mutedForeground} />
            </Pressable>
          );
        }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 24) + 84 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={ledgers.length > 0}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void reload()}
            tintColor={palette.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>MONEY BETWEEN YOU</Text>
                <Text style={styles.title}>People</Text>
              </View>

              {/* MY UPI BUTTON */}
              <Pressable
                onPress={() => setShowMyUpiModal(true)}
                style={({ pressed }) => [styles.myUpiBtn, pressed && styles.pressed]}
              >
                <View style={styles.upiIconTiny}>
                  <Feather name="send" size={11} color="#5F259F" />
                </View>
                <Text style={styles.myUpiBtnText} numberOfLines={1}>
                  {userProfile.upiId ? userProfile.upiId : 'Set My UPI'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.subtitle}>
              Keep track of who owes who, settle debts via PhonePe, and send payment requests.
            </Text>

            {/* SUMMARY OVERVIEW PILL */}
            {ledgers.length > 0 && (
              <View style={styles.overviewCard}>
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewLabel}>TOTAL YOU ARE OWED</Text>
                  <Text style={[styles.overviewValue, { color: palette.primary }]}>
                    {currency(totalReceivable)}
                  </Text>
                </View>
                <View style={styles.overviewDivider} />
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewLabel}>TOTAL YOU OWE</Text>
                  <Text style={styles.overviewValue}>{currency(totalPayable)}</Text>
                </View>
              </View>
            )}

            <View style={styles.rule}>
              <View style={styles.ruleAccent} />
              <View style={styles.ruleRest} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="users" size={24} color={palette.primary} />
            </View>
            <Text style={styles.emptyTitle}>No balances tracked yet</Text>
            <Text style={styles.emptyText}>
              Tag an expense or received amount with a person&apos;s name when adding entries.
            </Text>
          </View>
        }
      />

      {/* ACTIVE PERSON DETAIL MODAL */}
      {activeLedger && (
        <PersonDetail
          ledger={activeLedger}
          onClose={() => setSelectedPersonName(null)}
          onOpenMyUpiModal={() => setShowMyUpiModal(true)}
        />
      )}

      {/* CONFIGURE USER UPI MODAL */}
      <ConfigureMyUpiModal
        visible={showMyUpiModal}
        currentName={userProfile.name}
        currentUpi={userProfile.upiId}
        onClose={() => setShowMyUpiModal(false)}
        onSave={async (name, upi) => {
          await setUserProfile({ name, upiId: upi });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: 20 },
  header: { marginBottom: 16 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: palette.primary, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3 },
  title: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -0.9, marginTop: 4 },
  subtitle: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 6 },
  myUpiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: 160,
  },
  upiIconTiny: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FAF5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myUpiBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5F259F',
  },
  overviewCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECE8DE',
  },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewLabel: { color: palette.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.1 },
  overviewValue: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 4 },
  overviewDivider: { width: 1, height: 26, backgroundColor: '#ECE8DE' },
  rule: { flexDirection: 'row', height: 3, marginTop: 18, gap: 5 },
  ruleAccent: { width: 42, backgroundColor: palette.primary, borderRadius: 2 },
  ruleRest: { flex: 1, backgroundColor: '#DDD9D0', borderRadius: 2 },
  personRow: {
    backgroundColor: palette.card,
    borderRadius: 19,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECE8DE',
  },
  pressed: { opacity: 0.78 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: palette.foreground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFDF8', fontFamily: 'Inter_700Bold', fontSize: 17 },
  personMain: { flex: 1, minWidth: 0 },
  personName: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  personMeta: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  personBalance: { alignItems: 'flex-end', marginRight: 10 },
  personAmount: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  personDirection: { fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 3 },
  empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 62 },
  emptyIcon: { width: 60, height: 60, borderRadius: 21, backgroundColor: '#F9DED7', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 16 },
  emptyText: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(25,51,47,0.38)' },
  modalDismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  detailSheet: { maxHeight: '90%', backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 24 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#C8C2B7', alignSelf: 'center', marginBottom: 19 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  detailHeaderText: { flex: 1, marginLeft: 12 },
  detailKicker: { color: palette.primary, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3 },
  detailTitle: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.6, marginTop: 4 },
  closeButton: { width: 38, height: 38, backgroundColor: palette.card, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  balanceCard: { backgroundColor: palette.card, borderRadius: 20, borderWidth: 1, borderColor: '#ECE8DE', padding: 18, alignItems: 'center' },
  balanceLabel: { color: palette.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1 },
  balanceAmount: { fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -0.8, marginTop: 6 },
  balanceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  balanceDirection: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  upiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 10,
  },
  upiIconMini: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FAF5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5F259F',
  },
  upiActionRow: {
    marginTop: 12,
  },
  phonePePayBtn: {
    backgroundColor: '#5F259F', // Official PhonePe brand purple
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#5F259F',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  phonePePayBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  phonePeRequestBtn: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#C084FC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  phonePeRequestBtnText: {
    color: '#5F259F',
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  quickActionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  repaymentBtn: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  repaymentBtnText: { color: '#166534', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  paidMoreBtn: { backgroundColor: '#FFF5F3', borderColor: '#FED7D2' },
  paidMoreBtnText: { color: palette.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  detailStats: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  statCol: { flex: 1, alignItems: 'center' },
  detailStatLabel: { color: palette.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1 },
  detailStatValue: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 4 },
  detailStatDivider: { width: 1, height: 22, backgroundColor: '#DDD9D0' },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  historyLabel: { color: palette.primary, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3 },
  historyHelper: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 },
  historyList: { paddingBottom: 16 },
  historyRow: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECE8DE',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  historyMain: { flex: 1, minWidth: 0 },
  historyTitle: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  historyMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  historyMetaText: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 },
  historySubBadge: { backgroundColor: '#ECE8DE', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  historySubBadgeText: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  historyAmountWrap: { alignItems: 'flex-end', marginHorizontal: 8 },
  historyAmount: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  receivedAmount: { color: '#166534' },
  rowActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginLeft: 4 },
  actionIconBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F8F6F0', alignItems: 'center', justifyContent: 'center' },
  modalBackdropCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialogBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(25,51,47,0.48)' },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: palette.background,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 9,
  },
  dialogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dialogKicker: { color: '#166534', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  dialogKickerUpi: { color: '#5F259F', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  dialogTitle: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: 2 },
  closeCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' },
  dialogDescription: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginBottom: 14 },
  dialogFieldLabel: { color: palette.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1, marginBottom: 6 },
  dialogAmountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.input,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  dialogCurrencyPrefix: { color: palette.primary, fontFamily: 'Inter_700Bold', fontSize: 22, marginRight: 6 },
  dialogAmountInput: { flex: 1, color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 24, paddingVertical: 10 },
  fullBalanceChip: { alignSelf: 'flex-start', backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginBottom: 12 },
  fullBalanceChipText: { color: '#2E7D32', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  preservedCategoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  preservedCategoryLabel: { color: palette.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12 },
  preservedCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ECE8DE',
  },
  preservedCategoryText: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  dialogInput: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.input,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.foreground,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginBottom: 14,
  },
  dialogPrimaryBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: palette.foreground,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  dialogPhonePeBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#5F259F',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  dialogPrimaryBtnText: { color: '#FFFDF8', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  errorText: { color: palette.destructive, fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 8 },
});