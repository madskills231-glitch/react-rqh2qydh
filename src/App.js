import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from "react";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, BarChart, Bar,
  CartesianGrid
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  // Navigation & UI
  LayoutDashboard, Calculator, Briefcase, ClipboardList, Calendar, Users, Settings as SettingsIcon, LogOut, Menu, X,
  // Actions
  Plus, Trash2, Pencil, Copy, Check, ChevronRight, ChevronDown, Save, Search, Filter,
  // Files & docs
  FileText, FileEdit, Download, Upload, Camera, Image as ImageIcon,
  FolderOpen, Folder, Archive, Share2, History,
  // Status & flags
  AlertCircle, AlertTriangle, CheckCircle2, XCircle, Info, Clock, Zap, Lock, Unlock,
  // Construction
  HardHat, Hammer, Wrench, Truck, Package,
  // Money & data
  DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart, Receipt,
  ShieldCheck, BookOpen,
  // Misc
  ExternalLink, Eye, EyeOff, ArrowRight, ArrowLeft, RefreshCw, MoreHorizontal,
  CloudSun, Thermometer, MapPin, Phone, Mail, Building2,
  // v1.1 Pipeline additions
  GitBranch, Trophy, GripVertical, MessageSquare, UserPlus, Flame, Target,
  // v1.4 Voice + QOL
  Mic, MicOff
} from "lucide-react";
import { supabase } from "./supabase";

// ================================================================
// NORTHSHORE OS — CHANGELOG
// ================================================================
// Phase 1: Core CRM, Supabase, Vercel deployment
// Phase 2: Auth, custom domains, relational data, PDF proposals,
//          change orders, sales tax compliance fix
// Phase 3: Daily logs, photo uploads, punch list, material deliveries,
//          job completion gating
// CLEANUP PASS (Tier 1+2):
//   - Toast notification system (replaces alerts)
//   - ConfirmDialog system (replaces window.confirm)
//   - Estimate edit/delete/duplicate
//   - Lost status added to jobs and estimates
//   - Change order form clears after generation
//   - Client delete cascade warning
//   - Loading spinners on async actions
//   - Empty-state action prompts
//   - Wider desktop layout (max-w-screen-2xl)
//   - Archive view filter
//   - Estimates state lifted to App (fixes Dashboard staleness)
//   - useCallback wrapping (fixes stale closures)
//   - Session refresh listener
// POLISH PASS (Tier A):
//   - Lucide React icons throughout (replaces emoji)
//   - Framer Motion for tab transitions, card fade-ins, KPI count-up
//   - Dashboard hierarchy redesigned (Daily Log Status > Burn Rate > Pipeline)
//   - Recharts cursor bug fixed (cursor={false} on Tooltip)
//   - Custom scrollbar styling via global style tag
//   - Skeleton loading states for slow async
//   - Subtle KPI gradients based on meaning
//   - CountUp animation for KPI numbers on mount
// PHASE 4 — DOCUMENTS:
//   - Contract generator (binding agreement post-proposal-signature)
//   - Documents-as-state-machine: Mark Contract Signed arms NOC clock,
//     invoice schedule, daily log expectations, punch list scaffolding
//   - jobs.contract_signed_at + jobs.contract_number columns required
//   - Contract button surfaces only on Approved estimates
//   - today's render bug fixed in Dashboard banner (was today\'s)
// TIME TRACKING:
//   - Persistent ClockWidget in header — clock in/out from any tab
//   - Active session shows running timer + job name in header
//   - Per-job time history sub-tab in Jobs (with manual entry for missed times)
//   - Dashboard active session card
//   - Computed labor cost per job (settings.laborRate × actual hours)
//   - time_entries table required (see time-tracking-migration.sql)
// ================================================================
// ================================================================
// NORTHSHORE OS v1.4.1 — Apr 27 2026 — Audit findings cleanup +
// guardrails so this can't happen again
//
// REQUIRES SQL: v1.4.1-cleanup-and-indexes.sql
//   Part 1: 3 FK indexes (jobs.client_id, estimates.client_id,
//           estimates.job_id) — performance, not correctness.
//   Part 2: cascade-check before deletes (eyeball, all should be 0).
//   Part 3: deletes 7 confirmed-test rows (3 lost leads w/o reason,
//           2 completed jobs $0 actual, 2 duplicate JOHN clients).
//   Part 4: verify all three audit issues now return 0.
//
// CODE:
//
// LOST REASON IS NOW REQUIRED:
//   - MarkLostModal previously had "Reason (optional)" with a
//     "skip" path, which let 3 test leads escape with no reason.
//     CRM hygiene says you should always know WHY you lost — it
//     tells you whether bids are too high, follow-up's too slow,
//     or a lead source isn't qualified.
//   - Now: dropdown required, "Other" reveals a free-text input
//     also required. Mark Lost button stays disabled until valid.
//   - The other path to Lost (drag-to-Lost zone) goes through this
//     same modal, so closing the loophole here covers both.
//
// SOFT WARNING ON COMPLETED-WITH-$0:
//   - handleStatusChange now intercepts when newStatus === Completed
//     AND job.actual is null/0. Shows ConfirmDialog explaining the
//     consequences (job-cost history gap, weakened lien-waiver
//     paper trail) and offers a clear "Mark Complete Anyway" path
//     for legitimate $0 favor jobs.
//   - User can still mark a $0 job Complete — it just costs them
//     one click and they understand what they're doing. Not a
//     hard block; that would over-rotate.
//
// NO new dependencies.
// ================================================================
// NORTHSHORE OS v1.4.0 — Apr 27 2026 — Voice-to-text + QOL bundle
//
// CORE FEATURE: Voice-to-text on jobsite-relevant fields.
// Uses the browser's native Web Speech API (free, on-device,
// no API key required, no Whisper round-trip). Accuracy good
// for construction vocabulary. Whisper fallback can be added
// in v1.5 if accuracy issues surface.
//
// useVoiceInput hook + VoiceMicButton component:
//   - Continuous mode (keeps listening through pauses)
//   - Live interim transcript flows into target field while speaking
//   - Final transcript captured on stop, appended to existing text
//   - Pulsing red mic icon while recording
//   - Gracefully hides if browser doesn't support (Firefox)
//   - Auto-stops on extended silence per browser default
//
// Wired into:
//   - Daily Log → Work Performed
//   - Daily Log → Issues / Notes
//   - Photo Caption (after upload)
//   - Clock-out Session Notes
//   - Manual Time Entry Notes
//   - LeadDetailDrawer Notes (with markDirty integration)
//   - AddLeadModal Notes
//
// Browser support: Chrome, Edge, Safari (iOS 14.5+) — Firefox
// is flag-gated and treated as unsupported (mic button hides).
//
// QOL BUNDLE:
//
// AUTO-RESIZE TEXTAREAS:
//   - New AutoTextarea primitive grows with content from minRows
//     to maxRows, then scrolls. Replaces fixed-row textareas in
//     Daily Log, Time Entry, and Clock-out flows.
//
// OPTIMISTIC UI ON PUNCH TOGGLE:
//   - Checkbox flips locally before round-trip. Rolls back on
//     server error with toast. Highest-frequency action in the
//     field — eliminates 200-300ms perceived lag.
//
// UNSAVED-CHANGES INDICATOR:
//   - LeadDetailDrawer header shows pulsing amber "Unsaved" pill
//     when dirty. Visible without scrolling, regardless of where
//     you are in the drawer body.
//
// SKELETON LOADING:
//   - Initial data load now shows a skeleton mirroring the real
//     layout (header + KPIs + content blocks), not a centered
//     spinner. Perceptually faster — feels instant on second load.
//
// JOBS EMPTY STATE POLISH:
//   - Differentiates "no jobs at all" vs "filter excludes results."
//     Filter case shows a "Clear filters" CTA that resets both
//     filter and search.
//
// GLOBAL KEYBOARD SHORTCUTS:
//   - Esc: closes mobile nav (modals + drawers handle their own
//     Esc internally already).
//   - /: focuses the first visible search input on the active tab
//     (only fires when not already typing).
//
// NO SQL CHANGES. No new dependencies. Web Speech API is built
// into every supported browser.
// ================================================================
// NORTHSHORE OS v1.3.3 — Apr 27 2026 — Schema drift fix (code, not SQL)
//
// v1.3.2's audit reported 30 missing columns. After Connor ran
// the verify SQL and shared the actual schema, the picture changed:
//
//   - 12 of 30 were FALSE POSITIVES from the audit script. Its
//     regex captured column names from CHANGELOG comment text
//     (where I described "what the column SHOULD be") as if they
//     were real payload writes. Audit script fixed in v1.3.3
//     artifact: now strips comments before parsing.
//
//   - 5 of 30 were REAL DRIFT — code was writing the wrong
//     column name. Renamed to match the (better) DB schema:
//
//       daily_logs.hours          → hours_connor
//       daily_logs.work_completed → work_performed
//       material_deliveries.item  → description
//       material_deliveries.received_date → delivered_date
//       punch_list.priority       → category (with optional render)
//
//   - 13 of 30 were already-correct code that the audit ALSO
//     ghost-flagged. Verified zero matches in real source.
//
// THE DB SCHEMA IS RICHER THAN THE CODE. Worth reading the
// schema dump to see what features are LATENT (data fields exist,
// no UI yet):
//   - daily_logs has hours_connor / hours_dad / hours_other +
//     other_worker_name. Per-person hours tracked separately —
//     critical for payroll once dad becomes paid worker.
//     Today: code lumps everything into hours_connor.
//     v1.4: expose dad/other fields when payroll structure is set.
//   - daily_logs has materials_used, temperature, visitors —
//     none surfaced in current Daily Log UI.
//   - tools has assigned_to, current_location, warranty_expires_at,
//     hours_since_service, disposed_at — the schema anticipates
//     a fleet-management UI that hasn't been built.
//   - lien_waivers has condition_payment_amount/method/reference,
//     effective_at, voided_at, voided_reason — designed for the
//     full conditional-vs-unconditional waiver workflow.
//   - sworn_statements has parties (jsonb), delivered_at,
//     delivered_to — same story.
//
// READS UPDATED:
//   - log.work_completed → log.work_performed (Daily Log detail view)
//   - log.hours read replaced with sum of hours_connor+dad+other,
//     with backwards compat for legacy `hours` field on existing rows.
//   - d.item → d.description (delivery list)
//   - d.received_date → d.delivered_date (delivery list display)
//   - m.received_date → m.delivered_date (lien calc + last activity)
//   - punch item.priority → item.category (badge now optional)
//
// NO SQL MIGRATION. Pure code rename to match existing DB.
// Existing rows in DB use the canonical column names already, so
// historical data renders correctly post-deploy.
//
// Backward compat: daily-log hours read sums all four possible
// fields (hours_connor + hours_dad + hours_other + legacy `hours`)
// so any logs saved against the old `hours` field — IF they exist —
// still render their values. Likely zero such rows since the old
// payload would have been rejected by Postgres for unknown column.
//
// ================================================================
// NORTHSHORE OS v1.3.2 — Apr 27 2026 — Flagged-items sweep
//
// Connor cleared the "FLAGGED, NOT PATCHED" list in one ship.
// 10 items, 9 code patches, 1 verified false-positive.
//
// REQUIRES SQL MIGRATION (run v1.3.2-soft-delete-migration.sql):
//   ALTER TABLE clients   ADD COLUMN deleted_at TIMESTAMPTZ;
//   ALTER TABLE estimates ADD COLUMN deleted_at TIMESTAMPTZ;
//   ALTER TABLE jobs      ADD COLUMN paid_in_full_at TIMESTAMPTZ;
// Without these, soft-delete + paid-in-full features will fail
// with the same "column not found in schema cache" error as
// the v1.3.1 photo bug.
//
// SHIPPED:
//
// (1) Schema audit tool — schema-audit-v1.3.2.sql artifact.
//     Lists every column the code writes to. Run in Supabase
//     SQL Editor; any rows returned are bugs in waiting (like
//     the v1.3.1 job_photos.url issue).
//
// (2) Toast Undo for client + estimate delete:
//     - Both now SOFT DELETE (set deleted_at) instead of hard
//       delete. Preserves FK relationships (jobs.client_id,
//       estimates.client_id), prevents cascade orphaning.
//     - 6-second Undo button restores by clearing deleted_at.
//     - AppInner load filters .is("deleted_at", null) so
//       deleted rows stay invisible.
//
// (3) Last-contact pill on Clients edit form header.
//     When you select a client to edit, the form now shows
//     "Last contact: Xd ago" + linked job/estimate counts.
//     Useful for follow-up triage as the client list grows.
//
// (4) Material deliveries lifted to AppInner state:
//     - Lien calc now uses real material data (was [] before).
//     - last-activity calc same.
//     - JobOperations refactored: deliveries now derived from
//       lifted parent state. Single source of truth — no more
//       per-job local fetch. Add/edit/delete in JobOperations
//       now update parent directly. Loose punch_list state
//       unchanged (still scoped per-job).
//
// (5) handleConvertWon partial-failure rollback:
//     - Tracks created records (client + job).
//     - On any later step failure, rolls them back atomically.
//     - Bonus: dedupe check now uses normalizePhone() on both
//       sides instead of raw === comparison (was matching
//       different phone formats as different clients).
//
// (6) LeadDetailDrawer unsaved-changes warning:
//     - Two-layer guard: confirm dialog on close-button /
//       overlay click, plus native beforeunload for refresh
//       and tab-close cases.
//     - Only triggers when `dirty === true`.
//
// (7) Mark Paid in Full / dismiss lien warning:
//     - New PAYMENT STATUS block in expanded job (right after
//       Contract Status). Only renders when contract IS signed.
//     - Toggle stores jobs.paid_in_full_at timestamp.
//     - lienDeadlineFor() returns null when paid_in_full_at
//       is set — clears the job from lien widget AND per-job
//       badge AND nav notification badge. Three places, one
//       check at the source.
//
// (8) Photo timeline edit-in-place:
//     - Pencil icon appears on hover of timeline cards.
//     - Click → caption textarea + phase select inline.
//     - Save / Cancel buttons. URL preserved (it's derived,
//       not stored — see v1.3.1 patch).
//     - Grid view unchanged (lightbox already handles edits
//       there via existing pattern).
//
// (9) Drag-leave flicker fix:
//     - Three drop zones now use relatedTarget guard:
//       Pipeline columns, Lost zone, PhotoUploader.
//     - Without guard, dragging across child elements (e.g.
//       lead cards within a column) fired drag-leave even
//       though we never left the column container.
//
// (10) wonThisMonth timezone — verified false-positive flag.
//      Code uses getMonth() / getFullYear() which apply local
//      timezone conversion to the stored UTC timestamp. The
//      hypothetical bug ("UTC stored, local midnight could
//      land in next month") doesn't actually exist. No code
//      change. Removing from flag list.
//
// ================================================================
// NORTHSHORE OS v1.3.1 — Apr 27 2026 — Photo upload fix
//
// FIX: Photo uploads were failing with "Could not find the 'url'
// column of 'job_photos' in the schema cache." The deployed
// job_photos table has no `url` column — only storage_path.
//
// Two ways to solve: (A) ALTER TABLE to add the column, or (B) stop
// storing the URL and derive it from storage_path on read. Picked B
// because:
//   - The bucket is public; URLs are deterministic from path alone.
//   - Storing duplicates the source of truth (path).
//   - Avoids a schema migration — ships immediately.
//   - If the bucket ever moves, derived URLs stay correct.
//
// PATCHED:
//   - PhotoUploader insert no longer includes `url`. After a
//     successful insert, we attach the publicUrl in-memory before
//     calling onUploaded so the gallery displays it instantly.
//   - AppInner photo-load hydrates photoRes rows: if a row has no
//     `url` (the new normal), derive it via getPublicUrl. Backward
//     compatible — legacy rows that DO have url set keep their value.
//
// NO SQL CHANGES NEEDED. No schema migration. No breaking changes
// to existing photos.
// ================================================================
// NORTHSHORE OS v1.3.0 — Apr 27 2026 — Last-Touch Badges + Photo
// Timeline + QOL bundle. SECOND minor version after v1.2.
//
// CORE FEATURES (per roadmap):
//
// LAST-TOUCH BADGES (v1.3 helpers):
//   - lastActivityForJob(job, dailyLogs, timeEntries, jobPhotos, materials)
//     returns Date of most recent activity (log, time entry, photo,
//     material delivery), or null if no activity yet.
//   - lastContactForClient() aggregates across all the client's jobs.
//   - daysSinceActivity() / activityBadgeStyle() / activityLabel()
//     for consistent display across surfaces.
//   - Applied to:
//     - Jobs list collapsed row — "Today / 1d ago / 3d ago" badge
//       on Active jobs only (silent on Completed/Lost to reduce noise).
//     - Clients list cards — "Last contact: Xd ago" pill, only when
//       client has at least one job.
//     - LeadCards already had touchBadgeColor from v1.1 — left alone.
//
// PHOTO TIMELINE:
//   - PhotoGallery now has Grid/Timeline view toggle.
//   - Grid is unchanged (existing aspect-square thumbnails with phase
//     badge overlay).
//   - Timeline groups photos by day, sorted newest first. Each day has
//     a sticky header with date, photo count, and Clock icon. Each
//     photo renders as a horizontal card: 128x128 thumbnail + phase
//     badge + time + caption (or "No caption" italic placeholder).
//   - Phase filter still works on both views.
//   - Empty state unchanged.
//
// QOL BUNDLE:
//
// TAB NOTIFICATION BADGES:
//   - Extended the existing Daily Logs alert pattern to:
//     - Pipeline tab — count of stale leads (>7d since last_touch_at,
//       not lost/won/archived). Amber badge.
//     - Jobs tab — count of jobs with active lien warning (within
//       30d of MI lien deadline or expired). Rose badge — more urgent.
//   - Mobile hamburger dot now reflects sum across all three.
//   - 9+ overflow handling (shows "9+" instead of double-digit).
//
// JOBS FILTER PERSISTENCE:
//   - Jobs.filter and Jobs.search now persist via localStorage.
//   - Survives tab switches AND full page reloads.
//   - localStorage keys: northshore_jobs_filter, northshore_jobs_search.
//   - Wrapped in try/catch (storage may be quota-exceeded or disabled).
//
// TOAST UNDO:
//   - ToastProvider extended with action support — backward compatible.
//     Existing toast.success(msg, dur) still works. New API:
//     toast.success(msg, { duration: 6000, action: { label, onClick } }).
//   - Wired to Pipeline lead archive — 6-second window to undo via
//     supabase update + local state restore.
//   - Patten ready to extend to other destructive actions in v1.3.x.
//
// NO SQL CHANGES. No new dependencies.
// ================================================================
// NORTHSHORE OS v1.2.0 — Apr 27 2026 — Lien Countdown + utilities
// FIRST MINOR VERSION since v1.1 Pipeline. This is a real feature
// release, not just a patch.
//
// LIEN COUNTDOWN (the moat feature):
// - New helper: lienDeadlineFor(job, dailyLogs, timeEntries, materials)
//   Computes last labor/material date, applies MI Construction Lien
//   Act 90-day window, returns daysRemaining + urgency tier.
// - Per-job lien countdown badge in Jobs tab (only shows when within
//   30d of deadline OR expired — silent on safe jobs to avoid noise).
// - Dashboard "Lien Deadlines" widget (PRIORITY 1.5) — shows up to 5
//   most urgent jobs sorted by daysRemaining, click jumps to Jobs.
//   Hidden when no urgent deadlines exist.
// - Urgency tiers: safe (>30d, hidden), warning (8-30d, amber),
//   critical (1-7d, rose), expired (<0d, red with "ago" suffix).
// - Conservative calculation: uses daily_logs + time_entries only,
//   not material_deliveries (which lives in per-job state, not
//   AppInner). If a material delivery comes AFTER last labor, the
//   real deadline is later than what's shown — surfacing earlier is
//   the safer side to err on (Connor files lien earlier than
//   strictly necessary, no harm done).
//
// PHONE NORMALIZATION:
// - normalizePhone(input) → digits-only for storage. (231) 555-1234,
//   2315551234, 231-555-1234, 231.555.1234, +1 231 555 1234 all
//   normalize to "2315551234" — bulletproof dedupe.
// - formatPhone() pre-existed at line 575, reused for display.
// - Applied to: AddLeadModal save, LeadDetailDrawer save (with
//   format-on-blur for input), ClientQuickAddModal save (with
//   format-on-blur), Clients form save (insert + update both).
// - Existing Clients form's `payload = { name, email, phone, ... }`
//   was passing raw input without trim — also fixed (trims + nulls
//   empty strings).
//
// EMAIL VALIDATION (loose with soft warning):
// - isValidEmail(input) — regex /^.+@.+\..+$/, blocks nothing.
// - emailWarning(input) — returns specific warning text or null.
// - Soft amber warning under email field in: AddLeadModal,
//   LeadDetailDrawer, ClientQuickAddModal. Doesn't block save.
// - Catches: missing @, missing dot after @, leading/trailing dots
//   in domain. Doesn't catch semantic typos like .con vs .com (that
//   would require email verification, out of scope).
//
// NO SQL CHANGES. No new tables. No new dependencies.
// ================================================================
// NORTHSHORE OS v1.1.6 — Apr 27 2026 — Tab routing deadlock — REAL FIX
// - Fix: empty-tab-after-Pipeline bug, take 3. Two prior patches
//        (v1.1.2 ghost-overlay, v1.1.4 onJumpToJob racing state)
//        addressed specific TRIGGERS but not the underlying
//        MECHANISM. The mechanism: AppInner had an
//        <AnimatePresence mode="wait"> wrapping all tab content,
//        present since before Pipeline existed. mode="wait" holds
//        the old motion.div in DOM and waits for its exit animation
//        to fully complete before mounting the new tab. Pipeline
//        introduced nested AnimatePresences and many concurrent
//        animations (drag transforms, layout springs, modal fades,
//        LeadCard hover springs). When a tab change happened while
//        ANY of those animations were mid-flight, the outer
//        mode="wait" would deadlock — never proceed past wait, old
//        motion.div stays empty (because `tab === "Pipeline"` is
//        now false so its conditional renders nothing), new tab
//        never mounts. Result: empty content area, footer visible,
//        nav highlighted on the new tab.
//        Fix: removed AnimatePresence + motion.div wrapper from
//        tab routing entirely. Tab switches are now instant.
//        Lost: 200ms fade-in animation between tabs.
//        Gained: bulletproof tab navigation that can't deadlock.
//        ErrorBoundary still wraps each tab for crash recovery.
// - Lesson: when a bug recurs after two targeted patches, the
//        problem is upstream of where you've been looking. Stop
//        patching triggers. Find the mechanism and remove it.
// ================================================================
// NORTHSHORE OS v1.1.5b — Apr 27 2026 — Build hotfix
// - Fix: v1.1.5 file had a missing `function GlobalStyles() {`
//        declaration line. The ErrorBoundary str_replace insertion
//        in v1.1.4 accidentally consumed the function declaration
//        but left the body, leaving `return (` floating outside
//        any function. node --check tolerated it; ESLint with
//        babel-parser (what react-scripts/Vercel use) correctly
//        rejected it: "'return' outside of function. (293:2)".
//        Pre-flight lesson: node --check alone is insufficient —
//        need to mimic Vercel's stricter parse before shipping.
// ================================================================
// NORTHSHORE OS v1.1.5 — Apr 27 2026 — clients.address unblocked
// - SQL: clients.address column added via migration
//        (v1.1.5-clients-address-migration.sql).
// - This unblocks Pipeline convert flow (Bug A from v1.1.4 audit)
//        AND the latent bug in the existing Clients form, which
//        would have failed the first time a user typed an address
//        into a manually-added client.
// - Code: no changes — both insert sites already reference the
//        column correctly. SQL was the only missing piece.
// - Six latent risks from v1.1.4 audit remain flagged. Not patched
//        because each requires a design/UX decision Connor owns.
// ================================================================
// NORTHSHORE OS v1.1.4 — Apr 27 2026 — Full audit + preventative pass
// - Fix (Bug B): empty Jobs tab after clicking "Open job" in Won-banner.
//        Root cause: setDrawerLead(null) + setTab("Jobs") fired
//        simultaneously, deadlocking the outer AnimatePresence
//        (mode="wait") because the drawer's spring exit animation
//        never reported complete while Pipeline was unmounting.
//        Fix: don't manually close drawer in onJumpToJob — Pipeline
//        unmount handles cleanup. No racing state updates.
// - Add: ErrorBoundary component wrapping every tab. Render crashes
//        now show a recoverable error message with "Try again"
//        instead of silently producing an empty page. Closes the
//        entire class of "what happened to the content" mysteries.
// - Fix: handleUpdateLead now rolls back local state on supabase
//        failure (was leaving optimistic patch permanent on error).
// - Fix: handleAddLead now shows actual error message on failure
//        (was hiding the supabase reason behind generic toast).
// - Fix: daysSinceTouch clamps negative values to 0 — prevents
//        "-1d" badge display when client clock is ahead of DB.
// - Fix: LeadDetailDrawer now shows "Linked job no longer exists"
//        when won_job_id references a deleted job.
// - Fix: Jobs.filteredJobs defensive null guard — malformed job
//        entries skip silently instead of crashing the whole tab.
// - Add: Pipeline console-warns when leads have unrecognized stage
//        values (catches schema drift that would otherwise hide
//        cards from the board silently).
// - FLAGGED (waiting on Connor): clients.address column doesn't
//        exist in deployed schema — convert flow + Clients form
//        both reference it. Two-line fix either direction once
//        decided. See CHANGELOG.
// ================================================================
// NORTHSHORE OS v1.1.3 — Apr 27 2026 — Polished button system
// - Fix: buttons morphed/shrunk during saving state because the
//        global <Spinner /> component (a w-8 h-8 with py-12 wrapper)
//        was being rendered inline. Added <BtnSpinner /> — a small
//        w-4 h-4 inline spinner that matches icon footprint exactly.
//        Saving state now shows "Adding..." / "Converting..." /
//        "Saving..." text alongside the spinner, button width
//        stable across states.
// - Polish: full button styling overhaul. New .btn-polished class
//        system with:
//          • subtle 180deg gradient (lighter top → darker bottom)
//          • inner 1px white highlight at top (bevel effect)
//          • offset shadow + color-matched glow
//          • hover: brightness +5%, glow intensifies
//          • active/press: scale(0.97), satisfying tactile feel
//          • dedicated disabled style (.btn-muted) that doesn't
//            look like a render bug — slate gradient + readable
//            label like "No Changes"
//        Variants: btn-amber, btn-emerald, btn-rose, btn-slate,
//        btn-ghost-rose, btn-muted. Applied across all Pipeline
//        action buttons (Add Lead, Convert, Mark Lost, Archive,
//        Save Changes, Cancel, Show Lost).
// ================================================================
// NORTHSHORE OS v1.1.2 — Apr 27 2026 — Pipeline ghost-overlay fix
// - Fix: archiving a lead in Pipeline left a black overlay node
//        attached to the DOM, making other tabs render empty.
//        Root cause: AnimatePresence was placed INSIDE each modal
//        component instead of at the parent level wrapping the
//        conditional render. When the parent set drawerLead/etc to
//        null, the modal unmounted but the fixed-inset-0 overlay
//        wasn't cleaned up properly. Moved AnimatePresence to
//        Pipeline parent for all 4 modals (AddLead, LeadDetail,
//        Convert, MarkLost). Each conditional render is now
//        wrapped in its own AnimatePresence with a stable key.
// - Fix: Save Changes button looked uncolored when disabled —
//        opacity-50 on amber-500 looked broken, not intentional.
//        Now switches to a clean slate-800 disabled style with
//        "No Changes" label so state is clearly readable.
// ================================================================
// NORTHSHORE OS v1.1.1 — Apr 27 2026 — Pipeline polish patch
// - Fix: button icons + text were unaligned — added inline-flex
//        items-center to all Pipeline action buttons (Add Lead,
//        Save Changes, Convert, Mark Lost, Archive, etc).
// - Fix: "Failed to create job" on convert-to-Won. Was passing
//        an `address` column that doesn't exist on jobs table.
//        Removed; now matches existing Estimator job-creation
//        schema (name, client_id, status, budget, actual).
//        Lead's est_value flows into job.budget on convert.
// - Improve: error toasts now show the actual Supabase error
//        message so future schema mismatches are diagnosable.
// ================================================================
// NORTHSHORE OS v1.1.0 — Apr 27 2026 — Lead Pipeline (Kanban)
// - New: top-level "Pipeline" tab between Estimator and Jobs
// - New: 5-stage Kanban (New / Contacted / Site Visit / Estimate Sent / Won-Lost)
// - New: leads table + RLS + auto last_touch_at trigger
// - New: drag-drop between columns (HTML5 native, no extra deps)
// - New: AddLeadModal — quick capture with source dropdown
// - New: LeadDetailDrawer — slide-over (right) for full edit
// - New: Convert-to-Client+Job on drag to Won column
// - New: Soft delete to Lost column with optional reason
// - New: Days-since-touch badge per card (sets up v1.2 last-touch everywhere)
// - Aesthetic: layered surfaces, amber glow on stage headers,
//              tabular-nums for $, restrained hover scale
// - SQL: leads table required (see v1.1-pipeline-migration.sql)
// ================================================================
// NORTHSHORE OS v1.0.2 — Apr 27 2026 — Smoke test follow-ups
// - Fix: notary name validation now fires whenever a name is typed
//        (not just when "Notarized On" is also filled). Prevents
//        single-word names like "Wendy" from saving as drafts.
// - Fix: notarized-on date now requires both name and commission
//        expiration to be filled (was previously optional).
// - SQL: adds missing `crew` column to daily_logs table
//        (form was writing to it but column never existed).
// ================================================================
// NORTHSHORE OS v1.0.1 — Apr 27 2026 — Documents bug fixes
// - Fix: property_address fallback chain (job → client → placeholder)
// - Fix: owner_name fallback chain (job → client → placeholder)
// - Fix: notary commission expiration ≤ statement date now blocks save
// - Fix: notary name without space (no last name) now blocks save
// - Fix: warning blocks reflowed on word boundaries instead of mid-word
// - Add: visible data-gap warning banners in modals before generation
// ================================================================
// DOCUMENTS VAULT (Round 1 v1):
//   - Top-level Vault tab — central business-document repository
//   - Categories: Articles, Insurance, License, Vehicle, Tax, Employee,
//     Permit, Receipt, Other (with custom icons + colors)
//   - Drag-and-drop OR click-to-upload to non-public storage bucket
//   - Expiration tracking with Dashboard alert widget (30-day window)
//   - Version history (renew GLI policy → old version archived)
//   - Time-limited share links (e.g. 7-day COI link to GC)
//   - Audit log of every view/download/share (multi-user readiness)
//   - Soft delete (preserved history, restorable)
//   - Tag system w/ free-form metadata
//   - company_documents + company_document_events + company_document_shares
//     tables required (see documents-vault-migration.sql)
//   - Storage bucket "company-docs" (NOT public) required — see SQL footer
// TOOL ROI DATABASE:
//   - Top-level Tools tab — master tool inventory + ROI dashboard
//   - Per-tool: brand, model #, serial #, purchase price, supplier,
//     receipt photo, business-use %, depreciation method
//   - Section 179 + MACRS 5/7-yr + bonus depreciation tracking
//   - Per-tool ROI: total hours used × labor rate = earned revenue;
//     (earned - cost) / cost = ROI %; "earning its keep" / "ghost tool" flags
//   - Job-attribution: link tool uses to specific jobs for cost-per-job
//   - Maintenance log w/ auto-reset on service; next_service_due alerts
//   - Year-end tax report (CPA-ready Section 179 summary, total deductions)
//   - Anti-ROI view: tools never used / underutilized / overdue service
//   - Status: active / in_repair / lost / stolen / sold / retired
//   - Soft delete (preserves tax history)
//   - tools + tool_uses + tool_maintenance tables required
//     (see tool-roi-migration.sql)
//   - Storage bucket "tool-receipts" (NOT public) required
// ================================================================

// ================================================================
// GLOBAL STYLES
// Custom scrollbars + keyframes injected once at app root
// ================================================================
// ================================================================
// ERROR BOUNDARY (v1.1.4) — Surfaces render errors instead of
// silently unmounting subtree. Wrap each tab's content so a crash
// in Pipeline doesn't blank out the whole app, and a crash in Jobs
// shows a recoverable error message instead of an empty page.
// ================================================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Render crash in", this.props.label || "subtree", error, info);
    this.setState({ info });
  }
  reset = () => this.setState({ error: null, info: null });
  render() {
    if (this.state.error) {
      return (
        <div className="bg-rose-950/30 border border-rose-900/60 rounded-2xl p-6 my-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-rose-200 font-semibold mb-1">
                Something broke in {this.props.label || "this view"}
              </div>
              <div className="text-rose-300/80 text-sm mb-3">
                The app caught the error so the rest of the page still works.
                Switch to another tab and back, or reload to recover.
              </div>
              <details className="text-xs text-rose-300/70">
                <summary className="cursor-pointer hover:text-rose-200">Technical detail</summary>
                <pre className="mt-2 p-2 bg-black/40 rounded overflow-x-auto whitespace-pre-wrap break-words">
                  {String(this.state.error?.message || this.state.error)}
                </pre>
              </details>
              <button
                onClick={this.reset}
                className="mt-3 px-3 py-1.5 bg-rose-900/40 hover:bg-rose-900/60 border border-rose-800 rounded text-rose-100 text-xs font-medium"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


function GlobalStyles() {
  return (
    <style>{`
      /* Custom scrollbar - dark theme friendly */
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: #0f172a; }
      ::-webkit-scrollbar-thumb { background: #334155; border-radius: 5px; border: 2px solid #0f172a; }
      ::-webkit-scrollbar-thumb:hover { background: #475569; }

      /* Slide-in animation for toasts */
      @keyframes slideIn {
        from { transform: translateX(20px); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
      }

      /* Skeleton shimmer */
      @keyframes shimmer {
        0% { background-position: -1000px 0; }
        100% { background-position: 1000px 0; }
      }
      .skeleton {
        background: linear-gradient(90deg, #1e293b 0%, #334155 50%, #1e293b 100%);
        background-size: 1000px 100%;
        animation: shimmer 2s infinite linear;
      }

      /* Smoother focus rings on inputs */
      input:focus-visible, select:focus-visible, textarea:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.4);
      }

      /* Disable spinners on number inputs (cleaner look) */
      input[type="number"]::-webkit-inner-spin-button,
      input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      input[type="number"] { -moz-appearance: textfield; }

      /* ============================================================
         POLISHED BUTTON SYSTEM
         Framer-grade: gradient body, inner highlight, offset shadow,
         color-matched glow, scale-down on press. Use .btn-polished
         + a color modifier (.btn-amber / .btn-emerald / .btn-rose
         / .btn-slate / .btn-ghost). Always pair with inline-flex
         items-center on the parent for icon+text alignment.
         ============================================================ */
      .btn-polished {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        border-radius: 0.625rem;
        padding: 0.5rem 1rem;
        transition: transform 0.12s cubic-bezier(0.4, 0, 0.2, 1),
                    box-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1),
                    filter 0.12s ease;
        will-change: transform, box-shadow;
        isolation: isolate;
      }
      .btn-polished::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 50%, rgba(0,0,0,0.10) 100%);
        opacity: 1;
        z-index: 1;
      }
      .btn-polished > * { position: relative; z-index: 2; }
      .btn-polished:hover { filter: brightness(1.05); }
      .btn-polished:active:not(:disabled) { transform: scale(0.97); }
      .btn-polished:disabled {
        cursor: not-allowed;
        filter: saturate(0.3) brightness(0.7);
      }

      /* Amber primary */
      .btn-amber {
        background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%);
        color: #0f172a;
        box-shadow: 0 1px 0 0 rgba(255,255,255,0.3) inset,
                    0 6px 20px -4px rgba(245, 158, 11, 0.45),
                    0 2px 6px -1px rgba(0,0,0,0.3);
      }
      .btn-amber:hover:not(:disabled) {
        box-shadow: 0 1px 0 0 rgba(255,255,255,0.4) inset,
                    0 8px 28px -4px rgba(245, 158, 11, 0.6),
                    0 3px 10px -1px rgba(0,0,0,0.35);
      }

      /* Emerald success */
      .btn-emerald {
        background: linear-gradient(180deg, #34d399 0%, #10b981 100%);
        color: #0f172a;
        box-shadow: 0 1px 0 0 rgba(255,255,255,0.3) inset,
                    0 6px 20px -4px rgba(16, 185, 129, 0.5),
                    0 2px 6px -1px rgba(0,0,0,0.3);
      }
      .btn-emerald:hover:not(:disabled) {
        box-shadow: 0 1px 0 0 rgba(255,255,255,0.4) inset,
                    0 8px 28px -4px rgba(16, 185, 129, 0.65),
                    0 3px 10px -1px rgba(0,0,0,0.35);
      }

      /* Rose danger */
      .btn-rose {
        background: linear-gradient(180deg, #fb7185 0%, #e11d48 100%);
        color: #ffffff;
        box-shadow: 0 1px 0 0 rgba(255,255,255,0.25) inset,
                    0 6px 20px -4px rgba(225, 29, 72, 0.5),
                    0 2px 6px -1px rgba(0,0,0,0.3);
      }
      .btn-rose:hover:not(:disabled) {
        box-shadow: 0 1px 0 0 rgba(255,255,255,0.35) inset,
                    0 8px 28px -4px rgba(225, 29, 72, 0.65),
                    0 3px 10px -1px rgba(0,0,0,0.35);
      }

      /* Slate secondary (cancel, neutral) */
      .btn-slate {
        background: linear-gradient(180deg, #334155 0%, #1e293b 100%);
        color: #e2e8f0;
        box-shadow: 0 1px 0 0 rgba(255,255,255,0.06) inset,
                    0 1px 0 0 rgba(0,0,0,0.4),
                    0 2px 6px -1px rgba(0,0,0,0.4);
        border: 1px solid rgba(71, 85, 105, 0.6);
      }
      .btn-slate:hover:not(:disabled) {
        background: linear-gradient(180deg, #475569 0%, #334155 100%);
      }

      /* Ghost (subtle, archive-style danger) */
      .btn-ghost-rose {
        background: rgba(76, 5, 25, 0.4);
        color: #fda4af;
        border: 1px solid rgba(159, 18, 57, 0.5);
        box-shadow: 0 2px 6px -1px rgba(0,0,0,0.3);
      }
      .btn-ghost-rose:hover:not(:disabled) {
        background: rgba(127, 29, 29, 0.5);
        border-color: rgba(225, 29, 72, 0.6);
        color: #fecdd3;
      }

      /* Disabled-but-readable (no-changes-yet state) */
      .btn-muted {
        background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
        color: #64748b;
        border: 1px solid rgba(51, 65, 85, 0.6);
        cursor: not-allowed;
        opacity: 1 !important;  /* override Btn component's disabled:opacity-50 */
        filter: none !important; /* override .btn-polished:disabled filter */
      }
      .btn-polished.btn-muted::before { display: none; } /* no inner highlight on muted */
    `}</style>
  );
}

// ================================================================
// ANIMATED NUMBER (CountUp)
// Smoothly animates from 0 to target value on mount
// ================================================================
function CountUp({ value, prefix = "", duration = 0.8, format = (v) => v.toLocaleString() }) {
  const [display, setDisplay] = useState(0);
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);
  const targetRef = useRef(value);

  useEffect(() => {
    targetRef.current = value;
    startTimeRef.current = null;
    const startValue = display;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (targetRef.current - startValue) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(targetRef.current);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]); // intentionally omitting `display` — startValue captured once per value change

  return <span>{prefix}{format(display)}</span>;
}

// ================================================================
// COMPANY HELPER
// ================================================================
function getCompany(s) {
  return {
    name:    s.companyName    || "Northshore Mechanical & Construction LLC",
    phone:   s.companyPhone   || "(231) 760-7013",
    email:   s.companyEmail   || "connor@northshorebuildsmi.com",
    address: s.companyAddress || "1276 Sauter St, Muskegon, MI 49442",
    license: s.licenseNumber  || "242501434",
    website: s.website        || "northshorebuildsmi.com",
  };
}

// ================================================================
// LOGO  (tiny transparent PNG — placeholder)
// ================================================================
// This is a valid 1x1 transparent PNG so PDFs render without errors
// and the app builds clean on first paste. No action required to deploy.
//
// To swap in the real Northshore logo later: open your previous
// App.js, find the LOGO_BASE64 line, copy the long base64 string
// between the quotes, and replace the string below. One-line change.
// ================================================================
const LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// ================================================================
// UTILITIES
// ================================================================
const uid = () => Math.random().toString(36).slice(2, 10);

const currency = (n) =>
  `$${(Number(n) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (d) => {
  try { return new Date(d).toLocaleDateString(); }
  catch { return "—"; }
};

const round2 = (n) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const formatPhone = (phone) => {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
};

// Format minutes (or seconds via fromSeconds=true) as "Xh Ym" or "Ym" — used by ClockWidget + time history
const formatDuration = (minutes) => {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
};

// Hook that re-renders every `intervalMs` (default 60s) — drives the live clock widget
const useTicker = (intervalMs = 60000, isActive = true) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, isActive]);
};

const statusColor = (s) => {
  const v = (s || "").toLowerCase();
  if (v === "approved" || v === "active")    return "text-emerald-400";
  if (v === "rejected" || v === "overdue" || v === "lost") return "text-rose-400";
  if (v === "sent"     || v === "estimating") return "text-yellow-300";
  if (v === "completed")                      return "text-blue-400";
  if (v === "paused")                         return "text-slate-400";
  return "text-slate-300";
};

// ================================================================
// UI PRIMITIVES
// ================================================================
function Btn({ children, className = "", ...props }) {
  return (
    <button
      className={`px-4 py-2 rounded-lg font-medium bg-slate-800 text-white
        hover:bg-slate-700 transition-colors disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ className = "", children }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg ${className}`}>
      {children}
    </div>
  );
}

function CardContent({ className = "", children }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

function Inp({ className = "", ...props }) {
  return (
    <input
      className={`px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200
        focus:outline-none focus:ring-2 focus:ring-amber-400/50 w-full text-sm ${className}`}
      {...props}
    />
  );
}

function Sel({ className = "", children, ...props }) {
  return (
    <select
      className={`px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200
        focus:outline-none focus:ring-2 focus:ring-amber-400/50 w-full text-sm ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// AutoTextarea — auto-resizes height to fit content. v1.4 QOL.
// Eliminates fixed-row textareas that show 2 lines of a 5-line note.
// minRows sets initial height; grows up to maxRows then scrolls.
function AutoTextarea({ value, onChange, minRows = 2, maxRows = 12, className = "", ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // Each line is roughly 1.5em; cap height at maxRows
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const maxPx = lineHeight * maxRows + 16; // 16px = padding
    el.style.height = Math.min(el.scrollHeight, maxPx) + "px";
  }, [value, maxRows]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      rows={minRows}
      className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200
        focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none ${className}`}
      {...props}
    />
  );
}

function Badge({ label, color }) {
  const colors = {
    green: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
    yellow: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
    red:   "bg-rose-900/50 text-rose-300 border-rose-700",
    blue:  "bg-blue-900/50 text-blue-300 border-blue-700",
    gray:  "bg-slate-800 text-slate-300 border-slate-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs border ${colors[color] || colors.gray}`}>
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Inline button spinner — matches w-4 h-4 icon footprint so buttons don't morph during save
function BtnSpinner({ className = "" }) {
  return (
    <div className={`w-4 h-4 mr-1.5 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />
  );
}

// ----------------------------------------------------------------
// Tabs
// ----------------------------------------------------------------
const TabsCtx = createContext({ value: null, setValue: () => {} });

function Tabs({ value, onValueChange, children }) {
  return (
    <TabsCtx.Provider value={{ value, setValue: onValueChange || (() => {}) }}>
      <div>{children}</div>
    </TabsCtx.Provider>
  );
}

function TabsList({ className = "", children }) {
  return (
    <div className={`flex flex-wrap gap-2 mb-5 ${className}`}>{children}</div>
  );
}

function TabsTrigger({ value, children }) {
  const { value: cur, setValue } = useContext(TabsCtx);
  const active = cur === value;
  return (
    <button
      onClick={() => setValue(value)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
        active
          ? "bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-900/30"
          : "bg-slate-900 text-slate-300 border-gray-700 hover:bg-slate-800 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function TabsContent({ value, children }) {
  const { value: cur } = useContext(TabsCtx);
  return cur === value ? <div>{children}</div> : null;
}

// ================================================================
// TOAST NOTIFICATION SYSTEM
// Replaces alert() — non-blocking, auto-dismissing notifications
// Usage: const toast = useToast(); toast.success("Saved!");
// ================================================================
const ToastContext = createContext({
  toasts: [],
  toast: { success: () => {}, error: () => {}, info: () => {}, warn: () => {} },
});

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // v1.3 — action support (e.g. Undo button on archive/delete toasts)
  const push = useCallback((type, message, duration = 3500, action = null) => {
    const id = Math.random().toString(36).slice(2, 10);
    setToasts((prev) => [...prev, { id, type, message, action }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  // Helper: accept either a number (legacy duration) or an options object
  // ({ duration, action: { label, onClick } }). Keeps backward compat.
  const _resolve = (type, msg, opts, defaultDur) => {
    if (typeof opts === "number") return push(type, msg, opts);
    if (opts && typeof opts === "object") {
      return push(type, msg, opts.duration ?? defaultDur, opts.action ?? null);
    }
    return push(type, msg, defaultDur);
  };

  const toast = {
    success: (msg, opts) => _resolve("success", msg, opts, 3500),
    error:   (msg, opts) => _resolve("error",   msg, opts, 5000),
    info:    (msg, opts) => _resolve("info",    msg, opts, 3500),
    warn:    (msg, opts) => _resolve("warn",    msg, opts, 4500),
  };

  const styles = {
    success: "bg-emerald-900/90 border-emerald-600 text-emerald-100",
    error:   "bg-rose-900/90 border-rose-600 text-rose-100",
    info:    "bg-slate-900/90 border-slate-600 text-slate-100",
    warn:    "bg-amber-900/90 border-amber-600 text-amber-100",
  };

  const icons = {
    success: CheckCircle2,
    error:   XCircle,
    info:    Info,
    warn:    AlertTriangle,
  };

  return (
    <ToastContext.Provider value={{ toasts, toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 24, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className={`pointer-events-auto px-4 py-3 rounded-lg border-2 shadow-xl backdrop-blur-md
                  flex items-start gap-3 ${styles[t.type]}`}
              >
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="flex-1 text-sm">{t.message}</p>
                {t.action && (
                  <button
                    onClick={() => {
                      try { t.action.onClick(); } catch (e) { console.error("Toast action failed:", e); }
                      dismiss(t.id);
                    }}
                    className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors whitespace-nowrap"
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  onClick={() => dismiss(t.id)}
                  className="opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function useToast() {
  return useContext(ToastContext).toast;
}

// ================================================================
// CONFIRMATION DIALOG SYSTEM
// Replaces window.confirm — branded modal with custom messaging
// Usage: const confirm = useConfirm(); const ok = await confirm({title, message, danger: true});
// ================================================================
const ConfirmContext = createContext({ confirm: async () => false });

function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  // state shape: { title, message, confirmText, cancelText, danger, resolve }

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setState({
        title:       opts.title       || "Are you sure?",
        message:     opts.message     || "",
        confirmText: opts.confirmText || "Confirm",
        cancelText:  opts.cancelText  || "Cancel",
        danger:      opts.danger      || false,
        details:     opts.details     || null,
        resolve,
      });
    });
  }, []);

  const handleClose = (result) => {
    if (state?.resolve) state.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {state && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4"
            onClick={() => handleClose(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <h3 className={`text-lg font-bold mb-2 flex items-center gap-2 ${state.danger ? "text-rose-300" : "text-slate-100"}`}>
                {state.danger && <AlertTriangle className="w-5 h-5" />}
                {state.title}
              </h3>
              {state.message && (
                <p className="text-slate-400 text-sm mb-3 whitespace-pre-line">{state.message}</p>
              )}
              {state.details && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 mb-4 text-xs text-slate-300 max-h-40 overflow-y-auto whitespace-pre-line">
                  {state.details}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => handleClose(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  {state.cancelText}
                </button>
                <button
                  onClick={() => handleClose(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                    state.danger
                      ? "bg-rose-600 text-white hover:bg-rose-500"
                      : "bg-amber-400 text-black hover:bg-amber-500"
                  }`}
                >
                  {state.danger && <Trash2 className="w-4 h-4" />}
                  {state.confirmText}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

function useConfirm() {
  return useContext(ConfirmContext).confirm;
}

// ================================================================
// VOICE INPUT HOOK (v1.4)
// Wraps the browser's Web Speech API (SpeechRecognition).
// Free, on-device, no API key, no network round-trip.
// Accuracy is good for jobsite-relevant vocabulary.
//
// Returns:
//   supported   — boolean: browser supports the API
//   listening   — boolean: currently capturing audio
//   transcript  — interim + final results combined as a string
//   start()     — begin capturing (auto-stops on silence per SpeechRecognition default)
//   stop()      — manually halt
//   reset()     — clear transcript
//
// Continuous mode is ON — keeps listening through pauses until
// stop() called or browser auto-stops on extended silence.
//
// Browser support as of 2026:
//   Chrome / Edge / Safari (iOS 14.5+) — native, works offline
//   Firefox — flag-gated, treat as unsupported
//   Mobile Chrome — works, but requires page interaction first
// ================================================================
function useVoiceInput({ continuous = true, lang = "en-US" } = {}) {
  const SR = typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const supported = !!SR;
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  // Track final-vs-interim so we can build up across multiple recognition events
  const finalBufferRef = useRef("");

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch (e) { /* already stopped */ }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    finalBufferRef.current = "";
    setTranscript("");
  }, []);

  const start = useCallback(() => {
    if (!supported) return;
    if (listening) return;
    const recognition = new SR();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalBufferRef.current += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript(finalBufferRef.current + interim);
    };
    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch (e) {
      console.warn("Speech recognition start failed:", e);
      setListening(false);
    }
  }, [SR, supported, listening, continuous, lang]);

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return { supported, listening, transcript, start, stop, reset };
}

// ================================================================
// VoiceMicButton — drop-in voice input control (v1.4)
//
// Wraps useVoiceInput in a single-button UI. Press to start,
// press again to stop. Live transcript flows into onTranscript()
// callback so the parent can update its text field state.
//
// Props:
//   onTranscript(text)  — called continuously as words arrive.
//                         Parent decides whether to append or replace.
//   appendMode          — if true, appends to existing field on stop;
//                         if false (default), replaces.
//   currentValue        — used by appendMode to know what to add to.
//   onChange(newValue)  — called when transcript completes (on stop).
//   className           — optional positioning override
//   title               — tooltip
// ================================================================
function VoiceMicButton({ onChange, currentValue = "", appendMode = true, className = "", title = "Voice input" }) {
  const voice = useVoiceInput();
  const startedFromValueRef = useRef("");

  if (!voice.supported) {
    // Don't render anything — gracefully degrade. No broken icon.
    return null;
  }

  const toggle = () => {
    if (voice.listening) {
      voice.stop();
      // Final write: combine the snapshot we started from with the captured transcript.
      const captured = voice.transcript.trim();
      if (captured) {
        if (appendMode) {
          const sep = startedFromValueRef.current && !startedFromValueRef.current.endsWith(" ") ? " " : "";
          onChange(startedFromValueRef.current + sep + captured);
        } else {
          onChange(captured);
        }
      }
      voice.reset();
    } else {
      // Capture the current value at start time so live updates stay correct
      startedFromValueRef.current = appendMode ? (currentValue || "") : "";
      voice.reset();
      voice.start();
    }
  };

  // Show live transcript by passing it up while listening
  useEffect(() => {
    if (!voice.listening) return;
    const live = voice.transcript;
    if (!live) return;
    if (appendMode) {
      const sep = startedFromValueRef.current && !startedFromValueRef.current.endsWith(" ") ? " " : "";
      onChange(startedFromValueRef.current + sep + live);
    } else {
      onChange(live);
    }
  }, [voice.transcript, voice.listening, appendMode, onChange]);

  return (
    <button
      type="button"
      onClick={toggle}
      className={`relative inline-flex items-center justify-center w-7 h-7 rounded-md transition-all flex-shrink-0 ${
        voice.listening
          ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-amber-400"
      } ${className}`}
      title={voice.listening ? "Stop listening" : title}
      aria-label={voice.listening ? "Stop voice input" : "Start voice input"}
    >
      {voice.listening ? (
        <>
          <MicOff className="w-3.5 h-3.5" />
          {/* Pulse animation for active recording */}
          <span className="absolute inset-0 rounded-md animate-ping bg-rose-400/40" />
        </>
      ) : (
        <Mic className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// ================================================================
// PROPOSAL GENERATOR
// ================================================================
function generateProposalHTML({ estimate, client, settings }) {
  const co = getCompany(settings);
  const fmt = (n) =>
    `$${(Number(n) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const estNum = `NSB-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  const mTotal = Number(estimate.materials_total) ||
    (estimate.materials || []).reduce((s, m) => s + m.cost * m.qty, 0);
  const lTotal = Number(estimate.labor_total) ||
    (estimate.labor || []).reduce((s, l) => s + l.rate * l.hours, 0);
  const subtotal    = mTotal + lTotal;
  const cPct        = Number(estimate.contingency_pct) || 10;
  const oPct        = Number(estimate.overhead_pct)    || Number(settings.overheadPct) || 12.5;
  const pPct        = Number(estimate.profit_pct)      || Number(settings.profitPct)   || 10;
  const contingency = subtotal * (cPct / 100);
  const overhead    = subtotal * (oPct / 100);
  const profit      = subtotal * (pPct / 100);
  const grandTotal  = Number(estimate.grand_total) || (subtotal + contingency + overhead + profit);
  const deposit     = grandTotal * 0.40;
  const midpay      = grandTotal * 0.40;
  const final       = grandTotal * 0.20;
  const weeks       = Number(estimate.estimated_weeks) || 4;

  const clientName  = client ? client.name : "Valued Client";
  const scopeText   = (
    estimate.scope_of_work ||
    "Detailed scope of work per site visit and client agreement. All work performed per Michigan Residential Building Code and applicable local ordinances."
  ).replace(/\n/g, "<br>");

  const projectAddr = estimate.project_address ||
    (client ? `${clientName} Property` : "To Be Confirmed");

  const exclusionsRaw = estimate.exclusions ||
    "Permit fees unless otherwise specified in writing. Landscaping restoration after construction. " +
    "Interior painting of new work unless explicitly included. Furniture removal or storage. " +
    "Dumpster rental unless noted. Damage or additional work required due to unforeseen conditions " +
    "discovered during demolition or construction.";

  const exclusionItems = exclusionsRaw
    .split(/\.\s+/)
    .filter((e) => e.trim())
    .map((e) => e.replace(/\.$/, ""));

  const getTimeline = () => {
    if (weeks <= 2) return [
      { w: "Week 1",   t: "Site preparation, demolition, and material delivery" },
      { w: "Week 2",   t: "Primary construction, rough inspections, punch list, and cleanup" },
    ];
    if (weeks <= 4) return [
      { w: "Week 1",   t: "Site preparation, demolition, and material staging" },
      { w: "Week 2",   t: "Framing and structural work" },
      { w: "Week 3",   t: "Mechanical, electrical, and plumbing rough-in" },
      { w: "Week 4",   t: "Finish work, inspections, final cleanup, and walkthrough" },
    ];
    if (weeks <= 6) return [
      { w: "Weeks 1–2", t: "Site mobilization, demolition, permits confirmed, and material ordering" },
      { w: "Weeks 3–4", t: "Framing, structural, and rough-in work with inspections" },
      { w: "Weeks 5–6", t: "Insulation, drywall, finish work, fixtures, and final walkthrough" },
    ];
    return [
      { w: "Weeks 1–2",       t: "Site mobilization, demolition, and permit coordination" },
      { w: "Weeks 3–4",       t: "Foundation, framing, and structural work" },
      { w: "Weeks 5–6",       t: "Rough-in: mechanical, electrical, and plumbing — inspections" },
      { w: "Weeks 7–8",       t: "Insulation, drywall, and exterior close-up" },
      { w: `Weeks 9–${weeks}`, t: "Finish work, trim, fixtures, final inspections, and walkthrough" },
    ];
  };

  const timeline = getTimeline();

  const logoImg = `<img src="data:image/png;base64,${LOGO_BASE64}"
    alt="Northshore Mechanical & Construction"
    style="height:88px;width:auto;display:block;" />`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Northshore — Proposal ${estNum}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; background: #fff; font-size: 11pt; line-height: 1.65; }

    /* ACTION BAR */
    .action-bar { background: #0d1f33; padding: 10px 36px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 99; }
    .action-bar span { color: #8a9aaa; font-family: Arial, sans-serif; font-size: 11px; }
    .btn-pdf { background: #c45c26; color: #fff; border: none; padding: 9px 22px; font-size: 12px; font-weight: 700; cursor: pointer; border-radius: 3px; font-family: Arial, sans-serif; letter-spacing: 1px; }
    .btn-pdf:hover { background: #a84e22; }

    /* HEADER */
    .header { background: #0d1f33; color: #f5f0e8; padding: 28px 40px; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
    .logo-row { display: flex; align-items: center; gap: 18px; }
    .co-name { font-family: Arial, Helvetica, sans-serif; font-size: 19px; font-weight: 700; letter-spacing: 3px; color: #f5f0e8; }
    .co-sub { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 4px; color: #c45c26; margin-top: 3px; text-transform: uppercase; }
    .co-contact { font-family: Arial, sans-serif; font-size: 10px; color: #8a9aaa; line-height: 2; }
    .prop-meta { text-align: right; }
    .prop-title { font-family: Arial, sans-serif; font-size: 24px; font-weight: 700; letter-spacing: 5px; color: #f5f0e8; }
    .prop-num { font-family: Arial, sans-serif; font-size: 11px; color: #c45c26; margin-top: 5px; letter-spacing: 1px; }
    .prop-dates { font-family: Arial, sans-serif; font-size: 9.5px; color: #8a9aaa; margin-top: 5px; line-height: 1.9; }

    /* ACCENT BAR */
    .accent { height: 3px; background: linear-gradient(90deg, #c45c26, #e07340); }

    /* LAYOUT */
    .wrap { max-width: 800px; margin: 0 auto; padding: 0 40px; }
    .sec { margin: 26px 0; }
    .sh { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 4px; text-transform: uppercase; color: #c45c26; border-bottom: 1px solid #e8e0d0; padding-bottom: 5px; margin-bottom: 13px; font-weight: 700; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
    hr.div { border: none; border-top: 1px solid #e8e0d0; margin: 4px 0; }

    /* CLIENT/PROJECT INFO */
    .lbl { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 3px; text-transform: uppercase; color: #999; margin-bottom: 5px; }
    .info-name { font-size: 15px; font-weight: 700; color: #0d1f33; margin-bottom: 3px; }
    .info-detail { font-size: 10pt; color: #555; line-height: 1.7; }

    /* SCOPE */
    .scope-box { background: #f9f7f4; border-left: 3px solid #c45c26; padding: 14px 18px; font-size: 11pt; color: #333; line-height: 1.8; }

    /* PRICING */
    .pt { width: 100%; border-collapse: collapse; }
    .pt td { padding: 9px 11px; border-bottom: 1px solid #f0ece6; font-size: 10.5pt; }
    .pt td:last-child { text-align: right; font-family: 'Courier New', monospace; }
    .pt .sub-row td { border-top: 2px solid #0d1f33; border-bottom: 2px solid #0d1f33; font-weight: 700; background: #f5f0e8; }
    .gt-box { background: #0d1f33; color: #f5f0e8; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
    .gt-lbl { font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 3px; text-transform: uppercase; }
    .gt-amt { font-family: Arial, sans-serif; font-size: 20px; font-weight: 700; color: #f5c842; }

    /* PAYMENT TABLE */
    .pay-table { width: 100%; border-collapse: collapse; }
    .pay-table th { background: #0d1f33; color: #f5f0e8; padding: 9px 13px; text-align: left; font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; }
    .pay-table td { padding: 9px 13px; border-bottom: 1px solid #e8e0d0; font-size: 10.5pt; }
    .pay-table .ar { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; }

    /* TIMELINE */
    .tl-item { display: flex; gap: 14px; margin-bottom: 8px; padding: 9px 13px; background: #f9f7f4; }
    .tl-wk { font-family: Arial, sans-serif; font-size: 8.5px; font-weight: 700; letter-spacing: 1px; color: #c45c26; text-transform: uppercase; min-width: 80px; padding-top: 2px; }
    .tl-task { font-size: 10.5pt; color: #333; }

    /* INCLUSIONS / EXCLUSIONS */
    .inc-list, .exc-list { list-style: none; }
    .inc-list li, .exc-list li { font-size: 10pt; padding: 5px 0; border-bottom: 1px solid #f0ece6; color: #333; line-height: 1.6; }
    .inc-list li::before { content: "✓  "; color: #2a7a4a; font-weight: 700; }
    .exc-list li::before { content: "—  "; color: #aaa; }

    /* WHY NORTHSHORE */
    .why-box { background: #0d1f33; padding: 22px 26px; }
    .why-ttl { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 4px; text-transform: uppercase; color: #c45c26; margin-bottom: 11px; font-weight: 700; }
    .why-txt { font-size: 10.5pt; line-height: 1.85; color: #ccc6bc; }
    .creds { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .cred { background: rgba(196,92,38,0.15); border: 1px solid rgba(196,92,38,0.4); padding: 5px 11px; font-family: Arial, sans-serif; font-size: 9.5px; letter-spacing: 0.3px; color: #f5f0e8; white-space: nowrap; border-radius: 3px; font-weight: 600; }

    /* TERMS */
    .terms-txt { font-size: 9pt; color: #555; line-height: 1.85; }
    .terms-txt p { margin-bottom: 8px; }
    .cancel-box { border: 2px solid #0d1f33; padding: 14px 18px; margin-top: 18px; background: #fff8f0; }
    .cancel-ttl { font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 2px; font-weight: 700; text-transform: uppercase; margin-bottom: 7px; color: #0d1f33; }
    .cancel-txt { font-size: 9pt; line-height: 1.75; color: #333; }

    /* SIGNATURES */
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 6px; }
    .sig-lbl { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: #999; margin-bottom: 5px; }
    .sig-name { font-size: 11pt; font-weight: 700; color: #0d1f33; margin-bottom: 18px; }
    .sig-line { border-bottom: 1px solid #0d1f33; height: 30px; margin-bottom: 3px; }
    .sig-sub { font-family: Arial, sans-serif; font-size: 8px; color: #bbb; letter-spacing: 1px; }
    .print-box { padding: 11px 14px; background: #f9f7f4; border: 1px solid #e8e0d0; margin-top: 16px; }
    .print-lbl { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: #999; margin-bottom: 5px; }
    .print-line { border-bottom: 1px solid #0d1f33; height: 26px; }

    /* FOOTER */
    .foot { background: #0d1f33; color: #8a9aaa; padding: 14px 40px; display: flex; justify-content: space-between; align-items: center; margin-top: 36px; font-family: Arial, sans-serif; font-size: 8.5px; }
    .foot-r { text-align: right; }

    /* PRINT */
    @media print {
      .action-bar { display: none !important; }
      body { font-size: 10pt; }
      .header { padding: 24px 32px; }
      .wrap { padding: 0 32px; }
      .sec { margin: 18px 0; }
      .foot { margin-top: 24px; }
      .keep-together,
      .why-box,
      .cancel-box,
      .sig-grid,
      .pay-table,
      .gt-box {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      @page { margin: 0.4in; size: letter; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>

<div class="action-bar">
  <span>Northshore OS — Proposal Preview &nbsp;|&nbsp; ${estNum}</span>
  <button class="btn-pdf" onclick="window.print()">⬇ Save as PDF / Print</button>
</div>

<div class="header">
  <div class="logo-row">
    ${logoImg}
    <div>
      <div class="co-contact">
        ${formatPhone(co.phone)} &nbsp;|&nbsp; ${co.email}<br>
        ${co.address} &nbsp;|&nbsp; ${co.website}<br>
        MI Residential Builder License #${co.license}
      </div>
    </div>
  </div>
  <div class="prop-meta">
    <div class="prop-title">PROPOSAL</div>
    <div class="prop-num">${estNum}</div>
    <div class="prop-dates">Date: ${date}<br>Valid Until: ${validUntil}</div>
  </div>
</div>
<div class="accent"></div>

<div class="wrap">

  <!-- CLIENT + PROJECT -->
  <div class="sec">
    <div class="two-col">
      <div>
        <div class="lbl">Prepared For</div>
        <div class="info-name">${clientName}</div>
        <div class="info-detail">
          ${client && client.phone ? formatPhone(client.phone) + "<br>" : ""}
          ${client && client.email ? client.email : ""}
        </div>
      </div>
      <div>
        <div class="lbl">Project</div>
        <div class="info-name">${estimate.name || "Project Proposal"}</div>
        <div class="info-detail">${projectAddr}</div>
      </div>
    </div>
  </div>

  <hr class="div">

  <!-- SCOPE OF WORK -->
  <div class="sec">
    <div class="sh">Scope of Work</div>
    <div class="scope-box">${scopeText}</div>
  </div>

  <!-- INVESTMENT SUMMARY -->
  <div class="sec">
    <div class="sh">Investment Summary</div>
    <table class="pt">
      <tr><td>Materials</td><td>${fmt(mTotal)}</td></tr>
      <tr><td>Labor</td><td>${fmt(lTotal)}</td></tr>
      <tr class="sub-row"><td>Subtotal</td><td>${fmt(subtotal)}</td></tr>
      <tr><td>Contingency &amp; Risk Allowance (${cPct}%)</td><td>${fmt(contingency)}</td></tr>
      <tr><td>Project Management &amp; Overhead (${oPct}%)</td><td>${fmt(overhead)}</td></tr>
    </table>
    <div class="gt-box">
      <span class="gt-lbl">Total Project Investment</span>
      <span class="gt-amt">${fmt(grandTotal)}</span>
    </div>
  </div>

  <!-- PAYMENT SCHEDULE -->
  <div class="sec">
    <div class="sh">Payment Schedule</div>
    <table class="pay-table">
      <thead>
        <tr>
          <th>Phase</th>
          <th>Milestone</th>
          <th class="ar">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Deposit — 40%</strong></td>
          <td>Due upon signed contract</td>
          <td class="ar">${fmt(deposit)}</td>
        </tr>
        <tr>
          <td><strong>Progress — 40%</strong></td>
          <td>Due at project midpoint</td>
          <td class="ar">${fmt(midpay)}</td>
        </tr>
        <tr>
          <td><strong>Completion — 20%</strong></td>
          <td>Due upon final walkthrough</td>
          <td class="ar">${fmt(final)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- TIMELINE -->
  <div class="sec">
    <div class="sh">Estimated Project Timeline</div>
    ${timeline.map((t) => `
      <div class="tl-item">
        <div class="tl-wk">${t.w}</div>
        <div class="tl-task">${t.t}</div>
      </div>`).join("")}
    <p style="font-size:9pt;color:#999;margin-top:9px;font-style:italic;">
      * Timeline is an estimate. Start date confirmed upon contract execution and deposit receipt.
      Subject to permitting timelines, material availability, and weather conditions.
    </p>
  </div>

  <!-- INCLUSIONS / EXCLUSIONS -->
  <div class="sec">
    <div class="two-col">
      <div>
        <div class="sh">What's Included</div>
        <ul class="inc-list">
          <li>All work described in scope above</li>
          <li>Labor by licensed, insured professionals</li>
          <li>Material procurement and staging</li>
          <li>Daily site cleanup and debris management</li>
          <li>Weekly progress communication</li>
          <li>Final walkthrough and punch list completion</li>
          <li>1-year workmanship warranty</li>
        </ul>
      </div>
      <div>
        <div class="sh">What's Not Included</div>
        <ul class="exc-list">
          ${exclusionItems.map((e) => `<li>${e}</li>`).join("")}
        </ul>
      </div>
    </div>
  </div>

  <!-- WHY NORTHSHORE -->
  <div class="sec keep-together">
    <div class="why-box">
      <div class="why-ttl">Why Northshore</div>
      <div class="why-txt">
        Connor Garza is a UA Journeyman Steamfitter, Journeyman Boilermaker, and licensed Michigan
        Residential Builder — one of the few contractors in West Michigan holding both union trade
        credentials and a residential builder's license. His father brings 21 years as a union
        boilermaker, 10+ years of HVAC expertise, and deep remodeling and drywall experience.
        Together, Northshore Mechanical &amp; Construction LLC self-performs the vast majority of
        your project — meaning fewer subcontractors, tighter coordination, and a finished product
        built right the first time.
      </div>
      <div class="creds">
        <span class="cred">UA Journeyman Steamfitter</span>
        <span class="cred">Journeyman Boilermaker</span>
        <span class="cred">MI Residential Builder #${co.license}</span>
        <span class="cred">EPRI Certified Rigger</span>
      </div>
    </div>
  </div>

  <!-- TERMS & CONDITIONS -->
  <div class="sec">
    <div class="sh">Terms &amp; Conditions</div>
    <div class="terms-txt">
      <p>This proposal is valid for 30 days from the date issued. Pricing is based on the scope of
      work described herein. Any changes to scope, materials, or conditions will be addressed via
      written change order approved by both parties before additional work proceeds.</p>

      <p>Northshore Mechanical &amp; Construction LLC is not responsible for unforeseen conditions
      discovered during construction including but not limited to: hidden water damage, mold,
      structural deficiencies, outdated electrical or plumbing systems, or subsurface conditions.
      A written change order will be issued before any additional work proceeds.</p>

      <p>Building permits are the responsibility of the homeowner unless otherwise agreed in writing.
      All work performed in compliance with applicable Michigan Building Codes and local ordinances.</p>

      <p>A finance charge of 1.5% per month may be applied to balances outstanding beyond 30 days
      of the due date. Northshore Mechanical &amp; Construction LLC reserves the right to suspend
      work on any project with a balance outstanding beyond 14 days past due.</p>

      <p>This proposal, upon signing by both parties, constitutes the entire agreement. No verbal
      representations shall be binding. All modifications must be in writing and signed by both
      parties. Michigan Residential Builder License #${co.license}.</p>
    </div>

    <div class="cancel-box">
      <div class="cancel-ttl">Notice of Right to Cancel — Required by Michigan Law</div>
      <div class="cancel-txt">
        <strong>You, the buyer, may cancel this transaction at any time prior to midnight of the
        third business day after the date of this transaction.</strong> If this contract was signed
        at your residence, you have three (3) business days to cancel without penalty. To cancel,
        notify Northshore Mechanical &amp; Construction LLC in writing at ${co.address} or by email
        at ${co.email}. If you cancel, any payments made will be returned within 10 business days
        of receipt of your cancellation notice.
      </div>
    </div>
  </div>

  <!-- SIGNATURES -->
  <div class="sec keep-together">
    <div class="sh">Authorization &amp; Signatures</div>
    <p style="font-size:10pt;color:#555;margin-bottom:20px;">
      By signing below, both parties agree to the scope of work, pricing, payment schedule, and
      terms described in this proposal. This document becomes a binding contract upon execution
      by both parties.
    </p>
    <div class="sig-grid">
      <div>
        <div class="sig-lbl">Contractor</div>
        <div class="sig-name">
          Connor Garza<br>
          <span style="font-size:9pt;font-weight:400;color:#666;">
            Northshore Mechanical &amp; Construction LLC
          </span>
        </div>
        <div class="sig-line"></div>
        <div class="sig-sub">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
      </div>
      <div>
        <div class="sig-lbl">Client Authorization</div>
        <div class="sig-name">${clientName}</div>
        <div class="sig-line"></div>
        <div class="sig-sub">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
      </div>
    </div>
    <div class="print-box">
      <div class="print-lbl">Print Client Name</div>
      <div class="print-line"></div>
    </div>
  </div>

</div><!-- /wrap -->

<div class="foot">
  <div>
    Northshore Mechanical &amp; Construction LLC &nbsp;|&nbsp; ${co.address}<br>
    ${formatPhone(co.phone)} &nbsp;|&nbsp; ${co.email} &nbsp;|&nbsp; ${co.website}
  </div>
  <div class="foot-r">
    Michigan Residential Builder<br>
    License #${co.license}<br>
    ${estNum}
  </div>
</div>

</body>
</html>`;
}

function openProposal(estimate, client, settings) {
  const html = generateProposalHTML({ estimate, client, settings });
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert("Please allow popups for this site to generate proposals.");
  }
}

// ================================================================
// CHANGE ORDER GENERATOR
// ================================================================
function generateChangeOrderHTML({ job, client, coData, settings, originalTotal }) {
  const co = getCompany(settings);
  const fmt = (n) =>
    `$${(Number(n) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const date     = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const coNum    = `CO-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const newTotal = (Number(originalTotal) || 0) + (Number(coData.amount) || 0);
  const clientName = client ? client.name : "Valued Client";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Northshore — Change Order ${coNum}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; color: #1a1a1a; background: #fff; font-size: 11pt; line-height: 1.65; }
    .action-bar { background: #0d1f33; padding: 10px 36px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; }
    .action-bar span { color: #8a9aaa; font-family: Arial, sans-serif; font-size: 11px; }
    .btn-pdf { background: #c45c26; color: #fff; border: none; padding: 9px 22px; font-size: 12px; font-weight: 700; cursor: pointer; border-radius: 3px; font-family: Arial, sans-serif; }
    .header { background: #0d1f33; color: #f5f0e8; padding: 28px 40px; display: flex; justify-content: space-between; align-items: center; }
    .co-name { font-family: Arial, sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 3px; }
    .co-sub  { font-family: Arial, sans-serif; font-size: 8px; letter-spacing: 4px; color: #c45c26; margin-top: 3px; }
    .co-contact { font-family: Arial, sans-serif; font-size: 9px; color: #8a9aaa; margin-top: 8px; line-height: 1.9; }
    .title-block { text-align: right; }
    .co-title { font-family: Arial, sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 4px; }
    .co-num   { font-family: Arial, sans-serif; font-size: 11px; color: #c45c26; margin-top: 4px; }
    .co-date  { font-family: Arial, sans-serif; font-size: 9px; color: #8a9aaa; margin-top: 4px; }
    .accent { height: 3px; background: linear-gradient(90deg, #c45c26, #e07340); }
    .wrap { max-width: 800px; margin: 0 auto; padding: 28px 40px; }
    .sh { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 4px; text-transform: uppercase; color: #c45c26; border-bottom: 1px solid #e8e0d0; padding-bottom: 5px; margin-bottom: 13px; font-weight: 700; margin-top: 22px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .lbl { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 3px; text-transform: uppercase; color: #999; margin-bottom: 4px; }
    .val { font-size: 12pt; font-weight: 700; color: #0d1f33; }
    .desc-box { background: #f9f7f4; border-left: 3px solid #c45c26; padding: 14px 18px; font-size: 11pt; color: #333; line-height: 1.8; margin-bottom: 18px; }
    .price-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    .price-table td { padding: 10px 12px; border-bottom: 1px solid #f0ece6; font-size: 11pt; }
    .price-table td:last-child { text-align: right; font-family: 'Courier New', monospace; }
    .total-row td { background: #0d1f33; color: #f5f0e8; font-weight: 700; font-size: 13pt; }
    .total-row td:last-child { color: #f5c842; font-size: 16pt; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 20px; }
    .sig-line { border-bottom: 1px solid #0d1f33; height: 30px; margin: 14px 0 4px; }
    .sig-sub { font-family: Arial, sans-serif; font-size: 8px; color: #bbb; letter-spacing: 1px; }
    .terms-box { font-size: 9pt; color: #666; line-height: 1.8; background: #f9f7f4; padding: 12px 16px; border: 1px solid #e8e0d0; margin-top: 18px; }
    .foot { background: #0d1f33; color: #8a9aaa; padding: 12px 40px; display: flex; justify-content: space-between; align-items: center; margin-top: 32px; font-family: Arial, sans-serif; font-size: 8.5px; }
    @media print {
      .action-bar { display: none !important; }
      @page { margin: 0.4in; size: letter; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>

<div class="action-bar">
  <span>Northshore OS — Change Order ${coNum}</span>
  <button class="btn-pdf" onclick="window.print()">⬇ Save as PDF / Print</button>
</div>

<div class="header">
  <div style="display:flex;align-items:center;gap:14px;">
    <img src="data:image/png;base64,${LOGO_BASE64}"
      alt="Northshore"
      style="height:72px;width:auto;display:block;" />
    <div class="co-contact">
      ${formatPhone(co.phone)} &nbsp;|&nbsp; ${co.email}<br>
      ${co.address}<br>
      MI Residential Builder License #${co.license}
    </div>
  </div>
  <div class="title-block">
    <div class="co-title">CHANGE ORDER</div>
    <div class="co-num">${coNum}</div>
    <div class="co-date">${date}</div>
  </div>
</div>
<div class="accent"></div>

<div class="wrap">
  <div class="info-grid">
    <div><div class="lbl">Client</div><div class="val">${clientName}</div></div>
    <div><div class="lbl">Project / Job</div><div class="val">${job ? job.name : "—"}</div></div>
  </div>

  <div class="sh">Description of Additional Work</div>
  <div class="desc-box">
    ${(coData.description || "").replace(/\n/g, "<br>") || "See attached documentation."}
  </div>

  <div class="sh">Change Order Pricing</div>
  <table class="price-table">
    <tr><td>Original Contract Total</td><td>${fmt(originalTotal)}</td></tr>
    <tr><td>This Change Order</td><td>${fmt(coData.amount)}</td></tr>
    <tr class="total-row"><td>Revised Contract Total</td><td>${fmt(newTotal)}</td></tr>
  </table>

  <div class="terms-box">
    <strong>Terms:</strong> This change order modifies the original project contract. Work described
    above will proceed only upon signed authorization by both parties. Additional work is subject to
    the same terms and conditions as the original contract. Payment for this change order is due upon
    completion of the additional scope unless otherwise agreed in writing.
  </div>

  <div class="sh">Authorization</div>
  <p style="font-size:10pt;color:#555;margin-bottom:4px;">
    Both parties must sign to authorize this change order before additional work commences.
  </p>
  <div class="sig-grid">
    <div>
      <div style="font-family:Arial,sans-serif;font-size:8.5px;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:4px;">Contractor</div>
      <div style="font-size:11pt;font-weight:700;color:#0d1f33;">
        Connor Garza<br>
        <span style="font-size:9pt;font-weight:400;color:#666;">Northshore Mechanical &amp; Construction LLC</span>
      </div>
      <div class="sig-line"></div>
      <div class="sig-sub">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
    </div>
    <div>
      <div style="font-family:Arial,sans-serif;font-size:8.5px;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:4px;">Client Authorization</div>
      <div style="font-size:11pt;font-weight:700;color:#0d1f33;">${clientName}</div>
      <div class="sig-line"></div>
      <div class="sig-sub">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
    </div>
  </div>
</div>

<div class="foot">
  <div>Northshore Mechanical &amp; Construction LLC &nbsp;|&nbsp; ${co.address} &nbsp;|&nbsp; ${formatPhone(co.phone)}</div>
  <div>License #${co.license} &nbsp;|&nbsp; ${coNum}</div>
</div>

</body>
</html>`;
}

function openChangeOrder(job, client, coData, settings, originalTotal) {
  const html = generateChangeOrderHTML({ job, client, coData, settings, originalTotal });
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert("Please allow popups for this site to generate change orders.");
  }
}

// ================================================================
// CONTRACT GENERATOR — Phase 4
// ================================================================
// Documents-as-state-machine. Generating + signing this contract is
// what arms the operational machine (NOC clock, invoice schedule,
// daily log expectations, punch list scaffolding).
//
// Pulls from an APPROVED estimate. Once "Mark Contract Signed" is
// fired on the linked job, the rest of the system knows the project
// is binding and the cascade begins.
// ================================================================
function generateContractHTML({ estimate, client, settings, contractNum }) {
  const co = getCompany(settings);
  const fmt = (n) =>
    `$${(Number(n) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const today = new Date();
  const date = today.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const year = today.getFullYear();

  const grandTotal = Number(estimate.grand_total) || 0;
  const deposit    = grandTotal * 0.40;
  const midpay     = grandTotal * 0.40;
  const final      = grandTotal * 0.20;
  const weeks      = Number(estimate.estimated_weeks) || 4;

  const clientName  = client ? client.name : "Client";
  const projectAddr = estimate.project_address || (client ? `${clientName} Property` : "To Be Confirmed");

  // Estimate / proposal reference number — link this contract back to its origin doc
  const estRef = `NSB-${year}-${String(estimate.id).slice(-5).toUpperCase()}`;

  const scopeText = (
    estimate.scope_of_work ||
    "Scope of Work as detailed in Proposal " + estRef + ", which is incorporated by reference and attached as Exhibit A."
  ).replace(/\n/g, "<br>");

  const logoImg = `<img src="data:image/png;base64,${LOGO_BASE64}"
    alt="Northshore Mechanical & Construction"
    style="height:88px;width:auto;display:block;" />`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Northshore — Contract ${contractNum}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; background: #fff; font-size: 11pt; line-height: 1.65; }

    .action-bar { background: #0d1f33; padding: 10px 36px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 99; }
    .action-bar span { color: #8a9aaa; font-family: Arial, sans-serif; font-size: 11px; }
    .btn-pdf { background: #c45c26; color: #fff; border: none; padding: 9px 22px; font-size: 12px; font-weight: 700; cursor: pointer; border-radius: 3px; font-family: Arial, sans-serif; letter-spacing: 1px; }
    .btn-pdf:hover { background: #a84e22; }

    .header { background: #0d1f33; color: #f5f0e8; padding: 28px 40px; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
    .logo-row { display: flex; align-items: center; gap: 18px; }
    .co-contact { font-family: Arial, sans-serif; font-size: 10px; color: #8a9aaa; line-height: 2; }
    .doc-meta { text-align: right; }
    .doc-title { font-family: Arial, sans-serif; font-size: 24px; font-weight: 700; letter-spacing: 5px; color: #f5f0e8; }
    .doc-num { font-family: Arial, sans-serif; font-size: 11px; color: #c45c26; margin-top: 5px; letter-spacing: 1px; }
    .doc-dates { font-family: Arial, sans-serif; font-size: 9.5px; color: #8a9aaa; margin-top: 5px; line-height: 1.9; }

    .accent { height: 3px; background: linear-gradient(90deg, #c45c26, #e07340); }

    .wrap { max-width: 800px; margin: 0 auto; padding: 0 40px; }
    .sec { margin: 22px 0; }
    .sh { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 4px; text-transform: uppercase; color: #c45c26; border-bottom: 1px solid #e8e0d0; padding-bottom: 5px; margin-bottom: 13px; font-weight: 700; }
    .article-num { font-family: Arial, sans-serif; font-size: 10pt; font-weight: 700; color: #0d1f33; letter-spacing: 1px; }
    .article-ttl { font-family: Arial, sans-serif; font-size: 11pt; font-weight: 700; color: #0d1f33; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }

    .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
    .party-box { background: #f9f7f4; border-left: 3px solid #0d1f33; padding: 14px 18px; }
    .party-label { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 3px; text-transform: uppercase; color: #999; margin-bottom: 6px; }
    .party-name { font-size: 13pt; font-weight: 700; color: #0d1f33; margin-bottom: 4px; }
    .party-detail { font-size: 9.5pt; color: #555; line-height: 1.7; }

    .recitals { background: #f9f7f4; padding: 16px 22px; font-style: italic; color: #444; line-height: 1.8; font-size: 10.5pt; }
    .recitals p { margin-bottom: 8px; }
    .recitals strong { font-style: normal; }

    .body-text { font-size: 10.5pt; color: #333; line-height: 1.8; }
    .body-text p { margin-bottom: 8px; }
    .body-text strong { color: #0d1f33; }

    .scope-box { background: #f9f7f4; border-left: 3px solid #c45c26; padding: 14px 18px; font-size: 10.5pt; color: #333; line-height: 1.8; }

    .sum-box { background: #0d1f33; color: #f5f0e8; padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; }
    .sum-lbl { font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 3px; text-transform: uppercase; }
    .sum-amt { font-family: Arial, sans-serif; font-size: 22px; font-weight: 700; color: #f5c842; }

    .pay-table { width: 100%; border-collapse: collapse; }
    .pay-table th { background: #0d1f33; color: #f5f0e8; padding: 9px 13px; text-align: left; font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; }
    .pay-table td { padding: 9px 13px; border-bottom: 1px solid #e8e0d0; font-size: 10.5pt; }
    .pay-table .ar { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; }

    .lien-box { border: 2px solid #c45c26; padding: 14px 18px; background: #fff8f0; }
    .lien-ttl { font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 2px; font-weight: 700; text-transform: uppercase; margin-bottom: 7px; color: #c45c26; }
    .lien-txt { font-size: 9.5pt; line-height: 1.75; color: #333; }

    .cancel-box { border: 2px solid #0d1f33; padding: 14px 18px; background: #fff8f0; }
    .cancel-ttl { font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 2px; font-weight: 700; text-transform: uppercase; margin-bottom: 7px; color: #0d1f33; }
    .cancel-txt { font-size: 9.5pt; line-height: 1.75; color: #333; }

    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 6px; }
    .sig-lbl { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: #999; margin-bottom: 5px; }
    .sig-name { font-size: 11pt; font-weight: 700; color: #0d1f33; margin-bottom: 18px; }
    .sig-line { border-bottom: 1px solid #0d1f33; height: 30px; margin-bottom: 3px; }
    .sig-sub { font-family: Arial, sans-serif; font-size: 8px; color: #bbb; letter-spacing: 1px; }
    .print-box { padding: 11px 14px; background: #f9f7f4; border: 1px solid #e8e0d0; margin-top: 16px; }
    .print-lbl { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: #999; margin-bottom: 5px; }
    .print-line { border-bottom: 1px solid #0d1f33; height: 26px; }

    .foot { background: #0d1f33; color: #8a9aaa; padding: 14px 40px; display: flex; justify-content: space-between; align-items: center; margin-top: 36px; font-family: Arial, sans-serif; font-size: 8.5px; }

    @media print {
      .action-bar { display: none !important; }
      body { font-size: 10pt; }
      .header { padding: 24px 32px; }
      .wrap { padding: 0 32px; }
      .sec { margin: 16px 0; }
      .keep-together,
      .lien-box,
      .cancel-box,
      .sig-grid,
      .pay-table,
      .sum-box,
      .recitals { page-break-inside: avoid; break-inside: avoid; }
      @page { margin: 0.4in; size: letter; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>

<div class="action-bar">
  <span>Northshore OS — Contract Preview &nbsp;|&nbsp; ${contractNum}</span>
  <button class="btn-pdf" onclick="window.print()">⬇ Save as PDF / Print</button>
</div>

<div class="header">
  <div class="logo-row">
    ${logoImg}
    <div>
      <div class="co-contact">
        ${formatPhone(co.phone)} &nbsp;|&nbsp; ${co.email}<br>
        ${co.address} &nbsp;|&nbsp; ${co.website}<br>
        MI Residential Builder License #${co.license}
      </div>
    </div>
  </div>
  <div class="doc-meta">
    <div class="doc-title">CONTRACT</div>
    <div class="doc-num">${contractNum}</div>
    <div class="doc-dates">Effective Date: ${date}<br>Ref: Proposal ${estRef}</div>
  </div>
</div>
<div class="accent"></div>

<div class="wrap">

  <!-- PARTIES -->
  <div class="sec">
    <div class="sh">The Parties</div>
    <div class="parties-grid">
      <div class="party-box">
        <div class="party-label">Contractor</div>
        <div class="party-name">${co.name}</div>
        <div class="party-detail">
          ${co.address}<br>
          ${formatPhone(co.phone)} &nbsp;|&nbsp; ${co.email}<br>
          MI Residential Builder License #${co.license}
        </div>
      </div>
      <div class="party-box">
        <div class="party-label">Owner</div>
        <div class="party-name">${clientName}</div>
        <div class="party-detail">
          ${client && client.email ? client.email + "<br>" : ""}
          ${client && client.phone ? formatPhone(client.phone) + "<br>" : ""}
          Project Address: ${projectAddr}
        </div>
      </div>
    </div>
  </div>

  <!-- RECITALS -->
  <div class="sec">
    <div class="sh">Recitals</div>
    <div class="recitals">
      <p><strong>WHEREAS,</strong> Owner desires to engage Contractor to perform certain residential
      construction services at the property described above (the "Project"); and</p>
      <p><strong>WHEREAS,</strong> Contractor has prepared and delivered to Owner a written proposal
      dated prior to the date hereof, designated Proposal ${estRef}, describing the scope, materials,
      pricing, and schedule for the Project (the "Proposal"); and</p>
      <p><strong>WHEREAS,</strong> Owner has reviewed and accepted the Proposal and the parties now
      desire to memorialize their agreement in this binding Construction Contract;</p>
      <p><strong>NOW, THEREFORE,</strong> in consideration of the mutual covenants contained herein,
      and for other good and valuable consideration, the receipt and sufficiency of which are hereby
      acknowledged, the parties agree as follows:</p>
    </div>
  </div>

  <!-- ARTICLE 1 — CONTRACT DOCUMENTS -->
  <div class="sec">
    <div class="article-num">ARTICLE 1</div>
    <div class="article-ttl">Contract Documents</div>
    <div class="body-text">
      <p>The Contract Documents consist of: (a) this Construction Contract; (b) the Proposal
      ${estRef} attached hereto and incorporated by reference; (c) any plans, specifications, or
      drawings provided by Owner and accepted by Contractor; and (d) all written change orders
      executed pursuant to Article 6. In the event of any conflict between this Contract and the
      Proposal, this Contract shall control.</p>
    </div>
  </div>

  <!-- ARTICLE 2 — SCOPE OF WORK -->
  <div class="sec">
    <div class="article-num">ARTICLE 2</div>
    <div class="article-ttl">Scope of Work</div>
    <div class="scope-box">${scopeText}</div>
    <p style="font-size:9pt;color:#666;margin-top:8px;font-style:italic;">
      All work shall be performed in compliance with the Michigan Residential Building Code and
      applicable local ordinances. The detailed scope, inclusions, and exclusions set forth in the
      Proposal are incorporated by reference.
    </p>
  </div>

  <!-- ARTICLE 3 — CONTRACT SUM -->
  <div class="sec keep-together">
    <div class="article-num">ARTICLE 3</div>
    <div class="article-ttl">Contract Sum</div>
    <div class="body-text">
      <p>Owner agrees to pay Contractor the total Contract Sum below for the full and faithful
      performance of the Work, subject to additions and deductions made by written change order
      pursuant to Article 6.</p>
    </div>
    <div class="sum-box">
      <span class="sum-lbl">Total Contract Sum</span>
      <span class="sum-amt">${fmt(grandTotal)}</span>
    </div>
  </div>

  <!-- ARTICLE 4 — PAYMENT SCHEDULE -->
  <div class="sec">
    <div class="article-num">ARTICLE 4</div>
    <div class="article-ttl">Payment Schedule</div>
    <div class="body-text">
      <p>The Contract Sum shall be paid in accordance with the following milestone schedule. Each
      installment shall be due within seven (7) calendar days of the corresponding milestone, upon
      submission of an invoice by Contractor.</p>
    </div>
    <table class="pay-table">
      <thead>
        <tr><th>Phase</th><th>Trigger</th><th class="ar">Amount</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>1. Deposit — 40%</strong></td>
          <td>Upon execution of this Contract</td>
          <td class="ar">${fmt(deposit)}</td>
        </tr>
        <tr>
          <td><strong>2. Progress — 40%</strong></td>
          <td>Upon mutual agreement that Project has reached the midpoint</td>
          <td class="ar">${fmt(midpay)}</td>
        </tr>
        <tr>
          <td><strong>3. Final — 20%</strong></td>
          <td>Upon completion of final walkthrough and punch list</td>
          <td class="ar">${fmt(final)}</td>
        </tr>
      </tbody>
    </table>
    <div class="body-text" style="margin-top:10px;">
      <p>A finance charge of one and one-half percent (1.5%) per month, equivalent to an annual rate
      of eighteen percent (18%), shall apply to all balances unpaid more than thirty (30) days past
      due. Contractor reserves the right to suspend Work upon any balance unpaid more than fourteen
      (14) days past due.</p>
    </div>
  </div>

  <!-- ARTICLE 5 — TIME OF PERFORMANCE -->
  <div class="sec">
    <div class="article-num">ARTICLE 5</div>
    <div class="article-ttl">Time of Performance</div>
    <div class="body-text">
      <p>Contractor shall commence the Work within a reasonable time following execution of this
      Contract and receipt of the Deposit, and shall pursue the Work diligently to completion. The
      estimated duration of the Work is approximately ${weeks} week(s), exclusive of delays caused by:
      weather; permitting; material availability; acts or omissions of Owner; unforeseen site
      conditions; or other causes beyond Contractor's reasonable control. Such delays shall not
      constitute a breach of this Contract, and the time for performance shall be extended
      accordingly.</p>
    </div>
  </div>

  <!-- ARTICLE 6 — CHANGE ORDERS -->
  <div class="sec">
    <div class="article-num">ARTICLE 6</div>
    <div class="article-ttl">Change Orders</div>
    <div class="body-text">
      <p>Any change in the scope of Work, materials, or Contract Sum shall be documented by a
      written change order signed by both parties before such additional Work commences. Verbal
      authorizations shall not be binding. Contractor shall not be obligated to perform any Work
      outside the original scope absent an executed change order.</p>
    </div>
  </div>

  <!-- ARTICLE 7 — CONSTRUCTION LIEN ACT NOTICE (Michigan) -->
  <div class="sec keep-together">
    <div class="article-num">ARTICLE 7</div>
    <div class="article-ttl">Construction Lien Act Notice</div>
    <div class="lien-box">
      <div class="lien-ttl">Notice to Owner — Required by Michigan Law</div>
      <div class="lien-txt">
        <p style="margin-bottom:8px;"><strong>YOUR PROPERTY IS SUBJECT TO CONSTRUCTION LIENS.</strong>
        Under the Michigan Construction Lien Act (MCL 570.1101 et seq.), Contractor, subcontractors,
        and material suppliers who provide labor or materials for the improvement of your property
        may file a lien against your property if they are not paid. To protect yourself, Owner is
        entitled to receive sworn statements and unconditional waivers of lien from Contractor and
        any subcontractors or suppliers prior to making each payment.</p>
        <p>Contractor shall, upon request and at each payment milestone, furnish Owner with a sworn
        statement listing all parties providing labor or materials, and shall furnish full or partial
        unconditional lien waivers as appropriate. A Notice of Commencement shall be recorded for
        this Project as required by law.</p>
      </div>
    </div>
  </div>

  <!-- ARTICLE 8 — INSURANCE -->
  <!--
    PHASE 4 NOTE: insurance language intentionally minimal until GLI is bound.
    When the general liability policy is active, replace this article with full
    coverage representations and a "certificate available upon request" clause.
  -->
  <div class="sec">
    <div class="article-num">ARTICLE 8</div>
    <div class="article-ttl">Insurance</div>
    <div class="body-text">
      <p>Contractor shall maintain such insurance as is required by Michigan law for residential
      builders. Specific coverage and limits shall be furnished to Owner upon written request.</p>
    </div>
  </div>

  <!-- ARTICLE 9 — INDEMNIFICATION -->
  <div class="sec">
    <div class="article-num">ARTICLE 9</div>
    <div class="article-ttl">Indemnification</div>
    <div class="body-text">
      <p>Each party shall indemnify and hold the other harmless from claims, losses, damages, or
      expenses arising from its own negligent acts or omissions in connection with the Work. Neither
      party shall be liable to the other for consequential or incidental damages.</p>
    </div>
  </div>

  <!-- ARTICLE 10 — WARRANTY -->
  <div class="sec">
    <div class="article-num">ARTICLE 10</div>
    <div class="article-ttl">Warranty</div>
    <div class="body-text">
      <p>Contractor warrants that all Work shall be performed in a good and workmanlike manner, free
      from material defects, for a period of one (1) year following substantial completion.
      Manufacturer warranties on materials and equipment shall pass through to Owner. This warranty
      is in lieu of all other warranties, express or implied, including any implied warranty of
      merchantability or fitness for a particular purpose.</p>
    </div>
  </div>

  <!-- ARTICLE 11 — DEFAULT & TERMINATION -->
  <div class="sec">
    <div class="article-num">ARTICLE 11</div>
    <div class="article-ttl">Default and Termination</div>
    <div class="body-text">
      <p>Either party may terminate this Contract upon material breach by the other party that is
      not cured within ten (10) days of written notice. Upon termination, Contractor shall be paid
      for all Work performed and materials supplied to the date of termination, plus a reasonable
      mobilization and demobilization charge. Materials paid for by Owner shall remain Owner's
      property.</p>
    </div>
  </div>

  <!-- ARTICLE 12 — RIGHT TO CANCEL -->
  <div class="sec keep-together">
    <div class="article-num">ARTICLE 12</div>
    <div class="article-ttl">Notice of Right to Cancel</div>
    <div class="cancel-box">
      <div class="cancel-ttl">Required by Michigan Home Solicitation Sales Act</div>
      <div class="cancel-txt">
        <p><strong>You, the buyer, may cancel this transaction at any time prior to midnight of the
        third business day after the date of this transaction.</strong> If this Contract was signed
        at your residence, you have three (3) business days to cancel without penalty. To cancel,
        deliver written notice to Contractor at ${co.address} or by email to ${co.email}. Any
        payments made will be returned within ten (10) business days of receipt of your cancellation
        notice. Work shall not commence until the cancellation period has expired.</p>
      </div>
    </div>
  </div>

  <!-- ARTICLE 13 — GOVERNING LAW -->
  <div class="sec">
    <div class="article-num">ARTICLE 13</div>
    <div class="article-ttl">Governing Law and Disputes</div>
    <div class="body-text">
      <p>This Contract shall be governed by and construed in accordance with the laws of the State
      of Michigan. Any dispute arising under this Contract shall be venued in the courts of Muskegon
      County, Michigan. The parties shall first attempt in good faith to resolve any dispute through
      direct negotiation before commencing formal proceedings.</p>
    </div>
  </div>

  <!-- ARTICLE 14 — ENTIRE AGREEMENT -->
  <div class="sec">
    <div class="article-num">ARTICLE 14</div>
    <div class="article-ttl">Entire Agreement</div>
    <div class="body-text">
      <p>This Contract, together with the Contract Documents identified in Article 1, constitutes
      the entire agreement between the parties with respect to the Project and supersedes all prior
      negotiations, representations, and agreements, whether written or oral. No modification of
      this Contract shall be binding unless in writing and signed by both parties. If any provision
      of this Contract is held unenforceable, the remaining provisions shall continue in full force
      and effect.</p>
    </div>
  </div>

  <!-- SIGNATURES -->
  <div class="sec keep-together">
    <div class="sh">Execution</div>
    <p style="font-size:10pt;color:#555;margin-bottom:18px;">
      The parties have executed this Construction Contract as of the Effective Date set forth above,
      intending to be legally bound.
    </p>
    <div class="sig-grid">
      <div>
        <div class="sig-lbl">Contractor</div>
        <div class="sig-name">
          Connor Garza<br>
          <span style="font-size:9pt;font-weight:400;color:#666;">
            ${co.name}
          </span>
        </div>
        <div class="sig-line"></div>
        <div class="sig-sub">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
      </div>
      <div>
        <div class="sig-lbl">Owner</div>
        <div class="sig-name">${clientName}</div>
        <div class="sig-line"></div>
        <div class="sig-sub">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
      </div>
    </div>
    <div class="print-box">
      <div class="print-lbl">Print Owner Name</div>
      <div class="print-line"></div>
    </div>
  </div>

</div><!-- /wrap -->

<div class="foot">
  <div>
    ${co.name} &nbsp;|&nbsp; ${co.address}<br>
    ${formatPhone(co.phone)} &nbsp;|&nbsp; ${co.email}
  </div>
  <div style="text-align:right;">
    Michigan Residential Builder<br>
    License #${co.license}<br>
    ${contractNum}
  </div>
</div>

</body>
</html>`;
}

function openContract(estimate, client, settings, contractNum) {
  const html = generateContractHTML({ estimate, client, settings, contractNum });
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert("Please allow popups for this site to generate the contract.");
  }
}

// ================================================================
// CLOCK WIDGET — persistent header element
// ================================================================
// Shows clock state in the header from any tab. Two states:
//   - Inactive: small "Clock In" button (slate). Tap → JobPickerModal.
//   - Active:   pulsing green dot + job name + live timer. Tap → menu
//               with "Clock Out" + "Edit notes" options.
// Active state survives reload because the live entry is fetched from
// Supabase on mount in AppInner.
// ================================================================
function ClockWidget({ activeEntry, jobs, onClockIn, onClockOut, compact = false }) {
  // Re-render every minute when active so the timer ticks live
  useTicker(60000, !!activeEntry);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!activeEntry) {
    return (
      <>
        <button
          onClick={() => setPickerOpen(true)}
          className={`flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-slate-600 transition-colors text-slate-300 hover:text-white ${
            compact ? "px-2 py-1.5 text-xs" : "px-3 py-1.5 text-xs font-medium"
          }`}
          title="Clock in to a job"
        >
          <Clock className="w-3.5 h-3.5" />
          {!compact && <span>Clock In</span>}
        </button>
        <JobPickerModal
          isOpen={pickerOpen}
          jobs={jobs}
          onClose={() => setPickerOpen(false)}
          onPick={(job, notes) => {
            onClockIn(job, notes);
            setPickerOpen(false);
          }}
        />
      </>
    );
  }

  const job = jobs.find((j) => j.id === activeEntry.job_id);
  const jobName = job?.name || "(unknown job)";
  const elapsedMin = Math.floor((Date.now() - new Date(activeEntry.clock_in).getTime()) / 60000);

  return (
    <>
      <button
        onClick={() => setMenuOpen(true)}
        className={`flex items-center gap-2 rounded-lg border border-emerald-700/60 bg-emerald-900/30 hover:bg-emerald-900/50 transition-colors text-emerald-200 ${
          compact ? "px-2 py-1.5 text-xs" : "px-3 py-1.5 text-xs font-medium"
        }`}
        title={`Clocked in: ${jobName}`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="truncate max-w-[120px]">{jobName}</span>
        <span className="font-mono tabular-nums opacity-80">{formatDuration(elapsedMin)}</span>
      </button>
      <ClockSessionMenu
        isOpen={menuOpen}
        activeEntry={activeEntry}
        jobName={jobName}
        elapsedMin={elapsedMin}
        onClose={() => setMenuOpen(false)}
        onClockOut={(notes) => {
          onClockOut(notes);
          setMenuOpen(false);
        }}
      />
    </>
  );
}

// ================================================================
// JOB PICKER MODAL — shown when clocking in without a target job
// ================================================================
function JobPickerModal({ isOpen, jobs, onClose, onPick }) {
  const [selectedJobId, setSelectedJobId] = useState("");
  const [notes, setNotes] = useState("");
  const activeJobs = jobs.filter((j) => j.status === "Active");

  // Auto-select if there's only one active job — common case for solo-op
  useEffect(() => {
    if (isOpen && activeJobs.length === 1 && !selectedJobId) {
      setSelectedJobId(activeJobs[0].id);
    }
    if (!isOpen) {
      setSelectedJobId("");
      setNotes("");
    }
  }, [isOpen, activeJobs, selectedJobId]);

  const handleConfirm = () => {
    const job = jobs.find((j) => j.id === selectedJobId);
    if (!job) return;
    onPick(job, notes);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              Clock In
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {activeJobs.length === 0
                ? "No active jobs. Create or activate a job first."
                : "Pick a job. Timer starts immediately."}
            </p>

            {activeJobs.length > 0 && (
              <>
                <div className="mb-3">
                  <label className="block text-xs text-slate-400 mb-1">Job</label>
                  <Sel
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    autoFocus
                  >
                    <option value="">— Select active job —</option>
                    {activeJobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.name}</option>
                    ))}
                  </Sel>
                </div>
                <div className="mb-4">
                  <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
                  <Inp
                    placeholder="e.g. drywall hang east wall"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              {activeJobs.length > 0 && (
                <button
                  onClick={handleConfirm}
                  disabled={!selectedJobId}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  <Clock className="w-4 h-4" /> Start Timer
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ================================================================
// CLOCK SESSION MENU — shown when tapping the active clock chip
// ================================================================
function ClockSessionMenu({ isOpen, activeEntry, jobName, elapsedMin, onClose, onClockOut }) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) setNotes(activeEntry?.notes || "");
  }, [isOpen, activeEntry]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-emerald-700/60 rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-emerald-300 font-semibold truncate">{jobName}</p>
                <p className="text-xs text-slate-500">
                  Started {new Date(activeEntry.clock_in).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  &nbsp;•&nbsp; {formatDuration(elapsedMin)} so far
                </p>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-slate-400">Session notes (saved on clock out)</label>
                <VoiceMicButton currentValue={notes} onChange={setNotes} appendMode title="Dictate session notes" />
              </div>
              <AutoTextarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                minRows={3}
                placeholder="What you worked on..."
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Keep Working
              </button>
              <button
                onClick={() => onClockOut(notes)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-500 transition-colors flex items-center gap-1.5"
              >
                <Clock className="w-4 h-4" /> Clock Out
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ================================================================
// MANUAL TIME ENTRY MODAL — for missed times / paper-tracked work
// ================================================================
function ManualTimeEntryModal({ isOpen, jobId, jobName, existingEntry, onClose, onSave, onDelete }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [date, setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [startT, setStartT] = useState("08:00");
  const [endT, setEndT]   = useState("16:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (existingEntry) {
      const ci = new Date(existingEntry.clock_in);
      const co = existingEntry.clock_out ? new Date(existingEntry.clock_out) : null;
      const pad = (n) => String(n).padStart(2, "0");
      setDate(ci.toISOString().slice(0, 10));
      setStartT(`${pad(ci.getHours())}:${pad(ci.getMinutes())}`);
      setEndT(co ? `${pad(co.getHours())}:${pad(co.getMinutes())}` : "");
      setNotes(existingEntry.notes || "");
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setStartT("08:00");
      setEndT("16:00");
      setNotes("");
    }
  }, [isOpen, existingEntry]);

  const handleSave = async () => {
    if (!date || !startT || !endT) {
      toast.error("Date, start, and end are all required");
      return;
    }
    const ci = new Date(`${date}T${startT}:00`);
    const co = new Date(`${date}T${endT}:00`);
    if (co <= ci) {
      toast.error("End time must be after start time");
      return;
    }
    setSaving(true);
    await onSave({
      clock_in: ci.toISOString(),
      clock_out: co.toISOString(),
      duration_minutes: Math.round((co - ci) / 60000),
      notes: notes || null,
    });
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!existingEntry || !onDelete) return;
    const ok = await confirm({
      title: "Delete this time entry?",
      message: `${formatDate(existingEntry.clock_in)} — ${formatDuration(existingEntry.duration_minutes)} on ${jobName}. Cannot be undone.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    await onDelete(existingEntry);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-400" />
              {existingEntry ? "Edit Time Entry" : "Add Time Entry"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{jobName}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date</label>
                <Inp type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Start</label>
                  <Inp type="time" value={startT} onChange={(e) => setStartT(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">End</label>
                  <Inp type="time" value={endT} onChange={(e) => setEndT(e.target.value)} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-400">Notes</label>
                  <VoiceMicButton currentValue={notes} onChange={setNotes} appendMode title="Dictate notes" />
                </div>
                <AutoTextarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  minRows={2}
                  placeholder="What you worked on..."
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              {existingEntry && onDelete && (
                <button
                  onClick={handleDelete}
                  className="mr-auto px-3 py-2 rounded-lg text-xs font-medium bg-rose-900/30 text-rose-300 hover:bg-rose-900/50 border border-rose-800/50 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ================================================================
// DOCUMENTS VAULT
// Central business-document repository. Articles of org, insurance,
// vehicles, IDs, tax returns, permits, receipts. NON-PUBLIC storage,
// expiration tracking, version history, time-limited share links,
// full audit log.
//
// Architecture decisions worth knowing:
// - storage bucket "company-docs" is private (auth-gated). Files are
//   never embedded as <img src=...> directly — we always go through
//   createSignedUrl() with a short TTL.
// - "supersede" replaces an old doc with a new version. The old one
//   sticks around (superseded_at set) so we keep a paper trail of
//   every GLI policy ever bound, every license renewal, etc.
// - Soft delete only. Real delete would defeat the whole point of a
//   compliance vault. Future: add a hard-delete-after-N-years sweep.
// - Audit log captures every view, download, and share. When you
//   eventually have employees, this is who-saw-what for sensitive
//   docs like tax returns and IDs.
// ================================================================

const DOC_CATEGORIES = [
  { id: "Articles",  label: "Articles of Org", icon: BookOpen,    color: "text-purple-400",  bg: "bg-purple-900/20",  border: "border-purple-700/40" },
  { id: "Insurance", label: "Insurance",       icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-700/40" },
  { id: "License",   label: "Licenses",        icon: HardHat,     color: "text-amber-400",   bg: "bg-amber-900/20",   border: "border-amber-700/40" },
  { id: "Vehicle",   label: "Vehicles",        icon: Truck,       color: "text-blue-400",    bg: "bg-blue-900/20",    border: "border-blue-700/40" },
  { id: "Tax",       label: "Tax",             icon: DollarSign,  color: "text-rose-400",    bg: "bg-rose-900/20",    border: "border-rose-700/40" },
  { id: "Employee",  label: "Employee / IDs",  icon: Users,       color: "text-cyan-400",    bg: "bg-cyan-900/20",    border: "border-cyan-700/40" },
  { id: "Permit",    label: "Permits",         icon: FileText,    color: "text-orange-400",  bg: "bg-orange-900/20",  border: "border-orange-700/40" },
  { id: "Receipt",   label: "Receipts",        icon: Receipt,     color: "text-yellow-400",  bg: "bg-yellow-900/20",  border: "border-yellow-700/40" },
  { id: "Other",     label: "Other",           icon: Package,     color: "text-slate-400",   bg: "bg-slate-800/40",   border: "border-slate-700" },
];

const getCategoryMeta = (id) =>
  DOC_CATEGORIES.find((c) => c.id === id) || DOC_CATEGORIES[DOC_CATEGORIES.length - 1];

// Format file size as B/KB/MB/GB
const formatBytes = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

// Days between today and an ISO date. Negative = past, positive = future.
const daysUntil = (isoDate) => {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  const now = new Date();
  // Normalize to midnight UTC for both
  target.setUTCHours(0, 0, 0, 0);
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
};

// Audit-log event helper. Fire-and-forget — failures shouldn't block UX.
const logDocEvent = async (documentId, eventType, metadata = {}) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("company_document_events").insert({
      document_id: documentId,
      event_type: eventType,
      user_id: session?.user?.id,
      user_email: session?.user?.email,
      metadata,
    });
  } catch (e) {
    console.warn("audit log failed:", e);
  }
};

// Generate a URL-safe random token for share links
const makeShareToken = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

// ================================================================
// DOCUMENT UPLOAD MODAL — drag-and-drop OR click-to-pick
// ================================================================
function DocumentUploadModal({ isOpen, supersedeOf, onClose, onUploaded }) {
  const toast = useToast();
  const [file, setFile]         = useState(null);
  const [title, setTitle]       = useState("");
  const [category, setCategory] = useState("Other");
  const [expiresAt, setExpiresAt] = useState("");
  const [tags, setTags]         = useState("");
  const [notes, setNotes]       = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Pre-fill from supersedeOf when renewing a doc
  useEffect(() => {
    if (!isOpen) return;
    if (supersedeOf) {
      setTitle(supersedeOf.title || "");
      setCategory(supersedeOf.category || "Other");
      setTags((supersedeOf.tags || []).join(", "));
      setNotes("");
      setExpiresAt("");
      setFile(null);
    } else {
      setFile(null); setTitle(""); setCategory("Other");
      setExpiresAt(""); setTags(""); setNotes("");
    }
  }, [isOpen, supersedeOf]);

  const handleFile = (f) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) {
      toast.error("File over 50MB. Compress or split before uploading.");
      return;
    }
    setFile(f);
    // Auto-fill title from filename if empty (strip extension)
    if (!title) {
      setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleSave = async () => {
    if (!file) { toast.error("Pick a file first"); return; }
    if (!title.trim()) { toast.error("Title is required"); return; }
    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not signed in");

      // Build storage path: docs/<category>/<timestamp>-<safe-filename>
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `docs/${category}/${Date.now()}-${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from("company-docs")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;

      const tagArray = tags.split(",").map((t) => t.trim()).filter(Boolean);

      // Build the new row. If superseding, parent_doc_id + version+1
      const newRow = {
        title: title.trim(),
        category,
        tags: tagArray,
        notes: notes.trim() || null,
        storage_path: path,
        file_size: file.size,
        mime_type: file.type,
        expires_at: expiresAt || null,
        version: supersedeOf ? (supersedeOf.version || 1) + 1 : 1,
        parent_doc_id: supersedeOf?.id || null,
        uploaded_by: session.user.id,
        uploaded_by_email: session.user.email,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("company_documents")
        .insert(newRow)
        .select()
        .single();
      if (insertErr) throw insertErr;

      // If superseding, mark the old version
      if (supersedeOf) {
        await supabase
          .from("company_documents")
          .update({ superseded_at: new Date().toISOString() })
          .eq("id", supersedeOf.id);
      }

      await logDocEvent(inserted.id, supersedeOf ? "edit" : "view", {
        action: supersedeOf ? "supersede" : "upload",
        previous_version_id: supersedeOf?.id,
      });

      onUploaded(inserted, supersedeOf?.id);
      toast.success(supersedeOf ? `New version uploaded (v${inserted.version})` : "Uploaded");
    } catch (err) {
      toast.error("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4 py-8 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-lg w-full p-6 my-auto"
          >
            <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-400" />
              {supersedeOf ? `Renew: ${supersedeOf.title}` : "Upload Document"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {supersedeOf
                ? `Old version (v${supersedeOf.version}) will be archived but preserved.`
                : "PDFs, images, Word docs, spreadsheets — up to 50MB."}
            </p>

            {/* DRAG-AND-DROP ZONE */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
              }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mb-4 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragging
                  ? "border-amber-400 bg-amber-900/20"
                  : file
                    ? "border-emerald-700 bg-emerald-900/20"
                    : "border-slate-700 bg-slate-950/40 hover:border-slate-600"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
              />
              {file ? (
                <div className="text-sm">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                  <p className="text-emerald-300 font-medium truncate">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatBytes(file.size)}</p>
                  <p className="text-xs text-amber-400 mt-2">Click to swap</p>
                </div>
              ) : (
                <div className="text-sm text-slate-400">
                  <Upload className="w-7 h-7 mx-auto mb-2 text-slate-600" />
                  <p>Drag a file here, or <span className="text-amber-400">click to pick</span></p>
                  <p className="text-xs text-slate-600 mt-1">Max 50MB</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Title *</label>
                <Inp
                  placeholder="e.g. GLI Policy 2026-2027"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category</label>
                  <Sel value={category} onChange={(e) => setCategory(e.target.value)}>
                    {DOC_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </Sel>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Expires <span className="text-slate-600">(optional)</span>
                  </label>
                  <Inp type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Tags <span className="text-slate-600">(comma-separated, optional)</span>
                </label>
                <Inp
                  placeholder="e.g. truck-1, primary, 2026"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What's in this doc, where it came from, anything to remember..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={onClose}
                disabled={uploading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={uploading || !file || !title.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {uploading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Upload</>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ================================================================
// DOCUMENT DETAIL DRAWER — view, download, share, edit, supersede
// ================================================================
function DocumentDetailDrawer({ doc, allDocs, onClose, onUpdated, onDeleted, onSupersede }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [title, setTitle]     = useState(doc?.title || "");
  const [category, setCategory] = useState(doc?.category || "Other");
  const [tags, setTags]       = useState((doc?.tags || []).join(", "));
  const [expiresAt, setExpiresAt] = useState(doc?.expires_at || "");
  const [notes, setNotes]     = useState(doc?.notes || "");
  const [showShare, setShowShare] = useState(false);
  const [signedUrl, setSignedUrl] = useState(null);

  // Fetch a 60s signed URL for download
  useEffect(() => {
    if (!doc?.storage_path) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase.storage
        .from("company-docs")
        .createSignedUrl(doc.storage_path, 60);
      if (alive && !error && data) {
        setSignedUrl(data.signedUrl);
        logDocEvent(doc.id, "view");
      }
    })();
    return () => { alive = false; };
  }, [doc?.id, doc?.storage_path]);

  // Sync editing state when a different doc loads
  useEffect(() => {
    if (!doc) return;
    setTitle(doc.title || "");
    setCategory(doc.category || "Other");
    setTags((doc.tags || []).join(", "));
    setExpiresAt(doc.expires_at || "");
    setNotes(doc.notes || "");
    setEditing(false);
    setShowShare(false);
  }, [doc?.id]);

  if (!doc) return null;

  // Find prior versions in the chain
  const versionChain = [];
  let cursor = doc;
  while (cursor) {
    versionChain.unshift(cursor);
    cursor = cursor.parent_doc_id ? allDocs.find((d) => d.id === cursor.parent_doc_id) : null;
    if (versionChain.length > 50) break; // safety
  }

  const handleSaveEdit = async () => {
    const tagArray = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { data, error } = await supabase
      .from("company_documents")
      .update({
        title: title.trim(),
        category,
        tags: tagArray,
        expires_at: expiresAt || null,
        notes: notes.trim() || null,
      })
      .eq("id", doc.id)
      .select()
      .single();
    if (!error && data) {
      onUpdated(data);
      logDocEvent(doc.id, "edit");
      setEditing(false);
      toast.success("Document updated");
    } else {
      toast.error("Update failed: " + (error?.message || "Unknown error"));
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Archive this document?",
      message: "It will be hidden from the vault but preserved in case you need to restore it.",
      confirmText: "Archive",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("company_documents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", doc.id);
    if (!error) {
      logDocEvent(doc.id, "delete");
      onDeleted(doc.id);
      toast.success("Archived");
    } else {
      toast.error("Archive failed: " + error.message);
    }
  };

  const handleDownload = async () => {
    if (!signedUrl) return;
    logDocEvent(doc.id, "download");
    window.open(signedUrl, "_blank");
  };

  const meta = getCategoryMeta(doc.category);
  const Icon = meta.icon;
  const expDays = daysUntil(doc.expires_at);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[998] flex items-stretch justify-end"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border-l-2 border-slate-700 w-full max-w-lg overflow-y-auto"
        >
          {/* Header */}
          <div className={`${meta.bg} ${meta.border} border-b px-5 py-4 flex items-start justify-between gap-3`}>
            <div className="flex items-start gap-3 min-w-0">
              <Icon className={`w-7 h-7 ${meta.color} shrink-0 mt-0.5`} />
              <div className="min-w-0">
                {editing ? (
                  <Inp value={title} onChange={(e) => setTitle(e.target.value)} className="text-base font-bold mb-1" />
                ) : (
                  <h3 className="text-base font-bold text-slate-100 break-words">{doc.title}</h3>
                )}
                <p className={`text-xs ${meta.color}`}>{meta.label} • v{doc.version}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white shrink-0 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">

            {/* EXPIRATION CALLOUT */}
            {doc.expires_at && expDays !== null && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${
                expDays < 0
                  ? "bg-rose-900/30 border-rose-700/50 text-rose-200"
                  : expDays <= 30
                    ? "bg-amber-900/30 border-amber-700/50 text-amber-200"
                    : "bg-slate-800/40 border-slate-700 text-slate-300"
              }`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {expDays < 0
                      ? `Expired ${Math.abs(expDays)} day${Math.abs(expDays) === 1 ? "" : "s"} ago`
                      : expDays === 0
                        ? "Expires today"
                        : `Expires in ${expDays} day${expDays === 1 ? "" : "s"}`}
                    {" • "}
                    {new Date(doc.expires_at).toLocaleDateString([], { dateStyle: "medium" })}
                  </span>
                </div>
              </div>
            )}

            {/* ACTIONS */}
            {!editing && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownload}
                  disabled={!signedUrl}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 text-black hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button
                  onClick={() => setShowShare(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share Link
                </button>
                <button
                  onClick={() => onSupersede(doc)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-800/50 transition-colors flex items-center gap-1.5"
                  title="Upload a newer version (e.g. renewed insurance policy)"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Renew
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-900/30 text-rose-300 hover:bg-rose-900/50 border border-rose-800/50 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Archive
                </button>
              </div>
            )}

            {/* EDIT FORM */}
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Category</label>
                    <Sel value={category} onChange={(e) => setCategory(e.target.value)}>
                      {DOC_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </Sel>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Expires</label>
                    <Inp type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tags</label>
                  <Inp value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma-separated" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 text-black hover:bg-amber-500 transition-colors flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* METADATA */}
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Uploaded</span>
                      <span className="text-slate-300">
                        {new Date(doc.created_at).toLocaleDateString([], { dateStyle: "medium" })}
                        {doc.uploaded_by_email && ` by ${doc.uploaded_by_email.split("@")[0]}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">File size</span>
                      <span className="text-slate-300">{formatBytes(doc.file_size)}</span>
                    </div>
                    {doc.mime_type && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Type</span>
                        <span className="text-slate-300 truncate ml-2 max-w-[60%]">{doc.mime_type}</span>
                      </div>
                    )}
                    {doc.tags?.length > 0 && (
                      <div className="pt-1">
                        <p className="text-xs text-slate-500 mb-1">Tags</p>
                        <div className="flex flex-wrap gap-1">
                          {doc.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 rounded border border-slate-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {doc.notes && (
                      <div className="pt-1 border-t border-slate-800 mt-2">
                        <p className="text-xs text-slate-500 mb-1">Notes</p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{doc.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* VERSION HISTORY */}
                {versionChain.length > 1 && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <History className="w-4 h-4 text-slate-500" />
                        <p className="text-xs uppercase tracking-wider text-slate-500">Version History</p>
                      </div>
                      <div className="space-y-1.5">
                        {versionChain.map((v) => (
                          <div
                            key={v.id}
                            className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
                              v.id === doc.id ? "bg-amber-900/20 text-amber-300" : "bg-slate-800/40 text-slate-400"
                            }`}
                          >
                            <span>v{v.version} {v.id === doc.id && "(current)"}</span>
                            <span>{new Date(v.created_at).toLocaleDateString([], { dateStyle: "short" })}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* SHARE PANEL */}
            {showShare && (
              <ShareLinkPanel
                doc={doc}
                onClose={() => setShowShare(false)}
                onCreated={() => toast.success("Share link copied to clipboard")}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ================================================================
// SHARE LINK PANEL — generate time-limited share URL
// ================================================================
function ShareLinkPanel({ doc, onClose, onCreated }) {
  const toast = useToast();
  const [days, setDays] = useState(7);
  const [recipientNote, setRecipientNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [link, setLink] = useState(null);

  // NOTE on the limitation:
  // True public share links require a public-facing endpoint that resolves
  // a share token to a signed storage URL. Northshore OS doesn't have
  // a backend route for that yet, so v1 generates a Supabase storage
  // signed URL valid for `days` days. This URL is shareable but anyone
  // with it can access until it expires. We still record the share in
  // the DB for audit purposes and for future revocation when we add
  // a proper share-token resolver.
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const seconds = Math.max(1, Math.min(days, 30)) * 24 * 60 * 60;
      const { data, error } = await supabase.storage
        .from("company-docs")
        .createSignedUrl(doc.storage_path, seconds);
      if (error) throw error;
      const token = makeShareToken();
      const expiresAt = new Date(Date.now() + seconds * 1000).toISOString();

      // Record the share for audit + future revocation
      await supabase.from("company_document_shares").insert({
        document_id: doc.id,
        share_token: token,
        expires_at: expiresAt,
        created_by: session?.user?.id,
        created_by_email: session?.user?.email,
        recipient_note: recipientNote.trim() || null,
      });
      await logDocEvent(doc.id, "share", { days, recipient_note: recipientNote });

      setLink(data.signedUrl);
      try {
        await navigator.clipboard.writeText(data.signedUrl);
        onCreated();
      } catch {
        // clipboard might be blocked — that's fine, the link is shown below
      }
    } catch (err) {
      toast.error("Share generation failed: " + (err.message || "Unknown error"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-slate-500" />
            <p className="text-xs uppercase tracking-wider text-slate-500">Generate Share Link</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!link ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Expires after</label>
              <Sel value={days} onChange={(e) => setDays(Number(e.target.value))}>
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={7}>7 days (typical for COIs)</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days (max)</option>
              </Sel>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Note (private, for your records)</label>
              <Inp
                placeholder="e.g. Sent to GC for Murphy bid"
                value={recipientNote}
                onChange={(e) => setRecipientNote(e.target.value)}
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full px-3 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              {generating ? "Generating..." : "Generate Link"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Link copied to clipboard. Valid {days} day{days === 1 ? "" : "s"}.
            </p>
            <div className="bg-slate-950/60 border border-slate-700 rounded p-2 max-h-20 overflow-y-auto">
              <p className="text-[10px] font-mono text-slate-400 break-all">{link}</p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(link)}
              className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> Copy again
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ================================================================
// DOCUMENTS VAULT — top-level tab content
// ================================================================
function DocumentsVault({ documents, setDocuments }) {
  const toast = useToast();
  const [search, setSearch]           = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showArchived, setShowArchived] = useState(false);
  const [uploadOpen, setUploadOpen]   = useState(false);
  const [supersedeOf, setSupersedeOf] = useState(null);
  const [detailDoc, setDetailDoc]     = useState(null);

  // Active = not soft-deleted AND not superseded (latest version only)
  const visible = documents.filter((d) => {
    if (!showArchived && (d.deleted_at || d.superseded_at)) return false;
    if (showArchived && !d.deleted_at && !d.superseded_at) return false;
    if (activeCategory !== "All" && d.category !== activeCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = [d.title, d.notes, ...(d.tags || [])].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Counts per category for the sidebar (only on active docs)
  const categoryCounts = {};
  for (const d of documents) {
    if (d.deleted_at || d.superseded_at) continue;
    categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
  }
  const totalActive = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  // Expiring-soon sweep (within 30 days OR already expired)
  const expiringSoon = documents.filter((d) => {
    if (d.deleted_at || d.superseded_at || !d.expires_at) return false;
    const days = daysUntil(d.expires_at);
    return days !== null && days <= 30;
  }).sort((a, b) => daysUntil(a.expires_at) - daysUntil(b.expires_at));

  const handleUploaded = (newDoc, supersededId) => {
    setDocuments((prev) => {
      const next = prev.map((d) =>
        d.id === supersededId
          ? { ...d, superseded_at: new Date().toISOString() }
          : d
      );
      return [newDoc, ...next];
    });
    setUploadOpen(false);
    setSupersedeOf(null);
    setDetailDoc(newDoc);
  };

  const handleUpdated = (updated) => {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setDetailDoc(updated);
  };

  const handleDeleted = (id) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, deleted_at: new Date().toISOString() } : d))
    );
    setDetailDoc(null);
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-amber-400" />
            Documents Vault
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalActive} active document{totalActive === 1 ? "" : "s"}
            {expiringSoon.length > 0 && (
              <span className="text-amber-400 ml-2">
                • {expiringSoon.length} expiring soon
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showArchived
                ? "bg-slate-800 text-slate-200 border-slate-600"
                : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            {showArchived ? "Show Active" : "Archived"}
          </button>
          <button
            onClick={() => { setSupersedeOf(null); setUploadOpen(true); }}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" /> Upload
          </button>
        </div>
      </div>

      {/* EXPIRATION ALERTS */}
      {!showArchived && expiringSoon.length > 0 && (
        <Card className="border-amber-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <p className="text-sm font-semibold text-amber-300">Expiring Soon</p>
            </div>
            <div className="space-y-1.5">
              {expiringSoon.slice(0, 5).map((d) => {
                const days = daysUntil(d.expires_at);
                const meta = getCategoryMeta(d.category);
                const Icon = meta.icon;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDetailDoc(d)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                      days < 0
                        ? "bg-rose-900/20 border-rose-800/50 hover:bg-rose-900/30"
                        : "bg-amber-900/10 border-amber-800/40 hover:bg-amber-900/20"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
                    <span className="text-sm text-slate-200 truncate flex-1">{d.title}</span>
                    <span className={`text-xs font-mono shrink-0 ${days < 0 ? "text-rose-400" : "text-amber-400"}`}>
                      {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? "today" : `${days}d`}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CATEGORY GRID + SEARCH */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* LEFT: category sidebar */}
        <div className="lg:w-56 shrink-0">
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-1.5">
            <button
              onClick={() => setActiveCategory("All")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeCategory === "All"
                  ? "bg-amber-400 text-black"
                  : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>All</span>
              <span className="ml-auto opacity-70">{totalActive}</span>
            </button>
            {DOC_CATEGORIES.map((c) => {
              const Icon = c.icon;
              const count = categoryCounts[c.id] || 0;
              const isActive = activeCategory === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? `${c.bg} ${c.color} border ${c.border}`
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "" : c.color}`} />
                  <span className="truncate">{c.label}</span>
                  {count > 0 && <span className="ml-auto opacity-70">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: search + grid */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <Inp
              placeholder="Search title, tags, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {visible.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FolderOpen className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">
                  {showArchived
                    ? "No archived documents."
                    : search.trim() || activeCategory !== "All"
                      ? "No documents match your filters."
                      : "Vault is empty. Upload your first document to get started."}
                </p>
                {!showArchived && !search.trim() && activeCategory === "All" && (
                  <button
                    onClick={() => setUploadOpen(true)}
                    className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" /> Upload First Document
                  </button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {visible.map((d) => {
                const meta = getCategoryMeta(d.category);
                const Icon = meta.icon;
                const expDays = daysUntil(d.expires_at);
                const isExpiring = expDays !== null && expDays <= 30;
                const isExpired = expDays !== null && expDays < 0;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDetailDoc(d)}
                    className={`text-left p-3 rounded-lg border transition-all hover:scale-[1.02] hover:border-slate-600 ${meta.bg} ${meta.border}`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Icon className={`w-5 h-5 ${meta.color} shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-100 truncate">{d.title}</p>
                        <p className={`text-[10px] ${meta.color}`}>
                          {meta.label}{d.version > 1 && ` • v${d.version}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{formatBytes(d.file_size)}</span>
                      <span>{new Date(d.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                    </div>

                    {d.expires_at && (
                      <div className={`mt-2 px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 ${
                        isExpired
                          ? "bg-rose-900/40 text-rose-300"
                          : isExpiring
                            ? "bg-amber-900/40 text-amber-300"
                            : "bg-slate-800/50 text-slate-400"
                      }`}>
                        <Clock className="w-3 h-3 shrink-0" />
                        {isExpired
                          ? `Expired ${Math.abs(expDays)}d ago`
                          : expDays === 0
                            ? "Expires today"
                            : `${expDays}d to expiry`}
                      </div>
                    )}

                    {d.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {d.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 text-[9px] bg-slate-800/60 text-slate-400 rounded">
                            {tag}
                          </span>
                        ))}
                        {d.tags.length > 3 && (
                          <span className="text-[9px] text-slate-500">+{d.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      <DocumentUploadModal
        isOpen={uploadOpen}
        supersedeOf={supersedeOf}
        onClose={() => { setUploadOpen(false); setSupersedeOf(null); }}
        onUploaded={handleUploaded}
      />
      {detailDoc && (
        <DocumentDetailDrawer
          doc={detailDoc}
          allDocs={documents}
          onClose={() => setDetailDoc(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onSupersede={(d) => { setSupersedeOf(d); setUploadOpen(true); setDetailDoc(null); }}
        />
      )}
    </div>
  );
}

// ================================================================
// TOOL ROI DATABASE
// Master inventory of every tool/equipment Northshore owns, with:
// - Section 179 + MACRS depreciation tracking (CPA-ready)
// - ROI per tool (earned revenue vs cost basis)
// - Per-job usage attribution
// - Maintenance log with service-due alerts
// - Anti-ROI insights (ghost tools, underutilized, overdue service)
// - Year-end tax report generator
//
// Architectural decisions worth knowing:
// - business_use_pct enforces IRS >50% rule for Section 179 eligibility
// - depreciation_method drives the tax math; UI surfaces method-specific fields
// - tool_uses are attributable to jobs (or NULL = generic/shop use)
// - "earned revenue" = sum(tool_uses.attributed_revenue) — recomputed cheap
// - Soft delete preserves tax history (you NEED prior-year records for audits)
// ================================================================

const TOOL_CATEGORIES = [
  { id: "Power",      label: "Power Tools",     color: "text-amber-400",   bg: "bg-amber-900/20",   border: "border-amber-700/40",  icon: Zap },
  { id: "Hand",       label: "Hand Tools",      color: "text-blue-400",    bg: "bg-blue-900/20",    border: "border-blue-700/40",   icon: Hammer },
  { id: "Pipe",       label: "Pipe / Plumbing", color: "text-cyan-400",    bg: "bg-cyan-900/20",    border: "border-cyan-700/40",   icon: Wrench },
  { id: "Measuring",  label: "Measuring",       color: "text-purple-400",  bg: "bg-purple-900/20",  border: "border-purple-700/40", icon: Filter },
  { id: "Safety",     label: "Safety / PPE",    color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-700/40", icon: ShieldCheck },
  { id: "Vehicle",    label: "Vehicles",        color: "text-orange-400",  bg: "bg-orange-900/20",  border: "border-orange-700/40", icon: Truck },
  { id: "Heavy",      label: "Heavy Equipment", color: "text-rose-400",    bg: "bg-rose-900/20",    border: "border-rose-700/40",   icon: HardHat },
  { id: "Battery",    label: "Battery / Power", color: "text-yellow-400",  bg: "bg-yellow-900/20",  border: "border-yellow-700/40", icon: Zap },
  { id: "Software",   label: "Software / Subs", color: "text-indigo-400",  bg: "bg-indigo-900/20",  border: "border-indigo-700/40", icon: FileText },
  { id: "Other",      label: "Other",           color: "text-slate-400",   bg: "bg-slate-800/40",   border: "border-slate-700",      icon: Package },
];

const getToolCategoryMeta = (id) =>
  TOOL_CATEGORIES.find((c) => c.id === id) || TOOL_CATEGORIES[TOOL_CATEGORIES.length - 1];

const TOOL_STATUSES = [
  { id: "active",     label: "Active",     color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-700/40" },
  { id: "in_repair",  label: "In Repair",  color: "text-amber-400",   bg: "bg-amber-900/20",   border: "border-amber-700/40" },
  { id: "lost",       label: "Lost",       color: "text-rose-400",    bg: "bg-rose-900/20",    border: "border-rose-700/40" },
  { id: "stolen",     label: "Stolen",     color: "text-rose-500",    bg: "bg-rose-900/30",    border: "border-rose-600/50" },
  { id: "sold",       label: "Sold",       color: "text-slate-400",   bg: "bg-slate-800/40",   border: "border-slate-700" },
  { id: "retired",    label: "Retired",    color: "text-slate-500",   bg: "bg-slate-800/30",   border: "border-slate-700" },
];

const getToolStatusMeta = (id) =>
  TOOL_STATUSES.find((s) => s.id === id) || TOOL_STATUSES[0];

const DEPRECIATION_METHODS = [
  { id: "section_179",  label: "Section 179",          desc: "Full deduction year 1 (Form 4562 Part I). Most tools." },
  { id: "bonus_100",    label: "Bonus 100%",           desc: "100% bonus depreciation, post 1/19/2025. Like Sec 179 but no income limit." },
  { id: "macrs_5yr",    label: "MACRS 5-Year",         desc: "Trucks, computers, most equipment. Spread across 5 yrs." },
  { id: "macrs_7yr",    label: "MACRS 7-Year",         desc: "Office furniture, some heavy equipment." },
  { id: "expense",      label: "Expensed",             desc: "Under de minimis threshold — pure expense, no depreciation." },
  { id: "none",         label: "Personal / N/A",       desc: "Not depreciated. Used for personal-use tracking." },
];

// ================================================================
// MACRS depreciation tables (half-year convention, declining balance)
// Per IRS Pub 946 — Connor's CPA will reference these.
// ================================================================
const MACRS_5YR_RATES = [0.20, 0.32, 0.192, 0.1152, 0.1152, 0.0576];
const MACRS_7YR_RATES = [0.1429, 0.2449, 0.1749, 0.1249, 0.0892, 0.0892, 0.0893, 0.0446];

// Compute current-year and cumulative depreciation for a tool, given today's date.
const computeToolDepreciation = (tool, asOfYear = new Date().getFullYear()) => {
  const cost = Number(tool.purchase_price) || 0;
  const usePct = (Number(tool.business_use_pct) || 0) / 100;
  const basis = cost * usePct;
  const placedYear = tool.placed_in_service_date
    ? new Date(tool.placed_in_service_date).getFullYear()
    : tool.purchase_date
      ? new Date(tool.purchase_date).getFullYear()
      : null;

  if (!placedYear || basis <= 0) {
    return { thisYear: 0, cumulative: 0, remaining: basis, methodLabel: "—", basisAfterBusinessUse: basis };
  }

  const yearsInService = Math.max(0, asOfYear - placedYear);
  const method = tool.depreciation_method || "section_179";

  if (method === "section_179" || method === "bonus_100" || method === "expense") {
    const electedAmount = method === "section_179" && tool.section_179_amount != null
      ? Math.min(Number(tool.section_179_amount), basis)
      : basis;
    if (yearsInService === 0) {
      return {
        thisYear: electedAmount,
        cumulative: electedAmount,
        remaining: basis - electedAmount,
        methodLabel: method === "section_179" ? "Section 179" : method === "bonus_100" ? "Bonus 100%" : "Expensed",
        basisAfterBusinessUse: basis,
      };
    }
    return {
      thisYear: 0,
      cumulative: electedAmount,
      remaining: basis - electedAmount,
      methodLabel: method === "section_179" ? "Section 179" : method === "bonus_100" ? "Bonus 100%" : "Expensed",
      basisAfterBusinessUse: basis,
    };
  }

  if (method === "macrs_5yr" || method === "macrs_7yr") {
    const table = method === "macrs_5yr" ? MACRS_5YR_RATES : MACRS_7YR_RATES;
    let cumulative = 0;
    let thisYear = 0;
    for (let i = 0; i < table.length; i++) {
      const yearAmount = basis * table[i];
      if (i < yearsInService) cumulative += yearAmount;
      if (i === yearsInService) thisYear = yearAmount;
    }
    return {
      thisYear,
      cumulative: cumulative + thisYear,
      remaining: Math.max(0, basis - cumulative - thisYear),
      methodLabel: method === "macrs_5yr" ? "MACRS 5-yr" : "MACRS 7-yr",
      basisAfterBusinessUse: basis,
    };
  }

  return { thisYear: 0, cumulative: 0, remaining: basis, methodLabel: "—", basisAfterBusinessUse: basis };
};

// Compute ROI metrics for a tool given its uses.
const computeToolROI = (tool, toolUses, settings) => {
  const cost = Number(tool.purchase_price) || 0;
  const uses = toolUses.filter((u) => u.tool_id === tool.id);
  const totalHours = uses.reduce((s, u) => s + (Number(u.hours_used) || 0), 0);
  const earnedRevenue = uses.reduce((s, u) => {
    if (u.attributed_revenue != null) return s + Number(u.attributed_revenue);
    return s + ((Number(u.hours_used) || 0) * (Number(settings?.laborRate) || 95));
  }, 0);
  const roi = cost > 0 ? ((earnedRevenue - cost) / cost) * 100 : null;
  const jobsTouched = new Set(uses.filter((u) => u.job_id).map((u) => u.job_id)).size;
  return {
    totalHours,
    earnedRevenue,
    roi,
    netGain: earnedRevenue - cost,
    jobsTouched,
    useCount: uses.length,
  };
};


// ================================================================
// TOOL UPLOAD / EDIT MODAL — full CRUD form for tools
// ================================================================
function ToolFormModal({ isOpen, existingTool, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName]                 = useState("");
  const [brand, setBrand]               = useState("");
  const [modelNumber, setModelNumber]   = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [category, setCategory]         = useState("Power");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salesTax, setSalesTax]         = useState("");
  const [supplier, setSupplier]         = useState("");
  const [businessUsePct, setBusinessUsePct] = useState(100);
  const [depreciationMethod, setDepreciationMethod] = useState("section_179");
  const [placedInService, setPlacedInService] = useState("");
  const [warrantyExpires, setWarrantyExpires] = useState("");
  const [serviceIntervalHours, setServiceIntervalHours] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [tags, setTags]                 = useState("");
  const [notes, setNotes]               = useState("");
  const [receiptFile, setReceiptFile]   = useState(null);
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (existingTool) {
      setName(existingTool.name || "");
      setBrand(existingTool.brand || "");
      setModelNumber(existingTool.model_number || "");
      setSerialNumber(existingTool.serial_number || "");
      setCategory(existingTool.category || "Power");
      setPurchaseDate(existingTool.purchase_date || "");
      setPurchasePrice(existingTool.purchase_price ?? "");
      setSalesTax(existingTool.sales_tax_paid ?? "");
      setSupplier(existingTool.supplier || "");
      setBusinessUsePct(existingTool.business_use_pct ?? 100);
      setDepreciationMethod(existingTool.depreciation_method || "section_179");
      setPlacedInService(existingTool.placed_in_service_date || existingTool.purchase_date || "");
      setWarrantyExpires(existingTool.warranty_expires_at || "");
      setServiceIntervalHours(existingTool.service_interval_hours ?? "");
      setCurrentLocation(existingTool.current_location || "");
      setTags((existingTool.tags || []).join(", "));
      setNotes(existingTool.notes || "");
    } else {
      setName(""); setBrand(""); setModelNumber(""); setSerialNumber("");
      setCategory("Power"); setPurchaseDate(""); setPurchasePrice(""); setSalesTax("");
      setSupplier(""); setBusinessUsePct(100); setDepreciationMethod("section_179");
      setPlacedInService(""); setWarrantyExpires(""); setServiceIntervalHours("");
      setCurrentLocation(""); setTags(""); setNotes("");
    }
    setReceiptFile(null);
  }, [isOpen, existingTool]);

  const methodMeta = DEPRECIATION_METHODS.find((m) => m.id === depreciationMethod);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Tool name is required"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not signed in");

      let receiptPath = existingTool?.receipt_storage_path || null;

      if (receiptFile) {
        if (receiptFile.size > 25 * 1024 * 1024) {
          throw new Error("Receipt over 25MB. Compress first.");
        }
        const safeName = receiptFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `receipts/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("tool-receipts")
          .upload(path, receiptFile, { contentType: receiptFile.type, upsert: false });
        if (upErr) throw upErr;
        receiptPath = path;
      }

      const tagArray = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        name: name.trim(),
        brand: brand.trim() || null,
        model_number: modelNumber.trim() || null,
        serial_number: serialNumber.trim() || null,
        category,
        purchase_date: purchaseDate || null,
        purchase_price: purchasePrice === "" ? 0 : Number(purchasePrice),
        sales_tax_paid: salesTax === "" ? 0 : Number(salesTax),
        supplier: supplier.trim() || null,
        receipt_storage_path: receiptPath,
        business_use_pct: Number(businessUsePct) || 100,
        depreciation_method: depreciationMethod,
        recovery_period_years: depreciationMethod === "macrs_5yr" ? 5 :
                               depreciationMethod === "macrs_7yr" ? 7 : null,
        placed_in_service_date: placedInService || purchaseDate || null,
        warranty_expires_at: warrantyExpires || null,
        service_interval_hours: serviceIntervalHours === "" ? null : Number(serviceIntervalHours),
        current_location: currentLocation.trim() || null,
        tags: tagArray,
        notes: notes.trim() || null,
      };

      let result;
      if (existingTool) {
        const { data, error } = await supabase
          .from("tools")
          .update(payload)
          .eq("id", existingTool.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from("tools")
          .insert({
            ...payload,
            status: "active",
            created_by: session.user.id,
            created_by_email: session.user.email,
          })
          .select()
          .single();
        if (error) throw error;
        result = data;
      }
      onSaved(result, !!existingTool);
      toast.success(existingTool ? "Tool updated" : "Tool added to inventory");
    } catch (err) {
      toast.error("Save failed: " + (err.message || "Unknown"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4 py-8 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full p-6 my-auto"
          >
            <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-400" />
              {existingTool ? `Edit: ${existingTool.name}` : "Add Tool to Inventory"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {existingTool
                ? "Update tool details. Changes preserve all usage and maintenance history."
                : "Track every tool with cost basis, depreciation method, and ROI metrics."}
            </p>

            <div className="space-y-3 mb-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Identification</p>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tool Name *</label>
                <Inp placeholder="e.g. M18 FUEL Hammer Drill" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Brand</label>
                  <Inp placeholder="Milwaukee" value={brand} onChange={(e) => setBrand(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Model #</label>
                  <Inp placeholder="2904-20" value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Serial #</label>
                  <Inp placeholder="optional" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Category</label>
                <Sel value={category} onChange={(e) => setCategory(e.target.value)}>
                  {TOOL_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </Sel>
              </div>
            </div>

            <div className="space-y-3 mb-4 pt-3 border-t border-slate-800">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Acquisition</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Purchase Date</label>
                  <Inp type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cost ($)</label>
                  <Inp type="number" step="0.01" placeholder="0.00" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Sales Tax ($)</label>
                  <Inp type="number" step="0.01" placeholder="0.00" value={salesTax} onChange={(e) => setSalesTax(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Supplier</label>
                <Inp placeholder="Home Depot, Menards, Acme Tools, etc." value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Receipt Photo / PDF</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-400 file:text-black hover:file:bg-amber-500 file:cursor-pointer cursor-pointer"
                />
                {receiptFile && (<p className="text-[10px] text-emerald-400 mt-1">Will upload: {receiptFile.name}</p>)}
                {existingTool?.receipt_storage_path && !receiptFile && (
                  <p className="text-[10px] text-slate-500 mt-1">Existing receipt on file. Pick a new file to replace.</p>
                )}
              </div>
            </div>

            <div className="space-y-3 mb-4 pt-3 border-t border-slate-800">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Tax & Depreciation</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Business Use % <span className="text-slate-600">(IRS requires {">"}50% for §179)</span>
                  </label>
                  <Inp type="number" min={0} max={100} value={businessUsePct} onChange={(e) => setBusinessUsePct(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Placed In Service</label>
                  <Inp type="date" value={placedInService} onChange={(e) => setPlacedInService(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Depreciation Method</label>
                <Sel value={depreciationMethod} onChange={(e) => setDepreciationMethod(e.target.value)}>
                  {DEPRECIATION_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </Sel>
                {methodMeta && (<p className="text-[10px] text-slate-500 mt-1">{methodMeta.desc}</p>)}
              </div>
              {Number(businessUsePct) <= 50 && (
                <div className="px-3 py-2 rounded-lg bg-rose-900/20 border border-rose-800/50 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Business use ≤ 50% disqualifies this tool from Section 179. Use MACRS or expense.</span>
                </div>
              )}
            </div>

            <div className="space-y-3 mb-4 pt-3 border-t border-slate-800">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Operational</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Current Location</label>
                  <Inp placeholder="Truck 1, Garage, Job site..." value={currentLocation} onChange={(e) => setCurrentLocation(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Warranty Expires</label>
                  <Inp type="date" value={warrantyExpires} onChange={(e) => setWarrantyExpires(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Service Interval (hrs) <span className="text-slate-600 ml-1">optional</span></label>
                  <Inp type="number" min={0} placeholder="50" value={serviceIntervalHours} onChange={(e) => setServiceIntervalHours(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tags</label>
                  <Inp placeholder="comma-separated: heavy, truck-1, primary" value={tags} onChange={(e) => setTags(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember about this tool..." className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !name.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                {saving ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>) : (<><Save className="w-4 h-4" /> {existingTool ? "Save Changes" : "Add Tool"}</>)}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


// ================================================================
// LOG TOOL USE MODAL
// ================================================================
function ToolUseModal({ isOpen, tool, jobs, settings, onClose, onSaved }) {
  const toast = useToast();
  const [jobId, setJobId]         = useState("");
  const [usedDate, setUsedDate]   = useState(new Date().toISOString().slice(0, 10));
  const [hoursUsed, setHoursUsed] = useState("");
  const [notes, setNotes]         = useState("");
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (isOpen) {
      setJobId(""); setUsedDate(new Date().toISOString().slice(0, 10));
      setHoursUsed(""); setNotes("");
    }
  }, [isOpen]);

  const activeJobs = jobs.filter((j) => j.status === "Active");
  const laborRate = Number(settings?.laborRate) || 95;
  const attributedRevenue = hoursUsed ? Number(hoursUsed) * laborRate : 0;

  const handleSave = async () => {
    if (!hoursUsed || Number(hoursUsed) <= 0) { toast.error("Hours used is required"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("tool_uses")
        .insert({
          tool_id: tool.id,
          job_id: jobId || null,
          used_date: usedDate,
          hours_used: Number(hoursUsed),
          attributed_revenue: attributedRevenue,
          notes: notes.trim() || null,
          user_id: session?.user?.id,
          user_email: session?.user?.email,
        })
        .select()
        .single();
      if (error) throw error;
      onSaved(data);
      toast.success(`Logged ${hoursUsed}h on ${tool.name}`);
    } catch (err) {
      toast.error("Save failed: " + (err.message || "Unknown"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" /> Log Tool Use
            </h3>
            <p className="text-xs text-slate-500 mb-4">{tool.name}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Job <span className="text-slate-600">(optional — leave blank for shop / generic use)</span></label>
                <Sel value={jobId} onChange={(e) => setJobId(e.target.value)}>
                  <option value="">— Generic use (shop, training) —</option>
                  {activeJobs.map((j) => (<option key={j.id} value={j.id}>{j.name}</option>))}
                </Sel>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Date</label>
                  <Inp type="date" value={usedDate} onChange={(e) => setUsedDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Hours Used</label>
                  <Inp type="number" step="0.25" placeholder="2.5" value={hoursUsed} onChange={(e) => setHoursUsed(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you did with it..." className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
              </div>
              {hoursUsed && Number(hoursUsed) > 0 && (
                <div className="px-3 py-2 rounded-lg bg-emerald-900/20 border border-emerald-800/50 text-xs text-emerald-300 flex items-center justify-between">
                  <span>Attributed revenue ({hoursUsed}h × {currency(laborRate)}/hr)</span>
                  <span className="font-semibold">{currency(attributedRevenue)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !hoursUsed} className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Log Use"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ================================================================
// MAINTENANCE LOG MODAL
// ================================================================
function ToolMaintenanceModal({ isOpen, tool, onClose, onSaved }) {
  const toast = useToast();
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [serviceType, setServiceType] = useState("routine");
  const [description, setDescription] = useState("");
  const [cost, setCost]               = useState("");
  const [performedBy, setPerformedBy] = useState("Self");
  const [nextDue, setNextDue]         = useState("");
  const [notes, setNotes]             = useState("");
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (isOpen) {
      setServiceDate(new Date().toISOString().slice(0, 10));
      setServiceType("routine"); setDescription(""); setCost("");
      setPerformedBy("Self"); setNextDue(""); setNotes("");
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!description.trim()) { toast.error("Description is required"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("tool_maintenance")
        .insert({
          tool_id: tool.id,
          service_date: serviceDate,
          service_type: serviceType,
          description: description.trim(),
          cost: cost === "" ? 0 : Number(cost),
          performed_by: performedBy.trim() || null,
          next_service_due: nextDue || null,
          notes: notes.trim() || null,
          user_id: session?.user?.id,
          user_email: session?.user?.email,
        })
        .select()
        .single();
      if (error) throw error;
      onSaved(data);
      toast.success("Service logged. Hours-since-service reset.");
    } catch (err) {
      toast.error("Save failed: " + (err.message || "Unknown"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-400" /> Log Maintenance
            </h3>
            <p className="text-xs text-slate-500 mb-4">{tool.name}</p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Service Date</label>
                  <Inp type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Type</label>
                  <Sel value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                    <option value="routine">Routine</option>
                    <option value="repair">Repair</option>
                    <option value="replacement">Replacement</option>
                    <option value="inspection">Inspection</option>
                  </Sel>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description *</label>
                <Inp placeholder="Blade change, oil/filter, recharge cells..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cost ($)</label>
                  <Inp type="number" step="0.01" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Performed By</label>
                  <Inp value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Next Service Due <span className="text-slate-600">(optional)</span></label>
                <Inp type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !description.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Log Service"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


// ================================================================
// TOOL DETAIL DRAWER
// ================================================================
function ToolDetailDrawer({ tool, toolUses, toolMaintenance, jobs, settings, onClose, onUpdated, onDeleted }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [useModalOpen, setUseModalOpen] = useState(false);
  const [maintModalOpen, setMaintModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState(null);

  useEffect(() => {
    if (!tool?.receipt_storage_path) { setReceiptUrl(null); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase.storage
        .from("tool-receipts")
        .createSignedUrl(tool.receipt_storage_path, 60);
      if (alive && data) setReceiptUrl(data.signedUrl);
    })();
    return () => { alive = false; };
  }, [tool?.id, tool?.receipt_storage_path]);

  if (!tool) return null;

  const meta = getToolCategoryMeta(tool.category);
  const Icon = meta.icon;
  const dep = computeToolDepreciation(tool);
  const roi = computeToolROI(tool, toolUses, settings);
  const myUses = toolUses.filter((u) => u.tool_id === tool.id).slice(0, 50);
  const myMaint = toolMaintenance.filter((m) => m.tool_id === tool.id).slice(0, 50);
  const serviceDueDays = tool.next_service_due ? daysUntil(tool.next_service_due) : null;
  const warrantyDays = tool.warranty_expires_at ? daysUntil(tool.warranty_expires_at) : null;

  const updateStatus = async (newStatus) => {
    const { data, error } = await supabase
      .from("tools")
      .update({ status: newStatus })
      .eq("id", tool.id)
      .select()
      .single();
    if (!error && data) {
      onUpdated(data);
      toast.success(`Status updated to ${getToolStatusMeta(newStatus).label}`);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Archive this tool?",
      message: "Tool will be hidden from the inventory but tax history, usage logs, and maintenance records are preserved (required for IRS audits).",
      confirmText: "Archive",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("tools")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", tool.id);
    if (!error) {
      onDeleted(tool.id);
      toast.success("Tool archived");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[998] flex items-stretch justify-end"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border-l-2 border-slate-700 w-full max-w-xl overflow-y-auto"
        >
          <div className={`${meta.bg} ${meta.border} border-b px-5 py-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <Icon className={`w-7 h-7 ${meta.color} shrink-0 mt-0.5`} />
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-100 break-words">{tool.name}</h3>
                  <p className={`text-xs ${meta.color}`}>
                    {meta.label}
                    {tool.brand && ` • ${tool.brand}`}
                    {tool.model_number && ` ${tool.model_number}`}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white shrink-0 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {TOOL_STATUSES.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  onClick={() => updateStatus(s.id)}
                  className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                    tool.status === s.id ? `${s.bg} ${s.color} ${s.border}` : "bg-slate-900 text-slate-500 border-slate-700 hover:bg-slate-800"
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <Sel value={tool.status} onChange={(e) => updateStatus(e.target.value)} className="text-[10px] py-1 px-2 w-auto">
                {TOOL_STATUSES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
              </Sel>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {(serviceDueDays !== null && serviceDueDays <= 14) && (
              <div className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${
                serviceDueDays < 0 ? "bg-rose-900/30 border-rose-700/50 text-rose-200" : "bg-amber-900/30 border-amber-700/50 text-amber-200"
              }`}>
                <Wrench className="w-4 h-4 shrink-0" />
                <span>
                  {serviceDueDays < 0
                    ? `Service overdue by ${Math.abs(serviceDueDays)} day${Math.abs(serviceDueDays) === 1 ? "" : "s"}`
                    : `Service due in ${serviceDueDays} day${serviceDueDays === 1 ? "" : "s"}`}
                </span>
              </div>
            )}
            {tool.service_interval_hours && tool.hours_since_service >= tool.service_interval_hours && (
              <div className="rounded-lg border bg-rose-900/30 border-rose-700/50 text-rose-200 px-3 py-2 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Service threshold reached: {Number(tool.hours_since_service).toFixed(1)}h since last service (interval: {tool.service_interval_hours}h)</span>
              </div>
            )}
            {warrantyDays !== null && warrantyDays >= 0 && warrantyDays <= 30 && (
              <div className="rounded-lg border bg-blue-900/30 border-blue-700/50 text-blue-200 px-3 py-2 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Warranty expires in {warrantyDays} day{warrantyDays === 1 ? "" : "s"}</span>
              </div>
            )}

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <p className="text-xs uppercase tracking-wider text-slate-500">ROI Performance</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Total Hours</p>
                    <p className="text-xl font-bold text-slate-100 tabular-nums">{roi.totalHours.toFixed(1)}h</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{roi.useCount} session{roi.useCount === 1 ? "" : "s"}</p>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Earned Revenue</p>
                    <p className="text-xl font-bold text-emerald-400 tabular-nums">{currency(roi.earnedRevenue)}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">across {roi.jobsTouched} job{roi.jobsTouched === 1 ? "" : "s"}</p>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Cost Basis</p>
                    <p className="text-xl font-bold text-slate-300 tabular-nums">{currency(tool.purchase_price)}</p>
                    {tool.sales_tax_paid > 0 && (<p className="text-[10px] text-slate-600 mt-0.5">+ {currency(tool.sales_tax_paid)} tax</p>)}
                  </div>
                  <div className={`bg-slate-950/60 border rounded-lg p-3 ${roi.roi != null && roi.roi >= 0 ? "border-emerald-800/50" : "border-rose-800/50"}`}>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">ROI</p>
                    <p className={`text-xl font-bold tabular-nums ${
                      roi.roi == null ? "text-slate-500" : roi.roi >= 100 ? "text-emerald-400" : roi.roi >= 0 ? "text-amber-400" : "text-rose-400"
                    }`}>
                      {roi.roi == null ? "—" : `${roi.roi >= 0 ? "+" : ""}${roi.roi.toFixed(0)}%`}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{roi.netGain >= 0 ? "+" : ""}{currency(roi.netGain)} net</p>
                  </div>
                </div>

                {roi.useCount > 0 && (
                  <div className={`mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
                    roi.roi >= 100 ? 'bg-emerald-900/20 border border-emerald-800/40 text-emerald-300' :
                    roi.roi >= 0 ? 'bg-amber-900/20 border border-amber-800/40 text-amber-300' :
                    'bg-rose-900/20 border border-rose-800/40 text-rose-300'
                  }`}>
                    {roi.roi >= 100 ? (
                      <><CheckCircle2 className="w-3.5 h-3.5" /> Earning its keep — paid for itself {(roi.roi / 100).toFixed(1)}× over.</>
                    ) : roi.roi >= 0 ? (
                      <><Info className="w-3.5 h-3.5" /> Recouping cost — {(100 - roi.roi).toFixed(0)}% to break even.</>
                    ) : (
                      <><AlertTriangle className="w-3.5 h-3.5" /> Below cost basis — needs more job hours.</>
                    )}
                  </div>
                )}
                {roi.useCount === 0 && (
                  <div className="mt-3 px-3 py-2 rounded-lg text-xs bg-slate-800/40 border border-slate-700 text-slate-400 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" /> Ghost tool — not yet used on any job.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  <p className="text-xs uppercase tracking-wider text-slate-500">Tax Treatment</p>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="text-slate-200">{dep.methodLabel}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Cost basis</span><span className="text-slate-200">{currency(tool.purchase_price)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Business use</span><span className="text-slate-200">{tool.business_use_pct}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Deductible basis</span><span className="text-slate-200">{currency(dep.basisAfterBusinessUse)}</span></div>
                  <div className="flex justify-between font-semibold pt-1 border-t border-slate-800"><span className="text-slate-400">This year deduction</span><span className="text-emerald-400">{currency(dep.thisYear)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Cumulative deducted</span><span className="text-slate-300">{currency(dep.cumulative)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Remaining basis</span><span className="text-slate-300">{currency(dep.remaining)}</span></div>
                </div>
                {tool.business_use_pct <= 50 && (tool.depreciation_method === "section_179" || tool.depreciation_method === "bonus_100") && (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-rose-900/20 border border-rose-800/50 text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Business use ≤ 50% — IRS disallows §179/Bonus. Switch to MACRS.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <p className="text-xs uppercase tracking-wider text-slate-500">Usage History ({myUses.length})</p>
                  </div>
                  <button onClick={() => setUseModalOpen(true)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
                    <Plus className="w-3 h-3" /> Log Use
                  </button>
                </div>
                {myUses.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-3">No usage logged yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {myUses.map((u) => {
                      const job = jobs.find((j) => j.id === u.job_id);
                      return (
                        <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-slate-800/40 text-xs">
                          <span className="text-slate-400 shrink-0">{new Date(u.used_date).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                          <span className="text-amber-400 font-mono shrink-0">{Number(u.hours_used).toFixed(1)}h</span>
                          <span className="text-slate-300 truncate flex-1">{job?.name || <span className="text-slate-600 italic">generic use</span>}</span>
                          {u.attributed_revenue > 0 && (<span className="text-emerald-400 shrink-0">{currency(u.attributed_revenue)}</span>)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-slate-500" />
                    <p className="text-xs uppercase tracking-wider text-slate-500">Maintenance ({myMaint.length})</p>
                  </div>
                  <button onClick={() => setMaintModalOpen(true)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
                    <Plus className="w-3 h-3" /> Log Service
                  </button>
                </div>
                {myMaint.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-3">No maintenance logged.</p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {myMaint.map((m) => (
                      <div key={m.id} className="px-2 py-1.5 rounded bg-slate-800/40 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 shrink-0">{new Date(m.service_date).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" })}</span>
                          <span className="text-slate-200 truncate flex-1">{m.description}</span>
                          {m.cost > 0 && <span className="text-rose-400 shrink-0">{currency(m.cost)}</span>}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 ml-2">{m.service_type} • {m.performed_by || "—"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-xs space-y-1.5">
                {tool.serial_number && (<div className="flex justify-between"><span className="text-slate-500">Serial</span><span className="text-slate-300 font-mono">{tool.serial_number}</span></div>)}
                {tool.supplier && (<div className="flex justify-between"><span className="text-slate-500">Supplier</span><span className="text-slate-300">{tool.supplier}</span></div>)}
                {tool.current_location && (<div className="flex justify-between"><span className="text-slate-500">Location</span><span className="text-slate-300">{tool.current_location}</span></div>)}
                {tool.warranty_expires_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Warranty</span>
                    <span className={warrantyDays != null && warrantyDays < 0 ? "text-rose-400" : "text-slate-300"}>
                      {new Date(tool.warranty_expires_at).toLocaleDateString([], { dateStyle: "medium" })}
                    </span>
                  </div>
                )}
                {tool.tags?.length > 0 && (
                  <div className="pt-1.5">
                    <span className="text-slate-500 text-[10px]">TAGS</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tool.tags.map((t) => (<span key={t} className="px-1.5 py-0.5 text-[9px] bg-slate-800 text-slate-400 rounded">{t}</span>))}
                    </div>
                  </div>
                )}
                {tool.notes && (<div className="pt-1.5 border-t border-slate-800 mt-2"><p className="text-slate-300 whitespace-pre-wrap">{tool.notes}</p></div>)}
                {receiptUrl && (
                  <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 mt-2">
                    <FileText className="w-3.5 h-3.5" /> View Receipt
                  </a>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <button onClick={() => setEditModalOpen(true)} className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={handleDelete} className="ml-auto px-3 py-2 rounded-lg text-xs font-semibold bg-rose-900/30 text-rose-300 hover:bg-rose-900/50 border border-rose-800/50 transition-colors flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Archive
              </button>
            </div>
          </div>

          <ToolUseModal isOpen={useModalOpen} tool={tool} jobs={jobs} settings={settings} onClose={() => setUseModalOpen(false)} onSaved={(newUse) => { onUpdated({ ...tool, _newUse: newUse }); setUseModalOpen(false); }} />
          <ToolMaintenanceModal isOpen={maintModalOpen} tool={tool} onClose={() => setMaintModalOpen(false)} onSaved={(newMaint) => { onUpdated({ ...tool, _newMaint: newMaint }); setMaintModalOpen(false); }} />
          <ToolFormModal isOpen={editModalOpen} existingTool={tool} onClose={() => setEditModalOpen(false)} onSaved={(updated) => { onUpdated(updated); setEditModalOpen(false); }} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


// ================================================================
// TOOL ROI DATABASE — top-level Tools tab
// ================================================================
function ToolsROI({ tools, setTools, toolUses, setToolUses, toolMaintenance, setToolMaintenance, jobs, settings }) {
  const [search, setSearch]                 = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus]     = useState("active");
  const [sortBy, setSortBy]                 = useState("recent");
  const [showArchived, setShowArchived]     = useState(false);
  const [formModalOpen, setFormModalOpen]   = useState(false);
  const [detailTool, setDetailTool]         = useState(null);
  const [showTaxReport, setShowTaxReport]   = useState(false);

  const visible = tools.filter((t) => {
    if (!showArchived && t.deleted_at) return false;
    if (showArchived && !t.deleted_at) return false;
    if (filterCategory !== "All" && t.category !== filterCategory) return false;
    if (filterStatus !== "All" && t.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = [t.name, t.brand, t.model_number, t.serial_number, t.supplier, t.notes, ...(t.tags || [])]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...visible].sort((a, b) => {
    if (sortBy === "recent") return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === "cost") return (Number(b.purchase_price) || 0) - (Number(a.purchase_price) || 0);
    const aRoi = computeToolROI(a, toolUses, settings);
    const bRoi = computeToolROI(b, toolUses, settings);
    if (sortBy === "roi") return (bRoi.roi ?? -Infinity) - (aRoi.roi ?? -Infinity);
    if (sortBy === "hours") return bRoi.totalHours - aRoi.totalHours;
    return 0;
  });

  const activeTools = tools.filter((t) => !t.deleted_at);
  const totalCostBasis = activeTools.reduce((s, t) => s + (Number(t.purchase_price) || 0), 0);
  const totalEarnedRevenue = activeTools.reduce((s, t) => s + computeToolROI(t, toolUses, settings).earnedRevenue, 0);
  const totalNetGain = totalEarnedRevenue - totalCostBasis;
  const fleetROI = totalCostBasis > 0 ? ((totalEarnedRevenue - totalCostBasis) / totalCostBasis) * 100 : null;
  const ghostTools = activeTools.filter((t) => {
    const r = computeToolROI(t, toolUses, settings);
    return r.useCount === 0 && (Number(t.purchase_price) || 0) > 0;
  });
  const overdueService = activeTools.filter((t) => {
    if (!t.next_service_due) return false;
    return daysUntil(t.next_service_due) < 0;
  });

  const currentYear = new Date().getFullYear();
  const taxSummary = activeTools.reduce((acc, t) => {
    const dep = computeToolDepreciation(t, currentYear);
    if (dep.thisYear > 0) {
      acc.totalDeduction += dep.thisYear;
      acc.byMethod[dep.methodLabel] = (acc.byMethod[dep.methodLabel] || 0) + dep.thisYear;
      acc.tools.push({ tool: t, dep });
    }
    return acc;
  }, { totalDeduction: 0, byMethod: {}, tools: [] });

  const handleSaved = (saved, isEdit) => {
    setFormModalOpen(false);
    if (isEdit) {
      setTools((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
    } else {
      setTools((prev) => [saved, ...prev]);
    }
    setDetailTool(saved);
  };

  const handleUpdated = async (updated) => {
    if (updated._newUse) {
      setToolUses((prev) => [updated._newUse, ...prev]);
      const { data } = await supabase.from("tools").select("*").eq("id", updated.id).single();
      if (data) {
        setTools((prev) => prev.map((t) => (t.id === data.id ? data : t)));
        setDetailTool(data);
      }
    } else if (updated._newMaint) {
      setToolMaintenance((prev) => [updated._newMaint, ...prev]);
      const { data } = await supabase.from("tools").select("*").eq("id", updated.id).single();
      if (data) {
        setTools((prev) => prev.map((t) => (t.id === data.id ? data : t)));
        setDetailTool(data);
      }
    } else {
      setTools((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setDetailTool(updated);
    }
  };

  const handleDeleted = (id) => {
    setTools((prev) => prev.map((t) => (t.id === id ? { ...t, deleted_at: new Date().toISOString() } : t)));
    setDetailTool(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-amber-400" />
            Tool & Equipment ROI
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeTools.length} active tool{activeTools.length === 1 ? "" : "s"}
            {ghostTools.length > 0 && (<span className="text-amber-400 ml-2">• {ghostTools.length} unused</span>)}
            {overdueService.length > 0 && (<span className="text-rose-400 ml-2">• {overdueService.length} service overdue</span>)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTaxReport(!showTaxReport)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <DollarSign className="w-3.5 h-3.5" /> {showTaxReport ? "Hide" : "Tax Report"}
          </button>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showArchived ? "bg-slate-800 text-slate-200 border-slate-600" : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"
            }`}
          >
            <Archive className="w-3.5 h-3.5" /> {showArchived ? "Active" : "Archived"}
          </button>
          <button
            onClick={() => setFormModalOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Tool
          </button>
        </div>
      </div>

      {showTaxReport && (
        <Card className="border-amber-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <p className="text-sm font-bold text-amber-300">{currentYear} Tax Report — CPA Ready</p>
              </div>
              <span className="text-xs text-slate-500">Form 4562 reference</span>
            </div>
            {taxSummary.totalDeduction === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                No deductions calculated for {currentYear}. Add tools with purchase dates and depreciation methods.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-950/60 border border-emerald-800/40 rounded-lg p-3">
                    <p className="text-[10px] text-emerald-400 uppercase tracking-widest mb-1">Total {currentYear} Deduction</p>
                    <p className="text-2xl font-bold text-emerald-400 tabular-nums">{currency(taxSummary.totalDeduction)}</p>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Tools With Deduction</p>
                    <p className="text-2xl font-bold text-slate-100 tabular-nums">{taxSummary.tools.length}</p>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Methods Used</p>
                    <p className="text-2xl font-bold text-slate-100 tabular-nums">{Object.keys(taxSummary.byMethod).length}</p>
                  </div>
                </div>
                <div className="space-y-1 mb-4">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">By Method</p>
                  {Object.entries(taxSummary.byMethod).map(([method, amount]) => (
                    <div key={method} className="flex justify-between text-xs px-2 py-1.5 bg-slate-900/40 rounded">
                      <span className="text-slate-300">{method}</span>
                      <span className="text-emerald-400 font-mono">{currency(amount)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  Send this report to your CPA. Section 179 election is filed on Form 4562 Part I.
                  IRS Pub 946 governs MACRS tables. Bonus depreciation is 100% for property placed in service
                  after Jan 19, 2025. This is a tracking aid — confirm all figures with your tax professional.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Total Cost Basis</p>
          <p className="text-2xl font-bold text-slate-100 tabular-nums">{currency(totalCostBasis)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Earned Revenue</p>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{currency(totalEarnedRevenue)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${
          totalNetGain >= 0 ? "bg-emerald-950/20 border-emerald-800/40" : "bg-rose-950/20 border-rose-800/40"
        }`}>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Net Gain</p>
          <p className={`text-2xl font-bold tabular-nums ${totalNetGain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {totalNetGain >= 0 ? "+" : ""}{currency(totalNetGain)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Fleet ROI</p>
          <p className={`text-2xl font-bold tabular-nums ${
            fleetROI == null ? "text-slate-500" : fleetROI >= 100 ? "text-emerald-400" : fleetROI >= 0 ? "text-amber-400" : "text-rose-400"
          }`}>
            {fleetROI == null ? "—" : `${fleetROI >= 0 ? "+" : ""}${fleetROI.toFixed(0)}%`}
          </p>
        </div>
      </div>

      {(ghostTools.length > 0 || overdueService.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ghostTools.length > 0 && (
            <Card className="border-amber-700/40">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <p className="text-xs font-semibold text-amber-300">Ghost Tools ({ghostTools.length})</p>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">Bought, never logged on a job</p>
                <div className="space-y-1">
                  {ghostTools.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setDetailTool(t)}
                      className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded bg-slate-800/40 hover:bg-slate-800 text-left transition-colors"
                    >
                      <span className="text-slate-200 truncate">{t.name}</span>
                      <span className="text-rose-400 shrink-0">{currency(t.purchase_price)}</span>
                    </button>
                  ))}
                  {ghostTools.length > 3 && (<p className="text-[10px] text-slate-500 italic">+ {ghostTools.length - 3} more</p>)}
                </div>
              </CardContent>
            </Card>
          )}
          {overdueService.length > 0 && (
            <Card className="border-rose-700/40">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="w-4 h-4 text-rose-400" />
                  <p className="text-xs font-semibold text-rose-300">Service Overdue ({overdueService.length})</p>
                </div>
                <div className="space-y-1">
                  {overdueService.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setDetailTool(t)}
                      className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded bg-slate-800/40 hover:bg-slate-800 text-left transition-colors"
                    >
                      <span className="text-slate-200 truncate">{t.name}</span>
                      <span className="text-rose-400 shrink-0">{Math.abs(daysUntil(t.next_service_due))}d ago</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <Inp placeholder="Search by name, brand, model, serial, supplier..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Sel value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-auto">
          <option value="All">All categories</option>
          {TOOL_CATEGORIES.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
        </Sel>
        <Sel value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-auto">
          <option value="All">All statuses</option>
          {TOOL_STATUSES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
        </Sel>
        <Sel value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-auto">
          <option value="recent">Most recent</option>
          <option value="roi">Highest ROI</option>
          <option value="hours">Most hours</option>
          <option value="cost">Highest cost</option>
        </Sel>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Wrench className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              {showArchived ? "No archived tools." : tools.length === 0 ? "No tools in inventory yet. Add your first one to start tracking ROI." : "No tools match your filters."}
            </p>
            {!showArchived && tools.length === 0 && (
              <button onClick={() => setFormModalOpen(true)} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 transition-colors inline-flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add First Tool
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {sorted.map((t) => {
            const meta = getToolCategoryMeta(t.category);
            const Icon = meta.icon;
            const statusMeta = getToolStatusMeta(t.status);
            const r = computeToolROI(t, toolUses, settings);
            const serviceDue = t.next_service_due ? daysUntil(t.next_service_due) : null;
            return (
              <button
                key={t.id}
                onClick={() => setDetailTool(t)}
                className={`text-left p-4 rounded-lg border transition-all hover:scale-[1.01] hover:border-slate-600 ${meta.bg} ${meta.border}`}
              >
                <div className="flex items-start gap-2 mb-3">
                  <Icon className={`w-5 h-5 ${meta.color} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{t.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {t.brand}{t.brand && t.model_number && " • "}{t.model_number}
                    </p>
                  </div>
                  {t.status !== "active" && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${statusMeta.bg} ${statusMeta.color} border ${statusMeta.border}`}>
                      {statusMeta.label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2 text-[10px]">
                  <div>
                    <p className="text-slate-500 uppercase tracking-widest">Cost</p>
                    <p className="text-slate-200 font-mono">{currency(t.purchase_price)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-widest">Hours</p>
                    <p className="text-slate-200 font-mono">{r.totalHours.toFixed(1)}h</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-widest">ROI</p>
                    <p className={`font-mono ${
                      r.roi == null ? "text-slate-500" : r.roi >= 100 ? "text-emerald-400" : r.roi >= 0 ? "text-amber-400" : "text-rose-400"
                    }`}>
                      {r.roi == null ? "—" : `${r.roi >= 0 ? "+" : ""}${r.roi.toFixed(0)}%`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.useCount === 0 && (Number(t.purchase_price) || 0) > 0 && (
                    <span className="px-1.5 py-0.5 text-[9px] bg-amber-900/40 text-amber-300 rounded">ghost</span>
                  )}
                  {r.roi != null && r.roi >= 100 && (
                    <span className="px-1.5 py-0.5 text-[9px] bg-emerald-900/40 text-emerald-300 rounded">earning</span>
                  )}
                  {serviceDue !== null && serviceDue < 0 && (
                    <span className="px-1.5 py-0.5 text-[9px] bg-rose-900/40 text-rose-300 rounded">service overdue</span>
                  )}
                  {t.business_use_pct < 100 && (
                    <span className="px-1.5 py-0.5 text-[9px] bg-slate-800 text-slate-400 rounded">{t.business_use_pct}% biz</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <ToolFormModal isOpen={formModalOpen} existingTool={null} onClose={() => setFormModalOpen(false)} onSaved={handleSaved} />
      {detailTool && (
        <ToolDetailDrawer
          tool={detailTool}
          toolUses={toolUses}
          toolMaintenance={toolMaintenance}
          jobs={jobs}
          settings={settings}
          onClose={() => setDetailTool(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}


// ================================================================
// PHASE 4 DOCUMENTS — Invoices, Lien Waivers, Sworn Statements
//
// Michigan-compliant legal/financial document infrastructure.
// All statutory text per MCL 570.1110 (sworn statements) and
// MCL 570.1115(9) (lien waivers).
//
// Architectural decisions:
// - Invoice line items stored as JSONB for flexibility (SOV-style)
// - Payment ledger drives invoice status via DB trigger
// - Mark Paid auto-suggests matching waiver type with payment data
//   pre-populated (the killer workflow — competitors don't do this)
// - Statutory text frozen in document_text at issue time (statute
//   could change; document must remain whatever was in effect when issued)
// ================================================================

const INVOICE_STATUSES = [
  { id: "draft",   label: "Draft",   color: "text-slate-400",   bg: "bg-slate-800/40",   border: "border-slate-700" },
  { id: "sent",    label: "Sent",    color: "text-blue-400",    bg: "bg-blue-900/20",    border: "border-blue-700/40" },
  { id: "partial", label: "Partial", color: "text-amber-400",   bg: "bg-amber-900/20",   border: "border-amber-700/40" },
  { id: "paid",    label: "Paid",    color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-700/40" },
  { id: "overdue", label: "Overdue", color: "text-rose-400",    bg: "bg-rose-900/20",    border: "border-rose-700/40" },
  { id: "void",    label: "Void",    color: "text-slate-500",   bg: "bg-slate-800/30",   border: "border-slate-700" },
];
const getInvoiceStatusMeta = (id) =>
  INVOICE_STATUSES.find((s) => s.id === id) || INVOICE_STATUSES[0];

const PAYMENT_METHODS = [
  { id: "check",  label: "Check"        },
  { id: "ach",    label: "ACH / Bank Transfer" },
  { id: "card",   label: "Card"         },
  { id: "cash",   label: "Cash"         },
  { id: "wire",   label: "Wire"         },
  { id: "other",  label: "Other"        },
];

const WAIVER_TYPES = [
  {
    id: "partial_conditional",
    label: "Partial Conditional",
    short: "Partial Cond.",
    desc: "Issued before payment clears for a partial scope. Becomes effective only when payment is actually received.",
    color: "text-amber-400",
    bg: "bg-amber-900/20",
    border: "border-amber-700/40",
  },
  {
    id: "partial_unconditional",
    label: "Partial Unconditional",
    short: "Partial Uncond.",
    desc: "Issued AFTER partial payment clears. Effective immediately upon signing.",
    color: "text-blue-400",
    bg: "bg-blue-900/20",
    border: "border-blue-700/40",
  },
  {
    id: "full_conditional",
    label: "Full Conditional",
    short: "Full Cond.",
    desc: "Issued before final payment clears. Effective only when final payment is received in cleared funds.",
    color: "text-purple-400",
    bg: "bg-purple-900/20",
    border: "border-purple-700/40",
  },
  {
    id: "full_unconditional",
    label: "Full Unconditional",
    short: "Full Uncond.",
    desc: "Issued AFTER final payment clears. Releases ALL lien rights. Sign only after funds confirmed received.",
    color: "text-emerald-400",
    bg: "bg-emerald-900/20",
    border: "border-emerald-700/40",
  },
];
const getWaiverMeta = (id) =>
  WAIVER_TYPES.find((w) => w.id === id) || WAIVER_TYPES[0];

// ================================================================
// STATUTORY TEXT GENERATORS — MCL 570.1115 verbatim
// These produce the full document body Connor will print/email.
// DO NOT edit the statutory language without consulting a Michigan
// construction attorney — these forms must "substantially comply"
// with the statute or they can be voided in court.
// ================================================================

const generateLienWaiverText = (waiver) => {
  const {
    waiver_type,
    contractor_name,
    owner_name,
    property_address,
    property_county,
    payment_amount,
    payment_through_date,
    condition_payment_amount,
    condition_payment_method,
    condition_reference,
  } = waiver;

  const fmtAmount = (n) => new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
  }).format(Number(n) || 0);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  }) : "________________";

  // v1.0.1 — visible fallback placeholders for missing source data
  const safeOwner    = (owner_name || "").trim() || "[OWNER NAME REQUIRED — UPDATE BEFORE USE]";
  const safeAddress  = (property_address || "").trim() || "[PROPERTY ADDRESS REQUIRED — UPDATE BEFORE USE]";
  const safeCounty   = (property_county || "").trim() || "Muskegon";
  const safeCompany  = (contractor_name || "").trim() || "Northshore Mechanical & Construction LLC";

  const isPartial = waiver_type.startsWith("partial");
  const isConditional = waiver_type.endsWith("_conditional");
  const typeLabel = getWaiverMeta(waiver_type).label.toUpperCase();

  // Header common to all four
  let body = `${typeLabel} WAIVER OF LIEN

State of Michigan
County of ${safeCounty}

`;

  // Pre-amount language varies by type
  if (waiver_type === "full_unconditional") {
    body += `My/our contract with ${safeOwner} to provide labor and/or materials for an improvement to the property described as:

${safeAddress}

has been fully paid and satisfied. By signing this waiver, all my/our construction lien rights against the above-described property are hereby waived and released in full.

This waiver is unconditional and is effective immediately upon signing, regardless of any subsequent dispute regarding the payment received.

Total amount received: ${fmtAmount(payment_amount)}
For all labor and/or materials furnished through: ${fmtDate(payment_through_date)}
`;
  } else if (waiver_type === "partial_unconditional") {
    body += `My/our contract with ${safeOwner} to provide labor and/or materials for an improvement to the property described as:

${safeAddress}

has been partially paid in the amount stated below. By signing this waiver, my/our construction lien rights against the above-described property are hereby waived and released to the extent of the payment received.

This waiver is unconditional and is effective immediately upon signing, regardless of any subsequent dispute regarding the payment received. Lien rights are RESERVED for any unpaid amounts and for any labor or materials provided after the date stated below.

Amount received: ${fmtAmount(payment_amount)}
For labor and/or materials furnished through: ${fmtDate(payment_through_date)}
`;
  } else if (waiver_type === "full_conditional") {
    body += `My/our contract with ${safeOwner} for labor and/or materials for an improvement to the property described as:

${safeAddress}

is to be fully paid in the amount stated below. By signing this waiver, all my/our construction lien rights against the above-described property are hereby waived and released in full, BUT ONLY UPON ACTUAL RECEIPT of the payment described below in cleared funds.

This waiver is CONDITIONAL. It becomes effective only when the payment described below is actually received in cleared funds. If the payment fails for any reason (including but not limited to a returned check, reversed transfer, or stop payment), this waiver is void and all lien rights are preserved.

Amount of payment expected: ${fmtAmount(condition_payment_amount || payment_amount)}
Payment method: ${condition_payment_method || "________________"}
Reference / check #: ${condition_reference || "________________"}
For all labor and/or materials furnished through: ${fmtDate(payment_through_date)}
`;
  } else {
    // partial_conditional
    body += `My/our contract with ${safeOwner} for labor and/or materials for an improvement to the property described as:

${safeAddress}

is to be partially paid in the amount stated below. By signing this waiver, my/our construction lien rights against the above-described property are hereby waived and released to the extent of the payment described below, BUT ONLY UPON ACTUAL RECEIPT of that payment in cleared funds.

This waiver is CONDITIONAL. It becomes effective only when the payment described below is actually received in cleared funds. If the payment fails for any reason (including but not limited to a returned check, reversed transfer, or stop payment), this waiver is void and all lien rights are preserved. Lien rights are also RESERVED for any unpaid amounts and for any labor or materials provided after the date stated below.

Amount of payment expected: ${fmtAmount(condition_payment_amount || payment_amount)}
Payment method: ${condition_payment_method || "________________"}
Reference / check #: ${condition_reference || "________________"}
For labor and/or materials furnished through: ${fmtDate(payment_through_date)}
`;
  }

  // Signature block common to all
  body += `

Lien Claimant: ${safeCompany}

Signature: ____________________________________________

Printed name: __________________________________________

Title: _________________________________________________

Date: __________________________________________________

This waiver complies with MCL 570.1115 of the Michigan Construction Lien Act.`;

  return body;
};

// ================================================================
// SWORN STATEMENT — MCL 570.1110 verbatim warnings required
// ================================================================
const generateSwornStatementText = (statement) => {
  const {
    contractor_name,
    deponent_name,
    deponent_role,
    property_address,
    property_county,
    is_residential,
    parties = [],
    statement_date,
    notary_name,
    notary_county,
    notary_commission_expires,
  } = statement;

  const fmtAmount = (n) => new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
  }).format(Number(n) || 0);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  }) : "________________";

  // v1.0.1 — visible fallback placeholders for missing source data
  const safeAddress  = (property_address || "").trim() || "[PROPERTY ADDRESS REQUIRED — UPDATE BEFORE USE]";
  const safeCounty   = (property_county || "").trim() || "Muskegon";
  const safeContractor = (contractor_name || "").trim() || "Northshore Mechanical & Construction LLC";
  const safeDeponent = (deponent_name || "").trim() || "[DEPONENT NAME REQUIRED]";
  const safeRole     = (deponent_role || "").trim() || "Owner / Member";

  // v1.0.1 — wrap warnings on word boundaries (~72 chars) instead of mid-word breaks
  const wrapWarning = (text, width = 72) => {
    const words = text.replace(/\s+/g, " ").trim().split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      if ((line + " " + w).trim().length > width) {
        lines.push(line.trim());
        line = w;
      } else {
        line = (line + " " + w).trim();
      }
    }
    if (line) lines.push(line.trim());
    return lines.join("\n");
  };

  let body = `SWORN STATEMENT

State of Michigan
County of ${safeCounty}

${safeDeponent}, being first duly sworn, deposes and says:

That ${safeContractor} is the contractor for an improvement to the following described real property situated in ${safeCounty} County, Michigan:

${safeAddress}

I make this statement as the ${safeRole} of the contractor to represent to the owner or lessee of the property and his or her agents that the property is free from claims of construction liens, or the possibility of construction liens, except as specifically set forth in this statement and except for claims of construction liens by laborers that may be provided under section 109 of the construction lien act, 1980 PA 497, MCL 570.1109.

The following is a statement of each subcontractor and supplier, and laborer with whom the undersigned has (a) contracted, or (b) made arrangements, or (c) plans to make arrangements, in connection with the improvement to the property:

`;

  // Parties list (formatted as a column block)
  if (parties.length === 0) {
    body += `[No subcontractors, suppliers, or laborers have been engaged for this project. The contractor is performing all labor with materials furnished from the contractor's own inventory and/or specifically purchased for this contract.]\n\n`;
  } else {
    body += `------------------------------------------------------------------------\n`;
    body += `NAME / ADDRESS                | TYPE          | CONTRACT  | PAID      | DUE\n`;
    body += `------------------------------------------------------------------------\n`;
    parties.forEach((p) => {
      const name = (p.name || "").substring(0, 28).padEnd(28);
      const addr = (p.address || "").substring(0, 28).padEnd(28);
      const type = (p.type || "subcontractor").substring(0, 13).padEnd(13);
      const ka = fmtAmount(p.contract_amount).padStart(9);
      const kp = fmtAmount(p.paid_to_date).padStart(9);
      const kd = fmtAmount(p.balance_due).padStart(9);
      body += `${name} | ${type} | ${ka} | ${kp} | ${kd}\n`;
      if (addr.trim()) body += `  ${addr.trim()}\n`;
    });
    body += `------------------------------------------------------------------------\n\n`;

    const totals = parties.reduce(
      (acc, p) => ({
        contract: acc.contract + (Number(p.contract_amount) || 0),
        paid:     acc.paid     + (Number(p.paid_to_date)    || 0),
        due:      acc.due      + (Number(p.balance_due)     || 0),
      }),
      { contract: 0, paid: 0, due: 0 }
    );
    body += `TOTALS: Contract ${fmtAmount(totals.contract)} | Paid ${fmtAmount(totals.paid)} | Due ${fmtAmount(totals.due)}\n\n`;
  }

  // Statutory warnings — verbatim from MCL 570.1110, reflowed on word boundaries (v1.0.1)
  const warning1 = wrapWarning(
    "WARNING TO OWNER OR LESSEE: AN OWNER OR LESSEE OF THE PROPERTY SHALL NOT RELY ON THIS SWORN STATEMENT TO AVOID THE CLAIM OF A SUBCONTRACTOR, SUPPLIER, OR LABORER WHO HAS PROVIDED A NOTICE OF FURNISHING OR A LABORER WHO MAY PROVIDE A NOTICE OF FURNISHING UNDER SECTION 109 OF THE CONSTRUCTION LIEN ACT, 1980 PA 497, MCL 570.1109, TO THE DESIGNEE OR TO THE OWNER OR LESSEE IF THE DESIGNEE IS NOT NAMED OR HAS DIED."
  );
  body += `\n========================================================================\n${warning1}\n========================================================================\n`;

  if (is_residential) {
    const warning2 = wrapWarning(
      "IF THIS SWORN STATEMENT IS IN REGARD TO A RESIDENTIAL STRUCTURE, ON RECEIPT OF THE SWORN STATEMENT, THE OWNER OR LESSEE, OR THE OWNER'S OR LESSEE'S DESIGNEE SHALL GIVE NOTICE OF ITS RECEIPT TO EACH SUBCONTRACTOR, SUPPLIER, AND LABORER WHO HAS PROVIDED A NOTICE OF FURNISHING. IF A SUBCONTRACTOR, SUPPLIER, OR LABORER WHO IS ENTITLED TO NOTICE OF RECEIPT OF THE SWORN STATEMENT MAKES A REQUEST, THE OWNER, LESSEE, OR DESIGNEE SHALL PROVIDE THE REQUESTER A COPY OF THE SWORN STATEMENT WITHIN 10 BUSINESS DAYS AFTER RECEIVING THE REQUEST."
    );
    body += `\n========================================================================\n${warning2}\n========================================================================\n`;
  }

  const warning3 = wrapWarning(
    "WARNING TO DEPONENT: A PERSON WHO GIVES A FALSE SWORN STATEMENT WITH INTENT TO DEFRAUD IS SUBJECT TO CRIMINAL PENALTIES AS PROVIDED IN SECTION 110 OF THE CONSTRUCTION LIEN ACT, 1980 PA 497, MCL 570.1110."
  );
  body += `\n========================================================================\n${warning3}\n========================================================================\n
Deponent: _________________________________
          ${safeDeponent}
          ${safeRole}, ${safeContractor}

Subscribed and sworn to before me on ${fmtDate(statement_date)}.

Notary Public: _________________________________
${notary_name ? `              ${notary_name}\n` : ""}              ${notary_county || "Muskegon"} County, Michigan
              My commission expires: ${notary_commission_expires ? fmtDate(notary_commission_expires) : "________________"}

`;

  return body;
};


// ================================================================
// INVOICE FORM MODAL — create/edit invoice with SOV line items
// ================================================================
function InvoiceFormModal({ isOpen, existingInvoice, job, client, prevInvoiceTotal, onClose, onSaved }) {
  const toast = useToast();

  // Build default line items from job's 40/40/20 schedule
  const defaultMilestones = (j) => {
    const total = Number(j?.budget) || 0;
    return [
      { description: "Deposit (40%)",     scheduled_value: total * 0.4, this_period: total * 0.4, materials_stored: 0 },
      { description: "Progress (40%)",    scheduled_value: total * 0.4, this_period: 0,           materials_stored: 0 },
      { description: "Completion (20%)",  scheduled_value: total * 0.2, this_period: 0,           materials_stored: 0 },
    ];
  };

  const [invoiceNumber, setInvoiceNumber]   = useState("");
  const [milestone, setMilestone]           = useState("Deposit (40%)");
  const [invoiceDate, setInvoiceDate]       = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate]               = useState("");
  const [lineItems, setLineItems]           = useState([]);
  const [retainagePct, setRetainagePct]     = useState(0);
  const [notesToClient, setNotesToClient]   = useState("");
  const [internalNotes, setInternalNotes]   = useState("");
  const [saving, setSaving]                 = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (existingInvoice) {
      setInvoiceNumber(existingInvoice.invoice_number || "");
      setMilestone(existingInvoice.milestone || "");
      setInvoiceDate(existingInvoice.invoice_date || new Date().toISOString().slice(0, 10));
      setDueDate(existingInvoice.due_date || "");
      setLineItems(existingInvoice.line_items || []);
      setRetainagePct(existingInvoice.retainage_pct ?? 0);
      setNotesToClient(existingInvoice.notes_to_client || "");
      setInternalNotes(existingInvoice.internal_notes || "");
    } else {
      // Generate a new invoice number: INV-YYYY-####
      const year = new Date().getFullYear();
      const seq = String(Date.now()).slice(-4);
      setInvoiceNumber(`INV-${year}-${seq}`);
      setMilestone("Deposit (40%)");
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      const due = new Date(); due.setDate(due.getDate() + 14);
      setDueDate(due.toISOString().slice(0, 10));
      setLineItems(defaultMilestones(job));
      setRetainagePct(0);
      setNotesToClient("");
      setInternalNotes("");
    }
  }, [isOpen, existingInvoice, job?.id]);

  // Compute totals
  const subtotal = lineItems.reduce((s, li) => s + (Number(li.this_period) || 0) + (Number(li.materials_stored) || 0), 0);
  const retainageAmount = subtotal * (Number(retainagePct) || 0) / 100;
  const totalAmount = subtotal - retainageAmount;

  const updateLine = (idx, field, value) => {
    setLineItems((prev) => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  };
  const addLine = () => {
    setLineItems((prev) => [...prev, { description: "", scheduled_value: 0, this_period: 0, materials_stored: 0 }]);
  };
  const removeLine = (idx) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!invoiceNumber.trim()) { toast.error("Invoice number required"); return; }
    if (lineItems.length === 0) { toast.error("Add at least one line item"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        job_id: job.id,
        client_id: client?.id || null,
        invoice_number: invoiceNumber.trim(),
        milestone: milestone || null,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        line_items: lineItems,
        subtotal,
        retainage_pct: Number(retainagePct) || 0,
        retainage_amount: retainageAmount,
        total_amount: totalAmount,
        contract_amount: Number(job?.budget) || 0,
        previous_billed: prevInvoiceTotal || 0,
        amount_due: totalAmount,
        notes_to_client: notesToClient.trim() || null,
        internal_notes: internalNotes.trim() || null,
      };

      let result;
      if (existingInvoice) {
        const { data, error } = await supabase
          .from("invoices")
          .update(payload)
          .eq("id", existingInvoice.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from("invoices")
          .insert({
            ...payload,
            status: "draft",
            created_by: session?.user?.id,
            created_by_email: session?.user?.email,
          })
          .select()
          .single();
        if (error) throw error;
        result = data;
      }
      onSaved(result, !!existingInvoice);
      toast.success(existingInvoice ? "Invoice updated" : "Invoice created");
    } catch (err) {
      toast.error("Save failed: " + (err.message || "Unknown"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4 py-8 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-3xl w-full p-6 my-auto"
          >
            <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-400" />
              {existingInvoice ? `Edit ${existingInvoice.invoice_number}` : "New Invoice"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {job?.name} {client?.name ? `• ${client.name}` : ""}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Invoice #</label>
                <Inp value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Milestone</label>
                <Sel value={milestone} onChange={(e) => setMilestone(e.target.value)}>
                  <option>Deposit (40%)</option>
                  <option>Progress (40%)</option>
                  <option>Completion (20%)</option>
                  <option>Custom</option>
                </Sel>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Invoice Date</label>
                <Inp type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Due Date</label>
                <Inp type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Retainage % <span className="text-slate-600">(typically 0-10)</span></label>
                <Inp type="number" min={0} max={50} step="0.5" value={retainagePct} onChange={(e) => setRetainagePct(e.target.value)} />
              </div>
            </div>

            {/* LINE ITEMS — SOV style */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Schedule of Values</p>
                <button onClick={addLine} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Line
                </button>
              </div>
              <div className="space-y-2">
                {lineItems.map((li, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      placeholder="Description"
                      value={li.description || ""}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
                      className="col-span-5 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                    />
                    <input
                      type="number" step="0.01" placeholder="Scheduled"
                      value={li.scheduled_value ?? ""}
                      onChange={(e) => updateLine(idx, "scheduled_value", e.target.value === "" ? 0 : Number(e.target.value))}
                      className="col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                      title="Scheduled value (full line item value)"
                    />
                    <input
                      type="number" step="0.01" placeholder="This Period"
                      value={li.this_period ?? ""}
                      onChange={(e) => updateLine(idx, "this_period", e.target.value === "" ? 0 : Number(e.target.value))}
                      className="col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                      title="Work completed this period"
                    />
                    <input
                      type="number" step="0.01" placeholder="Stored"
                      value={li.materials_stored ?? ""}
                      onChange={(e) => updateLine(idx, "materials_stored", e.target.value === "" ? 0 : Number(e.target.value))}
                      className="col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                      title="Materials stored on-site (not yet installed)"
                    />
                    <button
                      onClick={() => removeLine(idx)}
                      className="col-span-1 text-rose-400 hover:text-rose-300 p-1 transition-colors"
                      title="Remove line"
                    >
                      <Trash2 className="w-3.5 h-3.5 mx-auto" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-3 text-[10px] text-slate-500 px-2">
                <span className="w-24 text-right">Description</span>
                <span className="w-20 text-right">Scheduled</span>
                <span className="w-20 text-right">This Period</span>
                <span className="w-20 text-right">Stored</span>
              </div>
            </div>

            {/* TOTALS */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 mb-4 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Contract amount</span><span className="text-slate-300">{currency(job?.budget || 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Previously billed</span><span className="text-slate-300">{currency(prevInvoiceTotal || 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Subtotal this period</span><span className="text-slate-200">{currency(subtotal)}</span></div>
              {retainageAmount > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">Retainage ({retainagePct}%)</span><span className="text-rose-400">−{currency(retainageAmount)}</span></div>
              )}
              <div className="flex justify-between font-semibold pt-1 border-t border-slate-800">
                <span className="text-slate-300">AMOUNT DUE</span>
                <span className="text-emerald-400">{currency(totalAmount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes to client (visible)</label>
                <textarea rows={2} value={notesToClient} onChange={(e) => setNotesToClient(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Internal notes (private)</label>
                <textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !invoiceNumber.trim() || lineItems.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : (existingInvoice ? "Save Changes" : "Create Invoice")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ================================================================
// LOG PAYMENT MODAL — record a payment + auto-suggest waiver
// ================================================================
function LogPaymentModal({ isOpen, invoice, job, settings, onClose, onSaved }) {
  const toast = useToast();
  const [amount, setAmount]         = useState("");
  const [method, setMethod]         = useState("check");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference]   = useState("");
  const [notes, setNotes]           = useState("");
  const [autoCreateWaiver, setAutoCreateWaiver] = useState(true);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (isOpen && invoice) {
      const remaining = Math.max(0, (Number(invoice.total_amount) || 0) - (Number(invoice.amount_paid) || 0));
      setAmount(remaining > 0 ? remaining.toFixed(2) : "");
      setMethod("check");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setReference(""); setNotes(""); setAutoCreateWaiver(true);
    }
  }, [isOpen, invoice]);

  if (!invoice) return null;

  const remainingBefore = Math.max(0, (Number(invoice.total_amount) || 0) - (Number(invoice.amount_paid) || 0));
  const willBePaid = (Number(invoice.amount_paid) || 0) + (Number(amount) || 0);
  const isFullyPaid = willBePaid >= (Number(invoice.total_amount) || 0);
  const isFinalInvoice = invoice.milestone?.includes("Completion") || invoice.milestone?.includes("Final");

  // Suggest waiver type:
  // - If this invoice payment fully pays AND it's the final milestone => full_unconditional
  // - If this invoice payment fully pays this invoice but not final => partial_unconditional
  // - If this invoice still has remaining due after this payment => partial_unconditional (for amount paid so far)
  const suggestedWaiverType = isFullyPaid && isFinalInvoice
    ? "full_unconditional"
    : "partial_unconditional";
  const suggestedWaiverMeta = getWaiverMeta(suggestedWaiverType);

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Amount required"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: payment, error: payErr } = await supabase
        .from("invoice_payments")
        .insert({
          invoice_id: invoice.id,
          amount: amt,
          payment_method: method,
          payment_date: paymentDate,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          recorded_by: session?.user?.id,
          recorded_by_email: session?.user?.email,
        })
        .select()
        .single();
      if (payErr) throw payErr;

      let waiver = null;
      if (autoCreateWaiver) {
        const waiverPayload = {
          job_id: invoice.job_id,
          client_id: invoice.client_id,
          invoice_id: invoice.id,
          payment_id: payment.id,
          waiver_type: suggestedWaiverType,
          property_address: job?.address || client?.address || "",
          property_county: "Muskegon",
          owner_name: job?.client_name || client?.name || "",
          contractor_name: settings?.companyName || "Northshore Mechanical & Construction LLC",
          payment_amount: amt,
          payment_through_date: paymentDate,
          status: "draft",
          created_by: session?.user?.id,
          created_by_email: session?.user?.email,
        };
        waiverPayload.document_text = generateLienWaiverText(waiverPayload);
        const { data: w, error: wErr } = await supabase
          .from("lien_waivers")
          .insert(waiverPayload)
          .select()
          .single();
        if (!wErr && w) {
          waiver = w;
          await supabase
            .from("invoice_payments")
            .update({ triggered_waiver_id: w.id })
            .eq("id", payment.id);
        }
      }

      onSaved({ payment, waiver });
      toast.success(
        autoCreateWaiver && waiver
          ? `Payment logged. ${suggestedWaiverMeta.short} waiver drafted.`
          : "Payment logged."
      );
    } catch (err) {
      toast.error("Save failed: " + (err.message || "Unknown"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Log Payment
            </h3>
            <p className="text-xs text-slate-500 mb-4">{invoice.invoice_number} • {currency(remainingBefore)} remaining</p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Amount</label>
                  <Inp type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Date Received</label>
                  <Inp type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Method</label>
                <Sel value={method} onChange={(e) => setMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
                </Sel>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Reference <span className="text-slate-600">(check #, last-4, txn id)</span>
                </label>
                <Inp value={reference} onChange={(e) => setReference(e.target.value)} placeholder="optional" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes</label>
                <Inp value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
              </div>

              {/* Auto-waiver suggestion */}
              <div className={`rounded-lg border p-3 ${suggestedWaiverMeta.bg} ${suggestedWaiverMeta.border}`}>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateWaiver}
                    onChange={(e) => setAutoCreateWaiver(e.target.checked)}
                    className="mt-0.5 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className={`text-xs font-semibold ${suggestedWaiverMeta.color}`}>
                      Auto-draft {suggestedWaiverMeta.label} Waiver
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isFullyPaid && isFinalInvoice
                        ? "Final payment fully clears the contract — releases all lien rights."
                        : "Releases lien rights to the extent of this payment. You retain rights for unpaid amounts."}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={onClose} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !amount}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-400 text-black hover:bg-emerald-500 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {saving ? "Saving..." : "Log Payment"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


// ================================================================
// LIEN WAIVER MODAL — manual create or edit existing
// ================================================================
function LienWaiverModal({ isOpen, existingWaiver, job, client, settings, invoices, onClose, onSaved }) {
  const toast = useToast();
  const [waiverType, setWaiverType]       = useState("partial_unconditional");
  const [linkedInvoiceId, setLinkedInvoiceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentThroughDate, setPaymentThroughDate] = useState(new Date().toISOString().slice(0, 10));
  const [conditionPaymentAmount, setConditionPaymentAmount] = useState("");
  const [conditionPaymentMethod, setConditionPaymentMethod] = useState("check");
  const [conditionReference, setConditionReference]         = useState("");
  const [saving, setSaving]                                 = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (existingWaiver) {
      setWaiverType(existingWaiver.waiver_type);
      setLinkedInvoiceId(existingWaiver.invoice_id || "");
      setPaymentAmount(existingWaiver.payment_amount ?? "");
      setPaymentThroughDate(existingWaiver.payment_through_date || new Date().toISOString().slice(0, 10));
      setConditionPaymentAmount(existingWaiver.condition_payment_amount ?? "");
      setConditionPaymentMethod(existingWaiver.condition_payment_method || "check");
      setConditionReference(existingWaiver.condition_reference || "");
    } else {
      setWaiverType("partial_unconditional");
      setLinkedInvoiceId("");
      setPaymentAmount("");
      setPaymentThroughDate(new Date().toISOString().slice(0, 10));
      setConditionPaymentAmount(""); setConditionPaymentMethod("check"); setConditionReference("");
    }
  }, [isOpen, existingWaiver]);

  const meta = getWaiverMeta(waiverType);
  const isConditional = waiverType.endsWith("_conditional");

  const handleSave = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) { toast.error("Payment amount required"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        job_id: job.id,
        client_id: client?.id || null,
        invoice_id: linkedInvoiceId || null,
        waiver_type: waiverType,
        property_address: job?.address || client?.address || "",
        property_county: "Muskegon",
        owner_name: job?.client_name || client?.name || "",
        contractor_name: settings?.companyName || "Northshore Mechanical & Construction LLC",
        payment_amount: Number(paymentAmount),
        payment_through_date: paymentThroughDate,
        condition_payment_amount: isConditional ? (Number(conditionPaymentAmount) || Number(paymentAmount)) : null,
        condition_payment_method: isConditional ? conditionPaymentMethod : null,
        condition_reference: isConditional ? (conditionReference.trim() || null) : null,
      };
      payload.document_text = generateLienWaiverText(payload);

      let result;
      if (existingWaiver) {
        const { data, error } = await supabase
          .from("lien_waivers")
          .update(payload)
          .eq("id", existingWaiver.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from("lien_waivers")
          .insert({
            ...payload,
            status: "draft",
            created_by: session?.user?.id,
            created_by_email: session?.user?.email,
          })
          .select()
          .single();
        if (error) throw error;
        result = data;
      }
      onSaved(result, !!existingWaiver);
      toast.success(existingWaiver ? "Waiver updated" : "Waiver drafted");
    } catch (err) {
      toast.error("Save failed: " + (err.message || "Unknown"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4 py-8 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-xl w-full p-6 my-auto"
          >
            <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              {existingWaiver ? "Edit Lien Waiver" : "New Lien Waiver"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">MCL 570.1115(9) statutory form</p>

            <div className="space-y-3">
              {/* Waiver type picker */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Waiver Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {WAIVER_TYPES.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setWaiverType(w.id)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                        waiverType === w.id
                          ? `${w.bg} ${w.color} ${w.border}`
                          : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      <p className="font-semibold">{w.label}</p>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">{meta.desc}</p>
              </div>

              {invoices.length > 0 && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Link to Invoice <span className="text-slate-600">(optional)</span></label>
                  <Sel value={linkedInvoiceId} onChange={(e) => setLinkedInvoiceId(e.target.value)}>
                    <option value="">— No invoice linked —</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} • {currency(inv.total_amount)} • {inv.status}
                      </option>
                    ))}
                  </Sel>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Payment Amount</label>
                  <Inp type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Through Date</label>
                  <Inp type="date" value={paymentThroughDate} onChange={(e) => setPaymentThroughDate(e.target.value)} />
                </div>
              </div>

              {isConditional && (
                <div className="bg-amber-900/10 border border-amber-800/30 rounded-lg p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">Conditional Payment Details</p>
                  <p className="text-[10px] text-slate-500">Required for conditional waivers — establishes when the waiver becomes effective.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Expected Payment</label>
                      <Inp type="number" step="0.01" value={conditionPaymentAmount} onChange={(e) => setConditionPaymentAmount(e.target.value)} placeholder={paymentAmount || "0.00"} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Method</label>
                      <Sel value={conditionPaymentMethod} onChange={(e) => setConditionPaymentMethod(e.target.value)}>
                        {PAYMENT_METHODS.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
                      </Sel>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Reference</label>
                    <Inp value={conditionReference} onChange={(e) => setConditionReference(e.target.value)} placeholder="check #, txn id..." />
                  </div>
                </div>
              )}

              <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-[10px] space-y-0.5">
                <p className="text-slate-500">Property: <span className={(job?.address || client?.address) ? "text-slate-300" : "text-rose-400 font-mono"}>{job?.address || client?.address || "[ADDRESS REQUIRED]"}</span></p>
                <p className="text-slate-500">Owner: <span className={(job?.client_name || client?.name) ? "text-slate-300" : "text-rose-400 font-mono"}>{job?.client_name || client?.name || "[OWNER NAME REQUIRED]"}</span></p>
                <p className="text-slate-500">Contractor: <span className="text-slate-300">{settings?.companyName || "Northshore Mechanical & Construction LLC"}</span></p>
              </div>

              {(!(job?.address || client?.address) || !(job?.client_name || client?.name)) && (
                <div className="px-3 py-2 rounded-lg bg-rose-900/20 border border-rose-800/50 text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Critical data missing on this job. Update the Job (and/or Client) record before delivering the waiver, or the document will render with placeholder brackets where address/owner should be.</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={onClose} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !paymentAmount}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : (existingWaiver ? "Save Changes" : "Draft Waiver")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ================================================================
// SWORN STATEMENT MODAL — generate the MCL 570.1110 doc
// ================================================================
function SwornStatementModal({ isOpen, existingStatement, job, client, settings, jobSubs, onClose, onSaved }) {
  const toast = useToast();
  const [statementNumber, setStatementNumber] = useState("");
  const [statementDate, setStatementDate]     = useState(new Date().toISOString().slice(0, 10));
  const [parties, setParties]                 = useState([]);
  const [notarizedAt, setNotarizedAt]         = useState("");
  const [notaryName, setNotaryName]           = useState("");
  const [notaryCounty, setNotaryCounty]       = useState("Muskegon");
  const [notaryCommission, setNotaryCommission] = useState("");
  const [notes, setNotes]                     = useState("");
  const [saving, setSaving]                   = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (existingStatement) {
      setStatementNumber(existingStatement.statement_number);
      setStatementDate(existingStatement.statement_date || new Date().toISOString().slice(0, 10));
      setParties(existingStatement.parties || []);
      setNotarizedAt(existingStatement.notarized_at ? existingStatement.notarized_at.slice(0, 10) : "");
      setNotaryName(existingStatement.notary_name || "");
      setNotaryCounty(existingStatement.notary_county || "Muskegon");
      setNotaryCommission(existingStatement.notary_commission_expires || "");
      setNotes(existingStatement.notes || "");
    } else {
      const year = new Date().getFullYear();
      const seq = String(Date.now()).slice(-4);
      setStatementNumber(`SS-${year}-${seq}`);
      setStatementDate(new Date().toISOString().slice(0, 10));
      // Pre-populate from job_subs registered for this job
      setParties((jobSubs || []).map((s) => ({
        name: s.name,
        address: s.address || "",
        type: s.party_type || "subcontractor",
        contract_amount: Number(s.contract_amount) || 0,
        paid_to_date: Number(s.paid_to_date) || 0,
        balance_due: Math.max(0, (Number(s.contract_amount) || 0) - (Number(s.paid_to_date) || 0)),
        notice_of_furnishing_received: s.notice_of_furnishing_received || false,
      })));
      setNotarizedAt(""); setNotaryName(""); setNotaryCounty("Muskegon"); setNotaryCommission(""); setNotes("");
    }
  }, [isOpen, existingStatement, jobSubs]);

  const updateParty = (idx, field, value) => {
    setParties((prev) => prev.map((p, i) => {
      if (i !== idx) return p;
      const updated = { ...p, [field]: value };
      if (field === "contract_amount" || field === "paid_to_date") {
        updated.balance_due = Math.max(0, (Number(updated.contract_amount) || 0) - (Number(updated.paid_to_date) || 0));
      }
      return updated;
    }));
  };
  const addParty = () => {
    setParties((prev) => [...prev, { name: "", address: "", type: "subcontractor", contract_amount: 0, paid_to_date: 0, balance_due: 0 }]);
  };
  const removeParty = (idx) => {
    setParties((prev) => prev.filter((_, i) => i !== idx));
  };

  const totals = parties.reduce((acc, p) => ({
    contract: acc.contract + (Number(p.contract_amount) || 0),
    paid: acc.paid + (Number(p.paid_to_date) || 0),
    due: acc.due + (Number(p.balance_due) || 0),
  }), { contract: 0, paid: 0, due: 0 });

  const handleSave = async () => {
    // v1.0.2 — Validate any notary data the user has entered, regardless of
    // whether they've filled "Notarized On". Prevents single-name "Wendy" from
    // being saved as a draft and forgotten about.
    if (notaryName.trim() && !notaryName.trim().includes(" ")) {
      toast.error("Notary name needs first AND last name (e.g. \"Wendy Smith\"). Clear the field if not yet notarized.");
      return;
    }
    if (notarizedAt && notaryCommission && new Date(notaryCommission) <= new Date(notarizedAt)) {
      toast.error("Notary commission expires on or before the notarization date — pick a different notary.");
      return;
    }
    // If notarized date is set, require notary identity (name + commission expiration)
    if (notarizedAt) {
      if (!notaryName.trim()) {
        toast.error("Notary name required when 'Notarized On' is filled.");
        return;
      }
      if (!notaryCommission) {
        toast.error("Commission expiration date required when 'Notarized On' is filled.");
        return;
      }
    }
    // If commission expiration is set without a notarized date, that's fine
    // (you might be entering notary info ahead of the actual notarization).

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        job_id: job.id,
        client_id: client?.id || null,
        statement_number: statementNumber,
        statement_date: statementDate,
        property_address: job?.address || client?.address || "",
        property_county: "Muskegon",
        is_residential: true,
        deponent_name: settings?.ownerName || "Connor Garza",
        deponent_role: "Owner / Member",
        contractor_name: settings?.companyName || "Northshore Mechanical & Construction LLC",
        parties,
        total_contract_amount: totals.contract,
        total_paid_to_date: totals.paid,
        total_balance_due: totals.due,
        notarized_at: notarizedAt || null,
        notary_name: notaryName.trim() || null,
        notary_county: notaryCounty.trim() || "Muskegon",
        notary_commission_expires: notaryCommission || null,
        notes: notes.trim() || null,
        status: notarizedAt ? "notarized" : "draft",
      };
      payload.document_text = generateSwornStatementText(payload);

      let result;
      if (existingStatement) {
        const { data, error } = await supabase
          .from("sworn_statements")
          .update(payload)
          .eq("id", existingStatement.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from("sworn_statements")
          .insert({
            ...payload,
            created_by: session?.user?.id,
            created_by_email: session?.user?.email,
          })
          .select()
          .single();
        if (error) throw error;
        result = data;
      }
      onSaved(result, !!existingStatement);
      toast.success(existingStatement ? "Sworn statement updated" : "Sworn statement drafted");
    } catch (err) {
      toast.error("Save failed: " + (err.message || "Unknown"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4 py-8 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-3xl w-full p-6 my-auto"
          >
            <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              {existingStatement ? `Edit ${existingStatement.statement_number}` : "New Sworn Statement"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              MCL 570.1110 • Required before collecting on bank-financed residential jobs
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Statement #</label>
                <Inp value={statementNumber} onChange={(e) => setStatementNumber(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Statement Date</label>
                <Inp type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
              </div>
            </div>

            {/* Parties */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  Subcontractors / Suppliers / Laborers ({parties.length})
                </p>
                <button onClick={addParty} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Party
                </button>
              </div>
              {parties.length === 0 ? (
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-500">No subs/suppliers added.</p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    If you're working solo with materials from your own inventory, the statement notes that explicitly.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {parties.map((p, idx) => (
                    <div key={idx} className="bg-slate-950/40 border border-slate-800 rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-12 gap-1.5">
                        <input
                          placeholder="Name"
                          value={p.name}
                          onChange={(e) => updateParty(idx, "name", e.target.value)}
                          className="col-span-5 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                        />
                        <select
                          value={p.type}
                          onChange={(e) => updateParty(idx, "type", e.target.value)}
                          className="col-span-3 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                        >
                          <option value="subcontractor">Sub</option>
                          <option value="supplier">Supplier</option>
                          <option value="laborer">Laborer</option>
                        </select>
                        <input
                          placeholder="Address"
                          value={p.address || ""}
                          onChange={(e) => updateParty(idx, "address", e.target.value)}
                          className="col-span-3 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                        />
                        <button onClick={() => removeParty(idx)} className="col-span-1 text-rose-400 hover:text-rose-300 transition-colors" title="Remove">
                          <Trash2 className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <input
                          type="number" step="0.01" placeholder="Contract"
                          value={p.contract_amount ?? ""}
                          onChange={(e) => updateParty(idx, "contract_amount", e.target.value === "" ? 0 : Number(e.target.value))}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                        />
                        <input
                          type="number" step="0.01" placeholder="Paid"
                          value={p.paid_to_date ?? ""}
                          onChange={(e) => updateParty(idx, "paid_to_date", e.target.value === "" ? 0 : Number(e.target.value))}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                        />
                        <div className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-amber-400 text-right tabular-nums">
                          {currency(p.balance_due)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="bg-slate-950/60 border border-slate-700 rounded-lg p-2 grid grid-cols-3 gap-2 text-xs font-semibold">
                    <div className="text-right"><span className="text-slate-500 mr-1">Contract:</span><span className="text-slate-200">{currency(totals.contract)}</span></div>
                    <div className="text-right"><span className="text-slate-500 mr-1">Paid:</span><span className="text-slate-200">{currency(totals.paid)}</span></div>
                    <div className="text-right"><span className="text-slate-500 mr-1">Due:</span><span className="text-amber-400">{currency(totals.due)}</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Notary */}
            <div className="bg-amber-900/10 border border-amber-800/30 rounded-lg p-3 mb-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">Notary Block <span className="text-slate-600 font-normal">(fill in after notarization)</span></p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Notarized On</label>
                  <Inp type="date" value={notarizedAt} onChange={(e) => setNotarizedAt(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Notary Name</label>
                  <Inp value={notaryName} onChange={(e) => setNotaryName(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Notary County</label>
                  <Inp value={notaryCounty} onChange={(e) => setNotaryCounty(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Commission Expires</label>
                  <Inp type="date" value={notaryCommission} onChange={(e) => setNotaryCommission(e.target.value)} />
                </div>
              </div>
            </div>

            {/* v1.0.1 — surface missing critical data BEFORE generation */}
            {(!job?.address && !client?.address) && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-rose-900/20 border border-rose-800/50 text-xs text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Property address is missing on this job. Document will render <span className="font-mono">[PROPERTY ADDRESS REQUIRED]</span> until you update the job. Update the Job's address before delivering this statement.</span>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : (existingStatement ? "Save Changes" : "Draft Statement")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ================================================================
// DOCUMENT PREVIEW MODAL — read-only view of any rendered doc
// ================================================================
function DocumentPreviewModal({ isOpen, title, text, onClose }) {
  const toast = useToast();
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text || "");
      toast.success("Copied to clipboard");
    } catch (e) {
      toast.error("Copy failed");
    }
  };
  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup blocked — allow popups to print"); return; }
    w.document.write(`<html><head><title>${title}</title>
      <style>body { font-family: 'Courier New', monospace; font-size: 11pt; line-height: 1.4; padding: 0.75in; white-space: pre-wrap; }</style>
      </head><body>${(text || "").replace(/[<>]/g, (c) => ({ "<": "&lt;", ">": "&gt;" }[c]))}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4 py-8 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-3xl w-full p-6 my-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" /> {title}
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-[11px] text-slate-300 font-mono whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
{text}
            </pre>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={handleCopy}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Copy Text
              </button>
              <button onClick={handlePrint}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-400 text-black hover:bg-amber-500 transition-colors flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Print / PDF
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


// ================================================================
// JOB DOCUMENTS — sub-tab inside Job detail view
// Shows invoices, lien waivers, sworn statements, payment ledger
// for a single job, with the document timeline and quick actions.
// ================================================================
function JobDocuments({
  job,
  client,
  settings,
  invoices, setInvoices,
  invoicePayments, setInvoicePayments,
  lienWaivers, setLienWaivers,
  swornStatements, setSwornStatements,
  jobSubs, setJobSubs,
}) {
  const toast = useToast();
  const confirm = useConfirm();

  // Filter to this job's records
  const jobInvoices = invoices.filter((i) => i.job_id === job.id && !i.deleted_at);
  const jobPayments = invoicePayments.filter((p) => jobInvoices.some((i) => i.id === p.invoice_id));
  const jobWaivers = lienWaivers.filter((w) => w.job_id === job.id && !w.deleted_at);
  const jobStatements = swornStatements.filter((s) => s.job_id === job.id && !s.deleted_at);
  const jobSubsForJob = jobSubs.filter((s) => s.job_id === job.id && !s.deleted_at);

  // Modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice]     = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice]     = useState(null);
  const [waiverModalOpen, setWaiverModalOpen]   = useState(false);
  const [editingWaiver, setEditingWaiver]       = useState(null);
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [editingStatement, setEditingStatement] = useState(null);
  const [previewOpen, setPreviewOpen]           = useState(false);
  const [previewTitle, setPreviewTitle]         = useState("");
  const [previewText, setPreviewText]           = useState("");

  // Aggregates
  const totalInvoiced = jobInvoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
  const totalPaid = jobInvoices.reduce((s, i) => s + (Number(i.amount_paid) || 0), 0);
  const totalDue = totalInvoiced - totalPaid;
  const contractAmount = Number(job?.budget) || 0;
  const remainingContract = contractAmount - totalInvoiced;

  // Save handlers
  const handleInvoiceSaved = (saved, isEdit) => {
    setInvoiceModalOpen(false);
    setEditingInvoice(null);
    if (isEdit) {
      setInvoices((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
    } else {
      setInvoices((prev) => [saved, ...prev]);
    }
  };

  const handlePaymentSaved = async ({ payment, waiver }) => {
    setPaymentModalOpen(false);
    setPaymentInvoice(null);
    setInvoicePayments((prev) => [payment, ...prev]);
    if (waiver) setLienWaivers((prev) => [waiver, ...prev]);
    // Refetch the invoice to pick up trigger-updated status/amount_paid
    const { data } = await supabase.from("invoices").select("*").eq("id", payment.invoice_id).single();
    if (data) setInvoices((prev) => prev.map((i) => (i.id === data.id ? data : i)));
  };

  const handleWaiverSaved = (saved, isEdit) => {
    setWaiverModalOpen(false);
    setEditingWaiver(null);
    if (isEdit) {
      setLienWaivers((prev) => prev.map((w) => (w.id === saved.id ? saved : w)));
    } else {
      setLienWaivers((prev) => [saved, ...prev]);
    }
  };

  const handleStatementSaved = (saved, isEdit) => {
    setStatementModalOpen(false);
    setEditingStatement(null);
    if (isEdit) {
      setSwornStatements((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
    } else {
      setSwornStatements((prev) => [saved, ...prev]);
    }
  };

  const deleteInvoice = async (inv) => {
    const ok = await confirm({
      title: "Delete invoice?",
      message: `Invoice ${inv.invoice_number} and any logged payments will be removed. This cannot be undone.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("invoices").update({ deleted_at: new Date().toISOString() }).eq("id", inv.id);
    if (!error) {
      setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, deleted_at: new Date().toISOString() } : i)));
      toast.success("Invoice deleted");
    }
  };

  const markWaiverEffective = async (w) => {
    const { data, error } = await supabase
      .from("lien_waivers")
      .update({ status: "effective", effective_at: new Date().toISOString() })
      .eq("id", w.id)
      .select()
      .single();
    if (!error && data) {
      setLienWaivers((prev) => prev.map((wv) => (wv.id === w.id ? data : wv)));
      toast.success("Waiver marked effective");
    }
  };

  const previewWaiver = (w) => {
    setPreviewTitle(`${getWaiverMeta(w.waiver_type).label} Waiver`);
    setPreviewText(w.document_text || generateLienWaiverText(w));
    setPreviewOpen(true);
  };
  const previewStatement = (s) => {
    setPreviewTitle(`Sworn Statement ${s.statement_number}`);
    setPreviewText(s.document_text || generateSwornStatementText(s));
    setPreviewOpen(true);
  };

  // Build the timeline — chronological merge of all events
  const timeline = [
    ...jobInvoices.map((i) => ({
      type: "invoice",
      date: i.invoice_date,
      title: `${i.invoice_number} • ${i.milestone || ""}`,
      detail: `${currency(i.total_amount)} • ${getInvoiceStatusMeta(i.status).label}`,
      icon: Receipt,
      colorClass: "text-blue-400",
      data: i,
    })),
    ...jobPayments.map((p) => {
      const inv = jobInvoices.find((i) => i.id === p.invoice_id);
      return {
        type: "payment",
        date: p.payment_date,
        title: `Payment received • ${currency(p.amount)}`,
        detail: `${PAYMENT_METHODS.find((m) => m.id === p.payment_method)?.label || p.payment_method}${p.reference ? ` • ${p.reference}` : ""} • ${inv?.invoice_number || ""}`,
        icon: DollarSign,
        colorClass: "text-emerald-400",
        data: p,
      };
    }),
    ...jobWaivers.map((w) => ({
      type: "waiver",
      date: w.created_at?.slice(0, 10) || w.payment_through_date,
      title: `${getWaiverMeta(w.waiver_type).label} Waiver`,
      detail: `${currency(w.payment_amount)} • ${w.status}`,
      icon: FileText,
      colorClass: getWaiverMeta(w.waiver_type).color,
      data: w,
    })),
    ...jobStatements.map((s) => ({
      type: "statement",
      date: s.statement_date,
      title: `Sworn Statement ${s.statement_number}`,
      detail: `${s.parties?.length || 0} parties • ${s.status}`,
      icon: FileText,
      colorClass: "text-purple-400",
      data: s,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-4">
      {/* SUMMARY HEADER */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Contract</p>
          <p className="text-lg font-bold text-slate-100 tabular-nums">{currency(contractAmount)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Invoiced</p>
          <p className="text-lg font-bold text-blue-400 tabular-nums">{currency(totalInvoiced)}</p>
          {remainingContract !== 0 && (
            <p className="text-[10px] text-slate-600 mt-0.5">
              {remainingContract > 0 ? `${currency(remainingContract)} unbilled` : `${currency(Math.abs(remainingContract))} over`}
            </p>
          )}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Collected</p>
          <p className="text-lg font-bold text-emerald-400 tabular-nums">{currency(totalPaid)}</p>
        </div>
        <div className={`border rounded-xl p-3 ${
          totalDue > 0 ? "bg-amber-950/20 border-amber-800/40" : "bg-slate-900 border-slate-800"
        }`}>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Outstanding</p>
          <p className={`text-lg font-bold tabular-nums ${totalDue > 0 ? "text-amber-400" : "text-slate-400"}`}>
            {currency(totalDue)}
          </p>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setEditingInvoice(null); setInvoiceModalOpen(true); }}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-400 text-black hover:bg-amber-500 transition-colors flex items-center gap-1.5"
        >
          <Receipt className="w-3.5 h-3.5" /> New Invoice
        </button>
        <button
          onClick={() => { setEditingWaiver(null); setWaiverModalOpen(true); }}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" /> Lien Waiver
        </button>
        <button
          onClick={() => { setEditingStatement(null); setStatementModalOpen(true); }}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" /> Sworn Statement
        </button>
      </div>

      {/* INVOICES LIST */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Invoices ({jobInvoices.length})
            </p>
          </div>
          {jobInvoices.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No invoices yet. Click "New Invoice" to start the 40/40/20 milestone schedule.</p>
          ) : (
            <div className="space-y-2">
              {jobInvoices.map((inv) => {
                const status = getInvoiceStatusMeta(inv.status);
                const remaining = (Number(inv.total_amount) || 0) - (Number(inv.amount_paid) || 0);
                return (
                  <div key={inv.id} className="bg-slate-950/40 border border-slate-800 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-100">{inv.invoice_number}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.bg} ${status.color} border ${status.border}`}>
                            {status.label}
                          </span>
                          {inv.milestone && (
                            <span className="text-[10px] text-slate-500">• {inv.milestone}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(inv.invoice_date).toLocaleDateString()}
                          {inv.due_date && ` • Due ${new Date(inv.due_date).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-100 tabular-nums">{currency(inv.total_amount)}</p>
                        {inv.amount_paid > 0 && (
                          <p className="text-[10px] text-emerald-400 tabular-nums">{currency(inv.amount_paid)} paid</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                      <div className="flex gap-1">
                        {remaining > 0.01 && (
                          <button
                            onClick={() => { setPaymentInvoice(inv); setPaymentModalOpen(true); }}
                            className="px-2 py-1 rounded text-[10px] font-semibold bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-800/50 transition-colors flex items-center gap-1"
                          >
                            <DollarSign className="w-3 h-3" /> Log Payment
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingInvoice(inv); setInvoiceModalOpen(true); }}
                          className="px-2 py-1 rounded text-[10px] font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      </div>
                      <button
                        onClick={() => deleteInvoice(inv)}
                        className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LIEN WAIVERS LIST */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
            Lien Waivers ({jobWaivers.length})
          </p>
          {jobWaivers.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No lien waivers yet. Auto-drafted when payments are logged, or click "Lien Waiver" above.</p>
          ) : (
            <div className="space-y-2">
              {jobWaivers.map((w) => {
                const meta = getWaiverMeta(w.waiver_type);
                return (
                  <div key={w.id} className={`border rounded-lg p-3 ${meta.bg} ${meta.border}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
                          <span className="text-[10px] text-slate-500">• {w.status}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {currency(w.payment_amount)} through {new Date(w.payment_through_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                      <div className="flex gap-1">
                        <button
                          onClick={() => previewWaiver(w)}
                          className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> View / Print
                        </button>
                        <button
                          onClick={() => { setEditingWaiver(w); setWaiverModalOpen(true); }}
                          className="px-2 py-1 rounded text-[10px] font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        {w.waiver_type.endsWith("_conditional") && w.status !== "effective" && (
                          <button
                            onClick={() => markWaiverEffective(w)}
                            className="px-2 py-1 rounded text-[10px] font-semibold bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-800/50 transition-colors flex items-center gap-1"
                            title="Mark effective once payment has cleared"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Mark Effective
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SWORN STATEMENTS LIST */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
            Sworn Statements ({jobStatements.length})
          </p>
          {jobStatements.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No sworn statements yet. Required for bank-financed residential jobs (MCL 570.1110).</p>
          ) : (
            <div className="space-y-2">
              {jobStatements.map((s) => (
                <div key={s.id} className="bg-slate-950/40 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-100">{s.statement_number}</p>
                        <span className="text-[10px] text-slate-500">• {s.status}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(s.statement_date).toLocaleDateString()} • {s.parties?.length || 0} parties • {currency(s.total_balance_due)} due
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => previewStatement(s)}
                      className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> View / Print
                    </button>
                    <button
                      onClick={() => { setEditingStatement(s); setStatementModalOpen(true); }}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* TIMELINE */}
      {timeline.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
              Document Timeline
            </p>
            <div className="space-y-1.5">
              {timeline.map((evt, idx) => {
                const Icon = evt.icon;
                return (
                  <div key={idx} className="flex items-start gap-2 px-2 py-1.5 rounded bg-slate-800/30 text-xs">
                    <Icon className={`w-3.5 h-3.5 ${evt.colorClass} shrink-0 mt-0.5`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-200">{evt.title}</p>
                      <p className="text-[10px] text-slate-500">{evt.detail}</p>
                    </div>
                    <span className="text-[10px] text-slate-600 shrink-0">
                      {evt.date ? new Date(evt.date).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODALS */}
      <InvoiceFormModal
        isOpen={invoiceModalOpen}
        existingInvoice={editingInvoice}
        job={job}
        client={client}
        prevInvoiceTotal={jobInvoices.filter((i) => i.id !== editingInvoice?.id).reduce((s, i) => s + (Number(i.total_amount) || 0), 0)}
        onClose={() => { setInvoiceModalOpen(false); setEditingInvoice(null); }}
        onSaved={handleInvoiceSaved}
      />
      <LogPaymentModal
        isOpen={paymentModalOpen}
        invoice={paymentInvoice}
        job={job}
        settings={settings}
        onClose={() => { setPaymentModalOpen(false); setPaymentInvoice(null); }}
        onSaved={handlePaymentSaved}
      />
      <LienWaiverModal
        isOpen={waiverModalOpen}
        existingWaiver={editingWaiver}
        job={job}
        client={client}
        settings={settings}
        invoices={jobInvoices}
        onClose={() => { setWaiverModalOpen(false); setEditingWaiver(null); }}
        onSaved={handleWaiverSaved}
      />
      <SwornStatementModal
        isOpen={statementModalOpen}
        existingStatement={editingStatement}
        job={job}
        client={client}
        settings={settings}
        jobSubs={jobSubsForJob}
        onClose={() => { setStatementModalOpen(false); setEditingStatement(null); }}
        onSaved={handleStatementSaved}
      />
      <DocumentPreviewModal
        isOpen={previewOpen}
        title={previewTitle}
        text={previewText}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}


// ================================================================
// LOGIN SCREEN
// ================================================================
function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      onLogin(data.session);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-amber-900/40">
            <span className="text-black font-black text-3xl">N</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Northshore OS</h1>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest">
            Internal Access Only
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </label>
                <Inp
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Password
                </label>
                <div className="relative">
                  <Inp
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-rose-300 text-xs bg-rose-900/30 border border-rose-800 rounded-lg px-3 py-2.5 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}
              <Btn
                type="submit"
                disabled={loading}
                className="w-full bg-amber-400 text-black hover:bg-amber-500 font-semibold flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Signing in...
                  </>
                ) : (
                  <>
                    Sign In <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Btn>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-slate-700">
          © {new Date().getFullYear()} Northshore Mechanical & Construction LLC
        </p>
      </motion.div>
    </div>
  );
}

// ================================================================
// DASHBOARD
// ================================================================
function Dashboard({ jobs, estimates, clients, dailyLogs = [], documents = [], timeEntries = [], materialDeliveries = [], setTab }) {
  const activeJobs  = jobs.filter((j) => j.status === "Active");
  const openEst     = estimates.filter((e) => e.status === "Draft" || e.status === "Sent");
  const approvedEst = estimates.filter((e) => e.status === "Approved");
  const arTotal     = approvedEst.reduce((s, e) => s + (e.grand_total || 0), 0);
  const pipeline    = openEst.reduce((s, e) => s + (e.grand_total || 0), 0);

  // v1.2 — Lien deadlines for urgent jobs widget
  // v1.3.2 — Now includes material_deliveries from lifted state.
  const lienAlerts = jobs
    .filter((j) => j.status === "Active" || j.status === "Completed")
    .map((j) => ({ job: j, lien: lienDeadlineFor(j, dailyLogs, timeEntries, materialDeliveries) }))
    .filter((x) => x.lien && x.lien.urgency !== "safe")
    .sort((a, b) => a.lien.daysRemaining - b.lien.daysRemaining);

  // Daily log tracking
  const today = new Date().toISOString().slice(0, 10);
  const jobsLoggedToday = new Set(
    dailyLogs.filter((l) => l.log_date === today).map((l) => l.job_id)
  );
  const jobsMissingTodayLog = activeJobs.filter((j) => !jobsLoggedToday.has(j.id));
  const allLogged = activeJobs.length > 0 && jobsMissingTodayLog.length === 0;

  const graphData = estimates.slice(-10).reverse().map((e) => ({
    name:  formatDate(e.created_at),
    total: Math.round(e.grand_total || 0),
  }));

  const jobData = jobs.slice(0, 6).map((j) => ({
    name:   j.name.split("—")[0].trim(),
    budget: j.budget,
    actual: j.actual || 0,
  }));

  const getClientName = (id) => {
    const c = clients.find((c) => c.id === id);
    return c ? c.name : null;
  };

  // Animation variants for staggered card entry
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.05 },
    },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
  };

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* HEADER */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-amber-400" />
            Dashboard
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>
      </motion.div>

      {/* PRIORITY 1 — DAILY LOG STATUS BANNER */}
      {activeJobs.length > 0 && (
        <motion.div variants={itemVariants}>
          {jobsMissingTodayLog.length > 0 ? (
            <div
              onClick={() => setTab && setTab("Daily")}
              className="cursor-pointer bg-gradient-to-r from-amber-900/40 via-amber-800/30 to-orange-900/30
                border-2 border-amber-500/60 rounded-xl p-5 hover:border-amber-400 transition-all
                shadow-lg shadow-amber-900/20"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-900/40">
                    <AlertTriangle className="w-6 h-6 text-black" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-amber-200 font-semibold text-base">
                      {jobsMissingTodayLog.length} {jobsMissingTodayLog.length === 1 ? "job needs" : "jobs need"} today's log
                    </p>
                    <p className="text-amber-200/60 text-xs mt-0.5">
                      {jobsMissingTodayLog.slice(0, 3).map((j) => j.name).join(" • ")}
                      {jobsMissingTodayLog.length > 3 && ` • +${jobsMissingTodayLog.length - 3} more`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-amber-300 text-sm font-medium shrink-0">
                  Log Now
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-emerald-900/30 to-emerald-800/20 border border-emerald-700/40 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="flex-1">
                <p className="text-emerald-300 text-sm font-medium">
                  All {activeJobs.length} active job{activeJobs.length > 1 ? "s" : ""} logged for today.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* DOCUMENT EXPIRATION ALERTS — surfaces vault expirations on Dashboard */}
      {(() => {
        const expiring = documents.filter((d) => {
          if (d.deleted_at || d.superseded_at || !d.expires_at) return false;
          const days = daysUntil(d.expires_at);
          return days !== null && days <= 30;
        }).sort((a, b) => daysUntil(a.expires_at) - daysUntil(b.expires_at));
        if (expiring.length === 0) return null;
        const expired = expiring.filter((d) => daysUntil(d.expires_at) < 0).length;
        return (
          <motion.div variants={itemVariants}>
            <button
              onClick={() => setTab("Vault")}
              className={`w-full text-left rounded-xl p-4 border transition-all ${
                expired > 0
                  ? "bg-rose-900/20 border-rose-700/50 hover:bg-rose-900/30"
                  : "bg-amber-900/20 border-amber-700/50 hover:bg-amber-900/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 shrink-0 ${expired > 0 ? "text-rose-400" : "text-amber-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${expired > 0 ? "text-rose-300" : "text-amber-300"}`}>
                    {expired > 0
                      ? `${expired} document${expired === 1 ? " is" : "s are"} expired`
                      : `${expiring.length} document${expiring.length === 1 ? "" : "s"} expiring soon`}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {expiring.slice(0, 3).map((d) => d.title).join(" • ")}
                    {expiring.length > 3 && ` +${expiring.length - 3} more`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              </div>
            </button>
          </motion.div>
        );
      })()}

      {/* PRIORITY 1.5 — LIEN DEADLINES (v1.2)
          Surfaces jobs where the 90-day MI Construction Lien Act window is
          within 30 days. Click a row to jump to that job. Critical for unpaid
          work — missing this window = losing lien rights entirely. */}
      {lienAlerts.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="bg-gradient-to-br from-rose-950/30 to-amber-950/20 border border-rose-900/40 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-rose-300" />
              <h3 className="text-sm font-semibold text-rose-100">Lien Deadlines</h3>
              <span className="text-[10px] text-rose-300/70 ml-1">
                MI Construction Lien Act — 90 days from last labor/material to record
              </span>
            </div>
            <div className="space-y-1.5">
              {lienAlerts.slice(0, 5).map(({ job, lien }) => {
                const client = clients.find((c) => c.id === job.client_id);
                return (
                  <button
                    key={job.id}
                    onClick={() => setTab && setTab("Jobs")}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800 hover:border-rose-800/60 transition-colors text-left"
                  >
                    <span className={`text-[10px] px-2 py-1 rounded-md font-semibold tabular-nums whitespace-nowrap ${lienBadgeStyle(lien.urgency)}`}>
                      {lienLabel(lien.urgency, lien.daysRemaining)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-100 truncate">{job.name}</p>
                      {client && <p className="text-[11px] text-slate-500 truncate">{client.name}</p>}
                    </div>
                    <p className="text-[11px] text-slate-500 whitespace-nowrap">
                      Last work: {lien.lastLaborDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                  </button>
                );
              })}
              {lienAlerts.length > 5 && (
                <p className="text-[11px] text-slate-500 text-center pt-1">
                  +{lienAlerts.length - 5} more — see Jobs tab
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* PRIORITY 2 — KPI CARDS WITH GRADIENTS */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Briefcase className="w-5 h-5" />}
          label="Active Jobs"
          value={activeJobs.length}
          sub="in progress"
          gradient="from-blue-900/40 to-slate-900/40 border-blue-700/30"
          iconColor="text-blue-400"
          numeric
          onClick={() => setTab && setTab("Jobs")}
        />
        <KpiCard
          icon={<FileText className="w-5 h-5" />}
          label="Open Bids"
          value={openEst.length}
          sub="awaiting approval"
          gradient="from-amber-900/40 to-slate-900/40 border-amber-700/30"
          iconColor="text-amber-400"
          numeric
          onClick={() => setTab && setTab("Estimator")}
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Pipeline"
          value={pipeline}
          sub="estimated value"
          gradient="from-purple-900/40 to-slate-900/40 border-purple-700/30"
          iconColor="text-purple-400"
          currency
        />
        <KpiCard
          icon={<DollarSign className="w-5 h-5" />}
          label="A/R Approved"
          value={arTotal}
          sub="ready to invoice"
          gradient="from-emerald-900/40 to-slate-900/40 border-emerald-700/30"
          iconColor="text-emerald-400"
          currency
        />
      </motion.div>

      {/* PRIORITY 3 — ACTIVE JOB BURN RATES (only if active) */}
      {activeJobs.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Hammer className="w-4 h-4 text-amber-400" />
                  Active Jobs — Burn Rate
                </h2>
                <button
                  onClick={() => setTab && setTab("Jobs")}
                  className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-4">
                {activeJobs.map((j) => {
                  const pct   = j.budget ? Math.min(100, ((j.actual || 0) / j.budget) * 100) : 0;
                  const color = pct < 70 ? "bg-emerald-500" : pct < 90 ? "bg-amber-400" : "bg-rose-500";
                  const textColor = pct < 70 ? "text-emerald-400" : pct < 90 ? "text-amber-400" : "text-rose-400";
                  return (
                    <div key={j.id}>
                      <div className="flex justify-between items-center text-sm mb-1.5">
                        <div className="min-w-0 flex-1 mr-2">
                          <span className="text-slate-200 font-medium truncate">{j.name}</span>
                          {j.client_id && getClientName(j.client_id) && (
                            <span className="text-slate-500 text-xs ml-2">
                              — {getClientName(j.client_id)}
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 text-xs whitespace-nowrap">
                          {currency(j.actual || 0)}{" "}
                          <span className="text-slate-600">/ {currency(j.budget)}</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-2 rounded-full ${color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                      <p className={`text-xs mt-1 ${textColor}`}>{round2(pct)}% burned</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* CHARTS ROW */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              Estimate Trend
            </h2>
            {graphData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={graphData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 11 }} />
                  <YAxis
                    stroke="#475569"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    cursor={{ stroke: "#334155", strokeWidth: 1, strokeDasharray: "3 3" }}
                    formatter={(v) => currency(v)}
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ fill: "#f59e0b", r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: "#f59e0b", strokeWidth: 2, fill: "#0f172a" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={<BarChart3 className="w-8 h-8 text-slate-700" />}
                message="Create estimates to see your trend"
                action={() => setTab && setTab("Estimator")}
                actionLabel="Build first estimate"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-400" />
              Budget vs Actual
            </h2>
            {jobData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={jobData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 10 }} />
                  <YAxis
                    stroke="#475569"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    cursor={false}
                    formatter={(v) => currency(v)}
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="budget" fill="#334155" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={<Briefcase className="w-8 h-8 text-slate-700" />}
                message="Add jobs to compare budget vs actual"
                action={() => setTab && setTab("Jobs")}
                actionLabel="Add a job"
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* RECENT ESTIMATES */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                Recent Estimates
              </h2>
              <button
                onClick={() => setTab && setTab("Estimator")}
                className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
              >
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {estimates.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-8 h-8 text-slate-700" />}
                message="No estimates yet"
                action={() => setTab && setTab("Estimator")}
                actionLabel="Build your first estimate"
              />
            ) : (
              <div className="space-y-1">
                {estimates.slice(0, 5).map((e) => (
                  <div
                    key={e.id}
                    className="flex justify-between items-center py-2.5 px-2 rounded-lg hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-200 text-sm font-medium">{e.name}</span>
                      {e.client_id && getClientName(e.client_id) && (
                        <span className="text-slate-500 text-xs ml-2">
                          — {getClientName(e.client_id)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-amber-400 font-semibold text-sm">
                        {currency(e.grand_total)}
                      </span>
                      <Badge
                        label={e.status}
                        color={
                          e.status === "Approved" ? "green" :
                          e.status === "Sent"     ? "yellow" :
                          e.status === "Lost"     ? "red"    : "gray"
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// KPI Card with gradient + animated number
function KpiCard({ icon, label, value, sub, gradient, iconColor, numeric, currency: isCurrency, onClick }) {
  const formatter = isCurrency
    ? (v) => `$${Math.round(v).toLocaleString()}`
    : (v) => Math.round(v).toString();

  return (
    <motion.div
      whileHover={onClick ? { y: -2 } : {}}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={`rounded-xl border bg-gradient-to-br ${gradient} ${onClick ? "cursor-pointer" : ""}
        shadow-lg backdrop-blur-sm`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">{label}</p>
          <div className={`${iconColor} opacity-80`}>{icon}</div>
        </div>
        <p className="text-3xl font-bold text-white tabular-nums">
          {numeric || isCurrency ? (
            <CountUp
              value={Number(value) || 0}
              format={formatter}
              duration={0.6}
            />
          ) : (
            value
          )}
        </p>
        <p className="text-xs text-slate-500 mt-1">{sub}</p>
      </div>
    </motion.div>
  );
}

// Empty state with icon + action
function EmptyState({ icon, message, action, actionLabel }) {
  return (
    <div className="h-[180px] flex flex-col items-center justify-center gap-3 text-center">
      {icon}
      <p className="text-slate-500 text-sm">{message}</p>
      {action && actionLabel && (
        <button
          onClick={action}
          className="text-amber-400 hover:text-amber-300 text-xs font-medium underline flex items-center gap-1"
        >
          {actionLabel} <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ================================================================
// CLIENT QUICK-ADD MODAL
// Inline client creation from anywhere — no need to leave current tab.
// Currently used by Estimator to add a client mid-estimate without
// losing form state.
// ================================================================
function ClientQuickAddModal({ isOpen, onClose, onClientAdded }) {
  const toast = useToast();
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setEmail(""); setPhone(""); setSaving(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Client name is required");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: name.trim(),
        email: email.trim() || null,
        phone: normalizePhone(phone) || null,
      })
      .select()
      .single();
    if (!error && data) {
      onClientAdded(data);
      reset();
    } else {
      toast.error("Add failed: " + (error?.message || "Unknown error"));
      setSaving(false);
    }
  };

  const emailWarn = emailWarning(email);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center px-4"
          onClick={() => { reset(); onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-400" />
              Quick Add Client
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Just the basics — full address &amp; notes can be added later in the Clients tab.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name *</label>
                <Inp
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && name.trim() && handleSave()}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email</label>
                  <Inp
                    placeholder="optional"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {emailWarn && (
                    <div className="mt-1 text-[11px] text-amber-400/90 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {emailWarn}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Phone</label>
                  <Inp
                    placeholder="optional"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={() => { const f = formatPhone(phone); if (f && f !== phone) setPhone(f); }}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => { reset(); onClose(); }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Add &amp; Select
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ================================================================
// PIPELINE (v1.1) — Lead Kanban board
// 5-stage drag-drop funnel: New → Contacted → Site Visit → Estimate Sent → Won/Lost
// ================================================================
const PIPELINE_STAGES = [
  { id: "new",            label: "New",           accent: "from-slate-500/20 to-slate-500/5",   border: "border-slate-500/30",  glow: "shadow-slate-500/10",  icon: Plus       },
  { id: "contacted",      label: "Contacted",     accent: "from-blue-500/20 to-blue-500/5",     border: "border-blue-500/30",   glow: "shadow-blue-500/10",   icon: MessageSquare },
  { id: "site_visit",     label: "Site Visit",    accent: "from-amber-500/20 to-amber-500/5",   border: "border-amber-500/30",  glow: "shadow-amber-500/10",  icon: MapPin     },
  { id: "estimate_sent",  label: "Estimate Sent", accent: "from-purple-500/20 to-purple-500/5", border: "border-purple-500/30", glow: "shadow-purple-500/10", icon: FileText   },
  { id: "won",            label: "Won",           accent: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/30", glow: "shadow-emerald-500/10", icon: Trophy   },
];

const LEAD_SOURCES = [
  "Referral",
  "Website",
  "Google",
  "Facebook",
  "Instagram",
  "Drive-by",
  "Past Client",
  "Cold Outreach",
  "Other",
];

function daysSinceTouch(ts) {
  if (!ts) return null;
  const ms = Date.now() - new Date(ts).getTime();
  // Clamp to 0 — clock skew between client and DB can yield slightly negative ms
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function touchBadgeColor(days) {
  if (days == null) return "bg-slate-700/60 text-slate-300";
  if (days <= 1)  return "bg-emerald-900/40 text-emerald-300 border border-emerald-500/30";
  if (days <= 3)  return "bg-blue-900/40 text-blue-300 border border-blue-500/30";
  if (days <= 7)  return "bg-amber-900/40 text-amber-300 border border-amber-500/30";
  return "bg-rose-900/40 text-rose-300 border border-rose-500/30";
}

// ================================================================
// PHONE NORMALIZATION (v1.2)
// Store digits-only for bulletproof dedupe. Format on display.
// ================================================================
function normalizePhone(input) {
  if (!input) return "";
  return String(input).replace(/\D/g, "");
}

// formatPhone(phone) is defined earlier in the file (line ~575) — use that.

// ================================================================
// EMAIL VALIDATION (v1.2)
// Loose check — must have @ and a dot after @. Doesn't block save,
// just surfaces a soft warning under the field.
// ================================================================
function isValidEmail(input) {
  if (!input) return true; // Empty is valid (optional field)
  return /^.+@.+\..+$/.test(String(input).trim());
}

function emailWarning(input) {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  if (!trimmed.includes("@")) return "Missing @ symbol";
  const afterAt = trimmed.split("@")[1] || "";
  if (!afterAt.includes(".")) return "Missing the .com (or similar) part";
  if (afterAt.startsWith(".") || afterAt.endsWith(".")) return "Email looks malformed";
  return null;
}

// ================================================================
// LIEN DEADLINE CALCULATOR (v1.2, schema-corrected v1.3.3)
// Michigan Construction Lien Act (Act 497 of 1980): a contractor
// has 90 days from the date of last labor or material furnished
// to record a Construction Lien. Miss this window, lose lien rights.
//
// "Last labor/material" = MAX of:
//   - latest daily_log.log_date for this job
//   - latest time_entries.clock_out (or clock_in if no clock_out yet)
//   - latest material_deliveries.delivered_date
// Returns null if the job has no labor/material activity yet.
// ================================================================
function lienDeadlineFor(job, dailyLogs, timeEntries, materialDeliveries) {
  if (!job) return null;
  // v1.3.2 — Paid jobs have no lien risk. The Construction Lien Act
  // only applies to unpaid work. Once Connor marks a job paid in full,
  // lien tracking becomes noise.
  if (job.paid_in_full_at) return null;
  const dates = [];

  (dailyLogs || []).forEach((l) => {
    if (l.job_id === job.id && l.log_date) {
      // log_date is YYYY-MM-DD; treat as local noon to avoid TZ edge cases
      dates.push(new Date(l.log_date + "T12:00:00").getTime());
    }
  });
  (timeEntries || []).forEach((t) => {
    if (t.job_id === job.id) {
      if (t.clock_out) dates.push(new Date(t.clock_out).getTime());
      else if (t.clock_in) dates.push(new Date(t.clock_in).getTime());
    }
  });
  (materialDeliveries || []).forEach((m) => {
    if (m.job_id === job.id && m.delivered_date) {
      dates.push(new Date(m.delivered_date + "T12:00:00").getTime());
    }
  });

  if (dates.length === 0) return null;

  const lastLaborMs = Math.max(...dates);
  const deadlineMs = lastLaborMs + 90 * 24 * 60 * 60 * 1000;
  const daysRemaining = Math.floor((deadlineMs - Date.now()) / (1000 * 60 * 60 * 24));

  let urgency = "safe";
  if (daysRemaining < 0)       urgency = "expired";
  else if (daysRemaining <= 7) urgency = "critical";
  else if (daysRemaining <= 30) urgency = "warning";

  return {
    lastLaborDate: new Date(lastLaborMs),
    deadlineDate: new Date(deadlineMs),
    daysRemaining,
    urgency,
  };
}

function lienBadgeStyle(urgency) {
  switch (urgency) {
    case "expired":  return "bg-red-950/60 text-red-300 border border-red-700";
    case "critical": return "bg-rose-900/50 text-rose-200 border border-rose-600";
    case "warning":  return "bg-amber-900/40 text-amber-200 border border-amber-700";
    case "safe":     return "bg-emerald-950/40 text-emerald-300 border border-emerald-800";
    default:         return "bg-slate-800 text-slate-400 border border-slate-700";
  }
}

function lienLabel(urgency, daysRemaining) {
  if (urgency === "expired") return `Lien window closed (${Math.abs(daysRemaining)}d ago)`;
  if (daysRemaining === 0)   return "Lien deadline today";
  if (daysRemaining === 1)   return "1d to record lien";
  return `${daysRemaining}d to record lien`;
}

// ================================================================
// LAST-TOUCH / LAST-ACTIVITY HELPERS (v1.3)
// "Last activity on a job" = most recent of:
//   - daily log
//   - time entry (clock_out preferred, fallback clock_in)
//   - photo upload
//   - material delivery received
// Returns Date object or null. Used for "Last work: 3d ago" badges
// in Jobs list, plus aggregated to compute last-contact-with-client.
// ================================================================
function lastActivityForJob(job, dailyLogs, timeEntries, jobPhotos, materialDeliveries) {
  if (!job) return null;
  const dates = [];
  (dailyLogs || []).forEach((l) => {
    if (l.job_id === job.id && l.log_date) dates.push(new Date(l.log_date + "T12:00:00").getTime());
  });
  (timeEntries || []).forEach((t) => {
    if (t.job_id === job.id) {
      if (t.clock_out) dates.push(new Date(t.clock_out).getTime());
      else if (t.clock_in) dates.push(new Date(t.clock_in).getTime());
    }
  });
  (jobPhotos || []).forEach((p) => {
    if (p.job_id === job.id && p.created_at) dates.push(new Date(p.created_at).getTime());
  });
  (materialDeliveries || []).forEach((m) => {
    if (m.job_id === job.id && m.delivered_date) dates.push(new Date(m.delivered_date + "T12:00:00").getTime());
  });
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates));
}

// Days since last activity (clamped to 0 for clock skew, null if no activity yet)
function daysSinceActivity(date) {
  if (!date) return null;
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// Activity badge style — same urgency tiers as touchBadgeColor but tuned
// for jobs (longer windows expected; "no activity in 14 days" is normal
// for a finished build, but >30d on Active jobs is suspect)
function activityBadgeStyle(days) {
  if (days == null)    return "bg-slate-800/60 text-slate-500 border border-slate-700";
  if (days <= 1)       return "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50";
  if (days <= 7)       return "bg-blue-900/40 text-blue-300 border border-blue-700/50";
  if (days <= 30)      return "bg-amber-900/40 text-amber-200 border border-amber-700/50";
  return "bg-rose-900/40 text-rose-300 border border-rose-700/50";
}

function activityLabel(days) {
  if (days == null) return "No activity yet";
  if (days === 0)   return "Today";
  if (days === 1)   return "1d ago";
  return `${days}d ago`;
}

// Last contact with a client = most recent activity across ALL their jobs
function lastContactForClient(client, jobs, dailyLogs, timeEntries, jobPhotos, materialDeliveries) {
  if (!client) return null;
  const clientJobs = (jobs || []).filter((j) => j.client_id === client.id);
  if (clientJobs.length === 0) return null;
  const dates = clientJobs
    .map((j) => lastActivityForJob(j, dailyLogs, timeEntries, jobPhotos, materialDeliveries))
    .filter(Boolean)
    .map((d) => d.getTime());
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates));
}

function Pipeline({ leads, setLeads, clients, setClients, jobs, setJobs, estimates, setTab }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [showAddModal, setShowAddModal] = useState(false);
  const [drawerLead, setDrawerLead] = useState(null);
  const [showLost, setShowLost] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [hoverColumn, setHoverColumn] = useState(null);

  // Conversion modal state — fires when a lead is dropped on Won
  const [convertingLead, setConvertingLead] = useState(null);
  // Lost reason modal — fires when a card is dropped on Lost
  const [losingLead, setLosingLead] = useState(null);

  const activeLeads = leads.filter((l) => !l.archived_at && l.stage !== "lost");
  const lostLeads   = leads.filter((l) => l.stage === "lost" && !l.archived_at);

  // Sanity check — if a lead's stage isn't recognized, log it so schema drift surfaces
  // instead of cards silently disappearing from the board
  const knownStageIds = PIPELINE_STAGES.map((s) => s.id).concat(["lost"]);
  const orphanedLeads = activeLeads.filter((l) => !knownStageIds.includes(l.stage));
  if (orphanedLeads.length > 0) {
    console.warn(
      `[Pipeline] ${orphanedLeads.length} lead(s) have unrecognized stage values:`,
      orphanedLeads.map((l) => ({ id: l.id, name: l.name, stage: l.stage }))
    );
  }

  const grouped = PIPELINE_STAGES.reduce((acc, s) => {
    acc[s.id] = activeLeads.filter((l) => l.stage === s.id);
    return acc;
  }, {});

  // Funnel stats
  const totalActive = activeLeads.length;
  const totalValue = activeLeads.reduce((sum, l) => sum + (Number(l.est_value) || 0), 0);
  const wonThisMonth = leads.filter((l) => {
    if (l.stage !== "won" || !l.won_at) return false;
    const w = new Date(l.won_at);
    const now = new Date();
    return w.getMonth() === now.getMonth() && w.getFullYear() === now.getFullYear();
  }).length;

  // ============================================================
  // Drag handlers (HTML5 native, no extra deps)
  // ============================================================
  const onDragStart = (e, lead) => {
    setDraggingId(lead.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", lead.id);
  };
  const onDragEnd = () => {
    setDraggingId(null);
    setHoverColumn(null);
  };
  const onDragOverCol = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (hoverColumn !== stageId) setHoverColumn(stageId);
  };
  const onDropCol = async (e, stageId) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    setHoverColumn(null);
    setDraggingId(null);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    if (lead.stage === stageId) return;

    // Special handling: dragging to Won fires conversion modal
    if (stageId === "won") {
      setConvertingLead(lead);
      return;
    }
    await updateLeadStage(lead, stageId);
  };

  const updateLeadStage = async (lead, newStage) => {
    const optimistic = { ...lead, stage: newStage, last_touch_at: new Date().toISOString() };
    setLeads((arr) => arr.map((l) => (l.id === lead.id ? optimistic : l)));

    const { error } = await supabase
      .from("leads")
      .update({ stage: newStage, last_touch_at: new Date().toISOString() })
      .eq("id", lead.id);
    if (error) {
      toast.error("Failed to update lead stage");
      setLeads((arr) => arr.map((l) => (l.id === lead.id ? lead : l)));
      return;
    }
    toast.success(`Moved ${lead.name} → ${PIPELINE_STAGES.find((s) => s.id === newStage)?.label || newStage}`);
  };

  // Drop on Lost zone (separate target)
  const onDropLost = async (e) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    setHoverColumn(null);
    setDraggingId(null);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    if (lead.stage === "lost") return;
    setLosingLead(lead);
  };

  // ============================================================
  // Lead actions
  // ============================================================
  const handleAddLead = async (payload) => {
    const { data, error } = await supabase
      .from("leads")
      .insert({ ...payload, stage: "new" })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add lead: " + error.message);
      return;
    }
    setLeads((arr) => [data, ...arr]);
    toast.success(`Added lead: ${data.name}`);
    setShowAddModal(false);
  };

  const handleUpdateLead = async (leadId, patch) => {
    // Snapshot the current lead so we can roll back if supabase rejects
    const previousLead = leads.find((l) => l.id === leadId);
    const optimistic = { ...patch, last_touch_at: new Date().toISOString() };
    setLeads((arr) => arr.map((l) => (l.id === leadId ? { ...l, ...optimistic } : l)));
    const { error } = await supabase.from("leads").update(optimistic).eq("id", leadId);
    if (error) {
      toast.error("Failed to update lead: " + error.message);
      // Roll back to pre-edit state
      if (previousLead) {
        setLeads((arr) => arr.map((l) => (l.id === leadId ? previousLead : l)));
      }
    }
  };

  const handleArchiveLead = async (leadId) => {
    const ok = await confirm({
      title: "Archive this lead?",
      message: "You can restore it later from Lost / Archive view.",
      confirmText: "Archive",
      destructive: true,
    });
    if (!ok) return;
    const previousLead = leads.find((l) => l.id === leadId);
    const { error } = await supabase
      .from("leads")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", leadId);
    if (error) {
      toast.error("Failed to archive: " + error.message);
      return;
    }
    setLeads((arr) => arr.filter((l) => l.id !== leadId));
    setDrawerLead(null);
    // v1.3 — Undo support
    toast.success("Lead archived", {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: async () => {
          const { error: undoErr } = await supabase
            .from("leads")
            .update({ archived_at: null })
            .eq("id", leadId);
          if (undoErr) {
            toast.error("Restore failed: " + undoErr.message);
            return;
          }
          if (previousLead) {
            setLeads((arr) => [{ ...previousLead, archived_at: null }, ...arr]);
          }
          toast.info("Lead restored");
        },
      },
    });
  };

  // ============================================================
  // Convert lead → client + job (drop-on-Won flow)
  // ============================================================
  const handleConvertWon = async (lead, alsoCreateJob, jobName) => {
    // v1.3.2 — Track what we created so we can roll back on partial failure.
    // Without this, a step-3 failure leaves orphaned clients/jobs in the DB
    // while the lead still shows as open. Multi-step writes need atomicity.
    const createdClientId = { id: null }; // mutable wrapper for rollback
    const createdJobId    = { id: null };

    const rollback = async (reason) => {
      try {
        if (createdJobId.id) {
          await supabase.from("jobs").delete().eq("id", createdJobId.id);
          setJobs((arr) => arr.filter((j) => j.id !== createdJobId.id));
        }
        if (createdClientId.id) {
          // Soft-delete (matches v1.3.2 client delete pattern)
          await supabase
            .from("clients")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", createdClientId.id);
          setClients((arr) => arr.filter((c) => c.id !== createdClientId.id));
        }
      } catch (rbErr) {
        console.error("Rollback also failed:", rbErr);
      }
      toast.error(`Convert failed: ${reason}. Any partial records were rolled back.`);
    };

    // 1. Create client (or reuse existing match)
    let clientId = null;
    const existingMatch = clients.find(
      (c) =>
        (lead.email && c.email && c.email.toLowerCase() === lead.email.toLowerCase()) ||
        (lead.phone && c.phone && normalizePhone(c.phone) === normalizePhone(lead.phone))
    );
    if (existingMatch) {
      clientId = existingMatch.id;
    } else {
      const { data: newClient, error: cErr } = await supabase
        .from("clients")
        .insert({
          name: lead.name,
          email: lead.email,
          phone: normalizePhone(lead.phone) || null,
          address: lead.address,
        })
        .select()
        .single();
      if (cErr) {
        toast.error("Failed to create client: " + cErr.message);
        return;
      }
      clientId = newClient.id;
      createdClientId.id = newClient.id; // arm rollback
      setClients((arr) => [...arr, newClient]);
    }

    // 2. Optionally create job
    let jobId = null;
    if (alsoCreateJob) {
      const { data: newJob, error: jErr } = await supabase
        .from("jobs")
        .insert({
          name:      jobName || lead.scope || `${lead.name} project`,
          client_id: clientId,
          status:    "Active",
          budget:    Number(lead.est_value) || 0,
          actual:    0,
        })
        .select()
        .single();
      if (jErr) {
        await rollback("job creation failed (" + jErr.message + ")");
        return;
      }
      jobId = newJob.id;
      createdJobId.id = newJob.id;
      setJobs((arr) => [newJob, ...arr]);
    }

    // 3. Mark lead as Won
    const wonAt = new Date().toISOString();
    const { error: lErr } = await supabase
      .from("leads")
      .update({
        stage: "won",
        won_at: wonAt,
        won_client_id: clientId,
        won_job_id: jobId,
        last_touch_at: wonAt,
      })
      .eq("id", lead.id);
    if (lErr) {
      await rollback("lead update failed (" + lErr.message + ")");
      return;
    }
    setLeads((arr) =>
      arr.map((l) =>
        l.id === lead.id
          ? { ...l, stage: "won", won_at: wonAt, won_client_id: clientId, won_job_id: jobId, last_touch_at: wonAt }
          : l
      )
    );

    toast.success(
      alsoCreateJob
        ? `${lead.name} converted to client + job 🎉`
        : `${lead.name} converted to client`
    );
    setConvertingLead(null);
  };

  // ============================================================
  // Mark Lost
  // ============================================================
  const handleMarkLost = async (lead, reason) => {
    const { error } = await supabase
      .from("leads")
      .update({
        stage: "lost",
        lost_reason: reason || null,
        last_touch_at: new Date().toISOString(),
      })
      .eq("id", lead.id);
    if (error) {
      toast.error("Failed to mark as lost");
      return;
    }
    setLeads((arr) =>
      arr.map((l) =>
        l.id === lead.id
          ? { ...l, stage: "lost", lost_reason: reason || null, last_touch_at: new Date().toISOString() }
          : l
      )
    );
    toast.success(`Marked ${lead.name} as lost`);
    setLosingLead(null);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white flex items-center gap-2">
            <GitBranch className="w-7 h-7 text-amber-400" />
            Pipeline
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Drag a lead between stages to move them through the funnel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn
            onClick={() => setShowLost((v) => !v)}
            className="btn-polished btn-slate text-sm"
          >
            <Archive className="w-4 h-4 mr-1.5" />
            {showLost ? "Hide" : "Show"} Lost ({lostLeads.length})
          </Btn>
          <Btn
            onClick={() => setShowAddModal(true)}
            className="btn-polished btn-amber"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Add Lead
          </Btn>
        </div>
      </div>

      {/* Funnel stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Active Leads</div>
            <div className="text-2xl font-semibold text-white tabular-nums">{totalActive}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-950/40 to-slate-900/60 border border-amber-900/40">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-amber-300/80 mb-1">Pipeline Value</div>
            <div className="text-2xl font-semibold text-amber-100 tabular-nums">
              ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-950/40 to-slate-900/60 border border-emerald-900/40">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-300/80 mb-1">Won This Month</div>
            <div className="text-2xl font-semibold text-emerald-100 tabular-nums">{wonThisMonth}</div>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {totalActive === 0 && lostLeads.length === 0 && (
        <Card className="bg-slate-900/40 border border-dashed border-slate-700">
          <CardContent className="p-10 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
              <Target className="w-7 h-7 text-amber-400" />
            </div>
            <div className="text-xl font-semibold text-white mb-1">Your funnel is empty</div>
            <div className="text-slate-400 text-sm mb-5 max-w-md mx-auto">
              Every paid job started as a lead. Add the first one — even a "maybe" — and start tracking who's moving forward and who's going cold.
            </div>
            <Btn
              onClick={() => setShowAddModal(true)}
              className="btn-polished btn-amber"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Add your first lead
            </Btn>
          </CardContent>
        </Card>
      )}

      {/* Kanban board */}
      {totalActive > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const cards = grouped[stage.id] || [];
            const isHover = hoverColumn === stage.id;
            return (
              <div
                key={stage.id}
                onDragOver={(e) => onDragOverCol(e, stage.id)}
                onDrop={(e) => onDropCol(e, stage.id)}
                onDragLeave={(e) => {
                  // v1.3.2 — Don't clear hover when entering a child (lead card).
                  // Only clear when relatedTarget is outside this column's bounds.
                  // Without this guard, dragging across cards within the same
                  // column triggers a hover-on/off flicker.
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    if (hoverColumn === stage.id) setHoverColumn(null);
                  }
                }}
                className={`rounded-2xl border ${stage.border} bg-gradient-to-b ${stage.accent} transition-all duration-150 ${
                  isHover ? `ring-2 ring-amber-400/60 shadow-2xl ${stage.glow}` : `shadow-lg ${stage.glow}`
                } min-h-[400px] flex flex-col`}
              >
                {/* Column header */}
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <stage.icon className="w-4 h-4 text-white/70" />
                    <span className="font-semibold text-white text-sm">{stage.label}</span>
                  </div>
                  <span className="text-xs text-white/50 tabular-nums px-1.5 py-0.5 rounded-md bg-white/5">
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 px-2 py-2 space-y-2 overflow-y-auto">
                  {cards.length === 0 && (
                    <div className="text-xs text-white/30 text-center py-6 italic">
                      Drop here
                    </div>
                  )}
                  {cards.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => setDrawerLead(lead)}
                      onDragStart={(e) => onDragStart(e, lead)}
                      onDragEnd={onDragEnd}
                      isDragging={draggingId === lead.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lost drop-zone (only shown while dragging or when showLost is on) */}
      {(draggingId || showLost) && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setHoverColumn("lost");
          }}
          onDrop={onDropLost}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setHoverColumn(null);
            }
          }}
          className={`rounded-2xl border-2 border-dashed transition-all duration-150 ${
            hoverColumn === "lost"
              ? "border-rose-400 bg-rose-950/30"
              : "border-rose-900/60 bg-rose-950/10"
          } p-5`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-400" />
              <span className="font-semibold text-rose-300 text-sm">
                Lost ({lostLeads.length})
              </span>
              <span className="text-xs text-rose-400/60">
                — drop here to mark a lead as lost
              </span>
            </div>
          </div>
          {showLost && lostLeads.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
              {lostLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => setDrawerLead(lead)}
                  onDragStart={() => {}}
                  onDragEnd={() => {}}
                  isDragging={false}
                  isLost
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals + drawers */}
      <AnimatePresence>
        {showAddModal && (
          <AddLeadModal
            key="add-lead-modal"
            onClose={() => setShowAddModal(false)}
            onAdd={handleAddLead}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {drawerLead && (
          <LeadDetailDrawer
            key="lead-detail-drawer"
            lead={drawerLead}
            clients={clients}
            jobs={jobs}
            estimates={estimates}
            onClose={() => setDrawerLead(null)}
            onUpdate={(patch) => handleUpdateLead(drawerLead.id, patch)}
            onArchive={() => handleArchiveLead(drawerLead.id)}
            onJumpToJob={(jobId) => {
              // Don't manually close the drawer here — Pipeline unmount will tear it down.
              // Calling setDrawerLead(null) AND setTab("Jobs") simultaneously caused the
              // outer AnimatePresence(mode="wait") to deadlock waiting on the drawer's
              // spring exit animation while Pipeline itself was unmounting. v1.1.4 fix.
              setTab("Jobs");
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {convertingLead && (
          <ConvertLeadModal
            key="convert-lead-modal"
            lead={convertingLead}
            onClose={() => setConvertingLead(null)}
            onConvert={handleConvertWon}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {losingLead && (
          <MarkLostModal
            key="mark-lost-modal"
            lead={losingLead}
            onClose={() => setLosingLead(null)}
            onMarkLost={handleMarkLost}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------
// Lead Card — single Kanban card
// ----------------------------------------------------------------
function LeadCard({ lead, onClick, onDragStart, onDragEnd, isDragging, isLost }) {
  const days = daysSinceTouch(lead.last_touch_at);
  const valueStr =
    lead.est_value && Number(lead.est_value) > 0
      ? `$${Number(lead.est_value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : null;
  const isStale = days != null && days > 7 && !isLost;

  return (
    <motion.div
      layout
      draggable={!isLost}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      whileHover={{ scale: 1.015, y: -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`group cursor-pointer rounded-xl border transition-all ${
        isDragging
          ? "opacity-40 border-amber-400 shadow-2xl shadow-amber-500/30 rotate-1"
          : isLost
          ? "border-rose-900/40 bg-slate-900/60 hover:border-rose-700/60"
          : "border-slate-700/60 bg-slate-900/80 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5"
      } p-3`}
    >
      {/* Top row: name + drag handle */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{lead.name}</div>
          {lead.scope && (
            <div className="text-xs text-slate-400 truncate mt-0.5">{lead.scope}</div>
          )}
        </div>
        {!isLost && (
          <GripVertical className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Source pill */}
      {lead.source && (
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
          {lead.source}
        </div>
      )}

      {/* Bottom row: value + age */}
      <div className="flex items-center justify-between gap-2">
        {valueStr ? (
          <span className="text-sm font-semibold text-amber-300 tabular-nums">{valueStr}</span>
        ) : (
          <span className="text-xs text-slate-600 italic">No value</span>
        )}
        {days != null && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums font-medium ${touchBadgeColor(days)}`}>
            {days === 0 ? "today" : days === 1 ? "1d" : `${days}d`}
          </span>
        )}
      </div>

      {/* Stale flame indicator */}
      {isStale && (
        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-1.5">
          <Flame className="w-3 h-3 text-rose-400" />
          <span className="text-[10px] text-rose-300/80 italic">Going cold — follow up</span>
        </div>
      )}
    </motion.div>
  );
}

// ----------------------------------------------------------------
// Add Lead Modal — quick capture
// ----------------------------------------------------------------
function AddLeadModal({ onClose, onAdd }) {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("Referral");
  const [estValue, setEstValue] = useState("");
  const [scope, setScope] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;
  const emailWarn = emailWarning(email);

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    await onAdd({
      name: name.trim(),
      phone: normalizePhone(phone) || null,
      email: email.trim() || null,
      source,
      est_value: estValue ? Number(estValue) : 0,
      scope: scope.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-white">Add Lead</h3>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">
                Name *
              </label>
              <Inp
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Homeowner name or company"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">
                  Phone
                </label>
                <Inp
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(231) 555-0100"
                  type="tel"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">
                  Email
                </label>
                <Inp
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  type="email"
                />
                {emailWarn && (
                  <div className="mt-1 text-[11px] text-amber-400/90 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {emailWarn}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">
                Source
              </label>
              <Sel value={source} onChange={(e) => setSource(e.target.value)}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Sel>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">
                Property address
              </label>
              <Inp
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, City"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">
                Scope (short)
              </label>
              <Inp
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="2-car detached garage, 24x24"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">
                Estimated value
              </label>
              <Inp
                value={estValue}
                onChange={(e) => setEstValue(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="50000"
                type="text"
                inputMode="decimal"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">
                  Notes
                </label>
                <VoiceMicButton
                  currentValue={notes}
                  onChange={setNotes}
                  appendMode
                  title="Dictate notes"
                />
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How did they find us, what they said, any concerns..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors resize-none"
                rows={3}
              />
            </div>
          </div>

          <div className="p-5 border-t border-slate-800 flex items-center justify-end gap-2">
            <Btn
              onClick={onClose}
              className="btn-polished btn-slate"
            >
              Cancel
            </Btn>
            <Btn
              onClick={submit}
              disabled={!canSave || saving}
              className="btn-polished btn-amber"
            >
              {saving ? <><BtnSpinner />Adding...</> : <><Save className="w-4 h-4 mr-1.5" />Add Lead</>}
            </Btn>
          </div>
        </motion.div>
      </motion.div>
  );
}

// ----------------------------------------------------------------
// Lead Detail Drawer — slide-over (right)
// ----------------------------------------------------------------
function LeadDetailDrawer({ lead, clients, jobs, estimates, onClose, onUpdate, onArchive, onJumpToJob }) {
  const [name, setName]     = useState(lead.name || "");
  const [phone, setPhone]   = useState(formatPhone(lead.phone) || "");
  const [email, setEmail]   = useState(lead.email || "");
  const [source, setSource] = useState(lead.source || "Referral");
  const [estValue, setEstValue] = useState(String(lead.est_value || ""));
  const [scope, setScope]   = useState(lead.scope || "");
  const [address, setAddress] = useState(lead.address || "");
  const [notes, setNotes]   = useState(lead.notes || "");
  const [dirty, setDirty]   = useState(false);

  useEffect(() => {
    setName(lead.name || "");
    setPhone(formatPhone(lead.phone) || "");
    setEmail(lead.email || "");
    setSource(lead.source || "Referral");
    setEstValue(String(lead.est_value || ""));
    setScope(lead.scope || "");
    setAddress(lead.address || "");
    setNotes(lead.notes || "");
    setDirty(false);
  }, [lead.id]);

  const markDirty = () => setDirty(true);
  const emailWarn = emailWarning(email);
  const confirm = useConfirm();

  // v1.3.2 — Unsaved-changes guard. Two layers:
  // (1) Close button / overlay click → confirm dialog (in-app)
  // (2) Browser refresh / tab close → native beforeunload warning
  const handleAttemptClose = useCallback(async () => {
    if (!dirty) {
      onClose();
      return;
    }
    const ok = await confirm({
      title: "Discard unsaved changes?",
      message: "You have edits that haven't been saved. Closing will lose them.",
      confirmText: "Discard",
      danger: true,
    });
    if (ok) onClose();
  }, [dirty, onClose, confirm]);

  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = ""; // Chrome/Safari require this
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleSave = async () => {
    await onUpdate({
      name: name.trim(),
      phone: normalizePhone(phone) || null,
      email: email.trim() || null,
      source,
      est_value: estValue ? Number(estValue) : 0,
      scope: scope.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    });
    setDirty(false);
  };

  // Convert linked records (if Won)
  const linkedJob = lead.won_job_id ? jobs.find((j) => j.id === lead.won_job_id) : null;
  const linkedClient = lead.won_client_id ? clients.find((c) => c.id === lead.won_client_id) : null;
  const stage = PIPELINE_STAGES.find((s) => s.id === lead.stage);
  const isLost = lead.stage === "lost";

  const days = daysSinceTouch(lead.last_touch_at);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
      onClick={handleAttemptClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-5 py-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {isLost ? (
                  <Badge label="Lost" color="rose" />
                ) : (
                  <Badge label={stage?.label || lead.stage} color="amber" />
                )}
                {days != null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums font-medium ${touchBadgeColor(days)}`}>
                    {days === 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`}
                  </span>
                )}
                {/* v1.4 — Unsaved-changes indicator */}
                {dirty && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-amber-400/20 text-amber-300 border border-amber-700/50 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Unsaved
                  </span>
                )}
              </div>
              <h3 className="text-xl font-semibold text-white truncate">{lead.name}</h3>
            </div>
            <button
              onClick={handleAttemptClose}
              className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Won-state banner */}
            {(linkedClient || linkedJob) && (
              <Card className="bg-emerald-950/40 border border-emerald-900/40">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-200">Converted</span>
                  </div>
                  {linkedClient && (
                    <div className="text-xs text-emerald-300/80 mb-1">
                      Client: {linkedClient.name}
                    </div>
                  )}
                  {linkedJob && (
                    <button
                      onClick={() => onJumpToJob(linkedJob.id)}
                      className="text-xs text-emerald-200 underline hover:text-emerald-100 flex items-center gap-1"
                    >
                      Open job: {linkedJob.name}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {!linkedJob && lead.won_job_id && (
                    <div className="text-xs text-amber-300/80 italic mt-1">
                      Linked job no longer exists (may have been deleted).
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Lost reason banner */}
            {isLost && lead.lost_reason && (
              <Card className="bg-rose-950/30 border border-rose-900/40">
                <CardContent className="p-3">
                  <div className="text-xs uppercase tracking-wide text-rose-400 mb-1">Lost reason</div>
                  <div className="text-sm text-rose-100">{lead.lost_reason}</div>
                </CardContent>
              </Card>
            )}

            {/* Editable fields */}
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">Name</label>
              <Inp value={name} onChange={(e) => { setName(e.target.value); markDirty(); }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">Phone</label>
                <Inp
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); markDirty(); }}
                  onBlur={() => { const f = formatPhone(phone); if (f && f !== phone) setPhone(f); }}
                  type="tel"
                  placeholder="(231) 555-0100"
                />
                {phone && (
                  <a
                    href={`tel:${normalizePhone(phone)}`}
                    className="text-xs text-amber-400 hover:text-amber-300 mt-1 inline-flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" /> Call
                  </a>
                )}
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">Email</label>
                <Inp value={email} onChange={(e) => { setEmail(e.target.value); markDirty(); }} type="email" />
                {emailWarn && (
                  <div className="mt-1 text-[11px] text-amber-400/90 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {emailWarn}
                  </div>
                )}
                {email && !emailWarn && (
                  <a
                    href={`mailto:${email}`}
                    className="text-xs text-amber-400 hover:text-amber-300 mt-1 inline-flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3" /> Email
                  </a>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">Source</label>
              <Sel value={source} onChange={(e) => { setSource(e.target.value); markDirty(); }}>
                {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Sel>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">Property address</label>
              <Inp value={address} onChange={(e) => { setAddress(e.target.value); markDirty(); }} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">Scope</label>
              <Inp value={scope} onChange={(e) => { setScope(e.target.value); markDirty(); }} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">Estimated value</label>
              <Inp
                value={estValue}
                onChange={(e) => { setEstValue(e.target.value.replace(/[^0-9.]/g, "")); markDirty(); }}
                inputMode="decimal"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Notes</label>
                <VoiceMicButton
                  currentValue={notes}
                  onChange={(v) => { setNotes(v); markDirty(); }}
                  appendMode
                  title="Dictate notes"
                />
              </div>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); markDirty(); }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors resize-none"
                rows={4}
              />
            </div>

            <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
              Created {new Date(lead.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Footer actions */}
          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-5 py-4 flex items-center justify-between gap-2">
            <Btn
              onClick={onArchive}
              className="btn-polished btn-ghost-rose text-sm"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Archive
            </Btn>
            <Btn
              onClick={handleSave}
              disabled={!dirty}
              className={dirty ? "btn-polished btn-amber" : "btn-polished btn-muted"}
            >
              <Save className="w-4 h-4 mr-1.5" />
              {dirty ? "Save Changes" : "No Changes"}
            </Btn>
          </div>
        </motion.div>
      </motion.div>
  );
}

// ----------------------------------------------------------------
// Convert Lead Modal — fires when dropping a lead on Won
// ----------------------------------------------------------------
function ConvertLeadModal({ lead, onClose, onConvert }) {
  const [createJob, setCreateJob] = useState(true);
  const [jobName, setJobName] = useState(lead.scope || `${lead.name} project`);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await onConvert(lead, createJob, jobName);
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="bg-slate-900 border border-emerald-900/40 rounded-2xl shadow-2xl shadow-emerald-500/10 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-800 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Convert {lead.name} to Won?</h3>
        </div>

        <div className="p-5 space-y-3">
            <p className="text-sm text-slate-300">
              This will create a Client record. Optionally also create a Job to start tracking the build.
            </p>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700 cursor-pointer hover:border-emerald-700 transition-colors">
              <input
                type="checkbox"
                checked={createJob}
                onChange={(e) => setCreateJob(e.target.checked)}
                className="mt-0.5 accent-emerald-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">Also create a Job</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Recommended. You can edit details later.
                </div>
              </div>
            </label>

            {createJob && (
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">
                  Job name
                </label>
                <Inp
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-800 flex items-center justify-end gap-2">
            <Btn
              onClick={onClose}
              className="btn-polished btn-slate"
            >
              Cancel
            </Btn>
            <Btn
              onClick={submit}
              disabled={saving}
              className="btn-polished btn-emerald"
            >
              {saving ? <><BtnSpinner />Converting...</> : <><Trophy className="w-4 h-4 mr-1.5" />Convert</>}
            </Btn>
          </div>
        </motion.div>
      </motion.div>
  );
}

// ----------------------------------------------------------------
// Mark Lost Modal — fires when dropping on Lost zone
// ----------------------------------------------------------------
function MarkLostModal({ lead, onClose, onMarkLost }) {
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [saving, setSaving] = useState(false);

  // v1.4.1 — Reason now required. CRM hygiene: knowing WHY you
  // lost is what tells you whether bids are too high, follow-up
  // too slow, or lead source unqualified. "Optional" was a footgun.
  const finalReason = reason === "Other" ? otherReason.trim() : reason;
  const canSubmit = !!finalReason && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    await onMarkLost(lead, finalReason);
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="bg-slate-900 border border-rose-900/40 rounded-2xl shadow-2xl shadow-rose-500/10 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-800 flex items-center gap-2">
          <XCircle className="w-5 h-5 text-rose-400" />
          <h3 className="text-lg font-semibold text-white">Mark {lead.name} as Lost?</h3>
        </div>

        <div className="p-5 space-y-3">
            <p className="text-sm text-slate-300">
              Why did you lose this one? Tracking patterns helps you
              spot whether bids are too high, follow-up's too slow,
              or a lead source isn't qualified.
            </p>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">
                Reason <span className="text-rose-400">*</span>
              </label>
              <Sel value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">— Select a reason —</option>
                <option value="Price">Price</option>
                <option value="Timeline">Timeline</option>
                <option value="Went with another contractor">Went with another contractor</option>
                <option value="Project cancelled">Project cancelled</option>
                <option value="No response">No response</option>
                <option value="Out of service area">Out of service area</option>
                <option value="Not a real lead">Not a real lead</option>
                <option value="Other">Other (specify below)</option>
              </Sel>
            </div>
            {reason === "Other" && (
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400 block mb-1">
                  Specify <span className="text-rose-400">*</span>
                </label>
                <Inp
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="What happened?"
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-800 flex items-center justify-end gap-2">
            <Btn
              onClick={onClose}
              className="btn-polished btn-slate"
            >
              Cancel
            </Btn>
            <Btn
              onClick={submit}
              disabled={!canSubmit}
              className={canSubmit ? "btn-polished btn-rose" : "btn-polished btn-muted"}
            >
              {saving ? <><BtnSpinner />Saving...</> : <><XCircle className="w-4 h-4 mr-1.5" />Mark Lost</>}
            </Btn>
          </div>
        </motion.div>
      </motion.div>
  );
}

// ================================================================
// ESTIMATOR
// ================================================================
function Estimator({ settings, estimates, setEstimates, onJobCreated, clients, setClients, jobs }) {
  const toast    = useToast();
  const confirm  = useConfirm();
  const [tab, setTab]                     = useState("Materials");
  const [estName, setEstName]             = useState("New Estimate");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [scopeOfWork, setScopeOfWork]     = useState("");
  const [projectAddress, setProjectAddress] = useState("");
  const [estimatedWeeks, setEstimatedWeeks] = useState(4);
  const [exclusionsText, setExclusionsText] = useState(
    "Permit fees unless otherwise specified in writing. " +
    "Landscaping restoration after construction. " +
    "Interior painting of new work unless explicitly included. " +
    "Furniture removal or storage. " +
    "Dumpster rental unless noted. " +
    "Damage or additional work required due to unforeseen conditions discovered during demolition or construction."
  );
  const [materials, setMaterials]         = useState([]);
  const [labor, setLabor]                 = useState([]);
  const [contingencyPct, setContingencyPct] = useState(10);
  const [fees, setFees]                   = useState(0);
  const [discount, setDiscount]           = useState(0);
  const [saving, setSaving]               = useState(false);
  const [editingId, setEditingId]         = useState(null);   // null = new, id = editing existing
  const [estFilter, setEstFilter]         = useState("All");  // saved-list filter
  const [estSearch, setEstSearch]         = useState("");     // saved-list search
  const [showClientAddModal, setShowClientAddModal] = useState(false); // quick-add client modal

  // Material form
  const [mName, setMName] = useState("");
  const [mCost, setMCost] = useState("");
  const [mQty,  setMQty]  = useState("");

  // Labor form
  const [lTask,  setLTask]  = useState("");
  const [lRate,  setLRate]  = useState("");
  const [lHours, setLHours] = useState("");

  // savedEstimates is now derived from parent state (fixes Dashboard staleness)
  const savedEstimates = estimates;

  const addMat = () => {
    const cost = parseFloat(mCost);
    const qty  = parseFloat(mQty);
    if (!mName || isNaN(cost) || isNaN(qty) || qty <= 0) return;
    setMaterials((m) => [...m, { id: uid(), name: mName, cost, qty }]);
    setMName(""); setMCost(""); setMQty("");
  };

  const addLab = () => {
    const rate  = parseFloat(lRate);
    const hours = parseFloat(lHours);
    if (!lTask || isNaN(rate) || isNaN(hours) || hours <= 0) return;
    setLabor((l) => [...l, { id: uid(), task: lTask, rate, hours }]);
    setLTask(""); setLRate(""); setLHours("");
  };

  const mTotal    = materials.reduce((s, m) => s + m.cost * m.qty, 0);
  const lTotal    = labor.reduce((s, l) => s + l.rate * l.hours, 0);
  const subtotal  = mTotal + lTotal;
  const contingency = subtotal * (contingencyPct / 100);
  const overhead  = subtotal * ((settings.overheadPct || 0) / 100);
  const profit    = subtotal * ((settings.profitPct || 0) / 100);
  // NOTE: Sales tax is NOT charged to clients per Michigan law (RAB 2025-18).
  // Contractors pay tax at purchase; it is absorbed into material cost.
  const grandTotal = Math.max(
    0,
    subtotal + contingency + overhead + profit +
    (Number(fees) || 0) - (Number(discount) || 0)
  );

  const saveEst = async (status = "Draft") => {
    setSaving(true);
    const payload = {
      name:          estName,
      materials,
      labor,
      grand_total:   grandTotal,
      status,
      client_id:     selectedClientId || null,
      job_id:        selectedJobId    || null,
      scope_of_work: scopeOfWork,
      project_address: projectAddress,
      estimated_weeks: estimatedWeeks,
      exclusions:    exclusionsText,
      contingency_pct: contingencyPct,
      materials_total: mTotal,
      labor_total:   lTotal,
      overhead_pct:  settings.overheadPct || 12.5,
      profit_pct:    settings.profitPct   || 10,
    };

    if (editingId) {
      // UPDATE existing estimate
      const { data, error } = await supabase
        .from("estimates")
        .update(payload)
        .eq("id", editingId)
        .select()
        .single();
      if (!error && data) {
        setEstimates((prev) => prev.map((e) => (e.id === data.id ? data : e)));
        toast.success(`Estimate updated as ${status}`);
        if (status === "Approved") {
          const { data: job } = await supabase
            .from("jobs")
            .insert({
              name:      estName,
              status:    "Active",
              budget:    grandTotal,
              actual:    0,
              client_id: selectedClientId || null,
            })
            .select()
            .single();
          if (job) {
            onJobCreated(job);
            toast.success("Job created from approved estimate");
          }
        }
      } else {
        toast.error("Update failed: " + (error?.message || "Unknown error"));
      }
    } else {
      // INSERT new estimate
      const { data, error } = await supabase
        .from("estimates")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setEstimates((prev) => [data, ...prev]);
        setEditingId(data.id);  // now we're editing this one
        toast.success(`Saved as ${status}`);
        if (status === "Approved") {
          const { data: job } = await supabase
            .from("jobs")
            .insert({
              name:      estName,
              status:    "Active",
              budget:    grandTotal,
              actual:    0,
              client_id: selectedClientId || null,
            })
            .select()
            .single();
          if (job) {
            onJobCreated(job);
            toast.success("Job created from approved estimate");
          }
        }
      } else {
        toast.error("Save failed: " + (error?.message || "Unknown error"));
      }
    }
    setSaving(false);
  };

  // Reset form to blank state (for "New Estimate" button)
  const resetForm = () => {
    setEditingId(null);
    setEstName("New Estimate");
    setSelectedClientId("");
    setSelectedJobId("");
    setScopeOfWork("");
    setProjectAddress("");
    setEstimatedWeeks(4);
    setMaterials([]);
    setLabor([]);
    setContingencyPct(10);
    setFees(0);
    setDiscount(0);
    setTab("Materials");
  };

  // Load an existing estimate into the editor
  const loadEstimate = (est) => {
    setEditingId(est.id);
    setEstName(est.name || "");
    setSelectedClientId(est.client_id || "");
    setSelectedJobId(est.job_id || "");
    setScopeOfWork(est.scope_of_work || "");
    setProjectAddress(est.project_address || "");
    setEstimatedWeeks(est.estimated_weeks || 4);
    setExclusionsText(est.exclusions || exclusionsText);
    setMaterials(Array.isArray(est.materials) ? est.materials : []);
    setLabor(Array.isArray(est.labor) ? est.labor : []);
    setContingencyPct(est.contingency_pct || 10);
    toast.info(`Loaded "${est.name}" for editing`);
    // scroll to top so user sees they're editing
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Duplicate an existing estimate as a new draft
  const duplicateEstimate = async (est) => {
    const ok = await confirm({
      title: "Duplicate this estimate?",
      message: `A new draft will be created as a copy of "${est.name}". You can then edit it independently.`,
      confirmText: "Duplicate",
    });
    if (!ok) return;
    const { id, created_at, ...rest } = est;
    const payload = {
      ...rest,
      name: `${est.name} (Copy)`,
      status: "Draft",
    };
    const { data, error } = await supabase
      .from("estimates")
      .insert(payload)
      .select()
      .single();
    if (!error && data) {
      setEstimates((prev) => [data, ...prev]);
      toast.success("Estimate duplicated");
    } else {
      toast.error("Duplicate failed: " + (error?.message || "Unknown error"));
    }
  };

  // Delete an estimate (v1.3.2 — soft-delete + Undo)
  const deleteEstimate = async (est) => {
    const ok = await confirm({
      title: "Delete this estimate?",
      message: `"${est.name}" (${currency(est.grand_total)}) will be removed.\n\nYou'll have a few seconds to undo.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("estimates")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", est.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    setEstimates((prev) => prev.filter((e) => e.id !== est.id));
    if (editingId === est.id) resetForm();
    toast.success("Estimate deleted", {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: async () => {
          const { error: undoErr } = await supabase
            .from("estimates")
            .update({ deleted_at: null })
            .eq("id", est.id);
          if (undoErr) {
            toast.error("Restore failed: " + undoErr.message);
            return;
          }
          const { data: fresh } = await supabase
            .from("estimates")
            .select("*")
            .eq("id", est.id)
            .maybeSingle();
          if (fresh) {
            setEstimates((prev) => [fresh, ...prev]);
          }
          toast.info("Estimate restored");
        },
      },
    });
  };

  // Update estimate status from the saved list (e.g. mark Lost)
  const updateEstimateStatus = async (est, newStatus) => {
    const { data, error } = await supabase
      .from("estimates")
      .update({ status: newStatus })
      .eq("id", est.id)
      .select()
      .single();
    if (!error && data) {
      setEstimates((prev) => prev.map((e) => (e.id === data.id ? data : e)));
      toast.success(`Status updated to ${newStatus}`);
    } else {
      toast.error("Status update failed: " + (error?.message || "Unknown error"));
    }
  };

  // Quick-add client from inside the estimator. Auto-selects the new client
  // so the in-progress estimate stays linked to it.
  const handleClientAdded = (newClient) => {
    setClients((prev) => [newClient, ...prev]);
    setSelectedClientId(newClient.id);
    setShowClientAddModal(false);
    toast.success(`Client "${newClient.name}" added and selected`);
  };


  const handleGenerateProposal = async (est) => {
    if (!est.grand_total || Number(est.grand_total) === 0) {
      toast.error("This estimate has $0 total. Add materials and labor first.");
      return;
    }
    if (!est.name || est.name === "New Estimate") {
      const ok = await confirm({
        title: "Estimate name not set",
        message: `This estimate is still named "${est.name || "(blank)"}". The client will see this as the project name on the proposal.`,
        confirmText: "Generate Anyway",
        cancelText: "Go Back",
      });
      if (!ok) return;
    }
    if (!est.scope_of_work || !est.scope_of_work.trim()) {
      const ok = await confirm({
        title: "No scope of work",
        message: "Generating a proposal without scope is not recommended. Clients trust contractors who clearly describe what they're doing.",
        confirmText: "Generate Anyway",
        cancelText: "Go Back",
      });
      if (!ok) return;
    }
    // Detect unfilled template placeholders
    const placeholderPhrases = [
      "Brief description of what we're building",
      "Specific work item #1",
      "Specific work item #2",
    ];
    const unfilled = placeholderPhrases.filter((p) =>
      (est.scope_of_work || "").includes(p)
    );
    if (unfilled.length > 0) {
      const ok = await confirm({
        title: "Scope contains template placeholders",
        message: "Your scope still has unfilled template text. The client will see this exactly as written.",
        details: unfilled.map((u) => `• ${u}`).join("\n"),
        confirmText: "Generate Anyway",
        cancelText: "Go Back",
        danger: true,
      });
      if (!ok) return;
    }
    const client = clients.find((c) => c.id === est.client_id) || null;
    openProposal(est, client, settings);
  };

  // PHASE 4 — Generate binding contract from an APPROVED estimate.
  // Contracts are only available for Approved estimates (gated in JSX below).
  const handleGenerateContract = async (est) => {
    if (est.status !== "Approved") {
      toast.error("Contracts are generated from Approved estimates only.");
      return;
    }
    if (!est.scope_of_work || !est.scope_of_work.trim()) {
      const ok = await confirm({
        title: "No scope on linked estimate",
        message: "Contract Article 2 references the proposal scope. Generating without one will leave Article 2 thin.",
        confirmText: "Generate Anyway",
        cancelText: "Go Back",
      });
      if (!ok) return;
    }
    const client = clients.find((c) => c.id === est.client_id) || null;
    const contractNum = `NSC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    openContract(est, client, settings, contractNum);
  };

  const ASSEMBLIES = [
    {
      name: "Toilet Set",
      mats: [{ name: "Toilet (standard)", cost: 169, qty: 1 }, { name: "Wax ring & supply", cost: 14, qty: 1 }],
      labs: [{ task: "Set toilet", rate: 95, hours: 1.25 }],
    },
    {
      name: "Bath Fan",
      mats: [{ name: "Bath fan unit", cost: 129, qty: 1 }, { name: "Ducting & tape", cost: 24.5, qty: 1 }],
      labs: [{ task: "Replace fan", rate: 95, hours: 1.5 }],
    },
    {
      name: "Interior Door",
      mats: [{ name: "Prehung door 6-8", cost: 189, qty: 1 }, { name: "Hardware set", cost: 45, qty: 1 }],
      labs: [{ task: "Install door", rate: 95, hours: 2 }],
    },
    {
      name: "Outlet/Switch",
      mats: [{ name: "Outlet or switch", cost: 4.5, qty: 1 }, { name: "Box & cover", cost: 3, qty: 1 }],
      labs: [{ task: "Wire outlet/switch", rate: 95, hours: 0.5 }],
    },
  ];

  const addAssembly = (a) => {
    setMaterials((m) => [...m, ...a.mats.map((x) => ({ ...x, id: uid() }))]);
    setLabor((l)     => [...l, ...a.labs.map((x) => ({ ...x, id: uid() }))]);
  };

  const lineItems = [
    { label: "Materials",                    value: currency(mTotal) },
    { label: "Labor",                        value: currency(lTotal) },
    { label: "Subtotal",                     value: currency(subtotal), bold: true },
    { label: `Contingency (${contingencyPct}%)`, value: currency(contingency) },
    { label: `Overhead (${settings.overheadPct}%)`, value: currency(overhead) },
    { label: `Profit (${settings.profitPct}%)`,     value: currency(profit) },
    { label: "Flat Fees",                    value: currency(fees) },
    { label: "Discount",                     value: `−${currency(discount)}` },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER ROW */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Estimator</h1>
            {editingId && (
              <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 text-xs font-semibold rounded border border-amber-700">
                Editing existing
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {editingId
              ? "You're editing a saved estimate. Changes will update the original."
              : "Build material + labor estimates with automatic markup"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {editingId && (
            <Btn
              onClick={resetForm}
              className="bg-slate-800 hover:bg-slate-700 text-xs"
              title="Discard changes and start a new estimate"
            >
              + New Estimate
            </Btn>
          )}
          <Inp
            value={estName}
            onChange={(e) => setEstName(e.target.value)}
            className="w-52"
            placeholder="Estimate name"
          />
          <Btn onClick={() => saveEst("Draft")} disabled={saving} className="bg-slate-700">
            {saving ? "Saving..." : editingId ? "Update Draft" : "Save Draft"}
          </Btn>
          <Btn onClick={() => saveEst("Sent")} disabled={saving} className="bg-blue-700 hover:bg-blue-600">
            {saving ? "Saving..." : "Mark Sent"}
          </Btn>
          <Btn onClick={() => saveEst("Approved")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
            {saving ? "Saving..." : "Approve → Job"}
          </Btn>
        </div>
      </div>

      {/* CLIENT + JOB LINK */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
            Link to Client & Job
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-slate-400">Client</label>
                <button
                  type="button"
                  onClick={() => setShowClientAddModal(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                  title="Add a new client without leaving this estimate"
                >
                  <Plus className="w-3 h-3" /> New Client
                </button>
              </div>
              <Sel value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                <option value="">— No client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Sel>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Existing Job (optional)</label>
              <Sel value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
                <option value="">— No job / will create new —</option>
                {jobs
                  .filter((j) => !selectedClientId || j.client_id === selectedClientId)
                  .map((j) => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
              </Sel>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PROPOSAL DETAILS */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
            Proposal Details
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Project Address</label>
              <Inp
                placeholder="123 Main St, Muskegon MI"
                value={projectAddress}
                onChange={(e) => setProjectAddress(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Estimated Duration (weeks)</label>
              <Inp
                type="number" min="1" max="52"
                value={estimatedWeeks}
                onChange={(e) => setEstimatedWeeks(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-slate-400">
                Scope of Work (client-facing)
              </label>
              <button
                type="button"
                onClick={async () => {
                  if (scopeOfWork.trim()) {
                    const ok = await confirm({
                      title: "Replace current scope?",
                      message: "This will replace what you've written with the template starter text.",
                      confirmText: "Replace",
                    });
                    if (!ok) return;
                  }
                  setScopeOfWork(
                    "PROJECT OVERVIEW:\n" +
                    "Brief description of what we're building or improving for the client.\n\n" +
                    "WORK TO BE PERFORMED:\n" +
                    "• Demo and site preparation\n" +
                    "• Specific work item #1\n" +
                    "• Specific work item #2\n" +
                    "• Cleanup and final walkthrough\n\n" +
                    "MATERIALS & FINISHES:\n" +
                    "Standard-grade materials sourced from approved suppliers. " +
                    "Specific finish selections to be confirmed with client prior to ordering.\n\n" +
                    "NOTES:\n" +
                    "All work performed per Michigan Residential Building Code. " +
                    "Permits pulled by Northshore where required."
                  );
                }}
                className="text-xs text-amber-400 hover:text-amber-300 underline"
              >
                Use Template
              </button>
            </div>
            <textarea
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              rows={6}
              placeholder="Click 'Use Template' for a structured starting point, or write your own scope. Be specific — homeowners trust contractors who clearly describe what they're doing."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
            <p className="text-xs text-slate-600 mt-1">
              Tip: A clear scope is the #1 reason proposals get accepted. Take an extra 2 minutes here.
            </p>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Exclusions</label>
            <textarea
              value={exclusionsText}
              onChange={(e) => setExclusionsText(e.target.value)}
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>
        </CardContent>
      </Card>

      {/* QUICK ASSEMBLIES */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
            Quick Add Assemblies
          </p>
          <div className="flex flex-wrap gap-2">
            {ASSEMBLIES.map((a) => (
              <Btn
                key={a.name}
                onClick={() => addAssembly(a)}
                className="bg-slate-800 hover:bg-slate-700 text-sm py-1.5"
              >
                + {a.name}
              </Btn>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* TABS + SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="Materials">Materials ({materials.length})</TabsTrigger>
              <TabsTrigger value="Labor">Labor ({labor.length})</TabsTrigger>
              <TabsTrigger value="Adjustments">Adjustments</TabsTrigger>
            </TabsList>

            {/* MATERIALS TAB */}
            <TabsContent value="Materials">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Inp
                      placeholder="Material name"
                      value={mName}
                      onChange={(e) => setMName(e.target.value)}
                      className="col-span-2"
                    />
                    <Inp
                      placeholder="Unit cost $"
                      type="number"
                      value={mCost}
                      onChange={(e) => setMCost(e.target.value)}
                    />
                    <Inp
                      placeholder="Qty"
                      type="number"
                      value={mQty}
                      onChange={(e) => setMQty(e.target.value)}
                    />
                    <Btn
                      onClick={addMat}
                      className="bg-amber-400 text-black hover:bg-amber-500 col-span-2 md:col-span-4"
                    >
                      Add Material
                    </Btn>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
                        <th className="py-2 font-medium">Name</th>
                        <th className="font-medium">Cost</th>
                        <th className="font-medium">Qty</th>
                        <th className="font-medium">Total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((m) => (
                        <tr key={m.id} className="border-b border-slate-800/50">
                          <td className="py-2 text-slate-200">{m.name}</td>
                          <td className="text-slate-400">{currency(m.cost)}</td>
                          <td className="text-slate-400">{m.qty}</td>
                          <td className="text-slate-200 font-medium">{currency(m.cost * m.qty)}</td>
                          <td className="text-right">
                            <Btn
                              onClick={() => setMaterials((x) => x.filter((x) => x.id !== m.id))}
                              className="text-xs py-1 px-2 bg-slate-900"
                            >
                              ✕
                            </Btn>
                          </td>
                        </tr>
                      ))}
                      {materials.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-slate-600 text-center">
                            No materials yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* LABOR TAB */}
            <TabsContent value="Labor">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Inp
                      placeholder="Task description"
                      value={lTask}
                      onChange={(e) => setLTask(e.target.value)}
                      className="col-span-2"
                    />
                    <Inp
                      placeholder={`Rate $/hr (default $${settings.laborRate || 95})`}
                      type="number"
                      value={lRate}
                      onChange={(e) => setLRate(e.target.value)}
                    />
                    <Inp
                      placeholder="Hours"
                      type="number"
                      value={lHours}
                      onChange={(e) => setLHours(e.target.value)}
                    />
                    <Btn
                      onClick={addLab}
                      className="bg-amber-400 text-black hover:bg-amber-500 col-span-2 md:col-span-4"
                    >
                      Add Labor
                    </Btn>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
                        <th className="py-2 font-medium">Task</th>
                        <th className="font-medium">Rate</th>
                        <th className="font-medium">Hours</th>
                        <th className="font-medium">Total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {labor.map((l) => (
                        <tr key={l.id} className="border-b border-slate-800/50">
                          <td className="py-2 text-slate-200">{l.task}</td>
                          <td className="text-slate-400">{currency(l.rate)}/hr</td>
                          <td className="text-slate-400">{l.hours}h</td>
                          <td className="text-slate-200 font-medium">{currency(l.rate * l.hours)}</td>
                          <td className="text-right">
                            <Btn
                              onClick={() => setLabor((x) => x.filter((x) => x.id !== l.id))}
                              className="text-xs py-1 px-2 bg-slate-900"
                            >
                              ✕
                            </Btn>
                          </td>
                        </tr>
                      ))}
                      {labor.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-slate-600 text-center">
                            No labor yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ADJUSTMENTS TAB */}
            <TabsContent value="Adjustments">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Contingency %</label>
                      <Inp
                        type="number"
                        value={contingencyPct}
                        onChange={(e) => setContingencyPct(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Flat Fees ($)</label>
                      <Inp
                        type="number"
                        value={fees}
                        onChange={(e) => setFees(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Discount ($)</label>
                      <Inp
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="bg-amber-900/20 rounded-lg p-3 border border-amber-900/40">
                    <p className="text-xs text-amber-400/90 font-medium mb-1">
                      Michigan Sales Tax — Important
                    </p>
                    <p className="text-xs text-slate-500">
                      Per Michigan law (RAB 2025-18), contractors pay sales tax when purchasing
                      materials and do NOT add a sales tax line to client proposals for real
                      property improvements. Tax is absorbed into your material cost pricing.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* SUMMARY SIDEBAR */}
        <div className="space-y-4">
          <Card className="border-amber-900/30">
            <CardContent className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                Estimate Summary
              </p>
              <p className="text-slate-300 font-medium text-sm mb-1 truncate">{estName}</p>
              {selectedClientId && (
                <p className="text-slate-500 text-xs mb-3">
                  {clients.find((c) => c.id === selectedClientId)?.name}
                </p>
              )}
              <div className="space-y-1.5">
                {lineItems.map((li) => (
                  <div
                    key={li.label}
                    className={`flex justify-between text-sm ${
                      li.bold
                        ? "font-semibold text-slate-200 border-t border-slate-700 pt-1.5 mt-1.5"
                        : "text-slate-400"
                    }`}
                  >
                    <span>{li.label}</span>
                    <span className={li.bold ? "text-slate-200" : "text-slate-300"}>
                      {li.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-amber-900/50">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-semibold">Grand Total</span>
                  <span className="text-2xl font-bold text-amber-400">{currency(grandTotal)}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Btn
                  onClick={() => saveEst("Draft")}
                  disabled={saving}
                  className="w-full bg-slate-700 text-sm"
                >
                  {saving ? "Saving..." : "Save Draft"}
                </Btn>
                <Btn
                  onClick={() => saveEst("Approved")}
                  disabled={saving}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-sm"
                >
                  Approve → Create Job
                </Btn>
              </div>
            </CardContent>
          </Card>

          {/* SAVED ESTIMATES */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">
                  Saved Estimates ({savedEstimates.length})
                </p>
                {editingId && (
                  <button
                    onClick={resetForm}
                    className="text-xs text-amber-400 hover:text-amber-300"
                    title="Clear form to start a new estimate"
                  >
                    + New
                  </button>
                )}
              </div>

              {/* FILTER + SEARCH */}
              {savedEstimates.length > 3 && (
                <div className="space-y-2 mb-3">
                  <Inp
                    placeholder="Search by name or client..."
                    value={estSearch}
                    onChange={(e) => setEstSearch(e.target.value)}
                    className="text-xs py-1.5"
                  />
                  <div className="flex flex-wrap gap-1">
                    {["All", "Draft", "Sent", "Approved", "Lost"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setEstFilter(f)}
                        className={`text-[10px] px-2 py-1 rounded border ${
                          estFilter === f
                            ? "bg-amber-400 text-black border-amber-400"
                            : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(() => {
                  const filtered = savedEstimates.filter((e) => {
                    if (estFilter !== "All" && e.status !== estFilter) return false;
                    if (estSearch.trim()) {
                      const q = estSearch.toLowerCase();
                      const cliName = clients.find((c) => c.id === e.client_id)?.name?.toLowerCase() || "";
                      if (!e.name?.toLowerCase().includes(q) && !cliName.includes(q)) return false;
                    }
                    return true;
                  });

                  if (savedEstimates.length === 0) {
                    return (
                      <div className="py-6 text-center">
                        <p className="text-slate-600 text-xs mb-1">No estimates yet</p>
                        <p className="text-slate-700 text-[10px]">
                          Build one above and save to get started
                        </p>
                      </div>
                    );
                  }
                  if (filtered.length === 0) {
                    return (
                      <p className="text-slate-600 text-xs text-center py-4">
                        No estimates match your filter
                      </p>
                    );
                  }

                  return filtered.map((e) => {
                    const estClient = clients.find((c) => c.id === e.client_id);
                    const isEditing = editingId === e.id;
                    return (
                      <div
                        key={e.id}
                        className={`text-xs py-2 px-2 rounded border transition-all ${
                          isEditing
                            ? "border-amber-500 bg-amber-900/10"
                            : "border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex justify-between items-center gap-2 mb-1">
                          <div className="min-w-0 flex-1">
                            <p className="text-slate-200 truncate font-medium">{e.name}</p>
                            {estClient && (
                              <p className="text-slate-600 text-[10px] truncate">{estClient.name}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-amber-400 font-semibold">{currency(e.grand_total)}</span>
                            <Badge
                              label={e.status}
                              color={
                                e.status === "Approved" ? "green" :
                                e.status === "Sent"     ? "yellow" :
                                e.status === "Lost"     ? "red" : "gray"
                              }
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-2">
                          <button
                            onClick={() => handleGenerateProposal(e)}
                            className="flex-1 text-[11px] py-1.5 px-2 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-900/30 rounded flex items-center justify-center gap-1 transition-colors"
                            title="Generate PDF Proposal"
                          >
                            <FileText className="w-3 h-3" /> PDF
                          </button>
                          {e.status === "Approved" && (
                            <button
                              onClick={() => handleGenerateContract(e)}
                              className="flex-1 text-[11px] py-1.5 px-2 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20 border border-emerald-900/30 rounded flex items-center justify-center gap-1 transition-colors"
                              title="Generate binding contract from this approved estimate"
                            >
                              <FileText className="w-3 h-3" /> Contract
                            </button>
                          )}
                          <button
                            onClick={() => loadEstimate(e)}
                            disabled={isEditing}
                            className={`text-[11px] py-1.5 px-2 rounded border flex items-center gap-1 transition-colors ${
                              isEditing
                                ? "bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed"
                                : "bg-blue-900/20 text-blue-300 hover:bg-blue-900/40 border-blue-900/40"
                            }`}
                            title={isEditing ? "Currently editing" : "Edit this estimate"}
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => duplicateEstimate(e)}
                            className="text-[11px] py-1.5 px-2 bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 rounded flex items-center transition-colors"
                            title="Duplicate as new draft"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <select
                            value={e.status}
                            onChange={(ev) => updateEstimateStatus(e, ev.target.value)}
                            className="text-[11px] py-1.5 px-1.5 bg-slate-900 text-slate-300 border border-slate-700 rounded"
                            title="Change status"
                          >
                            {["Draft", "Sent", "Approved", "Lost"].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => deleteEstimate(e)}
                            className="text-[11px] py-1.5 px-2 bg-rose-900/20 text-rose-400 hover:bg-rose-900/40 border border-rose-900/40 rounded flex items-center transition-colors"
                            title="Delete permanently"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick-Add Client modal — rendered inside Estimator so closing it
          preserves all in-flight estimate state */}
      <ClientQuickAddModal
        isOpen={showClientAddModal}
        onClose={() => setShowClientAddModal(false)}
        onClientAdded={handleClientAdded}
      />
    </div>
  );
}

// ================================================================
// JOB OPERATIONS
// Punch list, material deliveries, photos sub-component for Jobs
// ================================================================
function JobOperations({ job, jobPhotos, dailyLogs, setJobPhotos, settings, allJobs, timeEntries, setTimeEntries, activeTimeEntry, client, invoices, setInvoices, invoicePayments, setInvoicePayments, lienWaivers, setLienWaivers, swornStatements, setSwornStatements, jobSubs, setJobSubs, materialDeliveriesParent = [], setMaterialDeliveriesParent }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [opsTab, setOpsTab] = useState("Punch");
  const [punchList, setPunchList] = useState([]);
  // v1.3.2 — Deliveries now derived from lifted parent state. Single source
  // of truth = no risk of local-vs-global drift after add/edit/delete.
  const deliveries = (materialDeliveriesParent || [])
    .filter((d) => d.job_id === job.id)
    .sort((a, b) => (a.expected_date || "").localeCompare(b.expected_date || ""));
  const [loadingOps, setLoadingOps] = useState(true);

  // Punch form
  const [pItem, setPItem] = useState("");
  const [pPriority, setPPriority] = useState("Medium");

  // Delivery form
  const [dSupplier, setDSupplier] = useState("");
  const [dItem, setDItem] = useState("");
  const [dQty, setDQty] = useState("");
  const [dExpectedDate, setDExpectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [dCost, setDCost] = useState("");

  // Load punch when this job opens. Deliveries come from lifted parent state.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingOps(true);
      const { data: punchData } = await supabase
        .from("punch_list")
        .select("*")
        .eq("job_id", job.id)
        .order("created_at");
      if (!alive) return;
      setPunchList(punchData || []);
      setLoadingOps(false);
    })();
    return () => { alive = false; };
  }, [job.id]);

  const addPunch = useCallback(async () => {
    if (!pItem.trim()) return;
    const { data, error } = await supabase
      .from("punch_list")
      .insert({
        job_id: job.id,
        item: pItem,
        category: pPriority || null,
        completed: false,
      })
      .select()
      .single();
    if (!error && data) {
      setPunchList((p) => [...p, data]);
      setPItem("");
      toast.success("Punch item added");
    } else {
      toast.error("Add failed: " + (error?.message || "Unknown error"));
    }
  }, [job.id, pItem, pPriority, toast]);

  const togglePunch = useCallback(async (item) => {
    // v1.4 — Optimistic update: flip the UI immediately, reconcile after.
    // Punch toggles are the highest-frequency action in the field; a
    // 200-300ms round-trip felt laggy. Flip first, rollback if Postgres rejects.
    const newCompleted = !item.completed;
    setPunchList((p) => p.map((x) => (x.id === item.id ? { ...x, completed: newCompleted } : x)));
    const { data, error } = await supabase
      .from("punch_list")
      .update({ completed: newCompleted })
      .eq("id", item.id)
      .select()
      .single();
    if (error) {
      // Rollback on failure
      setPunchList((p) => p.map((x) => (x.id === item.id ? { ...x, completed: item.completed } : x)));
      toast.error("Failed to update: " + error.message);
    } else if (data) {
      // Reconcile with the canonical row from server
      setPunchList((p) => p.map((x) => (x.id === data.id ? data : x)));
    }
  }, [toast]);

  const deletePunch = useCallback(async (item) => {
    const ok = await confirm({
      title: "Delete punch item?",
      message: `"${item.item}" will be permanently removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("punch_list").delete().eq("id", item.id);
    if (!error) {
      setPunchList((p) => p.filter((x) => x.id !== item.id));
      toast.success("Punch item deleted");
    }
  }, [confirm, toast]);

  const addDelivery = useCallback(async () => {
    if (!dSupplier.trim() || !dItem.trim()) return;
    const { data, error } = await supabase
      .from("material_deliveries")
      .insert({
        job_id: job.id,
        supplier: dSupplier,
        description: dItem,
        quantity: dQty || null,
        expected_date: dExpectedDate,
        cost: parseFloat(dCost) || null,
        status: "Ordered",
      })
      .select()
      .single();
    if (!error && data) {
      // v1.3.2 — Single source of truth: parent state only.
      if (setMaterialDeliveriesParent) {
        setMaterialDeliveriesParent((all) => [data, ...all]);
      }
      setDSupplier(""); setDItem(""); setDQty(""); setDCost("");
      toast.success("Delivery added");
    } else {
      toast.error("Add failed: " + (error?.message || "Unknown error"));
    }
  }, [job.id, dSupplier, dItem, dQty, dExpectedDate, dCost, toast, setMaterialDeliveriesParent]);

  const updateDeliveryStatus = useCallback(async (del, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === "Delivered" && !del.delivered_date) {
      updates.delivered_date = new Date().toISOString().slice(0, 10);
    }
    const { data, error } = await supabase
      .from("material_deliveries")
      .update(updates)
      .eq("id", del.id)
      .select()
      .single();
    if (!error && data) {
      if (setMaterialDeliveriesParent) {
        setMaterialDeliveriesParent((all) => all.map((x) => (x.id === data.id ? data : x)));
      }
      toast.success(`Marked ${newStatus}`);
    }
  }, [toast, setMaterialDeliveriesParent]);

  const deleteDelivery = useCallback(async (del) => {
    const ok = await confirm({
      title: "Delete delivery record?",
      message: `${del.supplier} — ${del.description} will be removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("material_deliveries").delete().eq("id", del.id);
    if (!error) {
      if (setMaterialDeliveriesParent) {
        setMaterialDeliveriesParent((all) => all.filter((x) => x.id !== del.id));
      }
      toast.success("Delivery deleted");
    }
  }, [confirm, toast, setMaterialDeliveriesParent]);

  const openPunch = punchList.filter((p) => !p.completed);
  const completedPunch = punchList.filter((p) => p.completed);
  const pendingDeliveries = deliveries.filter((d) => d.status !== "Delivered");

  // Time entries scoped to THIS job
  const jobTimeEntries = (timeEntries || []).filter((t) => t.job_id === job.id);
  const completedTimeEntries = jobTimeEntries.filter((t) => t.duration_minutes != null);
  const totalMinutes = completedTimeEntries.reduce((s, t) => s + (t.duration_minutes || 0), 0);
  const laborRate = Number(settings.laborRate) || 95;
  const laborCost = (totalMinutes / 60) * laborRate;

  // Manual entry / edit state
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [timeModalEntry, setTimeModalEntry] = useState(null); // null = create, entry = edit

  const handleTimeSave = useCallback(async (payload) => {
    if (timeModalEntry) {
      // Edit existing
      const { data, error } = await supabase
        .from("time_entries")
        .update(payload)
        .eq("id", timeModalEntry.id)
        .select()
        .single();
      if (!error && data) {
        setTimeEntries((prev) => prev.map((t) => (t.id === data.id ? data : t)));
        toast.success("Time entry updated");
        setTimeModalOpen(false);
      } else {
        toast.error("Update failed: " + (error?.message || "Unknown error"));
      }
    } else {
      // Create new manual entry — needs job_id + user fields
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Not signed in");
        return;
      }
      const { data, error } = await supabase
        .from("time_entries")
        .insert({
          ...payload,
          job_id: job.id,
          user_id: session.user.id,
          user_email: session.user.email,
        })
        .select()
        .single();
      if (!error && data) {
        setTimeEntries((prev) => [data, ...prev]);
        toast.success("Time entry added");
        setTimeModalOpen(false);
      } else {
        toast.error("Add failed: " + (error?.message || "Unknown error"));
      }
    }
  }, [timeModalEntry, job.id, setTimeEntries, toast]);

  const handleTimeDelete = useCallback(async (entry) => {
    const { error } = await supabase.from("time_entries").delete().eq("id", entry.id);
    if (!error) {
      setTimeEntries((prev) => prev.filter((t) => t.id !== entry.id));
      toast.success("Entry deleted");
      setTimeModalOpen(false);
    }
  }, [setTimeEntries, toast]);

  return (
    <div className="space-y-3">
      <Tabs value={opsTab} onValueChange={setOpsTab}>
        <TabsList>
          <TabsTrigger value="Punch">
            Punch List ({openPunch.length})
          </TabsTrigger>
          <TabsTrigger value="Deliveries">
            Deliveries ({pendingDeliveries.length})
          </TabsTrigger>
          <TabsTrigger value="Photos">
            Photos
          </TabsTrigger>
          <TabsTrigger value="Time">
            Time ({formatDuration(totalMinutes)})
          </TabsTrigger>
          <TabsTrigger value="Documents">
            Documents
          </TabsTrigger>
        </TabsList>

        {/* PUNCH LIST */}
        <TabsContent value="Punch">
          <Card>
            <CardContent className="p-4">
              {loadingOps ? <Spinner /> : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-4">
                    <Inp
                      placeholder="Punch item description..."
                      value={pItem}
                      onChange={(e) => setPItem(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPunch()}
                      className="md:col-span-7"
                    />
                    <Sel
                      value={pPriority}
                      onChange={(e) => setPPriority(e.target.value)}
                      className="md:col-span-3"
                    >
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </Sel>
                    <Btn
                      onClick={addPunch}
                      className="bg-amber-400 text-black hover:bg-amber-500 md:col-span-2"
                    >
                      Add
                    </Btn>
                  </div>

                  {openPunch.length === 0 && completedPunch.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-6">
                      No punch items. Add the first one above.
                    </p>
                  )}

                  {openPunch.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                        Open Items ({openPunch.length})
                      </p>
                      <div className="space-y-1.5">
                        {openPunch.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg"
                          >
                            <button
                              onClick={() => togglePunch(item)}
                              className="w-5 h-5 border-2 border-slate-600 hover:border-emerald-500 rounded transition-colors shrink-0"
                              title="Mark complete"
                            />
                            <span className="text-slate-200 text-sm flex-1">{item.item}</span>
                            {item.category && (
                              <Badge
                                label={item.category}
                                color={
                                  item.category === "High"   ? "red" :
                                  item.category === "Medium" ? "yellow" : "gray"
                                }
                              />
                            )}
                            <button
                              onClick={() => deletePunch(item)}
                              className="text-slate-600 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {completedPunch.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                        Completed ({completedPunch.length})
                      </p>
                      <div className="space-y-1.5">
                        {completedPunch.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-900/30 border border-slate-800/60 rounded-lg opacity-60"
                          >
                            <button
                              onClick={() => togglePunch(item)}
                              className="w-5 h-5 bg-emerald-600 border-2 border-emerald-500 rounded flex items-center justify-center shrink-0"
                              title="Mark incomplete"
                            >
                              <Check className="w-3 h-3 text-white" />
                            </button>
                            <span className="text-slate-400 text-sm flex-1 line-through">{item.item}</span>
                            <button
                              onClick={() => deletePunch(item)}
                              className="text-slate-700 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MATERIAL DELIVERIES */}
        <TabsContent value="Deliveries">
          <Card>
            <CardContent className="p-4">
              {loadingOps ? <Spinner /> : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-4">
                    <Inp
                      placeholder="Supplier (e.g. Menards)"
                      value={dSupplier}
                      onChange={(e) => setDSupplier(e.target.value)}
                      className="md:col-span-3"
                    />
                    <Inp
                      placeholder="Item / description"
                      value={dItem}
                      onChange={(e) => setDItem(e.target.value)}
                      className="md:col-span-3"
                    />
                    <Inp
                      placeholder="Qty"
                      value={dQty}
                      onChange={(e) => setDQty(e.target.value)}
                      className="md:col-span-1"
                    />
                    <Inp
                      type="date"
                      value={dExpectedDate}
                      onChange={(e) => setDExpectedDate(e.target.value)}
                      className="md:col-span-2"
                    />
                    <Inp
                      type="number"
                      placeholder="Cost $"
                      value={dCost}
                      onChange={(e) => setDCost(e.target.value)}
                      className="md:col-span-2"
                    />
                    <Btn
                      onClick={addDelivery}
                      className="bg-amber-400 text-black hover:bg-amber-500 md:col-span-1"
                    >
                      Add
                    </Btn>
                  </div>

                  {deliveries.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-6">
                      No deliveries tracked. Add the first one above.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {deliveries.map((d) => {
                        const overdue =
                          d.status !== "Delivered" &&
                          new Date(d.expected_date) < new Date(new Date().toDateString());
                        return (
                          <div
                            key={d.id}
                            className={`px-3 py-2.5 rounded-lg border flex items-center gap-3 ${
                              overdue
                                ? "bg-rose-900/20 border-rose-800/50"
                                : d.status === "Delivered"
                                  ? "bg-slate-900/30 border-slate-800/60 opacity-70"
                                  : "bg-slate-900/60 border-slate-800"
                            }`}
                          >
                            <Truck className={`w-4 h-4 shrink-0 ${
                              overdue ? "text-rose-400" :
                              d.status === "Delivered" ? "text-emerald-400" : "text-slate-400"
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-baseline gap-2">
                                <span className="text-slate-200 text-sm font-medium">{d.supplier}</span>
                                <span className="text-slate-400 text-sm">— {d.description}</span>
                                {d.quantity && <span className="text-slate-500 text-xs">×{d.quantity}</span>}
                                {d.cost && (
                                  <span className="text-amber-400/70 text-xs">{currency(d.cost)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs mt-0.5">
                                <span className={overdue ? "text-rose-400" : "text-slate-500"}>
                                  {overdue && "OVERDUE — "}
                                  Expected {formatDate(d.expected_date)}
                                </span>
                                {d.delivered_date && (
                                  <span className="text-emerald-400">
                                    Delivered {formatDate(d.delivered_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Sel
                              value={d.status}
                              onChange={(e) => updateDeliveryStatus(d, e.target.value)}
                              className="w-32 text-xs py-1"
                            >
                              <option>Ordered</option>
                              <option>In Transit</option>
                              <option>Delivered</option>
                              <option>Backordered</option>
                            </Sel>
                            <button
                              onClick={() => deleteDelivery(d)}
                              className="text-slate-600 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PHOTOS */}
        <TabsContent value="Photos">
          <Card>
            <CardContent className="p-4 space-y-4">
              <PhotoUploader
                jobId={job.id}
                onUploaded={(p) => setJobPhotos((prev) => [p, ...prev])}
              />
              <PhotoGallery
                photos={jobPhotos.filter((p) => p.job_id === job.id)}
                onDelete={async (photo) => {
                  const ok = await confirm({
                    title: "Delete photo?",
                    message: "This will remove the photo permanently.",
                    confirmText: "Delete",
                    danger: true,
                  });
                  if (!ok) return;
                  // Delete from storage
                  if (photo.storage_path) {
                    await supabase.storage.from("job-photos").remove([photo.storage_path]);
                  }
                  await supabase.from("job_photos").delete().eq("id", photo.id);
                  setJobPhotos((prev) => prev.filter((p) => p.id !== photo.id));
                  toast.success("Photo deleted");
                }}
                onUpdate={async (photoId, updates) => {
                  // v1.3.2 — Inline caption/phase edits in timeline view
                  const { data, error } = await supabase
                    .from("job_photos")
                    .update(updates)
                    .eq("id", photoId)
                    .select()
                    .single();
                  if (error) {
                    toast.error("Update failed: " + error.message);
                    return false;
                  }
                  // Preserve the in-memory `url` (derived, not stored)
                  setJobPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...data, url: p.url } : p)));
                  return true;
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TIME TRACKING — per-job time history with manual add/edit */}
        <TabsContent value="Time">
          <Card>
            <CardContent className="p-4">
              {/* Summary header */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Total Hours</p>
                  <p className="text-xl font-bold text-amber-400 tabular-nums">{formatDuration(totalMinutes)}</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Entries</p>
                  <p className="text-xl font-bold text-slate-100 tabular-nums">{completedTimeEntries.length}</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Labor Cost</p>
                  <p className="text-xl font-bold text-emerald-400 tabular-nums">{currency(laborCost)}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">@ {currency(laborRate)}/hr</p>
                </div>
              </div>

              {/* Active session callout */}
              {activeTimeEntry && activeTimeEntry.job_id === job.id && (
                <div className="mb-3 px-3 py-2 bg-emerald-900/30 border border-emerald-700/50 rounded-lg flex items-center gap-2 text-emerald-200 text-sm">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  Currently clocked in to this job. Use the timer chip in the header to clock out.
                </div>
              )}

              {/* Add manual entry */}
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">
                  History ({jobTimeEntries.length})
                </p>
                <button
                  onClick={() => { setTimeModalEntry(null); setTimeModalOpen(true); }}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                  title="Add a past time entry (for missed clock-ins)"
                >
                  <Plus className="w-3 h-3" /> Manual Entry
                </button>
              </div>

              {jobTimeEntries.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">
                  No time logged yet. Use the clock chip in the header to start, or add a manual entry above.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {jobTimeEntries.map((entry) => {
                    const ci = new Date(entry.clock_in);
                    const isActive = entry.clock_out == null;
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                          isActive
                            ? "bg-emerald-900/20 border-emerald-700/50"
                            : "bg-slate-900/60 border-slate-800"
                        }`}
                      >
                        <Clock className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-2 text-sm">
                            <span className="text-slate-200 font-medium">
                              {ci.toLocaleDateString([], { month: "short", day: "numeric" })}
                            </span>
                            <span className="text-slate-500 text-xs">
                              {ci.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                              {entry.clock_out && ` — ${new Date(entry.clock_out).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                            </span>
                            {entry.user_email && (
                              <span className="text-slate-600 text-xs truncate">
                                {entry.user_email.split("@")[0]}
                              </span>
                            )}
                          </div>
                          {entry.notes && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{entry.notes}</p>
                          )}
                        </div>
                        <span className={`text-sm font-mono tabular-nums shrink-0 ${
                          isActive ? "text-emerald-400" : "text-amber-400"
                        }`}>
                          {isActive ? "running" : formatDuration(entry.duration_minutes)}
                        </span>
                        {!isActive && (
                          <button
                            onClick={() => { setTimeModalEntry(entry); setTimeModalOpen(true); }}
                            className="text-slate-600 hover:text-amber-400 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTS — invoices, lien waivers, sworn statements */}
        <TabsContent value="Documents">
          <JobDocuments
            job={job}
            client={client}
            settings={settings}
            invoices={invoices}
            setInvoices={setInvoices}
            invoicePayments={invoicePayments}
            setInvoicePayments={setInvoicePayments}
            lienWaivers={lienWaivers}
            setLienWaivers={setLienWaivers}
            swornStatements={swornStatements}
            setSwornStatements={setSwornStatements}
            jobSubs={jobSubs}
            setJobSubs={setJobSubs}
          />
        </TabsContent>
      </Tabs>

      {/* Manual time entry modal — shared by Add and Edit */}
      <ManualTimeEntryModal
        isOpen={timeModalOpen}
        jobId={job.id}
        jobName={job.name}
        existingEntry={timeModalEntry}
        onClose={() => setTimeModalOpen(false)}
        onSave={handleTimeSave}
        onDelete={handleTimeDelete}
      />
    </div>
  );
}
function Jobs({ jobs, setJobs, clients, jobPhotos, setJobPhotos, dailyLogs, settings, estimates, timeEntries, setTimeEntries, activeTimeEntry, invoices, setInvoices, invoicePayments, setInvoicePayments, lienWaivers, setLienWaivers, swornStatements, setSwornStatements, jobSubs, setJobSubs, materialDeliveries = [], setMaterialDeliveries }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [clientId, setClientId] = useState("");
  const [expandedJobId, setExpandedJobId] = useState(null);
  // v1.3 — filter + search persist across tab switches via localStorage
  const [filter, setFilter] = useState(() => {
    try { return localStorage.getItem("northshore_jobs_filter") || "Active"; }
    catch { return "Active"; }
  });
  const [search, setSearch] = useState(() => {
    try { return localStorage.getItem("northshore_jobs_search") || ""; }
    catch { return ""; }
  });
  useEffect(() => {
    try { localStorage.setItem("northshore_jobs_filter", filter); } catch (e) { /* quota or disabled */ }
  }, [filter]);
  useEffect(() => {
    try { localStorage.setItem("northshore_jobs_search", search); } catch (e) { /* quota or disabled */ }
  }, [search]);

  // Change order form (per-job, lifted state)
  const [coDescription, setCoDescription] = useState("");
  const [coAmount, setCoAmount] = useState("");

  const addJob = useCallback(async () => {
    if (!name.trim()) return;
    const { data, error } = await supabase
      .from("jobs")
      .insert({
        name,
        status: "Active",
        budget: parseFloat(budget) || 0,
        actual: 0,
        client_id: clientId || null,
      })
      .select()
      .single();
    if (!error && data) {
      setJobs((j) => [data, ...j]);
      setName(""); setBudget(""); setClientId("");
      toast.success("Job created");
    } else {
      toast.error("Add failed: " + (error?.message || "Unknown error"));
    }
  }, [name, budget, clientId, setJobs, toast]);

  const updateJob = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (!error && data) {
      setJobs((js) => js.map((j) => (j.id === data.id ? data : j)));
    } else {
      toast.error("Update failed: " + (error?.message || "Unknown error"));
    }
  }, [setJobs, toast]);

  const deleteJob = useCallback(async (job) => {
    const ok = await confirm({
      title: "Delete this job?",
      message: `"${job.name}" will be permanently deleted along with all linked daily logs, photos, punch list items, and material delivery records. This cannot be undone.`,
      confirmText: "Delete Job",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("jobs").delete().eq("id", job.id);
    if (!error) {
      setJobs((j) => j.filter((x) => x.id !== job.id));
      toast.success("Job deleted");
    } else {
      toast.error("Delete failed: " + error.message);
    }
  }, [confirm, setJobs, toast]);

  // ============================================================
  // PHASE 4 — MARK CONTRACT SIGNED
  // This is the trigger for the documents-as-state-machine.
  // Signing the contract arms the rest of the system: NOC clock,
  // invoice schedule, daily log expectations, punch list scaffolding.
  // ============================================================
  const markContractSigned = useCallback(async (job) => {
    const ok = await confirm({
      title: "Mark contract as signed?",
      message:
        "This records that the binding contract for this job has been executed by both parties. " +
        "From this point forward the system treats the job as legally active — Notice of Commencement " +
        "clock starts, payment milestones become due as configured, and daily log expectations apply.",
      confirmText: "Yes, Contract Signed",
    });
    if (!ok) return;
    const contractNum = job.contract_number || `NSC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    await updateJob(job.id, {
      contract_signed_at: new Date().toISOString(),
      contract_number: contractNum,
    });
    toast.success(`Contract ${contractNum} marked signed`);
  }, [confirm, updateJob, toast]);

  const clearContractSigned = useCallback(async (job) => {
    const ok = await confirm({
      title: "Clear contract signed status?",
      message: "This will undo the contract-signed state for this job. The contract number will be retained.",
      confirmText: "Clear",
      danger: true,
    });
    if (!ok) return;
    await updateJob(job.id, { contract_signed_at: null });
    toast.success("Contract signed status cleared");
  }, [confirm, updateJob, toast]);

  // v1.3.2 — Mark paid in full / clear. Removes the job from lien
  // tracking widgets (lien rights are moot once payment is complete).
  const markPaidInFull = useCallback(async (job) => {
    const ok = await confirm({
      title: "Mark paid in full?",
      message:
        "Confirm this job has been paid in full. The lien deadline countdown " +
        "will stop tracking it (lien rights only matter for unpaid work). " +
        "You can clear this later if needed.",
      confirmText: "Yes, Paid in Full",
    });
    if (!ok) return;
    await updateJob(job.id, { paid_in_full_at: new Date().toISOString() });
    toast.success("Marked paid in full — lien tracking cleared");
  }, [confirm, updateJob, toast]);

  const clearPaidInFull = useCallback(async (job) => {
    await updateJob(job.id, { paid_in_full_at: null });
    toast.info("Paid status cleared — lien tracking resumed");
  }, [updateJob, toast]);

  // Smart status-change handler — warns if the status change makes the job
  // disappear from the current filter view (the "where did my job go?" footgun)
  const handleStatusChange = useCallback(async (job, newStatus) => {
    // v1.4.1 — Soft warning when marking Complete with no actuals.
    // Catches the "marked done but never logged hours/materials"
    // pattern. Common with family-favor jobs (e.g. grandmother's shed)
    // where you may forget to log because no money's involved.
    // Either way, you want a defensible audit trail.
    if (newStatus === "Completed" && (!job.actual || job.actual === 0)) {
      const ok = await confirm({
        title: "Mark Complete with $0 actual?",
        message:
          `"${job.name}" has no logged hours, materials, or costs. ` +
          "Complete jobs without actuals create gaps in your job-cost history " +
          "(useful for future bidding) and weaken the lien-waiver paper trail. " +
          "\n\nIf this was a $0 favor job, that's fine — confirm to continue. " +
          "Otherwise, log time/materials first, then mark Complete.",
        confirmText: "Mark Complete Anyway",
      });
      if (!ok) return;
    }
    await updateJob(job.id, { status: newStatus });
    if (filter !== "All" && filter !== newStatus) {
      toast.info(
        `"${job.name}" marked ${newStatus} — you're viewing ${filter}, so it's hidden. Click "All" to find it.`,
        7000
      );
    } else {
      toast.success(`Marked ${newStatus}`);
    }
  }, [updateJob, filter, toast, confirm]);

  const handleGenerateChangeOrder = useCallback((job) => {
    if (!coDescription.trim() || !coAmount) {
      toast.error("Description and amount are both required.");
      return;
    }
    const client = clients.find((c) => c.id === job.client_id) || null;
    openChangeOrder(
      job, client,
      { description: coDescription, amount: parseFloat(coAmount) },
      settings, job.budget
    );
    setCoDescription("");
    setCoAmount("");
  }, [coDescription, coAmount, clients, settings, toast]);

  const filteredJobs = jobs.filter((j) => {
    // Defensive guard — skip malformed/null entries instead of crashing the whole tab
    if (!j || typeof j !== "object" || !j.name) return false;
    if (filter !== "All" && j.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const cliName = clients.find((c) => c.id === j.client_id)?.name?.toLowerCase() || "";
      if (!j.name.toLowerCase().includes(q) && !cliName.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-amber-400" />
            Jobs
          </h1>
          <p className="text-slate-500 text-sm mt-1">Track active projects, change orders, contracts</p>
        </div>
      </div>

      {/* QUICK ADD */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Quick Add Job</p>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <Inp
              placeholder="Job name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="md:col-span-5"
            />
            <Sel
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="md:col-span-3"
            >
              <option value="">— No client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Sel>
            <Inp
              placeholder="Budget $"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="md:col-span-2"
            />
            <Btn
              onClick={addJob}
              className="bg-amber-400 text-black hover:bg-amber-500 md:col-span-2"
            >
              <Plus className="w-4 h-4 inline-block mr-1" /> Add
            </Btn>
          </div>
        </CardContent>
      </Card>

      {/* FILTER + SEARCH — always visible so the "where did my job go?" recovery path is never hidden */}
      <div className="flex flex-wrap items-center gap-2">
        <Inp
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {["All", "Active", "Paused", "Completed", "Lost"].map((f) => {
          const count = f === "All" ? jobs.length : jobs.filter((j) => j.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                filter === f
                  ? "bg-amber-400 text-black border-amber-400"
                  : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"
              }`}
            >
              {f} <span className={filter === f ? "opacity-70" : "opacity-50"}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* JOB LIST */}
      {filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <EmptyState
              icon={<Briefcase className="w-10 h-10 text-slate-700" />}
              message={
                jobs.length === 0
                  ? "No jobs yet — fill the form above to create your first job"
                  : `No jobs match "${filter}"${search ? ` and "${search}"` : ""}`
              }
              action={
                jobs.length > 0
                  ? () => { setFilter("All"); setSearch(""); }
                  : null
              }
              actionLabel={jobs.length > 0 ? "Clear filters" : null}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((j) => {
            const expanded = expandedJobId === j.id;
            const client = clients.find((c) => c.id === j.client_id);
            const pct = j.budget ? Math.min(100, ((j.actual || 0) / j.budget) * 100) : 0;
            const burnColor =
              pct < 70 ? "bg-emerald-500" : pct < 90 ? "bg-amber-400" : "bg-rose-500";
            const burnTextColor =
              pct < 70 ? "text-emerald-400" : pct < 90 ? "text-amber-400" : "text-rose-400";
            const contractSigned = !!j.contract_signed_at;
            const linkedEstimate = estimates.find((e) => e.job_id === j.id || e.client_id === j.client_id);
            // v1.2 — Lien deadline (only show badge if within 30d of deadline or expired)
            // v1.3.2 — Now includes material_deliveries from lifted state.
            const lien = (j.status === "Active" || j.status === "Completed")
              ? lienDeadlineFor(j, dailyLogs, timeEntries, materialDeliveries)
              : null;
            const showLienBadge = lien && (lien.urgency !== "safe");
            // v1.3 — Last activity (only show on Active jobs to avoid noise on completed/lost)
            // v1.3.2 — Now includes material_deliveries.
            const lastActive = j.status === "Active"
              ? lastActivityForJob(j, dailyLogs, timeEntries, jobPhotos, materialDeliveries)
              : null;
            const activityDays = daysSinceActivity(lastActive);

            return (
              <Card key={j.id}>
                <CardContent className="p-4">
                  {/* COLLAPSED ROW */}
                  <div
                    className="flex flex-wrap items-center gap-3 cursor-pointer"
                    onClick={() => setExpandedJobId(expanded ? null : j.id)}
                  >
                    <ChevronRight
                      className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-90" : ""}`}
                    />
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-100 font-semibold">{j.name}</span>
                        {contractSigned && (
                          <span title={`Contract ${j.contract_number || ""} signed ${formatDate(j.contract_signed_at)}`}>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </span>
                        )}
                      </div>
                      {client && (
                        <p className="text-slate-500 text-xs">{client.name}</p>
                      )}
                    </div>
                    {j.status === "Active" && activityDays != null && (
                      <span
                        title={lastActive ? `Last activity: ${lastActive.toLocaleDateString()}` : "No activity yet"}
                        className={`text-[10px] px-2 py-1 rounded-md font-medium tabular-nums ${activityBadgeStyle(activityDays)}`}
                      >
                        {activityLabel(activityDays)}
                      </span>
                    )}
                    {showLienBadge && (
                      <span
                        title={`MI Construction Lien Act: 90 days from last labor/material to record. Last labor: ${lien.lastLaborDate.toLocaleDateString()}. Deadline: ${lien.deadlineDate.toLocaleDateString()}.`}
                        className={`text-[10px] px-2 py-1 rounded-md font-semibold tabular-nums ${lienBadgeStyle(lien.urgency)} flex items-center gap-1`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {lienLabel(lien.urgency, lien.daysRemaining)}
                      </span>
                    )}
                    <Badge
                      label={j.status}
                      color={
                        j.status === "Active"    ? "green" :
                        j.status === "Completed" ? "blue"  :
                        j.status === "Paused"    ? "gray"  :
                        j.status === "Lost"      ? "red"   : "gray"
                      }
                    />
                    <div className="text-right min-w-[140px]">
                      <p className="text-amber-400 font-semibold">{currency(j.budget)}</p>
                      <p className="text-xs text-slate-500">
                        {currency(j.actual || 0)} actual ({round2(pct)}%)
                      </p>
                    </div>
                  </div>

                  {/* BURN BAR */}
                  <div className="mt-3">
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${burnColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* EXPANDED PANEL */}
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
                          {/* JOB FIELDS */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <label className="text-xs text-slate-500 uppercase tracking-wider">Status</label>
                              <Sel
                                value={j.status}
                                onChange={(e) => handleStatusChange(j, e.target.value)}
                                className="mt-1"
                              >
                                <option>Active</option>
                                <option>Paused</option>
                                <option>Completed</option>
                                <option>Lost</option>
                              </Sel>
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 uppercase tracking-wider">Budget</label>
                              <Inp
                                type="number"
                                value={j.budget || 0}
                                onChange={(e) => updateJob(j.id, { budget: parseFloat(e.target.value) || 0 })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 uppercase tracking-wider">Actual Spend</label>
                              <Inp
                                type="number"
                                value={j.actual || 0}
                                onChange={(e) => updateJob(j.id, { actual: parseFloat(e.target.value) || 0 })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 uppercase tracking-wider">Burn Rate</label>
                              <p className={`mt-2 text-lg font-bold ${burnTextColor}`}>
                                {round2(pct)}%
                              </p>
                            </div>
                          </div>

                          {/* PHASE 4 — CONTRACT STATUS */}
                          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-3">
                                <FileText className={`w-5 h-5 ${contractSigned ? "text-emerald-400" : "text-slate-500"}`} />
                                <div>
                                  <p className="text-xs text-slate-500 uppercase tracking-wider">Contract Status</p>
                                  {contractSigned ? (
                                    <p className="text-sm text-emerald-300 font-medium mt-0.5">
                                      Signed {formatDate(j.contract_signed_at)}
                                      {j.contract_number && (
                                        <span className="text-slate-500 ml-2">({j.contract_number})</span>
                                      )}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-slate-400 mt-0.5">
                                      No contract signed yet — operational machine inactive.
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {linkedEstimate && linkedEstimate.status === "Approved" && (
                                  <button
                                    onClick={() => {
                                      const client = clients.find((c) => c.id === linkedEstimate.client_id) || null;
                                      const contractNum = j.contract_number || `NSC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
                                      openContract(linkedEstimate, client, settings, contractNum);
                                    }}
                                    className="text-xs py-1.5 px-3 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 border border-amber-900/40 rounded flex items-center gap-1.5 transition-colors"
                                    title="Generate contract PDF from linked approved estimate"
                                  >
                                    <FileText className="w-3.5 h-3.5" /> Generate Contract PDF
                                  </button>
                                )}
                                {!contractSigned ? (
                                  <button
                                    onClick={() => markContractSigned(j)}
                                    className="text-xs py-1.5 px-3 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-700/50 rounded flex items-center gap-1.5 transition-colors"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Contract Signed
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => clearContractSigned(j)}
                                    className="text-xs py-1.5 px-3 bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700 rounded flex items-center gap-1.5 transition-colors"
                                  >
                                    Clear Signed Status
                                  </button>
                                )}
                              </div>
                            </div>
                            {!linkedEstimate && (
                              <p className="text-xs text-slate-600 mt-2 italic">
                                No approved estimate linked to this job. Approve an estimate in the Estimator
                                first to enable contract generation.
                              </p>
                            )}
                          </div>

                          {/* v1.3.2 — PAID IN FULL STATUS (lien tracking control) */}
                          {contractSigned && (
                            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3">
                                  <DollarSign className={`w-5 h-5 ${j.paid_in_full_at ? "text-emerald-400" : "text-slate-500"}`} />
                                  <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider">Payment Status</p>
                                    {j.paid_in_full_at ? (
                                      <p className="text-sm text-emerald-300 font-medium mt-0.5">
                                        Paid in full {formatDate(j.paid_in_full_at)}
                                        <span className="text-slate-500 ml-2">— lien tracking off</span>
                                      </p>
                                    ) : (
                                      <p className="text-sm text-slate-400 mt-0.5">
                                        Not paid in full — lien deadline still tracked.
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {!j.paid_in_full_at ? (
                                    <button
                                      onClick={() => markPaidInFull(j)}
                                      className="text-xs py-1.5 px-3 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-700/50 rounded flex items-center gap-1.5 transition-colors"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid in Full
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => clearPaidInFull(j)}
                                      className="text-xs py-1.5 px-3 bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700 rounded flex items-center gap-1.5 transition-colors"
                                    >
                                      Clear Paid Status
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* CHANGE ORDER GENERATOR */}
                          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <FileEdit className="w-4 h-4" /> Generate Change Order
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                              <textarea
                                placeholder="Describe additional work..."
                                value={coDescription}
                                onChange={(e) => setCoDescription(e.target.value)}
                                rows={2}
                                className="md:col-span-7 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                              />
                              <Inp
                                type="number"
                                placeholder="Amount $"
                                value={coAmount}
                                onChange={(e) => setCoAmount(e.target.value)}
                                className="md:col-span-3"
                              />
                              <Btn
                                onClick={() => handleGenerateChangeOrder(j)}
                                className="bg-amber-400 text-black hover:bg-amber-500 md:col-span-2"
                              >
                                Generate
                              </Btn>
                            </div>
                          </div>

                          {/* OPS (PUNCH / DELIVERIES / PHOTOS / TIME) */}
                          <JobOperations
                            job={j}
                            jobPhotos={jobPhotos}
                            dailyLogs={dailyLogs}
                            setJobPhotos={setJobPhotos}
                            settings={settings}
                            allJobs={jobs}
                            timeEntries={timeEntries}
                            setTimeEntries={setTimeEntries}
                            activeTimeEntry={activeTimeEntry}
                            client={clients.find((c) => c.id === j.client_id)}
                            invoices={invoices}
                            setInvoices={setInvoices}
                            invoicePayments={invoicePayments}
                            setInvoicePayments={setInvoicePayments}
                            lienWaivers={lienWaivers}
                            setLienWaivers={setLienWaivers}
                            swornStatements={swornStatements}
                            setSwornStatements={setSwornStatements}
                            jobSubs={jobSubs}
                            setJobSubs={setJobSubs}
                            setMaterialDeliveriesParent={setMaterialDeliveries}
                          />

                          {/* DELETE JOB */}
                          <div className="pt-3 border-t border-slate-800 flex justify-end">
                            <button
                              onClick={() => deleteJob(j)}
                              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete Job
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================================================================
// CLIENTS
// ================================================================
function Clients({ clients, setClients, jobs, estimates, dailyLogs = [], timeEntries = [], jobPhotos = [], materialDeliveries = [] }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => {
    setEditingId(null);
    setName(""); setEmail(""); setPhone(""); setAddress(""); setNotes("");
  };

  const saveClient = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Client name is required");
      return;
    }
    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      phone: normalizePhone(phone) || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };
    if (editingId) {
      const { data, error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", editingId)
        .select()
        .single();
      if (!error && data) {
        setClients((cs) => cs.map((c) => (c.id === data.id ? data : c)));
        toast.success("Client updated");
        resetForm();
      } else {
        toast.error("Update failed: " + (error?.message || "Unknown error"));
      }
    } else {
      const { data, error } = await supabase
        .from("clients")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setClients((cs) => [data, ...cs]);
        toast.success("Client added");
        resetForm();
      } else {
        toast.error("Add failed: " + (error?.message || "Unknown error"));
      }
    }
  }, [name, email, phone, address, notes, editingId, setClients, toast]);

  const editClient = (c) => {
    setEditingId(c.id);
    setName(c.name || "");
    setEmail(c.email || "");
    setPhone(c.phone || "");
    setAddress(c.address || "");
    setNotes(c.notes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteClient = useCallback(async (client) => {
    const linkedJobs = jobs.filter((j) => j.client_id === client.id);
    const linkedEsts = estimates.filter((e) => e.client_id === client.id);
    let warningDetails = "";
    if (linkedJobs.length > 0 || linkedEsts.length > 0) {
      const parts = [];
      if (linkedJobs.length > 0) parts.push(`${linkedJobs.length} job${linkedJobs.length > 1 ? "s" : ""}`);
      if (linkedEsts.length > 0) parts.push(`${linkedEsts.length} estimate${linkedEsts.length > 1 ? "s" : ""}`);
      warningDetails = `\n\n${parts.join(" and ")} are linked to this client and will keep their reference (relationships preserved).`;
    }
    const ok = await confirm({
      title: "Delete this client?",
      message: `"${client.name}" will be removed from your list.${warningDetails}\n\nYou'll have a few seconds to undo.`,
      confirmText: "Delete Client",
      danger: true,
    });
    if (!ok) return;
    // v1.3.2 — Soft-delete: stamp deleted_at instead of dropping the row.
    // Preserves jobs.client_id and estimates.client_id FK relationships.
    const { error } = await supabase
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", client.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    setClients((cs) => cs.filter((c) => c.id !== client.id));
    if (editingId === client.id) resetForm();
    toast.success("Client deleted", {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: async () => {
          const { error: undoErr } = await supabase
            .from("clients")
            .update({ deleted_at: null })
            .eq("id", client.id);
          if (undoErr) {
            toast.error("Restore failed: " + undoErr.message);
            return;
          }
          // Re-insert into local state — fetch fresh in case row drifted
          const { data: fresh } = await supabase
            .from("clients")
            .select("*")
            .eq("id", client.id)
            .maybeSingle();
          if (fresh) {
            setClients((cs) => [...cs, fresh].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
          }
          toast.info("Client restored");
        },
      },
    });
  }, [jobs, estimates, editingId, setClients, confirm, toast]);

  const filtered = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            Clients
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {clients.length} client{clients.length !== 1 ? "s" : ""} on file
          </p>
        </div>
      </div>

      {/* CLIENT FORM */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              {editingId ? "Edit Client" : "Add New Client"}
            </p>
            {editingId && (
              <button
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-amber-400"
              >
                Cancel
              </button>
            )}
            {/* v1.3.2 — Last-contact + linked-work pill on edit */}
            {editingId && (() => {
              const editingClient = clients.find((c) => c.id === editingId);
              if (!editingClient) return null;
              const lastContact = lastContactForClient(editingClient, jobs, dailyLogs, timeEntries, jobPhotos, materialDeliveries);
              const contactDays = daysSinceActivity(lastContact);
              const cJobs = jobs.filter((j) => j.client_id === editingClient.id);
              const cEsts = estimates.filter((e) => e.client_id === editingClient.id);
              return (
                <div className="ml-auto flex items-center gap-2">
                  {(cJobs.length > 0 || cEsts.length > 0) && (
                    <span className="text-[10px] text-slate-500 tabular-nums">
                      {cJobs.length} job{cJobs.length !== 1 ? "s" : ""} · {cEsts.length} est
                    </span>
                  )}
                  {contactDays != null && (
                    <span
                      title={lastContact ? `Last activity: ${lastContact.toLocaleDateString()}` : ""}
                      className={`text-[10px] px-2 py-1 rounded-md font-medium tabular-nums ${activityBadgeStyle(contactDays)}`}
                    >
                      Last contact: {activityLabel(contactDays)}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            <Inp placeholder="Full name *"  value={name}    onChange={(e) => setName(e.target.value)} />
            <Inp placeholder="Email"        value={email}   onChange={(e) => setEmail(e.target.value)} />
            <Inp placeholder="Phone"        value={phone}   onChange={(e) => setPhone(e.target.value)} />
            <Inp placeholder="Address"      value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full mb-3 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
          <Btn
            onClick={saveClient}
            className="bg-amber-400 text-black hover:bg-amber-500 flex items-center gap-2"
          >
            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? "Update Client" : "Add Client"}
          </Btn>
        </CardContent>
      </Card>

      {/* SEARCH */}
      {clients.length > 5 && (
        <Inp
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      )}

      {/* CLIENT LIST */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <EmptyState
              icon={<Users className="w-10 h-10 text-slate-700" />}
              message={clients.length === 0 ? "No clients yet" : "No clients match your search"}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const cJobs = jobs.filter((j) => j.client_id === c.id);
            const cEsts = estimates.filter((e) => e.client_id === c.id);
            // v1.3 — Last contact across all client's jobs
            // v1.3.2 — Now includes material_deliveries.
            const lastContact = lastContactForClient(c, jobs, dailyLogs, timeEntries, jobPhotos, materialDeliveries);
            const contactDays = daysSinceActivity(lastContact);
            return (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-100 font-semibold truncate">{c.name}</p>
                      {c.address && <p className="text-slate-500 text-xs truncate">{c.address}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => editClient(c)}
                        className="text-slate-500 hover:text-amber-400 p-1 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteClient(c)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* v1.3 last-contact badge — only shown when client has jobs */}
                  {cJobs.length > 0 && contactDays != null && (
                    <div className="mb-3">
                      <span
                        title={lastContact ? `Last activity: ${lastContact.toLocaleDateString()}` : ""}
                        className={`text-[10px] px-2 py-1 rounded-md font-medium tabular-nums ${activityBadgeStyle(contactDays)}`}
                      >
                        Last contact: {activityLabel(contactDays)}
                      </span>
                    </div>
                  )}

                  <div className="space-y-1 text-sm mb-3">
                    {c.phone && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="w-3 h-3 text-slate-600" />
                        <a href={`tel:${c.phone}`} className="hover:text-amber-400">
                          {formatPhone(c.phone)}
                        </a>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Mail className="w-3 h-3 text-slate-600" />
                        <a href={`mailto:${c.email}`} className="hover:text-amber-400 truncate">
                          {c.email}
                        </a>
                      </div>
                    )}
                  </div>

                  {(cJobs.length > 0 || cEsts.length > 0) && (
                    <div className="pt-3 border-t border-slate-800 flex gap-3 text-xs">
                      {cJobs.length > 0 && (
                        <span className="text-slate-500">
                          <strong className="text-slate-300">{cJobs.length}</strong> job{cJobs.length > 1 ? "s" : ""}
                        </span>
                      )}
                      {cEsts.length > 0 && (
                        <span className="text-slate-500">
                          <strong className="text-slate-300">{cEsts.length}</strong> estimate{cEsts.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}

                  {c.notes && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 italic">{c.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================================================================
// SCHEDULE
// ================================================================
function Schedule({ jobs }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [jobName, setJobName] = useState("");
  const [task, setTask] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("schedule").select("*").order("date");
      if (alive) {
        setItems(data || []);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const addItem = useCallback(async () => {
    if (!jobName.trim() || !task.trim()) return;
    const { data, error } = await supabase
      .from("schedule")
      .insert({ date, job: jobName, task })
      .select()
      .single();
    if (!error && data) {
      setItems((it) => [...it, data]);
      setJobName(""); setTask("");
      toast.success("Schedule item added");
    } else {
      toast.error("Add failed: " + (error?.message || "Unknown error"));
    }
  }, [date, jobName, task, toast]);

  const deleteItem = useCallback(async (item) => {
    const ok = await confirm({
      title: "Delete schedule item?",
      message: `"${item.task}" on ${formatDate(item.date)} will be removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("schedule").delete().eq("id", item.id);
    if (!error) {
      setItems((it) => it.filter((i) => i.id !== item.id));
      toast.success("Item deleted");
    }
  }, [confirm, toast]);

  // Group by date
  const byDate = items.reduce((acc, it) => {
    (acc[it.date] = acc[it.date] || []).push(it);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6 text-amber-400" />
          Schedule
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {items.length} item{items.length !== 1 ? "s" : ""} scheduled
        </p>
      </div>

      {/* ADD FORM */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Add Schedule Item</p>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <Inp
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="md:col-span-3"
            />
            <Sel
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              className="md:col-span-3"
            >
              <option value="">— Select job —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.name}>{j.name}</option>
              ))}
            </Sel>
            <Inp
              placeholder="Task / scope"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className="md:col-span-4"
            />
            <Btn
              onClick={addItem}
              className="bg-amber-400 text-black hover:bg-amber-500 md:col-span-2"
            >
              <Plus className="w-4 h-4 inline-block mr-1" /> Add
            </Btn>
          </div>
        </CardContent>
      </Card>

      {/* SCHEDULE LIST */}
      {loading ? <Spinner /> : items.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <EmptyState
              icon={<Calendar className="w-10 h-10 text-slate-700" />}
              message="Nothing scheduled yet"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((d) => (
            <Card key={d}>
              <CardContent className="p-4">
                <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold mb-3">
                  {new Date(d + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
                <div className="space-y-2">
                  {byDate[d].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg"
                    >
                      <Briefcase className="w-4 h-4 text-slate-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-sm font-medium">{item.job}</p>
                        <p className="text-slate-500 text-xs">{item.task}</p>
                      </div>
                      <button
                        onClick={() => deleteItem(item)}
                        className="text-slate-600 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ================================================================
// PHOTO UPLOADER
// ================================================================
function PhotoUploader({ jobId, onUploaded }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState("Progress");
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef(null);

  // Compress image client-side before upload (resize + jpeg quality)
  const compressImage = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxDim = 1600;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error("Compression failed")),
            "image/jpeg",
            0.85
          );
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    for (const file of files) {
      try {
        const compressed = await compressImage(file);
        const ext = "jpg";
        const filename = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("job-photos")
          .upload(filename, compressed, {
            contentType: "image/jpeg",
            cacheControl: "3600",
          });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("job-photos")
          .getPublicUrl(filename);
        const { data: photoRecord, error: dbError } = await supabase
          .from("job_photos")
          .insert({
            job_id: jobId,
            storage_path: filename,
            phase,
            caption: caption || null,
          })
          .select()
          .single();
        if (dbError) throw dbError;
        // Derive the public URL on the fly — bucket is public, path is the
        // source of truth. (v1.3.1 fix: previously we stored url as a
        // column, but the deployed schema doesn't have one. Deriving avoids
        // the schema-cache error and keeps URLs current if the bucket moves.)
        const photoWithUrl = { ...photoRecord, url: urlData.publicUrl };
        if (onUploaded) onUploaded(photoWithUrl);
        successCount++;
      } catch (err) {
        console.error("Upload error:", err);
        toast.error(`Failed to upload ${file.name}: ${err.message}`);
      }
    }
    setUploading(false);
    setCaption("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (successCount > 0) {
      toast.success(`${successCount} photo${successCount > 1 ? "s" : ""} uploaded`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        <Sel
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
          className="md:col-span-3"
        >
          <option>Before</option>
          <option>Progress</option>
          <option>Issue</option>
          <option>Final</option>
          <option>Reference</option>
        </Sel>
        <div className="md:col-span-9 flex items-center gap-2">
          <Inp
            placeholder="Caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <VoiceMicButton
            currentValue={caption}
            onChange={setCaption}
            appendMode
            title="Dictate caption"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          disabled={uploading}
          className="block text-xs text-slate-400
            file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-amber-400 file:text-black hover:file:bg-amber-500
            file:cursor-pointer cursor-pointer"
        />
        {uploading && (
          <span className="text-xs text-amber-400 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading...
          </span>
        )}
      </div>
      <p className="text-xs text-slate-600">
        Photos are compressed to 1600px max and uploaded to Supabase Storage.
      </p>
    </div>
  );
}

// ================================================================
// PHOTO GALLERY
// ================================================================
function PhotoGallery({ photos, onDelete, onUpdate }) {
  const [filter, setFilter] = useState("All");
  const [view, setView] = useState("grid"); // v1.3 — "grid" | "timeline"
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  // v1.3.2 — Inline-edit state for timeline view
  const [editingId, setEditingId] = useState(null);
  const [draftCaption, setDraftCaption] = useState("");
  const [draftPhase, setDraftPhase] = useState("Progress");
  const [savingEdit, setSavingEdit] = useState(false);

  const filtered = filter === "All" ? photos : photos.filter((p) => p.phase === filter);

  // v1.3 — Group photos by day for timeline view, sorted newest first
  const grouped = (() => {
    const map = new Map();
    [...filtered]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .forEach((p) => {
        const day = p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "unknown";
        if (!map.has(day)) map.set(day, []);
        map.get(day).push(p);
      });
    return Array.from(map.entries());
  })();

  if (photos.length === 0) {
    return (
      <div className="py-8 text-center">
        <ImageIcon className="w-10 h-10 text-slate-700 mx-auto mb-2" />
        <p className="text-slate-500 text-sm">No photos yet for this job</p>
      </div>
    );
  }

  return (
    <div>
      {/* View toggle (v1.3) */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex flex-wrap gap-1">
          {["All", "Before", "Progress", "Issue", "Final", "Reference"].map((f) => {
            const count = f === "All" ? photos.length : photos.filter((p) => p.phase === f).length;
            if (f !== "All" && count === 0) return null;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                  filter === f
                    ? "bg-amber-400 text-black border-amber-400"
                    : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"
                }`}
              >
                {f} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex bg-slate-900 border border-slate-700 rounded overflow-hidden text-[11px] flex-shrink-0">
          <button
            onClick={() => setView("grid")}
            className={`px-2 py-1 transition-colors ${view === "grid" ? "bg-amber-400 text-black" : "text-slate-400 hover:bg-slate-800"}`}
            title="Grid view"
          >
            Grid
          </button>
          <button
            onClick={() => setView("timeline")}
            className={`px-2 py-1 border-l border-slate-700 transition-colors ${view === "timeline" ? "bg-amber-400 text-black" : "text-slate-400 hover:bg-slate-800"}`}
            title="Timeline view"
          >
            Timeline
          </button>
        </div>
      </div>

      {/* GRID VIEW (default — pre-existing) */}
      {view === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="relative group aspect-square rounded-lg overflow-hidden bg-slate-900 border border-slate-800 cursor-pointer"
              onClick={() => setLightboxPhoto(p)}
            >
              <img
                src={p.url}
                alt={p.caption || "Job photo"}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 left-1">
                <Badge
                  label={p.phase}
                  color={
                    p.phase === "Issue"  ? "red"    :
                    p.phase === "Final"  ? "green"  :
                    p.phase === "Before" ? "gray"   : "yellow"
                  }
                />
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end p-2 opacity-0 group-hover:opacity-100">
                {p.caption && (
                  <p className="text-xs text-white truncate w-full">{p.caption}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TIMELINE VIEW (v1.3 new) — chronological feed grouped by day */}
      {view === "timeline" && (
        <div className="space-y-5">
          {grouped.map(([day, dayPhotos]) => {
            const dayLabel = day === "unknown"
              ? "Unknown date"
              : new Date(day + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "short", month: "short", day: "numeric", year: "numeric",
                });
            return (
              <div key={day}>
                <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur py-2 -mx-1 px-1 mb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-slate-200 tabular-nums">{dayLabel}</span>
                    <span className="text-[10px] text-slate-500">
                      {dayPhotos.length} photo{dayPhotos.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-5">
                  {dayPhotos.map((p) => {
                    const isEditing = editingId === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`group bg-slate-900 border rounded-lg overflow-hidden transition-colors flex ${
                          isEditing
                            ? "border-amber-700/70"
                            : "border-slate-800 cursor-pointer hover:border-amber-700/50"
                        }`}
                        onClick={(e) => {
                          if (isEditing) return;
                          // Don't trigger lightbox if clicking the edit button
                          if (e.target.closest("[data-edit-trigger]")) return;
                          setLightboxPhoto(p);
                        }}
                      >
                        <img
                          src={p.url}
                          alt={p.caption || "Job photo"}
                          loading="lazy"
                          className="w-32 h-32 object-cover flex-shrink-0"
                        />
                        <div className="flex-1 p-3 min-w-0 flex flex-col">
                          {isEditing ? (
                            <>
                              <select
                                value={draftPhase}
                                onChange={(e) => setDraftPhase(e.target.value)}
                                className="mb-1 text-[10px] bg-slate-950 border border-slate-700 text-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-amber-500"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {["Before", "Progress", "Issue", "Final", "Reference"].map((ph) => (
                                  <option key={ph} value={ph}>{ph}</option>
                                ))}
                              </select>
                              <textarea
                                value={draftCaption}
                                onChange={(e) => setDraftCaption(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                rows={2}
                                className="text-xs bg-slate-950 border border-slate-700 text-slate-200 rounded px-2 py-1 mb-2 resize-none focus:outline-none focus:border-amber-500"
                                placeholder="Add a caption…"
                                autoFocus
                              />
                              <div className="flex gap-1.5">
                                <button
                                  disabled={savingEdit}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!onUpdate) return setEditingId(null);
                                    setSavingEdit(true);
                                    const ok = await onUpdate(p.id, {
                                      caption: draftCaption.trim() || null,
                                      phase: draftPhase,
                                    });
                                    setSavingEdit(false);
                                    if (ok) setEditingId(null);
                                  }}
                                  className="text-[10px] px-2 py-1 rounded bg-amber-400 text-black font-semibold hover:bg-amber-500 disabled:opacity-50"
                                >
                                  {savingEdit ? "Saving…" : "Save"}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                                  className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge
                                  label={p.phase}
                                  color={
                                    p.phase === "Issue"  ? "red"    :
                                    p.phase === "Final"  ? "green"  :
                                    p.phase === "Before" ? "gray"   : "yellow"
                                  }
                                />
                                <span className="text-[10px] text-slate-500 tabular-nums">
                                  {p.created_at && new Date(p.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </span>
                                {onUpdate && (
                                  <button
                                    data-edit-trigger
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingId(p.id);
                                      setDraftCaption(p.caption || "");
                                      setDraftPhase(p.phase || "Progress");
                                    }}
                                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-amber-400"
                                    title="Edit caption + phase"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              {p.caption ? (
                                <p className="text-xs text-slate-300 line-clamp-3">{p.caption}</p>
                              ) : (
                                <p className="text-xs text-slate-600 italic">No caption</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIGHTBOX */}
      <AnimatePresence>
        {lightboxPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[1100] flex items-center justify-center px-4"
            onClick={() => setLightboxPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="max-w-5xl max-h-[90vh] relative"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.caption || "Job photo"}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-white">
                  <Badge
                    label={lightboxPhoto.phase}
                    color={
                      lightboxPhoto.phase === "Issue"  ? "red"    :
                      lightboxPhoto.phase === "Final"  ? "green"  :
                      lightboxPhoto.phase === "Before" ? "gray"   : "yellow"
                    }
                  />
                  {lightboxPhoto.caption && (
                    <p className="text-sm mt-2">{lightboxPhoto.caption}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onDelete(lightboxPhoto);
                      setLightboxPhoto(null);
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-sm rounded flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                  <button
                    onClick={() => setLightboxPhoto(null)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ================================================================
// DAILY LOGS
// ================================================================
function DailyLogs({ jobs, dailyLogs, setDailyLogs }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [jobId, setJobId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [crew, setCrew] = useState("");
  const [hours, setHours] = useState("");
  const [weather, setWeather] = useState("");
  const [workCompleted, setWorkCompleted] = useState("");
  const [issues, setIssues] = useState("");
  const [filterJobId, setFilterJobId] = useState("All");

  const activeJobs = jobs.filter((j) => j.status === "Active");

  const submitLog = useCallback(async () => {
    if (!jobId) {
      toast.error("Pick a job");
      return;
    }
    if (!workCompleted.trim()) {
      toast.error("Describe work completed");
      return;
    }
    // v1.3.3 — Schema names: DB has hours_connor / hours_dad / hours_other.
    // For now we map flat-form `hours` → hours_connor (single-user app today).
    // v1.4 will expose dad/other-worker fields when payroll structure is set.
    const payload = {
      job_id: jobId,
      log_date: date,
      crew,
      hours_connor: parseFloat(hours) || null,
      weather,
      work_performed: workCompleted,
      issues,
    };
    const { data, error } = await supabase
      .from("daily_logs")
      .insert(payload)
      .select()
      .single();
    if (!error && data) {
      setDailyLogs((d) => [data, ...d]);
      toast.success("Log saved");
      setCrew(""); setHours(""); setWeather("");
      setWorkCompleted(""); setIssues("");
    } else {
      toast.error("Save failed: " + (error?.message || "Unknown error"));
    }
  }, [jobId, date, crew, hours, weather, workCompleted, issues, setDailyLogs, toast]);

  const deleteLog = useCallback(async (log) => {
    const ok = await confirm({
      title: "Delete this log entry?",
      message: `Log from ${formatDate(log.log_date)} will be permanently removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("daily_logs").delete().eq("id", log.id);
    if (!error) {
      setDailyLogs((d) => d.filter((x) => x.id !== log.id));
      toast.success("Log deleted");
    }
  }, [confirm, setDailyLogs, toast]);

  const getJobName = (id) => jobs.find((j) => j.id === id)?.name || "(unknown job)";

  const filtered = filterJobId === "All"
    ? dailyLogs
    : dailyLogs.filter((l) => l.job_id === filterJobId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-amber-400" />
          Daily Logs
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Field documentation, lien protection, and audit trail
        </p>
      </div>

      {/* LOG ENTRY FORM */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">New Log Entry</p>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
            <div className="md:col-span-5">
              <label className="block text-xs text-slate-400 mb-1">Job *</label>
              <Sel value={jobId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">— Select active job —</option>
                {activeJobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </Sel>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-slate-400 mb-1">Date</label>
              <Inp type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Hours</label>
              <Inp
                type="number"
                step="0.5"
                placeholder="8"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Weather</label>
              <Inp
                placeholder="60°F clear"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-slate-400 mb-1">Crew on site</label>
            <Inp
              placeholder="Connor, Dad, John (laborer)"
              value={crew}
              onChange={(e) => setCrew(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-slate-400">Work Completed *</label>
              <VoiceMicButton
                currentValue={workCompleted}
                onChange={setWorkCompleted}
                appendMode
                title="Dictate work completed"
              />
            </div>
            <AutoTextarea
              value={workCompleted}
              onChange={(e) => setWorkCompleted(e.target.value)}
              minRows={3}
              placeholder="What was done today..."
            />
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-slate-400">Issues / Notes</label>
              <VoiceMicButton
                currentValue={issues}
                onChange={setIssues}
                appendMode
                title="Dictate issues / notes"
              />
            </div>
            <AutoTextarea
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              minRows={2}
              placeholder="Anything notable, delays, change requests, etc."
            />
          </div>
          <Btn
            onClick={submitLog}
            className="bg-amber-400 text-black hover:bg-amber-500 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Log Entry
          </Btn>
        </CardContent>
      </Card>

      {/* FILTER */}
      {dailyLogs.length > 5 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Filter:</span>
          <Sel
            value={filterJobId}
            onChange={(e) => setFilterJobId(e.target.value)}
            className="max-w-xs"
          >
            <option value="All">All Jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.name}</option>
            ))}
          </Sel>
        </div>
      )}

      {/* LOG LIST */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <EmptyState
              icon={<ClipboardList className="w-10 h-10 text-slate-700" />}
              message={dailyLogs.length === 0 ? "No logs yet" : "No logs match your filter"}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-100 font-semibold">{getJobName(log.job_id)}</p>
                    <p className="text-xs text-amber-400 mt-0.5">
                      {new Date(log.log_date + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "long", month: "short", day: "numeric", year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                    {(() => {
                      // v1.3.3 — Sum hours_connor + hours_dad + hours_other.
                      // Backward-compat: legacy rows may still have a flat `hours` field.
                      const total = (Number(log.hours_connor) || 0) +
                                    (Number(log.hours_dad)    || 0) +
                                    (Number(log.hours_other)  || 0) +
                                    (Number(log.hours)        || 0);
                      return total > 0 ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {total}h
                        </span>
                      ) : null;
                    })()}
                    {log.weather && (
                      <span className="flex items-center gap-1">
                        <CloudSun className="w-3 h-3" /> {log.weather}
                      </span>
                    )}
                    <button
                      onClick={() => deleteLog(log)}
                      className="text-slate-600 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {log.crew && (
                  <p className="text-xs text-slate-500 mb-2">
                    <span className="text-slate-400 font-medium">Crew:</span> {log.crew}
                  </p>
                )}
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Work Completed</p>
                    <p className="text-slate-300 text-sm whitespace-pre-line">{log.work_performed}</p>
                  </div>
                  {log.issues && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Issues / Notes</p>
                      <p className="text-slate-400 text-sm whitespace-pre-line">{log.issues}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ================================================================
// SETTINGS
// ================================================================
function Settings({ settings, setSettings }) {
  const toast = useToast();
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocal(settings); }, [settings]);

  const update = (k, v) => setLocal((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    setSettings(local);
    // Persist to Supabase if you have a settings row, else localStorage
    try {
      localStorage.setItem("northshore_settings", JSON.stringify(local));
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Save failed: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-amber-400" />
          Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">Company info, pricing defaults, app preferences</p>
      </div>

      {/* COMPANY INFO */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Company Information
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Company Name</label>
              <Inp
                value={local.companyName || ""}
                onChange={(e) => update("companyName", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Phone</label>
                <Inp
                  value={local.companyPhone || ""}
                  onChange={(e) => update("companyPhone", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Email</label>
                <Inp
                  value={local.companyEmail || ""}
                  onChange={(e) => update("companyEmail", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Address</label>
              <Inp
                value={local.companyAddress || ""}
                onChange={(e) => update("companyAddress", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">License #</label>
                <Inp
                  value={local.licenseNumber || ""}
                  onChange={(e) => update("licenseNumber", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Website</label>
                <Inp
                  value={local.website || ""}
                  onChange={(e) => update("website", e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PRICING DEFAULTS */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Pricing Defaults
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Labor Rate ($/hr)</label>
              <Inp
                type="number"
                value={local.laborRate || 95}
                onChange={(e) => update("laborRate", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Material Markup (%)</label>
              <Inp
                type="number"
                value={local.materialMarkup || 20}
                onChange={(e) => update("materialMarkup", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Overhead (%)</label>
              <Inp
                type="number"
                value={local.overheadPct || 12.5}
                onChange={(e) => update("overheadPct", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Profit (%)</label>
              <Inp
                type="number"
                value={local.profitPct || 10}
                onChange={(e) => update("profitPct", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Default Contingency (%)</label>
              <Inp
                type="number"
                value={local.contingencyPct || 10}
                onChange={(e) => update("contingencyPct", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">MI Sales Tax % (internal only)</label>
              <Inp
                type="number"
                value={local.salesTaxPct || 6}
                onChange={(e) => update("salesTaxPct", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-3 text-xs text-amber-300/80">
            Sales tax is paid by Northshore at supplier purchase per Michigan RAB 2025-18.
            It is NOT added as a line item to client proposals. This rate is for internal cost
            tracking only.
          </div>
        </CardContent>
      </Card>

      {/* SAVE */}
      <div>
        <Btn
          onClick={save}
          disabled={saving}
          className="bg-amber-400 text-black hover:bg-amber-500 flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Save Settings
            </>
          )}
        </Btn>
      </div>
    </div>
  );
}

// ================================================================
// APP — root component with auth + data load + nav
// ================================================================
const TABS = [
  { id: "Dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { id: "Estimator", label: "Estimator",  icon: Calculator },
  { id: "Pipeline",  label: "Pipeline",   icon: GitBranch },
  { id: "Jobs",      label: "Jobs",       icon: Briefcase },
  { id: "Daily",     label: "Daily Logs", icon: ClipboardList },
  { id: "Schedule",  label: "Schedule",   icon: Calendar },
  { id: "Clients",   label: "Clients",    icon: Users },
  { id: "Vault",     label: "Vault",      icon: FolderOpen },
  { id: "Tools",     label: "Tools",      icon: Wrench },
  { id: "Settings",  label: "Settings",   icon: SettingsIcon },
];

function AppInner() {
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("Dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Domain data
  const [jobs, setJobs] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [clients, setClients] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [jobPhotos, setJobPhotos] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [activeTimeEntry, setActiveTimeEntry] = useState(null); // currently-clocked-in session for this user
  const [documents, setDocuments] = useState([]);
  const [tools, setTools] = useState([]);
  const [toolUses, setToolUses] = useState([]);
  const [toolMaintenance, setToolMaintenance] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoicePayments, setInvoicePayments] = useState([]);
  const [lienWaivers, setLienWaivers] = useState([]);
  const [swornStatements, setSwornStatements] = useState([]);
  const [jobSubs, setJobSubs] = useState([]);
  const [leads, setLeads] = useState([]);
  // v1.3.2 — Lifted to AppInner so lien calc + last-activity helpers
  // see deliveries across all jobs (not just the open one). JobOperations
  // still owns the editing UX; we keep parent state in sync via setter.
  const [materialDeliveries, setMaterialDeliveries] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Settings
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("northshore_settings");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to parse saved settings:", e);
    }
    return {
      companyName: "Northshore Mechanical & Construction LLC",
      companyPhone: "(231) 760-7013",
      companyEmail: "connor@northshorebuildsmi.com",
      companyAddress: "1276 Sauter St, Muskegon, MI 49442",
      licenseNumber: "242501434",
      website: "northshorebuildsmi.com",
      laborRate: 95,
      materialMarkup: 20,
      overheadPct: 12.5,
      profitPct: 10,
      contingencyPct: 10,
      salesTaxPct: 6,
    };
  });

  // Auth
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (alive) {
        setSession(session);
        setAuthLoading(false);
      }
    })();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => {
      alive = false;
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  // Data load (after auth)
  useEffect(() => {
    if (!session) {
      setDataLoaded(false);
      return;
    }
    let alive = true;
    (async () => {
      const [jobsRes, estRes, cliRes, logRes, photoRes, timeRes, activeRes, docsRes, toolsRes, toolUsesRes, toolMaintRes, invRes, payRes, waiverRes, stmtRes, subsRes, leadsRes, deliveriesRes] = await Promise.all([
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("estimates").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
        supabase.from("clients").select("*").is("deleted_at", null).order("name"),
        supabase.from("daily_logs").select("*").order("log_date", { ascending: false }),
        supabase.from("job_photos").select("*").order("created_at", { ascending: false }),
        supabase.from("time_entries").select("*").order("clock_in", { ascending: false }),
        // The hot-path lookup: am I currently clocked in anywhere?
        supabase
          .from("time_entries")
          .select("*")
          .eq("user_id", session.user.id)
          .is("clock_out", null)
          .maybeSingle(),
        supabase.from("company_documents").select("*").order("created_at", { ascending: false }),
        supabase.from("tools").select("*").order("created_at", { ascending: false }),
        supabase.from("tool_uses").select("*").order("used_date", { ascending: false }).limit(2000),
        supabase.from("tool_maintenance").select("*").order("service_date", { ascending: false }).limit(1000),
        supabase.from("invoices").select("*").order("invoice_date", { ascending: false }),
        supabase.from("invoice_payments").select("*").order("payment_date", { ascending: false }),
        supabase.from("lien_waivers").select("*").order("created_at", { ascending: false }),
        supabase.from("sworn_statements").select("*").order("statement_date", { ascending: false }),
        supabase.from("job_subs").select("*").order("created_at", { ascending: false }),
        supabase.from("leads").select("*").is("archived_at", null).order("last_touch_at", { ascending: false }),
        // v1.3.2 — All deliveries across all jobs (lifted from JobOperations
        // for accurate lien calc + last-activity helpers).
        supabase.from("material_deliveries").select("*").order("expected_date", { ascending: false }),
      ]);
      if (!alive) return;
      setJobs(jobsRes.data || []);
      setEstimates(estRes.data || []);
      setClients(cliRes.data || []);
      setDailyLogs(logRes.data || []);
      // v1.3.1 — Hydrate photo URLs from storage_path. The deployed
      // job_photos table has no `url` column, so we derive on read.
      // Backwards compatible with any legacy rows that DO have url set.
      const hydratedPhotos = (photoRes.data || []).map((p) => {
        if (p.url) return p;
        if (p.storage_path) {
          const { data: u } = supabase.storage.from("job-photos").getPublicUrl(p.storage_path);
          return { ...p, url: u?.publicUrl || null };
        }
        return p;
      });
      setJobPhotos(hydratedPhotos);
      setTimeEntries(timeRes.data || []);
      setActiveTimeEntry(activeRes.data || null);
      setDocuments(docsRes.data || []);
      setTools(toolsRes.data || []);
      setToolUses(toolUsesRes.data || []);
      setToolMaintenance(toolMaintRes.data || []);
      setInvoices(invRes.data || []);
      setInvoicePayments(payRes.data || []);
      setLienWaivers(waiverRes.data || []);
      setSwornStatements(stmtRes.data || []);
      setJobSubs(subsRes.data || []);
      setLeads(leadsRes.data || []);
      setMaterialDeliveries(deliveriesRes.data || []);
      setDataLoaded(true);
    })();
    return () => { alive = false; };
  }, [session]);

  const onJobCreated = useCallback((job) => {
    setJobs((j) => [job, ...j]);
  }, []);

  // ============================================================
  // TIME TRACKING — handlers wired to ClockWidget in the header
  // ============================================================
  const handleClockIn = useCallback(async (job, notes) => {
    if (!session?.user) return;
    if (activeTimeEntry) {
      toast.warn("You're already clocked in. Clock out first.");
      return;
    }
    const { data, error } = await supabase
      .from("time_entries")
      .insert({
        job_id: job.id,
        user_id: session.user.id,
        user_email: session.user.email,
        clock_in: new Date().toISOString(),
        notes: notes || null,
      })
      .select()
      .single();
    if (!error && data) {
      setActiveTimeEntry(data);
      setTimeEntries((prev) => [data, ...prev]);
      toast.success(`Clocked in to ${job.name}`);
    } else {
      toast.error("Clock-in failed: " + (error?.message || "Unknown error"));
    }
  }, [session, activeTimeEntry, toast]);

  const handleClockOut = useCallback(async (notes) => {
    if (!activeTimeEntry) return;
    const clockOut = new Date();
    const clockIn = new Date(activeTimeEntry.clock_in);
    const durationMin = Math.round((clockOut - clockIn) / 60000);
    const { data, error } = await supabase
      .from("time_entries")
      .update({
        clock_out: clockOut.toISOString(),
        duration_minutes: durationMin,
        notes: notes || activeTimeEntry.notes,
      })
      .eq("id", activeTimeEntry.id)
      .select()
      .single();
    if (!error && data) {
      setActiveTimeEntry(null);
      setTimeEntries((prev) => prev.map((e) => (e.id === data.id ? data : e)));
      toast.success(`Clocked out — ${formatDuration(durationMin)} logged`);
    } else {
      toast.error("Clock-out failed: " + (error?.message || "Unknown error"));
    }
  }, [activeTimeEntry, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setJobs([]); setEstimates([]); setClients([]);
    setDailyLogs([]); setJobPhotos([]);
    setTimeEntries([]); setActiveTimeEntry(null);
    setDocuments([]);
    setTools([]); setToolUses([]); setToolMaintenance([]);
    setInvoices([]); setInvoicePayments([]); setLienWaivers([]); setSwornStatements([]); setJobSubs([]);
    setDataLoaded(false);
    toast.info("Signed out");
  };

  // v1.4 — Global keyboard shortcuts
  // Esc: close mobile nav (modals + drawers handle their own Esc internally)
  // /:   focus the nearest search input on the active tab
  useEffect(() => {
    const handler = (e) => {
      // Don't intercept when user is typing in a field
      const target = e.target;
      const inField = target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );

      if (e.key === "Escape") {
        if (mobileNavOpen) {
          setMobileNavOpen(false);
          e.preventDefault();
        }
        return;
      }

      if (e.key === "/" && !inField) {
        // Find first visible search input on the page and focus it
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search" i], input[placeholder*="search" i]');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileNavOpen]);

  // Daily-log alert badge for nav
  const today = new Date().toISOString().slice(0, 10);
  const activeJobs = jobs.filter((j) => j.status === "Active");
  const jobsLoggedToday = new Set(
    dailyLogs.filter((l) => l.log_date === today).map((l) => l.job_id)
  );
  const jobsMissingTodayLog = activeJobs.filter((j) => !jobsLoggedToday.has(j.id));
  const dailyAlertCount = jobsMissingTodayLog.length;

  // v1.3 — Tab notification badges
  // Pipeline: count of stale leads (>7d since last touch, not lost/archived)
  const pipelineAlertCount = leads.filter((l) => {
    if (l.archived_at || l.stage === "lost" || l.stage === "won") return false;
    const days = daysSinceTouch(l.last_touch_at);
    return days != null && days > 7;
  }).length;
  // Jobs: count of jobs in lien-warning state (within 30d of deadline or expired)
  const jobsLienAlertCount = jobs.filter((j) => {
    if (j.status !== "Active" && j.status !== "Completed") return false;
    const lien = lienDeadlineFor(j, dailyLogs, timeEntries, materialDeliveries);
    return lien && lien.urgency !== "safe";
  }).length;

  // Helper — pull count for a given tab id
  const tabBadgeCount = (id) => {
    if (id === "Daily")    return dailyAlertCount;
    if (id === "Pipeline") return pipelineAlertCount;
    if (id === "Jobs")     return jobsLienAlertCount;
    return 0;
  };
  // Color tier for the badge (urgency varies by tab — lien is rose, others amber)
  const tabBadgeColor = (id) => {
    if (id === "Jobs") return "bg-rose-500"; // lien is critical
    return "bg-amber-500";                    // stale leads, missed logs
  };
  // Aggregate count for the mobile-menu hamburger dot
  const totalAlertCount = dailyAlertCount + pipelineAlertCount + jobsLienAlertCount;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-slate-200">
        {/* Skeleton header */}
        <header className="sticky top-0 z-40 backdrop-blur-md bg-black/60 border-b border-slate-800">
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded bg-amber-400/20 animate-pulse" />
              <div className="h-5 w-40 rounded bg-slate-800 animate-pulse" />
            </div>
            <div className="hidden lg:flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-8 w-20 rounded bg-slate-800 animate-pulse" />
              ))}
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse lg:hidden" />
          </div>
        </header>
        {/* Skeleton body */}
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-6 space-y-6">
          {/* Big banner skeleton */}
          <div className="h-24 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
          {/* KPI grid skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
            ))}
          </div>
          {/* Two-column content skeleton */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="h-64 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
            <div className="h-64 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
          </div>
          {/* Loading message at bottom — non-spinning, less attention-grabbing */}
          <div className="text-center text-slate-600 text-xs pt-2">
            Loading your workspace...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-slate-200">
      <GlobalStyles />

      {/* HEADER */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-black/60 border-b border-slate-800">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-2 -ml-2 text-slate-300 hover:text-amber-400 relative"
              aria-label="Menu"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              {totalAlertCount > 0 && !mobileNavOpen && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-900/30">
                <span className="text-black font-black text-sm">N</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">Northshore OS</p>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {settings.companyName?.split(" ").slice(0, 2).join(" ") || "Northshore"}
                </p>
              </div>
            </div>
          </div>

          {/* DESKTOP NAV */}
          <nav className="hidden lg:flex items-center gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const badgeCount = tabBadgeCount(t.id);
              const showBadge = badgeCount > 0;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    tab === t.id
                      ? "bg-amber-400 text-black"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                  {showBadge && (
                    <span className={`absolute -top-0.5 -right-0.5 ${tabBadgeColor(t.id)} text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center`}>
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ClockWidget
              activeEntry={activeTimeEntry}
              jobs={jobs}
              onClockIn={handleClockIn}
              onClockOut={handleClockOut}
            />
            <span className="hidden md:block text-xs text-slate-500 truncate max-w-[180px]">
              {session.user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MOBILE NAV */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="lg:hidden border-t border-slate-800 overflow-hidden"
            >
              <div className="px-3 py-3 space-y-1">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const badgeCount = tabBadgeCount(t.id);
                  const showBadge = badgeCount > 0;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTab(t.id);
                        setMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        tab === t.id
                          ? "bg-amber-400 text-black"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {t.label}
                      {showBadge && (
                        <span className={`ml-auto ${tabBadgeColor(t.id)} text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center`}>
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* MAIN CONTENT */}
      {/* v1.1.6 — Removed AnimatePresence(mode="wait") wrapper. The fade-in
          tab transition was deadlocking when Pipeline's nested animations
          (modal close, drag mid-flight, spring still bouncing) didn't settle
          cleanly before tab change. mode="wait" would hold the old motion.div
          forever and never mount the new tab. Direct conditional render is
          bulletproof. ErrorBoundary still wraps each tab for crash recovery. */}
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-6">
        <div key={tab}>
            {tab === "Dashboard" && (
              <ErrorBoundary label="Dashboard">
                <Dashboard
                  jobs={jobs}
                  estimates={estimates}
                  clients={clients}
                  dailyLogs={dailyLogs}
                  documents={documents}
                  timeEntries={timeEntries}
                  materialDeliveries={materialDeliveries}
                  setTab={setTab}
                />
              </ErrorBoundary>
            )}
            {tab === "Estimator" && (
              <ErrorBoundary label="Estimator">
                <Estimator
                  settings={settings}
                  estimates={estimates}
                  setEstimates={setEstimates}
                  onJobCreated={onJobCreated}
                  clients={clients}
                  setClients={setClients}
                  jobs={jobs}
                />
              </ErrorBoundary>
            )}
            {tab === "Pipeline" && (
              <ErrorBoundary label="Pipeline">
                <Pipeline
                  leads={leads}
                  setLeads={setLeads}
                  clients={clients}
                  setClients={setClients}
                  jobs={jobs}
                  setJobs={setJobs}
                  estimates={estimates}
                  setTab={setTab}
                />
              </ErrorBoundary>
            )}
            {tab === "Jobs" && (
              <ErrorBoundary label="Jobs">
                <Jobs
                  jobs={jobs}
                  setJobs={setJobs}
                  clients={clients}
                  jobPhotos={jobPhotos}
                  setJobPhotos={setJobPhotos}
                  dailyLogs={dailyLogs}
                  settings={settings}
                  estimates={estimates}
                  timeEntries={timeEntries}
                  setTimeEntries={setTimeEntries}
                  activeTimeEntry={activeTimeEntry}
                  invoices={invoices}
                  setInvoices={setInvoices}
                  invoicePayments={invoicePayments}
                  setInvoicePayments={setInvoicePayments}
                  lienWaivers={lienWaivers}
                  setLienWaivers={setLienWaivers}
                  swornStatements={swornStatements}
                  setSwornStatements={setSwornStatements}
                  jobSubs={jobSubs}
                  setJobSubs={setJobSubs}
                  materialDeliveries={materialDeliveries}
                  setMaterialDeliveries={setMaterialDeliveries}
                />
              </ErrorBoundary>
            )}
            {tab === "Daily" && (
              <ErrorBoundary label="Daily Logs">
                <DailyLogs
                  jobs={jobs}
                  dailyLogs={dailyLogs}
                  setDailyLogs={setDailyLogs}
                />
              </ErrorBoundary>
            )}
            {tab === "Schedule" && (
              <ErrorBoundary label="Schedule">
                <Schedule jobs={jobs} />
              </ErrorBoundary>
            )}
            {tab === "Clients" && (
              <ErrorBoundary label="Clients">
                <Clients
                  clients={clients}
                  setClients={setClients}
                  jobs={jobs}
                  estimates={estimates}
                  dailyLogs={dailyLogs}
                  timeEntries={timeEntries}
                  jobPhotos={jobPhotos}
                  materialDeliveries={materialDeliveries}
                />
              </ErrorBoundary>
            )}
            {tab === "Vault" && (
              <ErrorBoundary label="Vault">
                <DocumentsVault documents={documents} setDocuments={setDocuments} />
              </ErrorBoundary>
            )}
            {tab === "Tools" && (
              <ErrorBoundary label="Tools">
                <ToolsROI
                  tools={tools}
                  setTools={setTools}
                  toolUses={toolUses}
                  setToolUses={setToolUses}
                  toolMaintenance={toolMaintenance}
                  setToolMaintenance={setToolMaintenance}
                  jobs={jobs}
                  settings={settings}
                />
              </ErrorBoundary>
            )}
            {tab === "Settings" && (
              <ErrorBoundary label="Settings">
                <Settings settings={settings} setSettings={setSettings} />
              </ErrorBoundary>
            )}
        </div>
      </main>

      <footer className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-6 text-center text-[10px] text-slate-700 border-t border-slate-900 mt-12">
        © {new Date().getFullYear()} {settings.companyName} &nbsp;|&nbsp;
        License #{settings.licenseNumber} &nbsp;|&nbsp;
        Northshore OS Phase 4
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppInner />
      </ConfirmProvider>
    </ToastProvider>
  );
}