const COLORS={done:'#38c995',progress:'#d2b46d',pending:'#60aee8',risk:'#e5786d',study:'#9c89d9',out:'#637872',unclassified:'#8b9a96'};
const STATUS={done:'منجز / قبول تشغيلي',progress:'قيد العمل',pending:'بانتظار إجراء',risk:'متعثر / خطر'};
let DB,state={week:'',service:'all',status:'all',priority:'all',search:''},raf=[];

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ar=n=>Number(n||0).toLocaleString('ar-SA');
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function boot(){
  try{DB=await fetch('data.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()})}
  catch(e){document.body.innerHTML='<main class="empty">تعذر تحميل قاعدة البيانات. افتح المشروع عبر خادم محلي أو GitHub Pages.</main>';return}
  state.week=DB.meta.defaultWeek; fillFilters(); bind(); render(); reveal();
}

function fillFilters(){
  $('#weekFilter').innerHTML=DB.weeks.map(w=>`<option value="${w.id}">${w.label}</option>`).join('');
  $('#weekFilter').value=state.week;
  $('#serviceFilter').innerHTML='<option value="all">جميع المحافظ</option>'+DB.portfolios.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  $('#lastUpdated').textContent=`آخر تحديث: ${DB.meta.lastUpdated}`;
}

function bind(){
  ['weekFilter','serviceFilter','statusFilter','priorityFilter'].forEach(id=>$('#'+id).addEventListener('change',e=>{state[id.replace('Filter','')]=e.target.value;render()}));
  $('#searchInput').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();renderServices()});
  $('#resetFilters').addEventListener('click',()=>{state={week:DB.meta.defaultWeek,service:'all',status:'all',priority:'all',search:''};fillFilters();$('#statusFilter').value='all';$('#priorityFilter').value='all';$('#searchInput').value='';render()});
  $('#presentationBtn').addEventListener('click',()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen());
  $('#dataBtn').addEventListener('click',()=>$('#dataDialog').showModal());
  $('#dataDialog .close').addEventListener('click',()=>$('#dataDialog').close());
  addEventListener('resize',debounce(renderCharts,180));
}

function week(){return DB.weeks.find(w=>w.id===state.week)}
function relevant(){return DB.portfolios.filter(p=>p.weeks.includes(state.week))}
function filtered(){return relevant().filter(p=>(state.service==='all'||p.id===state.service)&&(state.status==='all'||p.status===state.status)&&(state.priority==='all'||p.priority===state.priority)&&(!state.search||JSON.stringify(p).toLowerCase().includes(state.search)))}

function render(){
  const w=week(); $('#weekPeriod').textContent=w.period; $('#weekDataNote').textContent=w.quality;
  renderMetrics(); renderCharts(); renderDecisions(); renderServices(); renderTimeline(); renderBaseline();
}

function renderMetrics(){
  const w=week(), ps=relevant(), active=ps.filter(p=>p.status==='progress'||p.status==='risk').length;
  const cards=[
    ['إجمالي محفظة المتطلبات',DB.requirements.reportedTotal,'آخر رقم مبلغ عنه','accent'],
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
  $('#activityTotal').textContent=`${ar(week().metrics.outputs+week().metrics.communications)} حركة في الأسبوع`;
  animate(1050,p=>{ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;for(let i=0;i<4;i++){let y=pad.y+i*(h-pad.y*2)/3;ctx.beginPath();ctx.moveTo(pad.x,y);ctx.lineTo(w-pad.x,y);ctx.stroke()}
    [['outputs',COLORS.done],['communications',COLORS.progress]].forEach(([key,color])=>{const pts=weeks.map((x,i)=>[pad.x+i*(w-pad.x*2)/(weeks.length-1),h-pad.y-(x.metrics[key]/max)*(h-pad.y*2)*p]);ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=3;ctx.shadowBlur=12;ctx.shadowColor=color;pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.shadowBlur=0;pts.forEach(([x,y])=>{ctx.beginPath();ctx.fillStyle=color;ctx.arc(x,y,4,0,Math.PI*2);ctx.fill()})});
    ctx.fillStyle='#9ab0aa';ctx.font='11px Segoe UI';ctx.textAlign='center';weeks.forEach((x,i)=>ctx.fillText(x.label.replace(' · 2026',''),pad.x+i*(w-pad.x*2)/(weeks.length-1),h-6));
  });
}
function animate(ms,draw){const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,start=performance.now();function tick(now){const p=reduced?1:Math.min(1,(now-start)/ms),ease=1-Math.pow(1-p,3);draw(ease);if(p<1)raf.push(requestAnimationFrame(tick))}raf.push(requestAnimationFrame(tick))}

function renderDecisions(){$('#decisionList').innerHTML=DB.decisions.map(d=>`<div class="decision"><span>${esc(d.priority)}</span><b>${esc(d.title)}</b><small>${esc(d.detail)}</small></div>`).join('')}

function renderServices(){
  const ps=filtered(); $('#resultsCount').textContent=`عرض ${ar(ps.length)} من ${ar(relevant().length)} محفظة نشطة في الفترة`;
  $('#servicesGrid').innerHTML=ps.length?ps.map((p,i)=>`<article class="service-card" style="--status:${COLORS[p.status]};--progress:${p.progress}%;animation-delay:${i*55}ms">
    <div class="card-top"><div><span class="service-code">${p.code} · ${esc(p.type)}</span><h3>${esc(p.name)}</h3></div><span class="badge">${STATUS[p.status]}</span></div>
    <p class="service-meta">${esc(p.owner)} · نطاق المحفظة تحت المطابقة البندية</p>
    <div class="progress-line"><i></i></div><div class="progress-label"><span>التقدم التقديري</span><b>${ar(p.progress)}%</b></div>
    <ul><li><b>آخر تحديث:</b> ${esc(p.lastUpdate)}</li><li><b>المخاطر:</b> ${esc(p.risk)}</li></ul>
    <div class="next-action"><span>الإجراء القادم</span>${esc(p.next)}</div>
    <div class="next-action" style="margin-top:8px"><span>الدعم المطلوب</span>${esc(p.support)}</div>
  </article>`).join(''):'<div class="empty">لا توجد محافظ تطابق المرشحات الحالية.</div>';
}

function renderTimeline(){$('#timeline').innerHTML=week().timeline.map(t=>`<div class="timeline-item"><time>${esc(t.date)}</time><b>${esc(t.title)}</b><p>${esc(t.detail)}</p></div>`).join('')}
function renderBaseline(){
  const rows=[['خط الأساس الموثق',DB.requirements.documentedBaseline],['إضافات تحت المطابقة',DB.requirements.underReconciliation],['الإجمالي المبلغ عنه',DB.requirements.reportedTotal]];
  $('#baselineBreakdown').innerHTML=rows.map(([l,v])=>`<div class="baseline-row"><div><span>${l}</span><b>${ar(v)}</b></div><div class="bar"><i style="width:${v/DB.requirements.reportedTotal*100}%"></i></div></div>`).join('')+`<p class="service-meta">المصدر: ${esc(DB.requirements.source)}</p>`;
}
function countUp(el,target){const start=performance.now(),dur=750;function tick(now){let p=Math.min(1,(now-start)/dur);el.textContent=ar(Math.round(target*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(tick)}requestAnimationFrame(tick)}
function reveal(){const o=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting&&e.target.classList.add('visible')),{threshold:.08});$$('.reveal').forEach(x=>o.observe(x))}
function debounce(fn,ms){let t;return()=>{clearTimeout(t);t=setTimeout(fn,ms)}}
boot();
