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
   - Tumatanggap ng `POST /save` para i-save ang JPEG o PDF sa `Rent/<pangalan ng tenant>/` (tingnan sa ibaba).
   - Binubuksan ang browser.
3. **`index.html`** pagka-load:
   - Kinukuha ang published na `.xlsx` mula sa Google Sheet (`SHEET_URL` sa simula ng script).
   - Pinupuno ang Tenant dropdown. Alphabetical ito, at nakahiwalay ang **Active** at **Archived**.
   - Kung ang URL ay may `#koleksyon`, ang Koleksyon tab ang unang bubukas.

## Mga tab

### Resibo
1. Pumili ng **Tenant**. Kusang lalabas ang resibo ng **pinakabagong buwan** na may Total Amount.
2. Puwedeng pumili ng ibang buwan sa **Buwan** dropdown, o i-click ang row sa **Sheet Preview** (pinakabago ang nasa itaas).
3. Sa itaas ng resibo:
   - **Download as JPEG**: sine-save sa `Rent/<tenant>/<Tenant_Name>-<MONTH>_<YEAR>.jpeg`. Ginagawa ang folder kung wala pa, at laging **pinapalitan** ang lumang file (walang "(1)").
   - **Copy**: kinokopya ang resibo bilang image, para ma-paste (Ctrl+V) sa Messenger o Viber.
   - **Back**: isinasara ang resibo.
4. Sa Sheet Preview, ang **Export PDF** ay gumagawa ng iisang PDF ng lahat ng buwan ng tenant, 4 na resibo bawat page. Sine-save ito sa `Rent/<tenant>/<Tenant_Name>-Receipts.pdf`.
5. Ang **Refresh** ay kumukuha ulit ng data sa Google Sheet, at nananatili ang napiling tenant at buwan.

Sa screen, pinaliliit ang resibo para kasya sa window, pero buong laki pa rin ang JPEG at PDF.

### Koleksyon
- Kabuuan ng **lahat ng tenant** para sa isang buwan: Rent, Tubig, Kuryente, Internet/Others at **Total**.
- **Paalala sa itaas ng mga tile:** nagsimula ang paupahan noong March 2023, pero mula January 2024 lang ang data sa sheet (wala ang data nina Aling Shirley, Katrina Mendoza at Marielle Domil). Nasa `BUSINESS_START` at `MISSING_TENANTS` sa simula ng `koleksyon.js` ang mga ito.
- **Buwan dropdown:** ang kasalukuyang buwan ang default. Piliin ang **ALL (lahat ng buwan)** para makita ang overall: kabuuan ng lahat ng buwan sa tiles, donut, bawat kwarto at table (may "Ilang buwan" bawat tenant), at lahat ng buwan sa mga graph. Sa ALL, bubuksan ng row sa table ang pinakabagong resibo ng tenant.
- **Mga graph**, nakahati sa 3 seksyon. Ang mga may buwan sa ilalim ay 2 taon (24 buwan) hanggang sa napiling buwan, o lahat ng buwan kapag ALL. Ipinapakita ang eksaktong halaga kapag tinapatan ng mouse, at sa mga column chart, i-click ang column para piliin ang buwang iyon.
  - **Koleksyon:** kabuuang koleksyon bawat buwan · breakdown ng singil (donut chart: Rent, Tubig, Kuryente, Internet/Others, may halaga at %) · ngayong taon vs nakaraang taon (grouped columns, Jan–Dec, may YTD at % pagbabago) · average na bill bawat tenant (columns)
  - **Mga kwarto (Y1 ng tab):** koleksyon ng bawat kwarto sa napiling buwan (kasama kung sino ang nakatira, o kung bakante) · occupancy (ilang kwarto ang may nakatira; kasama ang tenant na may row kahit wala pang Total) · koleksyon bawat kwarto sa 2 taon (stacked)
  - **Kuryente at tubig:** kabuuang singil sa kuryente at tubig (grouped columns) · rate ng kuryente bawat kwarto (₱/kWh = Σ col I ÷ Σ col E ng bawat kwarto) · rate ng tubig (₱/m³ = Σ col P ÷ Σ col L) · konsumo ng kuryente (kWh) at tubig (m³) bawat kwarto (heatmap: mas madilim = mas malaki, puti = bakante)
  - Puwedeng pare-pareho ang Y1 ng luma at bagong tenant ng iisang kwarto; ang tenant na may row sa buwang iyon ang binibilang.
- May table ng bawat tenant, kasama ang Remarks. Kasama ang mga archived na tenant sa mga buwang umuupa pa sila.
- I-click ang row para buksan ang resibo ng tenant na iyon sa parehong buwan.

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
  | Y1 | Kwarto ng tenant (halimbawa `2A`); lalabas sa Sheet Preview at sa Koleksyon |
  | U2 | Araw ng due date (halimbawa `1` → due sa ika-1 ng buwan) |

- Naka-**Publish to web** ito bilang `.xlsx` (File → Share → Publish to web). Ilang minuto ang delay bago lumabas ang mga pagbabago, kahit mag-Refresh ka.
- Dahil naka-publish, **public** ang data para sa kahit sinong may hawak ng link.

## Mga file

| File | Para saan |
|---|---|
| `index.html` | Ang app at ang Resibo tab. Naka-embed na ang logo. |
| `koleksyon.js` | Logic ng Koleksyon tab at ng paglipat ng tab |
| `koleksyon.css` | Styles ng Koleksyon tab at ng mga tab sa itaas |
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
| Hindi lumalabas ang bagong edit sa sheet | Hintayin ng ilang minuto (delay ng Publish to web), tapos i-Refresh |
| "Hindi makopya ang image" | Gamitin ang Download, o buksan sa Chrome o Edge gamit ang `.bat` |
