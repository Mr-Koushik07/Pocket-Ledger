# 🪙 Pocket Ledger

> **Your money, in focus.** A modern, offline-first personal expense tracker and peer-to-peer ledger built for clarity, speed, and real-world developer workflows.

Pocket Ledger combines daily expense tracking, multi-context segmentation (Personal, Developer, Office, and custom spheres), conference and trip event tagging, and person-to-person debt tracking into a cohesive, warm editorial mobile and web application.

---

## ✨ Key Features

### 📊 1. Home Dashboard & Insights
- **Monthly Spend Hero**: Live computation of total expenses, today's spending, and total entries formatted in Indian Rupees (`₹`).
- **Interactive Donut Chart**: Dynamic SVG donut visualization segmented by category colors.
- **Context Drill-Down**: Tap any category in the breakdown legend to inspect spending split across spheres (e.g., how much of *Food* was *Personal* vs. *Office* vs. *Developer*).
- **Recent Feed**: Instant snapshot of the latest 4 transactions with status tags, context badges, and quick-read visual cues.

### 💻 2. Developer & Event Spotlight
- **Tech Spending Aggregator**: Dedicated spotlight that monitors and aggregates tech, tools, and developer-related expenses.
- **Event & Conference Tagging**: Tag transactions with trip or conference tags (e.g., `#DevFest`, `#Hackathon2026`).
- **Unified Event Costs**: Automatically rolls up event expenses and displays a category-by-category breakdown for every trip or hackathon.

### 🌐 3. Context Spheres (Multi-Sphere Accounting)
- Preloaded with **Personal**, **Developer**, and **Office** spheres.
- **Custom Contexts**: Create custom spheres on the fly (e.g., *Freelance*, *College*, *Startup*) with custom icons and local persistence.
- Easily toggle contexts when adding expenses or filtering activity.

### ⚡ 5. Smart SMS & UPI Transaction Parser
- **Zero-Manual-Entry Mode**: Simply copy or paste any bank or UPI transactional SMS (from PhonePe, Google Pay, Paytm, HDFC, SBI, ICICI, Axis, etc.).
- **Automatic Entity Extraction**: Automatically extracts Amount, Inflow vs Outflow, Merchant / Payee, Bank Account / Card endings, and Transaction Reference.
- **Smart Category Inference**: Automatically maps known merchants (Swiggy, Zomato, Starbucks $\rightarrow$ *Food*; Uber, Ola, IRCTC $\rightarrow$ *Transport*; AWS, GitHub, Vercel $\rightarrow$ *Developer*; Amazon, Flipkart $\rightarrow$ *Shopping*).
- **Clipboard 1-Tap Paste**: Automatically reads and parses copied SMS text directly from the device clipboard.
- **Batch SMS Import**: Paste an entire message thread to parse and bulk-import multiple transactions simultaneously.

### 👥 6. People & PhonePe UPI Settlement ("Money Between You")
- **Automated Balance Tracking**: Tag any expense or received amount with a person's name (e.g., *Rahul*, *Priya*).
- **Zero-Math Settlement**: Automatically determines net balances (`owes you`, `you owe`, `settled`).
- **1-Tap PhonePe Direct Payment**: When you owe someone money, tap **"Pay via PhonePe"** to open PhonePe with the recipient's UPI ID, name, amount, and note pre-filled.
- **Settle Upon Payment**: Returning to Pocket Ledger automatically asks if the payment was completed to record the repayment without manual entry.
- **UPI Payment Request Sharing**: When someone owes you money, tap **"Request via WhatsApp"** to generate an instant payment link with your personal UPI ID.
- **Contact & Profile UPI Storage**: Save UPI IDs for individual contacts and configure your personal UPI ID for seamless reconciliation.

### 📝 7. Streamlined Expense Entry & Customization
- **Flexible Flow**: Mark transactions as `"I paid"` (expense) or `"I received"` (repayment / income).
- **Date Picking**: One-tap date selection for *Today*, *Yesterday*, or custom dates via an interactive calendar modal.
- **Custom Categories**: Built-in categories (*Food*, *Transport*, *Developer*, *Home*, *Shopping*, *Health*, *Other*) plus the ability to create new categories with a custom color palette.
- **Haptic Feedback**: Native tactile response on transaction saves and destructive actions.

### 📜 8. Activity & Filterable Ledger
- **Context Filters**: Seamlessly filter all past transactions by *All*, *Personal*, *Developer*, *Office*, or any custom sphere.
- **Event Filter**: Filter by clicking any `#event` tag to calculate the exact subtotal for that event.
- **Platform-Native Deletion**: Long-press or action icon to delete with native alerts on iOS/Android and immediate removal on Web.
- **Pull to Refresh**: Manual sync/reload control on all list views.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [React Native 0.86.3](https://reactnative.dev/) / [Expo SDK 57](https://expo.dev/) (New Architecture Enabled) |
| **Routing** | [Expo Router v57](https://docs.expo.dev/router/introduction/) (File-based routing with typed routes & React Compiler) |
| **Language** | [TypeScript ~5.9.2](https://www.typescriptlang.org/) (Strict mode) |
| **Local Storage** | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) (`pocket-ledger.db`) with fallback to [@react-native-async-storage/async-storage](https://react-native-async-storage.github.io/async-storage/) on Web |
| **Icons & Design** | `@expo/vector-icons` (Feather), `expo-symbols` (SF Symbols on iOS), `expo-blur` |
| **Typography** | `@expo-google-fonts/inter` (Inter 400, 500, 600, 700) |
| **Keyboard Management** | `react-native-keyboard-controller` with web fallback |
| **Data Fetching / State** | React Context (`ExpenseContext`) + `@tanstack/react-query` |
| **Haptics** | `expo-haptics` |

---

## 🗄️ Database & Storage Schema

Pocket Ledger uses a local SQLite database on native platforms with automatic schema creation and non-destructive migrations. On web environments, it seamlessly falls back to AsyncStorage with identical data shapes.

### Database Name: `pocket-ledger.db`

#### 1. `expenses` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY NOT NULL` | Unique ID (`timestamp-randomHash`) |
| `amount` | `REAL` | `NOT NULL` | Monetary value |
| `category` | `TEXT` | `NOT NULL` | Category name (e.g. `Food`, `Developer`) |
| `note` | `TEXT` | `NOT NULL` | Description or notes |
| `date` | `TEXT` | `NOT NULL` | ISO 8601 Date string |
| `direction` | `TEXT` | `NOT NULL DEFAULT 'spent'` | `'spent'` or `'received'` |
| `person` | `TEXT` | `NOT NULL DEFAULT ''` | Associated person's name |
| `sub_context` | `TEXT` | `NOT NULL DEFAULT 'Personal'` | Sphere (`Personal`, `Developer`, `Office`, etc.) |
| `event_tag` | `TEXT` | `NOT NULL DEFAULT ''` | Conference, trip, or event tag |

#### 2. `custom_categories` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `key` | `TEXT` | `PRIMARY KEY NOT NULL` | Unique category key |
| `label` | `TEXT` | `NOT NULL` | Display label |
| `icon` | `TEXT` | `NOT NULL` | Feather icon identifier |
| `color` | `TEXT` | `NOT NULL` | Hex color code |

#### 3. `custom_sub_contexts` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `key` | `TEXT` | `PRIMARY KEY NOT NULL` | Unique context key |
| `label` | `TEXT` | `NOT NULL` | Display label |
| `icon` | `TEXT` | `NOT NULL` | Feather icon identifier |

---

## 📁 Project Structure

```
Pocket-Ledger/
├── app/                                # Expo Router file-based screens
│   ├── (tabs)/                         # Bottom Tab Navigator
│   │   ├── _layout.tsx                 # Tab navigation bar with platform blur & SF symbols
│   │   ├── index.tsx                   # Home dashboard (Hero, Donut chart, Dev spotlight, FAB)
│   │   ├── activity.tsx                # Transaction ledger with sphere & event filtering
│   │   └── people.tsx                  # People ledger & bilateral balance tracking
│   ├── _layout.tsx                     # Root application layout (Providers, Fonts, ErrorBoundary)
│   └── +not-found.tsx                  # Fallback 404 screen
├── assets/                             # App branding & iconography
│   └── images/
│       ├── icon.png                    # Primary launcher and splash icon
│       └── icon_2.png                  # Alternate asset
├── components/                         # Shared UI and utility components
│   ├── ErrorBoundary.tsx               # Class component error boundary
│   ├── ErrorFallback.tsx               # User-facing error screen with dev stack viewer
│   └── KeyboardAwareScrollViewCompat.tsx # Cross-platform keyboard scroll helper
├── constants/
│   └── colors.ts                       # Semantic theme tokens & color definitions
├── context/
│   └── ExpenseContext.tsx              # SQLite engine, state management, and CRUD methods
├── hooks/
│   └── useColors.ts                    # Hook returning tokens based on light/dark mode
├── app.json                            # Expo application configuration & plugins
├── eas.json                            # Expo Application Services (EAS) build profiles
├── metro.config.js                     # Metro bundler configuration
├── package.json                        # Dependencies and scripts
└── tsconfig.json                       # TypeScript path aliases (`@/*`) and configuration
```

---

## 🎨 Design System

Pocket Ledger uses a refined, editorial color palette designed to avoid sterile spreadsheet aesthetics:

| Token | Hex Value | Role |
|---|---|---|
| **Background** | `#F7F4EC` | Warm parchment background surface |
| **Foreground / Text** | `#19332F` | Deep forest pine for text and strong accents |
| **Primary / Tint** | `#F06F58` | Warm coral for primary buttons, received highlights, and accents |
| **Card** | `#FFFDF8` | Slightly elevated warm ivory surface |
| **Developer Highlight** | `#6366F1` | Indigo used for developer tags, badges, and event cards |
| **Border / Input** | `#DDD9D0` / `#D7D2C8` | Subtle warm grey outlines |
| **Radius** | `18px - 24px` | Soft, modern rounded corners |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo Go](https://expo.dev/go) on your iOS/Android device, or a configured Android/iOS simulator

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/NavadeepDj/Pocket-Ledger.git
   cd Pocket-Ledger
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Run on a specific platform:**
   - Press `a` in the terminal to run on an **Android** emulator or connected device.
   - Press `i` in the terminal to run on an **iOS** simulator (macOS only).
   - Press `w` in the terminal to run in a **Web** browser.
   - Scan the terminal QR code using **Expo Go** on Android or Camera app on iOS.

### Type Checking
To verify TypeScript types across the project:
```bash
npm run typecheck
```

---

## 📦 Building with EAS (Expo Application Services)

The repository comes pre-configured with `eas.json` for Android and iOS builds:

### Android Standalone APK (Preview)
To generate an installable Android APK for testing:
```bash
npx eas-cli build --profile preview --platform android
```

### Production Build
To create production-ready app bundles:
```bash
npx eas-cli build --profile production --platform all
```

---

## 🔒 Privacy & Offline First

Pocket Ledger respects user privacy:
- **Zero Cloud Dependence**: All entries, custom categories, and personal debt ledgers remain on the physical device.
- **Local SQLite Engine**: Fast and responsive queries using synchronous SQLite execution.
- **No Analytics / Tracking**: Your financial data never leaves your device.

---

## 📄 License

This project is private and maintained for personal and community developer expense management.

