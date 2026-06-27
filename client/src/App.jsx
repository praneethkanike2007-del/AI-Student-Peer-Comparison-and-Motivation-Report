import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  UsersRound
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, clearSession, readUser, saveSession } from "./api";

const studentNav = [
  ["/student/dashboard", LayoutDashboard, "Dashboard"],
  ["/student/profile", UserRound, "Profile"],
  ["/student/attendance", ClipboardCheck, "Attendance"],
  ["/student/marks", BookOpen, "Marks"],
  ["/student/rank", BarChart3, "Rank"],
  ["/student/reports", Sparkles, "Reports"],
  ["/student/assistant", Bot, "Assistant"],
  ["/student/feedback", MessageSquare, "Feedback"]
];

const instructorNav = [
  ["/instructor/dashboard", LayoutDashboard, "Dashboard"],
  ["/instructor/students", UsersRound, "Students"],
  ["/instructor/attendance", ClipboardCheck, "Attendance"],
  ["/instructor/marks", BookOpen, "Marks"],
  ["/instructor/reports", Sparkles, "Reports"],
  ["/instructor/analytics", BarChart3, "Analytics"],
  ["/instructor/remarks", MessageSquare, "Remarks"]
];

const fetchCache = new Map();
const cachePrefix = "smartedu_cache:";
const cacheMs = 5 * 60 * 1000;

function readFetchCache(path) {
  const memory = fetchCache.get(path);
  if (memory && Date.now() - memory.time < cacheMs) return memory.data;
  try {
    const raw = sessionStorage.getItem(`${cachePrefix}${path}`);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.time > cacheMs) return null;
    fetchCache.set(path, cached);
    return cached.data;
  } catch {
    return null;
  }
}

function writeFetchCache(path, data) {
  const cached = { time: Date.now(), data };
  fetchCache.set(path, cached);
  try {
    sessionStorage.setItem(`${cachePrefix}${path}`, JSON.stringify(cached));
  } catch {
    // Storage can fail in private mode; memory cache still helps during this tab.
  }
}

function useFetch(path, deps = []) {
  const cachedData = readFetchCache(path);
  const [state, setState] = useState({ loading: !cachedData, error: "", data: cachedData });
  const load = async (force = false) => {
    const cached = force ? null : readFetchCache(path);
    if (cached) {
      setState({ loading: false, error: "", data: cached });
      return;
    }
    setState((current) => ({ ...current, loading: !current.data, error: "" }));
    try {
      const { data } = await api.get(path);
      writeFetchCache(path, data);
      setState({ loading: false, error: "", data });
    } catch (error) {
      setState({ loading: false, error: error.response?.data?.message || "Unable to load data", data: null });
    }
  };
  useEffect(() => {
    load();
  }, deps);
  return { ...state, reload: () => load(true) };
}

function Shell({ user, children }) {
  const navigate = useNavigate();
  const nav = user.role === "STUDENT" ? studentNav : instructorNav;
  useEffect(() => {
    const paths = user.role === "STUDENT"
      ? ["/student/dashboard", "/student/profile", "/student/attendance", "/student/marks", "/student/rank", "/student/reports", "/student/feedback", "/student/assistant/history", "/ai/status"]
      : ["/instructor/dashboard", "/instructor/students", "/instructor/subjects", "/instructor/attendance/history", "/instructor/marks/history", "/instructor/reports", "/instructor/analytics"];
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      for (const path of paths) {
        if (cancelled || readFetchCache(path)) continue;
        try {
          const { data } = await api.get(path);
          writeFetchCache(path, data);
        } catch {
          // Background prefetch should never block the visible page.
        }
      }
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user.role, user.id]);
  const logout = () => {
    clearSession();
    navigate("/login");
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to={user.role === "STUDENT" ? "/student/dashboard" : "/instructor/dashboard"}>
          <GraduationCap />
          <span>SmartEdu AI</span>
        </Link>
        <nav>
          {nav.map(([href, Icon, label]) => (
            <NavLink key={href} to={href}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          className="ghost-button"
          type="button"
          onClick={logout}
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <p>{user.role === "STUDENT" ? "Student Portal" : "Instructor Portal"}</p>
            <h1>AI Student Peer Comparison Portal</h1>
          </div>
          <div className="top-actions">
            <span className="pill"><ShieldCheck size={16} /> {user.role}</span>
            <span className="icon-pill"><Moon size={17} /></span>
            <button className="logout-button" type="button" onClick={logout}><LogOut size={17} /> Logout</button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function Protected({ role, children }) {
  const user = readUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === "STUDENT" ? "/student/dashboard" : "/instructor/dashboard"} replace />;
  return <Shell user={user}>{children}</Shell>;
}

function LoadingState() {
  return <div className="state">Loading the latest academic data...</div>;
}

function ErrorState({ message }) {
  return <div className="state error">{message}</div>;
}

function EmptyState({ message }) {
  return <div className="state">{message}</div>;
}

function Stat({ label, value, tone = "" }) {
  return (
    <section className={`stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

function SectionTitle({ icon: Icon, title, kicker }) {
  return (
    <div className="section-title">
      {Icon && <span className="section-icon"><Icon size={18} /></span>}
      <div>
        {kicker && <p>{kicker}</p>}
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, tone = "blue" }) {
  return (
    <div className="progress-row">
      <div><span>{label}</span><strong>{value}%</strong></div>
      <div className="progress-track"><span className={tone} style={{ width: `${Math.min(value, 100)}%` }} /></div>
    </div>
  );
}

function InsightCard({ icon: Icon, title, children, tone = "" }) {
  return (
    <article className={`insight-card ${tone}`}>
      <Icon size={20} />
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </article>
  );
}

function Landing() {
  const [overview, setOverview] = useState(null);
  useEffect(() => {
    api.get("/public/overview")
      .then(({ data }) => setOverview(data))
      .catch(() => setOverview(null));
  }, []);
  const curriculum = overview?.curriculum || [
    { code: "DSA204", name: "Data Structures", credits: 4, instructors: ["Institution faculty"] },
    { code: "DBMS210", name: "Database Systems", credits: 4, instructors: ["Institution faculty"] },
    { code: "MATH220", name: "Discrete Mathematics", credits: 3, instructors: ["Institution faculty"] },
    { code: "OS230", name: "Operating Systems", credits: 4, instructors: ["Institution faculty"] },
    { code: "CN240", name: "Computer Networks", credits: 3, instructors: ["Institution faculty"] }
  ];
  return (
    <main className="landing">
      <section className="hero">
        <nav className="home-nav">
          <Link className="home-brand" to="/">
            <GraduationCap size={24} />
            <span>SmartEdu AI</span>
          </Link>
          <Link className="home-login" to="/login">Login</Link>
        </nav>
        <div className="hero-copy">
          <span className="pill"><Sparkles size={16} /> Smart academic growth platform</span>
          <h1>AI Student Peer Comparison, Academic Tracking, and Motivation Portal</h1>
          <h2>Powered by Sri Gowthami Educational Institutions</h2>
          <p>
            Public visitors can learn about the institution, student strength, curriculum, and courses. Approved students
            and instructors can securely enter their academic portals.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to="/login">Open portal</Link>
            <a className="secondary-button" href="#features">Explore modules</a>
          </div>
        </div>
        <div className="hero-panel" aria-label="Platform highlights">
          <div>
            <strong>{overview?.studentCount || "24+"}</strong>
            <span>Institution students</span>
          </div>
          <div>
            <strong>{curriculum.length}</strong>
            <span>Core curriculum subjects</span>
          </div>
          <div>
            <strong>{overview?.instructorCount || "5"}</strong>
            <span>Subject instructors</span>
          </div>
        </div>
      </section>
      <section className="public-overview">
        <div>
          <p>Public Institution View</p>
          <h2>{overview?.institution || "Sri Gowthami Educational Institutions"}</h2>
          <span>
            Outsiders can view this public information only. Portal login is reserved for verified institution students
            and instructors.
          </span>
        </div>
        <div className="public-stats">
          <strong>{overview?.studentCount || "24+"}</strong>
          <span>Students</span>
          <strong>{overview?.courses?.length || 1}</strong>
          <span>Active course batch</span>
          <strong>{curriculum.length}</strong>
          <span>Subjects</span>
        </div>
      </section>
      <section className="curriculum-grid">
        {curriculum.map((subject) => (
          <article className="curriculum-card" key={subject.code}>
            <span>{subject.code} | {subject.credits} credits</span>
            <h2>{subject.name}</h2>
            <p>{subject.instructors?.join(", ") || "Institution faculty"}</p>
          </article>
        ))}
      </section>
      <section id="features" className="feature-grid">
        {[
          ["Student Portal", "Only institution students can view their own profile, attendance, marks, rank, reports, feedback, and AI study assistant."],
          ["Instructor Portal", "Only approved subject instructors can manage attendance, marks, reports, remarks, and performance monitoring."],
          ["Visitor Access", "Visitors and outsiders stay on the public homepage with institution details, curriculum, and course information."]
        ].map(([title, text]) => (
          <article className="feature" key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <section className="home-strip">
        <span>Academic tracking</span>
        <span>Peer comparison</span>
        <span>AI assistant</span>
        <span>Instructor analytics</span>
      </section>
    </main>
  );
}

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    await signIn(form);
  }
  async function signIn(credentials) {
    if (!credentials.email?.trim() || !credentials.password?.trim()) {
      setError("Please enter email and password, or click a sample account below.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", credentials);
      saveSession(data);
      navigate(data.user.role === "STUDENT" ? "/student/dashboard" : "/instructor/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please check the deployed API status at /api/public/status.");
    } finally {
      setLoading(false);
    }
  }
  const accountHints = [
    ["Student", "Aarav Nair", "student@smartedu.test"],
    ["Student", "Samaira Ali", "samaira@smartedu.test"],
    ["Student", "Diya Menon", "diya@smartedu.test"],
    ["Instructor", "Dr. Meera Sharma", "instructor@smartedu.test"],
    ["Instructor", "Prof. Farah Siddiqui", "farah@smartedu.test"],
    ["Instructor", "Prof. Anil Varma", "anil@smartedu.test"]
  ];
  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={submit}>
        <GraduationCap size={36} />
        <h1>Institution login</h1>
        <p>Only approved Sri Gowthami students and instructors can enter the portal. Visitors can view public information on the homepage.</p>
        <label>Email<input required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <div className="inline-error">{error}</div>}
        <button className="primary-button login-submit" disabled={loading}>{loading ? "Checking access..." : "Sign in"}</button>
        <div className="sample-accounts">
          <div>
            <p>Ready-made sample accounts for client demo</p>
            <span>Click any account to sign in directly. Password for all samples: <strong>Password123!</strong></span>
          </div>
          {accountHints.map(([role, name, email]) => (
            <button key={email} type="button" disabled={loading} onClick={() => signIn({ email, password: "Password123!" })}>
              <strong>{name}</strong>
              <small>{role}</small>
              <em>{email}</em>
            </button>
          ))}
        </div>
        <Link className="secondary-button" to="/">View public homepage</Link>
      </form>
    </main>
  );
}

function StudentDashboard() {
  const { loading, error, data } = useFetch("/student/dashboard");
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const monthTrend = [...data.attendance.monthly].reverse();
  const weakestSubject = [...data.marks.bySubject].sort((a, b) => a.percentage - b.percentage)[0];
  return (
    <div className="page-stack">
      <section className="intro-band">
        <div>
          <p>{data.student.studentCode} | {data.student.batch.name}</p>
          <h2>Hello, {data.student.fullName}</h2>
        </div>
        <span className="pill">Rank {data.comparison.rank || "-"} of {data.comparison.batchSize}</span>
      </section>
      <div className="stats-grid">
        <Stat label="Attendance" value={`${data.attendance.percentage}%`} tone={data.attendance.shortage ? "warn" : "good"} />
        <Stat label="Marks" value={`${data.marks.percentage}%`} />
        <Stat label="Batch average" value={`${data.comparison.batchAverage}%`} />
        <Stat label="Status" value={data.comparison.status} />
      </div>
      <div className="insight-grid">
        <InsightCard icon={Target} title="Today focus" tone="blue">
          {weakestSubject ? `Revise ${weakestSubject.subject} first. Your current subject score is ${weakestSubject.percentage}%.` : "Keep your revision rhythm steady across all subjects."}
        </InsightCard>
        <InsightCard icon={CalendarDays} title="Attendance signal" tone={data.attendance.shortage ? "amber" : "teal"}>
          {data.attendance.shortage ? "Attendance is below the safe threshold. Prioritize every upcoming class." : "Attendance is healthy. Maintain the same consistency this month."}
        </InsightCard>
        <InsightCard icon={TrendingUp} title="Peer position" tone="teal">
          You are {data.comparison.status} with a {Math.abs(data.comparison.studentPercentage - data.comparison.batchAverage)} point gap against batch average.
        </InsightCard>
      </div>
      <div className="two-col">
        <section className="panel">
          <SectionTitle icon={BookOpen} title="Subject marks" kicker="Published academic performance" />
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.marks.bySubject}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="subject" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="percentage" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel">
          <SectionTitle icon={Sparkles} title="Latest AI feedback" kicker="Personalized guidance" />
          {data.feedback.length ? <p className="report-text">{data.feedback[0].content}</p> : <EmptyState message="Generate feedback from the feedback page." />}
          <SectionTitle icon={Bell} title="Notifications" />
          <ul className="clean-list">
            {data.notifications.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.body}</span></li>)}
          </ul>
        </section>
      </div>
      <div className="two-col">
        <section className="panel">
          <SectionTitle icon={ClipboardCheck} title="Monthly attendance trend" />
          {monthTrend.length ? (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={monthTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area dataKey="percentage" stroke="#0f766e" fill="#ccfbf1" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No monthly attendance trend yet." />}
        </section>
        <section className="panel">
          <SectionTitle icon={CheckCircle2} title="Improvement plan" />
          <div className="task-list">
            <label><input type="checkbox" /> Attend the next three subject sessions without absence</label>
            <label><input type="checkbox" /> Complete one revision set for the weakest subject</label>
            <label><input type="checkbox" /> Generate a peer comparison report this week</label>
          </div>
        </section>
      </div>
    </div>
  );
}

function Profile() {
  const { loading, error, data } = useFetch("/student/profile");
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const s = data.student;
  const fields = {
    "Full name": s.fullName,
    "Student ID": s.studentCode,
    "Roll number": s.rollNumber,
    Gender: s.gender,
    Email: s.user.email,
    Phone: s.phone,
    "Parent or guardian": s.parentName,
    "Parent contact": s.parentContact,
    Address: s.address,
    Course: s.batch.course,
    Branch: s.batch.branch,
    "Year / semester": `${s.batch.year} / ${s.batch.semester}`,
    Section: s.batch.section,
    "Admission number": s.admissionNumber,
    Residence: s.residenceType
  };
  return <KeyValue title="Student Profile" fields={fields} />;
}

function KeyValue({ title, fields }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="kv-grid">
        {Object.entries(fields).map(([key, value]) => (
          <div key={key}><span>{key}</span><strong>{value}</strong></div>
        ))}
      </div>
    </section>
  );
}

function Attendance() {
  const { loading, error, data } = useFetch("/student/attendance");
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  return (
    <div className="page-stack">
      <div className="stats-grid">
        <Stat label="Total sessions" value={data.total} />
        <Stat label="Present or late" value={data.present} />
        <Stat label="Attendance" value={`${data.percentage}%`} tone={data.shortage ? "warn" : "good"} />
        <Stat label="Shortage warning" value={data.shortage ? "Yes" : "No"} />
      </div>
      <section className="panel">
        <h2>Subject-wise attendance</h2>
        <DataTable columns={["Subject", "Present", "Total", "Percentage"]} rows={data.bySubject.map((r) => [r.subject, r.present, r.total, `${r.percentage}%`])} />
      </section>
      <section className="panel">
        <h2>Date-wise records</h2>
        <DataTable columns={["Date", "Subject", "Status", "Topic"]} rows={data.records.map((r) => [new Date(r.session.date).toLocaleDateString(), r.session.subject.name, r.status, r.session.topic || "-"])} />
      </section>
    </div>
  );
}

function Marks() {
  const { loading, error, data } = useFetch("/student/marks");
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  return (
    <div className="page-stack">
      <div className="stats-grid">
        <Stat label="Total marks" value={`${data.totalScore}/${data.totalMax}`} />
        <Stat label="Percentage" value={`${data.percentage}%`} />
        <Stat label="Grade" value={data.grade} />
      </div>
      <section className="panel">
        <h2>Published marks</h2>
        <DataTable columns={["Subject", "Exam", "Type", "Score", "Grade"]} rows={data.marks.map((m) => [m.subject.name, m.exam.title, m.exam.type, `${m.score}/${m.exam.maxMarks}`, m.grade])} />
      </section>
    </div>
  );
}

function Rank() {
  const { loading, error, data } = useFetch("/student/rank");
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  return (
    <div className="page-stack">
      <div className="stats-grid">
        <Stat label="Current rank" value={data.rank || "-"} />
        <Stat label="Batch size" value={data.batchSize} />
        <Stat label="Your score" value={`${data.studentPercentage}%`} />
        <Stat label="Batch average" value={`${data.batchAverage}%`} />
      </div>
      <section className="panel">
        <SectionTitle icon={BarChart3} title="Anonymized peer comparison" kicker="Private batch distribution" />
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data.anonymizedDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Line dataKey="percentage" stroke="#0f766e" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </section>
      <section className="panel">
        <SectionTitle icon={Target} title="Comparison interpretation" />
        <div className="insight-grid compact">
          <InsightCard icon={ShieldCheck} title="Privacy">
            Other student identities are hidden. Only anonymous peer labels are shown.
          </InsightCard>
          <InsightCard icon={TrendingUp} title="Standing">
            Your current performance is {data.status}; rank and average update as instructors publish marks.
          </InsightCard>
          <InsightCard icon={BookOpen} title="Next academic move">
            Focus on raising the lowest subject percentage before chasing rank alone.
          </InsightCard>
        </div>
      </section>
    </div>
  );
}

function StudentReports() {
  const { loading, error, data, reload } = useFetch("/student/reports");
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState("Current semester");
  async function createReport() {
    setBusy(true);
    await api.post("/ai/peer-report", { period });
    await reload();
    setBusy(false);
  }
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  return (
    <div className="page-stack">
      <section className="panel">
        <SectionTitle icon={Sparkles} title="Generate Honest Academic Report" kicker="Uses your actual marks, attendance, rank, and batch average" />
        <div className="form-grid">
          <label>Reporting period<input value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
        </div>
        <button className="primary-button" onClick={createReport} disabled={busy}>{busy ? "Generating..." : "Generate actual report"}</button>
      </section>
      <ReportsList title="AI Report History" reports={data.reports} />
    </div>
  );
}

function Feedback() {
  const { loading, error, data, reload } = useFetch("/student/feedback");
  const [busy, setBusy] = useState(false);
  async function createFeedback() {
    setBusy(true);
    await api.post("/ai/feedback");
    await reload();
    setBusy(false);
  }
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  return (
    <section className="panel">
      <div className="section-head">
        <h2>Smart Feedback</h2>
        <button className="primary-button" onClick={createFeedback}>{busy ? "Generating..." : "Generate feedback"}</button>
      </div>
      {data.feedback.length ? data.feedback.map((item) => <article className="report" key={item.id}><p>{item.content}</p><span>{new Date(item.createdAt).toLocaleString()}</span></article>) : <EmptyState message="No feedback generated yet." />}
    </section>
  );
}

function Assistant() {
  const { loading, error, data, reload } = useFetch("/student/assistant/history");
  const dashboard = useFetch("/student/dashboard");
  const aiStatus = useFetch("/ai/status");
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [askError, setAskError] = useState("");
  async function ask(event) {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setAskError("");
    try {
      await api.post("/ai/chat", { question, mode });
      setQuestion("");
      await reload();
    } catch (err) {
      setAskError(err.response?.data?.message || "Assistant could not answer right now");
    } finally {
      setBusy(false);
    }
  }
  const context = dashboard.data;
  const weakest = context ? [...context.marks.bySubject].sort((a, b) => a.percentage - b.percentage)[0] : null;
  const quickPrompts = [
    { text: "Give me the best study plan of 5 hours according to my 5 different subjects", mode: "auto" },
    { text: "Analyze my marks, attendance, rank, and tell me exactly how to improve", mode: "auto" },
    { text: weakest ? `Make a study plan for my weakest subject: ${weakest.subject}` : "Make a study plan for my weakest subject", mode: "practice" },
    { text: "Write an exam-ready answer on SQL joins with example", mode: "exam" },
    { text: "Explain CPU scheduling step by step with FCFS, SJF, and Round Robin", mode: "steps" }
  ];
  return (
    <div className="page-stack">
      <section className="intro-band">
        <div>
          <p>Academic doubt solving with your real progress context</p>
          <h2>AI Study Assistant</h2>
        </div>
        {context && <span className="pill">Rank {context.comparison.rank} | Marks {context.marks.percentage}%</span>}
      </section>
      <div className="assistant-grid">
        <section className="panel">
          <SectionTitle icon={Bot} title="Ask a Doubt" kicker="Concepts, summaries, steps, comparisons, practice" />
          <div className="prompt-row rich-prompts">
            {quickPrompts.map((prompt) => <button key={prompt.text} type="button" onClick={() => { setQuestion(prompt.text); setMode(prompt.mode); }}>{prompt.text}</button>)}
          </div>
          <form className="chat-form" onSubmit={ask}>
            <label>Answer mode
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="auto">Auto detect</option>
                <option value="explain">Clear explanation</option>
                <option value="steps">Step-by-step</option>
                <option value="summary">Short summary</option>
                <option value="practice">Practice questions</option>
                <option value="exam">Exam-ready answer</option>
              </select>
            </label>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a specific doubt, e.g. Analyze my rank, explain OS deadlock, solve binary search complexity, or make a plan for my weakest subject..." />
            <button className="primary-button" disabled={busy}>{busy ? "Thinking..." : "Ask AI"}</button>
            {askError && <span className="inline-error">{askError}</span>}
          </form>
        </section>
        <section className="panel">
          <SectionTitle icon={Target} title="Your Study Context" kicker="Used by the assistant" />
          {dashboard.loading && <LoadingState />}
          {dashboard.error && <ErrorState message={dashboard.error} />}
          {context && (
            <div className="context-list">
              <p>
                <strong>AI engine:</strong>{" "}
                {aiStatus.loading
                  ? "Checking..."
                  : aiStatus.data?.openAiConfigured
                    ? `Real OpenAI API (${aiStatus.data.model})`
                    : "Demo academic engine active"}
              </p>
              {!aiStatus.loading && !aiStatus.data?.openAiConfigured && (
                <p className="success">
                  Demo answers are enabled now. Add OPENAI_API_KEY in server/.env later to switch this assistant to real OpenAI.
                </p>
              )}
              <ProgressBar label="Attendance" value={context.attendance.percentage} tone={context.attendance.shortage ? "amber" : "teal"} />
              <ProgressBar label="Marks" value={context.marks.percentage} />
              <p><strong>Weakest subject:</strong> {weakest ? `${weakest.subject} (${weakest.percentage}%)` : "Not enough marks yet"}</p>
              <p><strong>Batch average:</strong> {context.comparison.batchAverage}%</p>
              <p><strong>Assistant focus:</strong> clearer explanations, exam-style answers, and practice linked to weak areas.</p>
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <SectionTitle icon={MessageSquare} title="Chat History" kicker="Newest answers first" />
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {data?.chats?.length ? data.chats.map((chat) => <article className="chat-item rich-chat" key={chat.id}><strong>{chat.prompt}</strong><p>{chat.response}</p></article>) : !loading && <EmptyState message="Your AI chat history will appear here." />}
      </section>
    </div>
  );
}

function DataTable({ columns, rows }) {
  if (!rows.length) return <EmptyState message="No records found." />;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function InstructorDashboard() {
  const { loading, error, data } = useFetch("/instructor/dashboard");
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const watchCount = data.lowAttendance.length + data.lowPerformers.length;
  return (
    <div className="page-stack">
      <section className="intro-band instructor">
        <div>
          <p>Assigned cohort monitoring</p>
          <h2>Instructor Command Center</h2>
        </div>
        <span className="pill">{watchCount} students need review</span>
      </section>
      <div className="stats-grid">
        <Stat label="Assigned students" value={data.totalStudents} />
        <Stat label="Attendance average" value={`${data.attendanceAverage}%`} />
        <Stat label="Marks average" value={`${data.marksAverage}%`} />
        <Stat label="AI reports" value={data.reportUsage} />
      </div>
      <div className="insight-grid">
        <InsightCard icon={ClipboardCheck} title="Attendance action" tone={data.attendanceAverage < 80 ? "amber" : "teal"}>
          Cohort attendance average is {data.attendanceAverage}%. Students below 75% are surfaced automatically.
        </InsightCard>
        <InsightCard icon={BookOpen} title="Performance action" tone={data.marksAverage < 70 ? "amber" : "blue"}>
          Marks average is {data.marksAverage}%. Use the analytics view to isolate weak students by subject trend.
        </InsightCard>
        <InsightCard icon={Sparkles} title="AI monitoring" tone="blue">
          Review generated reports to understand motivation patterns and recurring academic gaps.
        </InsightCard>
      </div>
      <div className="two-col">
        <StudentMiniList title="Low attendance" rows={data.lowAttendance} metric="attendance" />
        <StudentMiniList title="Top performers" rows={data.topPerformers} metric="marks" />
      </div>
      <div className="two-col">
        <StudentMiniList title="Low performance" rows={data.lowPerformers} metric="marks" />
        <section className="panel">
          <SectionTitle icon={FileText} title="Instructor workflow" />
          <div className="workflow-list">
            <span>1</span><p>Mark attendance subject-wise for today.</p>
            <span>2</span><p>Publish only reviewed marks to the student portal.</p>
            <span>3</span><p>Open student records for rank, trend, reports, and remarks.</p>
            <span>4</span><p>Use analytics to plan remedial sessions for weak students.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function StudentMiniList({ title, rows, metric }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <ul className="clean-list">
        {rows.map((item) => <li key={item.student.id}><strong>{item.student.fullName}</strong><span>{item.snapshot[metric].percentage}%</span></li>)}
      </ul>
    </section>
  );
}

function InstructorStudents() {
  const { loading, error, data, reload } = useFetch("/instructor/students");
  const [term, setTerm] = useState("");
  const [section, setSection] = useState("all");
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const sections = useMemo(() => [...new Set((data?.students || []).map((s) => s.batch.section))], [data]);
  const rows = useMemo(() => (data?.students || [])
    .filter((s) => section === "all" || s.batch.section === section)
    .filter((s) => `${s.fullName} ${s.rollNumber} ${s.batch.branch} ${s.studentCode}`.toLowerCase().includes(term.toLowerCase())), [data, term, section]);
  async function addStudent(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    setSaving(true);
    setFormError("");
    setFormMessage("");
    try {
      const { data: created } = await api.post("/instructor/students", payload);
      setFormMessage(`${created.student.fullName} was added. Default password: ${payload.password || "Password123!"}`);
      event.currentTarget.reset();
      await reload();
    } catch (err) {
      setFormError(err.response?.data?.message || "Unable to add student");
    } finally {
      setSaving(false);
    }
  }
  async function removeStudent(student) {
    const ok = window.confirm(`Remove ${student.fullName} from the portal? This deletes their login, marks, attendance, reports, and remarks.`);
    if (!ok) return;
    setRemovingId(student.id);
    setFormError("");
    setFormMessage("");
    try {
      await api.delete(`/instructor/students/${student.id}`);
      setFormMessage(`${student.fullName} was removed from the portal.`);
      await reload();
    } catch (err) {
      setFormError(err.response?.data?.message || "Unable to remove student");
    } finally {
      setRemovingId("");
    }
  }
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const batches = data.batches || [];
  const defaultBatchId = batches[0]?.id || "";
  return (
    <div className="page-stack">
      <div className="stats-grid">
        <Stat label="Roster size" value={data.students.length} />
        <Stat label="Sections" value={sections.length} />
        <Stat label="Current filter" value={section === "all" ? "All" : section} />
        <Stat label="Visible records" value={rows.length} />
      </div>
      <section className="panel">
        <SectionTitle icon={UserRound} title="Add Student" kicker="Create an approved institution student login" />
        <form className="entry-form" onSubmit={addStudent}>
          <div className="form-grid">
            <label>Full name<input name="fullName" placeholder="Student full name" required /></label>
            <label>Email<input name="email" type="email" placeholder="student@example.com" required /></label>
            <label>Password<input name="password" defaultValue="Password123!" minLength={6} required /></label>
            <label>Batch<select name="batchId" defaultValue={defaultBatchId} required>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name} | Section {batch.section}</option>)}</select></label>
          </div>
          <div className="form-grid">
            <label>Student ID<input name="studentCode" placeholder="STU-1031" required /></label>
            <label>Roll number<input name="rollNumber" placeholder="31" required /></label>
            <label>Admission no.<input name="admissionNumber" placeholder="ADM-1031" required /></label>
            <label>Gender<select name="gender" defaultValue="Not specified"><option>Not specified</option><option>Female</option><option>Male</option><option>Other</option></select></label>
          </div>
          <div className="form-grid">
            <label>Date of birth<input name="dateOfBirth" type="date" /></label>
            <label>Phone<input name="phone" placeholder="+91..." /></label>
            <label>Parent name<input name="parentName" placeholder="Parent/guardian name" /></label>
            <label>Parent contact<input name="parentContact" placeholder="+91..." /></label>
          </div>
          <div className="form-grid">
            <label>Residence<select name="residenceType" defaultValue="Day Scholar"><option>Day Scholar</option><option>Hostel</option></select></label>
            <label>Address<input name="address" placeholder="Student address" /></label>
          </div>
          {formError && <span className="inline-error">{formError}</span>}
          {formMessage && <span className="success">{formMessage}</span>}
          <button className="primary-button" disabled={saving || !batches.length}>{saving ? "Adding..." : "Add student"}</button>
        </form>
      </section>
      <section className="panel">
        <div className="section-head">
          <SectionTitle icon={UsersRound} title="Student Records" kicker="Assigned batches only" />
          <div className="filter-row">
            <label className="search"><Search size={17} /><input placeholder="Search name, roll, ID" value={term} onChange={(e) => setTerm(e.target.value)} /></label>
            <select value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="all">All sections</option>
              {sections.map((item) => <option key={item} value={item}>Section {item}</option>)}
            </select>
          </div>
        </div>
        <DataTable columns={["Name", "Student ID", "Roll", "Branch", "Year", "Section", "Profile", "Remove"]} rows={rows.map((s) => [
          s.fullName,
          s.studentCode,
          s.rollNumber,
          s.batch.branch,
          s.batch.year,
          s.batch.section,
          <Link className="table-link" to={`/instructor/students/${s.id}`}>Open record</Link>,
          <button className="danger-button" type="button" disabled={removingId === s.id} onClick={() => removeStudent(s)}>{removingId === s.id ? "Removing..." : "Remove"}</button>
        ])} />
      </section>
    </div>
  );
}

function InstructorStudentDetail({ id }) {
  const { loading, error, data } = useFetch(`/instructor/students/${id}`, [id]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const s = data.student;
  return (
    <div className="page-stack">
      <section className="intro-band instructor">
        <div>
          <p>{s.studentCode} | Roll {s.rollNumber}</p>
          <h2>{s.fullName}</h2>
        </div>
        <span className="pill">Rank {data.comparison.rank || "-"} of {data.comparison.batchSize}</span>
      </section>
      <div className="stats-grid">
        <Stat label="Attendance" value={`${data.attendance.percentage}%`} tone={data.attendance.shortage ? "warn" : "good"} />
        <Stat label="Marks" value={`${data.marks.percentage}%`} />
        <Stat label="Batch average" value={`${data.comparison.batchAverage}%`} />
        <Stat label="Status" value={data.comparison.status} />
      </div>
      <div className="two-col">
        <KeyValue title="Student Profile" fields={{ Email: s.user?.email || "Not available", Phone: s.phone, Branch: s.batch.branch, Course: s.batch.course, "Year / semester": `${s.batch.year} / ${s.batch.semester}`, Section: s.batch.section, Guardian: s.parentName, "Guardian phone": s.parentContact, Residence: s.residenceType }} />
        <section className="panel">
          <SectionTitle icon={Target} title="Progress indicators" />
          <ProgressBar label="Attendance" value={data.attendance.percentage} tone={data.attendance.shortage ? "amber" : "teal"} />
          <ProgressBar label="Marks" value={data.marks.percentage} />
          <ProgressBar label="Batch comparison" value={Math.max(data.comparison.studentPercentage, 0)} tone="teal" />
        </section>
      </div>
      <section className="panel">
        <SectionTitle icon={BookOpen} title="Published marks" />
        <DataTable columns={["Subject", "Exam", "Type", "Score", "Grade"]} rows={data.marks.marks.map((m) => [m.subject.name, m.exam.title, m.exam.type, `${m.score}/${m.exam.maxMarks}`, m.grade])} />
      </section>
      <section className="panel">
        <SectionTitle icon={ClipboardCheck} title="Attendance records" />
        <DataTable columns={["Date", "Subject", "Status", "Topic"]} rows={data.attendance.records.slice(0, 12).map((r) => [new Date(r.session.date).toLocaleDateString(), r.session.subject.name, r.status, r.session.topic || "-"])} />
      </section>
      <ReportsList title="Reports and feedback" reports={data.reports} />
      <section className="panel">
        <SectionTitle icon={MessageSquare} title="Instructor remarks" />
        {data.remarks.length ? data.remarks.map((remark) => <article className="report" key={remark.id}><p>{remark.content}</p><span>{remark.visibleToStudent ? "Visible to student" : "Private note"} | {new Date(remark.createdAt).toLocaleString()}</span></article>) : <EmptyState message="No instructor remarks yet." />}
      </section>
    </div>
  );
}

function InstructorAttendance() {
  return <AcademicEntry type="attendance" />;
}

function InstructorMarks() {
  return <AcademicEntry type="marks" />;
}

function AcademicEntry({ type }) {
  const subjects = useFetch("/instructor/subjects");
  const students = useFetch("/instructor/students");
  const history = useFetch(type === "attendance" ? "/instructor/attendance/history" : "/instructor/marks/history", [type]);
  const [subjectId, setSubjectId] = useState("");
  const [message, setMessage] = useState("");
  const [bulkStatus, setBulkStatus] = useState("PRESENT");
  const [error, setError] = useState("");
  const [updateExamId, setUpdateExamId] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const selectedStudents = students.data.students;
    try {
      if (type === "attendance") {
        await api.post("/instructor/attendance", {
          subjectId,
          date: form.get("date"),
          topic: form.get("topic"),
          records: selectedStudents.map((s) => ({ studentId: s.id, status: form.get(`status-${s.id}`) }))
        });
      } else {
        await api.post("/instructor/marks", {
          subjectId,
          title: form.get("title"),
          type: form.get("type"),
          maxMarks: Number(form.get("maxMarks")),
          heldOn: form.get("heldOn"),
          published: form.get("published") === "on",
          marks: selectedStudents.map((s) => ({ studentId: s.id, score: Number(form.get(`score-${s.id}`)) }))
        });
      }
      setMessage(type === "attendance" ? "Attendance saved for the full assigned roster." : "Marks saved for the full assigned roster.");
      await history.reload();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save records");
    }
  }
  async function updateMarks(event) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api.patch(`/instructor/marks/${updateExamId}`, {
        marks: roster.map((student) => ({ studentId: student.id, score: Number(form.get(`update-score-${student.id}`)) }))
      });
      setMessage("Existing marks updated. Totals, grades, percentages, and rank will reflect the revised scores.");
      await history.reload();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update marks");
    }
  }
  if (subjects.loading || students.loading || history.loading) return <LoadingState />;
  if (subjects.error || students.error || history.error) return <ErrorState message={subjects.error || students.error || history.error} />;
  const roster = students.data.students;
  const attendanceRows = type === "attendance"
    ? history.data.sessions.map((session) => [
      new Date(session.date).toLocaleDateString(),
      session.subject.name,
      session.subject.batch.section,
      session.topic || "-",
      `${session.present}/${session.records.length}`,
      `${session.percentage}%`
    ])
    : [];
  const marksRows = type === "marks"
    ? history.data.exams.map((exam) => [
      exam.title,
      exam.subject.name,
      exam.type,
      new Date(exam.heldOn).toLocaleDateString(),
      `${exam.marks.length} students`,
      `${exam.average}%`,
      exam.published ? "Published" : "Draft"
    ])
    : [];
  const selectedExam = type === "marks" ? history.data.exams.find((exam) => exam.id === updateExamId) : null;
  return (
    <div className="page-stack">
      <section className="panel">
        <SectionTitle icon={type === "attendance" ? ClipboardCheck : BookOpen} title={type === "attendance" ? "Attendance Management" : "Marks Management"} kicker="Instructor-only academic entry and update" />
        <div className="insight-grid compact">
          <InsightCard icon={ShieldCheck} title="Role protected">Only instructors can create or update this academic data.</InsightCard>
          <InsightCard icon={type === "attendance" ? CalendarDays : BarChart3} title={type === "attendance" ? "Separate tracking" : "Auto calculations"}>
            {type === "attendance" ? "Attendance sessions and records are stored separately from marks." : "Totals, percentages, grades, and ranks update from saved scores."}
          </InsightCard>
          <InsightCard icon={FileText} title="Review trail">Recent saved records appear below for quick review.</InsightCard>
        </div>
        <form className="entry-form" onSubmit={submit}>
          <label>Subject<select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required><option value="">Select subject</option>{subjects.data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          {type === "attendance" ? (
            <>
              <div className="form-grid">
                <label>Date<input type="date" name="date" required /></label>
                <label>Topic<input name="topic" placeholder="Lecture topic" /></label>
                <label>Bulk status<select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}><option>PRESENT</option><option>ABSENT</option><option>LATE</option><option>EXCUSED</option></select></label>
              </div>
              <div className="roster-entry">
                {roster.map((s) => <label key={s.id}>{s.rollNumber} - {s.fullName}<select name={`status-${s.id}`} defaultValue={bulkStatus} key={`${s.id}-${bulkStatus}`}><option>PRESENT</option><option>ABSENT</option><option>LATE</option><option>EXCUSED</option></select></label>)}
              </div>
            </>
          ) : (
            <>
              <div className="form-grid">
                <label>Exam title<input name="title" required defaultValue="Internal Assessment" /></label>
                <label>Exam type<select name="type"><option>INTERNAL</option><option>ASSIGNMENT</option><option>SEMESTER</option><option>PRACTICAL</option></select></label>
                <label>Held on<input type="date" name="heldOn" required /></label>
                <label>Max marks<input type="number" name="maxMarks" defaultValue="100" min="1" required /></label>
              </div>
              <label className="checkbox"><input type="checkbox" name="published" /> Publish to students</label>
              <div className="roster-entry">
                {roster.map((s) => <label key={s.id}>{s.rollNumber} - {s.fullName}<input type="number" min="0" name={`score-${s.id}`} required placeholder="Score" /></label>)}
              </div>
            </>
          )}
          <button className="primary-button">Save or update</button>
          {error && <span className="inline-error">{error}</span>}
          {message && <span className="success">{message}</span>}
        </form>
      </section>
      <section className="panel">
        <SectionTitle icon={FileText} title={type === "attendance" ? "Attendance History" : "Marks History"} kicker="Recent instructor records" />
        {type === "attendance" ? (
          <DataTable columns={["Date", "Subject", "Section", "Topic", "Present", "Class %"]} rows={attendanceRows} />
        ) : (
          <DataTable columns={["Exam", "Subject", "Type", "Held on", "Entries", "Average", "Status"]} rows={marksRows} />
        )}
      </section>
      {type === "marks" && (
        <section className="panel">
          <SectionTitle icon={CheckCircle2} title="Update Existing Marks" kicker="Recalculate grades and rank after correction" />
          {history.data.exams.length ? (
            <form className="entry-form" onSubmit={updateMarks}>
              <label>Exam to update
                <select value={updateExamId} onChange={(event) => setUpdateExamId(event.target.value)} required>
                  <option value="">Select existing exam</option>
                  {history.data.exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title} - {exam.subject.name}</option>)}
                </select>
              </label>
              {selectedExam && (
                <div className="roster-entry">
                  {roster.map((student) => {
                    const existingMark = selectedExam.marks.find((mark) => mark.studentId === student.id);
                    return (
                      <label key={student.id}>{student.rollNumber} - {student.fullName}
                        <input type="number" min="0" max={selectedExam.maxMarks} name={`update-score-${student.id}`} defaultValue={existingMark?.score ?? 0} required />
                      </label>
                    );
                  })}
                </div>
              )}
              <button className="primary-button">Update marks</button>
            </form>
          ) : <EmptyState message="Create an exam first, then update marks here." />}
        </section>
      )}
    </div>
  );
}

function InstructorAnalytics() {
  const { loading, error, data } = useFetch("/instructor/analytics");
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const chart = data.rows.map((r) => ({ name: r.student.name.split(" ")[0], marks: r.marks.percentage, attendance: r.attendance.percentage }));
  const riskRows = data.rows
    .map((r) => ({ ...r, risk: r.attendance.percentage < 75 || r.marks.percentage < 60 ? "High" : r.marks.percentage < 70 ? "Medium" : "Stable" }))
    .sort((a, b) => a.marks.percentage - b.marks.percentage);
  return (
    <div className="page-stack">
      <section className="panel">
        <SectionTitle icon={BarChart3} title="Performance Analytics" kicker="Attendance and marks by student" />
        <ResponsiveContainer width="100%" height={330}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="marks" fill="#2563eb" radius={[6, 6, 0, 0]} />
            <Bar dataKey="attendance" fill="#0f766e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
      <section className="panel">
        <SectionTitle icon={Target} title="Risk and intervention table" />
        <DataTable columns={["Student", "Roll", "Attendance", "Marks", "Rank", "Risk", "Action"]} rows={riskRows.map((r) => [r.student.name, r.student.rollNumber, `${r.attendance.percentage}%`, `${r.marks.percentage}%`, r.comparison.rank || "-", r.risk, <Link className="table-link" to={`/instructor/students/${r.student.id}`}>Review</Link>])} />
      </section>
    </div>
  );
}

function ReportsList({ title, reports, action }) {
  return (
    <section className="panel">
      <div className="section-head"><h2>{title}</h2>{action}</div>
      {reports?.length ? reports.map((report) => <article className="report" key={report.id}><h3>{report.title}</h3><p>{report.content}</p><span>{report.period} | {new Date(report.createdAt).toLocaleString()}</span></article>) : <EmptyState message="No reports found." />}
    </section>
  );
}

function InstructorReports() {
  const { loading, error, data, reload } = useFetch("/instructor/reports");
  const students = useFetch("/instructor/students");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function generateForStudent(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      await api.post(`/instructor/students/${form.get("studentId")}/peer-report`, { period: form.get("period") || "Instructor review period" });
      setMessage("AI peer comparison report generated.");
      await reload();
    } finally {
      setBusy(false);
    }
  }
  if (loading || students.loading) return <LoadingState />;
  if (error || students.error) return <ErrorState message={error || students.error} />;
  return (
    <div className="page-stack">
      <div className="stats-grid">
        <Stat label="Total AI reports" value={data.reports.length} />
        <Stat label="Peer reports" value={data.reports.filter((r) => r.type === "PEER_COMPARISON").length} />
        <Stat label="Feedback reports" value={data.reports.filter((r) => r.type === "SMART_FEEDBACK").length} />
        <Stat label="Students covered" value={new Set(data.reports.map((r) => r.studentId)).size} />
      </div>
      <section className="panel">
        <SectionTitle icon={Sparkles} title="Generate AI Peer Report" kicker="Instructor-triggered review" />
        <form className="entry-form compact-form" onSubmit={generateForStudent}>
          <div className="form-grid">
            <label>Student<select name="studentId" required>{students.data.students.map((student) => <option key={student.id} value={student.id}>{student.rollNumber} - {student.fullName}</option>)}</select></label>
            <label>Reporting period<input name="period" defaultValue="Current semester" /></label>
          </div>
          <button className="primary-button" disabled={busy}>{busy ? "Generating..." : "Generate report"}</button>
          {message && <span className="success">{message}</span>}
        </form>
      </section>
      <ReportsList title="AI Reports Monitoring" reports={data.reports} />
    </div>
  );
}

function Remarks() {
  const students = useFetch("/instructor/students");
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.post(`/instructor/students/${form.get("studentId")}/remarks`, {
      content: form.get("content"),
      visibleToStudent: form.get("visibleToStudent") === "on"
    });
    event.currentTarget.reset();
    setMessage("Remark saved.");
  }
  if (students.loading) return <LoadingState />;
  if (students.error) return <ErrorState message={students.error} />;
  return (
    <section className="panel">
      <h2>Instructor Remarks</h2>
      <form className="entry-form" onSubmit={submit}>
        <label>Student<select name="studentId" required>{students.data.students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select></label>
        <label>Remark<textarea name="content" required placeholder="Academic note or progress remark" /></label>
        <label className="checkbox"><input type="checkbox" name="visibleToStudent" /> Visible to student</label>
        <button className="primary-button">Save remark</button>
        {message && <span className="success">{message}</span>}
      </form>
    </section>
  );
}

function StudentDetailRoute() {
  const { id } = useParams();
  return <InstructorStudentDetail id={id} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/student/dashboard" element={<Protected role="STUDENT"><StudentDashboard /></Protected>} />
      <Route path="/student/profile" element={<Protected role="STUDENT"><Profile /></Protected>} />
      <Route path="/student/attendance" element={<Protected role="STUDENT"><Attendance /></Protected>} />
      <Route path="/student/marks" element={<Protected role="STUDENT"><Marks /></Protected>} />
      <Route path="/student/rank" element={<Protected role="STUDENT"><Rank /></Protected>} />
      <Route path="/student/reports" element={<Protected role="STUDENT"><StudentReports /></Protected>} />
      <Route path="/student/assistant" element={<Protected role="STUDENT"><Assistant /></Protected>} />
      <Route path="/student/feedback" element={<Protected role="STUDENT"><Feedback /></Protected>} />
      <Route path="/instructor/dashboard" element={<Protected role="INSTRUCTOR"><InstructorDashboard /></Protected>} />
      <Route path="/instructor/students" element={<Protected role="INSTRUCTOR"><InstructorStudents /></Protected>} />
      <Route path="/instructor/students/:id" element={<Protected role="INSTRUCTOR"><StudentDetailRoute /></Protected>} />
      <Route path="/instructor/attendance" element={<Protected role="INSTRUCTOR"><InstructorAttendance /></Protected>} />
      <Route path="/instructor/marks" element={<Protected role="INSTRUCTOR"><InstructorMarks /></Protected>} />
      <Route path="/instructor/reports" element={<Protected role="INSTRUCTOR"><InstructorReports /></Protected>} />
      <Route path="/instructor/analytics" element={<Protected role="INSTRUCTOR"><InstructorAnalytics /></Protected>} />
      <Route path="/instructor/remarks" element={<Protected role="INSTRUCTOR"><Remarks /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
