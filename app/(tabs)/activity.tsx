import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import { CategoryItem, Expense, useExpenses } from '@/context/ExpenseContext';
import { EditExpenseModal } from '@/components/EditExpenseModal';
import { SmartSmsModal } from '@/components/SmartSmsModal';

const palette = colors.light;
const currency = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ExpenseItem({
  expense,
  onEdit,
  onDelete,
  onSelectEvent,
  getCategoryInfo,
}: {
  expense: Expense;
  onEdit: () => void;
  onDelete: () => void;
  onSelectEvent: (event: string) => void;
  getCategoryInfo: (cat: string) => CategoryItem;
}) {
  const category = getCategoryInfo(expense.category);

  const remove = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete ${expense.note || expense.category} (${currency(expense.amount)})?`)) {
        onDelete();
      }
      return;
    }
    Alert.alert('Delete expense?', `Remove ${expense.note || expense.category} (${currency(expense.amount)}) from your ledger?`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <Pressable
      testID={`expense-${expense.id}`}
      onPress={onEdit}
      onLongPress={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).then(remove)}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <View style={[styles.icon, { backgroundColor: `${category.color}1C` }]}>
        <Feather
          name={(category.icon as keyof typeof Feather.glyphMap) || 'tag'}
          size={18}
          color={category.color}
        />
      </View>

      <View style={styles.itemMain}>
        <Text style={styles.note} numberOfLines={1}>
          {expense.note || (expense.direction === 'received' ? 'Money received' : expense.category)}
        </Text>
        <View style={styles.badgeRow}>
          <Text style={styles.meta}>
            {expense.person ? `${expense.person} · ` : ''}
            {expense.direction === 'received' ? 'Received' : expense.category} · {formatDate(expense.date)}
          </Text>

          <View style={[styles.contextBadge, expense.subContext === 'Developer' && styles.contextBadgeDev]}>
            <Text style={[styles.contextBadgeText, expense.subContext === 'Developer' && styles.contextBadgeTextDev]}>
              {expense.subContext}
            </Text>
          </View>

          {expense.eventTag ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onSelectEvent(expense.eventTag);
              }}
              hitSlop={6}
              style={styles.eventBadge}
            >
              <Text style={styles.eventBadgeText}>#{expense.eventTag}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.amountWrap}>
        <Text style={[styles.amount, expense.direction === 'received' && styles.receivedAmount]}>
          {expense.direction === 'received' ? '+' : '−'}{currency(expense.amount)}
        </Text>
      </View>

      {/* QUICK ACTIONS ON ROW */}
      <View style={styles.rowActions}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          hitSlop={8}
          style={styles.actionBtn}
        >
          <Feather name="edit-2" size={14} color={palette.mutedForeground} />
        </Pressable>
        <Pressable
          testID={`delete-${expense.id}`}
          onPress={(e) => {
            e.stopPropagation();
            remove();
          }}
          hitSlop={8}
          style={styles.actionBtn}
        >
          <Feather name="trash-2" size={14} color={palette.destructive} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { expenses, subContexts, loading, reload, deleteExpense, getCategoryInfo } = useExpenses();
  const [filterContext, setFilterContext] = useState<string>('All');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showSmsModal, setShowSmsModal] = useState<boolean>(false);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      if (filterContext !== 'All' && item.subContext !== filterContext) return false;
      if (selectedEvent && item.eventTag.trim().toLowerCase() !== selectedEvent.trim().toLowerCase()) return false;
      return true;
    });
  }, [expenses, filterContext, selectedEvent]);

  const total = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);

  const allContextKeys = useMemo(() => {
    return ['All', ...subContexts.map((s) => s.key)];
  }, [subContexts]);

  const existingEvents = useMemo(() => {
    return Array.from(new Set(expenses.map((e) => e.eventTag.trim()).filter(Boolean)));
  }, [expenses]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ExpenseItem
            expense={item}
            onEdit={() => setEditingExpense(item)}
            onDelete={() => void deleteExpense(item.id)}
            onSelectEvent={(tag) => setSelectedEvent(tag)}
            getCategoryInfo={getCategoryInfo}
          />
        )}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 24) + 84 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={filteredExpenses.length > 0}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={palette.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View>
                <Text style={styles.kicker}>YOUR LEDGER</Text>
                <Text style={styles.title}>All activity</Text>
              </View>
              <Pressable
                onPress={() => setShowSmsModal(true)}
                style={({ pressed }) => [styles.headerSmsBtn, pressed && styles.pressed]}
              >
                <Feather name="zap" size={13} color="#6366F1" />
                <Text style={styles.headerSmsText}>SMS Import</Text>
              </Pressable>
            </View>

            {/* SUMMARY CARD */}
            <View style={styles.summary}>
              <View>
                <Text style={styles.summaryLabel}>
                  {selectedEvent
                    ? `TOTAL FOR #${selectedEvent.toUpperCase()}`
                    : filterContext !== 'All'
                    ? `TOTAL FOR ${filterContext.toUpperCase()}`
                    : 'TOTAL TRACKED'}
                </Text>
                <Text style={styles.summaryAmount}>{currency(total)}</Text>
              </View>
              <View style={styles.summaryIcon}>
                <Feather name="archive" size={20} color={palette.primaryForeground} />
              </View>
            </View>

            {/* FILTER PILLS */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
              <View style={styles.filterPills}>
                {allContextKeys.map((ctx) => {
                  const active = filterContext === ctx;
                  return (
                    <Pressable
                      key={ctx}
                      onPress={() => setFilterContext(ctx)}
                      style={[styles.filterPill, active && styles.filterPillActive]}
                    >
                      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                        {ctx}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* ACTIVE EVENT TAG CHIP */}
            {selectedEvent && (
              <View style={styles.activeEventFilterRow}>
                <Text style={styles.activeEventFilterLabel}>Event filter:</Text>
                <View style={styles.activeEventTagChip}>
                  <Text style={styles.activeEventTagText}>#{selectedEvent}</Text>
                  <Pressable onPress={() => setSelectedEvent(null)} hitSlop={6} style={styles.activeEventTagClose}>
                    <Feather name="x" size={13} color="#4F46E5" />
                  </Pressable>
                </View>
              </View>
            )}

            {filteredExpenses.length > 0 ? (
              <View style={styles.hintRow}>
                <Text style={styles.hint}>Amounts in coral are money received · Tap any entry to edit</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Feather name="inbox" size={24} color={palette.primary} /></View>
            <Text style={styles.emptyTitle}>
              {selectedEvent || filterContext !== 'All' ? 'No matching expenses' : 'Your ledger is clear'}
            </Text>
            <Text style={styles.emptyText}>
              {selectedEvent || filterContext !== 'All'
                ? 'Try changing or clearing your filters above.'
                : 'Expenses you add from Home will land here, ready to review.'}
            </Text>
          </View>
        }
      />

      {/* EDIT MODAL */}
      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          visible={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          existingEvents={existingEvents}
        />
      )}

      {/* SMART SMS MODAL */}
      <SmartSmsModal visible={showSmsModal} onClose={() => setShowSmsModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: 20 },
  header: { marginBottom: 18 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerSmsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    marginTop: 4,
  },
  headerSmsText: {
    color: '#6366F1',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  pressed: { opacity: 0.78 },
  kicker: { color: palette.primary, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.4 },
  title: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -0.8, marginTop: 5 },
  summary: { backgroundColor: palette.foreground, borderRadius: 22, padding: 20, marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: '#94B1A5', fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.1 },
  summaryAmount: { color: '#FFFDF8', fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -1, marginTop: 7 },
  summaryIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  filterPills: { flexDirection: 'row', gap: 7, marginTop: 4 },
  filterPill: { paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.card, borderWidth: 1, borderColor: '#ECE8DE' },
  filterPillActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  filterPillText: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  filterPillTextActive: { color: palette.primaryForeground },
  activeEventFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: '#EEF0FD', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  activeEventFilterLabel: { color: '#4F46E5', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  activeEventTagChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#C7D2FE' },
  activeEventTagText: { color: '#4F46E5', fontFamily: 'Inter_700Bold', fontSize: 12 },
  activeEventTagClose: { padding: 2 },
  hintRow: { marginTop: 12 },
  hint: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 },
  item: { backgroundColor: palette.card, borderRadius: 18, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ECE8DE' },
  itemPressed: { opacity: 0.78 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  itemMain: { flex: 1, minWidth: 0 },
  note: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  meta: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 },
  contextBadge: { backgroundColor: '#ECE8DE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  contextBadgeDev: { backgroundColor: '#ECEEFE' },
  contextBadgeText: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  contextBadgeTextDev: { color: '#6366F1' },
  eventBadge: { backgroundColor: '#EBF6F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  eventBadgeText: { color: '#1B6A4B', fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  amountWrap: { alignItems: 'flex-end', marginLeft: 8, marginRight: 6 },
  amount: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  receivedAmount: { color: palette.primary },
  rowActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F8F6F0', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 55 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#F9DED7', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 16 },
  emptyText: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
});