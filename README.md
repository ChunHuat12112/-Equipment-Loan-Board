# 設備借用看板 Equipment Loan Board

內部辦公設備借用系統。同事掃描 QR Code 或打開連結，就能查看設備可借數量、線上借用/歸還，管理者可以另外登入編輯設備清單。整套系統**完全免費**，不需要任何伺服器或資料庫費用。

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
- 線上借用（含借用理由與借用時間，過去時間會由前後端共同阻擋）與歸還（歸還前有確認視窗，避免手滑誤觸）
- 設備分類篩選
- 管理者密碼保護的設備管理（新增／編輯／刪除，含名稱、數量、分類、描述）
- 設備描述欄位（例如型號、藍牙版本、規格），會顯示在卡片上
- 借用與歸還時自動 email 通知管理者
- 歸還後保留歷史紀錄（不刪除，只標記狀態），方便日後追查
- 借用、歸還時間統一使用 `Asia/Singapore`，並以 `yyyy/MM/dd HH:mm` 顯示
- 中文／英文介面切換

## 已知限制（方便未來維護者評估）

- **管理者密碼是寫在前端原始碼裡的明碼**，只能防止同事手滑誤操作，不是真正的身分驗證機制，不適合存放高敏感資料
- Google Apps Script Web App 的存取權限設為「Anyone」，代表任何拿到 `/exec` 網址的人都能讀寫資料，僅靠網址本身的不可預測性作為保護
- 沒有帳號系統，借用人姓名為自由輸入文字，無法防止填錯或冒名
- Netlify 免費方案的額度以「credit」計算，若流量／部署次數異常暴增，當月有機會超額導致服務暫停（不會扣費，只會暫停到下個月額度重置）

## 部署方式（詳細步驟）

整套系統分兩塊部署：**後端**（Google 試算表 + Apps Script）先做，**前端**（HTML 網頁）後做，因為前端需要填入後端產生的網址。

### 第一部分：部署後端

**1. 建立 Google 試算表**

前往 [sheets.google.com](https://sheets.google.com) → 點「空白」建立新試算表 → 隨意命名（例如「設備借用資料庫」）。不需要手動建欄位，程式碼會自動建立。

**2. 貼上後端程式碼**

1. 在試算表選單點「擴充功能」→「Apps Script」，會開啟一個新分頁
2. 清空預設的程式碼，把 `apps-script-backend-v2.gs` 的完整內容整個貼上
3. 找到程式碼裡的這一行，換成你自己想收借用/歸還通知的信箱：
   ```javascript
   const OWNER_EMAIL = 'your-email@example.com';
   ```
4. 存檔（Ctrl+S / Cmd+S）

**3. 部署成 Web App**

1. 右上角點「Deploy」→「New deployment」
2. 點「Select type」旁的齒輪圖示 ⚙️ → 選「Web app」
3. 設定：
   - Execute as：**Me**
   - Who has access：**Anyone**
4. 點「Deploy」
5. 第一次部署會跳出 Google 授權要求（因為程式要讀寫試算表、要寄信），照著點「Authorize access」→ 選你的帳號 → 「Advanced」→「Go to [專案名稱] (unsafe)」→「Allow」
6. 完成後會拿到一個網址，長得像：
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```
   **把這個網址複製起來**，下一步要用

### 第二部分：部署前端

**4. 填入後端網址**

打開 `equipment-loan-board.html`，找到這一行，換成剛剛拿到的網址：
```javascript
const GAS_URL = 'https://script.google.com/macros/s/你的網址/exec';
```

**5. 上傳到 Netlify（免費靜態網站託管）**

1. 打開 [app.netlify.com/drop](https://app.netlify.com/drop)（不需要註冊帳號就能用，但建議之後註冊一個帳號方便管理）
2. 把 `equipment-loan-board.html` 檔案直接拖曳到網頁中央的虛線框
3. 幾秒鐘後會產生一個公開網址，例如 `https://random-name-12345.netlify.app`
4. 這個網址就是給同事使用、也是海報 QR Code 要連的網址

**6. 測試**

打開產生的網址，確認：
- 能看到設備清單（第一次會自動建立三筆範例設備）
- 能成功借用一項設備，並確認 Google 試算表的 `Loans` 分頁有新增一列
- 能成功歸還，確認該列的 `status` 欄位變成 `returned`
- 確認 `OWNER_EMAIL` 設定的信箱有收到通知信（若沒收到，見下方疑難排解）

### 之後要更新內容怎麼做

| 想改什麼 | 要動哪裡 | 步驟 |
|---|---|---|
| 前端畫面、文字、顏色、功能 | `equipment-loan-board.html` | 改好後回到 Netlify 該專案的「Deploys」頁面，把新檔案拖曳進去重新部署，**網址不變** |
| 後端邏輯、email 內容、資料欄位 | `apps-script-backend-v2.gs` | 改好後存檔，回到 Apps Script「Deploy」→「Manage deployments」→ 點編輯（鉛筆圖示）→ Version 選「New version」→「Deploy」，**單純存檔不會生效，一定要重新部署新版本** |
| 管理者通關密碼 | `equipment-loan-board.html` 裡的 `ADMIN_PASSCODE` | 改完密碼後同樣要重新上傳到 Netlify |

### 疑難排解

- **畫面顯示「資料讀取失敗」**：檢查 `GAS_URL` 是否跟 Apps Script 部署後拿到的網址完全一致；確認 Apps Script 部署權限是「Anyone」而非「Only myself」
- **收不到 email 通知**：到 Apps Script 左側時鐘圖示（Executions）查看最近一筆 `doPost` 執行紀錄，展開看 Log 內容；也檢查垃圾郵件匣；若信箱是公司網域，可能是機構的 Google Workspace 政策封鎖了自動化寄信，需洽詢 IT
- **改了程式碼但網頁沒變化**：Apps Script 一定要「New version」重新部署；Netlify 要重新拖曳上傳，兩邊都不會自動套用未部署的變更
