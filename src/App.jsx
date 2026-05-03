import { useState, useEffect, useRef } from "react";

const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "English", "History", "Economics"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const GOALS = ["Exam Preparation", "Daily Revision", "Learn New Topic", "Complete Assignments", "Quick Review"];

const COLOR_MAP = {
  Mathematics: { bg: "#fef3c7", accent: "#d97706", dot: "#f59e0b" },
  Physics: { bg: "#dbeafe", accent: "#1d4ed8", dot: "#3b82f6" },
  Chemistry: { bg: "#fce7f3", accent: "#be185d", dot: "#ec4899" },
  Biology: { bg: "#dcfce7", accent: "#15803d", dot: "#22c55e" },
  "Computer Science": { bg: "#ede9fe", accent: "#6d28d9", dot: "#8b5cf6" },
  English: { bg: "#ffedd5", accent: "#c2410c", dot: "#f97316" },
  History: { bg: "#e0f2fe", accent: "#0369a1", dot: "#0ea5e9" },
  Economics: { bg: "#f0fdf4", accent: "#166534", dot: "#4ade80" },
};

export default function StudyPlanner() {
  const [step, setStep] = useState("form"); // form | loading | plan
  const [formData, setFormData] = useState({
    name: "",
    subjects: [],
    hoursPerDay: 3,
    goal: "",
    examDate: "",
    weakSubjects: [],
  });
  const [plan, setPlan] = useState(null);
  const [aiTip, setAiTip] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [activeDay, setActiveDay] = useState(0);
  const [completedSessions, setCompletedSessions] = useState({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const loadingMessages = [
    "🧠 Analyzing your subjects...",
    "📊 Calculating optimal study blocks...",
    "⚡ Applying spaced repetition logic...",
    "📅 Building your weekly schedule...",
    "✨ Personalizing your plan...",
  ];

  useEffect(() => {
    if (step === "loading") {
      let i = 0;
      const interval = setInterval(() => {
        setLoadingMsg(loadingMessages[i % loadingMessages.length]);
        i++;
      }, 800);
      return () => clearInterval(interval);
    }
  }, [step]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const toggleSubject = (sub) => {
    setFormData((f) => ({
      ...f,
      subjects: f.subjects.includes(sub) ? f.subjects.filter((s) => s !== sub) : [...f.subjects, sub],
      weakSubjects: f.weakSubjects.filter((s) => f.subjects.includes(s) || s !== sub),
    }));
  };

  const toggleWeak = (sub) => {
    setFormData((f) => ({
      ...f,
      weakSubjects: f.weakSubjects.includes(sub) ? f.weakSubjects.filter((s) => s !== sub) : [...f.weakSubjects, sub],
    }));
  };

  const generatePlan = async () => {
    setStep("loading");
    const prompt = `You are an expert AI study planner. Create a detailed 7-day weekly study plan for a student.

Student Info:
- Name: ${formData.name || "Student"}
- Subjects: ${formData.subjects.join(", ")}
- Study hours per day: ${formData.hoursPerDay}
- Goal: ${formData.goal}
- Exam date: ${formData.examDate || "Not specified"}
- Weak subjects (need more time): ${formData.weakSubjects.join(", ") || "None specified"}

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "studentName": "string",
  "weeklyPlan": {
    "Mon": [{"subject": "string", "topic": "string", "duration": number, "type": "string", "priority": "high|medium|low"}],
    "Tue": [...],
    "Wed": [...],
    "Thu": [...],
    "Fri": [...],
    "Sat": [...],
    "Sun": [...]
  },
  "studyTip": "one motivational personalized study tip under 20 words",
  "totalWeeklyHours": number,
  "focusSubject": "string"
}

Rules:
- Each session duration in minutes (30-90 min blocks)
- Total daily sessions should sum to approximately ${formData.hoursPerDay * 60} minutes
- Give 40% more time to weak subjects
- type must be one of: "Study", "Practice", "Revision", "Break", "Mock Test"
- Sunday can have lighter schedule
- Include at least one Break session per day`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content.map((c) => c.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setPlan(parsed);
      setAiTip(parsed.studyTip);
      setStep("plan");
    } catch (e) {
      // Fallback plan
      const fallback = generateFallbackPlan();
      setPlan(fallback);
      setAiTip("Consistency beats perfection — show up every day!");
      setStep("plan");
    }
  };

  const generateFallbackPlan = () => {
    const subs = formData.subjects.length ? formData.subjects : ["Mathematics", "Physics"];
    const plan = {};
    DAYS.forEach((day, i) => {
      const sessions = [];
      if (i < 6) {
        subs.slice(0, 2).forEach((sub) => {
          sessions.push({ subject: sub, topic: "Core Concepts", duration: 60, type: "Study", priority: "high" });
        });
        sessions.push({ subject: "All", topic: "Quick Review", duration: 30, type: "Revision", priority: "medium" });
      } else {
        sessions.push({ subject: subs[0], topic: "Mock Test", duration: 90, type: "Mock Test", priority: "high" });
        sessions.push({ subject: "All", topic: "Rest & Light Reading", duration: 30, type: "Break", priority: "low" });
      }
      plan[day] = sessions;
    });
    return { studentName: formData.name || "Student", weeklyPlan: plan, studyTip: "Stay consistent!", totalWeeklyHours: formData.hoursPerDay * 7, focusSubject: subs[0] };
  };

  const toggleComplete = (day, idx) => {
    const key = `${day}-${idx}`;
    setCompletedSessions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((m) => [...m, { role: "user", text: userMsg }]);
    setChatLoading(true);

    const context = plan ? `The student has a study plan focused on: ${formData.subjects.join(", ")}. Goal: ${formData.goal}. Weak subjects: ${formData.weakSubjects.join(", ") || "none"}.` : "";

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            { role: "user", content: `You are a friendly AI study coach. ${context} Answer this study question concisely (max 3 sentences): ${userMsg}` }
          ],
        }),
      });
      const data = await res.json();
      const reply = data.content.map((c) => c.text || "").join("");
      setChatMessages((m) => [...m, { role: "ai", text: reply }]);
    } catch {
      setChatMessages((m) => [...m, { role: "ai", text: "I'm having trouble connecting right now. Try again in a moment!" }]);
    }
    setChatLoading(false);
  };

  const typeColors = {
    Study: { bg: "#dbeafe", text: "#1e40af" },
    Practice: { bg: "#fce7f3", text: "#9d174d" },
    Revision: { bg: "#dcfce7", text: "#14532d" },
    Break: { bg: "#fef3c7", text: "#92400e" },
    "Mock Test": { bg: "#ede9fe", text: "#4c1d95" },
  };

  const priorityDot = { high: "#ef4444", medium: "#f59e0b", low: "#6b7280" };

  const completedCount = Object.values(completedSessions).filter(Boolean).length;
  const totalSessions = plan ? Object.values(plan.weeklyPlan).flat().length : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Georgia', serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1B2A4A 0%, #2E4A7A 100%)", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>📚</span>
          <div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: "bold", letterSpacing: 1 }}>StudyAI Planner</div>
            <div style={{ color: "#93c5fd", fontSize: 12 }}>Built for study </div>
          </div>
        </div>
        {step === "plan" && (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "6px 16px", color: "#fff", fontSize: 13 }}>
              ✅ {completedCount}/{totalSessions} done
            </div>
            <button onClick={() => { setStep("form"); setPlan(null); setCompletedSessions({}); }} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "6px 16px", borderRadius: 20, cursor: "pointer", fontSize: 13 }}>
              ↺ New Plan
            </button>
          </div>
        )}
      </div>

      {/* FORM STEP */}
      {step === "form" && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, color: "#1B2A4A", margin: 0 }}>Build Your AI Study Plan</h1>
            <p style={{ color: "#64748b", marginTop: 8 }}>Tell us about yourself and we'll create a personalized weekly schedule</p>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 20 }}>
            <label style={{ display: "block", fontWeight: "bold", color: "#1B2A4A", marginBottom: 8 }}>Your Name</label>
            <input value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Dipali Gupta"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
          </div>

          <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 20 }}>
            <label style={{ display: "block", fontWeight: "bold", color: "#1B2A4A", marginBottom: 12 }}>Select Subjects</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {SUBJECTS.map((s) => (
                <button key={s} onClick={() => toggleSubject(s)}
                  style={{ padding: "8px 16px", borderRadius: 30, border: "2px solid", borderColor: formData.subjects.includes(s) ? "#2E4A7A" : "#e2e8f0", background: formData.subjects.includes(s) ? "#2E4A7A" : "#fff", color: formData.subjects.includes(s) ? "#fff" : "#475569", cursor: "pointer", fontSize: 13, fontWeight: formData.subjects.includes(s) ? "bold" : "normal", transition: "all 0.2s" }}>
                  {s}
                </button>
              ))}
            </div>
            {formData.subjects.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>Which subjects are you weak in? (optional)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {formData.subjects.map((s) => (
                    <button key={s} onClick={() => toggleWeak(s)}
                      style={{ padding: "6px 14px", borderRadius: 30, border: "2px solid", borderColor: formData.weakSubjects.includes(s) ? "#ef4444" : "#e2e8f0", background: formData.weakSubjects.includes(s) ? "#fef2f2" : "#f8fafc", color: formData.weakSubjects.includes(s) ? "#dc2626" : "#64748b", cursor: "pointer", fontSize: 12 }}>
                      {formData.weakSubjects.includes(s) ? "⚠️ " : ""}{s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
              <label style={{ display: "block", fontWeight: "bold", color: "#1B2A4A", marginBottom: 8 }}>Study Hours / Day</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" min={1} max={10} value={formData.hoursPerDay} onChange={(e) => setFormData((f) => ({ ...f, hoursPerDay: +e.target.value }))}
                  style={{ flex: 1, accentColor: "#2E4A7A" }} />
                <span style={{ fontSize: 22, fontWeight: "bold", color: "#2E4A7A", minWidth: 36 }}>{formData.hoursPerDay}h</span>
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
              <label style={{ display: "block", fontWeight: "bold", color: "#1B2A4A", marginBottom: 8 }}>Exam Date</label>
              <input type="date" value={formData.examDate} onChange={(e) => setFormData((f) => ({ ...f, examDate: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, boxSizing: "border-box" }} />
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 24 }}>
            <label style={{ display: "block", fontWeight: "bold", color: "#1B2A4A", marginBottom: 12 }}>Your Study Goal</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {GOALS.map((g) => (
                <button key={g} onClick={() => setFormData((f) => ({ ...f, goal: g }))}
                  style={{ padding: "8px 18px", borderRadius: 30, border: "2px solid", borderColor: formData.goal === g ? "#2E4A7A" : "#e2e8f0", background: formData.goal === g ? "#2E4A7A" : "#fff", color: formData.goal === g ? "#fff" : "#475569", cursor: "pointer", fontSize: 13 }}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <button onClick={generatePlan}
            disabled={formData.subjects.length === 0 || !formData.goal}
            style={{ width: "100%", padding: "16px", background: formData.subjects.length > 0 && formData.goal ? "linear-gradient(135deg, #1B2A4A, #2E4A7A)" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 14, fontSize: 17, fontWeight: "bold", cursor: formData.subjects.length > 0 && formData.goal ? "pointer" : "not-allowed", letterSpacing: 0.5 }}>
            ✨ Generate My AI Study Plan
          </button>
          {formData.subjects.length === 0 && <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 8 }}>Select at least one subject to continue</p>}
        </div>
      )}

      {/* LOADING STEP */}
      {step === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", border: "6px solid #e2e8f0", borderTop: "6px solid #2E4A7A", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: 18, color: "#1B2A4A", fontWeight: "bold" }}>{loadingMsg}</p>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>Claude AI is crafting your personalized plan...</p>
        </div>
      )}

      {/* PLAN STEP */}
      {step === "plan" && plan && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
          {/* AI Tip Banner */}
          <div style={{ background: "linear-gradient(135deg, #1B2A4A, #2E4A7A)", borderRadius: 14, padding: "16px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 28 }}>🤖</span>
            <div>
              <div style={{ color: "#93c5fd", fontSize: 12, fontWeight: "bold", marginBottom: 2 }}>AI STUDY TIP FOR YOU</div>
              <div style={{ color: "#fff", fontSize: 15 }}>{aiTip}</div>
            </div>
          </div>

          {/* Stats Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
            {[
              { label: "Weekly Hours", value: plan.totalWeeklyHours + "h", icon: "⏱️" },
              { label: "Focus Subject", value: plan.focusSubject, icon: "🎯" },
              { label: "Progress", value: `${completedCount}/${totalSessions}`, icon: "✅" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#1B2A4A" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Day Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
            {DAYS.map((day, i) => {
              const sessions = plan.weeklyPlan[day] || [];
              const done = sessions.filter((_, idx) => completedSessions[`${day}-${idx}`]).length;
              return (
                <button key={day} onClick={() => setActiveDay(i)}
                  style={{ flex: "0 0 auto", padding: "10px 18px", borderRadius: 30, border: "2px solid", borderColor: activeDay === i ? "#2E4A7A" : "#e2e8f0", background: activeDay === i ? "#2E4A7A" : "#fff", color: activeDay === i ? "#fff" : "#475569", cursor: "pointer", fontSize: 13, fontWeight: activeDay === i ? "bold" : "normal", position: "relative" }}>
                  {day}
                  {done > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#22c55e", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>{done}</span>}
                </button>
              );
            })}
          </div>

          {/* Day Schedule */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 20px", color: "#1B2A4A", fontSize: 18 }}>📅 {DAYS[activeDay]}'s Schedule</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(plan.weeklyPlan[DAYS[activeDay]] || []).map((session, idx) => {
                const key = `${DAYS[activeDay]}-${idx}`;
                const done = completedSessions[key];
                const col = COLOR_MAP[session.subject] || { bg: "#f1f5f9", accent: "#475569", dot: "#64748b" };
                const tc = typeColors[session.type] || { bg: "#f1f5f9", text: "#475569" };
                return (
                  <div key={idx} onClick={() => toggleComplete(DAYS[activeDay], idx)}
                    style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", borderRadius: 12, background: done ? "#f0fdf4" : col.bg, border: `1.5px solid ${done ? "#22c55e" : col.accent + "40"}`, cursor: "pointer", transition: "all 0.2s", opacity: done ? 0.8 : 1 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${done ? "#22c55e" : col.accent}`, background: done ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {done && <span style={{ color: "#fff", fontSize: 14 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: "bold", color: col.accent, fontSize: 15, textDecoration: done ? "line-through" : "none" }}>{session.subject}</span>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: priorityDot[session.priority] || "#64748b", flexShrink: 0 }} />
                      </div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>{session.topic}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span style={{ background: tc.bg, color: tc.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: "bold" }}>{session.type}</span>
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>⏱ {session.duration}m</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 12, textAlign: "center" }}>💡 Tap any session to mark it complete</p>
          </div>

          {/* AI Chat */}
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <button onClick={() => setChatOpen((v) => !v)}
              style={{ width: "100%", padding: "16px 24px", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>🤖</span>
                <span style={{ fontWeight: "bold", color: "#1B2A4A", fontSize: 16 }}>Ask Your AI Study Coach</span>
              </div>
              <span style={{ color: "#94a3b8", fontSize: 18 }}>{chatOpen ? "▲" : "▼"}</span>
            </button>
            {chatOpen && (
              <div style={{ borderTop: "1px solid #f1f5f9" }}>
                <div style={{ maxHeight: 260, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {chatMessages.length === 0 && (
                    <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
                      <p style={{ margin: 0 }}>Ask anything — tips, shortcuts, how to study smarter!</p>
                    </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "80%", padding: "10px 16px", borderRadius: 14, background: m.role === "user" ? "#2E4A7A" : "#f1f5f9", color: m.role === "user" ? "#fff" : "#1e293b", fontSize: 14 }}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display: "flex" }}>
                      <div style={{ padding: "10px 16px", borderRadius: 14, background: "#f1f5f9", color: "#64748b", fontSize: 14 }}>Thinking... 🤔</div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ padding: "12px 16px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 10 }}>
                  <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    placeholder="e.g. How do I study math faster?"
                    style={{ flex: 1, padding: "10px 16px", borderRadius: 30, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none" }} />
                  <button onClick={sendChat} disabled={chatLoading}
                    style={{ padding: "10px 20px", borderRadius: 30, background: "#2E4A7A", color: "#fff", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: 14 }}>
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}