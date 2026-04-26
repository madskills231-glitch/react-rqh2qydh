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
  // Status & flags
  AlertCircle, AlertTriangle, CheckCircle2, XCircle, Info, Clock, Zap, Lock, Unlock,
  // Construction
  HardHat, Hammer, Wrench, Truck, Package,
  // Money & data
  DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart, Receipt,
  // Misc
  ExternalLink, Eye, EyeOff, ArrowRight, ArrowLeft, RefreshCw, MoreHorizontal,
  CloudSun, Thermometer, MapPin, Phone, Mail, Building2
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
// ================================================================

// ================================================================
// GLOBAL STYLES
// Custom scrollbars + keyframes injected once at app root
// ================================================================
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

  const push = useCallback((type, message, duration = 3500) => {
    const id = Math.random().toString(36).slice(2, 10);
    setToasts((prev) => [...prev, { id, type, message }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const toast = {
    success: (msg, dur) => push("success", msg, dur),
    error:   (msg, dur) => push("error",   msg, dur ?? 5000),
    info:    (msg, dur) => push("info",    msg, dur),
    warn:    (msg, dur) => push("warn",    msg, dur ?? 4500),
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
function Dashboard({ jobs, estimates, clients, dailyLogs = [], setTab }) {
  const activeJobs  = jobs.filter((j) => j.status === "Active");
  const openEst     = estimates.filter((e) => e.status === "Draft" || e.status === "Sent");
  const approvedEst = estimates.filter((e) => e.status === "Approved");
  const arTotal     = approvedEst.reduce((s, e) => s + (e.grand_total || 0), 0);
  const pipeline    = openEst.reduce((s, e) => s + (e.grand_total || 0), 0);

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
// ESTIMATOR
// ================================================================
function Estimator({ settings, estimates, setEstimates, onJobCreated, clients, jobs }) {
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

  // Delete an estimate
  const deleteEstimate = async (est) => {
    const ok = await confirm({
      title: "Delete this estimate?",
      message: `This will permanently delete "${est.name}" (${currency(est.grand_total)}). This cannot be undone.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("estimates").delete().eq("id", est.id);
    if (!error) {
      setEstimates((prev) => prev.filter((e) => e.id !== est.id));
      // If we were editing the one we just deleted, reset form
      if (editingId === est.id) resetForm();
      toast.success("Estimate deleted");
    } else {
      toast.error("Delete failed: " + error.message);
    }
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
              <label className="block text-xs text-slate-400 mb-1">Client</label>
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
    </div>
  );
}
// ================================================================
// JOB OPERATIONS
// Punch list, material deliveries, photos sub-component for Jobs
// ================================================================
function JobOperations({ job, jobPhotos, dailyLogs, setJobPhotos, settings, allJobs }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [opsTab, setOpsTab] = useState("Punch");
  const [punchList, setPunchList] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
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

  // Load punch + deliveries when this job opens
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingOps(true);
      const [punchRes, delRes] = await Promise.all([
        supabase.from("punch_list").select("*").eq("job_id", job.id).order("created_at"),
        supabase.from("material_deliveries").select("*").eq("job_id", job.id).order("expected_date"),
      ]);
      if (!alive) return;
      setPunchList(punchRes.data || []);
      setDeliveries(delRes.data || []);
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
        priority: pPriority,
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
    const { data, error } = await supabase
      .from("punch_list")
      .update({ completed: !item.completed })
      .eq("id", item.id)
      .select()
      .single();
    if (!error && data) {
      setPunchList((p) => p.map((x) => (x.id === data.id ? data : x)));
    }
  }, []);

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
        item: dItem,
        quantity: dQty || null,
        expected_date: dExpectedDate,
        cost: parseFloat(dCost) || null,
        status: "Ordered",
      })
      .select()
      .single();
    if (!error && data) {
      setDeliveries((d) => [...d, data]);
      setDSupplier(""); setDItem(""); setDQty(""); setDCost("");
      toast.success("Delivery added");
    } else {
      toast.error("Add failed: " + (error?.message || "Unknown error"));
    }
  }, [job.id, dSupplier, dItem, dQty, dExpectedDate, dCost, toast]);

  const updateDeliveryStatus = useCallback(async (del, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === "Delivered" && !del.received_date) {
      updates.received_date = new Date().toISOString().slice(0, 10);
    }
    const { data, error } = await supabase
      .from("material_deliveries")
      .update(updates)
      .eq("id", del.id)
      .select()
      .single();
    if (!error && data) {
      setDeliveries((d) => d.map((x) => (x.id === data.id ? data : x)));
      toast.success(`Marked ${newStatus}`);
    }
  }, [toast]);

  const deleteDelivery = useCallback(async (del) => {
    const ok = await confirm({
      title: "Delete delivery record?",
      message: `${del.supplier} — ${del.item} will be removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("material_deliveries").delete().eq("id", del.id);
    if (!error) {
      setDeliveries((d) => d.filter((x) => x.id !== del.id));
      toast.success("Delivery deleted");
    }
  }, [confirm, toast]);

  const openPunch = punchList.filter((p) => !p.completed);
  const completedPunch = punchList.filter((p) => p.completed);
  const pendingDeliveries = deliveries.filter((d) => d.status !== "Delivered");

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
                            <Badge
                              label={item.priority}
                              color={
                                item.priority === "High"   ? "red" :
                                item.priority === "Medium" ? "yellow" : "gray"
                              }
                            />
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
                                <span className="text-slate-400 text-sm">— {d.item}</span>
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
                                {d.received_date && (
                                  <span className="text-emerald-400">
                                    Delivered {formatDate(d.received_date)}
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
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ================================================================
// JOBS
// ================================================================
function Jobs({ jobs, setJobs, clients, jobPhotos, setJobPhotos, dailyLogs, settings, estimates }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [clientId, setClientId] = useState("");
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [filter, setFilter] = useState("Active");
  const [search, setSearch] = useState("");

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

      {/* FILTER + SEARCH */}
      {jobs.length > 3 && (
        <div className="flex flex-wrap items-center gap-2">
          <Inp
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          {["All", "Active", "Paused", "Completed", "Lost"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                filter === f
                  ? "bg-amber-400 text-black border-amber-400"
                  : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* JOB LIST */}
      {filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <EmptyState
              icon={<Briefcase className="w-10 h-10 text-slate-700" />}
              message={jobs.length === 0 ? "No jobs yet" : "No jobs match your filter"}
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
                                onChange={(e) => updateJob(j.id, { status: e.target.value })}
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

                          {/* OPS (PUNCH / DELIVERIES / PHOTOS) */}
                          <JobOperations
                            job={j}
                            jobPhotos={jobPhotos}
                            dailyLogs={dailyLogs}
                            setJobPhotos={setJobPhotos}
                            settings={settings}
                            allJobs={jobs}
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
function Clients({ clients, setClients, jobs, estimates }) {
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
    const payload = { name, email, phone, address, notes };
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
      warningDetails = `\n\n${parts.join(" and ")} are linked to this client. They will not be deleted, but will lose their client reference.`;
    }
    const ok = await confirm({
      title: "Delete this client?",
      message: `"${client.name}" will be permanently deleted.${warningDetails}`,
      confirmText: "Delete Client",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("clients").delete().eq("id", client.id);
    if (!error) {
      setClients((cs) => cs.filter((c) => c.id !== client.id));
      if (editingId === client.id) resetForm();
      toast.success("Client deleted");
    } else {
      toast.error("Delete failed: " + error.message);
    }
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
            url: urlData.publicUrl,
            phase,
            caption: caption || null,
          })
          .select()
          .single();
        if (dbError) throw dbError;
        if (onUploaded) onUploaded(photoRecord);
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
        <Inp
          placeholder="Caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="md:col-span-9"
        />
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
function PhotoGallery({ photos, onDelete }) {
  const [filter, setFilter] = useState("All");
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const filtered = filter === "All" ? photos : photos.filter((p) => p.phase === filter);

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
      <div className="flex flex-wrap gap-1 mb-3">
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
    const payload = {
      job_id: jobId,
      log_date: date,
      crew,
      hours: parseFloat(hours) || null,
      weather,
      work_completed: workCompleted,
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
            <label className="block text-xs text-slate-400 mb-1">Work Completed *</label>
            <textarea
              value={workCompleted}
              onChange={(e) => setWorkCompleted(e.target.value)}
              rows={3}
              placeholder="What was done today..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-slate-400 mb-1">Issues / Notes</label>
            <textarea
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              rows={2}
              placeholder="Anything notable, delays, change requests, etc."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
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
                    {log.hours && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {log.hours}h
                      </span>
                    )}
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
                    <p className="text-slate-300 text-sm whitespace-pre-line">{log.work_completed}</p>
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
  { id: "Jobs",      label: "Jobs",       icon: Briefcase },
  { id: "Daily",     label: "Daily Logs", icon: ClipboardList },
  { id: "Schedule",  label: "Schedule",   icon: Calendar },
  { id: "Clients",   label: "Clients",    icon: Users },
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
      const [jobsRes, estRes, cliRes, logRes, photoRes] = await Promise.all([
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("estimates").select("*").order("created_at", { ascending: false }),
        supabase.from("clients").select("*").order("name"),
        supabase.from("daily_logs").select("*").order("log_date", { ascending: false }),
        supabase.from("job_photos").select("*").order("created_at", { ascending: false }),
      ]);
      if (!alive) return;
      setJobs(jobsRes.data || []);
      setEstimates(estRes.data || []);
      setClients(cliRes.data || []);
      setDailyLogs(logRes.data || []);
      setJobPhotos(photoRes.data || []);
      setDataLoaded(true);
    })();
    return () => { alive = false; };
  }, [session]);

  const onJobCreated = useCallback((job) => {
    setJobs((j) => [job, ...j]);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setJobs([]); setEstimates([]); setClients([]);
    setDailyLogs([]); setJobPhotos([]);
    setDataLoaded(false);
    toast.info("Signed out");
  };

  // Daily-log alert badge for nav
  const today = new Date().toISOString().slice(0, 10);
  const activeJobs = jobs.filter((j) => j.status === "Active");
  const jobsLoggedToday = new Set(
    dailyLogs.filter((l) => l.log_date === today).map((l) => l.job_id)
  );
  const jobsMissingTodayLog = activeJobs.filter((j) => !jobsLoggedToday.has(j.id));
  const dailyAlertCount = jobsMissingTodayLog.length;

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
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading your workspace...</p>
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
              {dailyAlertCount > 0 && !mobileNavOpen && (
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
              const showBadge = t.id === "Daily" && dailyAlertCount > 0;
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
                    <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {dailyAlertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
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
                  const showBadge = t.id === "Daily" && dailyAlertCount > 0;
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
                        <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {dailyAlertCount}
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
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "Dashboard" && (
              <Dashboard
                jobs={jobs}
                estimates={estimates}
                clients={clients}
                dailyLogs={dailyLogs}
                setTab={setTab}
              />
            )}
            {tab === "Estimator" && (
              <Estimator
                settings={settings}
                estimates={estimates}
                setEstimates={setEstimates}
                onJobCreated={onJobCreated}
                clients={clients}
                jobs={jobs}
              />
            )}
            {tab === "Jobs" && (
              <Jobs
                jobs={jobs}
                setJobs={setJobs}
                clients={clients}
                jobPhotos={jobPhotos}
                setJobPhotos={setJobPhotos}
                dailyLogs={dailyLogs}
                settings={settings}
                estimates={estimates}
              />
            )}
            {tab === "Daily" && (
              <DailyLogs
                jobs={jobs}
                dailyLogs={dailyLogs}
                setDailyLogs={setDailyLogs}
              />
            )}
            {tab === "Schedule" && (
              <Schedule jobs={jobs} />
            )}
            {tab === "Clients" && (
              <Clients
                clients={clients}
                setClients={setClients}
                jobs={jobs}
                estimates={estimates}
              />
            )}
            {tab === "Settings" && (
              <Settings settings={settings} setSettings={setSettings} />
            )}
          </motion.div>
        </AnimatePresence>
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