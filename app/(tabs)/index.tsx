import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import {
  CategoryItem,
  DEFAULT_CATEGORIES,
  Expense,
  SubContextItem,
  useExpenses,
} from '@/context/ExpenseContext';
import { EditExpenseModal } from '@/components/EditExpenseModal';
import { SmartSmsModal } from '@/components/SmartSmsModal';
import colors from '@/constants/colors';

const palette = colors.light;
const currency = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const compactCurrency = (amount: number) =>
  amount >= 1000 ? `₹${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k` : currency(amount);

const PRESET_COLORS = [
  '#F06F58', '#7A8FE8', '#6366F1', '#E4A94F',
  '#A17BD8', '#56A887', '#E11D48', '#0EA5E9',
  '#D97706', '#10B981', '#8B5CF6', '#F59E0B',
];

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function DatePickerModal({
  visible,
  currentDate,
  onSelect,
  onClose,
}: {
  visible: boolean;
  currentDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const [viewDate, setViewDate] = useState(new Date(currentDate));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const monthName = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{monthName}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable onPress={prevMonth} style={styles.pickerNavBtn}>
                <Feather name="chevron-left" size={18} color={palette.foreground} />
              </Pressable>
              <Pressable onPress={nextMonth} style={styles.pickerNavBtn}>
                <Feather name="chevron-right" size={18} color={palette.foreground} />
              </Pressable>
            </View>
          </View>

          <View style={styles.weekdaysRow}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <Text key={d} style={styles.weekdayText}>{d}</Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected =
                currentDate.getFullYear() === year &&
                currentDate.getMonth() === month &&
                currentDate.getDate() === dayNum;
              const isTodayDate =
                new Date().getFullYear() === year &&
                new Date().getMonth() === month &&
                new Date().getDate() === dayNum;

              return (
                <Pressable
                  key={`day-${dayNum}`}
                  onPress={() => {
                    const picked = new Date(year, month, dayNum);
                    onSelect(picked);
                    onClose();
                  }}
                  style={[styles.dayCell, isSelected && styles.dayCellSelected, isTodayDate && !isSelected && styles.dayCellToday]}
                >
                  <Text style={[styles.dayCellText, isSelected && styles.dayCellTextSelected]}>
                    {dayNum}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AddCategoryModal({
  visible,
  onAdd,
  onClose,
}: {
  visible: boolean;
  onAdd: (cat: CategoryItem) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [error, setError] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a category name');
      return;
    }
    onAdd({
      key: trimmed,
      label: trimmed,
      icon: 'tag',
      color: selectedColor,
    });
    setName('');
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.pickerBackdrop}>
        <Pressable style={styles.customDialogCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetKicker}>CUSTOM CATEGORY</Text>
              <Text style={styles.customDialogTitle}>New category</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={18} color={palette.foreground} />
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>CATEGORY NAME</Text>
          <TextInput
            value={name}
            onChangeText={(t) => { setName(t); setError(''); }}
            placeholder="e.g. Gaming, Investments, Gifts"
            placeholderTextColor={palette.mutedForeground}
            style={styles.noteInput}
            autoFocus
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.fieldLabel}>CHOOSE COLOR</Text>
          <View style={styles.colorRow}>
            {PRESET_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setSelectedColor(c)}
                style={[styles.colorCircle, { backgroundColor: c }, selectedColor === c && styles.colorCircleSelected]}
              >
                {selectedColor === c && <Feather name="check" size={14} color="#FFF" />}
              </Pressable>
            ))}
          </View>

          <Pressable onPress={submit} style={styles.dialogSaveBtn}>
            <Text style={styles.saveButtonText}>Create category</Text>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddSubContextModal({
  visible,
  onAdd,
  onClose,
}: {
  visible: boolean;
  onAdd: (ctx: SubContextItem) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a context name');
      return;
    }
    onAdd({
      key: trimmed,
      label: trimmed,
      icon: 'folder',
    });
    setName('');
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.pickerBackdrop}>
        <Pressable style={styles.customDialogCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetKicker}>CUSTOM SPHERE</Text>
              <Text style={styles.customDialogTitle}>New context</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={18} color={palette.foreground} />
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>CONTEXT NAME</Text>
          <TextInput
            value={name}
            onChangeText={(t) => { setName(t); setError(''); }}
            placeholder="e.g. Freelance, College, Startup"
            placeholderTextColor={palette.mutedForeground}
            style={styles.noteInput}
            autoFocus
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable onPress={submit} style={styles.dialogSaveBtn}>
            <Text style={styles.saveButtonText}>Create context</Text>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DonutChart({
  total,
  grouped,
  getCatColor,
}: {
  total: number;
  grouped: { category: string; amount: number }[];
  getCatColor: (cat: string) => string;
}) {
  const size = Math.min(Dimensions.get('window').width - 48, 228);
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={styles.donutWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.muted}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {total > 0 &&
          grouped.map((item) => {
            const segment = (item.amount / total) * circumference;
            const color = getCatColor(item.category);
            const node = (
              <Circle
                key={item.category}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${segment} ${circumference - segment}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                rotation="-90"
                origin={`${size / 2}, ${size / 2}`}
              />
            );
            offset += segment;
            return node;
          })}
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutEyebrow}>THIS MONTH</Text>
        <Text style={styles.donutTotal}>{compactCurrency(total)}</Text>
      </View>
    </View>
  );
}

function AddExpenseModal({
  visible,
  onClose,
  existingEvents = [],
}: {
  visible: boolean;
  onClose: () => void;
  existingEvents?: string[];
}) {
  const insets = useSafeAreaInsets();
  const { addExpense, categories, subContexts, addCategory, addSubContext } = useExpenses();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('Food');
  const [direction, setDirection] = useState<'spent' | 'received'>('spent');
  const [person, setPerson] = useState('');
  const [subContext, setSubContext] = useState<string>('Personal');
  const [eventTag, setEventTag] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [showAddCtxModal, setShowAddCtxModal] = useState(false);
  const [error, setError] = useState('');

  const isCurrentDay = isSameDay(selectedDate, new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterdayDay = isSameDay(selectedDate, yesterday);

  const save = async () => {
    const numericAmount = Number(amount.replace(',', '.'));
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter an amount greater than zero');
      return;
    }
    await addExpense({
      amount: numericAmount,
      note: note || (direction === 'spent' ? 'Expense' : 'Money received'),
      category,
      direction,
      person,
      subContext,
      eventTag,
      date: selectedDate.toISOString(),
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAmount('');
    setNote('');
    setCategory('Food');
    setDirection('spent');
    setPerson('');
    setSubContext('Personal');
    setEventTag('');
    setSelectedDate(new Date());
    setError('');
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismiss} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetKicker}>NEW ENTRY</Text>
              <Text style={styles.sheetTitle}>Add expense</Text>
            </View>
            <Pressable testID="close-expense" onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={20} color={palette.foreground} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetScroll}>
            {/* AMOUNT */}
            <Text style={styles.fieldLabel}>AMOUNT</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                testID="expense-amount"
                autoFocus
                value={amount}
                onChangeText={(value) => {
                  setAmount(value.replace(/[^0-9.,]/g, ''));
                  setError('');
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={palette.mutedForeground}
                style={styles.amountInput}
              />
            </View>

            {/* DATE SELECTOR */}
            <Text style={styles.fieldLabel}>DATE</Text>
            <View style={styles.dateRow}>
              <Pressable
                onPress={() => setSelectedDate(new Date())}
                style={[styles.dateChip, isCurrentDay && styles.dateChipSelected]}
              >
                <Feather name="calendar" size={13} color={isCurrentDay ? palette.primaryForeground : palette.foreground} />
                <Text style={[styles.dateChipText, isCurrentDay && styles.dateChipTextSelected]}>Today</Text>
              </Pressable>

              <Pressable
                onPress={() => setSelectedDate(yesterday)}
                style={[styles.dateChip, isYesterdayDay && styles.dateChipSelected]}
              >
                <Text style={[styles.dateChipText, isYesterdayDay && styles.dateChipTextSelected]}>Yesterday</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={[styles.dateChip, !isCurrentDay && !isYesterdayDay && styles.dateChipSelected]}
              >
                <Feather
                  name="edit-3"
                  size={13}
                  color={!isCurrentDay && !isYesterdayDay ? palette.primaryForeground : palette.foreground}
                />
                <Text style={[styles.dateChipText, !isCurrentDay && !isYesterdayDay && styles.dateChipTextSelected]}>
                  {!isCurrentDay && !isYesterdayDay
                    ? selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Pick Date'}
                </Text>
              </Pressable>
            </View>

            {/* TRANSACTION TYPE */}
            <Text style={styles.fieldLabel}>TRANSACTION TYPE</Text>
            <View style={styles.flowToggle}>
              <Pressable testID="direction-spent" onPress={() => setDirection('spent')} style={[styles.flowOption, direction === 'spent' && styles.flowOptionSelected]}>
                <Feather name="arrow-up-right" size={16} color={direction === 'spent' ? palette.primaryForeground : palette.primary} />
                <Text style={[styles.flowText, direction === 'spent' && styles.flowTextSelected]}>I paid</Text>
              </Pressable>
              <Pressable testID="direction-received" onPress={() => setDirection('received')} style={[styles.flowOption, direction === 'received' && styles.flowOptionSelected]}>
                <Feather name="arrow-down-left" size={16} color={direction === 'received' ? palette.primaryForeground : palette.primary} />
                <Text style={[styles.flowText, direction === 'received' && styles.flowTextSelected]}>I received</Text>
              </Pressable>
            </View>

            {/* CONTEXT SPHERE */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.fieldLabel}>CONTEXT SPHERE</Text>
              <Pressable onPress={() => setShowAddCtxModal(true)} style={styles.addNewLabelBtn}>
                <Feather name="plus" size={12} color="#6366F1" />
                <Text style={styles.addNewLabelText}>Add Context</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.contextToggle}>
                {subContexts.map((item) => {
                  const selected = subContext === item.key;
                  return (
                    <Pressable
                      testID={`context-${item.key}`}
                      key={item.key}
                      onPress={() => setSubContext(item.key)}
                      style={[styles.contextOption, selected && styles.contextOptionSelected]}
                    >
                      <Feather
                        name={(item.icon as keyof typeof Feather.glyphMap) || 'folder'}
                        size={13}
                        color={selected ? palette.primaryForeground : palette.foreground}
                      />
                      <Text style={[styles.contextText, selected && styles.contextTextSelected]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* EVENT TAG (SHOWN FOR DEVELOPER OR WHEN ENTERED) */}
            {(subContext === 'Developer' || eventTag.length > 0) && (
              <View style={styles.eventInputBox}>
                <View style={styles.eventInputHeader}>
                  <Feather name="calendar" size={13} color="#6366F1" />
                  <Text style={styles.eventFieldLabel}>EVENT / TRIP NAME <Text style={styles.optional}>OPTIONAL</Text></Text>
                </View>
                <TextInput
                  testID="expense-event-tag"
                  value={eventTag}
                  onChangeText={setEventTag}
                  placeholder="e.g. DevFest, Hackathon 2026"
                  placeholderTextColor={palette.mutedForeground}
                  style={styles.noteInput}
                  autoCapitalize="words"
                />
                {existingEvents.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagChipsScroll} contentContainerStyle={styles.tagChipsContent}>
                    {existingEvents.map((tag) => (
                      <Pressable
                        key={tag}
                        onPress={() => setEventTag(tag)}
                        style={[styles.tagChip, eventTag === tag && styles.tagChipSelected]}
                      >
                        <Text style={[styles.tagChipText, eventTag === tag && styles.tagChipTextSelected]}>
                          #{tag}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            )}

            {/* CATEGORY */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <Pressable onPress={() => setShowAddCatModal(true)} style={styles.addNewLabelBtn}>
                <Feather name="plus" size={12} color="#6366F1" />
                <Text style={styles.addNewLabelText}>Add Category</Text>
              </Pressable>
            </View>
            <View style={styles.categoryGrid}>
              {categories.map((item) => {
                const selected = category === item.key;
                return (
                  <Pressable
                    testID={`category-${item.key}`}
                    key={item.key}
                    onPress={() => setCategory(item.key)}
                    style={[styles.categoryOption, selected && { backgroundColor: item.color }]}
                  >
                    <Feather
                      name={(item.icon as keyof typeof Feather.glyphMap) || 'tag'}
                      size={15}
                      color={selected ? '#FFFDF8' : item.color}
                    />
                    <Text style={[styles.categoryOptionText, selected && styles.categoryOptionTextSelected]}>{item.label}</Text>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => setShowAddCatModal(true)} style={styles.categoryAddOption}>
                <Feather name="plus" size={14} color={palette.primary} />
                <Text style={styles.categoryAddText}>New</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>PERSON <Text style={styles.optional}>OPTIONAL</Text></Text>
            <TextInput
              testID="expense-person"
              value={person}
              onChangeText={setPerson}
              placeholder="e.g. Rahul"
              placeholderTextColor={palette.mutedForeground}
              style={styles.noteInput}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>NOTE <Text style={styles.optional}>OPTIONAL</Text></Text>
            <TextInput
              testID="expense-note"
              value={note}
              onChangeText={setNote}
              placeholder="What was this for?"
              placeholderTextColor={palette.mutedForeground}
              style={styles.noteInput}
              returnKeyType="done"
              onSubmitEditing={() => void save()}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Pressable testID="save-expense" onPress={() => void save()} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
              <Feather name="plus" size={19} color={palette.primaryForeground} />
              <Text style={styles.saveButtonText}>{direction === 'spent' ? 'Save expense' : 'Save transaction'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* SUB-MODALS */}
      <DatePickerModal
        visible={showDatePicker}
        currentDate={selectedDate}
        onSelect={(d) => setSelectedDate(d)}
        onClose={() => setShowDatePicker(false)}
      />
      <AddCategoryModal
        visible={showAddCatModal}
        onAdd={(newCat) => {
          void addCategory(newCat);
          setCategory(newCat.key);
        }}
        onClose={() => setShowAddCatModal(false)}
      />
      <AddSubContextModal
        visible={showAddCtxModal}
        onAdd={(newCtx) => {
          void addSubContext(newCtx);
          setSubContext(newCtx.key);
        }}
        onClose={() => setShowAddCtxModal(false)}
      />
    </Modal>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { expenses, loading, getCategoryInfo } = useExpenses();
  const [modalVisible, setModalVisible] = useState(false);
  const [smsModalVisible, setSmsModalVisible] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthExpenses = expenses.filter((expense) => {
    const date = new Date(expense.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });
  const monthSpent = monthExpenses.filter((expense) => expense.direction === 'spent');
  const total = monthSpent.reduce((sum, expense) => sum + expense.amount, 0);
  const todayTotal = monthSpent
    .filter((expense) => new Date(expense.date).toDateString() === new Date().toDateString())
    .reduce((sum, expense) => sum + expense.amount, 0);

  // Grouped by Category for Donut Chart
  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    monthSpent.forEach((expense) => map.set(expense.category, (map.get(expense.category) ?? 0) + expense.amount));
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthSpent]);

  // Sub-Context Breakdown by Category
  const categorySubBreakdown = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    monthSpent.forEach((expense) => {
      if (!map.has(expense.category)) {
        map.set(expense.category, new Map<string, number>());
      }
      const catMap = map.get(expense.category)!;
      catMap.set(expense.subContext, (catMap.get(expense.subContext) ?? 0) + expense.amount);
    });
    return map;
  }, [monthSpent]);

  // Developer & Events Aggregation
  const developerData = useMemo(() => {
    const devExpenses = monthSpent.filter(
      (e) => e.category === 'Developer' || e.subContext === 'Developer',
    );
    const devTotal = devExpenses.reduce((sum, e) => sum + e.amount, 0);

    const eventMap = new Map<string, { total: number; categories: Map<string, number> }>();
    let generalDevTotal = 0;

    devExpenses.forEach((e) => {
      const tag = e.eventTag.trim();
      if (tag) {
        if (!eventMap.has(tag)) {
          eventMap.set(tag, { total: 0, categories: new Map() });
        }
        const record = eventMap.get(tag)!;
        record.total += e.amount;
        record.categories.set(e.category, (record.categories.get(e.category) ?? 0) + e.amount);
      } else {
        generalDevTotal += e.amount;
      }
    });

    const eventsList = Array.from(eventMap.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      breakdown: Array.from(data.categories.entries()).map(([cat, amt]) => ({ category: cat, amount: amt })),
    }));

    return {
      devTotal,
      devCount: devExpenses.length,
      eventsList,
      generalDevTotal,
    };
  }, [monthSpent]);

  // Existing event tags across history for quick selection
  const existingEvents = useMemo(() => {
    return Array.from(new Set(expenses.map((e) => e.eventTag.trim()).filter(Boolean)));
  }, [expenses]);

  const recent = expenses.slice(0, 4);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 24) + 96 }]}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brand}>Pocket <Text style={styles.brandAccent}>Ledger</Text></Text>
            <Text style={styles.greeting}>Your money, in focus.</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Pressable
              onPress={() => setSmsModalVisible(true)}
              style={({ pressed }) => [styles.headerSmsBtn, pressed && styles.pressed]}
              hitSlop={6}
            >
              <Feather name="zap" size={16} color="#6366F1" />
              <Text style={styles.headerSmsText}>SMS</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/reports')}
              style={({ pressed }) => [styles.headerReportBtn, pressed && styles.pressed]}
              hitSlop={6}
            >
              <Feather name="file-text" size={19} color={palette.foreground} />
            </Pressable>
            <Pressable testID="add-expense-header" onPress={() => setModalVisible(true)} style={({ pressed }) => [styles.headerAdd, pressed && styles.pressed]}>
              <Feather name="plus" size={20} color={palette.primaryForeground} />
            </Pressable>
          </View>
        </View>

        {/* HERO CARD */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>SPENT THIS MONTH</Text>
            <View style={styles.monthPill}><Text style={styles.monthPillText}>{new Date().toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</Text></View>
          </View>
          {loading ? <ActivityIndicator color={palette.primaryForeground} /> : <Text style={styles.heroTotal}>{currency(total)}</Text>}
          <View style={styles.heroRule} />
          <View style={styles.heroMeta}>
            <View><Text style={styles.heroMetaLabel}>TODAY</Text><Text style={styles.heroMetaValue}>{currency(todayTotal)}</Text></View>
            <View style={styles.heroMetaDivider} />
            <View><Text style={styles.heroMetaLabel}>ENTRIES</Text><Text style={styles.heroMetaValue}>{monthExpenses.length}</Text></View>
            <View style={styles.heroSpark}><Feather name="trending-up" size={22} color={palette.primaryForeground} /><Text style={styles.sparkText}>STAY AWARE</Text></View>
          </View>
        </View>

        {/* SMART SMS BANNER */}
        <Pressable
          onPress={() => setSmsModalVisible(true)}
          style={({ pressed }) => [styles.smsBanner, pressed && styles.pressed]}
        >
          <View style={styles.smsBannerIcon}>
            <Feather name="zap" size={16} color="#6366F1" />
          </View>
          <View style={styles.smsBannerContent}>
            <Text style={styles.smsBannerTitle}>Smart SMS & UPI Auto-Parser</Text>
            <Text style={styles.smsBannerSubtitle}>Paste PhonePe or bank SMS to log in 1 tap</Text>
          </View>
          <Feather name="chevron-right" size={16} color={palette.mutedForeground} />
        </Pressable>

        {/* CATEGORY BREAKDOWN */}
        <View style={styles.sectionHeading}>
          <View><Text style={styles.sectionKicker}>YOUR BREAKDOWN</Text><Text style={styles.sectionTitle}>Where it goes</Text></View>
          <Text style={styles.sectionTotal}>{compactCurrency(total)}</Text>
        </View>
        <View style={styles.breakdownCard}>
          <DonutChart
            total={total}
            grouped={grouped}
            getCatColor={(cat) => getCategoryInfo(cat).color}
          />
          {grouped.length > 0 ? (
            <View style={styles.legend}>
              <Text style={styles.legendHelper}>Tap any category to see context split</Text>
              {grouped.map((item) => {
                const isExpanded = expandedCategory === item.category;
                const catMeta = getCategoryInfo(item.category);
                const subMap = categorySubBreakdown.get(item.category);
                return (
                  <View key={item.category} style={styles.categoryItemWrap}>
                    <Pressable
                      onPress={() => setExpandedCategory(isExpanded ? null : item.category)}
                      style={styles.legendRow}
                    >
                      <View style={[styles.legendDot, { backgroundColor: catMeta.color }]} />
                      <Text style={styles.legendLabel}>{item.category}</Text>
                      <Text style={styles.legendAmount}>{currency(item.amount)}</Text>
                      <Feather
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={palette.mutedForeground}
                        style={{ marginLeft: 6 }}
                      />
                    </Pressable>
                    {isExpanded && subMap && (
                      <View style={styles.subBreakdownBox}>
                        {Array.from(subMap.entries()).map(([ctx, amt]) => {
                          if (amt === 0) return null;
                          return (
                            <View key={ctx} style={styles.subBreakdownRow}>
                              <Text style={styles.subBreakdownLabel}>• {ctx}</Text>
                              <Text style={styles.subBreakdownAmt}>{currency(amt)}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Feather name="pie-chart" size={20} color={palette.primary} />
              <Text style={styles.emptyChartTitle}>Your story starts here</Text>
              <Text style={styles.emptyChartText}>Add an expense to see your spending shape up.</Text>
            </View>
          )}
        </View>

        {/* DEVELOPER & EVENTS SPOTLIGHT */}
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionKicker}>DEVELOPER & EVENTS</Text>
            <Text style={styles.sectionTitle}>Journey & Conferences</Text>
          </View>
          <Text style={styles.sectionTotal}>{compactCurrency(developerData.devTotal)}</Text>
        </View>

        {developerData.devTotal > 0 ? (
          <View style={styles.devCard}>
            <View style={styles.devHeader}>
              <View style={styles.devIconWrap}>
                <Feather name="terminal" size={20} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.devCardEyebrow}>DEVELOPER SPEND THIS MONTH</Text>
                <Text style={styles.devCardTotal}>{currency(developerData.devTotal)}</Text>
              </View>
              <View style={styles.devBadge}>
                <Text style={styles.devBadgeText}>{developerData.devCount} items</Text>
              </View>
            </View>

            {developerData.eventsList.map((event) => (
              <View key={event.name} style={styles.eventBox}>
                <View style={styles.eventBoxHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Feather name="calendar" size={14} color="#6366F1" />
                    <Text style={styles.eventBoxTitle}>#{event.name}</Text>
                  </View>
                  <Text style={styles.eventBoxTotal}>{currency(event.total)}</Text>
                </View>
                <View style={styles.eventPillsRow}>
                  {event.breakdown.map((b) => (
                    <View key={b.category} style={styles.eventPill}>
                      <Text style={styles.eventPillCategory}>{b.category}:</Text>
                      <Text style={styles.eventPillAmount}>{currency(b.amount)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {developerData.generalDevTotal > 0 && (
              <View style={styles.devGeneralRow}>
                <Text style={styles.devGeneralLabel}>General Tech & Tools</Text>
                <Text style={styles.devGeneralAmount}>{currency(developerData.generalDevTotal)}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.devCardEmpty}>
            <View style={styles.devIconWrapEmpty}>
              <Feather name="terminal" size={22} color="#6366F1" />
            </View>
            <Text style={styles.devCardEmptyTitle}>Track your Dev Journey</Text>
            <Text style={styles.devCardEmptyText}>
              Tag entries with "Developer" or an event like #DevFest to see unified event costs here.
            </Text>
          </View>
        )}

        {/* RECENT ACTIVITY */}
        <View style={styles.sectionHeading}>
          <View><Text style={styles.sectionKicker}>RECENT ACTIVITY</Text><Text style={styles.sectionTitle}>Latest expenses</Text></View>
          <Text style={styles.sectionCount}>{expenses.length}</Text>
        </View>
        <View style={styles.recentCard}>
          {recent.length > 0 ? recent.map((expense, index) => {
            const meta = getCategoryInfo(expense.category);
            return (
              <Pressable
                key={expense.id}
                onPress={() => setEditingExpense(expense)}
                style={({ pressed }) => [
                  styles.expenseRow,
                  index < recent.length - 1 && styles.expenseRowBorder,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.expenseIcon, { backgroundColor: `${meta.color}1C` }]}>
                  <Feather
                    name={(meta.icon as keyof typeof Feather.glyphMap) || (expense.direction === 'received' ? 'arrow-down-left' : 'tag')}
                    size={18}
                    color={expense.direction === 'received' ? palette.foreground : meta.color}
                  />
                </View>
                <View style={styles.expenseMain}>
                  <Text style={styles.expenseNote} numberOfLines={1}>{expense.note || expense.category}</Text>
                  <View style={styles.badgeRow}>
                    <Text style={styles.expenseMeta}>
                      {expense.person ? `${expense.person} · ` : ''}{expense.category} · {formatDate(expense.date)}
                    </Text>
                    <View style={[styles.contextBadge, expense.subContext === 'Developer' && styles.contextBadgeDev]}>
                      <Text style={[styles.contextBadgeText, expense.subContext === 'Developer' && styles.contextBadgeTextDev]}>
                        {expense.subContext}
                      </Text>
                    </View>
                    {expense.eventTag ? (
                      <View style={styles.eventBadge}>
                        <Text style={styles.eventBadgeText}>#{expense.eventTag}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={[styles.expenseAmount, expense.direction === 'received' && styles.receivedAmount]}>{expense.direction === 'received' ? '+' : '−'}{currency(expense.amount)}</Text>
              </Pressable>
            );
          }) : (
            <View style={styles.emptyRecent}>
              <Text style={styles.emptyRecentTitle}>Nothing logged yet</Text>
              <Text style={styles.emptyRecentText}>Your latest expenses will appear here.</Text>
            </View>
          )}
        </View>
      </ScrollView>
      <Pressable testID="add-expense-fab" onPress={() => setModalVisible(true)} style={({ pressed }) => [styles.fab, { bottom: Math.max(insets.bottom, 18) + 74 }, pressed && styles.pressed]}>
        <Feather name="plus" size={22} color={palette.primaryForeground} />
        <Text style={styles.fabText}>Add expense</Text>
      </Pressable>
      <AddExpenseModal visible={modalVisible} onClose={() => setModalVisible(false)} existingEvents={existingEvents} />
      <SmartSmsModal visible={smsModalVisible} onClose={() => setSmsModalVisible(false)} />
      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          visible={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          existingEvents={existingEvents}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  scrollContent: { paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  brand: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.8 },
  brandAccent: { color: palette.primary },
  greeting: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 3 },
  headerSmsBtn: { height: 44, paddingHorizontal: 12, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#E0E7FF', borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerSmsText: { color: '#6366F1', fontFamily: 'Inter_700Bold', fontSize: 12 },
  headerReportBtn: { width: 44, height: 44, backgroundColor: palette.card, borderWidth: 1, borderColor: '#ECE8DE', borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headerAdd: { width: 44, height: 44, backgroundColor: palette.foreground, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  heroCard: { backgroundColor: palette.foreground, borderRadius: 24, padding: 22, marginBottom: 18 },
  smsBanner: { backgroundColor: palette.card, borderRadius: 18, borderWidth: 1, borderColor: '#ECE8DE', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  smsBannerIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  smsBannerContent: { flex: 1 },
  smsBannerTitle: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  smsBannerSubtitle: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: '#B5C9BF', fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.2 },
  monthPill: { backgroundColor: '#315149', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  monthPillText: { color: '#D6E8DD', fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1 },
  heroTotal: { color: '#FFFDF8', fontFamily: 'Inter_700Bold', fontSize: 42, letterSpacing: -1.8, marginTop: 12 },
  heroRule: { height: 1, backgroundColor: '#36564D', marginVertical: 18 },
  heroMeta: { flexDirection: 'row', alignItems: 'center' },
  heroMetaLabel: { color: '#94B1A5', fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1 },
  heroMetaValue: { color: '#FFFDF8', fontFamily: 'Inter_600SemiBold', fontSize: 15, marginTop: 4 },
  heroMetaDivider: { height: 26, width: 1, backgroundColor: '#36564D', marginHorizontal: 23 },
  heroSpark: { marginLeft: 'auto', alignItems: 'flex-end', gap: 2 },
  sparkText: { color: '#94B1A5', fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 0.6 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 13 },
  sectionKicker: { color: palette.primary, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.4 },
  sectionTitle: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5, marginTop: 4 },
  sectionTotal: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14, paddingBottom: 3 },
  sectionCount: { color: palette.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 14, paddingBottom: 3 },
  breakdownCard: { backgroundColor: palette.card, borderRadius: 22, padding: 18, marginBottom: 30, borderWidth: 1, borderColor: '#ECE8DE' },
  donutWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 3 },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutEyebrow: { color: palette.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.1 },
  donutTotal: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.8, marginTop: 4 },
  legend: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#ECE8DE', paddingTop: 12, gap: 11 },
  legendHelper: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 4 },
  categoryItemWrap: { borderBottomWidth: 1, borderBottomColor: '#F5F2EB', paddingBottom: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 9 },
  legendLabel: { color: palette.foreground, fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  legendAmount: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  subBreakdownBox: { backgroundColor: '#F9F7F1', borderRadius: 10, padding: 10, marginTop: 6, marginLeft: 17, gap: 4 },
  subBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subBreakdownLabel: { color: palette.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12 },
  subBreakdownAmt: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  emptyChart: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#ECE8DE', marginTop: 12, paddingTop: 14 },
  emptyChartTitle: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 8 },
  emptyChartText: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 4 },
  devCard: { backgroundColor: palette.card, borderRadius: 22, padding: 18, marginBottom: 30, borderWidth: 1, borderColor: '#ECE8DE' },
  devHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  devIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#6366F118', alignItems: 'center', justifyContent: 'center' },
  devCardEyebrow: { color: '#6366F1', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1 },
  devCardTotal: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.8, marginTop: 2 },
  devBadge: { backgroundColor: '#ECEEFE', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  devBadgeText: { color: '#6366F1', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  eventBox: { backgroundColor: '#F8F9FE', borderWidth: 1, borderColor: '#E0E3FA', borderRadius: 14, padding: 12, marginBottom: 10 },
  eventBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  eventBoxTitle: { color: '#4F46E5', fontFamily: 'Inter_700Bold', fontSize: 14 },
  eventBoxTotal: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 },
  eventPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  eventPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#E8EAFA' },
  eventPillCategory: { color: palette.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 11 },
  eventPillAmount: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  devGeneralRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTopWidth: 1, borderTopColor: '#ECE8DE' },
  devGeneralLabel: { color: palette.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12 },
  devGeneralAmount: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  devCardEmpty: { backgroundColor: palette.card, borderRadius: 22, padding: 22, alignItems: 'center', marginBottom: 30, borderWidth: 1, borderColor: '#ECE8DE' },
  devIconWrapEmpty: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#6366F115', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  devCardEmptyTitle: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 4 },
  devCardEmptyText: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: 16 },
  recentCard: { backgroundColor: palette.card, borderRadius: 22, paddingHorizontal: 16, borderWidth: 1, borderColor: '#ECE8DE', marginBottom: 8 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  expenseRowBorder: { borderBottomWidth: 1, borderBottomColor: '#ECE8DE' },
  expenseIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  expenseMain: { flex: 1, minWidth: 0 },
  expenseNote: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  expenseMeta: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 },
  contextBadge: { backgroundColor: '#ECE8DE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  contextBadgeDev: { backgroundColor: '#ECEEFE' },
  contextBadgeText: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  contextBadgeTextDev: { color: '#6366F1' },
  eventBadge: { backgroundColor: '#EBF6F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  eventBadgeText: { color: '#1B6A4B', fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  expenseAmount: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14, marginLeft: 10 },
  receivedAmount: { color: palette.primary },
  emptyRecent: { paddingVertical: 24, alignItems: 'center' },
  emptyRecentTitle: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  emptyRecentText: { color: palette.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  fab: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.primary, paddingHorizontal: 18, height: 52, borderRadius: 18, shadowColor: '#19332F', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 6 },
  fabText: { color: palette.primaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  pressed: { opacity: 0.82 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalDismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(25,51,47,0.38)' },
  sheet: { backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 11, maxHeight: '92%' },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#C8C2B7', alignSelf: 'center', marginBottom: 18 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetScroll: { paddingBottom: 20 },
  sheetKicker: { color: palette.primary, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.4 },
  sheetTitle: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.7, marginTop: 4 },
  closeButton: { width: 38, height: 38, backgroundColor: palette.card, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { color: palette.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },
  optional: { color: '#A4AAA4', fontFamily: 'Inter_500Medium', letterSpacing: 0.8 },
  amountInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.card, borderWidth: 1, borderColor: palette.input, borderRadius: 16, paddingHorizontal: 16, marginBottom: 14 },
  currencyPrefix: { color: palette.primary, fontFamily: 'Inter_700Bold', fontSize: 25, marginRight: 5 },
  amountInput: { flex: 1, color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 29, paddingVertical: 14 },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 11, backgroundColor: palette.card, borderWidth: 1, borderColor: '#ECE8DE' },
  dateChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  dateChipText: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  dateChipTextSelected: { color: palette.primaryForeground },
  flowToggle: { flexDirection: 'row', backgroundColor: palette.muted, borderRadius: 14, padding: 4, marginBottom: 16 },
  flowOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, paddingVertical: 11 },
  flowOptionSelected: { backgroundColor: palette.primary },
  flowText: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  flowTextSelected: { color: palette.primaryForeground },
  addNewLabelBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingBottom: 6 },
  addNewLabelText: { color: '#6366F1', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  contextToggle: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  contextOption: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: palette.card, borderWidth: 1, borderColor: '#ECE8DE' },
  contextOptionSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  contextText: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  contextTextSelected: { color: palette.primaryForeground },
  eventInputBox: { backgroundColor: '#F8F9FE', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E0E3FA', marginBottom: 16 },
  eventInputHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  eventFieldLabel: { color: '#4F46E5', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1 },
  tagChipsScroll: { marginTop: 4 },
  tagChipsContent: { flexDirection: 'row', gap: 6 },
  tagChip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7DAF8', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  tagChipSelected: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  tagChipText: { color: '#6366F1', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  tagChipTextSelected: { color: '#FFFFFF' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryOption: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 10, backgroundColor: palette.card, borderWidth: 1, borderColor: '#E8E3D9' },
  categoryOptionText: { color: palette.foreground, fontFamily: 'Inter_500Medium', fontSize: 12, marginLeft: 6 },
  categoryOptionTextSelected: { color: '#FFFDF8', fontFamily: 'Inter_600SemiBold' },
  categoryAddOption: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 10, backgroundColor: '#FAF8F4', borderWidth: 1, borderColor: '#D9D3C7', borderStyle: 'dashed', gap: 4 },
  categoryAddText: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  noteInput: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: palette.foreground, fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 14 },
  errorText: { color: palette.destructive, fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 9 },
  saveButton: { height: 52, borderRadius: 16, backgroundColor: palette.foreground, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 20 },
  saveButtonText: { color: '#FFFDF8', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(25,51,47,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pickerCard: { width: '100%', maxWidth: 340, backgroundColor: palette.card, borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 18, elevation: 8 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pickerTitle: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 16 },
  pickerNavBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: palette.muted, alignItems: 'center', justifyContent: 'center' },
  weekdaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekdayText: { width: 38, textAlign: 'center', color: palette.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, marginVertical: 2 },
  dayCellSelected: { backgroundColor: palette.primary },
  dayCellToday: { borderWidth: 1.5, borderColor: palette.primary },
  dayCellText: { color: palette.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  dayCellTextSelected: { color: palette.primaryForeground },
  customDialogCard: { width: '100%', maxWidth: 340, backgroundColor: palette.background, borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, elevation: 9 },
  customDialogTitle: { color: palette.foreground, fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5, marginTop: 2 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  colorCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorCircleSelected: { transform: [{ scale: 1.15 }], borderWidth: 2, borderColor: '#FFF' },
  dialogSaveBtn: { height: 48, borderRadius: 14, backgroundColor: palette.foreground, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
});