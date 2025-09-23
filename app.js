
// 
function $(id){return document.getElementById(id)}
function metricBox(label, value){ return `<div class="metric"><div class="label">${label}</div><div class="value">${value}</div></div>` }
function nf(x, digits=3){ return Number.isFinite(x)? (+x).toFixed(digits) : "—" }

//(Mulberry32)
function mulberry32(a){return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15, t|1);t^=t+Math.imul(t^t>>>7, t|61);return ((t^t>>>14)>>>0)/4294967296}}
function expRV(rng, rate){ return -Math.log(1-rng())/rate } // exponential(mean=1/rate)

// 
// M/M/1: rho = λ/μ (<1), Lq = ρ^2/(1-ρ), L = ρ/(1-ρ), W = 1/(μ-λ), Wq = ρ/(μ-λ)
function mm1(lambda, mu){
  const rho = lambda/mu;
  if (rho >= 1) return {stable:false, rho, L:Infinity, Lq:Infinity, W:Infinity, Wq:Infinity, P0:0};
  const Lq = (rho*rho)/(1-rho);
  const L = rho/(1-rho);
  const W = 1/(mu - lambda);
  const Wq = rho/(mu - lambda);
  const P0 = 1 - rho;
  return {stable:true, rho, L, Lq, W, Wq, P0};
}

// M/M/c (Erlang-C): rho=λ/(cμ) < 1
function mmc(lambda, mu, c){
  const a = lambda/mu;
  const rho = lambda/(c*mu);
  if (rho >= 1) return {stable:false, rho, L:Infinity, Lq:Infinity, W:Infinity, Wq:Infinity, P0:0, Pw:1};
  // P0
  let sum = 0;
  for(let n=0;n<c;n++){ sum += Math.pow(a,n)/fact(n); }
  const term = Math.pow(a,c)/fact(c) * (1/(1-rho));
  const P0 = 1 / (sum + term);
  //
  const Pw = (Math.pow(a,c)/fact(c)) * (1/(1-rho)) * P0;
  // C
  const Lq = Pw * a / (c - a);
  const L = Lq + a;
  const Wq = Lq / lambda;
  const W = Wq + 1/mu;
  return {stable:true, rho, L, Lq, W, Wq, P0, Pw};
}

function fact(n){let r=1; for(let i=2;i<=n;i++) r*=i; return r;}

// (c servers) 
function simulate(lambda, mu, c, T, warmup, seed){
  const rng = mulberry32(seed|0);
  let t = 0;
  let nextArrival = expRV(rng, lambda);
  const serverBusyUntil = Array(c).fill(Infinity);
  let queue = [];
  let inSystem = 0;
  let served = 0, waitedSum = 0, systemSum = 0, areaQ = 0, areaS = 0, lastT = 0, busyTime = 0;

  const series = []; // [time, queueLength]

  function sample(){ series.push([t, queue.length]); }

  while (t < T){

    let soonest = Infinity, sIdx = -1;
    for (let i=0;i<c;i++){
      if (serverBusyUntil[i] < soonest) { soonest = serverBusyUntil[i]; sIdx = i; }
    }
    if (nextArrival <= soonest){
 
      areaQ += queue.length * (nextArrival - lastT);
      areaS += inSystem * (nextArrival - lastT);
      if (inSystem < c){
      
        for (let i=0;i<c;i++) if (!Number.isFinite(serverBusyUntil[i])) {}
        // 
        let idle = serverBusyUntil.findIndex(x => !Number.isFinite(x) || x<=t);
        if (idle === -1) idle = serverBusyUntil.findIndex(x => x === Infinity);
        if (idle === -1) idle = 0;
        const st = expRV(rng, mu);
        if (t >= warmup) busyTime += st;
        serverBusyUntil[idle] = nextArrival + st;
        if (nextArrival >= warmup){ waitedSum += 0; systemSum += st; served++; }
        inSystem++;
      } else {
        queue.push(nextArrival);
        inSystem++;
      }
      t = nextArrival; lastT = t; sample();
      nextArrival = t + expRV(rng, lambda);
    } else {
      
      areaQ += queue.length * (soonest - lastT);
      areaS += inSystem * (soonest - lastT);
      t = soonest; lastT = t;
      if (queue.length > 0){
        const arrivalTime = queue.shift();
        const wait = t - arrivalTime;
        const st = expRV(rng, mu);
        if (t >= warmup){ waitedSum += wait; systemSum += wait + st; served++; busyTime += st; }
        serverBusyUntil[sIdx] = t + st;
      } else {
        serverBusyUntil[sIdx] = Infinity;
        inSystem--;
      }
      sample();
    }
  }
  const effTime = Math.max(0, T - warmup);
  const Lq = areaQ / effTime;
  const Wq = served>0 ? waitedSum / served : NaN;
  const W  = served>0 ? systemSum / served : NaN;
  const L  = areaS / effTime;
  const util = (busyTime / (effTime * c));
  return { L, Lq, W, Wq, util, served, series };
}

// 
function lineChartSVG(series, width=520, height=200, pad=30){
  if (!series || series.length<2) return "<div class='chart'></div>";
  const xs = series.map(p=>p[0]), ys = series.map(p=>p[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const xscale = x => pad + (x - xmin) / (xmax - xmin) * (width - 2*pad);
  const yscale = y => height - pad - (y - ymin) / (Math.max(1e-9, ymax - ymin)) * (height - 2*pad);
  let d = "";
  series.forEach((p, i) => { const x=xscale(p[0]), y=yscale(p[1]); d += (i? "L":"M") + x + " " + y + " "; });
  const axes = `<line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}" stroke="#35507f"/>
               <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height-pad}" stroke="#35507f"/>`;
  return `<svg width="${width}" height="${height}">
    ${axes}
    <path d="${d}" fill="none" stroke="#5b8cff" stroke-width="2" />
  </svg>`;
}

function gaugeSVG(value, width=220, height=180){
  const v = Math.max(0, Math.min(1, value||0));
  const cx = width/2, cy = height*0.9, r = Math.min(width, height)*0.42;
  const start = Math.PI, end = 2*Math.PI;
 
  const ang = start + v*(end-start);
  const nx = cx + r*Math.cos(ang), ny = cy + r*Math.sin(ang);
  const color = v<0.7? "#25c08a" : v<0.9? "#ffb020" : "#ff5d5d";
  return `<svg width="${width}" height="${height}">
    <path d="M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}" fill="none" stroke="#35507f" stroke-width="10"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#eaf0ff"/>
    <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${color}" stroke-width="4"/>
    <text x="${cx}" y="${cy- r - 6}" fill="#eaf0ff" font-size="12" text-anchor="middle">ρ = ${nf(v,3)}</text>
  </svg>`;
}

// 
function colorScale(val, min, max){
  if (!Number.isFinite(val)) return "transparent";
  const t = Math.max(0, Math.min(1, (val - min) / (max - min + 1e-9)));
  const r = Math.round(255 * t);
  const g = Math.round(180 * (1 - t));
  const b = Math.round(80 * (1 - t));
  return `rgb(${r},${g},${b})`;
}

// 
function alertChip(text, type="warn"){ return `<span class="chip ${type}">${text}</span>` }

function renderAnalytic(){
  const lambda = +$("lambda").value, mu = +$("mu").value, c = +$("servers").value;
  const target = +$("rhoTarget").value || null;
  const alerts = [];
  let R;
  if (c === 1){
    R = mm1(lambda, mu);
  } else {
    R = mmc(lambda, mu, c);
  }
  if (!R.stable){
    alerts.push(alertChip("Sistem kararsız (ρ ≥ 1). Parametreleri düşür!", "danger"));
  } else {
    if (R.rho > 0.9) alerts.push(alertChip("Yüksek doluluk (ρ>0.9): Kuyruk patlayabilir.", "warn"));
    if (target && R.rho > target) alerts.push(alertChip(`Hedef ρ=${target} aşıldı.`, "warn"));
  }
  $("alerts").innerHTML = alerts.join(" ");
  $("analytic").innerHTML =
    metricBox("ρ (doluluk)", nf(R.rho)) +
    metricBox("L", nf(R.L)) +
    metricBox("Lq", nf(R.Lq)) +
    metricBox("W", nf(R.W)) +
    metricBox("Wq", nf(R.Wq)) +
    (R.P0!=null? metricBox("P0 (boş olas)", nf(R.P0)) : "") +
    (R.Pw!=null? metricBox("Pw (bekleme olas)", nf(R.Pw)) : "");
  return R;
}

function renderSim(){
  const lambda = +$("lambda").value, mu = +$("mu").value, c = +$("servers").value;
  const T = +$("simTime").value, warmup = +$("warmup").value, seed = +$("seed").value;
  const R = simulate(lambda, mu, c, T, warmup, seed);
  $("sim").innerHTML =
    metricBox("ρ̂ (sim)", nf(R.util)) +
    metricBox("L̂", nf(R.L)) +
    metricBox("Lq̂", nf(R.Lq)) +
    metricBox("Ŵ", nf(R.W)) +
    metricBox("Wq̂", nf(R.Wq)) +
    metricBox("Servis edilen", R.served);
  $("chartQueue").innerHTML = lineChartSVG(R.series);
  $("gaugeUtil").innerHTML = gaugeSVG(R.util);
  return R;
}

function renderCompare(A, S){
  if (!A || !S) { $("compare").innerHTML=""; return; }
  function delta(ana, sim){ if (!Number.isFinite(ana) || !Number.isFinite(sim)) return "—"; return nf( (sim-ana)/ana*100, 2)+"%"; }
  $("compare").innerHTML =
    metricBox("ρ kıyas", delta(A.rho, S.util)) +
    metricBox("L kıyas", delta(A.L, S.L)) +
    metricBox("Lq kıyas", delta(A.Lq, S.Lq)) +
    metricBox("W kıyas", delta(A.W, S.W)) +
    metricBox("Wq kıyas", delta(A.Wq, S.Wq));
}

function doBoth(){
  const A = renderAnalytic();
  const S = renderSim();
  renderCompare(A, S);
}

function clearAll(){
  $("analytic").innerHTML = "";
  $("sim").innerHTML = "";
  $("compare").innerHTML = "";
  $("chartQueue").innerHTML = "";
  $("gaugeUtil").innerHTML = "";
  $("alerts").innerHTML = "";
  $("heatmap").innerHTML = "";
}

// 
function computeHeatmap(){
  const lamMin = +$("hmLamMin").value, lamMax = +$("hmLamMax").value, lamStep = +$("hmLamStep").value;
  const muMin = +$("hmMuMin").value, muMax = +$("hmMuMax").value, muStep = +$("hmMuStep").value;
  const c = +$("hmC").value;
  const metric = $("hmMetric").value;
  const lambdas = []; for (let x=lamMin; x<=lamMax+1e-9; x+=lamStep) lambdas.push(+x.toFixed(6));
  const mus = []; for (let x=muMin; x<=muMax+1e-9; x+=muStep) mus.push(+x.toFixed(6));
  const vals = [];
  let min=Infinity, max=-Infinity;
  for (let i=0;i<mus.length;i++){
    const row=[];
    for (let j=0;j<lambdas.length;j++){
      const lam=lambdas[j], mu=mus[i];
      const R = (c===1)? mm1(lam, mu) : mmc(lam, mu, c);
      let v = R[metric];
      if (!R.stable) v = NaN;
      row.push(v);
      if (Number.isFinite(v)){ if (v<min) min=v; if (v>max) max=v; }
    }
    vals.push(row);
  }
  const gridCols = `repeat(${lambdas.length}, 1fr)`;
  let html = `<div class="hmgrid" style="grid-template-columns:${gridCols}">`;
  vals.forEach(row => row.forEach(v => {
    const color = Number.isFinite(v)? colorScale(v, min, max) : "transparent";
    html += `<div class="hmcell" style="background:${color}">${Number.isFinite(v)? nf(v,2) : "—"}</div>`;
  }));
  html += `</div>
    <div class="hmlegend">
      <span>Min</span><span class="legendbox" style="background:${colorScale(min,min,max)}"></span>
      <span>${nf(min,2)}</span>
      <span>→</span>
      <span class="legendbox" style="background:${colorScale(max,min,max)}"></span>
      <span>${nf(max,2)}</span>
    </div>`;
  $("heatmap").innerHTML = html;
}

// 
$("btnAnalytic").addEventListener("click", renderAnalytic);
$("btnSim").addEventListener("click", renderSim);
$("btnBoth").addEventListener("click", doBoth);
$("btnClear").addEventListener("click", clearAll);
$("btnHeatmap").addEventListener("click", computeHeatmap);


doBoth();
