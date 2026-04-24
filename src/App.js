import React, { useState, useEffect, useMemo, createContext, useContext } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import { supabase } from "./supabase";

// ================================================================
// UTILITIES
// ================================================================
const uid = () => Math.random().toString(36).slice(2, 10);
const currency = (n) => `$${(Number(n)||0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (d) => { try { return new Date(d).toLocaleDateString(); } catch { return "—"; } };
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const statusColor = (s) => {
  const v = (s||"").toLowerCase();
  if (v === "approved" || v === "active") return "text-emerald-400";
  if (v === "rejected" || v === "overdue") return "text-rose-400";
  if (v === "sent" || v === "estimating") return "text-yellow-300";
  if (v === "completed") return "text-blue-400";
  return "text-slate-300";
};

// ================================================================
// UI COMPONENTS
// ================================================================
function Btn({ children, className = "", ...props }) {
  return (
    <button className={`px-4 py-2 rounded-lg font-medium bg-slate-800 text-white hover:bg-slate-700 transition-colors disabled:opacity-50 ${className}`} {...props}>
      {children}
    </button>
  );
}
function Card({ className = "", children }) {
  return <div className={`rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg ${className}`}>{children}</div>;
}
function CardContent({ className = "", children }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
function Inp({ className = "", ...props }) {
  return (
    <input className={`px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 w-full text-sm ${className}`} {...props} />
  );
}
function Badge({ label, color }) {
  const colors = { green: "bg-emerald-900/50 text-emerald-300 border-emerald-700", yellow: "bg-yellow-900/50 text-yellow-300 border-yellow-700", red: "bg-rose-900/50 text-rose-300 border-rose-700", blue: "bg-blue-900/50 text-blue-300 border-blue-700", gray: "bg-slate-800 text-slate-300 border-slate-700" };
  return <span className={`px-2 py-0.5 rounded-full text-xs border ${colors[color] || colors.gray}`}>{label}</span>;
}
function Spinner() {
  return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
}

// Tabs
const TabsCtx = createContext({ value: null, setValue: () => {} });
function Tabs({ value, onValueChange, children }) {
  return <TabsCtx.Provider value={{ value, setValue: onValueChange || (() => {}) }}><div>{children}</div></TabsCtx.Provider>;
}
function TabsList({ className = "", children }) {
  return <div className={`flex flex-wrap gap-2 mb-5 ${className}`}>{children}</div>;
}
function TabsTrigger({ value, children }) {
  const { value: cur, setValue } = useContext(TabsCtx);
  const active = cur === value;
  return (
    <button onClick={() => setValue(value)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${active ? "bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-900/30" : "bg-slate-900 text-slate-300 border-gray-700 hover:bg-slate-800 hover:text-white"}`}>
      {children}
    </button>
  );
}
function TabsContent({ value, children }) {
  const { value: cur } = useContext(TabsCtx);
  return cur === value ? <div>{children}</div> : null;
}

// ================================================================
// DASHBOARD
// ================================================================
function Dashboard({ jobs, estimates }) {
  const activeJobs = jobs.filter(j => j.status === "Active");
  const openEst = estimates.filter(e => e.status === "Draft" || e.status === "Sent");
  const approvedEst = estimates.filter(e => e.status === "Approved");
  const arTotal = approvedEst.reduce((s, e) => s + (e.grand_total||0), 0);
  const pipeline = openEst.reduce((s, e) => s + (e.grand_total||0), 0);
  const graphData = estimates.slice(-10).map(e => ({ name: formatDate(e.created_at), total: Math.round(e.grand_total||0) }));
  const jobData = jobs.slice(0, 6).map(j => ({ name: j.name.split("—")[0].trim(), budget: j.budget, actual: j.actual||0 }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className="text-xs text-slate-500">{new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Jobs", value: activeJobs.length, sub: "in progress" },
          { label: "Open Bids", value: openEst.length, sub: "awaiting approval" },
          { label: "Pipeline", value: currency(pipeline), sub: "estimated value" },
          { label: "A/R Approved", value: currency(arTotal), sub: "ready to invoice" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{k.label}</p>
              <p className="text-3xl font-bold text-amber-400">{k.value}</p>
              <p className="text-xs text-slate-600 mt-1">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Estimate Trend</h2>
            {graphData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={graphData}>
                  <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => currency(v)} contentStyle={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:8 }} />
                  <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} dot={{ fill:"#f59e0b", r:3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">Create estimates to see trend</div>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Budget vs Actual</h2>
            {jobData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={jobData}>
                  <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => currency(v)} contentStyle={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:8 }} />
                  <Bar dataKey="budget" fill="#1e293b" radius={[3,3,0,0]} />
                  <Bar dataKey="actual" fill="#f59e0b" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">Add jobs to see comparison</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Active Jobs — Burn Rate</h2>
          {activeJobs.length === 0 && <p className="text-slate-600 text-sm">No active jobs.</p>}
          <div className="space-y-4">
            {activeJobs.map(j => {
              const pct = j.budget ? Math.min(100, ((j.actual||0)/j.budget)*100) : 0;
              const color = pct < 70 ? "bg-emerald-500" : pct < 90 ? "bg-yellow-400" : "bg-rose-500";
              return (
                <div key={j.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-200 font-medium">{j.name}</span>
                    <span className="text-slate-400">{currency(j.actual||0)} <span className="text-slate-600">/ {currency(j.budget)}</span></span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full">
                    <div className={`h-2 rounded-full transition-all ${color}`} style={{ width:`${pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{round2(pct)}% burned</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Recent Estimates</h2>
          {estimates.length === 0 && <p className="text-slate-600 text-sm">No estimates yet.</p>}
          <div className="space-y-2">
            {estimates.slice(0,5).map(e => (
              <div key={e.id} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
                <span className="text-slate-200 text-sm">{e.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-amber-400 font-semibold text-sm">{currency(e.grand_total)}</span>
                  <Badge label={e.status} color={e.status==="Approved"?"green":e.status==="Sent"?"yellow":"gray"} />
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
function Estimator({ settings, onEstimateSaved, onJobCreated }) {
  const [tab, setTab] = useState("Materials");
  const [estName, setEstName] = useState("New Estimate");
  const [materials, setMaterials] = useState([]);
  const [labor, setLabor] = useState([]);
  const [contingencyPct, setContingencyPct] = useState(2);
  const [taxExempt, setTaxExempt] = useState(false);
  const [fees, setFees] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedEstimates, setSavedEstimates] = useState([]);

  const [mName, setMName] = useState(""); const [mCost, setMCost] = useState(""); const [mQty, setMQty] = useState("");
  const [lTask, setLTask] = useState(""); const [lRate, setLRate] = useState(""); const [lHours, setLHours] = useState("");

  useEffect(() => {
    supabase.from("estimates").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setSavedEstimates(data); });
  }, []);

  const addMat = () => {
    const cost = parseFloat(mCost); const qty = parseFloat(mQty);
    if (!mName || isNaN(cost) || isNaN(qty) || qty <= 0) return;
    setMaterials(m => [...m, { id:uid(), name:mName, cost, qty }]);
    setMName(""); setMCost(""); setMQty("");
  };
  const addLab = () => {
    const rate = parseFloat(lRate); const hours = parseFloat(lHours);
    if (!lTask || isNaN(rate) || isNaN(hours) || hours <= 0) return;
    setLabor(l => [...l, { id:uid(), task:lTask, rate, hours }]);
    setLTask(""); setLRate(""); setLHours("");
  };

  const mTotal = materials.reduce((s,m) => s + m.cost*m.qty, 0);
  const lTotal = labor.reduce((s,l) => s + l.rate*l.hours, 0);
  const subtotal = mTotal + lTotal;
  const contingency = subtotal * (contingencyPct/100);
  const overhead = subtotal * ((settings.overheadPct||0)/100);
  const profit = subtotal * ((settings.profitPct||0)/100);
  const tax = taxExempt ? 0 : subtotal * ((settings.salesTaxPct||0)/100);
  const grandTotal = Math.max(0, subtotal + contingency + overhead + profit + tax + (Number(fees)||0) - (Number(discount)||0));

  const saveEst = async (status = "Draft") => {
    setSaving(true);
    const { data, error } = await supabase.from("estimates").insert({
      name: estName,
      materials,
      labor,
      grand_total: grandTotal,
      status,
    }).select().single();

    if (!error && data) {
      setSavedEstimates(prev => [data, ...prev]);
      onEstimateSaved(data);
      if (status === "Approved") {
        const { data: job } = await supabase.from("jobs").insert({
          name: estName,
          status: "Active",
          budget: grandTotal,
          actual: 0,
        }).select().single();
        if (job) onJobCreated(job);
      }
      alert(`Saved as ${status}${status==="Approved" ? " — Job created!" : ""}`);
    } else {
      alert("Error saving: " + error?.message);
    }
    setSaving(false);
  };

  const ASSEMBLIES = [
    { name:"Toilet Set", mats:[{name:"Toilet (standard)",cost:169,qty:1},{name:"Wax ring & supply",cost:14,qty:1}], labs:[{task:"Set toilet",rate:65,hours:1.25}] },
    { name:"Bath Fan", mats:[{name:"Bath fan unit",cost:129,qty:1},{name:"Ducting & tape",cost:24.5,qty:1}], labs:[{task:"Replace fan",rate:65,hours:1.5}] },
    { name:"Interior Door", mats:[{name:"Prehung door 6-8",cost:189,qty:1},{name:"Hardware set",cost:45,qty:1}], labs:[{task:"Install door",rate:65,hours:2}] },
    { name:"Outlet/Switch", mats:[{name:"Outlet or switch",cost:4.5,qty:1},{name:"Box & cover",cost:3,qty:1}], labs:[{task:"Wire outlet/switch",rate:75,hours:0.5}] },
  ];
  const addAssembly = (a) => {
    setMaterials(m => [...m, ...a.mats.map(x => ({...x, id:uid()}))]);
    setLabor(l => [...l, ...a.labs.map(x => ({...x, id:uid()}))]);
  };

  const lineItems = [
    { label: "Materials", value: currency(mTotal) },
    { label: "Labor", value: currency(lTotal) },
    { label: "Subtotal", value: currency(subtotal), bold: true },
    { label: `Contingency (${contingencyPct}%)`, value: currency(contingency) },
    { label: `Overhead (${settings.overheadPct}%)`, value: currency(overhead) },
    { label: `Profit (${settings.profitPct}%)`, value: currency(profit) },
    { label: `Sales Tax${taxExempt?" (exempt)":` (${settings.salesTaxPct}%)`}`, value: currency(tax) },
    { label: "Flat Fees", value: currency(fees) },
    { label: "Discount", value: `−${currency(discount)}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Estimator</h1>
          <p className="text-slate-500 text-sm mt-1">Build material + labor estimates with automatic markup</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Inp value={estName} onChange={e=>setEstName(e.target.value)} className="w-52" placeholder="Estimate name" />
          <Btn onClick={()=>saveEst("Draft")} disabled={saving} className="bg-slate-700">Save Draft</Btn>
          <Btn onClick={()=>saveEst("Sent")} disabled={saving} className="bg-blue-700 hover:bg-blue-600">Mark Sent</Btn>
          <Btn onClick={()=>saveEst("Approved")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">Approve → Job</Btn>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Quick Add Assemblies</p>
          <div className="flex flex-wrap gap-2">
            {ASSEMBLIES.map(a => (
              <Btn key={a.name} onClick={()=>addAssembly(a)} className="bg-slate-800 hover:bg-slate-700 text-sm py-1.5">+ {a.name}</Btn>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="Materials">Materials ({materials.length})</TabsTrigger>
              <TabsTrigger value="Labor">Labor ({labor.length})</TabsTrigger>
              <TabsTrigger value="Adjustments">Adjustments</TabsTrigger>
            </TabsList>

            <TabsContent value="Materials">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Inp placeholder="Material name" value={mName} onChange={e=>setMName(e.target.value)} className="col-span-2" />
                    <Inp placeholder="Unit cost $" type="number" value={mCost} onChange={e=>setMCost(e.target.value)} />
                    <Inp placeholder="Qty" type="number" value={mQty} onChange={e=>setMQty(e.target.value)} />
                    <Btn onClick={addMat} className="bg-amber-400 text-black hover:bg-amber-500 col-span-2 md:col-span-4">Add Material</Btn>
                  </div>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
                      <th className="py-2 font-medium">Name</th><th className="font-medium">Cost</th><th className="font-medium">Qty</th><th className="font-medium">Total</th><th />
                    </tr></thead>
                    <tbody>
                      {materials.map(m => (
                        <tr key={m.id} className="border-b border-slate-800/50">
                          <td className="py-2 text-slate-200">{m.name}</td>
                          <td className="text-slate-400">{currency(m.cost)}</td>
                          <td className="text-slate-400">{m.qty}</td>
                          <td className="text-slate-200 font-medium">{currency(m.cost*m.qty)}</td>
                          <td className="text-right"><Btn onClick={()=>setMaterials(x=>x.filter(x=>x.id!==m.id))} className="text-xs py-1 px-2 bg-slate-900">✕</Btn></td>
                        </tr>
                      ))}
                      {materials.length===0 && <tr><td colSpan={5} className="py-6 text-slate-600 text-center">No materials yet</td></tr>}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="Labor">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Inp placeholder="Task description" value={lTask} onChange={e=>setLTask(e.target.value)} className="col-span-2" />
                    <Inp placeholder="Rate $/hr" type="number" value={lRate} onChange={e=>setLRate(e.target.value)} />
                    <Inp placeholder="Hours" type="number" value={lHours} onChange={e=>setLHours(e.target.value)} />
                    <Btn onClick={addLab} className="bg-amber-400 text-black hover:bg-amber-500 col-span-2 md:col-span-4">Add Labor</Btn>
                  </div>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
                      <th className="py-2 font-medium">Task</th><th className="font-medium">Rate</th><th className="font-medium">Hours</th><th className="font-medium">Total</th><th />
                    </tr></thead>
                    <tbody>
                      {labor.map(l => (
                        <tr key={l.id} className="border-b border-slate-800/50">
                          <td className="py-2 text-slate-200">{l.task}</td>
                          <td className="text-slate-400">{currency(l.rate)}/hr</td>
                          <td className="text-slate-400">{l.hours}h</td>
                          <td className="text-slate-200 font-medium">{currency(l.rate*l.hours)}</td>
                          <td className="text-right"><Btn onClick={()=>setLabor(x=>x.filter(x=>x.id!==l.id))} className="text-xs py-1 px-2 bg-slate-900">✕</Btn></td>
                        </tr>
                      ))}
                      {labor.length===0 && <tr><td colSpan={5} className="py-6 text-slate-600 text-center">No labor yet</td></tr>}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="Adjustments">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Contingency %</label>
                      <Inp type="number" value={contingencyPct} onChange={e=>setContingencyPct(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Flat Fees ($)</label>
                      <Inp type="number" value={fees} onChange={e=>setFees(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Discount ($)</label>
                      <Inp type="number" value={discount} onChange={e=>setDiscount(Number(e.target.value))} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={taxExempt} onChange={e=>setTaxExempt(e.target.checked)} className="accent-amber-400 w-4 h-4" />
                    Tax Exempt Job
                  </label>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card className="border-amber-900/30">
            <CardContent className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Estimate Summary</p>
              <p className="text-slate-300 font-medium text-sm mb-3 truncate">{estName}</p>
              <div className="space-y-1.5">
                {lineItems.map(li => (
                  <div key={li.label} className={`flex justify-between text-sm ${li.bold ? "font-semibold text-slate-200 border-t border-slate-700 pt-1.5 mt-1.5" : "text-slate-400"}`}>
                    <span>{li.label}</span>
                    <span className={li.bold ? "text-slate-200" : "text-slate-300"}>{li.value}</span>
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
                <Btn onClick={()=>saveEst("Draft")} disabled={saving} className="w-full bg-slate-700 text-sm">{saving ? "Saving..." : "Save Draft"}</Btn>
                <Btn onClick={()=>saveEst("Approved")} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-500 text-sm">Approve → Create Job</Btn>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Saved Estimates ({savedEstimates.length})</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {savedEstimates.map(e => (
                  <div key={e.id} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800 last:border-0">
                    <span className="text-slate-300 truncate mr-2">{e.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-amber-400 font-medium">{currency(e.grand_total)}</span>
                      <Badge label={e.status} color={e.status==="Approved"?"green":e.status==="Sent"?"yellow":"gray"} />
                    </div>
                  </div>
                ))}
                {savedEstimates.length===0 && <p className="text-slate-600 text-xs">No saved estimates</p>}
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
function Jobs({ jobs, setJobs }) {
  const [name, setName] = useState(""); const [budget, setBudget] = useState(""); const [status, setStatus] = useState("Active");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const addJob = async () => {
    if (!name || !budget) return;
    setLoading(true);
    const { data, error } = await supabase.from("jobs").insert({
      name, budget: parseFloat(budget), actual: 0, status, notes: ""
    }).select().single();
    if (!error && data) setJobs(j => [data, ...j]);
    setName(""); setBudget("");
    setLoading(false);
  };

  const updateJob = async (id, patch) => {
    await supabase.from("jobs").update(patch).eq("id", id);
    setJobs(j => j.map(x => x.id===id ? {...x,...patch} : x));
  };

  const removeJob = async (id) => {
    if (!window.confirm("Remove this job?")) return;
    await supabase.from("jobs").delete().eq("id", id);
    setJobs(j => j.filter(x => x.id!==id));
  };

  const filtered = jobs.filter(j => filter==="All" || j.status===filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
          {["All","Active","Estimating","Paused","Completed"].map(f => <option key={f}>{f}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm text-slate-400 font-medium">Add New Job</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Inp placeholder="Job name / address" value={name} onChange={e=>setName(e.target.value)} className="md:col-span-2" />
            <Inp placeholder="Budget $" type="number" value={budget} onChange={e=>setBudget(e.target.value)} />
            <select value={status} onChange={e=>setStatus(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
              {["Active","Estimating","Paused","Completed"].map(s => <option key={s}>{s}</option>)}
            </select>
            <Btn onClick={addJob} disabled={loading} className="bg-amber-400 text-black hover:bg-amber-500 md:col-span-4">Add Job</Btn>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-medium">Job Name</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Budget</th>
                  <th className="py-3 px-4 font-medium">Actual Spent</th>
                  <th className="py-3 px-4 font-medium">Margin</th>
                  <th className="py-3 px-4 font-medium">Burn</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(j => {
                  const marginPct = j.budget ? ((j.budget-(j.actual||0))/j.budget)*100 : 0;
                  const burnPct = j.budget ? Math.min(100,((j.actual||0)/j.budget)*100) : 0;
                  const burnColor = burnPct<70?"bg-emerald-500":burnPct<90?"bg-yellow-400":"bg-rose-500";
                  const isExpanded = expandedId === j.id;
                  return (
                    <React.Fragment key={j.id}>
                      <tr className="border-b border-slate-800 hover:bg-slate-800/30 cursor-pointer" onClick={()=>setExpandedId(isExpanded?null:j.id)}>
                        <td className="py-3 px-4 text-slate-200 font-medium">{j.name}</td>
                        <td className="py-3 px-4">
                          <select value={j.status} onClick={e=>e.stopPropagation()} onChange={e=>updateJob(j.id,{status:e.target.value})} className={`bg-transparent text-sm ${statusColor(j.status)}`}>
                            {["Active","Estimating","Paused","Completed"].map(s=><option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{currency(j.budget)}</td>
                        <td className="py-3 px-4">
                          <Inp type="number" value={j.actual||0} onClick={e=>e.stopPropagation()} onChange={e=>updateJob(j.id,{actual:parseFloat(e.target.value||0)})} className="w-28 py-1" />
                        </td>
                        <td className={`py-3 px-4 font-semibold ${marginPct>=0?"text-emerald-400":"text-rose-400"}`}>{round2(marginPct)}%</td>
                        <td className="py-3 px-4">
                          <div className="w-24 bg-slate-800 h-2 rounded-full">
                            <div className={`h-2 rounded-full ${burnColor}`} style={{width:`${burnPct}%`}} />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Btn onClick={e=>{e.stopPropagation();removeJob(j.id);}} className="text-xs py-1 px-2 bg-slate-900">Remove</Btn>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-slate-800 bg-slate-900/50">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Job Notes</label>
                                <textarea value={j.notes||""} onChange={e=>updateJob(j.id,{notes:e.target.value})} rows={2}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50" placeholder="Add notes..." />
                              </div>
                              <div className="text-xs text-slate-500 space-y-1">
                                <p>Created: {formatDate(j.created_at)}</p>
                                <p>Remaining: <span className="text-emerald-400">{currency((j.budget||0)-(j.actual||0))}</span></p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filtered.length===0 && <tr><td colSpan={7} className="py-8 text-center text-slate-600">No jobs. Add one above.</td></tr>}
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
function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [company, setCompany] = useState(""); const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    supabase.from("clients").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setClients(data); setLoading(false); });
  }, []);

  const addClient = async () => {
    if (!name) return;
    const { data, error } = await supabase.from("clients").insert({ name, email, phone, company, notes, status:"Prospect" }).select().single();
    if (!error && data) setClients(c => [data, ...c]);
    setName(""); setEmail(""); setPhone(""); setCompany(""); setNotes("");
  };

  const updateClient = async (id, patch) => {
    await supabase.from("clients").update(patch).eq("id", id);
    setClients(c => c.map(x => x.id===id ? {...x,...patch} : x));
  };

  const removeClient = async (id) => {
    await supabase.from("clients").delete().eq("id", id);
    setClients(c => c.filter(x => x.id!==id));
  };

  const filtered = clients.filter(c => filter==="All" || c.status===filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Clients</h1>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-sm">{clients.length} total</span>
          <select value={filter} onChange={e=>setFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
            {["All","Prospect","Active","Closed"].map(f=><option key={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm text-slate-400 font-medium">Add Client</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Inp placeholder="Full name *" value={name} onChange={e=>setName(e.target.value)} />
            <Inp placeholder="Company (optional)" value={company} onChange={e=>setCompany(e.target.value)} />
            <Inp placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} />
            <Inp placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
            <Inp placeholder="Notes" value={notes} onChange={e=>setNotes(e.target.value)} />
            <Btn onClick={addClient} className="bg-amber-400 text-black hover:bg-amber-500">Add Client</Btn>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <Spinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Contact</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Notes</th>
                  <th className="py-3 px-4 font-medium">Added</th>
                  <th className="py-3 px-4" />
                </tr></thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-slate-800 hover:bg-slate-800/20">
                      <td className="py-3 px-4">
                        <p className="text-slate-200 font-medium">{c.name}</p>
                        {c.company && <p className="text-slate-500 text-xs">{c.company}</p>}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        {c.email && <p>{c.email}</p>}
                        {c.phone && <p>{c.phone}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <select value={c.status} onChange={e=>updateClient(c.id,{status:e.target.value})} className={`bg-transparent text-sm ${statusColor(c.status)}`}>
                          {["Prospect","Active","Closed"].map(s=><option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <Inp value={c.notes||""} onChange={e=>updateClient(c.id,{notes:e.target.value})} className="py-1 text-xs" placeholder="Notes..." />
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{formatDate(c.created_at)}</td>
                      <td className="py-3 px-4 text-right"><Btn onClick={()=>removeClient(c.id)} className="text-xs py-1 px-2 bg-slate-900">Remove</Btn></td>
                    </tr>
                  ))}
                  {filtered.length===0 && <tr><td colSpan={6} className="py-8 text-center text-slate-600">No clients yet.</td></tr>}
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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(""); const [job, setJob] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0,10));

  useEffect(() => {
    supabase.from("schedule").select("*").order("date", { ascending: true })
      .then(({ data }) => { if (data) setEvents(data); setLoading(false); });
  }, []);

  const addEvent = async () => {
    if (!title||!date) return;
    const { data, error } = await supabase.from("schedule").insert({ title, job:job||"General", date, status:"Active", type:"Task" }).select().single();
    if (!error && data) setEvents(e => [...e, data].sort((a,b)=>new Date(a.date)-new Date(b.date)));
    setTitle("");
  };

  const updateEvent = async (id, patch) => {
    await supabase.from("schedule").update(patch).eq("id", id);
    setEvents(e => e.map(x => x.id===id ? {...x,...patch} : x));
  };

  const removeEvent = async (id) => {
    await supabase.from("schedule").delete().eq("id", id);
    setEvents(e => e.filter(x => x.id!==id));
  };

  const today = new Date().toISOString().slice(0,10);
  const upcoming = events.filter(e=>e.date>=today && e.status!=="Completed");
  const past = events.filter(e=>e.date<today || e.status==="Completed");

  const renderTable = (items, label) => (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">{label} ({items.length})</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500 border-b border-slate-800 text-xs">
            <th className="py-2 font-medium">Date</th><th className="font-medium">Title</th><th className="font-medium">Job</th><th className="font-medium">Status</th><th />
          </tr></thead>
          <tbody>
            {items.map(e => (
              <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                <td className="py-2 text-slate-300 font-medium">{formatDate(e.date)}</td>
                <td className="py-2 text-slate-200">{e.title}</td>
                <td className="py-2 text-slate-400 text-xs">{e.job}</td>
                <td className="py-2">
                  <select value={e.status} onChange={ev=>updateEvent(e.id,{status:ev.target.value})} className={`bg-transparent text-sm ${statusColor(e.status)}`}>
                    {["Active","Completed","Paused"].map(s=><option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="py-2 text-right"><Btn onClick={()=>removeEvent(e.id)} className="text-xs py-1 px-2 bg-slate-900">✕</Btn></td>
              </tr>
            ))}
            {items.length===0 && <tr><td colSpan={5} className="py-4 text-slate-600 text-center">None</td></tr>}
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
            <Inp placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} className="md:col-span-2" />
            <select value={job} onChange={e=>setJob(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
              <option value="">General</option>
              {jobs.map(j=><option key={j.id} value={j.name}>{j.name}</option>)}
            </select>
            <Inp type="date" value={date} onChange={e=>setDate(e.target.value)} />
            <Btn onClick={addEvent} className="bg-amber-400 text-black hover:bg-amber-500 md:col-span-4">Add</Btn>
          </div>
        </CardContent>
      </Card>
      {loading ? <Spinner /> : <>
        {renderTable(upcoming, "Upcoming")}
        {renderTable(past, "Past / Completed")}
      </>}
    </div>
  );
}

// ================================================================
// SETTINGS
// ================================================================
function Settings({ settings, setSettings }) {
  const [overhead, setOverhead] = useState(settings.overheadPct);
  const [profit, setProfit] = useState(settings.profitPct);
  const [tax, setTax] = useState(settings.salesTaxPct);
  const [company, setCompany] = useState({ name:"Northshore Mechanical & Construction LLC", phone:"", email:"", address:"Muskegon, MI" });

  const saveSettings = () => {
    setSettings({ ...settings, overheadPct:parseFloat(overhead)||0, profitPct:parseFloat(profit)||0, salesTaxPct:parseFloat(tax)||0 });
    alert("Settings saved.");
  };

  const totalMarkup = (parseFloat(overhead)||0) + (parseFloat(profit)||0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-300">Company Info</p>
            {[["Company Name","name","text"],["Phone","phone","tel"],["Email","email","email"],["Address","address","text"]].map(([label,field,type]) => (
              <div key={field}>
                <label className="block text-xs text-slate-500 mb-1">{label}</label>
                <Inp type={type} value={company[field]||""} onChange={e=>setCompany({...company,[field]:e.target.value})} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-300">Estimate Defaults</p>
            {[["Overhead %",overhead,setOverhead,"Applied to subtotal for business costs"],["Profit %",profit,setProfit,"Your margin on top of costs"],["Sales Tax %",tax,setTax,"Michigan default: 6%"]].map(([label,val,set,hint]) => (
              <div key={label}>
                <label className="block text-xs text-slate-500 mb-1">{label}</label>
                <Inp type="number" value={val} onChange={e=>set(e.target.value)} />
                <p className="text-xs text-slate-600 mt-0.5">{hint}</p>
              </div>
            ))}
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <p className="text-xs text-slate-400">Total markup: <span className="text-amber-400 font-semibold">{totalMarkup.toFixed(1)}%</span></p>
              <p className="text-xs text-slate-500 mt-0.5">A $10,000 job costs ~{currency(10000*(1+totalMarkup/100))} to client before tax</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Btn onClick={saveSettings} className="bg-amber-400 text-black hover:bg-amber-500 px-8">Save All Settings</Btn>
    </div>
  );
}

// ================================================================
// APP ROOT
// ================================================================
const DEFAULT_SETTINGS = { overheadPct: 12.5, profitPct: 10, salesTaxPct: 6 };
const TABS = ["Dashboard","Estimator","Jobs","Schedule","Clients","Settings"];

export default function App() {
  const [tab, setTab] = useState("Dashboard");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [jobs, setJobs] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [{ data: jobsData }, { data: estimatesData }] = await Promise.all([
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("estimates").select("*").order("created_at", { ascending: false }),
      ]);
      if (jobsData) setJobs(jobsData);
      if (estimatesData) setEstimates(estimatesData);
      setLoading(false);
    }
    loadData();
  }, []);

  const handleEstimateSaved = (est) => setEstimates(prev => [est, ...prev]);
  const handleJobCreated = (job) => setJobs(prev => [job, ...prev]);

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
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
            <span className="text-black font-black text-sm">N</span>
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">Northshore OS</h1>
            <p className="text-xs text-slate-600 leading-none mt-0.5">Mechanical & Construction</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1.5">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab===t ? "bg-amber-400 text-black shadow-md shadow-amber-900/30" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        {tab==="Dashboard" && <Dashboard jobs={jobs} estimates={estimates} />}
        {tab==="Estimator" && <Estimator settings={settings} onEstimateSaved={handleEstimateSaved} onJobCreated={handleJobCreated} />}
        {tab==="Jobs" && <Jobs jobs={jobs} setJobs={setJobs} />}
        {tab==="Schedule" && <Schedule jobs={jobs} />}
        {tab==="Clients" && <Clients />}
        {tab==="Settings" && <Settings settings={settings} setSettings={setSettings} />}
      </main>

      <footer className="py-3 text-center text-xs text-slate-700 border-t border-slate-900">
        © {new Date().getFullYear()} Northshore Mechanical & Construction LLC — Internal Use Only
      </footer>
    </div>
  );
}