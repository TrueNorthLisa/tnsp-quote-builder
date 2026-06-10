import { useState, useEffect } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const sb = async (method, path, body) => {
  const res = await fetch(`${SB_URL}/rest/v1${path}`, {
    method,
    headers: { "Content-Type":"application/json","apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`,"Prefer":"return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0,200)}`);
  return text ? JSON.parse(text) : [];
};

// ── Screen Print Price Table ───────────────────────────────────────────────────
// Per unit per location, by colour count and quantity tier
// Tiers: 50-100, 101-200, 201-499, 500+
// Under 50: use 50-100 rate with markup (25-49: ×1.25, <25: ×1.40)
const SP_TABLE = {
//  colours: [50-100,  101-200,  201-499,  500+]
    1:  [9.89,  8.44,  8.37,  6.90],
    2:  [10.89, 9.29,  7.45,  5.58],
    3:  [11.89, 10.14, 8.13,  6.09],
    4:  [12.89, 10.99, 8.81,  6.60],
    5:  [13.89, 11.84, 9.49,  7.11],
    6:  [14.89, 12.69, 10.17, 7.62],
    7:  [15.89, 13.54, 10.85, 8.13],
    8:  [16.89, 14.39, 11.53, 8.64],
    9:  [17.89, 15.24, 12.21, 9.15],
    10: [18.89, 16.09, 12.89, 9.66],
};
const SP_EXTRA_PER_COLOUR = 1.00; // per additional colour above 10
const SP_SETUP_FEE = 25.00;       // per colour, one-time per order
const SP_SLEEVE_SURCHARGE = 3.00; // per unit for sleeve/hard print locations
const SP_ART_FEE = 75.00;         // per hour (applied manually)
const SP_INK_CHANGE_FEE = 25.00;  // per colour (applied manually)
const SP_PANTONE_FEE = 25.00;     // per colour (applied manually)

// DTF / Vinyl constants (kept for later)
const DTF_SHEET_COST = 70;
const DTF_SHEET_W = 22;
const DTF_SHEET_H = 60;
const VINYL_COST_PER_SQFT = 2.64;

function getSPRatePerUnit(colours, qty) {
  const c = Math.min(Math.max(parseInt(colours) || 1, 1), 999);
  
  // Get the base rate from the 50-100 tier
  const baseRate = c <= 10
    ? SP_TABLE[c][0]
    : SP_TABLE[10][0] + (c - 10) * SP_EXTRA_PER_COLOUR;

  // Apply quantity tier
  let rate;
  if (qty >= 500) {
    rate = c <= 10 ? SP_TABLE[c][3] : SP_TABLE[10][3] + (c - 10) * SP_EXTRA_PER_COLOUR;
  } else if (qty >= 201) {
    rate = c <= 10 ? SP_TABLE[c][2] : SP_TABLE[10][2] + (c - 10) * SP_EXTRA_PER_COLOUR;
  } else if (qty >= 101) {
    rate = c <= 10 ? SP_TABLE[c][1] : SP_TABLE[10][1] + (c - 10) * SP_EXTRA_PER_COLOUR;
  } else if (qty >= 50) {
    rate = baseRate;
  } else if (qty >= 25) {
    rate = baseRate * 1.25; // 25-49 units: +25%
  } else {
    rate = baseRate * 1.40; // under 25 units: +40%
  }
  
  return rate;
}

function calcScreenPrint({ qty, placements, isRush = false }) {
  let decorationCost = 0;
  let screenSetupFee = 0;

  placements.forEach(p => {
    const colours = parseInt(p.colours) || 1;
    const isSleeve = (p.placement || "").toLowerCase().includes("sleeve")
      || (p.placement || "").toLowerCase().includes("hard print");

    // Per-unit decoration cost for this placement
    const ratePerUnit = getSPRatePerUnit(colours, qty);
    const sleeveSurcharge = isSleeve ? SP_SLEEVE_SURCHARGE : 0;
    decorationCost += (ratePerUnit + sleeveSurcharge) * qty;

    // One-time setup fee per colour for this placement
    screenSetupFee += colours * SP_SETUP_FEE;
  });

  const rushFee = isRush ? (decorationCost + screenSetupFee) * 0.25 : 0;
  return { decorationCost, screenSetupFee, rushFee };
}

function calcDTF({ qty, placements, isRush = false }) {
  let totalCost = 0;
  const LABOUR_PER_PLACEMENT = (5/60) * 40;
  placements.forEach(p => {
    const sizeKey = (p.dtf_size || "standard").toLowerCase();
    let imgW = 8, imgH = 8;
    if (sizeKey.includes("small")) { imgW = 4; imgH = 4; }
    else if (sizeKey.includes("oversized")) { imgW = 14; imgH = 14; }
    const perRow = Math.floor(DTF_SHEET_W / imgW);
    const perCol = Math.floor(DTF_SHEET_H / imgH);
    const imgsPerSheet = perRow * perCol;
    const sheetsNeeded = Math.ceil(qty / imgsPerSheet);
    totalCost += (sheetsNeeded * DTF_SHEET_COST * 1.75) + (LABOUR_PER_PLACEMENT * qty);
  });
  const rushFee = isRush ? totalCost * 0.25 : 0;
  return { decorationCost: totalCost, screenSetupFee: 0, rushFee };
}

function calcVinyl({ qty, placements, isRush = false }) {
  let totalCost = 0;
  const LABOUR_PER_PLACEMENT = (5/60) * 40;
  placements.forEach(p => {
    const w = parseFloat(p.width_in) || 4;
    const h = parseFloat(p.height_in) || 4;
    const sqft = (w * h) / 144;
    totalCost += (sqft * VINYL_COST_PER_SQFT * 1.75 + LABOUR_PER_PLACEMENT) * qty;
  });
  const rushFee = isRush ? totalCost * 0.25 : 0;
  return { decorationCost: totalCost, screenSetupFee: 0, rushFee };
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  root: { minHeight:"100vh", background:"#0d0d0d", color:"#f0ede8", fontFamily:"'DM Mono','Courier New',monospace" },
  header: { background:"#0d0d0d", borderBottom:"3px solid #c8392b", padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, backdropFilter:"blur(12px)" },
  logo: { fontFamily:"'Bebas Neue',sans-serif", fontSize:"22px", letterSpacing:"4px", color:"#f0ede8" },
  logoRed: { color:"#c8392b" },
  nav: { display:"flex", gap:6 },
  navBtn: (active) => ({ padding:"6px 14px", background:active?"#c8392b":"transparent", color:active?"#fff":"#555", border:"1px solid "+( active?"#c8392b":"#333"), borderRadius:3, cursor:"pointer", fontSize:"11px", letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace" }),
  main: { maxWidth:1100, margin:"0 auto", padding:"28px 24px 80px" },
  card: { background:"#141414", border:"1px solid #ffffff12", borderRadius:6, overflow:"hidden", marginBottom:16 },
  cardHead: { background:"#1a1a1a", borderBottom:"1px solid #ffffff10", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" },
  cardTitle: { fontSize:"11px", letterSpacing:"2px", textTransform:"uppercase", color:"#c8392b", fontWeight:700 },
  cardBody: { padding:"20px" },
  g2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 },
  g3: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:16 },
  lbl: { fontSize:"10px", letterSpacing:"1.5px", textTransform:"uppercase", color:"#555", display:"block", marginBottom:6 },
  inp: { background:"#1e1e1e", border:"1px solid #ffffff15", borderBottom:"2px solid #333", color:"#f0ede8", padding:"9px 12px", fontSize:"13px", fontFamily:"'DM Mono',monospace", width:"100%", outline:"none", borderRadius:3 },
  sel: { background:"#1e1e1e", border:"1px solid #ffffff15", borderBottom:"2px solid #333", color:"#f0ede8", padding:"9px 12px", fontSize:"13px", fontFamily:"'DM Mono',monospace", width:"100%", outline:"none", borderRadius:3, appearance:"none" },
  ta: { background:"#1e1e1e", border:"1px solid #ffffff15", borderBottom:"2px solid #333", color:"#f0ede8", padding:"9px 12px", fontSize:"13px", fontFamily:"'DM Mono',monospace", width:"100%", outline:"none", borderRadius:3, resize:"vertical", minHeight:80 },
  btn: (v="p") => ({ padding:"10px 20px", background:v==="p"?"#c8392b":v==="g"?"#2a7a4b":v==="y"?"#e8c547":"transparent", color:v==="y"?"#0d0d0d":"#f0ede8", border:`1px solid ${v==="p"?"#c8392b":v==="g"?"#2a7a4b":v==="y"?"#e8c547":"#333"}`, borderRadius:3, cursor:"pointer", fontSize:"11px", letterSpacing:"1.5px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", fontWeight:700 }),
  tag: (c="#e8c547") => ({ fontSize:"10px", letterSpacing:"1px", textTransform:"uppercase", padding:"3px 8px", background:c+"22", color:c, border:`1px solid ${c}40`, borderRadius:2 }),
  divider: { height:1, background:"#ffffff10", margin:"16px 0" },
  statBox: { background:"#1a1a1a", border:"1px solid #ffffff10", borderRadius:4, padding:"14px 16px", textAlign:"center" },
  statVal: { fontSize:"26px", fontWeight:800, color:"#e8c547", lineHeight:1, marginBottom:4 },
  statLbl: { fontSize:"10px", color:"#555", letterSpacing:"1px", textTransform:"uppercase" },
  toast: { position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#2a7a4b", color:"#fff", padding:"10px 20px", borderRadius:4, fontSize:"12px", letterSpacing:"1px", zIndex:9999, whiteSpace:"nowrap" },
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("submissions");
  const [submissions, setSubmissions] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selSub, setSelSub] = useState(null);
  const [selQuote, setSelQuote] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => { loadData(); }, []);

  const showToast = (msg, type="s") => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [subs, qs] = await Promise.all([
        sb("GET", "/order_submissions?order=created_at.desc&limit=50"),
        sb("GET", "/quotes?order=created_at.desc&limit=50"),
      ]);
      setSubmissions(Array.isArray(subs) ? subs : []);
      setQuotes(Array.isArray(qs) ? qs : []);
    } catch(e) { showToast("Failed to load data", "e"); }
    setLoading(false);
  };

  const openNewQuote = (sub) => {
    setSelSub(sub);
    setSelQuote(null);
    setView("builder");
  };

  const openExistingQuote = (quote) => {
    setSelQuote(quote);
    const sub = submissions.find(s => s.id === quote.submission_id) || null;
    setSelSub(sub);
    setView("builder");
  };

  return (
    <div style={S.root}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>

      <header style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={S.logo}>TRUE <span style={S.logoRed}>NORTH</span></div>
          <div style={{fontSize:"10px",color:"#333",letterSpacing:"2px"}}>QUOTE BUILDER</div>
        </div>
        <div style={S.nav}>
          <button style={S.navBtn(view==="submissions")} onClick={()=>setView("submissions")}>Submissions</button>
          <button style={S.navBtn(view==="quotes")} onClick={()=>setView("quotes")}>Quotes</button>
          <button style={S.navBtn(false)} onClick={()=>{setSelSub(null);setSelQuote(null);setView("builder")}}>+ New Quote</button>
        </div>
      </header>

      <main style={S.main}>
        {loading && <div style={{textAlign:"center",color:"#555",padding:"60px",fontSize:"12px",letterSpacing:"2px"}}>LOADING…</div>}

        {!loading && view==="submissions" && (
          <SubmissionsView submissions={submissions} quotes={quotes} onOpen={openNewQuote} onRefresh={loadData}/>
        )}
        {!loading && view==="quotes" && (
          <QuotesView quotes={quotes} onOpen={openExistingQuote} onRefresh={loadData}/>
        )}
        {view==="builder" && (
          <QuoteBuilder
            submission={selSub}
            existingQuote={selQuote}
            onSaved={(q)=>{loadData();setSelQuote(q);showToast("Quote saved ✓");}}
            onSent={()=>{loadData();setView("quotes");showToast("Quote sent to customer ✓");}}
            toast={showToast}
          />
        )}
      </main>

      {toast && <div style={{...S.toast,background:toast.includes("failed")||toast.includes("error")?"#c8392b":"#2a7a4b"}}>{toast}</div>}
    </div>
  );
}

// ── Submissions View ──────────────────────────────────────────────────────────
function SubmissionsView({ submissions, quotes, onOpen, onRefresh }) {
  const [filter, setFilter] = useState("new");
  const quotedIds = new Set(quotes.map(q => q.submission_id));

  const filtered = submissions.filter(s => {
    if (filter === "new") return s.status === "new" && !quotedIds.has(s.id);
    if (filter === "quoted") return quotedIds.has(s.id);
    return true;
  });

  const newCount = submissions.filter(s => s.status === "new" && !quotedIds.has(s.id)).length;

  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:4}}>INCOMING REQUESTS</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"28px",letterSpacing:"4px",color:"#f0ede8"}}>ORDER SUBMISSIONS</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {newCount > 0 && <span style={S.tag("#c8392b")}>{newCount} NEW</span>}
          {["new","quoted","all"].map(f=>(
            <button key={f} style={{...S.btn(filter===f?"p":"o"),padding:"6px 14px"}} onClick={()=>setFilter(f)}>{f.toUpperCase()}</button>
          ))}
          <button style={{...S.btn("o"),padding:"6px 14px"}} onClick={onRefresh}>↺</button>
        </div>
      </div>

      {filtered.length === 0 && <div style={{textAlign:"center",padding:"60px",color:"#333",fontSize:"12px",letterSpacing:"2px"}}>NO SUBMISSIONS</div>}

      {filtered.map(sub => {
        const hasQuote = quotedIds.has(sub.id);
        const existingQuote = quotes.find(q => q.submission_id === sub.id);
        return (
          <div key={sub.id} style={{...S.card,borderLeft:`3px solid ${hasQuote?"#2a7a4b":"#c8392b"}`}}>
            <div style={S.cardHead}>
              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <div style={{fontSize:"15px",fontWeight:700,color:"#f0ede8"}}>{sub.customer_name}</div>
                {sub.company && <span style={{fontSize:"12px",color:"#666"}}>{sub.company}</span>}
                <span style={S.tag(hasQuote?"#2a7a4b":"#c8392b")}>{hasQuote?"QUOTED":"NEW"}</span>
                {sub.decoration_types?.map(d=><span key={d} style={S.tag("#7eb8f7")}>{d}</span>)}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:"11px",color:"#444"}}>{new Date(sub.created_at).toLocaleDateString("en-CA")}</span>
                {hasQuote && existingQuote
                  ? <button style={S.btn("o")} onClick={()=>onOpen(sub)}>View Quote</button>
                  : <button style={S.btn("p")} onClick={()=>onOpen(sub)}>Build Quote →</button>
                }
              </div>
            </div>
            <div style={{...S.cardBody,display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
              <SubField label="Garment" value={sub.garment_type}/>
              <SubField label="Quantity" value={sub.quantity ? `${sub.quantity} units` : sub.qty_total ? `${sub.qty_total} units` : "—"}/>
              <SubField label="Sizes" value={sub.size_breakdown || "—"}/>
              <SubField label="In-Hands" value={sub.in_hand_date || "—"}/>
              <SubField label="Budget" value={sub.budget_range || "—"}/>
              <SubField label="Artwork" value={sub.artwork_status || "—"}/>
              {sub.sp_placements && <SubField label="SP Placements" value={sub.sp_placements}/>}
              {sub.emb_placements && <SubField label="EMB Placements" value={sub.emb_placements}/>}
              {sub.design_notes && <SubField label="Design Notes" value={sub.design_notes}/>}
              {sub.extra_notes && <SubField label="Notes" value={sub.extra_notes}/>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubField({ label, value }) {
  if (!value || value === "—") return null;
  return (
    <div>
      <div style={{fontSize:"10px",color:"#444",letterSpacing:"1px",textTransform:"uppercase",marginBottom:3}}>{label}</div>
      <div style={{fontSize:"12px",color:"#888",lineHeight:1.4}}>{value}</div>
    </div>
  );
}

// ── Quotes View ───────────────────────────────────────────────────────────────
function QuotesView({ quotes, onOpen, onRefresh }) {
  const statusColor = { draft:"#555", sent:"#7eb8f7", accepted:"#2a7a4b", declined:"#c8392b", changes_requested:"#ff9f43" };

  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <div style={{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:4}}>SENT & DRAFT</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"28px",letterSpacing:"4px",color:"#f0ede8"}}>QUOTES</div>
        </div>
        <button style={{...S.btn("o"),padding:"6px 14px"}} onClick={onRefresh}>↺ Refresh</button>
      </div>

      {quotes.length === 0 && <div style={{textAlign:"center",padding:"60px",color:"#333",fontSize:"12px",letterSpacing:"2px"}}>NO QUOTES YET</div>}

      {quotes.map(q => (
        <div key={q.id} style={{...S.card,cursor:"pointer",borderLeft:`3px solid ${statusColor[q.status]||"#333"}`}} onClick={()=>onOpen(q)}>
          <div style={{...S.cardBody,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                <span style={{fontSize:"11px",color:"#e8c547",fontWeight:700}}>#{q.quote_num}</span>
                <span style={{fontSize:"15px",fontWeight:700,color:"#f0ede8"}}>{q.customer_name}</span>
                {q.company && <span style={{fontSize:"12px",color:"#666"}}>{q.company}</span>}
              </div>
              <div style={{fontSize:"12px",color:"#555"}}>{q.garment_brand} {q.garment_style} — {q.quantity} units · {(q.decoration_types||[]).join(", ")}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"20px",fontWeight:800,color:"#e8c547"}}>${(q.total||0).toFixed(2)}</div>
                <div style={{fontSize:"10px",color:"#444",letterSpacing:"1px"}}>CAD BEFORE TAX</div>
              </div>
              <span style={S.tag(statusColor[q.status]||"#555")}>{(q.status||"draft").toUpperCase().replace("_"," ")}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Quote Builder ─────────────────────────────────────────────────────────────
function QuoteBuilder({ submission, existingQuote, onSaved, onSent, toast }) {
  const sub = submission || {};

  const [quoteNum, setQuoteNum] = useState(existingQuote?.quote_num || "");
  const [custName, setCustName] = useState(existingQuote?.customer_name || sub.customer_name || "");
  const [custEmail, setCustEmail] = useState(existingQuote?.customer_email || sub.customer_email || "");
  const [custPhone, setCustPhone] = useState(existingQuote?.customer_phone || sub.customer_phone || "");
  const [company, setCompany] = useState(existingQuote?.company || sub.company || "");
  const [decorTypes, setDecorTypes] = useState(existingQuote?.decoration_types || sub.decoration_types || []);
  const [garmentBrand, setGarmentBrand] = useState(existingQuote?.garment_brand || "");
  const [garmentStyle, setGarmentStyle] = useState(existingQuote?.garment_style || sub.garment_type || "");
  const [garmentColour, setGarmentColour] = useState(existingQuote?.garment_colour || sub.garment_colours || "");
  const [qty, setQty] = useState(existingQuote?.quantity || parseInt(sub.quantity||sub.qty_total) || 0);
  const [blankCost, setBlankCost] = useState(existingQuote?.blank_cost || 0);
  const [inHandDate, setInHandDate] = useState(existingQuote?.in_hand_date || sub.in_hand_date || "");
  const [isRush, setIsRush] = useState(existingQuote?.is_rush || false);
  const [tier, setTier] = useState(existingQuote?.tier || "mid");
  const [notes, setNotes] = useState(existingQuote?.notes || "");
  const [ssStyleNum, setSsStyleNum] = useState("");
  const [ssLoading, setSsLoading] = useState(false);
  const [ssPrices, setSsPrices] = useState(null);
  const [savedQuoteId, setSavedQuoteId] = useState(existingQuote?.id || null);
  const [sending, setSending] = useState(false);

  // Placements state
  const [spPlacements, setSpPlacements] = useState(() => {
    if (existingQuote?.pricing?.sp_placements) return existingQuote.pricing.sp_placements;
    if (sub.sp_placements) {
      return sub.sp_placements.split(",").map((p,i) => {
        const match = p.trim().match(/^(.*?)\s*\((\d+)\s*colour/i);
        return { id:i, placement:match?.[1]?.trim()||p.trim(), colours:match?.[2]||"1" };
      });
    }
    return [{ id:0, placement:"Left Chest", colours:"1" }];
  });

  const [embPlacements, setEmbPlacements] = useState(() => {
    if (existingQuote?.pricing?.emb_placements) return existingQuote.pricing.emb_placements;
    if (sub.emb_placements) {
      return sub.emb_placements.split(",").map((p,i) => ({ id:i, placement:p.trim(), stitches:"7500" }));
    }
    return [{ id:0, placement:"Left Chest", stitches:"7500" }];
  });

  const [dtfPlacements, setDtfPlacements] = useState(() => {
    if (existingQuote?.pricing?.dtf_placements) return existingQuote.pricing.dtf_placements;
    return [{ id:0, dtf_size:"standard", width_in:"8", height_in:"8" }];
  });

  const [vinylPlacements, setVinylPlacements] = useState(() => {
    if (existingQuote?.pricing?.vinyl_placements) return existingQuote.pricing.vinyl_placements;
    return [{ id:0, placement:"Front", width_in:"4", height_in:"4" }];
  });

  // Pricing calc
  const isSP = decorTypes.includes("sp") || decorTypes.includes("Screen Printing");
  const isEMB = decorTypes.includes("emb") || decorTypes.includes("Embroidery");
  const isDTF = decorTypes.includes("dtf") || decorTypes.includes("DTF Transfer");
  const isVinyl = decorTypes.includes("vinyl") || decorTypes.includes("Vinyl Heat Press");

  let decorCost = 0, setupFee = 0, rushFee = 0;
  if (isSP && qty > 0) {
    const r = calcScreenPrint({ qty, placements:spPlacements, isRush });
    decorCost += r.decorationCost; setupFee += r.screenSetupFee; rushFee += r.rushFee;
  }
  if (isEMB && qty > 0) {
    // EMB placeholder — coming soon
    decorCost += 0;
  }
  if (isDTF && qty > 0) {
    const r = calcDTF({ qty, placements:dtfPlacements, isRush });
    decorCost += r.decorationCost; rushFee += r.rushFee;
  }
  if (isVinyl && qty > 0) {
    const r = calcVinyl({ qty, placements:vinylPlacements, isRush });
    decorCost += r.decorationCost; rushFee += r.rushFee;
  }

  const blankTotal = blankCost * qty;
  const subtotal = blankTotal + decorCost + setupFee;
  const total = subtotal + rushFee;
  const perUnit = qty > 0 ? total / qty : 0;

  const fetchSSPricing = async () => {
    if (!ssStyleNum.trim()) return;
    setSsLoading(true); setSsPrices(null);
    try {
      const res = await fetch("/api/ss-pricing", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({styleNum:ssStyleNum.trim()}) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSsPrices(data);
    } catch(e) { toast("S&S lookup failed: "+e.message, "e"); }
    setSsLoading(false);
  };

  const buildQuotePayload = () => ({
    quote_num: quoteNum || `Q-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    submission_id: sub.id || null,
    customer_name: custName,
    customer_email: custEmail,
    customer_phone: custPhone,
    company,
    decoration_types: decorTypes,
    garment_brand: garmentBrand,
    garment_style: garmentStyle,
    garment_colour: garmentColour,
    quantity: qty,
    blank_cost: blankCost,
    decoration_cost: decorCost,
    setup_fee: setupFee,
    rush_fee: rushFee,
    subtotal,
    total,
    is_rush: isRush,
    tier,
    in_hand_date: inHandDate,
    notes,
    status: "draft",
    accept_token: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    pricing: {
      sp_placements: spPlacements,
      emb_placements: embPlacements,
      dtf_placements: dtfPlacements,
      vinyl_placements: vinylPlacements,
    },
    placements: [
      ...(isSP ? spPlacements.map(p=>({placement:p.placement,type:"Screen Print",detail:`${p.colours} colour${p.colours!=1?"s":""}`,price:null})) : []),
      ...(isEMB ? embPlacements.map(p=>({placement:p.placement,type:"Embroidery",detail:`~${parseInt(p.stitches||7500).toLocaleString()} stitches`,price:null})) : []),
      ...(isDTF ? dtfPlacements.map(p=>({placement:p.placement||"Front",type:"DTF",detail:p.dtf_size,price:null})) : []),
      ...(isVinyl ? vinylPlacements.map(p=>({placement:p.placement||"Front",type:"Vinyl",detail:`${p.width_in}"×${p.height_in}"`,price:null})) : []),
    ],
    updated_at: new Date().toISOString(),
  });

  const saveQuote = async () => {
    const payload = buildQuotePayload();
    if (!payload.quote_num) payload.quote_num = `Q-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    setQuoteNum(payload.quote_num);
    try {
      let saved;
      if (savedQuoteId) {
        await sb("PATCH", `/quotes?id=eq.${savedQuoteId}`, payload);
        saved = { ...payload, id: savedQuoteId };
      } else {
        const [r] = await sb("POST", "/quotes", payload);
        saved = r;
        setSavedQuoteId(r.id);
      }
      // Mark submission as quoted
      if (sub.id) await sb("PATCH", `/order_submissions?id=eq.${sub.id}`, { status:"quoted" });
      onSaved(saved);
    } catch(e) { toast("Save failed: "+e.message, "e"); }
  };

  const sendQuote = async () => {
    if (!custEmail) { toast("Customer email required", "e"); return; }
    setSending(true);
    try {
      await saveQuote();
      const quoteData = buildQuotePayload();
      quoteData.id = savedQuoteId;
      const res = await fetch("/api/send-quote", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ quote:quoteData, submission:{ customer_name:custName, customer_email:custEmail } }),
      });
      if (!res.ok) throw new Error("Send failed");
      await sb("PATCH", `/quotes?id=eq.${savedQuoteId}`, { status:"sent", sent_at:new Date().toISOString() });
      onSent();
    } catch(e) { toast("Send failed: "+e.message, "e"); }
    setSending(false);
  };

  const DECOR_OPTIONS = [
    {key:"Screen Printing", label:"Screen Print"},
    {key:"Embroidery", label:"Embroidery"},
    {key:"DTF Transfer", label:"DTF"},
    {key:"Vinyl Heat Press", label:"Vinyl"},
  ];

  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:4}}>
            {sub.customer_name ? `FROM: ${sub.customer_name.toUpperCase()}` : "MANUAL ENTRY"}
          </div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"28px",letterSpacing:"4px",color:"#f0ede8"}}>
            {quoteNum || "NEW QUOTE"}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={S.btn("o")} onClick={saveQuote}>Save Draft</button>
          <button style={S.btn("y")} onClick={sendQuote} disabled={sending}>
            {sending ? "Sending…" : "Send to Customer →"}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <div style={S.statBox}><div style={S.statVal}>{qty}</div><div style={S.statLbl}>Units</div></div>
        <div style={S.statBox}><div style={S.statVal}>${blankTotal.toFixed(0)}</div><div style={S.statLbl}>Blanks Total</div></div>
        <div style={S.statBox}><div style={S.statVal}>${(decorCost+setupFee).toFixed(0)}</div><div style={S.statLbl}>Decoration</div></div>
        <div style={{...S.statBox,border:"1px solid #e8c54740",background:"#e8c54710"}}>
          <div style={{...S.statVal,fontSize:"28px"}}>${total.toFixed(2)}</div>
          <div style={{...S.statLbl,color:"#e8c547"}}>${perUnit.toFixed(2)}/unit · CAD</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
        {/* Left column */}
        <div>
          {/* Customer */}
          <div style={S.card}>
            <div style={S.cardHead}><div style={S.cardTitle}>Customer</div></div>
            <div style={S.cardBody}>
              <div style={S.g2}>
                <div><label style={S.lbl}>Name</label><input style={S.inp} value={custName} onChange={e=>setCustName(e.target.value)} placeholder="Full name"/></div>
                <div><label style={S.lbl}>Company</label><input style={S.inp} value={company} onChange={e=>setCompany(e.target.value)} placeholder="Company name"/></div>
              </div>
              <div style={S.g2}>
                <div><label style={S.lbl}>Email *</label><input style={S.inp} value={custEmail} onChange={e=>setCustEmail(e.target.value)} placeholder="email@example.com"/></div>
                <div><label style={S.lbl}>Phone</label><input style={S.inp} value={custPhone} onChange={e=>setCustPhone(e.target.value)} placeholder="604-555-0100"/></div>
              </div>
            </div>
          </div>

          {/* Order details */}
          <div style={S.card}>
            <div style={S.cardHead}><div style={S.cardTitle}>Order Details</div></div>
            <div style={S.cardBody}>
              <div style={S.g2}>
                <div><label style={S.lbl}>Quote #</label><input style={S.inp} value={quoteNum} onChange={e=>setQuoteNum(e.target.value)} placeholder="Auto-generated"/></div>
                <div><label style={S.lbl}>In-Hands Date</label><input style={S.inp} value={inHandDate} onChange={e=>setInHandDate(e.target.value)} placeholder="e.g. June 15, 2026"/></div>
              </div>
              <div style={S.g2}>
                <div><label style={S.lbl}>Quantity</label><input style={S.inp} type="number" value={qty} onChange={e=>setQty(parseInt(e.target.value)||0)} placeholder="0"/></div>
                <div>
                  <label style={S.lbl}>Quantity Tier</label>
                  <div style={{...S.inp,color:"#e8c547",cursor:"default"}}>
                    {qty === 0 ? "Enter quantity" :
                     qty < 25 ? `< 25 units (+40% on 50-100 rate)` :
                     qty < 50 ? `25–49 units (+25% on 50-100 rate)` :
                     qty <= 100 ? `50–100 units (base rate)` :
                     qty <= 200 ? `101–200 units` :
                     qty <= 499 ? `201–499 units` :
                     `500+ units`}
                  </div>
                </div>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:8}}>
                <input type="checkbox" checked={isRush} onChange={e=>setIsRush(e.target.checked)} style={{accentColor:"#ff9f43",width:14,height:14}}/>
                <span style={{fontSize:"12px",color:isRush?"#ff9f43":"#555",letterSpacing:"1px"}}>RUSH ORDER (+25%)</span>
              </label>
              <div style={{marginBottom:16}}>
                <label style={S.lbl}>Decoration Types</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {DECOR_OPTIONS.map(d=>{
                    const active = decorTypes.includes(d.key);
                    return (
                      <button key={d.key}
                        style={{padding:"6px 14px",background:active?"#c8392b22":"transparent",color:active?"#c8392b":"#555",border:`1px solid ${active?"#c8392b":"#333"}`,borderRadius:3,cursor:"pointer",fontSize:"11px",letterSpacing:"1px",fontFamily:"'DM Mono',monospace"}}
                        onClick={()=>setDecorTypes(prev=>prev.includes(d.key)?prev.filter(x=>x!==d.key):[...prev,d.key])}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Garments + S&S lookup */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div style={S.cardTitle}>Garments & Blank Cost</div>
            </div>
            <div style={S.cardBody}>
              <div style={S.g3}>
                <div><label style={S.lbl}>Brand</label><input style={S.inp} value={garmentBrand} onChange={e=>setGarmentBrand(e.target.value)} placeholder="Gildan"/></div>
                <div><label style={S.lbl}>Style</label><input style={S.inp} value={garmentStyle} onChange={e=>setGarmentStyle(e.target.value)} placeholder="5000 Heavy Cotton"/></div>
                <div><label style={S.lbl}>Colour</label><input style={S.inp} value={garmentColour} onChange={e=>setGarmentColour(e.target.value)} placeholder="Black"/></div>
              </div>

              {/* S&S Lookup */}
              <div style={{background:"#1a1a1a",border:"1px solid #ffffff08",borderRadius:4,padding:"14px",marginBottom:16}}>
                <div style={{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:10}}>S&S CANADA LIVE PRICING</div>
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  <input style={{...S.inp,flex:1}} value={ssStyleNum} onChange={e=>setSsStyleNum(e.target.value)} placeholder="Style # (e.g. G500)" onKeyDown={e=>e.key==="Enter"&&fetchSSPricing()}/>
                  <button style={S.btn("o")} onClick={fetchSSPricing} disabled={ssLoading}>{ssLoading?"…":"Look up"}</button>
                </div>
                {ssPrices && (
                  <div>
                    <div style={{fontSize:"11px",color:"#2a7a4b",marginBottom:8}}>✓ {ssPrices.title || ssStyleNum}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {(ssPrices.prices || ssPrices.casePrices || []).slice(0,6).map((p,i)=>(
                        <button key={i} style={{padding:"6px 10px",background:"#0d0d0d",border:"1px solid #333",color:"#d4d0c8",cursor:"pointer",fontSize:"11px",fontFamily:"'DM Mono',monospace",borderRadius:3}}
                          onClick={()=>setBlankCost(parseFloat(p.price||p.casePrice)||0)}>
                          {p.minQty||p.qty||""}+ · ${parseFloat(p.price||p.casePrice||0).toFixed(2)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={S.lbl}>Blank Cost Per Unit (CAD)</label>
                <input style={S.inp} type="number" step="0.01" value={blankCost} onChange={e=>setBlankCost(parseFloat(e.target.value)||0)} placeholder="0.00"/>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={S.card}>
            <div style={S.cardHead}><div style={S.cardTitle}>Notes to Customer</div></div>
            <div style={S.cardBody}>
              <textarea style={S.ta} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any special notes, conditions, or information for the customer…" rows={4}/>
            </div>
          </div>
        </div>

        {/* Right column — Pricing detail */}
        <div>
          {/* Screen Print */}
          {isSP && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <div style={S.cardTitle}>Screen Print Placements</div>
                <button style={{...S.btn("o"),padding:"4px 10px",fontSize:"10px"}} onClick={()=>setSpPlacements(p=>[...p,{id:Date.now(),placement:"",colours:"1"}])}>+ Add</button>
              </div>
              <div style={S.cardBody}>
                {spPlacements.map((p,i)=>(
                  <div key={p.id} style={{background:"#1a1a1a",border:"1px solid #ffffff08",borderRadius:4,padding:"12px",marginBottom:10}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 80px 32px",gap:8,marginBottom:8,alignItems:"end"}}>
                      <div>
                        {i===0 && <label style={S.lbl}>Placement</label>}
                        <select style={S.sel} value={p.placement} onChange={e=>setSpPlacements(prev=>prev.map(x=>x.id===p.id?{...x,placement:e.target.value}:x))}>
                          {["Left Chest","Right Chest","Centre Front","Full Front","Full Back","Centre Back","Left Sleeve","Right Sleeve","Back Neck / Nape","Other / Custom"].map(o=><option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        {i===0 && <label style={S.lbl}>Colours</label>}
                        <input style={S.inp} type="number" min="1" max="12" value={p.colours} onChange={e=>setSpPlacements(prev=>prev.map(x=>x.id===p.id?{...x,colours:e.target.value}:x))} placeholder="1"/>
                      </div>
                      <button style={{...S.btn("o"),padding:"6px",fontSize:"14px",marginTop:i===0?20:0}} onClick={()=>setSpPlacements(prev=>prev.filter(x=>x.id!==p.id))}>✕</button>
                    </div>
                    {qty > 0 && (
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:"#555",letterSpacing:"1px"}}>
                        <span>
                          ${getSPRatePerUnit(p.colours, qty).toFixed(2)}/unit
                          {(p.placement||"").toLowerCase().includes("sleeve") ? " + $3.00 sleeve" : ""}
                          {" × "}{qty} units
                        </span>
                        <span style={{color:"#e8c547"}}>
                          = ${((getSPRatePerUnit(p.colours, qty) + ((p.placement||"").toLowerCase().includes("sleeve") ? 3 : 0)) * qty).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <div style={S.divider}/>
                {qty > 0 && (
                  <div style={{fontSize:"11px",color:"#555",letterSpacing:"1px",lineHeight:1.8}}>
                    <div>Decoration: ${calcScreenPrint({qty,placements:spPlacements,isRush:false}).decorationCost.toFixed(2)}</div>
                    <div>Setup fees: ${calcScreenPrint({qty,placements:spPlacements,isRush:false}).screenSetupFee.toFixed(2)} ({spPlacements.reduce((a,p)=>a+(parseInt(p.colours)||1),0)} colours × $25)</div>
                    {isRush && <div style={{color:"#ff9f43"}}>Rush fee: ${calcScreenPrint({qty,placements:spPlacements,isRush:true}).rushFee.toFixed(2)}</div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Embroidery */}
          {isEMB && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <div style={S.cardTitle}>Embroidery Placements</div>
                <button style={{...S.btn("o"),padding:"4px 10px",fontSize:"10px"}} onClick={()=>setEmbPlacements(p=>[...p,{id:Date.now(),placement:"",stitches:"7500"}])}>+ Add</button>
              </div>
              <div style={S.cardBody}>
                {embPlacements.map((p,i)=>(
                  <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 100px 32px",gap:8,marginBottom:10,alignItems:"end"}}>
                    <div>
                      {i===0 && <label style={S.lbl}>Placement</label>}
                      <select style={S.sel} value={p.placement} onChange={e=>setEmbPlacements(prev=>prev.map(x=>x.id===p.id?{...x,placement:e.target.value}:x))}>
                        {["Left Chest","Centre Front","Hat Front","Left Sleeve","Right Sleeve","Hat Side Left","Hat Side Right","Hat Back","Centre Back","Other"].map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      {i===0 && <label style={S.lbl}>Stitches</label>}
                      <input style={S.inp} type="number" value={p.stitches} onChange={e=>setEmbPlacements(prev=>prev.map(x=>x.id===p.id?{...x,stitches:e.target.value}:x))} placeholder="7500"/>
                    </div>
                    <button style={{...S.btn("o"),padding:"6px",fontSize:"14px",marginTop:i===0?20:0}} onClick={()=>setEmbPlacements(prev=>prev.filter(x=>x.id!==p.id))}>✕</button>
                  </div>
                ))}
                <div style={S.divider}/>
                <div style={{fontSize:"11px",color:"#555",letterSpacing:"1px"}}>
                  Total: ${calcEmbroidery({qty,placements:embPlacements,garmentType:garmentStyle,isRush}).decorationCost.toFixed(2)} (incl. digitizing)
                </div>
              </div>
            </div>
          )}

          {/* DTF */}
          {isDTF && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <div style={S.cardTitle}>DTF Placements</div>
                <button style={{...S.btn("o"),padding:"4px 10px",fontSize:"10px"}} onClick={()=>setDtfPlacements(p=>[...p,{id:Date.now(),dtf_size:"standard",width_in:"8",height_in:"8"}])}>+ Add</button>
              </div>
              <div style={S.cardBody}>
                {dtfPlacements.map((p,i)=>(
                  <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 32px",gap:8,marginBottom:10,alignItems:"end"}}>
                    <div>
                      {i===0 && <label style={S.lbl}>Size</label>}
                      <select style={S.sel} value={p.dtf_size} onChange={e=>setDtfPlacements(prev=>prev.map(x=>x.id===p.id?{...x,dtf_size:e.target.value}:x))}>
                        <option value="small">Small (≤4")</option>
                        <option value="standard">Standard (4–8")</option>
                        <option value="oversized">Oversized (8"+)</option>
                      </select>
                    </div>
                    <div>
                      {i===0 && <label style={S.lbl}>W (in)</label>}
                      <input style={S.inp} type="number" value={p.width_in} onChange={e=>setDtfPlacements(prev=>prev.map(x=>x.id===p.id?{...x,width_in:e.target.value}:x))} placeholder='8"'/>
                    </div>
                    <div>
                      {i===0 && <label style={S.lbl}>H (in)</label>}
                      <input style={S.inp} type="number" value={p.height_in} onChange={e=>setDtfPlacements(prev=>prev.map(x=>x.id===p.id?{...x,height_in:e.target.value}:x))} placeholder='8"'/>
                    </div>
                    <button style={{...S.btn("o"),padding:"6px",fontSize:"14px",marginTop:i===0?20:0}} onClick={()=>setDtfPlacements(prev=>prev.filter(x=>x.id!==p.id))}>✕</button>
                  </div>
                ))}
                <div style={S.divider}/>
                <div style={{fontSize:"11px",color:"#555",letterSpacing:"1px"}}>
                  Total: ${calcDTF({qty,placements:dtfPlacements,isRush}).decorationCost.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Vinyl */}
          {isVinyl && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <div style={S.cardTitle}>Vinyl Placements</div>
                <button style={{...S.btn("o"),padding:"4px 10px",fontSize:"10px"}} onClick={()=>setVinylPlacements(p=>[...p,{id:Date.now(),placement:"Front",width_in:"4",height_in:"4"}])}>+ Add</button>
              </div>
              <div style={S.cardBody}>
                {vinylPlacements.map((p,i)=>(
                  <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 32px",gap:8,marginBottom:10,alignItems:"end"}}>
                    <div>
                      {i===0 && <label style={S.lbl}>Placement</label>}
                      <input style={S.inp} value={p.placement} onChange={e=>setVinylPlacements(prev=>prev.map(x=>x.id===p.id?{...x,placement:e.target.value}:x))} placeholder="Front"/>
                    </div>
                    <div>
                      {i===0 && <label style={S.lbl}>W (in)</label>}
                      <input style={S.inp} type="number" value={p.width_in} onChange={e=>setVinylPlacements(prev=>prev.map(x=>x.id===p.id?{...x,width_in:e.target.value}:x))} placeholder="4"/>
                    </div>
                    <div>
                      {i===0 && <label style={S.lbl}>H (in)</label>}
                      <input style={S.inp} type="number" value={p.height_in} onChange={e=>setVinylPlacements(prev=>prev.map(x=>x.id===p.id?{...x,height_in:e.target.value}:x))} placeholder="4"/>
                    </div>
                    <button style={{...S.btn("o"),padding:"6px",fontSize:"14px",marginTop:i===0?20:0}} onClick={()=>setVinylPlacements(prev=>prev.filter(x=>x.id!==p.id))}>✕</button>
                  </div>
                ))}
                <div style={S.divider}/>
                <div style={{fontSize:"11px",color:"#555",letterSpacing:"1px"}}>
                  Total: ${calcVinyl({qty,placements:vinylPlacements,isRush}).decorationCost.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Cost Summary */}
          <div style={{...S.card,border:"1px solid #e8c54730"}}>
            <div style={{...S.cardHead,borderBottom:"1px solid #e8c54720"}}>
              <div style={{...S.cardTitle,color:"#e8c547"}}>Cost Summary</div>
            </div>
            <div style={S.cardBody}>
              {[
                ["Blanks", `${qty} × $${blankCost.toFixed(2)}`, blankTotal],
                ["Decoration Labor", "", decorCost],
                ...(setupFee > 0 ? [["Screen Setup / Screens", "", setupFee]] : []),
                ...(rushFee > 0 ? [["Rush Fee (25%)", "", rushFee]] : []),
              ].map(([label, detail, val]) => (
                <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #ffffff08"}}>
                  <div>
                    <span style={{fontSize:"13px",color:"#888"}}>{label}</span>
                    {detail && <span style={{fontSize:"11px",color:"#444",marginLeft:8}}>{detail}</span>}
                  </div>
                  <span style={{fontSize:"13px",color:"#d4d0c8"}}>${val.toFixed(2)}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0 0",borderTop:"2px solid #c8392b",marginTop:8}}>
                <span style={{fontSize:"15px",fontWeight:700,color:"#f0ede8",letterSpacing:"1px"}}>TOTAL (before tax)</span>
                <span style={{fontSize:"22px",fontWeight:800,color:"#e8c547"}}>${total.toFixed(2)} CAD</span>
              </div>
              <div style={{textAlign:"right",fontSize:"12px",color:"#555",marginTop:4}}>${perUnit.toFixed(2)}/unit</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
