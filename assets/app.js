const COLORS={done:'#38c995',progress:'#d2b46d',pending:'#60aee8',risk:'#e5786d',study:'#9c89d9',out:'#637872',unclassified:'#8b9a96'};
const STATUS={done:'منجز ومقبول تشغيليًا',progress:'قيد التنفيذ',pending:'بانتظار إجراء',risk:'متعثر أو معرّض للخطر'};
let DB,DETAILS,ARCH,CENTER_BASELINE,state={week:'',scope:'all',pillar:'all',nature:'all',service:'all',status:'all',priority:'all',leader:'all',search:'',priorityEdit:false,view:'architecture',baselineStatus:'all',baselineResponse:'all',baselineSearch:'',agencyStatus:'all',agencyPriority:'all',agencyPortfolio:'all',agencySearch:''},raf=[];
const ORDER_KEY='umrah-pmo-portfolio-order-v1',WORK_KEY='umrah-pmo-work-state-v1',AGENCY_ORDER_KEY='umrah-pmo-agency-baseline-order-v1';
const readLocal=(key,fallback={})=>{try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}};
const writeLocal=(key,value)=>localStorage.setItem(key,JSON.stringify(value));

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ar=n=>Number(n||0).toLocaleString('ar-SA');
const esc=s=>String(s??'').replace(/\bBOC\b/g,'POC').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const pocMarkup=p=>{const x=p.poc||p.boc,items=[['POC · وكالة العمرة',x?.agency||'قيد التحديد']];if(x?.digital)items.push(['POC · وكالة التحول الرقمي',x.digital]);else items.push(['POC · مركز المعلومات',x?.center||'قيد التحديد']);if(x?.productOwner)items.push(['مالك المنتج',x.productOwner]);return `<div class="poc-strip">${items.map(([l,v])=>`<span><b>${l}</b>${esc(v)}</span>`).join('')}</div>`};
const evidenceLinks=x=>(x.evidenceLinks||[]).map(link=>{const local=['localhost','127.0.0.1'].includes(location.hostname);return link.restricted&&!local?`<button class="evidence-link restricted" data-evidence="دليل مقيّد للاستخدام الداخلي. يتطلب فتحه تسجيل دخول وصلاحية وصول معتمدة.">${esc(link.label)} · مقيّد</button>`:`<a class="evidence-link" href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.label)}</a>`}).join('');

async function boot(){
  try{const loaded=await Promise.all(['data.json','portfolio-details.json','extra-portfolios.json','meeting-directives.json','architecture.json','center-baseline.json'].map(x=>fetch(x,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()})));DB=loaded[0];DETAILS={...loaded[1],...loaded[3]};DB.portfolios.push(...loaded[2]);ARCH=loaded[4];CENTER_BASELINE=loaded[5];DB.portfolios.forEach(p=>p.architecture=ARCH.items[p.id]||{})}
  catch(e){document.body.innerHTML='<main class="empty">تعذر تحميل قاعدة البيانات. افتح المشروع عبر خادم محلي أو GitHub Pages.</main>';return}
  const savedOrder=readLocal(ORDER_KEY,[]);if(savedOrder.length)DB.portfolios.sort((a,b)=>{const ai=savedOrder.indexOf(a.id),bi=savedOrder.indexOf(b.id);return(ai<0?999:ai)-(bi<0?999:bi)});
  state.week=DB.meta.defaultWeek; fillFilters(); bind(); syncViewControls(); render(); reveal();
  const params=new URLSearchParams(location.search),printId=params.get('print'),weeklyId=params.get('weekly');
  if(printId&&DB.portfolios.some(p=>p.id===printId)){openPortfolio(printId);document.body.classList.add('print-portfolio');setPortfolioPrintTitle()}
  if(weeklyId&&DB.weeks.some(w=>w.id===weeklyId)){state.week=weeklyId;$('#weekFilter').value=weeklyId;render();openWeeklyReport();document.body.classList.add('print-weekly')}
}

function fillFilters(){
  $('#weekFilter').innerHTML=DB.weeks.map(w=>`<option value="${w.id}">${w.label}</option>`).join('');
  $('#weekFilter').value=state.week;
  $('#serviceFilter').innerHTML='<option value="all">جميع المحافظ</option>'+DB.portfolios.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  $('#pillarFilter').innerHTML='<option value="all">جميع المسارات</option>'+ARCH.pillars.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  const leaders=[...new Set(DB.portfolios.flatMap(p=>String((p.poc||p.boc)?.agency||'').split(/[،,]/).map(x=>x.trim())).filter(x=>x&&x!=='قيد التحديد'&&x!=='لا يوجد'))].sort((a,b)=>a.localeCompare(b,'ar'));
  $('#leaderFilter').innerHTML='<option value="all">جميع قادة المحافظ</option>'+leaders.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  $('#leaderFilter').value=state.leader;
  $('#lastUpdated').textContent=`آخر تحديث: ${DB.meta.lastUpdated}`;
}

function bind(){
  ['weekFilter','scopeFilter','pillarFilter','natureFilter','serviceFilter','statusFilter','priorityFilter','leaderFilter'].forEach(id=>$('#'+id).addEventListener('change',e=>{state[id.replace('Filter','')]=e.target.value;render();if(id==='weekFilter')announceWeekChange()}));
  $('#searchInput').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();render()});
  $('#filterToggle').addEventListener('click',()=>{const bar=$('#filterBar'),open=bar.hidden;bar.hidden=!open;$('#filterToggle').setAttribute('aria-expanded',String(open));$('#filterToggle').classList.toggle('open',open);if(open)setTimeout(()=>$('#searchInput').focus(),80)});
  $('#resetFilters').addEventListener('click',()=>{state={week:DB.meta.defaultWeek,scope:'all',pillar:'all',nature:'all',service:'all',status:'all',priority:'all',leader:'all',search:'',priorityEdit:false,view:'architecture',baselineStatus:'all',baselineResponse:'all',baselineSearch:'',agencyStatus:'all',agencyPriority:'all',agencyPortfolio:'all',agencySearch:''};fillFilters();['scopeFilter','pillarFilter','natureFilter','statusFilter','priorityFilter','leaderFilter'].forEach(id=>$('#'+id).value='all');$('#searchInput').value='';document.body.classList.remove('priority-edit');syncViewControls();render()});
  $('#presentationBtn').addEventListener('click',()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen());
  $('#dataBtn').addEventListener('click',()=>$('#dataDialog').showModal());
  $('#dataDialog .close').addEventListener('click',()=>$('#dataDialog').close());
  $('#portfolioDialog .close').addEventListener('click',()=>$('#portfolioDialog').close());
  $('#weeklyReportBtn').addEventListener('click',openWeeklyReport);
  $('#weeklyReportDialog .close').addEventListener('click',()=>$('#weeklyReportDialog').close());
  $('#weeklyReportDialog').addEventListener('click',e=>{if(e.target.closest('[data-week-print]')){document.body.classList.add('print-weekly');window.print()}});
  $('#priorityModeBtn').addEventListener('click',()=>{state.priorityEdit=!state.priorityEdit;document.body.classList.toggle('priority-edit',state.priorityEdit);$('#priorityModeBtn').textContent=state.priorityEdit?'حفظ الترتيب':'ترتيب الأولويات';renderServices()});
  $('#portfolioDialog').addEventListener('click',e=>{if(e.target.closest('[data-print]')){document.body.classList.add('print-portfolio');setPortfolioPrintTitle();window.print();return}const done=e.target.closest('[data-complete]');if(done){completeWork(done.dataset.portfolio,done.dataset.complete);return}const evidence=e.target.closest('[data-evidence]');if(evidence)alert(evidence.dataset.evidence)});
  addEventListener('afterprint',()=>{document.body.classList.remove('print-portfolio','print-weekly');if(document.body.dataset.screenTitle){document.title=document.body.dataset.screenTitle;delete document.body.dataset.screenTitle}});
  $('#servicesGrid').addEventListener('click',e=>{const btn=e.target.closest('[data-open]');if(btn)openPortfolio(btn.dataset.open)});
  $('#servicesGrid').addEventListener('change',e=>{if(e.target.id==='baselineStatusFilter'){state.baselineStatus=e.target.value;renderServices()}if(e.target.id==='baselineResponseFilter'){state.baselineResponse=e.target.value;renderServices()}if(e.target.id==='agencyStatusFilter'){state.agencyStatus=e.target.value;renderServices()}if(e.target.id==='agencyPriorityFilter'){state.agencyPriority=e.target.value;renderServices()}if(e.target.id==='agencyPortfolioFilter'){state.agencyPortfolio=e.target.value;renderServices()}});
  $('#servicesGrid').addEventListener('input',e=>{if(e.target.id==='baselineSearchInput'){state.baselineSearch=e.target.value.trim().toLowerCase();renderCenterBaseline();requestAnimationFrame(()=>{const input=$('#baselineSearchInput');input?.focus();input?.setSelectionRange(input.value.length,input.value.length)})}if(e.target.id==='agencySearchInput'){state.agencySearch=e.target.value.trim().toLowerCase();renderAgencyBaseline();requestAnimationFrame(()=>{const input=$('#agencySearchInput');input?.focus();input?.setSelectionRange(input.value.length,input.value.length)})}});
  $$('.view-toggle [data-view]').forEach(btn=>btn.addEventListener('click',()=>{state.view=btn.dataset.view;state.priorityEdit=false;document.body.classList.remove('priority-edit');syncViewControls();renderServices()}));
  bindDragAndDrop();
  addEventListener('resize',debounce(renderCharts,180));
}

function week(){return DB.weeks.find(w=>w.id===state.week)}
function relevant(){return DB.portfolios.filter(p=>p.weeks.includes(state.week))}
function displayed(){return state.scope==='active'?relevant():DB.portfolios}
function filtered(){return displayed().filter(p=>{const leaders=String((p.poc||p.boc)?.agency||'').split(/[،,]/).map(x=>x.trim()),a=p.architecture||{},natureMatch=state.nature==='all'||(state.nature==='sustainable'&&a.nature?.includes('مستدام'))||(state.nature==='temporary'&&a.nature?.includes('مؤقت'));return(state.pillar==='all'||a.pillar===state.pillar)&&natureMatch&&(state.service==='all'||p.id===state.service)&&(state.status==='all'||p.status===state.status)&&(state.priority==='all'||p.priority===state.priority)&&(state.leader==='all'||leaders.includes(state.leader))&&(!state.search||JSON.stringify({...p,details:DETAILS[p.id]}).toLowerCase().includes(state.search))})}
function syncViewControls(){const titles={architecture:'الخريطة المعمارية للمسارات',portfolios:'الحالة التنفيذية لكل محفظة',technical:'سجل مشروعات التطوير التقني',actions:'سجل الأعمال القادمة حسب الأولوية',operations:'التسليم والتشغيل بعد الإطلاق',agencyBaseline:'خط أساس وكالة العمرة',centerBaseline:'خط أساس مركز معلومات الحج والعمرة'};$$('.view-toggle [data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===state.view));$('#portfolioViewTitle').textContent=titles[state.view];$('#priorityModeBtn').style.display=state.view==='portfolios'?'':'none'}
function updateFilterUI(){const keys=['scope','pillar','nature','service','status','priority','leader'],count=keys.filter(k=>state[k]!=='all').length+(state.search?1:0),ps=filtered(),active=ps.filter(p=>p.weeks.includes(state.week)).length,badge=$('#activeFilterCount');badge.textContent=ar(count);badge.hidden=!count;$('#filterSummary').textContent=count?`${ar(ps.length)} محفظة مطابقة · ${ar(active)} عليها نشاط في ${week().label}`:'عرض جميع المحافظ والمسارات'}
function activityFor(p){if(!p.weeks.includes(state.week))return null;const keys={visa:['التأشيرة','الدخول'],ota:['OTA','المنصات'],classification:['التصنيف'],catering:['الإعاشة'],traveler:['حقيبة'],flights:['الرحلات','الطيران'],'external-agents':['التأهيل','الوكلاء'],'tourism-integration':['السياحة','الفنادق','المرشدين'],'nusuk-app':['الإجهاد','نسك'],'marketing-incentives':['الحوافز']}[p.id]||[];const hit=week().timeline.find(t=>keys.some(k=>(t.title+' '+t.detail).includes(k)));return hit?`${hit.title}: ${hit.detail}`:'نشاط مسجل ضمن نطاق الأسبوع؛ تفاصيل الحدث بانتظار المطابقة البندية مع سجل المحفظة.'}

function render(){
  const w=week(); $('#weekPeriod').textContent=w.period; $('#weekDataNote').textContent=w.quality;
  $('#weekSignals').innerHTML=`<b>${esc(w.summary)}</b><span>${ar(w.metrics.outputs)} مخرجات</span><span>${ar(w.metrics.communications)} مراسلة ومتابعة</span><span>${ar(w.metrics.decisions)} قرارات</span>`;
  renderMetrics(); renderCharts(); renderDecisions(); renderServices(); renderTimeline(); renderBaseline(); updateFilterUI();
}

function announceWeekChange(){const w=week(),toast=$('#weekToast');document.body.classList.remove('week-switched');void document.body.offsetWidth;document.body.classList.add('week-switched');toast.textContent=`تم تحميل ${w.label}: ${w.metrics.outputs} مخرجات و${w.metrics.decisions} قرارات`;toast.classList.add('show');clearTimeout(announceWeekChange.timer);announceWeekChange.timer=setTimeout(()=>{toast.classList.remove('show');document.body.classList.remove('week-switched')},2600)}

function renderMetrics(){
  $('#metrics').hidden=true;
  const ps=filtered(),active=ps.filter(p=>p.weeks.includes(state.week)).length,items=ps.flatMap(p=>workItemsFor(p,DETAILS[p.id])),open=items.filter(x=>x.status!=='done').length,avg=ps.length?Math.round(ps.reduce((n,p)=>n+p.progress,0)/ps.length):0;
  const cards=[
    ['المحافظ المطابقة',ps.length,'وفق المرشحات الحالية','accent'],
    ['عليها نشاط',active,`في ${week().label}`,''],
    ['عناصر العمل',items.length,'ضمن المحافظ المطابقة',''],
    ['جارية أو قادمة',open,'لم تسجل كمنجزة بعد',''],
    ['متوسط التقدم',avg,'% للنطاق المعروض','']
  ];
  $('#metrics').innerHTML=cards.map(([l,v,s,c])=>`<article class="metric ${c}"><span>${l}</span><b data-count="${v}">0</b><small>${s}</small></article>`).join('');
  $$('[data-count]').forEach(el=>countUp(el,+el.dataset.count));
}

function renderCharts(){cancelAnimationFrame(raf.pop());if($('#donutChart'))drawDonut();drawTrend()}
function setupCanvas(canvas,h){const dpr=Math.min(devicePixelRatio||1,2),rect=canvas.getBoundingClientRect();canvas.width=rect.width*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);return{ctx,w:rect.width,h}}
function drawDonut(){
  const c=$('#donutChart'),accepted=CENTER_BASELINE.rows.filter(r=>baselineText(r['الإستجابة'])==='مقبول'),counts=new Map();
  accepted.forEach(r=>{const key=baselineText(r['حالة الطلب']);counts.set(key,(counts.get(key)||0)+1)});
  const palette=['#38c995','#60aee8','#d2b46d','#9c89d9','#e5786d','#62c4b5','#e6a65d','#76a9ea','#b8ca70','#cf7fb4','#8b9a96','#d7dbe0'];
  const items=[...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([label,value],i)=>({label,value,color:palette[i%palette.length]}));
  const {ctx,w,h}=setupCanvas(c,230),cx=w/2,cy=h/2,r=Math.min(w,h)*.37,total=accepted.length;
  $('#donutTotal').textContent=ar(total);
  $('#statusLegend').innerHTML=items.map(x=>`<div class="legend-row"><i style="background:${x.color}"></i><span>${esc(x.label)}</span><b>${ar(x.value)}</b></div>`).join('');
  animate(900,p=>{ctx.clearRect(0,0,w,h);ctx.lineWidth=17;ctx.lineCap='round';let a=-Math.PI/2;items.forEach(x=>{const span=(x.value/total)*Math.PI*2*p;ctx.beginPath();ctx.strokeStyle=x.color;ctx.arc(cx,cy,r,a+.025,a+Math.max(.035,span-.025));ctx.stroke();a+=span})});
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
  if(state.view==='centerBaseline')return renderCenterBaseline();
  if(state.view==='agencyBaseline')return renderAgencyBaseline();
  const ps=filtered();
  if(state.view==='architecture')return renderArchitecture(ps);
  if(state.view==='technical')return renderTechnicalRegister(ps);
  if(state.view==='actions')return renderActionRegister(ps);
  if(state.view==='operations')return renderOperationsRegister(ps);
  $('#servicesGrid').classList.remove('actions-view','architecture-view');
  $('#resultsCount').textContent=`عرض ${ar(ps.length)} من ${ar(displayed().length)} محفظة · ${ar(relevant().length)} عليها نشاط في ${esc(week().label)}`;
  $('#servicesGrid').innerHTML=ps.length?ps.map((p,i)=>{const rank=DB.portfolios.indexOf(p)+1,activity=activityFor(p);return `<article class="service-card ${rank<=10?'top-priority ':''}${p.status==='risk'||p.priority==='critical'?'needs-attention':''}" draggable="${state.priorityEdit}" data-portfolio-id="${p.id}" style="--status:${COLORS[p.status]};--progress:${p.progress}%;animation-delay:${i*55}ms">
    <div class="card-top"><div><span class="service-code">${p.code} · ${esc(p.type)}</span><h3>${esc(p.name)}</h3></div><span class="badge">${STATUS[p.status]}</span></div>
    <div class="priority-rank"><b>${ar(rank)}</b><span>${rank<=10?'ضمن أعلى 10 أولويات':'ترتيب المحفظة'}</span></div>
    <div class="architecture-chips"><span>${esc(ARCH.pillars.find(x=>x.id===p.architecture.pillar)?.name)}</span><span>${esc(p.architecture.elementType)}</span><span>${esc(p.architecture.nature)}</span></div>
    <div class="week-activity ${activity?'has-activity':'no-activity'}"><b>${activity?'نشاط موثق في الأسبوع':'لا يوجد نشاط موثق في الأسبوع'}</b><span>${activity?esc(activity):`المحفظة ظاهرة ضمن خيار «كل المحافظ»`}</span></div>
    <p class="service-meta">${esc(p.owner)} · نطاق المحفظة تحت المطابقة البندية</p>${pocMarkup(p)}
    <div class="progress-line"><i></i></div><div class="progress-label"><span>التقدم التقديري</span><b>${ar(p.progress)}%</b></div>
    <ul><li><b>آخر تحديث:</b> ${esc(p.lastUpdate)}</li><li><b>المخاطر:</b> ${esc(p.risk)}</li></ul>
    <div class="next-action"><span>الإجراء القادم</span>${esc(p.next)}</div>
    <div class="next-action" style="margin-top:8px"><span>الدعم المطلوب</span>${esc(p.support)}</div>
    <button class="portfolio-open" data-open="${p.id}">فتح غرفة المتابعة ←</button>
  </article>`}).join(''):'<div class="empty">لا توجد محافظ تطابق المرشحات الحالية.</div>';
}

function renderCenterBaseline(){
  const headers=CENTER_BASELINE.headers,all=CENTER_BASELINE.rows;
  const statuses=[...new Set(all.map(r=>baselineText(r['حالة الطلب'])))].sort((a,b)=>a.localeCompare(b,'ar'));
  const responses=[...new Set(all.map(r=>baselineText(r['الإستجابة'])))].sort((a,b)=>a.localeCompare(b,'ar'));
  const rows=all.filter(r=>(state.baselineStatus==='all'||baselineText(r['حالة الطلب'])===state.baselineStatus)&&(state.baselineResponse==='all'||baselineText(r['الإستجابة'])===state.baselineResponse)&&(!state.baselineSearch||JSON.stringify(r).toLowerCase().includes(state.baselineSearch)));
  $('#servicesGrid').classList.remove('actions-view','architecture-view');$('#servicesGrid').classList.add('center-baseline-view');
  $('#resultsCount').textContent=`${ar(rows.length)} من ${ar(all.length)} طلبًا · ${ar(headers.length)} حقلاً كما وردت`;
  $('#servicesGrid').innerHTML=`<section class="center-baseline-overview"><article class="glass chart-card"><header><div><p class="eyebrow">مؤشر خط أساس المركز</p><h2>حالات الطلبات المقبولة</h2></div><span class="source-chip">Book1.xlsx · الاستجابة: مقبول</span></header><div class="baseline-chart-layout"><div class="donut-wrap"><canvas id="donutChart" width="260" height="260" aria-label="توزيع حالات الطلبات المقبولة كما وردت من المركز"></canvas><div class="donut-center"><b id="donutTotal">122</b><span>طلباً مقبولاً</span></div></div><div id="statusLegend" class="legend"></div></div></article></section><section class="baseline-source-head"><div><span>المصدر الرسمي</span><b>${esc(CENTER_BASELINE.source)}</b><small>الورقة: ${esc(CENTER_BASELINE.sheet)} · البيانات معروضة دون إعادة تصنيف أو استنتاج</small></div><div class="baseline-filters"><label>حالة الطلب<select id="baselineStatusFilter"><option value="all">جميع الحالات</option>${statuses.map(x=>`<option value="${esc(x)}" ${state.baselineStatus===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>الاستجابة<select id="baselineResponseFilter"><option value="all">جميع الاستجابات</option>${responses.map(x=>`<option value="${esc(x)}" ${state.baselineResponse===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label class="baseline-search">بحث في جميع الحقول<input id="baselineSearchInput" value="${esc(state.baselineSearch)}" placeholder="رقم الطلب، المالك، الوصف…"></label></div></section>${rows.length?`<section class="baseline-records" aria-label="سجل طلبات خط أساس المركز">${rows.map((r,i)=>baselineRecord(r,i)).join('')}</section>`:'<div class="empty">لا توجد سجلات تطابق التصفية الحالية.</div>'}`;
  requestAnimationFrame(drawDonut);
}

function agencyPriority(p){return({critical:'حرجة',high:'عالية',medium:'متوسطة',normal:'متوسطة',low:'منخفضة'}[p.priority]||p.priority||'غير محددة')}
function agencyRequestDate(item,d){
  if(item.requestDate)return{value:item.requestDate,source:'تاريخ الطلب المسجل'};
  const evidence=String(item.requestEvidence||item.evidence||'');
  const match=evidence.match(/(?:بتاريخ|في|من)\s*(\d{1,2}\s+(?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)(?:\s+\d{4})?)/);
  if(match)return{value:match[1],source:'مستخرج من دليل الطلب'};
  return{value:d?.asOf||'غير مسجل',source:d?.asOf?'تاريخ القيد في سجل الوكالة':'غير مسجل'};
}
function agencyRows(){const order=readLocal(AGENCY_ORDER_KEY,[]),rows=DB.portfolios.flatMap(p=>workItemsFor(p,DETAILS[p.id]).map(item=>{const d=DETAILS[p.id]||{},date=agencyRequestDate(item,d),pillar=ARCH.pillars.find(x=>x.id===p.architecture.pillar)?.name||'غير مصنف';return{key:`${p.id}::${item.id}`,p,item,date,pillar,priority:agencyPriority(p),agencyOwner:(p.poc||p.boc)?.agency||'غير محدد',description:item.description||'غير مسجل',update:item.completionEvidence||item.requestEvidence||item.evidence||p.lastUpdate||'غير مسجل',center:item.centerRequirementId?`${item.centerRequirementId} — ${item.centerStatus||'حالة غير مسجلة'}`:'غير مرتبط بند محدد'}}));return rows.sort((a,b)=>{if(a.item.status==='done'&&b.item.status!=='done')return 1;if(b.item.status==='done'&&a.item.status!=='done')return-1;const ai=order.indexOf(a.key),bi=order.indexOf(b.key);if(ai>=0||bi>=0)return(ai<0?9999:ai)-(bi<0?9999:bi);return DB.portfolios.indexOf(a.p)-DB.portfolios.indexOf(b.p)})}
function renderAgencyBaseline(){
  const all=agencyRows(),statuses=[...new Set(all.map(x=>STATUS[x.item.status]||x.item.status))],priorities=[...new Set(all.map(x=>x.priority))],portfolios=[...new Set(all.map(x=>x.p.name))];
  const rows=all.filter(x=>(state.agencyStatus==='all'||(STATUS[x.item.status]||x.item.status)===state.agencyStatus)&&(state.agencyPriority==='all'||x.priority===state.agencyPriority)&&(state.agencyPortfolio==='all'||x.p.name===state.agencyPortfolio)&&(!state.agencySearch||JSON.stringify(x).toLowerCase().includes(state.agencySearch)));
  const linked=all.filter(x=>x.item.centerRequirementId).length,completed=all.filter(x=>x.item.status==='done').length,remaining=all.length-completed;
  $('#servicesGrid').classList.remove('actions-view','architecture-view');$('#servicesGrid').classList.add('center-baseline-view','agency-baseline-view');
  $('#resultsCount').textContent=`${ar(rows.length)} من ${ar(all.length)} سجل عمل في خط أساس الوكالة`;
  $('#servicesGrid').innerHTML=`<section class="center-baseline-overview"><article class="glass chart-card"><header><div><p class="eyebrow">مؤشر خط أساس الوكالة</p><h2>حالة تنفيذ الطلبات</h2></div><span class="source-chip">${ar(linked)} مطابق للمركز · ${ar(all.length-linked)} تحتاج مطابقة</span></header><div class="agency-primary-kpis"><div class="total"><b>${ar(all.length)}</b><span>إجمالي الطلبات</span><small>${ar(linked)} مطابق لسجلات المركز · ${ar(all.length-linked)} تحتاج مراجعة أو مطابقة</small></div><div class="completed"><b>${ar(completed)}</b><span>منجز</span><small>وفق حالة التنفيذ المسجلة</small></div><div class="remaining"><b>${ar(remaining)}</b><span>غير منجز</span><small>المستهدف بالترتيب حسب الأولوية</small></div></div></article></section><section class="baseline-source-head"><div><span>خط الأساس التشغيلي للوكالة</span><b>الأعمال غير المنجزة أولاً حسب الأولوية</b><small>اسحب السجلات غير المنجزة وأفلتها لتغيير ترتيب استهدافها. السجلات المنجزة تظهر في نهاية القائمة ولا تدخل في ترتيب الأعمال القادمة.</small></div><div class="baseline-filters"><label>المحفظة<select id="agencyPortfolioFilter"><option value="all">جميع المحافظ</option>${portfolios.map(x=>`<option ${state.agencyPortfolio===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>الحالة<select id="agencyStatusFilter"><option value="all">جميع الحالات</option>${statuses.map(x=>`<option ${state.agencyStatus===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>الأولوية<select id="agencyPriorityFilter"><option value="all">جميع الأولويات</option>${priorities.map(x=>`<option ${state.agencyPriority===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label class="baseline-search">بحث<input id="agencySearchInput" value="${esc(state.agencySearch)}" placeholder="الكود، الطلب، المسؤول، المحفظة…"></label></div></section>${rows.length?`<section class="baseline-records agency-sortable">${rows.map((x,i)=>agencyRecord(x,i)).join('')}</section>`:'<div class="empty">لا توجد سجلات تطابق التصفية الحالية.</div>'}`;
}
function agencyRecord(x,index){const done=x.item.status==='done';return`<details class="baseline-record ${done?'agency-completed':'agency-draggable'}" draggable="${!done}" data-agency-key="${esc(x.key)}"><summary><span class="agency-drag-handle" title="${done?'سجل منجز':'اسحب لتغيير الأولوية'}">${done?'✓':'⋮⋮'}</span><span class="record-index">${ar(index+1)}</span><div class="record-identity"><b>${esc(x.item.id)}</b><small>${esc(x.item.title)}</small><em class="agency-portfolio-label">${esc(x.p.name)}</em></div><span class="record-owner"><i>المسؤول في الوكالة</i>${esc(x.agencyOwner)}</span><span class="record-status"><i>الحالة</i>${esc(STATUS[x.item.status]||x.item.status)}</span><span class="record-priority"><i>أولوية المحفظة</i>${esc(x.priority)}</span><span class="record-response"><i>تاريخ الطلب/القيد</i>${esc(x.date.value)}</span><span class="record-chevron">⌄</span></summary><div class="record-details"><section class="record-group"><h3>التعريف والارتباط</h3><div><dl><dt>${done?'ترتيب السجل':'ترتيب أولوية التنفيذ'}</dt><dd>${done?'منجز — خارج ترتيب الأعمال القادمة':ar(index+1)}</dd></dl><dl><dt>المحفظة</dt><dd>${esc(x.p.name)}</dd></dl><dl><dt>المسار</dt><dd>${esc(x.pillar)}</dd></dl><dl><dt>المسؤول في الوكالة</dt><dd>${esc(x.agencyOwner)}</dd></dl><dl><dt>الربط مع المركز</dt><dd>${esc(x.center)}</dd></dl></div></section><section class="record-group"><h3>تفاصيل الطلب</h3><div><dl><dt>الطلب</dt><dd>${esc(x.item.title)}</dd></dl><dl><dt>التوضيح المسجل</dt><dd>${esc(x.description)}</dd></dl><dl><dt>تاريخ الطلب/القيد</dt><dd>${esc(x.date.value)} · ${esc(x.date.source)}</dd></dl><dl><dt>الأولوية</dt><dd>${esc(x.priority)} · موروثة من المحفظة</dd></dl></div></section><section class="record-group"><h3>المتابعة التنفيذية</h3><div><dl><dt>ما تم / آخر تحديث</dt><dd>${esc(x.update)}</dd></dl><dl><dt>الدليل</dt><dd>${esc(x.item.requestEvidence||x.item.evidence||'غير مسجل')}</dd></dl><dl><dt>الإجراء القادم</dt><dd>${esc(x.item.next||'غير مسجل')}</dd></dl><dl><dt>الدعم المطلوب</dt><dd>${esc(x.item.support||'غير مسجل')}</dd></dl></div></section></div></details>`}
function reorderAgency(from,to){if(from===to)return;const current=agencyRows().filter(x=>x.item.status!=='done').map(x=>x.key),fi=current.indexOf(from),ti=current.indexOf(to);if(fi<0||ti<0)return;const[item]=current.splice(fi,1);current.splice(ti,0,item);writeLocal(AGENCY_ORDER_KEY,current);renderAgencyBaseline()}

function baselineRecord(row,index){
  const groups=[
    ['التعريف والملكية',['معرف الطلب','مقدم الطلب','مالك المنتج','الجهة','المصدر/العنوان','تاريخ الإستلام']],
    ['تفاصيل الطلب',['الطلب','الوصف','المحور','التصنيف','الأولوية']],
    ['الإسناد والاستجابة',['مديرالمنتج','الإستجابة','سبب الإستجابة','تاريخ الإسناد للمحلل']],
    ['الحالة والمواعيد',['حالة الطلب','نسبة الإنجاز','التاريخ المستهدف','التاريخ المتوقع']],
    ['حقول إضافية كما وردت',['Column2','Column1','Column3']],
    ['الملاحظات',['ملاحظات']],
  ];
  return `<details class="baseline-record"><summary><span class="record-index">${ar(index+1)}</span><div class="record-identity"><b>${esc(baselineDisplay(row['معرف الطلب'],'معرف الطلب'))}</b><small>${esc(baselineDisplay(row['الطلب'],'الطلب'))}</small></div><span class="record-owner"><i>مالك المنتج</i>${esc(baselineDisplay(row['مالك المنتج'],'مالك المنتج'))}</span><span class="record-status"><i>حالة الطلب</i>${esc(baselineDisplay(row['حالة الطلب'],'حالة الطلب'))}</span><span class="record-priority"><i>الأولوية</i>${esc(baselineDisplay(row['الأولوية'],'الأولوية'))}</span><span class="record-response"><i>الاستجابة</i>${esc(baselineDisplay(row['الإستجابة'],'الإستجابة'))}</span><span class="record-chevron" aria-hidden="true">⌄</span></summary><div class="record-details">${groups.map(([title,fields])=>`<section class="record-group"><h3>${title}</h3><div>${fields.map(field=>`<dl><dt>${esc(field)}</dt><dd>${esc(baselineDisplay(row[field],field))}</dd></dl>`).join('')}</div></section>`).join('')}</div></details>`;
}

function baselineText(value){return value===null||value===undefined||String(value).trim()===''?'(فارغ)':String(value).trim()}
function baselineDisplay(value,header){
  if(value===null||value===undefined||value==='')return '—';
  if(typeof value==='number'&&['تاريخ الإستلام','تاريخ الإسناد للمحلل','التاريخ المستهدف','التاريخ المتوقع'].includes(header)){
    const date=new Date(Date.UTC(1899,11,30)+value*86400000);
    return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('ar-SA',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'});
  }
  return String(value);
}

function renderArchitecture(ps){
  $('#servicesGrid').classList.remove('actions-view');$('#servicesGrid').classList.add('architecture-view');
  const groups=ARCH.pillars.map(pillar=>({pillar,items:ps.filter(p=>p.architecture.pillar===pillar.id)})).filter(g=>g.items.length);
  $('#resultsCount').textContent=`${ar(groups.length)} مسارات · ${ar(ps.length)} محفظة ومسار فرعي ومبادرة`;
  $('#servicesGrid').innerHTML=groups.map(({pillar,items},i)=>`<article class="pillar-card" style="--pillar-index:${i}"><header><span>مسار رئيسي ${ar(i+1)}</span><h3>${esc(pillar.name)}</h3><p>${esc(pillar.description)}</p></header><div class="pillar-items">${items.map(p=>{const rank=DB.portfolios.indexOf(p)+1;return `<button data-open="${p.id}"><b>${ar(rank)} · ${esc(p.name)}</b><span>${esc(p.architecture.elementType)} · ${esc(p.architecture.nature)}</span><small>${esc(p.architecture.technicalState)} ← ${esc(p.architecture.operatingState)}</small></button>`}).join('')}</div></article>`).join('')||'<div class="empty">لا توجد مسارات تطابق المرشحات الحالية.</div>';
}

function renderTechnicalRegister(ps){
  $('#servicesGrid').classList.add('actions-view');$('#servicesGrid').classList.remove('architecture-view');
  $('#resultsCount').textContent=`${ar(ps.length)} مشروعًا أو محفظة تحت المتابعة التقنية`;
  $('#servicesGrid').innerHTML=`<section class="closure-gates"><span>بوابات الإغلاق التقني</span>${ARCH.closureGates.map((g,i)=>`<b>${ar(i+1)} · ${esc(g)}</b>`).join('')}</section><div class="action-register-head technical"><span>الأولوية</span><span>المشروع التقني</span><span>حالة التنفيذ</span><span>بوابة الإغلاق والتسليم</span></div>${ps.map(p=>{const rank=DB.portfolios.indexOf(p)+1,a=p.architecture;return `<article class="action-register-row technical ${rank<=10?'top-action':''}"><div class="action-order"><b>${ar(rank)}</b><small>أولوية المحفظة</small></div><div><span class="service-code">${esc(ARCH.pillars.find(x=>x.id===a.pillar)?.name)} · ${esc(a.elementType)}</span><h3>${esc(p.name)}</h3><small>${esc(a.nature)}</small></div><div><span class="delivery-state">${esc(a.technicalState)}</span><p>${ar(p.progress)}% تقدم تقديري</p></div><div><p><strong>الإجراء:</strong> ${esc(p.next)}</p><small><strong>التسليم إلى:</strong> ${esc(a.operationsOwner)}</small><button class="portfolio-open" data-open="${p.id}">فتح تفاصيل المشروع ←</button></div></article>`}).join('')}`;
}

function renderOperationsRegister(ps){
  $('#servicesGrid').classList.add('actions-view');$('#servicesGrid').classList.remove('architecture-view');
  const rows=[...ps].sort((a,b)=>a.architecture.operatingState.localeCompare(b.architecture.operatingState,'ar'));
  $('#resultsCount').textContent=`${ar(rows.length)} خدمة بحسب حالة التسليم والتشغيل`;
  $('#servicesGrid').innerHTML=`<div class="action-register-head operations"><span>الأولوية</span><span>الخدمة</span><span>الحالة التشغيلية</span><span>مالك التشغيل</span></div>${rows.map(p=>{const rank=DB.portfolios.indexOf(p)+1,a=p.architecture;return `<article class="action-register-row operations ${a.operatingState.includes('مسلّم')?'handed-over':''}"><div class="action-order"><b>${ar(rank)}</b><small>${esc(a.nature)}</small></div><div><span class="service-code">${esc(a.elementType)}</span><h3>${esc(p.name)}</h3><small>التنفيذ التقني: ${esc(a.technicalState)}</small></div><div><span class="operating-state">${esc(a.operatingState)}</span></div><div><p>${esc(a.operationsOwner)}</p><small>${a.operatingState.includes('مسلّم')?'متابعة مؤشرات الأثر والتشغيل المستمر':'يتطلب استكمال بوابات الإغلاق والتسليم'}</small><button class="portfolio-open" data-open="${p.id}">فتح سجل التسليم ←</button></div></article>`}).join('')}`;
}

function renderActionRegister(ps){
  $('#servicesGrid').classList.add('actions-view');$('#servicesGrid').classList.remove('architecture-view');
  const rows=ps.flatMap(p=>{let items=workItemsFor(p,DETAILS[p.id]).filter(x=>x.status!=='done');if(!items.length&&p.next)items=[{id:`${p.code}-NEXT`,title:p.next,status:p.status==='risk'?'risk':'pending',owner:p.owner,next:p.next,support:p.support,evidence:'الإجراء القادم المسجل في المحفظة'}];return items.map((x,i)=>({p,x,portfolioRank:DB.portfolios.indexOf(p)+1,workRank:i+1}))});
  $('#resultsCount').textContent=`${ar(rows.length)} عملًا قادمًا · مرتبة حسب أولوية المحفظة ثم أولوية العمل`;
  $('#servicesGrid').innerHTML=rows.length?`<div class="action-register-head"><span>الأولوية</span><span>العمل القادم والمحفظة</span><span>المالك والحالة</span><span>الإجراء والدعم</span></div>${rows.map(({p,x,portfolioRank,workRank})=>`<article class="action-register-row ${portfolioRank<=10?'top-action':''}">
    <div class="action-order"><b>${ar(portfolioRank)}.${ar(workRank)}</b><small>المحفظة ${ar(portfolioRank)} · العمل ${ar(workRank)}</small></div>
    <div><span class="service-code">${esc(p.code)} · ${esc(p.name)}</span><h3>${esc(x.id)} · ${esc(x.title)}</h3>${x.requestDate?`<small>تاريخ الطلب: ${esc(x.requestDate)}</small>`:''}</div>
    <div><span class="badge" style="--status:${COLORS[x.status]};color:${COLORS[x.status]}">${STATUS[x.status]}</span><p>${esc(x.owner)}</p></div>
    <div><p><strong>التالي:</strong> ${esc(x.next)}</p><small><strong>الدعم:</strong> ${esc(x.support)}</small><button class="portfolio-open" data-open="${p.id}">فتح سجل المحفظة ←</button></div>
  </article>`).join('')}`:'<div class="empty">لا توجد أعمال قادمة ضمن المرشحات الحالية.</div>';
}

function bindDragAndDrop(){
  let draggedPortfolio=null,draggedWork=null,draggedAgency=null;
  $('#servicesGrid').addEventListener('dragstart',e=>{const agency=e.target.closest('[data-agency-key]');if(agency){draggedAgency=agency.dataset.agencyKey;agency.classList.add('dragging');return}const card=e.target.closest('[data-portfolio-id]');if(!state.priorityEdit||!card)return e.preventDefault();draggedPortfolio=card.dataset.portfolioId;card.classList.add('dragging')});
  $('#servicesGrid').addEventListener('dragover',e=>{if(draggedAgency){e.preventDefault();e.target.closest('[data-agency-key]')?.classList.add('drag-over');return}if(draggedPortfolio){e.preventDefault();e.target.closest('[data-portfolio-id]')?.classList.add('drag-over')}});
  $('#servicesGrid').addEventListener('dragleave',e=>e.target.closest('[data-portfolio-id]')?.classList.remove('drag-over'));
  $('#servicesGrid').addEventListener('drop',e=>{if(draggedAgency){const target=e.target.closest('[data-agency-key]');if(!target)return;e.preventDefault();reorderAgency(draggedAgency,target.dataset.agencyKey);draggedAgency=null;return}const target=e.target.closest('[data-portfolio-id]');if(!target||!draggedPortfolio)return;e.preventDefault();reorderPortfolio(draggedPortfolio,target.dataset.portfolioId);draggedPortfolio=null});
  $('#servicesGrid').addEventListener('dragend',()=>{$$('.dragging,.drag-over').forEach(x=>x.classList.remove('dragging','drag-over'));draggedPortfolio=null;draggedAgency=null});
  $('#portfolioDialog').addEventListener('dragstart',e=>{const row=e.target.closest('[data-work-id]');if(!row||row.dataset.done==='true')return e.preventDefault();draggedWork={portfolio:row.dataset.portfolio,id:row.dataset.workId};row.classList.add('dragging')});
  $('#portfolioDialog').addEventListener('dragover',e=>{if(draggedWork){e.preventDefault();e.target.closest('[data-work-id]')?.classList.add('drag-over')}});
  $('#portfolioDialog').addEventListener('drop',e=>{const target=e.target.closest('[data-work-id]');if(!target||!draggedWork)return;e.preventDefault();reorderWork(draggedWork.portfolio,draggedWork.id,target.dataset.workId);draggedWork=null});
  $('#portfolioDialog').addEventListener('dragend',()=>{$$('.dragging,.drag-over').forEach(x=>x.classList.remove('dragging','drag-over'));draggedWork=null});
}
function reorderPortfolio(from,to){if(from===to)return;const fromIndex=DB.portfolios.findIndex(x=>x.id===from),toIndex=DB.portfolios.findIndex(x=>x.id===to),[item]=DB.portfolios.splice(fromIndex,1);DB.portfolios.splice(toIndex,0,item);writeLocal(ORDER_KEY,DB.portfolios.map(x=>x.id));fillFilters();renderServices()}
function workItemsFor(p,d){const base=d?.workItems||p.achieved.map((x,i)=>({id:`${p.code}-${i+1}`,title:x,status:'done',owner:p.owner,evidence:'تحديث المحفظة',next:p.next,support:p.support})),saved=readLocal(WORK_KEY,{}),portfolio=saved[p.id]||{};const items=base.map(x=>({...x,...portfolio.items?.[x.id]})),order=portfolio.order||[];return items.sort((a,b)=>{if(a.status==='done'&&b.status!=='done')return 1;if(b.status==='done'&&a.status!=='done')return-1;const ai=order.indexOf(a.id),bi=order.indexOf(b.id);return(ai<0?999:ai)-(bi<0?999:bi)})}
function reorderWork(portfolio,from,to){if(from===to)return;const saved=readLocal(WORK_KEY,{}),p=DB.portfolios.find(x=>x.id===portfolio),items=workItemsFor(p,DETAILS[portfolio]).filter(x=>x.status!=='done'),order=items.map(x=>x.id),fi=order.indexOf(from),ti=order.indexOf(to);if(fi<0||ti<0)return;const[item]=order.splice(fi,1);order.splice(ti,0,item);saved[portfolio]={...(saved[portfolio]||{}),order};writeLocal(WORK_KEY,saved);openPortfolio(portfolio)}
function completeWork(portfolio,id){const evidence=prompt('أدخل دليل الإنجاز: رقم الطلب، رابط المستند، أو مرجع البريد.');if(!evidence)return;const saved=readLocal(WORK_KEY,{});saved[portfolio]=saved[portfolio]||{};saved[portfolio].items=saved[portfolio].items||{};saved[portfolio].items[id]={status:'done',completionDate:new Date().toLocaleDateString('ar-SA'),completionEvidence:evidence};writeLocal(WORK_KEY,saved);openPortfolio(portfolio)}

function openWeeklyReport(){
  const w=week(),ps=relevant(),avg=ps.length?Math.round(ps.reduce((s,p)=>s+p.progress,0)/ps.length):0;
  const statusCount=s=>ps.filter(p=>p.status===s).length;
  const attention=ps.filter(p=>p.priority==='critical'||p.status==='risk');
  $('#weeklyReport').innerHTML=`
    <section class="weekly-page weekly-page-summary">
      <header class="weekly-report-head"><img src="assets/ministry-logo.png" alt="وزارة الحج والعمرة"><div><span>إدارة متابعة الأنظمة الرقمية · وكالة العمرة</span><h1>تقرير الإنجاز الأسبوعي</h1><p>${esc(w.label)} · ${esc(w.period)}</p></div><button data-week-print>طباعة / حفظ PDF</button></header>
      <div class="weekly-hero"><span>الملخص التنفيذي</span><h2>${esc(w.summary)}</h2><p>يعرض التقرير المحافظ التي سُجل عليها نشاط خلال الفترة، ويربط آخر تحديث بالتقدم والإجراء القادم.</p></div>
      <div class="weekly-metrics">
        <article><b>${ar(ps.length)}</b><span>محافظ عليها نشاط</span></article><article><b>${ar(w.metrics.outputs)}</b><span>مخرجات الأسبوع</span></article><article><b>${ar(w.metrics.communications)}</b><span>مراسلات ومتابعات</span></article><article><b>${ar(w.metrics.decisions)}</b><span>قرارات وتوجيهات</span></article><article><b>${ar(avg)}%</b><span>متوسط تقدم المحافظ</span></article>
      </div>
      <section class="weekly-pulse"><div><span>نبض المحفظة</span><b>${ar(statusCount('progress'))} قيد التنفيذ · ${ar(statusCount('done'))} منجزة · ${ar(statusCount('pending'))} بانتظار إجراء</b></div><div class="weekly-progress"><i style="width:${avg}%"></i></div><small>مؤشر تقديري لتقدم المحافظ النشطة في الأسبوع، ولا يمثل نسبة الإغلاق البندية.</small></section>
      <div class="weekly-summary-grid">
        <section><h3>أبرز أحداث الأسبوع</h3><div class="weekly-events">${w.timeline.map((x,i)=>`<article><i>${ar(i+1)}</i><div><time>${esc(x.date)}</time><b>${esc(x.title)}</b><p>${esc(x.detail)}</p></div></article>`).join('')}</div></section>
        <section><h3>رادار الأولوية</h3><div class="weekly-attention">${(attention.length?attention:ps.slice(0,3)).slice(0,4).map(p=>`<article><span>${p.priority==='critical'?'حرجة':'عالية'}</span><b>${esc(p.name)}</b><p>${esc(p.next)}</p></article>`).join('')}</div></section>
      </div>
    </section>
    <section class="weekly-page weekly-page-portfolios">
      <header class="weekly-section-head"><div><span>${esc(w.label)}</span><h2>المحافظ التي شهدت نشاطًا</h2></div><b>${ar(ps.length)} محافظ</b></header>
      <div class="weekly-portfolio-grid ${ps.length>9?'dense':''} ${ps.length>10?'ultra-dense':''}">${ps.map(p=>`<article style="--weekly-status:${COLORS[p.status]}"><div class="weekly-card-head"><div><small>${esc(p.code)} · ${esc(p.type)}</small><h3>${esc(p.name)}</h3></div><span>${STATUS[p.status]}</span></div><div class="weekly-card-progress"><i style="width:${p.progress}%"></i></div><div class="weekly-card-score"><span>التقدم التقديري</span><b>${ar(p.progress)}%</b></div>${pocMarkup(p)}<p><strong>آخر تحديث:</strong> ${esc(p.lastUpdate)}</p><p><strong>الإجراء القادم:</strong> ${esc(p.next)}</p></article>`).join('')}</div>
      <footer class="weekly-report-foot"><span>المصدر: قاعدة بيانات المتابعة الأسبوعية والمراسلات الموثقة</span><span>${esc(DB.meta.lastUpdated)}</span></footer>
    </section>`;
  $('#weeklyReportDialog').showModal();
}

function openPortfolio(id){
  const p=DB.portfolios.find(x=>x.id===id),d=DETAILS[id],items=workItemsFor(p,d);
  const architecture=p.architecture||{},pillar=ARCH.pillars.find(x=>x.id===architecture.pillar);
  const milestones=d?.milestones||[...p.achieved.map((x,i)=>({date:`معلم ${ar(i+1)}`,title:x,status:'done',detail:'مخرج موثق ضمن سجل المحفظة.',evidence:'سجل تحديثات المحفظة'})),{date:'آخر تحديث',title:'الحالة التنفيذية الحالية',status:p.status,detail:p.lastUpdate,evidence:'آخر تحديث مسجل'}];
  const raci=d?.raci||buildRaci(d?.governance,p);
  const stats=[{s:'total',n:items.length},...['done','progress','pending','risk'].map(s=>({s,n:items.filter(x=>x.status===s).length}))];
  const e=d?.evm,sv=e?e.earned-e.planned:null,spi=e&&e.planned?e.earned/e.planned:null,cv=e?.actualCost!=null?e.earned-e.actualCost:null,cpi=e?.actualCost?e.earned/e.actualCost:null;
  $('#portfolioDetail').innerHTML=`<div class="portfolio-titlebar"><div><p class="eyebrow">${p.code} · غرفة متابعة المحفظة</p><h2>${esc(p.name)}</h2></div><button class="print-portfolio-btn" data-print>طباعة / حفظ PDF</button></div><p class="detail-lead">${esc(d?.source||p.lastUpdate)}</p>${pocMarkup(p)}<section class="delivery-summary"><div><span>المسار</span><b>${esc(pillar?.name)}</b></div><div><span>نوع العنصر</span><b>${esc(architecture.elementType)}</b></div><div><span>الطبيعة</span><b>${esc(architecture.nature)}</b></div><div><span>التنفيذ التقني</span><b>${esc(architecture.technicalState)}</b></div><div><span>التشغيل والتسليم</span><b>${esc(architecture.operatingState)}</b></div><div><span>مالك التشغيل</span><b>${esc(architecture.operationsOwner)}</b></div></section>
    <div class="detail-stats">${stats.map(x=>`<div class="${x.s}"><b>${ar(x.n)}</b><span>${x.s==='total'?'إجمالي سجل الأعمال':STATUS[x.s]}</span></div>`).join('')}</div>
    ${d?.tracks?`<section class="portfolio-tracks">${d.tracks.map(x=>`<article><div><span>مسار تنفيذي</span><h3>${esc(x.name)}</h3></div><span class="badge" style="--status:${COLORS[x.status]};color:${COLORS[x.status]}">${STATUS[x.status]}</span><p><b>الحالة الحالية:</b> ${esc(x.current)}</p><p><b>الإجراء التالي:</b> ${esc(x.next)}</p><small>${esc(x.owner)}</small></article>`).join('')}</section>`:''}
    ${d?.kpis?`<section class="portfolio-kpis">${d.kpis.map(x=>`<article class="${x.attention?'attention':''}"><b>${esc(x.value)}</b><span>${esc(x.label)}</span><small>${esc(x.note)}</small></article>`).join('')}</section>`:''}
    ${d?.catalog?`<section class="service-catalog"><article><header><span>متوفر في دليل التكامل</span><b>${ar(d.catalog.available.length)} خدمة</b></header><ol>${d.catalog.available.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></article><article class="missing"><header><span>غير متوفر ومطلوب</span><b>${ar(d.catalog.unavailable.length)} خدمات</b></header><ol>${d.catalog.unavailable.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><p>${esc(d.catalog.note)}</p></article></section>`:''}
    <section class="milestone-section"><div class="milestone-heading"><div><p class="eyebrow">السجل الزمني</p><h3>سجل الأحداث والمعالم الرئيسية</h3></div><span>${ar(milestones.length)} معالم</span></div><div class="milestone-rail">${milestones.map((m,i)=>`<article class="milestone ${m.status}"><i>${ar(i+1)}</i><div><time>${esc(m.date)}</time><b>${esc(m.title)}</b><p>${esc(m.detail)}</p><small>الدليل: ${esc(m.evidence)}</small></div><span>${STATUS[m.status]||esc(m.status)}</span></article>`).join('')}</div></section>
    ${d?.governance?`<section class="governance-section"><h3>السجل الرأسي للحوكمة والمتابعة</h3><div class="governance-rail">${d.governance.map((x,i)=>`<article><i>${ar(i+1)}</i><div><span>${esc(x.level)}</span><b>${esc(x.party)}</b><small>${esc(x.duty)}</small></div></article>`).join('')}</div></section>`:''}
    <section class="raci-section"><div class="milestone-heading"><div><p class="eyebrow">حوكمة أصحاب المصلحة</p><h3>مصفوفة المسؤوليات RACI</h3></div><span>توزيع الأدوار</span></div><div class="raci-legend"><span><b>R</b> المنفّذ</span><span><b>A</b> المساءل وصاحب الاعتماد</span><span><b>C</b> المستشار</span><span><b>I</b> المُحاط بالتحديث</span></div><div class="raci-table"><div class="raci-head"><b>الجهة / صاحب المصلحة</b><b>الدور</b><b>المسؤولية</b></div>${raci.map(x=>`<article><div><b>${esc(x.party)}</b><small>${esc(x.level||'صاحب مصلحة')}</small></div><span class="raci-code ${esc(x.role).toLowerCase()}">${esc(x.role)}</span><p>${esc(x.duty)}</p></article>`).join('')}</div></section>
    ${e?`<section class="evm-section"><header><div><h3>القيمة المكتسبة EVM</h3><small>${esc(e.basis)}</small></div><span>${esc(e.unit)}</span></header><div class="evm-grid"><div><span>خط الأساس BAC</span><b>${ar(e.baseline)}</b></div><div><span>القيمة المخططة PV</span><b>${ar(e.planned)}</b></div><div><span>القيمة المكتسبة EV</span><b>${ar(e.earned)}</b></div><div class="${sv<0?'negative':'positive'}"><span>انحراف الجدول SV</span><b>${sv>0?'+':''}${ar(sv)}</b></div><div class="${spi<1?'negative':'positive'}"><span>مؤشر الجدول SPI</span><b>${spi.toFixed(2)}</b></div><div><span>انحراف التكلفة CV</span><b>${cv==null?'غير متاح':ar(cv)}</b></div><div><span>مؤشر التكلفة CPI</span><b>${cpi==null?'غير متاح':cpi.toFixed(2)}</b></div></div></section>`:''}
    ${d?.decisions?`<section class="decision-strip"><h3>القرارات والتوجهات</h3>${d.decisions.map(x=>`<span>${esc(x)}</span>`).join('')}</section>`:''}
    <div class="detail-grid"><section><h3>سجل الأعمال</h3><p class="work-hint">اسحب الأعمال غير المنجزة لترتيب أولوية التنفيذ داخل المحفظة.</p><div class="work-table">${items.map((x,i)=>`<article draggable="${x.status!=='done'}" data-work-id="${esc(x.id)}" data-portfolio="${p.id}" data-done="${x.status==='done'}"><div><span class="work-rank">${ar(i+1)}</span><span class="badge" style="--status:${COLORS[x.status]};color:${COLORS[x.status]}">${STATUS[x.status]}</span><b>${esc(x.id)} · ${esc(x.title)}</b></div>${x.requestDate?`<p><strong>تاريخ الطلب:</strong> ${esc(x.requestDate)}</p>`:''}<p><strong>المالك:</strong> ${esc(x.owner)}</p><p><strong>دليل إنشاء الطلب:</strong> ${esc(x.requestEvidence||x.evidence)}</p><p><strong>التالي:</strong> ${esc(x.next)}</p><p><strong>الدعم:</strong> ${esc(x.support)}</p>${x.completionEvidence?`<p class="completion-evidence"><strong>دليل الإنجاز:</strong> ${esc(x.completionEvidence)} · ${esc(x.completionDate)}</p>`:''}<div class="work-actions">${evidenceLinks(x)||`<button data-evidence="${esc(x.requestEvidence||x.evidence)}">عرض الدليل</button>`}${x.status!=='done'?`<button class="complete-btn" data-complete="${esc(x.id)}" data-portfolio="${p.id}">تسجيل الإنجاز</button>`:''}</div></article>`).join('')}</div></section>
    <aside><h3>القيمة المتحققة</h3>${(d?.benefits||[{value:'إنجاز تشغيلي',evidence:p.lastUpdate,measure:'يتطلب مؤشر أثر معتمد'}]).map(x=>`<div class="benefit"><b>${esc(x.value)}</b><span>${esc(x.evidence)}</span><small>${esc(x.measure)}</small></div>`).join('')}<div class="data-callout"><b>قاعدة الإغلاق</b><p>${esc(DETAILS.framework.closureRule)}</p></div></aside></div>
    ${d?.risks?`<section class="risk-section"><h3>سجل المخاطر والتصعيد</h3><div class="risk-table"><div class="risk-head"><b>الخطر</b><b>المستوى</b><b>المالك</b><b>المعالجة</b><b>محفز التصعيد</b></div>${d.risks.map(r=>`<article><div><small>${esc(r.id)}</small><b>${esc(r.risk)}</b></div><span class="risk-level">${esc(r.level)}</span><span>${esc(r.owner)}</span><span>${esc(r.mitigation)}</span><span>${esc(r.escalation)}</span></article>`).join('')}</div></section>`:''}<footer class="portfolio-print-footer"><span><b>قاعدة الإغلاق:</b> ${esc(DETAILS.framework.closureRule)}</span><i>إدارة متابعة الأنظمة الرقمية · وكالة العمرة</i></footer>`;
  if(!$('#portfolioDialog').open)$('#portfolioDialog').showModal();
}

function setPortfolioPrintTitle(){
  const name=$('#portfolioDetail h2')?.textContent.trim();
  if(!name)return;
  if(!document.body.dataset.screenTitle)document.body.dataset.screenTitle=document.title;
  document.title=name;
}

function buildRaci(governance,p){
  if(!governance?.length)return[{party:p.owner,level:'مالك المحفظة',role:'A',duty:'المساءلة عن النتائج واعتماد الإغلاق'},{party:'فريق التنفيذ التقني',level:'التنفيذ',role:'R',duty:p.next},{party:'إدارة متابعة الأنظمة الرقمية',level:'المتابعة والحوكمة',role:'I',duty:'متابعة التقدم وتوثيق التحديثات والتصعيد'}];
  let accountableAssigned=false;
  return governance.map(x=>{const level=x.level||'';let role='C';if(/مالك الأعمال|الموافقات|الاعتماد/.test(level)&&!accountableAssigned){role='A';accountableAssigned=true}else if(/التنفيذ|التشغيل|التجربة|التحديث/.test(level)){role='R'}else if(/المتابعة|التصعيد|القيادة/.test(level)){role='I'}return{...x,role}});
}

function renderTimeline(){$('#timeline').innerHTML=week().timeline.map(t=>`<div class="timeline-item"><time>${esc(t.date)}</time><b>${esc(t.title)}</b><p>${esc(t.detail)}</p></div>`).join('')}
function renderBaseline(){
  const total=CENTER_BASELINE.rows.length,accepted=CENTER_BASELINE.rows.filter(r=>baselineText(r['الإستجابة'])==='مقبول').length,withoutResponse=CENTER_BASELINE.rows.filter(r=>baselineText(r['الإستجابة'])==='(فارغ)').length;
  const rows=[['إجمالي سجلات Book1',total],['الاستجابة: مقبول',accepted],['الاستجابة: فارغ',withoutResponse]];
  $('#baselineBreakdown').innerHTML=rows.map(([l,v])=>`<div class="baseline-row"><div><span>${l}</span><b>${ar(v)}</b></div><div class="bar"><i style="width:${v/total*100}%"></i></div></div>`).join('')+`<p class="service-meta">المصدر: ${esc(CENTER_BASELINE.source)} · الورقة: ${esc(CENTER_BASELINE.sheet)} · جميع الحقول كما وردت</p>`;
}
function countUp(el,target){const start=performance.now(),dur=750;function tick(now){let p=Math.min(1,(now-start)/dur);el.textContent=ar(Math.round(target*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(tick)}requestAnimationFrame(tick)}
function reveal(){const o=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting&&e.target.classList.add('visible')),{threshold:.08});$$('.reveal').forEach(x=>o.observe(x))}
function debounce(fn,ms){let t;return()=>{clearTimeout(t);t=setTimeout(fn,ms)}}
boot();
