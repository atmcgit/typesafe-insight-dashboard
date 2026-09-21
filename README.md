# TypeSafe Insight Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

TypeSafe Insight Dashboard, sosyal medya gönderilerini yalnızca anahtar kelime eşleşmesine göre değil, anahtar kelimenin **hangi anlamda ve bağlamda kullanıldığına** göre değerlendiren, açık kaynak bir semantik analiz arayüzüdür.

Kendi [TypeSafe](https://typesafe.ai) API anahtarınızla birkaç dakikada kurup çalıştırabilirsiniz — kod değişikliği veya "Mavi" örneğine bağlı kalma zorunluluğu yok, herhangi bir marka, ürün veya kişi adı için kullanılabilir.

Projenin temel amacı, bir anahtar kelimeyle bulunan sosyal medya gönderilerinin gerçekten hedeflenen konuyla ilgili olup olmadığını JEV AI kullanarak doğrulamaktır. Böylece aynı yazılışa sahip fakat farklı anlamlarda kullanılan kelimeler birbirinden ayrılabilir.

Örneğin `Mavi` anahtar kelimesi için sistem:

- “Mavi yeni sezon koleksiyonunu tanıttı.” gönderisini **marka**,
- “Gökyüzü bugün çok mavi.” gönderisini **renk**,
- hedeflenen anlamı açıkça taşımayan bir gönderiyi **alakasız**

olarak sınıflandırabilir.

## Neden bu proje var?

Geleneksel anahtar kelime araması, kelimenin metinde geçip geçmediğini bulur; ancak kelimenin hangi anlamda kullanıldığını anlayamaz. Bu durum sosyal medya dinleme, marka takibi ve kampanya analizi sırasında çok sayıda hatalı sonuç üretebilir.

Bu proje, bulunan her gönderiyi JEV AI ile ayrıca değerlendirerek şu soruya cevap verir:

> Gönderide geçen anahtar kelimenin bağlamı, aradığımız anahtar kelime anlamıyla aynı mı?

## Özellikler

- Anahtar kelime ve sosyal medya gönderilerini JSON olarak düzenleme
- Arayüz üzerinden hızlıca yeni gönderi ekleme
- Her gönderi için bağımsız semantik değerlendirme
- Anahtar kelime kullanımını `relevant`, `irrelevant` veya `uncertain` olarak sınıflandırma
- Hedef anlamı, dahil edilecek bağlamları ve hariç tutulacak anlamları arayüzden tanımlama
- Sınıflandırma güven oranını gösterme
- Bağlamın ne kadar açık olduğunu skorla ölçme
- Sonuçları işlem süresi ve kaynak bilgisiyle listeleme
- Toplam ve gönderi başına ortalama değerlendirme süresini gösterme
- Sonuçları sayfalama
- API anahtarını tarayıcıya göndermeden yerel Vite proxy üzerinden kullanma

## Nasıl çalışır?

1. Kullanıcı bir `keyword`, hedef anlamı açıklayan `targetContext` ve analiz edilecek `posts` listesini girer.
2. Uygulama her gönderi için iki JEV AI değerlendirme sorusu oluşturur:
   - Anahtar kelime bu gönderide hangi anlamı ifade ediyor?
   - Gönderi bu anlamı ne kadar açık biçimde ortaya koyuyor?
3. İstek, `/api/typesafe` yerel proxy uç noktasına gönderilir.
4. Proxy, isteği API anahtarıyla TypeSafe API'ye iletir. Varsayılan model `jev-latest` modelidir.
5. Dönen cevaplar sınıf, güven yüzdesi ve bağlam gücü skoru olarak arayüzde gösterilir.

Başlangıç örneği `Mavi` kelimesinin giyim markası anlamını diğer kullanımlardan ayırır. Kullanıcı arayüzdeki hedef anlam ve bağlam alanlarını değiştirerek aynı sistemi farklı keyword'ler için kullanabilir. JEV soruları [src/typesafeClient.js](src/typesafeClient.js) içindeki `buildTypesafeQuestions` fonksiyonu tarafından bu girdilerden dinamik oluşturulur.

## Kullanılan teknolojiler

- React 18
- Vite 6
- Material UI
- Framer Motion
- Tabler Icons
- JEV AI / TypeSafe API

## Kurulum

Gereksinimler:

- Node.js 18 veya üzeri
- npm
- TypeSafe API anahtarı

Projeyi kurmak için:

```bash
npm install
```

Proje kökünde bir `.env` dosyası oluşturun:

```env
TYPESAFE_API_KEY=api_anahtariniz

# İsteğe bağlı ayarlar
VITE_TYPESAFE_MODEL=jev-latest
VITE_TYPESAFE_API_URL=https://api.typesafe.ai/v1/systemone
```

Geliştirme sunucusunu başlatın:

```bash
npm run dev
```

Ardından terminalde gösterilen yerel adresi tarayıcıda açın.

> Güvenlik notu: API anahtarını kaynak koda eklemeyin ve repoya göndermeyin. Sunucu tarafındaki proxy tarafından okunması için `TYPESAFE_API_KEY` değişkenini kullanın.

## Veri formatı

Uygulamanın beklediği temel giriş yapısı şöyledir:

```json
{
  "keyword": "Mavi",
  "targetContext": {
    "label": "Mavi giyim markası",
    "description": "Mavi adlı giyim ve denim markası; markanın ürünleri, mağazaları, kampanyaları ve şirket faaliyetleri.",
    "include": [
      "Mavi mağazaları",
      "Mavi ürünleri ve koleksiyonları",
      "Mavi reklamları ve kampanyaları"
    ],
    "exclude": [
      "Mavi renk",
      "Gökyüzü veya deniz",
      "Bir eşyanın rengi"
    ]
  },
  "posts": [
    {
      "postId": "mavi-001",
      "content": "Mavi, yeni sezon denim koleksiyonunu tanıttı.",
      "platform": "X",
      "username": "modahaberleri"
    },
    {
      "postId": "mavi-002",
      "content": "Gökyüzü bugün çok mavi.",
      "platform": "Instagram",
      "username": "gezi_notlarim"
    }
  ]
}
```

Zorunlu alanlar:

- `keyword`: Anlamı incelenecek anahtar kelime
- `targetContext.label`: Aranan anlamın kısa adı
- `targetContext.description`: JEV'in esas alacağı hedef anlam açıklaması
- `targetContext.include`: Hedef anlamı destekleyen bağlam ve sinyaller
- `targetContext.exclude`: Aynı kelimenin hariç tutulacak farklı anlamları
- `posts`: Değerlendirilecek gönderiler dizisi
- `postId`: Her gönderi için benzersiz kimlik
- `content`: Gönderi metni

`platform` ve `username` gibi ek alanlar isteğe bağlıdır ve state içinde korunur.

## Sonuçların anlamı

Her gönderi için aşağıdaki bilgiler üretilir:

| Alan | Açıklama |
| --- | --- |
| `choice` | Anahtar kelimenin belirlenen anlam sınıfı |
| `confidence` | Seçilen sınıfa ait güven yüzdesi |
| `probabilities` | Tüm sınıfların olasılık dağılımı |
| `score` | Bağlamın anlamı ne kadar açık ortaya koyduğu |
| `elapsedMs` | Değerlendirme süresi |
| `source` | Sonucun API veya demo değerlendirmesinden geldiği bilgisi |

Mevcut sınıflar:

| Sınıf | Anlamı |
| --- | --- |
| `relevant` | Anahtar kelime kullanıcının tanımladığı hedef anlam ve bağlamla eşleşmektedir. |
| `irrelevant` | Anahtar kelime farklı bir anlamda kullanılmış veya gönderi hedef bağlamla ilgisizdir. |
| `uncertain` | Gönderide güvenilir bir karar vermek için yeterli bağlam bulunmamaktadır. |

## Komutlar

```bash
npm run dev      # Geliştirme sunucusunu başlatır
npm run build    # Üretim paketini oluşturur
npm run preview  # Oluşturulan paketi yerelde önizler
```

## Proje yapısı

```text
src/
├── App.jsx                 # Ana uygulama bileşeni
├── TypeSafeDashboard.jsx   # Dashboard, giriş alanları ve sonuç ekranı
├── typesafeClient.js       # JEV AI soruları, API isteği ve cevap dönüşümü
├── main.jsx                # React ve tema başlangıç noktası
└── styles.css              # Uygulama stilleri

vite.config.js              # Vite yapılandırması ve yerel API proxy'si
```

## Özelleştirme

Yeni bir keyword için kod değişikliği gerekmez. Arayüzden hedef anlamın adı, açıklaması, dahil edilecek bağlamlar ve hariç tutulacak anlamlar girildiğinde değerlendirme şablonu otomatik güncellenir.

Sonuç sınıflarının kendisi değiştirilmek istenirse `buildTypesafeQuestions` içindeki `criteria` ile arayüzdeki `COLORS` ve `LABELS` eşlemeleri birlikte güncellenmelidir.

## Üretim ortamı notu (Vercel)

`api/typesafe.js`, geliştirmedeki Vite proxy'sinin üretim karşılığıdır — Vercel'e
deploy edildiğinde otomatik olarak serverless function'a dönüşür, kod
değişikliği gerekmez.

Vercel projesinde **Settings → Environment Variables** altında:

- `TYPESAFE_API_KEY` — zorunlu, TypeSafe API anahtarınız (yalnızca sunucu tarafında okunur, istemciye hiç gönderilmez)
- `TYPESAFE_API_URL` — isteğe bağlı, varsayılan `https://api.typesafe.ai/v1/systemone`

`.env` dosyasındaki `VITE_TYPESAFE_API_KEY` yalnızca yerel geliştirme
sunucusu içindir; Vercel'e **kesinlikle commit edilmemeli** ve Vercel'in kendi
ortam değişkeni panelinden ayrıca `TYPESAFE_API_KEY` girilmelidir.

## Katkıda bulunma

Pull request'ler ve issue'lar memnuniyetle karşılanır. Fikir: yeni bir sonuç
sınıfı, farklı bir LLM sağlayıcısı desteği, çoklu dil desteği ya da UI
iyileştirmeleri. Büyük bir değişiklik öncesi bir issue açıp tartışmak
tekrar eden işi önler.

## Lisans

[MIT](LICENSE) — dilediğiniz gibi kullanın, değiştirin, dağıtın.
