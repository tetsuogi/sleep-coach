import { useState, useEffect, useCallback } from "react";

const FACTS = [
  {
    category: "脳の破壊",
    icon: "🧠",
    title: "あなたの脳は今夜も壊れる",
    body: "慢性的な睡眠不足は、覚醒と認知を司る青斑核のニューロンを最大25%死滅させる。この損傷は不可逆的で、週末の寝溜めでは回復しない。",
    source: "Penn Medicine / Journal of Neuroscience, 2013",
    metric: "25%",
    metricLabel: "神経細胞の喪失率",
  },
  {
    category: "ホルモン崩壊",
    icon: "⚡",
    title: "テストステロンが15年分老化する",
    body: "たった1週間の睡眠制限（5時間/晩）で、健康な男性のテストステロンが10〜15%低下。これは10〜15年分の加齢に相当する。筋力、意欲、性機能、体脂肪すべてに影響する。",
    source: "JAMA, 2011 / シカゴ大学",
    metric: "10-15%",
    metricLabel: "テストステロン低下率",
  },
  {
    category: "心臓への攻撃",
    icon: "❤️‍🩹",
    title: "死亡率が1.7倍になる",
    body: "6時間以下の睡眠の男性は、7-8時間寝ている男性に比べて全死因死亡率が1.7倍。冠動脈疾患リスクは48%上昇、脳卒中リスクは15%上昇する。",
    source: "メタ分析 / 約47.5万人対象",
    metric: "1.7x",
    metricLabel: "全死因死亡率",
  },
  {
    category: "代謝の破綻",
    icon: "🩸",
    title: "糖尿病リスクが30%上昇する",
    body: "6時間未満の睡眠は2型糖尿病リスクを約30%増加させる。インスリン感受性が低下し、食欲ホルモンが乱れる。断食の効果が夜更かしで帳消しになっている。",
    source: "前向き研究メタ分析 / 44.7万人",
    metric: "+30%",
    metricLabel: "糖尿病リスク増加",
  },
  {
    category: "認知の劣化",
    icon: "📉",
    title: "自分の劣化に気づけなくなる",
    body: "睡眠不足が続くと主観的な眠気は頭打ちになるが、客観的な認知テストのスコアは直線的に低下し続ける。「慣れた」と感じるのは脳が自己評価能力を失った証拠。",
    source: "Frontiers in Neuroscience, 2025",
    metric: "−54%",
    metricLabel: "中等度睡眠障害時のミス増加率",
  },
  {
    category: "免疫の崩壊",
    icon: "🛡️",
    title: "風邪をひきやすくなり、がんへの監視も弱まる",
    body: "6時間未満の睡眠で感染症リスクが有意に上昇。NK細胞の活性低下により、がん細胞への免疫監視も弱体化する。ワクチンの効果も低下する。",
    source: "Sleep, 2015 / 164人対象",
    metric: "6h未満",
    metricLabel: "免疫崩壊の閾値",
  },
  {
    category: "認知症への道",
    icon: "🌑",
    title: "低テストステロン×睡眠不足＝認知症リスク急増",
    body: "テストステロン低下と睡眠不足が組み合わさると、認知機能障害のリスクが相乗的に跳ね上がる。メンデルランダム化により因果関係が支持されている。",
    source: "Psychiatry Research, 2025",
    metric: "相乗効果",
    metricLabel: "リスクの増幅パターン",
  },
];

const RULES = [
  { icon: "📵", text: "20:00アラームでYouTubeを閉じる" },
  { icon: "🚪", text: "23:00にスマホをリビングに置く" },
  { icon: "🔒", text: "おやすみモードでYouTube・X・Amazon・メルカリを遮断" },
  { icon: "🍳", text: "食事は時短に徹する。凝らない。" },
];

const STORAGE_KEY = "sleep-coach-data";

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDayOfWeek(dateStr) {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return days[new Date(dateStr).getDay()];
}

export default function SleepCoach() {
  const [phase, setPhase] = useState("loading");
  const [factIndex, setFactIndex] = useState(0);
  const [rulesAcked, setRulesAcked] = useState(false);
  const [data, setData] = useState({ streak: 0, history: {}, lastCheckIn: null });
  const [morningResult, setMorningResult] = useState(null);
  const [todayFacts, setTodayFacts] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (phase !== "loading") return;
    const seed = hashDate(getToday());
    const shuffled = [...FACTS].sort((a, b) => {
      const ha = ((seed * 31 + FACTS.indexOf(a)) % 997);
      const hb = ((seed * 31 + FACTS.indexOf(b)) % 997);
      return ha - hb;
    });
    setTodayFacts(shuffled.slice(0, 4));

    const today = getToday();
    if (data.history[today]?.committed) {
      setPhase("done");
    } else if (data.lastCheckIn && data.lastCheckIn !== today && !data.history[data.lastCheckIn]?.result) {
      setPhase("morning");
    } else {
      setPhase("facts");
    }
  }, [data]);

  function hashDate(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  async function loadData() {
    try {
      const result = await window.storage.get(STORAGE_KEY);
      if (result?.value) {
        setData(JSON.parse(result.value));
        return;
      }
    } catch (e) {}
    setData({ streak: 0, history: {}, lastCheckIn: null });
  }

  async function saveData(newData) {
    setData(newData);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(newData));
    } catch (e) {
      console.error("Storage error:", e);
    }
  }

  function handleNextFact() {
    if (factIndex < todayFacts.length - 1) {
      setFactIndex(factIndex + 1);
    } else {
      setPhase("rules");
    }
  }

  function handleAckRules() {
    setRulesAcked(true);
  }

  async function handleCommit() {
    const today = getToday();
    const newHistory = { ...data.history, [today]: { committed: true, time: new Date().toISOString() } };
    await saveData({ ...data, history: newHistory, lastCheckIn: today });
    setPhase("done");
  }

  async function handleMorningReport(success) {
    setMorningResult(success);
    const yesterday = data.lastCheckIn;
    if (!yesterday) return;
    const newHistory = { ...data.history };
    newHistory[yesterday] = { ...newHistory[yesterday], result: success };
    const newStreak = success ? data.streak + 1 : 0;
    await saveData({ ...data, history: newHistory, streak: newStreak });
    setTimeout(() => {
      setPhase("facts");
      setMorningResult(null);
    }, 2000);
  }

  async function handleReset() {
    await saveData({ streak: 0, history: {}, lastCheckIn: null });
    setFactIndex(0);
    setRulesAcked(false);
    setPhase("facts");
  }

  const recentDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    recentDays.push({ date: key, day: getDayOfWeek(key), ...data.history[key] });
  }

  if (phase === "loading") {
    return (
      <div style={styles.container}>
        <div style={styles.loadingText}>読み込み中...</div>
      </div>
    );
  }

  if (phase === "morning") {
    return (
      <div style={styles.container}>
        <div style={styles.morningCard}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌅</div>
          <h2 style={styles.morningTitle}>昨夜の結果報告</h2>
          <p style={styles.morningBody}>23:00までにスマホを手放して消灯できましたか？</p>
          {morningResult === null ? (
            <div style={styles.morningButtons}>
              <button style={styles.successBtn} onClick={() => handleMorningReport(true)}>
                ✓ できた
              </button>
              <button style={styles.failBtn} onClick={() => handleMorningReport(false)}>
                ✗ できなかった
              </button>
            </div>
          ) : (
            <div style={styles.morningResult}>
              {morningResult ? (
                <p style={{ color: "#22c55e", fontSize: 18, fontWeight: 700 }}>
                  記録しました。継続していきましょう。
                </p>
              ) : (
                <p style={{ color: "#f59e0b", fontSize: 18, fontWeight: 700 }}>
                  正直に報告できたことが大事です。今夜こそ。
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === "facts") {
    const fact = todayFacts[factIndex];
    if (!fact) return null;
    const progress = factIndex + 1;
    const total = todayFacts.length;

    return (
      <div style={styles.container}>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${(progress / total) * 100}%` }} />
        </div>
        <div style={styles.progressLabel}>
          {progress} / {total}
        </div>

        <div style={styles.factCard}>
          <div style={styles.categoryBadge}>{fact.icon} {fact.category}</div>

          <div style={styles.metricBlock}>
            <div style={styles.metricValue}>{fact.metric}</div>
            <div style={styles.metricLabel}>{fact.metricLabel}</div>
          </div>

          <h2 style={styles.factTitle}>{fact.title}</h2>
          <p style={styles.factBody}>{fact.body}</p>
          <p style={styles.factSource}>{fact.source}</p>
        </div>

        <button style={styles.nextBtn} onClick={handleNextFact}>
          {factIndex < todayFacts.length - 1 ? "次の事実を見る →" : "ルール確認へ →"}
        </button>
      </div>
    );
  }

  if (phase === "rules") {
    return (
      <div style={styles.container}>
        <h2 style={styles.rulesTitle}>今夜守る4つのルール</h2>
        <div style={styles.rulesList}>
          {RULES.map((r, i) => (
            <div key={i} style={styles.ruleItem}>
              <span style={styles.ruleIcon}>{r.icon}</span>
              <span style={styles.ruleText}>{r.text}</span>
            </div>
          ))}
        </div>

        {data.streak > 0 && (
          <div style={styles.streakBanner}>
            🔥 現在の連続達成: {data.streak}日
          </div>
        )}

        <div style={styles.weekGrid}>
          {recentDays.map((d, i) => (
            <div key={i} style={styles.weekDay}>
              <div style={styles.weekDayLabel}>{d.day}</div>
              <div style={{
                ...styles.weekDot,
                backgroundColor: d.result === true ? "#22c55e" : d.result === false ? "#ef4444" : d.committed ? "#f59e0b" : "#333",
              }}>
                {d.result === true ? "✓" : d.result === false ? "✗" : d.committed ? "−" : ""}
              </div>
            </div>
          ))}
        </div>

        {!rulesAcked ? (
          <button style={styles.ackBtn} onClick={handleAckRules}>
            理解した。すべて読んだ。
          </button>
        ) : (
          <button style={styles.commitBtn} onClick={handleCommit}>
            今夜、23:00に消灯することを誓う
          </button>
        )}
      </div>
    );
  }

  if (phase === "done") {
    const now = new Date();
    const target = new Date();
    target.setHours(23, 0, 0, 0);
    const diff = target - now;
    const hoursLeft = diff > 0 ? Math.floor(diff / 3600000) : 0;
    const minsLeft = diff > 0 ? Math.floor((diff % 3600000) / 60000) : 0;

    return (
      <div style={styles.container}>
        <div style={styles.doneCard}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
          <h2 style={styles.doneTitle}>今日のチェックイン完了</h2>
          <p style={styles.doneBody}>
            今夜の誓いは記録されました。
          </p>
          {diff > 0 && (
            <div style={styles.countdown}>
              <div style={styles.countdownLabel}>消灯まで</div>
              <div style={styles.countdownValue}>{hoursLeft}時間 {minsLeft}分</div>
            </div>
          )}
          <div style={styles.doneReminder}>
            20:00 → YouTube終了{"\n"}
            23:00 → スマホをリビングへ → 消灯
          </div>

          {data.streak > 0 && (
            <div style={{ ...styles.streakBanner, marginTop: 20 }}>
              🔥 連続達成: {data.streak}日
            </div>
          )}

          <button style={styles.resetBtn} onClick={handleReset}>
            もう一度チェックインする（テスト用）
          </button>
        </div>
      </div>
    );
  }

  return null;
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0a0a0a",
    color: "#e5e5e5",
    fontFamily: '-apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif',
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 100,
    fontSize: 16,
    color: "#666",
  },

  // Progress
  progressBar: {
    width: "100%",
    maxWidth: 400,
    height: 3,
    backgroundColor: "#222",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#dc2626",
    transition: "width 0.3s ease",
  },
  progressLabel: {
    fontSize: 12,
    color: "#555",
    marginBottom: 20,
    fontVariantNumeric: "tabular-nums",
  },

  // Fact card
  factCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#111",
    border: "1px solid #1a1a1a",
    borderRadius: 12,
    padding: "28px 22px",
    marginBottom: 20,
  },
  categoryBadge: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 20,
  },
  metricBlock: {
    marginBottom: 22,
  },
  metricValue: {
    fontSize: 56,
    fontWeight: 800,
    color: "#dc2626",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.03em",
  },
  metricLabel: {
    fontSize: 13,
    color: "#777",
    marginTop: 6,
  },
  factTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#f5f5f5",
    lineHeight: 1.4,
    marginBottom: 14,
    margin: "0 0 14px 0",
  },
  factBody: {
    fontSize: 15,
    lineHeight: 1.7,
    color: "#b0b0b0",
    marginBottom: 16,
  },
  factSource: {
    fontSize: 11,
    color: "#555",
    fontStyle: "italic",
  },

  // Buttons
  nextBtn: {
    width: "100%",
    maxWidth: 400,
    padding: "16px 24px",
    backgroundColor: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.02em",
  },

  // Rules
  rulesTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#f5f5f5",
    marginBottom: 20,
    margin: "10px 0 20px 0",
  },
  rulesList: {
    width: "100%",
    maxWidth: 400,
    marginBottom: 24,
  },
  ruleItem: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 18px",
    backgroundColor: "#111",
    border: "1px solid #1a1a1a",
    borderRadius: 10,
    marginBottom: 8,
  },
  ruleIcon: {
    fontSize: 22,
    flexShrink: 0,
  },
  ruleText: {
    fontSize: 15,
    color: "#d4d4d4",
    lineHeight: 1.5,
  },
  ackBtn: {
    width: "100%",
    maxWidth: 400,
    padding: "16px 24px",
    backgroundColor: "#222",
    color: "#999",
    border: "1px solid #333",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  commitBtn: {
    width: "100%",
    maxWidth: 400,
    padding: "18px 24px",
    backgroundColor: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 17,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 8,
    letterSpacing: "0.02em",
  },

  // Streak
  streakBanner: {
    fontSize: 16,
    fontWeight: 700,
    color: "#f59e0b",
    textAlign: "center",
    padding: "10px 0",
    marginBottom: 16,
  },

  // Week grid
  weekGrid: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
    marginBottom: 24,
    width: "100%",
    maxWidth: 400,
  },
  weekDay: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  weekDayLabel: {
    fontSize: 11,
    color: "#555",
  },
  weekDot: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
  },

  // Morning
  morningCard: {
    maxWidth: 400,
    width: "100%",
    backgroundColor: "#111",
    border: "1px solid #1a1a1a",
    borderRadius: 12,
    padding: "32px 22px",
    textAlign: "center",
    marginTop: 40,
  },
  morningTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#f5f5f5",
    marginBottom: 12,
    margin: "0 0 12px 0",
  },
  morningBody: {
    fontSize: 15,
    color: "#999",
    marginBottom: 24,
  },
  morningButtons: {
    display: "flex",
    gap: 12,
  },
  successBtn: {
    flex: 1,
    padding: "14px 0",
    backgroundColor: "#14532d",
    color: "#22c55e",
    border: "1px solid #166534",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  failBtn: {
    flex: 1,
    padding: "14px 0",
    backgroundColor: "#450a0a",
    color: "#ef4444",
    border: "1px solid #7f1d1d",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  morningResult: {
    padding: "12px 0",
  },

  // Done
  doneCard: {
    maxWidth: 400,
    width: "100%",
    textAlign: "center",
    marginTop: 40,
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#f5f5f5",
    marginBottom: 10,
    margin: "0 0 10px 0",
  },
  doneBody: {
    fontSize: 15,
    color: "#777",
    marginBottom: 24,
  },
  countdown: {
    backgroundColor: "#111",
    border: "1px solid #1a1a1a",
    borderRadius: 12,
    padding: "20px",
    marginBottom: 20,
  },
  countdownLabel: {
    fontSize: 12,
    color: "#555",
    marginBottom: 6,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  countdownValue: {
    fontSize: 32,
    fontWeight: 800,
    color: "#dc2626",
    fontVariantNumeric: "tabular-nums",
  },
  doneReminder: {
    fontSize: 14,
    color: "#888",
    lineHeight: 1.8,
    whiteSpace: "pre-line",
    backgroundColor: "#111",
    border: "1px solid #1a1a1a",
    borderRadius: 12,
    padding: "16px 20px",
    textAlign: "left",
  },
  resetBtn: {
    marginTop: 32,
    padding: "10px 20px",
    backgroundColor: "transparent",
    color: "#444",
    border: "1px solid #222",
    borderRadius: 8,
    fontSize: 12,
    cursor: "pointer",
  },
};
