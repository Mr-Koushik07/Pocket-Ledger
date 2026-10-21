import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import { useExpenses } from '@/context/ExpenseContext';
import { parseBatchSms, parseSmsText, ParsedTransaction } from '@/services/smsParser';

const palette = colors.light;
const currency = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const SAMPLE_SMS = [
  'Paid ₹450.00 via PhonePe UPI to Swiggy on 19-Oct-2026. Txn ID: 4291829031. Bal: ₹12,450.00',
  'Dear SBI User, your A/c ending 4821 is debited by Rs.1200.00 on 18-Oct-26 by transfer to Rahul via PhonePe UPI. Ref No 4298172901.',
  'Rs. 199.00 spent on your HDFC Bank Card ending 1092 at NETFLIX on 17-Oct-26. Avl bal: Rs 48,200.00',
  'A/c *3910 Credited with Rs. 2,500.00 on 19-Oct-26 by VPA priya@okaxis (PhonePe UPI). UPI Ref: 9812739012',
];

export function SmartSmsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { addMultipleExpenses, categories } = useExpenses();
  const [rawText, setRawText] = useState('');
  const [parsedList, setParsedList] = useState<ParsedTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Parse text whenever entered or pasted
  const handleTextChange = (text: string) => {
    setRawText(text);
    if (!text.trim()) {
      setParsedList([]);
      setSelectedIds(new Set());
      return;
    }

    // Try batch parse first
    const batch = parseBatchSms(text);
    if (batch.length > 0) {
      setParsedList(batch);
      setSelectedIds(new Set(batch.map((b) => b.id)));
    } else {
      // Try single parse
      const single = parseSmsText(text);
      if (single) {
        setParsedList([single]);
        setSelectedIds(new Set([single.id]));
      } else {
        setParsedList([]);
        setSelectedIds(new Set());
      }
    }
  };

  const handlePasteClipboard = async () => {
    try {
      void Haptics.selectionAsync();
      const clip = await Clipboard.getStringAsync();
      if (clip && clip.trim()) {
        handleTextChange(clip);
      } else {
        Alert.alert('Clipboard Empty', 'No text found in clipboard to parse.');
      }
    } catch {
      Alert.alert('Error', 'Unable to access clipboard.');
    }
  };

  const handleLoadSample = (sample: string) => {
    void Haptics.selectionAsync();
    handleTextChange(sample);
  };

  const toggleSelect = (id: string) => {
    void Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpdateCategory = (id: string, newCategory: string) => {
    setParsedList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, category: newCategory } : item)),
    );
  };

  const handleImport = async () => {
    const toImport = parsedList.filter((item) => selectedIds.has(item.id));
    if (toImport.length === 0) {
      Alert.alert('No Selection', 'Please select at least one transaction to import.');
      return;
    }

    setIsProcessing(true);
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await addMultipleExpenses(
        toImport.map((item) => ({
          amount: item.amount,
          category: item.category,
          note: item.merchant !== 'Expense' ? item.merchant : (item.sourceApp || 'Bank SMS'),
          direction: item.direction,
          person: item.person || '',
          subContext: item.subContext,
          date: item.date,
        })),
      );

      setRawText('');
      setParsedList([]);
      setSelectedIds(new Set());
      onClose();

      const count = toImport.length;
      if (Platform.OS === 'web') {
        window.alert(`Successfully imported ${count} transaction${count > 1 ? 's' : ''}!`);
      } else {
        Alert.alert(
          'Transactions Imported! 🚀',
          `Added ${count} transaction${count > 1 ? 's' : ''} directly into your ledger.`,
        );
      }
    } catch (e) {
      Alert.alert('Import Failed', (e as Error)?.message || 'Could not save transactions.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <Pressable style={styles.dismissOverlay} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.sheetHandle} />

          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <View style={styles.iconCircle}>
                <Feather name="zap" size={18} color="#6366F1" />
              </View>
              <View>
                <Text style={styles.kicker}>SMART PARSER</Text>
                <Text style={styles.title}>Bank & PhonePe SMS</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Feather name="x" size={20} color={palette.foreground} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.description}>
              Copy any transactional SMS from PhonePe, GPay, Paytm, or your bank and paste it here.
              Pocket Ledger automatically extracts the amount, merchant, direction, and category!
            </Text>

            {/* INPUT + ACTION ROW */}
            <View style={styles.inputCard}>
              <View style={styles.inputHeader}>
                <Text style={styles.inputLabel}>PASTE SMS TEXT</Text>
                <Pressable onPress={() => void handlePasteClipboard()} style={styles.pasteBtn}>
                  <Feather name="clipboard" size={13} color="#6366F1" />
                  <Text style={styles.pasteBtnText}>Paste from Clipboard</Text>
                </Pressable>
              </View>

              <TextInput
                value={rawText}
                onChangeText={handleTextChange}
                placeholder="e.g. Paid Rs. 450 via PhonePe UPI to Swiggy on 19-Oct..."
                placeholderTextColor={palette.mutedForeground}
                multiline
                numberOfLines={3}
                style={styles.textArea}
              />

              {rawText.length > 0 && (
                <Pressable
                  onPress={() => handleTextChange('')}
                  style={styles.clearBtn}
                  hitSlop={6}
                >
                  <Text style={styles.clearBtnText}>Clear text</Text>
                </Pressable>
              )}
            </View>

            {/* QUICK SAMPLES */}
            {parsedList.length === 0 && (
              <View style={styles.samplesBox}>
                <Text style={styles.samplesLabel}>TEST WITH A SAMPLE SMS:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.samplesScroll}>
                  {SAMPLE_SMS.map((sample, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => handleLoadSample(sample)}
                      style={styles.sampleChip}
                    >
                      <Feather name="message-square" size={12} color="#6366F1" />
                      <Text style={styles.sampleChipText} numberOfLines={1}>
                        Sample {idx + 1}: {sample.slice(0, 24)}...
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* PARSED PREVIEW LIST */}
            {parsedList.length > 0 && (
              <View style={styles.previewSection}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewTitle}>
                    DETECTED TRANSACTIONS ({parsedList.length})
                  </Text>
                  <Text style={styles.previewSubtitle}>
                    {selectedIds.size} selected for import
                  </Text>
                </View>

                {parsedList.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => toggleSelect(item.id)}
                      style={[styles.parsedCard, isSelected && styles.parsedCardSelected]}
                    >
                      <View style={styles.cardTopRow}>
                        <View style={styles.cardMain}>
                          <View style={styles.checkCircle}>
                            <Feather
                              name={isSelected ? 'check-circle' : 'circle'}
                              size={18}
                              color={isSelected ? palette.primary : palette.mutedForeground}
                            />
                          </View>
                          <View>
                            <Text style={styles.merchantName}>{item.merchant}</Text>
                            <View style={styles.badgeRow}>
                              <View
                                style={[
                                  styles.dirBadge,
                                  item.direction === 'received' && styles.dirBadgeReceived,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.dirBadgeText,
                                    item.direction === 'received' && styles.dirBadgeTextReceived,
                                  ]}
                                >
                                  {item.direction === 'received' ? 'Inflow (+)' : 'Outflow (−)'}
                                </Text>
                              </View>

                              {item.sourceApp ? (
                                <View style={styles.sourceBadge}>
                                  <Text style={styles.sourceBadgeText}>{item.sourceApp}</Text>
                                </View>
                              ) : null}

                              {item.person ? (
                                <View style={styles.personBadge}>
                                  <Text style={styles.personBadgeText}>👤 {item.person}</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.cardAmount,
                            item.direction === 'received' && styles.cardAmountReceived,
                          ]}
                        >
                          {item.direction === 'received' ? '+' : '−'}
                          {currency(item.amount)}
                        </Text>
                      </View>

                      {/* CATEGORY SELECTOR CHIPS */}
                      <View style={styles.catChipsRow}>
                        <Text style={styles.catLabel}>Category:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {categories.slice(0, 6).map((c) => {
                              const active = item.category === c.key;
                              return (
                                <Pressable
                                  key={c.key}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleUpdateCategory(item.id, c.key);
                                  }}
                                  style={[
                                    styles.catChip,
                                    active && { backgroundColor: c.color, borderColor: c.color },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.catChipText,
                                      active && styles.catChipTextActive,
                                    ]}
                                  >
                                    {c.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </ScrollView>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* ACTION BUTTON */}
            {parsedList.length > 0 && (
              <Pressable
                onPress={() => void handleImport()}
                disabled={isProcessing || selectedIds.size === 0}
                style={({ pressed }) => [
                  styles.importBtn,
                  selectedIds.size === 0 && styles.importBtnDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Feather name="check" size={18} color="#FFF" />
                <Text style={styles.importBtnText}>
                  {isProcessing
                    ? 'Importing...'
                    : `Import ${selectedIds.size} Transaction${selectedIds.size > 1 ? 's' : ''} to Ledger`}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(25, 51, 47, 0.45)',
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    flex: 1,
  },
  sheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    backgroundColor: palette.muted,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.muted,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.foreground,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingVertical: 16,
    gap: 16,
  },
  description: {
    fontSize: 13,
    color: palette.mutedForeground,
    lineHeight: 18,
  },
  inputCard: {
    backgroundColor: palette.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.mutedForeground,
    letterSpacing: 0.6,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pasteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366F1',
  },
  textArea: {
    fontSize: 14,
    color: palette.foreground,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  clearBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  clearBtnText: {
    fontSize: 12,
    color: palette.destructive,
    fontWeight: '500',
  },
  samplesBox: {
    marginTop: 4,
    gap: 8,
  },
  samplesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.mutedForeground,
    letterSpacing: 0.6,
  },
  samplesScroll: {
    flexDirection: 'row',
  },
  sampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  sampleChipText: {
    fontSize: 12,
    color: palette.foreground,
    maxWidth: 180,
  },
  previewSection: {
    gap: 10,
    marginTop: 6,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.foreground,
    letterSpacing: 0.6,
  },
  previewSubtitle: {
    fontSize: 12,
    color: palette.mutedForeground,
  },
  parsedCard: {
    backgroundColor: palette.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: palette.border,
    gap: 10,
  },
  parsedCardSelected: {
    borderColor: palette.primary,
    backgroundColor: '#FFFBF9',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  checkCircle: {
    marginTop: 2,
  },
  merchantName: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.foreground,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  dirBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dirBadgeReceived: {
    backgroundColor: '#DCFCE7',
  },
  dirBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B91C1C',
  },
  dirBadgeTextReceived: {
    color: '#15803D',
  },
  sourceBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
  },
  personBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  personBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B45309',
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.foreground,
  },
  cardAmountReceived: {
    color: '#10B981',
  },
  catChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.muted,
    paddingTop: 8,
  },
  catLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.mutedForeground,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: palette.foreground,
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  importBtn: {
    backgroundColor: palette.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 10,
  },
  importBtnDisabled: {
    opacity: 0.5,
  },
  importBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.85,
  },
});
