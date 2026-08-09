const COLORS={done:'#38c995',progress:'#d2b46d',pending:'#60aee8',risk:'#e5786d',study:'#9c89d9',out:'#637872',unclassified:'#8b9a96'};
const STATUS={done:'منجز ومقبول تشغيليًا',progress:'قيد التنفيذ',pending:'بانتظار إجراء',risk:'متعثر أو معرّض للخطر'};
let DB,DETAILS,state={week:'',service:'all',status:'all',priority:'all',search:''},raf=[];

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ar=n=>Number(n||0).toLocaleString('ar-SA');
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function boot(){
  try{const loaded=await Promise.all(['data.json','portfolio-details.json','extra-portfolios.json','meeting-directives.json'].map(x=>fetch(x,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()})));DB=loaded[0];DETAILS={...loaded[1],...loaded[3]};DB.portfolios.push(...loaded[2])}
  catch(e){document.body.innerHTML='<main class="empty">تعذر تحميل قاعدة البيانات. افتح المشروع عبر خادم محلي أو GitHub Pages.</main>';return}
  state.week=DB.meta.defaultWeek; fillFilters(); bind(); render(); reveal();
  const printId=new URLSearchParams(location.search).get('print');if(printId&&DB.portfolios.some(p=>p.id===printId)){openPortfolio(printId);document.body.classList.add('print-portfolio')}
}

function fillFilters(){
  $('#weekFilter').innerHTML=DB.weeks.map(w=>`<option value="${w.id}">${w.label}</option>`).join('');
  $('#weekFilter').value=state.week;
  $('#serviceFilter').innerHTML='<option value="all">جميع المحافظ</option>'+DB.portfolios.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  $('#lastUpdated').textContent=`آخر تحديث: ${DB.meta.lastUpdated}`;
}

function bind(){
  ['weekFilter','serviceFilter','statusFilter','priorityFilter'].forEach(id=>$('#'+id).addEventListener('change',e=>{state[id.replace('Filter','')]=e.target.value;render();if(id==='weekFilter')announceWeekChange()}));
  $('#searchInput').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();renderServices()});
  $('#resetFilters').addEventListener('click',()=>{state={week:DB.meta.defaultWeek,service:'all',status:'all',priority:'all',search:''};fillFilters();$('#statusFilter').value='all';$('#priorityFilter').value='all';$('#searchInput').value='';render()});
  $('#presentationBtn').addEventListener('click',()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen());
  $('#dataBtn').addEventListener('click',()=>$('#dataDialog').showModal());
  $('#dataDialog .close').addEventListener('click',()=>$('#dataDialog').close());
  $('#portfolioDialog .close').addEventListener('click',()=>$('#portfolioDialog').close());
  $('#portfolioDialog').addEventListener('click',e=>{if(e.target.closest('[data-print]')){document.body.classList.add('print-portfolio');window.print()}});
  addEventListener('afterprint',()=>document.body.classList.remove('print-portfolio'));
  $('#servicesGrid').addEventListener('click',e=>{const btn=e.target.closest('[data-open]');if(btn)openPortfolio(btn.dataset.open)});
  addEventListener('resize',debounce(renderCharts,180));
}

function week(){return DB.weeks.find(w=>w.id===state.week)}
function relevant(){return DB.portfolios.filter(p=>p.weeks.includes(state.week))}
function filtered(){return relevant().filter(p=>(state.service==='all'||p.id===state.service)&&(state.status==='all'||p.status===state.status)&&(state.priority==='all'||p.priority===state.priority)&&(!state.search||JSON.stringify(p).toLowerCase().includes(state.search)))}

function render(){
  const w=week(); $('#weekPeriod').textContent=w.period; $('#weekDataNote').textContent=w.quality;
  $('#weekSignals').innerHTML=`<b>${esc(w.summary)}</b><span>${ar(w.metrics.outputs)} مخرجات</span><span>${ar(w.metrics.communications)} مراسلة ومتابعة</span><span>${ar(w.metrics.decisions)} قرارات</span>`;
  renderMetrics(); renderCharts(); renderDecisions(); renderServices(); renderTimeline(); renderBaseline();
}

function announceWeekChange(){const w=week(),toast=$('#weekToast');document.body.classList.remove('week-switched');void document.body.offsetWidth;document.body.classList.add('week-switched');toast.textContent=`تم تحميل ${w.label}: ${w.metrics.outputs} مخرجات و${w.metrics.decisions} قرارات`;toast.classList.add('show');clearTimeout(announceWeekChange.timer);announceWeekChange.timer=setTimeout(()=>{toast.classList.remove('show');document.body.classList.remove('week-switched')},2600)}

function renderMetrics(){
  const w=week(), ps=relevant(), active=ps.filter(p=>p.status==='progress'||p.status==='risk').length;
  const cards=[
    ['إجمالي محفظة المتطلبات',DB.requirements.reportedTotal,'أحدث إجمالي مُبلّغ عنه','accent'],
    ['الموثق بنداً بنداً',DB.requirements.documentedBaseline,'خط الأساس V12.03',''],
    ['تحت المطابقة',DB.requirements.underReconciliation,'إضافات جديدة',''],
    ['مخرجات الأسبوع',w.metrics.outputs,'وثيقة أو قرار أو إطلاق',''],
    ['محافظ نشطة',active,`من ${ps.length} محفظة في الفترة`,'']
  ];
  $('#metrics').innerHTML=cards.map(([l,v,s,c])=>`<article class="metric ${c}"><span>${l}</span><b data-count="${v}">0</b><small>${s}</small></article>`).join('');
  $$('[data-count]').forEach(el=>countUp(el,+el.dataset.count));
}

function renderCharts(){cancelAnimationFrame(raf.pop()); drawDonut(); drawTrend()}
function setupCanvas(canvas,h){const dpr=Math.min(devicePixelRatio||1,2),rect=canvas.getBoundingClientRect();canvas.width=rect.width*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);return{ctx,w:rect.width,h}}
function drawDonut(){
  const c=$('#donutChart'),data=DB.requirements.baselineStatus,items=[['done','منتهي'],['progress','تطوير'],['study','دراسة'],['pending','معلّق'],['out','خارج النطاق'],['unclassified','غير مصنف']];
  const {ctx,w,h}=setupCanvas(c,230),cx=w/2,cy=h/2,r=Math.min(w,h)*.37,total=Object.values(data).reduce((a,b)=>a+b,0);
  $('#donutTotal').textContent=ar(DB.requirements.reportedTotal);
  $('#statusLegend').innerHTML=items.map(([k,l])=>`<div class="legend-row"><i style="background:${COLORS[k]}"></i><span>${l}</span><b>${ar(data[k])}</b></div>`).join('');
  animate(900,p=>{ctx.clearRect(0,0,w,h);ctx.lineWidth=17;ctx.lineCap='round';let a=-Math.PI/2;items.forEach(([k])=>{const span=(data[k]/total)*Math.PI*2*p;ctx.beginPath();ctx.strokeStyle=COLORS[k];ctx.arc(cx,cy,r,a+.035,a+Math.max(.04,span-.035));ctx.stroke();a+=span})});
}
function drawTrend(){
  const c=$('#trendChart'),{ctx,w,h}=setupCanvas(c,230),pad={x:32,y:28},weeks=DB.weeks,max=Math.max(...weeks.flatMap(x=>[x.metrics.outputs,x.metrics.communications]))+3;
  $('#activityTotal').textContent=`${ar(week().metrics.outputs+week().metrics.communications)} نشاطًا موثقًا خلال الأسبوع`;
  animate(1050,p=>{ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;for(let i=0;i<4;i++){let y=pad.y+i*(h-pad.y*2)/3;ctx.beginPath();ctx.moveTo(pad.x,y);ctx.lineTo(w-pad.x,y);ctx.stroke()}
    [['outputs',COLORS.done],['communications',COLORS.progress]].forEach(([key,color])=>{const pts=weeks.map((x,i)=>[pad.x+i*(w-pad.x*2)/(weeks.length-1),h-pad.y-(x.metrics[key]/max)*(h-pad.y*2)*p]);ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=3;ctx.shadowBlur=12;ctx.shadowColor=color;pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.shadowBlur=0;pts.forEach(([x,y])=>{ctx.beginPath();ctx.fillStyle=color;ctx.arc(x,y,4,0,Math.PI*2);ctx.fill()})});
    ctx.fillStyle='#9ab0aa';ctx.font='11px Segoe UI';ctx.textAlign='center';weeks.forEach((x,i)=>ctx.fillText(x.label.replace(' · 2026',''),pad.x+i*(w-pad.x*2)/(weeks.length-1),h-6));
  });
}
function animate(ms,draw){const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,start=performance.now();function tick(now){const p=reduced?1:Math.min(1,(now-start)/ms),ease=1-Math.pow(1-p,3);draw(ease);if(p<1)raf.push(requestAnimationFrame(tick))}raf.push(requestAnimationFrame(tick))}

function renderDecisions(){$('#decisionList').innerHTML=DB.decisions.map(d=>`<div class="decision ${d.priority==='حرج'?'needs-attention':''}"><span>${esc(d.priority)}</span><b>${esc(d.title)}</b><small>${esc(d.detail)}</small></div>`).join('')}

function renderServices(){
  const ps=filtered(); $('#resultsCount').textContent=`عرض ${ar(ps.length)} من ${ar(relevant().length)} محفظة نشطة في الفترة`;
  $('#servicesGrid').innerHTML=ps.length?ps.map((p,i)=>`<article class="service-card ${p.status==='risk'||p.priority==='critical'?'needs-attention':''}" style="--status:${COLORS[p.status]};--progress:${p.progress}%;animation-delay:${i*55}ms">
    <div class="card-top"><div><span class="service-code">${p.code} · ${esc(p.type)}</span><h3>${esc(p.name)}</h3></div><span class="badge">${STATUS[p.status]}</span></div>
    <p class="service-meta">${esc(p.owner)} · نطاق المحفظة تحت المطابقة البندية</p>
    <div class="progress-line"><i></i></div><div class="progress-label"><span>التقدم التقديري</span><b>${ar(p.progress)}%</b></div>
    <ul><li><b>آخر تحديث:</b> ${esc(p.lastUpdate)}</li><li><b>المخاطر:</b> ${esc(p.risk)}</li></ul>
    <div class="next-action"><span>الإجراء القادم</span>${esc(p.next)}</div>
    <div class="next-action" style="margin-top:8px"><span>الدعم المطلوب</span>${esc(p.support)}</div>
    <button class="portfolio-open" data-open="${p.id}">فتح غرفة المتابعة ←</button>
  </article>`).join(''):'<div class="empty">لا توجد محافظ تطابق المرشحات الحالية.</div>';
}

function openPortfolio(id){
  const p=DB.portfolios.find(x=>x.id===id),d=DETAILS[id],items=d?.workItems||p.achieved.map((x,i)=>({id:`${p.code}-${i+1}`,title:x,status:'done',owner:p.owner,evidence:'تحديث المحفظة',next:p.next,support:p.support}));
  const milestones=d?.milestones||[...p.achieved.map((x,i)=>({date:`معلم ${ar(i+1)}`,title:x,status:'done',detail:'مخرج موثق ضمن سجل المحفظة.',evidence:'سجل تحديثات المحفظة'})),{date:'آخر تحديث',title:'الحالة التنفيذية الحالية',status:p.status,detail:p.lastUpdate,evidence:'آخر تحديث مسجل'}];
  const raci=d?.raci||buildRaci(d?.governance,p);
  const stats=['done','progress','pending','risk'].map(s=>({s,n:items.filter(x=>x.status===s).length}));
  const e=d?.evm,sv=e?e.earned-e.planned:null,spi=e&&e.planned?e.earned/e.planned:null,cv=e?.actualCost!=null?e.earned-e.actualCost:null,cpi=e?.actualCost?e.earned/e.actualCost:null;
  $('#portfolioDetail').innerHTML=`<div class="portfolio-titlebar"><div><p class="eyebrow">${p.code} · غرفة متابعة المحفظة</p><h2>${esc(p.name)}</h2></div><button class="print-portfolio-btn" data-print>طباعة / حفظ PDF</button></div><p class="detail-lead">${esc(d?.source||p.lastUpdate)}</p>
    <div class="detail-stats">${stats.map(x=>`<div><b>${ar(x.n)}</b><span>${STATUS[x.s]}</span></div>`).join('')}</div>
    ${d?.tracks?`<section class="portfolio-tracks">${d.tracks.map(x=>`<article><div><span>مسار تنفيذي</span><h3>${esc(x.name)}</h3></div><span class="badge" style="--status:${COLORS[x.status]};color:${COLORS[x.status]}">${STATUS[x.status]}</span><p><b>الحالة الحالية:</b> ${esc(x.current)}</p><p><b>الإجراء التالي:</b> ${esc(x.next)}</p><small>${esc(x.owner)}</small></article>`).join('')}</section>`:''}
    ${d?.kpis?`<section class="portfolio-kpis">${d.kpis.map(x=>`<article class="${x.attention?'attention':''}"><b>${esc(x.value)}</b><span>${esc(x.label)}</span><small>${esc(x.note)}</small></article>`).join('')}</section>`:''}
    <section class="milestone-section"><div class="milestone-heading"><div><p class="eyebrow">السجل الزمني</p><h3>سجل الأحداث والمعالم الرئيسية</h3></div><span>${ar(milestones.length)} معالم</span></div><div class="milestone-rail">${milestones.map((m,i)=>`<article class="milestone ${m.status}"><i>${ar(i+1)}</i><div><time>${esc(m.date)}</time><b>${esc(m.title)}</b><p>${esc(m.detail)}</p><small>الدليل: ${esc(m.evidence)}</small></div><span>${STATUS[m.status]||esc(m.status)}</span></article>`).join('')}</div></section>
    ${d?.governance?`<section class="governance-section"><h3>السجل الرأسي للحوكمة والمتابعة</h3><div class="governance-rail">${d.governance.map((x,i)=>`<article><i>${ar(i+1)}</i><div><span>${esc(x.level)}</span><b>${esc(x.party)}</b><small>${esc(x.duty)}</small></div></article>`).join('')}</div></section>`:''}
    <section class="raci-section"><div class="milestone-heading"><div><p class="eyebrow">حوكمة أصحاب المصلحة</p><h3>مصفوفة المسؤوليات RACI</h3></div><span>توزيع الأدوار</span></div><div class="raci-legend"><span><b>R</b> المنفّذ</span><span><b>A</b> المساءل وصاحب الاعتماد</span><span><b>C</b> المستشار</span><span><b>I</b> المُحاط بالتحديث</span></div><div class="raci-table"><div class="raci-head"><b>الجهة / صاحب المصلحة</b><b>الدور</b><b>المسؤولية</b></div>${raci.map(x=>`<article><div><b>${esc(x.party)}</b><small>${esc(x.level||'صاحب مصلحة')}</small></div><span class="raci-code ${esc(x.role).toLowerCase()}">${esc(x.role)}</span><p>${esc(x.duty)}</p></article>`).join('')}</div></section>
    ${e?`<section class="evm-section"><header><div><h3>القيمة المكتسبة EVM</h3><small>${esc(e.basis)}</small></div><span>${esc(e.unit)}</span></header><div class="evm-grid"><div><span>خط الأساس BAC</span><b>${ar(e.baseline)}</b></div><div><span>القيمة المخططة PV</span><b>${ar(e.planned)}</b></div><div><span>القيمة المكتسبة EV</span><b>${ar(e.earned)}</b></div><div class="${sv<0?'negative':'positive'}"><span>انحراف الجدول SV</span><b>${sv>0?'+':''}${ar(sv)}</b></div><div class="${spi<1?'negative':'positive'}"><span>مؤشر الجدول SPI</span><b>${spi.toFixed(2)}</b></div><div><span>انحراف التكلفة CV</span><b>${cv==null?'غير متاح':ar(cv)}</b></div><div><span>مؤشر التكلفة CPI</span><b>${cpi==null?'غير متاح':cpi.toFixed(2)}</b></div></div></section>`:''}
    ${d?.decisions?`<section class="decision-strip"><h3>القرارات والتوجهات</h3>${d.decisions.map(x=>`<span>${esc(x)}</span>`).join('')}</section>`:''}
    <div class="detail-grid"><section><h3>سجل الأعمال</h3><div class="work-table">${items.map(x=>`<article><div><span class="badge" style="--status:${COLORS[x.status]};color:${COLORS[x.status]}">${STATUS[x.status]}</span><b>${esc(x.id)} · ${esc(x.title)}</b></div><p><strong>المالك:</strong> ${esc(x.owner)}</p><p><strong>الدليل:</strong> ${esc(x.evidence)}</p><p><strong>التالي:</strong> ${esc(x.next)}</p><p><strong>الدعم:</strong> ${esc(x.support)}</p></article>`).join('')}</div></section>
    <aside><h3>القيمة المتحققة</h3>${(d?.benefits||[{value:'إنجاز تشغيلي',evidence:p.lastUpdate,measure:'يتطلب مؤشر أثر معتمد'}]).map(x=>`<div class="benefit"><b>${esc(x.value)}</b><span>${esc(x.evidence)}</span><small>${esc(x.measure)}</small></div>`).join('')}<div class="data-callout"><b>قاعدة الإغلاق</b><p>${esc(DETAILS.framework.closureRule)}</p></div></aside></div>
    ${d?.risks?`<section class="risk-section"><h3>سجل المخاطر والتصعيد</h3><div class="risk-table"><div class="risk-head"><b>الخطر</b><b>المستوى</b><b>المالك</b><b>المعالجة</b><b>محفز التصعيد</b></div>${d.risks.map(r=>`<article><div><small>${esc(r.id)}</small><b>${esc(r.risk)}</b></div><span class="risk-level">${esc(r.level)}</span><span>${esc(r.owner)}</span><span>${esc(r.mitigation)}</span><span>${esc(r.escalation)}</span></article>`).join('')}</div></section>`:''}`;
  $('#portfolioDialog').showModal();
}

function buildRaci(governance,p){
  if(!governance?.length)return[{party:p.owner,level:'مالك المحفظة',role:'A',duty:'المساءلة عن النتائج واعتماد الإغلاق'},{party:'فريق التنفيذ التقني',level:'التنفيذ',role:'R',duty:p.next},{party:'إدارة متابعة الأنظمة الرقمية',level:'المتابعة والحوكمة',role:'I',duty:'متابعة التقدم وتوثيق التحديثات والتصعيد'}];
  let accountableAssigned=false;
  return governance.map(x=>{const level=x.level||'';let role='C';if(/مالك الأعمال|الموافقات|الاعتماد/.test(level)&&!accountableAssigned){role='A';accountableAssigned=true}else if(/التنفيذ|التشغيل|التجربة|التحديث/.test(level)){role='R'}else if(/المتابعة|التصعيد|القيادة/.test(level)){role='I'}return{...x,role}});
}

function renderTimeline(){$('#timeline').innerHTML=week().timeline.map(t=>`<div class="timeline-item"><time>${esc(t.date)}</time><b>${esc(t.title)}</b><p>${esc(t.detail)}</p></div>`).join('')}
function renderBaseline(){
  const rows=[['خط الأساس الموثق',DB.requirements.documentedBaseline],['إضافات قيد المطابقة',DB.requirements.underReconciliation],['الإجمالي المُبلّغ عنه',DB.requirements.reportedTotal]];
  $('#baselineBreakdown').innerHTML=rows.map(([l,v])=>`<div class="baseline-row"><div><span>${l}</span><b>${ar(v)}</b></div><div class="bar"><i style="width:${v/DB.requirements.reportedTotal*100}%"></i></div></div>`).join('')+`<p class="service-meta">المصدر: ${esc(DB.requirements.source)}</p>`;
}
function countUp(el,target){const start=performance.now(),dur=750;function tick(now){let p=Math.min(1,(now-start)/dur);el.textContent=ar(Math.round(target*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(tick)}requestAnimationFrame(tick)}
function reveal(){const o=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting&&e.target.classList.add('visible')),{threshold:.08});$$('.reveal').forEach(x=>o.observe(x))}
function debounce(fn,ms){let t;return()=>{clearTimeout(t);t=setTimeout(fn,ms)}}
boot();
