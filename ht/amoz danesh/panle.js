let pendingManager = null;

window.onload = function () {
  const raw = localStorage.getItem('pendingManager');
  if (!raw) {
    window.location.href = 'index.html';
    return;
  }
  pendingManager = JSON.parse(raw);

  document.getElementById('pm-phone').value = pendingManager.phone || '';
  document.getElementById('pm-name').value = pendingManager.name || '';

  const nidInput = document.getElementById('national-id');
  nidInput.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
  });

  const phoneInput = document.getElementById('pm-phone');
  phoneInput.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 11);
  });
};

async function submitManagerPanel() {
  const nationalId = document.getElementById('national-id').value.trim();
  const phone = document.getElementById('pm-phone').value.trim();
  const name = document.getElementById('pm-name').value.trim();
  const province = document.getElementById('pm-province').value.trim();
  const city = document.getElementById('pm-city').value.trim();
  const school = document.getElementById('pm-school').value.trim();
  const district = document.getElementById('pm-district').value.trim();

  const error = document.getElementById('error-panel');
  const btn = document.getElementById('btn-panel');
  error.style.display = 'none';

  if (!/^\d{10}$/.test(nationalId)) {
    error.style.display = 'block';
    error.textContent = 'کد ملی باید ۱۰ رقم باشد';
    return;
  }
  if (!/^09\d{9}$/.test(phone)) {
    error.style.display = 'block';
    error.textContent = 'شماره موبایل معتبر وارد کنید';
    return;
  }
  if (!name) {
    error.style.display = 'block';
    error.textContent = 'نام و نام خانوادگی را وارد کنید';
    return;
  }
  if (!province || !city || !school || !district) {
    error.style.display = 'block';
    error.textContent = 'همه فیلدها را پر کنید';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'در حال ذخیره...';

  try {
    const phoneChanged = phone !== pendingManager.phone;
    if (phoneChanged) {
      const existing = await getUser(phone);
      if (existing) {
        error.style.display = 'block';
        error.textContent = 'این شماره قبلاً ثبت‌نام کرده';
        btn.disabled = false;
        btn.textContent = 'تأیید و ورود';
        return;
      }
    }

    const user = {
      name: name,
      password: pendingManager.password,
      avatar: pendingManager.avatar || '',
      nationalId: nationalId,
      phone: phone,
      province: province,
      city: city,
      school: school,
      district: district,
      grade: '',
      isManager: true,
      isTeacher: pendingManager.isTeacher || false,
      role: 'user',
      createdAt: pendingManager.createdAt || Date.now()
    };

    await saveUser(phone, user);

    if (phoneChanged && pendingManager.phone) {
      await deleteUser(pendingManager.phone);
    }

    localStorage.setItem('currentUser', phone);
    localStorage.removeItem('pendingManager');
    window.location.href = 'amoz.html';
  } catch (e) {
    error.style.display = 'block';
    error.textContent = 'خطا در ذخیره اطلاعات';
    console.error(e);
    btn.disabled = false;
    btn.textContent = 'تأیید و ورود';
  }
}