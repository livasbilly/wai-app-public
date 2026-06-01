# W.A.I. (Who Am I?)

A plug-and-play, local-first platform for students, creators, and introspective thinkers to explore, expand, and reflect on their thoughts.

## 💡 What is W.A.I.?

W.A.I. is a privacy-respecting, zero-configuration mind mapping and reflection tool. If you want full data ownership but find complex tools like Obsidian, local markdown editors, or custom cloud setups too intimidating, W.A.I. is for you.

Simply point W.A.I. to a local folder or plug in a USB drive. The app instantly parses your files on-the-fly and builds an interactive visual graph. Once mapped, you can explore connections and spar with custom, context-aware AI reflection partners (like *Casper* or *XPLorer*) to explore and expand your thoughts privately.

---

## 🚀 Key Features

- **Zero-Config File System Mapping**: Points to any local directory or USB drive using the browser's native File System Access API.
- **Interactive Visual Graph**: Beautiful, responsive, and dynamic visualization of your notes and document nodes.
- **Context-Aware AI Reflection Partners**: Converse with custom AI personas who understand your files and help you reflect, debate, and brainstorm.
- **Local-First & Private**: Your data stays yours. Designed with full privacy and zero-data-retention options.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (React 19, TypeScript)
- **Database/Storage**: Supabase (via PostgreSQL client and client-side RLS)
- **AI Integrations**: DeepSeek API (with custom reflection personalities)
- **Styling**: Tailwind CSS & Custom CSS

---

## 📦 Getting Started

To run W.A.I. locally on your machine, follow these steps:

### 1. Prerequisites
Make sure you have Node.js (v18+) installed.

### 2. Clone the Repository
```bash
git clone https://github.com/livasbilly/wai-app-public.git
cd wai-app-public
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Environment Setup
Create a `.env.local` file in the root of the project and add the following keys:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key (server-side only)

# AI Integration
DEEPSEEK_API_KEY=your_deepseek_api_key

# Admin Secret
ADMIN_PASSWORD=your_admin_secret_password
```

### 5. Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 🤝 Contributing & Feedback

W.A.I. was built by [Vasileios Livas](https://www.linkedin.com/in/vasileios-livas-bbb854306/) as part of a mission to redesign education architecture, focusing on verbal assessment, structured debates, and reflection.

If you have any feedback or want to collaborate, feel free to open an issue or connect on Twitter [@livasvasileios](https://x.com/livasvasileios).
