# OsmChassis - Kafe Kasa Sistemi

OsmChassis, kafeler için geliştirilmiş modern ve kullanıcı dostu bir kasa yönetim sistemidir. Masaları, siparişleri, ödemeleri ve stok durumunu kolayca yönetmenizi sağlar.

## Özellikler

### 1. Sipariş Yönetimi
- Masa bazlı sipariş oluşturma
- Kategorilere göre ürün filtreleme
- Anlık sipariş takibi
- Sipariş düzenleme ve güncelleme
- Masa durumu görüntüleme

### 2. Ödeme İşlemleri
- Kasiyer bazlı ödeme alma
- Masa hesabı kapatma
- Ödeme geçmişi takibi
- Kasiyer performans takibi

### 3. Ürün ve Stok Yönetimi
- Kategorili ürün ekleme
- Ürün resmi yükleme
- Stok takibi
- Stok uyarı sistemi
- Ürün silme ve güncelleme

### 4. Masa Yönetimi
- Yeni masa ekleme
- Masa durumu takibi (Boş/Dolu)
- Masa silme
- Masa bazlı sipariş geçmişi

### 5. Raporlama ve İstatistikler
- Günlük, haftalık, aylık ve yıllık satış raporları
- Grafiksel satış analizi
- En çok satan ürünler
- Kasiyer bazlı satış raporları
- Detaylı sipariş geçmişi

### 6. Sistem Ayarları
- İşletme bilgileri yönetimi
- Vergi ayarları
- Veritabanı yedekleme
- Sistem temizleme

## Teknolojiler

- HTML5, CSS3, JavaScript
- Bootstrap 5
- Chart.js (Grafikler için)
- NeDB (Veritabanı)
- Electron (Desktop uygulama)

## Kurulum

1. Projeyi klonlayın:
```bash
git clone https://github.com/yourusername/osmChassis.git
```

2. Proje dizinine gidin:
```bash
cd osmChassis
```

3. Gerekli paketleri yükleyin:
```bash
npm install
```

4. Uygulamayı başlatın:
```bash
npm start
```

## Kullanım

### Sipariş Oluşturma
1. "Sipariş Oluştur" sayfasına gidin
2. Sol panelden bir masa seçin
3. Orta panelden ürünleri seçin
4. Sağ panelden kategorileri filtreleyebilirsiniz
5. Alt panelde sipariş detaylarını görüntüleyin

### Ödeme Alma
1. "Ödeme" sayfasına gidin
2. Kasiyer seçimi yapın
3. Dolu masaları görüntüleyin
4. İlgili masanın ödemesini alın

### Ürün/Masa Ekleme
1. "Ekle ve Kaldır" sayfasına gidin
2. Yeni ürün eklemek için formu doldurun
3. Ürün resmi yükleyin
4. Yeni masa eklemek için masa numarası girin

### Raporları Görüntüleme
1. "Özet" sayfasına gidin
2. Zaman aralığını seçin (Günlük/Haftalık/Aylık/Yıllık)
3. Satış grafiklerini ve istatistikleri inceleyin

## Veritabanı Yapısı

Sistem dört ana veritabanı kullanır:
- `products.db`: Ürün bilgileri
- `orders.db`: Sipariş kayıtları
- `tables.db`: Masa bilgileri
- `settings.db`: Sistem ayarları

## Güvenlik

- Silme işlemleri için onay gerektirir
- Dolu masalar silinemez
- Stok kontrolü otomatik yapılır
- Veri kaybını önlemek için yedekleme sistemi mevcuttur

## Katkıda Bulunma

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.

## İletişim

Proje Sahibi - [@Yusuf-Osmanoglu](https://github.com/Yusuf-Osmanoglu)

Proje Linki: [https://github.com/Yusuf-Osmanoglu/osmChassis](https://github.com/Yusuf-Osmanoglu/osmChassis) 