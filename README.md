# M/M/1 – M/M/c Queue Simulator (QueueLab)

Lightweight **queueing theory lab**: Analytics (M/M/1 & M/M/c/Erlang-C) + **discrete-event simulation**, side-by-side comparison, time-series chart, utilization gauge, and λ–μ **heatmap**. Dark, minimal UI—no backend.

![Status](https://img.shields.io/badge/status-stable-25c08a) ![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features
- **Analytics**: ρ, L, Lq, W, Wq (+ M/M/c: P0, Pw)  
- **Simulation**: Exponential arrivals/services, warm-up, seed; metrics L̂, Lq̂, Ŵ, Wq̂, ρ̂  
- **Compare**: % deviation (simulation vs. analytics)  
- **Charts**: Queue length time–series (SVG), utilization **gauge**  
- **Heatmap**: λ–μ grid for L/Lq/W/Wq/ρ; marks unstable region (ρ≥1)  
- **Clean UI**: Two-column layout, minimal components, mobile friendly

## ✅ Math (checked)
- **M/M/1**:  
  ρ = λ/μ;  Lq = ρ²/(1−ρ);  L = ρ/(1−ρ);  W = 1/(μ−λ);  Wq = ρ/(μ−λ)
- **M/M/c (Erlang-C)**:  
  a = λ/μ,  ρ = λ/(cμ)  
  \- \(P_0\) via standard series + tail term  
  \- \(P_w = \frac{a^c}{c!\,(1-ρ)} P_0\)  
  \- **Lq = \(P_w \cdot \frac{a}{\,c-a\,}\)** (== \(P_w \cdot \frac{ρ}{1-ρ}\))  
  \- L = Lq + a;  Wq = Lq/λ;  W = Wq + 1/μ  
- **Simulation L**: time-average **area in system** (not an approximation)

## 🧩 Folder Structure
index.html # UI (two columns: left legend + compact heatmap)
style.css # Theme + components (card/grid/btn/metrics/gauge/heatmap)
app.js # Analytics + simulation + charts + heatmap
icon.png # Site icon


## 🚀 Run Locally
**Option A (VS Code – Live Server)**  
1. Open folder in VS Code  
2. Install “Live Server” extension  
3. Right-click `index.html` → **Open with Live Server**

**Option B (simple Python server)**
```bash
python -m http.server 8000
