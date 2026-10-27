const DRUGS=["NRT","Varenicline","Cytisine","Bupropion"];
const RET={A:"Available",U:"Unavailable",X:"Uncertain"};
const TB=typeof TB_DATA!=="undefined" ? TB_DATA : {year:null,updated:null,countries:{}};
const TB_LEGENDS={
  "tb-incidence":[["tb0","<10"],["tb1","10–49"],["tb2","50–99"],["tb3","100–199"],["tb4","200–399"],["tb5","≥400"],["nd","No data"]],
  "tb-smoking":[["tb0","0"],["tb1","1–99"],["tb2","100–999"],["tb3","1,000–9,999"],["tb4","10,000–49,999"],["tb5","≥50,000"],["nd","No data"]]
};
function tbValue(d){const row=TB.countries && TB.countries[d.i];return row ? row[mode==="tb-incidence"?"incidence":"smoking"] : null;}
function tbClass(d){
  const x=tbValue(d);
  if(x===null || !Number.isFinite(x)) return "nd";
  const breaks=mode==="tb-incidence" ? [10,50,100,200,400] : [1,100,1000,10000,50000];
  return "tb"+breaks.filter(limit=>x>=limit).length;
}
function num(x){return Number.isFinite(x)?x.toLocaleString("en-US",{maximumFractionDigits:2}):"No data";}
// Comparison counts only confirmed retail availability (status A).
// "0 confirmed" may include uncertain medicines; it does not imply all four are unavailable.
function tbAccessClass(d){
  const x=TB.countries && TB.countries[d.i] && TB.countries[d.i].incidence;
  if(!Number.isFinite(x)) return "nd";
  if(x<=tbCutoff) return "acc-below";
  if(fullSet(d)) return "acc-full";
  const count=avail(d);
  if(count>=2) return "acc-two";
  if(count===1) return "acc-one";
  return "acc-none";
}
const LEG_TB_ACCESS=[
  ["acc-none","0 confirmed available"],
  ["acc-one","1 medicine available"],
  ["acc-two","2+ medicines, no full package"],
  ["acc-full","Full package available"],
  ["acc-below","Incidence ≤ threshold"],
  ["nd","No TB incidence data"]
];

let palette={};
function refreshPalette(){
  const style=getComputedStyle(document.documentElement);
  for(const name of ["--nodata","--nodata-stroke","--c0","--c1","--c2","--c3","--c4","--tb0","--tb1","--tb2","--tb3","--tb4","--tb5","--acc-full","--acc-one","--acc-two","--acc-none","--acc-below"])
    palette[name]=style.getPropertyValue(name).trim();
}
const css=n=>palette[n];
function avail(d){return (d.r.match(/A/g)||[]).length}
function fullSet(d){return d.r[0]==="A"&&d.r[3]==="A"&&(d.r[1]==="A"||d.r[2]==="A")}
// Treat uncertain components as uncertain rather than confirmed unavailability.
function fullPackageStatus(d){
  if(fullSet(d)) return "A";
  if(d.r[0]==="U"||d.r[3]==="U"||(d.r[1]==="U"&&d.r[2]==="U")) return "U";
  return "X";
}
function klass(d,view){
  if(view==="full"){
    const s=fullPackageStatus(d);
    return s==="A"?"c4":s==="U"?"c0":"nd";
  }
  if(view==="all"){ if(d.r==="XXXX") return "nd"; return "c"+avail(d); }
  const s=d.r[+view]; return s==="A"?"c4":s==="U"?"c0":"nd";
}
function fillFor(k){return k==="nd"?css("--nodata"):css("--"+k)}
const LEG_ALL=[["c4","All 4 available"],["full","Full package"],["c3","3 available"],["c2","2 available"],["c1","1 available"],["c0","None available"],["nd","No data"]];
const LEG_ONE=[["c4","Available"],["c0","Unavailable"],["nd","Uncertain / no data"]];
const LEG_FULL=[["c4","Full package available"],["c0","Full package unavailable"],["nd","Uncertain / no data"]];

let view="all", mode="medicines", focusClass=null, tbDrug="any", tbStatus="A";
let tbColorBy="rate", tbCutoff=100;
const svg=d3.select("#map"), W=1000, H=520;
svg.attr("viewBox",`0 0 ${W} ${H}`);
const feats=topojson.feature(TOPO,TOPO.objects.countries).features;
const proj=d3.geoEqualEarth().fitExtent([[8,8],[W-8,H-8]],{type:"FeatureCollection",features:feats});
const path=d3.geoPath(proj);
const g=svg.append("g");
const countries=g.selectAll("path").data(feats).join("path")
  .attr("d",path)
  .attr("class",f=>"country"+(DATA[f.id]?"":" out"));
const dotData=Object.entries(DATA).filter(([k,d])=>d.ll).map(([k,d])=>({id:k,xy:proj(d.ll)}));
const dots=g.selectAll("circle").data(dotData).join("circle").attr("class","dot")
  .attr("cx",d=>d.xy[0]).attr("cy",d=>d.xy[1]);

let k=1;
function paint(){
  // Firefox and other browsers can restore <select> values without firing "change".
  // Read native controls on every render so the visible selection is the source of truth.
  const selectedDisplay=document.getElementById("tbColorBy").value;
  const selectedCutoff=Number(document.getElementById("tbCutoff").value);
  if(selectedDisplay!==tbColorBy || selectedCutoff!==tbCutoff) focusClass=null;
  tbColorBy=selectedDisplay;
  tbCutoff=selectedCutoff;
  tbDrug=document.getElementById("tbMedicine").value;
  tbStatus=document.getElementById("tbStatus").value;
  refreshPalette();
  const isTB=mode!=="medicines";
  const compare=mode==="tb-incidence"&&tbColorBy==="access";
  document.getElementById("medicineViewField").hidden=isTB;
  document.getElementById("medicineViews").hidden=isTB;
  document.getElementById("tbIncidenceControls").hidden=mode!=="tb-incidence";
  document.getElementById("tbControls").hidden=!isTB||compare;
  document.getElementById("tbThresholdField").hidden=!compare;
  // The native select is an invisible restoration mirror; only the segment is interactive.
  d3.selectAll("#tbThresholds button").attr("aria-pressed",function(){return Number(this.dataset.cutoff)===tbCutoff;});
  const meta=document.getElementById("tbMeta");
  meta.hidden=!isTB;
  meta.textContent=TB.year ? "WHO estimates for "+TB.year+" | Snapshot created: "+(TB.updated||"unknown").slice(0,10)
    +(compare?" | TB incidence >"+tbCutoff+" per 100,000; colours show medicine availability":"")
    : "WHO estimates not yet synchronized. Data will appear after the first successful automated update.";
  svg.attr("aria-label",compare?"World map comparing smoking cessation medicine availability in countries with TB incidence above "+tbCutoff+" per 100,000"
    :isTB?(mode==="tb-incidence"?"World map of estimated TB incidence per 100,000":"World map of estimated smoking-attributable tuberculosis cases"):"World map of smoking cessation medicine availability");
  const leg=compare?LEG_TB_ACCESS:isTB?TB_LEGENDS[mode]:(view==="all"?LEG_ALL:view==="full"?LEG_FULL:LEG_ONE);
  const classify=d=>compare?tbAccessClass(d):isTB?tbClass(d):klass(d,view);
  function dim(d,c){
    if(focusClass && (focusClass==="full"?!fullSet(d):c!==focusClass))return true;
    return isTB && !compare && tbDrug!=="any" && (
      tbDrug==="full" ? fullPackageStatus(d)!==tbStatus : d.r[Number(tbDrug)]!==tbStatus
    );
  }
  countries.each(function(f){
    const d=DATA[f.id],el=d3.select(this);
    if(!d){el.attr("style",null);return;}
    const c=classify(d);
    el.style("fill",fillFor(c)).classed("nd",c==="nd").classed("dim",dim(d,c));
  });
  dots.each(function(o){
    const d=DATA[o.id],c=classify(d);
    d3.select(this).style("fill",fillFor(c)).classed("nd",c==="nd").classed("dim",dim(d,c));
  });
  const counts={full:0};
  Object.values(DATA).forEach(d=>{const c=classify(d);counts[c]=(counts[c]||0)+1;if(fullSet(d))counts.full++;});
  const items=d3.select("#legend").selectAll("li").data(leg,d=>d[0]).join(enter=>{
    const li=enter.append("li"),b=li.append("button").attr("type","button");
    b.append("span").attr("class","sw");
    b.append("span").attr("class","label");
    b.append("span").attr("class","n");
    return li;
  });
  const buttons=items.select("button").attr("aria-pressed",([c])=>focusClass===c)
    .on("click",(event,[c])=>{focusClass=focusClass===c?null:c;paint()});
  buttons.select(".sw").style("background",([c])=>c==="full"?"linear-gradient(135deg, var(--c3) 0 50%, var(--c4) 50% 100%)":fillFor(c));
  buttons.select(".label").text(([,label])=>label);
  buttons.select(".n").text(([c])=>counts[c]||0);
  if(shownData){tipBody.innerHTML=html(shownData);tipSize=null;}
}
function strokes(){
  countries.style("stroke-width",0.5/k+"px");
  dots.attr("r",Math.max(2.2,3.6/Math.sqrt(k))/Math.sqrt(k)).style("stroke-width",0.6/k+"px");
}
const zoom=d3.zoom().scaleExtent([1,24]).translateExtent([[0,0],[W,H]])
  .on("zoom",e=>{k=e.transform.k;g.attr("transform",e.transform);strokes();});
svg.call(zoom).on("dblclick.zoom",null);
d3.select("#zin").on("click",()=>svg.transition().duration(250).call(zoom.scaleBy,1.8));
d3.select("#zout").on("click",()=>svg.transition().duration(250).call(zoom.scaleBy,1/1.8));
d3.select("#zreset").on("click",()=>svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity));
strokes();

// tooltip
const tip=document.getElementById("tip"), tipBody=tip.querySelector(".body");
let pinned=null, shownData=null, tipSize=null, moveFrame=0, pointer=null;
function statusDot(s){const c=s==="A"?"c4":s==="U"?"c0":"nd";return `<span class="st"><i style="background:${fillFor(c)}"></i>${RET[s]}</span>`}
function v(x){return x==null?"—":x}
function html(d){
  const n=avail(d), c=klass(d,"all");
  const pillTxt=d.r==="XXXX"?"No data":`${n} of 4 available`;
  const light=(c==="c2"||c==="nd");
  const full=fullSet(d);
  const tb=TB.countries && TB.countries[d.i] || {};
  const comparison=mode==="tb-incidence"&&tbColorBy==="access";
  const comparisonText=comparison?'<div class="foot">Incidence threshold: &gt;'+tbCutoff+
    ' per 100,000. Comparison category: '+({
      "acc-full":"Full package available",
      "acc-two":"Two or three medicines available, but no full package",
      "acc-one":"One medicine confirmed available",
      "acc-none":"Zero medicines confirmed available (some statuses may be uncertain)",
      "acc-below":"Below or equal to incidence threshold",
      "nd":"TB incidence data unavailable"
    }[tbAccessClass(d)])+'</div>':'';
  const tbText='<div class="tb-summary"><strong>WHO tuberculosis estimates'+(TB.year?' ('+TB.year+')':'')+'</strong>'+
    '<dl><dt>TB incidence / 100,000</dt><dd>'+num(tb.incidence)+'</dd>'+
    '<dt>Smoking-attributable TB cases</dt><dd>'+num(tb.smoking)+'</dd></dl></div>';
  let rows=DRUGS.map((nm,i)=>`<tr><td>${nm}</td><td>${statusDot(d.r[i])}</td><td>${v(d.s[i])}</td><td>${v(d.d[i])}</td><td>${v(d.m[i])}</td></tr>`).join("");
  return `<h2>${d.n}</h2>
  <div class="sum"><span class="pill${light?" light":""}" style="background:${fillFor(c)};${c==="nd"?"border:1px solid "+css("--nodata-stroke"):""}">${pillTxt}</span>${full?"Full package available":"Full package not confirmed available"}</div>
  ${tbText}${comparisonText}<table><thead><tr><th>Medicine</th><th>Retail 2026</th><th>WHO sold</th><th>OTC/Rx</th><th>Reimbursed</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="foot">NRT on national essential medicines list (WHO): ${v(d.e)}</div>`;
}
function place(x,y){
  const r=tipSize||(tipSize=tip.getBoundingClientRect()), pad=14;
  let L=x+pad, T=y+pad;
  if(L+r.width>innerWidth-8) L=x-r.width-pad;
  if(T+r.height>innerHeight-8) T=y-r.height-pad;
  tip.style.left=Math.max(8,L)+"px"; tip.style.top=Math.max(8,T)+"px";
}
const narrow=()=>matchMedia("(max-width:640px)").matches;
let hotEl=null;
function hot(el){ if(hotEl) d3.select(hotEl).classed("hot",false).style("stroke-width",null); hotEl=el; if(el){d3.select(el).classed("hot",true).style("stroke-width",1.6/k+"px").raise();} }
function show(d,el,x,y,pin){
  if(shownData!==d){tipBody.innerHTML=html(d);shownData=d;tipSize=null;}
  if(hotEl!==el)hot(el);
  if(!!pinned!==!!pin)tipSize=null;
  tip.classList.toggle("sheet",pin&&narrow()); tip.classList.toggle("pinned",!!pin&&!narrow());
  tip.classList.add("on");
  if(!(pin&&narrow())) place(x,y); else {tip.style.left="";tip.style.top="";}
  pinned=pin?d:null;
}
function hide(){
  cancelAnimationFrame(moveFrame);moveFrame=0;pointer=null;
  tip.classList.remove("on","sheet","pinned");pinned=null;shownData=null;tipSize=null;hot(null);
}
window.addEventListener("resize",hide);
tip.querySelector(".x").addEventListener("click",hide);
function bind(sel,getD){
  sel.on("pointermove",function(e){
    if(e.pointerType!=="mouse"||pinned)return;
    const d=getD(this);if(!d)return;
    pointer={d,el:this,x:e.clientX,y:e.clientY};
    if(!moveFrame)moveFrame=requestAnimationFrame(()=>{
      moveFrame=0;const p=pointer;
      if(p&&!pinned)show(p.d,p.el,p.x,p.y,false);
    });
  })
     .on("pointerleave",function(e){ if(e.pointerType==="mouse"&&!pinned) hide()})
     .on("click",function(e){ const d=getD(this); if(!d) return; e.stopPropagation(); show(d,this,e.clientX,e.clientY,true)});
}
bind(countries,el=>DATA[d3.select(el).datum().id]);
bind(dots,el=>DATA[d3.select(el).datum().id]);
svg.on("click",()=>{ if(pinned) hide() });
document.addEventListener("keydown",e=>{if(e.key==="Escape")hide()});

// Data layers share the geography and country tooltip.
d3.selectAll(".map-mode button").on("click",function(){
  mode=this.dataset.mode;focusClass=null;hide();
  d3.selectAll(".map-mode button").attr("aria-pressed",function(){return this.dataset.mode===mode;});
  paint();
});
document.getElementById("tbColorBy").addEventListener("change",function(){
  tbColorBy=this.value;focusClass=null;hide();paint();
});
document.getElementById("tbCutoff").addEventListener("change",function(){
  tbCutoff=Number(this.value);focusClass=null;hide();paint();
});
d3.selectAll("#tbThresholds button").on("click",function(){
  const native=document.getElementById("tbCutoff");
  if(native.value!==this.dataset.cutoff){
    native.value=this.dataset.cutoff;
    tbCutoff=Number(native.value);focusClass=null;hide();
  }
  paint();
});
document.getElementById("tbMedicine").addEventListener("change",function(){tbDrug=this.value;paint();});
document.getElementById("tbStatus").addEventListener("change",function(){tbStatus=this.value;paint();});

// view switch
d3.selectAll("#medicineViews button").on("click",function(){
  const btn=this; view=btn.dataset.view; focusClass=null; hide();
  d3.selectAll("#medicineViews button").attr("aria-pressed",function(){return this===btn});
  paint();
});

// search
const byName={};
Object.entries(DATA).forEach(([id,d])=>byName[d.n.toLowerCase()]=id);
document.getElementById("countries").innerHTML=Object.values(DATA).map(d=>d.n).sort().map(n=>`<option value="${n}">`).join("");
document.getElementById("q").addEventListener("change",function(){
  const id=byName[this.value.trim().toLowerCase()]; if(!id) return;
  const d=DATA[id]; const f=feats.find(f=>f.id===id);
  let el,cx,cy,scale;
  if(f && !d.ll){ const [[x0,y0],[x1,y1]]=path.bounds(f); cx=(x0+x1)/2; cy=(y0+y1)/2; scale=Math.min(8,0.5/Math.max((x1-x0)/W,(y1-y0)/H)); el=countries.filter(q=>q.id===id).node(); }
  else { const o=dotData.find(o=>o.id===id); [cx,cy]=o.xy; scale=8; el=dots.filter(q=>q.id===id).node(); }
  scale=Math.max(1,scale);
  svg.transition().duration(500).call(zoom.transform,d3.zoomIdentity.translate(W/2,H/2).scale(scale).translate(-cx,-cy))
    .on("end",()=>{const r=el.getBoundingClientRect(); show(d,el,r.left+r.width/2,r.top+r.height/2,true)});
  this.blur();
});

matchMedia("(prefers-color-scheme: dark)").addEventListener("change",paint);
// pageshow also fires after browsers restore persisted form controls and on BFCache return.
window.addEventListener("pageshow",()=>requestAnimationFrame(paint));
paint();
