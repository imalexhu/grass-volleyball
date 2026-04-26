# Grass Volleyball Management App

A modern, responsive web application designed for managing grass volleyball tournaments, tracking live match scores, and facilitating admin operations. Built with a robust modern web stack, it offers real-time scoreboards, detailed match tracking, and integrated payments.

## 🚀 Tech Stack

- **Framework**: [React 19](https://react.dev/) with [Vite](https://vitejs.dev/)
- **Routing & Data Fetching**: [TanStack Start](https://tanstack.com/start/latest) & [TanStack Router](https://tanstack.com/router/latest)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) (shadcn/ui style components)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend/Database**: [Firebase](https://firebase.google.com/) (Firestore for real-time tournament & match data)
- **Payments**: [Stripe](https://stripe.com/) integration
- **Language**: TypeScript

## ✨ Key Features

- **Live Match Dashboard**: A real-time public scoreboard to keep players and spectators updated on ongoing matches.
- **Admin Tournament Management**: Tools for creating tournaments, generating fixtures, and tracking overall tournament status.
- **Match Scoring Interface**: A dedicated interface for umpires/admins to score matches point-by-point, featuring highlight recording and strict rally sequences.
- **Quick Matches**: Ability to track ad-hoc games outside of official tournaments.
- **Real-time Sync**: Full integration with Firebase to ensure all match results and score updates are instantly synchronized across all clients.
- **Stripe Integration**: Handling of payments and registrations.

## 🛠 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) (or [Bun](https://bun.sh/)) installed on your machine.

### Installation

1. Clone the repository
2. Install the dependencies:
   ```bash
   npm install
   # or
   bun install
   ```

### Development Server

Start the development server:

```bash
npm run dev
# or
bun run dev
```

The application will be available locally. 

### Building for Production

To create a production build:

```bash
npm run build
```

## 📂 Project Structure

- `src/routes/` - Contains the application routes (TanStack Router)
- `src/lib/` - Utility functions, types, and API/Firebase integration logic
- `src/components/` - Reusable UI components

## 📝 Scripts

- `npm run dev` - Starts the Vite development server
- `npm run build` - Builds the app for production
- `npm run preview` - Previews the production build locally
- `npm run lint` - Runs ESLint
- `npm run format` - Formats the codebase using Prettier
