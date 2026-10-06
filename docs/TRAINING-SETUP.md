# Kader Matrisi ücretli eğitim kurulumu

Bu dal satışa hazır değildir. Canlıya almadan aşağıdaki kurulum ve test kapıları tamamlanmalıdır. Mevcut analiz abonelikleri eğitim erişimi vermez. Aynı kursa sonradan eklenen yayımlanmış dersler, kursu satın alan hesaba otomatik açılır.

## Yapı

- `/egitimler/kader-matrisi.html`: Türkçe/İngilizce ders listesi, aynı Supabase hesabıyla giriş ve HTML5 oynatıcı.
- `GET /api/training`: yayımlanmış derslerin sırası; kimliği doğrulanmış kullanıcı için erişim durumu.
- `GET /api/training?lesson=UUID`: sunucuda doğrulanan oturum + paid eğitim siparişi varsa iki saatlik özel video bağlantısı.
- `POST /api/training-checkout`: giriş yapmış, e-postası doğrulanmış hesabı sunucuda saptar. İstemciden kullanıcı/ürün/fiyat kabul etmez. Siparişi Dodo metadata orderId ile eşleştirir.
- Mevcut imzası doğrulanan `/api/dodo-webhook` eğitim ödemelerini ayrı tablolara yönlendirir. Eski analiz ürünlerinin akışı korunur.
- İadeler ve açılan/kaybedilen/kabul edilen itirazlar erişimi kapatır. İade başarıdan önce gelse de sonraki bildirim tekrar açamaz. Kısmi iadede de eğitim erişimi kapanır; işletme politikası olarak onaylanmalıdır. Kazanılmış/kapanmış itiraz otomatik yeniden açmaz; kontrol sonrası yönetici kararı gerekir.

## Kurulum

1. Mevcut Supabase projesinde `supabase/migrations/20261005_training.sql` çalıştırılır. Yeni tablolar ve private `training-videos` bucket oluşturur. Mevcut tablolara/politikalara dokunmaz. Migration bir kez uygulanır.
2. Vercel'de mevcut SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_WEBHOOK_SECRET korunur. SUPABASE_ANON_KEY eklenir (mevcut sitenin public anon anahtarı). Gizli anahtarlar GitHub'a yazılmaz. SITE_URL üretimde `https://www.destinychartmatrix.com` olmalı. Test dağıtımında test anahtarları, `DODO_PAYMENTS_ENV=test_mode` ve test dönüş adresi kullanılır.
3. Supabase Auth e-posta doğrulaması ve site/dönüş URL'leri kontrol edilir. `storage.objects` üzerinde daha önceden tanımlanmış genel authenticated/anon okuma politikaları bu bucket'a erişim vermemeli. Bucket private durumu + anonim/oturumlu doğrudan indirme reddi ayrıca test edilir.
4. Kullanıcı fiyatı/para birimini onayladıktan sonra Dodo'da AYRI tek seferlik eğitim ürünü oluşturulur. Product ID training_courses.dodo_product_id alanına kaydedilir. Fiyatı tarayıcı değil Dodo yönetir. `sales_enabled=false` kurulum bitene kadar korunur. Dodo checkout son fiyatı ödeme öncesi gösterir.
5. Güncel videolar Saro sesleriyle Google Vids'ten alınır; iki mola çıkarılmıştır. Kaynak sırası: PDF 1–31 (74 sahne), 32–54 (69 sahne), 55–74 (60 sahne), 75–76 (4 sahne, güncel teşekkür). Kaynakların indirilmesi ve tek MP4'e birleştirilmesi HENÜZ yapılmadı. Konu sırası ve son güncel teşekkür kontrol edilir.
6. Özel bucket'a video yüklenir. Supabase planının dosya boyutu ve trafik kotası gerçek MP4 boyutuyla kontrol edilir; büyük dosyalar için TUS/resumable upload gerekir. Plan yetmezse kullanıcı onayıyla özel video barındırma hizmeti seçilir. Public GitHub'a video yüklenmez.
7. training_lessons: course_id=kader-matrisi, position=1, TR/EN başlık, duration_seconds, bucket içindeki storage_path; öncelikle published=false. Dosya doğrulandıktan sonra published=true. Sonraki dersler 2,3,... sıra numarasıyla eklenir; mevcut sırayı değiştirmeyin.
8. Dodo webhook aynı `/api/dodo-webhook` olmalı. payment.succeeded, refund.succeeded, dispute.opened/lost/accepted bildirimleri etkin olmalı. Mevcut bildirimler kapatılmaz.
9. Aşağıdaki canlı olmayan testler geçmeden sales_enabled=true yapılmaz.

## Yayın öncesi kontroller

- Oturumsuz/bozuk token/ödemesiz kullanıcı oynatma URL'si alamaz. Eski ownerKey/localStorage ve analiz aboneliği eğitim kilidini açamaz.
- İki test hesabından A satın alır; B erişemez. Kimliği istek gövdesinden değiştirerek satın alma bağlanamaz.
- Geçerli Dodo test ödemesi → imzalı webhook → paid order → doğru sıralı ders → tam Saro sesli oynatma. Dönüş URL'sindeki parametre tek başına erişim vermez.
- Aynı webhook tekrarı tek siparişi günceller. Yanlış ürün, geçersiz imza, başkasının payment_id'si reddedilir.
- İade/itiraz ve ters sırada gelen tekrar başarı bildirimleri erişimi geri açmaz. Verilmiş URL en fazla kalan iki saat boyunca çalışabilir; bu bearer URL paylaşılabilir, DRM değildir.
- Oturum kapatınca oynatıcı temizlenir. Başka hesapla açıldığında ders korumalıdır. Ödeme sonrası otomatik kontrol + elle tekrar kontrol çalışır.
- Telefon ve masaüstünde TR/EN, hata/boş liste/satış kapalı/giriş/satın alınmış haller test edilir.

## Bilinen kapsam sınırları

Kod ve birim testler canlı ödeme, canlı RLS ve video transferi kanıtı değildir. Eski analiz kilitlerinin tarayıcıdaki açıklıkları ayrı bir güvenlik çalışmasıdır; yeni kurs bunları yetki kaynağı olarak kullanmaz. Payoneer ödeme tahsilat/çekim paneli değiştirilmez. Yeni eğitimin vergisi/fiyatı/iade politikası işletme tarafından belirlenmelidir.
