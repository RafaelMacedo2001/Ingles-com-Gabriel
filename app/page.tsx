"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type View = "login" | "admin" | "student";
type StudentSection = "lessons" | "calendar" | "progress" | "materials";
type Student = { id: string; name: string; email: string; phone: string; expiresAt: string; status: "Ativo" | "Expira em breve" | "Expirado"; initials: string; color: string; accessCount?: number; renewalCount?: number };
type CurrentUser = { name: string; email: string; expiresAt: string };
type DashboardStats = { total: number; active: number; expired: number; expiring: number; renewed: number; weeklyAccesses: number };
type AdminSection = "overview" | "students" | "lessons" | "calendar" | "communications" | "settings";
type LessonMaterial = { id: string; title: string; fileName: string; contentType: string; size: number; url: string };
type LessonCard = { id: string; number: string; title: string; date: string; duration: string; level: string; color: string; featured?: boolean; sourceName?: string; folderPath?: string; material?: LessonMaterial | null };
type Communication = { id: string; title: string; body: string; created_at: string; unread?: number | boolean };
type ScheduleEntry = { id: string; weekday: number; start_time: string; title: string; details: string };
type ProgressEntry = { lesson_id: string; lesson_title: string; watched_at: string };
type SettingsStatus = { email: { configured: boolean; emailFrom: string; appUrl: string; hasApiKey: boolean }; drive: { configured: boolean; clientEmail: string; folderId: string; hasPrivateKey: boolean }; payment: { configured: boolean; hasAccessToken: boolean; hasWebhookSecret: boolean; title: string; price: string } };

const COURSE_TIME_ZONE = "America/Sao_Paulo";

const weekdays = [
  { value: 1, name: "Segunda", short: "SEG" },
  { value: 2, name: "Terça", short: "TER" },
  { value: 3, name: "Quarta", short: "QUA" },
  { value: 4, name: "Quinta", short: "QUI" },
  { value: 5, name: "Sexta", short: "SEX" },
  { value: 6, name: "Sábado", short: "SÁB" },
];

const scheduleNotes = [
  "Estudar pela plataforma Hotmart de 3 a 4 vezes por semana é essencial para sua evolução e para aumentar seu vocabulário.",
  "As conversações acontecem pelo Zoom, são indicadas para alunos acima das aulas 15/20 e as respostas devem ser preparadas antes do encontro.",
  "As revisões de segunda e sexta, às 18h, são encontros extras conduzidos pela aluna Vilma. É um grupo de estudos somente entre alunos.",
];

const initialStudents: Student[] = [
  { id: "1", name: "Marina Costa", email: "marina.costa@email.com", phone: "+5511999990001", expiresAt: "18 set. 2026", status: "Ativo", initials: "MC", color: "lilac" },
  { id: "2", name: "Lucas Almeida", email: "lucas.almeida@email.com", phone: "+5511999990002", expiresAt: "07 set. 2026", status: "Expira em breve", initials: "LA", color: "orange" },
  { id: "3", name: "Beatriz Santos", email: "bia.santos@email.com", phone: "+5511999990003", expiresAt: "30 out. 2026", status: "Ativo", initials: "BS", color: "mint" },
  { id: "4", name: "Gabriel Rocha", email: "gabriel.rocha@email.com", phone: "+5511999990004", expiresAt: "02 set. 2026", status: "Expira em breve", initials: "GR", color: "blue" },
  { id: "5", name: "Camila Nunes", email: "camila.nunes@email.com", phone: "+5511999990005", expiresAt: "14 nov. 2026", status: "Ativo", initials: "CN", color: "rose" },
];

const lessons: LessonCard[] = [
  { id: "l1", number: "Aula 48", title: "Small talk: como manter uma conversa", date: "31 ago. 2026", duration: "52 min", level: "Intermediário", color: "violet", featured: true },
  { id: "l2", number: "Aula 47", title: "Present Perfect sem complicação", date: "30 ago. 2026", duration: "46 min", level: "Intermediário", color: "coral" },
  { id: "l3", number: "Aula 46", title: "Inglês para viagens: no aeroporto", date: "29 ago. 2026", duration: "58 min", level: "Todos os níveis", color: "sky" },
  { id: "l4", number: "Aula 45", title: "Phrasal verbs que você vai usar", date: "28 ago. 2026", duration: "49 min", level: "Intermediário", color: "lime" },
  { id: "l5", number: "Aula 44", title: "Pronúncia: sons do TH", date: "27 ago. 2026", duration: "43 min", level: "Básico", color: "yellow" },
  { id: "l6", number: "Aula 43", title: "Como pensar em inglês", date: "26 ago. 2026", duration: "51 min", level: "Todos os níveis", color: "pink" },
];

function Brand({ light = false }: { light?: boolean }) {
  return <div className={`brand ${light ? "brand-light" : ""}`}><img className="brand-mark" src="/gabriel-course-icon.png" alt="Professor Gabriel" /><span className="brand-copy">Inglês <span>com Gabriel</span></span></div>;
}

function Icon({ children }: { children: string }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

function EnglishLoader({ compact = false }: { compact?: boolean }) {
  return <div className={`english-loader ${compact ? "compact" : ""}`} role="status" aria-live="polite" aria-label="Carregando">
    <div className="loader-mark"><span>IG</span></div>
    <div className="loader-words" aria-hidden="true"><span className="loader-word wait">Wait</span><span className="loader-word loading">Loading</span></div>
    <div className="loader-line" aria-hidden="true"><i /></div>
  </div>;
}

function formatFullDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatVideoTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return hours ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

function formatLessonDuration(durationMillis?: string) {
  const milliseconds = Number(durationMillis);
  return Number.isFinite(milliseconds) && milliseconds > 0 ? formatVideoTime(milliseconds / 1000) : "Duração indisponível";
}

function lessonDateTimestamp(fileName: string, uploadedAt?: string) {
  const yearFirst = fileName.match(/\b(20\d{2})[-_. ](0[1-9]|1[0-2])[-_. ](0[1-9]|[12]\d|3[01])\b/);
  const dayFirst = fileName.match(/\b(0[1-9]|[12]\d|3[01])[-_. ](0[1-9]|1[0-2])[-_. ](20\d{2})\b/);
  const parts = yearFirst ? { year: yearFirst[1], month: yearFirst[2], day: yearFirst[3] } : dayFirst ? { year: dayFirst[3], month: dayFirst[2], day: dayFirst[1] } : null;
  if (parts) {
    const timestamp = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00-03:00`).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  const uploadedTimestamp = uploadedAt ? new Date(uploadedAt).getTime() : 0;
  return Number.isFinite(uploadedTimestamp) ? uploadedTimestamp : 0;
}

function formatLessonDate(fileName: string, uploadedAt?: string) {
  const timestamp = lessonDateTimestamp(fileName, uploadedAt);
  return timestamp ? new Date(timestamp).toLocaleDateString("pt-BR", { timeZone: COURSE_TIME_ZONE }) : "Data não informada";
}

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Arquivo";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return value || "Telefone não informado";
}

function groupLessonsByFolder(items: LessonCard[]) {
  const groups = new Map<string, LessonCard[]>();
  for (const lesson of items) {
    const folder = lesson.folderPath || "Aulas gerais";
    groups.set(folder, [...(groups.get(folder) || []), lesson]);
  }
  return Array.from(groups, ([name, groupedLessons]) => ({ name, lessons: groupedLessons }));
}

function LessonPlayer({ lesson, onClose, onFirstPlay }: { lesson: LessonCard; onClose: () => void; onFirstPlay?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const progressRecorded = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [playerError, setPlayerError] = useState("");

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function updateFullscreen() {
      setFullscreen(document.fullscreenElement === playerRef.current);
    }
    window.addEventListener("keydown", closeOnEscape);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("fullscreenchange", updateFullscreen);
    };
  }, [onClose]);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    setPlayerError("");
    try {
      if (video.paused) await video.play();
      else video.pause();
    } catch {
      setPlayerError("Não foi possível iniciar o vídeo. Confira se o arquivo está compartilhado com a conta de serviço.");
    }
  }

  function registerFirstPlay() {
    setPlaying(true);
    if (progressRecorded.current) return;
    progressRecorded.current = true;
    onFirstPlay?.();
  }

  function seek(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  }

  function changeVolume(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await playerRef.current?.requestFullscreen();
    } catch {
      setPlayerError("Seu navegador não permitiu abrir o vídeo em tela cheia.");
    }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="video-modal" role="dialog" aria-modal="true" aria-label={`Player da aula ${lesson.title}`} onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Fechar player">×</button>
      <div className="secure-video-wrap" ref={playerRef}>
        <div className="video-stage">
        <video
          ref={videoRef}
          className="secure-video"
          src={`/api/lessons/${encodeURIComponent(lesson.id)}/stream`}
          preload="metadata"
          playsInline
          onLoadStart={() => setBuffering(true)}
          onWaiting={() => setBuffering(true)}
          onSeeking={() => setBuffering(true)}
          onCanPlay={() => setBuffering(false)}
          onPlaying={() => setBuffering(false)}
          onSeeked={() => setBuffering(false)}
          onPlay={registerFirstPlay}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onError={() => { setBuffering(false); setPlayerError("O vídeo não pôde ser carregado. Verifique o formato do arquivo e o compartilhamento da pasta no Google Drive."); }}
        />
          {buffering && !playerError && <div className="video-loading"><EnglishLoader compact /></div>}
        </div>
        <div className="video-controls">
          <button className="video-play-button" type="button" onClick={() => void togglePlayback()} aria-label={playing ? "Pausar vídeo" : "Reproduzir vídeo"}>{playing ? "Ⅱ" : "▶"}<span>{playing ? "Pausar" : "Reproduzir"}</span></button>
          <span className="video-time">{formatVideoTime(currentTime)}</span>
          <input className="video-seek" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} aria-label="Posição do vídeo" />
          <span className="video-time">{formatVideoTime(duration)}</span>
          <div className="volume-control">
            <button type="button" onClick={toggleMute} aria-label={muted ? "Ativar som" : "Silenciar vídeo"}>{muted || volume === 0 ? "🔇" : volume < .5 ? "🔉" : "🔊"}</button>
            <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={(event) => changeVolume(Number(event.target.value))} aria-label="Volume do vídeo" />
          </div>
          <button className="fullscreen-button" type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Reduzir o vídeo" : "Abrir em tela cheia"}><i className={`fullscreen-icon ${fullscreen ? "minimize" : "maximize"}`} aria-hidden="true" /><span>{fullscreen ? "Reduzir" : "Tela cheia"}</span></button>
        </div>
      </div>
      {playerError && <div className="video-error" role="alert">{playerError}</div>}
      <div className="video-info"><small>{lesson.number}</small><h2>{lesson.title}</h2><p>{lesson.duration} · {lesson.level}</p>{lesson.material && <a className="player-material-button" href={lesson.material.url} target="_blank" rel="noreferrer">Acessar material <span>→</span></a>}</div>
    </div>
  </div>;
}

export default function Home() {
  const [view, setView] = useState<View>("login");
  const [initialLoading, setInitialLoading] = useState(true);
  const [loginType, setLoginType] = useState<"student" | "admin">("student");
  const [students, setStudents] = useState(initialStudents);
  const [search, setSearch] = useState("");
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [showPlayer, setShowPlayer] = useState<LessonCard | null>(null);
  const [toast, setToast] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activationEmail, setActivationEmail] = useState("");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [stats, setStats] = useState<DashboardStats>({ total: 0, active: 0, expired: 0, expiring: 0, renewed: 0, weeklyAccesses: 0 });
  const [adminSection, setAdminSection] = useState<AdminSection>("overview");
  const [adminLessons, setAdminLessons] = useState<LessonCard[]>([]);
  const [adminFolderFilter, setAdminFolderFilter] = useState("all");
  const [driveConfigured, setDriveConfigured] = useState(false);
  const [studentLessons, setStudentLessons] = useState<LessonCard[]>(lessons);
  const [studentLessonSearch, setStudentLessonSearch] = useState("");
  const [showLessonFilters, setShowLessonFilters] = useState(false);
  const [studentLevelFilter, setStudentLevelFilter] = useState("Todos os níveis");
  const [selectedStudentFolders, setSelectedStudentFolders] = useState<string[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [settings, setSettings] = useState<SettingsStatus | null>(null);
  const [studentSection, setStudentSection] = useState<StudentSection>("lessons");
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleEntry | null>(null);
  const [uploadingMaterialId, setUploadingMaterialId] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const firstAccessEmail = searchParams.get("first_access");
    const purchaseStatus = searchParams.get("purchase");
    const purchaseEmail = searchParams.get("email") || "";
    if (firstAccessEmail) { setLoginEmail(firstAccessEmail); setActivationEmail(firstAccessEmail); }
    if (purchaseStatus === "success") notify("Pagamento aprovado. Em alguns instantes você receberá o convite de acesso por e-mail.");
    if (purchaseStatus === "pending") notify("Pagamento em análise. Assim que for aprovado, seu acesso será liberado.");
    if (purchaseStatus === "failure") notify("Pagamento não concluído. Você pode tentar novamente quando quiser.");
    if (purchaseEmail) setLoginEmail(purchaseEmail);
    if (purchaseStatus) window.history.replaceState({}, "", "/");
    fetch("/api/session").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { role: "admin" | "student"; name?: string; email: string; expiresAt?: string };
      resetSessionUi();
      if (data.role === "student" && data.name && data.expiresAt) setCurrentUser({ name: data.name, email: data.email, expiresAt: data.expiresAt });
      setView(data.role);
    }).catch(() => undefined).finally(() => setInitialLoading(false));
  }, []);

  async function loadDashboard() {
    try {
      const response = await fetch("/api/students");
      if (!response.ok) return;
      const data = await response.json() as { students: Array<{ id: string; name: string; email: string; phone?: string; expires_at: string; access_count: number; renewal_count: number }>; stats: DashboardStats };
      setStats(data.stats);
      setStudents(data.students.map((student, index) => {
        const expiry = new Date(student.expires_at);
        const remaining = expiry.getTime() - Date.now();
        const status = remaining < 0 ? "Expirado" : remaining <= 7 * 86400000 ? "Expira em breve" : "Ativo";
        return { id: student.id, name: student.name, email: student.email, phone: student.phone || "", expiresAt: expiry.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).replaceAll(" de ", " "), status, initials: student.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), color: ["lilac", "orange", "mint", "blue", "rose"][index % 5], accessCount: Number(student.access_count || 0), renewalCount: Number(student.renewal_count || 0) };
      }));
    } catch { /* mantém o painel disponível durante uma falha temporária */ }
  }

  useEffect(() => { if (view === "admin") void loadDashboard(); }, [view]);

  async function loadLessons() {
    try {
      const response = await fetch("/api/lessons");
      if (!response.ok) return;
      const data = await response.json() as { configured: boolean; lessons: Array<{ id: string; name: string; title: string; level: string; createdTime?: string; size?: string; folderPath?: string; videoMediaMetadata?: { durationMillis?: string }; material?: LessonMaterial | null }> };
      const orderedLessons = [...data.lessons].sort((a, b) => lessonDateTimestamp(b.name, b.createdTime) - lessonDateTimestamp(a.name, a.createdTime));
      const mapped = orderedLessons.map((lesson, index) => ({ id: lesson.id, number: `Aula ${orderedLessons.length - index}`, title: lesson.title, date: formatLessonDate(lesson.name, lesson.createdTime), duration: formatLessonDuration(lesson.videoMediaMetadata?.durationMillis), level: lesson.level, color: ["violet", "coral", "sky", "lime", "yellow", "pink"][index % 6], featured: index === 0, sourceName: lesson.name, folderPath: lesson.folderPath, material: lesson.material }));
      setAdminLessons(mapped); setStudentLessons(mapped.length ? mapped : lessons); setDriveConfigured(data.configured);
    } catch { /* mantém os exemplos enquanto o Drive estiver indisponível */ }
  }

  async function loadCommunications() {
    try {
      const response = await fetch("/api/communications");
      if (!response.ok) return;
      const data = await response.json() as { communications: Communication[] };
      setCommunications(data.communications);
    } catch { /* notificações ficam vazias durante uma falha temporária */ }
  }

  async function loadSettings() {
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) return;
      setSettings(await response.json() as SettingsStatus);
    } catch { /* mantém o formulário disponível */ }
  }

  async function loadSchedule() {
    try {
      const response = await fetch("/api/schedule");
      if (!response.ok) return;
      const data = await response.json() as { entries: ScheduleEntry[] };
      setSchedule(data.entries);
    } catch { /* mantém o calendário disponível após a próxima sincronização */ }
  }

  async function loadProgress() {
    try {
      const response = await fetch("/api/progress");
      if (!response.ok) return;
      const data = await response.json() as { progress: ProgressEntry[] };
      setProgress(data.progress);
    } catch { /* o histórico será carregado novamente quando a conexão voltar */ }
  }

  useEffect(() => { if (view === "admin" || view === "student") void loadLessons(); }, [view]);
  useEffect(() => { if (view === "admin" || view === "student") void loadCommunications(); }, [view]);
  useEffect(() => { if (view === "admin" || view === "student") void loadSchedule(); }, [view]);
  useEffect(() => { if (view === "student") void loadProgress(); }, [view]);
  useEffect(() => { if (view === "admin") void loadSettings(); }, [view]);

  const filteredStudents = useMemo(() => students.filter((student) =>
    `${student.name} ${student.email} ${student.phone}`.toLowerCase().includes(search.toLowerCase())), [students, search]);
  const unreadCommunications = useMemo(() => communications.filter((message) => Boolean(message.unread)).length, [communications]);
  const watchedLessonIds = useMemo(() => new Set(progress.map((entry) => entry.lesson_id)), [progress]);
  const completedLessons = useMemo(() => studentLessons.filter((lesson) => watchedLessonIds.has(lesson.id)).length, [studentLessons, watchedLessonIds]);
  const studentFolders = useMemo(() => Array.from(new Set(studentLessons.map((lesson) => lesson.folderPath || "Aulas gerais"))), [studentLessons]);
  const hasStudentFolderFilter = selectedStudentFolders.length > 0 && selectedStudentFolders.length < studentFolders.length;
  const filteredStudentLessons = useMemo(() => studentLessons.filter((lesson) => {
    const matchesSearch = `${lesson.title} ${lesson.sourceName || ""}`.toLowerCase().includes(studentLessonSearch.trim().toLowerCase());
    const matchesLevel = studentLevelFilter === "Todos os níveis" || lesson.level === studentLevelFilter;
    const matchesFolder = !hasStudentFolderFilter || selectedStudentFolders.includes(lesson.folderPath || "Aulas gerais");
    return matchesSearch && matchesLevel && matchesFolder;
  }), [studentLessons, studentLessonSearch, studentLevelFilter, selectedStudentFolders, hasStudentFolderFilter]);
  const studentLessonGroups = useMemo(() => groupLessonsByFolder(filteredStudentLessons), [filteredStudentLessons]);
  const activeStudentFilterCount = (studentLevelFilter === "Todos os níveis" ? 0 : 1) + (hasStudentFolderFilter ? 1 : 0);
  const adminFolders = useMemo(() => Array.from(new Set(adminLessons.map((lesson) => lesson.folderPath || "Aulas gerais"))), [adminLessons]);
  const filteredAdminLessons = useMemo(() => adminFolderFilter === "all" ? adminLessons : adminLessons.filter((lesson) => (lesson.folderPath || "Aulas gerais") === adminFolderFilter), [adminLessons, adminFolderFilter]);
  const adminLessonGroups = useMemo(() => groupLessonsByFolder(filteredAdminLessons), [filteredAdminLessons]);

  useEffect(() => {
    if (adminFolderFilter !== "all" && !adminFolders.includes(adminFolderFilter)) setAdminFolderFilter("all");
  }, [adminFolderFilter, adminFolders]);

  useEffect(() => {
    setSelectedStudentFolders((current) => current.filter((folder) => studentFolders.includes(folder)));
  }, [studentFolders]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  function resetSessionUi() {
    setAdminSection("overview");
    setStudentSection("lessons");
    setStudentLessonSearch("");
    setShowLessonFilters(false);
    setStudentLevelFilter("Todos os níveis");
    setSelectedStudentFolders([]);
    setShowNotifications(false);
    setShowPlayer(null);
    setShowNewStudent(false);
    setShowPurchaseModal(false);
    setPurchaseLoading(false);
    setEditingStudent(null);
    setShowScheduleEditor(false);
    setEditingSchedule(null);
    setSearch("");
    setToast("");
    setError("");
    setPasswordVisible(false);
    setStudents([]);
    setStats({ total: 0, active: 0, expired: 0, expiring: 0, renewed: 0, weeklyAccesses: 0 });
    setAdminLessons([]);
    setAdminFolderFilter("all");
    setStudentLessons([]);
    setDriveConfigured(false);
    setCommunications([]);
    setProgress([]);
    setSchedule([]);
    setSettings(null);
    setUploadingMaterialId(null);
  }

  async function openNotifications() {
    const willOpen = !showNotifications;
    setShowNotifications(willOpen);
    if (!willOpen || unreadCommunications === 0) return;
    try {
      const response = await fetch("/api/communications/read", { method: "POST" });
      if (response.ok) setCommunications((current) => current.map((message) => ({ ...message, unread: false })));
    } catch { /* mantém o badge para tentar novamente no próximo acesso */ }
  }

  async function openLesson(lesson: LessonCard) {
    setShowPlayer(lesson);
  }

  async function registerLessonProgress(lesson: LessonCard) {
    try {
      const response = await fetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId: lesson.id, lessonTitle: lesson.title }) });
      if (response.ok) await loadProgress();
    } catch { /* a aula continua disponível mesmo se o registro atrasar */ }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const data = await response.json() as { role?: View; error?: string; needsActivation?: boolean; name?: string; email?: string; expiresAt?: string };
      if (!response.ok && data.needsActivation) { setActivationEmail(String(form.get("email"))); return; }
      if (!response.ok) throw new Error(data.error);
      resetSessionUi();
      setActivationEmail("");
      if (data.role === "student" && data.name && data.email && data.expiresAt) setCurrentUser({ name: data.name, email: data.email, expiresAt: data.expiresAt });
      setView(data.role === "admin" ? "admin" : "student");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
    } finally { setLoading(false); }
  }

  async function handleActivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) { setError("As senhas não coincidem."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: activationEmail, password }) });
      const data = await response.json() as { role?: View; error?: string; name?: string; email?: string; expiresAt?: string };
      if (!response.ok) throw new Error(data.error);
      resetSessionUi();
      if (data.name && data.email && data.expiresAt) setCurrentUser({ name: data.name, email: data.email, expiresAt: data.expiresAt });
      window.history.replaceState({}, "", "/");
      setView(data.role === "admin" ? "admin" : "student");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar sua senha."); }
    finally { setLoading(false); }
  }

  async function handleAddStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name"));
    const email = String(form.get("email"));
    const phone = String(form.get("phone"));
    const expires = String(form.get("expires"));
    let invitationSent = false;
    let invitationMessage = "O aluno foi cadastrado, mas o e-mail de convite não foi enviado.";
    try {
      const response = await fetch("/api/students", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, phone, expiresAt: `${expires}T23:59:59Z` }) });
      const result = await response.json() as { id?: string; error?: string; invitationSent?: boolean; invitationMessage?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar o aluno.");
      invitationSent = Boolean(result.invitationSent);
      invitationMessage = result.invitationMessage || invitationMessage;
    } catch (cause) {
      setShowNewStudent(false);
      notify(cause instanceof Error ? cause.message : "Não foi possível cadastrar o aluno.");
      return;
    }
    await loadDashboard();
    setShowNewStudent(false);
    notify(invitationSent ? `Convite enviado para ${email}` : invitationMessage);
  }

  async function handleStartPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPurchaseLoading(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), phone: form.get("phone") }),
      });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "Não foi possível iniciar o pagamento.");
      window.location.href = data.checkoutUrl;
    } catch (cause) {
      setPurchaseLoading(false);
      notify(cause instanceof Error ? cause.message : "Não foi possível iniciar o pagamento.");
    }
  }

  async function handleLogout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* encerra a interface mesmo offline */ }
    resetSessionUi();
    setCurrentUser(null); setActivationEmail(""); setLoginEmail(""); setView("login");
  }

  async function handleUpdateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStudent) return;
    const form = new FormData(event.currentTarget);
    const date = String(form.get("expires"));
    const phone = String(form.get("phone"));
    try {
      const response = await fetch(`/api/students/${editingStudent.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expiresAt: `${date}T23:59:59Z`, phone }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) { notify(data.error || "Não foi possível atualizar o aluno."); return; }
    } catch { notify("Não foi possível atualizar o aluno."); return; }
    const formatted = new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replaceAll(" de ", " ");
    setStudents((current) => current.map((student) => student.id === editingStudent.id ? { ...student, phone, expiresAt: formatted, status: "Ativo" } : student));
    await loadDashboard();
    setEditingStudent(null); notify("Dados do aluno atualizados com sucesso");
  }

  async function handleDeleteStudent() {
    if (!editingStudent) return;
    try { await fetch(`/api/students/${editingStudent.id}`, { method: "DELETE" }); } catch { /* demo */ }
    setStudents((current) => current.filter((student) => student.id !== editingStudent.id));
    await loadDashboard();
    setEditingStudent(null); notify("Aluno removido");
  }

  async function handleResendInvitation() {
    if (!editingStudent) return;
    try {
      const response = await fetch(`/api/students/${editingStudent.id}/invite`, { method: "POST" });
      const data = await response.json() as { message?: string; error?: string };
      notify(data.message || data.error || "Não foi possível enviar o convite.");
    } catch { notify("Não foi possível enviar o convite."); }
  }

  async function handleSaveLesson(event: FormEvent<HTMLFormElement>, lessonId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/lessons/${lessonId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: form.get("title"), level: form.get("level") }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { notify(data.error || "Não foi possível salvar a aula."); return; }
    await loadLessons(); notify("Card da aula atualizado");
  }

  async function handleUploadMaterial(formElement: HTMLFormElement, lesson: LessonCard) {
    const form = new FormData(formElement);
    const file = form.get("materialFile");
    const materialTitle = String(form.get("materialTitle") || "").trim();
    if (!(file instanceof File) || !file.size) { notify("Selecione um arquivo para anexar."); return; }
    if (!materialTitle) { notify("Informe o título do material."); return; }
    const lessonTitle = String(form.get("title") || lesson.title).trim();
    const upload = new FormData();
    upload.set("lessonId", lesson.id);
    upload.set("lessonTitle", lessonTitle);
    upload.set("title", materialTitle);
    upload.set("file", file);
    setUploadingMaterialId(lesson.id);
    try {
      const response = await fetch("/api/materials", { method: "POST", body: upload });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível anexar o material.");
      await loadLessons();
      notify("Material disponibilizado para os alunos");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Não foi possível anexar o material.");
    } finally {
      setUploadingMaterialId(null);
    }
  }

  async function handlePublishCommunication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/communications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: form.get("title"), body: form.get("body") }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { notify(data.error || "Não foi possível publicar o comunicado."); return; }
    formElement.reset(); await loadCommunications(); notify("Comunicado publicado para todos os alunos");
  }

  async function handleDeleteCommunication(id: string) {
    const response = await fetch(`/api/communications/${id}`, { method: "DELETE" });
    if (!response.ok) { notify("Não foi possível remover o comunicado."); return; }
    await loadCommunications(); notify("Comunicado removido");
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(Array.from(form.entries()).filter(([, value]) => String(value).trim()));
    const response = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { notify(data.error || "Não foi possível salvar as configurações."); return; }
    await loadSettings(); await loadLessons(); notify("Configurações salvas com segurança");
  }

  async function handleSaveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { weekday: Number(form.get("weekday")), startTime: String(form.get("startTime")), title: String(form.get("title")), details: String(form.get("details") || "") };
    const isEditing = Boolean(editingSchedule?.id);
    const response = await fetch(isEditing ? `/api/schedule/${editingSchedule?.id}` : "/api/schedule", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) { notify(data.error || "Não foi possível salvar o horário."); return; }
    await loadSchedule();
    setEditingSchedule(null); setShowScheduleEditor(false);
    notify(isEditing ? "Horário atualizado" : "Aula adicionada ao calendário");
  }

  async function handleDeleteSchedule(entry: ScheduleEntry) {
    const response = await fetch(`/api/schedule/${entry.id}`, { method: "DELETE" });
    if (!response.ok) { notify("Não foi possível remover o horário."); return; }
    await loadSchedule(); notify("Horário removido do calendário");
  }

  function scheduleTone(entry: ScheduleEntry) {
    const value = `${entry.title} ${entry.details}`.toLowerCase();
    if (value.includes("conversa")) return "conversation";
    if (value.includes("revis")) return "review";
    if (value.includes("instagram") || value.includes("live")) return "live";
    return "class";
  }

  if (initialLoading) return <main className="initial-loading"><Brand /><EnglishLoader /></main>;

  if (view === "login") return (
    <main className="login-page">
      <section className="login-visual">
        <Brand light />
        <div className="visual-copy">
          <div className="eyebrow light"><span>●</span> Fala e conversação na prática</div>
          <h1>Fale inglês com confiança.<br /><em>Evolua todos os dias.</em></h1>
          <p>Reveja suas aulas quando quiser e transforme prática constante em segurança para se comunicar em inglês.</p>
          <div className="mini-proof">
            <div className="proof-faces"><span>MA</span><span>LC</span><span>BS</span></div>
            <div><strong>+120 alunos ativos</strong><small>Aulas novas todos os dias</small></div>
          </div>
        </div>
        <div className="visual-orb orb-one" /><div className="visual-orb orb-two" />
        <div className="visual-foot">PRÁTICA &nbsp;•&nbsp; CONFIANÇA &nbsp;•&nbsp; FLUÊNCIA</div>
      </section>
      <section className="login-panel">
        <div className="mobile-brand"><Brand /></div>
        <div className="login-box">
          <div className="eyebrow"><span>●</span> Área exclusiva</div>
          <h2>Que bom ter você aqui.</h2>
          <p className="subtle">Acesse suas aulas e continue avançando.</p>
          <div className="login-tabs" role="tablist">
            <button className={loginType === "student" ? "active" : ""} onClick={() => { setLoginType("student"); setError(""); }}>Sou aluno</button>
            <button className={loginType === "admin" ? "active" : ""} onClick={() => { setLoginType("admin"); setError(""); }}>Sou gestor</button>
          </div>
          {activationEmail ? <form onSubmit={handleActivation} className="login-form">
            <div className="activation-note"><strong>Crie sua senha</strong><span>Primeiro acesso de {activationEmail}</span></div>
            <label>Nova senha<input name="password" type="password" placeholder="Mínimo de 8 caracteres" minLength={8} required /></label>
            <label>Confirmar senha<input name="confirm" type="password" placeholder="Repita a senha" minLength={8} required /></label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" disabled={loading}>{loading ? "Criando..." : "Criar senha e acessar"}<span>→</span></button>
            <button type="button" className="demo-link" onClick={() => setActivationEmail("")}>Voltar ao acesso</button>
          </form> : <form onSubmit={handleLogin} className="login-form">
            <label>E-mail<input name="email" type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder={loginType === "admin" ? "gestor@seudominio.com" : "voce@email.com"} required /></label>
            <label>Senha<div className="password-field"><input name="password" type={passwordVisible ? "text" : "password"} placeholder="Sua senha" required /><button type="button" onClick={() => setPasswordVisible(!passwordVisible)} aria-label="Mostrar senha">{passwordVisible ? "Ocultar" : "Mostrar"}</button></div></label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" disabled={loading}>{loading ? "Entrando..." : "Entrar na plataforma"}<span>→</span></button>
          </form>}
          {loginType === "student" && !activationEmail && <button className="purchase-access-button" onClick={() => setShowPurchaseModal(true)}>Não é aluno? Adquira aqui o acesso <span>→</span></button>}
          {loginType === "student" && !activationEmail && <button className="demo-link" onClick={() => setView("student")}>Visualizar demonstração →</button>}
          {loginType === "student" && !activationEmail && <button className="first-access first-access-button" onClick={() => loginEmail.includes("@") ? setActivationEmail(loginEmail) : setError("Informe seu e-mail para criar a senha.")}>Primeiro acesso? <strong>Criar minha senha</strong></button>}
        </div>
        {showPurchaseModal && <div className="modal-backdrop" onMouseDown={() => !purchaseLoading && setShowPurchaseModal(false)}><div className="form-modal purchase-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-heading"><div><span className="modal-icon">MP</span><div><h2>Adquirir acesso</h2><p>Informe seus dados para seguir ao pagamento seguro.</p></div></div><button onClick={() => setShowPurchaseModal(false)} disabled={purchaseLoading}>×</button></div><form onSubmit={handleStartPurchase}><label>Nome completo<input name="name" placeholder="Ex.: Juliana Martins" required /></label><label>E-mail<input name="email" type="email" placeholder="juliana@email.com" required /></label><label>Número de telefone<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" minLength={10} required /></label><div className="modal-note payment-note"><span>✓</span><p><strong>Acesso anual</strong>Após a aprovação do pagamento, seu cadastro será liberado automaticamente por 1 ano.</p></div><div className="modal-actions"><button type="button" onClick={() => setShowPurchaseModal(false)} disabled={purchaseLoading}>Cancelar</button><button className="primary-button compact" disabled={purchaseLoading}>{purchaseLoading ? "Abrindo checkout..." : "Ir para o Mercado Pago"}</button></div></form></div></div>}
        <footer>© 2026 Inglês com Gabriel <span>Privacidade &nbsp; Ajuda</span></footer>
      </section>
    </main>
  );

  if (view === "student") return (
    <div className="app-shell student-shell">
      <header className="topbar student-topbar">
        <Brand />
        <nav aria-label="Área do aluno"><button className={studentSection === "lessons" ? "active" : ""} onClick={() => setStudentSection("lessons")}>Aulas</button><button className={studentSection === "calendar" ? "active" : ""} onClick={() => setStudentSection("calendar")}>Calendário</button><button className={studentSection === "progress" ? "active" : ""} onClick={() => setStudentSection("progress")}>Meu progresso</button><button className={studentSection === "materials" ? "active" : ""} onClick={() => setStudentSection("materials")}>Materiais</button></nav>
        <div className="user-control notification-wrap"><button className={`notification student-notification ${unreadCommunications > 0 ? "unread" : ""}`} onClick={() => void openNotifications()} aria-label={unreadCommunications > 0 ? `${unreadCommunications} notificações não visualizadas` : "Notificações"}><span className="bell-icon" aria-hidden="true" />{unreadCommunications > 0 && <b>{unreadCommunications}</b>}</button><div className="avatar blue">{(currentUser?.name || "Aluno").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><strong>{currentUser?.name || "Aluno"}</strong><small>Aluno</small></div><button className="logout-button" onClick={handleLogout}>Sair</button>{showNotifications && <div className="notification-popover"><div className="notification-popover-head"><strong>Comunicados</strong><span>{communications.length} {communications.length === 1 ? "mensagem" : "mensagens"}</span></div>{communications.length ? communications.map((message) => <article key={message.id}><span>✦</span><div><strong>{message.title}</strong><p>{message.body}</p><small>{new Date(message.created_at).toLocaleDateString("pt-BR")}</small></div></article>) : <div className="empty-notifications">Nenhum comunicado novo.</div>}</div>}</div>
      </header>
      <main className="student-main">
        <section className="student-welcome">
          <div><span className="eyebrow"><b>●</b> ÁREA DO ALUNO</span><h1>Olá, {(currentUser?.name || "Aluno").split(" ")[0]}! <span>👋</span></h1><p>{studentSection === "lessons" ? "Continue de onde parou ou escolha uma nova aula." : studentSection === "calendar" ? "Confira os próximos encontros ao vivo da sua semana." : studentSection === "progress" ? "Acompanhe as aulas que você já assistiu." : "Acesse os materiais complementares do curso."}</p></div>
          <div className="access-card"><span className="calendar-icon">▣</span><div><small>Seu acesso está ativo até</small><strong>{formatFullDate(currentUser?.expiresAt || "")}</strong></div><span className="active-dot">● Ativo</span></div>
        </section>
        {studentSection === "calendar" && <section className="student-calendar panel">
          <div className="calendar-title"><div><span className="eyebrow"><b>●</b> HORÁRIO DE BRASÍLIA 🇧🇷</span><h2>Cronograma de aulas ao vivo</h2><p>Organize sua semana e prepare-se antes de cada encontro.</p></div><span className="calendar-title-icon">▣</span></div>
          <div className="calendar-grid student-calendar-grid">{weekdays.map((day) => <article className="day-column" key={day.value}><div className="day-heading"><span>{day.short}</span><strong>{day.name}</strong></div><div className="day-events">{schedule.filter((entry) => entry.weekday === day.value).map((entry) => <div className={`schedule-event ${scheduleTone(entry)}`} key={entry.id}><time>{entry.start_time.replace(":00", "h")}</time><div><strong>{entry.title}</strong>{entry.details && <small>{entry.details}</small>}</div></div>)}{!schedule.some((entry) => entry.weekday === day.value) && <span className="empty-day">Sem aula</span>}</div></article>)}</div>
          <div className="schedule-notes"><strong>📍 Observações importantes</strong>{scheduleNotes.map((note) => <p key={note}>• {note}</p>)}</div>
        </section>}
        {studentSection === "lessons" && <><section className="featured-lesson">
          <div className="feature-art"><div className="play-ring"><button onClick={() => studentLessons[0] && void openLesson(studentLessons[0])}>▶</button></div><span className="feature-tag">AULA MAIS RECENTE</span><div className="speech-line">HELLO &nbsp; HOW ARE YOU? &nbsp; NICE TO MEET YOU</div></div>
          <div className="feature-content"><span className="lesson-number">{studentLessons[0]?.number || "AULA"}</span><h2>{studentLessons[0]?.title || "Nova aula em breve"}</h2><p>Acesse a gravação completa e continue avançando no seu inglês.</p><div className="lesson-meta"><span>◷ {studentLessons[0]?.duration || "Vídeo"}</span><span>◉ {studentLessons[0]?.level || "Todos os níveis"}</span><span>▣ {studentLessons[0]?.date || ""}</span></div><button className="primary-button compact" onClick={() => studentLessons[0] && void openLesson(studentLessons[0])}>{studentLessons[0] && watchedLessonIds.has(studentLessons[0].id) ? "Assistir novamente" : "Assistir aula"} <span>▶</span></button></div>
        </section>
        <section className="lessons-section">
          <div className="section-heading"><div><h2>Todas as aulas</h2><p>{filteredStudentLessons.length} de {studentLessons.length} aulas exibidas</p></div><div className="lesson-tools"><label className="search-field"><Icon>⌕</Icon><input value={studentLessonSearch} onChange={(event) => setStudentLessonSearch(event.target.value)} placeholder="Buscar aula..." /></label><button type="button" className={`filter-button student-filter-button ${activeStudentFilterCount ? "active" : ""}`} onClick={() => setShowLessonFilters(true)} aria-label="Abrir filtros das aulas"><span className="filter-glyph" aria-hidden="true"><i /><i /><i /></span><span>Filtros</span>{activeStudentFilterCount > 0 && <b>{activeStudentFilterCount}</b>}</button></div></div>
          {studentLessonGroups.length ? <div className="lesson-folder-groups">{studentLessonGroups.map((group) => <section className="lesson-folder-group" key={group.name}><div className="lesson-folder-heading"><div><span className="folder-icon">▰</span><div><h3>{group.name}</h3><p>{group.lessons.length} {group.lessons.length === 1 ? "aula" : "aulas"}</p></div></div></div><div className="lesson-grid">{group.lessons.map((lesson) => <article className={`lesson-card ${watchedLessonIds.has(lesson.id) ? "watched" : ""}`} key={lesson.id}><button className={`lesson-cover ${lesson.color}`} onClick={() => void openLesson(lesson)}><span className="cover-number">{lesson.number}</span>{watchedLessonIds.has(lesson.id) && <span className="watched-badge">✓ Assistida</span>}<span className="cover-play">▶</span><span className="cover-duration">{lesson.duration}</span></button><div className="lesson-card-body"><span className="small-level">{lesson.level}</span><h3>{lesson.title}</h3><p>{lesson.date}</p><button onClick={() => void openLesson(lesson)}>{watchedLessonIds.has(lesson.id) ? "Assistir novamente" : "Assistir agora"} <span>→</span></button></div></article>)}</div></section>)}</div> : <div className="empty-lesson-filter"><span>⌕</span><strong>Nenhuma aula encontrada</strong><p>Tente alterar o nível, as pastas selecionadas ou o termo pesquisado.</p><button type="button" onClick={() => { setStudentLessonSearch(""); setStudentLevelFilter("Todos os níveis"); setSelectedStudentFolders([]); }}>Limpar filtros</button></div>}
        </section></>}
        {studentSection === "progress" && <section className="progress-area"><div className="progress-summary panel"><div className="progress-ring" style={{ "--progress": `${Math.round((completedLessons / Math.max(studentLessons.length, 1)) * 100)}%` } as React.CSSProperties}><span>{Math.round((completedLessons / Math.max(studentLessons.length, 1)) * 100)}%</span></div><div><span className="eyebrow"><b>●</b> SEU RITMO</span><h2>{completedLessons} de {studentLessons.length} aulas assistidas</h2><p>Cada aula aberta fica registrada no seu histórico.</p><div className="progress-bar"><i style={{ width: `${Math.round((completedLessons / Math.max(studentLessons.length, 1)) * 100)}%` }} /></div></div></div><div className="panel progress-history"><div className="panel-heading"><div><h2>Histórico de aulas</h2><p>Da mais recente para a mais antiga</p></div></div>{progress.length ? <div className="progress-list">{progress.map((entry) => { const lesson = studentLessons.find((item) => item.id === entry.lesson_id); return <article key={entry.lesson_id}><span className="progress-check">✓</span><div><strong>{entry.lesson_title}</strong><small>Assistida em {new Date(entry.watched_at).toLocaleDateString("pt-BR")} às {new Date(entry.watched_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small></div>{lesson && <button onClick={() => void openLesson(lesson)}>Reassistir →</button>}</article>; })}</div> : <div className="empty-progress"><span>▷</span><strong>Seu histórico começa na primeira aula</strong><p>Abra uma aula para registrar seu progresso.</p><button className="primary-button compact" onClick={() => setStudentSection("lessons")}>Ver aulas</button></div>}</div></section>}
        {studentSection === "materials" && <section className="materials-area"><div className="section-heading"><div><span className="eyebrow"><b>●</b> BIBLIOTECA DO CURSO</span><h2>Materiais para estudar</h2><p>Baixe e consulte seus materiais complementares quando quiser.</p></div></div>{studentLessons.some((lesson) => lesson.material) && <div className="lesson-material-grid">{studentLessons.filter((lesson) => lesson.material).map((lesson) => <article className="panel lesson-material-card" key={lesson.material!.id}><span className="material-file-icon">▤</span><div><small>{lesson.number} · {formatFileSize(lesson.material!.size)}</small><h3>{lesson.material!.title}</h3><p>Material complementar de {lesson.title}</p></div><a href={lesson.material!.url} target="_blank" rel="noreferrer">Acessar material <span>→</span></a></article>)}</div>}<article className="panel material-card"><img src="/capa-apostila-ingles-com-gabriel.jpeg" alt="Capa da apostila Do Zero à Fluência" /><div className="material-copy"><span className="material-type">PDF · 246 PÁGINAS</span><h2>Apostila - Do Zero à Fluência</h2><p>Conteúdo de apoio com as 100 aulas do curso, vocabulário, verbos e exercícios para acompanhar seus estudos.</p><div className="material-meta"><span>▣ Material oficial</span><span>↓ 6 MB</span><span>✓ Incluído no curso</span></div><div className="material-actions"><a className="primary-button compact" href="/apostila-do-zero-a-fluencia.pdf" target="_blank" rel="noreferrer">Abrir apostila <span>→</span></a><a className="download-button" href="/apostila-do-zero-a-fluencia.pdf" download>Baixar PDF</a></div></div></article></section>}
      </main>
      {showLessonFilters && <div className="modal-backdrop lesson-filter-backdrop" onMouseDown={() => setShowLessonFilters(false)}><section className="lesson-filter-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-filter-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="filter-glyph large" aria-hidden="true"><i /><i /><i /></span><div><h2 id="lesson-filter-title">Filtrar aulas</h2><p>Escolha um nível e uma ou mais pastas.</p></div></div><button type="button" onClick={() => setShowLessonFilters(false)} aria-label="Fechar filtros">×</button></header><div className="lesson-filter-content"><fieldset><legend>Nível</legend><div className="level-filter-options">{["Todos os níveis", "Básico", "Intermediário", "Avançado"].map((level) => <button type="button" key={level} className={studentLevelFilter === level ? "active" : ""} aria-pressed={studentLevelFilter === level} onClick={() => setStudentLevelFilter(level)}>{level}</button>)}</div></fieldset><fieldset><div className="folder-filter-legend"><legend>Pastas</legend><div><button type="button" onClick={() => setSelectedStudentFolders(studentFolders)}>Marcar todas</button><button type="button" onClick={() => setSelectedStudentFolders([])}>Limpar</button></div></div><div className="student-folder-options">{studentFolders.map((folder) => <label key={folder}><input type="checkbox" checked={selectedStudentFolders.includes(folder)} onChange={() => setSelectedStudentFolders((current) => current.includes(folder) ? current.filter((item) => item !== folder) : [...current, folder])} /><span><b>{folder}</b><small>{studentLessons.filter((lesson) => (lesson.folderPath || "Aulas gerais") === folder).length} aulas</small></span></label>)}</div>{selectedStudentFolders.length === studentFolders.length && studentFolders.length > 0 && <p className="all-folders-note">✓ Todas as pastas selecionadas: nenhum filtro de pasta será aplicado.</p>}</fieldset></div><footer><button type="button" className="clear-lesson-filters" onClick={() => { setStudentLevelFilter("Todos os níveis"); setSelectedStudentFolders([]); }}>Limpar filtros</button><button type="button" className="primary-button compact" onClick={() => setShowLessonFilters(false)}>Mostrar {filteredStudentLessons.length} {filteredStudentLessons.length === 1 ? "aula" : "aulas"}</button></footer></section></div>}
      {showPlayer && <LessonPlayer key={showPlayer.id} lesson={showPlayer} onClose={() => setShowPlayer(null)} onFirstPlay={() => void registerLessonProgress(showPlayer)} />}
    </div>
  );

  return (
    <div className="app-shell admin-shell">
      <aside className="sidebar">
        <Brand light />
        <div className="workspace-label">GESTÃO DO CURSO</div>
        <nav className="side-nav"><button className={adminSection === "overview" ? "active" : ""} onClick={() => setAdminSection("overview")}><Icon>⌂</Icon>Visão geral</button><button className={adminSection === "students" ? "active" : ""} onClick={() => setAdminSection("students")}><Icon>♙</Icon>Alunos<span className="nav-count">{stats.active}</span></button><button className={adminSection === "lessons" ? "active" : ""} onClick={() => setAdminSection("lessons")}><Icon>▷</Icon>Aulas gravadas</button><button className={adminSection === "calendar" ? "active" : ""} onClick={() => setAdminSection("calendar")}><Icon>▣</Icon>Calendário</button><button className={adminSection === "communications" ? "active" : ""} onClick={() => setAdminSection("communications")}><Icon>✉</Icon>Comunicações</button></nav>
        <div className="workspace-label lower">CONFIGURAÇÕES</div>
        <nav className="side-nav"><button className={adminSection === "settings" ? "active" : ""} onClick={() => setAdminSection("settings")}><Icon>⚙</Icon>Configurações</button></nav>
        <div className="drive-status"><span className="drive-symbol">△</span><div><strong>Google Drive</strong><small><i /> Sincronizado agora</small></div></div>
        <div className="sidebar-user"><div className="avatar dark">GR</div><div><strong>Gabriel</strong><small>Administrador</small></div><button className="logout-button sidebar-logout" onClick={handleLogout}>Sair</button></div>
      </aside>
      <main className="admin-main">
        {adminSection === "overview" && <>
          <header className="admin-header"><div><p>PAINEL DO GESTOR</p><h1>Olá, Gabriel. <span>Aqui está o resumo do seu curso.</span></h1></div><div className="header-actions"><button className="notification" onClick={() => setAdminSection("communications")} aria-label="Abrir comunicações"><span className="bell-icon" aria-hidden="true" /></button><button className="primary-button compact" onClick={() => setShowNewStudent(true)}>＋ Novo aluno</button></div></header>
          <section className="metrics">
            <article><div className="metric-icon purple">♙</div><div><p>ALUNOS ATIVOS</p><strong>{stats.active}</strong><small>Com acesso válido hoje</small></div><span className="sparkline purple-line">▁▂▃▅▄▆▇</span></article>
            <article><div className="metric-icon orange">⌛</div><div><p>EXPIRAM EM 7 DIAS</p><strong>{stats.expiring}</strong><small>{stats.expiring > 0 ? "Requer atenção" : "Nenhuma expiração próxima"}</small></div><button onClick={() => setAdminSection("students")}>Ver alunos →</button></article>
            <article><div className="metric-icon green">▷</div><div><p>AULAS DISPONÍVEIS</p><strong>{adminLessons.length}</strong><small>{driveConfigured ? "Sincronizadas com o Drive" : "Conteúdo de demonstração"}</small></div><span className="sparkline green-line">▂▃▂▄▅▅▇</span></article>
            <article><div className="metric-icon blue">◉</div><div><p>ACESSOS ESTA SEMANA</p><strong>{stats.weeklyAccesses}</strong><small>Logins de alunos desde segunda</small></div><span className="sparkline blue-line">▁▂▅▃▆▅▇</span></article>
          </section>
          <section className="dashboard-grid">
            <div className="panel students-panel"><div className="panel-heading"><div><h2>Alunos</h2><p>Gerencie acessos e renovações</p></div><button onClick={() => setAdminSection("students")}>Ver todos <span>→</span></button></div><div className="table-tools"><label className="search-field"><Icon>⌕</Icon><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar aluno por nome, e-mail ou telefone..." /></label></div><div className="student-table"><div className="table-row table-head"><span>ALUNO</span><span>STATUS</span><span>VALIDADE</span><span /></div>{filteredStudents.slice(0, 5).map((student) => <div className="table-row" key={student.id}><div className="student-cell"><div className={`avatar ${student.color}`}>{student.initials}</div><div><strong>{student.name}</strong><small>{student.email}</small><small className="student-phone">☎ {formatPhone(student.phone)}</small></div></div><span className={`status ${student.status === "Ativo" ? "active" : "warning"}`}><i />{student.status}</span><span className="expiry">{student.expiresAt}</span><button className="row-menu" onClick={() => setEditingStudent(student)}>•••</button></div>)}</div></div>
            <div className="right-stack"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Resumo da base</h2><p>Histórico preservado</p></div></div><div className="timeline"><div><span className="timeline-icon green">♙</span><p><strong>{stats.total} alunos no total</strong><small>Desde o início do curso</small></p></div><div><span className="timeline-icon purple">↻</span><p><strong>{stats.renewed} alunos renovaram</strong><small>Renovações registradas</small></p></div><div><span className="timeline-icon orange">⌛</span><p><strong>{stats.expired} acessos expirados</strong><small>Bloqueados automaticamente</small></p></div></div></section><section className="panel drive-panel"><div className="drive-top"><span className="drive-symbol large">△</span><div><h3>Google Drive</h3><p>{driveConfigured ? "Suas aulas estão sincronizadas" : "Aguardando configuração"}</p></div><span className={`status ${driveConfigured ? "active" : "warning"}`}><i />{driveConfigured ? "Conectado" : "Demonstração"}</span></div><button onClick={() => setAdminSection("lessons")}>Gerenciar aulas <span>→</span></button></section></div>
          </section>
        </>}

        {adminSection === "students" && <>
          <header className="admin-header"><div><p>GESTÃO DE ALUNOS</p><h1>Alunos <span>Histórico, validade, renovações e acessos.</span></h1></div><button className="primary-button compact" onClick={() => setShowNewStudent(true)}>＋ Novo aluno</button></header>
          <section className="metrics management-metrics"><article><div className="metric-icon purple">♙</div><div><p>TOTAL DE ALUNOS</p><strong>{stats.total}</strong><small>Histórico completo</small></div></article><article><div className="metric-icon green">✓</div><div><p>ATIVOS</p><strong>{stats.active}</strong><small>Acesso liberado</small></div></article><article><div className="metric-icon orange">⌛</div><div><p>EXPIRADOS</p><strong>{stats.expired}</strong><small>Acesso bloqueado</small></div></article><article><div className="metric-icon blue">↻</div><div><p>JÁ RENOVARAM</p><strong>{stats.renewed}</strong><small>Uma ou mais renovações</small></div></article></section>
          <section className="panel management-panel"><div className="panel-heading"><div><h2>Base de alunos</h2><p>Quantidade de acessos e situação de cada aluno</p></div></div><div className="table-tools"><label className="search-field"><Icon>⌕</Icon><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail ou telefone..." /></label></div><div className="management-table"><div className="management-row management-head"><span>ALUNO</span><span>STATUS</span><span>ACESSOS</span><span>RENOVAÇÕES</span><span>VALIDADE</span><span /></div>{filteredStudents.map((student) => <div className="management-row" key={student.id}><div className="student-cell"><div className={`avatar ${student.color}`}>{student.initials}</div><div><strong>{student.name}</strong><small>{student.email}</small><small className="student-phone">☎ {formatPhone(student.phone)}</small></div></div><span className={`status ${student.status === "Ativo" ? "active" : "warning"}`}><i />{student.status}</span><strong className="count-cell">{student.accessCount || 0}</strong><strong className="count-cell">{student.renewalCount || 0}</strong><span>{student.expiresAt}</span><button className="row-menu" onClick={() => setEditingStudent(student)}>•••</button></div>)}</div></section>
        </>}

        {adminSection === "lessons" && <>
          <header className="admin-header"><div><p>CONTEÚDO DO CURSO</p><h1>Aulas gravadas <span>Personalize como cada aula aparece para os alunos.</span></h1></div><span className={`status ${driveConfigured ? "active" : "warning"}`}><i />{driveConfigured ? "Drive conectado" : "Modo demonstração"}</span></header>
          {!driveConfigured && <div className="integration-banner"><span className="drive-symbol large">△</span><div><strong>Google Drive ainda não conectado</strong><p>Você pode testar as edições abaixo. Ao configurar as credenciais, os arquivos reais da pasta aparecerão automaticamente.</p></div></div>}
          <div className="folder-filter" role="group" aria-label="Filtrar aulas por pasta"><span>Filtrar por pasta</span><div className="folder-filter-chips"><button type="button" className={adminFolderFilter === "all" ? "active" : ""} aria-pressed={adminFolderFilter === "all"} onClick={() => setAdminFolderFilter("all")}>Todos <b>{adminLessons.length}</b></button>{adminFolders.map((folder) => { const count = adminLessons.filter((lesson) => (lesson.folderPath || "Aulas gerais") === folder).length; return <button type="button" key={folder} className={adminFolderFilter === folder ? "active" : ""} aria-pressed={adminFolderFilter === folder} onClick={() => setAdminFolderFilter(folder)}>{folder} <b>{count}</b></button>; })}</div></div>
          <div className="admin-lesson-groups">{adminLessonGroups.map((group) => <section className="admin-lesson-group" key={group.name}><div className="lesson-folder-heading admin-folder-heading"><div><span className="folder-icon">▰</span><div><h2>{group.name}</h2><p>{group.lessons.length} {group.lessons.length === 1 ? "vídeo" : "vídeos"} nesta pasta</p></div></div></div><div className="admin-lesson-grid">{group.lessons.map((lesson) => <article className="panel admin-lesson-card" key={lesson.id}><button type="button" className={`admin-lesson-cover ${lesson.color}`} onClick={() => setShowPlayer(lesson)} aria-label={`Pré-visualizar ${lesson.title}`}><b>Pré-visualizar</b><span>▶</span><small>{lesson.sourceName}</small></button><form onSubmit={(event) => handleSaveLesson(event, lesson.id)}><label>Título exibido<input name="title" defaultValue={lesson.title} required /></label><label>Nível<select name="level" defaultValue={lesson.level}><option>Todos os níveis</option><option>Básico</option><option>Intermediário</option><option>Avançado</option></select></label><div className="lesson-admin-meta"><span>{lesson.date}</span><span>{lesson.duration}</span></div><div className="admin-material-fields"><label>Título do material<input name="materialTitle" defaultValue={lesson.material?.title || `Material de apoio — ${lesson.title}`} /></label><label>Arquivo do material<input name="materialFile" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg" /></label>{lesson.material && <small className="attached-material">✓ Anexado: {lesson.material.fileName} · {formatFileSize(lesson.material.size)}</small>}<button type="button" className="material-upload-button" disabled={uploadingMaterialId === lesson.id} onClick={(event) => event.currentTarget.form && void handleUploadMaterial(event.currentTarget.form, lesson)}>{uploadingMaterialId === lesson.id ? "Enviando..." : lesson.material ? "Substituir material" : "Anexar material"}</button></div><button className="primary-button compact">Salvar alterações</button></form></article>)}</div></section>)}</div>
        </>}

        {adminSection === "calendar" && <>
          <header className="admin-header"><div><p>CRONOGRAMA SEMANAL</p><h1>Calendário <span>Cadastre e atualize os encontros ao vivo dos alunos.</span></h1></div><button className="primary-button compact" onClick={() => { setEditingSchedule(null); setShowScheduleEditor(true); }}>＋ Novo horário</button></header>
          <div className="calendar-timezone">🖥️ 📚 📝 <strong>Horário de Brasília 🇧🇷</strong><span>As alterações aparecem automaticamente na área dos alunos.</span></div>
          <section className="calendar-grid admin-calendar-grid">{weekdays.map((day) => <article className="panel day-column admin-day" key={day.value}><div className="day-heading"><span>{day.short}</span><strong>{day.name}</strong><small>{schedule.filter((entry) => entry.weekday === day.value).length} {schedule.filter((entry) => entry.weekday === day.value).length === 1 ? "encontro" : "encontros"}</small></div><div className="day-events">{schedule.filter((entry) => entry.weekday === day.value).map((entry) => <div className={`schedule-event admin-event ${scheduleTone(entry)}`} key={entry.id}><time>{entry.start_time.replace(":00", "h")}</time><div><strong>{entry.title}</strong>{entry.details && <small>{entry.details}</small>}<span className="event-actions"><button onClick={() => { setEditingSchedule(entry); setShowScheduleEditor(true); }}>Editar</button><button onClick={() => void handleDeleteSchedule(entry)}>Excluir</button></span></div></div>)}{!schedule.some((entry) => entry.weekday === day.value) && <span className="empty-day">Nenhum horário cadastrado.</span>}</div><button className="add-day-event" onClick={() => { setEditingSchedule({ id: "", weekday: day.value, start_time: "", title: "", details: "" }); setShowScheduleEditor(true); }}>＋ Adicionar neste dia</button></article>)}</section>
          <section className="panel admin-schedule-notes"><div className="panel-heading"><div><h2>Observações para os alunos</h2><p>Informações exibidas abaixo do cronograma</p></div></div><div className="schedule-notes">{scheduleNotes.map((note) => <p key={note}>• {note}</p>)}</div></section>
        </>}

        {adminSection === "communications" && <>
          <header className="admin-header"><div><p>CENTRAL DE MENSAGENS</p><h1>Comunicações <span>Publique avisos para todos os alunos.</span></h1></div></header>
          <section className="communications-layout"><form className="panel composer" onSubmit={handlePublishCommunication}><div className="panel-heading"><div><h2>Novo comunicado</h2><p>Será exibido nas notificações dos alunos</p></div></div><div className="composer-fields"><label>Título<input name="title" placeholder="Ex.: Cupom de desconto" required /></label><label>Mensagem<textarea name="body" placeholder="Ex.: Aproveite o cupom de desconto na Hotmart, válido até amanhã." rows={7} required /></label><div className="audience-note"><span>♙</span><p><strong>Envio em massa</strong>Todos os alunos ativos verão esta mensagem.</p></div><button className="primary-button">Publicar comunicado <span>→</span></button></div></form><div className="panel message-center"><div className="panel-heading"><div><h2>Comunicados publicados</h2><p>{communications.length} no total</p></div></div><div className="message-list">{communications.length ? communications.map((message) => <article key={message.id}><span className="message-icon">✦</span><div><strong>{message.title}</strong><p>{message.body}</p><small>Publicado em {new Date(message.created_at).toLocaleDateString("pt-BR")}</small></div><button onClick={() => handleDeleteCommunication(message.id)}>×</button></article>) : <div className="empty-messages"><span>✉</span><strong>Nenhum comunicado publicado</strong><p>Crie a primeira mensagem para seus alunos.</p></div>}</div></div></section>
        </>}

        {adminSection === "settings" && <>
          <header className="admin-header"><div><p>CONFIGURAÇÕES</p><h1>Integrações <span>Conecte os serviços usados pelo portal.</span></h1></div></header>
          <div className="security-banner"><span>◆</span><div><strong>Credenciais protegidas</strong><p>Chaves e senhas são criptografadas antes de serem armazenadas e nunca voltam a aparecer integralmente nesta tela.</p></div></div>
          <form className="settings-form" onSubmit={handleSaveSettings}>
            <section className="panel settings-card"><div className="settings-card-head"><div className="service-logo email-logo">✉</div><div><h2>Envio de e-mails</h2><p>Convites de primeiro acesso e avisos de expiração via Resend.</p></div><span className={`status ${settings?.email.configured ? "active" : "warning"}`}><i />{settings?.email.configured ? "Configurado" : "Pendente"}</span></div><div className="settings-fields"><label>Chave da API Resend<input name="resendApiKey" type="password" placeholder={settings?.email.hasApiKey ? "••••••••••••••••  (já cadastrada)" : "re_..."} /></label><label>Remetente verificado<input name="emailFrom" type="text" defaultValue={settings?.email.emailFrom || ""} placeholder="Inglês com Gabriel <aulas@seudominio.com>" /></label><label>Endereço público do portal<input name="appUrl" type="url" defaultValue={settings?.email.appUrl || ""} placeholder="https://aulas.seudominio.com" /><small>Usado no botão “Criar minha senha” enviado aos alunos.</small></label><div className="settings-help"><strong>O que você precisa?</strong><p>Crie uma conta na Resend, valide seu domínio de envio e copie a chave da API.</p></div></div></section>
            <section className="panel settings-card"><div className="settings-card-head"><div className="service-logo drive-logo">△</div><div><h2>Google Drive</h2><p>Leitura segura da pasta onde ficam as aulas gravadas.</p></div><span className={`status ${settings?.drive.configured ? "active" : "warning"}`}><i />{settings?.drive.configured ? "Configurado" : "Pendente"}</span></div><div className="settings-fields"><label>E-mail da conta de serviço<input name="googleClientEmail" type="email" defaultValue={settings?.drive.clientEmail || ""} placeholder="conta@projeto.iam.gserviceaccount.com" /></label><label>ID da pasta das aulas<input name="googleDriveFolderId" type="text" defaultValue={settings?.drive.folderId || ""} placeholder="1AbCDefGhIjKlMn..." /><small>É o trecho do endereço do Drive depois de <b>/folders/</b>. As subpastas serão sincronizadas e usadas para agrupar as aulas.</small></label><label>Chave privada da conta de serviço<textarea name="googlePrivateKey" rows={7} placeholder={settings?.drive.hasPrivateKey ? "Chave privada já cadastrada. Cole uma nova somente para substituir." : "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"} /></label><div className="settings-help"><strong>Permissão necessária</strong><p>Compartilhe a pasta principal das aulas com o e-mail da conta de serviço como leitor. A permissão será herdada pelas subpastas.</p></div></div></section>
            <section className="panel settings-card"><div className="settings-card-head"><div className="service-logo payment-logo">MP</div><div><h2>Mercado Pago</h2><p>Checkout Pro para venda automática do acesso anual.</p></div><span className={`status ${settings?.payment.configured ? "active" : "warning"}`}><i />{settings?.payment.configured ? "Configurado" : "Pendente"}</span></div><div className="settings-fields"><label>Access Token<input name="mercadoPagoAccessToken" type="password" placeholder={settings?.payment.hasAccessToken ? "••••••••••••••••  (já cadastrado)" : "APP_USR-..."} /></label><label>Segredo do webhook<input name="mercadoPagoWebhookSecret" type="password" placeholder={settings?.payment.hasWebhookSecret ? "••••••••••••••••  (já cadastrado)" : "Assinatura secreta do webhook"} /></label><label>Título do produto<input name="courseCheckoutTitle" type="text" defaultValue={settings?.payment.title || "Inglês com Gabriel - Acesso anual"} /></label><label>Valor do acesso anual<input name="courseCheckoutPrice" type="number" min="1" step="0.01" defaultValue={settings?.payment.price || "997"} /></label><div className="settings-help"><strong>URL do webhook</strong><p>Configure no Mercado Pago: /api/checkout/webhook no endereço público do portal.</p></div></div></section>
            <div className="settings-actions"><p>Campos de chave vazios mantêm o valor salvo anteriormente.</p><button className="primary-button compact">Salvar configurações <span>→</span></button></div>
          </form>
        </>}
      </main>
      {showScheduleEditor && <div className="modal-backdrop" onMouseDown={() => { setShowScheduleEditor(false); setEditingSchedule(null); }}><div className="form-modal schedule-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-heading"><div><span className="modal-icon">▣</span><div><h2>{editingSchedule?.id ? "Editar horário" : "Novo horário"}</h2><p>Este encontro ficará visível para todos os alunos.</p></div></div><button onClick={() => { setShowScheduleEditor(false); setEditingSchedule(null); }}>×</button></div><form onSubmit={handleSaveSchedule}><div className="schedule-form-row"><label>Dia da semana<select name="weekday" defaultValue={editingSchedule?.weekday || 1} required>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.name}</option>)}</select></label><label>Horário<input name="startTime" type="time" defaultValue={editingSchedule?.start_time || ""} required /></label></div><label>Nome da aula<input name="title" defaultValue={editingSchedule?.title || ""} placeholder="Ex.: Conversação" required /></label><label>Detalhes<input name="details" defaultValue={editingSchedule?.details || ""} placeholder="Ex.: Pelo Zoom, com teacher Gabriel" /></label><div className="modal-note"><span>◷</span><p><strong>Horário de Brasília</strong>Use sempre o horário oficial de Brasília ao cadastrar.</p></div><div className="modal-actions"><button type="button" onClick={() => { setShowScheduleEditor(false); setEditingSchedule(null); }}>Cancelar</button><button className="primary-button compact">{editingSchedule?.id ? "Salvar alterações" : "Adicionar ao calendário"}</button></div></form></div></div>}
      {showNewStudent && <div className="modal-backdrop" onMouseDown={() => setShowNewStudent(false)}><div className="form-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-heading"><div><span className="modal-icon">＋</span><div><h2>Novo aluno</h2><p>O aluno receberá um convite para criar a senha.</p></div></div><button onClick={() => setShowNewStudent(false)}>×</button></div><form onSubmit={handleAddStudent}><label>Nome completo<input name="name" placeholder="Ex.: Juliana Martins" required /></label><label>E-mail<input name="email" type="email" placeholder="juliana@email.com" required /></label><label>Número de telefone<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" minLength={10} required /></label><label>Data de expiração<input name="expires" type="date" required /></label><div className="modal-note"><span>✉</span><p><strong>Convite automático</strong>Enviaremos um e-mail seguro para o primeiro acesso.</p></div><div className="modal-actions"><button type="button" onClick={() => setShowNewStudent(false)}>Cancelar</button><button className="primary-button compact">Cadastrar e enviar convite</button></div></form></div></div>}
      {editingStudent && <div className="modal-backdrop" onMouseDown={() => setEditingStudent(null)}><div className="form-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-heading"><div><span className="modal-icon">↻</span><div><h2>Gerenciar acesso</h2><p>{editingStudent.name} · {editingStudent.email}</p></div></div><button onClick={() => setEditingStudent(null)}>×</button></div><form onSubmit={handleUpdateStudent}><label>Número de telefone<input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={formatPhone(editingStudent.phone)} placeholder="(11) 99999-9999" /></label><label>Nova data de expiração<input name="expires" type="date" required /></label><button type="button" className="resend-button" onClick={handleResendInvitation}>✉ Reenviar convite de primeiro acesso</button><div className="modal-note"><span>◷</span><p><strong>Atualização imediata</strong>O telefone e a nova validade passam a valer assim que você salvar.</p></div><div className="modal-actions split"><button type="button" className="danger-button" onClick={handleDeleteStudent}>Remover aluno</button><button className="primary-button compact">Salvar alterações</button></div></form></div></div>}
      {showPlayer && <LessonPlayer key={showPlayer.id} lesson={showPlayer} onClose={() => setShowPlayer(null)} />}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </div>
  );
}
