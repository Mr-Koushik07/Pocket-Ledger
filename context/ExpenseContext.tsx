import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

export type SubContext = string;

export type SubContextItem = {
  key: string;
  label: string;
  icon: string;
};

export const DEFAULT_SUB_CONTEXTS: SubContextItem[] = [
  { key: 'Personal', label: 'Personal', icon: 'user' },
  { key: 'Developer', label: 'Developer', icon: 'code' },
  { key: 'Office', label: 'Office', icon: 'briefcase' },
];

export const SUB_CONTEXTS = DEFAULT_SUB_CONTEXTS;

export type CategoryItem = {
  key: string;
  label: string;
  icon: string;
  color: string;
};

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { key: 'Food', label: 'Food', icon: 'coffee', color: '#F06F58' },
  { key: 'Transport', label: 'Transport', icon: 'navigation', color: '#7A8FE8' },
  { key: 'Developer', label: 'Developer', icon: 'terminal', color: '#6366F1' },
  { key: 'Home', label: 'Home', icon: 'home', color: '#E4A94F' },
  { key: 'Shopping', label: 'Shopping', icon: 'shopping-bag', color: '#A17BD8' },
  { key: 'Health', label: 'Health', icon: 'heart', color: '#56A887' },
  { key: 'Other', label: 'Other', icon: 'more-horizontal', color: '#83908B' },
];

export const CATEGORIES = DEFAULT_CATEGORIES;

export type Expense = {
  id: string;
  amount: number;
  category: string;
  subContext: SubContext;
  eventTag: string;
  note: string;
  date: string;
  direction: 'spent' | 'received';
  person: string;
};

const STORAGE_KEY = '@pocket-ledger/expenses';
const CUSTOM_CAT_KEY = '@pocket-ledger/custom_categories';
const CUSTOM_CTX_KEY = '@pocket-ledger/custom_sub_contexts';
const CONTACTS_KEY = '@pocket-ledger/person_contacts';
const PROFILE_KEY = '@pocket-ledger/user_profile';

export type PersonContact = {
  name: string;
  upiId: string;
  phone?: string;
};

export type UserProfile = {
  name: string;
  upiId: string;
};

type Database = ReturnType<typeof SQLite.openDatabaseSync>;
let database: Database | null = null;

function getDatabase() {
  if (Platform.OS === 'web') return null;
  if (!database) {
    database = SQLite.openDatabaseSync('pocket-ledger.db');
    database.execSync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT NOT NULL,
        date TEXT NOT NULL,
        direction TEXT NOT NULL DEFAULT 'spent',
        person TEXT NOT NULL DEFAULT '',
        sub_context TEXT NOT NULL DEFAULT 'Personal',
        event_tag TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS custom_categories (
        key TEXT PRIMARY KEY NOT NULL,
        label TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS custom_sub_contexts (
        key TEXT PRIMARY KEY NOT NULL,
        label TEXT NOT NULL,
        icon TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS person_contacts (
        name TEXT PRIMARY KEY NOT NULL,
        upi_id TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    try {
      database.execSync("ALTER TABLE expenses ADD COLUMN direction TEXT NOT NULL DEFAULT 'spent'");
    } catch {}
    try {
      database.execSync("ALTER TABLE expenses ADD COLUMN person TEXT NOT NULL DEFAULT ''");
    } catch {}
    try {
      database.execSync("ALTER TABLE expenses ADD COLUMN sub_context TEXT NOT NULL DEFAULT 'Personal'");
    } catch {}
    try {
      database.execSync("ALTER TABLE expenses ADD COLUMN event_tag TEXT NOT NULL DEFAULT ''");
    } catch {}
  }
  return database;
}

type DbExpenseRow = {
  id: string;
  amount: number | string;
  category: string;
  note: string;
  date: string;
  direction?: 'spent' | 'received';
  person?: string;
  sub_context?: string;
  event_tag?: string;
};

async function readExpenses(): Promise<Expense[]> {
  const db = getDatabase();
  if (db) {
    return db
      .getAllSync<DbExpenseRow>(
        'SELECT id, amount, category, note, date, direction, person, sub_context, event_tag FROM expenses ORDER BY date DESC',
      )
      .map((item) => ({
        id: item.id,
        amount: Number(item.amount),
        category: item.category,
        note: item.note,
        date: item.date,
        direction: item.direction ?? 'spent',
        person: item.person ?? '',
        subContext: item.sub_context || 'Personal',
        eventTag: item.event_tag ?? '',
      }));
  }

  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored
    ? (JSON.parse(stored) as Partial<Expense>[]).map((item) => ({
        id: item.id ?? '',
        amount: Number(item.amount ?? 0),
        category: item.category ?? 'Other',
        subContext: item.subContext || 'Personal',
        eventTag: item.eventTag ?? '',
        note: item.note ?? 'Expense',
        date: item.date ?? new Date().toISOString(),
        direction: item.direction ?? 'spent',
        person: item.person ?? '',
      }))
    : [];
}

async function readCustomCategories(): Promise<CategoryItem[]> {
  const db = getDatabase();
  if (db) {
    return db.getAllSync<CategoryItem>('SELECT key, label, icon, color FROM custom_categories');
  }
  const stored = await AsyncStorage.getItem(CUSTOM_CAT_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function readCustomSubContexts(): Promise<SubContextItem[]> {
  const db = getDatabase();
  if (db) {
    return db.getAllSync<SubContextItem>('SELECT key, label, icon FROM custom_sub_contexts');
  }
  const stored = await AsyncStorage.getItem(CUSTOM_CTX_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function readPersonContacts(): Promise<Record<string, PersonContact>> {
  const db = getDatabase();
  if (db) {
    try {
      const rows = db.getAllSync<{ name: string; upi_id: string; phone: string }>(
        'SELECT name, upi_id, phone FROM person_contacts',
      );
      const map: Record<string, PersonContact> = {};
      for (const row of rows) {
        map[row.name.toLowerCase()] = { name: row.name, upiId: row.upi_id, phone: row.phone };
      }
      return map;
    } catch {
      return {};
    }
  }
  const stored = await AsyncStorage.getItem(CONTACTS_KEY);
  return stored ? JSON.parse(stored) : {};
}

async function readUserProfile(): Promise<UserProfile> {
  const db = getDatabase();
  if (db) {
    try {
      const rows = db.getAllSync<{ key: string; value: string }>(
        "SELECT key, value FROM app_settings WHERE key IN ('user_name', 'user_upi')",
      );
      const name = rows.find((r) => r.key === 'user_name')?.value || '';
      const upiId = rows.find((r) => r.key === 'user_upi')?.value || '';
      return { name, upiId };
    } catch {
      return { name: '', upiId: '' };
    }
  }
  const stored = await AsyncStorage.getItem(PROFILE_KEY);
  return stored ? JSON.parse(stored) : { name: '', upiId: '' };
}

async function writeWebExpenses(expenses: Expense[]) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }
}

export type AddExpenseInput = {
  amount: number;
  category: string;
  note: string;
  direction: 'spent' | 'received';
  person: string;
  subContext?: SubContext;
  eventTag?: string;
  date?: string;
};

export type UpdateExpenseInput = {
  id: string;
  amount?: number;
  category?: string;
  note?: string;
  direction?: 'spent' | 'received';
  person?: string;
  subContext?: SubContext;
  eventTag?: string;
  date?: string;
};

type ExpenseContextValue = {
  expenses: Expense[];
  categories: CategoryItem[];
  subContexts: SubContextItem[];
  personContacts: Record<string, PersonContact>;
  userProfile: UserProfile;
  loading: boolean;
  addExpense: (input: AddExpenseInput) => Promise<void>;
  addMultipleExpenses: (inputs: AddExpenseInput[]) => Promise<void>;
  updateExpense: (input: UpdateExpenseInput) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addCategory: (item: CategoryItem) => Promise<void>;
  deleteCategory: (key: string) => Promise<void>;
  addSubContext: (item: SubContextItem) => Promise<void>;
  deleteSubContext: (key: string) => Promise<void>;
  setPersonContact: (name: string, upiId: string, phone?: string) => Promise<void>;
  setUserProfile: (profile: UserProfile) => Promise<void>;
  reload: () => Promise<void>;
  getCategoryInfo: (key: string) => CategoryItem;
};

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customCategories, setCustomCategories] = useState<CategoryItem[]>([]);
  const [customSubContexts, setCustomSubContexts] = useState<SubContextItem[]>([]);
  const [personContacts, setPersonContacts] = useState<Record<string, PersonContact>>({});
  const [userProfile, setUserProfileState] = useState<UserProfile>({ name: '', upiId: '' });
  const [loading, setLoading] = useState(true);

  const categories = useMemo(() => {
    return [...DEFAULT_CATEGORIES, ...customCategories];
  }, [customCategories]);

  const subContexts = useMemo(() => {
    return [...DEFAULT_SUB_CONTEXTS, ...customSubContexts];
  }, [customSubContexts]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [exp, cats, ctxs, contacts, profile] = await Promise.all([
        readExpenses(),
        readCustomCategories(),
        readCustomSubContexts(),
        readPersonContacts(),
        readUserProfile(),
      ]);
      setExpenses(exp);
      setCustomCategories(cats);
      setCustomSubContexts(ctxs);
      setPersonContacts(contacts);
      setUserProfileState(profile);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addExpense = useCallback(
    async (input: AddExpenseInput) => {
      const expense: Expense = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amount: Number(input.amount),
        category: input.category,
        subContext: input.subContext ?? 'Personal',
        eventTag: (input.eventTag ?? '').trim(),
        note: input.note.trim(),
        date: input.date ?? new Date().toISOString(),
        direction: input.direction,
        person: input.person.trim(),
      };
      const db = getDatabase();
      if (db) {
        db.runSync(
          'INSERT INTO expenses (id, amount, category, note, date, direction, person, sub_context, event_tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          expense.id,
          expense.amount,
          expense.category,
          expense.note,
          expense.date,
          expense.direction,
          expense.person,
          expense.subContext,
          expense.eventTag,
        );
      }
      setExpenses((current) => [expense, ...current]);
      await writeWebExpenses([expense, ...expenses]);
    },
    [expenses],
  );

  const updateExpense = useCallback(
    async (input: UpdateExpenseInput) => {
      const existing = expenses.find((e) => e.id === input.id);
      if (!existing) return;
      const updated: Expense = {
        ...existing,
        ...(input.amount !== undefined ? { amount: Number(input.amount) } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.note !== undefined ? { note: input.note.trim() } : {}),
        ...(input.direction !== undefined ? { direction: input.direction } : {}),
        ...(input.person !== undefined ? { person: input.person.trim() } : {}),
        ...(input.subContext !== undefined ? { subContext: input.subContext } : {}),
        ...(input.eventTag !== undefined ? { eventTag: input.eventTag.trim() } : {}),
        ...(input.date !== undefined ? { date: input.date } : {}),
      };

      const db = getDatabase();
      if (db) {
        db.runSync(
          'UPDATE expenses SET amount = ?, category = ?, note = ?, date = ?, direction = ?, person = ?, sub_context = ?, event_tag = ? WHERE id = ?',
          updated.amount,
          updated.category,
          updated.note,
          updated.date,
          updated.direction,
          updated.person,
          updated.subContext,
          updated.eventTag,
          updated.id,
        );
      }
      const next = expenses.map((e) => (e.id === input.id ? updated : e));
      setExpenses(next);
      await writeWebExpenses(next);
    },
    [expenses],
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      const db = getDatabase();
      if (db) db.runSync('DELETE FROM expenses WHERE id = ?', id);
      const next = expenses.filter((expense) => expense.id !== id);
      setExpenses(next);
      await writeWebExpenses(next);
    },
    [expenses],
  );

  const addCategory = useCallback(
    async (item: CategoryItem) => {
      const db = getDatabase();
      if (db) {
        db.runSync(
          'INSERT OR REPLACE INTO custom_categories (key, label, icon, color) VALUES (?, ?, ?, ?)',
          item.key,
          item.label,
          item.icon,
          item.color,
        );
      }
      const updated = [...customCategories.filter((c) => c.key !== item.key), item];
      setCustomCategories(updated);
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(updated));
      }
    },
    [customCategories],
  );

  const deleteCategory = useCallback(
    async (key: string) => {
      const db = getDatabase();
      if (db) {
        db.runSync('DELETE FROM custom_categories WHERE key = ?', key);
      }
      const updated = customCategories.filter((c) => c.key !== key);
      setCustomCategories(updated);
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(updated));
      }
    },
    [customCategories],
  );

  const addSubContext = useCallback(
    async (item: SubContextItem) => {
      const db = getDatabase();
      if (db) {
        db.runSync(
          'INSERT OR REPLACE INTO custom_sub_contexts (key, label, icon) VALUES (?, ?, ?)',
          item.key,
          item.label,
          item.icon,
        );
      }
      const updated = [...customSubContexts.filter((c) => c.key !== item.key), item];
      setCustomSubContexts(updated);
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(CUSTOM_CTX_KEY, JSON.stringify(updated));
      }
    },
    [customSubContexts],
  );

  const deleteSubContext = useCallback(
    async (key: string) => {
      const db = getDatabase();
      if (db) {
        db.runSync('DELETE FROM custom_sub_contexts WHERE key = ?', key);
      }
      const updated = customSubContexts.filter((c) => c.key !== key);
      setCustomSubContexts(updated);
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(CUSTOM_CTX_KEY, JSON.stringify(updated));
      }
    },
    [customSubContexts],
  );

  const addMultipleExpenses = useCallback(
    async (inputs: AddExpenseInput[]) => {
      if (inputs.length === 0) return;
      const newExpenses: Expense[] = inputs.map((input) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amount: Number(input.amount),
        category: input.category,
        subContext: input.subContext ?? 'Personal',
        eventTag: (input.eventTag ?? '').trim(),
        note: input.note.trim(),
        date: input.date ?? new Date().toISOString(),
        direction: input.direction,
        person: input.person.trim(),
      }));

      const db = getDatabase();
      if (db) {
        db.withTransactionSync(() => {
          for (const expense of newExpenses) {
            db.runSync(
              'INSERT INTO expenses (id, amount, category, note, date, direction, person, sub_context, event_tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              expense.id,
              expense.amount,
              expense.category,
              expense.note,
              expense.date,
              expense.direction,
              expense.person,
              expense.subContext,
              expense.eventTag,
            );
          }
        });
      }
      setExpenses((current) => [...newExpenses, ...current]);
      await writeWebExpenses([...newExpenses, ...expenses]);
    },
    [expenses],
  );

  const setPersonContact = useCallback(
    async (name: string, upiId: string, phone: string = '') => {
      const cleanName = name.trim();
      if (!cleanName) return;
      const cleanUpi = upiId.trim();
      const cleanPhone = phone.trim();

      const db = getDatabase();
      if (db) {
        db.runSync(
          'INSERT OR REPLACE INTO person_contacts (name, upi_id, phone) VALUES (?, ?, ?)',
          cleanName,
          cleanUpi,
          cleanPhone,
        );
      }
      const updated = {
        ...personContacts,
        [cleanName.toLowerCase()]: { name: cleanName, upiId: cleanUpi, phone: cleanPhone },
      };
      setPersonContacts(updated);
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(updated));
      }
    },
    [personContacts],
  );

  const setUserProfile = useCallback(
    async (profile: UserProfile) => {
      const cleanName = profile.name.trim();
      const cleanUpi = profile.upiId.trim();

      const db = getDatabase();
      if (db) {
        db.runSync(
          "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('user_name', ?)",
          cleanName,
        );
        db.runSync(
          "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('user_upi', ?)",
          cleanUpi,
        );
      }
      const updated = { name: cleanName, upiId: cleanUpi };
      setUserProfileState(updated);
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      }
    },
    [],
  );

  const getCategoryInfo = useCallback(
    (key: string) => {
      const found = categories.find((c) => c.key.toLowerCase() === key.toLowerCase());
      return found ?? DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];
    },
    [categories],
  );

  const value = useMemo(
    () => ({
      expenses,
      categories,
      subContexts,
      personContacts,
      userProfile,
      loading,
      addExpense,
      addMultipleExpenses,
      updateExpense,
      deleteExpense,
      addCategory,
      deleteCategory,
      addSubContext,
      deleteSubContext,
      setPersonContact,
      setUserProfile,
      reload,
      getCategoryInfo,
    }),
    [
      expenses,
      categories,
      subContexts,
      personContacts,
      userProfile,
      loading,
      addExpense,
      addMultipleExpenses,
      updateExpense,
      deleteExpense,
      addCategory,
      deleteCategory,
      addSubContext,
      deleteSubContext,
      setPersonContact,
      setUserProfile,
      reload,
      getCategoryInfo,
    ],
  );

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}

export function useExpenses() {
  const value = useContext(ExpenseContext);
  if (!value) throw new Error('useExpenses must be used within ExpenseProvider');
  return value;
}

export function getCategory(category: string) {
  return DEFAULT_CATEGORIES.find((item) => item.key === category) ?? DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];
}