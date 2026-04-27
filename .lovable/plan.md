

# LMS Student UI/UX Overhaul — Implementation Plan

## Overview
Clean up the student-facing interface across 5 phases: remove visual noise, simplify the dashboard, unify lesson components, improve the Videos page UX, and decompose the monolithic dashboard.

---

## Phase 1: Clean Up Animations & Visual Noise

**StudentDashboard.tsx** — Remove all excessive hover effects from the 3-card stats section and milestones/leaderboard grid:
- Delete all `group-hover:scale-[1.03]`, `group-hover:rotate-12`, `group-hover:animate-bounce`, `group-hover:animate-spin`, `group-hover:animate-pulse` classes
- Delete all sweeping gradient overlay `<div>` elements (the `absolute inset-0 bg-gradient-to-r ... -translate-x-full group-hover:translate-x-full` pattern — appears 6 times)
- Replace card hover with simple `hover:shadow-md transition-shadow duration-200`
- Remove `group-hover:translate-x-1` on title text, `group-hover:scale-105` on buttons
- Replace hardcoded colors: `bg-green-50` → `bg-green-500/10 dark:bg-green-500/20`, `bg-orange-50` → `bg-orange-500/10`, `bg-purple-50` → `bg-purple-500/10`, `from-purple-50 to-pink-50` → `bg-muted`
- Remove `animate-ping` on the star element in leaderboard card
- Remove `hover:scale-[1.02]` from milestone items and leaderboard card

**ModuleCard.tsx** — Fix dark mode:
- `bg-white` → `bg-card`
- `bg-blue-50`, `bg-green-50`, `bg-purple-50`, `bg-orange-50`, `bg-red-50` → use `/10` opacity variants with dark mode support
- `hover:${colorScheme.bg}` → `hover:bg-muted/50`

---

## Phase 2: Simplify Dashboard Layout

**StudentDashboard.tsx** — Restructure the card grid:
- Change the 3-column grid to a 2-column grid: **Continue Learning** and **Next Assignment** only
- Move the **Integrations** card into a small collapsible section below the main cards (or remove entirely — it's not essential for daily student use)
- Merge **Milestones** and **Your Rank** into a single "Your Progress" card with two tabs using the existing `Tabs` component
- Add clear `<h2>` section dividers between card groups with proper spacing

---

## Phase 3: Unify Lesson Display

The Videos page already uses `RecordingRow` exclusively. The old `ModuleCard + LessonRow` system is only used by `CurrentModuleCard` (dashboard widget). Plan:
- Update `CurrentModuleCard` to use `RecordingRow` instead of its custom lesson rows, OR simplify it to just show the module title + progress bar with a "Continue" button (no inline lesson list)
- Mark `ModuleCard.tsx` and `LessonRow.tsx` as deprecated / remove if no other consumers exist

---

## Phase 4: Improve Videos Page UX

**Videos.tsx**:
- Auto-expand the module containing the next unwatched lesson on initial load
- Add a sticky "Continue where you left off" banner at the top showing the next unwatched lesson with a direct "Watch" button
- Auto-scroll to the active module on mount

**RecordingRow.tsx** — Friendlier lock messages:
- `'Complete previous lesson to unlock'` → `'Watch the previous lesson first'`
- `'Submit previous assignment to unlock'` → `'Submit your assignment to continue'`
- `'Previous assignment pending approval'` → `'Waiting for your assignment to be reviewed'`
- Add a subtle highlight (ring) on the next unwatched row

---

## Phase 5: Break Down StudentDashboard

Extract the monolithic component into focused sub-components, each owning its own data:

| New Component | Responsibility | Data Source |
|---|---|---|
| `ContinueLearningCard` | Current course + lock status + "Go to Videos" | `useCourseRecordings` |
| `NextAssignmentCard` | Next pending assignment + due status | Supabase query (assignments + submissions) |
| `ProgressSummaryCard` | Milestones tab + Leaderboard tab | Supabase queries (milestones, leaderboard_snapshots) |
| `LiveSessionBanner` | Upcoming/live session alert | Supabase query (success_sessions) |
| `LearningJourneyCard` | Financial goal + pathway progress | Existing state |

`StudentDashboard.tsx` becomes a ~120-line layout component that renders these cards in order.

---

## Execution Order

Phases 1 and 2 together first (immediate visual improvement, ~4 files). Then Phase 4 (Videos UX, 2 files). Then Phase 5 (decomposition, ~6 new files). Phase 3 last (cleanup of old components).

## Files Modified
- `src/components/StudentDashboard.tsx` (Phases 1, 2, 5)
- `src/components/ModuleCard.tsx` (Phase 1, possibly removed in Phase 3)
- `src/components/LessonRow.tsx` (possibly removed in Phase 3)
- `src/components/CurrentModuleCard.tsx` (Phase 3)
- `src/pages/Videos.tsx` (Phase 4)
- `src/components/videos/RecordingRow.tsx` (Phase 4)

## New Files (Phase 5)
- `src/components/dashboard/ContinueLearningCard.tsx`
- `src/components/dashboard/NextAssignmentCard.tsx`
- `src/components/dashboard/ProgressSummaryCard.tsx`
- `src/components/dashboard/LiveSessionBanner.tsx`
- `src/components/dashboard/LearningJourneyCard.tsx`

