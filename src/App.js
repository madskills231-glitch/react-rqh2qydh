import React, { useState, useEffect, createContext, useContext } from "react";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, BarChart, Bar
} from "recharts";
import { supabase } from "./supabase";

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

const statusColor = (s) => {
  const v = (s || "").toLowerCase();
  if (v === "approved" || v === "active")    return "text-emerald-400";
  if (v === "rejected" || v === "overdue")   return "text-rose-400";
  if (v === "sent"     || v === "estimating") return "text-yellow-300";
  if (v === "completed")                      return "text-blue-400";
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

  const logoSVG = `
    <svg width="50" height="58" viewBox="0 0 50 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="25,2 48,14.5 48,43.5 25,56 2,43.5 2,14.5"
        fill="rgba(245,240,232,0.05)" stroke="#f5f0e8" stroke-width="2"/>
      <text x="25" y="43"
        font-family="'Times New Roman',Times,serif"
        font-size="34" font-weight="700"
        fill="#f5f0e8" text-anchor="middle">N</text>
      <polygon points="30,13 21,45 25,45 34,13" fill="#c45c26" opacity="0.95"/>
    </svg>`;

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
    .header { background: #0d1f33; color: #f5f0e8; padding: 32px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
    .logo-row { display: flex; align-items: center; gap: 14px; }
    .co-name { font-family: Arial, Helvetica, sans-serif; font-size: 19px; font-weight: 700; letter-spacing: 3px; color: #f5f0e8; }
    .co-sub { font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 4px; color: #c45c26; margin-top: 3px; text-transform: uppercase; }
    .co-contact { font-family: Arial, sans-serif; font-size: 9.5px; color: #8a9aaa; margin-top: 9px; line-height: 1.9; }
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
    .creds { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 13px; }
    .cred { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.13); padding: 3px 9px; font-family: Arial, sans-serif; font-size: 8.5px; letter-spacing: 1px; color: #f5f0e8; }

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
    ${logoSVG}
    <div>
      <div class="co-name">NORTHSHORE</div>
      <div class="co-sub">Mechanical &amp; Construction</div>
      <div class="co-contact">
        ${co.phone} &nbsp;|&nbsp; ${co.email}<br>
        ${co.address}<br>
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
          ${client && client.phone ? client.phone + "<br>" : ""}
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
  <div class="sec">
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
        <span class="cred">Fully Insured</span>
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
      All work performed in compliance with applicable Michigan Building Codes and local ordinances.
      Northshore Mechanical &amp; Construction LLC carries general liability insurance; certificate
      available upon request.</p>

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
  <div class="sec">
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
    ${co.phone} &nbsp;|&nbsp; ${co.email} &nbsp;|&nbsp; ${co.website}
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
  <div>
    <div class="co-name">NORTHSHORE</div>
    <div class="co-sub">Mechanical &amp; Construction</div>
    <div class="co-contact">
      ${co.phone} &nbsp;|&nbsp; ${co.email}<br>
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
  <div>Northshore Mechanical &amp; Construction LLC &nbsp;|&nbsp; ${co.address} &nbsp;|&nbsp; ${co.phone}</div>
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
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 bg-amber-400 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-black font-black text-2xl">N</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Northshore OS</h1>
          <p className="text-slate-500 text-sm mt-1">Internal access only</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Email</label>
                <Inp
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Password</label>
                <Inp
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="text-rose-400 text-xs bg-rose-900/20 border border-rose-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <Btn
                type="submit"
                disabled={loading}
                className="w-full bg-amber-400 text-black hover:bg-amber-500 font-semibold"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Btn>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-slate-700">
          © {new Date().getFullYear()} Northshore Mechanical & Construction LLC
        </p>
      </div>
    </div>
  );
}

// ================================================================
// DASHBOARD
// ================================================================
function Dashboard({ jobs, estimates, clients }) {
  const activeJobs  = jobs.filter((j) => j.status === "Active");
  const openEst     = estimates.filter((e) => e.status === "Draft" || e.status === "Sent");
  const approvedEst = estimates.filter((e) => e.status === "Approved");
  const arTotal     = approvedEst.reduce((s, e) => s + (e.grand_total || 0), 0);
  const pipeline    = openEst.reduce((s, e) => s + (e.grand_total || 0), 0);

  const graphData = estimates.slice(-10).map((e) => ({
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className="text-xs text-slate-500">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric",
          })}
        </span>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Jobs",   value: activeJobs.length,  sub: "in progress" },
          { label: "Open Bids",     value: openEst.length,     sub: "awaiting approval" },
          { label: "Pipeline",      value: currency(pipeline), sub: "estimated value" },
          { label: "A/R Approved",  value: currency(arTotal),  sub: "ready to invoice" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{k.label}</p>
              <p className="text-3xl font-bold text-amber-400">{k.value}</p>
              <p className="text-xs text-slate-600 mt-1">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Estimate Trend
            </h2>
            {graphData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={graphData}>
                  <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 11 }} />
                  <YAxis
                    stroke="#475569"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => currency(v)}
                    contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: "#f59e0b", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">
                Create estimates to see trend
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Budget vs Actual
            </h2>
            {jobData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={jobData}>
                  <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 10 }} />
                  <YAxis
                    stroke="#475569"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => currency(v)}
                    contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                  />
                  <Bar dataKey="budget" fill="#1e293b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">
                Add jobs to see comparison
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BURN RATE */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Active Jobs — Burn Rate
          </h2>
          {activeJobs.length === 0 && (
            <p className="text-slate-600 text-sm">No active jobs.</p>
          )}
          <div className="space-y-4">
            {activeJobs.map((j) => {
              const pct   = j.budget ? Math.min(100, ((j.actual || 0) / j.budget) * 100) : 0;
              const color = pct < 70 ? "bg-emerald-500" : pct < 90 ? "bg-yellow-400" : "bg-rose-500";
              return (
                <div key={j.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <div>
                      <span className="text-slate-200 font-medium">{j.name}</span>
                      {j.client_id && getClientName(j.client_id) && (
                        <span className="text-slate-500 text-xs ml-2">
                          — {getClientName(j.client_id)}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400">
                      {currency(j.actual || 0)}{" "}
                      <span className="text-slate-600">/ {currency(j.budget)}</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full">
                    <div
                      className={`h-2 rounded-full transition-all ${color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{round2(pct)}% burned</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* RECENT ESTIMATES */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Recent Estimates
          </h2>
          {estimates.length === 0 && (
            <p className="text-slate-600 text-sm">No estimates yet.</p>
          )}
          <div className="space-y-2">
            {estimates.slice(0, 5).map((e) => (
              <div
                key={e.id}
                className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0"
              >
                <div>
                  <span className="text-slate-200 text-sm">{e.name}</span>
                  {e.client_id && getClientName(e.client_id) && (
                    <span className="text-slate-500 text-xs ml-2">
                      — {getClientName(e.client_id)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-amber-400 font-semibold text-sm">
                    {currency(e.grand_total)}
                  </span>
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
        </CardContent>
      </Card>
    </div>
  );
}

// ================================================================
// ESTIMATOR
// ================================================================
function Estimator({ settings, onEstimateSaved, onJobCreated, clients, jobs }) {
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
  const [savedEstimates, setSavedEstimates] = useState([]);

  // Material form
  const [mName, setMName] = useState("");
  const [mCost, setMCost] = useState("");
  const [mQty,  setMQty]  = useState("");

  // Labor form
  const [lTask,  setLTask]  = useState("");
  const [lRate,  setLRate]  = useState("");
  const [lHours, setLHours] = useState("");

  useEffect(() => {
    supabase
      .from("estimates")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setSavedEstimates(data); });
  }, []);

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

    const { data, error } = await supabase
      .from("estimates")
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      setSavedEstimates((prev) => [data, ...prev]);
      onEstimateSaved(data);
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
        if (job) onJobCreated(job);
      }
      alert(`Saved as ${status}${status === "Approved" ? " — Job created!" : ""}`);
    } else {
      alert("Error saving: " + error?.message);
    }
    setSaving(false);
  };

  const handleGenerateProposal = (est) => {
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
          <h1 className="text-2xl font-bold">Estimator</h1>
          <p className="text-slate-500 text-sm mt-1">
            Build material + labor estimates with automatic markup
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Inp
            value={estName}
            onChange={(e) => setEstName(e.target.value)}
            className="w-52"
            placeholder="Estimate name"
          />
          <Btn onClick={() => saveEst("Draft")} disabled={saving} className="bg-slate-700">
            Save Draft
          </Btn>
          <Btn onClick={() => saveEst("Sent")} disabled={saving} className="bg-blue-700 hover:bg-blue-600">
            Mark Sent
          </Btn>
          <Btn onClick={() => saveEst("Approved")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
            Approve → Job
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
            <label className="block text-xs text-slate-400 mb-1">
              Scope of Work (client-facing)
            </label>
            <textarea
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              rows={3}
              placeholder="Describe the project in plain language for the client..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
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
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                Saved Estimates ({savedEstimates.length})
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {savedEstimates.map((e) => (
                  <div key={e.id} className="text-xs py-1.5 border-b border-slate-800 last:border-0">
                    <div className="flex justify-between items-center">
                      <p className="text-slate-300 truncate mr-2">{e.name}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-amber-400 font-medium">{currency(e.grand_total)}</span>
                        <Badge
                          label={e.status}
                          color={
                            e.status === "Approved" ? "green" :
                            e.status === "Sent"     ? "yellow" : "gray"
                          }
                        />
                      </div>
                    </div>
                    <Btn
                      onClick={() => handleGenerateProposal(e)}
                      className="mt-1.5 w-full text-xs py-1 bg-amber-400/10 text-amber-400
                        hover:bg-amber-400/20 border border-amber-900/30"
                    >
                      📄 Generate Proposal
                    </Btn>
                  </div>
                ))}
                {savedEstimates.length === 0 && (
                  <p className="text-slate-600 text-xs">No saved estimates</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// JOBS
// ================================================================
function Jobs({ jobs, setJobs, clients, settings }) {
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
    if (!name || !budget) return;
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
    if (!error && data) setJobs((j) => [data, ...j]);
    setName(""); setBudget(""); setSelectedClientId("");
    setLoading(false);
  };

  const updateJob = async (id, patch) => {
    await supabase.from("jobs").update(patch).eq("id", id);
    setJobs((j) => j.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeJob = async (id) => {
    if (!window.confirm("Remove this job?")) return;
    await supabase.from("jobs").delete().eq("id", id);
    setJobs((j) => j.filter((x) => x.id !== id));
  };

  const getClientName = (id) => {
    const c = clients.find((c) => c.id === id);
    return c ? c.name : null;
  };

  const handleGenerateCO = (job) => {
    if (!coDesc.trim() || !coAmount) {
      alert("Enter a description and amount before generating the change order.");
      return;
    }
    const client = clients.find((c) => c.id === job.client_id) || null;
    openChangeOrder(
      job, client,
      { description: coDesc, amount: parseFloat(coAmount) },
      settings,
      job.budget || 0
    );
  };

  const filtered = jobs.filter((j) => filter === "All" || j.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <Sel
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-40"
        >
          {["All", "Active", "Estimating", "Paused", "Completed"].map((f) => (
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
              {["Active", "Estimating", "Paused", "Completed"].map((s) => (
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
                            {["Active", "Estimating", "Paused", "Completed"].map((s) => (
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
                            onClick={(e) => { e.stopPropagation(); removeJob(j.id); }}
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
                                      hover:bg-amber-400/20 border border-amber-900/30"
                                  >
                                    📄 Generate Change Order
                                  </Btn>
                                </div>
                              </div>
                            </div>
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
function Clients({ jobs, estimates }) {
  const [clients, setClients]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [company, setCompany]     = useState("");
  const [notes, setNotes]         = useState("");
  const [filter, setFilter]       = useState("All");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setClients(data); setLoading(false); });
  }, []);

  const addClient = async () => {
    if (!name) return;
    const { data, error } = await supabase
      .from("clients")
      .insert({ name, email, phone, company, notes, status: "Prospect" })
      .select()
      .single();
    if (!error && data) setClients((c) => [data, ...c]);
    setName(""); setEmail(""); setPhone(""); setCompany(""); setNotes("");
  };

  const updateClient = async (id, patch) => {
    await supabase.from("clients").update(patch).eq("id", id);
    setClients((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeClient = async (id) => {
    await supabase.from("clients").delete().eq("id", id);
    setClients((c) => c.filter((x) => x.id !== id));
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
          {loading ? <Spinner /> : (
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
                            {c.phone && <p>{c.phone}</p>}
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
                              onClick={(e) => { e.stopPropagation(); removeClient(c.id); }}
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
    if (!title || !date) return;
    const { data, error } = await supabase
      .from("schedule")
      .insert({ title, job: job || "General", date, status: "Active", type: "Task" })
      .select()
      .single();
    if (!error && data)
      setEvents((e) => [...e, data].sort((a, b) => new Date(a.date) - new Date(b.date)));
    setTitle("");
  };

  const updateEvent = async (id, patch) => {
    await supabase.from("schedule").update(patch).eq("id", id);
    setEvents((e) => e.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeEvent = async (id) => {
    await supabase.from("schedule").delete().eq("id", id);
    setEvents((e) => e.filter((x) => x.id !== id));
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
                    onClick={() => removeEvent(e.id)}
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
// SETTINGS
// ================================================================
function Settings({ settings, setSettings }) {
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
    alert("Settings saved.");
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

const TABS = ["Dashboard", "Estimator", "Jobs", "Schedule", "Clients", "Settings"];

export default function App() {
  const [tab, setTab]           = useState("Dashboard");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [jobs, setJobs]         = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [clients, setClients]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [session, setSession]   = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

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
      ] = await Promise.all([
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("estimates").select("*").order("created_at", { ascending: false }),
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
      ]);
      if (jobsData)     setJobs(jobsData);
      if (estimatesData) setEstimates(estimatesData);
      if (clientsData)  setClients(clientsData);
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
  };

  const handleEstimateSaved = (est) => setEstimates((prev) => [est, ...prev]);
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

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
            <span className="text-black font-black text-sm">N</span>
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">Northshore OS</h1>
            <p className="text-xs text-slate-600 leading-none mt-0.5">
              Mechanical & Construction
            </p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1.5 items-center">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t
                  ? "bg-amber-400 text-black shadow-md shadow-amber-900/30"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500
              hover:text-rose-400 hover:bg-rose-900/20 transition-all ml-2 border border-slate-800"
          >
            Sign Out
          </button>
        </nav>
      </header>

      {/* MAIN */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        {tab === "Dashboard"  && <Dashboard  jobs={jobs} estimates={estimates} clients={clients} />}
        {tab === "Estimator"  && <Estimator  settings={settings} onEstimateSaved={handleEstimateSaved} onJobCreated={handleJobCreated} clients={clients} jobs={jobs} />}
        {tab === "Jobs"       && <Jobs       jobs={jobs} setJobs={setJobs} clients={clients} settings={settings} />}
        {tab === "Schedule"   && <Schedule   jobs={jobs} />}
        {tab === "Clients"    && <Clients    jobs={jobs} estimates={estimates} />}
        {tab === "Settings"   && <Settings   settings={settings} setSettings={setSettings} />}
      </main>

      {/* FOOTER */}
      <footer className="py-3 text-center text-xs text-slate-700 border-t border-slate-900">
        © {new Date().getFullYear()} Northshore Mechanical & Construction LLC — Internal Use Only
      </footer>
    </div>
  );
}