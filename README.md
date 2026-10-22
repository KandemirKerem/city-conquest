# 🎲 Silgi Savaşları — 4 Kişilik Okul Sırası Strateji Oyunu

Okul sıralarında kağıt üstünde oynadığımız efsanevi silgi çevirme ve toprak fethetme oyununun **Three.js (React Three Fiber)**, **Rapier 3D Fizik Motoru**, **React (Vite + Tailwind CSS)** ve **Socket.io** ile geliştirilmiş modern web uyarlaması.

## ✨ Özellikler

- **Her Maç Benzersiz Kağıt Harita (`d3-delaunay` Voronoi):** Tıpkı boş kağıda rastgele eğimli çizgiler çekilmiş gibi her oyunda otomatik üretilen düzensiz bölgeler ve komşuluk (`neighbors`) sistemi.
- **6 Yüzlü (3W - 3L) 3D Fiziksel Silgi (`@react-three/rapier`):**
  - 1 Geniş Yüz **W**, 1 Geniş Yüz **L**
  - 1 Yan Yüz **W**, 1 Yan Yüz **L**
  - 1 Dik Yüz **W**, 1 Dik Yüz **L**
  - Boş toprağa hamle yapıldığında **"SİLGİ AT"** tuşuyla masaya fırlatılır; tüm oyuncularda senkronize şekilde aynı yüzde durur.
- **Taş - Kağıt - Makas Sınır Savaşı:** Rakip komşu toprağa saldırdığında canlı TKM düellosu başlar. Kazanırsan hedef toprağı alırsın, **kaybedersen saldırdığın sınır toprağını rakibe verirsin!**
- **CK3 Tarzı Dinamik Kamera + Mobil 2D Modu:**
  - **PC (3D Masa Modu):** Mouse tekerleği (Scroll) ile uzaklaştığında tam tepeden kuş bakışı kağıt harita görünümü, yaklaştığında ise açılı izometrik 3D masa görünümü.
  - **Mobil / Lite (2D Kağıt Modu):** Mobil tarayıcılarda otomatik devreye giren (veya üst menüden tek tuşla geçilebilen) sıfır kasmalı SVG kağıt harita ve 2D silgi animasyonu.
- **Lobi & Oda Sistemi:** 5 haneli oda koduyla hızlı katılım, davet linki kopyalama, şifreli/açık oda listesi ve tek başına test edebilmek için **🤖 Bot Ekleme** desteği.
- **Kazanma & İzleyici Modu:** Toprağı sıfırlanan oyuncu elenerek **İzleyici (Spectator)** moduna geçer. Haritanın **%80'ine** ulaşan veya sona kalan tek oyuncu oyunu kazanır.

## 🚀 Yerelde Çalıştırma

```bash
# Hem sunucuyu (Port 3001) hem istemciyi (Port 5173) aynı anda başlatır:
npm run dev
```

Tarayıcıdan `http://localhost:5173` adresine gidebilirsin.

## ☁️ Oracle Cloud Sunucusunda Yayına Alma

```bash
# 1. İstemci (React) üretim paketini derle:
npm run build

# 2. Sunucuyu başlat (Express hem API/Socket.io hem de derlenen React arayüzünü tek porttan sunar):
PORT=3001 npm start
```
