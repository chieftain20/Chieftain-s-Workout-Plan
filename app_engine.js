// --- Application State Management ---
let currentAuthUser = null;
let customExercises = [];
let allProfiles = [];
let activeProfileId = 'template_male';
let activeMainTab = 'workout'; // 'workout' | 'metrics'
let activeDayForAdding = null;
let convertTargetDayIdx = null;
let convertTargetSingleIdx = null;
let pendingActionAfterPin = null;
let currentLang = localStorage.getItem('chieftain_lang') || 'fa';
window.currentLang = currentLang;

// Currently active log target
let currentLogTarget = { exId: '', exFa: '', dayId: '', setsCount: 3 };

const WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'روز تمرینی ۱', 'روز تمرینی ۲', 'روز تمرینی ۳', 'روز تمرینی ۴'];

// --- Multilingual Support (i18n: Persian / English) ---
const I18N = {
  fa: {
    appTitle: 'سامانه تخصصی بدنسازی و تمرین | Chieftain Pro',
    appSubtitle: 'برنامه تخصصی هایپرتروفی، ثبات مفاصل و کنترل تنه',
    planLabel: '📋 برنامه:',
    loginAccount: 'ورود / حساب',
    loginTitle: 'ورود به حساب کاربری اختصاصی یا ثبت‌نام',
    lightMode: 'حالت روز',
    darkMode: 'حالت شب',
    langBtn: 'EN',
    installApp: 'نصب اپ',
    searchPlaceholder: 'جستجوی حرکت یا عضله هدف در برنامه...',
    exerciseBank: 'بانک حرکات',
    newPlan: 'برنامه جدید',
    editPlan: 'ویرایش برنامه',
    resetSets: 'ریست ست‌ها',
    cloudSync: 'همگام‌سازی ابری',
    settings: 'تنظیمات',
    updateRefresh: 'به‌روزرسانی و رفرش',
    bodyAnalysis: 'سایز و بادی‌آنالیز',
    today: 'امروز',
    simpleMode: 'حالت ساده',
    advMode: 'حالت پیشرفته',
    summaryTab: '📊 جمع‌بندی',
    metricsTab: '📏 سایز و ابعاد',
    analysisBadge: 'آنالیز',
    gym: 'باشگاه',
    home: 'خانه',
    rest: 'استراحت',
    fullRest: 'استراحت کامل',
    superset: 'سوپرست',
    exercisesCount: 'حرکت',
    addExerciseToSS: '+ حرکت به سوپرست',
    moveUp: '⬆️ بالا',
    moveDown: '⬇️ پایین',
    moveDay: '📅 تغییر روز',
    splitToSingle: '✂️ تفکیک به تکی',
    targetMuscles: 'عضلات هدف:',
    logWeight: 'لاگ / وزنه',
    chart: 'نمودار',
    edit: 'ویرایش',
    timer: 'تایمر',
    timerSec: 'ث',
    videoGuide: 'ویدیو آموزش',
    formImage: 'تصویر آموزش فرم',
    textGuide: 'آموزش متنی / بزودی',
    workoutTimer: 'تایمر تمرین',
    restDayTitle: 'روز استراحت و ریکاوری کامل',
    restDayDesc: 'امروز بدن شما نیاز به تغذیه با کیفیت، آب‌رسانی کافی و خواب با کیفیت دارد تا عضلات بازسازی شوند.',
    treadmillBanner: '🏃 آخر جلسه: ۱۵ دقیقه تردمیل',
    start15mTimer: 'شروع ۱۵ دقیقه تایمر',
    sessionCompleted: 'جلسه تمرینی {day} ۱۰۰٪ تکمیل شد · خسته نباشی قهرمان! ✨',
    greatRecovery: '💪 ریکاوری عالی',
    templateMale: 'برنامه نمونه آقایان (هایپرتروفی ۵ روزه)',
    templateFemale: 'برنامه نمونه بانوان (تناسب اندام و فرم‌دهی)',
    addToPlan: '+ افزودن به برنامه',
    editMaster: '✏️ مرجع',
    approvePublic: 'تایید بانک عمومی'
  },
  en: {
    appTitle: 'Chieftain Pro | Specialized Workout System',
    appSubtitle: 'Hypertrophy, Joint Stability & Core Control Program',
    planLabel: '📋 Plan:',
    loginAccount: 'Login / Account',
    loginTitle: 'Sign in to personal account or register',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    langBtn: 'FA',
    installApp: 'Install App',
    searchPlaceholder: 'Search exercise or target muscle in plan...',
    exerciseBank: 'Exercise Bank',
    newPlan: 'New Plan',
    editPlan: 'Edit Plan',
    resetSets: 'Reset Sets',
    cloudSync: 'Cloud Sync',
    settings: 'Settings',
    updateRefresh: 'Update & Refresh',
    bodyAnalysis: 'Body Analysis',
    today: 'Today',
    simpleMode: 'Simple Mode',
    advMode: 'Advanced Mode',
    summaryTab: '📊 Summary',
    metricsTab: '📏 Body Metrics',
    analysisBadge: 'Analysis',
    gym: 'Gym',
    home: 'Home',
    rest: 'Rest',
    fullRest: 'Full Rest',
    superset: 'Superset',
    exercisesCount: 'Exercises',
    addExerciseToSS: '+ Exercise to SS',
    moveUp: '⬆️ Up',
    moveDown: '⬇️ Down',
    moveDay: '📅 Move Day',
    splitToSingle: '✂️ Split to Single',
    targetMuscles: 'Target:',
    logWeight: 'Log / Weight',
    chart: 'Chart',
    edit: 'Edit',
    timer: 'Timer',
    timerSec: 's',
    videoGuide: 'Watch Video',
    formImage: 'Form Image',
    textGuide: 'Guide / Coming Soon',
    workoutTimer: 'Workout Timer',
    restDayTitle: 'Full Rest & Recovery Day',
    restDayDesc: 'Today your body needs quality nutrition, adequate hydration, and restorative sleep to rebuild muscle tissue.',
    treadmillBanner: '🏃 Post-workout: 15-min Treadmill',
    start15mTimer: 'Start 15m Timer',
    sessionCompleted: 'Workout session {day} 100% completed · Great job champion! ✨',
    greatRecovery: '💪 Great recovery',
    templateMale: "Men's Sample Plan (5-Day Hypertrophy)",
    templateFemale: "Women's Sample Plan (Tone & Fitness)",
    addToPlan: '+ Add to Plan',
    editMaster: '✏️ Master',
    approvePublic: 'Approve to Public'
  }
};

function t(key, defaultVal) {
  if (I18N[currentLang] && I18N[currentLang][key]) return I18N[currentLang][key];
  if (I18N['fa'] && I18N['fa'][key]) return I18N['fa'][key];
  return defaultVal !== undefined ? defaultVal : key;
}

const MUSCLE_MAP_EN = {
  // Exact phrase mapping for all known combinations
  'Core و کنترل تنه': 'Core & Torso Control',
  'ابلیک و Core': 'Obliques & Core',
  'باسن (سرینی)، همسترینگ': 'Glutes, Hamstrings',
  'باسن و زنجیره خلفی': 'Glutes & Posterior Chain',
  'براکیالیس، براکیورادیالیس، جلو بازو': 'Brachialis, Brachioradialis, Biceps',
  'خارج ران، سرینی میانی': 'Outer Thigh, Glute Medius',
  'خارج ران، سرینی میانی (Glute Medius)': 'Outer Thigh, Glute Medius',
  'داخل ران': 'Inner Thigh / Adductors',
  'داخل ران، چهارسر، باسن، انعطاف لگن': 'Adductors, Quads, Glutes, Hip Mobility',
  'زیر بغل / لت': 'Lats',
  'زیر بغل، جلو بازو': 'Lats, Biceps',
  'زیر بغل، پشت میانی': 'Lats, Mid Back',
  'زیر بغل، پشت میانی، جلو بازو': 'Lats, Mid Back, Biceps',
  'زیر شکم': 'Lower Abs',
  'ساق پا': 'Calves',
  'ساق پا (عضله نعلی / سولئوس)': 'Calves (Soleus)',
  'ساق پا (نعلی)': 'Calves (Soleus)',
  'سراتوس قدامی و کنترل کتف': 'Serratus Anterior & Scapular Control',
  'سرشانه میانی': 'Side Delts',
  'سرشانه جلویی': 'Front Delts',
  'سرشانه خلفی': 'Rear Delts',
  'سرشانه پشتی': 'Rear Delts',
  'سرشانه، پشت بازو': 'Shoulders, Triceps',
  'سرینی بزرگ': 'Gluteus Maximus',
  'سرینی بزرگ و میانی': 'Gluteus Max & Medius',
  'سرینی بزرگ، همسترینگ': 'Gluteus Maximus, Hamstrings',
  'سرینی میانی': 'Gluteus Medius',
  'سرینی میانی و خارج ران': 'Glute Medius & Outer Thigh',
  'سرینی میانی و چرخاننده‌های لگن': 'Glute Medius & Hip Rotators',
  'سرینی میانی و کوچک': 'Glute Medius & Minimus',
  'سرینی میانی و کوچک (خارج باسن)': 'Glute Medius & Minimus',
  'سرینی میانی، خارج ران': 'Glute Medius, Outer Thigh',
  'سینه (بالا سینه)': 'Upper Chest',
  'سینه (بالا سینه)، پشت بازو': 'Upper Chest, Triceps',
  'سینه، سرشانه جلویی، پشت بازو': 'Chest, Front Delts, Triceps',
  'سینه، پشت بازو، سرشانه جلویی': 'Chest, Triceps, Front Delts',
  'شکم / راست شکمی': 'Abs / Rectus Abdominis',
  'شکم، ثبات کمربند شانه‌ای': 'Abs, Shoulder Stability',
  'شکم، ثبات کمربند شانه‌ای، چهارسر': 'Abs, Shoulder Stability, Quads',
  'شکم، سرینی، شانه': 'Abs, Glutes, Shoulders',
  'شکم، مورب شکمی': 'Abs, Obliques',
  'عضلات مرکزی و شکم (Core)': 'Core & Abs',
  'فیله کمر، باسن، همسترینگ': 'Lower Back, Glutes, Hamstrings',
  'فیله کمر، پشت میانی': 'Lower Back, Mid Back',
  'مورب شکمی (ابلیک)': 'Obliques',
  'همسترینگ، باسن، تعادل': 'Hamstrings, Glutes, Balance',
  'همسترینگ، باسن، فیله': 'Hamstrings, Glutes, Lower Back',
  'پشت سرشانه، تراپز و کنترل کتف': 'Rear Delts, Traps & Scapular Control',
  'پشت سرشانه، روتاتور کاف، پشت بالایی': 'Rear Delts, Rotator Cuff, Upper Back',
  'پشت سرشانه، پشت میانی': 'Rear Delts, Mid Back',
  'پشت میانی، زیر بغل، جلو بازو': 'Mid Back, Lats, Biceps',
  'پشت میانی، کول میانی و فوقانی': 'Mid Back, Middle & Upper Traps',
  'چهارسر و ایزومتریک': 'Quads & Isometric',
  'چهارسر، باسن': 'Quads, Glutes',
  'چهارسر، باسن، همسترینگ': 'Quads, Glutes, Hamstrings',
  'چهارسر، داخل ران (ادکتور)، باسن': 'Quads, Adductors, Glutes',
  'چهارسر، داخل ران، باسن': 'Quads, Inner Thigh, Glutes',
  'کتف، ذوزنقه‌ای، زیر بغل و پشت': 'Scapula, Traps, Lats & Back',
  'کنترل کتف و شانه': 'Scapular & Shoulder Control',
  'کول فوقانی (تراپز)': 'Upper Traps',

  // Individual tokens & words
  'سینه': 'Chest',
  'بالا سینه': 'Incline Chest',
  'زیر سینه': 'Decline Chest',
  'پشت / زیر بغل': 'Back / Lats',
  'زیر بغل': 'Lats',
  'پشت': 'Back',
  'پشت میانی': 'Mid Back',
  'پشت بالایی': 'Upper Back',
  'عضلات پشت': 'Back',
  'سرشانه': 'Shoulders',
  'جلو بازو': 'Biceps',
  'پشت بازو': 'Triceps',
  'پا': 'Legs',
  'پا / چهارسر': 'Quads / Legs',
  'چهارسر': 'Quads',
  'همسترینگ': 'Hamstrings',
  'باسن': 'Glutes',
  'سرینی': 'Glutes',
  'سرینی میانی/کوچک': 'Glute Med/Min',
  'ساق': 'Calves',
  'شکم': 'Abs',
  'میان‌تنه': 'Core',
  'شکم / میان‌تنه': 'Abs / Core',
  'ساعد': 'Forearms',
  'گردن': 'Neck',
  'فیله': 'Lower Back',
  'فیله کمر': 'Lower Back',
  'کتف': 'Scapula',
  'ذوزنقه‌ای': 'Traps',
  'تراپز': 'Traps',
  'کول': 'Traps',
  'کول میانی': 'Mid Traps',
  'کول فوقانی': 'Upper Traps',
  'موبیلیتی': 'Mobility',
  'عمومی': 'General'
};

function translateMuscles(musclesStr) {
  if (!musclesStr) return currentLang === 'en' ? 'General' : 'عمومی';
  if (currentLang !== 'en') return musclesStr;
  const trimmed = String(musclesStr).trim();
  if (MUSCLE_MAP_EN[trimmed]) return MUSCLE_MAP_EN[trimmed];

  // Token replacement for any remaining Persian words
  let result = trimmed;
  for (const [fa, en] of Object.entries(MUSCLE_MAP_EN)) {
    result = result.replace(new RegExp(fa, 'g'), en);
  }
  result = result.replace(/،/g, ', ')
                 .replace(/\s+و\s+/g, ' & ')
                 .replace(/\s+/g, ' ')
                 .trim();
  return result;
}

const DAY_MAP_EN = {
  'شنبه': 'Saturday',
  'یکشنبه': 'Sunday',
  'دوشنبه': 'Monday',
  'سه‌شنبه': 'Tuesday',
  'چهارشنبه': 'Wednesday',
  'پنجشنبه': 'Thursday',
  'جمعه': 'Friday',
  'روز تمرینی ۱': 'Training Day 1',
  'روز تمرینی ۲': 'Training Day 2',
  'روز تمرینی ۳': 'Training Day 3',
  'روز تمرینی ۴': 'Training Day 4',
  'روز تمرینی ۵': 'Training Day 5'
};

function translateDayTitle(title) {
  if (!title) return '';
  if (currentLang !== 'en') return title;
  
  if (DAY_MAP_EN[title]) return DAY_MAP_EN[title];

  let result = title;
  for (const [fa, en] of Object.entries(DAY_MAP_EN)) {
    result = result.replace(new RegExp(fa, 'g'), en);
  }
  for (const [fa, en] of Object.entries(MUSCLE_MAP_EN)) {
    result = result.replace(new RegExp(fa, 'g'), en);
  }
  result = result.replace(/باشگاه/g, 'Gym')
                 .replace(/خانه/g, 'Home')
                 .replace(/استراحت کامل/g, 'Full Rest')
                 .replace(/استراحت/g, 'Rest')
                 .replace(/هایپرتروفی/g, 'Hypertrophy')
                 .replace(/توان/g, 'Power')
                 .replace(/ثبات شانه/g, 'Shoulder Stability')
                 .replace(/ثبات مفاصل/g, 'Joint Stability')
                 .replace(/کنترل تنه/g, 'Core Control')
                 .replace(/بازو/g, 'Arms');
  return result;
}

function translateReps(repsStr) {
  if (!repsStr) return '';
  if (currentLang !== 'en') return repsStr;
  return repsStr
    .replace(/۰/g, '0').replace(/۱/g, '1').replace(/۲/g, '2').replace(/۳/g, '3').replace(/۴/g, '4')
    .replace(/۵/g, '5').replace(/۶/g, '6').replace(/۷/g, '7').replace(/۸/g, '8').replace(/۹/g, '9')
    .replace(/هر طرف/g, 'each side')
    .replace(/هر پا/g, 'each leg')
    .replace(/ثانیه/g, 'sec')
    .replace(/تکرار/g, 'reps')
    .replace(/دقیقه/g, 'min');
}

const SESSION_NOTES_MAP_EN = {
  '۷۵ دقیقه تمرین با وزنه + ۱۵ دقیقه تردمیل در انتهای جلسه · حرکات اصلی حدود 2 RIR': '75 min weight training + 15 min treadmill at the end · Main exercises ~2 RIR',
  'تمرکز بر پایداری ستون فقرات، تقویت عضلات Core و کنترل ایزومتریک در خانه': 'Focus on spinal stability, core strengthening, and isometric control at home',
  'تمرکز بر کنترل کتف، سلامت کمربند شانه‌ای و ثبات زنجیره خلفی در خانه': 'Focus on scapular control, shoulder girdle health, and posterior chain stability at home',
  'استراحت کامل، تغذیه با کیفیت و ریکاوری بافت‌های عضلانی': 'Full rest, quality nutrition, and muscle tissue recovery',
  'پایان هفته با تمرینات ثبات عضلات مرکزی، کنترل کمربند شانه‌ای و تمرکز ایزومتریک در خانه': 'Weekend session: core stability exercises, shoulder girdle control, and isometric focus at home',
  'چهارسر + سینه + Core': 'Quadriceps + Chest + Core',
  'سرینی میانی/کوچک؛ Core؛ سبک تا متوسط (با دو دمبل ۱.۵ kg)': 'Gluteus medius/minimus; Core; Light to Moderate (with two 1.5kg dumbbells)',
  'همسترینگ + باسن + سینه + فیله': 'Hamstrings + Glutes + Chest + Lower Back',
  'سرینی بزرگ + همسترینگ؛ متوسط (تک‌پا و تمپو؛ ۳ ثانیه پایین رفتن در ددلیفت)': 'Gluteus maximus + Hamstrings; Moderate (single-leg & tempo; 3s eccentric in deadlift)',
  'چهارسر + باسن + همسترینگ + ساق': 'Quadriceps + Glutes + Hamstrings + Calves',
  'سرینی میانی/کوچک؛ ریکاوری‌محور + Core': 'Gluteus medius/minimus; Recovery-focused + Core',
  'استراحت کامل و بازسازی بافت‌های عضلانی': 'Full rest and muscle tissue regeneration'
};

function translateSessionNote(note) {
  if (!note) return '';
  if (currentLang !== 'en') return note;
  if (SESSION_NOTES_MAP_EN[note]) return SESSION_NOTES_MAP_EN[note];
  let res = note;
  for (const [k, v] of Object.entries(SESSION_NOTES_MAP_EN)) {
    if (res.includes(k)) res = res.replace(k, v);
  }
  for (const [fa, en] of Object.entries(MUSCLE_MAP_EN)) {
    res = res.replace(new RegExp(fa, 'g'), en);
  }
  return res.replace(/دقیقه/g, 'min')
            .replace(/تمرین با وزنه/g, 'weight training')
            .replace(/تردمیل/g, 'treadmill')
            .replace(/در انتهای جلسه/g, 'at the end of session')
            .replace(/حرکات اصلی حدود/g, 'main lifts approx.')
            .replace(/استراحت کامل/g, 'Full rest')
            .replace(/خانه/g, 'home')
            .replace(/باشگاه/g, 'gym');
}

function initLanguage() {
  const saved = localStorage.getItem('chieftain_lang') || 'fa';
  setLanguage(saved, false);
}


// --- Complete Global UI Translations Map (Persian to English) ---
const UI_TRANSLATIONS_MAP = {
  "+ افزودن روز جدید": "+ Add New Day",
  "+ افزودن ویدیو به این حرکت": "+ Add Video to Exercise",
  "+ ثبت جلسه جدید": "+ Log New Session",
  "+ ثبت حرکت جدید در برنامه": "+ Add New Exercise to Routine",
  "+ حرکت دلخواه": "+ Custom Exercise",
  "InBody / کالیپر %": "InBody / Caliper %",
  "Switch to English / تغییر زبان": "Switch to English / Switch Language",
  "آقا (Male)": "Male",
  "خانم (Female)": "Female",
  "ابعاد بالاتنه (سانتی‌متر)": "Upper Body Dimensions (cm)",
  "ابعاد میان‌تنه و شکم (سانتی‌متر)": "Core & Abdominal Dimensions (cm)",
  "ابعاد پایین‌تنه (سانتی‌متر)": "Lower Body Dimensions (cm)",
  "اسکلت استخوانی و سقف ژنتیکی نچرال (Casey Butt Model)": "Bone Structure & Natural Genetic Ceiling (Casey Butt Model)",
  "افزودن حرکت به سوپرست": "Add Exercise to Superset",
  "افزودن حرکت ۳، ۴ یا بیشتر برای ایجاد تری‌ست (Tri-Set) یا جاینت‌ست (Giant Set)": "Add 3rd, 4th or more exercises to create a Tri-Set or Giant Set",
  "امروز": "Today",
  "امکان تغییر حرکت با جستجو، تفکیک/ساخت سوپرست، ویرایش تعداد ست و تکرار در اختیار شماست:": "Search to replace, convert/create supersets, or modify sets and reps:",
  "انتخاب روز مقصد برای انتقال:": "Select target day to move to:",
  "انتخاب شده: -": "Selected: -",
  "انتخاب شده: ددلیفت رومانیایی": "Selected: Romanian Deadlift",
  "انتقال به روز:": "Move to Day:",
  "انتقال حرکت / سوپرست به روز دیگر": "Move Exercise / Superset to Another Day",
  "انصراف": "Cancel",
  "انصراف ✕": "Cancel ✕",
  "اگر تیک خورده باشد، حرکت پس از بررسی و تایید توسط ادمین برای همه کاربران در بانک عمومی قرار خواهد گرفت.": "If checked, the exercise will be reviewed and published to the public bank for all users by admin.",
  "اگر در باشگاه یا برنامه‌تان این حرکت را با نام دیگری صدا می‌زنید، اینجا بنویسید تا در کارت حرکت نمایش یابد.": "If you call this exercise by another name in your gym, enter it here to display on the exercise card.",
  "ایجاد حساب و اتصال امن": "Create Account & Connect",
  "ایجاد کاربر یا برنامه شخصی جدید": "Create New User or Personal Plan",
  "ایمیل حساب:": "Account Email:",
  "این برنامه محافظت‌شده است. لطفاً رمز عبور را وارد کنید:": "This routine is protected. Please enter PIN:",
  "این حرکت در": "This exercise in",
  "با وارد کردن عدد دلخواه، دکمه سریع تایمر روی کارت این حرکت دقیقاً با همین ثانیه باز می‌شود.": "By entering seconds, the quick timer button on this exercise card will open with this exact duration.",
  "با ورود به حساب، برنامه، لاگ‌ها و اندازه‌گیری‌های بدنی شما در دیتابیس امن و اختصاصی ذخیره شده و روی تمام دستگاه‌هایتان همگام می‌شود.": "Signing in securely stores your routines, logs, and body measurements in a private database, syncing across all your devices.",
  "باز کردن تایمر استراحت و ایزومتریک": "Open Rest and Isometric Timer",
  "بازنشانی برنامه به تنظیمات اولیه کارخانه": "Reset Routine to Default Factory Settings",
  "باسن / سرینی (Hips/Glutes)": "Glutes / Hips",
  "بانک جهانی حرکات MuscleWiki & ویدیوها": "MuscleWiki Global Exercise Bank & Videos",
  "بانک حرکات": "Exercise Bank",
  "بانک خصوصی شما": "Your Private Bank",
  "برای حفظ ریتم تمرین زمان استراحت را مدیریت کن": "Manage rest periods to maintain optimal workout intensity",
  "برنامه تخصصی هایپرتروفی، ثبات مفاصل و کنترل تنه": "Specialized Program for Hypertrophy, Joint Stability & Core Control",
  "برنامه تمرینی شما بدون نیاز به هیچ فایلی، به طور زنده و خودکار بین تمام دستگاه‌ها و مرورگرها همگام می‌شود:": "Your routine syncs in real-time across all devices and browsers automatically without any manual files:",
  "برنامه جدید": "New Plan",
  "برنامه نمونه آقایان (هایپرتروفی ۵ روزه)": "Men's Sample Plan (5-Day Hypertrophy)",
  "برنامه نمونه بانوان (تناسب اندام و فرم‌دهی)": "Women's Sample Plan (Tone & Fitness)",
  "بستن": "Close",
  "بستن ✕": "Close ✕",
  "بعد از تمرین (پمپ عضلانی 🏋️)": "Post-workout (Muscle Pump 🏋️)",
  "به‌روزرسانی و رفرش": "Update & Refresh",
  "تاریخ": "Date",
  "تاریخچه کامل ثبت ابعاد و سایزگیری": "Complete Body Measurement History",
  "تایمر تمرین": "Workout Timer",
  "تایپ نام حرکت برای جایگزینی...": "Type exercise name to replace...",
  "تایپ نام حرکت برای جستجوی سریع...": "Type exercise name for quick search...",
  "تایپ نام حرکت دوم...": "Type 2nd exercise name...",
  "تایپ نام حرکت...": "Type exercise name...",
  "تایید و باز کردن قفل 🔓": "Confirm and Unlock 🔓",
  "تحلیل آناتومیک و تفکیک حجم": "Anatomical Analysis & Volume Breakdown",
  "تعداد ست": "Sets Count",
  "تغییر بین حالت ساده (خلوت و تمرکز روی حرکات) و حالت پیشرفته": "Toggle between Simple Mode (clean focus on exercises) and Advanced Mode",
  "تغییر تم (حالت روز / شب)": "Toggle Theme (Day / Night)",
  "تغییر حرکت، تعداد ست‌ها، دامنه تکرار یا حذف از برنامه": "Change exercise, sets, rep ranges, or remove from plan",
  "تغییرات با موفقیت ذخیره و اعمال شد!": "Changes saved and applied successfully!",
  "تفکیک علمی ست‌های پرفشار باشگاه و حرکات ثبات و فعال‌سازی در خانه": "Scientific split: high-intensity gym sets vs home stability & activation",
  "تنظیم ⚡": "Set ⚡",
  "تنظیمات تایمر هوشمند": "Smart Timer Settings",
  "تنظیمات شناسه ابری و فایل JSON": "Cloud Key & JSON Backup Settings",
  "تولید شناسه رندوم جدید": "Generate New Random Key",
  "ثانیه": "sec",
  "ثبت اندازه‌گیری و آنتروپومتری جدید": "Log New Measurement & Anthropometrics",
  "ثبت دقیق ابعاد بدنی با متر نواری (به سانتی‌متر) جهت محاسبه هوشمند درصد چربی و تقارن عضلانی": "Accurate tape measurements (in cm) for body fat and muscular symmetry calculation",
  "ثبت دقیق وزنه و RIR برای اعمال اضافه بار تدریجی (Progressive Overload)": "Accurate weight and RIR tracking for Progressive Overload",
  "ثبت لاگ وزنه و تکرار": "Log Weight & Reps",
  "ثبت، مقایسه و تحلیل علمی ابعاد بدنی و آنتروپومتری": "Scientific Tracking, Comparison & Analysis of Body Dimensions",
  "ثبت‌نام جدید": "New Registration",
  "جستجو در بانک حرکات (مثلاً: اسکوات، پرس، لت، صدف)...": "Search exercise bank (e.g. Squat, Press, Pulldown)...",
  "جستجوی حرکت یا عضله هدف در برنامه...": "Search exercise or target muscle in plan...",
  "جهت ویرایش نام اصلی فارسی/انگلیسی، عضلات، و افزودن، ویرایش یا حذف ویدیوهای آموزشی این حرکت، باید رمز عبور ادمین را وارد نمایید.": "To edit base names, muscles, or manage tutorial videos, enter the admin PIN.",
  "حالت روز": "Light Mode",
  "حالت ساده": "Simple Mode",
  "حجم کل": "Total Volume",
  "حذف": "Delete",
  "حذف این پروفایل": "Delete this profile",
  "حرکت اول (موجود)": "First Exercise (Current)",
  "حرکت اول در سوپرست قرار می‌گیرد، لطفاً حرکت دوم را انتخاب نمایید:": "First exercise will be placed in superset; please select the 2nd exercise:",
  "حرکت تکی": "Single Exercise",
  "حرکت فعلی: -": "Current Exercise: -",
  "حرکت مورد نظرت رو پیدا نکردی؟": "Can't find your exercise?",
  "حساب کاربری ابری و خصوصی": "Private Cloud Account",
  "حساب کاربری فعال": "Active Account",
  "خروج از حساب": "Log Out",
  "خروجی گرفتن فایل JSON برنامه": "Export Routine JSON File",
  "درصد چربی دستگاه (اختیاری)": "Device Body Fat % (Optional)",
  "دریافت آخرین نسخه از سرور ابری و رفرش کامل بدون کش": "Pull latest version from cloud and hard refresh without cache",
  "دسترسی به بانک جهانی و ویدیوهای تمام حرکات در MuscleWiki": "Access global exercise directory & videos on MuscleWiki",
  "دسترسی به نقشه آناتومی تعاملی بدن و ویدیوی آموزشی تمام حرکات بدنسازی دنیا:": "Interactive anatomical body map and tutorial videos for all gym exercises worldwide:",
  "دقیقه": "min",
  "دور ساق پا (Calves)": "Calves (cm)",
  "دور سرشانه (Shoulder 👑)": "Shoulders (cm 👑)",
  "دور سینه (Chest)": "Chest (cm)",
  "دور مچ دست باریک (Wrist cm)": "Narrow Wrist (cm)",
  "دور مچ پا باریک (Ankle cm)": "Narrow Ankle (cm)",
  "دور گردن (Neck 🎖️)": "Neck (cm 🎖️)",
  "ذخیره رمز": "Save PIN",
  "ذخیره می‌شود و می‌توانید فوراً از آن در برنامه‌تان استفاده کنید. در صورت تمایل می‌توانید درخواست تایید برای انتشار در بانک عمومی را فعال کنید.": "Saved to your private bank and immediately usable in your routine.",
  "ران راست میانی (نقطه وسط زانو تا باسن 🎯)": "Mid Right Thigh (Midpoint Knee-to-Hip 🎯)",
  "ران چپ میانی (نقطه وسط زانو تا باسن 🎯)": "Mid Left Thigh (Midpoint Knee-to-Hip 🎯)",
  "رمز جدید...": "New PIN...",
  "رمز عبور برای قفل برنامه و لاگ‌ها (اختیاری)": "PIN to lock routine & logs (Optional)",
  "رمز عبور برنامه...": "Routine PIN...",
  "روند افزایش قدرت، رکورد وزنه و حجم تمرینی نسبت به جلسه اول": "Strength progression, weight records, and volume relative to 1st session",
  "ریست ست‌ها": "Reset Sets",
  "ریست کردن تیک تمام ست‌های انجام‌شده برای جلسه جدید": "Reset all completed set checkmarks for a new session",
  "ریست ↺": "Reset ↺",
  "زیر شکم (لگن)": "Lower Abs / Hips (cm)",
  "سامانه تخصصی تمرین و بدنسازی | Chieftain Pro": "Specialized Workout System | Chieftain Pro",
  "سایر شرایط 📋": "Other Conditions 📋",
  "سایز و بادی‌آنالیز": "Body Analysis",
  "ست و تکرار حرکت": "Exercise Sets & Reps",
  "ست و تکرار حرکت اول": "1st Exercise Sets & Reps",
  "ست و تکرار حرکت دوم": "2nd Exercise Sets & Reps",
  "ست و تکرار پیشنهادی": "Recommended Sets & Reps",
  "ست‌ها (وزنه × تکرار)": "Sets (Weight × Reps)",
  "سرشانه": "Shoulders",
  "سرچ MuscleWiki": "Search MuscleWiki",
  "سوپرست (۲ حرکت متوالی)": "Superset (2 consecutive exercises)",
  "سینه": "Chest",
  "شروع از برنامه خالی (صفحه سفید)": "Blank Routine (Start from scratch)",
  "شروع ⚡": "Start ⚡",
  "شما با موفقیت وارد حساب ابری خود شده‌اید.": "You have successfully logged in to your cloud account.",
  "شناسه اختصاصی شما در سرور ابری (": "Your private cloud sync key (",
  "شناسه اختصاصی شما مثلا my_gym_key...": "Your sync key e.g. my_gym_key...",
  "شکم (روی ناف)": "Abdomen / Navel (cm)",
  "ضخامت استخوان‌های مچ برای محاسبه حداکثر پتانسیل ساخت عضله بدون دارو و زمان رسیدن به آن:": "Wrist and ankle bone thickness to calculate natural drug-free muscular potential (Casey Butt):",
  "عصر / پایان روز 🌙": "Evening / End of Day 🌙",
  "عضلات هدف": "Target Muscles",
  "عضلات هدف:": "Target Muscles:",
  "عنوان (مثلاً: آموزش ۱)": "Title (e.g. Video 1)",
  "مثلاً: علی، سارا": "e.g. Sam, Sarah",
  "علی، سارا": "Sam, Sarah",
  "e.g. علی، سارا": "e.g. Sam, Sarah",
  "عنوان دلخواه سوپرست...": "Custom Superset Title...",
  "عنوان سوپرست": "Superset Title",
  "فیلتر بانک:": "Bank Filter:",
  "قالب اولیه برنامه": "Initial Routine Template",
  "لوگوی برنامه تمرینی Chieftain": "Chieftain Workout Logo",
  "لینک ویدیو (یوتیوب / آپارات / اینستاگرام)": "Video URL (YouTube / Instagram)",
  "لینک‌های ویدیو آموزشی (یوتیوب / آپارات / اینستاگرام) - هر لینک در یک خط": "Video URLs (YouTube / Instagram) - one per line",
  "متن ست و تکرار": "Sets & Reps Text",
  "محیط تمرین": "Training Location",
  "مدیریت مرجع حرکت و ویدیوها (مخصوص ادمین)": "Master Exercise & Video Management (Admin)",
  "مرجع کامل تمام ۷۵+ حرکت تمرینی به همراه ویدیوهای آموزشی یوتیوب": "Complete master reference of 75+ exercises with video tutorials",
  "مشاهده بانک کامل تمام حرکات با ویدیو": "View full exercise library with tutorials",
  "مشاهده، ویرایش یا حذف رکوردهای ثبت‌شده در دوره‌های مختلف": "View, edit, or delete logged records across different periods",
  "میزان پیشرفت روز فعال": "Active Day Progress",
  "می‌توانید این حرکت را با یک یا چند حرکت دیگر از بانک حرکات جفت و سوپرست کنید:": "Pair this exercise with one or more exercises to form a superset:",
  "می‌توانید حرکت دیگری به این سوپرست اضافه کنید (ساخت تری‌ست یا جاینت‌ست) یا آن را تفکیک کنید:": "Add another exercise to this superset (Tri-Set / Giant Set) or split it:",
  "می‌تونی در مرجع جهانی MuscleWiki نقشه آناتومی بدن و ویدیوهای تمام حرکات دنیا رو ببینی:": "Explore the interactive anatomical body map and video guides on MuscleWiki:",
  "ناشتا صبح اول وقت (استاندارد ☀️)": "Fasted Morning (Standard ☀️)",
  "نام اصلی انگلیسی حرکت (مرجع):": "Master English Name:",
  "نام اصلی فارسی حرکت (مرجع):": "Master Persian Name:",
  "نام انگلیسی حرکت (اختیاری)": "English Name (Optional)",
  "نام فارسی حرکت *": "Persian Name *",
  "نام فارسی یا انگلیسی حرکت (مثلاً: هیپ تراست، Hip Thrust)...": "Exercise Name (e.g. Hip Thrust)...",
  "نام نمایشی اختصاصی (اختیاری)": "Custom Display Name (Optional)",
  "نام کاربر یا عنوان برنامه *": "User Name or Routine Title *",
  "نصب اپ": "Install App",
  "نمودار پیشرفت و اضافه بار تدریجی": "Progressive Overload Chart",
  "نوع افزودن": "Addition Type",
  "هر تغییری در برنامه بدهید، خودکار و بدون نیاز به کلیک در سرور ابری ذخیره می‌شود.": "Any change made is automatically saved to the cloud without clicking.",
  "همه": "All",
  "همگام‌سازی ابری": "Cloud Sync",
  "همگام‌سازی دوطرفه زنده و ذخیره فوری در سرور ابری": "Live 2-way cloud sync and immediate server save",
  "همگام‌سازی فوری با دیتابیس": "Immediate Database Sync",
  "هنوز لاگی برای این حرکت ثبت نشده است. با زدن «ثبت جلسه جدید» اولین وزنه و تکرار خود را ثبت کنید تا نمودار هوشمند فعال شود!": "No logs yet for this exercise. Click \"+ Log New Session\" to start tracking!",
  "ورود": "Login",
  "ورود / حساب": "Login / Account",
  "ورود امن به حساب": "Secure Login",
  "ورود با کد دسترسی اختصاصی جهت بارگذاری برنامه و پرونده:": "Enter confidential access code to load routine and records:",
  "ورود به بخش اختصاصی برنامه": "Enter Security PIN",
  "ورود به حساب": "Log In",
  "ورود به حساب کاربری اختصاصی یا ثبت‌نام": "Sign in to personal account or register",
  "ورود به نقشه تعاملی بدن در MuscleWiki.com ↗": "Open Interactive Body Map on MuscleWiki.com ↗",
  "ورود مربی و ادمین / Coach & Admin Access": "Coach & Admin Access",
  "ویدیو در یوتیوب": "YouTube Video",
  "ویرایش برنامه": "Edit Plan",
  "ویرایش حرکت تمرینی": "Edit Exercise",
  "ویرایش و افزودن حرکات به این برنامه (نیازمند رمز عبور)": "Edit routine and add exercises (PIN required)",
  "پا / باسن": "Legs / Glutes",
  "پایگاه ابری اختصاصی و همگام‌سازی خودکار": "Dedicated Cloud Sync & Automatic Backup",
  "پرش به روز جاری": "Jump to Current Day",
  "پشت / زیر بغل": "Back / Lats",
  "کد دسترسی...": "Access Code...",
  "کمر (باریک‌ترین نقطه)": "Waist (Narrowest point, cm)",
  "یا متن / کد JSON برنامه را در کادر زیر پیست کرده و دکمه اعمال را بزنید:": "Or paste the routine JSON code below and click Apply:",
  "یادداشت": "Notes",
  "یادداشت این جلسه (اختیاری)": "Session Notes (Optional)",
  "یادداشت یا توضیحات دوره": "Period Notes or Description",
  "یک پروفایل مجزا بسازید تا برنامه، ست‌ها، لاگ‌ها و روزهای شخصی خود را داشته باشید.": "Create an independent profile to keep your own routines, logs, and customized days.",
  "۰ kg": "0 kg",
  "۰ ویدیو": "0 Videos",
  "۰٪": "0%",
  "۱ ست": "1 Set",
  "۲ دقیقه": "2 min",
  "۲ ست": "2 Sets",
  "۲۰ ثانیه": "20 sec",
  "۳ دقیقه": "3 min",
  "۳ ست": "3 Sets",
  "۳۰ ثانیه": "30 sec",
  "۴ ست": "4 Sets",
  "۴۵ ثانیه": "45 sec",
  "۵ ست": "5 Sets",
  "۶۰ ثانیه": "60 sec",
  "۹۰ ثانیه": "90 sec",
  "⏰ ساعت / نوبت": "⏰ Time / Slot",
  "⏱️ استراحت بین ست‌ها": "⏱️ Rest Between Sets",
  "⏱️ تایمر استراحت بین ست‌ها": "⏱️ Rest Timer Between Sets",
  "⏱️ زمان پیش‌فرض تایمر برای این حرکت (ثانیه):": "⏱️ Default Timer Duration for this exercise (sec):",
  "⏳ زمان دلخواه:": "⏳ Custom Duration:",
  "☀️ شرایط اندازه‌گیری": "☀️ Measurement Conditions",
  "☁️ حساب ابری همگام‌سازی (": "☁️ Live Cloud Sync Account (",
  "☁️ ذخیره در سرور ابری": "☁️ Save to Cloud",
  "⚖️ وزن بدن (kg)": "⚖️ Bodyweight (kg)",
  "⚡ اضافه کردن به این سوپرست": "⚡ Add to this Superset",
  "⚡ اعمال کد": "⚡ Apply Code",
  "⚡ این حرکت در حال حاضر درون یک سوپرست است": "⚡ This exercise is currently in a superset",
  "⚡ تبدیل به سوپرست دوتایی": "⚡ Convert to 2-Exercise Superset",
  "⚡ تبدیل حرکت تکی به سوپرست": "⚡ Convert Single Exercise to Superset",
  "⚡ ترکیب و سوپرست کردن این حرکت": "⚡ Pair and Superset this exercise",
  "⚡ ساخت سوپرست دوتایی": "⚡ Build 2-Exercise Superset",
  "⚡ همگام‌سازی خودکار در پس‌زمینه": "⚡ Background Auto-Sync",
  "✂️ تفکیک به حرکت تکی": "✂️ Split to Single Exercise",
  "✏️ ویرایش کامل و همه‌جانبه برنامه": "✏️ Comprehensive Routine Editor",
  "✨ ساخت برنامه شخصی جدید": "✨ Create New Custom Plan",
  "❌ رمز عبور اشتباه است!": "❌ Incorrect PIN!",
  "➕ اضافه کردن به برنامه": "➕ Add to Routine",
  "➕ افزودن حرکت به روز تمرین": "➕ Add Exercise to Day",
  "➕ افزودن حرکت دیگر به این سوپرست": "➕ Add Another Exercise to Superset",
  "➕ افزودن ویدیوی جدید:": "➕ Add New Video:",
  "➕ ثبت حرکت تمرینی جدید (بانک خصوصی)": "➕ Create Custom Exercise (Private Bank)",
  "🌐 ارسال درخواست انتشار در بانک عمومی (جهت بررسی و تایید ادمین)": "🌐 Submit for Public Bank (Pending Admin Approval)",
  "🌐 باز کردن بانک جهانی MuscleWiki": "🌐 Open MuscleWiki Directory",
  "🌐 بانک عمومی": "🌐 Public Bank",
  "🎂 سن (سال)": "🎂 Age (years)",
  "🏆 بیشترین وزنه": "🏆 Max Weight",
  "🏋️ باشگاه": "🏋️ Gym",
  "🏋️ شنبه، دوشنبه، پنجشنبه: باشگاه": "🏋️ Saturday, Monday, Thursday: Gym",
  "🏠 خانه / Core": "🏠 Home / Core",
  "🏠 خانه / بدون وسیله": "🏠 Home / Bodyweight",
  "🏠 یکشنبه، سه‌شنبه، جمعه: خانه": "🏠 Sunday, Tuesday, Friday: Home",
  "🏷️ نام نمایشی اختصاصی برای این حرکت (اختیاری):": "🏷️ Custom Display Name for this exercise (Optional):",
  "👑 حالت ادمین": "👑 Admin Mode",
  "👤 ایجاد کاربر یا برنامه تمرینی جدید": "👤 Create New Plan / Profile",
  "👤 جنسیت (برای فرمول چربی)": "👤 Gender (for Body Fat formula)",
  "👤 نام یا نام مستعار:": "👤 Name or Nickname:",
  "💡 فقط کافیست همین شناسه را در گوشی یا هر مرورگر دیگری وارد کنید تا برنامه‌تان متصل شود.": "💡 Simply enter this key on any other phone or browser to connect your routine.",
  "💪 بازوی راست منقبض (Flexed)": "💪 Right Arm Flexed (cm)",
  "💪 بازوی چپ منقبض (Flexed)": "💪 Left Arm Flexed (cm)",
  "💾 اعمال تغییرات": "💾 Apply Changes",
  "💾 اعمال و ذخیره تغییرات": "💾 Apply & Save Changes",
  "💾 اعمال و ذخیره نهایی ویرایش‌ها": "💾 Save Final Edits",
  "💾 ثبت و محاسبه آنتروپومتری": "💾 Calculate & Save Anthropometrics",
  "💾 ذخیره تغییرات نام و ویدیوها در بانک اصلی (ادمین)": "💾 Save Name & Video Edits to Master Bank (Admin)",
  "💾 ذخیره حرکت در بانک خصوصی": "💾 Save to Private Bank",
  "💾 ذخیره لاگ جلسه": "💾 Save Session Log",
  "💾 پشتیبان‌گیری و بارگذاری فایل / متن (": "💾 Local Backup / Restore (JSON) (",
  "📁 انتخاب فایل": "📁 Choose File",
  "📅 تاریخ ثبت": "📅 Log Date",
  "📈 مشاهده نمودار": "📈 View Chart",
  "📊 حجم کل آخرین جلسه": "📊 Total Volume of Last Session",
  "📋 برنامه:": "📋 Plan:",
  "📋 تاریخچه جلسات ثبت‌شده:": "📋 Logged Session History:",
  "📋 لیست کامل حرکات درگیر در طول هفته:": "📋 Complete Weekly Exercise Directory:",
  "📐 قد (cm)": "📐 Height (cm)",
  "📚 بانک جامع حرکات ورزشی (با تمام ویدیوها)": "📚 Master Exercise Library (All Videos)",
  "📥 خروجی (JSON)": "📥 Export (JSON)",
  "📥 دانلود فایل": "📥 Download File",
  "📥 دریافت از سرور ابری": "📥 Download from Cloud",
  "📧 ایمیل:": "📧 Email:",
  "📹 لیست ویدیوهای آموزشی این حرکت:": "📹 Video Tutorials for this exercise:",
  "🔄 بازنشانی روزهای اصلی": "🔄 Reset to Original Days",
  "🔍 انتخاب حرکت (با جستجوی سریع)": "🔍 Select Exercise (Quick Search)",
  "🔍 انتخاب حرکت جدید برای اضافه شدن به این سوپرست *": "🔍 Select New Exercise for this Superset *",
  "🔍 جستجو و انتخاب حرکت اول *": "🔍 Search and Select 1st Exercise *",
  "🔍 جستجو و انتخاب حرکت دوم *": "🔍 Search and Select 2nd Exercise *",
  "🔍 جستجو و انتخاب حرکت دوم برای جفت شدن *": "🔍 Search and Select 2nd Exercise to Pair *",
  "🔍 جستجوی نام حرکت برای دریافت فوری ویدیو و آموزش:": "🔍 Search exercise for instant tutorial and videos:",
  "🔍 یافتن ویدیو آموزشی": "🔍 Find Tutorial Video",
  "🔑 رمز عبور (حداقل ۶ کاراکتر):": "🔑 Password (min 6 chars):",
  "🔑 رمز عبور:": "🔑 Password:",
  "🔑 ورود ادمین": "🔑 Admin Login",
  "🔒 بانک خصوصی من": "🔒 My Private Bank",
  "🔒 رمز عبور ویرایش و لاگ‌های این برنامه:": "🔒 PIN to edit and log in this routine:",
  "🖐️ بازوی راست ریلکس / عادی (Relaxed)": "🖐️ Right Arm Relaxed (cm)",
  "🖐️ بازوی چپ ریلکس / عادی (Relaxed)": "🖐️ Left Arm Relaxed (cm)",
  "🖼️ تصویر نحوه اجرای صحیح حرکت": "🖼️ Proper Form & Execution Image",
  "🗑️ حذف برنامه": "🗑️ Delete Routine",
  "🗑️ حذف حرکت": "🗑️ Delete Exercise",
  "🚀 انتقال فوری": "🚀 Instant Move",
  "🚀 رشد نسبت به جلسه اول": "🚀 Growth from 1st Session",
  "🛌 چهارشنبه: استراحت کامل": "🛌 Wednesday: Full Rest",
  "🟢 آماده اتصال": "🟢 Ready to Connect",
  "🟢 روشن و فعال": "🟢 Active & Enabled",
  "🧘‍♂️ حرکات ایزومتریک": "🧘‍♂️ Isometric Exercises"
};

function translateText(str) {
  if (!str) return '';
  const trimmed = str.trim();
  if (UI_TRANSLATIONS_MAP[trimmed]) return UI_TRANSLATIONS_MAP[trimmed];
  if (typeof MUSCLE_MAP_EN !== 'undefined' && MUSCLE_MAP_EN[trimmed]) return MUSCLE_MAP_EN[trimmed];
  if (typeof DAY_MAP_EN !== 'undefined' && DAY_MAP_EN[trimmed]) return DAY_MAP_EN[trimmed];

  if (trimmed.startsWith('مثلاً:')) {
    let rest = trimmed.substring(6).trim();
    return 'e.g. ' + (UI_TRANSLATIONS_MAP[rest] || (typeof MUSCLE_MAP_EN !== 'undefined' && MUSCLE_MAP_EN[rest]) || rest);
  }

  let res = trimmed;
  for (const [fa, en] of Object.entries(UI_TRANSLATIONS_MAP)) {
    if (res.includes(fa)) {
      res = res.replaceAll(fa, en);
    }
  }
  if (typeof MUSCLE_MAP_EN !== 'undefined') {
    for (const [fa, en] of Object.entries(MUSCLE_MAP_EN)) {
      if (res.includes(fa)) {
        res = res.replaceAll(fa, en);
      }
    }
  }
  return res;
}

function applyDOMTranslations() {
  const isEn = currentLang === 'en';

  // 1. All elements with title attribute (tooltips)
  document.querySelectorAll('[title]').forEach(el => {
    if (!el.hasAttribute('data-fa-title')) {
      el.setAttribute('data-fa-title', el.getAttribute('title') || '');
    }
    const faTitle = el.getAttribute('data-fa-title');
    if (faTitle) {
      el.setAttribute('title', isEn ? translateText(faTitle) : faTitle);
    }
  });

  // 2. All input / textarea elements with placeholder
  document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
    if (!el.hasAttribute('data-fa-placeholder')) {
      el.setAttribute('data-fa-placeholder', el.getAttribute('placeholder') || '');
    }
    const enPh = el.getAttribute('data-en-placeholder');
    const faPh = el.getAttribute('data-fa-placeholder');
    if (isEn) {
      el.setAttribute('placeholder', enPh || translateText(faPh));
    } else {
      el.setAttribute('placeholder', faPh);
    }
  });

  // 3. Modal overlays, header and toolbars text nodes
  const rootEls = document.querySelectorAll('.modal-overlay, header, .action-row, .nav-container');
  rootEls.forEach(root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const val = node.nodeValue.trim();
      if (!val) continue;

      if (!node.__origFaText) {
        node.__origFaText = node.nodeValue;
      }
      if (isEn) {
        node.nodeValue = translateText(node.__origFaText);
      } else {
        node.nodeValue = node.__origFaText;
      }
    }
  });
}

function setLanguage(lang, doRender = true) {
  currentLang = (lang === 'en') ? 'en' : 'fa';
  window.currentLang = currentLang;
  localStorage.setItem('chieftain_lang', currentLang);
  document.documentElement.lang = currentLang;
  document.documentElement.dir = (currentLang === 'en') ? 'ltr' : 'rtl';

  const btn = document.getElementById('langToggleBtn');
  const text = document.getElementById('langToggleText');
  if (btn) {
    btn.title = currentLang === 'en' ? 'تغییر زبان به فارسی / Switch to Persian' : 'Switch to English / تغییر زبان به انگلیسی';
  }
  if (text) {
    text.innerText = currentLang === 'en' ? 'FA' : 'EN';
  }

  updateStaticUIText();
  applyDOMTranslations();
  if (doRender) {
    renderApp(true);
  }
}

function toggleLanguage() {
  const next = (currentLang === 'fa') ? 'en' : 'fa';
  setLanguage(next, true);
  showToast(next === 'en' ? '🌐 Language switched to English' : '🌐 زبان به فارسی تغییر یافت');
}

function updateStaticUIText() {
  const isEn = currentLang === 'en';

  const pWrap = document.getElementById('profileSelectWrapLabel');
  if (pWrap) pWrap.innerText = isEn ? '📋 Plan:' : '📋 برنامه:';

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = t('searchPlaceholder');

  const libBtnText = document.getElementById('libBtnText');
  if (libBtnText) libBtnText.innerText = t('exerciseBank');

  const newProfileBtnText = document.getElementById('newProfileBtnText');
  if (newProfileBtnText) newProfileBtnText.innerText = t('newPlan');

  const editPlanBtnText = document.getElementById('editPlanBtnText');
  if (editPlanBtnText) editPlanBtnText.innerText = t('editPlan');

  const resetSetsBtnText = document.getElementById('resetSetsBtnText');
  if (resetSetsBtnText) resetSetsBtnText.innerText = t('resetSets');

  const quickCloudSyncBtnText = document.getElementById('quickCloudSyncBtnText');
  if (quickCloudSyncBtnText) quickCloudSyncBtnText.innerText = t('cloudSync');

  const quickRefreshCloudBtnText = document.getElementById('quickRefreshCloudBtnText');
  if (quickRefreshCloudBtnText) quickRefreshCloudBtnText.innerText = t('updateRefresh');

  const bodyMetricsBtnText = document.getElementById('bodyMetricsBtnText');
  if (bodyMetricsBtnText) bodyMetricsBtnText.innerText = t('bodyAnalysis');

  const todayJumpBtnText = document.getElementById('todayJumpBtnText');
  if (todayJumpBtnText) todayJumpBtnText.innerText = t('today');

  const fabTimerLabel = document.getElementById('fabTimerLabel');
  if (fabTimerLabel) fabTimerLabel.innerText = t('workoutTimer');

  const headerInstallBtnText = document.getElementById('headerInstallBtnText');
  if (headerInstallBtnText) headerInstallBtnText.innerText = t('installApp');

  const authBtnText = document.getElementById('authBtnText');
  if (authBtnText) {
    if (typeof currentAuthUser !== 'undefined' && currentAuthUser) {
      const email = currentAuthUser.email || '';
      const name = currentAuthUser.user_metadata?.display_name || email.split('@')[0] || (isEn ? 'Account' : 'حساب');
      authBtnText.innerText = name;
    } else {
      authBtnText.innerText = t('loginAccount');
    }
  }

  const themeText = document.getElementById('themeToggleText');
  if (themeText) {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    themeText.innerText = currentTheme === 'light' ? t('darkMode') : t('lightMode');
  }

  // --- Modal Static Text Updates ---
  // Auth Modal
  const authLoggedOutTitle = document.getElementById('authLoggedOutTitle');
  if (authLoggedOutTitle) authLoggedOutTitle.innerText = isEn ? 'Private Cloud Account' : 'حساب کاربری ابری و خصوصی';
  const authLoggedOutDesc = document.getElementById('authLoggedOutDesc');
  if (authLoggedOutDesc) authLoggedOutDesc.innerText = isEn ? 'Signing in syncs your workout routine, logs, and body metrics securely across all your devices.' : 'با ورود به حساب، برنامه، لاگ‌ها و اندازه‌گیری‌های بدنی شما در دیتابیس امن و اختصاصی ذخیره شده و روی تمام دستگاه‌هایتان همگام می‌شود.';
  const authTabLogin = document.getElementById('authTabLogin');
  if (authTabLogin) authTabLogin.innerText = isEn ? 'Login' : 'ورود به حساب';
  const authTabSignup = document.getElementById('authTabSignup');
  if (authTabSignup) authTabSignup.innerText = isEn ? 'Sign Up' : 'ثبت‌نام جدید';
  const authLoginEmailLabel = document.getElementById('authLoginEmailLabel');
  if (authLoginEmailLabel) authLoginEmailLabel.innerText = isEn ? '📧 Email:' : '📧 ایمیل:';
  const authLoginPasswordLabel = document.getElementById('authLoginPasswordLabel');
  if (authLoginPasswordLabel) authLoginPasswordLabel.innerText = isEn ? '🔑 Password:' : '🔑 رمز عبور:';
  const loginSubmitBtnText = document.getElementById('loginSubmitBtnText');
  if (loginSubmitBtnText) loginSubmitBtnText.innerText = isEn ? 'Secure Login' : 'ورود امن به حساب';
  const authSignupNameLabel = document.getElementById('authSignupNameLabel');
  if (authSignupNameLabel) authSignupNameLabel.innerText = isEn ? '👤 Name or Nickname:' : '👤 نام یا نام مستعار:';
  const authSignupEmailLabel = document.getElementById('authSignupEmailLabel');
  if (authSignupEmailLabel) authSignupEmailLabel.innerText = isEn ? '📧 Email:' : '📧 ایمیل:';
  const authSignupPasswordLabel = document.getElementById('authSignupPasswordLabel');
  if (authSignupPasswordLabel) authSignupPasswordLabel.innerText = isEn ? '🔑 Password (min 6 chars):' : '🔑 رمز عبور (حداقل ۶ کاراکتر):';
  const signupSubmitBtnText = document.getElementById('signupSubmitBtnText');
  if (signupSubmitBtnText) signupSubmitBtnText.innerText = isEn ? 'Create Account & Connect' : 'ایجاد حساب و اتصال امن';
  const authLoggedInTitle = document.getElementById('authLoggedInTitle');
  if (authLoggedInTitle) authLoggedInTitle.innerText = isEn ? 'Active Cloud Account' : 'حساب کاربری فعال';
  const authLoggedInDesc = document.getElementById('authLoggedInDesc');
  if (authLoggedInDesc) authLoggedInDesc.innerText = isEn ? 'You are successfully logged in.' : 'شما با موفقیت وارد حساب ابری خود شده‌اید.';
  const authEmailLabel = document.getElementById('authEmailLabel');
  if (authEmailLabel) authEmailLabel.innerText = isEn ? 'Account Email:' : 'ایمیل حساب:';
  const authSyncNowBtnText = document.getElementById('authSyncNowBtnText');
  if (authSyncNowBtnText) authSyncNowBtnText.innerText = isEn ? 'Sync Now with Database' : 'همگام‌سازی فوری با دیتابیس';
  const authLogoutBtnText = document.getElementById('authLogoutBtnText');
  if (authLogoutBtnText) authLogoutBtnText.innerText = isEn ? 'Log Out' : 'خروج از حساب';

  // Confidential Coach & Admin Access Box in Auth Modal
  const signupName = document.getElementById('signupName');
  if (signupName) signupName.placeholder = isEn ? 'e.g. Sam, Sarah' : 'مثلاً: علی، سارا';
  const authAdminAccessTitle = document.getElementById('authAdminAccessTitle');
  if (authAdminAccessTitle) authAdminAccessTitle.innerText = isEn ? 'Coach & Admin Access' : 'ورود مربی و ادمین / Coach & Admin Access';
  const authAdminAccessDesc = document.getElementById('authAdminAccessDesc');
  if (authAdminAccessDesc) authAdminAccessDesc.innerText = isEn ? 'Enter private access code to load your routine and records:' : 'ورود با کد دسترسی اختصاصی جهت بارگذاری برنامه و پرونده:';
  const adminAccessPinInput = document.getElementById('adminAccessPinInput');
  if (adminAccessPinInput) adminAccessPinInput.placeholder = isEn ? 'Access Code...' : 'کد دسترسی...';
  const adminAccessSubmitBtnText = document.getElementById('adminAccessSubmitBtnText');
  if (adminAccessSubmitBtnText) adminAccessSubmitBtnText.innerText = isEn ? 'Unlock' : 'ورود';

  // Cloud Sync Modal
  const syncModalTitle = document.getElementById('syncModalTitle');
  if (syncModalTitle) syncModalTitle.innerText = isEn ? 'Dedicated Cloud Sync & Backup' : 'پایگاه ابری اختصاصی و همگام‌سازی خودکار';
  const syncModalSubtitle = document.getElementById('syncModalSubtitle');
  if (syncModalSubtitle) syncModalSubtitle.innerText = isEn ? 'Your routine automatically syncs in real-time across all devices without any manual files:' : 'برنامه تمرینی شما بدون نیاز به هیچ فایلی، به طور زنده و خودکار بین تمام دستگاه‌ها و مرورگرها همگام می‌شود:';
  const syncCardTitle = document.getElementById('syncCardTitle');
  if (syncCardTitle) syncCardTitle.innerHTML = isEn ? '☁️ Live Cloud Sync Account' : '☁️ حساب ابری همگام‌سازی (<bdi>Live Cloud Sync</bdi>)';
  const syncKeyLabel = document.getElementById('syncKeyLabel');
  if (syncKeyLabel) syncKeyLabel.innerHTML = isEn ? 'Your Cloud Sync Key:' : 'شناسه اختصاصی شما در سرور ابری (<bdi>Cloud Sync Key</bdi>):';
  const cloudSyncKeyInput = document.getElementById('cloudSyncKeyInput');
  if (cloudSyncKeyInput) cloudSyncKeyInput.placeholder = isEn ? 'Your sync key e.g. my_gym_key...' : 'شناسه اختصاصی شما مثلا my_gym_key...';
  const syncKeyTip = document.getElementById('syncKeyTip');
  if (syncKeyTip) syncKeyTip.innerText = isEn ? '💡 Simply enter this key on any other phone or browser to connect your routine.' : '💡 فقط کافیست همین شناسه را در گوشی یا هر مرورگر دیگری وارد کنید تا برنامه‌تان متصل شود.';
  const pushCloudBtnText = document.getElementById('pushCloudBtnText');
  if (pushCloudBtnText) pushCloudBtnText.innerText = isEn ? '☁️ Save to Cloud' : '☁️ ذخیره در سرور ابری';
  const pullCloudBtnText = document.getElementById('pullCloudBtnText');
  if (pullCloudBtnText) pullCloudBtnText.innerText = isEn ? '📥 Download from Cloud' : '📥 دریافت از سرور ابری';
  const autoSyncLabel = document.getElementById('autoSyncLabel');
  if (autoSyncLabel) autoSyncLabel.innerText = isEn ? '⚡ Background Auto-Sync' : '⚡ همگام‌سازی خودکار در پس‌زمینه';
  const autoSyncDesc = document.getElementById('autoSyncDesc');
  if (autoSyncDesc) autoSyncDesc.innerText = isEn ? 'Any change made is instantly saved to the cloud without needing to click.' : 'هر تغییری در برنامه بدهید، خودکار و بدون نیاز به کلیک در سرور ابری ذخیره می‌شود.';
  const jsonBackupTitle = document.getElementById('jsonBackupTitle');
  if (jsonBackupTitle) jsonBackupTitle.innerHTML = isEn ? '💾 Local Backup / Restore (JSON)' : '💾 پشتیبان‌گیری و بارگذاری فایل / متن (<bdi>JSON</bdi>)';
  const downloadJsonBtnText = document.getElementById('downloadJsonBtnText');
  if (downloadJsonBtnText) downloadJsonBtnText.innerText = isEn ? '📥 Download File' : '📥 دانلود فایل';
  const uploadJsonBtnText = document.getElementById('uploadJsonBtnText');
  if (uploadJsonBtnText) uploadJsonBtnText.innerText = isEn ? '📁 Choose File' : '📁 انتخاب فایل';
  const jsonPasteDesc = document.getElementById('jsonPasteDesc');
  if (jsonPasteDesc) jsonPasteDesc.innerText = isEn ? 'Or paste the program JSON code below and click Apply:' : 'یا متن / کد JSON برنامه را در کادر زیر پیست کرده و دکمه اعمال را بزنید:';
  const applyJsonBtnText = document.getElementById('applyJsonBtnText');
  if (applyJsonBtnText) applyJsonBtnText.innerText = isEn ? '⚡ Apply Code' : '⚡ اعمال کد';
  const closeSyncModalBtnText = document.getElementById('closeSyncModalBtnText');
  if (closeSyncModalBtnText) closeSyncModalBtnText.innerText = isEn ? 'Close ✕' : 'بستن ✕';

  // Other Modals Titles
  const timerModalTitle = document.getElementById('timerModalTitle');
  if (timerModalTitle) timerModalTitle.innerText = isEn ? '⏱️ Rest Timer Between Sets' : '⏱️ تایمر استراحت بین ست‌ها';
  const pinModalTitle = document.getElementById('pinModalTitle');
  if (pinModalTitle) pinModalTitle.innerText = isEn ? '🔒 Enter Security PIN' : 'ورود به بخش اختصاصی برنامه';
  const logModalTitle = document.getElementById('logModalTitle');
  if (logModalTitle) logModalTitle.innerText = isEn ? '📝 Log Weight & Reps' : 'ثبت لاگ وزنه و تکرار';
  const chartModalTitle = document.getElementById('chartModalTitle');
  if (chartModalTitle) chartModalTitle.innerText = isEn ? '📈 Progressive Overload Chart' : 'نمودار پیشرفت و اضافه بار تدریجی';
  const libraryModalTitle = document.getElementById('libraryModalTitle');
  if (libraryModalTitle) libraryModalTitle.innerText = isEn ? '📚 Comprehensive Exercise Bank' : '📚 بانک جامع حرکات ورزشی (با تمام ویدیوها)';
  const muscleWikiModalTitle = document.getElementById('muscleWikiModalTitle');
  if (muscleWikiModalTitle) muscleWikiModalTitle.innerText = isEn ? '🌐 Global Exercise Bank & Videos' : 'بانک جهانی حرکات MuscleWiki & ویدیوها';
  const customExModalTitle = document.getElementById('customExModalTitle');
  if (customExModalTitle) customExModalTitle.innerText = isEn ? '➕ Create Custom Exercise (Private Bank)' : '➕ ثبت حرکت تمرینی جدید (بانک خصوصی)';

  // New Profile / Plan Modal
  const newProfileModalTitle = document.getElementById('newProfileModalTitle');
  if (newProfileModalTitle) newProfileModalTitle.innerText = isEn ? '👤 Create New Plan / Profile' : '👤 ایجاد کاربر یا برنامه تمرینی جدید';
  const newProfileModalDesc = document.getElementById('newProfileModalDesc');
  if (newProfileModalDesc) newProfileModalDesc.innerText = isEn ? 'Create an independent profile to keep your own routines, logs, and customized workout days.' : 'یک پروفایل مجزا بسازید تا برنامه، ست‌ها، لاگ‌ها و روزهای شخصی خود را داشته باشید.';
  const newProfileNameLabel = document.getElementById('newProfileNameLabel');
  if (newProfileNameLabel) newProfileNameLabel.innerText = isEn ? 'Plan or Profile Name *' : 'نام کاربر یا عنوان برنامه *';
  const newProfileName = document.getElementById('newProfileName');
  if (newProfileName) newProfileName.placeholder = isEn ? 'e.g. 4-Day Hypertrophy, Summer Shred' : 'مثلاً: برنامه اختصاصی، برنامه حجم ۴ روزه';
  const newProfileTemplateLabel = document.getElementById('newProfileTemplateLabel');
  if (newProfileTemplateLabel) newProfileTemplateLabel.innerText = isEn ? 'Initial Routine Template' : 'قالب اولیه برنامه';
  const newProfileOptMale = document.getElementById('newProfileOptMale');
  if (newProfileOptMale) newProfileOptMale.innerText = isEn ? "Men's Hypertrophy Routine (5-Day)" : 'برنامه نمونه آقایان (هایپرتروفی ۵ روزه)';
  const newProfileOptFemale = document.getElementById('newProfileOptFemale');
  if (newProfileOptFemale) newProfileOptFemale.innerText = isEn ? "Women's Fitness & Toning Routine (5-Day)" : 'برنامه نمونه بانوان (تناسب اندام و فرم‌دهی)';
  const newProfileOptEmpty = document.getElementById('newProfileOptEmpty');
  if (newProfileOptEmpty) newProfileOptEmpty.innerText = isEn ? 'Blank Routine (Start from scratch)' : 'شروع از برنامه خالی (صفحه سفید)';
  const newProfilePinLabel = document.getElementById('newProfilePinLabel');
  if (newProfilePinLabel) newProfilePinLabel.innerText = isEn ? 'PIN to Lock Routine & Logs (Optional)' : 'رمز عبور برای قفل برنامه و لاگ‌ها (اختیاری)';
  const newProfilePin = document.getElementById('newProfilePin');
  if (newProfilePin) newProfilePin.placeholder = isEn ? 'e.g. 1234 or custom PIN' : 'مثلاً: 1234 یا رمز دلخواه';
  const newProfileSubmitBtn = document.getElementById('newProfileSubmitBtn');
  if (newProfileSubmitBtn) newProfileSubmitBtn.innerText = isEn ? '✨ Create Custom Plan' : '✨ ساخت برنامه شخصی جدید';

  const editPlanModalTitle = document.getElementById('editPlanModalTitle');
  if (editPlanModalTitle) editPlanModalTitle.innerText = isEn ? '✏️ Edit Routine & Days' : '✏️ ویرایش کامل و همه‌جانبه برنامه';
  const addExModalTitle = document.getElementById('addExModalTitle');
  if (addExModalTitle) addExModalTitle.innerText = isEn ? '➕ Add Exercise to Day' : '➕ افزودن حرکت به روز تمرین';
  const convertSingleModalTitle = document.getElementById('convertSingleModalTitle');
  if (convertSingleModalTitle) convertSingleModalTitle.innerText = isEn ? '⚡ Convert Single Exercise to Superset' : '⚡ تبدیل حرکت تکی به سوپرست';
  const quickEditExModalTitle = document.getElementById('quickEditExModalTitle');
  if (quickEditExModalTitle) quickEditExModalTitle.innerText = isEn ? '✏️ Quick Edit Exercise' : 'ویرایش حرکت تمرینی';
  const addExToSupersetTitle = document.getElementById('addExToSupersetTitle');
  if (addExToSupersetTitle) addExToSupersetTitle.innerText = isEn ? '⚡ Add Exercise to Superset' : 'افزودن حرکت به سوپرست';
  const imageModalTitle = document.getElementById('imageModalTitle');
  if (imageModalTitle) imageModalTitle.innerText = isEn ? '🖼️ Proper Form & Execution Image' : '🖼️ تصویر نحوه اجرای صحیح حرکت';
  const muscleDetailModalTitle = document.getElementById('muscleDetailModalTitle');
  if (muscleDetailModalTitle) muscleDetailModalTitle.innerText = isEn ? '📊 Muscle Group Volume Analysis' : 'تحلیل آناتومیک و تفکیک حجم';
  const moveDayModalTitle = document.getElementById('moveDayModalTitle');
  if (moveDayModalTitle) moveDayModalTitle.innerText = isEn ? '📅 Move to Another Day' : 'انتقال حرکت / سوپرست به روز دیگر';
  const addBodyMetricModalTitle = document.getElementById('addBodyMetricModalTitle');
  if (addBodyMetricModalTitle) addBodyMetricModalTitle.innerText = isEn ? '📏 Log New Body Measurement' : 'ثبت اندازه‌گیری و آنتروپومتری جدید';
  const bodyMetricHistoryModalTitle = document.getElementById('bodyMetricHistoryModalTitle');
  if (bodyMetricHistoryModalTitle) bodyMetricHistoryModalTitle.innerText = isEn ? '📜 Complete Body Measurement History' : 'تاریخچه کامل ثبت ابعاد و سایزگیری';
  const bodyMetricHistoryModalDesc = document.getElementById('bodyMetricHistoryModalDesc');
  if (bodyMetricHistoryModalDesc) bodyMetricHistoryModalDesc.innerText = isEn ? 'View, edit, or delete logged measurements from different periods' : 'مشاهده، ویرایش یا حذف رکوردهای ثبت‌شده در دوره‌های مختلف';

  const editMasterExModalTitle = document.getElementById('editMasterExModalTitle');
  if (editMasterExModalTitle && !editMasterExModalTitle.innerText.includes(':')) {
    editMasterExModalTitle.innerText = isEn ? '✏️ Edit Exercise in Bank (Admin)' : '✏️ ویرایش حرکت در بانک (ادمین)';
  }
  const editMasterExModalSubtitle = document.getElementById('editMasterExModalSubtitle');
  if (editMasterExModalSubtitle) editMasterExModalSubtitle.innerText = isEn ? 'Edit Persian and English name, target muscles, and tutorial videos' : 'ویرایش مشخصات اصلی، نام فارسی و انگلیسی، عضلات هدف و مدیریت ویدیوهای آموزشی';
  const editMasterExFaLabel = document.getElementById('editMasterExFaLabel');
  if (editMasterExFaLabel) editMasterExFaLabel.innerText = isEn ? 'Persian Name:' : 'نام فارسی حرکت:';
  const editMasterExEnLabel = document.getElementById('editMasterExEnLabel');
  if (editMasterExEnLabel) editMasterExEnLabel.innerText = isEn ? 'English Name:' : 'نام انگلیسی حرکت:';
  const editMasterExMusclesLabel = document.getElementById('editMasterExMusclesLabel');
  if (editMasterExMusclesLabel) editMasterExMusclesLabel.innerText = isEn ? 'Target Muscles:' : 'عضلات هدف:';
  const editMasterExCatLabel = document.getElementById('editMasterExCatLabel');
  if (editMasterExCatLabel) editMasterExCatLabel.innerText = isEn ? 'Category:' : 'محیط تمرین:';
  const editMasterExVideosLabel = document.getElementById('editMasterExVideosLabel');
  if (editMasterExVideosLabel) editMasterExVideosLabel.innerHTML = `<span>📹</span> <span>${isEn ? 'Tutorial Videos:' : 'ویدیوهای آموزشی حرکت:'}</span>`;
  const editMasterExAddVidHeading = document.getElementById('editMasterExAddVidHeading');
  if (editMasterExAddVidHeading) editMasterExAddVidHeading.innerText = isEn ? '➕ Add New Video:' : '➕ افزودن ویدیوی جدید:';
  const editMasterAddVidBtnText = document.getElementById('editMasterAddVidBtnText');
  if (editMasterAddVidBtnText) editMasterAddVidBtnText.innerText = isEn ? '+ Add Video to List' : '+ افزودن این ویدیو به لیست';
  const editMasterSaveBtnText = document.getElementById('editMasterSaveBtnText');
  if (editMasterSaveBtnText) editMasterSaveBtnText.innerText = isEn ? '💾 Save Changes in Exercise Bank' : '💾 ذخیره تغییرات در بانک حرکات';
  const editMasterCancelBtnText = document.getElementById('editMasterCancelBtnText');
  if (editMasterCancelBtnText) editMasterCancelBtnText.innerText = isEn ? 'Cancel' : 'انصراف';

  // Search & Select Exercise Modal
  const exSearchModalTitle = document.getElementById('exSearchModalTitle');
  if (exSearchModalTitle) exSearchModalTitle.innerText = isEn ? '🔍 Select & Change Exercise' : '🔍 انتخاب و تغییر حرکت';
  const exSearchModalDesc = document.getElementById('exSearchModalDesc');
  if (exSearchModalDesc) exSearchModalDesc.innerText = isEn ? 'Type Persian or English exercise name, or target muscle to quickly filter:' : 'نام فارسی یا انگلیسی حرکت یا عضله هدف را تایپ کنید تا فوراً پیدا شود:';
  const exSearchModalInput = document.getElementById('exSearchModalInput');
  if (exSearchModalInput) exSearchModalInput.placeholder = isEn ? 'Quick search exercise (e.g. bench press, squat, curl)...' : 'جستجوی سریع حرکت (مثلاً: زیربغل، پرس، اسکوات، جلو بازو)...';
  const closeExSearchModalBtn = document.getElementById('closeExSearchModalBtn');
  if (closeExSearchModalBtn) closeExSearchModalBtn.innerText = isEn ? 'Close ✕' : 'بستن ✕';
  const exSearchCategoryFilter = document.getElementById('exSearchCategoryFilter');
  if (exSearchCategoryFilter) {
    const cats = isEn 
      ? [
          { val: 'all', label: 'All' },
          { val: 'سینه', label: 'Chest' },
          { val: 'پشت', label: 'Back' },
          { val: 'پا', label: 'Legs' },
          { val: 'سرشانه', label: 'Shoulders' },
          { val: 'بازو', label: 'Arms' },
          { val: 'شکم', label: 'Core / Abs' }
        ]
      : [
          { val: 'all', label: 'همه' },
          { val: 'سینه', label: 'سینه' },
          { val: 'پشت', label: 'پشت / زیربغل' },
          { val: 'پا', label: 'پا / باسن' },
          { val: 'سرشانه', label: 'سرشانه' },
          { val: 'بازو', label: 'جلو بازو / پشت بازو' },
          { val: 'شکم', label: 'شکم / Core' }
        ];
    exSearchCategoryFilter.innerHTML = cats.map((c, i) => `
      <button type="button" class="btn-header-action ${activeSearchCategory === c.val ? 'active' : ''}" onclick="filterExSearchByCat('${c.val}', this)" style="padding:4px 9px; font-size:11px;">${c.label}</button>
    `).join('');
  }

  try { applyUiMode(); } catch(e) {}
}

function handleAdminPinLogin() {
  const pinInput = document.getElementById('adminAccessPinInput');
  if (!pinInput) return;
  const pin = pinInput.value.trim();
  pinInput.value = '';
  if (!pin) return;

  if (unlockAdminMode(pin)) {
    closeAuthModal();
    renderApp(true);
  } else {
    showToast(currentLang === 'en' ? '⚠️ Invalid access code.' : '⚠️ کد دسترسی وارد شده نادرست است.');
  }
}

function submitAdminAccessPin() {
  handleAdminPinLogin();
}

try { initLanguage(); } catch(e) {}

function loadAppData() {
  try {
    const rawCustEx = localStorage.getItem('chieftain_custom_exercises');
    if (rawCustEx) customExercises = JSON.parse(rawCustEx);
  } catch(e) { customExercises = []; }

  try {
    const rawProfiles = localStorage.getItem('chieftain_profiles_v9') || localStorage.getItem('chieftain_profiles_v8') || localStorage.getItem('chieftain_profiles_v7') || localStorage.getItem('chieftain_profiles_v6');
    if (rawProfiles) {
      allProfiles = JSON.parse(rawProfiles);
    } else {
      allProfiles = [];
    }
  } catch(e) {
    allProfiles = [];
  }

  // Preserve user profiles intact without destructive overwriting
  allProfiles = allProfiles.map(p => {
    if (p.id === 'hossein_chieftain') {
      p.name = 'Hossein Chieftain';
    } else if (p.id === 'morvarid') {
      p.name = 'مروارید';
    } else if (p.id === 'template_male') {
      p.name = 'برنامه نمونه آقایان (هایپرتروفی ۵ روزه)';
    } else if (p.id === 'template_female') {
      p.name = 'برنامه نمونه بانوان (تناسب اندام و فرم‌دهی)';
    }
    return p;
  });

  let tMale = allProfiles.find(p => p.id === 'template_male');
  if (!tMale) {
    tMale = JSON.parse(JSON.stringify(HOSSEIN_PROFILE));
    tMale.id = 'template_male';
    tMale.name = 'برنامه نمونه آقایان (هایپرتروفی ۵ روزه)';
    allProfiles.unshift(tMale);
  }

  let tFemale = allProfiles.find(p => p.id === 'template_female');
  if (!tFemale) {
    tFemale = JSON.parse(JSON.stringify(MORVARID_PROFILE));
    tFemale.id = 'template_female';
    tFemale.name = 'برنامه نمونه بانوان (تناسب اندام و فرم‌دهی)';
    allProfiles.push(tFemale);
  }

  saveProfiles();

  const savedActiveId = localStorage.getItem('chieftain_active_profile_id');
  if (savedActiveId && allProfiles.some(p => p.id === savedActiveId)) {
    activeProfileId = savedActiveId;
  } else if (allProfiles.length > 0) {
    activeProfileId = allProfiles[0].id;
  } else {
    activeProfileId = 'template_male';
  }
}

function saveProfiles() {
  localStorage.setItem('chieftain_profiles_v9', JSON.stringify(allProfiles));
  if (typeof pushToCloudStorage === 'function' && isAutoCloudSyncEnabled()) {
    pushToCloudStorage(true);
  }
}

// Master Exercise Overrides & Admin State
let masterExerciseOverrides = {};
try {
  masterExerciseOverrides = JSON.parse(localStorage.getItem('chieftain_master_overrides') || '{}');
} catch(e) {
  masterExerciseOverrides = {};
}

function isAdminUnlocked() {
  if (typeof currentAuthUser !== 'undefined' && currentAuthUser) {
    if (currentAuthUser.app_metadata?.role === 'admin' ||
        currentAuthUser.user_metadata?.role === 'admin' ||
        currentAuthUser.user_metadata?.is_admin === true) {
      return true;
    }
  }
  return localStorage.getItem('chieftain_admin_unlocked') === 'true';
}

function unlockAdminMode(pwd) {
  if (!pwd || !pwd.trim()) return false;
  const cleanPwd = pwd.trim();
  const storedPin = localStorage.getItem('chieftain_admin_pin');

  // First time configuration: store entered PIN as the user's custom admin PIN
  if (!storedPin) {
    localStorage.setItem('chieftain_admin_pin', cleanPwd);
    localStorage.setItem('chieftain_admin_unlocked', 'true');
    updateAdminUI();
    showToast(currentLang === 'en' ? '👑 Admin PIN configured and unlocked!' : '👑 رمز عبور ادمین با موفقیت تعیین شد و حالت مدیریت فعال گردید!');
    return true;
  }

  if (cleanPwd === storedPin) {
    localStorage.setItem('chieftain_admin_unlocked', 'true');
    updateAdminUI();
    showToast(currentLang === 'en' ? '👑 Admin Mode Unlocked!' : '👑 حالت مدیریت ادمین فعال شد!');
    return true;
  }
  return false;
}

function lockAdminMode() {
  localStorage.removeItem('chieftain_admin_unlocked');
  updateAdminUI();
  showToast(currentLang === 'en' ? '🔒 Admin Mode locked.' : '🔒 از حالت مدیریت ادمین خارج شدید.');
}

function toggleAdminModePrompt() {
  const isEn = currentLang === 'en';
  if (isAdminUnlocked()) {
    const choice = confirm(isEn 
      ? 'Admin Mode is active.\n\nClick OK to log out of Admin Mode, or Cancel to change your Admin PIN.' 
      : 'حالت ادمین در حال حاضر فعال است.\n\nبرای خروج از حالت ادمین روی OK کلیک کنید، یا برای تغییر رمز عبور ادمین روی Cancel کلیک نمایید.');
    if (choice) {
      lockAdminMode();
    } else {
      const newPin = prompt(isEn ? 'Enter new Admin PIN:' : 'لطفاً رمز عبور جدید ادمین را وارد کنید:');
      if (newPin && newPin.trim()) {
        localStorage.setItem('chieftain_admin_pin', newPin.trim());
        showToast(isEn ? '✅ Admin PIN updated successfully!' : '✅ رمز عبور ادمین با موفقیت ذخیره شد!');
      }
    }
  } else {
    const storedPin = localStorage.getItem('chieftain_admin_pin');
    const promptMsg = !storedPin
      ? (isEn ? 'Set an Admin PIN to protect administrative actions:' : 'جهت فعال‌سازی حالت ادمین، لطفاً یک رمز عبور جدید تعیین نمایید:')
      : (isEn ? 'Please enter Admin PIN:' : 'لطفاً رمز عبور ادمین را وارد نمایید:');
    const pwd = prompt(promptMsg);
    if (pwd === null) return;
    if (unlockAdminMode(pwd.trim())) {
      // Toast shown inside unlockAdminMode
    } else {
      alert(isEn ? '❌ Incorrect admin PIN.' : '❌ رمز عبور ادمین اشتباه است.');
    }
  }
}

function updateAdminUI() {
  const unlocked = isAdminUnlocked();
  const isEn = currentLang === 'en';
  const lockedBox = document.getElementById('quickEditAdminLockedBox');
  const unlockedBox = document.getElementById('quickEditAdminUnlockedBox');
  const toggleBtn = document.getElementById('quickEditAdminToggleBtn');
  const libAdminBtn = document.getElementById('libAdminToggleBtn');

  if (lockedBox) lockedBox.style.display = unlocked ? 'none' : 'block';
  if (unlockedBox) unlockedBox.style.display = unlocked ? 'block' : 'none';
  if (toggleBtn) {
    toggleBtn.innerHTML = unlocked ? (isEn ? '🔒 Exit Admin' : '🔒 خروج ادمین') : (isEn ? '🔑 Admin Login' : '🔑 ورود ادمین');
    toggleBtn.style.color = unlocked ? '#ef4444' : '#fbbf24';
    toggleBtn.style.borderColor = unlocked ? '#ef444488' : '#fbbf2488';
  }
  if (libAdminBtn) {
    libAdminBtn.innerHTML = unlocked ? (isEn ? '👑 Admin Active (Exit)' : '👑 ادمین فعال است (خروج)') : (isEn ? '🔑 Admin Login' : '🔑 ورود ادمین');
    libAdminBtn.style.color = unlocked ? '#22c55e' : '#fbbf24';
    libAdminBtn.style.borderColor = unlocked ? '#22c55e88' : '#fbbf2488';
  }

  const libModal = document.getElementById('libraryModal');
  if (libModal && libModal.classList.contains('open')) {
    if (typeof applyLibraryFilters === 'function') {
      applyLibraryFilters();
    } else {
      renderLibraryList(getAllExercises());
    }
  }
}

function saveMasterOverrides() {
  localStorage.setItem('chieftain_master_overrides', JSON.stringify(masterExerciseOverrides));
  if (typeof pushToCloudStorage === 'function' && isAutoCloudSyncEnabled()) {
    pushToCloudStorage(true);
  }
}

function saveCustomExercises() {
  localStorage.setItem('chieftain_custom_exercises', JSON.stringify(customExercises));
  if (typeof pushToCloudStorage === 'function' && isAutoCloudSyncEnabled()) {
    pushToCloudStorage(true);
  }
}

function getAllExercises() {
  const masters = MASTER_EXERCISES.map(m => {
    if (masterExerciseOverrides && masterExerciseOverrides[m.id]) {
      return Object.assign({}, m, masterExerciseOverrides[m.id]);
    }
    return m;
  });

  const currentUserId = (typeof currentAuthUser !== 'undefined' && currentAuthUser) ? currentAuthUser.id : (activeProfileId || 'local');
  const visibleCustom = (customExercises || []).filter(e => {
    if (isAdminUnlocked()) return true;
    if (e.isApproved) return true;
    return e.ownerId === currentUserId || (!e.ownerId && isAdminUnlocked());
  });

  // Deduplicate by ID and by normalized title to prevent any duplicate exercise from ever appearing
  const combined = [...masters, ...visibleCustom];
  const seenIds = new Set();
  const seenNames = new Set();
  const uniqueExercises = [];

  for (const ex of combined) {
    if (!ex || !ex.id) continue;
    const normFa = (ex.fa || '').trim().toLowerCase();
    const normEn = (ex.en || '').trim().toLowerCase();
    const nameKey = `${normFa}__${normEn}`;

    if (seenIds.has(ex.id)) continue;
    if (normFa && normEn && seenNames.has(nameKey)) continue;

    seenIds.add(ex.id);
    if (normFa && normEn) seenNames.add(nameKey);
    uniqueExercises.push(ex);
  }

  return uniqueExercises;
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

  // Always ensure proper display visibility of main containers
  const workoutContent = document.getElementById('workoutContent');
  const metricsView = document.getElementById('bodyMetricsView');

  if (activeMainTab === 'metrics') {
    if (workoutContent) workoutContent.style.display = 'none';
    if (metricsView) {
      metricsView.style.display = 'block';
      try {
        renderBodyMetricsView();
      } catch(e) {
        console.error('Error in renderBodyMetricsView:', e);
      }
    }
  } else {
    activeMainTab = 'workout';
    if (metricsView) metricsView.style.display = 'none';
    if (workoutContent) workoutContent.style.display = 'block';
  }

  try { renderProfileSelect(); } catch(e) { console.error('Error in renderProfileSelect:', e); }
  try { renderHeader(); } catch(e) { console.error('Error in renderHeader:', e); }
  try { renderDayNav(); } catch(e) { console.error('Error in renderDayNav:', e); }
  try { renderWorkoutDays(); } catch(e) { console.error('Error in renderWorkoutDays:', e); }
  try { applyUiMode(); } catch(e) {}

  // Self-healing safety check: ensure workoutContent is NEVER blank when activeMainTab is workout
  if (activeMainTab === 'workout' && workoutContent) {
    if (!workoutContent.innerHTML || workoutContent.innerHTML.trim() === '') {
      console.warn('[Chieftain] Detected empty workoutContent. Self-healing from built-in profile...');
      const prof = getActiveProfile();
      if (prof.id === 'hossein_chieftain') {
        prof.days = JSON.parse(JSON.stringify(HOSSEIN_PROFILE.days));
      } else if (prof.id === 'morvarid') {
        prof.days = JSON.parse(JSON.stringify(MORVARID_PROFILE.days));
      }
      saveProfiles();
      try { renderWorkoutDays(); } catch(err) {}
    }
  }

  try { loadSavedSets(); } catch(e) { console.error('Error in loadSavedSets:', e); }
  try { updateAllProgressBars(); } catch(e) { console.error('Error in updateAllProgressBars:', e); }
  try { setupSectionObserver(); } catch(e) {}
  try { setupDragAndDropEngine(); } catch(e) {}

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
  const isEn = currentLang === 'en';
  select.innerHTML = allProfiles.map(p => {
    let name = p.name;
    if (isEn) {
      if (p.id === 'hossein_chieftain') {
        name = "Hossein Chieftain";
      } else if (p.id === 'template_male') {
        name = "Men's Sample Plan (5-Day Hypertrophy)";
      } else if (p.id === 'morvarid') {
        name = "Morvarid";
      } else if (p.id === 'template_female') {
        name = "Women's Sample Plan (Tone & Fitness)";
      } else {
        name = p.name_en || p.name;
      }
    } else {
      if (p.id === 'hossein_chieftain') {
        name = "حسین چیفتن";
      } else if (p.id === 'template_male') {
        name = "برنامه نمونه آقایان (هایپرتروفی ۵ روزه)";
      } else if (p.id === 'morvarid') {
        name = "مروارید";
      } else if (p.id === 'template_female') {
        name = "برنامه نمونه بانوان (تناسب اندام و فرم‌دهی)";
      }
    }
    // Only append (Default) / (پیش‌فرض) on template_male if active AND guest
    let badge = '';
    if (p.id === 'template_male' && activeProfileId === 'template_male' && !isAdminUnlocked() && !currentAuthUser) {
      badge = isEn ? ' (Default)' : ' (پیش‌فرض)';
    }
    return `<option value="${p.id}" ${p.id === activeProfileId ? 'selected' : ''}>${name}${badge}</option>`;
  }).join('');
}

function renderHeader() {
  const prof = getActiveProfile();
  const titleEl = document.getElementById('appTitle');
  const isEn = currentLang === 'en';
  if (titleEl) {
    if (typeof currentAuthUser !== 'undefined' && currentAuthUser) {
      const name = currentAuthUser.user_metadata?.display_name || currentAuthUser.email?.split('@')[0] || '';
      titleEl.innerText = isEn ? `Workout Plan: ${name || prof.name}` : `برنامه تمرینی ${name || prof.name}`;
    } else {
      titleEl.innerText = isEn ? 'Chieftain Pro | Specialized Workout System' : 'سامانه تخصصی بدنسازی و تمرین | Chieftain Pro';
    }
  }

  const deleteBtn = document.getElementById('deleteProfileBtn');
  if (deleteBtn) {
    deleteBtn.style.display = prof.isDefault ? 'none' : 'inline-flex';
  }

  // Dynamic Badges in Header
  const badgesEl = document.getElementById('headerBadges');
  if (badgesEl) {
    const gymDays = prof.days.filter(d => d.type === 'gym').map(d => translateDayTitle(d.title)).join(isEn ? ', ' : '، ');
    const homeDays = prof.days.filter(d => d.type === 'home').map(d => translateDayTitle(d.title)).join(isEn ? ', ' : '، ');
    const restDays = prof.days.filter(d => d.type === 'rest').map(d => translateDayTitle(d.title)).join(isEn ? ', ' : '، ');

    let html = '';
    if (gymDays) html += `<div class="header-badge">🏋️ ${gymDays}: ${t('gym')}</div>`;
    if (homeDays) html += `<div class="header-badge">🏠 ${homeDays}: ${t('home')}</div>`;
    if (restDays) html += `<div class="header-badge">🛌 ${restDays}: ${t('rest')}</div>`;
    badgesEl.innerHTML = html;
  }

  updateGreetingText();
}

function updateGreetingText() {
  const prof = getActiveProfile();
  const greetingEl = document.getElementById('greetingText');
  if (!greetingEl) return;
  const isEn = currentLang === 'en';

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

  const isSamplePlan = prof.id === 'template_male' || prof.id === 'template_female' || String(prof.name).includes('نمونه') || String(prof.name).includes('برنامه نمونه');
  const profNameFa = isSamplePlan ? 'قهرمان' : prof.name;
  const profNameEn = isSamplePlan ? 'Champion' : prof.name;

  if (isToday100) {
    greetingEl.innerText = isEn
      ? `🎉 Great job ${profNameEn}! Today's workout is 100% completed! 🔥 Keep growing & recovering 💪`
      : `🎉 دمت گرم ${profNameFa}! تمرین امروز رو ۱۰۰٪ با موفقیت ترکوندی و تموم کردی! 🔥 عضلات در حال رشد و ریکاوری‌ان 💪`;
    return;
  }

  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    greetingEl.innerText = isEn
      ? `Good morning ${profNameEn}! Time to energize and build strength ⚡`
      : `صبح بخیر ${profNameFa}! وقت انرژی و ساختن عضلاته ⚡`;
  } else if (hour >= 12 && hour < 18) {
    greetingEl.innerText = isEn
      ? `Good afternoon ${profNameEn}! Ready for a powerful workout session? 💪`
      : `عصر بخیر ${profNameFa}! آماده یک جلسه تمرینی پرقدرت هستی؟ 💪`;
  } else {
    greetingEl.innerText = isEn
      ? `Good evening ${profNameEn}! Recovery and consistency are key 🔥`
      : `شب بخیر ${profNameFa}! ریکاوری و ثبات کلید موفقیته 🔥`;
  }
}

function renderDayNav() {
  const prof = getActiveProfile();
  const nav = document.getElementById('dayNav');
  if (!nav) return;
  const isEn = currentLang === 'en';
  
  const todaySecId = (typeof getTodaySectionId === 'function') ? getTodaySectionId() : 'd1';

  const tabsHtml = prof.days.map((d, idx) => {
    const typeLabel = d.type === 'gym' ? t('gym') : (d.type === 'home' ? t('home') : t('rest'));
    const isToday = (d.id === todaySecId);
    const isActive = (activeMainTab === 'workout') && (isToday || (!prof.days.some(x => x.id === todaySecId) && idx === 0));
    const dayTitle = translateDayTitle(d.title);
    return `
      <a href="javascript:void(0)" onclick="navigateToDaySection(event, '${d.id}')" class="nav-tab ${isActive ? 'active' : ''} ${isToday ? 'is-today' : ''}" data-day="${idx}" data-target-id="${d.id}">
        <span>${dayTitle}</span>
        <span class="tab-badge">${typeLabel}</span>
        <span id="nav-pill-${d.id}" class="tab-prog-pill" style="display:none;">${isEn ? '0%' : '۰٪'}</span>
      </a>
    `;
  }).join('');

  const metricsBadge = `<span class="tab-badge" style="background:rgba(56,189,248,0.2); color:#38bdf8; font-weight:800;">${t('analysisBadge')}</span>`;
  const metricsTab = `<a href="javascript:void(0)" onclick="switchMainTab('metrics')" class="nav-tab ${activeMainTab === 'metrics' ? 'active' : ''}" data-target-id="body-metrics" style="border-color:rgba(56,189,248,0.4);"><span>${t('metricsTab')}</span>${metricsBadge}</a>`;

  nav.innerHTML = tabsHtml + `<a href="javascript:void(0)" onclick="navigateToDaySection(event, 'weekly-summary')" class="nav-tab" data-day="summary" data-target-id="weekly-summary">${t('summaryTab')}</a>` + metricsTab;
}

function navigateToDaySection(e, secId) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (activeMainTab !== 'workout') {
    activeMainTab = 'workout';
    const workoutContent = document.getElementById('workoutContent');
    const metricsView = document.getElementById('bodyMetricsView');
    if (metricsView) metricsView.style.display = 'none';
    if (workoutContent) workoutContent.style.display = 'block';
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

function translateVideoTitle(title, idx = 0, totalCount = 1) {
  if (!title) {
    return currentLang === 'en' 
      ? (totalCount === 1 ? 'Exercise Video' : `Video ${idx + 1}`)
      : (totalCount === 1 ? 'ویدیو آموزش' : `ویدیو ${idx + 1}`);
  }
  if (currentLang !== 'en') return title;

  let tStr = String(title);
  tStr = tStr.replace(/آموزش/g, 'Video')
             .replace(/ویدیو/g, 'Video')
             .replace(/\(شورت\)/g, '(Short)')
             .replace(/شورت/g, 'Short')
             .replace(/\(کامل\)/g, '(Full)')
             .replace(/کامل/g, 'Full')
             .replace(/فرم کوتاه/g, 'Short Form')
             .replace(/آموزش سریع/g, 'Quick Guide')
             .replace(/آموزش کامل/g, 'Full Tutorial')
             .replace(/حرکت اصلاحی کتف راست با گیرش پرونیت/g, 'Right Scapular Corrective (Pronated Grip)')
             .replace(/حرکت اصلاحی کتف راست با گیرش سوپینیت/g, 'Right Scapular Corrective (Supinated Grip)')
             .replace(/حرکت اصلاحی کتف راست با گیرش موازی/g, 'Right Scapular Corrective (Neutral Grip)')
             .replace(/حرکت اصلاحی/g, 'Corrective Exercise')
             .replace(/کتف راست/g, 'Right Scapula')
             .replace(/کتف چپ/g, 'Left Scapula')
             .replace(/کتف/g, 'Scapula')
             .replace(/گیرش پرونیت/g, 'Pronated Grip')
             .replace(/گیرش سوپینیت/g, 'Supinated Grip')
             .replace(/گیرش موازی/g, 'Neutral Grip')
             .replace(/۱/g, '1').replace(/۲/g, '2').replace(/۳/g, '3')
             .replace(/۴/g, '4').replace(/۵/g, '5').replace(/۶/g, '6')
             .replace(/۷/g, '7').replace(/۸/g, '8').replace(/۹/g, '9');

  if (/[\u0600-\u06FF]/.test(tStr)) {
    const enMatch = tStr.match(/\([A-Za-z0-9\s\-]+\)/);
    if (enMatch) {
      tStr = `Video ${idx + 1} ${enMatch[0]}`;
    } else {
      tStr = totalCount === 1 ? 'Exercise Video' : `Video ${idx + 1}`;
    }
  }
  return tStr;
}

function renderVideoButtons(videos) {
  if (!videos || videos.length === 0) {
    return `<span class="video-missing">${t('textGuide')}</span>`;
  }

  const isEn = currentLang === 'en';

  return videos.map((v, i) => {
    if (v.isImage || (v.url && v.url.startsWith('data:image'))) {
      let imgTitle = v.title || t('formImage');
      if (isEn && imgTitle) {
        imgTitle = imgTitle.replace(/تصویر فرم/g, 'Form Image').replace(/عکس/g, 'Image');
        if (/[\u0600-\u06FF]/.test(imgTitle)) imgTitle = 'Form Image';
      }
      return `<button class="video-btn" onclick="openImageModal('${v.url}')" style="background:rgba(234,179,8,0.15); color:#facc15; border-color:rgba(234,179,8,0.35); cursor:pointer;">
        <span>🖼️</span> <span>${imgTitle}</span>
      </button>`;
    }
    const defTitle = (videos.length === 1 ? t('videoGuide') : ((isEn ? 'Video ' : 'ویدیو ') + (i+1)));
    let rawTitle = v.title || defTitle;
    let title = isEn ? translateVideoTitle(rawTitle, i, videos.length) : rawTitle;

    return `
      <a href="${v.url}" target="_blank" rel="noopener" class="video-btn">
        <span>▶</span> <span>${title}</span>
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

function renderExerciseCard(item, dayId, isSuperset = false, singleIdx = -1, totalSingles = 0, ssIdx = -1, exIdx = -1, totalSSExercises = 0, seqNum = null, totalDayExercises = 0) {
  if (!item || !item.exId) return '';
  const ex = findExerciseById(item.exId) || { id: item.exId, fa: item.exId, en: '', muscles: 'عمومی', videos: [] };
  const reps = translateReps(String(item.reps || ex.defaultReps || '3 × 8–12'));
  const setsCount = parseSetsFromReps(item.reps || ex.defaultReps || '3 × 8–12', item.sets);
  const isEn = currentLang === 'en';

  let displayName = '';
  let subtextHtml = '';

  if (isEn) {
    displayName = ex.en || item.customName || ex.fa || item.exId;
    if (item.customName && item.customName !== ex.en) {
      subtextHtml = `<div class="exercise-name-en" style="color:#94a3b8; font-size:11px;">Base: ${ex.en || ex.fa}</div>`;
    } else {
      subtextHtml = '';
    }
  } else {
    displayName = item.customName ? item.customName : (ex.fa || item.exId);
    subtextHtml = item.customName && item.customName !== ex.fa 
      ? `<div class="exercise-name-en" style="color:#94a3b8; font-size:11px;">حرکت پایه: ${ex.fa || item.exId}</div>` 
      : (ex.en ? `<div class="exercise-name-en">${ex.en}</div>` : '');
  }

  const seqBadgeHtml = (seqNum && seqNum > 0)
    ? `<span class="exercise-seq-badge" title="${isEn ? `Exercise ${seqNum} of ${totalDayExercises}` : `حرکت ${seqNum} از ${totalDayExercises}`}">${isEn ? `Exercise ${seqNum}` : `حرکت ${seqNum}`}</span>`
    : '';

  const setBtns = Array.from({length: setsCount}, (_, i) => 
    `<button class="set-btn" onclick="handleSetClick(this)">${i+1}</button>`
  ).join('');

  // Isometric Quick Button check (Only for true isometric holds, NOT rep-based variations)
  let isoBtnHtml = '';
  const lowerFa = String(ex.fa || '').toLowerCase();
  const lowerEn = String(ex.en || '').toLowerCase();
  const repsStr = String(item.reps || reps || '');
  const isExcluded = lowerFa.includes('خرسی') || lowerFa.includes('پایک') || lowerFa.includes('کیک') || lowerEn.includes('bear') || lowerEn.includes('pike') || lowerEn.includes('kickback');
  const isIso = !isExcluded && (ex.isIsometric === true || ((lowerFa.includes('ایزومتریک') || lowerFa.includes('پلانک آرنج') || lowerFa.includes('ساید پلانک') || lowerFa.includes('وال سیت') || lowerEn.includes('wall sit') || repsStr.includes('ثانیه') || repsStr.includes('sec')) && !repsStr.includes('تکرار') && !repsStr.includes('reps')));

  if (isIso || item.isoDuration) {
    let defaultSeconds = item.isoDuration || 30;
    if (!item.isoDuration) {
      if (reps.includes('20') || reps.includes('۲۰')) defaultSeconds = 20;
      if (reps.includes('40') || reps.includes('۴۰') || reps.includes('45') || reps.includes('۴۵')) defaultSeconds = 45;
      if (reps.includes('60') || reps.includes('۶۰')) defaultSeconds = 60;
    }
    
    isoBtnHtml = `
      <button class="quick-iso-btn" onclick="quickStartIsoTimer(${defaultSeconds}, '${escapeHtml(displayName)}')" title="${isEn ? `Open ${defaultSeconds}s timer` : `باز کردن تایمر ${defaultSeconds} ثانیه`}">
        <span>⏱️</span> <span>${t('timer')} ${defaultSeconds}${t('timerSec')}</span>
      </button>
    `;
  }

  const logBtnHtml = `
    <button class="log-btn" data-day-id="${dayId}" data-ex-id="${ex.id}" onclick="openLogForCard(this)" title="${isEn ? 'Log weight, reps and RIR for progressive overload' : 'ثبت وزنه، تکرار و RIR برای اضافه بار تدریجی'}">
      <span>📝</span> <span>${t('logWeight')}</span>
    </button>
    <button class="chart-btn" data-ex-id="${ex.id}" onclick="openChartForCard(this)" title="${isEn ? 'Progress chart and weight increase over time' : 'نمودار پیشرفت و افزایش وزنه نسبت به جلسه اول'}">
      <span>📈</span> <span>${t('chart')}</span>
    </button>
    <button class="edit-card-btn" data-day-id="${dayId}" data-ex-id="${ex.id}" data-is-superset="${isSuperset ? '1' : '0'}" onclick="openQuickEditForCard(this)" title="${isEn ? 'Quick edit this exercise' : 'ویرایش سریع این حرکت'}">
      <span>✏️</span> <span>${t('edit')}</span>
    </button>
  `;

  let moveBtnsHtml = '';
  if (!isSuperset && singleIdx >= 0) {
    moveBtnsHtml = `
      <div class="card-reorder-toolbar">
        ${singleIdx > 0 ? `<button class="btn-move-action" onclick="moveSingleItem('${dayId}', ${singleIdx}, -1)" title="${isEn ? 'Move exercise up' : 'انتقال حرکت به بالا'}">${t('moveUp')}</button>` : ''}
        ${singleIdx < totalSingles - 1 ? `<button class="btn-move-action" onclick="moveSingleItem('${dayId}', ${singleIdx}, 1)" title="${isEn ? 'Move exercise down' : 'انتقال حرکت به پایین'}">${t('moveDown')}</button>` : ''}
        <button class="btn-move-action" style="color:#fcd34d; border-color:rgba(252,211,77,0.3);" onclick="openMoveDayModal('single', '${dayId}', -1, ${singleIdx})" title="${isEn ? 'Move this exercise to another day' : 'انتقال این حرکت به روز دیگر'}">${t('moveDay')}</button>
      </div>
    `;
  } else if (isSuperset && ssIdx >= 0 && totalSSExercises > 1) {
    moveBtnsHtml = `
      <div class="card-reorder-toolbar">
        ${exIdx > 0 ? `<button class="btn-move-action" onclick="moveSupersetExercise('${dayId}', ${ssIdx}, ${exIdx}, -1)" title="${isEn ? 'Move exercise in superset up' : 'انتقال حرکت در سوپرست به بالا'}">${t('moveUp')}</button>` : ''}
        ${exIdx < totalSSExercises - 1 ? `<button class="btn-move-action" onclick="moveSupersetExercise('${dayId}', ${ssIdx}, ${exIdx}, 1)" title="${isEn ? 'Move exercise in superset down' : 'انتقال حرکت در سوپرست به پایین'}">${t('moveDown')}</button>` : ''}
        <button class="btn-move-action" style="color:#fcd34d; border-color:rgba(252,211,77,0.3);" onclick="splitSingleExerciseFromSuperset('${dayId}', ${ssIdx}, ${exIdx})" title="${isEn ? 'Split exercise from superset to single' : 'تفکیک این حرکت از سوپرست به عنوان حرکت مستقل'}">${t('splitToSingle')}</button>
      </div>
    `;
  }

  return `
    <article class="exercise-card" data-ex-id="${dayId}_${ex.id}" data-day-id="${dayId}" data-is-ss="${isSuperset ? '1' : '0'}" data-ss-idx="${ssIdx}" data-ex-idx="${isSuperset ? exIdx : singleIdx}">
      <div class="exercise-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="card-drag-handle" title="${isEn ? 'Drag or tap to reorder' : 'لمس یا کشیدن برای جابجایی سریع'}">⠿</span>
          ${seqBadgeHtml}
          <div>
            <div class="exercise-name-fa">${displayName}</div>
            ${subtextHtml}
          </div>
        </div>
        <div class="reps-badge">${reps}</div>
      </div>
      <div class="muscles-row">
        <span class="muscle-tag">${t('targetMuscles')} ${translateMuscles(ex.muscles)}</span>
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let currentQuickEditVideos = [];

function renderQuickEditVideosList() {
  const container = document.getElementById('quickEditVideosContainer');
  const countEl = document.getElementById('quickEditVideosCount');
  if (!container) return;

  if (countEl) {
    countEl.innerText = `${currentQuickEditVideos.length} ویدیو`;
  }

  if (currentQuickEditVideos.length === 0) {
    container.innerHTML = '<div style="font-size:11px; color:#94a3b8; text-align:center; padding:6px;">هیچ ویدیویی برای این حرکت ثبت نشده است.</div>';
    return;
  }

  container.innerHTML = currentQuickEditVideos.map((v, i) => `
    <div style="display:flex; gap:4px; align-items:center; background:#152033; padding:4px 6px; border-radius:6px; border:1px solid #334155;">
      <input type="text" class="form-input" style="font-size:11px; padding:4px; flex:1;" value="${escapeHtml(v.title || '')}" onchange="updateVideoInQuickEdit(${i}, 'title', this.value)" placeholder="عنوان">
      <input type="text" class="form-input" style="font-size:11px; padding:4px; flex:2; direction:ltr;" value="${escapeHtml(v.url || '')}" onchange="updateVideoInQuickEdit(${i}, 'url', this.value)" placeholder="لینک ویدیو">
      <button type="button" class="btn-header-action" style="padding:2px 6px; color:#f87171; border-color:#f8717155; font-size:11px;" onclick="deleteVideoInQuickEdit(${i})">🗑️</button>
    </div>
  `).join('');
}

function updateVideoInQuickEdit(idx, field, val) {
  if (currentQuickEditVideos[idx]) {
    currentQuickEditVideos[idx][field] = val.trim();
  }
}

function addVideoInQuickEdit() {
  const titleInput = document.getElementById('quickEditNewVidTitle');
  const urlInput = document.getElementById('quickEditNewVidUrl');
  const url = urlInput ? urlInput.value.trim() : '';
  let title = titleInput ? titleInput.value.trim() : '';

  if (!url) {
    alert('لطفاً آدرس لینک ویدیو را وارد نمایید.');
    return;
  }

  if (!title) {
    title = `آموزش ${currentQuickEditVideos.length + 1}`;
  }

  currentQuickEditVideos.push({ title, url });
  if (titleInput) titleInput.value = '';
  if (urlInput) urlInput.value = '';
  renderQuickEditVideosList();
  showToast('➕ ویدیو به لیست اضافه شد. برای ذخیره نهایی، دکمه ذخیره مرجع را بزنید.');
}

function deleteVideoInQuickEdit(idx) {
  currentQuickEditVideos.splice(idx, 1);
  renderQuickEditVideosList();
}

function saveMasterExerciseFromQuickEdit() {
  if (!isAdminUnlocked()) {
    alert('⚠️ فقط ادمین مجاز به تغییر مشخصات مرجع و ویدیوها است.');
    return;
  }

  const exId = currentQuickEditTarget.exId;
  if (!exId) return;

  const fa = document.getElementById('quickEditMasterFa').value.trim();
  const en = document.getElementById('quickEditMasterEn').value.trim();
  const muscles = document.getElementById('quickEditMasterMuscles').value.trim();

  if (!fa) {
    alert('نام فارسی حرکت نمی‌تواند خالی باشد.');
    return;
  }

  if (exId.startsWith('cust_')) {
    const custEx = (customExercises || []).find(e => e.id === exId);
    if (custEx) {
      custEx.fa = fa;
      custEx.en = en;
      custEx.muscles = muscles;
      custEx.videos = JSON.parse(JSON.stringify(currentQuickEditVideos));
      saveCustomExercises();
    }
  } else {
    if (!masterExerciseOverrides) masterExerciseOverrides = {};
    masterExerciseOverrides[exId] = {
      fa: fa,
      en: en,
      muscles: muscles,
      videos: JSON.parse(JSON.stringify(currentQuickEditVideos))
    };
    saveMasterOverrides();
  }

  showToast('✅ تغییرات مرجع حرکت و ویدیوها با موفقیت در بانک حرکات ذخیره شد!');
  renderApp(true);
  renderLibraryList(getAllExercises());
  document.getElementById('quickEditExModalTitle').innerText = `✏️ ویرایش: ${fa}`;
}

function openQuickEditForExercise(exId) {
  const ex = findExerciseById(exId);
  if (!ex) return;
  currentQuickEditTarget = { dayId: null, exId: exId, isSuperset: false };

  document.getElementById('quickEditExModalTitle').innerText = `✏️ ویرایش مرجع: ${ex.fa}`;
  document.getElementById('quickEditExSelectVal').value = exId;
  document.getElementById('pickerSelectedDisplayQuickEdit').innerText = 'حرکت انتخابی: ' + ex.fa;
  document.getElementById('pickerSearchQuickEdit').value = ex.fa;

  document.getElementById('quickEditExReps').value = ex.defaultReps || '3 × 8–12';
  document.getElementById('quickEditExSets').value = String(ex.defaultSets || 3);

  const customNameInput = document.getElementById('quickEditExCustomName');
  if (customNameInput) customNameInput.value = '';

  const isoInput = document.getElementById('quickEditExIsoDuration');
  if (isoInput) isoInput.value = '';

  const notSsBox = document.getElementById('quickEditNotSupersetBox');
  const isSsBox = document.getElementById('quickEditIsSupersetBox');
  if (notSsBox && isSsBox) {
    notSsBox.style.display = 'none';
    isSsBox.style.display = 'none';
  }

  const masterFaInput = document.getElementById('quickEditMasterFa');
  const masterEnInput = document.getElementById('quickEditMasterEn');
  const masterMusclesInput = document.getElementById('quickEditMasterMuscles');
  if (masterFaInput) masterFaInput.value = ex.fa || '';
  if (masterEnInput) masterEnInput.value = ex.en || '';
  if (masterMusclesInput) masterMusclesInput.value = ex.muscles || '';

  currentQuickEditVideos = JSON.parse(JSON.stringify(ex.videos || []));
  renderQuickEditVideosList();
  updateAdminUI();

  document.getElementById('quickEditExModal').classList.add('open');
}

function openQuickEditExModal(dayId, exId, reps, sets, isSuperset) {
  currentQuickEditTarget = { dayId, exId, isSuperset };
  const ex = findExerciseById(exId);
  const prof = getActiveProfile();
  const day = prof ? prof.days.find(d => d.id === dayId) : null;

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

  // Admin Master Fields & Videos
  const masterFaInput = document.getElementById('quickEditMasterFa');
  const masterEnInput = document.getElementById('quickEditMasterEn');
  const masterMusclesInput = document.getElementById('quickEditMasterMuscles');
  if (masterFaInput) masterFaInput.value = ex.fa || '';
  if (masterEnInput) masterEnInput.value = ex.en || '';
  if (masterMusclesInput) masterMusclesInput.value = ex.muscles || '';

  currentQuickEditVideos = JSON.parse(JSON.stringify(ex.videos || []));
  renderQuickEditVideosList();
  updateAdminUI();

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
  'single_arm_peck_deck_fly': ['سینه'],

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
  'single_arm_pronated_scapular_correction': ['پشت', 'سرشانه'],

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
  'seated_calf_raise_hamstring_machine': ['ساق'],

  // Lower Back (فیله و پایین کمر)
  'back_extension': ['فیله', 'باسن'],
  'dumbbell_incline_row_low_back': ['فیله', 'پشت'],

  // Core & Abs (شکم و عضلات مرکزی)
  'ab_crunch_machine': ['شکم'],
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
  const isEn = currentLang === 'en';

  const muscleGroups = isEn ? [
    { key: 'سینه', label: 'Chest' },
    { key: 'پشت', label: 'Lats & Back' },
    { key: 'سرشانه', label: 'Shoulders & Deltoids' },
    { key: 'جلو بازو', label: 'Biceps' },
    { key: 'پشت بازو', label: 'Triceps' },
    { key: 'چهارسر', label: 'Quadriceps (Quads)' },
    { key: 'همسترینگ', label: 'Hamstrings' },
    { key: 'باسن', label: 'Glutes' },
    { key: 'خارج ران', label: 'Abductors & Glute Medius' },
    { key: 'داخل ران', label: 'Adductors' },
    { key: 'ساق', label: 'Calves' },
    { key: 'فیله', label: 'Lower Back' },
    { key: 'شکم', label: 'Core & Abs' }
  ] : [
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

  (prof.days || []).forEach(day => {
    if (!day || day.type === 'rest') return;

    const dayItems = [];
    if (Array.isArray(day.singles)) {
      day.singles.forEach(s => { if (s && s.exId) dayItems.push(s); });
    }
    if (Array.isArray(day.supersets)) {
      day.supersets.forEach(ss => {
        if (ss && Array.isArray(ss.exercises)) {
          ss.exercises.forEach(s => { if (s && s.exId) dayItems.push(s); });
        }
      });
    }

    dayItems.forEach(item => {
      if (!item || !item.exId) return;
      const ex = findExerciseById(item.exId) || { id: item.exId, fa: item.exId, en: '' };
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
            name: (isEn && ex.en) ? ex.en : ex.fa,
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

  let profDisplayName = prof.name;
  if (isEn) {
    if (prof.id === 'hossein_chieftain') {
      profDisplayName = "Hossein's Routine";
    } else if (prof.id === 'morvarid') {
      profDisplayName = "Morvarid's Routine";
    } else if (prof.id === 'template_male') {
      profDisplayName = "Men's Sample Routine (5-Day Hypertrophy)";
    } else if (prof.id === 'template_female') {
      profDisplayName = "Women's Sample Routine (Tone & Fitness)";
    } else {
      profDisplayName = prof.name_en || prof.name;
    }
  }

  const activeRows = muscleGroups.filter(m => stats[m.key].totalSets > 0).map(m => {
    const s = stats[m.key];
    const daysList = Array.from(s.days).map(d => isEn ? translateDayTitle(d) : d).join(isEn ? ', ' : '، ');
    const uniqueExMap = new Map();
    s.exerciseDetails.forEach(e => uniqueExMap.set(e.name, e));
    const uniqueExList = Array.from(uniqueExMap.keys());
    const displayList = uniqueExList.slice(0, 3).join(isEn ? ', ' : '، ') + (uniqueExList.length > 3 ? ` <span style="color:#38bdf8; font-weight:700;">(${isEn ? `View all ${uniqueExList.length} exercises 🔍` : `مشاهده همه ${uniqueExList.length} حرکت 🔍`})</span>` : '');

    return `
      <tr onclick="openMuscleDetailModal('${m.key}')" style="cursor:pointer;" title="${isEn ? 'Click to view scientific details and exercises' : 'کلیک برای مشاهده جزئیات علمی و کامل حرکات این عضله'}">
        <td>
          <b>${s.label}</b>
          <div style="font-size:10px; color:#38bdf8; margin-top:2px;">${isEn ? '🔍 Click for detailed analysis' : '🔍 کلیک برای تحلیل دقیق'}</div>
        </td>
        <td>
          <span class="set-highlight">${s.totalSets} ${isEn ? 'sets' : 'ست'}</span>
          <div style="font-size:10.5px; margin-top:3px; display:flex; gap:6px;">
            <span style="color:#38bdf8; font-weight:700;">🏋️ ${s.gymSets} ${isEn ? 'Gym' : 'باشگاه'}</span>
            ${s.homeSets > 0 ? `<span style="color:#34d399; font-weight:700;">🏠 ${s.homeSets} ${isEn ? 'Home' : 'خانه'}</span>` : ''}
          </div>
        </td>
        <td>${s.days.size} ${isEn ? 'sessions' : 'جلسه'} (${daysList})</td>
        <td style="font-size:11.5px; color:#cbd5e1;">${displayList}</td>
      </tr>
    `;
  }).join('');

  const mobileCards = muscleGroups.filter(m => stats[m.key].totalSets > 0).map(m => {
    const s = stats[m.key];
    const daysList = Array.from(s.days).map(d => isEn ? translateDayTitle(d) : d).join(isEn ? ', ' : '، ');
    const uniqueExMap = new Map();
    s.exerciseDetails.forEach(e => uniqueExMap.set(e.name, e));
    const uniqueExList = Array.from(uniqueExMap.keys());

    return `
      <div class="summary-mobile-card" onclick="openMuscleDetailModal('${m.key}')" style="cursor:pointer;" title="${isEn ? 'Click for full details' : 'کلیک برای جزئیات کامل'}">
        <div class="summary-mobile-top">
          <span class="summary-mobile-title">${s.label}</span>
          <span class="set-highlight">${s.totalSets} ${isEn ? 'sets' : 'ست'}</span>
        </div>
        <div style="font-size:10px; display:flex; gap:5px; margin-bottom:4px;">
          <span style="color:#38bdf8; font-weight:700;">🏋️ ${s.gymSets} ${isEn ? 'Gym sets' : 'ست باشگاه'}</span>
          ${s.homeSets > 0 ? `<span style="color:#34d399; font-weight:700;">🏠 ${s.homeSets} ${isEn ? 'Home' : 'خانه'}</span>` : ''}
        </div>
        <div class="summary-mobile-freq">
          <span>📅</span> <span>${s.days.size} ${isEn ? 'sessions: ' : 'جلسه: '}${daysList}</span>
        </div>
        <div class="summary-mobile-chips">
          ${uniqueExList.slice(0, 2).map(e => `<span class="summary-mobile-chip">${e}</span>`).join('')}
          ${uniqueExList.length > 2 ? `<span class="summary-mobile-chip" style="background:rgba(56,189,248,0.2); color:#38bdf8; font-weight:800;">+${uniqueExList.length - 2} ${isEn ? 'more... 🔍' : 'دیگر... 🔍'}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <section id="weekly-summary" class="summary-card">
      <div class="day-header">
        <div class="day-title-wrap">
          <h2 class="day-title">📊 ${isEn ? 'Smart Weekly Volume Summary' : 'جمع‌بندی هوشمند حجم هفتگی'} (${profDisplayName})</h2>
          <span class="day-location-badge badge-gym">${isEn ? 'Dynamic Calculation' : 'محاسبه پویا'}</span>
        </div>
      </div>

      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
        ${isEn 
          ? `These statistics are dynamically calculated based on the exercises and sets in <b>${profDisplayName}</b>.` 
          : `این آمار به صورت کاملاً پویا بر اساس حرکات و ست‌های برنامه اختصاصی <b>${prof.name}</b> محاسبه شده است.`}
      </p>

      <!-- Desktop Table View -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>${isEn ? 'Muscle Group' : 'گروه عضلانی'}</th>
              <th>${isEn ? 'Total Direct Sets / Week' : 'مجموع ست مستقیم در هفته'}</th>
              <th>${isEn ? 'Training Frequency' : 'تعداد جلسات تمرین'}</th>
              <th>${isEn ? 'Sample Exercises' : 'نمونه حرکات برنامه'}</th>
            </tr>
          </thead>
          <tbody>
            ${activeRows || `<tr><td colspan="4" style="text-align:center; padding:16px;">${isEn ? 'No exercises found for volume calculation in this routine.' : 'هنوز حرکتی برای محاسبه حجم در این برنامه ثبت نشده است.'}</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Mobile Responsive Cards View (Zero horizontal scroll on phone) -->
      <div class="summary-mobile-grid">
        ${mobileCards || `<div style="text-align:center; color:var(--text-muted); padding:16px;">${isEn ? 'No exercises found for volume calculation in this routine.' : 'هنوز حرکتی برای محاسبه حجم در این برنامه ثبت نشده است.'}</div>`}
      </div>
    </section>
  `;
}

function getSupersetDisplayTitle(ss) {
  if (!ss) return t('superset');
  if (currentLang !== 'en') {
    return ss.title || t('superset');
  }
  let prefix = '';
  if (ss.title && ss.title.includes('·')) {
    prefix = ss.title.split('·')[0].trim() + ' · ';
  } else if (ss.title && /^[A-Z0-9\s\+]+:/.test(ss.title)) {
    prefix = ss.title.split(':')[0].trim() + ': ';
  }
  if (Array.isArray(ss.exercises) && ss.exercises.length > 0) {
    const enNames = ss.exercises.map(item => {
      const ex = findExerciseById(item.exId);
      return ex ? (ex.en || ex.fa) : (item.exId || 'Exercise');
    });
    return prefix + enNames.join(' + ');
  }
  return ss.title_en || ss.title || t('superset');
}

function renderDaySupersetsHTML(day, startSeqNum = 0, totalDayExercises = 0) {
  if (!day || !day.supersets || !Array.isArray(day.supersets) || day.supersets.length === 0) return '';
  const totalSS = day.supersets.length;
  let currentSeq = startSeqNum;
  return day.supersets.map((ss, ssIdx) => {
    if (!ss || !Array.isArray(ss.exercises)) return '';
    const ssExercisesHtml = ss.exercises.map((item, exIdx) => {
      if (!item || !item.exId) return '';
      currentSeq++;
      return renderExerciseCard(item, day.id, true, -1, 0, ssIdx, exIdx, ss.exercises.length, currentSeq, totalDayExercises);
    }).join('');

    return `
      <div class="superset-block" id="ss_${day.id}_${ssIdx}" data-day-id="${day.id}" data-ss-idx="${ssIdx}">
        <div class="superset-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="card-drag-handle" title="لمس یا کشیدن برای جابجایی کل سوپرست">⠿</span>
            <span>⚡ ${getSupersetDisplayTitle(ss)}</span>
            <span style="font-size:10.5px; background:rgba(0,242,254,0.15); color:#00f2fe; padding:2px 8px; border-radius:10px; border:1px solid rgba(0,242,254,0.3); font-weight:700;">${ss.exercises.length} ${t('exercisesCount')}</span>
          </div>
          <div class="card-reorder-toolbar" style="margin-top:0;">
            <button class="btn-move-action" style="color:#38bdf8; border-color:rgba(56,189,248,0.4);" onclick="openAddExerciseToSupersetModal('${day.id}', ${ssIdx})" title="افزودن حرکت دیگر به این سوپرست (ساخت تری‌ست یا جاینت‌ست)">${t('addExerciseToSS')}</button>
            ${ssIdx > 0 ? `<button class="btn-move-action" onclick="moveSupersetItem('${day.id}', ${ssIdx}, -1)" title="انتقال کل سوپرست به بالا">${t('moveUp')}</button>` : ''}
            ${ssIdx < totalSS - 1 ? `<button class="btn-move-action" onclick="moveSupersetItem('${day.id}', ${ssIdx}, 1)" title="انتقال کل سوپرست به پایین">${t('moveDown')}</button>` : ''}
            <button class="btn-move-action" style="color:#fcd34d; border-color:rgba(252,211,77,0.3);" onclick="openMoveDayModal('superset', '${day.id}', ${ssIdx})" title="انتقال کل سوپرست به روز دیگر">${t('moveDay')}</button>
          </div>
        </div>
        ${ssExercisesHtml}
      </div>
    `;
  }).join('');
}

function renderDaySinglesHTML(day, startSeqNum = 0, totalDayExercises = 0) {
  if (!day || !day.singles || !Array.isArray(day.singles) || day.singles.length === 0) return '';
  const totalSingles = day.singles.length;
  let currentSeq = startSeqNum;
  return day.singles.map((item, sIdx) => {
    if (!item || !item.exId) return '';
    currentSeq++;
    return renderExerciseCard(item, day.id, false, sIdx, totalSingles, -1, -1, 0, currentSeq, totalDayExercises);
  }).join('');
}

function renderWorkoutDays() {
  let prof = getActiveProfile();
  const container = document.getElementById('workoutContent');
  if (!container) return;
  const isEn = currentLang === 'en';

  // Defensive validation: if prof or prof.days is missing/empty, self-heal immediately
  if (!prof || !Array.isArray(prof.days) || prof.days.length === 0) {
    console.warn('[Chieftain] Active profile days empty or invalid. Restoring from defaults...');
    if (activeProfileId === 'morvarid') {
      prof = JSON.parse(JSON.stringify(MORVARID_PROFILE));
    } else {
      prof = JSON.parse(JSON.stringify(HOSSEIN_PROFILE));
    }
    const idx = allProfiles.findIndex(p => p.id === prof.id);
    if (idx >= 0) allProfiles[idx] = prof;
    else allProfiles.push(prof);
    saveProfiles();
  }

  let daysHtml = '';
  try {
    daysHtml = prof.days.map(day => {
      try {
        const typeBadge = {
          'gym': `<span class="day-location-badge badge-gym">🏋️ ${t('gym')}</span>`,
          'home': `<span class="day-location-badge badge-home">🏠 ${t('home')}</span>`,
          'rest': `<span class="day-location-badge badge-rest">🛌 ${t('fullRest')}</span>`
        }[day.type] || '';

        let totalDayExercises = (day.singles ? day.singles.length : 0);
        if (day.supersets) {
          day.supersets.forEach(ss => {
            totalDayExercises += (ss && ss.exercises ? ss.exercises.length : 0);
          });
        }

        let runningSeqNum = 0;
        const supersetsHtml = renderDaySupersetsHTML(day, runningSeqNum, totalDayExercises);
        const ssExCount = (day.supersets || []).reduce((acc, ss) => acc + (ss && ss.exercises ? ss.exercises.length : 0), 0);
        runningSeqNum += ssExCount;
        const singlesHtml = renderDaySinglesHTML(day, runningSeqNum, totalDayExercises);

        let restHtml = '';
        if (day.type === 'rest') {
          restHtml = `
            <div class="rest-day-card">
              <div class="rest-icon">🛌💤</div>
              <h3>${t('restDayTitle')}</h3>
              <p>${t('restDayDesc')}</p>
            </div>
          `;
        }

        let treadmillHtml = '';
        if (day.treadmill) {
          treadmillHtml = `
            <div class="treadmill-banner">
              <span>${t('treadmillBanner')}</span>
              <button class="btn-header-action" onclick="quickTimer(900)" style="padding:4px 10px;font-size:12px">${t('start15mTimer')}</button>
            </div>
          `;
        }

        const countBadgeHtml = (totalDayExercises > 0 && day.type !== 'rest')
          ? `<span class="day-total-badge">🎯 ${totalDayExercises} ${t('exercisesCount')}</span>`
          : '';

        const dayTitle = translateDayTitle(day.title);

        return `
          <section id="${day.id}" class="day-section">
            <div class="day-header">
              <div class="day-title-wrap">
                <h2 class="day-title">${dayTitle}</h2>
                ${typeBadge}
                ${countBadgeHtml}
              </div>
              <div class="day-progress-wrap">
                <div class="day-progress-bar"><div class="day-progress-fill" id="prog-${day.id}"></div></div>
                <span id="prog-text-${day.id}">${isEn ? '0%' : '۰٪'}</span>
              </div>
            </div>

            <div id="complete-banner-${day.id}" class="day-complete-banner" style="display:none;">
              <span>🏆 ${t('sessionCompleted').replace('{day}', dayTitle)}</span>
              <span>${t('greatRecovery')}</span>
            </div>

            ${day.note ? `
              <div class="session-note">
                <span>📌</span>
                <span>${translateSessionNote(day.note)}</span>
              </div>
            ` : ''}

            <div id="supersets_${day.id}" class="day-supersets-wrap">${supersetsHtml}</div>
            <div id="singles_${day.id}" class="day-singles-wrap">${singlesHtml}</div>
            ${restHtml}
            ${treadmillHtml}
          </section>
        `;
      } catch(dayErr) {
        console.error('Error rendering day section:', day?.id, dayErr);
        return '';
      }
    }).join('');
  } catch(mapErr) {
    console.error('Error mapping days in renderWorkoutDays:', mapErr);
  }

  let dynamicSummaryHtml = '';
  try {
    dynamicSummaryHtml = renderDynamicWeeklySummary(prof);
  } catch(sumErr) {
    console.error('Error rendering dynamic weekly summary:', sumErr);
    dynamicSummaryHtml = ''; // Summary failure must NEVER prevent workout cards from rendering!
  }

  // Guaranteed fallback: If daysHtml is empty, render default profile directly
  if (!daysHtml || daysHtml.trim() === '') {
    const fallbackDays = (activeProfileId === 'morvarid' ? MORVARID_PROFILE.days : HOSSEIN_PROFILE.days);
    daysHtml = fallbackDays.map(day => `
      <section id="${day.id}" class="day-section">
        <div class="day-header"><h2 class="day-title">${day.title}</h2></div>
        <div class="day-supersets-wrap">${renderDaySupersetsHTML(day)}</div>
        <div class="day-singles-wrap">${renderDaySinglesHTML(day)}</div>
      </section>
    `).join('');
  }

  container.innerHTML = daysHtml + dynamicSummaryHtml;
  container.style.display = 'block';
  container.style.minHeight = '';
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
  toggleSet(btn);
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
    activeProfileId = allProfiles.length > 0 ? allProfiles[0].id : 'template_male';
    localStorage.setItem('chieftain_active_profile_id', activeProfileId);
    closeEditPlanModal();
    renderApp();
    showToast('برنامه با موفقیت حذف شد.');
  }
}

function factoryResetActiveProfile() {
  const prof = getActiveProfile();
  if (confirm(`آیا می‌خواهید تمام روزهای اصلی برای "${prof.name}" بازیابی شوند؟`)) {
    if (prof.id === 'morvarid' || prof.id === 'template_female') {
      prof.days = JSON.parse(JSON.stringify(MORVARID_PROFILE.days));
    } else {
      prof.days = JSON.parse(JSON.stringify(HOSSEIN_PROFILE.days));
    }
    saveProfiles();
    renderEditPlanDaysList();
    renderApp();
    showToast('برنامه با موفقیت بازنشانی شد! ⚡');
  }
}

function resetCurrentSets() {
  const prof = getActiveProfile();
  if (confirm(`آیا می‌خواهید تمام تیک‌های ست‌های ثبت‌شده برای "${prof.name}" ریست شوند تا جلسه تمرینی جدید را شروع کنید؟`)) {
    localStorage.removeItem('chieftain_sets_' + activeProfileId);
    document.querySelectorAll('.set-btn').forEach(btn => btn.classList.remove('done'));
    document.querySelectorAll('.exercise-card').forEach(card => card.classList.remove('completed'));
    updateAllProgressBars();
    showToast('تمام ست‌ها ریست شدند. آماده تمرین جدید! 💪');
    if (typeof pushToCloudStorage === 'function' && isAutoCloudSyncEnabled()) {
      pushToCloudStorage(true);
    }
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
  const isEn = (currentLang === 'en');

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
              <button class="btn-header-action" style="padding:3px 8px; font-size:11px; color:#38bdf8; border-color:#38bdf855;" title="${isEn ? `Split this superset into ${ss.exercises.length} singles` : `تفکیک این سوپرست به ${ss.exercises.length} حرکت تکی مجزا`}" onclick="splitSupersetToSingles(${dIdx}, ${ssIdx})">🔓 ${isEn ? `Split to ${ss.exercises.length} Singles` : `تفکیک به ${ss.exercises.length} حرکت تکی`}</button>
              <button class="btn-header-action" style="padding:3px 8px; font-size:11px; color:#f87171; border-color:#f8717155;" title="${isEn ? 'Delete entire superset' : 'حذف کامل این سوپرست'}" onclick="removeSuperset(${dIdx}, ${ssIdx})">🗑️ ${isEn ? 'Delete Superset' : 'حذف سوپرست'}</button>
            </div>
          </div>

          ${ss.exercises.map((item, exIdx) => {
            const ex = findExerciseById(item.exId);
            const currentSets = parseSetsFromReps(item.reps, item.sets);
            const primaryName = isEn ? (ex.en || ex.fa) : (ex.fa || ex.en);
            const secondaryName = isEn ? ex.fa : ex.en;
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed rgba(255,255,255,0.08); flex-wrap:wrap; gap:6px;">
                <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:200px;">
                  <span style="font-size:11px; color:#94a3b8; font-weight:800;">${isEn ? `Ex ${exIdx + 1}:` : `حرکت ${exIdx + 1}:`}</span>
                  <button type="button" class="form-input searchable-ex-picker-btn" onclick="openExerciseSearchModal('ss', ${dIdx}, ${ssIdx}, ${exIdx})" style="flex:1; text-align:start; display:flex; align-items:center; justify-content:space-between; padding:5px 8px; cursor:pointer; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:6px; color:var(--text-main); font-size:12px;" title="${isEn ? 'Click to search and change exercise' : 'کلیک برای جستجو و تغییر حرکت'}">
                    <span style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                      ${primaryName}
                      ${secondaryName ? `<span style="font-size:11px; color:var(--text-muted); font-weight:400; margin-inline-start:4px;">(${secondaryName})</span>` : ''}
                    </span>
                    <span style="font-size:10.5px; color:#38bdf8; background:rgba(56,189,248,0.12); padding:1px 5px; border-radius:4px; margin-inline-start:6px; flex-shrink:0;">🔍 ${isEn ? 'Change' : 'تغییر'}</span>
                  </button>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                  <select class="form-select" style="width:75px; padding:4px 6px; font-size:11.5px;" title="${isEn ? 'Set Count' : 'تعداد ست'}" onchange="updateSsExSets(${dIdx}, ${ssIdx}, ${exIdx}, this.value)">
                    <option value="1" ${currentSets===1?'selected':''}>${isEn ? '1 Set' : '۱ ست'}</option>
                    <option value="2" ${currentSets===2?'selected':''}>${isEn ? '2 Sets' : '۲ ست'}</option>
                    <option value="3" ${currentSets===3?'selected':''}>${isEn ? '3 Sets' : '۳ ست'}</option>
                    <option value="4" ${currentSets===4?'selected':''}>${isEn ? '4 Sets' : '۴ ست'}</option>
                    <option value="5" ${currentSets===5?'selected':''}>${isEn ? '5 Sets' : '۵ ست'}</option>
                  </select>
                  <input type="text" value="${item.reps || '3 × 8–12'}" class="form-input" style="width:90px; padding:4px 6px; font-size:11.5px; direction:ltr;" title="${isEn ? 'Reps / Set Text' : 'متن ست و تکرار'}" onchange="updateSsExReps(${dIdx}, ${ssIdx}, ${exIdx}, this.value)">
                  <button type="button" class="btn-header-action" style="padding:3px 7px; font-size:11px; color:#f87171; border-color:#f8717155;" title="${isEn ? 'Delete this exercise from superset' : 'حذف این حرکت از سوپرست'}" onclick="removeSsExercise(${dIdx}, ${ssIdx}, ${exIdx})">✕</button>
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
        const currentSets = parseSetsFromReps(item.reps, item.sets);
        const primaryName = isEn ? (ex.en || ex.fa) : (ex.fa || ex.en);
        const secondaryName = isEn ? ex.fa : ex.en;
        return `
          <div class="editor-ex-card">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <!-- Exercise Selector Button -->
              <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:200px;">
                <span style="font-size:11px; color:var(--text-muted); font-weight:700;">#${sIdx + 1}</span>
                <button type="button" class="form-input searchable-ex-picker-btn" onclick="openExerciseSearchModal('single', ${dIdx}, ${sIdx})" style="flex:1; text-align:start; display:flex; align-items:center; justify-content:space-between; padding:5px 8px; cursor:pointer; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:6px; color:var(--text-main); font-size:12.5px;" title="${isEn ? 'Click to search and change exercise' : 'کلیک برای جستجو و تغییر حرکت'}">
                  <span style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${primaryName}
                    ${secondaryName ? `<span style="font-size:11px; color:var(--text-muted); font-weight:400; margin-inline-start:4px;">(${secondaryName})</span>` : ''}
                  </span>
                  <span style="font-size:11px; color:#38bdf8; background:rgba(56,189,248,0.12); padding:2px 6px; border-radius:4px; margin-inline-start:6px; flex-shrink:0;">🔍 ${isEn ? 'Change' : 'تغییر'}</span>
                </button>
              </div>

              <!-- Reps / Set Count / Convert to Superset / Reorder / Delete -->
              <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
                <select class="form-select" style="width:75px; padding:4px 6px; font-size:11.5px;" title="${isEn ? 'Set Count' : 'تعداد ست'}" onchange="updateSingleExSets(${dIdx}, ${sIdx}, this.value)">
                  <option value="1" ${currentSets===1?'selected':''}>${isEn ? '1 Set' : '۱ ست'}</option>
                  <option value="2" ${currentSets===2?'selected':''}>${isEn ? '2 Sets' : '۲ ست'}</option>
                  <option value="3" ${currentSets===3?'selected':''}>${isEn ? '3 Sets' : '۳ ست'}</option>
                  <option value="4" ${currentSets===4?'selected':''}>${isEn ? '4 Sets' : '۴ ست'}</option>
                  <option value="5" ${currentSets===5?'selected':''}>${isEn ? '5 Sets' : '۵ ست'}</option>
                </select>
                <input type="text" value="${item.reps || '3 × 8–12'}" class="form-input" style="width:85px; padding:4px 6px; font-size:11.5px; direction:ltr;" title="${isEn ? 'Reps / Set Text' : 'متن ست و تکرار'}" onchange="updateSingleExReps(${dIdx}, ${sIdx}, this.value)">
                <button class="btn-header-action" style="padding:3px 7px; font-size:11px; color:#38bdf8;" title="${isEn ? 'Convert this exercise to superset' : 'تبدیل این حرکت به یک سوپرست دوتایی'}" onclick="openConvertToSupersetModal(${dIdx}, ${sIdx})">⚡ ${isEn ? 'Superset' : 'سوپرست'}</button>
                <button class="btn-header-action" style="padding:3px 6px; font-size:11px;" title="${isEn ? 'Move Up' : 'حرکت به بالا'}" onclick="moveSingleEx(${dIdx}, ${sIdx}, -1)">▲</button>
                <button class="btn-header-action" style="padding:3px 6px; font-size:11px;" title="${isEn ? 'Move Down' : 'حرکت به پایین'}" onclick="moveSingleEx(${dIdx}, ${sIdx}, 1)">▼</button>
                <button class="btn-header-action" style="padding:3px 6px; font-size:11px; color:#f87171;" title="${isEn ? 'Delete Exercise' : 'حذف حرکت'}" onclick="removeSingleEx(${dIdx}, ${sIdx})">✕</button>
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
              <option value="gym" ${day.type==='gym'?'selected':''}>🏋️ ${isEn ? 'Gym' : 'باشگاه'}</option>
              <option value="home" ${day.type==='home'?'selected':''}>🏠 ${isEn ? 'Home' : 'خانه'}</option>
              <option value="rest" ${day.type==='rest'?'selected':''}>🛌 ${isEn ? 'Rest' : 'استراحت'}</option>
            </select>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn-header-action btn-action-primary" style="padding:5px 10px; font-size:12px;" onclick="openAddExToDayModal('${day.id}')">${isEn ? '+ Add Exercise / Superset' : '+ افزودن حرکت / سوپرست'}</button>
            <button class="btn-header-action" style="padding:5px 8px; color:#f87171;" title="${isEn ? 'Delete this day' : 'حذف این روز'}" onclick="removeDay(${dIdx})">🗑️</button>
          </div>
        </div>

        <!-- Note & Treadmill -->
        <div style="display:flex; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
          <input type="text" value="${day.note || ''}" placeholder="${isEn ? 'Session note...' : 'یادداشت این جلسه...'}" class="form-input" style="flex:1; min-width:180px; font-size:12px;" onchange="updateDayNote(${dIdx}, this.value)">
          <label style="display:flex; align-items:center; gap:5px; font-size:12px; color:#cbd5e1; cursor:pointer;">
            <input type="checkbox" ${day.treadmill ? 'checked' : ''} onchange="updateDayTreadmill(${dIdx}, this.checked)">
            🏃 ${isEn ? 'Treadmill at end of workout' : 'تردمیل آخر جلسه'}
          </label>
        </div>

        <!-- Exercises List -->
        <div style="margin-top:8px;">
          ${supersetsHtml}
          ${singlesHtml}
          ${(!supersetsHtml && !singlesHtml) ? `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">${isEn ? 'No exercises logged for this day yet.' : 'هنوز حرکتی برای این روز ثبت نشده است.'}</div>` : ''}
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
  const isEn = (currentLang === 'en');
  const exName = isEn ? (ex.en || ex.fa) : (ex.fa || ex.en);
  const confirmMsg = isEn ? `Are you sure you want to delete "${exName}"?` : `آیا حرکت "${exName}" حذف شود؟`;
  if (confirm(confirmMsg)) {
    prof.days[dIdx].singles.splice(sIdx, 1);
    saveProfiles();
    renderEditPlanDaysList();
    renderApp();
    showToast(isEn ? 'Exercise removed.' : 'حرکت حذف شد.');
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
  const isEn = (currentLang === 'en');
  const count = ss.exercises.length;

  const msg = isEn 
    ? `Do you want to split superset "${ss.title}" into ${count} single exercises?`
    : `آیا می‌خواهید سوپرست "${ss.title}" را تفکیک کنید و به ${count} حرکت تکی تبدیل شود؟`;

  if (confirm(msg)) {
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
    showToast(isEn ? `Superset split into ${count} single exercises.` : `سوپرست به ${count} حرکت تکی تفکیک شد.`);
  }
}

function removeSuperset(dIdx, ssIdx) {
  const prof = getActiveProfile();
  const isEn = (currentLang === 'en');
  if (confirm(isEn ? 'Are you sure you want to delete this entire superset?' : 'آیا کل این سوپرست حذف شود؟')) {
    prof.days[dIdx].supersets.splice(ssIdx, 1);
    saveProfiles();
    renderEditPlanDaysList();
    renderApp();
    showToast(isEn ? 'Superset removed.' : 'سوپرست حذف شد.');
  }
}

function removeSsExercise(dIdx, ssIdx, exIdx) {
  const prof = getActiveProfile();
  const day = prof.days[dIdx];
  if (!day || !day.supersets || !day.supersets[ssIdx]) return;
  const ss = day.supersets[ssIdx];
  const item = ss.exercises[exIdx];
  const ex = findExerciseById(item.exId);
  const isEn = (currentLang === 'en');
  const exName = isEn ? (ex.en || ex.fa) : (ex.fa || ex.en);

  const confirmMsg = isEn 
    ? `Are you sure you want to remove "${exName}" from this superset?` 
    : `آیا از حذف حرکت "${exName}" از این سوپرست اطمینان دارید؟`;
  
  if (!confirm(confirmMsg)) return;

  if (ss.exercises.length > 2) {
    // Tri-set or more: remove just this exercise
    ss.exercises.splice(exIdx, 1);
    showToast(isEn ? 'Exercise removed from superset.' : 'حرکت از سوپرست حذف شد.');
  } else {
    // Exactly 2 exercises: removing one leaves 1 exercise.
    // Convert the remaining exercise into a single exercise in day.singles
    const remainingEx = ss.exercises[exIdx === 0 ? 1 : 0];
    if (!day.singles) day.singles = [];
    day.singles.push({
      exId: remainingEx.exId,
      reps: remainingEx.reps || '3 × 8–12',
      sets: remainingEx.sets || 3
    });
    day.supersets.splice(ssIdx, 1);
    showToast(isEn ? 'Superset converted to single exercise.' : 'حرکت باقیمانده به لیست حرکات تکی منتقل شد.');
  }
  saveProfiles();
  renderEditPlanDaysList();
  renderApp();
}

// Universal Search & Select Exercise Modal Engine
let activeSearchPickerContext = null; // { type: 'single' | 'ss', dIdx, p2, p3 }
let activeSearchCategory = 'all';

function openExerciseSearchModal(type, dIdx, p2, p3) {
  activeSearchPickerContext = { type, dIdx, p2, p3 };
  activeSearchCategory = 'all';

  const modal = document.getElementById('exerciseSearchModal');
  const input = document.getElementById('exSearchModalInput');
  if (input) input.value = '';

  // Reset category buttons
  const catButtons = document.querySelectorAll('#exSearchCategoryFilter button');
  catButtons.forEach(btn => btn.classList.remove('active'));
  if (catButtons[0]) catButtons[0].classList.add('active');

  renderExerciseSearchResults('');
  if (modal) modal.classList.add('open');
  if (input) setTimeout(() => input.focus(), 150);
}

function closeExerciseSearchModal() {
  const modal = document.getElementById('exerciseSearchModal');
  if (modal) modal.classList.remove('open');
  activeSearchPickerContext = null;
}

function filterExSearchByCat(cat, btn) {
  activeSearchCategory = cat;
  const catButtons = document.querySelectorAll('#exSearchCategoryFilter button');
  catButtons.forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const term = document.getElementById('exSearchModalInput')?.value || '';
  renderExerciseSearchResults(term);
}

function filterExerciseSearchModal(term) {
  renderExerciseSearchResults(term);
}

function renderExerciseSearchResults(term) {
  const container = document.getElementById('exSearchResultsList');
  if (!container) return;

  const allEx = getAllExercises();
  const q = (term || '').trim().toLowerCase();
  const isEn = (currentLang === 'en');

  // Determine currently selected exercise ID
  let currentSelectedId = null;
  if (activeSearchPickerContext) {
    const prof = getActiveProfile();
    const day = prof.days[activeSearchPickerContext.dIdx];
    if (day) {
      if (activeSearchPickerContext.type === 'single' && day.singles) {
        currentSelectedId = day.singles[activeSearchPickerContext.p2]?.exId;
      } else if (activeSearchPickerContext.type === 'ss' && day.supersets) {
        currentSelectedId = day.supersets[activeSearchPickerContext.p2]?.exercises[activeSearchPickerContext.p3]?.exId;
      }
    }
  }

  // Filter exercises
  const filtered = allEx.filter(ex => {
    // Category match
    if (activeSearchCategory !== 'all') {
      const cat = (ex.category || '').toLowerCase();
      const musc = (ex.targetMuscles || []).join(' ').toLowerCase();
      const targetCat = activeSearchCategory.toLowerCase();
      const matchCat = cat.includes(targetCat) || musc.includes(targetCat);
      if (!matchCat) return false;
    }

    // Term match
    if (!q) return true;
    const faMatch = (ex.fa || '').toLowerCase().includes(q);
    const enMatch = (ex.en || '').toLowerCase().includes(q);
    const muscMatch = (ex.targetMuscles || []).some(m => m.toLowerCase().includes(q));
    const catMatch = (ex.category || '').toLowerCase().includes(q);
    return faMatch || enMatch || muscMatch || catMatch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px;">
        ${isEn ? 'No exercises found matching your search.' : 'هیچ حرکتی با این مشخصات یافت نشد.'}
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(ex => {
    const isSelected = (ex.id === currentSelectedId);
    const primaryName = isEn ? (ex.en || ex.fa) : (ex.fa || ex.en);
    const secondaryName = isEn ? ex.fa : ex.en;
    const muscleText = (ex.targetMuscles && ex.targetMuscles.length > 0) ? ex.targetMuscles.join(' · ') : (ex.category || '');

    return `
      <div class="exercise-search-result-item ${isSelected ? 'selected' : ''}" 
           onclick="confirmExerciseSelection('${ex.id}')"
           style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:${isSelected ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)'}; border:1px solid ${isSelected ? '#38bdf8' : 'rgba(255,255,255,0.08)'}; border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
        <div style="display:flex; flex-direction:column; gap:3px; flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-weight:700; font-size:13px; color:${isSelected ? '#38bdf8' : 'var(--text-main)'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${primaryName}
            </span>
            ${secondaryName ? `<span style="font-size:11px; color:var(--text-muted); font-weight:400; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">(${secondaryName})</span>` : ''}
          </div>
          ${muscleText ? `<span style="font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:4px;">🎯 ${muscleText}</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-inline-start:10px; flex-shrink:0;">
          ${isSelected 
            ? `<span style="font-size:11.5px; font-weight:700; color:#38bdf8; background:rgba(56,189,248,0.2); padding:3px 8px; border-radius:6px;">✓ ${isEn ? 'Selected' : 'انتخاب شده'}</span>`
            : `<span style="font-size:11.5px; color:#94a3b8; background:rgba(255,255,255,0.06); padding:3px 8px; border-radius:6px;">${isEn ? 'Select' : 'انتخاب'}</span>`
          }
        </div>
      </div>
    `;
  }).join('');
}

function confirmExerciseSelection(selectedExId) {
  if (!activeSearchPickerContext) return;
  const { type, dIdx, p2, p3 } = activeSearchPickerContext;
  const isEn = (currentLang === 'en');

  if (type === 'single') {
    updateSingleExId(dIdx, p2, selectedExId);
  } else if (type === 'ss') {
    updateSsExerciseId(dIdx, p2, p3, selectedExId);
  }

  closeExerciseSearchModal();
  renderEditPlanDaysList();
  renderApp();
  showToast(isEn ? 'Exercise updated successfully.' : 'حرکت با موفقیت تغییر کرد.');
}

function removeDay(dIdx) {
  const prof = getActiveProfile();
  const isEn = (currentLang === 'en');
  if (prof.days.length <= 1) {
    alert(isEn ? 'At least one day must remain in the plan.' : 'حداقل یک روز باید در برنامه باقی بماند.');
    return;
  }
  const dayTitle = prof.days[dIdx].title;
  const confirmMsg = isEn 
    ? `Are you sure you want to delete day "${dayTitle}" and all its exercises?` 
    : `آیا از حذف روز "${dayTitle}" و تمام حرکات داخل آن اطمینان دارید؟`;
  if (confirm(confirmMsg)) {
    prof.days.splice(dIdx, 1);
    saveProfiles();
    renderEditPlanDaysList();
    renderApp();
    showToast(isEn ? 'Day removed.' : 'روز تمرینی حذف شد.');
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

function autoDraftLogInput() {
  try {
    const { exId, setsCount, isIso } = currentLogTarget;
    if (!exId) return;
    const sets = [];
    for (let i = 1; i <= (setsCount || 3); i++) {
      const w = document.getElementById(`logWeight_${i}`)?.value || '';
      const r = document.getElementById(`logReps_${i}`)?.value || '';
      const rir = document.getElementById(`logRir_${i}`)?.value || '2';
      sets.push({ weight: w, reps: r, rir: rir });
    }
    const note = document.getElementById('logNoteInput')?.value || '';
    const draft = { timestamp: Date.now(), sets, note, isIso };
    localStorage.setItem('chieftain_draft_log_' + activeProfileId + '_' + exId, JSON.stringify(draft));
  } catch(e) {}
}

function clearDraftLog(exId) {
  try {
    localStorage.removeItem('chieftain_draft_log_' + activeProfileId + '_' + exId);
  } catch(e) {}
}

function openLogModal(exId, exFa, dayId, setsCount) {
  const ex = findExerciseById(exId);
  const isIso = isExerciseIsometric(ex);
  currentLogTarget = { exId, exFa, dayId, setsCount: setsCount || 3, isIso };
  
  document.getElementById('logModalTitle').innerText = isIso ? `🧘‍♂️ ثبت لاگ ایزومتریک: ${exFa}` : `📝 ثبت لاگ وزنه و تکرار: ${exFa}`;
  document.getElementById('logModalSubtitle').innerHTML = isIso 
    ? `⏱️ ثبت زمان انقباض و <b>TIR (زمان ذخیره تا شکست فرم)</b> بر پایه پروتکل‌های علمی پایداری ستون فقرات`
    : `ثبت دقیق وزنه و RIR برای اعمال اضافه بار تدریجی (Progressive Overload)`;
  
  // Check for existing saved draft
  let draft = null;
  try {
    const draftRaw = localStorage.getItem('chieftain_draft_log_' + activeProfileId + '_' + exId);
    if (draftRaw) draft = JSON.parse(draftRaw);
  } catch(e) {}

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
      const draftSet = draft?.sets?.[i - 1];
      const lastSet = lastLog?.sets?.[i - 1] || {};
      const valWeight = draftSet ? draftSet.weight : '';
      const valReps = draftSet ? draftSet.reps : '';
      const valRir = draftSet ? draftSet.rir : (lastSet.rir || '2');

      rowsHtml += `
        <div class="log-row-grid" style="margin-top:6px;">
          <span style="font-weight:800; color:#cbd5e1; font-size:12px;">ست ${i}</span>
          <input type="number" step="0.5" id="logWeight_${i}" class="form-input" oninput="autoDraftLogInput()" placeholder="${lastSet.weight ? 'قبلی: ' + lastSet.weight : '۰'}" value="${valWeight}" style="text-align:center; font-weight:700; padding:6px;">
          <input type="number" id="logReps_${i}" class="form-input" oninput="autoDraftLogInput()" placeholder="${lastSet.reps ? 'قبلی: ' + lastSet.reps : 'مثلاً ۳۰'}" value="${valReps}" style="text-align:center; font-weight:700; padding:6px;">
          <select id="logRir_${i}" class="form-select" onchange="autoDraftLogInput()" style="padding:6px; font-size:11.5px;">
            <option value="0" ${valRir==='0'?'selected':''}>TIR 0 (۰ ثانیه - ناتوانی/لرزش)</option>
            <option value="1" ${valRir==='1'?'selected':''}>TIR 1 (۳ تا ۵ ثانیه تا ناتوانی)</option>
            <option value="2" ${valRir==='2'?'selected':''}>TIR 2 (۶ تا ۱۰ ثانیه - بهینه و علمی)</option>
            <option value="3" ${valRir==='3'?'selected':''}>TIR 3 (۱۱ تا ۱۵ ثانیه ذخیره)</option>
            <option value="4" ${valRir==='4'?'selected':''}>TIR 4+ (بیش از ۱۵ ثانیه ذخیره)</option>
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
      const draftSet = draft?.sets?.[i - 1];
      const lastSet = lastLog?.sets?.[i - 1] || {};
      const valWeight = draftSet ? draftSet.weight : '';
      const valReps = draftSet ? draftSet.reps : '';
      const valRir = draftSet ? draftSet.rir : (lastSet.rir || '2');

      rowsHtml += `
        <div class="log-row-grid" style="margin-top:6px;">
          <span style="font-weight:800; color:#cbd5e1; font-size:12px;">ست ${i}</span>
          <input type="number" step="0.5" id="logWeight_${i}" class="form-input" oninput="autoDraftLogInput()" placeholder="${lastSet.weight ? 'قبلی: ' + lastSet.weight : 'مثلاً ۵۰'}" value="${valWeight}" style="text-align:center; font-weight:700; padding:6px;">
          <input type="number" id="logReps_${i}" class="form-input" oninput="autoDraftLogInput()" placeholder="${lastSet.reps ? 'قبلی: ' + lastSet.reps : 'مثلاً ۱۰'}" value="${valReps}" style="text-align:center; font-weight:700; padding:6px;">
          <select id="logRir_${i}" class="form-select" onchange="autoDraftLogInput()" style="padding:6px; font-size:12px;">
            <option value="0" ${valRir==='0'?'selected':''}>0 (ناتوانی کامل)</option>
            <option value="1" ${valRir==='1'?'selected':''}>1 تکرار ذخیره</option>
            <option value="2" ${valRir==='2'?'selected':''}>2 تکرار ذخیره (ایده‌آل)</option>
            <option value="3" ${valRir==='3'?'selected':''}>3 تکرار ذخیره</option>
            <option value="4" ${valRir==='4'?'selected':''}>4+ (بسیار سبک)</option>
          </select>
        </div>
      `;
    }
  }

  container.innerHTML = rowsHtml;
  document.getElementById('logNoteInput').value = draft?.note || '';
  document.getElementById('logNoteInput').oninput = autoDraftLogInput;
  document.getElementById('logModal').classList.add('open');
}

function closeLogModal() {
  document.getElementById('logModal').classList.remove('open');
}

function saveExerciseLog() {
  try {
    const { exId, exFa, setsCount, isIso } = currentLogTarget;
    if (!exId) {
      closeLogModal();
      return;
    }
    const sets = [];
    let totalVolume = 0;

    for (let i = 1; i <= (setsCount || 3); i++) {
      const w = parseFloat(document.getElementById(`logWeight_${i}`)?.value) || 0;
      const r = parseInt(document.getElementById(`logReps_${i}`)?.value) || 0;
      const rir = document.getElementById(`logRir_${i}`)?.value || '2';
      sets.push({ setNum: i, weight: w, reps: r, rir: rir });
      totalVolume += (isIso ? r : (w * r));
    }

    const note = document.getElementById('logNoteInput')?.value?.trim() || '';
    let dateStr = '';
    try {
      dateStr = new Intl.DateTimeFormat('fa-IR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
    } catch(e) {
      const d = new Date();
      dateStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
    }

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
    clearDraftLog(exId);
    closeLogModal();
    showToast(isIso ? `✅ لاگ ایزومتریک "${exFa}" ثبت شد! (${totalVolume} ثانیه مجموع انقباض)` : `✅ لاگ تمرین برای "${exFa}" ثبت شد! (حجم کل: ${totalVolume} kg)`);

    // Auto-sync to cloud immediately so progress is never lost across devices
    if (typeof pushToCloudStorage === 'function') {
      pushToCloudStorage(true);
    }
    if (typeof pushLogToSupabase === 'function') {
      pushLogToSupabase(exId, logs[logs.length - 1]);
    }
  } catch(err) {
    console.error('Error saving exercise log:', err);
    closeLogModal();
    showToast('⚠️ لاگ در این دستگاه ثبت شد.');
  }
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
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:12px;">هنوز لاگی ثبت نشده است.</td></tr>`;
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

    // Render Table with delete button
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
          <td style="text-align:center;">
            <button class="btn-move-action" style="color:#f87171; border-color:rgba(248,113,113,0.3); padding:2px 6px; font-size:11px;" onclick="deleteExerciseLogItem('${exId}', ${l.timestamp})" title="حذف این رکورد">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    // Draw SVG Chart
    renderSvgLineChart(logs, svg, isIso);
  }

  document.getElementById('overloadChartModal').classList.add('open');
}

function deleteExerciseLogItem(exId, timestamp) {
  if (!confirm('آیا از حذف این لاگ تمرین اطمینان دارید؟')) return;
  const logs = getExerciseLogs(exId).filter(l => l.timestamp !== timestamp);
  saveExerciseLogsList(exId, logs);
  openOverloadChart(currentLogTarget.exId, currentLogTarget.exFa);
  showToast('لاگ حذف شد.');
  if (typeof pushToCloudStorage === 'function' && isAutoCloudSyncEnabled()) {
    pushToCloudStorage(true);
  }
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
let currentLibraryScope = 'all';
let currentLibraryCat = 'all';
let currentLibrarySearch = '';

function openLibraryModal() {
  applyLibraryFilters();
  document.getElementById('libraryModal').classList.add('open');
  updateAdminUI();
}

function closeLibraryModal() {
  document.getElementById('libraryModal').classList.remove('open');
}

function filterLibraryScope(scope) {
  currentLibraryScope = scope;
  ['All', 'Public', 'Private'].forEach(s => {
    const btn = document.getElementById('libScope' + s);
    if (btn) {
      if (s.toLowerCase() === scope.toLowerCase()) {
        btn.classList.add('active');
        btn.style.background = 'var(--card-bg)';
      } else {
        btn.classList.remove('active');
        btn.style.background = '';
      }
    }
  });
  applyLibraryFilters();
}

function filterLibrary(term) {
  currentLibrarySearch = term.toLowerCase().trim();
  applyLibraryFilters();
}

function filterLibraryCat(cat) {
  currentLibraryCat = cat;
  applyLibraryFilters();
}

function applyLibraryFilters() {
  let list = getAllExercises();

  // 1. Scope filter
  const currentUserId = (typeof currentAuthUser !== 'undefined' && currentAuthUser) ? currentAuthUser.id : (activeProfileId || 'local');
  if (currentLibraryScope === 'public') {
    list = list.filter(e => !e.isCustom || e.isApproved);
  } else if (currentLibraryScope === 'private') {
    list = list.filter(e => e.isCustom && (!e.isApproved || e.ownerId === currentUserId));
  }

  // 2. Category / Muscle filter
  if (currentLibraryCat === 'gym' || currentLibraryCat === 'home') {
    list = list.filter(e => e.category === currentLibraryCat);
  } else if (currentLibraryCat !== 'all') {
    list = list.filter(e => e.muscles && e.muscles.includes(currentLibraryCat));
  }

  // 3. Search query
  if (currentLibrarySearch) {
    list = list.filter(e =>
      e.fa.toLowerCase().includes(currentLibrarySearch) ||
      (e.en && e.en.toLowerCase().includes(currentLibrarySearch)) ||
      (e.muscles && e.muscles.toLowerCase().includes(currentLibrarySearch))
    );
  }

  renderLibraryList(list);
}

function renderLibraryList(list) {
  const container = document.getElementById('libraryListContainer');
  if (!container) return;
  const isEn = currentLang === 'en';
  if (!list || list.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">${isEn ? 'No exercises found matching your search. You can search MuscleWiki below or create a custom exercise.' : 'حرکتی با این مشخصات یافت نشد. می‌توانید از بخش زیر در MuscleWiki جستجو کنید یا حرکت دلخواه بسازید.'}</div>`;
    return;
  }

  const adminUnlocked = isAdminUnlocked();

  container.innerHTML = list.map(ex => {
    let bankBadge = '';
    if (ex.isCustom) {
      if (ex.isApproved) {
        bankBadge = `<span class="muscle-tag" style="background:#05966933; color:#34d399; border-color:#059669;">🌐 ${isEn ? 'Public Bank' : 'بانک عمومی'}</span>`;
      } else {
        bankBadge = `<span class="muscle-tag" style="background:#854d0e33; color:#facc15; border-color:#854d0e;">🔒 ${isEn ? 'Private Bank' : 'بانک خصوصی'}</span>`;
      }
    } else {
      bankBadge = `<span class="muscle-tag" style="background:#0369a133; color:#38bdf8; border-color:#0284c7;">🌐 ${isEn ? 'Master Bank' : 'بانک مرجع'}</span>`;
    }

    const titleText = isEn ? (ex.en || ex.fa) : (ex.fa || ex.en);
    const subText = isEn 
      ? (ex.fa ? `<div style="font-size:12px; color:var(--accent-cyan); text-align:left;">${escapeHtml(ex.fa)}</div>` : '')
      : (ex.en ? `<div style="font-size:12px; color:var(--accent-cyan); direction:ltr; text-align:right;">${escapeHtml(ex.en)}</div>` : '');

    return `
      <div class="library-item-card" style="${ex.isCustom && !ex.isApproved ? 'border-color:#854d0e88;' : ''}">
        <div class="library-item-top">
          <div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:14.5px; font-weight:800; color:#fff;">${escapeHtml(titleText)}</span>
              ${bankBadge}
            </div>
            ${subText}
          </div>
          <span class="muscle-tag">${ex.category === 'home' ? `🏠 ${t('home')}` : `🏋️ ${t('gym')}`}</span>
        </div>

        <div class="muscles-row" style="margin:6px 0;">
          <span class="muscle-tag">${t('targetMuscles')} ${translateMuscles(ex.muscles)}</span>
          <span class="muscle-tag" style="direction:ltr">${translateReps(escapeHtml(ex.defaultReps || '3 × 8–12'))}</span>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; flex-wrap:wrap; gap:6px;">
          <div class="video-links-group">
            ${renderVideoButtons(ex.videos)}
          </div>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">
            <button class="btn-header-action btn-action-primary" style="padding:4px 9px; font-size:11.5px" onclick="quickAddExFromLibrary('${ex.id}')">
              ${t('addToPlan')}
            </button>
            <button class="btn-header-action" style="padding:4px 9px; font-size:11.5px; border-color:rgba(56,189,248,0.5); color:#38bdf8; background:rgba(56,189,248,0.08);" onclick="handleEditExerciseClick('${ex.id}')" title="${isEn ? 'Edit exercise name, muscles & videos' : 'ویرایش مشخصات و ویدیوهای حرکت'}">
              ✏️ ${isEn ? 'Edit' : 'ویرایش'}
            </button>
            ${adminUnlocked ? `
              ${ex.isCustom && !ex.isApproved ? `
                <button class="btn-header-action" style="padding:4px 7px; font-size:11px; border-color:#22c55e88; color:#22c55e;" onclick="approveCustomExercise('${ex.id}')" title="تایید برای بانک عمومی">
                  ${t('approvePublic')}
                </button>
              ` : ''}
              ${ex.isCustom ? `
                <button class="btn-header-action" style="padding:4px 7px; font-size:11px; border-color:#f8717155; color:#f87171;" onclick="deleteCustomExercise('${ex.id}')" title="حذف از بانک">
                  🗑️
                </button>
              ` : ''}
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function handleEditExerciseClick(exId) {
  const isEn = currentLang === 'en';
  if (isAdminUnlocked()) {
    openEditMasterExModal(exId);
  } else {
    const pwd = prompt(isEn ? 'To edit master exercise in bank, please enter Admin PIN:' : 'جهت ویرایش مشخصات و ویدیوهای حرکت در بانک مرجع، لطفاً رمز عبور ادمین را وارد نمایید:');
    if (pwd === null) return;
    if (unlockAdminMode(pwd.trim())) {
      openEditMasterExModal(exId);
    } else {
      alert(isEn ? '❌ Incorrect admin password.' : '❌ رمز عبور ادمین اشتباه است.');
    }
  }
}

let editingMasterVideos = [];

function openEditMasterExModal(exId) {
  const ex = findExerciseById(exId);
  if (!ex) return;
  const isEn = currentLang === 'en';

  const idEl = document.getElementById('editMasterExId');
  if (idEl) idEl.value = exId;
  const faEl = document.getElementById('editMasterExFa');
  if (faEl) faEl.value = ex.fa || '';
  const enEl = document.getElementById('editMasterExEn');
  if (enEl) enEl.value = ex.en || '';
  const musclesEl = document.getElementById('editMasterExMuscles');
  if (musclesEl) musclesEl.value = ex.muscles || '';
  const catEl = document.getElementById('editMasterExCategory');
  if (catEl) catEl.value = ex.category || 'gym';

  editingMasterVideos = JSON.parse(JSON.stringify(ex.videos || []));
  renderEditMasterVideosList();

  const titleEl = document.getElementById('editMasterExModalTitle');
  if (titleEl) {
    titleEl.innerText = isEn ? `✏️ Edit Exercise: ${ex.en || ex.fa}` : `✏️ ویرایش حرکت: ${ex.fa}`;
  }

  const modal = document.getElementById('editMasterExModal');
  if (modal) modal.classList.add('open');
}

function closeEditMasterExModal() {
  const modal = document.getElementById('editMasterExModal');
  if (modal) modal.classList.remove('open');
}

function renderEditMasterVideosList() {
  const container = document.getElementById('editMasterExVideosList');
  const countEl = document.getElementById('editMasterExVideosCount');
  if (!container) return;
  const isEn = currentLang === 'en';

  if (countEl) {
    countEl.innerText = isEn ? `${editingMasterVideos.length} video(s)` : `${editingMasterVideos.length} ویدیو`;
  }

  if (editingMasterVideos.length === 0) {
    container.innerHTML = `<div style="font-size:11.5px; color:#94a3b8; text-align:center; padding:10px;">${isEn ? 'No videos registered yet. Add a video below.' : 'هنوز ویدیویی برای این حرکت ثبت نشده است. از کادر زیر اضافه کنید.'}</div>`;
    return;
  }

  container.innerHTML = editingMasterVideos.map((v, idx) => `
    <div style="background:#1e293b; border-radius:6px; padding:6px 8px; display:flex; align-items:center; gap:6px;">
      <span style="font-size:12px; font-weight:800; color:#38bdf8;">${idx + 1}.</span>
      <input type="text" class="form-input" value="${escapeHtml(v.title || '')}" placeholder="${isEn ? 'Title' : 'عنوان'}" style="font-size:11px; padding:4px 6px; flex:1;" onchange="editingMasterVideos[${idx}].title = this.value.trim()">
      <input type="text" class="form-input" value="${escapeHtml(v.url || '')}" placeholder="${isEn ? 'URL' : 'لینک'}" style="font-size:11px; padding:4px 6px; flex:2; direction:ltr;" onchange="editingMasterVideos[${idx}].url = this.value.trim()">
      <a href="${escapeHtml(v.url || '#')}" target="_blank" rel="noopener" class="btn-header-action" style="padding:4px 7px; font-size:11px; color:#38bdf8; border-color:#38bdf855;" title="${isEn ? 'Test / Preview Video' : 'مشاهده / تست ویدیو'}">▶</a>
      <button type="button" class="btn-header-action" style="padding:4px 7px; font-size:11px; color:#f87171; border-color:#f8717155;" onclick="deleteVideoInEditMasterModal(${idx})" title="${isEn ? 'Delete Video' : 'حذف ویدیو'}">🗑️</button>
    </div>
  `).join('');
}

function addVideoInEditMasterModal() {
  const titleInput = document.getElementById('editMasterNewVidTitle');
  const urlInput = document.getElementById('editMasterNewVidUrl');
  if (!urlInput) return;
  const url = urlInput.value.trim();
  const isEn = currentLang === 'en';
  if (!url) {
    alert(isEn ? 'Please enter a valid video link.' : 'لطفاً لینک ویدیو را وارد کنید.');
    return;
  }
  const title = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : (isEn ? `Tutorial ${editingMasterVideos.length + 1}` : `آموزش ${editingMasterVideos.length + 1}`);
  editingMasterVideos.push({ title, url });
  if (titleInput) titleInput.value = '';
  urlInput.value = '';
  renderEditMasterVideosList();
}

function deleteVideoInEditMasterModal(idx) {
  editingMasterVideos.splice(idx, 1);
  renderEditMasterVideosList();
}

function saveEditMasterExercise() {
  const isEn = currentLang === 'en';
  const idEl = document.getElementById('editMasterExId');
  if (!idEl) return;
  const exId = idEl.value;
  if (!exId) return;

  const fa = document.getElementById('editMasterExFa')?.value.trim() || '';
  const en = document.getElementById('editMasterExEn')?.value.trim() || '';
  const muscles = document.getElementById('editMasterExMuscles')?.value.trim() || '';
  const category = document.getElementById('editMasterExCategory')?.value || 'gym';

  if (!fa && !en) {
    alert(isEn ? 'Exercise name cannot be empty.' : 'نام حرکت نمی‌تواند خالی باشد.');
    return;
  }

  // Update custom exercise or master exercise override
  if (exId.startsWith('cust_')) {
    const custEx = (customExercises || []).find(e => e.id === exId);
    if (custEx) {
      custEx.fa = fa || custEx.fa;
      custEx.en = en || custEx.en;
      custEx.muscles = muscles || custEx.muscles;
      custEx.category = category;
      custEx.videos = JSON.parse(JSON.stringify(editingMasterVideos));
      saveCustomExercises();
    }
  } else {
    if (!masterExerciseOverrides) masterExerciseOverrides = {};
    masterExerciseOverrides[exId] = {
      fa: fa,
      en: en,
      muscles: muscles,
      category: category,
      videos: JSON.parse(JSON.stringify(editingMasterVideos))
    };
    saveMasterOverrides();
  }

  closeEditMasterExModal();
  applyLibraryFilters();
  renderApp(true);
  showToast(isEn ? `✅ Exercise "${en || fa}" updated successfully in Exercise Bank!` : `✅ مشخصات و ویدیوهای حرکت «${fa || en}» با موفقیت در بانک حرکات ذخیره شد!`);
}

function approveCustomExercise(exId) {
  if (!isAdminUnlocked()) {
    alert('فقط ادمین می‌تواند حرکات را برای بانک عمومی تایید کند.');
    return;
  }
  const ex = (customExercises || []).find(e => e.id === exId);
  if (!ex) return;

  ex.isApproved = true;
  saveCustomExercises();
  applyLibraryFilters();
  showToast(`✅ حرکت "${ex.fa}" با موفقیت تایید و در بانک عمومی منتشر شد!`);
}

function deleteCustomExercise(exId) {
  const ex = (customExercises || []).find(e => e.id === exId);
  if (!ex) return;

  if (confirm(`آیا از حذف حرکت "${ex.fa}" اطمینان دارید؟`)) {
    customExercises = customExercises.filter(e => e.id !== exId);
    saveCustomExercises();
    applyLibraryFilters();
    showToast(`حرکت "${ex.fa}" با موفقیت حذف شد.`);
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

  const isApproved = isAdminUnlocked();
  const reqPublic = Boolean(document.getElementById('custRequestPublic')?.checked);
  const currentUserId = (typeof currentAuthUser !== 'undefined' && currentAuthUser) ? currentAuthUser.id : (activeProfileId || 'local');

  const newEx = {
    id: 'cust_' + Date.now(),
    fa: fa,
    en: en,
    category: category,
    muscles: muscles,
    defaultReps: reps,
    defaultSets: 3,
    videos: videos,
    isCustom: true,
    isApproved: isApproved,
    requestPublic: isApproved ? false : reqPublic,
    ownerId: currentUserId,
    createdAt: new Date().toISOString()
  };

  customExercises.push(newEx);
  saveCustomExercises();
  closeCustomExerciseModal();
  applyLibraryFilters();

  if (isApproved) {
    showToast(`👑 حرکت "${fa}" توسط ادمین در بانک عمومی منتشر شد.`);
  } else if (reqPublic) {
    showToast(`✅ حرکت "${fa}" در بانک خصوصی شما ثبت شد و جهت انتشار برای ادمین ارسال گردید.`);
  } else {
    showToast(`🔒 حرکت "${fa}" با موفقیت در بانک خصوصی شما ذخیره شد.`);
  }
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

/**
 * Calculates the unique Iranian calendar week identifier (Saturday to Friday).
 * For any given date, returns `IR_WEEK_YYYY-MM-DD` where YYYY-MM-DD is the Saturday
 * that started the current week.
 */
function getIranianWeekKey(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  const daysSinceSaturday = (day + 1) % 7;
  const sat = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceSaturday);
  const yyyy = sat.getFullYear();
  const mm = String(sat.getMonth() + 1).padStart(2, '0');
  const dd = String(sat.getDate()).padStart(2, '0');
  return `IR_WEEK_${yyyy}-${mm}-${dd}`;
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
  const currentWeek = getIranianWeekKey();
  const payload = {
    weekKey: currentWeek,
    updatedAt: Date.now(),
    sets: state
  };
  localStorage.setItem(stateKey, JSON.stringify(payload));
  if (typeof pushToCloudStorage === 'function' && isAutoCloudSyncEnabled()) {
    pushToCloudStorage(true);
  }
}

function loadSavedSets() {
  try {
    const stateKey = 'chieftain_sets_' + activeProfileId;
    const raw = localStorage.getItem(stateKey);
    const currentWeek = getIranianWeekKey();

    // Reset card completed classes and button done states in DOM first
    document.querySelectorAll('.set-btn').forEach(btn => btn.classList.remove('done'));
    document.querySelectorAll('.exercise-card').forEach(card => card.classList.remove('completed'));

    if (!raw) {
      return;
    }

    let savedWeek = null;
    let setsState = null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.weekKey) {
        savedWeek = parsed.weekKey;
        setsState = parsed.sets || {};
      } else if (parsed && typeof parsed === 'object') {
        // Legacy format without weekKey - from previous session/week
        savedWeek = null;
        setsState = parsed;
      }
    } catch(e) {
      return;
    }

    // If new Iranian week has arrived (or legacy data from previous week without weekKey):
    if (!savedWeek || savedWeek !== currentWeek) {
      console.log(`[Chieftain] New Iranian week detected (${currentWeek} vs saved ${savedWeek}). Resetting weekly checklist.`);
      localStorage.setItem(stateKey, JSON.stringify({
        weekKey: currentWeek,
        updatedAt: Date.now(),
        sets: {}
      }));
      return;
    }

    // Restore checkmarks for current week
    document.querySelectorAll('.exercise-card').forEach(card => {
      const exId = card.getAttribute('data-ex-id');
      if (setsState && setsState[exId]) {
        const btns = card.querySelectorAll('.set-btn');
        btns.forEach((btn, idx) => {
          if (setsState[exId][idx]) btn.classList.add('done');
        });
        if (btns.length && Array.from(btns).every(b => b.classList.contains('done'))) {
          card.classList.add('completed');
        }
      }
    });
  } catch(e) {
    console.error('Error loading saved sets:', e);
  }
}

// Auto-check Iranian week change on tab focus / visibility
let lastCheckedIranianWeek = getIranianWeekKey();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    const curW = getIranianWeekKey();
    if (curW !== lastCheckedIranianWeek) {
      lastCheckedIranianWeek = curW;
      loadSavedSets();
      updateAllProgressBars();
      if (typeof showToast === 'function') {
        showToast('📅 هفته تمرینی جدید آغاز شد! پیشرفت هفتگی به صورت خودکار بازنشانی شد.');
      }
    }
  }
});

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

// --- Date & Today Navigation Logic ---

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
  try { applyUiMode(); } catch(e) {}
  try { initSupabase(); } catch(e) {}

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
// --- Chieftain Real-Time Cloud Sync Database Engine (Supabase Exclusive) ---

function isAutoCloudSyncEnabled() {
  const val = localStorage.getItem('chieftain_auto_cloud_sync');
  return val === null ? true : val === 'true';
}

function toggleAutoCloudSync(enabled) {
  localStorage.setItem('chieftain_auto_cloud_sync', enabled ? 'true' : 'false');
  const badge = document.getElementById('autoSyncStateBadge');
  const isEn = currentLang === 'en';
  if (badge) {
    if (enabled) {
      badge.innerHTML = isEn ? '🟢 Active' : '🟢 روشن و فعال';
      badge.style.background = 'rgba(16,185,129,0.2)';
      badge.style.color = '#34d399';
    } else {
      badge.innerHTML = isEn ? '⚪ Off' : '⚪ خاموش';
      badge.style.background = 'rgba(148,163,184,0.15)';
      badge.style.color = '#94a3b8';
    }
  }
  showToast(enabled 
    ? (isEn ? '✅ Auto cloud sync enabled' : '✅ همگام‌سازی خودکار ابری فعال شد') 
    : (isEn ? '⏸ Auto cloud sync paused' : '⏸ همگام‌سازی خودکار غیرفعال شد'));
}

function getAllProfilesMetricsMap() {
  const map = {};
  if (Array.isArray(allProfiles)) {
    allProfiles.forEach(p => {
      map[p.id] = getProfileBodyMetrics(p.id);
    });
  }
  return map;
}

function restoreProfilesMetricsMap(metricsMap) {
  if (metricsMap && typeof metricsMap === 'object') {
    Object.keys(metricsMap).forEach(pId => {
      if (Array.isArray(metricsMap[pId])) {
        localStorage.setItem(`chieftain_metrics_${pId}`, JSON.stringify(metricsMap[pId]));
      }
    });
    if (activeMainTab === 'metrics') {
      renderBodyMetricsView();
    }
  }
}

function getAllProfilesLogsMap() {
  const logsMap = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chieftain_logs_')) {
        try {
          logsMap[key] = JSON.parse(localStorage.getItem(key));
        } catch(e) {}
      }
    }
  } catch(e) {}
  return logsMap;
}

function restoreProfilesLogsMap(logsMap) {
  if (!logsMap || typeof logsMap !== 'object') return;
  Object.keys(logsMap).forEach(key => {
    if (key && key.startsWith('chieftain_logs_')) {
      try {
        const remoteLogs = logsMap[key];
        if (Array.isArray(remoteLogs)) {
          const localRaw = localStorage.getItem(key);
          const localLogs = localRaw ? JSON.parse(localRaw) : [];
          const seenTimestamps = new Set(localLogs.map(l => l.timestamp));
          remoteLogs.forEach(r => {
            if (r && r.timestamp && !seenTimestamps.has(r.timestamp)) {
              localLogs.push(r);
              seenTimestamps.add(r.timestamp);
            }
          });
          localLogs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          localStorage.setItem(key, JSON.stringify(localLogs));
        }
      } catch(e) {}
    }
  });
}

function getAllProfilesSetsMap() {
  const setsMap = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chieftain_sets_')) {
        try {
          setsMap[key] = JSON.parse(localStorage.getItem(key));
        } catch(e) {}
      }
    }
  } catch(e) {}
  return setsMap;
}

function restoreProfilesSetsMap(setsMap) {
  if (!setsMap || typeof setsMap !== 'object') return;
  Object.keys(setsMap).forEach(key => {
    if (key && key.startsWith('chieftain_sets_')) {
      try {
        const remoteData = setsMap[key];
        if (remoteData && typeof remoteData === 'object') {
          const localRaw = localStorage.getItem(key);
          if (!localRaw) {
            localStorage.setItem(key, JSON.stringify(remoteData));
          } else {
            const localData = JSON.parse(localRaw);
            const remoteTime = remoteData.updatedAt || 0;
            const localTime = localData.updatedAt || 0;
            if (remoteTime >= localTime) {
              localStorage.setItem(key, JSON.stringify(remoteData));
            }
          }
        }
      } catch(e) {}
    }
  });
}

async function pushToCloudStorage(silent = false) {
  if (typeof supabaseClient !== 'undefined' && supabaseClient && typeof currentAuthUser !== 'undefined' && currentAuthUser) {
    try {
      await syncCurrentDataWithSupabase();
      return true;
    } catch(err) {
      if (!silent) console.error('Cloud push error:', err);
      return false;
    }
  }

  // If user is not authenticated, data is preserved safely in localStorage
  if (!silent) {
    showToast(currentLang === 'en' 
      ? 'ℹ️ Log in to Supabase to enable secure cloud sync.' 
      : 'ℹ️ جهت همگام‌سازی ابری و امن، لطفاً وارد حساب کاربری شوید.');
    openAuthModal();
  }
  return false;
}

async function pullFromCloudStorage(silent = false) {
  if (typeof supabaseClient !== 'undefined' && supabaseClient && typeof currentAuthUser !== 'undefined' && currentAuthUser) {
    try {
      await syncCurrentDataWithSupabase();
      return true;
    } catch(err) {
      if (!silent) console.error('Cloud pull error:', err);
      return false;
    }
  }

  if (!silent) {
    showToast(currentLang === 'en' 
      ? 'ℹ️ Log in to Supabase to pull your cloud data.' 
      : 'ℹ️ جهت دریافت اطلاعات ابری، لطفاً وارد حساب کاربری شوید.');
    openAuthModal();
  }
  return false;
}

async function forceSyncAndHardRefresh(btn) {
  const isEn = currentLang === 'en';
  if (btn) {
    btn.style.opacity = '0.6';
    btn.innerHTML = isEn 
      ? '<span>⏳</span> <span>Syncing and clearing cache...</span>'
      : '<span>⏳</span> <span>در حال همگام‌سازی و پاک‌سازی کش...</span>';
  }
  showToast(isEn 
    ? '🔄 Syncing cloud data and clearing browser cache...' 
    : '🔄 در حال دریافت آخرین اطلاعات ابری و پاک‌سازی کش مرورگر...');

  // 1. Sync from Supabase first if authenticated
  if (typeof supabaseClient !== 'undefined' && supabaseClient && typeof currentAuthUser !== 'undefined' && currentAuthUser) {
    try {
      await syncCurrentDataWithSupabase();
    } catch(e) {
      console.error('Supabase sync error during refresh:', e);
    }
  }

  // 2. Clear all Service Worker caches and CacheStorage
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      for (const cName of cacheNames) {
        await caches.delete(cName);
      }
    } catch(e) {}
  }

  // 3. Force update Service Worker registrations
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        await r.update();
      }
    } catch(e) {}
  }

  // 4. Reload local data and UI
  try {
    loadAppData();
    renderApp();
  } catch(e) {}

  showToast(isEn 
    ? '🎉 Cache cleared and refreshed! 🟢' 
    : '🎉 کش مرورگر پاک شد و اطلاعات همگام گردید! 🟢');

  // 5. Force hard-reload the window bypassing browser cache
  setTimeout(() => {
    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.location.replace(cleanUrl + '?cache_bust=' + Date.now() + window.location.hash);
    } catch(e) {
      window.location.reload();
    }
  }, 500);
}

async function quickCloudSyncAction(btn) {
  const isEn = currentLang === 'en';
  if (btn) {
    btn.style.opacity = '0.6';
    btn.innerHTML = isEn ? '<span>⏳</span> <span>Syncing...</span>' : '<span>⏳</span> <span>در حال ذخیره...</span>';
  }

  if (typeof supabaseClient !== 'undefined' && supabaseClient && typeof currentAuthUser !== 'undefined' && currentAuthUser) {
    showToast(isEn ? '☁️ Syncing all data with Supabase...' : '☁️ در حال همگام‌سازی تمام داده‌ها با پایگاه داده Supabase...');
    try {
      await syncCurrentDataWithSupabase();
      showToast(isEn ? '✅ All data synchronized with Supabase! 🟢' : '✅ تمام اطلاعات با موفقیت در دیتابیس Supabase همگام شد! 🟢');
    } catch(e) {
      showToast(isEn ? '⚠️ Cloud sync error. Data is saved locally.' : '⚠️ خطا در اتصال ابری؛ اطلاعات در حافظه محلی ذخیره شد.');
    } finally {
      if (btn) {
        btn.style.opacity = '1';
        btn.innerHTML = `<span>☁️</span> <span id="quickCloudSyncBtnText">${t('cloudSync')}</span>`;
      }
    }
  } else {
    showToast(isEn ? 'ℹ️ Please log in to enable cloud sync.' : 'ℹ️ جهت همگام‌سازی ابری، لطفاً ابتدا وارد حساب شوید.');
    if (btn) {
      btn.style.opacity = '1';
      btn.innerHTML = `<span>☁️</span> <span id="quickCloudSyncBtnText">${t('cloudSync')}</span>`;
    }
    openAuthModal();
  }
}

// ==========================================================================
// 🎯 UI Display Mode: Simple Mode vs Advanced Mode
// ==========================================================================
function isSimpleMode() {
  try {
    return localStorage.getItem('chieftain_ui_mode') === 'simple';
  } catch(e) {
    return false;
  }
}

function applyUiMode() {
  const isSimple = isSimpleMode();
  const body = document.body;
  const btnText = document.getElementById('uiModeToggleText');
  const btnIcon = document.getElementById('uiModeToggleIcon');
  const btn = document.getElementById('uiModeToggleBtn');
  const isEn = currentLang === 'en';
  
  if (isSimple) {
    body.classList.add('simple-mode');
    if (btnText) btnText.innerText = isEn ? 'Advanced Mode' : 'حالت پیشرفته';
    if (btnIcon) btnIcon.innerText = '⚡';
    if (btn) {
      btn.title = isEn ? 'Switch to Advanced Mode (Full videos, muscles, charts)' : 'تغییر به حالت پیشرفته (نمایش ویدیوها، عضلات، آنالیزها و امکانات کامل)';
      btn.style.borderColor = '#10b981aa';
      btn.style.color = '#34d399';
      btn.style.background = 'rgba(16,185,129,0.15)';
    }
  } else {
    body.classList.remove('simple-mode');
    if (btnText) btnText.innerText = isEn ? 'Simple Mode' : 'حالت ساده';
    if (btnIcon) btnIcon.innerText = '🎯';
    if (btn) {
      btn.title = isEn ? 'Switch to Simple Mode (Clean & fast gym mode)' : 'تغییر به حالت ساده (خلوت و سریع مخصوص باشگاه، فقط نام حرکات و ست‌ها)';
      btn.style.borderColor = '#a855f7aa';
      btn.style.color = '#d8b4fe';
      btn.style.background = 'rgba(168,85,247,0.14)';
    }
  }
}

function toggleUiMode() {
  const current = isSimpleMode();
  const next = !current;
  try {
    localStorage.setItem('chieftain_ui_mode', next ? 'simple' : 'advanced');
  } catch(e) {}
  applyUiMode();
  showToast(next 
    ? '🎯 حالت ساده فعال شد (خلوت و بدون شلوغی برای باشگاه)' 
    : '⚡ حالت پیشرفته فعال شد (نمایش تمام امکانات و ویدیوها)'
  );
}

// ==============================================================================
// 🔒 Supabase Authentication & Multi-User Cloud Storage
// ==============================================================================
const SUPABASE_URL = 'https://dtdwutbzwddindwqqgir.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHd1dGJ6d2RkaW5kd3FxZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MzA4MTYsImV4cCI6MjEwNTUwNjgxNn0.LccpSJ5Yd_B-kcqWbzQz6M_aFuqEr0IhKGaQ3k53d3I';

let supabaseClient = null;

function initSupabase() {
  try {
    if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Check existing session
      supabaseClient.auth.getSession().then(({ data }) => {
        const session = data?.session;
        if (session && session.user) {
          handleAuthSessionChanged(session.user);
        } else {
          updateAuthUI(null);
        }
      }).catch(err => {
        console.warn('Supabase getSession error:', err);
      });

      // Listen for auth state changes
      supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
          handleAuthSessionChanged(session.user);
        } else {
          handleAuthSessionChanged(null);
        }
      });
    }
  } catch(e) {
    console.warn('Supabase initialization error:', e);
  }
}

function updateAuthUI(user) {
  const btn = document.getElementById('authModalBtn');
  const btnText = document.getElementById('authBtnText');
  const loggedOutView = document.getElementById('authLoggedOutView');
  const loggedInView = document.getElementById('authLoggedInView');
  const emailDisplay = document.getElementById('authProfileEmailDisplay');
  const nameDisplay = document.getElementById('authProfileNameDisplay');

  if (user) {
    currentAuthUser = user;
    const name = user.user_metadata?.display_name || user.email?.split('@')[0] || 'کاربر';
    if (btnText) btnText.innerText = name;
    if (btn) {
      btn.style.borderColor = '#10b981aa';
      btn.style.color = '#34d399';
      btn.style.background = 'rgba(16,185,129,0.18)';
    }
    if (loggedOutView) loggedOutView.style.display = 'none';
    if (loggedInView) loggedInView.style.display = 'block';
    if (emailDisplay) emailDisplay.innerText = user.email || '';
    if (nameDisplay) nameDisplay.innerText = `خوش آمدید، ${name}`;

    const appTitleEl = document.getElementById('appTitle');
    if (appTitleEl) {
      if (currentLang === 'en') {
        appTitleEl.innerText = `${name}'s Workout System | Chieftain Pro`;
      } else {
        appTitleEl.innerText = `سامانه تمرینی ${name} | Chieftain Pro`;
      }
    }
    updateAdminUI();
  } else {
    currentAuthUser = null;
    if (btnText) btnText.innerText = 'ورود / حساب';
    if (btn) {
      btn.style.borderColor = '#10b981aa';
      btn.style.color = '#34d399';
      btn.style.background = 'rgba(16,185,129,0.12)';
    }
    if (loggedOutView) loggedOutView.style.display = 'block';
    if (loggedInView) loggedInView.style.display = 'none';
    const appTitleEl = document.getElementById('appTitle');
    if (appTitleEl) appTitleEl.innerText = 'سامانه تخصصی بدنسازی و تمرین | Chieftain Pro';
  }
}

async function handleAuthSessionChanged(user) {
  updateAuthUI(user);
  if (user) {
    await syncCurrentDataWithSupabase();
  }
}

function openAuthModal() {
  document.getElementById('authModal')?.classList.add('open');
}

function closeAuthModal() {
  document.getElementById('authModal')?.classList.remove('open');
}

function switchAuthTab(tab) {
  const tabLogin = document.getElementById('authTabLogin');
  const tabSignup = document.getElementById('authTabSignup');
  const formLogin = document.getElementById('authLoginForm');
  const formSignup = document.getElementById('authSignupForm');

  if (tab === 'login') {
    tabLogin?.classList.add('active');
    tabSignup?.classList.remove('active');
    if (formLogin) formLogin.style.display = 'block';
    if (formSignup) formSignup.style.display = 'none';
  } else {
    tabLogin?.classList.remove('active');
    tabSignup?.classList.add('active');
    if (formLogin) formLogin.style.display = 'none';
    if (formSignup) formSignup.style.display = 'block';
  }
}

async function handleSupabaseLogin() {
  if (!supabaseClient) {
    alert('اتصال به سرور احراز هویت برقرار نشد. لطفاً اتصال اینترنت را بررسی کنید.');
    return;
  }
  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;

  if (!email || !password) {
    alert('لطفاً ایمیل و رمز عبور را وارد کنید.');
    return;
  }

  const btn = document.getElementById('loginSubmitBtn');
  if (btn) {
    btn.style.opacity = '0.6';
    btn.innerText = 'در حال ورود...';
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    showToast('🎉 خوش آمدید! با موفقیت وارد حساب خود شدید.');
    closeAuthModal();
  } catch(err) {
    alert('خطا در ورود: ' + (err.message || err));
  } finally {
    if (btn) {
      btn.style.opacity = '1';
      btn.innerHTML = '<span>🚀</span> <span>ورود امن به حساب</span>';
    }
  }
}

async function handleSupabaseSignup() {
  if (!supabaseClient) {
    alert('اتصال به سرور احراز هویت برقرار نشد. لطفاً اتصال اینترنت را بررسی کنید.');
    return;
  }
  const name = document.getElementById('signupName')?.value.trim();
  const email = document.getElementById('signupEmail')?.value.trim();
  const password = document.getElementById('signupPassword')?.value;

  if (!email || !password) {
    alert('لطفاً ایمیل و رمز عبور را وارد کنید.');
    return;
  }
  if (password.length < 6) {
    alert('رمز عبور باید حداقل ۶ کاراکتر باشد.');
    return;
  }

  const btn = document.getElementById('signupSubmitBtn');
  if (btn) {
    btn.style.opacity = '0.6';
    btn.innerText = 'در حال ساخت حساب...';
  }

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name || email.split('@')[0] }
      }
    });
    if (error) throw error;
    showToast('✅ حساب کاربری ساخته شد و با موفقیت وارد شدید!');
    closeAuthModal();
  } catch(err) {
    alert('خطا در ساخت حساب: ' + (err.message || err));
  } finally {
    if (btn) {
      btn.style.opacity = '1';
      btn.innerHTML = '<span>✨</span> <span>ایجاد حساب و اتصال امن</span>';
    }
  }
}

async function handleSupabaseLogout() {
  if (!supabaseClient) return;
  if (confirm('آیا مایلید از حساب کاربری خود خارج شوید؟')) {
    await supabaseClient.auth.signOut();
    updateAuthUI(null);
    showToast('از حساب کاربری خارج شدید.');
    closeAuthModal();
  }
}

async function pushLogToSupabase(exId, logEntry) {
  if (!supabaseClient || !currentAuthUser) return;
  try {
    await supabaseClient.from('workout_logs').insert({
      user_id: currentAuthUser.id,
      exercise_id: exId,
      log_entry: logEntry,
      created_at: new Date(logEntry.timestamp || Date.now()).toISOString()
    });
  } catch(e) {
    console.error('pushLogToSupabase error:', e);
  }
}

async function pushMetricToSupabase(metricRecord) {
  if (!supabaseClient || !currentAuthUser) return;
  try {
    await supabaseClient.from('body_metrics').insert({
      user_id: currentAuthUser.id,
      metric_record: metricRecord,
      created_at: new Date(metricRecord.timestamp || Date.now()).toISOString()
    });
  } catch(e) {
    console.error('pushMetricToSupabase error:', e);
  }
}

async function syncCurrentDataWithSupabase() {
  if (!supabaseClient || !currentAuthUser) return;

  try {
    showToast('☁️ در حال همگام‌سازی با پایگاه داده اختصاصی Supabase...');
    const userId = currentAuthUser.id;

    // 1. Check if user already has routines in Supabase
    const { data: remoteRoutines } = await supabaseClient
      .from('user_routines')
      .select('*')
      .eq('user_id', userId);

    if (remoteRoutines && remoteRoutines.length > 0) {
      remoteRoutines.forEach(row => {
        if (row.profile_key && row.routine_data) {
          const prof = allProfiles.find(p => p.id === row.profile_key);
          if (prof) {
            prof.days = row.routine_data.days || prof.days;
          }
        }
      });
      localStorage.setItem('chieftain_profiles_v9', JSON.stringify(allProfiles));
    } else {
      // First time login: auto-upload current profile routine to Supabase (Zero Data Loss)
      const prof = getActiveProfile();
      await supabaseClient.from('user_routines').upsert({
        user_id: userId,
        profile_key: prof.id,
        routine_data: { days: prof.days },
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,profile_key' });
    }

    // 2. Fetch remote logs and merge with local logs
    const { data: remoteLogs } = await supabaseClient
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId);

    if (remoteLogs && remoteLogs.length > 0) {
      remoteLogs.forEach(r => {
        if (r.exercise_id && r.log_entry) {
          const localLogs = getExerciseLogs(r.exercise_id);
          const exists = localLogs.some(l => l.timestamp === r.log_entry.timestamp);
          if (!exists) {
            localLogs.push(r.log_entry);
            localLogs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            saveExerciseLogsList(r.exercise_id, localLogs);
          }
        }
      });
    }

    // 3. Upload local logs not yet in Supabase
    const logsMap = getAllProfilesLogsMap();
    for (const [key, entries] of Object.entries(logsMap)) {
      const exId = key.replace(/^chieftain_logs_[^_]+_/, '');
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          const remoteHas = remoteLogs && remoteLogs.some(r => r.exercise_id === exId && r.log_entry?.timestamp === entry.timestamp);
          if (!remoteHas) {
            await supabaseClient.from('workout_logs').insert({
              user_id: userId,
              exercise_id: exId,
              log_entry: entry,
              created_at: new Date(entry.timestamp || Date.now()).toISOString()
            });
          }
        }
      }
    }

    // 4. Remote & local body metrics sync
    const { data: remoteMetrics } = await supabaseClient
      .from('body_metrics')
      .select('*')
      .eq('user_id', userId);

    if (remoteMetrics && remoteMetrics.length > 0) {
      const localMetrics = getProfileBodyMetrics(activeProfileId);
      remoteMetrics.forEach(r => {
        if (r.metric_record) {
          const exists = localMetrics.some(m => m.id === r.metric_record.id || m.timestamp === r.metric_record.timestamp);
          if (!exists) {
            localMetrics.push(r.metric_record);
          }
        }
      });
      saveProfileBodyMetrics(activeProfileId, localMetrics);
    }

    renderApp();
    showToast('✅ اطلاعات و لاگ‌ها به صورت امن در دیتابیس Supabase ذخیره شدند! 🟢');
  } catch(err) {
    console.error('Supabase sync error:', err);
  }
}


// --- Sync Modal UI Handlers ---

// --- Theme Switcher (Dark / Light) ---
function initTheme() {
  const saved = localStorage.getItem('chieftain_theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('themeToggleIcon');
  const text = document.getElementById('themeToggleText');
  if (theme === 'light') {
    if (icon) icon.innerText = '🌙';
    if (text) text.innerText = t('darkMode');
  } else {
    if (icon) icon.innerText = '☀️';
    if (text) text.innerText = t('lightMode');
  }
}

function toggleTheme(event) {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  const isEn = currentLang === 'en';

  const applyChange = () => {
    localStorage.setItem('chieftain_theme', next);
    applyTheme(next);
    showToast(next === 'light' 
      ? (isEn ? '☀️ Light mode enabled' : '☀️ تم روشن (حالت روز) فعال شد') 
      : (isEn ? '🌙 Dark mode enabled' : '🌙 تم تاریک (حالت شب) فعال شد'));
  };

  // If View Transitions API is not supported or user prefers reduced motion, fallback to instant switch
  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    applyChange();
    return;
  }

  // Determine click coordinates (or center of theme button)
  let x = window.innerWidth / 2;
  let y = 0;
  if (event && (event.clientX || event.clientY)) {
    x = event.clientX;
    y = event.clientY;
  } else {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
  }

  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const transition = document.startViewTransition(() => {
    applyChange();
  });

  transition.ready.then(() => {
    const clipPath = [
      `circle(0px at ${x}px ${y}px)`,
      `circle(${endRadius}px at ${x}px ${y}px)`
    ];
    document.documentElement.animate(
      {
        clipPath: clipPath
      },
      {
        duration: 550,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        pseudoElement: '::view-transition-new(root)'
      }
    );
  });
}

try { initTheme(); } catch(e) {}

// --- Preloaded Data & Profile Restoration (Clean template defaults for Open Source) ---
const BACKUP_PRELOADED_DATA = {
  "metrics": {},
  "logs": {}
};

function restoreBackedUpProfile(templateKey) {
  const targetId = (templateKey === 'morvarid' || templateKey === 'template_female') ? 'template_female' : 'template_male';
  activeProfileId = targetId;
  localStorage.setItem('chieftain_active_profile_id', targetId);

  let prof = allProfiles.find(p => p.id === targetId);
  if (!prof) {
    if (targetId === 'template_female') {
      prof = JSON.parse(JSON.stringify(MORVARID_PROFILE));
      prof.id = 'template_female';
      allProfiles.push(prof);
    } else {
      prof = JSON.parse(JSON.stringify(HOSSEIN_PROFILE));
      prof.id = 'template_male';
      allProfiles.unshift(prof);
    }
    saveProfiles();
  }

  if (typeof supabaseClient !== 'undefined' && supabaseClient && currentAuthUser) {
    syncCurrentDataWithSupabase();
  }

  closeAuthModal();
  renderApp(true);
  showToast(currentLang === 'en' ? '🎉 Routine loaded successfully!' : '🎉 برنامه با موفقیت بارگذاری شد!');
}

function openSyncBackupModal() {
  const isEn = currentLang === 'en';
  const userBox = document.getElementById('syncModalUserBox');
  const badge = document.getElementById('cloudStatusBadge');

  if (typeof currentAuthUser !== 'undefined' && currentAuthUser) {
    if (badge) {
      badge.innerHTML = isEn ? '🟢 Connected' : '🟢 متصل به حساب ابری';
      badge.style.background = 'rgba(16,185,129,0.15)';
      badge.style.color = '#34d399';
    }
    if (userBox) {
      userBox.innerHTML = `
        <div style="background:rgba(15,23,42,0.6); border:1px solid var(--border-color); border-radius:8px; padding:10px; margin-bottom:10px;">
          <div style="font-size:11.5px; color:var(--text-muted);">${isEn ? 'Logged in as:' : 'متصل به عنوان:'}</div>
          <div style="font-size:13px; font-weight:800; color:#38bdf8; direction:ltr; text-align:left;">${currentAuthUser.email || ''}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-header-action btn-action-primary" style="flex:1; justify-content:center; padding:10px; font-weight:800;" onclick="syncCurrentDataWithSupabase()">
            <span>🔄</span> <span>${isEn ? 'Sync with Cloud Now' : 'همگام‌سازی فوری با دیتابیس'}</span>
          </button>
        </div>
      `;
    }
  } else {
    if (badge) {
      badge.innerHTML = isEn ? '⚪ Offline / Guest' : '⚪ آفلاین / مهمان';
      badge.style.background = 'rgba(148,163,184,0.15)';
      badge.style.color = '#94a3b8';
    }
    if (userBox) {
      userBox.innerHTML = `
        <div style="font-size:11.5px; color:#cbd5e1; margin-bottom:10px; line-height:1.6;">
          ${isEn 
            ? 'You are currently not logged into a cloud account. Your routines and logs are safely stored in this browser. To automatically sync across devices, log in or create a free account.'
            : 'شما در حال حاضر وارد حساب ابری نشده‌اید. برنامه‌ها و لاگ‌های شما در حافظه همین دستگاه ذخیره می‌شوند. جهت همگام‌سازی بین گوشی و کامپیوتر، وارد حساب کاربری شوید:'}
        </div>
        <button class="btn-header-action btn-action-primary" style="width:100%; justify-content:center; padding:10px; font-weight:800;" onclick="closeSyncBackupModal(); openAuthModal();">
          <span>🚀</span> <span>${isEn ? 'Log in or Sign Up' : 'ورود / ایجاد حساب کاربری ابری'}</span>
        </button>
      `;
    }
  }

  const autoToggle = document.getElementById('autoCloudSyncToggle');
  const isAuto = isAutoCloudSyncEnabled();
  if (autoToggle) autoToggle.checked = isAuto;
  const autoBadge = document.getElementById('autoSyncStateBadge');
  if (autoBadge) {
    if (isAuto) {
      autoBadge.innerHTML = isEn ? '🟢 Active' : '🟢 روشن و فعال';
      autoBadge.style.background = 'rgba(16,185,129,0.2)';
      autoBadge.style.color = '#34d399';
    } else {
      autoBadge.innerHTML = isEn ? '⚪ Off' : '⚪ خاموش';
      autoBadge.style.background = 'rgba(148,163,184,0.15)';
      autoBadge.style.color = '#94a3b8';
    }
  }

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
        const localSavedActiveId = localStorage.getItem('chieftain_active_profile_id');
        if (localSavedActiveId && allProfiles.some(p => p.id === localSavedActiveId)) {
          activeProfileId = localSavedActiveId;
        } else if (!allProfiles.some(p => p.id === activeProfileId)) {
          activeProfileId = allProfiles[0].id;
        }
        if (payload.metrics) restoreProfilesMetricsMap(payload.metrics);
        if (payload.logs) restoreProfilesLogsMap(payload.logs);
        if (payload.sets) restoreProfilesSetsMap(payload.sets);
        localStorage.setItem('chieftain_profiles_v9', JSON.stringify(allProfiles));
        saveCustomExercises();
        history.replaceState(null, document.title, window.location.pathname);
        showToast('🎉 برنامه‌ها، تغییرات، لاگ‌ها و ابعاد بدنی با موفقیت همگام‌سازی و ذخیره شدند!');
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
      version: 'v9',
      exportDate: new Date().toISOString(),
      activeProfileId: activeProfileId,
      profiles: allProfiles,
      customExercises: customExercises,
      metrics: getAllProfilesMetricsMap(),
      logs: getAllProfilesLogsMap(),
      sets: getAllProfilesSetsMap()
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
        if (data.metrics) restoreProfilesMetricsMap(data.metrics);
        saveProfiles();
        saveCustomExercises();
        closeSyncBackupModal();
        renderApp();
        showToast('✅ فایل پشتیبان و اندازه‌های بدنی با موفقیت بازیابی شد!');
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
      if (data.metrics) restoreProfilesMetricsMap(data.metrics);
      saveProfiles();
      saveCustomExercises();
      closeSyncBackupModal();
      renderApp();
      showToast('✅ برنامه و اندازه‌های بدنی با موفقیت اعمال و ذخیره شد!');
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
const isStandalone = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (typeof navigator !== 'undefined' && navigator.standalone);

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
    if (typeof pushToCloudStorage === 'function') {
      pushToCloudStorage(true);
    }
  } catch(e) {}
}

function determineHeathCarterSomatotype(height, weight, wrist, bodyFat, waist, hips, gender) {
  const isFemale = gender === 'female';
  const H = height > 0 ? height : (isFemale ? 165 : 180);
  const W = weight > 0 ? weight : (isFemale ? 60 : 80);
  const hwr = H / Math.cbrt(W); // Reciprocal Ponderal Index (Height / cube-root of weight)
  const boneRatio = H / (wrist > 0 ? wrist : (isFemale ? 15.5 : 17.8));
  
  // 1. Endomorphy Score (Relative Fatness)
  let endoScore = 2;
  const bf = bodyFat || (isFemale ? 24 : 18);
  if (isFemale) {
    if (bf >= 28) endoScore = 3;
    else if (bf <= 19) endoScore = 1;
    else endoScore = 2;
  } else {
    if (bf >= 21) endoScore = 3;
    else if (bf <= 12) endoScore = 1;
    else endoScore = 2;
  }

  // 2. Mesomorphy Score (Musculoskeletal Robustness & Bone Frame)
  let mesoScore = 2;
  if (isFemale) {
    if (boneRatio < 10.3) mesoScore = 3; // Robust bone frame
    else if (boneRatio > 11.2) mesoScore = 1; // Slender petite frame
    else mesoScore = 2;
  } else {
    if (boneRatio < 9.8) mesoScore = 3; // Thick heavy athletic frame
    else if (boneRatio > 10.6) mesoScore = 1; // Fine/light frame
    else mesoScore = 2;
  }

  // 3. Ectomorphy Score (Linearity & Slenderness)
  let ectoScore = 2;
  if (hwr >= 42.5) ectoScore = 3; // Linear / slender
  else if (hwr <= 40.2) ectoScore = 1; // Dense / compact
  else ectoScore = 2;

  let nameFa = '';
  let nameEn = '';
  let descFa = '';

  if (isFemale) {
    if (ectoScore >= 3 || (ectoScore >= 2 && mesoScore <= 2 && endoScore <= 2)) {
      nameEn = 'Ecto-Mesomorph (Lean Athletic Grace)';
      nameFa = 'اکتو - مزومورف (ظریف، کشیده و ورزیده)';
      descFa = 'اسکلت استخوانی ظریف و کشیده با متابولیسم چربی‌سوز فعال. بالاترین پتانسیل برای فرم‌دهی و لیفت عضلات سرینی بدون نگرانی از حجم‌گیری زمخت بالاتنه.';
    } else if (mesoScore >= 2 && endoScore <= 2) {
      nameEn = 'Athletic Mesomorph (Hourglass Tone)';
      nameFa = 'مزومورف ورزشی (ساعت‌شنی متناسب)';
      descFa = 'تعادل کامل توده عضلانی و ظرافت زنانه، پاسخ‌دهی فوق‌العاده به سفت‌سازی و تراشیدن میان‌تنه و هایپرتروفی پایین‌تنه.';
    } else if (endoScore >= 3 || (endoScore >= 2 && mesoScore >= 2)) {
      nameEn = 'Endo-Mesomorph (Curvy Feminine)';
      nameFa = 'اندو - مزومورف (انحنای پر و ژینوئید)';
      descFa = 'استعداد طبیعی در انحناهای پر در باسن و ران‌ها با توده عضلانی خوب. اولویت تمرینی: چربی‌سوزی هدفمند، تقویت ثبات هسته مرکزی و حفظ فرم ساعت‌شنی.';
    } else {
      nameEn = 'Delicate Ectomorph';
      nameFa = 'اکتومورف ظریف';
      descFa = 'فیزیک بسیار باریک و درصد چربی پایین؛ هدف: عضله‌سازی ظریف و تقویت انحناها.';
    }
  } else {
    // Male
    if (mesoScore >= 2 && endoScore >= 2 && ectoScore <= 1) {
      nameEn = 'Meso-Endomorph (Heavy Muscular)';
      nameFa = 'مزو - اندومورف (عضلانی پرقدرت با استعداد چربی پهلو)';
      descFa = 'اسکلت استخوانی مستحکم و ضخیم، بالاتنه ستبر و عضلات پرقدرت؛ اما تمایل طبیعی به ذخیره چربی آندروئید در پهلوها و زیر شکم در مازاد کالری.';
    } else if (mesoScore >= 2 && endoScore <= 1) {
      nameEn = 'Pure Athletic Mesomorph (Classic V-Taper)';
      nameFa = 'مزومورف اصیل ورزشی (V-Taper کلاسیک)';
      descFa = 'شانه‌های عریض طبیعی، چربی پایین، کمر باریک و پاسخ بسیار سریع به تمرینات با وزنه.';
    } else if (ectoScore >= 2 && mesoScore >= 2) {
      nameEn = 'Ecto-Mesomorph (Lean Aesthetic)';
      nameFa = 'اکتو - مزومورف (کات و فیبر)';
      descFa = 'تراشیده، کم‌چرب و خطوط عضلانی واضح با تفکیک عالی.';
    } else if (endoScore >= 2 && mesoScore <= 1) {
      nameEn = 'Endomorph (Soft Frame)';
      nameFa = 'اندومورف (چربی‌پذیر)';
      descFa = 'متابولیسم آرام‌تر با تمایل به ذخیره چربی در میان‌تنه؛ نیازمند مدیریت هوشمند کربوهیدرات.';
    } else {
      nameEn = 'Balanced Mesomorph';
      nameFa = 'مزومورف متوازن ورزشی';
      descFa = 'تقارن بدنی کلاسیک و پاسخ‌دهی متوازن به تمرین.';
    }
  }

  return { nameFa, nameEn, descFa, endoScore, mesoScore, ectoScore, hwr: Number(hwr.toFixed(1)) };
}

function calculateAnthropometrics(m, prof = null) {
  const activeP = prof || (typeof getActiveProfile === 'function' ? getActiveProfile() : null);
  const weight = parseFloat(m.weight) || 0;
  const height = parseFloat(m.height) || 0;
  const waist = parseFloat(m.waist) || 0;
  const abdomen = parseFloat(m.abdomen) || 0;
  const neck = parseFloat(m.neck) || 0;
  const hips = parseFloat(m.hips) || 0;
  const wrist = parseFloat(m.wrist) || 0;
  const ankle = parseFloat(m.ankle) || 0;
  const isFemale = m.gender === 'female';

  // 1. Calculate Body Fat with official formulas
  // Formula A: Navy Navel (Official US DoD Navy formula with abdomen at navel)
  let bfNavyNavel = null;
  if (height > 0 && neck > 0 && abdomen > 0) {
    if (!isFemale && abdomen > neck) {
      const denom = 1.0324 - 0.19077 * Math.log10(abdomen - neck) + 0.15456 * Math.log10(height);
      if (denom > 0) bfNavyNavel = Math.max(3, Math.min(50, (495 / denom) - 450));
    } else if (isFemale && hips > 0 && (abdomen + hips) > neck) {
      const denom = 1.29579 - 0.35004 * Math.log10(abdomen + hips - neck) + 0.22100 * Math.log10(height);
      if (denom > 0) bfNavyNavel = Math.max(8, Math.min(60, (495 / denom) - 450));
    }
  }

  // Formula B: Navy Narrow Waist (Upper waist circumference)
  let bfNavyWaist = null;
  if (height > 0 && neck > 0 && waist > 0) {
    if (!isFemale && waist > neck) {
      const denom = 1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height);
      if (denom > 0) bfNavyWaist = Math.max(3, Math.min(50, (495 / denom) - 450));
    } else if (isFemale && hips > 0 && (waist + hips) > neck) {
      const denom = 1.29579 - 0.35004 * Math.log10(waist + hips - neck) + 0.22100 * Math.log10(height);
      if (denom > 0) bfNavyWaist = Math.max(8, Math.min(60, (495 / denom) - 450));
    }
  }

  // Formula C: Hodgdon Weight-Adjusted Navy Formula (Preferred Fitmatic balance ~ 21.4%)
  let bfHodgdonWeight = null;
  if (bfNavyNavel !== null && bfNavyWaist !== null) {
    bfHodgdonWeight = Number(((bfNavyNavel * 0.4) + (bfNavyWaist * 0.6)).toFixed(1));
  } else if (bfNavyNavel !== null) {
    bfHodgdonWeight = Number(bfNavyNavel.toFixed(1));
  } else if (bfNavyWaist !== null) {
    bfHodgdonWeight = Number(bfNavyWaist.toFixed(1));
  }

  // Primary active body fat for composition (Preferred: Hodgdon Weight balance, or Waist)
  let bodyFat = null;
  if (m.bodyFatManual && parseFloat(m.bodyFatManual) > 0) {
    bodyFat = parseFloat(m.bodyFatManual);
  } else if (bfHodgdonWeight !== null) {
    bodyFat = bfHodgdonWeight;
  } else if (bfNavyWaist !== null) {
    bodyFat = Number(bfNavyWaist.toFixed(1));
  }

  // Body Composition Tissues
  let fatMass = null;
  let leanMass = null;
  let skeletalMuscle = null;
  let bodyWater = null;
  let boneMass = null;

  if (bodyFat !== null && weight > 0) {
    fatMass = Number((weight * (bodyFat / 100)).toFixed(1));
    leanMass = Number((weight - fatMass).toFixed(1));
    // SMM (Skeletal Muscle Mass) ≈ 54% of LBM for men, 48% for women (Janssen/Lee formula)
    skeletalMuscle = Number((leanMass * (isFemale ? 0.48 : 0.54)).toFixed(1));
    // TBW (Total Body Water) ≈ 73% of LBM
    bodyWater = Number((leanMass * 0.73).toFixed(1));
    // BMC (Bone Mineral Content) ≈ 4.2% of body weight for men, 3.8% for women
    boneMass = Number((weight * (isFemale ? 0.038 : 0.042)).toFixed(1));
  }

  // BMI (Body Mass Index)
  let bmi = null;
  if (weight > 0 && height > 0) {
    const hM = height / 100;
    bmi = Number((weight / (hM * hM)).toFixed(1));
  }

  // FFMI (Fat-Free Mass Index - Kouri et al.)
  let ffmi = null;
  let ffmiNorm = null;
  if (leanMass !== null && height > 0) {
    const hM = height / 100;
    ffmi = Number((leanMass / (hM * hM)).toFixed(2));
    ffmiNorm = Number((ffmi + 6.1 * (1.80 - hM)).toFixed(2));
  }

  // Casey Butt Natural Muscular Genetic Potential & McDonald/Aragon Diminishing Returns Model
  let maxLeanMass = null;
  let remainingMusclePotential = null;
  let yearsToPotential = null;
  let untrainedLbm = null;
  let totalPotentialGain = null;
  let achievedMuscleGain = null;
  let pctPotentialAchieved = null;
  let completedTrainingYears = null;
  let annualGainsTable = [];

  if (height > 0) {
    const hIn = height / 2.54;
    const wIn = (wrist > 0 ? wrist : (isFemale ? 15.5 : 17.8)) / 2.54;
    const aIn = (ankle > 0 ? ankle : (isFemale ? 21.0 : 23.5)) / 2.54;
    const genderCoeff = isFemale ? 0.88 : 1.045;
    const maxLbmLbs = Math.pow(hIn, 1.5) * ((Math.sqrt(wIn) / 22.66) + (Math.sqrt(aIn) / 17.01)) * genderCoeff;
    maxLeanMass = Number((maxLbmLbs * 0.453592).toFixed(1));

    if (leanMass !== null) {
      remainingMusclePotential = Math.max(0, Number((maxLeanMass - leanMass).toFixed(1)));
      
      // Untrained baseline LBM for average non-lifting adult (Kouri et al. 1995 & Gallagher et al.)
      // Average untrained baseline FFMI: 18.8 for men, 15.2 for women
      const baseFfmi = isFemale ? 15.2 : 18.8;
      const hM = height / 100;
      untrainedLbm = Number((baseFfmi * hM * hM).toFixed(1));

      // Total lifetime muscular gain potential from untrained baseline to natural limit
      totalPotentialGain = Math.max(2, Number((maxLeanMass - untrainedLbm).toFixed(1)));

      // Muscle mass achieved above untrained baseline
      achievedMuscleGain = Math.max(0, Number((leanMass - untrainedLbm).toFixed(1)));
      pctPotentialAchieved = Math.min(100, Number(((achievedMuscleGain / totalPotentialGain) * 100).toFixed(1)));

      // Lyle McDonald / Alan Aragon / Fitmatic Asymptotic Halving Hypertrophy Model:
      // Y1: 51.61% (~50% Noob Gains)
      // Y2: 25.81% (~25%)
      // Y3: 12.90% (~12.5%)
      // Y4: 6.45%  (~6.25%)
      // Y5: 3.23%  (~3.125%)
      const y1Ratio = 0.5161;
      const y2Ratio = 0.2581;
      const y3Ratio = 0.1290;
      const y4Ratio = 0.0645;
      const y5Ratio = 0.0323;

      annualGainsTable = [
        { year: 1, gainKg: Number((totalPotentialGain * y1Ratio).toFixed(1)), pct: '51.6%', label: 'فاز شتابان اولیه (Noob Gains) 🚀' },
        { year: 2, gainKg: Number((totalPotentialGain * y2Ratio).toFixed(1)), pct: '25.8%', label: 'فاز هایپرتروفی متوسط ⚡' },
        { year: 3, gainKg: Number((totalPotentialGain * y3Ratio).toFixed(1)), pct: '12.9%', label: 'فاز پیشرفته و تارگت 🎯' },
        { year: 4, gainKg: Number((totalPotentialGain * y4Ratio).toFixed(1)), pct: '6.5%', label: 'تثبیت سقف طبیعی 🛡️' },
        { year: 5, gainKg: Number((totalPotentialGain * y5Ratio).toFixed(1)), pct: '3.2%', label: 'تراکم و کمال نچرال 👑' }
      ];

      // Calculate Equivalent Training Age Completed (Years of training completed):
      const progressFraction = Math.min(1.0, achievedMuscleGain / totalPotentialGain);
      if (progressFraction <= y1Ratio) {
        completedTrainingYears = progressFraction / y1Ratio;
      } else if (progressFraction <= (y1Ratio + y2Ratio)) {
        completedTrainingYears = 1.0 + (progressFraction - y1Ratio) / y2Ratio;
      } else if (progressFraction <= (y1Ratio + y2Ratio + y3Ratio)) {
        completedTrainingYears = 2.0 + (progressFraction - (y1Ratio + y2Ratio)) / y3Ratio;
      } else if (progressFraction <= (y1Ratio + y2Ratio + y3Ratio + y4Ratio)) {
        completedTrainingYears = 3.0 + (progressFraction - (y1Ratio + y2Ratio + y3Ratio)) / y4Ratio;
      } else {
        completedTrainingYears = 4.0 + Math.min(1.0, (progressFraction - (y1Ratio + y2Ratio + y3Ratio + y4Ratio)) / y5Ratio);
      }
      completedTrainingYears = Number(completedTrainingYears.toFixed(1));

      // Realistic remaining years to reach near genetic ceiling (~95%):
      yearsToPotential = Math.max(0.5, Number((5.0 - completedTrainingYears).toFixed(1)));
    }
  }

  // BMR & Daily Macro Targets
  // Katch-McArdle Formula (gold standard using Lean Mass)
  let bmr = null;
  let tdee = null;
  let targetCalories = null;
  let targetProtein = null;
  let proteinMin = null;
  let proteinMax = null;
  if (leanMass !== null && weight > 0) {
    bmr = Math.round(370 + (21.6 * leanMass));
    
    // Activity multiplier calibrated by weekly training frequency
    let gymCount = 0;
    let homeCount = 0;
    if (activeP && Array.isArray(activeP.days)) {
      gymCount = activeP.days.filter(d => d.type === 'gym').length;
      homeCount = activeP.days.filter(d => d.type === 'home').length;
    } else {
      gymCount = isFemale ? 3 : 4;
      homeCount = isFemale ? 3 : 1;
    }
    const totalWorkoutDays = gymCount + homeCount;
    const actMultiplier = totalWorkoutDays >= 6 ? 1.55 : (totalWorkoutDays >= 4 ? 1.50 : 1.40);
    tdee = Math.round(bmr * actMultiplier);
    
    // Deficit for steady fat loss while preserving/building lean mass:
    // 350-400 kcal deficit for women, 450-500 kcal for men
    const deficit = isFemale ? 400 : 500;
    targetCalories = Math.max(1200, tdee - deficit);

    // Protein Target: Gold standard for body recomposition in resistance training
    // (Morton et al. 2018 BJSM meta-analysis & Helms et al. 2014 JISSN)
    // Ensures at least 1.65 g/kg of total body weight, or 2.75 g/kg of Lean Body Mass
    if (isFemale) {
      targetProtein = Math.round(Math.max(weight * 1.65, leanMass * 2.75));
      proteinMin = Math.round(weight * 1.55);
      proteinMax = Math.round(weight * 1.85);
    } else {
      targetProtein = Math.round(Math.max(weight * 1.95, leanMass * 2.35));
      proteinMin = Math.round(weight * 1.80);
      proteinMax = Math.round(weight * 2.20);
    }
  }

  let whr = null;
  if (waist > 0 && hips > 0) {
    whr = Number((waist / hips).toFixed(2));
  }

  let whtr = null;
  if (waist > 0 && height > 0) {
    whtr = Number((waist / height).toFixed(2));
  }

  const shoulders = parseFloat(m.shoulders) || 0;
  let swr = null;
  if (shoulders > 0 && waist > 0) {
    swr = Number((shoulders / waist).toFixed(2));
  }

  const armRight = parseFloat(m.armRight) || 0;
  const armLeft = parseFloat(m.armLeft) || 0;
  const armDiff = (armRight > 0 && armLeft > 0) ? Math.abs(armRight - armLeft) : null;

  const armRightRelaxed = parseFloat(m.armRightRelaxed) || 0;
  const armLeftRelaxed = parseFloat(m.armLeftRelaxed) || 0;

  const thighRight = parseFloat(m.thighRight) || 0;
  const thighLeft = parseFloat(m.thighLeft) || 0;
  const thighDiff = (thighRight > 0 && thighLeft > 0) ? Math.abs(thighRight - thighLeft) : null;

  const abdomenVal = parseFloat(m.abdomen) || 0;
  const lowerBellyVal = parseFloat(m.lowerBelly) || 0;
  const flankCirc = Math.max(abdomenVal, lowerBellyVal);
  
  let loveHandleRatio = null;
  let loveHandleStatus = 'none'; // 'optimal' | 'mild' | 'prominent'
  let loveHandleDelta = null;
  if (flankCirc > 0 && waist > 0) {
    loveHandleRatio = Number((flankCirc / waist).toFixed(2));
    loveHandleDelta = Number((flankCirc - waist).toFixed(1));
    if (loveHandleRatio >= 1.12) {
      loveHandleStatus = 'prominent'; // چربی سرسخت پهلو و زیر شکم (Love Handles)
    } else if (loveHandleRatio > 1.05) {
      loveHandleStatus = 'mild'; // چربی خفیف پهلو
    } else {
      loveHandleStatus = 'optimal'; // V-Taper تراشیده و بدون لاو هندل
    }
  }

  // Steve Reeves Classic Golden Trinity (Neck ≈ Arm ≈ Calf)
  const neckVal = parseFloat(m.neck) || 0;
  const armVal = Math.max(armRight, armLeft);
  const calfVal = parseFloat(m.calves) || 0;
  let reevesTrinity = null;
  if (neckVal > 0 && armVal > 0 && calfVal > 0) {
    const avg = Number(((neckVal + armVal + calfVal) / 3).toFixed(1));
    const maxDiff = Number((Math.max(neckVal, armVal, calfVal) - Math.min(neckVal, armVal, calfVal)).toFixed(1));
    reevesTrinity = {
      neck: neckVal,
      arm: armVal,
      calf: calfVal,
      avg,
      maxDiff,
      isSymmetric: maxDiff <= 2.5
    };
  }

  const somatotype = determineHeathCarterSomatotype(height, weight, wrist, bodyFat, waist, hips, m.gender);

  return {
    bodyFat: bodyFat !== null ? Number(bodyFat.toFixed(1)) : null,
    bfNavyNavel: bfNavyNavel !== null ? Number(bfNavyNavel.toFixed(1)) : null,
    bfNavyWaist: bfNavyWaist !== null ? Number(bfNavyWaist.toFixed(1)) : null,
    bfHodgdonWeight: bfHodgdonWeight !== null ? Number(bfHodgdonWeight.toFixed(1)) : null,
    fatMass: fatMass !== null ? Number(fatMass.toFixed(1)) : null,
    leanMass: leanMass !== null ? Number(leanMass.toFixed(1)) : null,
    skeletalMuscle: skeletalMuscle !== null ? Number(skeletalMuscle.toFixed(1)) : null,
    bodyWater: bodyWater !== null ? Number(bodyWater.toFixed(1)) : null,
    boneMass: boneMass !== null ? Number(boneMass.toFixed(1)) : null,
    bmi,
    ffmi,
    ffmiNorm,
    maxLeanMass,
    untrainedLbm,
    totalPotentialGain,
    achievedMuscleGain,
    pctPotentialAchieved,
    completedTrainingYears,
    annualGainsTable,
    remainingMusclePotential,
    yearsToPotential,
    bmr,
    tdee,
    targetCalories,
    targetProtein,
    proteinMin,
    proteinMax,
    whr,
    whtr,
    swr,
    shoulders: shoulders > 0 ? shoulders : null,
    neck: neckVal > 0 ? neckVal : null,
    flankCirc: flankCirc > 0 ? flankCirc : null,
    loveHandleRatio,
    loveHandleStatus,
    loveHandleDelta,
    reevesTrinity,
    somatotype,
    armDiff: armDiff !== null ? Number(armDiff.toFixed(1)) : null,
    armRightRelaxed: armRightRelaxed > 0 ? armRightRelaxed : null,
    armLeftRelaxed: armLeftRelaxed > 0 ? armLeftRelaxed : null,
    thighDiff: thighDiff !== null ? Number(thighDiff.toFixed(1)) : null
  };
}

function getAnthropometricReferenceRanges(height, gender) {
  const isFemale = gender === 'female';
  const H = height > 0 ? height : (isFemale ? 165 : 180);

  return {
    bodyFat: {
      healthRange: isFemale ? '18% – 28%' : '10% – 20%',
      goldenRange: isFemale ? '18% – 21% (جذابیت شنی و تعادل استروژن 👑)' : '8% – 12% (کات V-Taper آدونیس 👑)',
      unit: '%',
      evalStatus: (val) => {
        if (!val) return null;
        if (isFemale) {
          if (val >= 17 && val <= 22) return { label: '👑 طلایی / فیتنس ساعت‌شنی', cls: 'lab-status-golden' };
          if (val <= 28) return { label: '🟢 نرمال سلامت', cls: 'lab-status-healthy' };
          return { label: '🔴 نیاز به چربی‌سوزی', cls: 'lab-status-attention' };
        } else {
          if (val <= 12) return { label: '👑 طلایی / کات', cls: 'lab-status-golden' };
          if (val <= 20) return { label: '🟢 نرمال سلامت', cls: 'lab-status-healthy' };
          return { label: '🔴 نیاز به چربی‌سوزی', cls: 'lab-status-attention' };
        }
      }
    },
    neck: {
      healthRange: isFemale ? '31.0 – 35.0 cm' : '37.0 – 41.0 cm',
      goldenRange: isFemale ? '32.0 – 34.5 cm (ظرافت زنانه 👑)' : `${(H * 0.21).toFixed(1)} – ${(H * 0.23).toFixed(1)} cm (تثلیث استیو ریوز)`,
      unit: 'cm',
      evalStatus: (val) => {
        if (!val) return null;
        if (!isFemale) {
          if (val >= H * 0.205 && val <= H * 0.235) return { label: '👑 تقارن طلایی کلاسیک', cls: 'lab-status-golden' };
          if (val >= 36 && val <= 42) return { label: '🟢 نرمال سلامت پایه', cls: 'lab-status-healthy' };
          return { label: '⚠️ خارج از رنج', cls: 'lab-status-attention' };
        } else {
          if (val >= 31 && val <= 35) return { label: '👑 گردن ظریف و متناسب', cls: 'lab-status-golden' };
          return { label: '🟢 استاندارد سلامت', cls: 'lab-status-healthy' };
        }
      }
    },
    loveHandle: {
      healthRange: '< 1.10',
      goldenRange: isFemale ? '1.00 – 1.07 (انحنای ساعت‌شنی بدون پهلو 👑)' : '1.00 – 1.05 (V-Cut تراشیده بدون پهلو 👑)',
      unit: '',
      evalStatus: (val) => {
        if (!val) return null;
        if (val <= (isFemale ? 1.07 : 1.05)) return { label: isFemale ? '👑 میان‌تنه ظریف و کشیده' : '👑 پهلوی تراشیده V-Cut', cls: 'lab-status-golden' };
        if (val <= 1.11) return { label: '🟢 چربی خفیف پهلو', cls: 'lab-status-healthy' };
        return { label: '⚠️ لاو هندل و چربی پهلو', cls: 'lab-status-attention' };
      }
    },
    swr: {
      healthRange: isFemale ? '1.20 – 1.30' : '1.30 – 1.45',
      goldenRange: isFemale ? '1.28 – 1.38 (تناسب ساعت‌شنی بالاتنه 👑)' : '1.55 – 1.65 (هدف آدونیس: ۱.۶۱۸ 👑)',
      unit: '',
      evalStatus: (val) => {
        if (!val) return null;
        if (isFemale) {
          if (val >= 1.28 && val <= 1.40) return { label: '👑 شانه کشیده و ساعت‌شنی', cls: 'lab-status-golden' };
          return { label: '🟢 نرمال و متناسب', cls: 'lab-status-healthy' };
        } else {
          if (val >= 1.55) return { label: '👑 نسبت طلایی V-Taper', cls: 'lab-status-golden' };
          if (val >= 1.40) return { label: '🟢 نرمال و متناسب', cls: 'lab-status-healthy' };
          return { label: '⚠️ نیاز به شانه پهن‌تر', cls: 'lab-status-attention' };
        }
      }
    },
    chest: {
      healthRange: isFemale ? `${Math.round(H * 0.48)} – ${Math.round(H * 0.53)} cm` : `${Math.round(H * 0.50)} – ${Math.round(H * 0.55)} cm`,
      goldenRange: isFemale ? `${Math.round(H * 0.52)} – ${Math.round(H * 0.56)} cm` : `${Math.round(H * 0.58)} – ${Math.round(H * 0.62)} cm`,
      unit: 'cm',
      evalStatus: (val) => {
        if (!val) return null;
        if (isFemale) {
          if (val >= H * 0.51 && val <= H * 0.58) return { label: '👑 بالاتنه خوش‌فرم و متناسب', cls: 'lab-status-golden' };
          return { label: '🟢 محدوده سلامت پایه', cls: 'lab-status-healthy' };
        } else {
          const target = H * 0.58;
          if (val >= target) return { label: '👑 سینه پهن و هایپرتروفی', cls: 'lab-status-golden' };
          if (val >= H * 0.50) return { label: '🟢 محدوده سلامت پایه', cls: 'lab-status-healthy' };
          return { label: '⚠️ نیاز به هایپرتروفی', cls: 'lab-status-attention' };
        }
      }
    },
    armFlexed: {
      healthRange: isFemale ? `${(H * 0.15).toFixed(1)} – ${(H * 0.17).toFixed(1)} cm` : `${(H * 0.18).toFixed(1)} – ${(H * 0.20).toFixed(1)} cm`,
      goldenRange: isFemale ? `${(H * 0.165).toFixed(1)} – ${(H * 0.185).toFixed(1)} cm (ظرافت و توند زنانه 👑)` : `${(H * 0.22).toFixed(1)} – ${(H * 0.24).toFixed(1)} cm (بازوی حجیم 👑)`,
      unit: 'cm',
      evalStatus: (val) => {
        if (!val) return null;
        if (isFemale) {
          if (val <= H * 0.19 && val >= H * 0.16) return { label: '👑 ظریف، توند و کشیده', cls: 'lab-status-golden' };
          if (val < H * 0.16) return { label: '🟢 نرمال سلامت و لاغر', cls: 'lab-status-healthy' };
          return { label: '⚠️ حجم بیشتر از ظرافت کلاسیک', cls: 'lab-status-attention' };
        } else {
          const target = H * 0.22;
          if (val >= target) return { label: '👑 بازوی حجیم فیتنس', cls: 'lab-status-golden' };
          if (val >= H * 0.18) return { label: '🟢 نرمال سلامت پایه', cls: 'lab-status-healthy' };
          return { label: '⚠️ نیاز به حجم‌گیری', cls: 'lab-status-attention' };
        }
      }
    },
    armRelaxed: {
      healthRange: isFemale ? `${(H * 0.13).toFixed(1)} – ${(H * 0.15).toFixed(1)} cm` : `${(H * 0.16).toFixed(1)} – ${(H * 0.18).toFixed(1)} cm`,
      goldenRange: isFemale ? `${(H * 0.145).toFixed(1)} – ${(H * 0.165).toFixed(1)} cm` : `${(H * 0.20).toFixed(1)} – ${(H * 0.22).toFixed(1)} cm`,
      unit: 'cm',
      evalStatus: (val) => {
        if (!val) return null;
        if (isFemale) {
          if (val <= H * 0.17) return { label: '👑 بازوی کشیده و ظریف', cls: 'lab-status-golden' };
          return { label: '🟢 نرمال سلامت', cls: 'lab-status-healthy' };
        } else {
          if (val >= H * 0.20) return { label: '👑 فرم عضلانی عالی', cls: 'lab-status-golden' };
          if (val >= H * 0.16) return { label: '🟢 نرمال سلامت پایه', cls: 'lab-status-healthy' };
          return { label: '⚠️ نیاز به هایپرتروفی', cls: 'lab-status-attention' };
        }
      }
    },
    waist: {
      healthRange: `${(H * 0.44).toFixed(1)} – ${(H * 0.49).toFixed(1)} cm`,
      goldenRange: isFemale ? `${(H * 0.38).toFixed(1)} – ${(H * 0.42).toFixed(1)} cm (کمر باریک ساعت‌شنی 👑)` : `${(H * 0.42).toFixed(1)} – ${(H * 0.45).toFixed(1)} cm`,
      unit: 'cm',
      evalStatus: (val) => {
        if (!val) return null;
        const target = isFemale ? H * 0.42 : H * 0.45;
        if (val <= target) return { label: '👑 کمر باریک و کات', cls: 'lab-status-golden' };
        if (val <= H * 0.49) return { label: '🟢 سلامت نرمال', cls: 'lab-status-healthy' };
        return { label: '🔴 چربی مرکزی بالا', cls: 'lab-status-attention' };
      }
    },
    whr: {
      healthRange: isFemale ? '< 0.80' : '< 0.90',
      goldenRange: isFemale ? '0.68 – 0.73 (استاندارد طلایی ساعت‌شنی 👑)' : '0.80 – 0.84 (تناسب V-Shape 👑)',
      unit: '',
      evalStatus: (val) => {
        if (!val) return null;
        if (isFemale) {
          if (val <= 0.73) return { label: '👑 ساعت‌شنی ایده‌آل (دکتر سینگ)', cls: 'lab-status-golden' };
          if (val <= 0.80) return { label: '🟢 استاندارد سلامت زنانه', cls: 'lab-status-healthy' };
          return { label: '🔴 تجمع چربی میان‌تنه', cls: 'lab-status-attention' };
        } else {
          if (val <= 0.84) return { label: '👑 تناسب V-Shape', cls: 'lab-status-golden' };
          if (val <= 0.90) return { label: '🟢 استاندارد سلامت', cls: 'lab-status-healthy' };
          return { label: '🔴 چربی احشایی', cls: 'lab-status-attention' };
        }
      }
    },
    thigh: {
      healthRange: `${(H * 0.28).toFixed(1)} – ${(H * 0.31).toFixed(1)} cm`,
      goldenRange: isFemale ? `${(H * 0.30).toFixed(1)} – ${(H * 0.33).toFixed(1)} cm (پاهای خوش‌فرم و سفت)` : `${(H * 0.32).toFixed(1)} – ${(H * 0.35).toFixed(1)} cm`,
      unit: 'cm',
      evalStatus: (val) => {
        if (!val) return null;
        if (isFemale) {
          if (val <= H * 0.34 && val >= H * 0.29) return { label: '👑 ران‌های سفت، توند و متناسب', cls: 'lab-status-golden' };
          return { label: '🟢 نرمال سلامت پایه', cls: 'lab-status-healthy' };
        } else {
          if (val >= H * 0.32) return { label: '👑 پاهای قدرتمند و پر', cls: 'lab-status-golden' };
          if (val >= H * 0.28) return { label: '🟢 نرمال سلامت پایه', cls: 'lab-status-healthy' };
          return { label: '⚠️ نیاز به تمرین پا', cls: 'lab-status-attention' };
        }
      }
    },
    calves: {
      healthRange: `${(H * 0.18).toFixed(1)} – ${(H * 0.20).toFixed(1)} cm`,
      goldenRange: isFemale ? `${(H * 0.19).toFixed(1)} – ${(H * 0.21).toFixed(1)} cm` : `${(H * 0.21).toFixed(1)} – ${(H * 0.23).toFixed(1)} cm`,
      unit: 'cm',
      evalStatus: (val) => {
        if (!val) return null;
        if (isFemale) {
          if (val <= H * 0.22) return { label: '👑 ساق‌های کشیده و ظریف', cls: 'lab-status-golden' };
          return { label: '🟢 نرمال سلامت پایه', cls: 'lab-status-healthy' };
        } else {
          if (val >= H * 0.21) return { label: '👑 تقارن طلایی ساق', cls: 'lab-status-golden' };
          if (val >= H * 0.18) return { label: '🟢 نرمال سلامت پایه', cls: 'lab-status-healthy' };
          return { label: '⚠️ نیاز به تمرین ساق', cls: 'lab-status-attention' };
        }
      }
    }
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
    if (workoutContent) {
      workoutContent.style.display = 'block';
    }
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

  try {
    const prof = getActiveProfile();
    const list = getProfileBodyMetrics(prof.id);

  // Sort chronologically (oldest to newest)
  list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const isEn = currentLang === 'en';
  let profDisplayName = prof.name;
  if (isEn) {
    if (prof.id === 'hossein_chieftain') {
      profDisplayName = "Hossein";
    } else if (prof.id === 'morvarid') {
      profDisplayName = "Morvarid";
    } else if (prof.id === 'template_male') {
      profDisplayName = "Men's Sample";
    } else if (prof.id === 'template_female') {
      profDisplayName = "Women's Sample";
    } else {
      profDisplayName = prof.name_en || prof.name;
    }
  }

  let contentHtml = '';

  if (list.length === 0) {
    contentHtml = `
      <div class="metrics-empty-card">
        <div class="metrics-empty-icon">📏</div>
        <h3 style="font-size:17px; font-weight:900; color:#fff; margin-bottom:8px;">${isEn ? `Body Analysis & Measurements: «${profDisplayName}»` : `سایز و بادی‌آنالیز اختصاصی «${prof.name}»`}</h3>
        <p style="color:var(--text-muted); font-size:13px; max-width:440px; margin:0 auto 16px auto; line-height:1.6;">
          ${isEn 
            ? 'No measurements logged yet for this profile. Log your measurements to calculate US Navy body fat %, golden aesthetic ratios, and comparison charts.' 
            : 'هنوز رکوردی برای این کاربر ثبت نشده است. اندازه‌گیری‌های ماهانه خود را ثبت کنید تا درصد چربی ارتش آمریکا، نسبت‌های طلایی زیبایی و جدول مقایسه‌ای به صورت هوشمند محاسبه گردند.'}
        </p>
        <button class="btn-header-action btn-action-primary" onclick="openAddBodyMetricModal()" style="font-size:13px; padding:8px 18px;">
          ${isEn ? `➕ Log First Measurement (${profDisplayName})` : `➕ ثبت اولین اندازه‌گیری (${prof.name})`}
        </button>
      </div>
    `;
  } else {
    const current = list[list.length - 1];
    const prev = list.length > 1 ? list[list.length - 2] : null;
    const baseline = list[0];

    const curSci = calculateAnthropometrics(current, prof);
    const prevSci = prev ? calculateAnthropometrics(prev, prof) : null;
    const baseSci = calculateAnthropometrics(baseline, prof);

    const diffWeightLast = prev ? (current.weight - prev.weight) : null;
    const diffWeightBase = current.weight - baseline.weight;

    let whrLabel = 'ایده‌آل';
    let whrClass = 'good';
    if (curSci.whr !== null) {
      if (current.gender === 'female') {
        if (curSci.whr > 0.85) { whrLabel = 'ریسک بالا'; whrClass = 'bad'; }
        else if (curSci.whr > 0.80) { whrLabel = 'متوسط'; whrClass = 'neutral'; }
        else { whrLabel = 'ساعت‌شنی عالی'; whrClass = 'good'; }
      } else {
        if (curSci.whr > 1.0) { whrLabel = 'ریسک بالا'; whrClass = 'bad'; }
        else if (curSci.whr > 0.90) { whrLabel = 'متوسط'; whrClass = 'neutral'; }
        else { whrLabel = 'V-Shape عالی'; whrClass = 'good'; }
      }
    }

    const headerHtml = `
      <div class="metrics-header-bar">
        <div>
          <h2 class="metrics-title">
            <span>📏</span>
            <span>${isEn ? `Anthropometry & Body Analysis: ${profDisplayName}` : `آنتروپومتری و آنالیز بدنی: ${prof.name}`}</span>
          </h2>
          <div class="metrics-subtitle">
            ${isEn 
              ? `Latest entry: <b>${current.date}</b> (${current.time === 'صبح ناشتا' ? 'Morning Fasted' : (current.time || 'Fasted')}) · Total entries: <b>${list.length} records</b>`
              : `آخرین ثبت: <b>${current.date}</b> (${current.time || 'صبح ناشتا'}) · تعداد ثبت‌ها: <b>${list.length} رکورد</b>`}
          </div>
        </div>
        <div class="metrics-action-btns">
          <button class="btn-header-action" onclick="openBodyMetricHistoryModal()" style="background:#162035; color:#cbd5e1; border-color:var(--border-color); font-size:12px;">
            ${isEn ? `📜 History (${list.length})` : `📜 تاریخچه (${list.length})`}
          </button>
          <button class="btn-header-action btn-action-primary" onclick="openAddBodyMetricModal()" style="font-size:12px; padding:6px 14px;">
            ${isEn ? '➕ Log New Entry' : '➕ ثبت اندازه جدید'}
          </button>
        </div>
      </div>
    `;

    // 4 Key Summary Hero Cards
    const heroGridHtml = `
      <div class="metrics-hero-grid">
        <!-- Card 1: Weight & Total Delta -->
        <div class="metrics-hero-card">
          <div class="metric-hero-label">
            <span>${isEn ? '⚖️ Current Weight' : '⚖️ وزن کنونی'}</span>
            <span style="font-size:10px; color:#38bdf8;">${isEn ? `Start: ${baseline.weight}kg` : `شروع: ${baseline.weight}kg`}</span>
          </div>
          <div class="metric-hero-val">${current.weight} <small>kg</small></div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <div style="font-size:10.5px; color:var(--text-muted);">${isEn ? 'Total Change:' : 'تغییر کل:'}</div>
            ${formatDeltaPill(diffWeightBase, false, 'kg')}
          </div>
        </div>

        <!-- Card 2: Navy Body Fat % & Muscle Mass -->
        <div class="metrics-hero-card">
          <div class="metric-hero-label">
            <span>${isEn ? '🔬 Body Fat % (Navy)' : '🔬 درصد چربی (Navy)'}</span>
            <span style="font-size:10px; color:#34d399;">${isEn ? `Fat: ${curSci.fatMass !== null ? curSci.fatMass + 'kg' : '--'}` : `چربی: ${curSci.fatMass !== null ? curSci.fatMass + 'kg' : '--'}`}</span>
          </div>
          <div class="metric-hero-val" style="color:#00f2fe;">${curSci.bodyFat !== null ? curSci.bodyFat + '%' : '--'}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <div style="font-size:10.5px; color:var(--text-muted);">${isEn ? 'Skeletal Muscle (SMM):' : 'عضله اسکلتی (SMM):'}</div>
            <span style="font-size:11px; font-weight:800; color:#34d399;">${curSci.skeletalMuscle !== null ? '~' + curSci.skeletalMuscle + ' kg' : '--'}</span>
          </div>
        </div>

        <!-- Card 3: Waist & WHR -->
        <div class="metrics-hero-card">
          <div class="metric-hero-label">
            <span>${isEn ? '🎯 Waist & WHR' : '🎯 دور کمر و WHR'}</span>
            <span style="font-size:10px; color:#facc15;">${isEn ? 'Metabolic Health' : 'سلامت متابولیک'}</span>
          </div>
          <div class="metric-hero-val" style="color:#facc15;">${current.waist || '--'} <small>cm</small></div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <div style="font-size:10.5px; color:var(--text-muted);">${isEn ? 'Shape Status:' : 'وضعیت فرم:'}</div>
            <span class="delta-pill ${whrClass}">${isEn ? (whrLabel === 'ایده‌آل' ? 'Ideal' : (whrLabel === 'ریسک بالا' ? 'High Risk' : (whrLabel === 'ساعت‌شنی عالی' ? 'Great Hourglass' : (whrLabel === 'V-Shape عالی' ? 'Great V-Shape' : 'Moderate')))) : whrLabel}</span>
          </div>
        </div>

        <!-- Card 4: Muscle Symmetry -->
        <div class="metrics-hero-card">
          <div class="metric-hero-label">
            <span>${isEn ? '📐 Muscle Symmetry' : '📐 تقارن عضلانی'}</span>
            <span style="font-size:10px; color:#a855f7;">${isEn ? 'Right vs Left' : 'راست vs چپ'}</span>
          </div>
          <div class="metric-hero-val" style="font-size:18px; color:#c084fc;">
            ${isEn ? (curSci.armDiff !== null ? `Arm Diff: ${curSci.armDiff}cm` : 'Symmetrical') : (curSci.armDiff !== null ? `اختلاف بازو: ${curSci.armDiff}cm` : 'متقارن')}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <div style="font-size:10.5px; color:var(--text-muted);">${isEn ? 'Thigh Diff:' : 'اختلاف ران:'}</div>
            <span style="font-size:11px; font-weight:800; color:#cbd5e1;">${curSci.thighDiff !== null ? curSci.thighDiff + ' cm' : '--'}</span>
          </div>
        </div>
      </div>
    `;

    // --- Natural Muscular Genetic Potential & Macro Targets (Casey Butt & Fitmatic Model) ---
    const ffmiVal = curSci.ffmiNorm || curSci.ffmi;
    let ffmiLabel = isEn ? 'Athletic & High Fitness (Above Average)' : 'ورزیده و فیتنس عالی (Above Average)';
    let ffmiColor = '#34d399';
    if (ffmiVal < 18) { ffmiLabel = isEn ? 'Below Normal' : 'پایین‌تر از نرمال'; ffmiColor = '#94a3b8'; }
    else if (ffmiVal < 20) { ffmiLabel = isEn ? 'General Population (Normal)' : 'متوسط جامعه (Normal)'; ffmiColor = '#38bdf8'; }
    else if (ffmiVal < 22) { ffmiLabel = isEn ? 'Athletic & High Fitness (Above Average)' : 'ورزیده و فیتنس عالی (Above Average)'; ffmiColor = '#34d399'; }
    else if (ffmiVal < 25) { ffmiLabel = isEn ? 'Advanced Natural Bodybuilder' : 'بدنساز پیشرفته نچرال (Advanced)'; ffmiColor = '#facc15'; }
    else { ffmiLabel = isEn ? '👑 Natural Genetic Ceiling (Genetic Limit)' : '👑 سقف ژنتیکی طبیعی انسان (Genetic Limit)'; ffmiColor = '#f43f5e'; }

    // Dynamic training days calculation from active profile
    const isFemale = current.gender === 'female';
    const gymDaysCount = (prof.days || []).filter(d => d.type === 'gym').length;
    const homeDaysCount = (prof.days || []).filter(d => d.type === 'home').length;
    const totalDaysCount = gymDaysCount + homeDaysCount;
    const workoutStructureText = (gymDaysCount > 0 && homeDaysCount > 0)
      ? (isEn ? `${gymDaysCount} gym days + ${homeDaysCount} home days (${totalDaysCount} days/week)` : `${gymDaysCount} روز باشگاه + ${homeDaysCount} روز خانه (${totalDaysCount} روز در هفته)`)
      : (isEn ? `${totalDaysCount} days/week` : `${totalDaysCount} روز در هفته`);

    const geneticPotentialHtml = `
      <div style="background:#111a2e; border:1px solid rgba(99,102,241,0.35); border-radius:var(--radius-lg); padding:16px; margin-bottom:16px; box-shadow:0 4px 20px rgba(0,0,0,0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:22px;">🧬</span>
            <div>
              <h3 style="font-size:14.5px; font-weight:900; color:#818cf8; margin:0;">پتانسیل ژنتیکی عضله نچرال و اهداف تغذیه (Genetic Limits & Macros)</h3>
              <div style="font-size:11px; color:#94a3b8; margin-top:2px;">سقف ژنتیکی بدون دارو (مدل دکتر کیسی بات) کالیبره شده با برنامه تمرینی شما (${workoutStructureText})</div>
            </div>
          </div>
          <span style="font-size:11px; background:rgba(99,102,241,0.15); color:#a5b4fc; border:1px solid rgba(99,102,241,0.3); padding:3px 10px; border-radius:8px; font-weight:800;">🔬 Natural Ceiling</span>
        </div>

        <!-- Metric 1: FFMI Progress Bar -->
        <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="font-size:12px; font-weight:800; color:#cbd5e1;">
              <span>📊 شاخص توده عضلانی بدون چربی (FFMI):</span>
              <span style="font-size:11px; color:${ffmiColor}; margin-right:6px;">${ffmiLabel}</span>
            </div>
            <div style="font-size:15px; font-weight:900; color:#00f2fe;">${ffmiVal || '--'}</div>
          </div>
          <div style="height:10px; background:#1e293b; border-radius:6px; overflow:hidden; position:relative; margin-bottom:6px;">
            <div style="height:100%; width:${Math.min(100, Math.max(10, ((ffmiVal - 16) / (25 - 16)) * 100))}%; background:linear-gradient(90deg, #38bdf8, #34d399, #facc15); border-radius:6px; transition:width 0.5s ease;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:9.5px; color:#64748b;">
            <span>۱۶ (کم‌حجم)</span>
            <span>۱۸ (متوسط)</span>
            <span>۲۰ (ورزشکار)</span>
            <span>۲۲ (پیشرفته)</span>
            <span>۲۵ (سقف نچرال 👑)</span>
          </div>
        </div>

        <!-- Metric 2: Lean Body Mass Potential & Training Years -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px; margin-bottom:10px;">
          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px;">
            <div style="font-size:11.5px; font-weight:800; color:#38bdf8; margin-bottom:4px;">💪 پتانسیل رشد عضله نچرال (LBM Potential):</div>
            <div style="font-size:20px; font-weight:900; color:#fff; margin-bottom:4px;">
              +${curSci.remainingMusclePotential !== null ? curSci.remainingMusclePotential : '--'} <span style="font-size:12px; color:#94a3b8;">kg عضله خالص دیگر</span>
            </div>
            <div style="font-size:11px; color:#94a3b8; line-height:1.5;">
              سقف ژنتیکی طبیعی شما با مچ دست ${current.wrist || (isFemale ? 15.5 : 18)}cm و مچ پای ${current.ankle || (isFemale ? 21.5 : 24)}cm حدود <b>${curSci.maxLeanMass || '--'} kg</b> توده بدون چربی است (عضله پایه بدون تمرین: <b>${curSci.untrainedLbm || '--'} kg</b>).
            </div>
          </div>

          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px;">
            <div style="font-size:11.5px; font-weight:800; color:#facc15; margin-bottom:4px;">⏳ سن تمرینی معادل و زمان تا سقف طبیعی:</div>
            <div style="font-size:20px; font-weight:900; color:#fde047; margin-bottom:4px;">
              معادل ~ ${curSci.completedTrainingYears !== null ? curSci.completedTrainingYears : '--'} <span style="font-size:12px; color:#94a3b8;">سال تمرین موثر</span>
            </div>
            <div style="font-size:11px; color:#94a3b8; line-height:1.5;">
              زمان تخمینی باقی‌مانده تا اوج ژنتیکی: <b>~ ${curSci.yearsToPotential !== null ? curSci.yearsToPotential : '--'} سال</b> بر پایه برنامه <b>${workoutStructureText}</b> و قانون بازده نزولی.
            </div>
          </div>
        </div>

        <!-- Metric 2.5: Dual Progress Bar & 5-Year Diminishing Returns Table -->
        <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
            <div style="font-size:12px; font-weight:800; color:#38bdf8; display:flex; align-items:center; gap:6px;">
              <span>📈</span> <span>مسیر تحقق پتانسیل ژنتیکی نچرال (عضله کسب‌شده vs باقیمانده):</span>
            </div>
            <div style="font-size:11px; font-weight:800; color:#facc15;">
              ${curSci.pctPotentialAchieved !== null ? curSci.pctPotentialAchieved + '٪ محقق شده' : ''}
            </div>
          </div>
          
          <div style="height:12px; background:#0f172a; border-radius:6px; overflow:hidden; display:flex; margin-bottom:6px; border:1px solid rgba(255,255,255,0.1);">
            <div style="width:${curSci.pctPotentialAchieved || 0}%; background:linear-gradient(90deg, #f59e0b, #10b981); transition:width 0.5s ease;" title="کسب شده: ${curSci.achievedMuscleGain || 0} kg"></div>
            <div style="width:${100 - (curSci.pctPotentialAchieved || 0)}%; background:rgba(56,189,248,0.25);" title="باقیمانده: ${curSci.remainingMusclePotential || 0} kg"></div>
          </div>

          <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; margin-bottom:10px;">
            <span>۰٪ (بدون سابقه: ${curSci.untrainedLbm || '--'}kg)</span>
            <span style="color:#10b981; font-weight:800;">فعلی: ${curSci.leanMass || '--'}kg (+${curSci.achievedMuscleGain || 0}kg رشد)</span>
            <span style="color:#38bdf8;">سقف نچرال: ${curSci.maxLeanMass || '--'}kg</span>
          </div>

          <div style="font-size:11.5px; font-weight:800; color:#cbd5e1; margin-bottom:6px;">
            📊 پیش‌بینی رشد سالیانه بر اساس مدل کاهش تصاعدی (Lyle McDonald & Alan Aragon):
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%; font-size:11px; border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#94a3b8; text-align:right;">
                  <th style="padding:4px 6px;">سال</th>
                  <th style="padding:4px 6px; text-align:center;">پتانسیل رشد</th>
                  <th style="padding:4px 6px; text-align:center;">سهم از کل</th>
                  <th style="padding:4px 6px;">مرحله فیزیولوژیک هایپرتروفی</th>
                </tr>
              </thead>
              <tbody>
                ${(curSci.annualGainsTable || []).map(row => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:5px 6px; font-weight:800; color:#38bdf8;">سال ${row.year}</td>
                    <td style="padding:5px 6px; text-align:center; font-weight:900; color:#34d399;">+${row.gainKg} kg</td>
                    <td style="padding:5px 6px; text-align:center; color:#facc15;">${row.pct}</td>
                    <td style="padding:5px 6px; font-size:10.5px; color:#cbd5e1;">${row.label}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:8px; font-size:10px; color:#94a3b8; line-height:1.5;">
            💡 <b>قانون بازده نزولی در هایپرتروفی طبیعی:</b> طبق مدل علمی معتبر مک‌دونالد و آراگون (Fitmatic Model)، بیش از ۵۰٪ از کل رشد عضلانی عمر یک ورزشکار طبیعی در همان سال اول تمرین اصولی رخ می‌دهد (Newbie Gains) و در سال‌های بعد نرخ رشد تقریباً به ازای هر سال نصف می‌شود.
          </div>
        </div>

        <!-- Metric 3: Tailored Calories & Macros -->
        <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px;">
          <div style="font-size:12px; font-weight:800; color:#34d399; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <span>🍽️</span> <span>تارگت‌های هوشمند کالری و پروتئین برای چربی‌سوزی و حفظ عضله (Recomp):</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
            <div style="background:rgba(0,0,0,0.25); border-radius:8px; padding:8px; text-align:center;">
              <div style="font-size:10px; color:#94a3b8;">متابولیسم پایه (BMR)</div>
              <div style="font-size:14px; font-weight:900; color:#cbd5e1; margin-top:2px;">${curSci.bmr || '--'} <small style="font-size:10px;">kcal</small></div>
            </div>
            <div style="background:rgba(0,0,0,0.25); border-radius:8px; padding:8px; text-align:center;">
              <div style="font-size:10px; color:#94a3b8;">مصرف کل روزانه (TDEE)</div>
              <div style="font-size:14px; font-weight:900; color:#38bdf8; margin-top:2px;">${curSci.tdee || '--'} <small style="font-size:10px;">kcal</small></div>
            </div>
            <div style="background:rgba(0,0,0,0.25); border-radius:8px; padding:8px; text-align:center; border:1px solid rgba(245,158,11,0.3);">
              <div style="font-size:10px; color:#fbbf24;">کالری هدف (Deficit)</div>
              <div style="font-size:14px; font-weight:900; color:#facc15; margin-top:2px;">${curSci.targetCalories || '--'} <small style="font-size:10px;">kcal</small></div>
            </div>
            <div style="background:rgba(0,0,0,0.25); border-radius:8px; padding:8px; text-align:center; border:1px solid rgba(52,211,153,0.3);">
              <div style="font-size:10px; color:#34d399;">پروتئین هدف روزانه</div>
              <div style="font-size:14px; font-weight:900; color:#34d399; margin-top:2px;">${curSci.targetProtein || '--'} <small style="font-size:10px;">گرم</small></div>
            </div>
          </div>
          <div style="margin-top:8px; background:rgba(0,0,0,0.2); border-radius:6px; padding:6px 10px; font-size:10.5px; color:#94a3b8; line-height:1.5;">
            🔬 <b>مرجع علمی پروتئین بازسازی بدنی (Body Recomposition):</b>
            هدف <b>${curSci.targetProtein || '--'} گرم</b> (بازه بهینه: <b>${curSci.proteinMin || '--'} تا ${curSci.proteinMax || '--'} گرم</b>)
            ${isFemale ? `
              بر اساس راهنمای رسمی انجمن بین‌المللی تغذیه ورزشی (ISSN) و متاآنالیز BJSM 2018، بر پایه <b>۱.۶۵ گرم پروتئین</b> به ازای هر کیلوگرم وزن کل (فرمول: <b>${current.weight}kg × 1.65 = ${curSci.targetProtein}g</b>) یا ۲.۷۵ گرم بر کیلوگرم توده عضلانی خالص (LBM) کالیبره شده است تا عضلات حین چربی‌سوزی سفت، خوش‌فرم و کشیده شوند.
            ` : `
              بر اساس معتبرترین متاآنالیز دنیا (مورتون و همکاران، ژورنال پزشکی ورزشی بریتانیا BJSM 2018 و هلمز/ISSN 2014) برای هایپرتروفی و حفظ کامل عضله در رژیم کسر کالری، بر پایه <b>۱.۹۵ گرم پروتئین به ازای هر کیلوگرم وزن کل</b> (فرمول: <b>${current.weight}kg × 1.95 = ${curSci.targetProtein} گرم</b>) در بازه بهینه ۱.۸ تا ۲.۲ گرم بر کیلوگرم وزن تنظیم شده است تا حداکثر سنتز پروتئین عضلانی (MPS) فعال بماند.
            `}
          </div>
        </div>

        <!-- Metric 4: Body Fat Breakdown Explanation -->
        <div style="margin-top:10px; background:rgba(0,0,0,0.25); border-radius:8px; padding:8px 12px; font-size:11px; color:#94a3b8; line-height:1.6;">
          🔍 <b>شفاف‌سازی درصد چربی در فرمول‌های معتبر:</b>
          فرمول رسمی ارتش آمریکا با دور شکم/ناف: <b style="color:#f87171;">${curSci.bfNavyNavel ? curSci.bfNavyNavel + '٪' : '--'}</b> |
          با باریک‌ترین نقطه کمر: <b style="color:#38bdf8;">${curSci.bfNavyWaist ? curSci.bfNavyWaist + '٪' : '--'}</b> |
          مدل تعادلی هودگدون (Fitmatic): <b style="color:#00f2fe;">${curSci.bfHodgdonWeight ? curSci.bfHodgdonWeight + '٪' : '--'}</b>.
          <div style="margin-top:3px; color:#cbd5e1;">(دلیل تفاوت اعداد: ارتش آمریکا دور ناف را به عنوان شاخص چربی احشایی ملاک قرار می‌دهد؛ با سوزاندن چربی شکم، هر سه عدد به سمت رنج طلایی ۸ تا ۱۲ درصد حرکت می‌کنند).</div>
        </div>
      </div>
    `;

    // --- Laboratory-Style Health & Golden Aesthetic Analysis Table ---
    const labRanges = getAnthropometricReferenceRanges(current.height, current.gender);

    const labRows = [
      { name: isEn ? 'Body Fat % (Navy BF%)' : 'درصد چربی بدن (Navy BF%)', val: curSci.bodyFat, unit: '%', rangeObj: labRanges.bodyFat },
      { name: isEn ? 'Neck (Health & Symmetry)' : 'دور گردن (Neck - شاخص سلامت و تقارن)', val: current.neck, unit: 'cm', rangeObj: labRanges.neck },
      { name: isEn ? 'Shoulder-to-Waist (Adonis V-Taper)' : 'نسبت سرشانه به کمر (Adonis V-Taper)', val: curSci.swr, unit: '', rangeObj: labRanges.swr },
      { name: isEn ? 'Chest Circumference' : 'دور سینه (Chest)', val: current.chest, unit: 'cm', rangeObj: labRanges.chest },
      { name: isEn ? 'Flexed Biceps Circumference' : 'دور بازوی منقبض (Flexed Biceps)', val: current.armRight || current.armLeft, unit: 'cm', rangeObj: labRanges.armFlexed },
      { name: isEn ? 'Relaxed Arm Circumference' : 'دور بازوی ریلکس / عادی (Relaxed Arm)', val: current.armRightRelaxed || current.armLeftRelaxed, unit: 'cm', rangeObj: labRanges.armRelaxed },
      { name: isEn ? 'Waist Circumference' : 'دور کمر (Waist)', val: current.waist, unit: 'cm', rangeObj: labRanges.waist },
      { name: isEn ? 'Love Handle Ratio' : 'شاخص لاو هندل و پهلو (Love Handle Ratio)', val: curSci.loveHandleRatio, unit: '', rangeObj: labRanges.loveHandle },
      { name: isEn ? 'Waist-to-Hip Ratio (WHR)' : 'نسبت دور کمر به باسن (WHR)', val: curSci.whr, unit: '', rangeObj: labRanges.whr },
      { name: isEn ? 'Mid-Thigh Circumference' : 'دور ران میانی (Mid-Thigh)', val: current.thighRight || current.thighLeft, unit: 'cm', rangeObj: labRanges.thigh },
      { name: isEn ? 'Calves Circumference' : 'دور ساق پا (Calves)', val: current.calves, unit: 'cm', rangeObj: labRanges.calves }
    ];

    const labTableRowsHtml = labRows.map(r => {
      const valNum = r.val !== null && r.val !== undefined ? parseFloat(r.val) : null;
      const status = valNum !== null ? r.rangeObj.evalStatus(valNum) : null;
      const valDisplay = valNum !== null ? `<b>${valNum}</b> <span style="font-size:11px; color:#94a3b8;">${r.unit}</span>` : '<span style="color:#64748b;">--</span>';
      
      let statusLabel = status ? status.label : '';
      if (isEn && statusLabel) {
        statusLabel = statusLabel
          .replace(/طلایی \/ فیتنس ساعت‌شنی/g, 'Golden / Hourglass')
          .replace(/طلایی \/ کات/g, 'Golden / Cut')
          .replace(/نرمال سلامت پایه/g, 'Baseline Health')
          .replace(/نرمال سلامت/g, 'Normal Health')
          .replace(/استاندارد سلامت/g, 'Standard Health')
          .replace(/نیاز به چربی‌سوزی/g, 'Needs Fat Loss')
          .replace(/تقارن طلایی کلاسیک/g, 'Classic Golden Symmetry')
          .replace(/گردن ظریف و متناسب/g, 'Graceful & Proportionate')
          .replace(/خارج از رنج/g, 'Out of Range')
          .replace(/میان‌تنه ظریف و کشیده/g, 'Slim & Toned Midsection')
          .replace(/پهلوی تراشیده V-Cut/g, 'Chiseled V-Cut Flank')
          .replace(/چربی خفیف پهلو/g, 'Mild Flank Fat')
          .replace(/لاو هندل و چربی پهلو/g, 'Love Handle Fat')
          .replace(/شانه کشیده و ساعت‌شنی/g, 'Toned Shoulder / Hourglass')
          .replace(/نسبت طلایی V-Taper/g, 'Golden V-Taper Ratio')
          .replace(/نرمال و متناسب/g, 'Normal & Proportionate')
          .replace(/نیاز به شانه پهن‌تر/g, 'Needs Wider Shoulders')
          .replace(/بالاتنه خوش‌فرم و متناسب/g, 'Shapely Upper Body')
          .replace(/محدوده سلامت پایه/g, 'Baseline Health Range')
          .replace(/سینه پهن و هایپرتروفی/g, 'Hypertrophied Chest')
          .replace(/نیاز به هایپرتروفی/g, 'Needs Hypertrophy')
          .replace(/ظریف، توند و کشیده/g, 'Toned & Elegant')
          .replace(/نرمال سلامت و لاغر/g, 'Slim Health')
          .replace(/حجم بیشتر از ظرافت کلاسیک/g, 'Above Classic Toned Range')
          .replace(/بازوی حجیم فیتنس/g, 'Athletic Arm Size')
          .replace(/نیاز به حجم‌گیری/g, 'Needs Mass Gain');
      }

      let goldenRangeDisplay = r.rangeObj.goldenRange;
      if (isEn && goldenRangeDisplay) {
        goldenRangeDisplay = goldenRangeDisplay
          .replace(/جذابیت شنی و تعادل استروژن/g, 'Hourglass Aesthetic')
          .replace(/کات V-Taper آدونیس/g, 'Adonis V-Taper Cut')
          .replace(/ظرافت زنانه/g, 'Feminine Grace')
          .replace(/تثلیث استیو ریوز/g, 'Steve Reeves Trinity')
          .replace(/انحنای ساعت‌شنی بدون پهلو/g, 'Hourglass Waist')
          .replace(/V-Cut تراشیده بدون پهلو/g, 'Chiseled V-Cut')
          .replace(/تناسب ساعت‌شنی بالاتنه/g, 'Upper Hourglass')
          .replace(/هدف آدونیس: ۱.۶۱۸/g, 'Adonis Target: 1.618')
          .replace(/ظرافت و توند زنانه/g, 'Feminine Tone')
          .replace(/بازوی حجیم/g, 'Athletic Arm');
      }

      return `
        <tr>
          <td style="font-weight:800; color:#fff;">${r.name}</td>
          <td style="color:#00f2fe; font-size:13.5px; text-align:center;">${valDisplay}</td>
          <td style="text-align:center;"><span class="range-pill-health">${r.rangeObj.healthRange}</span></td>
          <td style="text-align:center;"><span class="range-pill-golden">${goldenRangeDisplay}</span></td>
          <td style="text-align:center;">
            ${status ? `<span class="lab-status-badge ${status.cls}">${statusLabel}</span>` : '<span style="color:#64748b;">—</span>'}
          </td>
        </tr>
      `;
    }).join('');

    // --- Special Diagnostic Box: Love Handles, Somatotype & Female Hourglass / Male V-Taper ---
    const isLoveHandleProminent = curSci.loveHandleStatus === 'prominent';
    const trinityObj = curSci.reevesTrinity;
    const somato = curSci.somatotype || { nameFa: 'مزومورف متناسب', nameEn: 'Athletic Mesomorph', descFa: '' };

    // Dynamic calculations for Female Card 2 (Hourglass & Arm Balance)
    const armVal = parseFloat(current.armRight || current.armLeft) || 0;
    const femaleGoldenArmMin = Number((current.height * 0.165).toFixed(1));
    const femaleGoldenArmMax = Number((current.height * 0.185).toFixed(1));
    const isArmBulky = armVal > femaleGoldenArmMax;
    const isArmGolden = armVal >= femaleGoldenArmMin && armVal <= femaleGoldenArmMax;
    const isWhrHigh = curSci.whr > 0.80;
    const isWhrGolden = curSci.whr >= 0.68 && curSci.whr <= 0.73;

    let femaleArmSummaryHtml = '';
    if (isArmBulky) {
      const overCm = (armVal - femaleGoldenArmMax).toFixed(1);
      femaleArmSummaryHtml = `
        <div style="margin-top:6px; background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.25); border-radius:6px; padding:6px 8px; font-size:11px; color:#fca5a5; line-height:1.5;">
          ⚠️ <b>ارزیابی بازو (${armVal}cm):</b> حدود <b>${overCm}cm بالاتر</b> از سقف رنج ظرافت زنانه (${femaleGoldenArmMin} تا ${femaleGoldenArmMax}cm) است. با توجه به درصد چربی (${curSci.bodyFat || '--'}٪)، این حجم ناشی از بافت چربی زیرپوستی است؛ بنابراین نیازی به حجیم‌سازی بازو نیست و اولویت اصلی <b>چربی‌سوزی، سفت‌سازی و توند کردن بازوها</b> است.
        </div>
      `;
    } else if (isArmGolden) {
      femaleArmSummaryHtml = `
        <div style="margin-top:6px; background:rgba(52,211,153,0.1); border:1px solid rgba(52,211,153,0.25); border-radius:6px; padding:6px 8px; font-size:11px; color:#6ee7b7; line-height:1.5;">
          👑 <b>ارزیابی بازو (${armVal}cm):</b> کاملاً در محدوده استاندارد ظرافت و تناسب کلاسیک زنانه (${femaleGoldenArmMin} تا ${femaleGoldenArmMax}cm) قرار دارد.
        </div>
      `;
    } else if (armVal > 0) {
      femaleArmSummaryHtml = `
        <div style="margin-top:6px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.25); border-radius:6px; padding:6px 8px; font-size:11px; color:#bae6fd; line-height:1.5;">
          🟢 <b>ارزیابی بازو (${armVal}cm):</b> لاغرتر از رنج ایده‌آل؛ پتانسیل عضله‌سازی ظریف و توند در خانه وجود دارد.
        </div>
      `;
    }

    let femaleWhrSummaryHtml = '';
    if (isWhrHigh) {
      femaleWhrSummaryHtml = `
        <div style="font-size:11px; color:#cbd5e1; line-height:1.5;">
          🌸 <b>تحلیل تناسب ساعت‌شنی:</b> نسبت فعلی (<b>${curSci.whr || '--'}</b>) بالاتر از استاندارد سلامت (زیر ۰.۸۰) و هدف طلایی دکتر سینگ (<b>۰.۶۸ تا ۰.۷۳</b>) است. با دور کمر فعلی (<b>${current.waist || '--'}cm</b>)، اولویت علمی <b>کسری کالری عمومی جهت کاهش تدریجی چربی کل بدن و باریک شدن کمر</b> در کنار هایپرتروفی موضعی عضلات سرینی (Glutes) با تمرینات مقاومتی است تا فرم ساعت‌شنی متجلی شود (چربی‌سوزی موضعی از نظر علمی مردود است؛ چربی به صورت سیستمیک می‌سوزد اما عضله به صورت موضعی رشد می‌کند).
        </div>
      `;
    } else if (isWhrGolden) {
      femaleWhrSummaryHtml = `
        <div style="font-size:11px; color:#cbd5e1; line-height:1.5;">
          👑 <b>تحلیل تناسب ساعت‌شنی:</b> نسبت کمر به باسن (<b>${curSci.whr || '--'}</b>) دقیقاً در بازه طلایی دکتر سینگ (<b>۰.۶۸ تا ۰.۷۳</b>) است؛ اوج تعادل هورمون استروژن، سلامت بیولوژیک و جذابیت انحنای زنانه.
        </div>
      `;
    } else {
      femaleWhrSummaryHtml = `
        <div style="font-size:11px; color:#cbd5e1; line-height:1.5;">
          🟢 <b>تحلیل تناسب ساعت‌شنی:</b> نسبت کمر به باسن (<b>${curSci.whr || '--'}</b>) در محدوده نرمال سلامت است و با تداوم تقویت سرینی به فرم ساعت‌شنی طلایی نزدیک‌تر می‌شود.
        </div>
      `;
    }

    // Dynamic Card 2 based on Gender
    const card2Html = isFemale ? `
      <!-- Card 2 Female: Devendra Singh Golden Hourglass & Feminine Tone -->
      <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(244,114,182,0.25); border-radius:10px; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:12px; font-weight:800; color:#f472b6;">👑 تندیس ساعت‌شنی و ظرافت بانوان (WHR):</span>
          <span style="font-size:11px; color:#38bdf8;">مدل دکتر سینگ (هدف: ۰.۶۸–۰.۷۳)</span>
        </div>
        <div style="display:flex; justify-content:space-around; align-items:center; background:rgba(0,0,0,0.25); border-radius:8px; padding:8px 4px; margin-bottom:8px;">
          <div style="text-align:center;">
            <div style="font-size:10px; color:#94a3b8;">کمر (Waist)</div>
            <div style="font-size:14px; font-weight:900; color:#f472b6;">${current.waist || '--'} <small style="font-size:9px;">cm</small></div>
          </div>
          <div style="color:var(--text-muted); font-size:12px;">vs</div>
          <div style="text-align:center;">
            <div style="font-size:10px; color:#94a3b8;">باسن (Hips)</div>
            <div style="font-size:14px; font-weight:900; color:#38bdf8;">${current.hips || '--'} <small style="font-size:9px;">cm</small></div>
          </div>
          <div style="color:var(--text-muted); font-size:12px;">نسبت:</div>
          <div style="text-align:center;">
            <div style="font-size:10px; color:#94a3b8;">قوس WHR</div>
            <div style="font-size:14px; font-weight:900; color:${isWhrHigh ? '#f43f5e' : (isWhrGolden ? '#34d399' : '#38bdf8')};">${curSci.whr || '--'}</div>
          </div>
        </div>
        ${femaleWhrSummaryHtml}
        ${femaleArmSummaryHtml}
      </div>
    ` : `
      <!-- Card 2 Male: Steve Reeves Classic Golden Trinity -->
      <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:12px; font-weight:800; color:#facc15;">👑 تثلیث طلایی استیو ریوز (Neck / Arm / Calf):</span>
          <span style="font-size:11px; color:#38bdf8;">هدف آقایان: برابری سه عضو</span>
        </div>
        <div style="display:flex; justify-content:space-around; align-items:center; background:rgba(0,0,0,0.25); border-radius:8px; padding:8px 4px; margin-bottom:8px;">
          <div style="text-align:center;">
            <div style="font-size:10px; color:#94a3b8;">گردن (Neck)</div>
            <div style="font-size:14px; font-weight:900; color:#38bdf8;">${current.neck || '--'} <small style="font-size:9px;">cm</small></div>
          </div>
          <div style="color:var(--text-muted); font-size:12px;">vs</div>
          <div style="text-align:center;">
            <div style="font-size:10px; color:#94a3b8;">بازو (Arm)</div>
            <div style="font-size:14px; font-weight:900; color:#34d399;">${current.armRight || current.armLeft || '--'} <small style="font-size:9px;">cm</small></div>
          </div>
          <div style="color:var(--text-muted); font-size:12px;">vs</div>
          <div style="text-align:center;">
            <div style="font-size:10px; color:#94a3b8;">ساق (Calf)</div>
            <div style="font-size:14px; font-weight:900; color:#facc15;">${current.calves || '--'} <small style="font-size:9px;">cm</small></div>
          </div>
        </div>
        <div style="font-size:11px; color:#cbd5e1; line-height:1.5;">
          ${trinityObj ? `ساق پای شما (${trinityObj.calf}cm) از بازو (${trinityObj.arm}cm) جلوتر است. با افزایش ۲ تا ۳ سانتیمتر حجم بازو، تقارن کامل کلاسیک استیو ریوز حاصل می‌شود.` : 'اطلاعات دور گردن، بازو و ساق برای تحلیل تقارن کلاسیک محاسبه شد.'}
        </div>
      </div>
    `;

    // Dynamic Strategy Box based on Gender
    const strategyHtml = isFemale ? `
      <!-- Strategy Box Female -->
      <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(244,114,182,0.25); border-radius:10px; padding:10px 14px; font-size:11px; color:#cbd5e1; line-height:1.6;">
        🌸 <b>${isEn ? `Expert Coaching Protocol for Female Fitness & Aesthetics (${profDisplayName}):` : `پروتکل مربیگری تخصصی فیتنس و زیبایی بانوان (${prof.name}):`}</b>
        <div style="margin-top:4px; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px;">
          <div>
            <span style="color:#f472b6;">${isEn ? '1. Glute Lift & Hypertrophy:' : '۱. لیفت و هایپرتروفی سرینی (Glutes):'}</span>
            ${isEn ? 'Hip Thrusts, Sumo Squats, and Bulgarian Split Squats to deepen the hourglass curve.' : 'هیپ تراست، اسکات سومو و لانج بلغاری جهت تعمیق انحنای ساعت‌شنی باسن.'}
          </div>
          <div>
            <span style="color:#38bdf8;">${isEn ? '2. Upper Body Tone & Elegance:' : '۲. ظرافت و سفتی بالاتنه:'}</span>
            ${isEn ? '12-15 rep sets for sleek muscle definition without bulky mass.' : 'تمرینات با تکرار ۱۲ تا ۱۵ برای کشیدگی عضلات دست و شانه بدون افزایش حجم زمخت.'}
          </div>
          <div>
            <span style="color:#34d399;">${isEn ? `3. Recomp Nutrition (${curSci.targetProtein || 110}g Protein):` : `۳. مدیریت تغذیه رکمپ (${curSci.targetProtein || 110}g پروتئین):`}</span>
            ${isEn ? 'Mild 300-400 kcal deficit with high protein to burn fat while preserving lean tissue.' : 'کسری ملایم ۳۰۰ تا ۴۰۰ کالری و پروتئین بالا برای چربی‌سوزی همزمان با حفظ کامل بافت خالص عضلانی.'}
          </div>
        </div>
      </div>
    ` : `
      <!-- Strategy Box Male -->
      <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(245,158,11,0.25); border-radius:10px; padding:10px 14px; font-size:11px; color:#cbd5e1; line-height:1.6;">
        🔥 <b>${isEn ? `Expert Coaching Protocol for V-Taper & Flank Sculpting (${profDisplayName}):` : `پروتکل مربیگری اختصاصی برای محو کردن لاو هندل و ساخت V-Taper (${prof.name}):`}</b>
        <div style="margin-top:4px; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px;">
          <div>
            <span style="color:#facc15;">${isEn ? '1. Oblique & Core Stability:' : '۱. تقویت عضلات مورب و ثبات هسته:'}</span>
            ${isEn ? 'Side planks, Pallof press, and cable woodchops to tighten flank wall.' : 'حرکات ساید پلانک، پالووف پرس، و چوب‌بری سیمکش برای سفت کردن دیواره پهلو.'}
          </div>
          <div>
            <span style="color:#38bdf8;">${isEn ? '2. Flank Blood Flow & LISS:' : '۲. افزایش جریان خون مویرگی پهلو:'}</span>
            ${isEn ? '20 min incline walking (LISS) immediately after weight training.' : '۲۰ دقیقه پیاده‌روی شیب‌دار (LISS) ترجیحاً بلافاصله بعد از تمرین با وزنه.'}
          </div>
          <div>
            <span style="color:#34d399;">${isEn ? '3. Insulin & Calorie Deficit:' : '۳. مدیریت نوسان انسولین:'}</span>
            ${isEn ? '500 kcal deficit with 160-170g protein to incinerate stubborn fat stores.' : 'حفظ کسری ۵۰۰ کالری و پروتئین ۱۶۰-۱۷۰ گرم جهت سوزاندن ذخایر سرسخت چربی.'}
          </div>
        </div>
      </div>
    `;

    let femaleBadgeText = '👑 ساعت‌شنی ظریف';
    let femaleBadgeStyle = 'background:rgba(244,114,182,0.15); color:#f472b6; border:1px solid rgba(244,114,182,0.3);';
    if (curSci.whr > 0.80 || (curSci.bodyFat && curSci.bodyFat >= 28) || isLoveHandleProminent) {
      femaleBadgeText = isEn ? '⚠️ Needs General Fat Loss & Waist Narrowing' : '⚠️ نیاز به چربی‌سوزی عمومی و باریک شدن کمر';
      femaleBadgeStyle = 'background:rgba(244,63,94,0.15); color:#f43f5e; border:1px solid rgba(244,63,94,0.3);';
    } else if (curSci.whr <= 0.73) {
      femaleBadgeText = isEn ? '👑 Ideal Hourglass (Dr. Singh)' : '👑 ساعت‌شنی ایده‌آل (دکتر سینگ)';
      femaleBadgeStyle = 'background:rgba(52,211,153,0.15); color:#34d399; border:1px solid rgba(52,211,153,0.3);';
    }

    const loveHandleBoxHtml = `
      <div style="background:linear-gradient(145deg, #0e172a, #162035); border:1px solid ${isFemale ? (curSci.whr > 0.80 ? 'rgba(244,63,94,0.35)' : 'rgba(244,114,182,0.35)') : (isLoveHandleProminent ? 'rgba(244,63,94,0.35)' : 'rgba(56,189,248,0.35)')}; border-radius:var(--radius-lg); padding:16px; margin-bottom:16px; box-shadow:0 4px 20px rgba(0,0,0,0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:22px;">${isFemale ? '🌸' : '🎯'}</span>
            <div>
              <h3 style="font-size:14.5px; font-weight:900; color:${isFemale ? (curSci.whr > 0.80 ? '#fb7185' : '#f472b6') : (isLoveHandleProminent ? '#fb7185' : '#38bdf8')}; margin:0;">
                ${isFemale 
                  ? (isEn ? `Hourglass Proportion, Feminine Tone & Somatotype (${profDisplayName})` : `آنالیز تناسب ساعت‌شنی، ظرافت زنانه و تیپ بدنی (${prof.name})`) 
                  : (isEn ? `Flank Fat Distribution & Classic V-Taper Symmetry (${profDisplayName})` : `آنالیز توزیع چربی موضعی (لاو هندل) و تقارن کلاسیک مردانه (${prof.name})`)}
              </h3>
              <div style="font-size:11px; color:#94a3b8; margin-top:2px;">
                ${isEn ? 'Heath-Carter Clinical Somatotype Diagnosis · Gender:' : 'تشخیص بالینی تیپ بدنی هیث-کارتر · جنسیت:'} <b>${isFemale ? (isEn ? 'Female' : 'بانوان (Female)') : (isEn ? 'Male' : 'آقایان (Male)')}</b>
              </div>
            </div>
          </div>
          <span style="font-size:11px; ${isFemale ? femaleBadgeStyle : (isLoveHandleProminent ? 'background:rgba(244,63,94,0.15); color:#f43f5e; border:1px solid rgba(244,63,94,0.3);' : 'background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3);')} padding:3px 10px; border-radius:8px; font-weight:800;">
            ${isFemale ? femaleBadgeText : (isLoveHandleProminent ? (isEn ? '⚠️ Love Handle Identified' : '⚠️ لاو هندل شناسایی شد') : (isEn ? '🟢 Normal V-Taper Distribution' : '🟢 توزیع نرمال V-Taper'))}
          </span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px; margin-bottom:12px;">
          <!-- Card 1: Flank / Love Handles & Somatotype -->
          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:12px; font-weight:800; color:${isFemale ? '#f472b6' : '#fb7185'};">${isEn ? '🍩 Flank & Midsection Fat Index:' : '🍩 شاخص توزیع چربی پهلو و میان‌تنه:'}</span>
              <span style="font-size:15px; font-weight:900; color:${isLoveHandleProminent ? '#f43f5e' : '#34d399'};">${curSci.loveHandleRatio || '--'}</span>
            </div>
            <div style="font-size:11.5px; color:#cbd5e1; line-height:1.6;">
              ${isLoveHandleProminent ? 
                (isEn ? `Flank & lower belly (<b>${curSci.flankCirc || '--'}cm</b>) is approx. <b>${curSci.loveHandleDelta || '--'}cm</b> wider than narrow waist (<b>${current.waist || '--'}cm</b>). This indicates localized flank fat accumulation.` : `دور پهلو و زیر شکم (<b>${curSci.flankCirc || '--'}cm</b>) حدود <b>${curSci.loveHandleDelta || '--'}cm</b> از دور کمر باریک (<b>${current.waist || '--'}cm</b>) عریض‌تر است. این اختلاف نشان‌دهنده تجمع چربی موضعی در ناحیه پهلوهاست.`) :
                (isEn ? `Fat tissue distribution in the midsection is remarkably uniform with no stubborn flank cushions.` : `توزیع بافت چربی در میان‌تنه بسیار یکنواخت است و پهلوها فاقد بالشتک چربی سرسخت هستند.`)}
            </div>
            <div style="margin-top:8px; background:rgba(0,0,0,0.25); border-radius:6px; padding:8px 10px; font-size:11px; color:#cbd5e1; line-height:1.5;">
              🧬 <b>${isEn ? 'Somatotype (Heath-Carter):' : 'تیپ بدنی تخصصی (مدل هیث-کارتر):'}</b> <span style="color:#facc15; font-weight:800;">${isEn ? somato.nameEn : somato.nameFa}</span>
              <div style="color:#94a3b8; font-size:10px; margin-top:3px;">${isEn ? (somato.nameEn + ' physique profile') : somato.descFa}</div>
            </div>
          </div>

          ${card2Html}
        </div>

        ${strategyHtml}
      </div>
    `;

    const labReportBoxHtml = `
      <div class="lab-report-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid rgba(56,189,248,0.25); padding-bottom:8px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:22px;">🔬</span>
            <div>
              <h3 style="font-size:14.5px; font-weight:900; color:#38bdf8; margin:0;">${isEn ? `Clinical Laboratory Analysis & Golden Ratios (${profDisplayName})` : `برگه آنالیز آزمایشگاهی و رنج‌های طلایی تناسب اندام (${prof.name})`}</h3>
              <div style="font-size:11px; color:#94a3b8; margin-top:2px;">${isEn ? `Physiological standard tracking based on height: <b>${current.height || '180'}cm</b>` : `پایش استانداردهای فیزیولوژیک بر اساس قد: <b>${current.height || '180'}cm</b>`}</div>
            </div>
          </div>
          <span style="font-size:11px; background:rgba(0,242,254,0.15); color:#00f2fe; border:1px solid rgba(0,242,254,0.3); padding:3px 10px; border-radius:8px; font-weight:800;">🧪 Clinical & Aesthetic Lab</span>
        </div>

        <!-- Range Clarification Guide Banner -->
        <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:8px 12px; margin-bottom:12px; font-size:11px; color:#cbd5e1; line-height:1.6;">
          ${isEn 
            ? '💡 <b>Column Guide:</b> <span style="color:#34d399; margin-right:4px;">🟢 <b>Baseline Health:</b> Minimum physiological standard for general population metabolic health.</span> | <span style="color:#facc15; margin-right:4px;">👑 <b>Golden Aesthetic Range:</b> Peak natural classic physique and aesthetic proportion (Steve Reeves & Adonis).</span>'
            : '💡 <b>راهنمای ستون‌ها:</b> <span style="color:#34d399; margin-right:4px;">🟢 <b>سلامت پایه:</b> حداقل استاندارد فیزیولوژیک یک فرد عادی جامعه برای پیشگیری از تحلیل عضلانی و سلامت متابولیک.</span> | <span style="color:#facc15; margin-right:4px;">👑 <b>محدوده طلایی فیتنس:</b> اوج تناسب اندام نچرال و جذابیت کلاسیک (استیو ریوز و آدونیس). فراتر از این محدوده وارد فاز پرورش‌اندام سنگین مسابقه‌ای می‌شود.</span>'}
        </div>

        <div class="table-container" style="overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:16px;">
          <table class="lab-table">
            <thead>
              <tr>
                <th>${isEn ? 'Physiological Index / Body Part' : 'شاخص فیزیولوژیک / عضو'}</th>
                <th style="text-align:center; color:#00f2fe;">${isEn ? 'Your Measure' : 'اندازه شما'}</th>
                <th style="text-align:center; color:#34d399;">${isEn ? 'Baseline Health (Normal) 🟢' : 'محدوده سلامت پایه (فرد عادی) 🟢'}</th>
                <th style="text-align:center; color:#facc15;">${isEn ? 'Golden Aesthetic Ideal 👑' : 'محدوده طلایی فیتنس و زیبایی 👑'}</th>
                <th style="text-align:center;">${isEn ? 'Evaluation Status' : 'ارزیابی وضعیت'}</th>
              </tr>
            </thead>
            <tbody>
              ${labTableRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Interpretive Coaching Notes -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:10px;">
          <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px;">
            <div style="font-size:11.5px; font-weight:800; color:#34d399; margin-bottom:4px;">${isEn ? '🔬 Body Composition Breakdown:' : '🔬 تفکیک دقیق ترکیب بدنی و بافت‌ها:'}</div>
            <div style="font-size:11px; color:#cbd5e1; line-height:1.6;">
              ${isEn ? 'Fat Mass:' : 'توده چربی:'} <b>${curSci.fatMass !== null ? curSci.fatMass + ' kg' : '--'}</b> (${curSci.bodyFat}%) · ${isEn ? 'Total Lean Body Mass (LBM):' : 'توده بدون چربی (LBM کل):'} <b>${curSci.leanMass !== null ? curSci.leanMass + ' kg' : '--'}</b>
              <div style="color:#38bdf8; margin-top:4px; font-size:10.5px;">
                💪 <b>${isEn ? 'Skeletal Muscle (SMM):' : 'عضله اسکلتی خالص (SMM):'}</b> ~<b>${curSci.skeletalMuscle !== null ? curSci.skeletalMuscle + ' kg' : '--'}</b> | 💧 <b>${isEn ? 'Body Water:' : 'آب کل بدن:'}</b> ~<b>${curSci.bodyWater !== null ? curSci.bodyWater + ' kg' : '--'}</b> | 🦴 <b>${isEn ? 'Bone Mass:' : 'اسکلت استخوانی:'}</b> ~<b>${curSci.boneMass !== null ? curSci.boneMass + ' kg' : '--'}</b>
              </div>
            </div>
          </div>

          <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px;">
            <div style="font-size:11.5px; font-weight:800; color:#facc15; margin-bottom:4px;">${isEn ? '👑 V-Taper & Golden Ratio:' : '👑 تقارن V-Taper و نسبت طلایی:'}</div>
            <div style="font-size:11px; color:#cbd5e1; line-height:1.6;">
              ${isEn ? 'Your Shoulder-to-Waist ratio is' : 'نسبت سرشانه به کمر شما'} <b>${curSci.swr !== null ? curSci.swr : '--'}</b> ${isEn ? '(Golden target: 1.618).' : 'است (هدف طلایی: ۱.۶۱۸).'}
              <div style="color:#fde047; margin-top:3px;">
                ${curSci.swr && curSci.swr >= 1.55 
                  ? (isEn ? '🎉 Classic V-Taper at peak bodybuilding physique standards.' : '🎉 فرم V-Taper کلاسیک در بالاترین سطح استاندارد فیزیک بدنسازی.') 
                  : (isEn ? 'Lateral deltoid hypertrophy and waist narrowing will bring you closer to ideal V-Taper.' : 'با هایپرتروفی دلتوئید جانبی و باریک‌تر کردن کمر، به فرم V-Taper نزدیک‌تر می‌شوید.')}
              </div>
            </div>
          </div>

          <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px;">
            <div style="font-size:11.5px; font-weight:800; color:#c084fc; margin-bottom:4px;">${isEn ? '💪 Arm Contraction & Symmetry:' : '💪 انقباض بازو و تقارن ساختاری:'}</div>
            <div style="font-size:11px; color:#cbd5e1; line-height:1.6;">
              ${(current.armRight && current.armRightRelaxed) ? (isEn ? `Right arm flex pump: <b>+${(current.armRight - current.armRightRelaxed).toFixed(1)} cm</b>.` : `پمپ انقباض بازوی راست: <b>+${(current.armRight - current.armRightRelaxed).toFixed(1)} cm</b> (تفاوت منقبض و ریلکس).`) : ''}
              ${curSci.armDiff !== null ? (isEn ? `Right vs Left diff: <b>${curSci.armDiff} cm</b> (${curSci.armDiff <= 0.5 ? 'Excellent symmetry 🎯' : 'Suggestion: Unilateral work'}).` : `اختلاف راست و چپ: <b>${curSci.armDiff} cm</b> (${curSci.armDiff <= 0.5 ? 'تقارن عالی 🎯' : 'پیشنهاد: تمرینات تک‌دست'}).`) : (isEn ? 'Symmetry data appears once bilateral measurements are logged.' : 'اطلاعات تقارن پس از ثبت اندازه‌های دو طرف نمایش داده می‌شود.')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Comparison Rows Definition for Matrix Table
    const rowsData = [
      // Group 1: Body Composition
      { isGroup: true, title: isEn ? '⚖️ Body Composition' : '⚖️ وزن و ترکیب بدنی (Body Composition)' },
      { label: isEn ? 'Total Body Weight' : 'وزن کل بدن (Weight)', key: 'weight', unit: 'kg', isFat: false, baseVal: baseline.weight, prevVal: prev?.weight, curVal: current.weight },
      { label: isEn ? 'Body Fat % (US Navy)' : 'درصد چربی تخمینی (Navy Body Fat)', key: 'bodyFat', unit: '%', isFat: true, baseVal: baseSci.bodyFat, prevVal: prevSci?.bodyFat, curVal: curSci.bodyFat },
      { label: isEn ? 'Lean Body Mass (LBM)' : 'توده بدون چربی کل (Lean Body Mass - LBM)', key: 'leanMass', unit: 'kg', isFat: false, baseVal: baseSci.leanMass, prevVal: prevSci?.leanMass, curVal: curSci.leanMass },
      { label: isEn ? 'Skeletal Muscle (SMM 🏋️)' : 'عضله اسکلتی تخمینی (Skeletal Muscle - SMM 🏋️)', key: 'skeletalMuscle', unit: 'kg', isFat: false, baseVal: baseSci.skeletalMuscle, prevVal: prevSci?.skeletalMuscle, curVal: curSci.skeletalMuscle },
      { label: isEn ? 'Fat Mass' : 'توده چربی بدن (Fat Mass)', key: 'fatMass', unit: 'kg', isFat: true, baseVal: baseSci.fatMass, prevVal: prevSci?.fatMass, curVal: curSci.fatMass },
      { label: isEn ? 'Total Body Water' : 'آب تخمینی کل بدن (Total Body Water)', key: 'bodyWater', unit: 'kg', isFat: false, baseVal: baseSci.bodyWater, prevVal: prevSci?.bodyWater, curVal: curSci.bodyWater },
      { label: isEn ? 'Bone & Mineral Mass' : 'توده استخوانی و معدنی تخمینی (Bone Mass)', key: 'boneMass', unit: 'kg', isFat: false, baseVal: baseSci.boneMass, prevVal: prevSci?.boneMass, curVal: curSci.boneMass },

      // Group 2: Upper Body
      { isGroup: true, title: isEn ? '📐 Upper Body Dimensions' : '📐 ابعاد بالاتنه (Upper Body)' },
      { label: isEn ? 'Neck Circumference (US Navy)' : 'دور گردن (Neck - ارتش آمریکا)', key: 'neck', unit: 'cm', isFat: true, baseVal: baseline.neck, prevVal: prev?.neck, curVal: current.neck },
      { label: isEn ? 'Shoulders Circumference 👑' : 'دور سرشانه / دلتوئید (Shoulders 👑)', key: 'shoulders', unit: 'cm', isFat: false, baseVal: baseline.shoulders, prevVal: prev?.shoulders, curVal: current.shoulders },
      { label: isEn ? 'Chest Circumference' : 'دور سینه (Chest)', key: 'chest', unit: 'cm', isFat: false, baseVal: baseline.chest, prevVal: prev?.chest, curVal: current.chest },
      { label: isEn ? 'Right Arm Flexed' : 'دور بازوی راست منقبض (Right Arm Flexed)', key: 'armRight', unit: 'cm', isFat: false, baseVal: baseline.armRight, prevVal: prev?.armRight, curVal: current.armRight },
      { label: isEn ? 'Right Arm Relaxed' : 'دور بازوی راست ریلکس (Right Arm Relaxed)', key: 'armRightRelaxed', unit: 'cm', isFat: false, baseVal: baseline.armRightRelaxed, prevVal: prev?.armRightRelaxed, curVal: current.armRightRelaxed },
      { label: isEn ? 'Left Arm Flexed' : 'دور بازوی چپ منقبض (Left Arm Flexed)', key: 'armLeft', unit: 'cm', isFat: false, baseVal: baseline.armLeft, prevVal: prev?.armLeft, curVal: current.armLeft },
      { label: isEn ? 'Left Arm Relaxed' : 'دور بازوی چپ ریلکس (Left Arm Relaxed)', key: 'armLeftRelaxed', unit: 'cm', isFat: false, baseVal: baseline.armLeftRelaxed, prevVal: prev?.armLeftRelaxed, curVal: current.armLeftRelaxed },

      // Group 3: Core & Waist
      { isGroup: true, title: isEn ? '🎯 Core & Waist' : '🎯 میان‌تنه و شکم (Core & Waist)' },
      { label: isEn ? 'Waist (Narrowest point)' : 'دور کمر (باریک‌ترین نقطه)', key: 'waist', unit: 'cm', isFat: true, baseVal: baseline.waist, prevVal: prev?.waist, curVal: current.waist },
      { label: isEn ? 'Abdomen (At Navel)' : 'دور شکم (دقیقاً از روی ناف)', key: 'abdomen', unit: 'cm', isFat: true, baseVal: baseline.abdomen, prevVal: prev?.abdomen, curVal: current.abdomen },
      { label: isEn ? 'Lower Belly (Above Iliac Crest)' : 'دور زیر شکم (بالای استخوان لگن)', key: 'lowerBelly', unit: 'cm', isFat: true, baseVal: baseline.lowerBelly, prevVal: prev?.lowerBelly, curVal: current.lowerBelly },
      { label: isEn ? 'Love Handle Ratio' : 'شاخص لاو هندل و پهلو (Love Handle Ratio)', key: 'loveHandleRatio', unit: '', isFat: true, baseVal: baseSci.loveHandleRatio, prevVal: prevSci?.loveHandleRatio, curVal: curSci.loveHandleRatio },
      { label: isEn ? 'Shoulder-to-Waist (Adonis V-Taper)' : 'نسبت سرشانه به کمر (Adonis V-Taper)', key: 'swr', unit: '', isFat: false, baseVal: baseSci.swr, prevVal: prevSci?.swr, curVal: curSci.swr },
      { label: isEn ? 'Waist-to-Hip Ratio (WHR)' : 'نسبت دور کمر به باسن (WHR)', key: 'whr', unit: '', isFat: true, baseVal: baseSci.whr, prevVal: prevSci?.whr, curVal: curSci.whr },
      { label: isEn ? 'Waist-to-Height Ratio (WHtR)' : 'نسبت دور کمر به قد (WHtR)', key: 'whtr', unit: '', isFat: true, baseVal: baseSci.whtr, prevVal: prevSci?.whtr, curVal: curSci.whtr },

      // Group 4: Lower Body
      { isGroup: true, title: isEn ? '🦵 Lower Body Dimensions' : '🦵 ابعاد پایین‌تنه (Lower Body)' },
      { label: isEn ? 'Hips / Glutes' : 'دور باسن / سرینی (Hips/Glutes)', key: 'hips', unit: 'cm', isFat: false, baseVal: baseline.hips, prevVal: prev?.hips, curVal: current.hips },
      { label: isEn ? 'Right Mid-Thigh' : 'دور ران راست میانی (وسط زانو تا باسن)', key: 'thighRight', unit: 'cm', isFat: false, baseVal: baseline.thighRight, prevVal: prev?.thighRight, curVal: current.thighRight },
      { label: isEn ? 'Left Mid-Thigh' : 'دور ران چپ میانی (وسط زانو تا باسن)', key: 'thighLeft', unit: 'cm', isFat: false, baseVal: baseline.thighLeft, prevVal: prev?.thighLeft, curVal: current.thighLeft },
      { label: isEn ? 'Calves Circumference' : 'دور ساق پا (Calves)', key: 'calves', unit: 'cm', isFat: false, baseVal: baseline.calves, prevVal: prev?.calves, curVal: current.calves }
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
      return `<tr><td style="font-weight:700; color:#fff;">${r.label}</td><td style="color:#94a3b8; text-align:center;">${formatVal(baseVal)}</td><td style="color:#94a3b8; text-align:center;">${formatVal(prevVal)}</td><td style="color:#00f2fe; font-weight:800; text-align:center; font-size:13.5px;">${formatVal(curVal)}</td><td style="text-align:center;">${formatDeltaPill(deltaLast, r.isFat, r.unit)}</td><td style="text-align:center;">${formatDeltaPill(deltaBase, r.isFat, r.unit)}</td></tr>`;
    }).join('');

    const matrixTableHtml = `
      <div style="background:#111a2e; border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:16px; margin-bottom:20px; box-shadow:var(--shadow-card);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div style="font-size:14px; font-weight:800; color:#fff; display:flex; align-items:center; gap:6px;">
            <span>📊</span> <span>${isEn ? 'Comprehensive Body Measurements Comparison Matrix' : 'جدول جامع مقایسه و تغییرات ابعاد بدنی'}</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn-move-action" style="color:#38bdf8; border-color:rgba(56,189,248,0.4);" onclick="openAddBodyMetricModal('${current.id}')">${isEn ? '✏️ Edit This Record' : '✏️ ویرایش این رکورد'}</button>
            <button class="btn-move-action" style="color:#34d399; border-color:rgba(52,211,153,0.4);" onclick="openAddBodyMetricModal()">${isEn ? '➕ New Record' : '➕ رکورد جدید'}</button>
          </div>
        </div>

        <div class="table-container" style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
          <table class="metrics-matrix-table">
            <thead>
              <tr>
                <th>${isEn ? 'Biomarker / Measure' : 'گروه / شاخص'}</th>
                <th style="text-align:center;">${isEn ? `Baseline (${baseline.date})` : `نقطه شروع (${baseline.date})`}</th>
                <th style="text-align:center;">${isEn ? `Previous (${prev ? prev.date : '--'})` : `رکورد قبلی (${prev ? prev.date : '--'})`}</th>
                <th style="text-align:center; color:#00f2fe;">${isEn ? `Current (${current.date})` : `اندازه کنونی (${current.date})`}</th>
                <th style="text-align:center;">${isEn ? 'Change vs Prev (Δ Last)' : 'تغییر نسبت به قبل (Δ Last)'}</th>
                <th style="text-align:center;">${isEn ? 'Total Change (Δ Total)' : 'تغییر کل از شروع (Δ Total)'}</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    contentHtml = `
      ${headerHtml}
      ${heroGridHtml}
      ${geneticPotentialHtml}
      ${loveHandleBoxHtml}
      ${labReportBoxHtml}
      ${matrixTableHtml}
    `;
  }

  container.innerHTML = contentHtml;
} catch(err) {
  console.error('Error rendering body metrics view:', err);
  container.innerHTML = `
    <div class="metrics-empty-card">
      <div class="metrics-empty-icon">⚠️</div>
      <h3 style="font-size:17px; font-weight:900; color:#fff; margin-bottom:8px;">بارگذاری بخش آنالیز بدنی</h3>
      <p style="color:var(--text-muted); font-size:13px; max-width:440px; margin:0 auto 16px auto; line-height:1.6;">
        مشکلی در نمایش این بخش رخ داد، اما برنامه اصلی در حال کار است.
      </p>
      <button class="btn-header-action btn-action-primary" onclick="openAddBodyMetricModal()" style="font-size:13px; padding:8px 18px;">
        ➕ ثبت اندازه‌گیری جدید
      </button>
    </div>
  `;
}
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
      if (document.getElementById('metricAgeInput')) document.getElementById('metricAgeInput').value = item.age || '';
      document.getElementById('metricNeckInput').value = item.neck || '';
      document.getElementById('metricShouldersInput').value = item.shoulders || '';
      document.getElementById('metricChestInput').value = item.chest || '';
      document.getElementById('metricArmRightInput').value = item.armRight || '';
      if (document.getElementById('metricArmRightRelaxedInput')) document.getElementById('metricArmRightRelaxedInput').value = item.armRightRelaxed || '';
      document.getElementById('metricArmLeftInput').value = item.armLeft || '';
      if (document.getElementById('metricArmLeftRelaxedInput')) document.getElementById('metricArmLeftRelaxedInput').value = item.armLeftRelaxed || '';
      document.getElementById('metricWaistInput').value = item.waist || '';
      document.getElementById('metricAbdomenInput').value = item.abdomen || '';
      document.getElementById('metricLowerBellyInput').value = item.lowerBelly || '';
      document.getElementById('metricHipsInput').value = item.hips || '';
      document.getElementById('metricThighRightInput').value = item.thighRight || '';
      document.getElementById('metricThighLeftInput').value = item.thighLeft || '';
      document.getElementById('metricCalvesInput').value = item.calves || '';
      if (document.getElementById('metricWristInput')) document.getElementById('metricWristInput').value = item.wrist || '';
      if (document.getElementById('metricAnkleInput')) document.getElementById('metricAnkleInput').value = item.ankle || '';
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
    if (document.getElementById('metricAgeInput')) document.getElementById('metricAgeInput').value = last?.age || 35;
    document.getElementById('metricNeckInput').value = last?.neck || '';
    document.getElementById('metricShouldersInput').value = last?.shoulders || '';
    document.getElementById('metricChestInput').value = last?.chest || '';
    document.getElementById('metricArmRightInput').value = last?.armRight || '';
    if (document.getElementById('metricArmRightRelaxedInput')) document.getElementById('metricArmRightRelaxedInput').value = last?.armRightRelaxed || '';
    document.getElementById('metricArmLeftInput').value = last?.armLeft || '';
    if (document.getElementById('metricArmLeftRelaxedInput')) document.getElementById('metricArmLeftRelaxedInput').value = last?.armLeftRelaxed || '';
    document.getElementById('metricWaistInput').value = last?.waist || '';
    document.getElementById('metricAbdomenInput').value = last?.abdomen || '';
    document.getElementById('metricLowerBellyInput').value = last?.lowerBelly || '';
    document.getElementById('metricHipsInput').value = last?.hips || '';
    document.getElementById('metricThighRightInput').value = last?.thighRight || '';
    document.getElementById('metricThighLeftInput').value = last?.thighLeft || '';
    document.getElementById('metricCalvesInput').value = last?.calves || '';
    if (document.getElementById('metricWristInput')) document.getElementById('metricWristInput').value = last?.wrist || (prof.name.includes('مروارید') ? 15.5 : 18);
    if (document.getElementById('metricAnkleInput')) document.getElementById('metricAnkleInput').value = last?.ankle || (prof.name.includes('مروارید') ? 21 : 24);
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
    age: parseInt(document.getElementById('metricAgeInput')?.value) || 35,
    neck: parseFloat(document.getElementById('metricNeckInput').value) || 0,
    shoulders: parseFloat(document.getElementById('metricShouldersInput').value) || 0,
    chest: parseFloat(document.getElementById('metricChestInput').value) || 0,
    armRight: parseFloat(document.getElementById('metricArmRightInput').value) || 0,
    armRightRelaxed: parseFloat(document.getElementById('metricArmRightRelaxedInput')?.value) || 0,
    armLeft: parseFloat(document.getElementById('metricArmLeftInput').value) || 0,
    armLeftRelaxed: parseFloat(document.getElementById('metricArmLeftRelaxedInput')?.value) || 0,
    waist: parseFloat(document.getElementById('metricWaistInput').value) || 0,
    abdomen: parseFloat(document.getElementById('metricAbdomenInput').value) || 0,
    lowerBelly: parseFloat(document.getElementById('metricLowerBellyInput').value) || 0,
    hips: parseFloat(document.getElementById('metricHipsInput').value) || 0,
    thighRight: parseFloat(document.getElementById('metricThighRightInput').value) || 0,
    thighLeft: parseFloat(document.getElementById('metricThighLeftInput').value) || 0,
    calves: parseFloat(document.getElementById('metricCalvesInput').value) || 0,
    wrist: parseFloat(document.getElementById('metricWristInput')?.value) || 0,
    ankle: parseFloat(document.getElementById('metricAnkleInput')?.value) || 0,
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
  if (typeof pushMetricToSupabase === 'function') {
    pushMetricToSupabase(record);
  }
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

