// --- Application State Management ---
let customExercises = [];
let allProfiles = [];
let activeProfileId = 'hossein_chieftain';
let activeDayForAdding = null;

const WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'روز تمرینی ۱', 'روز تمرینی ۲', 'روز تمرینی ۳', 'روز تمرینی ۴'];

function loadAppData() {
  try {
    const rawCustEx = localStorage.getItem('chieftain_custom_exercises');
    if (rawCustEx) customExercises = JSON.parse(rawCustEx);
  } catch(e) { customExercises = []; }

  try {
    const rawProfiles = localStorage.getItem('chieftain_profiles_v3');
    if (rawProfiles) {
      allProfiles = JSON.parse(rawProfiles);
    } else {
      // First time loading v3 or upgrading from old version:
      // Ensure Hossein profile has full 7 days (including Saturday) and pin: 'gym'
      const defaultProf = JSON.parse(JSON.stringify(HOSSEIN_PROFILE));
      defaultProf.pin = 'gym';
      allProfiles = [defaultProf];
      localStorage.setItem('chieftain_profiles_v3', JSON.stringify(allProfiles));
    }

    // Auto-heal check: if Hossein profile has lost Saturday (d1) or has fewer than 7 days, automatically restore it!
    const hProf = allProfiles.find(p => p.id === 'hossein_chieftain');
    if (hProf) {
      if (!hProf.pin) hProf.pin = 'gym';
      if (!hProf.days || hProf.days.length < 7 || !hProf.days.some(d => d.id === 'd1' || d.title === 'شنبه')) {
        hProf.days = JSON.parse(JSON.stringify(HOSSEIN_PROFILE.days));
      }
    } else {
      const defaultProf = JSON.parse(JSON.stringify(HOSSEIN_PROFILE));
      defaultProf.pin = 'gym';
      allProfiles.unshift(defaultProf);
    }
    saveProfiles();
  } catch(e) {
    const defaultProf = JSON.parse(JSON.stringify(HOSSEIN_PROFILE));
    defaultProf.pin = 'gym';
    allProfiles = [defaultProf];
  }

  const savedActiveId = localStorage.getItem('chieftain_active_profile_id');
  if (savedActiveId && allProfiles.some(p => p.id === savedActiveId)) {
    activeProfileId = savedActiveId;
  } else {
    activeProfileId = 'hossein_chieftain';
  }
}

function saveProfiles() {
  localStorage.setItem('chieftain_profiles_v3', JSON.stringify(allProfiles));
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
    muscles: 'نامشخص',
    videos: [],
    defaultReps: '3 × 8–12',
    defaultSets: 3
  };
}

function getActiveProfile() {
  return allProfiles.find(p => p.id === activeProfileId) || HOSSEIN_PROFILE;
}

// --- UI Rendering Engine ---
function renderApp() {
  renderProfileSelect();
  renderHeader();
  renderDayNav();
  renderWorkoutDays();
  loadSavedSets();
  updateAllProgressBars();
}

function renderProfileSelect() {
  const select = document.getElementById('profileSelect');
  select.innerHTML = allProfiles.map(p => 
    `<option value="${p.id}" ${p.id === activeProfileId ? 'selected' : ''}>${p.name} ${p.isDefault ? '(پیش‌فرض)' : ''}</option>`
  ).join('');
}

function renderHeader() {
  const prof = getActiveProfile();
  const titleEl = document.getElementById('appTitle');
  if (prof.id === 'hossein_chieftain') {
    titleEl.innerText = 'برنامه تمرینی Hossein Chieftain';
  } else {
    titleEl.innerText = 'برنامه تمرینی ' + prof.name;
  }

  const deleteBtn = document.getElementById('deleteProfileBtn');
  if (deleteBtn) {
    deleteBtn.style.display = prof.isDefault ? 'none' : 'inline-flex';
  }

  const hour = new Date().getHours();
  const greetingEl = document.getElementById('greetingText');
  if (greetingEl) {
    if (hour >= 5 && hour < 12) {
      greetingEl.innerText = `صبح بخیر ${prof.name}! وقت انرژی و ساختن عضلاته ⚡`;
    } else if (hour >= 12 && hour < 18) {
      greetingEl.innerText = `عصر بخیر ${prof.name}! آماده یک جلسه تمرینی پرقدرت هستی؟ 💪`;
    } else {
      greetingEl.innerText = `شب بخیر ${prof.name}! ریکاوری و ثبات کلید موفقیته 🔥`;
    }
  }
}

function renderDayNav() {
  const prof = getActiveProfile();
  const nav = document.getElementById('dayNav');
  
  const tabsHtml = prof.days.map((d, idx) => {
    const typeLabel = d.type === 'gym' ? 'باشگاه' : (d.type === 'home' ? 'خانه' : 'استراحت');
    return `<a href="#${d.id}" class="nav-tab" data-day="${idx}">${d.title} <span class="tab-badge">${typeLabel}</span></a>`;
  }).join('');

  nav.innerHTML = tabsHtml + `<a href="#weekly-summary" class="nav-tab" data-day="summary">📊 جمع‌بندی</a>`;
}

function renderVideoButtons(videos) {
  if (!videos || videos.length === 0) {
    return `<span class="video-missing">آموزش متنی / بزودی</span>`;
  }

  if (videos.length === 1) {
    return `<a href="${videos[0].url}" target="_blank" rel="noopener" class="video-btn">
      <span>▶</span> <span>ویدیو آموزش</span>
    </a>`;
  }

  return videos.map((v, i) => `
    <a href="${v.url}" target="_blank" rel="noopener" class="video-btn">
      <span>▶</span> <span>${v.title || ('ویدیو ' + (i+1))}</span>
    </a>
  `).join('');
}

function renderExerciseCard(item, dayId, isSuperset = false) {
  const ex = findExerciseById(item.exId);
  const reps = item.reps || ex.defaultReps || '3 × 8–12';
  const setsCount = item.sets || ex.defaultSets || 3;

  const setBtns = Array.from({length: setsCount}, (_, i) => 
    `<button class="set-btn" onclick="toggleSet(this)">${i+1}</button>`
  ).join('');

  return `
    <article class="exercise-card" data-ex-id="${dayId}_${ex.id}">
      <div class="exercise-header">
        <div>
          <div class="exercise-name-fa">${ex.fa}</div>
          ${ex.en ? `<div class="exercise-name-en">${ex.en}</div>` : ''}
        </div>
        <div class="reps-badge">${reps}</div>
      </div>
      <div class="muscles-row">
        <span class="muscle-tag">عضلات هدف: ${ex.muscles || 'عمومی'}</span>
      </div>
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

function renderWorkoutDays() {
  const prof = getActiveProfile();
  const container = document.getElementById('workoutContent');

  const daysHtml = prof.days.map(day => {
    const typeBadge = {
      'gym': '<span class="day-location-badge badge-gym">🏋️ باشگاه</span>',
      'home': '<span class="day-location-badge badge-home">🏠 خانه</span>',
      'rest': '<span class="day-location-badge badge-rest">🛌 استراحت کامل</span>'
    }[day.type] || '';

    let supersetsHtml = '';
    if (day.supersets && day.supersets.length > 0) {
      supersetsHtml = day.supersets.map(ss => `
        <div class="superset-block">
          <div class="superset-header">⚡ ${ss.title}</div>
          ${ss.exercises.map(item => renderExerciseCard(item, day.id, true)).join('')}
        </div>
      `).join('');
    }

    let singlesHtml = '';
    if (day.singles && day.singles.length > 0) {
      singlesHtml = day.singles.map(item => renderExerciseCard(item, day.id, false)).join('');
    }

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

        ${day.note ? `
          <div class="session-note">
            <span>📌</span>
            <span>${day.note}</span>
          </div>
        ` : ''}

        ${supersetsHtml}
        ${singlesHtml}
        ${restHtml}
        ${treadmillHtml}
      </section>
    `;
  }).join('');

  const summaryCardHtml = `
    <section id="weekly-summary" class="summary-card">
      <div class="day-header">
        <div class="day-title-wrap">
          <h2 class="day-title">📊 جمع‌بندی حجم هفتگی عضلات</h2>
          <span class="day-location-badge badge-gym">ست مستقیم</span>
        </div>
      </div>

      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
        ست‌های مستقیم برنامه جدا از تحریک غیرمستقیم حرکات مرکب نمایش داده شده‌اند.
      </p>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>عضله</th>
              <th>ست مستقیم / هفته</th>
              <th>دفعات در هفته</th>
              <th>یادداشت و حرکات</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><b>سینه</b></td><td><span class="set-highlight">12 ست</span></td><td>۳ بار</td><td>حجم هدف اصلی (اسمیت بالا سینه، پرس سینه دستگاه، فلای)</td></tr>
            <tr><td><b>چهارسر</b></td><td><span class="set-highlight">9 ست</span></td><td>۲–۳ بار</td><td>هک اسکوات، پرس پا، جلوپا دستگاه</td></tr>
            <tr><td><b>همسترینگ</b></td><td><span class="set-highlight">12 ست</span></td><td>۳ بار</td><td>پشت‌پا دستگاه + ددلیفت رومانیایی (RDL)</td></tr>
            <tr><td><b>ساق پا</b></td><td><span class="set-highlight">9 ست</span></td><td>۳ بار</td><td>ساق روی هک اسکوات</td></tr>
            <tr><td><b>داخل ران</b></td><td><span class="set-highlight">6 ست</span></td><td>۲ بار</td><td>اداکشن کابل (Cable Adduction)</td></tr>
            <tr><td><b>خارج ران</b></td><td><span class="set-highlight">6 ست</span></td><td>۲ بار</td><td>ابداکشن کابل (Cable Abduction)</td></tr>
            <tr><td><b>فیله / کمر</b></td><td><span class="set-highlight">9 ست</span></td><td>۳ بار</td><td>بک اکستنشن (Back Extension)</td></tr>
            <tr><td><b>شکم</b></td><td><span class="set-highlight">6 ست</span></td><td>۲ بار</td><td>کرانچ ایستاده کابل + کرانچ نیمکت</td></tr>
            <tr><td><b>مورب شکمی</b></td><td><span class="set-highlight">تمرین خانه</span></td><td>۳ بار</td><td>ساید پلانک ایزومتریک</td></tr>
            <tr><td><b>زیر بغل / لت</b></td><td><span class="set-highlight">6 ست</span></td><td>۲ بار</td><td>لت سیم‌کش + یوفو زیر بغل</td></tr>
            <tr><td><b>پشت میانی</b></td><td><span class="set-highlight">6 ست</span></td><td>۲ بار</td><td>یوفو زیر بغل + قایقی سیم‌کش</td></tr>
            <tr><td><b>پشت سرشانه</b></td><td><span class="set-highlight">9 ست</span></td><td>۳ بار</td><td>ریورس پک‌دک (Reverse Pec Deck)</td></tr>
            <tr><td><b>سرشانه میانی</b></td><td><span class="set-highlight">6 ست</span></td><td>۲ بار</td><td>نشر جانب دستگاه (Lateral Raise)</td></tr>
            <tr><td><b>جلو بازو</b></td><td><span class="set-highlight">6 ست</span></td><td>۲ بار</td><td>لاری دستگاه + همر کرل لاری</td></tr>
            <tr><td><b>پشت بازو</b></td><td><span class="set-highlight">6 ست</span></td><td>۲ بار</td><td>پشت بازو طناب + پشت بازو بالای سر</td></tr>
            <tr><td><b>کول فوقانی</b></td><td><span class="set-highlight">3 ست</span></td><td>۱ بار</td><td>شراگ دمبل + تحریک روئینگ</td></tr>
            <tr><td><b>ساعد</b></td><td><span>غیرمستقیم</span></td><td>—</td><td>درگیری در Grip و حرکات روئینگ / کرل</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;

  container.innerHTML = daysHtml + summaryCardHtml;
}

// --- PIN & Access Control ---
function requestEditPlanAccess() {
  const prof = getActiveProfile();
  if (prof.pin) {
    document.getElementById('profilePinInput').value = '';
    document.getElementById('pinErrorMsg').style.display = 'none';
    document.getElementById('pinModal').classList.add('open');
    setTimeout(() => document.getElementById('profilePinInput').focus(), 200);
  } else {
    openEditPlanModalDirect();
  }
}

function closePinModal() {
  document.getElementById('pinModal').classList.remove('open');
}

function confirmProfilePin() {
  const prof = getActiveProfile();
  const enteredPin = document.getElementById('profilePinInput').value.trim();

  if (enteredPin === prof.pin) {
    closePinModal();
    openEditPlanModalDirect();
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

function updateProfilePin() {
  const prof = getActiveProfile();
  const newPin = document.getElementById('editProfilePinInput').value.trim();
  prof.pin = newPin;
  saveProfiles();
  alert(newPin ? `رمز عبور برنامه به "${newPin}" تغییر یافت.` : 'رمز عبور این برنامه حذف شد.');
}

// --- Profile Switching & Creation ---
function onProfileChange(newId) {
  activeProfileId = newId;
  localStorage.setItem('chieftain_active_profile_id', newId);
  renderApp();
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
}

function deleteActiveProfile() {
  const prof = getActiveProfile();
  if (prof.isDefault) {
    alert('برنامه اصلی Hossein Chieftain قابل حذف نیست.');
    return;
  }

  if (confirm(`آیا از حذف کامل برنامه "${prof.name}" اطمینان دارید؟`)) {
    allProfiles = allProfiles.filter(p => p.id !== prof.id);
    saveProfiles();
    activeProfileId = 'hossein_chieftain';
    localStorage.setItem('chieftain_active_profile_id', 'hossein_chieftain');
    closeEditPlanModal();
    renderApp();
  }
}

function factoryResetActiveProfile() {
  const prof = getActiveProfile();
  if (confirm(`آیا می‌خواهید تمام روزهای اصلی (شنبه تا جمعه با تمام ۵۱ حرکت) برای "${prof.name}" بازیابی و ریست شوند؟`)) {
    prof.days = JSON.parse(JSON.stringify(HOSSEIN_PROFILE.days));
    if (prof.isDefault) prof.pin = 'gym';
    saveProfiles();
    renderEditPlanDaysList();
    renderApp();
    alert('برنامه ۷ روزه اصلی (شنبه تا جمعه) با موفقیت بازیابی شد! ⚡');
  }
}

function resetCurrentSets() {
  const prof = getActiveProfile();
  if (confirm(`آیا می‌خواهید تمام تیک‌های ست‌های ثبت‌شده برای "${prof.name}" ریست شوند تا جلسه تمرینی جدید را شروع کنید؟`)) {
    localStorage.removeItem('chieftain_sets_' + activeProfileId);
    document.querySelectorAll('.set-btn').forEach(btn => btn.classList.remove('done'));
    document.querySelectorAll('.exercise-card').forEach(card => card.classList.remove('completed'));
    updateAllProgressBars();
    alert('تمام ست‌ها ریست شدند. آماده تمرین جدید! 💪');
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

// --- Detailed Routine & Exercise Editor ---
function renderEditPlanDaysList() {
  const prof = getActiveProfile();
  const container = document.getElementById('editPlanDaysList');

  container.innerHTML = prof.days.map((day, dIdx) => {
    // Supersets List HTML
    let supersetsHtml = '';
    if (day.supersets && day.supersets.length > 0) {
      supersetsHtml = day.supersets.map((ss, ssIdx) => `
        <div style="background:#10192a; border:1px solid rgba(56,189,248,0.25); border-radius:10px; padding:10px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:12px; font-weight:800; color:#38bdf8;">⚡ ${ss.title}</span>
            <button class="btn-header-action" style="padding:2px 7px; font-size:11px; color:#f87171;" onclick="removeSuperset(${dIdx}, ${ssIdx})">حذف سوپرست</button>
          </div>
          ${ss.exercises.map((item, exIdx) => {
            const ex = findExerciseById(item.exId);
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px dashed rgba(255,255,255,0.05); font-size:12.5px;">
                <span>${ex.fa}</span>
                <div style="display:flex; gap:4px; align-items:center;">
                  <input type="text" value="${item.reps || '3 × 8–12'}" class="form-input" style="width:90px; padding:3px 6px; font-size:11.5px; direction:ltr;" onchange="updateSsExReps(${dIdx}, ${ssIdx}, ${exIdx}, this.value)">
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
        return `
          <div style="background:#10192a; border:1px solid var(--border-color); border-radius:8px; padding:8px 10px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:13px; font-weight:700; color:#fff;">${ex.fa}</span>
              ${ex.en ? `<span style="font-size:11px; color:var(--accent-cyan); direction:ltr;">(${ex.en})</span>` : ''}
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <input type="text" value="${item.reps || '3 × 8–12'}" class="form-input" style="width:95px; padding:3px 6px; font-size:11.5px; direction:ltr;" title="تغییر ست و تکرار" onchange="updateSingleExReps(${dIdx}, ${sIdx}, this.value)">
              <button class="btn-header-action" style="padding:2px 6px; font-size:11px;" title="انتقال به بالا" onclick="moveSingleEx(${dIdx}, ${sIdx}, -1)">▲</button>
              <button class="btn-header-action" style="padding:2px 6px; font-size:11px;" title="انتقال به پایین" onclick="moveSingleEx(${dIdx}, ${sIdx}, 1)">▼</button>
              <button class="btn-header-action" style="padding:2px 6px; font-size:11px; color:#f87171;" title="حذف حرکت" onclick="removeSingleEx(${dIdx}, ${sIdx})">✕</button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Week day dropdown options
    const dayOptionsHtml = WEEK_DAYS.map(w => 
      `<option value="${w}" ${day.title === w ? 'selected' : ''}>${w}</option>`
    ).join('');

    return `
      <div style="background:#152033; border:1px solid var(--border-color); border-radius:14px; padding:14px; margin-bottom:14px;">
        <!-- Day Header with Dropdown Day Selector -->
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
            <button class="btn-header-action btn-action-primary" style="padding:5px 10px; font-size:12px;" onclick="openAddExToDayModal('${day.id}')">+ افزودن حرکت</button>
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

function updateSingleExReps(dIdx, sIdx, reps) {
  const prof = getActiveProfile();
  prof.days[dIdx].singles[sIdx].reps = reps;
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

function updateSsExReps(dIdx, ssIdx, exIdx, reps) {
  const prof = getActiveProfile();
  prof.days[dIdx].supersets[ssIdx].exercises[exIdx].reps = reps;
  saveProfiles();
  renderApp();
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
}

// --- Add Exercise to Day Modal ---
function openAddExToDayModal(dayId) {
  activeDayForAdding = dayId;
  const exercises = getAllExercises();
  
  const optionsHtml = exercises.map(e => 
    `<option value="${e.id}">${e.fa} ${e.en ? `(${e.en})` : ''} - ${e.muscles || ''}</option>`
  ).join('');

  document.getElementById('addExSelect1').innerHTML = optionsHtml;
  document.getElementById('addExSelect2').innerHTML = optionsHtml;
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
  const exId1 = document.getElementById('addExSelect1').value;
  const reps1 = document.getElementById('addExReps1').value.trim() || '3 × 8–12';

  if (type === 'single') {
    if (!day.singles) day.singles = [];
    day.singles.push({
      exId: exId1,
      reps: reps1,
      sets: 3
    });
  } else {
    const exId2 = document.getElementById('addExSelect2').value;
    const reps2 = document.getElementById('addExReps2').value.trim() || '3 × 12–20';
    const ex1Obj = findExerciseById(exId1);
    const ex2Obj = findExerciseById(exId2);
    const ssTitle = document.getElementById('addSupersetTitle').value.trim() || `سوپرست · ${ex1Obj.fa} + ${ex2Obj.fa}`;

    if (!day.supersets) day.supersets = [];
    day.supersets.push({
      title: ssTitle,
      exercises: [
        { exId: exId1, reps: reps1, sets: 3 },
        { exId: exId2, reps: reps2, sets: 3 }
      ]
    });
  }

  saveProfiles();
  closeAddExToDayModal();
  renderEditPlanDaysList();
  renderApp();
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
  alert(`حرکت "${ex.fa}" به روز "${firstDay.title}" برنامه اضافه شد!`);
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
  alert(`حرکت "${fa}" با موفقیت در بانک حرکات ثبت شد.`);
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
}

function updateAllProgressBars() {
  document.querySelectorAll('.day-section').forEach(sec => updateDayProgress(sec));
}

// --- Rest Timer Engine ---
let timerInterval = null;
let timerRemaining = 90;
let timerInitial = 90;
let isTimerRunning = false;

const timerDisplay = document.getElementById('timerDisplay');
const timerFab = document.getElementById('openTimerBtn');
const fabLabel = document.getElementById('fabTimerLabel');
const startBtn = document.getElementById('startTimerBtn');

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
    if (fabLabel) fabLabel.innerText = timerRemaining === timerInitial ? 'تایمر استراحت' : formatTime(timerRemaining);
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
    if (btn.innerText.includes(String(seconds)) || (seconds === 120 && btn.innerText.includes('۲'))) {
      btn.classList.add('active');
    }
  });

  updateTimerUI();
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
  setTimerDuration(seconds);
  openTimerModal();
  toggleTimer();
}

function triggerTimerEndAlarm() {
  if ('vibrate' in navigator) {
    navigator.vibrate([300, 150, 300, 150, 500]);
  }
  
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
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

timerFab.addEventListener('click', openTimerModal);

// --- PWA Installation & Date Logic ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

const jsDayToIranian = { 6: 'd1', 0: 'd2', 1: 'd3', 2: 'd4', 3: 'd5', 4: 'd6', 5: 'd7' };
const todayIndex = new Date().getDay();
const todaySectionId = jsDayToIranian[todayIndex] || 'd1';

document.addEventListener('DOMContentLoaded', () => {
  loadAppData();
  renderApp();

  const todaySec = document.getElementById(todaySectionId);
  if (todaySec) todaySec.classList.add('today-highlight');

  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.getAttribute('href') === '#' + todaySectionId) {
      tab.classList.add('is-today', 'active');
    }
  });
});

document.getElementById('todayJumpBtn')?.addEventListener('click', () => {
  document.getElementById(todaySectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

window.addEventListener('scroll', () => {
  let current = '';
  document.querySelectorAll('.day-section, .summary-card').forEach(section => {
    if (window.pageYOffset >= section.offsetTop - 130) {
      current = section.getAttribute('id');
    }
  });

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('href') === '#' + current);
  });
});

document.getElementById('searchInput')?.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase().trim();
  document.querySelectorAll('.exercise-card, .superset-block').forEach(card => {
    card.style.display = (!term || card.innerText.toLowerCase().includes(term)) ? '' : 'none';
  });
});

// PWA Banner & Modals
let deferredPrompt = null;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

const headerInstallBtn = document.getElementById('headerInstallBtn');
const banner = document.getElementById('installBanner');
const bannerInstallBtn = document.getElementById('bannerInstallBtn');
const installModal = document.getElementById('installGuideModal');
const iosGuide = document.getElementById('iosGuideContent');
const androidGuide = document.getElementById('androidGuideContent');
const nativeTriggerBtn = document.getElementById('triggerNativeInstall');

if (isStandalone) {
  if (headerInstallBtn) {
    headerInstallBtn.innerHTML = '<span>✓</span> <span>نصب شده</span>';
    headerInstallBtn.style.opacity = '0.7';
  }
  if (banner) banner.style.display = 'none';
} else {
  if (!sessionStorage.getItem('dismiss_banner')) {
    setTimeout(() => { if (banner) banner.style.display = 'block'; }, 2500);
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (banner) banner.style.display = 'block';
});

function showInstallFlow() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted' && banner) banner.style.display = 'none';
      deferredPrompt = null;
    });
  } else {
    if (isIOS) {
      if (iosGuide) iosGuide.style.display = 'block';
      if (androidGuide) androidGuide.style.display = 'none';
    } else {
      if (iosGuide) iosGuide.style.display = 'none';
      if (androidGuide) androidGuide.style.display = 'block';
    }
    if (installModal) installModal.classList.add('open');
  }
}

headerInstallBtn?.addEventListener('click', showInstallFlow);
bannerInstallBtn?.addEventListener('click', showInstallFlow);

nativeTriggerBtn?.addEventListener('click', () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    closeInstallGuide();
  } else {
    alert('در کروم گوشی، روی ۳ نقطه بالای صفحه بزنید و Install app یا Add to Home Screen را انتخاب کنید.');
  }
});

function closeInstallGuide() {
  if (installModal) installModal.classList.remove('open');
}

function dismissBanner() {
  if (banner) banner.style.display = 'none';
  sessionStorage.setItem('dismiss_banner', '1');
}

window.addEventListener('appinstalled', () => {
  if (banner) banner.style.display = 'none';
  if (headerInstallBtn) headerInstallBtn.innerHTML = '<span>✓</span> <span>نصب شده</span>';
});
