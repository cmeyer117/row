// gym-weight-photos.js
// Weight tracker + composition estimate + progress photos, extracted from
// gym.html (phase 1 of the module split, see
// docs/superpowers/specs/2026-07-08-gym-html-module-split-weight-photos.md).
//
// Loaded as a plain (non-module) script between two halves of gym.html's
// original inline script. Reads shared state/DOM-helper/config values via
// window.__gym (set up by the first half) and exposes wtRender/
// photosRender/wtLoad/wtSetEntries/photosSetAll on window so the second
// half (specifically the remote-sync code) can still call them by name.

  // ============================================================
  // WEIGHT TRACKER + COMPOSITION ESTIMATE + PROGRESS PHOTOS
  // All persisted to localStorage:
  //   po_coach_weights : [{ dateKey:'YYYY-MM-DD', weight:Number }]
  //   po_coach_photos  : [{ id, dataUrl, dateKey, weight }]
  // ============================================================
  const WT_KEY = 'po_coach_weights';
  const PHOTO_KEY = 'po_coach_photos';

  function wtLoad() {
    try {
      const raw = localStorage.getItem(WT_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.sort((a,b) => a.dateKey.localeCompare(b.dateKey)) : [];
    } catch (e) { return []; }
  }
  function wtSave(arr) {
    try { localStorage.setItem(WT_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function wtDateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function wtParseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function wtSmoothPath(points) {
    if (!points.length) return '';
    if (points.length === 1) return 'M ' + points[0].x + ' ' + points[0].y;
    let d = 'M ' + points[0].x.toFixed(2) + ' ' + points[0].y.toFixed(2);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i-1], curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      d += ' Q ' + cx.toFixed(2) + ' ' + prev.y.toFixed(2) + ', ' + cx.toFixed(2) + ' ' + ((prev.y + curr.y)/2).toFixed(2);
      d += ' T ' + curr.x.toFixed(2) + ' ' + curr.y.toFixed(2);
    }
    return d;
  }

  let wtEntries = wtLoad();

  function wtSaveEntry(weight, dateKey) {
    const key = dateKey || wtDateKey(new Date());
    const existing = wtEntries.find(e => e.dateKey === key);
    if (existing) existing.weight = weight;
    else { wtEntries.push({ dateKey: key, weight }); wtEntries.sort((a,b) => a.dateKey.localeCompare(b.dateKey)); }
    wtSave(wtEntries);
    window.__gym.resetChipToToday('wtDateChip', 'wtDateInput');
    wtRender();
    if (window.__gym.$('wtHistList').style.display !== 'none') wtRenderHistory();
  }

  function wtRenderHistory() {
    const list = window.__gym.$('wtHistList');
    if (!list) return;
    const sorted = wtEntries.slice().reverse();
    if (!sorted.length) {
      list.innerHTML = '<div style="text-align:center;font-size:12px;color:var(--text-3);padding:12px">No entries yet.</div>';
      return;
    }
    const u = window.__gym.state.units;
    list.innerHTML = sorted.map((e, ri) => {
      const origIdx = wtEntries.length - 1 - ri;
      return '<div class="wt-hist-row">'
        + '<span class="wt-hist-date">' + window.__gym.fmtDateChipLabel(e.dateKey) + '</span>'
        + '<span class="wt-hist-val">' + e.weight.toFixed(1) + ' ' + u + '</span>'
        + '<button class="wt-hist-btn" data-wt-edit="' + origIdx + '" title="Edit">✎</button>'
        + '<button class="wt-hist-btn del" data-wt-del="' + origIdx + '" title="Delete">×</button>'
        + '</div>';
    }).join('');
    list.querySelectorAll('[data-wt-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.wtEdit, 10);
        const entry = wtEntries[idx];
        window.__gym.$('wtInput').value = entry.weight.toFixed(1);
        window.__gym.$('wtDateInput').value = entry.dateKey;
        window.__gym.$('wtDateChip').childNodes[0].textContent = window.__gym.fmtDateChipLabel(entry.dateKey);
        window.__gym.$('wtDateChip').classList.toggle('is-past', entry.dateKey !== window.__gym.getActiveDate());
        wtEntries.splice(idx, 1);
        wtSave(wtEntries);
        window.__gym.$('wtLocked').classList.add('hidden');
        window.__gym.$('wtInputRow').classList.remove('hidden');
        wtRender();
        wtRenderHistory();
        window.__gym.$('wtInput').focus(); window.__gym.$('wtInput').select();
      });
    });
    list.querySelectorAll('[data-wt-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Delete this entry?')) return;
        wtEntries.splice(parseInt(btn.dataset.wtDel, 10), 1);
        wtSave(wtEntries);
        wtRender();
        wtRenderHistory();
      });
    });
  }

  function wtRender() {
    const last = wtEntries[wtEntries.length - 1] || null;
    const todayKey = wtDateKey(new Date());
    const todayEntry = wtEntries.find(e => e.dateKey === todayKey);
    const u = window.__gym.state.units;

    // Sync unit labels everywhere
    window.__gym.$('wtUnit').textContent = u;
    window.__gym.$('wtUnitStatic').textContent = u;
    window.__gym.$('wtNum').textContent = last ? last.weight.toFixed(1) : '—';

    // Locked vs input
    if (todayEntry) {
      window.__gym.$('wtEmpty').classList.add('hidden');
      window.__gym.$('wtLockedValue').textContent = todayEntry.weight.toFixed(1) + ' ' + u;
      window.__gym.$('wtLocked').classList.remove('hidden');
      window.__gym.$('wtInputRow').classList.add('hidden');
    } else {
      if (wtEntries.length === 0) window.__gym.$('wtEmpty').classList.remove('hidden');
      else window.__gym.$('wtEmpty').classList.add('hidden');
      window.__gym.$('wtLocked').classList.add('hidden');
      window.__gym.$('wtInputRow').classList.remove('hidden');
      if (last && !window.__gym.$('wtInput').value) window.__gym.$('wtInput').value = last.weight.toFixed(1);
    }

    // Chart, delta, composition need 2+ entries
    if (wtEntries.length >= 2) {
      window.__gym.$('wtChartWrap').classList.remove('hidden');
      window.__gym.$('wtLegend').classList.remove('hidden');
      wtRenderChart();
      wtRenderDelta();
      wtRenderComposition();
    } else {
      window.__gym.$('wtChartWrap').classList.add('hidden');
      window.__gym.$('wtLegend').classList.add('hidden');
      window.__gym.$('wtDelta').classList.add('hidden');
      window.__gym.$('wtComp').classList.add('hidden');
    }
    wtRenderStreak();
  }

  // Streak — consecutive days ending at today (or yesterday if today
  // hasn't been logged yet) with at least one weight entry.
  function wtRenderStreak() {
    const el = window.__gym.$('wtStreak');
    let streak = 0;
    let cursor = new Date(new Date());
    if (!wtEntries.find(e => e.dateKey === wtDateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (wtEntries.find(e => e.dateKey === wtDateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    if (streak >= 2) {
      window.__gym.$('wtStreakNum').textContent = streak + ' day streak';
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  function wtRenderChart() {
    const recent = wtEntries.slice(-30);
    const weights = recent.map(e => e.weight);
    const min = Math.min.apply(null, weights);
    const max = Math.max.apply(null, weights);
    const pad = Math.max((max - min) * 0.15, 0.5);
    const yMin = min - pad, yMax = max + pad;
    const xLeft = 8, xRight = 312, yTop = 20, yBot = 110;
    const xRange = xRight - xLeft, yRange = yBot - yTop;
    const xFor = (i) => recent.length === 1 ? xRight : xLeft + (i / (recent.length - 1)) * xRange;
    const yFor = (w) => yBot - ((w - yMin) / (yMax - yMin)) * yRange;
    const points = recent.map((e, i) => ({ x: xFor(i), y: yFor(e.weight) }));
    const linePath = wtSmoothPath(points);
    const areaPath = linePath + ' L ' + points[points.length - 1].x.toFixed(2) + ' ' + yBot + ' L ' + points[0].x.toFixed(2) + ' ' + yBot + ' Z';
    // 7d moving avg
    const avgPoints = recent.map((_, i) => {
      const start = Math.max(0, i - 6);
      const win = recent.slice(start, i + 1);
      const avg = win.reduce((s, p) => s + p.weight, 0) / win.length;
      return { x: xFor(i), y: yFor(avg) };
    });
    const avgPath = wtSmoothPath(avgPoints);
    let html = '<path class="wt-avg-line" d="' + avgPath + '"></path>'
             + '<path class="wt-area" d="' + areaPath + '"></path>'
             + '<path class="wt-line" filter="url(#wtGlow)" d="' + linePath + '"></path>';
    points.forEach((p, i) => {
      const cls = (i === points.length - 1) ? 'wt-dot-today' : 'wt-dot';
      const r = (i === points.length - 1) ? 5 : 3;
      html += '<circle class="' + cls + '" cx="' + p.x.toFixed(2) + '" cy="' + p.y.toFixed(2) + '" r="' + r + '"/>';
    });
    window.__gym.$('wtChartContent').innerHTML = html;
    window.__gym.$('wtYAxisMax').textContent = yMax.toFixed(1);
    window.__gym.$('wtYAxisMin').textContent = yMin.toFixed(1);
    window.__gym.$('wtMeta').textContent = wtEntries.length + ' ' + (wtEntries.length === 1 ? 'entry' : 'entries') + ' · last ' + recent.length + ' days';
  }

  function wtRenderDelta() {
    const last = wtEntries[wtEntries.length - 1];
    const lastDate = wtParseKey(last.dateKey);
    const cutoff = new Date(lastDate); cutoff.setDate(cutoff.getDate() - 7);
    const baseline = wtEntries.find(e => wtParseKey(e.dateKey) >= cutoff) || wtEntries[0];
    const diff = last.weight - baseline.weight;
    const el = window.__gym.$('wtDelta');
    if (Math.abs(diff) < 0.05) { el.classList.add('hidden'); return; }
    const arrow = diff > 0 ? '↑' : '↓';
    const sign = diff > 0 ? '+' : '−';
    el.textContent = arrow + ' ' + sign + Math.abs(diff).toFixed(1) + ' ' + window.__gym.state.units + ' · last 7d';
    el.classList.toggle('up',   diff > 0);
    el.classList.toggle('down', diff < 0);
    el.classList.remove('hidden');
  }

  // ============================================================
  // COMPOSITION ESTIMATE — muscle vs fat from weight + strength trend
  //
  // Math:
  //   weightDelta   = current weight − weight ~30 days ago
  //   strengthDelta = avg of (current 1RM / 1RM 30 days ago across all
  //                   exercises with logs in BOTH windows)
  //   yearsTraining → max muscle gain rate per week:
  //     1y → 0.45 kg, 2y → 0.23 kg, 3y+ → 0.11 kg (Lyle McDonald's
  //     model — cited intermediate intermediate values are real ceilings)
  //   estimated muscle gain = max muscle rate × weeks × (1 + strengthDelta)
  //                           clipped to [0, weightDelta]
  //   estimated fat gain    = weightDelta − estimated muscle gain
  //
  // If you LOSE weight: any positive strength delta means you're keeping
  // (or building) muscle, so the loss is mostly fat.
  // ============================================================
  function wtRenderComposition() {
    const compEl = window.__gym.$('wtComp');
    if (!window.__gym.CONFIG.composition || !window.__gym.CONFIG.composition.enabled) {
      compEl.classList.add('hidden'); return;
    }
    const windowDays = window.__gym.CONFIG.composition.windowDays || 30;
    if (wtEntries.length < 2) { compEl.classList.add('hidden'); return; }

    const now = wtParseKey(wtEntries[wtEntries.length - 1].dateKey);
    const start = new Date(now); start.setDate(start.getDate() - windowDays);

    // Find weight at start of window (closest entry on or after start)
    const startEntry = wtEntries.find(e => wtParseKey(e.dateKey) >= start);
    const endEntry = wtEntries[wtEntries.length - 1];
    if (!startEntry || startEntry === endEntry) { compEl.classList.add('hidden'); return; }
    const weightDelta = endEntry.weight - startEntry.weight;
    const actualDays = Math.max(1, Math.round((wtParseKey(endEntry.dateKey) - wtParseKey(startEntry.dateKey)) / 86400000));
    const weeks = actualDays / 7;

    // Strength delta — for each exercise, take the AVG 1RM of logs inside
    // the window vs AVG of logs of equal count just before the window.
    let strengthRatios = [];
    let workoutDays = new Set();
    let totalVolumeInWindow = 0;
    window.__gym.state.exercises.forEach(ex => {
      const logs = (window.__gym.state.logs[ex.id] || []).slice();
      if (logs.length < 2 || ex.bw) {
        // Still count volume / sessions even for bodyweight + sparse exercises
        logs.forEach(l => {
          if (new Date(l.date) >= start) {
            workoutDays.add(l.date.slice(0, 10));
            totalVolumeInWindow += (l.weight || 0) * (l.reps || 0);
          }
        });
        return;
      }
      const inWin  = logs.filter(l => new Date(l.date) >= start);
      const before = logs.filter(l => new Date(l.date) < start);
      inWin.forEach(l => {
        workoutDays.add(l.date.slice(0, 10));
        totalVolumeInWindow += (l.weight || 0) * (l.reps || 0);
      });
      if (!inWin.length || !before.length) return;
      const avg = arr => arr.reduce((s, l) => s + estimate1RM(l.weight, l.reps), 0) / arr.length;
      const a = avg(before), b = avg(inWin);
      if (a <= 0) return;
      strengthRatios.push(b / a);
    });
    const strengthDelta = strengthRatios.length
      ? (strengthRatios.reduce((s, r) => s + r, 0) / strengthRatios.length) - 1
      : 0;
    // Frequency factor: 4+ training days/week = full credit, fewer = penalty.
    // Volume factor: moderate cap so a single huge day doesn't game the score.
    const sessionsPerWeek = (workoutDays.size / actualDays) * 7;
    const frequencyFactor = Math.max(0.4, Math.min(1.2, sessionsPerWeek / 4));

    // Max muscle gain rate per week (kg). Convert to lb if user's units are lb.
    const yt = window.__gym.CONFIG.composition.yearsTraining || 1;
    let maxMuscleKgPerWeek;
    if (yt <= 1) maxMuscleKgPerWeek = 0.45;
    else if (yt === 2) maxMuscleKgPerWeek = 0.23;
    else maxMuscleKgPerWeek = 0.11;
    const unitConv = (window.__gym.state.units === 'lb') ? 2.20462 : 1;
    const maxMusclePerWeek = maxMuscleKgPerWeek * unitConv;

    // Estimated muscle: scale by strength gain (capped between 0.5x and 1.5x)
    // AND by training frequency (you can't build muscle you didn't stimulate).
    const strengthBoost = Math.max(0.5, Math.min(1.5, 1 + strengthDelta * 4));
    let estMuscle = maxMusclePerWeek * weeks * strengthBoost * frequencyFactor;

    let estFat;
    let headlineCls = '';
    let headline = '';
    if (weightDelta > 0) {
      // Surplus: split between muscle and fat. Cap muscle at the weight gained.
      estMuscle = Math.min(estMuscle, weightDelta);
      estFat = Math.max(0, weightDelta - estMuscle);
      const musclePct = estMuscle / weightDelta;
      if (musclePct >= 0.6 && strengthDelta > 0) {
        headlineCls = 'good';
        headline = '+' + weightDelta.toFixed(1) + ' ' + window.__gym.state.units + ' — mostly muscle, strength up.';
      } else if (musclePct >= 0.35) {
        headlineCls = 'warn';
        headline = '+' + weightDelta.toFixed(1) + ' ' + window.__gym.state.units + ' — mixed. Tighten kcal or push lifts harder.';
      } else {
        headlineCls = 'bad';
        headline = '+' + weightDelta.toFixed(1) + ' ' + window.__gym.state.units + ' — mostly fat. Strength flat. Cut kcal.';
      }
    } else {
      // Deficit: assume fat first, only credit muscle loss if strength dropped.
      const wDown = Math.abs(weightDelta);
      if (strengthDelta >= 0) {
        // Strength preserved or up → all fat lost, slight muscle gain
        estMuscle = Math.min(maxMusclePerWeek * weeks * 0.3, 0.5);
        estFat = -(wDown + estMuscle);
        headlineCls = 'good';
        headline = '−' + wDown.toFixed(1) + ' ' + window.__gym.state.units + ' — strength holding, fat dropping.';
      } else {
        // Strength dropped → some muscle loss
        const lossPct = Math.min(0.4, Math.abs(strengthDelta) * 2);
        estMuscle = -wDown * lossPct;
        estFat = -(wDown + estMuscle);
        headlineCls = 'warn';
        headline = '−' + wDown.toFixed(1) + ' ' + window.__gym.state.units + ' — strength slipping. You may be losing muscle.';
      }
    }

    // Render
    compEl.classList.remove('hidden');
    window.__gym.$('wtCompWindow').textContent = 'last ' + actualDays + 'd';
    const headlineEl = window.__gym.$('wtCompHeadline');
    headlineEl.textContent = headline;
    headlineEl.className = 'wt-comp-headline ' + headlineCls;

    // Bars
    const totalAbs = Math.abs(estMuscle) + Math.abs(estFat) || 1;
    const musclePct = (Math.abs(estMuscle) / totalAbs) * 100;
    const fatPct = (Math.abs(estFat) / totalAbs) * 100;
    window.__gym.$('wtCompBars').innerHTML =
      '<div class="wt-comp-bar muscle" style="width:' + musclePct.toFixed(1) + '%"></div>' +
      '<div class="wt-comp-bar fat" style="width:' + fatPct.toFixed(1) + '%"></div>';

    // Foot line — strength + training frequency (so you can see why the
    // muscle estimate is what it is).
    const sd = strengthDelta * 100;
    const sdStr = (sd >= 0 ? '+' : '') + sd.toFixed(1) + '%';
    const muscleSign = estMuscle >= 0 ? '+' : '';
    const fatSign = estFat >= 0 ? '+' : '';
    const freqStr = sessionsPerWeek.toFixed(1) + ' sessions/wk';
    window.__gym.$('wtCompFoot').textContent =
      '~' + muscleSign + estMuscle.toFixed(1) + ' ' + window.__gym.state.units + ' muscle · '
      + '~' + fatSign + estFat.toFixed(1) + ' ' + window.__gym.state.units + ' fat · '
      + 'strength ' + sdStr
      + ' · ' + freqStr
      + (strengthRatios.length ? '' : ' (no lift data)');
  }

  // Wire weight UI
  window.__gym.initDateChip('wtDateChip', 'wtDateInput');
  window.__gym.$('wtSaveBtn').addEventListener('click', () => {
    const v = parseFloat(window.__gym.$('wtInput').value);
    if (isNaN(v) || v <= 0) return;
    wtSaveEntry(v, window.__gym.getChipDate('wtDateInput'));
  });
  window.__gym.$('wtInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.__gym.$('wtSaveBtn').click();
  });
  window.__gym.$('wtEditBtn').addEventListener('click', () => {
    window.__gym.$('wtLocked').classList.add('hidden');
    window.__gym.$('wtInputRow').classList.remove('hidden');
    window.__gym.resetChipToToday('wtDateChip', 'wtDateInput');
    const todayEntry = wtEntries.find(e => e.dateKey === wtDateKey(new Date()));
    if (todayEntry) window.__gym.$('wtInput').value = todayEntry.weight.toFixed(1);
    window.__gym.$('wtInput').focus(); window.__gym.$('wtInput').select();
  });
  window.__gym.$('wtHistToggle').addEventListener('click', () => {
    const list = window.__gym.$('wtHistList');
    const open = list.style.display !== 'none';
    list.style.display = open ? 'none' : 'flex';
    if (!open) { list.style.flexDirection = 'column'; wtRenderHistory(); }
    window.__gym.$('wtHistToggle').textContent = open ? 'Weight history ▾' : 'Weight history ▴';
  });

  // ============================================================
  // PROGRESS PHOTOS
  // ============================================================
  let photos = [];
  try {
    const raw = localStorage.getItem(PHOTO_KEY);
    if (raw) photos = JSON.parse(raw);
  } catch (e) { photos = []; }

  function photosSave() {
    try {
      localStorage.setItem(PHOTO_KEY, JSON.stringify(photos));
      return true;
    } catch (e) {
      return false;
    }
  }
  // Downscale a dataURL to a max longest-side dimension and re-encode as
  // JPEG. Phone camera photos are often 2–5MB which blows the ~5MB
  // localStorage quota after one or two saves. Compressing to ~1080px /
  // q=0.75 typically drops each photo to <100KB.
  function compressPhotoDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1080;
    quality = quality == null ? 0.75 : quality;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
          else { w = Math.round(w * (maxDim / h)); h = maxDim; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try { resolve(c.toDataURL('image/jpeg', quality)); }
        catch { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }
  async function uploadPhotoToStorage(dataUrl) {
    if (!window.__gym.pcSupa) return null;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const filename = 'photo_' + Date.now() + '_' +
        Math.random().toString(36).slice(2, 10) + '.jpg';
      const { error } = await window.__gym.pcSupa.storage
        .from('progress-photos')
        .upload(filename, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) return null;
      const { data } = window.__gym.pcSupa.storage.from('progress-photos').getPublicUrl(filename);
      return data ? data.publicUrl : null;
    } catch (e) { return null; }
  }

  function photoFmtDate(key) {
    const d = wtParseKey(key);
    const mons = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return mons[d.getMonth()] + ' ' + d.getDate();
  }
  function photoCurrentWeight() {
    const last = wtEntries[wtEntries.length - 1];
    return last ? (last.weight.toFixed(1) + ' ' + window.__gym.state.units) : '—';
  }
  function photosRender() {
    const grid = window.__gym.$('wtPhotoGrid');
    if (!photos.length) {
      grid.innerHTML = '<div class="wt-photo-empty">No photos yet · tap Take Photo to start</div>';
    } else {
      grid.innerHTML = photos.map(p =>
        '<button class="wt-photo-card" data-id="' + p.id + '" type="button">' +
          '<img src="' + (p.url || p.dataUrl) + '" alt="">' +
          '<div class="wt-photo-overlay"></div>' +
          '<div class="wt-photo-meta">' +
            '<span class="wt-photo-date">' + photoFmtDate(p.dateKey) + '</span>' +
            '<span class="wt-photo-weight">' + (p.weight || '—') + '</span>' +
          '</div>' +
        '</button>'
      ).join('');
      grid.querySelectorAll('.wt-photo-card').forEach(card => {
        card.addEventListener('click', () => openPhoto(card.dataset.id));
      });
    }
    // Update count on the link
    if (!photos.length) window.__gym.$('wtProgressCount').textContent = '0 photos';
    else if (photos.length === 1) window.__gym.$('wtProgressCount').textContent = '1 photo · latest ' + photoFmtDate(photos[0].dateKey);
    else window.__gym.$('wtProgressCount').textContent = photos.length + ' photos · latest ' + photoFmtDate(photos[0].dateKey);
  }
  async function photosAdd(dataUrl) {
    let compressed = dataUrl;
    try { compressed = await compressPhotoDataUrl(dataUrl); } catch {}
    const id = 'p' + Date.now() + '_' + Math.floor(Math.random() * 999);
    const entry = {
      id,
      dataUrl: compressed,
      dateKey: wtDateKey(new Date()),
      weight: photoCurrentWeight()
    };
    photos.unshift(entry);
    if (!photosSave()) {
      // Storage was full even after compression — try once more at lower
      // quality before giving up.
      try {
        entry.dataUrl = await compressPhotoDataUrl(dataUrl, 800, 0.6);
      } catch {}
      if (!photosSave()) {
        photos.shift();
        alert('Phone storage is full — delete some older progress photos before adding a new one.');
        return;
      }
    }
    photosRender();
    uploadPhotoToStorage(entry.dataUrl).then((url) => {
      if (!url) return;
      const e = photos.find(p => p.id === id);
      if (!e) return;
      e.url = url;
      delete e.dataUrl;
      photosSave();
      photosRender();
    });
  }
  function fileToPhoto(file) {
    const r = new FileReader();
    r.onload = (e) => photosAdd(e.target.result);
    r.readAsDataURL(file);
  }

  window.__gym.$('wtProgressLink').addEventListener('click', () => {
    photosRender();
    window.__gym.$('wtOverlay').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  });
  window.__gym.$('wtBack').addEventListener('click', () => {
    window.__gym.$('wtOverlay').classList.remove('is-open');
    document.body.style.overflow = '';
  });

  // Take Photo: try in-browser camera, fall back to file input
  let camStream = null;
  let camFacing = 'environment';
  async function openCam() {
    window.__gym.$('wtCam').classList.add('is-open');
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: camFacing } }, audio: false
      });
      window.__gym.$('wtCamVideo').srcObject = camStream;
    } catch (e) {
      try {
        camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        window.__gym.$('wtCamVideo').srcObject = camStream;
      } catch (e2) {
        closeCam();
        alert('Camera unavailable. Use "From Library" instead.');
        throw e2;
      }
    }
  }
  function closeCam() {
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
    window.__gym.$('wtCamVideo').srcObject = null;
    window.__gym.$('wtCam').classList.remove('is-open');
  }
  window.__gym.$('wtTakePhotoBtn').addEventListener('click', async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try { await openCam(); return; } catch (e) {}
    }
    window.__gym.$('wtFileCamera').click();
  });
  window.__gym.$('wtFileCamera').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) fileToPhoto(f);
    e.target.value = '';
  });
  window.__gym.$('wtFromLibraryBtn').addEventListener('click', () => window.__gym.$('wtFileLibrary').click());
  window.__gym.$('wtFileLibrary').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) fileToPhoto(f);
    e.target.value = '';
  });
  window.__gym.$('wtCamCancel').addEventListener('click', closeCam);
  window.__gym.$('wtCamFlip').addEventListener('click', async () => {
    camFacing = camFacing === 'environment' ? 'user' : 'environment';
    if (camStream) camStream.getTracks().forEach(t => t.stop());
    try { await openCam(); } catch (e) {}
  });
  window.__gym.$('wtCamShutter').addEventListener('click', () => {
    const video = window.__gym.$('wtCamVideo'), canvas = window.__gym.$('wtCamCanvas');
    if (!video.videoWidth) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    closeCam();
    photosAdd(dataUrl);
  });

  // Photo viewer
  let activePhotoId = null;
  let comparePhotoId = null;       // the OTHER photo being compared to
  let pvDeleteConfirm = false;
  function openPhoto(id) {
    const p = photos.find(x => x.id === id);
    if (!p) return;
    activePhotoId = id;
    window.__gym.$('wtViewerImg').src = p.url || p.dataUrl;
    window.__gym.$('wtViewerDate').textContent = photoFmtDate(p.dateKey).toUpperCase();
    window.__gym.$('wtViewerWeight').textContent = p.weight || '—';
    window.__gym.$('wtViewer').dataset.mode = 'single';
    window.__gym.$('wtViewer').classList.add('is-open');
    pvDeleteConfirm = false;
    window.__gym.$('wtViewerDelete').textContent = 'Delete';
    window.__gym.$('wtViewerDelete').classList.remove('is-confirm');
    // Disable Compare button if there's no other photo to compare against
    window.__gym.$('wtViewerCompare').disabled = photos.length < 2;
    window.__gym.$('wtViewerCompare').style.opacity = photos.length < 2 ? '0.4' : '';
  }
  function closePhoto() {
    window.__gym.$('wtViewer').classList.remove('is-open');
    window.__gym.$('wtViewer').dataset.mode = 'single';
    activePhotoId = null;
    comparePhotoId = null;
  }

  // Pull a number out of "162.0 lbs" / "73.5 kg" / "—"
  function parseWeightStr(w) {
    if (!w) return null;
    const m = String(w).match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  // Format a delta with arrow + sign
  function fmtDelta(diff, units) {
    if (diff == null) return '';
    if (Math.abs(diff) < 0.05) return '· no change';
    const sign = diff > 0 ? '+' : '−';
    return '· ' + sign + Math.abs(diff).toFixed(1) + ' ' + units;
  }

  // Pick the "compare to" photo for a given active id. Default: the most
  // recent photo BEFORE the active one (older → time-progress comparison).
  // Falls back to the most recent newer photo if active is the oldest.
  function defaultCompareFor(activeId) {
    const idx = photos.findIndex(p => p.id === activeId);
    if (idx === -1) return null;
    if (photos[idx + 1]) return photos[idx + 1].id;        // photos are stored newest-first
    if (photos[idx - 1]) return photos[idx - 1].id;
    return null;
  }

  function openCompare(activeId, otherId) {
    const A = photos.find(p => p.id === activeId);
    const B = photos.find(p => p.id === otherId);
    if (!A || !B) return;
    activePhotoId = activeId;
    comparePhotoId = otherId;
    window.__gym.$('wtCmpImgA').src = A.url || A.dataUrl;
    window.__gym.$('wtCmpImgB').src = B.url || B.dataUrl;
    window.__gym.$('wtCmpMetaA').textContent = photoFmtDate(A.dateKey) + ' · ' + (A.weight || '—');
    window.__gym.$('wtCmpMetaB').textContent = photoFmtDate(B.dateKey) + ' · ' + (B.weight || '—');
    // Headline — date arrow + weight delta
    const wA = parseWeightStr(A.weight);
    const wB = parseWeightStr(B.weight);
    const headEl = window.__gym.$('wtCompareHeadline');
    let cls = 'flat', headline = photoFmtDate(A.dateKey) + ' → ' + photoFmtDate(B.dateKey);
    if (wA != null && wB != null) {
      const diff = wA - wB; // active vs comparison
      headline += ' ' + fmtDelta(diff, window.__gym.state.units);
      if (Math.abs(diff) < 0.05) cls = 'flat';
      else if (diff > 0) cls = 'up';
      else cls = 'down';
    }
    headEl.textContent = headline;
    headEl.className = 'wt-compare-headline ' + cls;
    window.__gym.$('wtViewer').dataset.mode = 'compare';
    window.__gym.$('wtViewer').classList.add('is-open');
    pvDeleteConfirm = false;
    window.__gym.$('wtCompareDelete').textContent = 'Delete';
    window.__gym.$('wtCompareDelete').classList.remove('is-confirm');
  }

  function cycleCompareTarget() {
    if (!activePhotoId) return;
    const others = photos.filter(p => p.id !== activePhotoId);
    if (!others.length) return;
    const curIdx = others.findIndex(p => p.id === comparePhotoId);
    const nextIdx = (curIdx + 1) % others.length;
    openCompare(activePhotoId, others[nextIdx].id);
  }

  function deleteActivePhoto(deleteBtn) {
    if (!activePhotoId) return;
    if (!pvDeleteConfirm) {
      pvDeleteConfirm = true;
      deleteBtn.textContent = 'Confirm delete?';
      deleteBtn.classList.add('is-confirm');
      setTimeout(() => {
        pvDeleteConfirm = false;
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.remove('is-confirm');
      }, 3000);
      return;
    }
    photos = photos.filter(p => p.id !== activePhotoId);
    photosSave();
    photosRender();
    closePhoto();
  }

  window.__gym.$('wtViewerClose').addEventListener('click', closePhoto);
  window.__gym.$('wtCompareClose').addEventListener('click', closePhoto);
  window.__gym.$('wtViewerDelete').addEventListener('click', () => deleteActivePhoto(window.__gym.$('wtViewerDelete')));
  window.__gym.$('wtCompareDelete').addEventListener('click', () => deleteActivePhoto(window.__gym.$('wtCompareDelete')));
  window.__gym.$('wtViewerCompare').addEventListener('click', () => {
    if (!activePhotoId) return;
    const otherId = defaultCompareFor(activePhotoId);
    if (!otherId) { alert('Need at least one other photo to compare.'); return; }
    openCompare(activePhotoId, otherId);
  });
  window.__gym.$('wtCompareBack').addEventListener('click', () => {
    if (activePhotoId) {
      window.__gym.$('wtViewer').dataset.mode = 'single';
    } else {
      closePhoto();
    }
  });
  // Tap the right-hand "other" photo to cycle through different comparison targets
  window.__gym.$('wtCmpSideB').addEventListener('click', cycleCompareTarget);


  // ---- Exposed for gym.html's remaining inline script (sync code) ----
  window.wtRender = wtRender;
  window.photosRender = photosRender;
  window.wtLoad = wtLoad;
  window.wtSetEntries = function (arr) { wtEntries = arr; };
  window.photosSetAll = function (arr) { photos = arr; };
  window.compressPhotoDataUrl = compressPhotoDataUrl;
  window.uploadPhotoToStorage = uploadPhotoToStorage;