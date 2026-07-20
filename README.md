# 設備借用看板 Equipment Loan Board

設備借用系統。同事掃描 QR Code 或打開連結，就能查看設備可借數量、線上借用/歸還，管理者可以另外登入編輯設備清單。整套系統**完全免費**，不需要任何伺服器或資料庫費用。

## 架構

```
┌─────────────────────┐        ┌──────────────────────┐        ┌────────────────────┐
│   前端網頁 (靜態)      │  fetch │  Google Apps Script   │  讀寫  │   Google 試算表      │
│  HTML / CSS / JS     │ ─────▶ │   (後端 Web App)       │ ─────▶ │  Items / Loans 分頁  │
│  託管於 Netlify       │ ◀───── │   doGet / doPost       │ ◀───── │                     │
└─────────────────────┘        └──────────────────────┘        └────────────────────┘
                                          │
                                          │ MailApp.sendEmail()
                                          ▼
                                  管理者信箱（借用/歸還通知）
```

沒有傳統意義上「自己架設、自己維運」的伺服器。前端是純靜態網頁，資料庫用 Google 試算表代替，中間靠 Google Apps Script 提供一個免費的 API 端點串接兩者。

## 技術棧與各環節費用

| 環節 | 使用技術 | 費用 |
|---|---|---|
| 前端介面 | 純 HTML + CSS + JavaScript（無框架） | 免費，無版權/授權費用 |
| 網頁託管 | [Netlify](https://netlify.com) 免費方案 | 免費，每月 300 credit（約 15GB 流量），超過額度僅暫停服務、不會產生費用 |
| 後端 API | Google Apps Script（Web App 部署） | 免費，隨 Google 帳號附贈，無額外費用 |
| 資料庫 | Google 試算表（Items / Loans 兩個分頁） | 免費，計入 Google 帳號的免費雲端硬碟容量 |
| Email 通知 | Google Apps Script `MailApp`（透過 Gmail 寄信） | 免費，個人 Gmail 帳號每日 100 封額度 |
| 字型 | Google Fonts（IBM Plex Mono / IBM Plex Sans） | 免費，開源授權 |

**結論：目前的建置方式在正常辦公室規模的使用量下，完全不會產生任何費用。**

## 功能

- 即時顯示每項設備的可借數量、目前借用人
- 線上借用（含借用理由）與歸還
- 設備分類篩選
- 管理者密碼保護的設備管理（新增／編輯／刪除，含名稱、數量、分類、描述）
- 借用與歸還時自動 email 通知管理者
- 歸還後保留歷史紀錄（不刪除，只標記狀態），方便日後追查
- 中文／英文介面切換

## 已知限制（誠實揭露，方便未來維護者評估）

- **管理者密碼是寫在前端原始碼裡的明碼**，只能防止同事手滑誤操作，不是真正的身分驗證機制，不適合存放高敏感資料
- Google Apps Script Web App 的存取權限設為「Anyone」，代表任何拿到 `/exec` 網址的人都能讀寫資料，僅靠網址本身的不可預測性作為保護
- 沒有帳號系統，借用人姓名為自由輸入文字，無法防止填錯或冒名
- Netlify 免費方案的額度以「credit」計算，若流量／部署次數異常暴增，當月有機會超額導致服務暫停（不會扣費，只會暫停到下個月額度重置）

## 部署方式

1. **後端**：把 `apps-script-backend-v2.gs` 貼到 Google 試算表的 Apps Script 編輯器，部署為 Web App（Execute as: Me / Who has access: Anyone），取得 `/exec` 網址
2. **前端**：把該網址填入 `equipment-loan-board.html` 中的 `GAS_URL` 常數，將檔案拖曳上傳至 [Netlify Drop](https://app.netlify.com/drop) 完成部署
3. 之後若需更新前端，回到 Netlify 專案的 Deploys 頁面重新拖曳檔案即可，網址不變
4. 若需更新後端邏輯，回到 Apps Script 編輯器修改後，需重新 **Deploy → Manage deployments → New version → Deploy** 才會生效
