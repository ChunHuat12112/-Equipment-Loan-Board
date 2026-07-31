// 這段程式碼要「整個取代」你原本貼在 Apps Script 編輯器裡的內容
// 資料會存成兩個分頁：Items（設備清單）、Loans（借用紀錄），一列一筆，欄位分開

const APP_TIME_ZONE = 'Asia/Singapore';
const DATE_TIME_FORMAT = 'yyyy/MM/dd HH:mm';

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function itemsSheet_() {
  return getSheet_('Items', ['id', 'name', 'total', 'category', 'description']);
}

function loansSheet_() {
  const sheet = getSheet_('Loans', ['id', 'itemId', 'itemName', 'borrower', 'qty', 'reason', 'timestamp', 'status', 'returnedAt']);
  // timestamp（第 7 欄）和 returnedAt（第 9 欄）在試算表中直接顯示年月日與時間。
  const rowCount = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, 7, rowCount, 1).setNumberFormat(DATE_TIME_FORMAT);
  sheet.getRange(2, 9, rowCount, 1).setNumberFormat(DATE_TIME_FORMAT);
  migrateLegacyTimestamps_(sheet);
  return sheet;
}

function newId_(prefix) {
  return prefix + '_' + Utilities.getUuid().slice(0, 8);
}

function formatDateTime_(date) {
  return Utilities.formatDate(date, APP_TIME_ZONE, DATE_TIME_FORMAT);
}

function migrateLegacyTimestamps_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  [7, 9].forEach(column => {
    const range = sheet.getRange(2, column, lastRow - 1, 1);
    const values = range.getValues();
    let changed = false;

    values.forEach(row => {
      // 舊版本使用 Date.now()，試算表中會留下 13 位毫秒數；轉成真正的日期物件。
      if (typeof row[0] === 'number' && row[0] > 100000000000) {
        row[0] = new Date(row[0]);
        changed = true;
      }
    });

    if (changed) range.setValues(values);
  });
}

function readItems_() {
  const rows = itemsSheet_().getDataRange().getValues();
  return rows.slice(1).filter(r => r[0]).map(r => ({
    id: r[0], name: r[1], total: Number(r[2]), category: r[3], description: r[4] || ''
  }));
}

function readLoans_() {
  const rows = loansSheet_().getDataRange().getValues();
  return rows.slice(1).filter(r => r[0]).map(r => ({
    id: r[0], itemId: r[1], itemName: r[2], borrower: r[3],
    qty: Number(r[4]), reason: r[5], ts: Number(r[6]),
    status: r[7] || 'borrowed', returnedAt: r[8] ? Number(r[8]) : null
  }));
}

function buildState_() {
  return { items: readItems_(), loans: readLoans_() };
}

function seedDefaults_() {
  const sheet = itemsSheet_();
  sheet.appendRow([newId_('i'), '筆記型電腦', 2, '電腦設備', '']);
  sheet.appendRow([newId_('i'), '外接螢幕', 3, '電腦設備', '']);
  sheet.appendRow([newId_('i'), 'HDMI 傳輸線', 4, '週邊配件', '']);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function deleteRowById_(sheet, id) {
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === id) { sheet.deleteRow(i + 1); break; }
  }
}

function updateItem_(p) {
  const sheet = itemsSheet_();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === p.id) {
      sheet.getRange(i + 1, 2).setValue(p.name);
      sheet.getRange(i + 1, 3).setValue(p.total);
      sheet.getRange(i + 1, 4).setValue(p.category || '未分類');
      sheet.getRange(i + 1, 5).setValue(p.description || '');
      break;
    }
  }
}

function markLoanReturned_(id) {
  const sheet = loansSheet_();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sheet.getRange(i + 1, 8).setValue('returned');   // status column
      sheet.getRange(i + 1, 9).setValue(new Date());    // returnedAt column
      return {
        itemName: rows[i][2], borrower: rows[i][3], qty: rows[i][4]
      };
    }
  }
  return null;
}

// ★ 換成你自己想收通知的 email 地址
const OWNER_EMAIL = 'chkhoo@tzuchi.my';

function sendBorrowEmail_(p) {
  try {
    const subject = '【設備借用通知】' + p.borrower + ' 借了「' + p.itemName + '」';
    const lines = [
      '借用人：' + p.borrower,
      '設備：' + p.itemName,
      '數量：' + p.qty,
      p.reason ? '借用理由：' + p.reason : '（未填寫理由）',
      '借用時間：' + formatDateTime_(new Date(Number(p.borrowAt)))
    ];
    MailApp.sendEmail(OWNER_EMAIL, subject, lines.join('\n'));
  } catch (e) {
    // 寄信失敗不影響借用紀錄本身的寫入，靜默失敗即可
  }
}

function sendReturnEmail_(loanInfo) {
  if (!loanInfo) return;
  try {
    const subject = '【設備歸還通知】' + loanInfo.borrower + ' 歸還了「' + loanInfo.itemName + '」';
    const lines = [
      '借用人：' + loanInfo.borrower,
      '設備：' + loanInfo.itemName,
      '數量：' + loanInfo.qty,
      '歸還時間：' + formatDateTime_(new Date())
    ];
    MailApp.sendEmail(OWNER_EMAIL, subject, lines.join('\n'));
  } catch (e) {
    // 寄信失敗不影響歸還狀態本身的更新，靜默失敗即可
  }
}

function doGet(e) {
  let state = buildState_();
  if (state.items.length === 0) {
    seedDefaults_();
    state = buildState_();
  }
  return jsonOut_(state);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;
  const p = body.payload || {};

  if (action === 'addItem') {
    itemsSheet_().appendRow([newId_('i'), p.name, p.total, p.category || '未分類', p.description || '']);
  } else if (action === 'updateItem') {
    updateItem_(p);
  } else if (action === 'deleteItem') {
    // 只刪除設備本身，借用歷史紀錄保留在 Loans 分頁，方便日後追查
    deleteRowById_(itemsSheet_(), p.id);
  } else if (action === 'addLoan') {
    const borrowAt = Number(p.borrowAt);
    if (!Number.isFinite(borrowAt)) {
      return jsonOut_({ error: 'invalidBorrowTime', state: buildState_() });
    }
    if (borrowAt <= Date.now()) {
      return jsonOut_({ error: 'borrowTimePast', state: buildState_() });
    }
    loansSheet_().appendRow([newId_('l'), p.itemId, p.itemName, p.borrower, p.qty, p.reason || '', new Date(borrowAt), 'borrowed', '']);
    sendBorrowEmail_(p);
  } else if (action === 'returnLoan') {
    const loanInfo = markLoanReturned_(p.id);
    sendReturnEmail_(loanInfo);
  }

  return jsonOut_(buildState_());
}
