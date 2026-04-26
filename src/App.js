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

// Northshore logo — base64 encoded JPEG (200px, dark navy bg, blends with header)
const LOGO_BASE64 = "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";

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
                      {jobsMissingTodayLog.length} {jobsMissingTodayLog.length === 1 ? "job needs" : "jobs need"} today\'s log
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
// JOB OPERATIONS — Punch List + Material Deliveries + Photos per Job
// ================================================================
function JobOperations({ job, updateJob, session }) {
  const toast    = useToast();
  const confirm  = useConfirm();
  const [section, setSection] = useState("punch");
  const [punchItems, setPunchItems]     = useState([]);
  const [deliveries, setDeliveries]     = useState([]);
  const [jobPhotos, setJobPhotos]       = useState([]);
  const [loaded, setLoaded]             = useState(false);

  // Punch list form
  const [newPunch, setNewPunch]         = useState("");
  const [newPunchCat, setNewPunchCat]   = useState("general");

  // Delivery form
  const [delDesc, setDelDesc]           = useState("");
  const [delSupplier, setDelSupplier]   = useState("");
  const [delQty, setDelQty]             = useState("");
  const [delCost, setDelCost]           = useState("");
  const [delExpected, setDelExpected]   = useState("");

  const [photoRefresh, setPhotoRefresh] = useState(0);

  // Load punch + deliveries + photos once when this job's panel opens
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [
        { data: pData },
        { data: dData },
        { data: phData },
      ] = await Promise.all([
        supabase.from("punch_list").select("*").eq("job_id", job.id).order("created_at", { ascending: true }),
        supabase.from("material_deliveries").select("*").eq("job_id", job.id).order("created_at", { ascending: false }),
        supabase.from("job_photos").select("*").eq("job_id", job.id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setPunchItems(pData || []);
      setDeliveries(dData || []);
      setJobPhotos(phData || []);
      setLoaded(true);
    }
    load();
    return () => { cancelled = true; };
  }, [job.id, photoRefresh]);

  const totalPunch     = punchItems.length;
  const completedPunch = punchItems.filter((p) => p.completed).length;
  const punchPct       = totalPunch > 0 ? (completedPunch / totalPunch) * 100 : 0;
  const allComplete    = totalPunch > 0 && completedPunch === totalPunch;

  // Deliveries summary
  const pendingDeliveries = deliveries.filter((d) => d.status === "ordered" || d.status === "in_transit").length;
  const overdueDeliveries = deliveries.filter((d) => {
    if (d.status === "delivered" || d.status === "installed") return false;
    if (!d.expected_date) return false;
    return new Date(d.expected_date) < new Date(new Date().toISOString().slice(0, 10));
  }).length;

  // PUNCH LIST handlers
  const addPunchItem = async (e) => {
    e?.stopPropagation?.();
    if (!newPunch.trim()) return;
    const { data, error } = await supabase
      .from("punch_list")
      .insert({ job_id: job.id, item: newPunch, category: newPunchCat, completed: false })
      .select()
      .single();
    if (!error && data) {
      setPunchItems((prev) => [...prev, data]);
      setNewPunch("");
      toast.success("Punch item added");
    } else if (error) {
      toast.error("Failed to add punch item: " + error.message);
    }
  };

  const togglePunchItem = async (item) => {
    const newCompleted = !item.completed;
    const updates = {
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null,
      completed_by: newCompleted ? (session?.user?.email || "unknown") : null,
    };
    const { data, error } = await supabase
      .from("punch_list")
      .update(updates)
      .eq("id", item.id)
      .select()
      .single();
    if (!error && data) {
      setPunchItems((prev) => prev.map((p) => (p.id === data.id ? data : p)));
    } else if (error) {
      toast.error("Update failed: " + error.message);
    }
  };

  const deletePunchItem = async (item) => {
    const ok = await confirm({
      title: "Delete punch item?",
      message: `"${item.item}" will be permanently removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    await supabase.from("punch_list").delete().eq("id", item.id);
    setPunchItems((prev) => prev.filter((p) => p.id !== item.id));
    toast.success("Punch item removed");
  };

  // DELIVERY handlers
  const addDelivery = async (e) => {
    e?.stopPropagation?.();
    if (!delDesc.trim()) { toast.error("Description required"); return; }
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("material_deliveries")
      .insert({
        job_id: job.id,
        description: delDesc,
        supplier: delSupplier || null,
        quantity: delQty || null,
        cost: parseFloat(delCost) || 0,
        status: "ordered",
        ordered_date: today,
        expected_date: delExpected || null,
      })
      .select()
      .single();
    if (!error && data) {
      setDeliveries((prev) => [data, ...prev]);
      setDelDesc(""); setDelSupplier(""); setDelQty(""); setDelCost(""); setDelExpected("");
      toast.success("Delivery tracked");
    } else if (error) {
      toast.error("Failed to add delivery: " + error.message);
    }
  };

  const updateDeliveryStatus = async (id, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === "delivered" || newStatus === "installed") {
      updates.delivered_date = new Date().toISOString().slice(0, 10);
    }
    const { data, error } = await supabase
      .from("material_deliveries")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (!error && data) {
      setDeliveries((prev) => prev.map((d) => (d.id === data.id ? data : d)));
    } else if (error) {
      toast.error("Status update failed: " + error.message);
    }
  };

  const deleteDelivery = async (delivery) => {
    const ok = await confirm({
      title: "Delete delivery record?",
      message: `"${delivery.description}" will be permanently removed from this job's delivery log.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    await supabase.from("material_deliveries").delete().eq("id", delivery.id);
    setDeliveries((prev) => prev.filter((d) => d.id !== delivery.id));
    toast.success("Delivery removed");
  };

  // PHOTO delete
  const deletePhoto = async (photo) => {
    const ok = await confirm({
      title: "Delete this photo?",
      message: "The photo will be permanently removed from storage. This cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    await supabase.storage.from("job-photos").remove([photo.storage_path]);
    await supabase.from("job_photos").delete().eq("id", photo.id);
    setPhotoRefresh((x) => x + 1);
    toast.success("Photo deleted");
  };

  // MARK COMPLETE — gated by punch list completion
  const markJobComplete = async (e) => {
    e?.stopPropagation?.();
    if (!allComplete) {
      toast.error("Cannot mark job complete — punch list still has open items");
      return;
    }
    const ok = await confirm({
      title: "Mark job complete?",
      message: `"${job.name}" will move out of active tracking and into the Archive view. You can still view all data, but it won't appear in active dashboards.`,
      confirmText: "Mark Complete",
    });
    if (!ok) return;
    await updateJob(job.id, { status: "Completed" });
    toast.success(`"${job.name}" marked complete`);
  };

  const punchCategories = ["general", "electrical", "plumbing", "drywall", "paint", "trim", "cleanup", "inspection"];
  const catColors = {
    general:    "bg-slate-800 text-slate-300",
    electrical: "bg-yellow-900/50 text-yellow-300",
    plumbing:   "bg-blue-900/50 text-blue-300",
    drywall:    "bg-purple-900/50 text-purple-300",
    paint:      "bg-pink-900/50 text-pink-300",
    trim:       "bg-orange-900/50 text-orange-300",
    cleanup:    "bg-emerald-900/50 text-emerald-300",
    inspection: "bg-rose-900/50 text-rose-300",
  };

  const statusColors = {
    ordered:    "bg-slate-800 text-slate-300 border-slate-700",
    in_transit: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
    delivered:  "bg-blue-900/50 text-blue-300 border-blue-700",
    installed:  "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  };

  return (
    <div className="pt-4 mt-4 border-t border-slate-800" onClick={(e) => e.stopPropagation()}>
      {/* TAB NAV */}
      <div className="flex flex-wrap gap-2 mb-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "punch",      label: "Punch List",         count: totalPunch > 0 ? `${completedPunch}/${totalPunch}` : "0" },
            { key: "deliveries", label: "Material Deliveries", count: deliveries.length, badge: overdueDeliveries },
            { key: "photos",     label: "Photos",              count: jobPhotos.length },
          ].map((s) => (
            <button
              key={s.key}
              onClick={(e) => { e.stopPropagation(); setSection(s.key); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                section === s.key
                  ? "bg-amber-400 text-black border-amber-400"
                  : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"
              }`}
            >
              {s.label} <span className="opacity-70">({s.count})</span>
              {s.badge > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[10px]">
                  {s.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* MARK COMPLETE BUTTON — gated */}
        {job.status === "Active" && (
          <button
            onClick={markJobComplete}
            disabled={!allComplete}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              allComplete
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
                : "bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed"
            }`}
            title={allComplete ? "Mark this job complete" : "Complete all punch list items first"}
          >
            {allComplete ? "✓ Mark Job Complete" : `🔒 Punch list ${completedPunch}/${totalPunch}`}
          </button>
        )}
      </div>

      {/* PUNCH LIST */}
      {section === "punch" && (
        <div>
          {totalPunch > 0 && (
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Completion</span>
                <span className={allComplete ? "text-emerald-400" : "text-slate-400"}>
                  {round2(punchPct)}% — {completedPunch} of {totalPunch}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full">
                <div
                  className={`h-1.5 rounded-full ${allComplete ? "bg-emerald-500" : "bg-amber-400"}`}
                  style={{ width: `${punchPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Add new punch item */}
          <div className="flex flex-wrap gap-2 mb-3">
            <Inp
              value={newPunch}
              onChange={(e) => setNewPunch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPunchItem(e)}
              placeholder="e.g. Touch up paint above kitchen window"
              className="flex-1 min-w-[200px]"
            />
            <Sel value={newPunchCat} onChange={(e) => setNewPunchCat(e.target.value)} className="w-32">
              {punchCategories.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </Sel>
            <Btn onClick={addPunchItem} className="bg-amber-400 text-black hover:bg-amber-500 text-xs">
              + Add Item
            </Btn>
          </div>

          {/* Items list */}
          {!loaded && <p className="text-xs text-slate-600">Loading...</p>}
          {loaded && punchItems.length === 0 && (
            <p className="text-xs text-slate-600 italic">
              No punch items yet. Add items as you find them. Job cannot be marked complete until every item is checked off.
            </p>
          )}
          <div className="space-y-1.5">
            {punchItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-2 p-2 rounded border transition-all ${
                  item.completed
                    ? "bg-emerald-900/10 border-emerald-900/40"
                    : "bg-slate-900/40 border-slate-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => togglePunchItem(item)}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className={`text-xs px-1.5 py-0.5 rounded uppercase tracking-wider ${catColors[item.category] || catColors.general}`}>
                  {item.category}
                </span>
                <span className={`flex-1 text-sm ${item.completed ? "text-slate-500 line-through" : "text-slate-200"}`}>
                  {item.item}
                </span>
                {item.completed && item.completed_at && (
                  <span className="text-xs text-slate-600">{formatDate(item.completed_at)}</span>
                )}
                <button
                  onClick={() => deletePunchItem(item)}
                  className="text-slate-600 hover:text-rose-400 text-xs px-1"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MATERIAL DELIVERIES */}
      {section === "deliveries" && (
        <div>
          {/* Summary */}
          {deliveries.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-slate-900/40 border border-slate-800 rounded p-2 text-center">
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-lg font-bold text-slate-200">{deliveries.length}</p>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 rounded p-2 text-center">
                <p className="text-xs text-slate-500">Pending</p>
                <p className="text-lg font-bold text-yellow-400">{pendingDeliveries}</p>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 rounded p-2 text-center">
                <p className="text-xs text-slate-500">Overdue</p>
                <p className={`text-lg font-bold ${overdueDeliveries > 0 ? "text-rose-400" : "text-slate-300"}`}>
                  {overdueDeliveries}
                </p>
              </div>
            </div>
          )}

          {/* Add delivery */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 mb-3 space-y-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Add Delivery</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Inp value={delDesc} onChange={(e) => setDelDesc(e.target.value)} placeholder="Description (e.g. 12 sheets 1/2 drywall)" />
              <Inp value={delSupplier} onChange={(e) => setDelSupplier(e.target.value)} placeholder="Supplier (Menards, 84 Lumber...)" />
              <Inp value={delQty} onChange={(e) => setDelQty(e.target.value)} placeholder="Quantity" />
              <Inp type="number" value={delCost} onChange={(e) => setDelCost(e.target.value)} placeholder="Cost $" />
              <div>
                <label className="block text-xs text-slate-500 mb-1">Expected Delivery</label>
                <Inp type="date" value={delExpected} onChange={(e) => setDelExpected(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Btn onClick={addDelivery} className="w-full bg-amber-400 text-black hover:bg-amber-500 text-xs">
                  + Add Delivery
                </Btn>
              </div>
            </div>
          </div>

          {/* Deliveries list */}
          {!loaded && <p className="text-xs text-slate-600">Loading...</p>}
          {loaded && deliveries.length === 0 && (
            <p className="text-xs text-slate-600 italic">
              No deliveries tracked. Add as you place orders so nothing slips through.
            </p>
          )}
          <div className="space-y-1.5">
            {deliveries.map((d) => {
              const isOverdue = d.expected_date &&
                (d.status === "ordered" || d.status === "in_transit") &&
                new Date(d.expected_date) < new Date(new Date().toISOString().slice(0, 10));
              return (
                <div
                  key={d.id}
                  className={`p-2 rounded border ${isOverdue ? "border-rose-700/50 bg-rose-900/10" : "border-slate-800 bg-slate-900/40"}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm font-medium">{d.description}</p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
                        {d.supplier && <span>{d.supplier}</span>}
                        {d.quantity && <span>Qty: {d.quantity}</span>}
                        {d.cost > 0 && <span className="text-amber-400">{currency(d.cost)}</span>}
                        {d.expected_date && (
                          <span className={isOverdue ? "text-rose-400 font-semibold" : ""}>
                            Expected: {formatDate(d.expected_date)} {isOverdue && "⚠ OVERDUE"}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteDelivery(d)} className="text-slate-600 hover:text-rose-400 text-xs">
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {["ordered", "in_transit", "delivered", "installed"].map((s) => (
                      <button
                        key={s}
                        onClick={() => updateDeliveryStatus(d.id, s)}
                        className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border ${
                          d.status === s ? statusColors[s] : "bg-transparent text-slate-600 border-slate-800 hover:border-slate-600"
                        }`}
                      >
                        {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PHOTOS */}
      {section === "photos" && (
        <div>
          <PhotoUploader
            jobId={job.id}
            session={session}
            onUploaded={() => setPhotoRefresh((x) => x + 1)}
          />
          <div className="mt-3">
            {!loaded && <p className="text-xs text-slate-600">Loading...</p>}
            {loaded && (
              <PhotoGallery photos={jobPhotos} onDelete={deletePhoto} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================
// JOBS
// ================================================================
function Jobs({ jobs, setJobs, clients, settings, session }) {
  const toast    = useToast();
  const confirm  = useConfirm();
  const [name, setName]                   = useState("");
  const [budget, setBudget]               = useState("");
  const [status, setStatus]               = useState("Active");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [filter, setFilter]               = useState("All");
  const [loading, setLoading]             = useState(false);
  const [expandedId, setExpandedId]       = useState(null);

  // Change order form state
  const [coJobId, setCoJobId]   = useState(null);
  const [coDesc, setCoDesc]     = useState("");
  const [coAmount, setCoAmount] = useState("");

  const addJob = async () => {
    if (!name || !budget) {
      toast.error("Job name and budget are required");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .insert({
        name,
        budget:    parseFloat(budget),
        actual:    0,
        status,
        notes:     "",
        client_id: selectedClientId || null,
      })
      .select()
      .single();
    if (!error && data) {
      setJobs((j) => [data, ...j]);
      toast.success(`Job "${name}" added`);
      setName(""); setBudget(""); setSelectedClientId("");
    } else {
      toast.error("Failed to add job: " + (error?.message || "Unknown error"));
    }
    setLoading(false);
  };

  // useCallback prevents stale closures in JobOperations child components
  const updateJob = useCallback(async (id, patch) => {
    const { error } = await supabase.from("jobs").update(patch).eq("id", id);
    if (error) {
      toast.error("Update failed: " + error.message);
      return;
    }
    setJobs((j) => j.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, [setJobs, toast]);

  const removeJob = async (job) => {
    const ok = await confirm({
      title: "Remove this job?",
      message: `This will permanently delete "${job.name}" and ALL associated data: punch list items, material deliveries, photos, and daily logs.`,
      confirmText: "Delete Job",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("jobs").delete().eq("id", job.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    setJobs((j) => j.filter((x) => x.id !== job.id));
    toast.success("Job removed");
  };

  const getClientName = (id) => {
    const c = clients.find((c) => c.id === id);
    return c ? c.name : null;
  };

  const handleGenerateCO = (job) => {
    if (!coDesc.trim() || !coAmount) {
      toast.error("Enter a description and amount before generating the change order");
      return;
    }
    const amount = parseFloat(coAmount);
    if (isNaN(amount) || amount === 0) {
      toast.error("Change order amount must be a non-zero number");
      return;
    }
    const client = clients.find((c) => c.id === job.client_id) || null;
    openChangeOrder(
      job, client,
      { description: coDesc, amount },
      settings,
      job.budget || 0
    );
    // CLEAR FORM after generation so next CO doesn't have stale data
    setCoJobId(null);
    setCoDesc("");
    setCoAmount("");
    toast.success("Change order generated");
  };

  const filtered = jobs.filter((j) => {
    if (filter === "All")     return j.status !== "Completed" && j.status !== "Lost";
    if (filter === "Archive") return j.status === "Completed" || j.status === "Lost";
    return j.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <Sel
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-40"
        >
          {["All", "Active", "Estimating", "Paused", "Completed", "Lost", "Archive"].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </Sel>
      </div>

      {/* ADD JOB FORM */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm text-slate-400 font-medium">Add New Job</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Inp
              placeholder="Job name / address"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="md:col-span-2"
            />
            <Inp
              placeholder="Budget $"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <Sel value={status} onChange={(e) => setStatus(e.target.value)}>
              {["Active", "Estimating", "Paused", "Completed", "Lost"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Sel>
            <Sel
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="md:col-span-2"
            >
              <option value="">— Link to client (optional) —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Sel>
            <Btn
              onClick={addJob}
              disabled={loading}
              className="bg-amber-400 text-black hover:bg-amber-500 md:col-span-2"
            >
              Add Job
            </Btn>
          </div>
        </CardContent>
      </Card>

      {/* JOBS TABLE */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-medium">Job</th>
                  <th className="py-3 px-4 font-medium">Client</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Budget</th>
                  <th className="py-3 px-4 font-medium">Actual</th>
                  <th className="py-3 px-4 font-medium">Margin</th>
                  <th className="py-3 px-4 font-medium">Burn</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => {
                  const marginPct = j.budget
                    ? ((j.budget - (j.actual || 0)) / j.budget) * 100
                    : 0;
                  const burnPct = j.budget
                    ? Math.min(100, ((j.actual || 0) / j.budget) * 100)
                    : 0;
                  const burnColor =
                    burnPct < 70 ? "bg-emerald-500" :
                    burnPct < 90 ? "bg-yellow-400"  : "bg-rose-500";
                  const isExpanded = expandedId === j.id;

                  return (
                    <React.Fragment key={j.id}>
                      <tr
                        className="border-b border-slate-800 hover:bg-slate-800/30 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : j.id)}
                      >
                        <td className="py-3 px-4 text-slate-200 font-medium">{j.name}</td>
                        <td className="py-3 px-4 text-slate-400 text-xs">
                          {j.client_id
                            ? (getClientName(j.client_id) || <span className="text-slate-600">—</span>)
                            : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={j.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateJob(j.id, { status: e.target.value })}
                            className={`bg-transparent text-sm ${statusColor(j.status)}`}
                          >
                            {["Active", "Estimating", "Paused", "Completed", "Lost"].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{currency(j.budget)}</td>
                        <td className="py-3 px-4">
                          <Inp
                            type="number"
                            value={j.actual || 0}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              updateJob(j.id, { actual: parseFloat(e.target.value || 0) })
                            }
                            className="w-28 py-1"
                          />
                        </td>
                        <td className={`py-3 px-4 font-semibold ${marginPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {round2(marginPct)}%
                        </td>
                        <td className="py-3 px-4">
                          <div className="w-24 bg-slate-800 h-2 rounded-full">
                            <div
                              className={`h-2 rounded-full ${burnColor}`}
                              style={{ width: `${burnPct}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Btn
                            onClick={(e) => { e.stopPropagation(); removeJob(j); }}
                            className="text-xs py-1 px-2 bg-slate-900"
                          >
                            Remove
                          </Btn>
                        </td>
                      </tr>

                      {/* EXPANDED ROW */}
                      {isExpanded && (
                        <tr className="border-b border-slate-800 bg-slate-900/50">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Job Notes</label>
                                <textarea
                                  value={j.notes || ""}
                                  onChange={(e) => updateJob(j.id, { notes: e.target.value })}
                                  rows={2}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                  placeholder="Add notes..."
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Client</label>
                                <Sel
                                  value={j.client_id || ""}
                                  onChange={(e) =>
                                    updateJob(j.id, { client_id: e.target.value || null })
                                  }
                                >
                                  <option value="">— No client —</option>
                                  {clients.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </Sel>
                              </div>
                              <div className="text-xs text-slate-500 space-y-1">
                                <p>Created: {formatDate(j.created_at)}</p>
                                <p>
                                  Remaining:{" "}
                                  <span className="text-emerald-400">
                                    {currency((j.budget || 0) - (j.actual || 0))}
                                  </span>
                                </p>
                              </div>
                            </div>

                            {/* CHANGE ORDER SECTION */}
                            <div className="pt-4 border-t border-slate-800">
                              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                                Generate Change Order
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <textarea
                                  value={coJobId === j.id ? coDesc : ""}
                                  onChange={(e) => { setCoJobId(j.id); setCoDesc(e.target.value); }}
                                  rows={2}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 md:col-span-2"
                                  placeholder="Describe the additional work..."
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="space-y-2">
                                  <Inp
                                    type="number"
                                    placeholder="Additional amount $"
                                    value={coJobId === j.id ? coAmount : ""}
                                    onChange={(e) => { setCoJobId(j.id); setCoAmount(e.target.value); }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <Btn
                                    onClick={(e) => { e.stopPropagation(); handleGenerateCO(j); }}
                                    className="w-full text-xs bg-amber-400/10 text-amber-400
                                      hover:bg-amber-400/20 border border-amber-900/30 flex items-center justify-center gap-1.5"
                                  >
                                    <FileEdit className="w-3.5 h-3.5" />
                                    Generate Change Order
                                  </Btn>
                                </div>
                              </div>
                            </div>

                            {/* JOB OPERATIONS — Punch List + Material Deliveries + Photos */}
                            <JobOperations
                              job={j}
                              updateJob={updateJob}
                              session={session}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-600">
                      No jobs. Add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ================================================================
// CLIENTS
// ================================================================
function Clients({ clients, setClients, jobs, estimates }) {
  const toast    = useToast();
  const confirm  = useConfirm();
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [company, setCompany]     = useState("");
  const [notes, setNotes]         = useState("");
  const [filter, setFilter]       = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving]       = useState(false);

  const addClient = async () => {
    if (!name.trim()) {
      toast.error("Client name is required");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({ name, email, phone, company, notes, status: "Prospect" })
      .select()
      .single();
    if (!error && data) {
      setClients((c) => [data, ...c]);
      setName(""); setEmail(""); setPhone(""); setCompany(""); setNotes("");
      toast.success(`Client "${name}" added`);
    } else {
      toast.error("Failed to add client: " + (error?.message || "Unknown error"));
    }
    setSaving(false);
  };

  const updateClient = async (id, patch) => {
    const { error } = await supabase.from("clients").update(patch).eq("id", id);
    if (error) {
      toast.error("Update failed: " + error.message);
      return;
    }
    setClients((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeClient = async (client) => {
    const linkedJobs = jobs.filter((j) => j.client_id === client.id);
    const linkedEsts = estimates.filter((e) => e.client_id === client.id);

    let message = `"${client.name}" will be permanently deleted.`;
    let details = null;

    if (linkedJobs.length > 0 || linkedEsts.length > 0) {
      message = `"${client.name}" will be permanently deleted.\n\nLinked records will lose their client connection but will NOT be deleted:`;
      const jobLines = linkedJobs.map((j) => `• Job: ${j.name} (${j.status})`).join("\n");
      const estLines = linkedEsts.map((e) => `• Estimate: ${e.name} — ${currency(e.grand_total)}`).join("\n");
      details = [jobLines, estLines].filter(Boolean).join("\n");
    }

    const ok = await confirm({
      title: "Delete this client?",
      message,
      details,
      confirmText: "Delete Client",
      danger: true,
    });
    if (!ok) return;

    const { error } = await supabase.from("clients").delete().eq("id", client.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    setClients((c) => c.filter((x) => x.id !== client.id));
    toast.success(`"${client.name}" deleted`);
  };

  const filtered        = clients.filter((c) => filter === "All" || c.status === filter);
  const getClientJobs   = (id) => jobs.filter((j) => j.client_id === id);
  const getClientEsts   = (id) => estimates.filter((e) => e.client_id === id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Clients</h1>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-sm">{clients.length} total</span>
          <Sel
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-36"
          >
            {["All", "Prospect", "Active", "Closed"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Sel>
        </div>
      </div>

      {/* ADD CLIENT FORM */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm text-slate-400 font-medium">Add Client</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Inp placeholder="Full name *" value={name}    onChange={(e) => setName(e.target.value)} />
            <Inp placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} />
            <Inp placeholder="Phone"  value={phone}   onChange={(e) => setPhone(e.target.value)} />
            <Inp placeholder="Email"  value={email}   onChange={(e) => setEmail(e.target.value)} />
            <Inp placeholder="Notes"  value={notes}   onChange={(e) => setNotes(e.target.value)} />
            <Btn onClick={addClient} className="bg-amber-400 text-black hover:bg-amber-500">
              Add Client
            </Btn>
          </div>
        </CardContent>
      </Card>

      {/* CLIENTS TABLE */}
      <Card>
        <CardContent className="p-0">
          {(
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 font-medium">Name</th>
                    <th className="py-3 px-4 font-medium">Contact</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Jobs</th>
                    <th className="py-3 px-4 font-medium">Estimates</th>
                    <th className="py-3 px-4 font-medium">Added</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const cJobs = getClientJobs(c.id);
                    const cEsts = getClientEsts(c.id);
                    const isExp = expandedId === c.id;

                    return (
                      <React.Fragment key={c.id}>
                        <tr
                          className="border-b border-slate-800 hover:bg-slate-800/20 cursor-pointer"
                          onClick={() => setExpandedId(isExp ? null : c.id)}
                        >
                          <td className="py-3 px-4">
                            <p className="text-slate-200 font-medium">{c.name}</p>
                            {c.company && (
                              <p className="text-slate-500 text-xs">{c.company}</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-xs">
                            {c.email && <p>{c.email}</p>}
                            {c.phone && <p>{formatPhone(c.phone)}</p>}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={c.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateClient(c.id, { status: e.target.value })}
                              className={`bg-transparent text-sm ${statusColor(c.status)}`}
                            >
                              {["Prospect", "Active", "Closed"].map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4 text-slate-300 text-xs">
                            {cJobs.length} job{cJobs.length !== 1 ? "s" : ""}
                          </td>
                          <td className="py-3 px-4 text-slate-300 text-xs">
                            {cEsts.length} estimate{cEsts.length !== 1 ? "s" : ""}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-xs">
                            {formatDate(c.created_at)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Btn
                              onClick={(e) => { e.stopPropagation(); removeClient(c); }}
                              className="text-xs py-1 px-2 bg-slate-900"
                            >
                              Remove
                            </Btn>
                          </td>
                        </tr>

                        {isExp && (
                          <tr className="border-b border-slate-800 bg-slate-900/50">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Jobs</p>
                                  {cJobs.length === 0 ? (
                                    <p className="text-slate-600 text-xs">No jobs linked</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {cJobs.map((j) => (
                                        <div
                                          key={j.id}
                                          className="flex justify-between items-center text-xs py-1 border-b border-slate-800"
                                        >
                                          <span className="text-slate-300">{j.name}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-slate-500">{currency(j.budget)}</span>
                                            <Badge
                                              label={j.status}
                                              color={
                                                j.status === "Active"    ? "green" :
                                                j.status === "Completed" ? "blue"  : "gray"
                                              }
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Estimates</p>
                                  {cEsts.length === 0 ? (
                                    <p className="text-slate-600 text-xs">No estimates linked</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {cEsts.map((e) => (
                                        <div
                                          key={e.id}
                                          className="flex justify-between items-center text-xs py-1 border-b border-slate-800"
                                        >
                                          <span className="text-slate-300">{e.name}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-amber-400">{currency(e.grand_total)}</span>
                                            <Badge
                                              label={e.status}
                                              color={
                                                e.status === "Approved" ? "green" :
                                                e.status === "Sent"     ? "yellow" : "gray"
                                              }
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3">
                                <label className="text-xs text-slate-500 block mb-1">Notes</label>
                                <Inp
                                  value={c.notes || ""}
                                  onChange={(e) => updateClient(c.id, { notes: e.target.value })}
                                  className="text-xs"
                                  placeholder="Notes..."
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-600">
                        No clients yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ================================================================
// SCHEDULE
// ================================================================
function Schedule({ jobs }) {
  const toast    = useToast();
  const confirm  = useConfirm();
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle]     = useState("");
  const [job, setJob]         = useState("");
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    supabase
      .from("schedule")
      .select("*")
      .order("date", { ascending: true })
      .then(({ data }) => { if (data) setEvents(data); setLoading(false); });
  }, []);

  const addEvent = async () => {
    if (!title.trim() || !date) {
      toast.error("Title and date are required");
      return;
    }
    const { data, error } = await supabase
      .from("schedule")
      .insert({ title, job: job || "General", date, status: "Active", type: "Task" })
      .select()
      .single();
    if (!error && data) {
      setEvents((e) => [...e, data].sort((a, b) => new Date(a.date) - new Date(b.date)));
      setTitle("");
      toast.success("Event added");
    } else if (error) {
      toast.error("Failed to add event: " + error.message);
    }
  };

  const updateEvent = async (id, patch) => {
    const { error } = await supabase.from("schedule").update(patch).eq("id", id);
    if (error) {
      toast.error("Update failed: " + error.message);
      return;
    }
    setEvents((e) => e.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeEvent = async (event) => {
    const ok = await confirm({
      title: "Delete event?",
      message: `"${event.title}" will be permanently removed from the schedule.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    await supabase.from("schedule").delete().eq("id", event.id);
    setEvents((e) => e.filter((x) => x.id !== event.id));
    toast.success("Event removed");
  };

  const today    = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today && e.status !== "Completed");
  const past     = events.filter((e) => e.date < today  || e.status === "Completed");

  const renderTable = (items, label) => (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
          {label} ({items.length})
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-800 text-xs">
              <th className="py-2 font-medium">Date</th>
              <th className="font-medium">Title</th>
              <th className="font-medium">Job</th>
              <th className="font-medium">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                <td className="py-2 text-slate-300 font-medium">{formatDate(e.date)}</td>
                <td className="py-2 text-slate-200">{e.title}</td>
                <td className="py-2 text-slate-400 text-xs">{e.job}</td>
                <td className="py-2">
                  <select
                    value={e.status}
                    onChange={(ev) => updateEvent(e.id, { status: ev.target.value })}
                    className={`bg-transparent text-sm ${statusColor(e.status)}`}
                  >
                    {["Active", "Completed", "Paused"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 text-right">
                  <Btn
                    onClick={() => removeEvent(e)}
                    className="text-xs py-1 px-2 bg-slate-900"
                  >
                    ✕
                  </Btn>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-slate-600 text-center">None</td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Schedule</h1>
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm text-slate-400 font-medium">Add Task / Event</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Inp
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="md:col-span-2"
            />
            <Sel value={job} onChange={(e) => setJob(e.target.value)}>
              <option value="">General</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.name}>{j.name}</option>
              ))}
            </Sel>
            <Inp
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Btn
              onClick={addEvent}
              className="bg-amber-400 text-black hover:bg-amber-500 md:col-span-4"
            >
              Add
            </Btn>
          </div>
        </CardContent>
      </Card>
      {loading ? <Spinner /> : (
        <>
          {renderTable(upcoming, "Upcoming")}
          {renderTable(past, "Past / Completed")}
        </>
      )}
    </div>
  );
}

// ================================================================
// PHOTO UPLOADER (used by Daily Logs and Job views)
// ================================================================
function PhotoUploader({ jobId, dailyLogId = null, session, onUploaded, compact = false }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState("during");
  const [caption, setCaption] = useState("");

  const compressImage = (file, maxWidth = 1600, quality = 0.82) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error("Compression failed")),
            "image/jpeg",
            quality
          );
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploadedBy = session?.user?.email || "unknown";
    let successCount = 0;
    let failCount = 0;

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.warn(`Skipped ${file.name} — not an image`);
          failCount++;
          continue;
        }

        const compressed = await compressImage(file);
        const ext = "jpg";
        const filename = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("job-photos")
          .upload(filename, compressed, {
            cacheControl: "3600",
            contentType: "image/jpeg",
            upsert: false,
          });

        if (uploadErr) {
          toast.error(`Upload failed: ${uploadErr.message}`);
          failCount++;
          continue;
        }

        const { error: insertErr } = await supabase.from("job_photos").insert({
          job_id: jobId,
          daily_log_id: dailyLogId,
          storage_path: filename,
          phase,
          caption: caption || null,
          uploaded_by: uploadedBy,
        });

        if (insertErr) {
          toast.error(`Save failed: ${insertErr.message}`);
          failCount++;
        } else {
          successCount++;
        }
      }

      setCaption("");
      if (successCount > 0) {
        toast.success(`${successCount} photo${successCount > 1 ? "s" : ""} uploaded`);
      }
      if (onUploaded) onUploaded();
    } catch (err) {
      toast.error("Upload error: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`bg-slate-900/60 border border-slate-700 rounded-lg ${compact ? "p-2" : "p-3"}`}>
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "mb-2"}`}>
        <Sel value={phase} onChange={(e) => setPhase(e.target.value)} className="w-32">
          <option value="before">Before</option>
          <option value="during">During</option>
          <option value="after">After</option>
          <option value="issues">Issue / Problem</option>
        </Sel>
        {!compact && (
          <Inp
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Optional caption"
            className="flex-1 min-w-[150px]"
          />
        )}
        <label
          className={`px-3 py-2 rounded-lg font-medium cursor-pointer transition-colors text-sm whitespace-nowrap ${
            uploading
              ? "bg-slate-700 text-slate-400 cursor-wait"
              : "bg-amber-400 text-black hover:bg-amber-500"
          }`}
        >
          {uploading ? (
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 animate-spin" /> Uploading...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Camera className="w-4 h-4" /> Upload Photos
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
        </label>
      </div>
      {!compact && (
        <p className="text-xs text-slate-600 mt-1">
          Tap to take a photo or upload from gallery. Auto-compressed before upload.
        </p>
      )}
    </div>
  );
}

// ================================================================
// PHOTO GALLERY (displays photos for a job or daily log)
// ================================================================
function PhotoGallery({ photos, onDelete, compact = false }) {
  const [enlarged, setEnlarged] = useState(null);

  const getPublicUrl = (path) => {
    const { data } = supabase.storage.from("job-photos").getPublicUrl(path);
    return data?.publicUrl;
  };

  const phaseColors = {
    before: "bg-blue-900/60 text-blue-300 border-blue-700",
    during: "bg-amber-900/60 text-amber-300 border-amber-700",
    after:  "bg-emerald-900/60 text-emerald-300 border-emerald-700",
    issues: "bg-rose-900/60 text-rose-300 border-rose-700",
  };

  if (!photos || photos.length === 0) {
    return (
      <p className="text-slate-600 text-xs italic">No photos uploaded yet.</p>
    );
  }

  return (
    <>
      <div className={`grid gap-2 ${compact ? "grid-cols-3 md:grid-cols-4" : "grid-cols-2 md:grid-cols-4 lg:grid-cols-5"}`}>
        {photos.map((p) => {
          const url = getPublicUrl(p.storage_path);
          return (
            <div key={p.id} className="relative group">
              <img
                src={url}
                alt={p.caption || "Job photo"}
                onClick={() => setEnlarged(p)}
                className="w-full h-24 object-cover rounded-lg cursor-pointer border border-slate-700 hover:border-amber-400 transition-colors"
              />
              <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${phaseColors[p.phase] || phaseColors.during} uppercase tracking-wider`}>
                {p.phase}
              </div>
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(p); }}
                  className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500"
                  title="Delete photo"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* LIGHTBOX */}
      {enlarged && (
        <div
          onClick={() => setEnlarged(null)}
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="max-w-4xl max-h-[90vh] flex flex-col items-center gap-3">
            <img
              src={getPublicUrl(enlarged.storage_path)}
              alt={enlarged.caption || "Job photo"}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="text-center text-white text-sm">
              <div className="flex items-center justify-center gap-3 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${phaseColors[enlarged.phase] || phaseColors.during} uppercase`}>
                  {enlarged.phase}
                </span>
                <span className="text-slate-400 text-xs">{formatDate(enlarged.created_at)}</span>
              </div>
              {enlarged.caption && <p className="text-slate-300 italic">{enlarged.caption}</p>}
              <p className="text-slate-600 text-xs mt-1">Click anywhere to close</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ================================================================
// DAILY LOGS
// ================================================================
function DailyLogs({ jobs, clients, dailyLogs, setDailyLogs, session }) {
  const toast    = useToast();
  const confirm  = useConfirm();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [logDate, setLogDate]             = useState(today);
  const [weather, setWeather]             = useState("");
  const [temperature, setTemperature]     = useState("");
  const [hoursConnor, setHoursConnor]     = useState("");
  const [hoursDad, setHoursDad]           = useState("");
  const [hoursOther, setHoursOther]       = useState("");
  const [otherWorker, setOtherWorker]     = useState("");
  const [workPerformed, setWorkPerformed] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [issues, setIssues]               = useState("");
  const [visitors, setVisitors]           = useState("");
  const [saving, setSaving]               = useState(false);
  const [editingLogId, setEditingLogId]   = useState(null);
  const [photos, setPhotos]               = useState([]);
  const [photoRefresh, setPhotoRefresh]   = useState(0);

  const activeJobs = jobs.filter((j) => j.status === "Active");
  const jobsLoggedToday = new Set(
    dailyLogs.filter((l) => l.log_date === today).map((l) => l.job_id)
  );

  const getClientName = (clientId) => {
    const c = clients.find((c) => c.id === clientId);
    return c ? c.name : null;
  };

  // Load photos for the currently selected job + date
  useEffect(() => {
    if (!selectedJobId) { setPhotos([]); return; }
    let log_id = editingLogId;
    if (!log_id) {
      const existing = dailyLogs.find(
        (l) => l.job_id === selectedJobId && l.log_date === logDate
      );
      log_id = existing?.id;
    }

    if (log_id) {
      supabase
        .from("job_photos")
        .select("*")
        .eq("daily_log_id", log_id)
        .order("created_at", { ascending: false })
        .then(({ data }) => { if (data) setPhotos(data); });
    } else {
      setPhotos([]);
    }
  }, [selectedJobId, logDate, editingLogId, dailyLogs, photoRefresh]);

  const resetForm = () => {
    setWeather(""); setTemperature("");
    setHoursConnor(""); setHoursDad(""); setHoursOther(""); setOtherWorker("");
    setWorkPerformed(""); setMaterialsUsed(""); setIssues(""); setVisitors("");
    setEditingLogId(null);
  };

  const loadExistingLog = (jobId, date) => {
    const existing = dailyLogs.find(
      (l) => l.job_id === jobId && l.log_date === date
    );
    if (existing) {
      setWeather(existing.weather || "");
      setTemperature(existing.temperature || "");
      setHoursConnor(existing.hours_connor || "");
      setHoursDad(existing.hours_dad || "");
      setHoursOther(existing.hours_other || "");
      setOtherWorker(existing.other_worker_name || "");
      setWorkPerformed(existing.work_performed || "");
      setMaterialsUsed(existing.materials_used || "");
      setIssues(existing.issues || "");
      setVisitors(existing.visitors || "");
      setEditingLogId(existing.id);
    } else {
      resetForm();
    }
  };

  const handleSelectJob = (jobId) => {
    setSelectedJobId(jobId);
    setLogDate(today);
    loadExistingLog(jobId, today);
  };

  const handleDateChange = (newDate) => {
    setLogDate(newDate);
    if (selectedJobId) loadExistingLog(selectedJobId, newDate);
  };

  const saveLog = async () => {
    if (!selectedJobId) { toast.error("Select a job first"); return; }
    if (!workPerformed.trim()) {
      toast.error("Work Performed is required — describe what was done today");
      return;
    }

    setSaving(true);
    const createdBy = session?.user?.email || "unknown";

    const payload = {
      job_id: selectedJobId,
      log_date: logDate,
      weather: weather || null,
      temperature: temperature ? parseInt(temperature) : null,
      hours_connor: parseFloat(hoursConnor) || 0,
      hours_dad: parseFloat(hoursDad) || 0,
      hours_other: parseFloat(hoursOther) || 0,
      other_worker_name: otherWorker || null,
      work_performed: workPerformed,
      materials_used: materialsUsed || null,
      issues: issues || null,
      visitors: visitors || null,
      created_by: createdBy,
    };

    if (editingLogId) {
      const { data, error } = await supabase
        .from("daily_logs")
        .update(payload)
        .eq("id", editingLogId)
        .select()
        .single();

      if (!error && data) {
        setDailyLogs((prev) => prev.map((l) => (l.id === data.id ? data : l)));
        toast.success("Log updated");
      } else {
        toast.error("Update failed: " + (error?.message || "Unknown error"));
      }
    } else {
      const { data, error } = await supabase
        .from("daily_logs")
        .insert(payload)
        .select()
        .single();

      if (!error && data) {
        setDailyLogs((prev) => [data, ...prev]);
        setEditingLogId(data.id);
        toast.success("Log saved — you can now attach photos");
      } else {
        toast.error("Save failed: " + (error?.message || "Unknown error"));
      }
    }

    setSaving(false);
  };

  const deletePhoto = async (photo) => {
    const ok = await confirm({
      title: "Delete this photo?",
      message: "The photo will be permanently removed from storage.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    await supabase.storage.from("job-photos").remove([photo.storage_path]);
    await supabase.from("job_photos").delete().eq("id", photo.id);
    setPhotoRefresh((x) => x + 1);
    toast.success("Photo deleted");
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const totalHours = (parseFloat(hoursConnor) || 0) + (parseFloat(hoursDad) || 0) + (parseFloat(hoursOther) || 0);

  // Past logs for selected job
  const jobPastLogs = selectedJobId
    ? dailyLogs.filter((l) => l.job_id === selectedJobId).slice(0, 14)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Daily Logs</h1>
          <p className="text-slate-500 text-sm mt-1">
            End-of-day update required for every active job. Today: {new Date(today).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* ACTIVE JOBS NEEDING LOGS */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Active Jobs — Today's Status
            </p>
            <span className="text-xs text-slate-600">
              {activeJobs.length - jobsLoggedToday.size} of {activeJobs.length} pending
            </span>
          </div>
          {activeJobs.length === 0 && (
            <p className="text-slate-600 text-sm italic">
              No active jobs. Mark a job as Active in the Jobs tab to log work.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeJobs.map((j) => {
              const logged = jobsLoggedToday.has(j.id);
              const isSelected = selectedJobId === j.id;
              return (
                <button
                  key={j.id}
                  onClick={() => handleSelectJob(j.id)}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-amber-400 bg-amber-900/20"
                      : logged
                      ? "border-emerald-700/40 bg-emerald-900/10 hover:border-emerald-600"
                      : "border-rose-700/50 bg-rose-900/10 hover:border-rose-600"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-slate-200 font-medium text-sm truncate">{j.name}</span>
                    <span
                      className={`shrink-0 w-2.5 h-2.5 rounded-full ${
                        logged ? "bg-emerald-400" : "bg-rose-400"
                      }`}
                      title={logged ? "Logged today" : "Needs today's log"}
                    />
                  </div>
                  {j.client_id && getClientName(j.client_id) && (
                    <p className="text-slate-500 text-xs">{getClientName(j.client_id)}</p>
                  )}
                  <p className={`text-xs mt-1 ${logged ? "text-emerald-400" : "text-rose-400"}`}>
                    {logged ? "✓ Logged today" : "● Needs today's log"}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* LOG ENTRY FORM */}
      {selectedJobId && (
        <Card className="border-amber-900/40">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  {editingLogId ? "Editing Log" : "New Log"}
                </p>
                <h2 className="text-lg font-bold text-slate-100">{selectedJob?.name}</h2>
                {selectedJob?.client_id && getClientName(selectedJob.client_id) && (
                  <p className="text-slate-500 text-xs">{getClientName(selectedJob.client_id)}</p>
                )}
              </div>
              <button
                onClick={() => { setSelectedJobId(""); resetForm(); }}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                ✕ Close
              </button>
            </div>

            {/* DATE */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Log Date</label>
              <Inp
                type="date"
                value={logDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-44"
              />
            </div>

            {/* WEATHER + TEMP */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Weather</label>
                <Sel value={weather} onChange={(e) => setWeather(e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="Sunny / Clear">Sunny / Clear</option>
                  <option value="Partly Cloudy">Partly Cloudy</option>
                  <option value="Overcast">Overcast</option>
                  <option value="Rain">Rain</option>
                  <option value="Heavy Rain">Heavy Rain</option>
                  <option value="Snow">Snow</option>
                  <option value="Wind">Wind</option>
                  <option value="Storm">Storm</option>
                </Sel>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Temperature (°F)</label>
                <Inp
                  type="number"
                  placeholder="e.g. 68"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </div>
            </div>

            {/* HOURS PER PERSON */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                Hours Worked
                {totalHours > 0 && (
                  <span className="text-amber-400 ml-2">({totalHours.toFixed(1)} total)</span>
                )}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Connor</p>
                  <Inp
                    type="number"
                    step="0.25"
                    placeholder="Hours"
                    value={hoursConnor}
                    onChange={(e) => setHoursConnor(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Dad</p>
                  <Inp
                    type="number"
                    step="0.25"
                    placeholder="Hours"
                    value={hoursDad}
                    onChange={(e) => setHoursDad(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">
                    Other {otherWorker && `(${otherWorker})`}
                  </p>
                  <div className="flex gap-2">
                    <Inp
                      type="number"
                      step="0.25"
                      placeholder="Hours"
                      value={hoursOther}
                      onChange={(e) => setHoursOther(e.target.value)}
                    />
                    <Inp
                      placeholder="Name"
                      value={otherWorker}
                      onChange={(e) => setOtherWorker(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* WORK PERFORMED */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Work Performed <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={workPerformed}
                onChange={(e) => setWorkPerformed(e.target.value)}
                rows={4}
                placeholder="Describe what was completed today. Be specific — this is your record if a dispute comes up later."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>

            {/* MATERIALS USED */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Materials Used Today</label>
              <textarea
                value={materialsUsed}
                onChange={(e) => setMaterialsUsed(e.target.value)}
                rows={2}
                placeholder="e.g. 12 sheets 1/2 drywall, 4 boxes screws, 3 tubes adhesive..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>

            {/* ISSUES + VISITORS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Issues / Problems</label>
                <textarea
                  value={issues}
                  onChange={(e) => setIssues(e.target.value)}
                  rows={2}
                  placeholder="Anything go wrong? Damaged materials, weather delays, code questions..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Visitors / Inspectors</label>
                <textarea
                  value={visitors}
                  onChange={(e) => setVisitors(e.target.value)}
                  rows={2}
                  placeholder="Who showed up? Inspector name, sub, client visit, supplier delivery..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
            </div>

            {/* SAVE BUTTON */}
            <div className="flex gap-2">
              <Btn
                onClick={saveLog}
                disabled={saving}
                className="bg-amber-400 text-black hover:bg-amber-500 font-semibold flex-1"
              >
                {saving ? "Saving..." : editingLogId ? "Update Log" : "Save Log"}
              </Btn>
            </div>

            {/* PHOTO UPLOADER — only shown after log is saved */}
            {editingLogId && (
              <div className="pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                  Photos for this log
                </p>
                <PhotoUploader
                  jobId={selectedJobId}
                  dailyLogId={editingLogId}
                  session={session}
                  onUploaded={() => setPhotoRefresh((x) => x + 1)}
                />
                <div className="mt-3">
                  <PhotoGallery photos={photos} onDelete={deletePhoto} />
                </div>
              </div>
            )}
            {!editingLogId && (
              <p className="text-xs text-slate-600 italic">
                💡 Save the log first, then you can attach photos.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* PAST LOGS FOR SELECTED JOB */}
      {selectedJobId && jobPastLogs.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
              Past Logs for {selectedJob?.name} ({jobPastLogs.length})
            </p>
            <div className="space-y-2">
              {jobPastLogs.map((l) => {
                const totalH = (l.hours_connor || 0) + (l.hours_dad || 0) + (l.hours_other || 0);
                const isCurrentlyEditing = editingLogId === l.id;
                return (
                  <div
                    key={l.id}
                    onClick={() => { setLogDate(l.log_date); loadExistingLog(selectedJobId, l.log_date); }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isCurrentlyEditing
                        ? "border-amber-400 bg-amber-900/10"
                        : "border-slate-800 hover:border-slate-700 bg-slate-900/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-slate-200 font-semibold text-sm">{formatDate(l.log_date)}</span>
                        {l.weather && <span className="text-xs text-slate-500">{l.weather}{l.temperature && ` · ${l.temperature}°F`}</span>}
                      </div>
                      <span className="text-amber-400 text-xs font-semibold">{totalH.toFixed(1)}h</span>
                    </div>
                    <p className="text-slate-400 text-xs line-clamp-2">{l.work_performed}</p>
                    {l.issues && (
                      <p className="text-rose-400 text-xs mt-1">⚠ {l.issues}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ================================================================
// SETTINGS
// ================================================================
function Settings({ settings, setSettings }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...settings });

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const saveSettings = () => {
    const saved = {
      ...form,
      overheadPct: parseFloat(form.overheadPct) || 0,
      profitPct:   parseFloat(form.profitPct)   || 0,
      salesTaxPct: parseFloat(form.salesTaxPct) || 0,
      laborRate:   parseFloat(form.laborRate)   || 95,
    };
    setSettings(saved);
    localStorage.setItem("northshore_settings", JSON.stringify(saved));
    toast.success("Settings saved");
  };

  const totalMarkup =
    (parseFloat(form.overheadPct) || 0) + (parseFloat(form.profitPct) || 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COMPANY INFO */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-300">Company Info</p>
            {[
              ["Company Name",   "companyName",    "text"],
              ["Phone",          "companyPhone",   "tel"],
              ["Email",          "companyEmail",   "email"],
              ["Address",        "companyAddress", "text"],
              ["License Number", "licenseNumber",  "text"],
              ["Website",        "website",        "text"],
            ].map(([label, field, type]) => (
              <div key={field}>
                <label className="block text-xs text-slate-500 mb-1">{label}</label>
                <Inp
                  type={type}
                  value={form[field] || ""}
                  onChange={(e) => update(field, e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ESTIMATE DEFAULTS */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-300">Estimate Defaults</p>

            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Default Labor Rate ($/hr)
              </label>
              <Inp
                type="number"
                value={form.laborRate || 95}
                onChange={(e) => update("laborRate", e.target.value)}
              />
              <p className="text-xs text-slate-600 mt-0.5">
                Suggested minimum: $95/hr for a licensed builder in West Michigan
              </p>
            </div>

            {[
              ["Overhead %", "overheadPct", "Applied to subtotal for business costs"],
              ["Profit %",   "profitPct",   "Your margin on top of costs"],
            ].map(([label, key, hint]) => (
              <div key={key}>
                <label className="block text-xs text-slate-500 mb-1">{label}</label>
                <Inp
                  type="number"
                  value={form[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
                <p className="text-xs text-slate-600 mt-0.5">{hint}</p>
              </div>
            ))}

            <div className="bg-amber-900/20 rounded-lg p-3 border border-amber-900/40">
              <p className="text-xs text-amber-400/90 font-medium mb-1">
                Michigan Sales Tax — Do Not Charge Clients
              </p>
              <p className="text-xs text-slate-500">
                Per Michigan RAB 2025-18, residential contractors pay sales tax
                when purchasing materials and do NOT add a sales tax line to
                client proposals. Tax is absorbed into material pricing.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <p className="text-xs text-slate-400">
                Total markup:{" "}
                <span className="text-amber-400 font-semibold">
                  {totalMarkup.toFixed(1)}%
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                A $10,000 job costs ~{currency(10000 * (1 + totalMarkup / 100))} to client
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Btn
        onClick={saveSettings}
        className="bg-amber-400 text-black hover:bg-amber-500 px-8"
      >
        Save All Settings
      </Btn>
    </div>
  );
}

// ================================================================
// APP ROOT
// ================================================================
const DEFAULT_SETTINGS = {
  overheadPct:    12.5,
  profitPct:      10,
  salesTaxPct:    6,
  laborRate:      95,
  companyName:    "Northshore Mechanical & Construction LLC",
  companyPhone:   "(231) 760-7013",
  companyEmail:   "connor@northshorebuildsmi.com",
  companyAddress: "1276 Sauter St, Muskegon, MI 49442",
  licenseNumber:  "242501434",
  website:        "northshorebuildsmi.com",
};

const TABS = ["Dashboard", "Estimator", "Jobs", "Daily", "Schedule", "Clients", "Settings"];

// Wrap the entire app with Toast + Confirm providers so any component
// can use useToast() and useConfirm() without prop drilling.
export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <GlobalStyles />
        <AppInner />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function AppInner() {
  const [tab, setTab]           = useState("Dashboard");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [jobs, setJobs]         = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [clients, setClients]   = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [session, setSession]   = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Load persisted settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("northshore_settings");
      if (saved) setSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {}
  }, []);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Data load — only runs after auth
  useEffect(() => {
    if (!session) return;
    async function loadData() {
      const [
        { data: jobsData },
        { data: estimatesData },
        { data: clientsData },
        { data: dailyLogsData },
      ] = await Promise.all([
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("estimates").select("*").order("created_at", { ascending: false }),
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("daily_logs").select("*").order("log_date", { ascending: false }),
      ]);
      if (jobsData)       setJobs(jobsData);
      if (estimatesData)  setEstimates(estimatesData);
      if (clientsData)    setClients(clientsData);
      if (dailyLogsData)  setDailyLogs(dailyLogsData);
      setLoading(false);
    }
    loadData();
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setJobs([]);
    setEstimates([]);
    setClients([]);
    setDailyLogs([]);
  };

  const handleJobCreated    = (job) => setJobs((prev) => [job, ...prev]);

  // AUTH CHECK SPINNER
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // NOT LOGGED IN
  if (!session) return <LoginScreen onLogin={setSession} />;

  // DATA LOADING
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading Northshore OS...</p>
        </div>
      </div>
    );
  }

  // Daily log warning count for header badge
  const todayStr = new Date().toISOString().slice(0, 10);
  const jobsLoggedTodayHeader = new Set(
    dailyLogs.filter((l) => l.log_date === todayStr).map((l) => l.job_id)
  );
  const dailyAlertCount = jobs
    .filter((j) => j.status === "Active" && !jobsLoggedTodayHeader.has(j.id))
    .length;

  const tabIcons = {
    Dashboard: LayoutDashboard,
    Estimator: Calculator,
    Jobs:      Briefcase,
    Daily:     ClipboardList,
    Schedule:  Calendar,
    Clients:   Users,
    Settings:  SettingsIcon,
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-black/85 backdrop-blur-md border-b border-gray-800/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-900/40">
              <span className="text-black font-black text-base">N</span>
            </div>
            <div>
              <h1 className="text-base font-bold leading-none tracking-tight">Northshore OS</h1>
              <p className="text-[10px] text-slate-500 leading-none mt-1 uppercase tracking-wider">
                Mechanical & Construction
              </p>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileNavOpen((o) => !o)}
            className="md:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800"
            aria-label="Menu"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map((t) => {
              const Icon = tabIcons[t];
              const active = tab === t;
              const showAlert = t === "Daily" && dailyAlertCount > 0;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    active
                      ? "bg-amber-400 text-black shadow-md shadow-amber-900/30"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {t}
                  {showAlert && !active && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-lg">
                      {dailyAlertCount}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-500
                hover:text-rose-400 hover:bg-rose-900/20 transition-all ml-2 border border-slate-800
                flex items-center gap-2"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">Sign Out</span>
            </button>
          </nav>
        </div>

        {/* Mobile nav drawer */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden"
            >
              <div className="pt-3 pb-1 grid grid-cols-2 gap-2">
                {TABS.map((t) => {
                  const Icon = tabIcons[t];
                  const active = tab === t;
                  const showAlert = t === "Daily" && dailyAlertCount > 0;
                  return (
                    <button
                      key={t}
                      onClick={() => { setTab(t); setMobileNavOpen(false); }}
                      className={`relative px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                        active
                          ? "bg-amber-400 text-black"
                          : "bg-slate-900 text-gray-400 border border-slate-800"
                      }`}
                    >
                      {Icon && <Icon className="w-4 h-4" />}
                      {t}
                      {showAlert && !active && (
                        <span className="ml-1 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                          {dailyAlertCount}
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={() => { handleLogout(); setMobileNavOpen(false); }}
                  className="col-span-2 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-400 bg-rose-900/20 border border-rose-900/40 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* MAIN */}
      <main className="flex-1 p-4 md:p-6 max-w-screen-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "Dashboard"  && <Dashboard  jobs={jobs} estimates={estimates} clients={clients} dailyLogs={dailyLogs} setTab={setTab} />}
            {tab === "Estimator"  && <Estimator  settings={settings} estimates={estimates} setEstimates={setEstimates} onJobCreated={handleJobCreated} clients={clients} jobs={jobs} />}
            {tab === "Jobs"       && <Jobs       jobs={jobs} setJobs={setJobs} clients={clients} settings={settings} session={session} />}
            {tab === "Daily"      && <DailyLogs  jobs={jobs} clients={clients} dailyLogs={dailyLogs} setDailyLogs={setDailyLogs} session={session} />}
            {tab === "Schedule"   && <Schedule   jobs={jobs} />}
            {tab === "Clients"    && <Clients    clients={clients} setClients={setClients} jobs={jobs} estimates={estimates} />}
            {tab === "Settings"   && <Settings   settings={settings} setSettings={setSettings} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="py-3 text-center text-xs text-slate-700 border-t border-slate-900">
        © {new Date().getFullYear()} Northshore Mechanical & Construction LLC — Internal Use Only
      </footer>
    </div>
  );
}