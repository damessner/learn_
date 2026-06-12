<div align="center">

# Learn

**Exercise & assignment platform for English classes**

_Built for the MORE! 1st-grade AHS/MS curriculum_

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2d3748?logo=prisma)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003b57?logo=sqlite)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss)](https://tailwindcss.com/)

</div>

---

## Overview

Learn is a self-hosted web application for creating, assigning, and completing interactive language exercises. It supports 14 exercise types — from multiple choice and gap-fills to image hotspot quizzes and interactive reading — and handles the full workflow from content authoring to student submission and teacher review.

Designed around the **MORE!** textbook series for Austrian 1st-grade English classes, but applicable to any language teaching context.

## Features

### For Teachers

- **Worksheet Creator** — Build mixed exercises (MC, gap-fill, drag-drop, categorization, matching, ordering, open question, media embed, instruction card) in a single worksheet
- **Special exercise modes** — Image Hotspot Quiz, Interactive Reading (branching stories), Vocabulary Practice
- **Course management** — Organize exercises into units, drag-and-drop reordering
- **Classroom management** — Create classrooms with join codes, assign exercises or entire courses
- **Submission review** — View student answers, scores, and attempt history
- **Rich media** — Upload images, audio, and video directly into exercises
- **Preview mode** — See exactly what students will see

### For Students

- **Interactive widgets** — Drag-and-drop, click-to-answer, hotspot exploration, audio playback
- **Multiple attempts** — Retry with decreasing score multipliers (100% → 75% → 50% → 25%)
- **Progress dashboard** — See completion status, scores, and due dates at a glance
- **Audio support** — Listen to prompts and conversations within exercises

### Exercise Types

| Type | Description |
|------|-------------|
| Multiple Choice | Classic MC with optional media per question |
| Gap Fill | Fill in blanks with text input or dropdown |
| Drag & Drop | Drag words into blanks within a sentence |
| Categorization | Sort items into categories |
| Clickable Choice | Assign statements to choice buttons |
| Matching | Match left-column items to right-column items |
| Open Question | Free-text answer with keyword scoring |
| Ordering | Arrange words into the correct order |
| Media Embed | Display image, audio, or video (no scoring) |
| Instruction Card | Display instructions (no scoring) |
| Image Hotspot Quiz | Find and click hotspots on an image |
| Interactive Reading | Branching choose-your-own-adventure stories |
| Vocabulary Practice | Word–translation flashcard drills |
| Explore Image Map | Clickable scenes with audio and scene transitions |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| UI | React 19, Tailwind CSS 4 |
| Database | SQLite via Prisma 7 |
| Auth | Encrypted session cookies (AES-256-GCM) |
| Validation | Zod |
| Storage | Filesystem (JSON + Markdown) with DB sync |

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/damessner/learn_.git
cd learn_

# Install dependencies
npm install

# Set up the database
npx prisma db push
npx prisma db seed

# Create a .env file (SQLite is the default)
echo 'DATABASE_URL="file:./dev.db"' > .env

# Start the development server
npm run dev
```

Open **http://localhost:3000** and register a teacher account to get started.

### Creating Exercises

Exercises are stored as JSON or Markdown files in `content/exercises/<id>/`:

```
content/exercises/
  u1-spelling-02/
    index.json          # Exercise definition
    assets/
      audio.wav         # Media files
  verbs-gapfill/
    index.md            # Markdown with frontmatter
```

You can create exercises via the web UI (**/teacher/create**) or by writing files directly and syncing with the **Sync** button on the teacher dashboard.

## Project Structure

```
src/
  app/
    actions.ts              # Server actions (auth, CRUD, assignments)
    api/auth/               # Login, register, logout API routes
    api/admin/sync/         # Manual DB sync endpoint
    api/exercises/[id]/assets/  # Media file serving
    teacher/                # Teacher dashboard, creator, preview
    student/                # Student dashboard
    assignments/[id]/       # Assignment player
    submissions/[id]/       # Submission review
  components/
    Navbar.tsx
    widgets/                # 14 exercise widget components
      types.ts              # TypeScript interfaces for all configs
      index.ts              # Widget registry
  lib/
    exercises.ts            # Zod schemas, disk I/O, validation
    scoring.ts              # Attempt multiplier logic
    session.ts              # Encrypted session management
    db.ts                   # Prisma client
prisma/
  schema.prisma             # Database schema
  seed.ts                   # Demo data
  migrations/               # Schema migrations
content/
  exercises/                # Exercise content (JSON/MD + assets)
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | SQLite connection string |
| `SESSION_SECRET` | — | AES-256-GCM key (auto-generated if unset) |

### Exercise File Format

Each exercise is a JSON file (`index.json`) or Markdown file with frontmatter (`index.md`):

```json
{
  "id": "my-quiz",
  "title": "Unit 1 Quiz",
  "description": "Alphabet and spelling",
  "type": "worksheet",
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "How do you spell your name?",
      "options": ["E-M-M-A", "E-M-A", "E-M-M-A-A"],
      "correctOptionIndex": 0
    }
  ]
}
```

See `src/lib/exercises.ts` for the full Zod schema of all exercise types.

## License

Private repository. All rights reserved.