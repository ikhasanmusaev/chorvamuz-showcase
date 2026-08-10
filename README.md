# Chorvam.uz — kod namunalari

*[Русская версия](README.ru.md)*

Chorvam.uz — O'zbekistondagi chorva bozori uchun platforma: Telegram Mini App va veb.
Mahsulot ishlab chiqilmoqda, kod bazasi yopiq. Bu yerda kichik tanlanma keltirilgan —
u **muhandislik masalalarini qanday hal qilishimizni** ko'rsatadi, nimani qurayotganimizni emas.

Uchta hikoya, har biri isbot bilan. Barcha parchalar — mahsulotdagi ishlaydigan kod.

```
npm install && npm test        # 15 ta test, ~2 soniya
```

---

## 1. Pul haqidagi bildirishnoma yo'qolishi mumkin emas

**Nima bo'lgan edi.** Tashqi yetkazish kanali ishlamay qoladi — xabar logga `warn`
darajasida yoziladi va shu bilan tamom. Odam o'z to'lovi haqida bildirishnoma olmaydi,
uni tiklashning esa iloji yo'q: logda bir qator, tizimda hech nima.

Xato kanalning ishlamay qolishida emas edi — u har doim ishdan chiqadi. Xato shundaki,
**log muvaffaqiyat haqida hisobot berardi**: kod istisnosiz ishlab tugadi, «yuborildi»
ko'rsatkichi o'sdi, odamga esa hech nima yetib bormadi.

**Nima qildik.** Holatga ega navbat: `PENDING → SENT | FAILED`, urinishlar soni,
oxirgi xatoning matni, keyingi urinish vaqti.

- [`src/reliable-delivery/outbox.entity.ts`](src/reliable-delivery/outbox.entity.ts) — model
- [`src/reliable-delivery/retry-policy.ts`](src/reliable-delivery/retry-policy.ts) — qachon takrorlash va qachon to'xtash
- [`src/reliable-delivery/retry-worker.ts`](src/reliable-delivery/retry-worker.ts) — jadval bo'yicha takrorlash

**E'tiborga loyiq ikkita yechim:**

Pauza ikki barobar o'sadi (1, 2, 4… daqiqa, eng ko'pi bir soat). Nosozlikning odatiy
sababi — qabul qiluvchi tomonning qayta ishga tushishi, bu bir necha soniya davom etadi:
birinchi takror tez bo'lishi kerak, toki odam hech narsani sezmasin. Ammo kanal jiddiy
ishdan chiqqan bo'lsa, uni har daqiqada urish — tiklanishiga xalaqit berish demakdir.

Sakkizta urinishdan so'ng yozuv `FAILED` holatiga o'tadi va **ko'rinib turaveradi**.
Taslim bo'lish mumkin, yo'qotish mumkin emas: aynan shu holat bo'yicha odam ko'radigan
«N ta yetkazilmadi» hisoboti quriladi.

**Isbot:** [`tests/retry-policy.spec.ts`](tests/retry-policy.spec.ts) — 7 ta test, shu
jumladan takrorlash tsikli taxminan ikki soatga sig'ishini tekshiruvchi test. Odamni
bundan uzoqroq xabarsiz qoldirib bo'lmaydi: undan keyin takror emas, tahlil kerak.

---

## 2. Odam o'z summasi o'zgarganini bank ko'chirmasidan bilmasligi kerak

**Nima bo'lgan edi.** Hisoblangan summalar bo'linmaydi: har biri — yopilgan bitim,
«bitimning yarmini» yechib bo'lmaydi. Shu sababli so'ralgan summa har doim ham aniq
to'planavermaydi.

348 090 000 mavjud bo'lganda 349 090 000 so'ralsa, tizim **jimgina kichikroq summaga
ariza yaratardi**. Ekran esa halol qilib «ariza qabul qilindi» deb yozardi — qabul
qilingani boshqa ariza edi. Hech nima ishdan chiqmasdi, loglarda hech qanday xato yo'q edi.

Alohida yoqimsiz jihati: yonginasida, eng kam summa tekshiruvida xuddi shu qoida to'g'ri
ishlardi — rad etardi va raqamlar bilan tushuntirardi. Bitta qoida, ikkita amalga oshirish,
turlicha xatti-harakat — bu biz o'zimizda bir necha marta uchratgan nuqson turi.

**Nima qildik.** Nomuvofiqlik endi yutib yuborilmaydi: ariza yo odam aytgan summaga
tuziladi, yo umuman tuzilmaydi — aynan qancha to'planishi va nima qilish kerakligi
tushuntirilgan holda.

- [`src/payouts/accrual-selection.ts`](src/payouts/accrual-selection.ts)

**Isbot:** [`tests/accrual-selection.spec.ts`](tests/accrual-selection.spec.ts) — 8 ta test,
shu jumladan o'sha 349 090 000 holati va rad javobida **ikkala** raqam — mavjud va
to'planadigan summa — borligini tekshirish. Odamga nima qilishni tushunish uchun bittasi
yetarli emas.

---

## 3. Serverning javobini emas, odam ko'rgan narsani tekshiramiz

API tekshiruvlari butunlay o'tkazib yuboradigan nuqsonlar:

- server `200 OK` javob beradi va bazada holatni o'zgartiradi, ekrandagi tugma esa
  faolsiz qolaveradi — API nuqtai nazaridan muvaffaqiyat, odam nuqtai nazaridan
  funksiya ishlamaydi;
- ikkita summa satr sifatida qo'shiladi va `550 000` o'rniga ekranda `300 000 250 000`
  paydo bo'ladi — na bitta istisno, na logda bitta yozuv;
- ro'yxat bo'sh, lekin ma'lumot yo'qligidan emas, yuklash ishdan chiqqanidan —
  bo'sh holat qulashni yashiradi.

**Freymvork qoidasi:** ishlayotganining isboti deb faqat ekranda ko'ringan narsa
hisoblanadi. API roppa-rosa ikki marta chaqiriladi — holatni **oldin** bilish va
fiksturalarni **keyin** tozalash uchun, — va hech qachon «ishlayapti» degan xulosa uchun emas.

- [`browser-checks/base.py`](browser-checks/base.py) — bosqichlar, qulaganda skrinshot
- [`browser-checks/helpers.py`](browser-checks/helpers.py) — CSS-klass bo'yicha emas, rol va yozuv bo'yicha qidiruv
- [`browser-checks/example_scenario.py`](browser-checks/example_scenario.py) — to'liq stsenariy

Qulagan bosqich stsenariyni to'xtatmaydi: bitta buzilgan tugma qolgan o'ntasining
holatini yashirmasligi kerak, aks holda har bir tekshiruv bittadan nuqson tuzatadi.

---

## Qo'shimcha: hozir qaysi build javob bermoqda

Ikki kun ichida testlash uch marta eski koddagi jarayonni tekshirdi, prodga esa hech kim
qayta yig'magan servis chiqib ketishiga oz qoldi. Ishlayotgan jarayonni keraklisidan
ajratishning imkoni yo'q edi: tashqaridan ikkalasi bir xil va bir xil ishonchli javob beradi.

`GET /health` commit, branch va yig'ilish vaqtini qaytaradi — har qanday tekshiruvning
birinchi so'rovi.

- [`src/build-identity/health.controller.ts`](src/build-identity/health.controller.ts)
- [`src/build-identity/write-build-info.js`](src/build-identity/write-build-info.js)

Butun ish shu nozik jihat uchun qilingan: ma'lumot build'dan **keyin** yoziladi va
uning yonida yotadi. Git'ni so'rov paytida o'qib bo'lmaydi — u holda `/health` ishchi
katalogdagi commit'ni ko'rsatardi, jarayon esa eski build'da ishlab turardi, ya'ni
aynan o'zi uchun yaratilgan holatda yolg'on gapirardi.

---

## Kod qayerdan olingan

Parchalar ishlaydigan mahsulotdan olingan. Faqat ikki xil narsa o'zgartirilgan:

1. **Yetkazish kanaliga bog'liq nomlar** (`telegramId` → `recipientId`) va ichki vazifa
   raqamlari — kodni bizning treker'imizsiz o'qish mumkin bo'lishi uchun.
2. **Takrorlash siyosati va hisoblanmalarni tanlash alohida modullarga ajratilgan.**
   Mahsulotda ular servislar ichida, baza tranzaksiyasi bilan birga yashaydi. Bu yerda
   infratuzilmadan ajratilgan — qoidani bazasiz va tarmoqsiz testlar bilan tekshirish
   mumkin bo'lsin deb. Mantiq va xato matnlari o'zgartirilmagan.

Hech nima «chiroyli ko'rinsin» deb qayta yozilmagan: koddagi izohlar mahsulotdagi bilan
bir xil, shu jumladan bu yechimlar o'sib chiqqan nuqsonlarning tavsifi ham.

## Bu yerda ataylab yo'q narsalar

- mahsulot asosidagi biznes-qoidalar va chegaralar;
- komissiya modeli va pulning ishtirokchilar o'rtasida taqsimlanishi;
- to'lov tizimlari bilan integratsiyalar;
- rollar va kirish huquqlari mantiqi;
- investitsiya qismi.

Bu tanlashdagi e'tiborsizlik emas: sanab o'tilganlar mahsulotning mohiyatini tashkil
qiladi va ochiq nashr etish uni butunlay berib yuborish degani bo'lardi. Bu modullarning
istalganini shaxsiy uchrashuvda ko'rsatishga tayyormiz.

## Litsenziya

Kod tanlov arizasi doirasida faqat tanishish uchun nashr etilgan. Barcha huquqlar
himoyalangan — [LICENSE](LICENSE) ga qarang.
