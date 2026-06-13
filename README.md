<div align="center">

# Learn

**Exercise & assignment platform for English classes**

_Built for the MORE! 1st-grade AHS/MS curriculum_

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2d3748?logo=prisma)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003b57?logo=sqlite)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-3-729b1b?logo=vitest)](https://vitest.dev/)

</div>

---

## Overview

Learn is a self-hosted web application for creating, assigning, completing, and reviewing interactive language exercises. It supports 14 exercise types—ranging from multiple choice and gap-fills to image hotspot quizzes, interactive reading, and media-rich open questions—and handles the full workflow from content authoring to student submission, gradebook analytics, and manual teacher grading override.

Designed around the **MORE!** textbook series for Austrian 1st-grade English classes, but easily extensible to any language teaching context.

---

## Core Features

### 👩‍🏫 For Teachers

- **Worksheet Creator** — Build mixed-modality exercises in a single worksheet (e.g. multiple-choice, gap-fill, drag-and-drop, categorization, matching, ordering, open questions, media embeds, instruction cards).
- **Pixabay Image Search Integration** — Search, preview, and download copyright-free public images directly into worksheets or vocabulary flashcards via a secure server proxy.
- **Live Quiz Host** — Create and host Kahoot-like real-time synchronous quizzes supporting single choice, multiple choice, word ordering, and text inputs with live charts and a student leaderboard.
- **Master Course Organizer** — Arrange exercises into units and courses with drag-and-drop reordering and assign them to classrooms in bulk.
- **Roster & Class Gradebook Matrix** — View a unified grid of student performance per assignment, drill down into student profiles to inspect attempts, and reset student passwords directly.
- **Bulk Import/Export** — Add students in bulk using CSV/JSON formatted lists, and export the entire classroom gradebook to CSV for external school records.
- **Grading & Scoring Reviews** — Review student answers, view submission timelines, grade student open responses (media or free text), and overwrite automated scores.
- **Content Sync** — Synchronize exercises defined as JSON or Markdown on disk directly into the database. Handles soft-deletes smoothly.

### 🧑‍🎓 For Students

- **Interactive Player** — Responsive, dark-mode friendly workspace for solving drag-and-drop, clickable choice, categorization, and hotspot-based exercises.
- **Vocabulary Picture Supplementation** — Reinforce spelling retention with an experimental **Picture Match Stage** (Stage 4) grid quiz showing target words and distractors.
- **Live Quiz Gamepad** — Participate in real-time synchronous class games using a 6-digit PIN with speed-based scoring, live ranking feedback, and custom shape pads.
- **Autocorrect Protection** — iPad-ready forms with autocorrect, suggestions, and spellcheck disabled by default to prevent unwanted keyboard assistance during assessments.
- **Rich Media Submissions** — Record audio directly in-browser via the `MediaRecorder` API or upload pictures as open-question submissions.
- **Attempt Multipliers** — Reward mastery by letting students retry exercises with decreasing score multipliers (100% &rarr; 75% &rarr; 50% &rarr; 25% max-score caps).
- **AI Feedback Quota** — Ask the coach for feedback up to 3 times per text attempt. This guides students through a Socratic revision process (first draft, second draft, and third draft review) before final submission.
- **Progress Dashboard** — View completed work, check outstanding assignments, and trace due dates.

---

## 🧱 Exercise & Widget Types

| Type | Interactive Widget Features | Grading Mechanism |
| :--- | :--- | :--- |
| **Multiple Choice** | Option lists with support for question media (audio/image) | Automated (correct option match) |
| **Gap Fill** | Text fields or inline dropdown lists inside sentences | Automated (exact match) |
| **Drag & Drop** | Drag items into corresponding placeholders in a sentence | Automated (exact position match) |
| **Categorization** | Drag-and-drop items into colored categorization bins | Automated (exact category match) |
| **Clickable Choice** | Toggle statement labels assigned to choices | Automated (exact state matches) |
| **Matching** | Match left-column cards to right-column items | Automated (correct key pairs) |
| **Open Question** | Text input with support for voice recording and image uploads | Advanced Rubric / Teacher Manual override |
| **Ordering** | Rearrange a randomized set of words into the correct sentence | Automated (exact order match) |
| **Media Embed** | Display images, play audio files, or show embedded video | Non-graded (Informational) |
| **Instruction Card**| Render formatted instructional text for worksheets | Non-graded (Informational) |
| **Image Hotspot Quiz**| Find and tap hidden regions/items on a background image | Automated (tap inside boundary box) |
| **Interactive Reading**| Branching "choose-your-own-adventure" story choices | Automated (completion path logic) |
| **Vocabulary Practice**| Interactive flashcard drills for word-translation matching | Automated (spelling or match checks) |
| **Explore Image Map** | Interactive image map with audio hotspots and scene transitions | Non-graded (Exploratory) |
| **Live Quiz** | Synchronous multiplayer class game with single/multiple choice, text, and order inputs | Automated (speed-based scoring) |


### 📝 Advanced Open Question Evaluation

The `OpenQuestion` widget supports a rich evaluation rubric configured in the worksheet creator:
1. **Required Keywords**: Keywords that *must* appear in the response, with optional scoring weights (`keyword##weight`).
2. **Bonus Keywords**: Keywords that add extra score points if included (each bonus weight translates to `weight * 15` points, capped at 100%).
3. **Forbidden Keywords**: Trigger words that immediately void the score to 0% if detected.
4. **Spelling Tolerance**:
   - `strict`: Case-insensitive exact substring matching.
   - `lenient`: Match words with a Levenshtein distance of $\le 1$ to allow minor spelling mistakes.
   - `off`: Substring matching disabled (defaulting to manual grading).
5. **Media Override Flow**: If a student submits a response containing *only* audio or an image, automated keyword scoring is bypassed, and the server marks the submission as pending teacher review to avoid automatic fail grades.

---

## 🛡️ Security & Hardening Architecture

The application has been hardened to prevent tampering, unauthorized access, and resource abuse:

1. **Server-Authoritative Scoring**: The application never trusts client-computed scores. The server re-evaluates all answers against the disk configuration upon submission. Attempt multipliers are strictly tracked and applied on the server.
2. **Cryptographic Join Codes**: Classroom join codes are generated using cryptographically secure PRNGs (`crypto.randomBytes`) rather than predictable pseudorandom generators.
3. **Asset Serving Isolation**: API endpoints for exercises assets (`/api/exercises/[id]/assets/[...path]`) enforce active session checks, sanitize path parts to prevent directory traversal attacks (blocking `..` and relative slashes), and block configuration file reads (`index.json` or `index.md`).
4. **Upload Restrictions**: Submission and exercise uploads enforce strict extension allowlists (blocking SVG files to prevent XSS), limit maximum file sizes (20MB), and utilize secure UUIDs (`crypto.randomUUID`) to write unique target filenames.
5. **Brute-Force Rate Limiting**: The login endpoint `/api/auth/login` uses an in-memory rate-limiter keyed by IP and username, blocking authentication attempts for 5 minutes after 5 consecutive failures. The registration endpoint `/api/auth/register` is independently rate-limited by IP to block automated account creation, and usernames are normalized (lowercase + trim) before lookup to prevent enumeration.
6. **Transactional Integrity**: Critical database modifications—including bulk student roster imports, course assignment operations, and drag-and-drop course reorders—are fully wrapped in Prisma database transactions (`$transaction`) to guarantee atomic writes.
7. **Live Quiz Cryptographic PINs**: 6-digit Live Quiz join PINs are generated with `crypto.randomInt(100000, 1000000)` and strictly validated server-side (`/^\d{6}$/`, max nickname length 50).
8. **Live Quiz Host Authorization**: Every host action (`startLiveQuiz`, `endLiveQuestion`, `showLiveLeaderboard`, `nextLiveQuestion`, `finishLiveQuiz`) re-loads the session and rejects callers whose `userId` is not the recorded host.
9. **Live Quiz Participant Binding**: When a participant is linked to a user account, `submitLiveAnswer` verifies that the calling session's `userId` matches the participant's `userId` before accepting an answer, preventing one student from answering on behalf of another.
10. **Session Cookie Validation**: Decrypted session cookies are type-checked before use (`userId` and `username` must be strings, `role` must be `"TEACHER"` or `"STUDENT"`); malformed cookies are silently discarded instead of throwing.
11. **Upload Path-Traversal Protection**: `uploadMedia` resolves the absolute target path and rejects writes that escape the `assets/` directory, blocks filenames containing `..` or starting with `.`, and pre-checks the base64-decoded size to prevent OOM.
12. **AI Request Timeouts**: All Gemini API calls (writing-coach feedback, feedback goal improvement, cloze generation) use a 30-second `AbortController` so hung upstream requests cannot block server workers indefinitely.
13. **Rate-Limit Production Guard**: `resetRateLimitStoreForTests` short-circuits with a warning in `production` to prevent an accidental global reset of the brute-force limiter.
14. **Assignment Ownership**: `assignExercise` and `unassignAssignment` verify the target classroom belongs to the calling teacher before writing; an unauthorized caller receives an `Access denied` error rather than a mutation.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Server Actions, Server Components)
- **UI & Layout**: React 19, Tailwind CSS 4, Lucide React icons
- **Database**: SQLite via Prisma 7
- **Authentication**: Encrypted session cookies (AES-256-GCM)
- **Validation**: Zod Schemas
- **Test Runner**: Vitest 3

---

## 📦 Project Structure

```
├── prisma/
│   ├── schema.prisma          # Database models (User, Classroom, Student, Assignment, etc.)
│   └── seed.ts                # Seeding script for development environments
├── content/
│   └── exercises/             # JSON/Markdown exercise definitions and media assets
├── src/
│   ├── app/
│   │   ├── actions.ts         # Delegating wrapper for server actions
│   │   ├── api/
│   │   │   ├── auth/          # Login, logout, register API endpoints
│   │   │   ├── exercises/     # Secure assets serving & teacher upload routes
│   │   │   └── submissions/   # Student media upload endpoint
│   │   ├── teacher/           # Teacher dashboard, creator client, classroom gradebook
│   │   ├── student/           # Student assignment player & dashboards
│   │   └── layout.tsx         # Root container
│   ├── components/
│   │   ├── Navbar.tsx         # Unified global navigation
│   │   └── widgets/           # 14 player widgets and builder helper scripts
│   └── lib/
│       ├── actions/           # Hardened server actions (classroom, course, exercise, submission)
│       ├── exercises.ts       # Zod exercise definitions, cache, and disk I/O helpers
│       ├── live-quiz-utils.ts # Pure Live Quiz helpers (answer evaluation, speed-based points)
│       ├── rateLimit.ts       # Brute-force credentials rate-limiter
│       ├── session.ts         # Cookie encryption and session authorization utilities
│       ├── submissionScoring.ts # Server-side answers evaluation and grading logic
│       └── points.ts          # Core points calculation logic
└── vitest.config.ts           # Vitest unit test suite configuration
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/damessner/learn_.git
   cd learn_
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up the Database**:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

4. **Configuration (`.env`)**:
   Create a `.env` file in the root directory. SQLite is configured by default:
   ```env
   DATABASE_URL="file:./dev.db"
   SESSION_SECRET="your_secure_32_character_session_secret_key"
   
   # Optional: Gemini API Configuration
   GEMINI_API_KEY="AIzaSy..."
   GEMINI_MODEL="gemini-3.5-flash-latest"

   # Optional: Pixabay API Configuration
   PIXABAY_API_KEY="your_pixabay_api_key"
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) and register a teacher account.

---

## 🧪 Testing

The repository includes a comprehensive unit testing suite using Vitest that verifies rate limiting, join codes, points multipliers, server-authoritative scoring, Live Quiz answer evaluation across all four question types, drag-drop answer normalization, and interactive-reading question-ID validation.

Run the test suite once:
```bash
npm run test
```

Run tests in watch/interactive mode:
```bash
npm run test:watch
```

---

## 📄 Configuration Formats

### Exercise JSON (`index.json`)

Exercises are validated via Zod schemas inside `src/lib/exercises.ts`. An example of a worksheet containing multiple-choice and open questions:

```json
{
  "id": "u1-spelling-practice",
  "title": "Unit 1 Spelling Practice",
  "description": "Practice spelling and vocabulary words from Unit 1",
  "type": "worksheet",
  "tags": ["spelling", "unit-1"],
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "What is the spelling of 'apple'?",
      "options": ["aple", "apple", "applee"],
      "correctOptionIndex": 1
    },
    {
      "id": "q2",
      "type": "open-question",
      "question": "Write a short sentence using the word 'spelling'.",
      "required": ["spelling##2.0"],
      "bonus": ["grammar##1.0", "sentence##1.0"],
      "forbidden": ["badword"],
      "spellingTolerance": "lenient",
      "allowAudio": true,
      "allowImage": true
    }
  ]
}
```

## License

Private repository. All rights reserved.