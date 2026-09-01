# Aegis AI — Progress Log

> **Ritual:** 09:00 → تسک‌های امروز + مبحث یادگیری | 21:00 → بازبینی (انجام‌شده / نشده + چرا + جمع‌بندی یادگیری)
> Evidence sources: `git log`, `pytest`, file inspection. Agent appends the verdict each evening.

---

## 2026-08-29 — Day 1 (Phase 0: Foundation)

### Learn
- [ ] Python packaging: pyproject.toml, uv, venv, entry points → **carry-over to 2026-08-30**

### Planned
- [ ] T0.1 Rename ContextForge → AegisAI → **carry-over to 2026-08-30**
- [ ] T0.2 Scaffold layout (db/services/schemas/policies/workers/tests) → **carry-over to 2026-08-30**

> **2026-08-29 (شنبه):** روز برنامه‌ریزی — Life OS + تخته + ROADMAP کامیت شد. کاربر تصمیم گرفت اجرای تسک‌ها از **2026-08-30** شروع شود، نه امروز. هیچ تسک build برای امروز انتظار نمی‌رود.
> **یادگیری:** قبل از شروع پروژه‌محور، ویدئوی ۱۲ ساعتهٔ FastAPI تمام شود (۳ ساعت مانده: JWT، Redis، دیتابیس). تسک‌های build پس از اتمام ویدئو فعال می‌شوند.

### Report (fill at end of day)
_(cron 21:01 — گزارشی از کاربر در این بازبینی ثبت نشد؛ در صورت ارسال گزارش، مرور صبح 2026-08-30 آن را تطبیق می‌دهد.)_

### Agent verdict (21:00) — بدون گزارش کاربر
| تسک | وضعیت | مدرک |
|---|---|---|
| Learn: Python packaging | شروع نشده (شیفت) | گیت ویدئوی ۱۲ ساعتهٔ FastAPI هنوز باز است؛ شواهد مطالعه‌ای ثبت نشده |
| T0.1 Rename ContextForge → AegisAI | انجام نشده (انتظار نمی‌رفت) | `pyproject.toml` هنوز `name = "contextforge"`؛ README «# ContextForge»؛ grep در `.env`، `.example.env`، `app/core/config.py` هنوز contextforge دارد |
| T0.2 Scaffold layout | انجام نشده (انتظار نمی‌رفت) | `app/` فقط `api/` و `core/` دارد؛ `db/ services/ schemas/ policies/ workers/` و `tests/` وجود ندارند |

- انتظار امروز طبق تصمیم خود کاربر «صفر تسک build» بود (کامیت‌های `7f14504` و `4ed058d`) → هیچ مغایرتی وجود ندارد.
- کار واقعی امروز: ۳ کامیت مستندسازی `d7109ae` (ROADMAP + task files + PROGRESS)، `7f14504` (شیفت Day 1 به 2026-08-30)، `4ed058d` (گیت ویدئو). `git status` تمیز.
- pytest/ruff اجرا نشد: `.venv` در مخزن وجود ندارد و `tests/` هنوز ساخته نشده — baseline سبز به T0.4 (فردا) موکول می‌شود.
- **جمع‌بندی یادگیری امروز:** بدون مبحث جدید — روز برنامه‌ریزی؛ فقط تعریف گیت «اتمام ویدئوی FastAPI قبل از build».
- **فردا (Day 1 اجرایی = 2026-08-30):** T0.1 + T0.2 + مبحث Python packaging (هر سه carry-over امروز) — شرط شروع build: اتمام ۳ ساعت باقی‌ماندهٔ ویدئو (JWT، Redis، DB).

---

## 2026-08-30 - Day 1

### Learn
- [ ] Python packaging: pyproject.toml، uv، venv، console entry points (carry-over از 2026-08-29) → **دوباره carry-over به 2026-08-31**

### Planned
- [ ] T0.1 Rename ContextForge → AegisAI → `docs/tasks/T0.1-rename-aegisai.md` (carry-over از 2026-08-29) → **carry-over به 2026-08-31**
- [ ] T0.2 Scaffold layout (db/services/schemas/policies/workers + tests) → `docs/tasks/T0.2-scaffold-layout.md` (carry-over از 2026-08-29) → **carry-over به 2026-08-31**

> شرط شروع build: اتمام ۳ ساعت باقی‌ماندهٔ ویدئوی FastAPI (JWT، Redis، DB).

### Report (fill at end of day)
**گزارش کاربر (ثبت 2026-08-31 00:53):** ویدئو آموزش حذف شده بود → ادامه ممکن نشد؛ تصمیم: یادگیری با پروژهٔ AegisAI جلو برود. مصاحبهٔ کاری امروز انجام شد. ECG: گزارش تکمیل و ارسال شد + جلسه برگزار شد. CO2: اصلاحات انجام شد، فردا نمایش به استاد. لینکدین: کامنت‌ها گذاشته شد. ادعا: rename برای AegisAI انجام شد.

### Agent verdict (21:00) — بدون گزارش کاربر
| تسک | وضعیت | مدرک |
|---|---|---|
| Learn: Python packaging | شروع نشده (شیفت دوم) | `learning.md` هنوز «۳ ساعت مانده» را ثبت دارد؛ هیچ شواهد مطالعه‌ای امروز دیده نشد |
| T0.1 Rename ContextForge → AegisAI | انجام نشده | `pyproject.toml` هنوز `name = "contextforge"`؛ README هنوز «# ContextForge»؛ grep هنوز در `.env`، `.example.env`، `app/core/config.py` نتایج دارد |
| T0.2 Scaffold layout | انجام نشده | `app/` فقط `api/` و `core/` دارد؛ `db/ services/ schemas/ policies/ workers/` و `tests/` وجود ندارند |

- تنها کامیت امروز: `36e2465` (10:48، مستندسازی مرور دیروز + برنامهٔ امروز). `git status` تمیز؛ هیچ کامیت کد یا تغییر فایل دیگری ثبت نشد.
- pytest/ruff قابل اجرا نبود: نه `.venv` در مخزن هست، نه `tests/` ساخته شده و pytest/ruff روی پایتون سیستم نصب نیستند — T0.4 همچنان باز.
- وضعیت گیت ویدئو: شواهدی از پیشرفت در ۳ ساعت باقی‌مانده (JWT، Redis، DB) ثبت نشد؛ شرط شروع build برقرار نبود، پس عدم اجرای تسک‌ها با گیت سازگار است اما Day 1 اجرایی کامل عقب افتاد.
- **فردا (2026-08-31 = Day 2):** اولویت اول carry-over — T0.1 + T0.2 + مبحث Python packaging؛ سپس در صورت جا شدن: T0.3/T0.4/T0.6 طبق برنامهٔ اصلی. اگر تسک‌ها دوباره انجام نشوند، طبق قاعدهٔ ROADMAP نیاز به re-scoping صریح دارند (blocked > 2 days).

### تطبیق گزارش کاربر (ثبت 2026-08-31 00:53)
| ادعای کاربر | حکم | مدرک |
|---|---|---|
| ویدئو حذف شده → یادگیری با پروژهٔ AegisAI | ✅ پذیرفته شد؛ گیت ویدئو لغو | ROADMAP به‌روز شد |
| مصاحبهٔ کاری | ✅ ثبت شد | گزارش کاربر (خارج از ریپو) |
| گزارش ECG تکمیل و ارسال شد + جلسه | ✅ تأیید با شواهد | تغییرات `E:/projs/ECG/tools/` (thesis/eq/mathtype) در 2026-08-30 |
| اصلاحات CO2 انجام شد؛ فردا به استاد | ✅ تأیید با شواهد | `outputs/main_paper_rev_02_*`، EndNote `.enl/.ris`، graphical abstract v2-v4 (2026-08-30) |
| کامنت‌های لینکدین | ✅ پذیرفته شد | گزارش کاربر (پلتفرم بیرونی) |
| rename AegisAI انجام شد | ❌ تأیید نشد | `grep -ci contextforge` در 00:53: README=2، pyproject.toml=1، config.py=1؛ `app/` اسکفولد نشده |

- **نتیجهٔ تطبیق:** T0.1 باز است (سومین روز) — شاید rename دیگری انجام شده (پوشه/پروفایل) ولی مدرک تسک، grep تمیز + کامیت است. T0.2 باز. Day 1 اجرایی به 2026-08-31 منتقل؛ اجرای نشدن دوباره = re-scope اجباری طبق قاعده.

### تکمیل دیرهنگام Day 1 (ثبت 2026-08-31 ~01:00) — کاربر اجرا کرد
| تسک | حکم | مدرک (00:55) |
|---|---|---|
| T0.1 Rename ContextForge → AegisAI | ✅ تأیید | `grep -ric contextforge` در README/pyproject/config.py/.env/.example.env = **صفر** |
| T0.2 Scaffold layout | ✅ تأیید | `app/db, services, schemas, policies, workers` + `tests/test_smoke.py` موجود |
| Push به GitHub | ✅ تأیید | `git ls-remote origin` = `da0d729` مطابق لوکال؛ remote: `GIGAParviz/AegisAi` |
| Learn: Python packaging | ◐ نیمه | pyproject/README ویرایش شده؛ ولی `.venv` نیست و `pydantic_settings` نصب نیست → import پروژه فعلاً fail است (T0.4) |

- **هشدار زنجیرهٔ شواهد:** تاریخ گیت از نو ساخته شده (تک‌کامیت `da0d729 initial project`) و `docs` موقتاً ignore شده بود — کامییت‌های قبلی (d7109ae…3d7a5a5) از تاریخ حذف شدند. محتوای PROGRESS/ROADMAP روی دیسک سالم است و از همین کامیت دوباره track می‌شود. قانون از این پس: **تاریخ گیت پروژه rewrite نمی‌شود** — شواهد ریتوال در همان تاریخ accumulate می‌شوند.
- جمع‌بندی: Day 1 اجرایی با تأخیر بسته شد. فردا (2026-08-31 = Day 2): T0.3 + T0.4 (venv با uv → pytest سبز → ruff) + T0.6 (CI) — دوباره روی schedule.

---

## 2026-08-31 - Day 2

### Learn
- [x] pytest essentials: fixtures, parametrize, monkeypatch; ruff — همراه با اجرای عملی T0.4 (نتیجهٔ واقعی: 3 passed + ruff clean)

### Planned
- [x] T0.3 Settings expansion + tests/test_config.py — **تأیید** (کامیت `30c2b04`)
- [x] T0.4 Green baseline — **تأیید** (کامیت `cec16fc`؛ `pytest -q` → 3 passed، `ruff check .` → clean، venv با uv)
- [ ] T0.6 CI workflow → carry-over به 2026-09-01

### Report (fill at end of day)
**گزارش کاربر (ثبت 2026-09-01 00:16):** تسک‌های AegisAI T0.3/T0.4 انجام شد. سناریو ویدئو اینستا برنامه‌ریزی شد. CO2 به استاد تحویل شد — انتظار بازخورد. ECG تمام شد و رفت («کاری دیگه نمونده و اوکی شد»). لینکدین: کامنت گذاشته شد.

### Agent verdict (21:00 → ثبت 00:16 با شواهد)
| تسک | وضعیت | مدرک |
|---|---|---|
| T0.3 Settings expansion | ✅ بسته شد | کامیت `30c2b04` + tests/test_config.py |
| T0.4 Green baseline | ✅ بسته شد | کامیت `cec16fc`؛ بازاجرای agent در 00:16: **3 passed** / ruff **clean** / `.venv` موجود |
| T0.6 CI workflow | ◐ باز | پوشهٔ `.github/workflows/` وجود ندارد |

- اجرای مسیر یادگیری «با دست» تأیید می‌شود: venv با uv ساخته شده و تست‌ها قابل بازاجرای مستقل‌اند — این دیگر اسناد نیست، baseline سبز است. 🟢
- جریان‌های غیر AegisAI (گزارش کاربر): سناریو ویدئو اینستا ✓ آماده، CO2 تحویل استاد ✓ در انتظار بازخورد، ECG بسته شد ✓، لینکدین کامنت ✓.
- **فردا (2026-09-01 = Day 3):** T0.5 (Docker Desktop) + T0.6 (CI) + مبحث Containers 101. نکتهٔ ظرفیت: روز نصب و راه‌اندازی است، فشار کمتر.
- **تسک‌های تازهٔ کاربر برای 2026-09-01 (خارج از AegisAI):** (۱) تست عملی کدهای LangChain — مدرک: یادداشت/نتیجهٔ اجرا، (۲) بررسی سناریوهای پست اینستا + آماده‌سازی و در صورت امکان ضبط ویدئو — مدرک: فایل ویدئو، (۳) خبر گرفتن از سلیمی دربارهٔ شرکت — مدرک: پیام/تماس. پست لینکدین از برنامهٔ نزدیک حذف شد (تصمیم کاربر)؛ لینکدین = فقط کامنت روزانه.

---

## 2026-09-01 - Day 3

### Learn
- [x] Containers 101: Docker Desktop/WSL2, images vs containers — مفهوم مطالعه شد (گزارش کاربر)؛ اجرا → مانده (verdict پایین)

### Planned
- [x] T0.6 CI workflow — **بسته شد**: `.github/workflows/ci.yml` روی ریموت (ruff + pytest، Python 3.11، `pip install -e ".[dev]"`)؛ اجرای GitHub Actions از API: **`CI | 4e47b23 | completed | success`**. ۱۰ کامیت از 2026-08-31 ظهر.
- [x] T0.5 Docker — **بسته شد (اصلاح حکم قبلی 2026-09-02)**: کاربر روشن کرد — Docker در دیستروی مجزای WSL به نام `DockerEngine` نصب است و با `wsl -d Dockerengine` اجرا می‌شود. تأیید agent: `wsl -d Dockerengine -- docker --version` → Docker 29.1.3؛ `docker run --rm hello-world` → موفق. (چرا اشتباه رد شد: من فقط PATH ویندوز/Ubuntu را چک کرده بودم.)
- [x] LangChain probe (تسک کاربر) — **انجام شد**: mini project در `E:\projs\AegisAI\my_tests\` (main, config, models, service, session)؛ نتیجهٔ کاربر: «خیلی خوبه». این مسیر عمداً gitignored است (`.gitignore` خطوط 10-11: `.my_tests/`, `my_tests/`) → شواهد = فایل‌های لوکال + گزارش کاربر.

### Report (fill at end of day)
**گزارش کاربر (ثبت 2026-09-02 02:15):** T0.5 و T0.6 انجام شد؛ CI در گیت‌هاب درست کار کرد. ویدئوی اینستا ضبط شد — ادیت مانده و ضبط ویس دردسر زیاد دارد → جستجوی روش سریع/کیفیت‌دار برای ادیت و انیمیشن. کامنت‌های لینکدین ✓. پیشنهاد مصاحبهٔ کاری: جلسهٔ جمعه **۴ سپتامبر** ساعت ۱۴:۳۰. LangChain تست شد و mini project ساخته شد. سلیمی: تماس گرفته شد → جلسهٔ پنج‌شنبه ۳ سپتامبر صبح در شرکت. باشگاه: روزهای زوج (شنبه/دوشنبه/چهارشنبه) ساعت ۱۹:۳۰. شروع برنامهٔ تولید محتوا و بازاریابی برای سایت خودش gymmim.ir.

### Agent verdict (ثبت 02:15 با شواهد)
| تسک | وضعیت | مدرک |
|---|---|---|
| T0.6 CI workflow | ✅ بسته شد | GitHub API: `CI on 4e47b23 → success`؛ لوکال HEAD = ریموت HEAD |
| T0.5 Docker Desktop | ❌ باز — نصب مجدد لازم | `docker.exe` یافت نشد (Program Files + WSL)؛ لاگ حذف/نصب قدیمی |
| LangChain probe | ✅ بسته شد | `my_tests/` موجود (gitignored عمدی) |

- پیوند یادگیری: نتیجهٔ LangChain probe («خیلی خوبه» + mini project) ورودی تصمیم مرحلهٔ ۲ یادگیری است — به `streams/learning.md` منتقل شد.
- ⚠️ از ثبتِ بازبینی ۲۱:۰۰ (کرون): `ruff check .` → 2 خطا در `my_tests/` (F401) — baseline سبز Day 2 شکسته شده؛ و `api_key` هاردکد در `my_tests/memory_mng.py`. **گام صبح Day 4: ruff fix در my_tests + انتقال api_key به `.env`** (قبل از هر کامیت). T0.5 هم سه‌روزه شده → نصب مجدد Docker فردا یا re-scope صریح.
- **فردا (2026-09-02 = Day 4):** اول: پاکسازی my_tests (ruff + key) → بعد T1.1/T1.2 (Learn: SQLAlchemy async) · ادیت ویدئو (خط تولید جدید) · آماده‌سازی جلسهٔ سلیمی (پنج‌شنبه صبح) · مصاحبهٔ جمعه ۴ سپتامبر ۱۴:۳۰ (تاریخ درست‌شده).
