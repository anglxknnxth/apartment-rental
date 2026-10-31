# Rent Receipt Generator

Gumagawa ng **Apartment Rental Acknowledgement Receipt** (JPEG o PDF) para sa bawat tenant, gamit ang data sa Google Sheet.

## Paano buksan

I-double-click ang **`Buksan Resibo.bat`**.

- May lalabas na itim na window. **Huwag itong isara** habang ginagamit ang page, kasi ito ang nagpapatakbo ng page. Isara lang ito kapag tapos ka na.
- Kusang bubukas ang browser sa `http://localhost:8765/index.html`. Kung may gamit na ang port 8765, susubukan nito ang 8766, 8767, at iba pa.

> Huwag i-double-click ang `index.html` mismo. Hinaharang ng Google ang pagkuha ng data kapag binuksan bilang file (`file://`).

## Ano ang nangyayari pagbukas (startup)

1. **`Buksan Resibo.bat`** → pinapatakbo ang **`serve.ps1`** (PowerShell lang ang gamit, walang kailangang i-install).
2. **`serve.ps1`**:
   - Nagbubukas ng local server sa `http://localhost:<port>/`. Ang computer mo lang ang may access.
   - Nagbibigay lang ng mga file na nasa loob ng Rent folder.
   - May `GET /__version` (pinakabagong oras ng pagbabago ng `.html`/`.js`/`.css`/`.ico`). Tinitingnan ito ng page bawat 2 segundo, at **kusang nagre-reload ang page kapag may bagong code**, habang ibinabalik ang napiling tenant, buwan at tab.
   - Tumatanggap ng `POST /save` para i-save ang JPEG o PDF sa `Rent/<pangalan ng tenant>/` (tingnan sa ibaba).
   - Binubuksan ang browser.
3. **`index.html`** pagka-load:
   - Kinukuha ang published na `.xlsx` mula sa Google Sheet (`SHEET_URL` sa simula ng script).
   - Ipinapakita sa toast kapag na-update ang data (o kapag may error), at pinupuno ang Tenant dropdown. Alphabetical ito, at nakahiwalay ang **Active** at **Archived**.
   - Kung ang URL ay may `#dashboard` o `#highlights`, ang tab na iyon ang unang bubukas.

## Mga tab

### Receipt
1. Pumili ng **Tenant**. Kusang lalabas ang resibo ng **pinakabagong buwan** na may Total Amount.
2. Puwedeng pumili ng ibang buwan sa **Buwan** dropdown, o i-click ang row sa **Preview** (pinakabago ang nasa itaas). Buod ang default ng Preview: Date, Rent, Kuryente, Tubig, Internet at Total ng 12 pinakabagong buwan. I-click ang **See more** (katabi ng Export PDF) para makita ang lahat ng column at buwan, at **See less** para bumalik.
3. Sa itaas ng resibo:
   - **Download as JPEG**: sine-save sa `Rent/<tenant>/<Tenant_Name>-<MONTH>_<YEAR>.jpeg`. Ginagawa ang folder kung wala pa, at laging **pinapalitan** ang lumang file (walang "(1)").
   - **Copy**: kinokopya ang resibo bilang image, para ma-paste (Ctrl+V) sa Messenger o Viber.
4. Sa Preview, ang **Export PDF** ay gumagawa ng iisang PDF ng lahat ng buwan ng tenant, 4 na resibo bawat page. Sine-save ito sa `Rent/<tenant>/<Tenant_Name>-Receipts.pdf`.
5. Para makuha ang pinakabagong data mula sa Google Sheet, i-reload ang page (F5).

Sa screen, pinaliliit ang resibo para kasya sa window, pero buong laki pa rin ang JPEG at PDF.

### Dashboard
- Kabuuan ng **lahat ng tenant** para sa isang buwan: Rent, Tubig, Kuryente, Internet/Others at **Total**.
- **Paalala sa itaas ng mga tile:** nagsimula ang paupahan noong March 2023, pero mula January 2024 lang ang data sa sheet (wala ang data nina Aling Shirley, Katrina Mendoza at Marielle Domil). Nasa `BUSINESS_START` at `MISSING_TENANTS` sa simula ng `dashboard.js` ang mga ito.
- **Buwan dropdown:** ang kasalukuyang buwan ang default. Piliin ang **ALL (lahat ng buwan)** para makita ang overall: kabuuan ng lahat ng buwan sa tiles, donut, bawat kwarto at table (may "Ilang buwan" bawat tenant), at lahat ng buwan sa mga graph. Sa ALL, bubuksan ng row sa table ang pinakabagong resibo ng tenant.
- **Mga graph**, nakahati sa 3 seksyon. Ang mga may buwan sa ilalim ay 2 taon (24 buwan) hanggang sa napiling buwan, o lahat ng buwan kapag ALL. Ipinapakita ang eksaktong halaga kapag tinapatan ng mouse, at sa mga column chart, i-click ang column para piliin ang buwang iyon.
  - **Koleksyon:** kabuuang koleksyon bawat buwan · breakdown ng singil (donut chart: Rent, Tubig, Kuryente, Internet/Others, may halaga at %) · ngayong taon vs nakaraang taon (grouped columns, Jan–Dec, may YTD at % pagbabago) · average na bill bawat tenant (columns)
  - **Mga kwarto (Y1 ng tab):** koleksyon ng bawat kwarto sa napiling buwan (kasama kung sino ang nakatira, o kung bakante) · occupancy (ilang kwarto ang may nakatira; kasama ang tenant na may row kahit wala pang Total) · koleksyon bawat kwarto sa 2 taon (stacked)
  - **Kuryente at tubig:** kabuuang singil sa kuryente at tubig (grouped columns) · rate ng kuryente bawat kwarto (₱/kWh = Σ col I ÷ Σ col E ng bawat kwarto) · rate ng tubig (₱/m³ = Σ col P ÷ Σ col L) · konsumo ng kuryente (kWh) at tubig (m³) bawat kwarto (heatmap: mas madilim = mas malaki, puti = bakante)
  - Puwedeng pare-pareho ang Y1 ng luma at bagong tenant ng iisang kwarto; ang tenant na may row sa buwang iyon ang binibilang.
- May table ng bawat tenant, kasama ang Remarks. Kasama ang mga archived na tenant sa mga buwang umuupa pa sila.
- I-click ang row para buksan ang resibo ng tenant na iyon sa parehong buwan.

### Highlights
- Mahahalagang detalye mula sa **lahat** ng data (hindi apektado ng napiling buwan):
  - Pinakamatagal na tenant · pinakabagong tenant · pinakamataas at pinakamababang koleksyon sa isang buwan · average bawat buwan · pinakamalakas sa kuryente at tubig (average bawat buwan, kasama lang ang may ≥3 buwang data) · occupancy (average % at kasalukuyang bakante)
  - Kapag kinlik ang card ng buwan, bubuksan ito sa Dashboard tab. Kapag tenant, bubuksan ang resibo niya.
- **Lahat ng tenant:** table ng bawat naging tenant (kwarto, mula, hanggang, ilang buwan, kabuuang naibayad, average na bill). I-click ang row para buksan ang pinakabagong resibo.
- Naaalala sa URL: .

## Google Sheet

- **Isang tab = isang tenant.** Ang pangalan ng tab ang lalabas sa resibo at ang gagamiting pangalan ng folder.
- **Naka-hide na tab = archived**, ibig sabihin hindi na umuupa.
- **Mga header row:** lahat ng row bago ang unang may petsa sa column A (sa ngayon, 2 row).
- **Mga column na ginagamit:**

  | Column | Laman |
  |---|---|
  | A | Date (buwan) |
  | B | Rent Rate |
  | C–E, G, I | Kuryente: Previous, Current, Consumption, Rate, Total |
  | J–L, N, P | Tubig: Previous, Current, Consumption (m³), Rate, Total |
  | Q | Internet Rate |
  | R | Other Charges |
  | S | Total Amount |
  | T | Remarks (laging may card sa resibo; blangko kapag walang laman) |
  | Y1 | Kwarto ng tenant (halimbawa `2A`); lalabas sa Preview at sa Dashboard |

- **Bagong kwarto:** kapag may kwartong nadagdag sa gitna (hal. Room 4 noong July 2026), ilagay ito sa `ROOM_OPENED` sa simula ng `dashboard.js` (hal. `{ '4': 'JULY, 2026' }`). Bago ang buwang iyon, hindi ito binibilang sa occupancy at hindi ito lumalabas na "bakante".
  | U2 | Araw ng due date (halimbawa `1` → due sa ika-1 ng buwan) |

- Naka-**Publish to web** ito bilang `.xlsx` (File → Share → Publish to web). Ilang minuto ang delay bago lumabas ang mga pagbabago, kahit i-reload mo ang page.
- Dahil naka-publish, **public** ang data para sa kahit sinong may hawak ng link.

## Mga file

| File | Para saan |
|---|---|
| `index.html` | Ang app at ang Receipt tab. Naka-embed na ang logo. |
| `dashboard.js` | Logic ng Dashboard tab at ng paglipat ng tab |
| `dashboard.css` | Styles ng Dashboard tab at ng mga tab sa itaas |
| `highlights.js` | Highlights tab: gumagawa ng sariling tab at section, at ng lahat ng kuwenta |
| `highlights.css` | Styles ng Highlights tab |
| `favicon.ico` | Icon sa browser tab (ang logo, 16/32/48 px) |
| `serve.ps1` | Local server at pag-save sa folder ng tenant |
| `Buksan Resibo.bat` | Pinapatakbo ang `serve.ps1` |
| `.gitignore` | Ini-ignore ang mga folder, PDF, documents at images |

## Sa GitHub Pages

Gumagana rin ang page sa GitHub Pages (kumukuha pa rin ng data sa Google Sheet), pero:
- Sa **Downloads** napupunta ang JPEG at PDF, hindi sa folder ng tenant.
- Gumagana pa rin ang Copy.

## Kapag may problema

| Nakikita | Gawin |
|---|---|
| "Hindi makuha ang Google Sheet kapag binuksan bilang file" | Buksan gamit ang `Buksan Resibo.bat` |
| "Hindi ma-save sa folder ng tenant, na-download na lang" | May lumang `serve.ps1` na tumatakbo. Isara lahat ng itim na window at buksan ulit ang `.bat` |
| Hindi lumalabas ang bagong edit sa sheet | Hintayin ng ilang minuto (delay ng Publish to web), tapos i-reload ang page |
| "Hindi makopya ang image" | Gamitin ang Download, o buksan sa Chrome o Edge gamit ang `.bat` |
