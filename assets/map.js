const DRUGS=["NRT","Varenicline","Cytisine","Bupropion"];
const RET={A:"Available",U:"Unavailable",X:"Uncertain"};
let palette={};
function refreshPalette(){
  const style=getComputedStyle(document.documentElement);
  for(const name of ["--nodata","--nodata-stroke","--c0","--c1","--c2","--c3","--c4"])
    palette[name]=style.getPropertyValue(name).trim();
}
const css=n=>palette[n];
function avail(d){return (d.r.match(/A/g)||[]).length}
function fullSet(d){return d.r[0]==="A"&&d.r[3]==="A"&&(d.r[1]==="A"||d.r[2]==="A")}
function klass(d,view){
  if(view==="all"){ if(d.r==="XXXX") return "nd"; return "c"+avail(d); }
  const s=d.r[+view]; return s==="A"?"c4":s==="U"?"c0":"nd";
}
function fillFor(k){return k==="nd"?css("--nodata"):css("--"+k)}
const LEG_ALL=[["c4","All 4 available"],["full","Full set"],["c3","3 available"],["c2","2 available"],["c1","1 available"],["c0","None available"],["nd","No data"]];
const LEG_ONE=[["c4","Available"],["c0","Unavailable"],["nd","Uncertain / no data"]];

let view="all", focusClass=null;
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
  refreshPalette();
  const leg=view==="all"?LEG_ALL:LEG_ONE;
  countries.each(function(f){
    const d=DATA[f.id]; const el=d3.select(this);
    if(!d){el.attr("style",null);return}
    const c=klass(d,view);
    const dimmed=focusClass&&(focusClass==="full"?!fullSet(d):c!==focusClass);
    el.style("fill",fillFor(c)).classed("nd",c==="nd").classed("dim",dimmed);
  });
  dots.each(function(o){
    const d=DATA[o.id], c=klass(d,view);
    const dimmed=focusClass&&(focusClass==="full"?!fullSet(d):c!==focusClass);
    d3.select(this).style("fill",fillFor(c)).classed("nd",c==="nd").classed("dim",dimmed);
  });
  const counts={full:0}; Object.values(DATA).forEach(d=>{const c=klass(d,view);counts[c]=(counts[c]||0)+1;if(fullSet(d))counts.full++});
  const items=d3.select("#legend").selectAll("li").data(leg, d=>d[0]).join(enter=>{
    const li=enter.append("li"), b=li.append("button").attr("type","button");
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
  let rows=DRUGS.map((nm,i)=>`<tr><td>${nm}</td><td>${statusDot(d.r[i])}</td><td>${v(d.s[i])}</td><td>${v(d.d[i])}</td><td>${v(d.m[i])}</td></tr>`).join("");
  return `<h2>${d.n}</h2>
  <div class="sum"><span class="pill${light?" light":""}" style="background:${fillFor(c)};${c==="nd"?"border:1px solid "+css("--nodata-stroke"):""}">${pillTxt}</span>${full?"Full set available":"Full set not available"}</div>
  <table><thead><tr><th>Medicine</th><th>Retail 2026</th><th>WHO sold</th><th>OTC/Rx</th><th>Reimbursed</th></tr></thead><tbody>${rows}</tbody></table>
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

// view switch
d3.selectAll(".seg button").on("click",function(){
  const btn=this; view=btn.dataset.view; focusClass=null; hide();
  d3.selectAll(".seg button").attr("aria-pressed",function(){return this===btn});
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
paint();
