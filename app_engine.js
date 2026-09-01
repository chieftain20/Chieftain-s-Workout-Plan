// --- Application State Management ---
let customExercises = [];
let allProfiles = [];
let activeProfileId = 'hossein_chieftain';
let activeDayForAdding = null;
let convertTargetDayIdx = null;
let convertTargetSingleIdx = null;
let pendingActionAfterPin = null;

// Currently active log target
let currentLogTarget = { exId: '', exFa: '', dayId: '', setsCount: 3 };

const WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'روز تمرینی ۱', 'روز تمرینی ۲', 'روز تمرینی ۳', 'روز تمرینی ۴'];

function loadAppData() {
  try {
    const rawCustEx = localStorage.getItem('chieftain_custom_exercises');
    if (rawCustEx) customExercises = JSON.parse(rawCustEx);
  } catch(e) { customExercises = []; }

  try {
    const rawProfiles = localStorage.getItem('chieftain_profiles_v8') || localStorage.getItem('chieftain_profiles_v7') || localStorage.getItem('chieftain_profiles_v6');
    if (rawProfiles) {
      allProfiles = JSON.parse(rawProfiles);
    } else {
      allProfiles = [];
    }
  } catch(e) {
    allProfiles = [];
  }

  // Ensure built-in profile Hossein Chieftain exists and has proper PIN & latest routine
  let hProf = allProfiles.find(p => p.id === 'hossein_chieftain');
  if (!hProf) {
    hProf = JSON.parse(JSON.stringify(HOSSEIN_PROFILE));
    hProf.pin = 'gym';
    allProfiles.unshift(hProf);
  } else {
    hProf.pin = 'gym';
    if (!localStorage.getItem('chieftain_profiles_v8')) {
      hProf.days = JSON.parse(JSON.stringify(HOSSEIN_PROFILE.days));
    }
  }

  // Ensure built-in profile Morvarid exists and has proper PIN
  let mProf = allProfiles.find(p => p.id === 'morvarid');
  if (!mProf) {
    mProf = JSON.parse(JSON.stringify(MORVARID_PROFILE));
    mProf.pin = 'inci';
    allProfiles.push(mProf);
  } else {
    mProf.name = 'مروارید';
    if (!mProf.pin) mProf.pin = 'inci';
    if (!localStorage.getItem('chieftain_profiles_v8') || !mProf.days || mProf.days.length === 0) {
      mProf.days = JSON.parse(JSON.stringify(MORVARID_PROFILE.days));
    }
  }

  saveProfiles();

  const savedActiveId = localStorage.getItem('chieftain_active_profile_id');
  if (savedActiveId && allProfiles.some(p => p.id === savedActiveId)) {
    activeProfileId = savedActiveId;
  } else {
    activeProfileId = 'hossein_chieftain';
  }
}

function saveProfiles() {
  localStorage.setItem('chieftain_profiles_v8', JSON.stringify(allProfiles));
  if (typeof pushToCloudStorage === 'function' && isAutoCloudSyncEnabled()) {
    pushToCloudStorage(true);
  }
}

function saveCustomExercises() {
  localStorage.setItem('chieftain_custom_exercises', JSON.stringify(customExercises));
}

function getAllExercises() {
  return [...MASTER_EXERCISES, ...customExercises];
}

function findExerciseById(id) {
  return getAllExercises().find(e => e.id === id) || {
    id: id,
    fa: id,
    en: '',
    muscles: 'عمومی',
    videos: [],
    defaultReps: '3 × 8–12',
    defaultSets: 3
  };
}

function getActiveProfile() {
  return allProfiles.find(p => p.id === activeProfileId) || HOSSEIN_PROFILE;
}

function parseSetsFromReps(repsStr, fallbackSets) {
  if (fallbackSets && fallbackSets > 0) return fallbackSets;
  if (!repsStr) return 3;
  const match = repsStr.match(/^(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    if (num > 0 && num <= 10) return num;
  }
  return 3;
}

// Toast Notification Engine
function showToast(message) {
  const toast = document.getElementById('toastMsg');
  const toastText = document.getElementById('toastText');
  if (!toast || !toastText) return;
  toastText.innerText = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- UI Rendering Engine ---
function renderApp(preserveScroll = true, targetCardExId = null) {
  const scrollY = (typeof preserveScroll === 'number') 
    ? preserveScroll 
    : (preserveScroll ? (window.scrollY || document.documentElement.scrollTop) : 0);

  renderProfileSelect();
  renderHeader();
  renderDayNav();
  renderWorkoutDays();
  loadSavedSets();
  updateAllProgressBars();
  setupSectionObserver();
  setupDragAndDropEngine();

  if (activeMainTab === 'metrics') {
    const workoutContent = document.getElementById('workoutContent');
    const metricsView = document.getElementById('bodyMetricsView');
    if (workoutContent) workoutContent.style.display = 'none';
    if (metricsView) {
      metricsView.style.display = 'block';
      renderBodyMetricsView();
    }
  }

  // If a specific card was edited/moved, keep it precisely in view
  if (targetCardExId) {
    const card = document.querySelector(`[data-ex-id="${targetCardExId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'instant', block: 'center' });
      card.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
      card.style.borderColor = '#00f2fe';
      card.style.boxShadow = '0 0 20px rgba(0,242,254,0.4)';
      setTimeout(() => {
        card.style.borderColor = '';
        card.style.boxShadow = '';
      }, 1200);
      return;
    }
  }

  // Preserve exact scroll position
  if (preserveScroll && scrollY > 0) {
    window.scrollTo({ top: scrollY, behavior: 'instant' });
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'instant' });
    });
  }
}

function renderProfileSelect() {
  const select = document.getElementById('profileSelect');
  if (!select) return;
  select.innerHTML = allProfiles.map(p => {
    const badge = (p.id === 'hossein_chieftain') ? ' (پیش‌فرض)' : '';
    return `<option value="${p.id}" ${p.id === activeProfileId ? 'selected' : ''}>${p.name}${badge}</option>`;
  }).join('');
}

function renderHeader() {
  const prof = getActiveProfile();
  const titleEl = document.getElementById('appTitle');
  titleEl.innerText = 'برنامه تمرینی ' + prof.name;

  const deleteBtn = document.getElementById('deleteProfileBtn');
  if (deleteBtn) {
    deleteBtn.style.display = prof.isDefault ? 'none' : 'inline-flex';
  }

  // Dynamic Badges in Header
  const badgesEl = document.getElementById('headerBadges');
  if (badgesEl) {
    const gymDays = prof.days.filter(d => d.type === 'gym').map(d => d.title).join('، ');
    const homeDays = prof.days.filter(d => d.type === 'home').map(d => d.title).join('، ');
    const restDays = prof.days.filter(d => d.type === 'rest').map(d => d.title).join('، ');

    let html = '';
    if (gymDays) html += `<div class="header-badge">🏋️ ${gymDays}: باشگاه</div>`;
    if (homeDays) html += `<div class="header-badge">🏠 ${homeDays}: خانه</div>`;
    if (restDays) html += `<div class="header-badge">🛌 ${restDays}: استراحت</div>`;
    badgesEl.innerHTML = html;
  }

  updateGreetingText();
}

function updateGreetingText() {
  const prof = getActiveProfile();
  const greetingEl = document.getElementById('greetingText');
  if (!greetingEl) return;

  const todaySecId = getTodaySectionId();
  const todaySec = document.getElementById(todaySecId);
  let isToday100 = false;
  if (todaySec) {
    const btns = todaySec.querySelectorAll('.set-btn');
    const doneBtns = todaySec.querySelectorAll('.set-btn.done');
    if (btns.length > 0 && btns.length === doneBtns.length) {
      isToday100 = true;
    }
  }

  if (isToday100) {
    greetingEl.innerText = `🎉 دمت گرم ${prof.name}! تمرین امروز رو ۱۰۰٪ با موفقیت ترکوندی و تموم کردی! 🔥 عضلات در حال رشد و ریکاوری‌ان 💪`;
    return;
  }

  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    greetingEl.innerText = `صبح بخیر ${prof.name}! وقت انرژی و ساختن عضلاته ⚡`;
  } else if (hour >= 12 && hour < 18) {
    greetingEl.innerText = `عصر بخیر ${prof.name}! آماده یک جلسه تمرینی پرقدرت هستی؟ 💪`;
  } else {
    greetingEl.innerText = `شب بخیر ${prof.name}! ریکاوری و ثبات کلید موفقیته 🔥`;
  }
}

function renderDayNav() {
  const prof = getActiveProfile();
  const nav = document.getElementById('dayNav');
  if (!nav) return;
  
  const tabsHtml = prof.days.map((d, idx) => {
    const typeLabel = d.type === 'gym' ? 'باشگاه' : (d.type === 'home' ? 'خانه' : 'استراحت');
    return `
      <a href="javascript:void(0)" onclick="navigateToDaySection(event, '${d.id}')" class="nav-tab ${activeMainTab === 'workout' && idx === 0 ? 'active' : ''}" data-day="${idx}" data-target-id="${d.id}">
        <span>${d.title}</span>
        <span class="tab-badge">${typeLabel}</span>
        <span id="nav-pill-${d.id}" class="tab-prog-pill" style="display:none;">۰٪</span>
      </a>
    `;
  }).join('');

  const metricsBadge = `<span class="tab-badge" style="background:rgba(56,189,248,0.2); color:#38bdf8; font-weight:800;">آنالیز</span>`;
  const metricsTab = `<a href="javascript:void(0)" onclick="switchMainTab('metrics')" class="nav-tab ${activeMainTab === 'metrics' ? 'active' : ''}" data-target-id="body-metrics" style="border-color:rgba(56,189,248,0.4);"><span>📏 سایز و ابعاد</span>${metricsBadge}</a>`;

  nav.innerHTML = tabsHtml + `<a href="javascript:void(0)" onclick="navigateToDaySection(event, 'weekly-summary')" class="nav-tab" data-day="summary" data-target-id="weekly-summary">📊 جمع‌بندی</a>` + metricsTab;
}

function navigateToDaySection(e, secId) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const el = document.getElementById(secId);
  if (el) {
    const navBarHeight = 110;
    const pos = el.getBoundingClientRect().top + (window.scrollY || document.documentElement.scrollTop) - navBarHeight;
    window.scrollTo({ top: pos, behavior: 'smooth' });
  }
  if (window.location.hash && !window.location.hash.startsWith('#sync=')) {
    try {
      history.replaceState(null, null, window.location.pathname + window.location.search);
    } catch(err) {}
  }
}

function renderVideoButtons(videos) {
  if (!videos || videos.length === 0) {
    return `<span class="video-missing">آموزش متنی / بزودی</span>`;
  }

  return videos.map((v, i) => {
    if (v.isImage || (v.url && v.url.startsWith('data:image'))) {
      return `<button class="video-btn" onclick="openImageModal('${v.url}')" style="background:rgba(234,179,8,0.15); color:#facc15; border-color:rgba(234,179,8,0.35); cursor:pointer;">
        <span>🖼️</span> <span>${v.title || 'تصویر آموزش فرم'}</span>
      </button>`;
    }
    return `
      <a href="${v.url}" target="_blank" rel="noopener" class="video-btn">
        <span>▶</span> <span>${v.title || (videos.length === 1 ? 'ویدیو آموزش' : ('ویدیو ' + (i+1)))}</span>
      </a>
    `;
  }).join('');
}

function openImageModal(imgSrc) {
  const imgEl = document.getElementById('imageModalImg');
  if (imgEl) imgEl.src = imgSrc;
  document.getElementById('imageModal')?.classList.add('open');
}

function closeImageModal() {
  document.getElementById('imageModal')?.classList.remove('open');
}

function renderExerciseCard(item, dayId, isSuperset = false, singleIdx = -1, totalSingles = 0, ssIdx = -1, exIdx = -1, totalSSExercises = 0) {
  const ex = findExerciseById(item.exId);
  const reps = item.reps || ex.defaultReps || '3 × 8–12';
  const setsCount = parseSetsFromReps(reps, item.sets);
  const displayNameFa = item.customName ? item.customName : ex.fa;
  const originalSubtext = item.customName && item.customName !== ex.fa 
    ? `<div class="exercise-name-en" style="color:#94a3b8; font-size:11px;">حرکت پایه: ${ex.fa}</div>` 
    : (ex.en ? `<div class="exercise-name-en">${ex.en}</div>` : '');

  const setBtns = Array.from({length: setsCount}, (_, i) => 
    `<button class="set-btn" onclick="handleSetClick(this)">${i+1}</button>`
  ).join('');

  // Isometric Quick Button check (Only for true isometric holds, NOT rep-based variations)
  let isoBtnHtml = '';
  const lowerFa = ex.fa.toLowerCase();
  const lowerEn = (ex.en || '').toLowerCase();
  const isExcluded = lowerFa.includes('خرسی') || lowerFa.includes('پایک') || lowerFa.includes('کیک') || lowerEn.includes('bear') || lowerEn.includes('pike') || lowerEn.includes('kickback');
  const isIso = !isExcluded && (ex.isIsometric === true || ((lowerFa.includes('ایزومتریک') || lowerFa.includes('پلانک آرنج') || lowerFa.includes('ساید پلانک') || lowerFa.includes('وال سیت') || lowerEn.includes('wall sit') || reps.includes('ثانیه')) && !reps.includes('تکرار')));

  if (isIso || item.isoDuration) {
    let defaultSeconds = item.isoDuration || 30;
    if (!item.isoDuration) {
      if (reps.includes('20') || reps.includes('۲۰')) defaultSeconds = 20;
      if (reps.includes('40') || reps.includes('۴۰') || reps.includes('45') || reps.includes('۴۵')) defaultSeconds = 45;
      if (reps.includes('60') || reps.includes('۶۰')) defaultSeconds = 60;
    }
    
    isoBtnHtml = `
      <button class="quick-iso-btn" onclick="quickStartIsoTimer(${defaultSeconds}, '${displayNameFa}')" title="باز کردن تایمر ${defaultSeconds} ثانیه">
        <span>⏱️</span> <span>تایمر ${defaultSeconds}ث</span>
      </button>
    `;
  }

  const logBtnHtml = `
    <button class="log-btn" data-day-id="${dayId}" data-ex-id="${ex.id}" onclick="openLogForCard(this)" title="ثبت وزنه، تکرار و RIR برای اضافه بار تدریجی">
      <span>📝</span> <span>لاگ / وزنه</span>
    </button>
    <button class="chart-btn" data-ex-id="${ex.id}" onclick="openChartForCard(this)" title="نمودار پیشرفت و افزایش وزنه نسبت به جلسه اول">
      <span>📈</span> <span>نمودار</span>
    </button>
    <button class="edit-card-btn" data-day-id="${dayId}" data-ex-id="${ex.id}" data-is-superset="${isSuperset ? '1' : '0'}" onclick="openQuickEditForCard(this)" title="ویرایش سریع این حرکت">
      <span>✏️</span> <span>ویرایش</span>
    </button>
  `;

  let moveBtnsHtml = '';
  if (!isSuperset && singleIdx >= 0) {
    moveBtnsHtml = `
      <div class="card-reorder-toolbar">
        ${singleIdx > 0 ? `<button class="btn-move-action" onclick="moveSingleItem('${dayId}', ${singleIdx}, -1)" title="انتقال حرکت به بالا">⬆️ بالا</button>` : ''}
        ${singleIdx < totalSingles - 1 ? `<button class="btn-move-action" onclick="moveSingleItem('${dayId}', ${singleIdx}, 1)" title="انتقال حرکت به پایین">⬇️ پایین</button>` : ''}
        <button class="btn-move-action" style="color:#fcd34d; border-color:rgba(252,211,77,0.3);" onclick="openMoveDayModal('single', '${dayId}', -1, ${singleIdx})" title="انتقال این حرکت به روز دیگر">📅 تغییر روز</button>
      </div>
    `;
  } else if (isSuperset && ssIdx >= 0 && totalSSExercises > 1) {
    moveBtnsHtml = `
      <div class="card-reorder-toolbar">
        ${exIdx > 0 ? `<button class="btn-move-action" onclick="moveSupersetExercise('${dayId}', ${ssIdx}, ${exIdx}, -1)" title="انتقال حرکت در سوپرست به بالا">⬆️ بالا</button>` : ''}
        ${exIdx < totalSSExercises - 1 ? `<button class="btn-move-action" onclick="moveSupersetExercise('${dayId}', ${ssIdx}, ${exIdx}, 1)" title="انتقال حرکت در سوپرست به پایین">⬇️ پایین</button>` : ''}
        <button class="btn-move-action" style="color:#fcd34d; border-color:rgba(252,211,77,0.3);" onclick="splitSingleExerciseFromSuperset('${dayId}', ${ssIdx}, ${exIdx})" title="تفکیک این حرکت از سوپرست به عنوان حرکت مستقل">✂️ تفکیک به تکی</button>
      </div>
    `;
  }

  return `
    <article class="exercise-card" data-ex-id="${dayId}_${ex.id}" data-day-id="${dayId}" data-is-ss="${isSuperset ? '1' : '0'}" data-ss-idx="${ssIdx}" data-ex-idx="${isSuperset ? exIdx : singleIdx}">
      <div class="exercise-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="card-drag-handle" title="لمس یا کشیدن برای جابجایی سریع">⠿</span>
          <div>
            <div class="exercise-name-fa">${displayNameFa}</div>
            ${originalSubtext}
          </div>
        </div>
        <div class="reps-badge">${reps}</div>
      </div>
      <div class="muscles-row">
        <span class="muscle-tag">عضلات هدف: ${ex.muscles || 'عمومی'}</span>
        ${isoBtnHtml}
        ${logBtnHtml}
      </div>
      ${moveBtnsHtml}
      <div class="card-footer">
        <div class="video-links-group">
          ${renderVideoButtons(ex.videos)}
        </div>
        <div class="sets-tracker">
          ${setBtns}
        </div>
      </div>
    </article>
  `;
}

// --- Quick Single Exercise Editor Logic ---
let currentQuickEditTarget = { dayId: '', exId: '', isSuperset: false };

function openLogForCard(btn) {
  const dayId = btn.getAttribute('data-day-id');
  const exId = btn.getAttribute('data-ex-id');
  const ex = findExerciseById(exId);
  const prof = getActiveProfile();
  const day = prof.days.find(d => d.id === dayId);
  let item = null;
  if (day?.singles) item = day.singles.find(s => s.exId === exId);
  if (!item && day?.supersets) {
    for (const ss of day.supersets) {
      item = ss.exercises.find(e => e.exId === exId);
      if (item) break;
    }
  }
  const setsCount = item ? parseSetsFromReps(item.reps, item.sets) : 3;
  openLogModal(exId, ex.fa, dayId, setsCount);
}

function openChartForCard(btn) {
  const exId = btn.getAttribute('data-ex-id');
  const ex = findExerciseById(exId);
  openOverloadChart(exId, ex.fa);
}

function openQuickEditForCard(btn) {
  const dayId = btn.getAttribute('data-day-id');
  const exId = btn.getAttribute('data-ex-id');
  const isSuperset = btn.getAttribute('data-is-superset') === '1';

  const prof = getActiveProfile();
  const day = prof.days.find(d => d.id === dayId);
  if (!day) return;

  let item = null;
  if (!isSuperset && day.singles) {
    item = day.singles.find(s => s.exId === exId);
  } else if (isSuperset && day.supersets) {
    for (const ss of day.supersets) {
      item = ss.exercises.find(e => e.exId === exId);
      if (item) break;
    }
  }

  const reps = item?.reps || '3 × 8–12';
  const sets = item?.sets || parseSetsFromReps(reps, 3);

  if (isProfileUnlocked()) {
    openQuickEditExModal(dayId, exId, reps, sets, isSuperset);
  } else {
    pendingActionAfterPin = () => openQuickEditExModal(dayId, exId, reps, sets, isSuperset);
    document.getElementById('pinModalTitle').innerText = 'ورود به بخش ویرایش حرکت';
    document.getElementById('pinModalDesc').innerText = `برنامه ${prof.name} محافظت‌شده است. لطفاً رمز عبور را وارد کنید:`;
    document.getElementById('profilePinInput').value = '';
    document.getElementById('pinErrorMsg').style.display = 'none';
    document.getElementById('pinModal').classList.add('open');
    setTimeout(() => document.getElementById('profilePinInput').focus(), 200);
  }
}

function openQuickEditExModal(dayId, exId, reps, sets, isSuperset) {
  currentQuickEditTarget = { dayId, exId, isSuperset };
  const ex = findExerciseById(exId);
  const prof = getActiveProfile();
  const day = prof.days.find(d => d.id === dayId);

  let currentItem = null;
  if (!isSuperset && day?.singles) {
    currentItem = day.singles.find(s => s.exId === exId);
  } else if (isSuperset && day?.supersets) {
    for (const ss of day.supersets) {
      currentItem = ss.exercises.find(e => e.exId === exId);
      if (currentItem) break;
    }
  }

  document.getElementById('quickEditExModalTitle').innerText = `✏️ ویرایش: ${ex.fa}`;
  document.getElementById('quickEditExSelectVal').value = exId;
  document.getElementById('pickerSelectedDisplayQuickEdit').innerText = 'حرکت انتخابی: ' + ex.fa;
  document.getElementById('pickerSearchQuickEdit').value = ex.fa;
  filterPickerOptions('QuickEdit', '');

  document.getElementById('quickEditExReps').value = reps || ex.defaultReps || '3 × 8–12';
  document.getElementById('quickEditExSets').value = String(sets || 3);

  const customNameInput = document.getElementById('quickEditExCustomName');
  if (customNameInput) {
    customNameInput.value = currentItem?.customName || '';
  }

  const isoInput = document.getElementById('quickEditExIsoDuration');
  if (isoInput) {
    isoInput.value = currentItem?.isoDuration || '';
  }

  // Toggle Superset UI boxes
  const notSsBox = document.getElementById('quickEditNotSupersetBox');
  const isSsBox = document.getElementById('quickEditIsSupersetBox');
  if (notSsBox && isSsBox) {
    notSsBox.style.display = isSuperset ? 'none' : 'block';
    isSsBox.style.display = isSuperset ? 'block' : 'none';
  }

  document.getElementById('quickEditExModal').classList.add('open');
}

function addExerciseToThisSupersetFromQuickEdit() {
  const { dayId, exId } = currentQuickEditTarget;
  const prof = getActiveProfile();
  const day = prof.days.find(d => d.id === dayId);
  if (!day || !day.supersets) return;

  const ssIdx = day.supersets.findIndex(ss => ss.exercises.some(e => e.exId === exId));
  if (ssIdx < 0) return;

  closeQuickEditExModal();
  openAddExerciseToSupersetModal(dayId, ssIdx);
}

function startSupersetFromQuickEdit() {
  const { dayId, exId } = currentQuickEditTarget;
  const prof = getActiveProfile();
  const dIdx = prof.days.findIndex(d => d.id === dayId);
  if (dIdx < 0) return;
  const day = prof.days[dIdx];
  const sIdx = day.singles ? day.singles.findIndex(s => s.exId === exId) : -1;
  if (sIdx < 0) return;

  closeQuickEditExModal();
  openConvertToSupersetModal(dIdx, sIdx);
}

function splitSupersetFromQuickEdit() {
  const { dayId, exId } = currentQuickEditTarget;
  const prof = getActiveProfile();
  const day = prof.days.find(d => d.id === dayId);
  if (!day || !day.supersets) return;

  let foundItem = null;
  for (const ss of day.supersets) {
    const idx = ss.exercises.findIndex(e => e.exId === exId);
    if (idx >= 0) {
      foundItem = ss.exercises.splice(idx, 1)[0];
      break;
    }
  }

  // Remove any empty supersets
  day.supersets = day.supersets.filter(ss => ss.exercises.length > 0);

  if (foundItem) {
    if (!day.singles) day.singles = [];
    day.singles.push(foundItem);
    saveProfiles();
    closeQuickEditExModal();
    renderApp(true);
    showToast(`✂️ حرکت "${findExerciseById(exId).fa}" از سوپرست تفکیک و به حرکت تکی تبدیل شد!`);
  }
}

function closeQuickEditExModal() {
  document.getElementById('quickEditExModal').classList.remove('open');
}

function saveQuickEditExercise() {
  const prof = getActiveProfile();
  const { dayId, exId, isSuperset } = currentQuickEditTarget;
  const day = prof.days.find(d => d.id === dayId);
  if (!day) return;

  const newExId = document.getElementById('quickEditExSelectVal').value || exId;
  const newReps = document.getElementById('quickEditExReps').value.trim() || '3 × 8–12';
  const newSets = parseInt(document.getElementById('quickEditExSets').value) || 3;
  const customNameVal = document.getElementById('quickEditExCustomName')?.value.trim() || '';
  const isoDurationVal = parseInt(document.getElementById('quickEditExIsoDuration')?.value) || 0;

  let targetItem = null;
  let targetSIdx = -1;
  let targetSSIdx = -1;
  let targetExIdx = -1;

  if (!isSuperset && day.singles) {
    targetSIdx = day.singles.findIndex(s => s.exId === exId);
    if (targetSIdx >= 0) {
      targetItem = day.singles[targetSIdx];
    }
  } else if (isSuperset && day.supersets) {
    for (let i = 0; i < day.supersets.length; i++) {
      const idx = day.supersets[i].exercises.findIndex(e => e.exId === exId);
      if (idx >= 0) {
        targetSSIdx = i;
        targetExIdx = idx;
        targetItem = day.supersets[i].exercises[idx];
        break;
      }
    }
  }

  if (targetItem) {
    targetItem.exId = newExId;
    targetItem.reps = newReps;
    targetItem.sets = newSets;
    if (customNameVal) targetItem.customName = customNameVal;
    else delete targetItem.customName;
    if (isoDurationVal > 0) targetItem.isoDuration = isoDurationVal;
    else delete targetItem.isoDuration;
  }

  saveProfiles();
  closeQuickEditExModal();

  if (!isSuperset) {
    const singlesWrap = document.getElementById('singles_' + dayId);
    if (singlesWrap) {
      singlesWrap.innerHTML = renderDaySinglesHTML(day);
      loadSavedSets();
      showToast('✅ تغییرات حرکت با موفقیت ذخیره و اعمال شد!');
      return;
    }
  } else {
    const ssWrap = document.getElementById('supersets_' + dayId);
    if (ssWrap) {
      ssWrap.innerHTML = renderDaySupersetsHTML(day);
      loadSavedSets();
      showToast('✅ تغییرات حرکت با موفقیت ذخیره و اعمال شد!');
      return;
    }
  }

  renderApp(true);
  showToast('✅ تغییرات حرکت با موفقیت ذخیره و اعمال شد!');
}

function deleteQuickEditExercise() {
  const prof = getActiveProfile();
  const { dayId, exId, isSuperset } = currentQuickEditTarget;
  const day = prof.days.find(d => d.id === dayId);
  if (!day) return;

  const ex = findExerciseById(exId);
  if (confirm(`آیا از حذف حرکت "${ex.fa}" از روز "${day.title}" اطمینان دارید؟`)) {
    if (!isSuperset && day.singles) {
      day.singles = day.singles.filter(s => s.exId !== exId);
    } else if (isSuperset && day.supersets) {
      for (const ss of day.supersets) {
        ss.exercises = ss.exercises.filter(e => e.exId !== exId);
      }
      day.supersets = day.supersets.filter(ss => ss.exercises.length > 0);
    }

    saveProfiles();
    closeQuickEditExModal();
    renderApp();
    showToast(`حرکت "${ex.fa}" با موفقیت حذف شد.`);
  }
}

// --- Definitive Scientific Muscle Taxonomy & Mapping ---
const EXERCISE_MUSCLE_MAPPING = {
  // Chest (سینه)
  'chest_press_machine': ['سینه'],
  'seated_chest_press_machine': ['سینه'],
  'incline_smith_press': ['سینه'],
  'smith_incline_bench_press': ['سینه'],
  'iso_lateral_incline_bench_press': ['سینه'],
  'peck_deck_fly': ['سینه'],
  'incline_fly_machine': ['سینه'],
  'iso_lateral_incline_pec_fly_machine': ['سینه'],
  'incline_chest_fly': ['سینه'],
  'seated_cable_pec_fly': ['سینه'],
  'cable_fly': ['سینه'],

  // Lats & Back (زیر بغل و پشت)
  'lat_pulldown': ['پشت'],
  'neutral_lat_pulldown': ['پشت'],
  'cable_seated_row': ['پشت'],
  'cable_row': ['پشت'],
  'iso_lateral_row': ['پشت'],
  'ufo_lat_pulldown': ['پشت'],
  'ufo_linear_row_machine': ['پشت'],
  'dumbbell_row': ['پشت'],
  'lat_pulldown_underhand': ['پشت'],

  // Shoulders (سرشانه و دلتوئید)
  'machine_lateral_raise': ['سرشانه'],
  'standing_lateral_raise_machine': ['سرشانه'],
  'dumbbell_lateral_raise': ['سرشانه'],
  'plate_loaded_shoulder_press': ['سرشانه'],
  'dumbbell_shoulder_press': ['سرشانه'],
  'cable_lateral_raise': ['سرشانه'],
  'reverse_peck_deck': ['سرشانه'],
  'reverse_peck_deck_fly': ['سرشانه'],
  'cable_face_pull': ['سرشانه'],
  'face_pull': ['سرشانه'],
  'prone_itwy': ['سرشانه'],
  'wall_slide': ['سرشانه'],
  'dumbbell_shrugs': ['سرشانه'],
  'chest_supported_dumbbell_shrug': ['سرشانه', 'پشت'],

  // Biceps (جلو بازو)
  'ez_bar_preacher_curl': ['جلو بازو'],
  'preacher_curls': ['جلو بازو'],
  'hammer_preacher_curl': ['جلو بازو'],
  'preacher_hammer_curl': ['جلو بازو'],
  'cable_bicep_curl': ['جلو بازو'],
  'dumbbell_bicep_curl': ['جلو بازو'],
  'incline_dumbbell_curl': ['جلو بازو'],

  // Triceps (پشت بازو)
  'rope_tricep_pushdown': ['پشت بازو'],
  'rope_triceps_pushdown': ['پشت بازو'],
  'overhead_rope_tricep_extension': ['پشت بازو'],
  'overhead_triceps_extension': ['پشت بازو'],
  'cable_tricep_pushdown': ['پشت بازو'],
  'cable_triceps_pushdown': ['پشت بازو'],
  'skull_crusher': ['پشت بازو'],

  // Quads (چهارسر ران)
  'leg_extension': ['چهارسر'],
  'hack_squat': ['چهارسر', 'باسن'],
  'leg_press': ['چهارسر', 'باسن'],
  'smith_squat_mini_ball': ['چهارسر', 'داخل ران', 'باسن'],
  'smith_machine_squat': ['چهارسر', 'باسن'],
  'dumbbell_squat': ['چهارسر', 'باسن'],
  'wall_sit': ['چهارسر'],
  'cossack_squat': ['چهارسر', 'داخل ران', 'باسن'],
  'kettlebell_side_lunge': ['چهارسر', 'داخل ران', 'باسن'],

  // Hamstrings (همسترینگ)
  'leg_curl': ['همسترینگ'],
  'seated_leg_curl_machine': ['همسترینگ'],
  'single_leg_cable_hamstring_curl': ['همسترینگ'],
  'slider_hamstring_curl': ['همسترینگ'],
  'rdl': ['همسترینگ', 'باسن', 'فیله'],
  'dumbbell_rdl': ['همسترینگ', 'باسن', 'فیله'],
  'single_leg_dumbbell_rdl': ['همسترینگ', 'باسن', 'فیله'],

  // Glutes (سرینی و باسن)
  'hip_thrust': ['باسن'],
  'glute_bridge': ['باسن'],
  'glute_bridge_iso': ['باسن'],
  'glute_bridge_knees_out': ['باسن'],
  'single_leg_glute_bridge': ['باسن', 'همسترینگ'],
  'cable_glute_kickback': ['باسن'],
  'quadruped_glute_kickback': ['باسن'],

  // Abductors / Glute Medius (خارج ران و سرینی میانی)
  'machine_hip_abduction': ['خارج ران'],
  'cable_hip_abduction': ['خارج ران'],
  'bent_knee_cable_hip_abduction': ['خارج ران'],
  'standing_plate_hip_abduction': ['خارج ران'],
  'lying_plate_hip_abduction': ['خارج ران'],
  'side_lying_hip_abduction': ['خارج ران'],
  'clamshell_plate': ['خارج ران'],
  'clamshell_band': ['خارج ران'],
  'clamshell_dumbbell': ['خارج ران'],
  'clamshell_bodyweight': ['خارج ران'],
  'fire_hydrant': ['خارج ران'],

  // Adductors (داخل ران)
  'cable_hip_adduction': ['داخل ران'],

  // Calves (ساق پا)
  'standing_calf_raise_hack': ['ساق'],
  'standing_calf_raise_machine': ['ساق'],
  'seated_calf_raise': ['ساق'],

  // Lower Back (فیله و پایین کمر)
  'back_extension': ['فیله', 'باسن'],
  'dumbbell_incline_row_low_back': ['فیله', 'پشت'],

  // Core & Abs (شکم و عضلات مرکزی)
  'standing_cable_crunch': ['شکم'],
  'cable_oblique_crunch': ['شکم'],
  'bench_crunch': ['شکم'],
  'bench_reverse_crunch': ['شکم'],
  'captains_chair_leg_raise_oblique': ['شکم'],
  'dead_bug': ['شکم'],
  'dead_bug_iso': ['شکم'],
  'bird_dog': ['شکم'],
  'iso_bird_dog': ['شکم'],
  'side_plank_iso': ['شکم'],
  'side_plank_dips': ['شکم'],
  'plank_hold': ['شکم'],
  'forearm_plank': ['شکم'],
  'onhand_plank_knee_in': ['شکم'],
  'straight_arm_bear_plank_knee_extension': ['شکم'],
  'pike_plank_kickback': ['شکم'],
  'push_up_plus': ['شکم']
};

function renderDynamicWeeklySummary(prof) {
  const muscleGroups = [
    { key: 'سینه', label: 'سینه (Chest)' },
    { key: 'پشت', label: 'زیر بغل و پشت (Lats & Back)' },
    { key: 'سرشانه', label: 'سرشانه و دلتوئید (Shoulders)' },
    { key: 'جلو بازو', label: 'جلو بازو (Biceps)' },
    { key: 'پشت بازو', label: 'پشت بازو (Triceps)' },
    { key: 'چهارسر', label: 'چهارسر ران (Quads)' },
    { key: 'همسترینگ', label: 'همسترینگ (Hamstrings)' },
    { key: 'باسن', label: 'سرینی و باسن (Glutes)' },
    { key: 'خارج ران', label: 'خارج ران و سرینی میانی (Abductors)' },
    { key: 'داخل ران', label: 'داخل ران (Adductors)' },
    { key: 'ساق', label: 'ساق پا (Calves)' },
    { key: 'فیله', label: 'فیله و پایین کمر (Lower Back)' },
    { key: 'شکم', label: 'عضلات مرکزی و شکم (Core & Abs)' }
  ];

  const stats = {};
  muscleGroups.forEach(m => {
    stats[m.key] = { 
      key: m.key, 
      label: m.label, 
      gymSets: 0, 
      homeSets: 0, 
      totalSets: 0, 
      days: new Set(), 
      exerciseDetails: [] 
    };
  });

  prof.days.forEach(day => {
    if (day.type === 'rest') return;

    const dayItems = [];
    if (day.singles) day.singles.forEach(s => dayItems.push(s));
    if (day.supersets) day.supersets.forEach(ss => ss.exercises.forEach(s => dayItems.push(s)));

    dayItems.forEach(item => {
      const ex = findExerciseById(item.exId);
      const sets = parseSetsFromReps(item.reps, item.sets);
      const assignedMuscles = EXERCISE_MUSCLE_MAPPING[item.exId] || [];
      const isGym = (day.type === 'gym');

      assignedMuscles.forEach(mKey => {
        if (stats[mKey]) {
          if (isGym) stats[mKey].gymSets += sets;
          else stats[mKey].homeSets += sets;
          stats[mKey].totalSets += sets;
          stats[mKey].days.add(day.title);
          stats[mKey].exerciseDetails.push({
            exId: item.exId,
            fa: ex.fa,
            en: ex.en || '',
            dayTitle: day.title,
            dayType: day.type,
            sets: sets,
            reps: item.reps || ex.defaultReps || '3 × 8–12'
          });
        }
      });
    });
  });

  window.__currentMuscleStats = stats;

  const activeRows = muscleGroups.filter(m => stats[m.key].totalSets > 0).map(m => {
    const s = stats[m.key];
    const daysList = Array.from(s.days).join('، ');
    const uniqueExMap = new Map();
    s.exerciseDetails.forEach(e => uniqueExMap.set(e.fa, e));
    const uniqueExList = Array.from(uniqueExMap.keys());
    const displayList = uniqueExList.slice(0, 3).join('، ') + (uniqueExList.length > 3 ? ` <span style="color:#38bdf8; font-weight:700;">(مشاهده همه ${uniqueExList.length} حرکت 🔍)</span>` : '');

    return `
      <tr onclick="openMuscleDetailModal('${m.key}')" style="cursor:pointer;" title="کلیک برای مشاهده جزئیات علمی و کامل حرکات این عضله">
        <td>
          <b>${s.label}</b>
          <div style="font-size:10px; color:#38bdf8; margin-top:2px;">🔍 کلیک برای تحلیل دقیق</div>
        </td>
        <td>
          <span class="set-highlight">${s.totalSets} ست</span>
          <div style="font-size:10.5px; margin-top:3px; display:flex; gap:6px;">
            <span style="color:#38bdf8; font-weight:700;">🏋️ ${s.gymSets} باشگاه</span>
            ${s.homeSets > 0 ? `<span style="color:#34d399; font-weight:700;">🏠 ${s.homeSets} خانه</span>` : ''}
          </div>
        </td>
        <td>${s.days.size} جلسه (${daysList})</td>
        <td style="font-size:11.5px; color:#cbd5e1;">${displayList}</td>
      </tr>
    `;
  }).join('');

  const mobileCards = muscleGroups.filter(m => stats[m.key].totalSets > 0).map(m => {
    const s = stats[m.key];
    const daysList = Array.from(s.days).join('، ');
    const uniqueExMap = new Map();
    s.exerciseDetails.forEach(e => uniqueExMap.set(e.fa, e));
    const uniqueExList = Array.from(uniqueExMap.keys());

    return `
      <div class="summary-mobile-card" onclick="openMuscleDetailModal('${m.key}')" style="cursor:pointer;" title="کلیک برای جزئیات کامل">
        <div class="summary-mobile-top">
          <span class="summary-mobile-title">${s.label}</span>
          <span class="set-highlight">${s.totalSets} ست</span>
        </div>
        <div style="font-size:10px; display:flex; gap:5px; margin-bottom:4px;">
          <span style="color:#38bdf8; font-weight:700;">🏋️ ${s.gymSets} ست باشگاه</span>
          ${s.homeSets > 0 ? `<span style="color:#34d399; font-weight:700;">🏠 ${s.homeSets} خانه</span>` : ''}
        </div>
        <div class="summary-mobile-freq">
          <span>📅</span> <span>${s.days.size} جلسه: ${daysList}</span>
        </div>
        <div class="summary-mobile-chips">
          ${uniqueExList.slice(0, 2).map(e => `<span class="summary-mobile-chip">${e}</span>`).join('')}
          ${uniqueExList.length > 2 ? `<span class="summary-mobile-chip" style="background:rgba(56,189,248,0.2); color:#38bdf8; font-weight:800;">+${uniqueExList.length - 2} دیگر... 🔍</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <section id="weekly-summary" class="summary-card">
      <div class="day-header">
        <div class="day-title-wrap">
          <h2 class="day-title">📊 جمع‌بندی هوشمند حجم هفتگی (${prof.name})</h2>
          <span class="day-location-badge badge-gym">محاسبه پویا</span>
        </div>
      </div>

      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
        این آمار به صورت کاملاً پویا بر اساس حرکات و ست‌های برنامه اختصاصی <b>${prof.name}</b> محاسبه شده است.
      </p>

      <!-- Desktop Table View -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>گروه عضلانی</th>
              <th>مجموع ست مستقیم در هفته</th>
              <th>تعداد جلسات تمرین</th>
              <th>نمونه حرکات برنامه</th>
            </tr>
          </thead>
          <tbody>
            ${activeRows || '<tr><td colspan="4" style="text-align:center; padding:16px;">هنوز حرکتی برای محاسبه حجم در این برنامه ثبت نشده است.</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Mobile Responsive Cards View (Zero horizontal scroll on phone) -->
      <div class="summary-mobile-grid">
        ${mobileCards || '<div style="text-align:center; color:var(--text-muted); padding:16px;">هنوز حرکتی برای محاسبه حجم در این برنامه ثبت نشده است.</div>'}
      </div>
    </section>
  `;
}

function renderDaySupersetsHTML(day) {
  if (!day.supersets || day.supersets.length === 0) return '';
  const totalSS = day.supersets.length;
  return day.supersets.map((ss, ssIdx) => `
    <div class="superset-block" id="ss_${day.id}_${ssIdx}" data-day-id="${day.id}" data-ss-idx="${ssIdx}">
      <div class="superset-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="card-drag-handle" title="لمس یا کشیدن برای جابجایی کل سوپرست">⠿</span>
          <span>⚡ ${ss.title}</span>
          <span style="font-size:10.5px; background:rgba(0,242,254,0.15); color:#00f2fe; padding:2px 8px; border-radius:10px; border:1px solid rgba(0,242,254,0.3); font-weight:700;">${ss.exercises.length} حرکت</span>
        </div>
        <div class="card-reorder-toolbar" style="margin-top:0;">
          <button class="btn-move-action" style="color:#38bdf8; border-color:rgba(56,189,248,0.4);" onclick="openAddExerciseToSupersetModal('${day.id}', ${ssIdx})" title="افزودن حرکت دیگر به این سوپرست (ساخت تری‌ست یا جاینت‌ست)">+ حرکت به سوپرست</button>
          ${ssIdx > 0 ? `<button class="btn-move-action" onclick="moveSupersetItem('${day.id}', ${ssIdx}, -1)" title="انتقال کل سوپرست به بالا">⬆️ بالا</button>` : ''}
          ${ssIdx < totalSS - 1 ? `<button class="btn-move-action" onclick="moveSupersetItem('${day.id}', ${ssIdx}, 1)" title="انتقال کل سوپرست به پایین">⬇️ پایین</button>` : ''}
          <button class="btn-move-action" style="color:#fcd34d; border-color:rgba(252,211,77,0.3);" onclick="openMoveDayModal('superset', '${day.id}', ${ssIdx})" title="انتقال کل سوپرست به روز دیگر">📅 انتقال به روز دیگر</button>
        </div>
      </div>
      ${ss.exercises.map((item, exIdx) => renderExerciseCard(item, day.id, true, -1, 0, ssIdx, exIdx, ss.exercises.length)).join('')}
    </div>
  `).join('');
}

function renderDaySinglesHTML(day) {
  if (!day.singles || day.singles.length === 0) return '';
  const totalSingles = day.singles.length;
  return day.singles.map((item, sIdx) => renderExerciseCard(item, day.id, false, sIdx, totalSingles)).join('');
}

function renderWorkoutDays() {
  const prof = getActiveProfile();
  const container = document.getElementById('workoutContent');
  if (!container) return;

  const currentHeight = container.offsetHeight;
  if (currentHeight > 0) {
    container.style.minHeight = currentHeight + 'px';
  }

  const daysHtml = prof.days.map(day => {
    const typeBadge = {
      'gym': '<span class="day-location-badge badge-gym">🏋️ باشگاه</span>',
      'home': '<span class="day-location-badge badge-home">🏠 خانه</span>',
      'rest': '<span class="day-location-badge badge-rest">🛌 استراحت کامل</span>'
    }[day.type] || '';

    const supersetsHtml = renderDaySupersetsHTML(day);
    const singlesHtml = renderDaySinglesHTML(day);

    let restHtml = '';
    if (day.type === 'rest') {
      restHtml = `
        <div class="rest-day-card">
          <div class="rest-icon">🛌💤</div>
          <h3>روز استراحت و ریکاوری کامل</h3>
          <p>امروز بدن شما نیاز به تغذیه با کیفیت، آب‌رسانی کافی و خواب با کیفیت دارد تا عضلات بازسازی شوند.</p>
        </div>
      `;
    }

    let treadmillHtml = '';
    if (day.treadmill) {
      treadmillHtml = `
        <div class="treadmill-banner">
          <span>🏃 آخر جلسه: ۱۵ دقیقه تردمیل</span>
          <button class="btn-header-action" onclick="quickTimer(900)" style="padding:4px 10px;font-size:12px">شروع ۱۵ دقیقه تایمر</button>
        </div>
      `;
    }

    return `
      <section id="${day.id}" class="day-section">
        <div class="day-header">
          <div class="day-title-wrap">
            <h2 class="day-title">${day.title}</h2>
            ${typeBadge}
          </div>
          <div class="day-progress-wrap">
            <div class="day-progress-bar"><div class="day-progress-fill" id="prog-${day.id}"></div></div>
            <span id="prog-text-${day.id}">۰٪</span>
          </div>
        </div>

        <div id="complete-banner-${day.id}" class="day-complete-banner" style="display:none;">
          <span>🏆 جلسه تمرینی ${day.title} ۱۰۰٪ تکمیل شد · خسته نباشی قهرمان! ✨</span>
          <span>💪 ریکاوری عالی</span>
        </div>

        ${day.note ? `
          <div class="session-note">
            <span>📌</span>
            <span>${day.note}</span>
          </div>
        ` : ''}

        <div id="supersets_${day.id}" class="day-supersets-wrap">${supersetsHtml}</div>
        <div id="singles_${day.id}" class="day-singles-wrap">${singlesHtml}</div>
        ${restHtml}
        ${treadmillHtml}
      </section>
    `;
  }).join('');

  const dynamicSummaryHtml = renderDynamicWeeklySummary(prof);
  container.innerHTML = daysHtml + dynamicSummaryHtml;

  requestAnimationFrame(() => {
    container.style.minHeight = '';
  });
}

// --- Muscle Breakdown Detail Modal Handlers ---
function openMuscleDetailModal(mKey) {
  const stats = window.__currentMuscleStats?.[mKey];
  if (!stats) return;

  document.getElementById('muscleDetailModalTitle').innerText = `📊 تحلیل دقیق حجم: ${stats.label}`;
  
  // Stats Row
  const statsRow = document.getElementById('muscleDetailStatsRow');
  statsRow.innerHTML = `
    <div style="background:#162035; border:1px solid var(--border-color); border-radius:10px; padding:8px; text-align:center;">
      <div style="font-size:10px; color:var(--text-muted);">مجموع کل در هفته</div>
      <div style="font-size:16px; font-weight:900; color:#00f2fe; margin-top:2px;">${stats.totalSets} ست</div>
    </div>
    <div style="background:#162035; border:1px solid rgba(56,189,248,0.3); border-radius:10px; padding:8px; text-align:center;">
      <div style="font-size:10px; color:#38bdf8;">🏋️ ست اصلی باشگاه</div>
      <div style="font-size:16px; font-weight:900; color:#38bdf8; margin-top:2px;">${stats.gymSets} ست</div>
    </div>
    <div style="background:#162035; border:1px solid rgba(52,211,153,0.3); border-radius:10px; padding:8px; text-align:center;">
      <div style="font-size:10px; color:#34d399;">🏠 ست ثبات / خانه</div>
      <div style="font-size:16px; font-weight:900; color:#34d399; margin-top:2px;">${stats.homeSets} ست</div>
    </div>
  `;

  // Exercise details list
  const listEl = document.getElementById('muscleDetailExercisesList');
  listEl.innerHTML = stats.exerciseDetails.map((item, idx) => `
    <div style="background:#152033; border:1px solid var(--border-color); border-radius:10px; padding:9px 11px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
      <div>
        <div style="font-size:13px; font-weight:800; color:#fff;">${idx+1}. ${item.fa}</div>
        ${item.en ? `<div style="font-size:10.5px; color:#94a3b8; direction:ltr; text-align:right;">${item.en}</div>` : ''}
        <div style="display:flex; gap:6px; align-items:center; margin-top:4px;">
          <span style="font-size:10px; color:#cbd5e1; background:rgba(255,255,255,0.06); padding:1px 6px; border-radius:4px;">🗓️ ${item.dayTitle}</span>
          <span style="font-size:10px; padding:1px 6px; border-radius:4px; ${item.dayType==='gym' ? 'background:rgba(56,189,248,0.15); color:#38bdf8;' : 'background:rgba(52,211,153,0.15); color:#34d399;'}">${item.dayType==='gym' ? '🏋️ باشگاه' : '🏠 خانه'}</span>
        </div>
      </div>
      <div style="text-align:left; flex-shrink:0;">
        <div class="reps-badge" style="font-size:10.5px; padding:2px 7px;">${item.reps}</div>
        <div style="font-size:11px; color:#00f2fe; font-weight:800; margin-top:3px; text-align:center;">${item.sets} ست مستقیم</div>
      </div>
    </div>
  `).join('');

  document.getElementById('muscleDetailModal').classList.add('open');
}

function closeMuscleDetailModal() {
  document.getElementById('muscleDetailModal').classList.remove('open');
}

// --- PIN & Access Control ---
function isProfileUnlocked() {
  const prof = getActiveProfile();
  if (!prof.pin) return true;
  return sessionStorage.getItem('chieftain_unlocked_' + activeProfileId) === 'true';
}

function requestEditPlanAccess() {
  if (isProfileUnlocked()) {
    openEditPlanModalDirect();
  } else {
    pendingActionAfterPin = 'edit_plan';
    document.getElementById('pinModalTitle').innerText = 'ورود به بخش ویرایش برنامه';
    document.getElementById('pinModalDesc').innerText = 'این برنامه محافظت‌شده است. لطفاً رمز عبور را وارد نمایید:';
    document.getElementById('profilePinInput').value = '';
    document.getElementById('pinErrorMsg').style.display = 'none';
    document.getElementById('pinModal').classList.add('open');
    setTimeout(() => document.getElementById('profilePinInput').focus(), 200);
  }
}

function handleSetClick(btn) {
  if (isProfileUnlocked()) {
    toggleSet(btn);
  } else {
    pendingActionAfterPin = () => toggleSet(btn);
    document.getElementById('pinModalTitle').innerText = 'ثبت ست‌های تمرینی';
    document.getElementById('pinModalDesc').innerText = 'برای ثبت ست‌های این برنامه شخصی، لطفاً رمز عبور را وارد کنید:';
    document.getElementById('profilePinInput').value = '';
    document.getElementById('pinErrorMsg').style.display = 'none';
    document.getElementById('pinModal').classList.add('open');
    setTimeout(() => document.getElementById('profilePinInput').focus(), 200);
  }
}

function closePinModal() {
  document.getElementById('pinModal').classList.remove('open');
  pendingActionAfterPin = null;
}

function confirmProfilePin() {
  const prof = getActiveProfile();
  const enteredPin = document.getElementById('profilePinInput').value.trim();

  if (enteredPin === (prof.pin || 'gym')) {
    sessionStorage.setItem('chieftain_unlocked_' + activeProfileId, 'true');
    const actionToRun = pendingActionAfterPin;
    pendingActionAfterPin = null;
    document.getElementById('pinModal').classList.remove('open');

    if (actionToRun === 'edit_plan') {
      openEditPlanModalDirect();
    } else if (typeof actionToRun === 'function') {
      actionToRun();
    }
    showToast('🔓 قفل باز شد. دسترسی شما تایید گردید.');
  } else {
    document.getElementById('pinErrorMsg').style.display = 'block';
  }
}

function openEditPlanModalDirect() {
  const prof = getActiveProfile();
  document.getElementById('editPlanProfileBadge').innerText = 'برنامه: ' + prof.name;
  document.getElementById('editProfilePinInput').value = prof.pin || '';
  renderEditPlanDaysList();
  document.getElementById('editPlanModal').classList.add('open');
}

function closeEditPlanModal() {
  document.getElementById('editPlanModal').classList.remove('open');
}

function applyAndSavePlanEdits() {
  saveProfiles();
  closeEditPlanModal();
  renderApp();
  showToast('✅ تغییرات برنامه با موفقیت ذخیره و اعمال شد!');
}

function updateProfilePin() {
  const prof = getActiveProfile();
  const newPin = document.getElementById('editProfilePinInput').value.trim();
  prof.pin = newPin;
  saveProfiles();
  showToast(newPin ? `🔒 رمز عبور برنامه به "${newPin}" تغییر یافت.` : 'رمز عبور این برنامه حذف شد.');
}

// --- Profile Switching & Creation ---
function onProfileChange(newId) {
  activeProfileId = newId;
  localStorage.setItem('chieftain_active_profile_id', newId);
  renderApp();
  if (activeMainTab === 'metrics') {
    renderBodyMetricsView();
  }
}

function openNewProfileModal() {
  document.getElementById('newProfileName').value = '';
  document.getElementById('newProfilePin').value = '';
  document.getElementById('newProfileModal').classList.add('open');
}

function closeNewProfileModal() {
  document.getElementById('newProfileModal').classList.remove('open');
}

function saveNewProfile() {
  const name = document.getElementById('newProfileName').value.trim();
  if (!name) {
    alert('لطفاً نام کاربر یا عنوان برنامه را وارد کنید.');
    return;
  }

  const template = document.getElementById('newProfileTemplate').value;
  const pin = document.getElementById('newProfilePin').value.trim();
  const newId = 'prof_' + Date.now();

  let newDays = [];
  if (template === 'clone') {
    newDays = JSON.parse(JSON.stringify(HOSSEIN_PROFILE.days));
  } else if (template === 'morvarid') {
    newDays = JSON.parse(JSON.stringify(MORVARID_PROFILE.days));
  } else {
    newDays = [
      { id: 'd1', title: 'شنبه', type: 'gym', badge: '🏋️ باشگاه', note: '', treadmill: false, supersets: [], singles: [] }
    ];
  }

  const newProf = {
    id: newId,
    name: name,
    isDefault: false,
    pin: pin,
    days: newDays
  };

  allProfiles.push(newProf);
  saveProfiles();
  activeProfileId = newId;
  localStorage.setItem('chieftain_active_profile_id', newId);
  closeNewProfileModal();
  renderApp();
  showToast(`✨ برنامه شخصی "${name}" با موفقیت ایجاد و ذخیره شد.`);
}

function deleteActiveProfile() {
  const prof = getActiveProfile();
  if (prof.isDefault) {
    alert('برنامه‌های پیش‌فرض اصلی قابل حذف نیستند.');
    return;
  }

  if (confirm(`آیا از حذف کامل برنامه "${prof.name}" اطمینان دارید؟`)) {
    allProfiles = allProfiles.filter(p => p.id !== prof.id);
    saveProfiles();
    activeProfileId = 'hossein_chieftain';
    localStorage.setItem('chieftain_active_profile_id', 'hossein_chieftain');
    closeEditPlanModal();
    renderApp();
    showToast('برنامه با موفقیت حذف شد.');
  }
}

function factoryResetActiveProfile() {
  const prof = getActiveProfile();
  if (confirm(`آیا می‌خواهید تمام روزهای اصلی برای "${prof.name}" بازیابی شوند؟`)) {
    if (prof.id === 'morvarid') {
      prof.days = JSON.parse(JSON.stringify(MORVARID_PROFILE.days));
      prof.pin = 'inci';
    } else {
      prof.days = JSON.parse(JSON.stringify(HOSSEIN_PROFILE.days));
      if (prof.id === 'hossein_chieftain') prof.pin = 'gym';
    }
    saveProfiles();
    renderEditPlanDaysList();
    renderApp();
    showToast('برنامه با موفقیت بازنشانی شد! ⚡');
  }
}

function resetCurrentSets() {
  const prof = getActiveProfile();
  if (!isProfileUnlocked()) {
    handleSetClick({ click: () => resetCurrentSets() });
    return;
  }

  if (confirm(`آیا می‌خواهید تمام تیک‌های ست‌های ثبت‌شده برای "${prof.name}" ریست شوند تا جلسه تمرینی جدید را شروع کنید؟`)) {
    localStorage.removeItem('chieftain_sets_' + activeProfileId);
    document.querySelectorAll('.set-btn').forEach(btn => btn.classList.remove('done'));
    document.querySelectorAll('.exercise-card').forEach(card => card.classList.remove('completed'));
    updateAllProgressBars();
    showToast('تمام ست‌ها ریست شدند. آماده تمرین جدید! 💪');
  }
}

function exportActiveProfile() {
  const prof = getActiveProfile();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(prof, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `${prof.name.replace(/\s+/g, '_')}_workout.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// --- Searchable Picker Engine ---
function filterPickerOptions(slot, term) {
  term = (term || '').toLowerCase().trim();
  const all = getAllExercises();
  const listEl = document.getElementById('pickerList' + slot);
  if (!listEl) return;

  const filtered = !term ? all.slice(0, 15) : all.filter(e => 
    e.fa.toLowerCase().includes(term) || (e.en && e.en.toLowerCase().includes(term)) || (e.muscles && e.muscles.toLowerCase().includes(term))
  );

  listEl.innerHTML = filtered.map(e => `
    <div class="search-picker-item" onclick="selectPickerOption('${slot}', '${e.id}', '${e.fa.replace(/'/g, "\\'")}')">
      <div>
        <span style="font-weight:700;">${e.fa}</span>
        ${e.en ? `<span style="font-size:10.5px; color:#38bdf8; margin-right:4px;">(${e.en})</span>` : ''}
      </div>
      <span style="font-size:10px; color:#94a3b8;">${e.muscles || ''}</span>
    </div>
  `).join('');
}

function selectPickerOption(slot, exId, exFa) {
  let inputVal = null;
  if (slot === 'Convert') {
    inputVal = document.getElementById('convertSingleSelect2Val');
  } else if (slot === 'QuickEdit') {
    inputVal = document.getElementById('quickEditExSelectVal');
  } else {
    inputVal = document.getElementById('addExSelect' + slot + 'Val');
  }

  const display = document.getElementById('pickerSelectedDisplay' + slot);
  if (inputVal) inputVal.value = exId;
  if (display) display.innerText = 'حرکت انتخابی: ' + exFa;
  const searchBox = document.getElementById('pickerSearch' + slot);
  if (searchBox) searchBox.value = exFa;
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  pendingActionAfterPin = null;
}

// --- Rich Routine & Granular Exercise Editor ---
function renderEditPlanDaysList() {
  const prof = getActiveProfile();
  const container = document.getElementById('editPlanDaysList');
  const allEx = getAllExercises();

  container.innerHTML = prof.days.map((day, dIdx) => {
    // Supersets List HTML
    let supersetsHtml = '';
    if (day.supersets && day.supersets.length > 0) {
      supersetsHtml = day.supersets.map((ss, ssIdx) => `
        <div class="editor-superset-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:12px; font-weight:800; color:#38bdf8;">⚡</span>
              <input type="text" value="${ss.title}" class="form-input" style="font-weight:700; width:220px; padding:4px 8px; font-size:12px;" onchange="updateSupersetTitle(${dIdx}, ${ssIdx}, this.value)">
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn-header-action" style="padding:3px 8px; font-size:11px; color:#38bdf8; border-color:#38bdf855;" title="تفکیک این سوپرست به ۲ حرکت تکی مجزا" onclick="splitSupersetToSingles(${dIdx}, ${ssIdx})">🔓 تفکیک به ۲ حرکت تکی</button>
              <button class="btn-header-action" style="padding:3px 8px; font-size:11px; color:#f87171; border-color:#f8717155;" onclick="removeSuperset(${dIdx}, ${ssIdx})">🗑️ حذف سوپرست</button>
            </div>
          </div>

          ${ss.exercises.map((item, exIdx) => {
            const ex = findExerciseById(item.exId);
            const exOptions = allEx.map(e => `<option value="${e.id}" ${e.id === item.exId ? 'selected' : ''}>${e.fa} ${e.en ? `(${e.en})` : ''}</option>`).join('');
            const currentSets = parseSetsFromReps(item.reps, item.sets);
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed rgba(255,255,255,0.08); flex-wrap:wrap; gap:6px;">
                <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:200px;">
                  <span style="font-size:11px; color:#94a3b8; font-weight:800;">${exIdx === 0 ? 'حرکت ۱:' : 'حرکت ۲:'}</span>
                  <select class="form-select" style="font-size:12px; padding:4px 8px;" onchange="updateSsExerciseId(${dIdx}, ${ssIdx}, ${exIdx}, this.value)">
                    ${exOptions}
                  </select>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                  <select class="form-select" style="width:75px; padding:4px 6px; font-size:11.5px;" title="تعداد ست" onchange="updateSsExSets(${dIdx}, ${ssIdx}, ${exIdx}, this.value)">
                    <option value="1" ${currentSets===1?'selected':''}>۱ ست</option>
                    <option value="2" ${currentSets===2?'selected':''}>۲ ست</option>
                    <option value="3" ${currentSets===3?'selected':''}>۳ ست</option>
                    <option value="4" ${currentSets===4?'selected':''}>۴ ست</option>
                    <option value="5" ${currentSets===5?'selected':''}>۵ ست</option>
                  </select>
                  <input type="text" value="${item.reps || '3 × 8–12'}" class="form-input" style="width:90px; padding:4px 6px; font-size:11.5px; direction:ltr;" title="متن ست و تکرار" onchange="updateSsExReps(${dIdx}, ${ssIdx}, ${exIdx}, this.value)">
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `).join('');
    }

    // Singles List HTML
    let singlesHtml = '';
    if (day.singles && day.singles.length > 0) {
      singlesHtml = day.singles.map((item, sIdx) => {
        const ex = findExerciseById(item.exId);
        const exOptions = allEx.map(e => `<option value="${e.id}" ${e.id === item.exId ? 'selected' : ''}>${e.fa} ${e.en ? `(${e.en})` : ''}</option>`).join('');
        const currentSets = parseSetsFromReps(item.reps, item.sets);
        return `
          <div class="editor-ex-card">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <!-- Exercise Selector Dropdown -->
              <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:200px;">
                <span style="font-size:11px; color:var(--text-muted);">#${sIdx + 1}</span>
                <select class="form-select" style="font-size:12.5px; font-weight:700; padding:5px 8px;" onchange="updateSingleExId(${dIdx}, ${sIdx}, this.value)">
                  ${exOptions}
                </select>
              </div>

              <!-- Reps / Set Count / Convert to Superset / Reorder / Delete -->
              <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
                <select class="form-select" style="width:75px; padding:4px 6px; font-size:11.5px;" title="تعداد ست" onchange="updateSingleExSets(${dIdx}, ${sIdx}, this.value)">
                  <option value="1" ${currentSets===1?'selected':''}>۱ ست</option>
                  <option value="2" ${currentSets===2?'selected':''}>۲ ست</option>
                  <option value="3" ${currentSets===3?'selected':''}>۳ ست</option>
                  <option value="4" ${currentSets===4?'selected':''}>۴ ست</option>
                  <option value="5" ${currentSets===5?'selected':''}>۵ ست</option>
                </select>
                <input type="text" value="${item.reps || '3 × 8–12'}" class="form-input" style="width:85px; padding:4px 6px; font-size:11.5px; direction:ltr;" title="متن ست و تکرار" onchange="updateSingleExReps(${dIdx}, ${sIdx}, this.value)">
                <button class="btn-header-action" style="padding:3px 7px; font-size:11px; color:#38bdf8;" title="تبدیل این حرکت به یک سوپرست دوتایی" onclick="openConvertToSupersetModal(${dIdx}, ${sIdx})">⚡ سوپرست</button>
                <button class="btn-header-action" style="padding:3px 6px; font-size:11px;" title="حرکت به بالا" onclick="moveSingleEx(${dIdx}, ${sIdx}, -1)">▲</button>
                <button class="btn-header-action" style="padding:3px 6px; font-size:11px;" title="حرکت به پایین" onclick="moveSingleEx(${dIdx}, ${sIdx}, 1)">▼</button>
                <button class="btn-header-action" style="padding:3px 6px; font-size:11px; color:#f87171;" title="حذف حرکت" onclick="removeSingleEx(${dIdx}, ${sIdx})">✕</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    const dayOptionsHtml = WEEK_DAYS.map(w => 
      `<option value="${w}" ${day.title === w ? 'selected' : ''}>${w}</option>`
    ).join('');

    return `
      <div style="background:#152033; border:1px solid var(--border-color); border-radius:14px; padding:14px; margin-bottom:14px;">
        <!-- Day Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
          <div style="display:flex; gap:6px; align-items:center;">
            <select class="form-select" style="font-weight:800; width:125px; display:inline-block; color:#38bdf8;" onchange="updateDayTitle(${dIdx}, this.value)">
              ${dayOptionsHtml}
            </select>
            <select class="form-select" style="width:110px; display:inline-block;" onchange="updateDayType(${dIdx}, this.value)">
              <option value="gym" ${day.type==='gym'?'selected':''}>🏋️ باشگاه</option>
              <option value="home" ${day.type==='home'?'selected':''}>🏠 خانه</option>
              <option value="rest" ${day.type==='rest'?'selected':''}>🛌 استراحت</option>
            </select>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn-header-action btn-action-primary" style="padding:5px 10px; font-size:12px;" onclick="openAddExToDayModal('${day.id}')">+ افزودن حرکت / سوپرست</button>
            <button class="btn-header-action" style="padding:5px 8px; color:#f87171;" title="حذف این روز" onclick="removeDay(${dIdx})">🗑️</button>
          </div>
        </div>

        <!-- Note & Treadmill -->
        <div style="display:flex; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
          <input type="text" value="${day.note || ''}" placeholder="یادداشت این جلسه..." class="form-input" style="flex:1; min-width:180px; font-size:12px;" onchange="updateDayNote(${dIdx}, this.value)">
          <label style="display:flex; align-items:center; gap:5px; font-size:12px; color:#cbd5e1; cursor:pointer;">
            <input type="checkbox" ${day.treadmill ? 'checked' : ''} onchange="updateDayTreadmill(${dIdx}, this.checked)">
            🏃 تردمیل آخر جلسه
          </label>
        </div>

        <!-- Exercises List -->
        <div style="margin-top:8px;">
          ${supersetsHtml}
          ${singlesHtml}
          ${(!supersetsHtml && !singlesHtml) ? '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">هنوز حرکتی برای این روز ثبت نشده است.</div>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

function updateDayTitle(dIdx, newTitle) {
  const prof = getActiveProfile();
  prof.days[dIdx].title = newTitle;
  saveProfiles();
  renderApp();
}

function updateDayType(dIdx, newType) {
  const prof = getActiveProfile();
  prof.days[dIdx].type = newType;
  saveProfiles();
  renderApp();
}

function updateDayNote(dIdx, note) {
  const prof = getActiveProfile();
  prof.days[dIdx].note = note;
  saveProfiles();
  renderApp();
}

function updateDayTreadmill(dIdx, treadmill) {
  const prof = getActiveProfile();
  prof.days[dIdx].treadmill = treadmill;
  saveProfiles();
  renderApp();
}

function updateSingleExId(dIdx, sIdx, newExId) {
  const prof = getActiveProfile();
  prof.days[dIdx].singles[sIdx].exId = newExId;
  saveProfiles();
  renderApp();
}

function updateSingleExSets(dIdx, sIdx, setsVal) {
  const prof = getActiveProfile();
  const setsNum = parseInt(setsVal) || 3;
  prof.days[dIdx].singles[sIdx].sets = setsNum;
  const oldReps = prof.days[dIdx].singles[sIdx].reps || '3 × 8–12';
  prof.days[dIdx].singles[sIdx].reps = oldReps.replace(/^\d+/, setsNum);
  saveProfiles();
  renderEditPlanDaysList();
  renderApp();
}

function updateSingleExReps(dIdx, sIdx, reps) {
  const prof = getActiveProfile();
  prof.days[dIdx].singles[sIdx].reps = reps;
  prof.days[dIdx].singles[sIdx].sets = parseSetsFromReps(reps, 3);
  saveProfiles();
  renderApp();
}

function moveSingleEx(dIdx, sIdx, dir) {
  const prof = getActiveProfile();
  const list = prof.days[dIdx].singles;
  const targetIdx = sIdx + dir;
  if (targetIdx < 0 || targetIdx >= list.length) return;
  const temp = list[sIdx];
  list[sIdx] = list[targetIdx];
  list[targetIdx] = temp;
  saveProfiles();
  renderEditPlanDaysList();
  renderApp();
}

function removeSingleEx(dIdx, sIdx) {
  const prof = getActiveProfile();
  const ex = findExerciseById(prof.days[dIdx].singles[sIdx].exId);
  if (confirm(`آیا حرکت "${ex.fa}" حذف شود؟`)) {
    prof.days[dIdx].singles.splice(sIdx, 1);
    saveProfiles();
    renderEditPlanDaysList();
    renderApp();
  }
}

// Convert Single Exercise to Superset
function openConvertToSupersetModal(dIdx, sIdx) {
  convertTargetDayIdx = dIdx;
  convertTargetSingleIdx = sIdx;
  const prof = getActiveProfile();
  const targetSingle = prof.days[dIdx].singles[sIdx];
  const ex1 = findExerciseById(targetSingle.exId);

  document.getElementById('convertSingleName1').value = `${ex1.fa} (${targetSingle.reps || '3 × 8–12'})`;
  
  const allEx = getAllExercises();
  const defaultEx2 = allEx[0] || ex1;
  document.getElementById('convertSingleSelect2Val').value = defaultEx2.id;
  document.getElementById('pickerSelectedDisplayConvert').innerText = 'انتخاب شده: ' + defaultEx2.fa;
  document.getElementById('pickerSearchConvert').value = defaultEx2.fa;
  filterPickerOptions('Convert', '');

  document.getElementById('convertSingleReps2').value = '3 × 10–15';
  document.getElementById('convertSingleSets2').value = '3';
  document.getElementById('convertSingleTitle').value = `سوپرست · ${ex1.fa} + ...`;

  document.getElementById('convertSingleModal').classList.add('open');
}

function closeConvertSingleModal() {
  document.getElementById('convertSingleModal').classList.remove('open');
}

function confirmConvertSingleToSuperset() {
  const prof = getActiveProfile();
  const day = prof.days[convertTargetDayIdx];
  const single = day.singles[convertTargetSingleIdx];
  const ex1 = findExerciseById(single.exId);

  const exId2 = document.getElementById('convertSingleSelect2Val').value || getAllExercises()[0].id;
  const reps2 = document.getElementById('convertSingleReps2').value.trim() || '3 × 10–15';
  const sets2 = parseInt(document.getElementById('convertSingleSets2').value) || 3;
  const ex2 = findExerciseById(exId2);
  const title = document.getElementById('convertSingleTitle').value.trim() || `سوپرست · ${ex1.fa} + ${ex2.fa}`;

  if (!day.supersets) day.supersets = [];
  day.supersets.push({
    title: title,
    exercises: [
      { exId: single.exId, reps: single.reps || '3 × 8–12', sets: single.sets || 3 },
      { exId: exId2, reps: reps2, sets: sets2 }
    ]
  });

  day.singles.splice(convertTargetSingleIdx, 1);
  saveProfiles();
  closeConvertSingleModal();
  renderEditPlanDaysList();
  renderApp();
  showToast('⚡ سوپرست جدید با موفقیت ایجاد شد.');
}

// Superset Handlers
function updateSupersetTitle(dIdx, ssIdx, newTitle) {
  const prof = getActiveProfile();
  prof.days[dIdx].supersets[ssIdx].title = newTitle;
  saveProfiles();
  renderApp();
}

function updateSsExerciseId(dIdx, ssIdx, exIdx, newExId) {
  const prof = getActiveProfile();
  prof.days[dIdx].supersets[ssIdx].exercises[exIdx].exId = newExId;
  saveProfiles();
  renderApp();
}

function updateSsExSets(dIdx, ssIdx, exIdx, setsVal) {
  const prof = getActiveProfile();
  const setsNum = parseInt(setsVal) || 3;
  prof.days[dIdx].supersets[ssIdx].exercises[exIdx].sets = setsNum;
  const oldReps = prof.days[dIdx].supersets[ssIdx].exercises[exIdx].reps || '3 × 8–12';
  prof.days[dIdx].supersets[ssIdx].exercises[exIdx].reps = oldReps.replace(/^\d+/, setsNum);
  saveProfiles();
  renderEditPlanDaysList();
  renderApp();
}

function updateSsExReps(dIdx, ssIdx, exIdx, reps) {
  const prof = getActiveProfile();
  prof.days[dIdx].supersets[ssIdx].exercises[exIdx].reps = reps;
  prof.days[dIdx].supersets[ssIdx].exercises[exIdx].sets = parseSetsFromReps(reps, 3);
  saveProfiles();
  renderApp();
}

function splitSupersetToSingles(dIdx, ssIdx) {
  const prof = getActiveProfile();
  const day = prof.days[dIdx];
  const ss = day.supersets[ssIdx];

  if (confirm(`آیا می‌خواهید سوپرست "${ss.title}" را تفکیک کنید و به ۲ حرکت تکی تبدیل شود؟`)) {
    if (!day.singles) day.singles = [];
    ss.exercises.forEach(item => {
      day.singles.push({
        exId: item.exId,
        reps: item.reps || '3 × 8–12',
        sets: item.sets || 3
      });
    });
    day.supersets.splice(ssIdx, 1);
    saveProfiles();
    renderEditPlanDaysList();
    renderApp();
    showToast('🔓 سوپرست به ۲ حرکت تکی تفکیک شد.');
  }
}

function removeSuperset(dIdx, ssIdx) {
  const prof = getActiveProfile();
  if (confirm(`آیا کل این سوپرست حذف شود؟`)) {
    prof.days[dIdx].supersets.splice(ssIdx, 1);
    saveProfiles();
    renderEditPlanDaysList();
    renderApp();
  }
}

function removeDay(dIdx) {
  const prof = getActiveProfile();
  if (prof.days.length <= 1) {
    alert('حداقل یک روز باید در برنامه باقی بماند.');
    return;
  }
  const dayTitle = prof.days[dIdx].title;
  if (confirm(`آیا از حذف روز "${dayTitle}" و تمام حرکات داخل آن اطمینان دارید؟`)) {
    prof.days.splice(dIdx, 1);
    saveProfiles();
    renderEditPlanDaysList();
    renderApp();
  }
}

function addNewDayToActiveProfile() {
  const prof = getActiveProfile();
  const newDayId = 'd' + (prof.days.length + 1) + '_' + Date.now();
  const defaultTitle = WEEK_DAYS[prof.days.length % WEEK_DAYS.length] || `روز ${prof.days.length + 1}`;
  prof.days.push({
    id: newDayId,
    title: defaultTitle,
    type: 'gym',
    badge: '🏋️ باشگاه',
    note: '',
    treadmill: false,
    supersets: [],
    singles: []
  });
  saveProfiles();
  renderEditPlanDaysList();
  renderApp();
  showToast('روز تمرینی جدید اضافه شد.');
}

// --- Add Exercise to Day Modal with Search Picker ---
function openAddExToDayModal(dayId) {
  activeDayForAdding = dayId;
  const exercises = getAllExercises();
  const firstEx = exercises[0] || { id: 'leg_curl', fa: 'حرکت ۱' };
  const secondEx = exercises[1] || exercises[0];

  document.getElementById('addExSelect1Val').value = firstEx.id;
  document.getElementById('pickerSelectedDisplay1').innerText = 'انتخاب شده: ' + firstEx.fa;
  document.getElementById('pickerSearch1').value = firstEx.fa;
  filterPickerOptions(1, '');

  document.getElementById('addExSelect2Val').value = secondEx.id;
  document.getElementById('pickerSelectedDisplay2').innerText = 'انتخاب شده: ' + secondEx.fa;
  document.getElementById('pickerSearch2').value = secondEx.fa;
  filterPickerOptions(2, '');

  document.getElementById('addExType').value = 'single';
  document.getElementById('supersetSecondExGroup').style.display = 'none';

  document.getElementById('addExToDayModal').classList.add('open');
}

function closeAddExToDayModal() {
  document.getElementById('addExToDayModal').classList.remove('open');
}

function onAddExTypeChange(val) {
  document.getElementById('supersetSecondExGroup').style.display = val === 'superset' ? 'block' : 'none';
}

function confirmAddExerciseToDay() {
  const prof = getActiveProfile();
  const day = prof.days.find(d => d.id === activeDayForAdding);
  if (!day) return;

  const type = document.getElementById('addExType').value;
  const exId1 = document.getElementById('addExSelect1Val').value || getAllExercises()[0].id;
  const reps1 = document.getElementById('addExReps1').value.trim() || '3 × 8–12';
  const sets1 = parseInt(document.getElementById('addExSets1').value) || 3;

  if (type === 'single') {
    if (!day.singles) day.singles = [];
    day.singles.push({
      exId: exId1,
      reps: reps1,
      sets: sets1
    });
  } else {
    const exId2 = document.getElementById('addExSelect2Val').value || getAllExercises()[1].id;
    const reps2 = document.getElementById('addExReps2').value.trim() || '3 × 12–20';
    const sets2 = parseInt(document.getElementById('addExSets2').value) || 3;
    const ex1Obj = findExerciseById(exId1);
    const ex2Obj = findExerciseById(exId2);
    const ssTitle = document.getElementById('addSupersetTitle').value.trim() || `سوپرست · ${ex1Obj.fa} + ${ex2Obj.fa}`;

    if (!day.supersets) day.supersets = [];
    day.supersets.push({
      title: ssTitle,
      exercises: [
        { exId: exId1, reps: reps1, sets: sets1 },
        { exId: exId2, reps: reps2, sets: sets2 }
      ]
    });
  }

  saveProfiles();
  closeAddExToDayModal();
  renderEditPlanDaysList();
  renderApp();
  showToast('حرکت با موفقیت به برنامه اضافه شد.');
}

// --- Workout Logger & Progressive Overload Tracking ---
function getExerciseLogs(exId) {
  try {
    const raw = localStorage.getItem('chieftain_logs_' + activeProfileId + '_' + exId);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveExerciseLogsList(exId, logs) {
  localStorage.setItem('chieftain_logs_' + activeProfileId + '_' + exId, JSON.stringify(logs));
}

function isExerciseIsometric(ex) {
  if (!ex) return false;
  const lowerFa = (ex.fa || '').toLowerCase();
  const lowerEn = (ex.en || '').toLowerCase();
  const isExcluded = lowerFa.includes('خرسی') || lowerFa.includes('پایک') || lowerFa.includes('کیک') || lowerEn.includes('bear') || lowerEn.includes('pike') || lowerEn.includes('kickback');
  return !isExcluded && (ex.isIsometric === true || ((lowerFa.includes('ایزومتریک') || lowerFa.includes('پلانک') || lowerFa.includes('ساید پلانک') || lowerFa.includes('وال سیت') || lowerEn.includes('wall sit') || (ex.defaultReps && ex.defaultReps.includes('ثانیه'))) && !(ex.defaultReps && ex.defaultReps.includes('تکرار'))));
}

function openLogModal(exId, exFa, dayId, setsCount) {
  if (!isProfileUnlocked()) {
    pendingActionAfterPin = () => openLogModal(exId, exFa, dayId, setsCount);
    document.getElementById('pinModalTitle').innerText = 'ثبت لاگ و پیشرفت';
    document.getElementById('pinModalDesc').innerText = 'برای ثبت لاگ و پیشرفت این برنامه، لطفاً رمز عبور را وارد کنید:';
    document.getElementById('profilePinInput').value = '';
    document.getElementById('pinErrorMsg').style.display = 'none';
    document.getElementById('pinModal').classList.add('open');
    setTimeout(() => document.getElementById('profilePinInput').focus(), 200);
    return;
  }

  const ex = findExerciseById(exId);
  const isIso = isExerciseIsometric(ex);
  currentLogTarget = { exId, exFa, dayId, setsCount: setsCount || 3, isIso };
  
  document.getElementById('logModalTitle').innerText = isIso ? `🧘‍♂️ ثبت لاگ ایزومتریک: ${exFa}` : `📝 ثبت لاگ وزنه و تکرار: ${exFa}`;
  document.getElementById('logModalSubtitle').innerHTML = isIso 
    ? `⏱️ ثبت زمان انقباض و <b>TIR (زمان ذخیره تا شکست فرم)</b> بر پایه پروتکل‌های علمی پایداری ستون فقرات`
    : `ثبت دقیق وزنه و RIR برای اعمال اضافه بار تدریجی (Progressive Overload)`;
  
  // Render set rows
  const container = document.getElementById('logSetsContainer');
  const pastLogs = getExerciseLogs(exId);
  const lastLog = pastLogs[pastLogs.length - 1];

  let rowsHtml = '';
  if (isIso) {
    rowsHtml = `
      <div class="log-row-grid" style="font-size:11px; font-weight:800; color:#38bdf8; padding-bottom:4px; border-bottom:1px solid var(--border-color);">
        <span>ست</span>
        <span>وزنه اضافه (kg)</span>
        <span>مدت زمان (ثانیه)</span>
        <span>TIR / زمان ذخیره</span>
      </div>
    `;
    for (let i = 1; i <= currentLogTarget.setsCount; i++) {
      const lastSet = lastLog?.sets?.[i - 1] || {};
      rowsHtml += `
        <div class="log-row-grid" style="margin-top:6px;">
          <span style="font-weight:800; color:#cbd5e1; font-size:12px;">ست ${i}</span>
          <input type="number" step="0.5" id="logWeight_${i}" class="form-input" placeholder="${lastSet.weight ? 'قبلی: ' + lastSet.weight : '۰'}" value="${lastSet.weight || ''}" style="text-align:center; font-weight:700; padding:6px;">
          <input type="number" id="logReps_${i}" class="form-input" placeholder="${lastSet.reps ? 'قبلی: ' + lastSet.reps : 'مثلاً ۳۰'}" value="${lastSet.reps || ''}" style="text-align:center; font-weight:700; padding:6px;">
          <select id="logRir_${i}" class="form-select" style="padding:6px; font-size:11.5px;">
            <option value="0" ${lastSet.rir==='0'?'selected':''}>TIR 0 (۰ ثانیه - ناتوانی/لرزش)</option>
            <option value="1" ${lastSet.rir==='1'?'selected':''}>TIR 1 (۳ تا ۵ ثانیه تا ناتوانی)</option>
            <option value="2" ${(!lastSet.rir || lastSet.rir==='2')?'selected':''}>TIR 2 (۶ تا ۱۰ ثانیه - بهینه و علمی)</option>
            <option value="3" ${lastSet.rir==='3'?'selected':''}>TIR 3 (۱۱ تا ۱۵ ثانیه ذخیره)</option>
            <option value="4" ${lastSet.rir==='4'?'selected':''}>TIR 4+ (بیش از ۱۵ ثانیه ذخیره)</option>
          </select>
        </div>
      `;
    }
    rowsHtml += `
      <div style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.2); border-radius:8px; padding:6px 10px; margin-top:8px; font-size:11px; color:#94a3b8; line-height:1.5;">
        💡 <b>پروتکل علمی TIR (Time In Reserve):</b> در ایزومتریک RIR بر حسب ثانیه تا ناتوانی یا لرزش عضلانی سنجیده می‌شود (TIR 2 یعنی ۶ الی ۱۰ ثانیه قبل از افتادن کیفیت فرم متوقف شده‌اید).
      </div>
    `;
  } else {
    rowsHtml = `
      <div class="log-row-grid" style="font-size:11.5px; font-weight:800; color:#38bdf8; padding-bottom:4px; border-bottom:1px solid var(--border-color);">
        <span>ست</span>
        <span>وزنه (kg)</span>
        <span>تعداد تکرار</span>
        <span>RIR (تکرار ذخیره)</span>
      </div>
    `;
    for (let i = 1; i <= currentLogTarget.setsCount; i++) {
      const lastSet = lastLog?.sets?.[i - 1] || {};
      rowsHtml += `
        <div class="log-row-grid" style="margin-top:6px;">
          <span style="font-weight:800; color:#cbd5e1; font-size:12px;">ست ${i}</span>
          <input type="number" step="0.5" id="logWeight_${i}" class="form-input" placeholder="${lastSet.weight ? 'قبلی: ' + lastSet.weight : 'مثلاً ۵۰'}" value="${lastSet.weight || ''}" style="text-align:center; font-weight:700; padding:6px;">
          <input type="number" id="logReps_${i}" class="form-input" placeholder="${lastSet.reps ? 'قبلی: ' + lastSet.reps : 'مثلاً ۱۰'}" value="${lastSet.reps || ''}" style="text-align:center; font-weight:700; padding:6px;">
          <select id="logRir_${i}" class="form-select" style="padding:6px; font-size:12px;">
            <option value="0" ${lastSet.rir==='0'?'selected':''}>0 (ناتوانی کامل)</option>
            <option value="1" ${lastSet.rir==='1'?'selected':''}>1 تکرار ذخیره</option>
            <option value="2" ${(!lastSet.rir || lastSet.rir==='2')?'selected':''}>2 تکرار ذخیره (ایده‌آل)</option>
            <option value="3" ${lastSet.rir==='3'?'selected':''}>3 تکرار ذخیره</option>
            <option value="4" ${lastSet.rir==='4'?'selected':''}>4+ (بسیار سبک)</option>
          </select>
        </div>
      `;
    }
  }

  container.innerHTML = rowsHtml;
  document.getElementById('logNoteInput').value = '';
  document.getElementById('logModal').classList.add('open');
}

function closeLogModal() {
  document.getElementById('logModal').classList.remove('open');
}

function saveExerciseLog() {
  const { exId, exFa, setsCount, isIso } = currentLogTarget;
  const sets = [];
  let totalVolume = 0;

  for (let i = 1; i <= setsCount; i++) {
    const w = parseFloat(document.getElementById(`logWeight_${i}`)?.value) || 0;
    const r = parseInt(document.getElementById(`logReps_${i}`)?.value) || 0;
    const rir = document.getElementById(`logRir_${i}`)?.value || '2';
    sets.push({ setNum: i, weight: w, reps: r, rir: rir });
    totalVolume += (isIso ? r : (w * r));
  }

  const note = document.getElementById('logNoteInput').value.trim();
  const dateStr = new Intl.DateTimeFormat('fa-IR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());

  const logs = getExerciseLogs(exId);
  logs.push({
    timestamp: Date.now(),
    date: dateStr,
    sets: sets,
    totalVolume: totalVolume,
    isIso: isIso,
    note: note
  });

  saveExerciseLogsList(exId, logs);
  closeLogModal();
  showToast(isIso ? `✅ لاگ ایزومتریک "${exFa}" ثبت شد! (${totalVolume} ثانیه مجموع انقباض)` : `✅ لاگ تمرین برای "${exFa}" ثبت شد! (حجم کل: ${totalVolume} kg)`);
}

function openOverloadChartFromLog() {
  closeLogModal();
  openOverloadChart(currentLogTarget.exId, currentLogTarget.exFa);
}

function openLogModalFromChart() {
  closeOverloadChartModal();
  openLogModal(currentLogTarget.exId, currentLogTarget.exFa, currentLogTarget.dayId, currentLogTarget.setsCount);
}

function openOverloadChart(exId, exFa) {
  currentLogTarget.exId = exId;
  currentLogTarget.exFa = exFa;
  const ex = findExerciseById(exId);
  const isIso = isExerciseIsometric(ex);
  document.getElementById('chartModalTitle').innerText = isIso ? `📈 نمودار پیشرفت زمان: ${exFa}` : `📈 نمودار پیشرفت وزنه: ${exFa}`;
  
  const logs = getExerciseLogs(exId);
  const tableBody = document.getElementById('logHistoryTableBody');
  const svg = document.getElementById('overloadSvg');
  const emptyNotice = document.getElementById('chartEmptyNotice');

  if (logs.length === 0) {
    emptyNotice.style.display = 'block';
    svg.style.display = 'none';
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:12px;">هنوز لاگی ثبت نشده است.</td></tr>`;
    document.getElementById('statMaxWeight').innerText = isIso ? '۰ ثانیه' : '۰ kg';
    document.getElementById('statOverloadPct').innerText = '۰٪';
    document.getElementById('statLastVolume').innerText = isIso ? '۰ ثانیه' : '۰ kg';
  } else {
    emptyNotice.style.display = 'none';
    svg.style.display = 'block';

    let maxMetric = 0;
    logs.forEach(l => l.sets.forEach(s => { 
      const metric = isIso ? (s.reps || 0) : (s.weight || 0);
      if (metric > maxMetric) maxMetric = metric; 
    }));
    
    const firstMetric = isIso ? (logs[0].sets[0]?.reps || 1) : (logs[0].sets[0]?.weight || 1);
    const lastMetric = isIso ? (logs[logs.length - 1].sets[0]?.reps || firstMetric) : (logs[logs.length - 1].sets[0]?.weight || firstMetric);
    const overloadPct = firstMetric > 0 ? Math.round(((lastMetric - firstMetric) / firstMetric) * 100) : 0;
    const lastVol = logs[logs.length - 1].totalVolume || 0;

    document.getElementById('statMaxWeight').innerText = isIso ? `${maxMetric} ثانیه` : `${maxMetric} kg`;
    document.getElementById('statOverloadPct').innerText = `${overloadPct >= 0 ? '+' : ''}${overloadPct}٪`;
    document.getElementById('statLastVolume').innerText = isIso ? `${lastVol} ثانیه` : `${lastVol} kg`;

    // Render Table
    tableBody.innerHTML = logs.slice().reverse().map(l => {
      const setsStr = l.sets.map(s => isIso ? (s.weight > 0 ? `${s.weight}kg + ${s.reps}ث` : `${s.reps} ثانیه`) : `${s.weight}kg × ${s.reps}`).join(' | ');
      const rirStr = l.sets.map(s => isIso ? `TIR ${s.rir}` : `RIR ${s.rir}`).join('، ');
      return `
        <tr>
          <td>${l.date}</td>
          <td style="direction:ltr; text-align:right;">${setsStr}</td>
          <td>${rirStr}</td>
          <td><b>${l.totalVolume} ${isIso ? 'ثانیه' : 'kg'}</b></td>
          <td style="font-size:11px; color:#94a3b8;">${l.note || '—'}</td>
        </tr>
      `;
    }).join('');

    // Draw SVG Chart
    renderSvgLineChart(logs, svg, isIso);
  }

  document.getElementById('overloadChartModal').classList.add('open');
}

function closeOverloadChartModal() {
  document.getElementById('overloadChartModal').classList.remove('open');
}

function renderSvgLineChart(logs, svgEl, isIso = false) {
  const points = logs.map((l, i) => {
    const maxVal = Math.max(...l.sets.map(s => (isIso ? (s.reps || 0) : (s.weight || 0))), 0);
    return { x: i, y: maxVal, date: l.date };
  });

  const width = 480;
  const height = 160;
  const padding = 30;

  const maxY = Math.max(...points.map(p => p.y), 10) * 1.15;
  const minY = Math.min(...points.map(p => p.y), 0);

  const getSvgX = (i) => points.length === 1 ? width / 2 : padding + (i / (points.length - 1)) * (width - 2 * padding);
  const getSvgY = (val) => height - padding - ((val - minY) / (maxY - minY || 1)) * (height - 2 * padding);

  let pathD = '';
  let dotsHtml = '';

  points.forEach((p, idx) => {
    const cx = getSvgX(idx);
    const cy = getSvgY(p.y);
    if (idx === 0) pathD += `M ${cx} ${cy}`;
    else pathD += ` L ${cx} ${cy}`;

    const labelText = isIso ? `${p.y}ث` : `${p.y}kg`;
    dotsHtml += `
      <circle cx="${cx}" cy="${cy}" r="5" fill="#00f2fe" stroke="#090d16" stroke-width="2"/>
      <text x="${cx}" y="${cy - 9}" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle">${labelText}</text>
    `;
  });

  svgEl.innerHTML = `
    <!-- Grid Lines -->
    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="3,3"/>
    
    <!-- Path Line -->
    <path d="${pathD}" fill="none" stroke="url(#lineGradient)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Gradients -->
    <defs>
      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#00f2fe"/>
        <stop offset="100%" stop-color="#00e599"/>
      </linearGradient>
    </defs>

    ${dotsHtml}
  `;
}

// --- Exercise Library Explorer ---
function openLibraryModal() {
  renderLibraryList(getAllExercises());
  document.getElementById('libraryModal').classList.add('open');
}

function closeLibraryModal() {
  document.getElementById('libraryModal').classList.remove('open');
}

function renderLibraryList(list) {
  const container = document.getElementById('libraryListContainer');
  if (!list || list.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">حرکتی با این مشخصات یافت نشد. می‌توانید از بخش زیر در MuscleWiki جستجو کنید.</div>';
    return;
  }

  container.innerHTML = list.map(ex => `
    <div class="library-item-card">
      <div class="library-item-top">
        <div>
          <div style="font-size:14.5px; font-weight:800; color:#fff;">${ex.fa}</div>
          ${ex.en ? `<div style="font-size:12px; color:var(--accent-cyan); direction:ltr; text-align:right;">${ex.en}</div>` : ''}
        </div>
        <span class="muscle-tag">${ex.category === 'home' ? '🏠 خانه' : '🏋️ باشگاه'}</span>
      </div>

      <div class="muscles-row" style="margin:6px 0;">
        <span class="muscle-tag">عضلات: ${ex.muscles || 'عمومی'}</span>
        <span class="muscle-tag" style="direction:ltr">${ex.defaultReps || '3 × 8–12'}</span>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; flex-wrap:wrap; gap:6px;">
        <div class="video-links-group">
          ${renderVideoButtons(ex.videos)}
        </div>
        <button class="btn-header-action btn-action-primary" style="padding:4px 9px; font-size:11.5px" onclick="quickAddExFromLibrary('${ex.id}')">
          + افزودن به برنامه
        </button>
      </div>
    </div>
  `).join('');
}

function filterLibrary(term) {
  term = term.toLowerCase().trim();
  const all = getAllExercises();
  if (!term) {
    renderLibraryList(all);
    return;
  }
  const filtered = all.filter(e => 
    e.fa.toLowerCase().includes(term) || 
    (e.en && e.en.toLowerCase().includes(term)) ||
    (e.muscles && e.muscles.toLowerCase().includes(term))
  );
  renderLibraryList(filtered);
}

function filterLibraryCat(cat) {
  const all = getAllExercises();
  if (cat === 'all') {
    renderLibraryList(all);
  } else if (cat === 'gym' || cat === 'home') {
    renderLibraryList(all.filter(e => e.category === cat));
  } else {
    renderLibraryList(all.filter(e => e.muscles && e.muscles.includes(cat)));
  }
}

function quickAddExFromLibrary(exId) {
  const prof = getActiveProfile();
  if (prof.days.length === 0) return;
  const firstDay = prof.days[0];
  if (!firstDay.singles) firstDay.singles = [];
  
  const ex = findExerciseById(exId);
  firstDay.singles.push({
    exId: exId,
    reps: ex.defaultReps || '3 × 8–12',
    sets: 3
  });

  saveProfiles();
  renderApp();
  showToast(`حرکت "${ex.fa}" به روز "${firstDay.title}" اضافه شد!`);
}

// --- MuscleWiki Integration Logic ---
function openMuscleWikiModal() {
  document.getElementById('muscleWikiModal').classList.add('open');
}

function closeMuscleWikiModal() {
  document.getElementById('muscleWikiModal').classList.remove('open');
}

function searchYouTubeDirect() {
  const query = document.getElementById('mwSearchQuery').value.trim();
  if (!query) {
    window.open('https://www.youtube.com/results?search_query=gym+workout+exercise+tutorial', '_blank');
    return;
  }
  const targetUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query + ' exercise form tutorial');
  window.open(targetUrl, '_blank');
}

function searchMuscleWikiDirect() {
  const query = document.getElementById('mwSearchQuery').value.trim();
  if (!query) {
    window.open('https://musclewiki.com/', '_blank');
    return;
  }
  const targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent('site:musclewiki.com ' + query);
  window.open(targetUrl, '_blank');
}

function searchVideosForCustom() {
  const en = document.getElementById('custEnName').value.trim() || document.getElementById('custFaName').value.trim();
  if (!en) {
    window.open('https://musclewiki.com/', '_blank');
    return;
  }
  const targetUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(en + ' workout form tutorial');
  window.open(targetUrl, '_blank');
}

// --- Custom Exercise Modal ---
function openCustomExerciseModal() {
  document.getElementById('custFaName').value = '';
  document.getElementById('custEnName').value = '';
  document.getElementById('custMuscles').value = '';
  document.getElementById('custReps').value = '3 × 10–12';
  document.getElementById('custVideos').value = '';
  document.getElementById('customExerciseModal').classList.add('open');
}

function closeCustomExerciseModal() {
  document.getElementById('customExerciseModal').classList.remove('open');
}

function saveCustomExercise() {
  const fa = document.getElementById('custFaName').value.trim();
  if (!fa) {
    alert('لطفاً نام فارسی حرکت را وارد نمایید.');
    return;
  }

  const en = document.getElementById('custEnName').value.trim();
  const category = document.getElementById('custCategory').value;
  const muscles = document.getElementById('custMuscles').value.trim() || 'سایر';
  const reps = document.getElementById('custReps').value.trim() || '3 × 10–12';
  const rawVideos = document.getElementById('custVideos').value.trim();

  const videos = [];
  if (rawVideos) {
    const lines = rawVideos.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach((url, i) => {
      videos.push({
        title: lines.length === 1 ? 'آموزش ۱' : `آموزش ${i+1}`,
        url: url
      });
    });
  }

  const newEx = {
    id: 'cust_' + Date.now(),
    fa: fa,
    en: en,
    category: category,
    muscles: muscles,
    defaultReps: reps,
    defaultSets: 3,
    videos: videos
  };

  customExercises.push(newEx);
  saveCustomExercises();
  closeCustomExerciseModal();
  renderLibraryList(getAllExercises());
  showToast(`حرکت "${fa}" با موفقیت در بانک حرکات ثبت شد.`);
}

// --- Sets Tracker & Persistence ---
function toggleSet(btn) {
  btn.classList.toggle('done');
  if ('vibrate' in navigator) navigator.vibrate(40);

  const card = btn.closest('.exercise-card');
  const allBtns = card.querySelectorAll('.set-btn');
  card.classList.toggle('completed', Array.from(allBtns).every(b => b.classList.contains('done')));

  saveSetsState();
  updateDayProgress(card.closest('.day-section'));
  updateGreetingText();
}

function saveSetsState() {
  const stateKey = 'chieftain_sets_' + activeProfileId;
  const state = {};
  document.querySelectorAll('.exercise-card').forEach(card => {
    const exId = card.getAttribute('data-ex-id');
    if (exId) {
      state[exId] = Array.from(card.querySelectorAll('.set-btn')).map(b => b.classList.contains('done'));
    }
  });
  localStorage.setItem(stateKey, JSON.stringify(state));
}

function loadSavedSets() {
  try {
    const stateKey = 'chieftain_sets_' + activeProfileId;
    const raw = localStorage.getItem(stateKey);
    if (!raw) return;
    const state = JSON.parse(raw);
    document.querySelectorAll('.exercise-card').forEach(card => {
      const exId = card.getAttribute('data-ex-id');
      if (state[exId]) {
        const btns = card.querySelectorAll('.set-btn');
        btns.forEach((btn, idx) => {
          if (state[exId][idx]) btn.classList.add('done');
        });
        if (btns.length && Array.from(btns).every(b => b.classList.contains('done'))) {
          card.classList.add('completed');
        }
      }
    });
  } catch(e) {}
}

function updateDayProgress(daySec) {
  if (!daySec) return;
  const dayId = daySec.getAttribute('id');
  const btns = daySec.querySelectorAll('.set-btn');
  if (!btns.length) return;
  const doneBtns = daySec.querySelectorAll('.set-btn.done');
  const pct = Math.round((doneBtns.length / btns.length) * 100);

  const fillEl = document.getElementById('prog-' + dayId);
  const textEl = document.getElementById('prog-text-' + dayId);
  if (fillEl) fillEl.style.width = pct + '%';
  if (textEl) textEl.innerText = pct + '٪';

  // Update Complete Celebration Banner
  const completeBanner = document.getElementById('complete-banner-' + dayId);
  if (completeBanner) {
    completeBanner.style.display = pct === 100 ? 'flex' : 'none';
  }

  // Update Nav Tab Pill
  const navPill = document.getElementById('nav-pill-' + dayId);
  if (navPill) {
    navPill.innerText = pct + '٪';
    navPill.style.display = pct > 0 ? 'inline-block' : 'none';
  }

  // Update Global Sticky Progress Bar if this is current day
  const stickyFill = document.getElementById('globalStickyProgress');
  if (stickyFill && daySec.classList.contains('today-highlight')) {
    stickyFill.style.width = pct + '%';
  }
}

function updateAllProgressBars() {
  document.querySelectorAll('.day-section').forEach(sec => updateDayProgress(sec));
  updateGreetingText();
}

// --- Universal Rest & Isometric Timer Engine ---
let timerInterval = null;
let timerRemaining = 90;
let timerInitial = 90;
let isTimerRunning = false;
let currentTimerMode = 'rest'; // 'rest' or 'iso'

const timerDisplay = document.getElementById('timerDisplay');
const timerFab = document.getElementById('openTimerBtn');
const fabLabel = document.getElementById('fabTimerLabel');
const startBtn = document.getElementById('startTimerBtn');
const modalTitle = document.getElementById('timerModalTitle');
const modalDesc = document.getElementById('timerModalDesc');

function switchTimerMode(mode) {
  currentTimerMode = mode;
  document.getElementById('modeRestBtn').classList.toggle('active', mode === 'rest');
  document.getElementById('modeIsoBtn').classList.toggle('active', mode === 'iso');

  if (mode === 'rest') {
    modalTitle.innerText = '⏱️ تایمر استراحت بین ست‌ها';
    modalDesc.innerText = 'برای حفظ ریتم تمرین زمان استراحت را مدیریت کن';
    if (!isTimerRunning) setTimerDuration(90);
  } else {
    modalTitle.innerText = '🧘‍♂️ تایمر حرکات ایزومتریک و نگه‌داشتن';
    modalDesc.innerText = 'زمان‌گیری دقیق برای پلانک، وال‌سیت، دیدباگ و حرکات ایزومتریک';
    if (!isTimerRunning) setTimerDuration(30);
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function updateTimerUI() {
  if (timerDisplay) timerDisplay.innerText = formatTime(timerRemaining);
  if (isTimerRunning) {
    if (fabLabel) fabLabel.innerText = formatTime(timerRemaining);
    if (timerFab) timerFab.classList.add('running');
    if (startBtn) {
      startBtn.innerText = 'توقف ⏸';
      startBtn.className = 'timer-ctl-btn btn-pause';
    }
  } else {
    if (fabLabel) fabLabel.innerText = timerRemaining === timerInitial ? 'تایمر تمرین' : formatTime(timerRemaining);
    if (timerFab) timerFab.classList.remove('running');
    if (startBtn) {
      startBtn.innerText = 'ادامه ⚡';
      startBtn.className = 'timer-ctl-btn btn-start';
    }
  }
}

function setTimerDuration(seconds) {
  clearInterval(timerInterval);
  isTimerRunning = false;
  timerInitial = seconds;
  timerRemaining = seconds;

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.remove('active');
    const text = btn.innerText;
    if (
      (seconds === 20 && text.includes('۲۰')) ||
      (seconds === 30 && text.includes('۳۰')) ||
      (seconds === 45 && text.includes('۴۵')) ||
      (seconds === 60 && text.includes('۶۰')) ||
      (seconds === 90 && text.includes('۹۰')) ||
      (seconds === 120 && text.includes('۲')) ||
      (seconds === 180 && text.includes('۳'))
    ) {
      btn.classList.add('active');
    }
  });

  updateTimerUI();
}

function applyCustomTimer() {
  const m = parseInt(document.getElementById('customMin').value) || 0;
  const s = parseInt(document.getElementById('customSec').value) || 0;
  const total = (m * 60) + s;
  if (total <= 0) {
    alert('لطفاً زمان معتبری وارد کنید.');
    return;
  }
  setTimerDuration(total);
}

function quickStartIsoTimer(seconds, exName) {
  switchTimerMode('iso');
  setTimerDuration(seconds);
  modalTitle.innerText = `🧘‍♂️ تایمر ایزومتریک: ${exName}`;
  openTimerModal();
}

function toggleTimer() {
  if (isTimerRunning) {
    clearInterval(timerInterval);
    isTimerRunning = false;
    updateTimerUI();
  } else {
    if (timerRemaining <= 0) timerRemaining = timerInitial;
    isTimerRunning = true;
    updateTimerUI();

    timerInterval = setInterval(() => {
      timerRemaining--;
      if (timerRemaining <= 0) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        timerRemaining = 0;
        updateTimerUI();
        triggerTimerEndAlarm();
      } else {
        updateTimerUI();
      }
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  isTimerRunning = false;
  timerRemaining = timerInitial;
  updateTimerUI();
}

function quickTimer(seconds) {
  switchTimerMode('rest');
  setTimerDuration(seconds);
  openTimerModal();
}

function triggerTimerEndAlarm() {
  if ('vibrate' in navigator) {
    navigator.vibrate([400, 200, 400, 200, 600]);
  }
  
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    }
  } catch(e) {}

  if (fabLabel) fabLabel.innerText = 'زمان تمام! 🔥';
}

function openTimerModal() {
  document.getElementById('timerModal').classList.add('open');
}

function closeTimerModal() {
  document.getElementById('timerModal').classList.remove('open');
}

timerFab?.addEventListener('click', openTimerModal);

// --- PWA Installation & Date Logic ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

const todayIndex = new Date().getDay(); // 0 = Sunday, 6 = Saturday

function getTodaySectionId() {
  const prof = getActiveProfile();
  // Saturday in JS is 6 -> index 0
  // Sunday in JS is 0 -> index 1
  // Monday in JS is 1 -> index 2, etc.
  const dayIdx = (todayIndex === 6) ? 0 : (todayIndex + 1);
  const targetDay = prof.days[dayIdx] || prof.days[0];
  return targetDay ? targetDay.id : 'd1';
}

document.addEventListener('DOMContentLoaded', () => {
  loadAppData();
  checkUrlSyncData();
  
  if (window.location.hash && !window.location.hash.startsWith('#sync=')) {
    try {
      history.replaceState(null, null, window.location.pathname + window.location.search);
    } catch(err) {}
  }

  renderApp(false);

  // Background Auto-Sync from Cloud on startup
  if (navigator.onLine && isAutoCloudSyncEnabled()) {
    pullFromCloudStorage(true);
  }

  const todaySecId = getTodaySectionId();
  const todaySec = document.getElementById(todaySecId);
  if (todaySec) todaySec.classList.add('today-highlight');

  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.getAttribute('data-target-id') === todaySecId) {
      tab.classList.add('is-today', 'active');
    }
  });
});

document.getElementById('todayJumpBtn')?.addEventListener('click', () => {
  const todaySecId = getTodaySectionId();
  const el = document.getElementById(todaySecId);
  if (el) {
    const navBarHeight = 110;
    const pos = el.getBoundingClientRect().top + (window.scrollY || document.documentElement.scrollTop) - navBarHeight;
    window.scrollTo({ top: pos, behavior: 'smooth' });
  }
});

// Native Asynchronous IntersectionObserver (Zero layout thrashing, 120fps smooth scrolling)
let activeSectionObserver = null;

function setupSectionObserver() {
  if (activeSectionObserver) {
    activeSectionObserver.disconnect();
  }

  activeSectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const secId = entry.target.getAttribute('id');
        if (secId) {
          document.querySelectorAll('.nav-tab').forEach(tab => {
            const isCurrent = tab.getAttribute('data-target-id') === secId;
            tab.classList.toggle('active', isCurrent);
          });

          const btns = entry.target.querySelectorAll('.set-btn');
          if (btns.length) {
            const doneBtns = entry.target.querySelectorAll('.set-btn.done');
            const pct = Math.round((doneBtns.length / btns.length) * 100);
            const stickyFill = document.getElementById('globalStickyProgress');
            if (stickyFill) stickyFill.style.width = pct + '%';
          }
        }
      }
    });
  }, {
    rootMargin: '-10% 0px -65% 0px',
    threshold: 0.05
  });

  document.querySelectorAll('.day-section, .summary-card').forEach(sec => {
    activeSectionObserver.observe(sec);
  });
}

// --- Sync & Cloud Backup / Restore Handlers ---
// --- Chieftain Real-Time Cloud Sync Database Engine ---
const CLOUD_KV_BUCKET = 'https://kvdb.io/BgbDquBYHnhVdJyQMuGqds/';

function getEffectiveCloudKey() {
  let savedKey = localStorage.getItem('chieftain_cloud_sync_key');
  if (!savedKey) {
    savedKey = (activeProfileId === 'hossein_chieftain') ? 'hossein' : (activeProfileId === 'morvarid' ? 'morvarid' : 'user_' + activeProfileId.replace(/[^a-zA-Z0-9]/g, ''));
    localStorage.setItem('chieftain_cloud_sync_key', savedKey);
  }
  return savedKey;
}

function setCloudSyncKey(key) {
  const cleanKey = key.trim().toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '');
  if (!cleanKey) return;
  localStorage.setItem('chieftain_cloud_sync_key', cleanKey);
}

function generateRandomSyncKey() {
  const newKey = 'user_' + Math.random().toString(36).substring(2, 8);
  const input = document.getElementById('cloudSyncKeyInput');
  if (input) input.value = newKey;
  setCloudSyncKey(newKey);
  showToast('🎲 شناسه جدید ابری تولید شد: ' + newKey);
}

function isAutoCloudSyncEnabled() {
  const val = localStorage.getItem('chieftain_auto_cloud_sync');
  return val === null ? true : val === 'true';
}

function toggleAutoCloudSync(enabled) {
  localStorage.setItem('chieftain_auto_cloud_sync', enabled ? 'true' : 'false');
  const badge = document.getElementById('autoSyncStateBadge');
  if (badge) {
    if (enabled) {
      badge.innerHTML = '🟢 روشن و فعال';
      badge.style.background = 'rgba(16,185,129,0.2)';
      badge.style.color = '#34d399';
    } else {
      badge.innerHTML = '⚪ خاموش';
      badge.style.background = 'rgba(148,163,184,0.15)';
      badge.style.color = '#94a3b8';
    }
  }
  showToast(enabled ? '✅ همگام‌سازی خودکار ابری فعال شد' : '⏸ همگام‌سازی خودکار غیرفعال شد');
}

async function pushToCloudStorage(silent = false) {
  const keyInput = document.getElementById('cloudSyncKeyInput');
  if (keyInput && keyInput.value) {
    setCloudSyncKey(keyInput.value);
  }
  const syncKey = getEffectiveCloudKey();
  const badge = document.getElementById('cloudStatusBadge');

  if (badge) {
    badge.innerHTML = '🔄 در حال ارسال...';
    badge.style.color = '#38bdf8';
  }

  const payload = {
    version: 'v8',
    syncKey: syncKey,
    updatedAt: new Date().toISOString(),
    activeId: activeProfileId,
    profiles: allProfiles,
    custom: customExercises
  };

  try {
    const resp = await fetch(CLOUD_KV_BUCKET + syncKey, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      const now = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      if (badge) {
        badge.innerHTML = `🟢 متصل و همگام (${now})`;
        badge.style.color = '#34d399';
      }
      if (!silent) {
        showToast('☁️ تمام برنامه‌ها و تغییرات با موفقیت در سرور ابری ذخیره شدند!');
      }
    } else {
      if (badge) {
        badge.innerHTML = '⚠️ خطا در اتصال';
        badge.style.color = '#f87171';
      }
      if (!silent) alert('خطا در ذخیره ابری: ' + resp.statusText);
    }
  } catch(e) {
    if (badge) {
      badge.innerHTML = '⚠️ آفلاین';
      badge.style.color = '#f87171';
    }
    if (!silent) console.error('Cloud push error:', e);
  }
}

async function pullFromCloudStorage(silent = false) {
  const keyInput = document.getElementById('cloudSyncKeyInput');
  if (keyInput && keyInput.value) {
    setCloudSyncKey(keyInput.value);
  }
  const syncKey = getEffectiveCloudKey();
  const badge = document.getElementById('cloudStatusBadge');

  if (badge) {
    badge.innerHTML = '🔄 در حال دریافت...';
    badge.style.color = '#38bdf8';
  }

  try {
    const resp = await fetch(CLOUD_KV_BUCKET + syncKey);
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.profiles && Array.isArray(data.profiles)) {
        allProfiles = data.profiles;
        if (data.custom) customExercises = data.custom;
        if (data.activeId) activeProfileId = data.activeId;
        saveProfiles();
        saveCustomExercises();
        renderApp();

        const now = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        if (badge) {
          badge.innerHTML = `🟢 همگام با ابر (${now})`;
          badge.style.color = '#34d399';
        }
        if (!silent) {
          showToast('✅ آخرین نسخه برنامه با موفقیت از سرور ابری دریافت و اعمال شد!');
        }
        return true;
      }
    } else if (resp.status === 404) {
      if (!silent) {
        alert('شناسه ابری "' + syncKey + '" هنوز در سرور ابری اطلاعاتی ندارد. لطفاً ابتدا روی "ذخیره در سرور ابری" بزنید.');
      }
    }
  } catch(e) {
    if (!silent) console.error('Cloud pull error:', e);
  }
  return false;
}

async function forceSyncAndHardRefresh(btn) {
  if (btn) {
    btn.style.opacity = '0.5';
    btn.innerHTML = '<span>🔄</span> <span>در حال دریافت...</span>';
  }
  showToast('🔄 در حال استعلام آخرین تغییرات از سرور ابری...');

  // 1. Force update Service Worker cache if online
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        await r.update();
      }
    } catch(e) {}
  }

  // 2. Pull latest from Cloud KV DB
  try {
    const success = await pullFromCloudStorage(true);
    if (success) {
      showToast('🎉 آخرین نسخه برنامه از سرور ابری دریافت و رفرش شد!');
    } else {
      loadAppData();
      renderApp();
      showToast('✅ صفحه با موفقیت به‌روزرسانی و رفرش شد!');
    }
  } catch(e) {
    loadAppData();
    renderApp();
    showToast('✅ رفرش محلی انجام شد.');
  }

  if (btn) {
    btn.style.opacity = '1';
    btn.innerHTML = '<span>🔄</span> <span>به‌روزرسانی و رفرش</span>';
  }
}

// --- Sync Modal UI Handlers ---
function openSyncBackupModal() {
  const syncKey = getEffectiveCloudKey();
  const keyInput = document.getElementById('cloudSyncKeyInput');
  if (keyInput) keyInput.value = syncKey;

  const autoToggle = document.getElementById('autoCloudSyncToggle');
  const isAuto = isAutoCloudSyncEnabled();
  if (autoToggle) autoToggle.checked = isAuto;
  const badge = document.getElementById('autoSyncStateBadge');
  if (badge) {
    if (isAuto) {
      badge.innerHTML = '🟢 روشن و فعال';
      badge.style.background = 'rgba(16,185,129,0.2)';
      badge.style.color = '#34d399';
    } else {
      badge.innerHTML = '⚪ خاموش';
      badge.style.background = 'rgba(148,163,184,0.15)';
      badge.style.color = '#94a3b8';
    }
  }

  const syncInput = document.getElementById('syncUrlDisplayInput');
  try {
    const payload = {
      version: 'v8',
      activeId: activeProfileId,
      profiles: allProfiles,
      custom: customExercises,
      timestamp: Date.now()
    };
    const jsonStr = JSON.stringify(payload);
    const b64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1)));
    const syncUrl = window.location.origin + window.location.pathname + '#sync=' + b64;
    if (syncInput) syncInput.value = syncUrl;
  } catch(e) {}

  document.getElementById('syncBackupModal')?.classList.add('open');
}

function closeSyncBackupModal() {
  document.getElementById('syncBackupModal')?.classList.remove('open');
}

function copyDirectSyncLink() {
  const syncInput = document.getElementById('syncUrlDisplayInput');
  if (syncInput && syncInput.value) {
    syncInput.select();
    syncInput.setSelectionRange(0, 99999);
    try {
      navigator.clipboard.writeText(syncInput.value).then(() => {
        showToast('📋 لینک با موفقیت کپی شد!');
      }).catch(() => {
        document.execCommand('copy');
        showToast('📋 لینک کپی شد!');
      });
    } catch(e) {
      document.execCommand('copy');
      showToast('📋 لینک کپی شد!');
    }
  }
}

function copyRawProfileJson() {
  const prof = getActiveProfile();
  const rawStr = JSON.stringify(prof, null, 2);
  try {
    navigator.clipboard.writeText(rawStr).then(() => {
      showToast('💾 کد تنظیمات کپی شد! آن را برای دستیار بفرستید تا دائمی شود.');
    }).catch(() => {
      prompt('کد زیر را کپی کرده و بفرستید:', rawStr);
    });
  } catch(e) {
    prompt('کد زیر را کپی کرده و بفرستید:', rawStr);
  }
}

function checkUrlSyncData() {
  try {
    const hash = window.location.hash || '';
    if (hash.startsWith('#sync=')) {
      const b64 = hash.replace('#sync=', '');
      const jsonStr = decodeURIComponent(Array.prototype.map.call(atob(b64), (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      const payload = JSON.parse(jsonStr);

      if (payload && payload.profiles && Array.isArray(payload.profiles)) {
        allProfiles = payload.profiles;
        if (payload.custom) customExercises = payload.custom;
        if (payload.activeId) activeProfileId = payload.activeId;
        saveProfiles();
        saveCustomExercises();
        history.replaceState(null, document.title, window.location.pathname);
        showToast('🎉 برنامه‌ها و تغییرات با موفقیت همگام‌سازی و ذخیره شدند!');
      }
    }
  } catch(e) {
    console.error('Error importing sync link:', e);
  }
}

function downloadBackupJson() {
  try {
    const payload = {
      app: 'Chieftain Workout PWA',
      version: 'v8',
      exportDate: new Date().toISOString(),
      activeProfileId: activeProfileId,
      profiles: allProfiles,
      customExercises: customExercises
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chieftain_workout_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📥 فایل پشتیبان با موفقیت دانلود شد!');
  } catch(e) {
    alert('خطا در دانلود پشتیبان: ' + e.message);
  }
}

// --- Reorder & Move Exercise / Superset Engine ---
let moveDayState = { type: 'superset', dayId: '', ssIdx: -1, singleIdx: -1 };

function verifyEditPIN(callback) {
  if (isProfileUnlocked()) {
    callback();
    return;
  }
  pendingActionAfterPin = callback;
  const prof = getActiveProfile();
  document.getElementById('pinModalTitle').innerText = 'تایید دسترسی ویرایش';
  document.getElementById('pinModalDesc').innerText = `برای ویرایش و جابجایی در برنامه «${prof.name}»، لطفاً رمز عبور را وارد کنید:`;
  document.getElementById('profilePinInput').value = '';
  document.getElementById('pinErrorMsg').style.display = 'none';
  document.getElementById('pinModal').classList.add('open');
  setTimeout(() => document.getElementById('profilePinInput').focus(), 200);
}

function moveSupersetItem(dayId, ssIdx, direction) {
  verifyEditPIN(() => {
    const prof = getActiveProfile();
    const day = prof.days.find(d => d.id === dayId);
    if (!day || !day.supersets) return;

    const newIdx = ssIdx + direction;
    if (newIdx < 0 || newIdx >= day.supersets.length) return;

    const temp = day.supersets[ssIdx];
    day.supersets[ssIdx] = day.supersets[newIdx];
    day.supersets[newIdx] = temp;
    saveProfiles();

    const ssWrap = document.getElementById('supersets_' + dayId);
    if (ssWrap) {
      ssWrap.innerHTML = renderDaySupersetsHTML(day);
      loadSavedSets();
      showToast('⚡ ترتیب سوپرست با موفقیت تغییر کرد و ذخیره شد!');
      return;
    }

    renderApp(true);
    showToast('⚡ ترتیب سوپرست با موفقیت تغییر کرد و ذخیره شد!');
  });
}

function moveSingleItem(dayId, singleIdx, direction) {
  verifyEditPIN(() => {
    const prof = getActiveProfile();
    const day = prof.days.find(d => d.id === dayId);
    if (!day || !day.singles) return;

    const newIdx = singleIdx + direction;
    if (newIdx < 0 || newIdx >= day.singles.length) return;

    const temp = day.singles[singleIdx];
    day.singles[singleIdx] = day.singles[newIdx];
    day.singles[newIdx] = temp;
    saveProfiles();

    const singlesWrap = document.getElementById('singles_' + dayId);
    if (singlesWrap) {
      singlesWrap.innerHTML = renderDaySinglesHTML(day);
      loadSavedSets();
      showToast('⚡ ترتیب حرکت با موفقیت تغییر کرد و ذخیره شد!');
      return;
    }

    renderApp(true);
    showToast('⚡ ترتیب حرکت با موفقیت تغییر کرد و ذخیره شد!');
  });
}

// --- Multi-Exercise SuperSet / Tri-Set / Giant-Set Engine ---
let currentAddToSSTarget = { dayId: '', ssIdx: -1 };

function openAddExerciseToSupersetModal(dayId, ssIdx) {
  verifyEditPIN(() => {
    currentAddToSSTarget = { dayId, ssIdx };
    const prof = getActiveProfile();
    const day = prof.days.find(d => d.id === dayId);
    if (!day || !day.supersets || !day.supersets[ssIdx]) return;
    const ss = day.supersets[ssIdx];

    document.getElementById('addExToSupersetTitle').innerText = `⚡ افزودن حرکت به: ${ss.title}`;
    document.getElementById('addExToSupersetSubtitle').innerText = `این سوپرست در حال حاضر شامل ${ss.exercises.length} حرکت است. حرکت جدید را انتخاب کنید:`;

    const allEx = getAllExercises();
    const defaultEx = allEx[0];
    document.getElementById('addExToSSSelectVal').value = defaultEx.id;
    document.getElementById('pickerSelectedDisplayAddToSS').innerText = 'انتخاب شده: ' + defaultEx.fa;
    document.getElementById('pickerSearchAddToSS').value = defaultEx.fa;
    filterPickerOptions('AddToSS', '');

    document.getElementById('addExToSSReps').value = '3 × 10–15';
    document.getElementById('addExToSSSets').value = '3';
    document.getElementById('addExToSSCustomName').value = '';

    document.getElementById('addExToSupersetModal')?.classList.add('open');
  });
}

function closeAddExToSupersetModal() {
  document.getElementById('addExToSupersetModal')?.classList.remove('open');
}

function confirmAddExerciseToSuperset() {
  const { dayId, ssIdx } = currentAddToSSTarget;
  const prof = getActiveProfile();
  const day = prof.days.find(d => d.id === dayId);
  if (!day || !day.supersets || !day.supersets[ssIdx]) return;

  const exId = document.getElementById('addExToSSSelectVal')?.value || getAllExercises()[0].id;
  const reps = document.getElementById('addExToSSReps')?.value.trim() || '3 × 10–15';
  const sets = parseInt(document.getElementById('addExToSSSets')?.value) || 3;
  const customName = document.getElementById('addExToSSCustomName')?.value.trim();

  const newItem = { exId, reps, sets };
  if (customName) newItem.customName = customName;

  day.supersets[ssIdx].exercises.push(newItem);

  saveProfiles();
  closeAddExToSupersetModal();

  const ssWrap = document.getElementById('supersets_' + dayId);
  if (ssWrap) {
    ssWrap.innerHTML = renderDaySupersetsHTML(day);
    loadSavedSets();
    showToast(`⚡ حرکت "${findExerciseById(exId).fa}" با موفقیت به سوپرست اضافه شد! (مجموع: ${day.supersets[ssIdx].exercises.length} حرکت)`);
    return;
  }

  renderApp(true);
  showToast(`⚡ حرکت "${findExerciseById(exId).fa}" با موفقیت به سوپرست اضافه شد! (مجموع: ${day.supersets[ssIdx].exercises.length} حرکت)`);
}

function moveSupersetExercise(dayId, ssIdx, exIdx, direction) {
  verifyEditPIN(() => {
    const prof = getActiveProfile();
    const day = prof.days.find(d => d.id === dayId);
    if (!day || !day.supersets || !day.supersets[ssIdx]) return;

    const list = day.supersets[ssIdx].exercises;
    const newIdx = exIdx + direction;
    if (newIdx < 0 || newIdx >= list.length) return;

    const temp = list[exIdx];
    list[exIdx] = list[newIdx];
    list[newIdx] = temp;

    saveProfiles();

    const ssWrap = document.getElementById('supersets_' + dayId);
    if (ssWrap) {
      ssWrap.innerHTML = renderDaySupersetsHTML(day);
      loadSavedSets();
      showToast('⚡ ترتیب حرکت درون سوپرست تغییر کرد!');
      return;
    }

    renderApp(true);
    showToast('⚡ ترتیب حرکت درون سوپرست تغییر کرد!');
  });
}

function splitSingleExerciseFromSuperset(dayId, ssIdx, exIdx) {
  verifyEditPIN(() => {
    const prof = getActiveProfile();
    const day = prof.days.find(d => d.id === dayId);
    if (!day || !day.supersets || !day.supersets[ssIdx]) return;

    const item = day.supersets[ssIdx].exercises.splice(exIdx, 1)[0];
    if (day.supersets[ssIdx].exercises.length === 0) {
      day.supersets.splice(ssIdx, 1);
    }
    if (!day.singles) day.singles = [];
    day.singles.push(item);

    saveProfiles();

    const ssWrap = document.getElementById('supersets_' + dayId);
    const singlesWrap = document.getElementById('singles_' + dayId);
    if (ssWrap && singlesWrap) {
      ssWrap.innerHTML = renderDaySupersetsHTML(day);
      singlesWrap.innerHTML = renderDaySinglesHTML(day);
      loadSavedSets();
      showToast('✂️ حرکت از سوپرست جدا و به عنوان حرکت تکی ذخیره شد!');
      return;
    }

    renderApp(true);
    showToast('✂️ حرکت از سوپرست جدا و به عنوان حرکت تکی ذخیره شد!');
  });
}

function openMoveDayModal(type, dayId, ssIdx = -1, singleIdx = -1) {
  verifyEditPIN(() => {
    moveDayState = { type, dayId, ssIdx, singleIdx };
    const prof = getActiveProfile();
    const currentDay = prof.days.find(d => d.id === dayId);
    const select = document.getElementById('moveDaySelect');
    const label = document.getElementById('moveDayTargetLabel');

    let itemName = '';
    if (type === 'superset' && currentDay?.supersets?.[ssIdx]) {
      itemName = currentDay.supersets[ssIdx].title;
    } else if (type === 'single' && currentDay?.singles?.[singleIdx]) {
      const ex = findExerciseById(currentDay.singles[singleIdx].exId);
      itemName = ex.fa;
    }

    if (label) {
      label.innerHTML = `انتقال «<b style="color:#00f2fe;">${itemName}</b>» از روز <b>${currentDay?.title || ''}</b> به:`;
    }

    if (select) {
      select.innerHTML = prof.days
        .filter(d => d.id !== dayId)
        .map(d => `<option value="${d.id}">${d.title} (${d.type === 'gym' ? '🏋️ باشگاه' : (d.type === 'home' ? '🏠 خانه' : '🛌 استراحت')})</option>`)
        .join('');
    }

    document.getElementById('moveDayModal')?.classList.add('open');
  });
}

function closeMoveDayModal() {
  document.getElementById('moveDayModal')?.classList.remove('open');
}

function executeMoveDay() {
  const targetDayId = document.getElementById('moveDaySelect')?.value;
  if (!targetDayId) return;

  const prof = getActiveProfile();
  const { type, dayId, ssIdx, singleIdx } = moveDayState;
  const srcDay = prof.days.find(d => d.id === dayId);
  const destDay = prof.days.find(d => d.id === targetDayId);
  if (!srcDay || !destDay) return;

  if (type === 'superset') {
    if (!srcDay.supersets || !srcDay.supersets[ssIdx]) return;
    const item = srcDay.supersets.splice(ssIdx, 1)[0];
    if (!destDay.supersets) destDay.supersets = [];
    destDay.supersets.push(item);
    showToast(`🚀 سوپرست با موفقیت به روز "${destDay.title}" منتقل شد!`);
  } else {
    if (!srcDay.singles || !srcDay.singles[singleIdx]) return;
    const item = srcDay.singles.splice(singleIdx, 1)[0];
    if (!destDay.singles) destDay.singles = [];
    destDay.singles.push(item);
    showToast(`🚀 حرکت با موفقیت به روز "${destDay.title}" منتقل شد!`);
  }

  saveProfiles();
  closeMoveDayModal();
  renderApp(true);
}

function handleRestoreFile(input) {
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && data.profiles && Array.isArray(data.profiles)) {
        allProfiles = data.profiles;
        if (data.customExercises) customExercises = data.customExercises;
        if (data.activeProfileId) activeProfileId = data.activeProfileId;
        saveProfiles();
        saveCustomExercises();
        closeSyncBackupModal();
        renderApp();
        showToast('✅ فایل پشتیبان با موفقیت بازیابی شد!');
      } else {
        alert('فرمت فایل نامعتبر است.');
      }
    } catch(err) {
      alert('خطا در پردازش فایل: ' + err.message);
    }
    input.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

function applyPastedJson() {
  const input = document.getElementById('pasteJsonInput');
  if (!input || !input.value.trim()) {
    alert('لطفاً ابتدا متن JSON را در کادر قرار دهید.');
    return;
  }
  try {
    const data = JSON.parse(input.value.trim());
    if (data && data.profiles && Array.isArray(data.profiles)) {
      allProfiles = data.profiles;
      if (data.customExercises) customExercises = data.customExercises;
      if (data.activeProfileId) activeProfileId = data.activeProfileId;
      saveProfiles();
      saveCustomExercises();
      closeSyncBackupModal();
      renderApp();
      showToast('✅ برنامه با موفقیت از متن JSON اعمال و ذخیره شد!');
      input.value = '';
    } else {
      alert('ساختار کد JSON نامعتبر است.');
    }
  } catch(e) {
    alert('خطا در خواندن کد JSON: ' + e.message);
  }
}

document.getElementById('searchInput')?.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase().trim();
  document.querySelectorAll('.exercise-card, .superset-block').forEach(card => {
    card.style.display = (!term || card.innerText.toLowerCase().includes(term)) ? '' : 'none';
  });
});

// PWA Install Handlers
let deferredPrompt = null;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

const headerInstallBtn = document.getElementById('headerInstallBtn');

if (isStandalone) {
  if (headerInstallBtn) {
    headerInstallBtn.innerHTML = '<span>✓</span> <span>اپ نصب شده</span>';
    headerInstallBtn.style.opacity = '0.7';
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

function showInstallFlow() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
      deferredPrompt = null;
    });
  } else {
    alert('برای نصب روی آیفون: دکمه Share مرورگر و سپس Add to Home Screen را بزنید.\nبرای اندروید: از منوی سه نقطه مرورگر، گزینه Install app را انتخاب کنید.');
  }
}

headerInstallBtn?.addEventListener('click', showInstallFlow);

window.addEventListener('appinstalled', () => {
  if (headerInstallBtn) {
    headerInstallBtn.innerHTML = '<span>✓</span> <span>اپ نصب شده</span>';
    headerInstallBtn.style.opacity = '0.7';
  }
});

// Universal Modal Dismiss Handlers
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-overlay')) {
    closeAllModals();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllModals();
  }
});

// Register Service Worker with Auto Cache-Busting
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.update();
    }).catch((err) => {});
  });
}

// ==========================================================================
// 📏 Anthropometrics & Body Measurements Tracking Engine
// ==========================================================================
let activeMainTab = 'workout'; // 'workout' | 'metrics'

function getProfileBodyMetrics(profId = activeProfileId) {
  try {
    const raw = localStorage.getItem(`chieftain_metrics_${profId}`);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return [];
}

function saveProfileBodyMetrics(profId, metricsList) {
  try {
    localStorage.setItem(`chieftain_metrics_${profId}`, JSON.stringify(metricsList));
    if (typeof pushProfilesToCloudSilent === 'function') {
      pushProfilesToCloudSilent();
    }
  } catch(e) {}
}

function calculateAnthropometrics(m) {
  const weight = parseFloat(m.weight) || 0;
  const height = parseFloat(m.height) || 0;
  const waist = parseFloat(m.waist) || 0;
  const neck = parseFloat(m.neck) || 0;
  const hips = parseFloat(m.hips) || 0;
  const isFemale = m.gender === 'female';

  let bodyFat = null;
  if (m.bodyFatManual && parseFloat(m.bodyFatManual) > 0) {
    bodyFat = parseFloat(m.bodyFatManual);
  } else if (height > 0 && waist > 0 && neck > 0) {
    if (!isFemale && waist > neck) {
      // U.S. Navy Formula for Men
      const denom = 1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height);
      if (denom > 0) bodyFat = Math.max(3, Math.min(50, (495 / denom) - 450));
    } else if (isFemale && hips > 0 && (waist + hips) > neck) {
      // U.S. Navy Formula for Women
      const denom = 1.29579 - 0.35004 * Math.log10(waist + hips - neck) + 0.22100 * Math.log10(height);
      if (denom > 0) bodyFat = Math.max(8, Math.min(60, (495 / denom) - 450));
    }
  }

  let fatMass = null;
  let leanMass = null;
  if (bodyFat !== null && weight > 0) {
    fatMass = weight * (bodyFat / 100);
    leanMass = weight - fatMass;
  }

  let whr = null;
  if (waist > 0 && hips > 0) {
    whr = waist / hips;
  }

  let whtr = null;
  if (waist > 0 && height > 0) {
    whtr = waist / height;
  }

  const shoulders = parseFloat(m.shoulders) || 0;
  let swr = null;
  if (shoulders > 0 && waist > 0) {
    swr = Number((shoulders / waist).toFixed(2));
  }

  const armRight = parseFloat(m.armRight) || 0;
  const armLeft = parseFloat(m.armLeft) || 0;
  const armDiff = (armRight > 0 && armLeft > 0) ? Math.abs(armRight - armLeft) : null;

  const thighRight = parseFloat(m.thighRight) || 0;
  const thighLeft = parseFloat(m.thighLeft) || 0;
  const thighDiff = (thighRight > 0 && thighLeft > 0) ? Math.abs(thighRight - thighLeft) : null;

  return {
    bodyFat: bodyFat !== null ? Number(bodyFat.toFixed(1)) : null,
    fatMass: fatMass !== null ? Number(fatMass.toFixed(1)) : null,
    leanMass: leanMass !== null ? Number(leanMass.toFixed(1)) : null,
    whr: whr !== null ? Number(whr.toFixed(2)) : null,
    whtr: whtr !== null ? Number(whtr.toFixed(2)) : null,
    swr: swr !== null ? swr : null,
    shoulders: shoulders > 0 ? shoulders : null,
    armDiff: armDiff !== null ? Number(armDiff.toFixed(1)) : null,
    thighDiff: thighDiff !== null ? Number(thighDiff.toFixed(1)) : null
  };
}

function switchMainTab(tabName) {
  activeMainTab = tabName;
  const workoutContent = document.getElementById('workoutContent');
  const metricsView = document.getElementById('bodyMetricsView');
  const navTabs = document.querySelectorAll('#dayNav .nav-tab');

  navTabs.forEach(t => t.classList.remove('active'));

  if (tabName === 'metrics') {
    if (workoutContent) workoutContent.style.display = 'none';
    if (metricsView) {
      metricsView.style.display = 'block';
      renderBodyMetricsView();
    }
    const metricsNavTab = document.querySelector('[data-target-id="body-metrics"]');
    if (metricsNavTab) metricsNavTab.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    if (metricsView) metricsView.style.display = 'none';
    if (workoutContent) workoutContent.style.display = 'block';
    const firstNavTab = document.querySelector('#dayNav .nav-tab[data-day="0"]');
    if (firstNavTab) firstNavTab.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function formatDeltaPill(diff, isFatMetric, unit = 'cm') {
  if (diff === null || diff === undefined || isNaN(diff)) {
    return `<span class="delta-pill neutral">-</span>`;
  }
  const rounded = Number(diff.toFixed(1));
  if (rounded === 0) {
    return `<span class="delta-pill neutral">۰.۰ ${unit}</span>`;
  }

  const sign = rounded > 0 ? `+${rounded}` : `${rounded}`;
  if (isFatMetric) {
    // For fat/waist: decrease is good, increase is bad
    const cls = rounded < 0 ? 'good' : 'bad';
    const icon = rounded < 0 ? '▼' : '▲';
    return `<span class="delta-pill ${cls}">${icon} ${sign} ${unit}</span>`;
  } else {
    // For muscle/chest/arms: increase is good, decrease is bad
    const cls = rounded > 0 ? 'good' : 'bad';
    const icon = rounded > 0 ? '▲' : '▼';
    return `<span class="delta-pill ${cls}">${icon} ${sign} ${unit}</span>`;
  }
}

function renderBodyMetricsView() {
  const container = document.getElementById('bodyMetricsView');
  if (!container) return;

  const prof = getActiveProfile();
  const list = getProfileBodyMetrics(prof.id);

  // Sort by timestamp
  list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  let contentHtml = '';

  // Header Bar
  const headerHtml = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px; background:linear-gradient(145deg, rgba(17,26,46,0.95), rgba(12,18,32,0.95)); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:16px; box-shadow:var(--shadow-card);">
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:24px;">📏</span>
          <h2 style="font-size:17px; font-weight:900; color:#fff; margin:0;">داشبورد آنتروپومتری و ابعاد بدنی (${prof.name})</h2>
        </div>
        <p style="font-size:12px; color:var(--text-muted); margin:4px 0 0 0;">
          پایش ماهانه سایز، محاسبه درصد چربی با فرمول ارتش آمریکا (<bdi>U.S. Navy</bdi>) و تحلیل تقارن عضلانی
        </p>
      </div>

      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn-header-action btn-action-primary" style="font-weight:800;" onclick="openAddBodyMetricModal()">
          <span>➕</span> <span>ثبت اندازه‌گیری جدید</span>
        </button>
        ${list.length > 0 ? `
          <button class="btn-header-action" onclick="openBodyMetricHistoryModal()" title="مشاهده تاریخچه تمام ${list.length} رکورد">
            <span>📜</span> <span>تاریخچه (${list.length})</span>
          </button>
        ` : ''}
        <button class="btn-header-action" onclick="switchMainTab('workout')" style="border-color:rgba(255,255,255,0.15);">
          <span>🏋️</span> <span>بازگشت به تمرینات</span>
        </button>
      </div>
    </div>
  `;

  if (list.length === 0) {
    // Empty State
    contentHtml = `
      ${headerHtml}
      <div style="background:#111a2e; border:1px dashed var(--border-color); border-radius:var(--radius-lg); padding:36px 20px; text-align:center;">
        <div style="font-size:48px; margin-bottom:12px;">📏✨</div>
        <h3 style="color:#fff; font-size:18px; font-weight:800; margin-bottom:8px;">هنوز اندازه‌ای برای ${prof.name} ثبت نشده است!</h3>
        <p style="color:var(--text-muted); font-size:13px; max-width:520px; margin:0 auto 20px auto; line-height:1.7;">
          با ثبت ماهانه اندازه‌های دور سینه، بازو، کمر، شکم، باسن و ران، برنامه به صورت خودکار درصد چربی، حجم عضلانی خالص و نسبت تقارن بدن شما را محاسبه و مقایسه می‌کند.
        </p>
        <button class="btn-header-action btn-action-success" style="padding:12px 24px; font-size:14px; font-weight:800; margin:0 auto;" onclick="openAddBodyMetricModal()">
          <span>➕</span> <span>ثبت اولین اندازه‌گیری ماهانه</span>
        </button>
      </div>
    `;
  } else {
    const current = list[list.length - 1];
    const prev = list.length > 1 ? list[list.length - 2] : null;
    const baseline = list[0];

    const curSci = calculateAnthropometrics(current);
    const prevSci = prev ? calculateAnthropometrics(prev) : null;
    const baseSci = calculateAnthropometrics(baseline);

    const diffWeightLast = prev ? (current.weight - prev.weight) : null;
    const diffWeightBase = current.weight - baseline.weight;

    const diffWaistLast = prev ? (current.waist - prev.waist) : null;
    const diffWaistBase = current.waist - baseline.waist;

    const diffBfLast = (curSci.bodyFat !== null && prevSci?.bodyFat !== null) ? (curSci.bodyFat - prevSci.bodyFat) : null;
    const diffBfBase = (curSci.bodyFat !== null && baseSci?.bodyFat !== null) ? (curSci.bodyFat - baseSci.bodyFat) : null;

    const diffLeanLast = (curSci.leanMass !== null && prevSci?.leanMass !== null) ? (curSci.leanMass - prevSci.leanMass) : null;
    const diffLeanBase = (curSci.leanMass !== null && baseSci?.leanMass !== null) ? (curSci.leanMass - baseSci.leanMass) : null;

    // WHR Health Tag
    let whrLabel = 'استاندارد';
    let whrClass = 'good';
    if (curSci.whr !== null) {
      if (current.gender === 'female') {
        if (curSci.whr <= 0.80) { whrLabel = 'فرم ساعت‌شنی عالی ✨'; whrClass = 'good'; }
        else if (curSci.whr <= 0.85) { whrLabel = 'متوسط ⚠️'; whrClass = 'neutral'; }
        else { whrLabel = 'تجمع چربی شکمی 🔴'; whrClass = 'bad'; }
      } else {
        if (curSci.whr <= 0.90) { whrLabel = 'V-Taper ایده‌آل ✨'; whrClass = 'good'; }
        else if (curSci.whr <= 0.99) { whrLabel = 'متوسط ⚠️'; whrClass = 'neutral'; }
        else { whrLabel = 'چربی احشایی بالا 🔴'; whrClass = 'bad'; }
      }
    }

    // Hero Grid
    const heroGridHtml = `
      <div class="metrics-hero-grid">
        <!-- Card 1: Weight -->
        <div class="metrics-hero-card">
          <div class="metric-hero-label">
            <span>⚖️ وزن کنونی</span>
            <span style="font-size:10px; color:#38bdf8; background:rgba(56,189,248,0.1); padding:2px 6px; border-radius:6px;">${current.date}</span>
          </div>
          <div class="metric-hero-val">${current.weight || '--'} <small>kg</small></div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <div style="font-size:10.5px; color:var(--text-muted);">نسبت به شروع:</div>
            ${formatDeltaPill(diffWeightBase, false, 'kg')}
          </div>
        </div>

        <!-- Card 2: Navy Body Fat % -->
        <div class="metrics-hero-card">
          <div class="metric-hero-label">
            <span>🔬 درصد چربی (Navy)</span>
            <span style="font-size:10px; color:#34d399; background:rgba(52,211,153,0.1); padding:2px 6px; border-radius:6px;">ارتش آمریکا</span>
          </div>
          <div class="metric-hero-val" style="color:#00f2fe;">${curSci.bodyFat !== null ? curSci.bodyFat + '%' : '--'}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <div style="font-size:10.5px; color:var(--text-muted);">عضله خالص (LBM):</div>
            <span style="font-size:11px; font-weight:800; color:#34d399;">${curSci.leanMass !== null ? curSci.leanMass + ' kg' : '--'}</span>
          </div>
        </div>

        <!-- Card 3: Waist & WHR -->
        <div class="metrics-hero-card">
          <div class="metric-hero-label">
            <span>🎯 دور کمر و WHR</span>
            <span style="font-size:10px; color:#facc15; background:rgba(250,204,21,0.1); padding:2px 6px; border-radius:6px;">سلامت متابولیک</span>
          </div>
          <div class="metric-hero-val" style="color:#facc15;">${current.waist || '--'} <small>cm</small></div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <div style="font-size:10.5px; color:var(--text-muted);">نسبت کمر به باسن:</div>
            <span class="delta-pill ${whrClass}">${curSci.whr !== null ? curSci.whr + ' (' + whrLabel + ')' : '--'}</span>
          </div>
        </div>

        <!-- Card 4: Muscle Symmetry -->
        <div class="metrics-hero-card">
          <div class="metric-hero-label">
            <span>📐 تقارن عضلانی</span>
            <span style="font-size:10px; color:#a855f7; background:rgba(168,85,247,0.1); padding:2px 6px; border-radius:6px;">راست vs چپ</span>
          </div>
          <div class="metric-hero-val" style="font-size:18px; color:#c084fc;">
            ${curSci.armDiff !== null ? `بازو: ${curSci.armDiff}cm` : 'متقارن'}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <div style="font-size:10.5px; color:var(--text-muted);">اختلاف ران:</div>
            <span style="font-size:11px; font-weight:800; color:#cbd5e1;">${curSci.thighDiff !== null ? curSci.thighDiff + ' cm' : '--'}</span>
          </div>
        </div>
      </div>
    `;

    // Comparison Rows Definition
    const rowsData = [
      // Group 1: Body Composition
      { isGroup: true, title: '⚖️ وزن و ترکیب بدنی (Body Composition)' },
      { label: 'وزن بدن (Weight)', key: 'weight', unit: 'kg', isFat: false, baseVal: baseline.weight, prevVal: prev?.weight, curVal: current.weight },
      { label: 'درصد چربی تخمینی (Navy Body Fat)', key: 'bodyFat', unit: '%', isFat: true, baseVal: baseSci.bodyFat, prevVal: prevSci?.bodyFat, curVal: curSci.bodyFat },
      { label: 'توده خالص عضلانی (Lean Body Mass)', key: 'leanMass', unit: 'kg', isFat: false, baseVal: baseSci.leanMass, prevVal: prevSci?.leanMass, curVal: curSci.leanMass },
      { label: 'توده چربی بدن (Fat Mass)', key: 'fatMass', unit: 'kg', isFat: true, baseVal: baseSci.fatMass, prevVal: prevSci?.fatMass, curVal: curSci.fatMass },

      // Group 2: Upper Body
      { isGroup: true, title: '📐 ابعاد بالاتنه (Upper Body)' },
      { label: 'دور گردن (Neck - ارتش آمریکا)', key: 'neck', unit: 'cm', isFat: true, baseVal: baseline.neck, prevVal: prev?.neck, curVal: current.neck },
      { label: 'دور سرشانه / دلتوئید (Shoulders 👑)', key: 'shoulders', unit: 'cm', isFat: false, baseVal: baseline.shoulders, prevVal: prev?.shoulders, curVal: current.shoulders },
      { label: 'دور سینه (Chest)', key: 'chest', unit: 'cm', isFat: false, baseVal: baseline.chest, prevVal: prev?.chest, curVal: current.chest },
      { label: 'دور بازوی راست منقبض (Right Arm)', key: 'armRight', unit: 'cm', isFat: false, baseVal: baseline.armRight, prevVal: prev?.armRight, curVal: current.armRight },
      { label: 'دور بازوی چپ منقبض (Left Arm)', key: 'armLeft', unit: 'cm', isFat: false, baseVal: baseline.armLeft, prevVal: prev?.armLeft, curVal: current.armLeft },

      // Group 3: Core & Waist
      { isGroup: true, title: '🎯 میان‌تنه و شکم (Core & Waist)' },
      { label: 'دور کمر (باریک‌ترین نقطه)', key: 'waist', unit: 'cm', isFat: true, baseVal: baseline.waist, prevVal: prev?.waist, curVal: current.waist },
      { label: 'دور شکم (دقیقاً از روی ناف)', key: 'abdomen', unit: 'cm', isFat: true, baseVal: baseline.abdomen, prevVal: prev?.abdomen, curVal: current.abdomen },
      { label: 'دور زیر شکم (بالای استخوان لگن)', key: 'lowerBelly', unit: 'cm', isFat: true, baseVal: baseline.lowerBelly, prevVal: prev?.lowerBelly, curVal: current.lowerBelly },
      { label: 'نسبت سرشانه به کمر (Adonis V-Taper)', key: 'swr', unit: '', isFat: false, baseVal: baseSci.swr, prevVal: prevSci?.swr, curVal: curSci.swr },
      { label: 'نسبت دور کمر به باسن (WHR)', key: 'whr', unit: '', isFat: true, baseVal: baseSci.whr, prevVal: prevSci?.whr, curVal: curSci.whr },
      { label: 'نسبت دور کمر به قد (WHtR)', key: 'whtr', unit: '', isFat: true, baseVal: baseSci.whtr, prevVal: prevSci?.whtr, curVal: curSci.whtr },

      // Group 4: Lower Body
      { isGroup: true, title: '🦵 ابعاد پایین‌تنه (Lower Body)' },
      { label: 'دور باسن / سرینی (Hips/Glutes)', key: 'hips', unit: 'cm', isFat: false, baseVal: baseline.hips, prevVal: prev?.hips, curVal: current.hips },
      { label: 'دور ران راست میانی (وسط زانو تا باسن)', key: 'thighRight', unit: 'cm', isFat: false, baseVal: baseline.thighRight, prevVal: prev?.thighRight, curVal: current.thighRight },
      { label: 'دور ران چپ میانی (وسط زانو تا باسن)', key: 'thighLeft', unit: 'cm', isFat: false, baseVal: baseline.thighLeft, prevVal: prev?.thighLeft, curVal: current.thighLeft },
      { label: 'دور ساق پا (Calves)', key: 'calves', unit: 'cm', isFat: false, baseVal: baseline.calves, prevVal: prev?.calves, curVal: current.calves }
    ];

    const tableRowsHtml = rowsData.map(r => {
      if (r.isGroup) {
        return `<tr class="metrics-group-header"><td colspan="6">${r.title}</td></tr>`;
      }

      const curVal = r.curVal !== null && r.curVal !== undefined ? parseFloat(r.curVal) : null;
      const prevVal = r.prevVal !== null && r.prevVal !== undefined ? parseFloat(r.prevVal) : null;
      const baseVal = r.baseVal !== null && r.baseVal !== undefined ? parseFloat(r.baseVal) : null;

      const deltaLast = (curVal !== null && prevVal !== null) ? (curVal - prevVal) : null;
      const deltaBase = (curVal !== null && baseVal !== null) ? (curVal - baseVal) : null;

      const formatVal = (v) => v !== null && v > 0 ? `${v} <span style="font-size:10px; color:var(--text-muted);">${r.unit}</span>` : '<span style="color:#64748b;">--</span>';

      return `
        <tr>
          <td style="font-weight:700; color:#fff;">${r.label}</td>
          <td style="color:#94a3b8; text-align:center;">${formatVal(baseVal)}</td>
          <td style="color:#94a3b8; text-align:center;">${formatVal(prevVal)}</td>
          <td style="color:#00f2fe; font-weight:800; text-align:center; font-size:13.5px;">${formatVal(curVal)}</td>
          <td style="text-align:center;">${formatDeltaPill(deltaLast, r.isFat, r.unit)}</td>
          <td style="text-align:center;">${formatDeltaPill(deltaBase, r.isFat, r.unit)}</td>
        </tr>
      `;
    }).join('');

    const matrixTableHtml = `
      <div style="background:#111a2e; border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:16px; margin-bottom:20px; box-shadow:var(--shadow-card);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div style="font-size:14px; font-weight:800; color:#fff; display:flex; align-items:center; gap:6px;">
            <span>📊</span> <span>جدول جامع مقایسه و تغییرات ابعاد بدنی</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn-move-action" style="color:#38bdf8; border-color:rgba(56,189,248,0.4);" onclick="openAddBodyMetricModal('${current.id}')">✏️ ویرایش این رکورد</button>
            <button class="btn-move-action" style="color:#34d399; border-color:rgba(52,211,153,0.4);" onclick="openAddBodyMetricModal()">➕ رکورد جدید</button>
          </div>
        </div>

        <div class="table-container" style="overflow-x:auto;">
          <table class="metrics-matrix-table">
            <thead>
              <tr>
                <th>گروه / شاخص</th>
                <th style="text-align:center;">نقطه شروع (${baseline.date})</th>
                <th style="text-align:center;">رکورد قبلی (${prev ? prev.date : '--'})</th>
                <th style="text-align:center; color:#00f2fe;">اندازه کنونی (${current.date})</th>
                <th style="text-align:center;">تغییر نسبت به قبل (Δ Last)</th>
                <th style="text-align:center;">تغییر کل از شروع (Δ Total)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // --- Detailed Scientific Analysis & Interpretation Report ---
    let bfAnalysis = '';
    if (curSci.bodyFat !== null) {
      if (current.gender === 'female') {
        if (curSci.bodyFat < 16) bfAnalysis = 'تفکیک عضلانی بسیار بالا و چربی فوق‌العاده پایین (ورزشکار حرفه‌ای).';
        else if (curSci.bodyFat <= 22) bfAnalysis = 'سطح چربی ایده‌آل برای فیتنس بانوان و هایپرتروفی همراه با سلامت کامل.';
        else if (curSci.bodyFat <= 28) bfAnalysis = 'محدوده سلامت نرمال و پایدار.';
        else bfAnalysis = 'پیشنهاد: فاز ملایم چربی‌سوزی با کنترل کالری و حفظ توده عضلانی.';
      } else {
        if (curSci.bodyFat < 10) bfAnalysis = 'سطح چربی بسیار پایین و کات مسابقه‌ای (تراشیدگی کامل عضلات).';
        else if (curSci.bodyFat <= 15) bfAnalysis = 'محدوده طلایی فیتنس و بدنسازی (عضلات مشخص + شادابی هورمونی).';
        else if (curSci.bodyFat <= 20) bfAnalysis = 'محدوده سلامت عمومی و بالک تمیز.';
        else bfAnalysis = 'پیشنهاد: تمرکز بر کات و چربی‌سوزی تدریجی در کنار تمرینات پرفشار.';
      }
    }

    let adonisAnalysis = '';
    if (curSci.swr !== null) {
      if (curSci.swr >= 1.60) adonisAnalysis = '🎉 تبریک! بالاتنه شما به نسبت طلایی کلاسیک (۱.۶۱۸) و V-Taper اصیل رسیده است.';
      else if (curSci.swr >= 1.45) adonisAnalysis = 'فرم V-Taper بسیار خوب با پتانسیل عالی؛ با رشد دلتوئید جانبی به نسبت طلایی ۱.۶۱۸ خواهید رسید.';
      else adonisAnalysis = 'برای رسیدن به نسبت V-Taper، تمرکز بر هایپرتروفی سرشانه و باریک‌تر کردن دور کمر توصیه می‌شود.';
    }

    let symmetryAnalysis = '';
    if (curSci.armDiff !== null || curSci.thighDiff !== null) {
      const maxDiff = Math.max(curSci.armDiff || 0, curSci.thighDiff || 0);
      if (maxDiff <= 0.5) symmetryAnalysis = 'تقارن عضلانی در اندام‌های چپ و راست فوق‌العاده متوازن و استاندارد است. 🎯';
      else if (maxDiff <= 1.2) symmetryAnalysis = `اختلاف جزئی (${maxDiff} سانتی‌متر) کاملاً طبیعی است؛ برای بالانس بیشتر از دمبل و سیم‌کش استفاده کنید.`;
      else symmetryAnalysis = `عدم تقارن قابل توجه (${maxDiff} سانتی‌متر)؛ ست‌ها را با اندام ضعیف‌تر شروع کنید و حجم مساوی بزنید.`;
    }

    const reportCardHtml = `
      <div style="background:linear-gradient(145deg, #131f38, #182848); border:1px solid rgba(56,189,248,0.3); border-radius:var(--radius-lg); padding:16px; margin-bottom:16px; box-shadow:var(--shadow-card);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; flex-wrap:wrap; gap:6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:20px;">🧠</span>
            <h3 style="font-size:14px; font-weight:900; color:#38bdf8; margin:0;">گزارش تحلیلی و بادی‌آنالیز هوشمند (${prof.name})</h3>
          </div>
          <span style="font-size:11px; background:rgba(0,242,254,0.15); color:#00f2fe; padding:2px 8px; border-radius:8px; font-weight:800;">تحلیل بر پایه آخرین یافته‌های علمی</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:10px;">
          ${curSci.bodyFat !== null ? `
            <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px;">
              <div style="font-size:11.5px; font-weight:800; color:#34d399; margin-bottom:4px;">🔬 تحلیل توده چربی و عضله خالص:</div>
              <div style="font-size:11px; color:#cbd5e1; line-height:1.6;">
                درصد چربی شما <b>${curSci.bodyFat}٪</b> (معادل <b>${curSci.fatMass} کیلو چربی</b>) و توده عضلانی خالص شما <b>${curSci.leanMass} کیلوگرم</b> است.
                <div style="color:#38bdf8; margin-top:3px;">${bfAnalysis}</div>
              </div>
            </div>
          ` : ''}

          ${curSci.swr !== null ? `
            <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px;">
              <div style="font-size:11.5px; font-weight:800; color:#facc15; margin-bottom:4px;">👑 تحلیل نسبت طلایی سرشانه (Adonis Index):</div>
              <div style="font-size:11px; color:#cbd5e1; line-height:1.6;">
                نسبت سرشانه به کمر شما <b>${curSci.swr}</b> است (هدف طلایی: ۱.۶۱۸).
                <div style="color:#fde047; margin-top:3px;">${adonisAnalysis}</div>
              </div>
            </div>
          ` : ''}

          ${curSci.whr !== null ? `
            <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px;">
              <div style="font-size:11.5px; font-weight:800; color:#38bdf8; margin-bottom:4px;">🎯 سلامت متابولیک و چربی احشایی (WHR):</div>
              <div style="font-size:11px; color:#cbd5e1; line-height:1.6;">
                نسبت دور کمر به باسن: <b>${curSci.whr}</b> · وضعیت: <span class="delta-pill ${whrClass}">${whrLabel}</span>
                <div style="color:#94a3b8; margin-top:3px;">نشان‌دهنده توزیع سالم چربی و عدم ریسک چربی احشایی در اطراف اندام‌های داخلی.</div>
              </div>
            </div>
          ` : ''}

          ${symmetryAnalysis ? `
            <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px;">
              <div style="font-size:11.5px; font-weight:800; color:#c084fc; margin-bottom:4px;">📐 ارزیابی تقارن و تعادل ساختاری:</div>
              <div style="font-size:11px; color:#cbd5e1; line-height:1.6;">
                ${symmetryAnalysis}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    contentHtml = `
      ${headerHtml}
      ${heroGridHtml}
      ${reportCardHtml}
      ${matrixTableHtml}
    `;
  }

  container.innerHTML = contentHtml;
}

// --- Modal Handlers for Body Metrics ---
function openAddBodyMetricModal(recordId = null) {
  const prof = getActiveProfile();
  const list = getProfileBodyMetrics(prof.id);
  const modal = document.getElementById('addBodyMetricModal');
  if (!modal) return;

  document.getElementById('metricRecordId').value = recordId || '';

  if (recordId) {
    const item = list.find(m => m.id === recordId);
    if (item) {
      document.getElementById('addBodyMetricModalTitle').innerText = `ویرایش اندازه‌گیری (${prof.name})`;
      document.getElementById('metricDateInput').value = item.date || '';
      document.getElementById('metricTimeInput').value = item.time || '';
      document.getElementById('metricConditionSelect').value = item.condition || 'fasted_morning';
      document.getElementById('metricGenderSelect').value = item.gender || 'male';
      document.getElementById('metricWeightInput').value = item.weight || '';
      document.getElementById('metricHeightInput').value = item.height || '';
      document.getElementById('metricNeckInput').value = item.neck || '';
      document.getElementById('metricShouldersInput').value = item.shoulders || '';
      document.getElementById('metricChestInput').value = item.chest || '';
      document.getElementById('metricArmRightInput').value = item.armRight || '';
      document.getElementById('metricArmLeftInput').value = item.armLeft || '';
      document.getElementById('metricWaistInput').value = item.waist || '';
      document.getElementById('metricAbdomenInput').value = item.abdomen || '';
      document.getElementById('metricLowerBellyInput').value = item.lowerBelly || '';
      document.getElementById('metricHipsInput').value = item.hips || '';
      document.getElementById('metricThighRightInput').value = item.thighRight || '';
      document.getElementById('metricThighLeftInput').value = item.thighLeft || '';
      document.getElementById('metricCalvesInput').value = item.calves || '';
      document.getElementById('metricBodyFatManualInput').value = item.bodyFatManual || '';
      document.getElementById('metricNotesInput').value = item.notes || '';
    }
  } else {
    document.getElementById('addBodyMetricModalTitle').innerText = `ثبت اندازه‌گیری جدید (${prof.name})`;
    const now = new Date();
    const dStr = now.toLocaleDateString('fa-IR');
    const tStr = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    const last = list.length > 0 ? list[list.length - 1] : null;
    document.getElementById('metricDateInput').value = dStr;
    document.getElementById('metricTimeInput').value = tStr;
    document.getElementById('metricConditionSelect').value = 'fasted_morning';
    document.getElementById('metricGenderSelect').value = last?.gender || (prof.name.includes('مروارید') ? 'female' : 'male');
    document.getElementById('metricWeightInput').value = last?.weight || '';
    document.getElementById('metricHeightInput').value = last?.height || '';
    document.getElementById('metricNeckInput').value = last?.neck || '';
    document.getElementById('metricShouldersInput').value = last?.shoulders || '';
    document.getElementById('metricChestInput').value = last?.chest || '';
    document.getElementById('metricArmRightInput').value = last?.armRight || '';
    document.getElementById('metricArmLeftInput').value = last?.armLeft || '';
    document.getElementById('metricWaistInput').value = last?.waist || '';
    document.getElementById('metricAbdomenInput').value = last?.abdomen || '';
    document.getElementById('metricLowerBellyInput').value = last?.lowerBelly || '';
    document.getElementById('metricHipsInput').value = last?.hips || '';
    document.getElementById('metricThighRightInput').value = last?.thighRight || '';
    document.getElementById('metricThighLeftInput').value = last?.thighLeft || '';
    document.getElementById('metricCalvesInput').value = last?.calves || '';
    document.getElementById('metricBodyFatManualInput').value = '';
    document.getElementById('metricNotesInput').value = '';
  }

  modal.classList.add('open');
}

function closeAddBodyMetricModal() {
  document.getElementById('addBodyMetricModal')?.classList.remove('open');
}

function saveBodyMetricRecord() {
  const prof = getActiveProfile();
  const list = getProfileBodyMetrics(prof.id);
  const recordId = document.getElementById('metricRecordId').value;

  const dateVal = document.getElementById('metricDateInput').value.trim() || new Date().toLocaleDateString('fa-IR');
  const timeVal = document.getElementById('metricTimeInput').value.trim() || new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  const conditionVal = document.getElementById('metricConditionSelect').value;
  const genderVal = document.getElementById('metricGenderSelect').value;

  const weightVal = parseFloat(document.getElementById('metricWeightInput').value) || 0;
  const heightVal = parseFloat(document.getElementById('metricHeightInput').value) || 0;

  if (weightVal <= 0) {
    alert('لطفاً وزن خود را وارد کنید.');
    return;
  }

  const record = {
    id: recordId || ('m_' + Date.now()),
    timestamp: Date.now(),
    date: dateVal,
    time: timeVal,
    condition: conditionVal,
    gender: genderVal,
    weight: weightVal,
    height: heightVal,
    neck: parseFloat(document.getElementById('metricNeckInput').value) || 0,
    shoulders: parseFloat(document.getElementById('metricShouldersInput').value) || 0,
    chest: parseFloat(document.getElementById('metricChestInput').value) || 0,
    armRight: parseFloat(document.getElementById('metricArmRightInput').value) || 0,
    armLeft: parseFloat(document.getElementById('metricArmLeftInput').value) || 0,
    waist: parseFloat(document.getElementById('metricWaistInput').value) || 0,
    abdomen: parseFloat(document.getElementById('metricAbdomenInput').value) || 0,
    lowerBelly: parseFloat(document.getElementById('metricLowerBellyInput').value) || 0,
    hips: parseFloat(document.getElementById('metricHipsInput').value) || 0,
    thighRight: parseFloat(document.getElementById('metricThighRightInput').value) || 0,
    thighLeft: parseFloat(document.getElementById('metricThighLeftInput').value) || 0,
    calves: parseFloat(document.getElementById('metricCalvesInput').value) || 0,
    bodyFatManual: parseFloat(document.getElementById('metricBodyFatManualInput').value) || 0,
    notes: document.getElementById('metricNotesInput').value.trim()
  };

  if (recordId) {
    const idx = list.findIndex(m => m.id === recordId);
    if (idx >= 0) {
      record.timestamp = list[idx].timestamp; // keep original timestamp
      list[idx] = record;
    } else {
      list.push(record);
    }
  } else {
    list.push(record);
  }

  saveProfileBodyMetrics(prof.id, list);
  closeAddBodyMetricModal();
  switchMainTab('metrics');
  showToast('✅ رکورد با موفقیت ثبت شد و بادی‌آنالیز هوشمند محاسبه گردید!');
}

function openBodyMetricHistoryModal() {
  const prof = getActiveProfile();
  const list = getProfileBodyMetrics(prof.id);
  const modal = document.getElementById('bodyMetricHistoryModal');
  const container = document.getElementById('metricHistoryListContainer');
  if (!modal || !container) return;

  list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">هیچ رکوردی ثبت نشده است.</div>';
  } else {
    container.innerHTML = list.map((item, idx) => {
      const sci = calculateAnthropometrics(item);
      return `
        <div style="background:#152033; border:1px solid var(--border-color); border-radius:10px; padding:10px 12px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <div style="font-weight:800; color:#fff; font-size:13px;">
              <span>📅 ${item.date} (${item.time || ''})</span>
              <span style="font-size:11px; color:#38bdf8; margin-right:6px;">⚖️ ${item.weight} kg</span>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:3px;">
              دور کمر: <b>${item.waist || '--'}cm</b> · دور شکم: <b>${item.abdomen || '--'}cm</b> · چربی Navy: <b>${sci.bodyFat !== null ? sci.bodyFat + '%' : '--'}</b>
              ${item.notes ? ` · <span style="color:#fcd34d;">📌 ${item.notes}</span>` : ''}
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn-move-action" style="color:#38bdf8; border-color:rgba(56,189,248,0.4);" onclick="closeBodyMetricHistoryModal(); openAddBodyMetricModal('${item.id}');">✏️</button>
            <button class="btn-move-action" style="color:#f87171; border-color:rgba(248,113,113,0.4);" onclick="deleteBodyMetricRecord('${item.id}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  modal.classList.add('open');
}

function closeBodyMetricHistoryModal() {
  document.getElementById('bodyMetricHistoryModal')?.classList.remove('open');
}

function deleteBodyMetricRecord(id) {
  const prof = getActiveProfile();
  let list = getProfileBodyMetrics(prof.id);
  const item = list.find(m => m.id === id);
  if (!item) return;

  if (confirm(`آیا از حذف رکورد اندازه‌گیری تاریخ «${item.date}» اطمینان دارید؟`)) {
    list = list.filter(m => m.id !== id);
    saveProfileBodyMetrics(prof.id, list);
    openBodyMetricHistoryModal();
    renderBodyMetricsView();
    showToast('🗑️ رکورد با موفقیت حذف شد.');
  }
}

// ==========================================================================
// 🖐️ Drag and Drop Reordering Engine (Mouse & Mobile Touch)
// ==========================================================================
function setupDragAndDropEngine() {
  const daySections = document.querySelectorAll('.day-section');
  
  daySections.forEach(daySec => {
    const dayId = daySec.id;

    // 1. Singles Drag & Drop (Desktop)
    const singlesWrap = document.getElementById('singles_' + dayId);
    if (singlesWrap) {
      const cards = singlesWrap.querySelectorAll(':scope > .exercise-card');
      cards.forEach((card, idx) => {
        card.setAttribute('draggable', 'true');
        
        card.ondragstart = (e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'single', dayId, idx }));
          card.classList.add('is-dragging');
        };

        card.ondragend = () => {
          card.classList.remove('is-dragging');
          singlesWrap.querySelectorAll('.drop-target-hover').forEach(el => el.classList.remove('drop-target-hover'));
        };

        card.ondragover = (e) => {
          e.preventDefault();
          card.classList.add('drop-target-hover');
        };

        card.ondragleave = () => {
          card.classList.remove('drop-target-hover');
        };

        card.ondrop = (e) => {
          e.preventDefault();
          card.classList.remove('drop-target-hover');
          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'single' && data.dayId === dayId && data.idx !== idx) {
              reorderSingleArray(dayId, data.idx, idx);
            }
          } catch(err) {}
        };
      });
    }

    // 2. Supersets Drag & Drop (Desktop)
    const supersetsWrap = document.getElementById('supersets_' + dayId);
    if (supersetsWrap) {
      const ssBlocks = supersetsWrap.querySelectorAll(':scope > .superset-block');
      ssBlocks.forEach((block, ssIdx) => {
        block.setAttribute('draggable', 'true');

        block.ondragstart = (e) => {
          if (e.target.closest('.exercise-card')) return;
          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'superset', dayId, ssIdx }));
          block.classList.add('is-dragging');
        };

        block.ondragend = () => {
          block.classList.remove('is-dragging');
          supersetsWrap.querySelectorAll('.drop-target-hover').forEach(el => el.classList.remove('drop-target-hover'));
        };

        block.ondragover = (e) => {
          e.preventDefault();
          block.classList.add('drop-target-hover');
        };

        block.ondragleave = () => {
          block.classList.remove('drop-target-hover');
        };

        block.ondrop = (e) => {
          e.preventDefault();
          block.classList.remove('drop-target-hover');
          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'superset' && data.dayId === dayId && data.ssIdx !== ssIdx) {
              reorderSupersetArray(dayId, data.ssIdx, ssIdx);
            }
          } catch(err) {}
        };

        // 3. Reorder inside superset (Desktop)
        const innerCards = block.querySelectorAll(':scope > .exercise-card');
        innerCards.forEach((innerCard, exIdx) => {
          innerCard.setAttribute('draggable', 'true');

          innerCard.ondragstart = (e) => {
            e.stopPropagation();
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'superset_ex', dayId, ssIdx, exIdx }));
            innerCard.classList.add('is-dragging');
          };

          innerCard.ondragend = () => {
            innerCard.classList.remove('is-dragging');
            block.querySelectorAll('.drop-target-hover').forEach(el => el.classList.remove('drop-target-hover'));
          };

          innerCard.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            innerCard.classList.add('drop-target-hover');
          };

          innerCard.ondragleave = () => {
            innerCard.classList.remove('drop-target-hover');
          };

          innerCard.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            innerCard.classList.remove('drop-target-hover');
            try {
              const data = JSON.parse(e.dataTransfer.getData('text/plain'));
              if (data.type === 'superset_ex' && data.dayId === dayId && data.ssIdx === ssIdx && data.exIdx !== exIdx) {
                reorderSupersetExerciseArray(dayId, ssIdx, data.exIdx, exIdx);
              }
            } catch(err) {}
          };
        });
      });
    }
  });

  setupTouchDragDrop();
}

function reorderSingleArray(dayId, fromIdx, toIdx) {
  verifyEditPIN(() => {
    const prof = getActiveProfile();
    const day = prof.days.find(d => d.id === dayId);
    if (!day || !day.singles) return;
    const item = day.singles.splice(fromIdx, 1)[0];
    day.singles.splice(toIdx, 0, item);
    saveProfiles();
    const singlesWrap = document.getElementById('singles_' + dayId);
    if (singlesWrap) {
      singlesWrap.innerHTML = renderDaySinglesHTML(day);
      loadSavedSets();
      setupDragAndDropEngine();
      showToast('⚡ ترتیب حرکت با موفقیت تغییر کرد!');
    }
  });
}

function reorderSupersetArray(dayId, fromIdx, toIdx) {
  verifyEditPIN(() => {
    const prof = getActiveProfile();
    const day = prof.days.find(d => d.id === dayId);
    if (!day || !day.supersets) return;
    const item = day.supersets.splice(fromIdx, 1)[0];
    day.supersets.splice(toIdx, 0, item);
    saveProfiles();
    const ssWrap = document.getElementById('supersets_' + dayId);
    if (ssWrap) {
      ssWrap.innerHTML = renderDaySupersetsHTML(day);
      loadSavedSets();
      setupDragAndDropEngine();
      showToast('⚡ ترتیب سوپرست با موفقیت تغییر کرد!');
    }
  });
}

function reorderSupersetExerciseArray(dayId, ssIdx, fromIdx, toIdx) {
  verifyEditPIN(() => {
    const prof = getActiveProfile();
    const day = prof.days.find(d => d.id === dayId);
    if (!day || !day.supersets?.[ssIdx]) return;
    const list = day.supersets[ssIdx].exercises;
    const item = list.splice(fromIdx, 1)[0];
    list.splice(toIdx, 0, item);
    saveProfiles();
    const ssWrap = document.getElementById('supersets_' + dayId);
    if (ssWrap) {
      ssWrap.innerHTML = renderDaySupersetsHTML(day);
      loadSavedSets();
      setupDragAndDropEngine();
      showToast('⚡ ترتیب حرکت درون سوپرست تغییر کرد!');
    }
  });
}

function setupTouchDragDrop() {
  const handles = document.querySelectorAll('.card-drag-handle');
  handles.forEach(handle => {
    let draggedCard = null;
    let parentContainer = null;
    let initialCards = [];

    handle.ontouchstart = (e) => {
      draggedCard = handle.closest('.exercise-card') || handle.closest('.superset-block');
      if (!draggedCard) return;
      parentContainer = draggedCard.parentElement;
      initialCards = Array.from(parentContainer.children);
      draggedCard.classList.add('is-dragging');
    };

    handle.ontouchmove = (e) => {
      if (!draggedCard) return;
      e.preventDefault();
      const touch = e.touches[0];
      const hoveredEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetCard = hoveredEl?.closest('.exercise-card') || hoveredEl?.closest('.superset-block');
      
      parentContainer.querySelectorAll('.drop-target-hover').forEach(el => el.classList.remove('drop-target-hover'));
      if (targetCard && targetCard !== draggedCard && targetCard.parentElement === parentContainer) {
        targetCard.classList.add('drop-target-hover');
      }
    };

    handle.ontouchend = () => {
      if (!draggedCard) return;
      draggedCard.classList.remove('is-dragging');
      const targetCard = parentContainer.querySelector('.drop-target-hover');
      if (targetCard) {
        targetCard.classList.remove('drop-target-hover');
        const fromIdx = initialCards.indexOf(draggedCard);
        const toIdx = initialCards.indexOf(targetCard);
        if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
          const daySec = draggedCard.closest('.day-section');
          const dayId = daySec?.id;
          const isSS = draggedCard.classList.contains('superset-block');
          const isInnerSS = !!draggedCard.closest('.superset-block') && !isSS;

          if (isInnerSS) {
            const ssBlock = draggedCard.closest('.superset-block');
            const ssIdx = parseInt(ssBlock.id.split('_').pop());
            reorderSupersetExerciseArray(dayId, ssIdx, fromIdx, toIdx);
          } else if (isSS) {
            reorderSupersetArray(dayId, fromIdx, toIdx);
          } else {
            reorderSingleArray(dayId, fromIdx, toIdx);
          }
        }
      }
      draggedCard = null;
    };
  });
}

