/* Probity — autonomous counterparty clearance agent.
   Loop: validate registration -> screen sanctions -> scan adverse media
         -> adjudicate (AI) -> self-audit (AI) -> verdict.
   All keys live server-side in Netlify Functions. Cases stored on-device only. */

/* ---------------- i18n ---------------- */
const I18N = {
  en: {
    tagline:"Counterparty clearance",
    amlr:"<b>EU AMLR</b> — counterparty screening mandatory from Jul 2026",
    intakeEyebrow:"New clearance",
    lblName:'Counterparty name <span class="hint">— person or company</span>',
    lblCountry:"Country", lblVat:'VAT number <span class="hint">— optional, enables live registration check</span>',
    runBtn:"Run clearance",
    formnote:"Probity validates the VAT registration, screens the official EU and UN sanctions lists, scans adverse media, then adjudicates and self-audits the findings. Nothing is stored outside this device.",
    savedTitle:"Saved clearances",
    emptyBig:"No clearance run yet",
    emptySub:"Enter a counterparty and Probity will work through the full due-diligence loop autonomously.",
    s1:"Validate registration", s2:"Screen sanctions lists", s3:"Scan adverse media", s4:"Adjudicate matches", s5:"Self-audit",
    pName:"Enter a counterparty name to run a clearance.",
    phaseValidate:"Validating registration", phaseSanctions:"Screening EU & UN sanctions lists",
    phaseAdverse:"Scanning adverse media", phaseAdjudicate:"Adjudicating matches", phaseAudit:"Self-auditing assessment",
    regCheck:"Registration check", sanctions:"Sanctions screening", adverse:"Adverse media",
    decisionLog:"Decision log", listsScreened:"Lists screened",
    vatNot:"VAT not provided — registration not verified", regUnavail:"Registry temporarily unavailable",
    regValid:"Valid & registered", regInvalid:"Not a valid registration", noSanctions:"No confirmed match on screened lists",
    noAdverse:"No relevant adverse media found", analystDraft:"Analyst draft", auditReview:"Compliance self-audit",
    changeLabel:"What the audit changed:", export:"Export JSON", rescreen:"Re-screen",
    risk:"Risk", keyRisks:"Key risks",
    disclaimer:"Probity produces a screening signal for triage — not certified compliance and not legal advice. Sanctions lists update daily and name matching is probabilistic; confirm any hit directly against the official source before acting. Registration data comes from the European Commission VIES service in real time.",
    dec:{PROCEED:"Proceed", ENHANCED_DUE_DILIGENCE:"Enhanced due diligence", DO_NOT_PROCEED:"Do not proceed"},
    stamp:{PROCEED:"CLEAR", ENHANCED_DUE_DILIGENCE:"REVIEW", DO_NOT_PROCEED:"DECLINE"},
    langName:"English"
  },
  bg: {
    tagline:"Проверка на контрагент",
    amlr:"<b>EU AMLR</b> — проверката на контрагенти е задължителна от юли 2026",
    intakeEyebrow:"Нова проверка",
    lblName:'Име на контрагент <span class="hint">— лице или фирма</span>',
    lblCountry:"Държава", lblVat:'ДДС номер <span class="hint">— по избор, активира жива проверка на регистрацията</span>',
    runBtn:"Стартирай проверка",
    formnote:"Probity валидира ДДС регистрацията, проверява официалните EU и UN санкционни списъци, сканира за adverse media, после преценява и самоодитира находките. Нищо не се съхранява извън това устройство.",
    savedTitle:"Запазени проверки",
    emptyBig:"Все още няма проверка",
    emptySub:"Въведи контрагент и Probity ще премине автономно през целия due-diligence цикъл.",
    s1:"Валидирай регистрация", s2:"Провери санкционни списъци", s3:"Сканирай adverse media", s4:"Прецени съвпадения", s5:"Самоодит",
    pName:"Въведи име на контрагент, за да стартираш проверка.",
    phaseValidate:"Валидиране на регистрация", phaseSanctions:"Проверка на EU и UN санкционни списъци",
    phaseAdverse:"Сканиране на adverse media", phaseAdjudicate:"Преценка на съвпадения", phaseAudit:"Самоодит на оценката",
    regCheck:"Проверка на регистрация", sanctions:"Санкционна проверка", adverse:"Adverse media",
    decisionLog:"Журнал на решението", listsScreened:"Проверени списъци",
    vatNot:"Няма ДДС номер — регистрацията не е проверена", regUnavail:"Регистърът е временно недостъпен",
    regValid:"Валидна и регистрирана", regInvalid:"Невалидна регистрация", noSanctions:"Няма потвърдено съвпадение в проверените списъци",
    noAdverse:"Няма релевантни adverse media", analystDraft:"Чернова на анализатора", auditReview:"Самоодит за съответствие",
    changeLabel:"Какво промени одитът:", export:"Експорт JSON", rescreen:"Повтори проверката",
    risk:"Риск", keyRisks:"Ключови рискове",
    disclaimer:"Probity дава screening сигнал за триаж — не е сертифицирано съответствие и не е правен съвет. Санкционните списъци се обновяват дневно и съпоставянето на имена е вероятностно; потвърди всяко съвпадение директно в официалния източник, преди да действаш. Данните за регистрация идват в реално време от услугата VIES на Европейската комисия.",
    dec:{PROCEED:"Продължи", ENHANCED_DUE_DILIGENCE:"Задълбочена проверка", DO_NOT_PROCEED:"Не продължавай"},
    stamp:{PROCEED:"ЧИСТО", ENHANCED_DUE_DILIGENCE:"ПРОВЕРКА", DO_NOT_PROCEED:"ОТКАЗ"},
    langName:"български"
  }
};
let LANG = localStorage.getItem("probity_lang") || "en";

const COUNTRIES = [
  ["","—"],["BG","Bulgaria"],["AT","Austria"],["BE","Belgium"],["HR","Croatia"],["CY","Cyprus"],
  ["CZ","Czechia"],["DK","Denmark"],["EE","Estonia"],["FI","Finland"],["FR","France"],["DE","Germany"],
  ["EL","Greece"],["HU","Hungary"],["IE","Ireland"],["IT","Italy"],["LV","Latvia"],["LT","Lithuania"],
  ["LU","Luxembourg"],["MT","Malta"],["NL","Netherlands"],["PL","Poland"],["PT","Portugal"],["RO","Romania"],
  ["SK","Slovakia"],["SI","Slovenia"],["ES","Spain"],["SE","Sweden"],["GB","United Kingdom"],
  ["CH","Switzerland"],["US","United States"],["TR","Türkiye"],["RS","Serbia"],["UA","Ukraine"],["OTHER","Other"]
];
const VAT_CC = COUNTRIES.filter(c => c[0] && !["GB","US","CH","TR","RS","UA","OTHER"].includes(c[0]));

/* ---------------- boot ---------------- */
function t(k){ return I18N[LANG][k]; }
function setLang(l){
  LANG = l; localStorage.setItem("probity_lang", l);
  document.getElementById("en").classList.toggle("on", l==="en");
  document.getElementById("bg").classList.toggle("on", l==="bg");
  document.documentElement.lang = l;
  applyStatic();
  renderSaved();
}
function applyStatic(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const k = el.getAttribute("data-i18n");
    if (I18N[LANG][k] !== undefined) el.innerHTML = I18N[LANG][k];
  });
}
function fillSelects(){
  const c = document.getElementById("country");
  c.innerHTML = COUNTRIES.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
  const v = document.getElementById("vatcc");
  v.innerHTML = VAT_CC.map(([val])=>`<option value="${val}">${val}</option>`).join("");
}
window.addEventListener("DOMContentLoaded", ()=>{
  fillSelects(); setLang(LANG); renderSaved();
  document.getElementById("name").addEventListener("keydown", e=>{ if(e.key==="Enter") runClearance(); });
});

/* ---------------- backend calls ---------------- */
async function fn(path, payload){
  const r = await fetch("/.netlify/functions/"+path, {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)
  });
  let data; try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data.error || (path+" failed ("+r.status+")"));
  return data;
}
async function groqJSON(messages){
  const d = await fn("groq", { messages, json:true, temperature:0.12 });
  let c = (d.content||"").replace(/```json/gi,"").replace(/```/g,"").trim();
  return JSON.parse(c);
}

/* ---------------- the loop ---------------- */
let BUSY = false;
async function runClearance(){
  if (BUSY) return;
  const name = document.getElementById("name").value.trim();
  const country = document.getElementById("country").value;
  const vatcc = document.getElementById("vatcc").value;
  const vat = document.getElementById("vat").value.trim();
  if (!name){ flashError(t("pName")); return; }

  BUSY = true;
  document.getElementById("run").disabled = true;
  const phases = ["phaseValidate","phaseSanctions","phaseAdverse","phaseAdjudicate","phaseAudit"];
  renderLoader(phases);
  const setPhase = (i)=>{ updateLoader(i); };

  try {
    // 1. registration
    setPhase(0);
    let vies = null;
    if (vat) { try { vies = await fn("vies", { countryCode: vatcc, vatNumber: vat }); } catch(e){ vies = { unavailable:true, error:String(e.message) }; } }
    markDone(0);

    // 2. sanctions
    setPhase(1);
    const sanc = await fn("sanctions", { name });
    markDone(1);

    // 3. adverse media
    setPhase(2);
    let adv = { organic:[] };
    try { adv = await fn("adverse", { name, country: countryName(country) }); } catch(e){ adv = { organic:[], unavailable:true }; }
    markDone(2);

    // 4. adjudicate
    setPhase(3);
    const input = { counterparty:{ name, country: countryName(country), vat: vat? (vatcc+vat):null },
                    registration: vies, sanctionsSnippets: sanc.matches||[], adverseResults: adv.organic||[] };
    const draft = await groqJSON(adjudicatePrompt(input));
    markDone(3);

    // 5. self-audit
    setPhase(4);
    const final = await groqJSON(auditPrompt(input, draft));
    markDone(4);

    const result = {
      id: "c_"+Date.now(),
      name, country, vat: vat? (vatcc+vat):"", ts: Date.now(),
      vies, sources: sanc.sourcesUsed||[], sourceErrors: sanc.errors||[],
      draft, final,
      decision: final.finalDecision || draft.draftDecision || "ENHANCED_DUE_DILIGENCE",
      score: clampScore(final.finalScore ?? draft.draftScore)
    };
    saveCase(result);
    renderResult(result);
  } catch (e){
    flashError((LANG==="bg"?"Грешка: ":"Error: ") + (e.message||e));
  } finally {
    BUSY = false; document.getElementById("run").disabled = false;
  }
}

function adjudicatePrompt(input){
  const lang = I18N[LANG].langName;
  return [
    { role:"system", content:
      "You are a conservative, evidence-bound sanctions and counterparty due-diligence analyst for a small business. "+
      "You NEVER invent facts. A shared surname or common name is NOT a match: a genuine sanctions match needs the name AND "+
      "corroborating detail (country, role, entity type, programme) to line up with the counterparty. "+
      "RULES YOU MUST FOLLOW:\n"+
      "- Adverse-media findings must come from the adverse-media search results provided. NEVER fabricate a finding from missing data.\n"+
      "- 'No VAT number' is NOT adverse media and NOT a key risk. For an individual (a personal name, not a company) VAT is irrelevant — ignore it entirely. "+
      "For a company without VAT, mention it only once as an administrative note, never as a risk.\n"+
      "- keyRisks must be REAL, evidence-backed risks (a confirmed sanctions hit, a credible adverse-media story about THIS counterparty). "+
      "If there are none, return an empty keyRisks array.\n"+
      "Write all human-readable text in "+lang+". Output STRICT JSON only, no prose around it." },
    { role:"user", content:
      "COUNTERPARTY AND EVIDENCE:\n"+JSON.stringify(input,null,1)+
      "\n\nTasks:\n"+
      "1) For each sanctions snippet decide isMatch (true/false), confidence 0-1, and extract programme + reason from the snippet text.\n"+
      "2) Summarise only GENUINE adverse-media findings about THIS counterparty from the adverseResults provided; ignore namesakes and irrelevant results. "+
      "If adverseResults is empty or irrelevant, return an empty adverseFindings array.\n"+
      "3) draftScore 0-100 (0 clean, 100 sanctioned/severe). draftDecision rule: any confirmed sanctions match => DO_NOT_PROCEED; "+
      "credible adverse media about THIS counterparty => at least ENHANCED_DUE_DILIGENCE; otherwise PROCEED. "+
      "A missing VAT alone NEVER triggers ENHANCED_DUE_DILIGENCE.\n"+
      "4) draftSummary: 2-3 plain sentences focused on what the evidence actually shows. Do not mention missing VAT in the summary unless it is the only notable observation about a company.\n\n"+
      'Return JSON: {"sanctionsAssessment":[{"source":"","isMatch":false,"confidence":0,"programme":"","reason":""}],'+
      '"confirmedSanctionsHits":[{"source":"","programme":"","detail":""}],'+
      '"adverseFindings":[{"title":"","summary":"","severity":"low","link":""}],'+
      '"draftScore":0,"draftDecision":"PROCEED","draftSummary":""}' }
  ];
}
function auditPrompt(input, draft){
  const lang = I18N[LANG].langName;
  return [
    { role:"system", content:
      "You are a SENIOR compliance reviewer auditing a junior analyst's draft. Be skeptical. Your job is to catch errors: "+
      "coincidental name matches treated as real hits, over- or under-stated severity, and decisions not supported by the evidence. "+
      "You may raise OR lower the score. If the draft is sound, confirm it.\n"+
      "STRICT RULES:\n"+
      "- 'No VAT number' is NEVER a key risk. Remove any such entry from keyRisks if the draft included it. For a personal name, ignore VAT entirely.\n"+
      "- adverseFindings must be backed by the adverseResults in the evidence. If the draft invented findings, drop them.\n"+
      "- keyRisks must be a SHORT list of real, evidence-backed concerns. Empty array if nothing genuine surfaced.\n"+
      "Write all human-readable text in "+lang+". Output STRICT JSON only." },
    { role:"user", content:
      "INPUT EVIDENCE:\n"+JSON.stringify(input,null,1)+"\n\nANALYST DRAFT:\n"+JSON.stringify(draft,null,1)+
      "\n\nRe-examine every claimed sanctions hit against its snippet and drop coincidental name overlaps. Re-rate adverse findings against the actual adverseResults. "+
      "Strip any 'missing VAT' entries from keyRisks. Then produce the final assessment.\n\n"+
      'Return JSON: {"finalScore":0,"finalDecision":"PROCEED",'+
      '"summary":"","confirmedSanctionsHits":[{"source":"","programme":"","detail":""}],'+
      '"adverseFindings":[{"title":"","summary":"","severity":"low","link":""}],'+
      '"keyRisks":[""],"auditChange":"State what you changed vs the draft and why; if nothing changed, say the draft was confirmed."}' }
  ];
}

/* ---------------- rendering ---------------- */
function el(html){ const d=document.createElement("div"); d.innerHTML=html.trim(); return d.firstChild; }
function esc(s){ return (s==null?"":String(s)).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
function countryName(code){ const c = COUNTRIES.find(x=>x[0]===code); return c? c[1] : ""; }
function clampScore(n){ n = Math.round(Number(n)); return isNaN(n)?50:Math.max(0,Math.min(100,n)); }
function decColor(d){ return d==="PROCEED"?"var(--green)":d==="DO_NOT_PROCEED"?"var(--red)":"var(--amber)"; }

function renderLoader(keys){
  const r = document.getElementById("results");
  r.innerHTML = `<div class="panel"><div class="loader" id="loader">${
    keys.map((k,i)=>`<div class="row" data-i="${i}"><span class="tick"></span><b>${t(k)}</b></div>`).join("")
  }</div></div>`;
}
function updateLoader(i){
  document.querySelectorAll("#loader .row").forEach(row=>{
    const idx = +row.dataset.i;
    row.classList.toggle("active", idx===i);
  });
}
function markDone(i){
  const row = document.querySelector(`#loader .row[data-i="${i}"]`);
  if(row){ row.classList.remove("active"); row.classList.add("done"); }
}

function renderResult(res){
  const f = res.final || {};
  const decision = res.decision;
  const score = res.score;
  const col = decColor(decision);
  const hits = (f.confirmedSanctionsHits||[]).filter(h=>h && (h.source||h.detail||h.programme));
  const findings = (f.adverseFindings||[]).filter(x=>x && x.title);
  // Safety net: AI sometimes lists "no VAT" as a risk even when told not to. Strip it here.
  const risks = (f.keyRisks||[]).filter(rk=>{
    if (!rk) return false;
    const low = String(rk).toLowerCase();
    if (/(vat|ддс|дсс|tva|mwst|iva)/.test(low) && /(missing|absen|no |липс|без|not provided|няма)/.test(low)) return false;
    return true;
  });

  const r = document.getElementById("results");
  r.innerHTML = "";

  /* verdict stamp */
  r.appendChild(el(`
    <div class="panel verdict ${decision}">
      <div class="inner">
        <div class="stamp"><div class="word">${esc(t("stamp")[decision]||"")}</div><div class="sub">CLEARANCE</div></div>
        <div class="vmeta">
          <div class="who">${esc(res.name)}</div>
          <div class="where">${esc(countryName(res.country))}${res.vat?` · <span class="mono">${esc(res.vat)}</span>`:""}</div>
          <div class="score">
            <span class="verdict-label" style="font-weight:600;font-size:13.5px">${esc(t("dec")[decision]||"")}</span>
            <div class="track"><div class="fill" style="width:${score}%;background:${col}"></div></div>
            <span class="num">${score}<span style="color:var(--muted)">/100</span></span>
          </div>
        </div>
      </div>
      <div class="summary">${esc(f.summary || (res.draft&&res.draft.draftSummary) || "")}</div>
    </div>`));

  /* registration */
  r.appendChild(el(regCard(res.vies)));

  /* sanctions */
  r.appendChild(el(sanctionsCard(hits, res.sources, res.sourceErrors)));

  /* adverse */
  r.appendChild(el(adverseCard(findings, risks)));

  /* decision log */
  r.appendChild(el(logCard(res.draft, res.final)));

  /* actions + disclaimer */
  const a = el(`<div class="panel"><div class="pad">
    <div class="actions">
      <button class="ghost" id="exp">${t("export")}</button>
      <button class="ghost" id="res">${t("rescreen")}</button>
    </div>
    <p class="disclaimer" style="margin-top:14px">${t("disclaimer")}</p>
  </div></div>`);
  r.appendChild(a);
  document.getElementById("exp").onclick = ()=>exportCase(res);
  document.getElementById("res").onclick = ()=>{ document.getElementById("name").value=res.name; runClearance(); };
}

function regCard(vies){
  let badge, body;
  if (!vies){ badge=`<span class="badge">${esc(t("vatNot"))}</span>`; body=`<p class="muted-note">${esc(t("vatNot"))}</p>`; }
  else if (vies.unavailable || vies.valid===null){ badge=`<span class="badge warn">${esc(t("regUnavail"))}</span>`; body=`<p class="muted-note">${esc(t("regUnavail"))}</p>`; }
  else if (vies.valid===true){
    badge=`<span class="badge clear">${esc(t("regValid"))}</span>`;
    body = kv("VAT", vies.countryCode+vies.vatNumber, true)
         + (vies.name && vies.name!=="---"? kv("Name", vies.name):"")
         + (vies.address && vies.address!=="---"? kv("Address", vies.address):"")
         + (vies.requestDate? kv("Checked", vies.requestDate, true):"");
  } else { badge=`<span class="badge warn">${esc(t("regInvalid"))}</span>`; body=`<p class="muted-note">${esc(t("regInvalid"))}</p>`; }
  return `<div class="panel card"><div class="pad">
    <h2>${esc(t("regCheck"))} ${badge}</h2>
    <div style="margin-top:8px">${body}</div>
    <p class="muted-note" style="margin-top:8px;font-size:11.5px">European Commission VIES</p>
  </div></div>`;
}
function kv(k,v,mono){ return `<div class="kv"><span class="k">${esc(k)}</span><span class="v ${mono?"mono":""}">${esc(v)}</span></div>`; }

function sanctionsCard(hits, sources, errors){
  const badge = hits.length
    ? `<span class="badge hit">${hits.length} ${hits.length===1?"match":"matches"}</span>`
    : `<span class="badge clear">${esc(t("noSanctions"))}</span>`;
  let body = hits.length
    ? hits.map(h=>`<div class="finding">
        <div class="ft"><span class="sev high"></span>${esc(h.programme||"Sanctions listing")}</div>
        <div class="fs">${esc(h.detail||"")}</div>
        <div class="src mono" style="color:var(--muted)">${esc(h.source||"")}</div>
      </div>`).join("")
    : `<p class="muted-note">${esc(t("noSanctions"))}</p>`;
  const lists = (sources||[]).map(s=>`<a href="${esc(s.portal)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`).join("");
  const errs = (errors||[]).length? `<p class="muted-note" style="margin-top:8px;color:var(--amber)">${esc(errors.join(" · "))}</p>`:"";
  return `<div class="panel card"><div class="pad">
    <h2>${esc(t("sanctions"))} ${badge}</h2>
    <div style="margin-top:8px">${body}</div>
    ${lists?`<div style="margin-top:10px"><div class="muted-note" style="font-size:11.5px">${esc(t("listsScreened"))}</div><div class="lists">${lists}</div></div>`:""}
    ${errs}
  </div></div>`;
}

function adverseCard(findings, risks){
  const badge = findings.length
    ? `<span class="badge warn">${findings.length}</span>`
    : `<span class="badge clear">${esc(t("noAdverse"))}</span>`;
  let body = findings.length
    ? findings.map(x=>`<div class="finding">
        <div class="ft"><span class="sev ${["low","medium","high"].includes(x.severity)?x.severity:"low"}"></span>${esc(x.title)}</div>
        <div class="fs">${esc(x.summary||"")}</div>
        ${x.link?`<div class="src"><a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(shortLink(x.link))} ↗</a></div>`:""}
      </div>`).join("")
    : `<p class="muted-note">${esc(t("noAdverse"))}</p>`;
  const risksHtml = risks.length
    ? `<div style="margin-top:12px"><div class="muted-note" style="font-size:11.5px">${esc(t("keyRisks"))}</div>
       <ul style="margin:6px 0 0;padding-left:18px;font-size:13.5px">${risks.map(rk=>`<li>${esc(rk)}</li>`).join("")}</ul></div>`
    : "";
  return `<div class="panel card"><div class="pad">
    <h2>${esc(t("adverse"))} ${badge}</h2>
    <div style="margin-top:8px">${body}</div>
    ${risksHtml}
  </div></div>`;
}
function shortLink(u){ try{ return new URL(u).hostname.replace(/^www\./,""); }catch{ return u; } }

function logCard(draft, final){
  const d = draft||{}, f = final||{};
  const changed = f.auditChange || "";
  return `<div class="panel card log"><div class="pad">
    <h2>${esc(t("decisionLog"))}</h2>
    <div class="step">
      <div class="lbl">${esc(t("analystDraft"))}</div>
      <p>${esc(t("dec")[d.draftDecision]||d.draftDecision||"")} · ${esc(t("risk"))} ${esc(clampScore(d.draftScore))}/100</p>
      <p style="color:var(--muted);margin-top:4px">${esc(d.draftSummary||"")}</p>
    </div>
    <div class="step audit">
      <div class="lbl">${esc(t("auditReview"))}</div>
      <p>${esc(t("dec")[f.finalDecision]||f.finalDecision||"")} · ${esc(t("risk"))} ${esc(clampScore(f.finalScore))}/100</p>
      ${changed?`<div class="change"><b>${esc(t("changeLabel"))}</b> ${esc(changed)}</div>`:""}
    </div>
  </div></div>`;
}

function flashError(msg){
  const r = document.getElementById("results");
  const e = el(`<div class="err">${esc(msg)}</div>`);
  r.prepend(e);
  setTimeout(()=>e.remove(), 6000);
}

/* ---------------- storage ---------------- */
function loadCases(){ try{ return JSON.parse(localStorage.getItem("probity_cases")||"[]"); }catch{ return []; } }
function saveCase(res){
  const cases = loadCases().filter(c=>c.id!==res.id);
  cases.unshift(res);
  localStorage.setItem("probity_cases", JSON.stringify(cases.slice(0,40)));
  renderSaved();
}
function renderSaved(){
  const cases = loadCases();
  const wrap = document.getElementById("savedWrap");
  const list = document.getElementById("savedList");
  if (!cases.length){ wrap.style.display="none"; return; }
  wrap.style.display="block";
  list.innerHTML = cases.map(c=>`
    <div class="case" onclick="openCase('${c.id}')">
      <span class="dot ${c.decision}"></span>
      <span class="nm">${esc(c.name)}</span>
      <span class="sc">${esc(c.score)}</span>
    </div>`).join("");
}
function openCase(id){
  const c = loadCases().find(x=>x.id===id);
  if (c){ renderResult(c); window.scrollTo({top:0,behavior:"smooth"}); }
}
function exportCase(res){
  const blob = new Blob([JSON.stringify(res,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "probity_"+res.name.replace(/[^a-z0-9]+/gi,"_").toLowerCase()+".json";
  a.click(); URL.revokeObjectURL(a.href);
}

/* service worker (best-effort offline shell) */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", ()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
