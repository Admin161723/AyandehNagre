// ========== متغیرهای موقت ==========
let tempPhone = '';
let tempCode = '';
let tempName = '';
let tempPass = '';
let tempAvatar = '';

// ========== رمزهای تأیید ==========
const MANAGER_PASS = 'amoz2026-shaki007-madars-modir';
const TEACHER_PASS = 'shaki007-2026-mfa';

// ========== شروع ==========
window.onload = function () {
  // ضد کپی/پیست/راست‌کلیک روی کد
  const codeInput = document.getElementById('code-input');
  ['paste', 'copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'].forEach(evt => {
    codeInput.addEventListener(evt, e => e.preventDefault());
  });
  codeInput.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 4);
  });

  const current = localStorage.getItem('currentUser');
  if (current) {
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    const user = users[current];
    if (user) {
      if (user.isManager) {
        loadManager(user);
        showScreen('manager');
      } else {
        loadMain(user);
        showScreen('main');
      }
      return;
    }
  }

  // لودینگ ۲ ثانیه
  setTimeout(() => {
    showScreen('login');
  }, 2000);
};

// ========== نمایش صفحه ==========
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

// ========== حرف اول اسم برای آواتار ==========
function initialOf(name) {
  if (!name) return '';
  const t = name.trim();
  return t ? t.charAt(0) : '';
}

// ========== ورود شماره ==========
function goLogin() {
  const phone = document.getElementById('phone').value.trim();
  const error = document.getElementById('error-phone');

  if (!/^09\d{9}$/.test(phone)) {
    error.style.display = 'block';
    error.textContent = 'شماره موبایل معتبر وارد کنید (۱۱ رقم با ۰۹)';
    return;
  }
  error.style.display = 'none';
  tempPhone = phone;

  const users = JSON.parse(localStorage.getItem('users') || '{}');

  if (users[phone]) {
    document.getElementById('phone-show').textContent = phone;
    showScreen('password');
  } else {
    // کاربر جدید → کد ۴ رقمی
    tempCode = Math.floor(1000 + Math.random() * 9000).toString();

    // نمایش کد داخل خود صفحه
    document.getElementById('code-display').textContent = tempCode;
    document.getElementById('code-input').value = '';
    document.getElementById('error-code').style.display = 'none';

    showScreen('verify');
  }
}

// ========== ورود با رمز ==========
function doLogin() {
  const pass = document.getElementById('password-input').value;
  const users = JSON.parse(localStorage.getItem('users') || '{}');
  const error = document.getElementById('error-password');

  if (users[tempPhone] && users[tempPhone].password === pass) {
    localStorage.setItem('currentUser', tempPhone);
    const user = users[tempPhone];
    if (user.isManager) {
      loadManager(user);
      showScreen('manager');
    } else {
      loadMain(user);
      showScreen('main');
    }
  } else {
    error.style.display = 'block';
    error.textContent = 'رمز عبور اشتباه است';
  }
}

// ========== تأیید کد ==========
function verifyCode() {
  const code = document.getElementById('code-input').value.trim();
  const error = document.getElementById('error-code');

  if (code === tempCode) {
    showScreen('profile');
  } else {
    error.style.display = 'block';
    error.textContent = 'کد وارد شده اشتباه است';
  }
}

// ========== پیش‌نمایش آواتار ==========
function previewAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (ev) {
    tempAvatar = ev.target.result;
    const av = document.getElementById('avatar-preview');
    av.style.backgroundImage = `url(${tempAvatar})`;
    av.innerHTML = '';
  };
  reader.readAsDataURL(file);
}

// ========== ذخیره پروفایل ==========
function saveProfile() {
  const name = document.getElementById('name-input').value.trim();
  const pass1 = document.getElementById('pass1').value;
  const pass2 = document.getElementById('pass2').value;
  const error = document.getElementById('error-profile');

  if (!name) {
    error.style.display = 'block';
    error.textContent = 'نام را وارد کنید';
    return;
  }
  if (pass1.length < 6) {
    error.style.display = 'block';
    error.textContent = 'رمز عبور حداقل ۶ کاراکتر باشد';
    return;
  }
  if (pass1 !== pass2) {
    error.style.display = 'block';
    error.textContent = 'رمز عبور و تکرار آن یکسان نیست';
    return;
  }

  tempName = name;
  tempPass = pass1;
  error.style.display = 'none';
  showScreen('school');
}

// ========== تیک مدیر ==========
function toggleManager() {
  const checked = document.getElementById('is-manager').checked;
  document.getElementById('manager-box').style.display = checked ? 'block' : 'none';
}

// ========== تیک معلم ==========
function toggleTeacher() {
  const checked = document.getElementById('is-teacher').checked;
  document.getElementById('teacher-box').style.display = checked ? 'block' : 'none';
}

// ========== ثبت‌نام نهایی ==========
function finishRegister() {
  const province = document.getElementById('province').value.trim();
  const school = document.getElementById('school').value.trim();
  const grade = document.getElementById('grade').value.trim();

  const isManager = document.getElementById('is-manager').checked;
  const isTeacher = document.getElementById('is-teacher').checked;

  const managerPass = document.getElementById('manager-pass').value.trim();
  const teacherPass = document.getElementById('teacher-pass').value.trim();

  const error = document.getElementById('error-school');
  error.style.display = 'none';

  if (isManager && managerPass !== MANAGER_PASS) {
    error.style.display = 'block';
    error.textContent = 'رمز مدیر اشتباه است';
    return;
  }

  if (isTeacher && teacherPass !== TEACHER_PASS) {
    error.style.display = 'block';
    error.textContent = 'رمز معلم اشتباه است';
    return;
  }

  // اگر معلم تأییدشده باشد، نیازی به اطلاعات مدرسه نیست
  const schoolRequired = !isTeacher || isManager;

  if (schoolRequired && (!province || !school || !grade)) {
    error.style.display = 'block';
    error.textContent = 'همه فیلدها را پر کنید';
    return;
  }

  const users = JSON.parse(localStorage.getItem('users') || '{}');
  users[tempPhone] = {
    name: tempName,
    password: tempPass,
    avatar: tempAvatar || '',
    province: province,
    school: school,
    grade: grade,
    isManager: isManager,
    isTeacher: isTeacher
  };

  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('currentUser', tempPhone);

  if (isManager) {
    loadManager(users[tempPhone]);
    showScreen('manager');
  } else {
    loadMain(users[tempPhone]);
    showScreen('main');
  }
}

// ========== بارگذاری صفحه اصلی ==========
function loadMain(user) {
  document.getElementById('main-name').textContent = user.name || 'کاربر';

  const parts = [];
  if (user.isTeacher) parts.push('معلم');
  if (user.school) parts.push(user.school);
  if (user.grade) parts.push(user.grade);
  document.getElementById('main-info').textContent = parts.join(' | ') || 'آموزیار';

  const av = document.getElementById('main-avatar');
  if (user.avatar) {
    av.style.backgroundImage = `url(${user.avatar})`;
    av.textContent = '';
  } else {
    av.style.backgroundImage = '';
    av.textContent = initialOf(user.name);
  }
}

// ========== بارگذاری پنل مدیر ==========
function loadManager(user) {
  document.getElementById('manager-name').textContent = user.name || 'مدیر';
  document.getElementById('manager-info').textContent =
    (user.school || '') + (user.province ? ' | ' + user.province : '');

  const av = document.getElementById('manager-avatar');
  if (user.avatar) {
    av.style.backgroundImage = `url(${user.avatar})`;
    av.textContent = '';
  } else {
    av.style.backgroundImage = '';
    av.textContent = initialOf(user.name);
  }
}

// ========== خروج ==========
function logout() {
  localStorage.removeItem('currentUser');

  document.getElementById('phone').value = '';
  document.getElementById('password-input').value = '';
  document.getElementById('code-input').value = '';
  document.getElementById('name-input').value = '';
  document.getElementById('pass1').value = '';
  document.getElementById('pass2').value = '';
  document.getElementById('province').value = '';
  document.getElementById('school').value = '';
  document.getElementById('grade').value = '';

  document.getElementById('is-manager').checked = false;
  document.getElementById('manager-pass').value = '';
  document.getElementById('manager-box').style.display = 'none';

  document.getElementById('is-teacher').checked = false;
  document.getElementById('teacher-pass').value = '';
  document.getElementById('teacher-box').style.display = 'none';

  document.getElementById('code-display').textContent = '----';

  const av = document.getElementById('avatar-preview');
  av.style.backgroundImage = '';
  av.innerHTML = '<span>انتخاب عکس</span>';

  tempPhone = '';
  tempCode = '';
  tempName = '';
  tempPass = '';
  tempAvatar = '';

  showScreen('login');
}