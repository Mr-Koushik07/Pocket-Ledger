import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import { useExpenses } from '@/context/ExpenseContext';
import {
  formatCurrency,
  generateMonthlyReportHtml,
} from '@/services/pdfReport';

const palette = colors.light;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { expenses, getCategoryInfo } = useExpenses();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [userName, setUserName] = useState<string>('');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Month navigation helpers
  const prevMonth = () => {
    void Haptics.selectionAsync();
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    void Haptics.selectionAsync();
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const isCurrentMonth =
    selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const goToCurrentMonth = () => {
    void Haptics.selectionAsync();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
  };

  // Filter transactions for selected month
  const monthlyExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const d = new Date(exp.date);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [expenses, selectedYear, selectedMonth]);

  // Aggregate metrics
  const spentItems = monthlyExpenses.filter((e) => e.direction !== 'received');
  const receivedItems = monthlyExpenses.filter((e) => e.direction === 'received');

  const totalSpent = spentItems.reduce((acc, e) => acc + e.amount, 0);
  const totalReceived = receivedItems.reduce((acc, e) => acc + e.amount, 0);
  const netCashflow = totalReceived - totalSpent;

  // Category breakdown for preview
  const categorySummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of spentItems) {
      map.set(item.category, (map.get(item.category) || 0) + item.amount);
    }
    return Array.from(map.entries())
      .map(([catKey, amount]) => {
        const info = getCategoryInfo(catKey);
        const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
        return { key: catKey, label: info.label, color: info.color, amount, pct };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [spentItems, totalSpent, getCategoryInfo]);

  // Build statement metadata
  const statementId = useMemo(() => {
    const monthPad = String(selectedMonth + 1).padStart(2, '0');
    return `PL-${selectedYear}${monthPad}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  }, [selectedYear, selectedMonth]);

  // Generate & Download / Share PDF
  const handleExportPdf = async () => {
    try {
      setIsGenerating(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const html = generateMonthlyReportHtml({
        year: selectedYear,
        month: selectedMonth,
        monthName: MONTH_NAMES[selectedMonth],
        expenses: monthlyExpenses,
        getCategoryInfo,
        statementId,
        generatedAt: new Date().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        userName: userName.trim() || undefined,
      });

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        setIsGenerating(false);
        return;
      }

      // Generate local PDF file
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      setIsGenerating(false);

      // Trigger native share/download sheet
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Pocket-Ledger-${MONTH_NAMES[selectedMonth]}-${selectedYear}.pdf`,
        });
      } else {
        Alert.alert('PDF Generated', `Report saved to: ${uri}`);
      }
    } catch (err: any) {
      setIsGenerating(false);
      Alert.alert('Export Failed', err?.message || 'Could not generate PDF report.');
    }
  };

  // Direct Print Preview
  const handleDirectPrint = async () => {
    try {
      void Haptics.selectionAsync();
      const html = generateMonthlyReportHtml({
        year: selectedYear,
        month: selectedMonth,
        monthName: MONTH_NAMES[selectedMonth],
        expenses: monthlyExpenses,
        getCategoryInfo,
        statementId,
        generatedAt: new Date().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        userName: userName.trim() || undefined,
      });
      await Print.printAsync({ html });
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Could not open print dialog.');
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 24) + 90,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>FINANCIAL STATEMENTS</Text>
            <Text style={styles.title}>Monthly reports</Text>
          </View>
          <Pressable
            onPress={() => setShowConfigModal(true)}
            style={styles.configBtn}
            hitSlop={8}
          >
            <Feather name="settings" size={18} color={palette.foreground} />
          </Pressable>
        </View>

        {/* MONTH NAVIGATOR */}
        <View style={styles.monthNavCard}>
          <Pressable onPress={prevMonth} style={styles.navArrow} hitSlop={12}>
            <Feather name="chevron-left" size={20} color={palette.foreground} />
          </Pressable>

          <View style={styles.monthCenter}>
            <Text style={styles.monthNameText}>
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </Text>
            <Text style={styles.monthSubText}>
              {monthlyExpenses.length} transactions recorded
            </Text>
          </View>

          <Pressable onPress={nextMonth} style={styles.navArrow} hitSlop={12}>
            <Feather name="chevron-right" size={20} color={palette.foreground} />
          </Pressable>
        </View>

        {!isCurrentMonth && (
          <Pressable onPress={goToCurrentMonth} style={styles.currentMonthBanner}>
            <Feather name="rotate-ccw" size={13} color="#6366F1" />
            <Text style={styles.currentMonthText}>Return to current month</Text>
          </Pressable>
        )}

        {/* PREPARED FOR TAG (IF CONFIGURED) */}
        {userName.trim().length > 0 && (
          <View style={styles.preparedForBadge}>
            <Feather name="user-check" size={13} color="#059669" />
            <Text style={styles.preparedForText}>
              Statement customized for: <Text style={{ fontWeight: '700' }}>{userName.trim()}</Text>
            </Text>
          </View>
        )}

        {/* EXECUTIVE SUMMARY CARDS */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.cardLabel}>TOTAL OUTFLOW</Text>
            <Text style={[styles.cardValue, { color: '#E11D48' }]}>
              −{formatCurrency(totalSpent)}
            </Text>
            <Text style={styles.cardSub}>{spentItems.length} expenses</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.cardLabel}>TOTAL INFLOW</Text>
            <Text style={[styles.cardValue, { color: '#059669' }]}>
              +{formatCurrency(totalReceived)}
            </Text>
            <Text style={styles.cardSub}>{receivedItems.length} receipts</Text>
          </View>
        </View>

        <View style={styles.netCard}>
          <View>
            <Text style={styles.cardLabel}>MONTHLY NET CASHFLOW</Text>
            <Text
              style={[
                styles.netValue,
                netCashflow >= 0 ? { color: '#059669' } : { color: '#E11D48' },
              ]}
            >
              {netCashflow >= 0 ? '+' : '−'}
              {formatCurrency(Math.abs(netCashflow))}
            </Text>
          </View>
          <View style={styles.verifiedTag}>
            <Feather name="shield" size={14} color="#059669" />
            <Text style={styles.verifiedText}>Audit Grounded</Text>
          </View>
        </View>

        {/* ACTIONS */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleExportPdf}
            disabled={isGenerating}
            style={({ pressed }) => [
              styles.primaryExportBtn,
              pressed && styles.btnPressed,
              isGenerating && { opacity: 0.7 },
            ]}
          >
            {isGenerating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="download" size={18} color="#FFFFFF" />
                <Text style={styles.exportBtnText}>Download PDF Statement</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleDirectPrint}
            style={({ pressed }) => [styles.secondaryPrintBtn, pressed && styles.btnPressed]}
          >
            <Feather name="printer" size={17} color={palette.foreground} />
          </Pressable>
        </View>

        {/* CATEGORY VISUAL DISTRIBUTION PREVIEW */}
        {categorySummary.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>CATEGORY BREAKDOWN</Text>
              <Text style={styles.sectionSub}>Included in PDF visualization</Text>
            </View>
            <View style={styles.categoryCardList}>
              {categorySummary.map((cat) => (
                <View key={cat.key} style={styles.categoryPreviewRow}>
                  <View style={styles.catMeta}>
                    <View style={[styles.catColorDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.catLabel}>{cat.label}</Text>
                  </View>
                  <View style={styles.catAmountWrap}>
                    <Text style={styles.catAmount}>{formatCurrency(cat.amount)}</Text>
                    <Text style={styles.catPct}>{cat.pct.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.barBackground}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${cat.pct}%`, backgroundColor: cat.color },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* RECENT MONTH TRANSACTIONS PREVIEW */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              GROUNDED TRANSACTIONS ({monthlyExpenses.length})
            </Text>
            <Text style={styles.sectionSub}>Full ledger is attached to PDF</Text>
          </View>

          {monthlyExpenses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="inbox" size={32} color={palette.mutedForeground} />
              <Text style={styles.emptyTitle}>No records in this month</Text>
              <Text style={styles.emptySub}>
                There are no entries logged for {MONTH_NAMES[selectedMonth]} {selectedYear}.
                Use the arrows above to select another month.
              </Text>
            </View>
          ) : (
            <View style={styles.previewLedgerList}>
              {monthlyExpenses.slice(0, 5).map((item, idx) => {
                const cat = getCategoryInfo(item.category);
                const isRec = item.direction === 'received';
                return (
                  <View key={item.id} style={styles.ledgerRowPreview}>
                    <View style={styles.ledgerLeft}>
                      <Text style={styles.ledgerIndex}>#{idx + 1}</Text>
                      <View>
                        <Text style={styles.ledgerNote} numberOfLines={1}>
                          {item.note || item.category}
                        </Text>
                        <Text style={styles.ledgerMeta}>
                          {new Date(item.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}{' '}
                          &bull; {cat.label} &bull; {item.subContext}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.ledgerAmount,
                        isRec ? { color: '#059669' } : { color: '#0F172A' },
                      ]}
                    >
                      {isRec ? '+' : '−'}
                      {formatCurrency(item.amount)}
                    </Text>
                  </View>
                );
              })}
              {monthlyExpenses.length > 5 && (
                <View style={styles.moreRowsNotice}>
                  <Text style={styles.moreRowsText}>
                    + {monthlyExpenses.length - 5} more entries attached in PDF audit table
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* CUSTOMIZE MODAL */}
      <Modal
        visible={showConfigModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfigModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowConfigModal(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Statement settings</Text>
              <Pressable
                onPress={() => setShowConfigModal(false)}
                hitSlop={8}
              >
                <Feather name="x" size={18} color={palette.foreground} />
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>PREPARED FOR (OPTIONAL)</Text>
            <TextInput
              value={userName}
              onChangeText={setUserName}
              placeholder="e.g. Navaneeth, DJ Studios, Personal"
              placeholderTextColor={palette.mutedForeground}
              style={styles.modalInput}
              autoCapitalize="words"
            />
            <Text style={styles.modalHint}>
              This name will be displayed on the top header of the downloaded PDF statement.
            </Text>

            <Pressable
              onPress={() => setShowConfigModal(false)}
              style={styles.modalDoneBtn}
            >
              <Text style={styles.modalDoneText}>Save</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: palette.mutedForeground,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.foreground,
    letterSpacing: -0.5,
  },
  configBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenter: {
    alignItems: 'center',
  },
  monthNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.foreground,
    letterSpacing: -0.3,
  },
  monthSubText: {
    fontSize: 12,
    color: palette.mutedForeground,
    fontWeight: '500',
    marginTop: 2,
  },
  currentMonthBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
  },
  currentMonthText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
  preparedForBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  preparedForText: {
    fontSize: 12,
    color: '#065F46',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 14,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.mutedForeground,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginVertical: 4,
  },
  cardSub: {
    fontSize: 11,
    color: palette.mutedForeground,
    fontWeight: '500',
  },
  netCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  netValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  primaryExportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 15,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryPrintBtn: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: palette.mutedForeground,
    textTransform: 'uppercase',
  },
  sectionSub: {
    fontSize: 11,
    color: palette.mutedForeground,
  },
  categoryCardList: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  categoryPreviewRow: {
    flexDirection: 'column',
    gap: 5,
  },
  catMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.foreground,
  },
  catAmountWrap: {
    position: 'absolute',
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.foreground,
  },
  catPct: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.mutedForeground,
  },
  barBackground: {
    height: 6,
    backgroundColor: palette.muted,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  previewLedgerList: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  ledgerRowPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  ledgerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  ledgerIndex: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.mutedForeground,
    width: 24,
  },
  ledgerNote: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.foreground,
    maxWidth: 180,
  },
  ledgerMeta: {
    fontSize: 11,
    color: palette.mutedForeground,
    marginTop: 2,
  },
  ledgerAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  moreRowsNotice: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: palette.muted,
  },
  moreRowsText: {
    fontSize: 11,
    color: palette.mutedForeground,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.foreground,
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    color: palette.mutedForeground,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.foreground,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: palette.mutedForeground,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: palette.foreground,
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 11,
    color: palette.mutedForeground,
    marginBottom: 20,
    lineHeight: 16,
  },
  modalDoneBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalDoneText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
