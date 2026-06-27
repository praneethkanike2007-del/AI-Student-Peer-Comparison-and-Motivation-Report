import OpenAI from "openai";

const configuredApiKey = process.env.OPENAI_API_KEY?.trim();
const placeholderKeys = new Set(["sk-your-openai-api-key-here", "your_real_openai_api_key", "your-openai-api-key"]);
const hasUsableApiKey = Boolean(configuredApiKey && !placeholderKeys.has(configuredApiKey));
const activeModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const aiProvider = (process.env.AI_PROVIDER || "").toLowerCase();
const useOpenAi = aiProvider !== "built-in" && aiProvider !== "ollama" && hasUsableApiKey;
const client = useOpenAi ? new OpenAI({ apiKey: configuredApiKey }) : null;
const ollamaEnabled = aiProvider === "ollama";
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2:3b";
const ollamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 25000);
let lastOpenAiError = "";
let lastOllamaError = "";

function maskedKey() {
  if (!configuredApiKey) return "";
  if (placeholderKeys.has(configuredApiKey)) return "placeholder";
  if (configuredApiKey.length <= 12) return "configured";
  return `${configuredApiKey.slice(0, 7)}...${configuredApiKey.slice(-4)}`;
}

export function getAiProviderStatus() {
  return {
    provider: client ? "openai" : ollamaEnabled ? "ollama" : "built-in",
    model: client ? activeModel : ollamaEnabled ? ollamaModel : "local academic fallback",
    openAiConfigured: Boolean(client),
    ollamaConfigured: ollamaEnabled,
    ollamaBaseUrl: ollamaEnabled ? ollamaBaseUrl : "",
    keyStatus: client ? "configured" : configuredApiKey ? "placeholder_or_invalid" : "missing",
    keyPreview: maskedKey(),
    lastOpenAiError,
    lastOllamaError
  };
}

async function complete(system, user) {
  if (client) return completeWithOpenAi(system, user);
  if (ollamaEnabled) return completeWithOllama(system, user);
  return fallbackResponse(system, user);
}

async function completeWithOpenAi(system, user) {
  try {
    const response = await client.chat.completions.create({
      model: activeModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.25,
      max_tokens: 900
    });
    lastOpenAiError = "";
    return response.choices[0]?.message?.content?.trim() || "I could not generate a response right now.";
  } catch (error) {
    lastOpenAiError = error?.message || "OpenAI request failed";
    return fallbackResponse(system, user);
  }
}

async function completeWithOllama(system, user) {
  let timer;
  try {
    const payload = parseJson(user);
    const compactUser = payload.question
      ? JSON.stringify({
        question: payload.question,
        mode: payload.mode,
        student: payload.snapshot?.student?.fullName,
        attendance: payload.snapshot?.attendance?.percentage,
        marks: payload.snapshot?.marks?.percentage,
        rank: payload.snapshot?.comparison?.rank,
        batchSize: payload.snapshot?.comparison?.batchSize,
        batchAverage: payload.snapshot?.comparison?.batchAverage,
        subjects: payload.snapshot?.marks?.bySubject
      })
      : user;
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), ollamaTimeoutMs);
    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        messages: [
          { role: "system", content: `${system}\nKeep the answer concise, structured, and under 450 words.` },
          { role: "user", content: compactUser }
        ],
        options: { temperature: 0.25, num_predict: 500, num_ctx: 2048 }
      })
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const data = await response.json();
    lastOllamaError = "";
    return data.message?.content?.trim() || fallbackResponse(system, user);
  } catch (error) {
    if (timer) clearTimeout(timer);
    lastOllamaError = error?.message || "Ollama request failed";
    return fallbackResponse(system, user);
  }
}

function fallbackResponse(system, user) {
  if (system.includes("peer comparison")) {
    return buildPeerReport(parseJson(user));
  }
  if (system.includes("academic feedback")) {
    return buildSmartFeedback(parseJson(user));
  }
  const payload = parseJson(user);
  return buildDoubtAnswer(payload.question || user, payload.snapshot, payload.mode || "auto");
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function pct(value) {
  return Number.isFinite(value) ? `${value}%` : "0%";
}

function sortedSubjects(snapshot) {
  return [...(snapshot?.marks?.bySubject || [])].sort((a, b) => b.percentage - a.percentage);
}

function studentName(snapshot) {
  return snapshot?.student?.fullName || "this student";
}

function buildSmartFeedback(snapshot) {
  const subjects = sortedSubjects(snapshot);
  const strongest = subjects[0];
  const weakest = subjects[subjects.length - 1];
  const attendance = snapshot?.attendance?.percentage || 0;
  const marks = snapshot?.marks?.percentage || 0;
  const comparison = snapshot?.comparison || {};
  const actions = [];
  if (attendance < 75) actions.push("raise attendance above 75% by avoiding avoidable absences");
  if (weakest) actions.push(`revise ${weakest.subject}, currently the lowest subject at ${pct(weakest.percentage)}`);
  if (marks < (comparison.batchAverage || 0)) actions.push("close the gap with the batch average through weekly practice");
  if (!actions.length) actions.push("maintain consistency and protect the current study rhythm");

  return [
    `${studentName(snapshot)} has ${pct(attendance)} attendance, ${pct(marks)} overall marks, and rank ${comparison.rank || "-"} of ${comparison.batchSize || "-"}.`,
    strongest ? `Strongest area: ${strongest.subject} at ${pct(strongest.percentage)}.` : "No subject marks are available yet.",
    weakest ? `Main improvement area: ${weakest.subject} at ${pct(weakest.percentage)}.` : "Add marks to identify improvement areas.",
    `Recommended action: ${actions.join("; ")}.`,
    "This feedback is based only on the current stored attendance, marks, rank, and batch comparison data."
  ].join("\n");
}

function buildPeerReport(payload) {
  const snapshot = payload?.snapshot || payload || {};
  const period = payload?.period || "Current term";
  const subjects = sortedSubjects(snapshot);
  const strongest = subjects[0];
  const weakest = subjects[subjects.length - 1];
  const attendance = snapshot?.attendance?.percentage || 0;
  const marks = snapshot?.marks?.percentage || 0;
  const comparison = snapshot?.comparison || {};
  const gap = marks - (comparison.batchAverage || 0);
  const shortage = snapshot?.attendance?.shortage;
  const status = gap >= 5 ? "above the batch average" : gap <= -5 ? "below the batch average" : "close to the batch average";

  return [
    `Report period: ${period}`,
    `Student: ${studentName(snapshot)}`,
    `Performance snapshot: Overall marks are ${pct(marks)}, attendance is ${pct(attendance)}, grade is ${snapshot?.marks?.grade || "not available"}, and rank is ${comparison.rank || "-"} of ${comparison.batchSize || "-"}.`,
    `Batch comparison: The batch average is ${pct(comparison.batchAverage || 0)}. The student is ${Math.abs(gap)} percentage points ${gap >= 0 ? "above" : "below"} that average, so the current standing is ${status}.`,
    `Strengths: ${strongest ? `${strongest.subject} is the strongest subject at ${pct(strongest.percentage)}.` : "No published subject marks are available yet."}`,
    `Areas to improve: ${weakest ? `${weakest.subject} needs the most attention at ${pct(weakest.percentage)}.` : "No weak subject can be identified until marks are published."} ${shortage ? "Attendance is below the safe threshold and needs immediate correction." : "Attendance is currently above the shortage threshold."}`,
    `Motivational guidance: ${gap >= 0 ? "The current record is strong; the goal is to keep consistency and avoid slipping in the weakest subject." : "Improvement is realistic if the student focuses on the lowest subject and maintains attendance discipline."}`,
    `Next steps: ${weakest ? `Revise ${weakest.subject} in short daily sessions, solve practice questions, and ask doubts early.` : "Wait for more academic records, then generate a fresh report."} Track attendance weekly and compare progress after the next published assessment.`,
    "Privacy note: Peer comparison is anonymized and does not expose other students' identities."
  ].join("\n");
}

const knowledgeBase = [
  {
    keys: ["normalization", "normalisation", "1nf", "2nf", "3nf", "bcnf"],
    title: "Database normalization",
    subject: "DBMS",
    explanation: [
      "Database normalization is the process of organizing tables to reduce redundancy and avoid update, insert, and delete anomalies.",
      "1NF: every column contains atomic values, and repeating groups are removed.",
      "2NF: the table is in 1NF and every non-key attribute depends on the whole primary key, not only part of a composite key.",
      "3NF: the table is in 2NF and non-key attributes do not depend on other non-key attributes.",
      "BCNF: every determinant should be a candidate key; it is stricter than 3NF."
    ],
    example: "Example: Instead of storing StudentName, Course1, Course2 in one row, create Student, Course, and Enrollment tables. This avoids repeating student details for every course.",
    mistakes: ["Confusing 2NF with 3NF", "Keeping comma-separated values in one column", "Removing redundancy without preserving relationships"]
  },
  {
    keys: ["binary search", "time complexity", "log n", "logarithmic"],
    title: "Binary search time complexity",
    subject: "Data Structures",
    explanation: [
      "Binary search works on a sorted list by checking the middle element and discarding half of the remaining search space each step.",
      "Worst-case time complexity: O(log n).",
      "Best-case time complexity: O(1), when the middle element is the target.",
      "Space complexity: O(1) for iterative binary search and O(log n) for recursive binary search due to call stack."
    ],
    example: "For 16 elements, binary search needs at most 4 comparisons because 16 -> 8 -> 4 -> 2 -> 1.",
    mistakes: ["Using binary search on unsorted data", "Incorrect mid calculation", "Infinite loop from not updating low/high correctly"]
  },
  {
    keys: ["stack", "queue", "data structures"],
    title: "Stacks and queues",
    subject: "Data Structures",
    explanation: [
      "A stack follows LIFO: last in, first out. Main operations are push, pop, and peek.",
      "A queue follows FIFO: first in, first out. Main operations are enqueue, dequeue, and front.",
      "Stacks are used in recursion, undo operations, and expression evaluation.",
      "Queues are used in scheduling, buffering, BFS traversal, and printer queues."
    ],
    example: "Stack example: browser back button. Queue example: students waiting in order for registration.",
    mistakes: ["Mixing LIFO and FIFO", "Ignoring overflow/underflow conditions", "Using linear queue without handling wasted space"]
  },
  {
    keys: ["sql join", "joins", "inner join", "left join", "right join", "full join"],
    title: "SQL joins",
    subject: "DBMS",
    explanation: [
      "A SQL join combines rows from two or more tables using a related column.",
      "INNER JOIN returns only matching rows from both tables.",
      "LEFT JOIN returns all rows from the left table and matching rows from the right table.",
      "RIGHT JOIN returns all rows from the right table and matching rows from the left table.",
      "FULL JOIN returns matching and non-matching rows from both tables where supported."
    ],
    example: "SELECT s.name, m.score FROM students s INNER JOIN marks m ON s.id = m.student_id;",
    mistakes: ["Forgetting the ON condition", "Using INNER JOIN when unmatched rows are needed", "Joining on non-key columns accidentally"]
  },
  {
    keys: ["oop", "object oriented", "inheritance", "polymorphism", "encapsulation", "abstraction"],
    title: "Object-oriented programming principles",
    subject: "Programming",
    explanation: [
      "Encapsulation bundles data and methods together and protects internal state.",
      "Abstraction hides unnecessary implementation details and exposes essential behavior.",
      "Inheritance allows a class to reuse or extend another class.",
      "Polymorphism allows the same interface or method name to behave differently depending on the object."
    ],
    example: "A Payment class can have CreditCardPayment and UpiPayment subclasses. Both can implement pay(), but each performs payment differently.",
    mistakes: ["Using inheritance where composition is better", "Exposing all data publicly", "Confusing overloading with overriding"]
  },
  {
    keys: ["process", "thread", "operating system", "os"],
    title: "Process vs thread",
    subject: "Operating Systems",
    explanation: [
      "A process is an independent program in execution with its own memory space.",
      "A thread is a smaller execution unit inside a process and shares process memory.",
      "Processes are more isolated and safer, but context switching is heavier.",
      "Threads are lighter and faster to switch, but shared memory can cause synchronization issues."
    ],
    example: "A browser may run tabs as processes, while each tab may use multiple threads for rendering, JavaScript, and networking.",
    mistakes: ["Saying threads never have separate stacks", "Ignoring race conditions", "Assuming processes share memory by default"]
  },
  {
    keys: ["deadlock", "mutual exclusion", "hold and wait", "circular wait"],
    title: "Deadlock",
    subject: "Operating Systems",
    explanation: [
      "Deadlock occurs when processes wait forever because each holds a resource needed by another.",
      "Four necessary conditions are mutual exclusion, hold and wait, no preemption, and circular wait.",
      "Deadlock can be handled by prevention, avoidance, detection and recovery, or ignoring it in low-risk systems."
    ],
    example: "Process A holds printer and waits for scanner; Process B holds scanner and waits for printer. Neither can continue.",
    mistakes: ["Confusing deadlock with starvation", "Forgetting the four necessary conditions", "Assuming timeout always solves the root cause"]
  },
  {
    keys: ["tcp", "udp", "network", "computer networks"],
    title: "TCP vs UDP",
    subject: "Computer Networks",
    explanation: [
      "TCP is connection-oriented, reliable, ordered, and uses acknowledgements and retransmission.",
      "UDP is connectionless, faster, and does not guarantee delivery or ordering.",
      "TCP is used for web browsing, file transfer, and email.",
      "UDP is used for streaming, online games, DNS, and VoIP where speed matters."
    ],
    example: "Downloading a file uses TCP because every byte must arrive correctly. A live video call may use UDP because small losses are acceptable.",
    mistakes: ["Calling UDP unreliable in every practical sense", "Ignoring latency tradeoffs", "Using TCP where low-latency streaming is more important"]
  }
];

const courseKnowledge = [
  {
    keys: ["array", "linked list", "linkedlist", "data structure basics"],
    title: "Arrays vs linked lists",
    subject: "Data Structures",
    explanation: [
      "An array stores elements in contiguous memory and supports fast index access.",
      "A linked list stores elements as nodes connected by links, so insertion and deletion can be easier when the node position is known.",
      "Array access by index is O(1), while linked list access is O(n).",
      "Arrays may require shifting elements during insertion/deletion; linked lists require pointer changes."
    ],
    example: "Use an array for marks where index access is frequent. Use a linked list when frequent insertions/deletions happen in the middle.",
    mistakes: ["Saying linked lists are always faster", "Ignoring memory overhead of links", "Forgetting that linked list search is O(n)"]
  },
  {
    keys: ["sorting", "bubble sort", "selection sort", "insertion sort", "merge sort", "quick sort"],
    title: "Sorting algorithms",
    subject: "Data Structures",
    explanation: [
      "Sorting arranges data in a defined order, usually ascending or descending.",
      "Bubble, selection, and insertion sort are simple but usually O(n^2).",
      "Merge sort is O(n log n) and stable, but needs extra memory.",
      "Quick sort is average O(n log n), often fast in practice, but worst case can be O(n^2)."
    ],
    example: "For exam marks, sorting percentages helps calculate rank and identify top performers.",
    mistakes: ["Using O(n^2) sorting for large data", "Confusing stable and unstable sort", "Forgetting quick sort worst case"]
  },
  {
    keys: ["recursion", "recursive", "base case"],
    title: "Recursion",
    subject: "Data Structures",
    explanation: [
      "Recursion is a technique where a function solves a problem by calling itself on a smaller input.",
      "Every recursive solution needs a base case to stop and a recursive case to reduce the problem.",
      "Recursion is useful for trees, divide-and-conquer algorithms, backtracking, and mathematical definitions.",
      "The call stack stores pending function calls, so deep recursion can cause stack overflow."
    ],
    example: "Factorial: fact(n) = n * fact(n - 1), with fact(0) = 1 as the base case.",
    mistakes: ["Missing base case", "Not reducing input", "Ignoring stack memory"]
  },
  {
    keys: ["er diagram", "entity relationship", "entity", "relationship", "cardinality"],
    title: "ER diagrams",
    subject: "DBMS",
    explanation: [
      "An ER diagram models data using entities, attributes, and relationships.",
      "Entities are real-world objects such as Student, Course, or Instructor.",
      "Attributes describe entities, such as studentId, name, or phone.",
      "Relationships show how entities are connected, such as Student enrolls in Course.",
      "Cardinality explains how many records participate: one-to-one, one-to-many, or many-to-many."
    ],
    example: "Student and Course usually have a many-to-many relationship, resolved using an Enrollment table.",
    mistakes: ["Treating attributes as entities", "Missing cardinality", "Not resolving many-to-many relationships"]
  },
  {
    keys: ["transaction", "acid", "atomicity", "consistency", "isolation", "durability"],
    title: "ACID properties",
    subject: "DBMS",
    explanation: [
      "ACID properties make database transactions reliable.",
      "Atomicity means all operations complete or none complete.",
      "Consistency means the database moves from one valid state to another.",
      "Isolation means concurrent transactions should not incorrectly affect each other.",
      "Durability means committed data remains saved even after failure."
    ],
    example: "In a bank transfer, money should not be debited unless the credit also succeeds.",
    mistakes: ["Confusing isolation with security", "Ignoring rollback", "Explaining ACID without a transaction example"]
  },
  {
    keys: ["set theory", "sets", "union", "intersection", "venn"],
    title: "Set theory",
    subject: "Discrete Mathematics",
    explanation: [
      "A set is a well-defined collection of distinct objects.",
      "Union A ∪ B contains elements in A or B.",
      "Intersection A ∩ B contains elements common to both A and B.",
      "Difference A - B contains elements in A but not in B.",
      "Venn diagrams visually show relationships between sets."
    ],
    example: "If A = {1,2,3} and B = {3,4}, then A ∪ B = {1,2,3,4} and A ∩ B = {3}.",
    mistakes: ["Repeating duplicate elements in a set", "Confusing union and intersection", "Forgetting universal set in complement problems"]
  },
  {
    keys: ["graph", "graphs", "vertex", "edge", "bfs", "dfs"],
    title: "Graphs, BFS, and DFS",
    subject: "Discrete Mathematics",
    explanation: [
      "A graph contains vertices connected by edges.",
      "Graphs can be directed or undirected, weighted or unweighted.",
      "BFS explores level by level using a queue.",
      "DFS explores deeply first using recursion or a stack.",
      "Graphs model networks, routes, dependencies, and social connections."
    ],
    example: "In a college map, buildings are vertices and paths are edges; BFS can find the shortest unweighted path.",
    mistakes: ["Using DFS for shortest path in unweighted graphs", "Forgetting visited nodes", "Confusing directed and undirected edges"]
  },
  {
    keys: ["cpu scheduling", "fcfs", "sjf", "round robin", "priority scheduling"],
    title: "CPU scheduling",
    subject: "Operating Systems",
    explanation: [
      "CPU scheduling decides which process gets the CPU next.",
      "FCFS executes processes in arrival order but may cause convoy effect.",
      "SJF chooses the shortest burst time and can reduce average waiting time.",
      "Round Robin gives each process a fixed time quantum and is useful for time-sharing systems.",
      "Priority scheduling runs higher-priority processes first but can cause starvation."
    ],
    example: "Round Robin is like giving each student a fixed time slot to ask doubts, then moving to the next student.",
    mistakes: ["Ignoring arrival time", "Confusing waiting time and turnaround time", "Using too large or too small a time quantum"]
  },
  {
    keys: ["paging", "page replacement", "fifo page", "lru", "virtual memory"],
    title: "Paging and page replacement",
    subject: "Operating Systems",
    explanation: [
      "Paging divides memory into fixed-size pages and frames.",
      "Virtual memory lets programs use more memory than physically available by moving pages between RAM and disk.",
      "A page fault occurs when a needed page is not in RAM.",
      "FIFO replaces the oldest loaded page.",
      "LRU replaces the page that has not been used for the longest time."
    ],
    example: "If RAM has three frames and a fourth page is needed, a page replacement algorithm chooses which page to remove.",
    mistakes: ["Confusing pages with segments", "Assuming every page fault is an error", "Forgetting LRU depends on recent use"]
  },
  {
    keys: ["osi model", "tcp ip model", "layers", "application layer", "transport layer"],
    title: "OSI and TCP/IP layers",
    subject: "Computer Networks",
    explanation: [
      "Layered network models divide communication tasks into smaller responsibilities.",
      "OSI has seven layers: Physical, Data Link, Network, Transport, Session, Presentation, Application.",
      "TCP/IP is commonly explained with Application, Transport, Internet, and Network Access layers.",
      "Layering helps troubleshooting, standardization, and modular design."
    ],
    example: "HTTP works at the application layer, TCP works at the transport layer, and IP works at the network/internet layer.",
    mistakes: ["Mixing OSI and TCP/IP layer counts", "Placing IP in transport layer", "Forgetting encapsulation"]
  },
  {
    keys: ["ip address", "subnet", "subnetting", "cidr", "ipv4"],
    title: "IP addressing and subnetting",
    subject: "Computer Networks",
    explanation: [
      "An IPv4 address identifies a device or interface on a network.",
      "Subnetting divides a larger network into smaller networks.",
      "CIDR notation such as /24 tells how many bits are used for the network portion.",
      "Subnetting helps organize networks, reduce broadcast traffic, and manage IP allocation."
    ],
    example: "192.168.1.0/24 usually provides addresses from 192.168.1.1 to 192.168.1.254 for hosts.",
    mistakes: ["Counting network and broadcast addresses as usable hosts", "Confusing subnet mask with gateway", "Ignoring binary conversion in subnet problems"]
  }
];

const allKnowledge = [...knowledgeBase, ...courseKnowledge];

const subjectPlans = {
  "data structures": ["Arrays and linked lists", "Stacks and queues", "Recursion", "Searching and sorting", "Trees and graphs", "Time complexity"],
  "database systems": ["ER diagrams", "Normalization", "SQL joins", "Transactions and ACID", "Indexing basics", "Keys and constraints"],
  "discrete mathematics": ["Set theory", "Relations and functions", "Logic and truth tables", "Counting principles", "Graphs", "Recurrence basics"],
  "operating systems": ["Process vs thread", "CPU scheduling", "Deadlocks", "Memory management", "Paging", "Synchronization"],
  "computer networks": ["OSI and TCP/IP models", "IP addressing", "Subnetting", "TCP vs UDP", "Routing basics", "DNS and HTTP"]
};

function tokenize(text) {
  return String(text).toLowerCase().match(/[a-z0-9+#]+/g) || [];
}

function findKnowledge(question) {
  const lower = question.toLowerCase();
  let best = null;
  for (const item of allKnowledge) {
    let score = 0;
    for (const key of item.keys) {
      if (lower.includes(key)) score += key.split(/\s+/).length + 3;
    }
    const questionTokens = new Set(tokenize(question));
    for (const token of tokenize(`${item.title} ${item.subject} ${item.keys.join(" ")}`)) {
      if (questionTokens.has(token)) score += 1;
    }
    if (!best || score > best.score) best = { item, score };
  }
  return best?.score > 2 ? best.item : null;
}

function buildKnowledgeAnswer(item, question, snapshot, mode) {
  const subjects = sortedSubjects(snapshot);
  const weakest = subjects[subjects.length - 1];
  const contextLine = snapshot?.student
    ? `Student context: ${studentName(snapshot)} has ${pct(snapshot.attendance?.percentage || 0)} attendance, ${pct(snapshot.marks?.percentage || 0)} marks, rank ${snapshot.comparison?.rank || "-"} of ${snapshot.comparison?.batchSize || "-"}${weakest ? `, and the current weakest subject is ${weakest.subject} at ${pct(weakest.percentage)}` : ""}.`
    : "";
  const lines = [contextLine, `Topic: ${item.title}`, `Subject area: ${item.subject}`].filter(Boolean);

  if (mode === "summary") {
    return [...lines, "Short summary:", item.explanation.slice(0, 3).join(" "), `Example: ${item.example}`].join("\n");
  }

  if (mode === "practice" || question.toLowerCase().includes("practice")) {
    return [
      ...lines,
      "Practice questions:",
      `1. Define ${item.title} in your own words.`,
      `2. Explain one real-life use of ${item.title}.`,
      `3. Solve or write an example related to: ${item.example}`,
      `4. List two common mistakes: ${item.mistakes.slice(0, 2).join("; ")}.`,
      weakest ? `Personal focus: connect one practice answer to ${weakest.subject}, because it is your lowest current subject.` : "Personal focus: revise the answer after 24 hours."
    ].join("\n");
  }

  if (mode === "exam") {
    return [
      ...lines,
      "Exam-ready answer:",
      ...item.explanation.map((line, index) => `${index + 1}. ${line}`),
      `Example: ${item.example}`,
      `Common mistakes to avoid: ${item.mistakes.join("; ")}.`
    ].join("\n");
  }

  if (mode === "steps" || question.toLowerCase().includes("step")) {
    return [
      ...lines,
      "Step-by-step understanding:",
      "1. Start with the definition.",
      ...item.explanation.map((line, index) => `${index + 2}. ${line}`),
      `${item.explanation.length + 2}. Apply it using this example: ${item.example}`,
      `${item.explanation.length + 3}. Check your answer against these mistakes: ${item.mistakes.join("; ")}.`
    ].join("\n");
  }

  return [
    ...lines,
    "Clear explanation:",
    ...item.explanation.map((line) => `- ${line}`),
    `Example: ${item.example}`,
    `Accuracy check: Avoid ${item.mistakes.join("; ")}.`,
    weakest ? `Personal study advice: since ${weakest.subject} is currently weakest, ask follow-up doubts from that area first.` : "Personal study advice: turn this into a 5-line revision note."
  ].join("\n");
}

function academicSnapshotLines(snapshot) {
  const subjects = sortedSubjects(snapshot);
  const weakest = subjects[subjects.length - 1];
  const strongest = subjects[0];
  const attendance = snapshot?.attendance?.percentage || 0;
  const marks = snapshot?.marks?.percentage || 0;
  const comparison = snapshot?.comparison || {};
  return {
    subjects,
    weakest,
    strongest,
    attendance,
    marks,
    comparison,
    intro: `${studentName(snapshot)} currently has ${pct(attendance)} attendance, ${pct(marks)} overall marks, rank ${comparison.rank || "-"} of ${comparison.batchSize || "-"}, and batch average is ${pct(comparison.batchAverage || 0)}.`
  };
}

function buildSubjectPlan(subjectName, snapshot) {
  const key = Object.keys(subjectPlans).find((name) => subjectName.toLowerCase().includes(name));
  const topics = subjectPlans[key] || subjectPlans["data structures"];
  const { intro, weakest, strongest } = academicSnapshotLines(snapshot);
  return [
    intro,
    `Important topics for ${key || subjectName}:`,
    ...topics.map((topic, index) => `${index + 1}. ${topic}`),
    weakest ? `Priority advice: Your weakest current subject is ${weakest.subject} at ${pct(weakest.percentage)}, so give it the first study slot each day.` : "",
    strongest ? `Maintain strength: ${strongest.subject} is currently strongest at ${pct(strongest.percentage)}; revise it twice a week so it does not drop.` : "",
    "Study method: read the concept, write one short note, solve two questions, then explain the answer aloud in simple words."
  ].filter(Boolean).join("\n");
}

function buildImportantQuestions(question, snapshot) {
  const lower = question.toLowerCase();
  const { intro, weakest } = academicSnapshotLines(snapshot);
  const isSql = lower.includes("sql") || lower.includes("dbms") || lower.includes("database");
  const questions = isSql
    ? [
      "Define SQL and explain its main command categories: DDL, DML, DCL, TCL, and DQL.",
      "Write SQL queries using SELECT, WHERE, ORDER BY, GROUP BY, and HAVING.",
      "Explain INNER JOIN, LEFT JOIN, RIGHT JOIN, and FULL JOIN with examples.",
      "Differentiate primary key, foreign key, unique key, and candidate key.",
      "Explain normalization with 1NF, 2NF, 3NF, and BCNF examples.",
      "Write queries using aggregate functions: COUNT, SUM, AVG, MIN, MAX.",
      "Explain subqueries and correlated subqueries with examples.",
      "What are views and indexes? Explain advantages and limitations.",
      "Explain transactions and ACID properties.",
      "Write a query to find the second highest marks/salary from a table."
    ]
    : [
      "Write the definition and purpose of the topic.",
      "Explain the most important types or categories.",
      "Solve one direct numerical or query-based question.",
      "Compare this topic with a related concept.",
      "Write one real-life application.",
      "List common mistakes and how to avoid them."
    ];

  return [
    intro,
    isSql ? "Important SQL/DBMS questions for exam practice:" : "Important questions for exam practice:",
    ...questions.map((item, index) => `${index + 1}. ${item}`),
    "Best 2-hour preparation order:",
    isSql
      ? "1. Joins and SELECT queries, 2. Keys and constraints, 3. Normalization, 4. Aggregates/subqueries, 5. Transactions."
      : "1. Definitions, 2. Examples, 3. Problem solving, 4. Comparison questions, 5. Revision.",
    weakest ? `Personal note: your weakest subject is ${weakest.subject}, so connect this practice with that subject if it appears in your syllabus.` : ""
  ].filter(Boolean).join("\n");
}

function extractHours(question) {
  const lower = question.toLowerCase();
  const digitMatch = lower.match(/(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs)/);
  if (digitMatch) return Number(digitMatch[1]);
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  const word = Object.keys(words).find((key) => lower.includes(`${key} hour`) || lower.includes(`${key} hr`));
  return word ? words[word] : 5;
}

function minutesLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function buildTimedStudyPlan(question, snapshot) {
  const { intro, subjects, weakest, strongest } = academicSnapshotLines(snapshot);
  const requestedHours = extractHours(question);
  const totalMinutes = Math.max(60, Math.round(requestedHours * 60));
  const subjectRows = subjects.length ? [...subjects].sort((a, b) => a.percentage - b.percentage) : [
    { subject: "Data Structures", percentage: 0 },
    { subject: "Database Systems", percentage: 0 },
    { subject: "Discrete Mathematics", percentage: 0 },
    { subject: "Operating Systems", percentage: 0 },
    { subject: "Computer Networks", percentage: 0 }
  ];
  const selected = subjectRows.slice(0, 5);
  const baseBreakMinutes = totalMinutes >= 180 ? 20 : 10;
  const studyMinutes = totalMinutes - baseBreakMinutes;
  const weights = selected.map((item, index) => {
    const weaknessBoost = Math.max(0, 100 - (item.percentage || 0));
    return weaknessBoost + (selected.length - index) * 3;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || selected.length;
  let remaining = studyMinutes;
  const slots = selected.map((item, index) => {
    const minutes = index === selected.length - 1
      ? remaining
      : Math.max(35, Math.round((studyMinutes * weights[index]) / totalWeight / 5) * 5);
    remaining -= minutes;
    return { ...item, minutes };
  });

  const breakAfter = Math.floor(selected.length / 2);
  let cursor = 0;
  const schedule = [];
  for (const [index, slot] of slots.entries()) {
    const start = cursor;
    const end = cursor + slot.minutes;
    schedule.push(`${minutesLabel(start)} - ${minutesLabel(end)}: ${slot.subject} (${pct(slot.percentage)}) - revise one concept, solve 2 questions, write mistakes.`);
    cursor = end;
    if (index === breakAfter - 1 && baseBreakMinutes) {
      schedule.push(`${minutesLabel(cursor)} - ${minutesLabel(cursor + baseBreakMinutes)}: Break - water, walk, no phone scrolling.`);
      cursor += baseBreakMinutes;
    }
  }

  return [
    intro,
    `${requestedHours}-hour study plan for 5 subjects:`,
    weakest ? `Priority: Start with ${weakest.subject}, because it is the weakest subject at ${pct(weakest.percentage)}.` : "Priority: Start with the subject you find hardest.",
    strongest ? `Maintenance: Keep ${strongest.subject} in the plan, but do not spend the maximum time there because it is already strongest at ${pct(strongest.percentage)}.` : "",
    "Schedule:",
    ...schedule.map((line, index) => `${index + 1}. ${line}`),
    "How to study each slot:",
    "- First 10 minutes: revise notes/formulas/key definitions.",
    "- Middle time: solve problems or write exam answers.",
    "- Last 5 minutes: write what you got wrong and one doubt to ask.",
    "End check:",
    "- Mark completed subjects.",
    "- Keep tomorrow's first slot for the subject where you made the most mistakes.",
    "- If attendance is below 75% in any subject, do not skip that class even during exam preparation."
  ].filter(Boolean).join("\n");
}

function buildPersonalAcademicAnswer(question, snapshot, mode) {
  if (!snapshot?.student) return null;
  const lower = question.toLowerCase();
  const { intro, subjects, weakest, strongest, attendance, marks, comparison } = academicSnapshotLines(snapshot);
  const gap = marks - (comparison.batchAverage || 0);

  if (/(my|mine|me|i)\b/.test(lower) || lower.includes("attendance") || lower.includes("marks") || lower.includes("rank") || lower.includes("weak") || lower.includes("improve") || lower.includes("study plan")) {
    if (lower.includes("study plan") || lower.includes("timetable") || lower.includes("schedule") || lower.includes("hour")) {
      return buildTimedStudyPlan(question, snapshot);
    }

    if (lower.includes("analyze") || lower.includes("analysis") || lower.includes("exactly") || (lower.includes("marks") && lower.includes("attendance") && lower.includes("rank"))) {
      return [
        intro,
        "Complete performance analysis:",
        `1. Marks: ${pct(marks)} overall. ${gap >= 0 ? `This is ${Math.abs(gap)} points above the batch average.` : `This is ${Math.abs(gap)} points below the batch average.`}`,
        `2. Rank: ${comparison.rank || "-"} of ${comparison.batchSize || "-"}, so your current standing is ${comparison.status || "not available"}.`,
        `3. Attendance: ${pct(attendance)}. ${attendance >= 75 ? "This is currently safe, but keep it stable." : "This is risky and should be corrected first."}`,
        strongest ? `4. Strongest subject: ${strongest.subject} at ${pct(strongest.percentage)}.` : "4. Strongest subject: not available yet.",
        weakest ? `5. Weakest subject: ${weakest.subject} at ${pct(weakest.percentage)}.` : "5. Weakest subject: not available yet.",
        "Exact improvement plan:",
        weakest ? `- Give ${weakest.subject} the first 40-minute study block daily.` : "- Start with the subject where you feel least confident.",
        "- Solve 3 previous/internal questions after each concept.",
        "- Maintain attendance above 75% in every subject, not only overall.",
        "- Recheck rank after the next published assessment; improvement should show through total percentage first.",
        "Honest conclusion: your improvement depends more on strengthening the lowest subject than on revising only the subjects where you already score well."
      ].join("\n");
    }

    if (lower.includes("attendance")) {
      return [
        intro,
        "Attendance answer:",
        `Your overall attendance is ${pct(attendance)}.`,
        attendance >= 75
          ? "This is above the usual 75% safety line. Keep attending consistently so one or two absences do not pull it down."
          : "This is below the usual 75% safety line. Attend upcoming classes regularly and avoid unnecessary absences until it recovers.",
        "Subject-wise attendance:",
        ...(snapshot.attendance?.bySubject || []).map((item) => `- ${item.subject}: ${pct(item.percentage)} (${item.present}/${item.total})`),
        "Rule used here: PRESENT and LATE count as attended; ABSENT and EXCUSED do not count as attended in the current setup."
      ].join("\n");
    }

    if (lower.includes("rank") || lower.includes("batch") || lower.includes("peer")) {
      return [
        intro,
        "Rank and peer comparison:",
        `You are rank ${comparison.rank || "-"} out of ${comparison.batchSize || "-"} students.`,
        `Your marks are ${Math.abs(gap)} percentage points ${gap >= 0 ? "above" : "below"} the batch average.`,
        strongest ? `Main strength: ${strongest.subject} at ${pct(strongest.percentage)}.` : "Main strength cannot be found until marks are available.",
        weakest ? `Main improvement area: ${weakest.subject} at ${pct(weakest.percentage)}.` : "Improvement area cannot be found until marks are available.",
        "To improve rank, focus on the lowest subject first because improving a weak subject usually raises total percentage faster than polishing the strongest subject."
      ].join("\n");
    }

    if (lower.includes("important") || lower.includes("topics") || lower.includes("study plan") || lower.includes("study")) {
      if (weakest) return buildSubjectPlan(weakest.subject, snapshot);
      return buildSubjectPlan("Data Structures", snapshot);
    }

    if (lower.includes("marks") || lower.includes("percentage") || lower.includes("grade") || lower.includes("weak") || lower.includes("improve")) {
      return [
        intro,
        "Marks analysis:",
        ...(subjects.length ? subjects.map((item) => `- ${item.subject}: ${pct(item.percentage)}`) : ["No marks are available yet."]),
        strongest ? `Strongest subject: ${strongest.subject} (${pct(strongest.percentage)}).` : "",
        weakest ? `Weakest subject: ${weakest.subject} (${pct(weakest.percentage)}).` : "",
        weakest ? `Action plan: spend 40 minutes daily on ${weakest.subject}, solve previous questions, and ask one specific doubt after every study session.` : "Action plan: wait for marks to be published, then compare subject percentages.",
        attendance < 75 ? "Also fix attendance because low attendance can affect academic standing even if marks improve." : "Attendance is not the main risk right now, so prioritize subject practice."
      ].filter(Boolean).join("\n");
    }

    if (mode === "practice" && weakest) {
      return buildSubjectPlan(weakest.subject, snapshot);
    }
  }

  return null;
}

function buildDoubtAnswer(question, snapshot = {}, mode = "auto") {
  const q = question.trim();
  const lower = q.toLowerCase();
  const topic = q.replace(/^(explain|summarize|solve|give|provide|what is|define)\s+/i, "").slice(0, 120) || "this topic";
  const subjects = sortedSubjects(snapshot);
  const strongest = subjects[0];
  const weakest = subjects[subjects.length - 1];
  const contextLine = snapshot?.student
    ? `Context for ${studentName(snapshot)}: attendance ${pct(snapshot.attendance?.percentage || 0)}, marks ${pct(snapshot.marks?.percentage || 0)}, rank ${snapshot.comparison?.rank || "-"} of ${snapshot.comparison?.batchSize || "-"}${weakest ? `, weakest subject ${weakest.subject} at ${pct(weakest.percentage)}` : ""}.`
    : "";
  const knowledge = findKnowledge(q);
  const selectedMode =
    mode !== "auto" ? mode : lower.includes("practice") ? "practice" : lower.includes("summar") ? "summary" : lower.includes("step") || lower.includes("solve") ? "steps" : "explain";
  if (lower.includes("important question") || lower.includes("important questions") || lower.includes("exam questions")) {
    return buildImportantQuestions(q, snapshot);
  }
  if (lower.includes("study plan") || lower.includes("timetable") || lower.includes("schedule") || lower.includes("daily routine") || (lower.includes("hour") && lower.includes("subject"))) {
    return buildTimedStudyPlan(q, snapshot);
  }
  const personalAnswer = buildPersonalAcademicAnswer(q, snapshot, selectedMode);
  if (personalAnswer) return personalAnswer;

  for (const subjectName of Object.keys(subjectPlans)) {
    if ((lower.includes("important") || lower.includes("topics") || lower.includes("syllabus")) && lower.includes(subjectName)) {
      return buildSubjectPlan(subjectName, snapshot);
    }
  }

  if (knowledge) return buildKnowledgeAnswer(knowledge, q, snapshot, selectedMode);

  if (selectedMode === "practice") {
    return [
      contextLine,
      `Practice set for ${topic}:`,
      "1. Write the key definition in your own words.",
      "2. Solve one direct formula/concept question.",
      "3. Solve one application question with changed values or a new example.",
      "4. Explain the answer in 4-5 lines as if teaching a classmate.",
      weakest ? `Because ${weakest.subject} is currently the weakest area, connect one practice question to that subject if possible.` : "Send me one attempted answer and I can check it step by step."
    ].join("\n");
  }

  if (selectedMode === "summary") {
    return [
      contextLine,
      `Summary of ${topic}:`,
      "Start with the main idea, then list the important terms, then connect them with one example.",
      "A good revision summary should include: definition, purpose, key rule/formula, common mistake, and one solved example.",
      `For ${topic}, focus on understanding why it is used, not only memorizing the wording.`,
      strongest ? `Use your stronger subject habit from ${strongest.subject}: keep examples clear and test yourself after revision.` : "After summarizing, test yourself with two short questions."
    ].join("\n");
  }

  if (selectedMode === "steps") {
    return [
      contextLine,
      `Step-by-step method for ${topic}:`,
      "1. Identify what is given and what must be found.",
      "2. Write the relevant concept, theorem, syntax rule, or formula.",
      "3. Substitute values or apply the rule carefully.",
      "4. Check the result against the original question.",
      "5. Write the final answer with units, reasoning, or conclusion.",
      "Share the exact numerical/problem statement if you want me to solve that specific problem."
    ].join("\n");
  }

  if (lower.includes("difference") || lower.includes("compare")) {
    return [
      contextLine,
      `Comparison answer for ${topic}:`,
      "Use three columns: feature, first concept, second concept.",
      "Compare purpose, input/data used, output/result, advantages, limitations, and one example.",
      "This structure usually scores well because it is clear and exam-friendly."
    ].join("\n");
  }

  return [
    contextLine,
    `Explanation of ${topic}:`,
    `${topic} should be understood in three layers: the definition, why it is needed, and how it is applied in a real question.`,
    "First learn the core idea in simple words. Then connect it to one example. Finally, test yourself with a small problem.",
    weakest ? `Since ${weakest.subject} is your lowest current subject, ask follow-up doubts from that subject first for maximum improvement.` : "If you send the exact chapter, formula, code, or problem statement, I can give a more exact answer."
  ].join("\n");
}

export function doubtAssistantPrompt(question, snapshot = {}, mode = "auto") {
  return {
    system:
      "You are the primary academic AI assistant inside a student portal. Give accurate, exam-useful answers with clear headings, examples, and next steps. Use the student's real marks, attendance, rank, weak subjects, and batch average when the question is personal. For academic concepts, answer from reliable computer science and mathematics knowledge. If a problem statement is incomplete, state exactly what information is missing. Do not invent marks, dates, citations, student identities, or peer names. Never expose other students.",
    user: JSON.stringify({ question, snapshot, mode }, null, 2)
  };
}

export function smartFeedbackPrompt(snapshot) {
  return {
    system:
      "You generate short positive personalized academic feedback based on real attendance, marks, rank, and trends. Identify strengths, weak areas, and practical next actions without negativity.",
    user: JSON.stringify(snapshot, null, 2)
  };
}

export function peerComparisonPrompt(snapshot, period) {
  return {
    system:
      "You create anonymized academic peer comparison reports. Never expose other students' identities. Include performance snapshot, comparison with batch average, strengths, improvement areas, motivational guidance, and next steps.",
    user: JSON.stringify({ period, snapshot }, null, 2)
  };
}

export async function answerDoubt(question, snapshot, mode) {
  const prompt = doubtAssistantPrompt(question, snapshot, mode);
  return complete(prompt.system, prompt.user);
}

export async function generateSmartFeedback(snapshot) {
  const prompt = smartFeedbackPrompt(snapshot);
  return complete(prompt.system, prompt.user);
}

export async function generatePeerReport(snapshot, period) {
  const prompt = peerComparisonPrompt(snapshot, period);
  return complete(prompt.system, prompt.user);
}
