/* ============================================================
   睡眠コーチ — Google Apps Script（サーバー側）
   役割:
   1. アプリからのイベント（誓い/YouTube終了/スマホ追放 等）をスプレッドシートに記録
   2. 30分毎に状況を確認し、未実施なら iPhone に音付き通知を送る（〜深夜2:00で停止）

   セットアップ手順は SETUP-GAS.md を参照。
   ============================================================ */

/* ------------------------------------------------------------
   設定 — ここだけ自分の値に書き換える
   ------------------------------------------------------------ */
var TOKEN = "kaeru-no-uta-1234";      // アプリ側 GAS_TOKEN と完全に一致させる合言葉（好きな文字列に）

var NOTIFY_METHOD = "pushover";        // "pushover" / "ntfy" / "email" のいずれか

// ▼ Pushover を使う場合（推奨）
var PUSHOVER_TOKEN = "";               // Pushoverで作成したアプリのAPIトークン
var PUSHOVER_USER  = "";               // Pushoverのユーザーキー
var PUSHOVER_PRIORITY = 1;             // 1=高（音が鳴る）/ 2=緊急（消音・集中モードも貫通、要クリティカル許可）

// ▼ ntfy を使う場合（無料）
var NTFY_TOPIC = "";                   // 例: "sleepcoach-x7k2p9"（他人に推測されにくい文字列にする）

// ▼ メールを使う場合
var EMAIL_TO = "";                     // 送信先メールアドレス

var SHEET_NAME = "log";
var TZ = "Asia/Tokyo";

/* ------------------------------------------------------------
   Webアプリ: アプリからのイベントを受信してシートに記録
   ------------------------------------------------------------ */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) {
      return ContentService.createTextOutput("forbidden");
    }
    var sheet = getSheet();
    sheet.appendRow([body.date, body.event, body.time, body.detail || ""]);
    return ContentService.createTextOutput("ok");
  } catch (err) {
    return ContentService.createTextOutput("error: " + err);
  }
}

// デプロイ確認用（ブラウザでURLを開くと "sleep-coach OK" と表示）
function doGet(e) {
  return ContentService.createTextOutput("sleep-coach OK");
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["date", "event", "time", "detail"]);
  }
  return sheet;
}

/* ------------------------------------------------------------
   督促: 30分毎トリガーで実行
   19:30〜22:30 … チェックイン未実施なら「チェックインしろ」
   23:15〜翌1:45 … 実行日なのにスマホ追放未確認なら「スマホを置け」
   2:00以降 … 何もしない（寝落ち対応）
   ------------------------------------------------------------ */
function checkReminders() {
  var now = new Date();
  var hour = parseInt(Utilities.formatDate(now, TZ, "H"), 10);
  var min  = parseInt(Utilities.formatDate(now, TZ, "m"), 10);
  var mins = hour * 60 + min;   // 0〜1439（その日の経過分）

  var today = Utilities.formatDate(now, TZ, "yyyy-MM-dd");
  var yesterday = Utilities.formatDate(new Date(now.getTime() - 86400000), TZ, "yyyy-MM-dd");

  // チェックイン督促: 19:30(=1170) 〜 22:30(=1350)
  if (mins >= 1170 && mins <= 1350) {
    var recToday = getDayEvents(today);
    if (!recToday.committed && !recToday.restDay) {
      notify("⏰ 睡眠コーチ", "まだ今夜のチェックインをしていません。アプリを開いて今夜の誓いを立てろ。");
      return;
    }
  }

  // スマホ追放督促: 23:15(=1395)〜23:59 は当日 / 00:00〜01:45(=105) は前日の記録を見る
  var phoneDate = null;
  if (mins >= 1395) phoneDate = today;
  else if (mins <= 105) phoneDate = yesterday;

  if (phoneDate) {
    var rec = getDayEvents(phoneDate);
    // その日にチェックイン済み・フリー日でない・まだスマホを置いていない場合のみ督促
    if (rec.committed && !rec.restDay && !rec.phoneOut) {
      notify("🚪 睡眠コーチ", "まだスマホを手放していません。リビングに置いて今すぐ消灯しろ。");
      return;
    }
  }
}

// 指定日のイベント種別を { committed:true, phoneOut:true, ... } の形で返す
function getDayEvents(dateStr) {
  var sheet = getSheet();
  var values = sheet.getDataRange().getValues();
  var out = {};
  for (var i = 1; i < values.length; i++) {
    var d = values[i][0];
    var ds = (d instanceof Date) ? Utilities.formatDate(d, TZ, "yyyy-MM-dd") : String(d);
    if (ds === dateStr) {
      out[values[i][1]] = true;   // 列B（event名）をキーにする
    }
  }
  return out;
}

/* ------------------------------------------------------------
   通知の送信（3方式を NOTIFY_METHOD で切替）
   ------------------------------------------------------------ */
function notify(title, message) {
  if (NOTIFY_METHOD === "pushover") {
    var payload = {
      token: PUSHOVER_TOKEN,
      user: PUSHOVER_USER,
      title: title,
      message: message,
      priority: PUSHOVER_PRIORITY
    };
    if (PUSHOVER_PRIORITY === 2) { payload.retry = 60; payload.expire = 1800; } // 緊急は必須パラメータ
    UrlFetchApp.fetch("https://api.pushover.net/1/messages.json", {
      method: "post", payload: payload, muteHttpExceptions: true
    });

  } else if (NOTIFY_METHOD === "ntfy") {
    // 日本語をHTTPヘッダに入れると文字化けするため、タイトルは本文に含める
    UrlFetchApp.fetch("https://ntfy.sh/" + NTFY_TOPIC, {
      method: "post",
      contentType: "text/plain; charset=utf-8",
      payload: title + "\n" + message,
      headers: { "Priority": "high", "Tags": "warning" },
      muteHttpExceptions: true
    });

  } else if (NOTIFY_METHOD === "email") {
    MailApp.sendEmail(EMAIL_TO, title, message);
  }
}

/* ------------------------------------------------------------
   手動テスト用（GASエディタから実行して通知が届くか確認）
   ------------------------------------------------------------ */
function testNotify() {
  notify("🔔 テスト通知", "睡眠コーチの通知テストです。これが音付きで届けば設定成功。");
}

// 督促ロジックのテスト（今この瞬間の時間帯で督促が出るかを確認）
function testCheckReminders() {
  checkReminders();
}
