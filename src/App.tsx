import React, { useState, useEffect, useRef } from "react";
import { 
  Brain, 
  Clipboard, 
  Bell, 
  FileText, 
  Mic, 
  MicOff,
  Search, 
  Activity, 
  FolderOpen, 
  Database, 
  Smartphone, 
  CheckCircle, 
  AlertCircle, 
  RotateCw, 
  Sparkles, 
  Calendar, 
  Trash2, 
  Upload, 
  FileCode, 
  Save, 
  ArrowRight,
  Plus,
  Play,
  Heart,
  HelpCircle,
  FileUp,
  ExternalLink,
  ChevronRight,
  CornerDownRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CaptureEvent, HealthStatus, SearchQueryResponse, SearchResult } from "./types";

// Helper: Custom lightweight Markdown-to-HTML Parser to avoid rendering libraries
function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return "<p class='text-[#141414] opacity-50 italic'>No content</p>";
  
  let html = markdown;
  
  // Replace HTML special characters to prevent XSS
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code Blocks
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
    return `<pre class="bg-[#141414] text-[#E4E3E0] p-4 border border-[#141414] overflow-x-auto my-3 font-mono text-xs">${code.trim()}</pre>`;
  });

  // Checkboxes
  html = html.replace(/\[x\]\s(.*?)\n/g, '<div class="flex items-start my-1"><input type="checkbox" checked disabled class="mt-1 mr-2 accent-[#141414]" /> <span class="line-through opacity-50">$1</span></div>');
  html = html.replace(/\[\s\]\s(.*?)\n/g, '<div class="flex items-start my-1"><input type="checkbox" disabled class="mt-1 mr-2" /> <span>$1</span></div>');

  // Headings
  html = html.replace(/^#\s+(.*?)$/gm, '<h1 class="text-xl font-bold text-[#141414] border-b-2 border-[#141414] pb-1 mt-5 mb-2 uppercase tracking-tight font-sans">$1</h1>');
  html = html.replace(/^##\s+(.*?)$/gm, '<h2 class="text-md font-bold text-[#141414] border-b border-[#141414] pb-1 mt-4 mb-2 uppercase tracking-tight font-sans">$1</h2>');
  html = html.replace(/^###\s+(.*?)$/gm, '<h3 class="text-xs font-bold text-[#141414] mt-3 mb-1 uppercase tracking-wider font-sans">$1</h3>');

  // Bold Text
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#141414]">$1</strong>');

  // Inline Code
  html = html.replace(/`(.*?)`/g, '<code class="bg-[#DAD9D5] text-[#141414] px-1.5 py-0.5 border border-[#141414] font-mono text-xs">$1</code>');

  // List Items
  html = html.replace(/^\*\s+(.*?)$/gm, '<li class="ml-4 list-disc text-[#141414] my-1">$1</li>');
  html = html.replace(/^-\s+(.*?)$/gm, '<li class="ml-4 list-disc text-[#141414] my-1">$1</li>');

  // Convert linebreaks to <p> where appropriate
  const lines = html.split("\n");
  const parsedLines = lines.map(line => {
    if (line.trim().startsWith("<h") || line.trim().startsWith("<pre") || line.trim().startsWith("<li") || line.trim().startsWith("<div") || line.trim() === "") {
      return line;
    }
    return `<p class="text-[#141414] text-xs font-medium my-1">${line}</p>`;
  });

  return parsedLines.join("\n");
}

export default function App() {
  // State variables
  const [activeTab, setActiveTab] = useState<"dashboard" | "search" | "vault" | "devices">("dashboard");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isAiConfigured, setIsAiConfigured] = useState<boolean>(false);
  const [rawEvents, setRawEvents] = useState<CaptureEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Simulation inputs
  const [simType, setSimType] = useState<"clipboard" | "notification" | "file">("clipboard");
  const [simSource, setSimSource] = useState<string>("Chrome");
  const [simContent, setSimContent] = useState<string>("");
  const [simFileName, setSimFileName] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Microphone/Voice memo recording
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [transcribing, setTranscribing] = useState<boolean>(false);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchTimeframe, setSearchTimeframe] = useState<string>("all");
  const [searching, setSearching] = useState<boolean>(false);
  const [searchResponse, setSearchResponse] = useState<SearchQueryResponse | null>(null);

  // Vault/Markdown State
  const [vaultFiles, setVaultFiles] = useState<{ summaries: any[]; digests: any[] }>({ summaries: [], digests: [] });
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isEditingFile, setIsEditingFile] = useState<boolean>(false);
  const [savingFile, setSavingFile] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [processingSummary, setProcessingSummary] = useState<boolean>(false);

  // Notifications feedback
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch initial stats & records
  const loadData = async () => {
    try {
      const res = await fetch("/api/health-status");
      const data = await res.json();
      setHealth(data.status);
      setIsAiConfigured(data.isAIConfigured);

      const eventsRes = await fetch("/api/events");
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setRawEvents(eventsData);
      } else {
        // Safe fallbacks
        setRawEvents([]);
      }

      // Fetch vault files list
      const vaultRes = await fetch("/api/vault");
      if (vaultRes.ok) {
        const vaultData = await vaultRes.json();
        setVaultFiles(vaultData);
      }
    } catch (err) {
      console.error("Failed to load server data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Fetch and check events every 8 seconds for real-time ingestion log feel
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    showToast("Metrics and dashboard synchronized.", "success");
  };

  // Simulate ingestion trigger (Tasker / Shortcuts)
  const triggerSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simContent.trim()) {
      showToast("Please enter text content to capture.", "error");
      return;
    }

    setIsSimulating(true);
    try {
      const res = await fetch("/api/simulate-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: simType,
          appSource: simSource,
          content: simContent,
          fileName: simType === "file" ? simFileName || "screenshot_capture.png" : undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        showToast(`Successfully captured simulated ${simType} event!`, "success");
        setSimContent("");
        setSimFileName("");
        // Reload
        await loadData();
      } else {
        showToast("Simulation API failed.", "error");
      }
    } catch (err) {
      showToast("Error connecting to server simulation.", "error");
    } finally {
      setIsSimulating(false);
    }
  };

  // Start micro-recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setAudioChunks([]);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setAudioChunks((prev) => [...prev, e.data]);
        }
      };

      recorder.onstop = async () => {
        // This will be called when we invoke recorder.stop()
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      showToast("Recording audio memo...", "info");
    } catch (err) {
      console.error("Failed to start recording:", err);
      showToast("Microphone access denied or not available in iframe. Try uploading a file below instead!", "error");
    }
  };

  const stopRecordingAndTranscribe = async () => {
    if (!mediaRecorder) return;
    
    clearInterval(recordIntervalRef.current!);
    mediaRecorder.stop();
    setIsRecording(false);
    setTranscribing(true);

    // Give some milliseconds for the final chunk to collect
    setTimeout(async () => {
      // Collect the chunks and form a blob
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      
      // Convert Blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        await sendAudioToServer(base64Data, "audio/webm", "voice_memo.webm");
      };
    }, 500);
  };

  // Process standard audio file upload
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTranscribing(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64Data = (reader.result as string).split(",")[1];
      await sendAudioToServer(base64Data, file.type || "audio/mp3", file.name);
    };
  };

  const sendAudioToServer = async (base64Audio: string, mimeType: string, fileName: string) => {
    try {
      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Audio, mimeType, fileName })
      });

      if (res.ok) {
        const data = await res.json();
        showToast("Voice memo transcribed and saved!", "success");
        await loadData();
      } else {
        const errData = await res.json();
        showToast(errData.error || "Failed to transcribe voice memo.", "error");
      }
    } catch (err) {
      showToast("Error connecting to transcription pipeline.", "error");
    } finally {
      setTranscribing(false);
    }
  };

  // Perform AI semantic / keyword search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, timeframe: searchTimeframe })
      });

      if (res.ok) {
        const data = await res.json();
        setSearchResponse(data);
      } else {
        showToast("Search failed.", "error");
      }
    } catch (err) {
      showToast("Error executing search query.", "error");
    } finally {
      setSearching(false);
    }
  };

  // Vault document management
  const selectFile = async (file: any) => {
    try {
      const res = await fetch(`/api/vault/file?relativePath=${encodeURIComponent(file.path)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedFile(file);
        setFileContent(data.content);
        setIsEditingFile(false);
      }
    } catch (err) {
      showToast("Error loading vault document.", "error");
    }
  };

  const saveEditedFile = async () => {
    if (!selectedFile) return;
    setSavingFile(true);
    try {
      const res = await fetch("/api/vault/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relativePath: selectedFile.path, content: fileContent })
      });

      if (res.ok) {
        showToast("Vault document saved successfully.", "success");
        setIsEditingFile(false);
      } else {
        showToast("Failed to save changes.", "error");
      }
    } catch (err) {
      showToast("Error saving document.", "error");
    } finally {
      setSavingFile(false);
    }
  };

  // Trigger Markdown summary compile
  const compileDailySummary = async () => {
    setProcessingSummary(true);
    try {
      const res = await fetch("/api/jobs/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate })
      });

      const data = await res.json();
      if (data.status === "success") {
        showToast(`Daily summary for ${selectedDate} compiled!`, "success");
        // Reload vault files list
        const vRes = await fetch("/api/vault");
        const vaultData = await vRes.json();
        setVaultFiles(vaultData);
        // Autoselect the newly created file
        const newFile = vaultData.summaries.find((s: any) => s.date === selectedDate);
        if (newFile) selectFile(newFile);
      } else if (data.status === "empty") {
        showToast(`No captured events found for ${selectedDate} to summarize. Try simulating some activity first!`, "info");
      } else {
        showToast(data.error || "Compilation failed.", "error");
      }
    } catch (err) {
      showToast("Error starting summary compile job.", "error");
    } finally {
      setProcessingSummary(false);
    }
  };

  // Trigger daily diagnostic digest compile
  const compileHealthDigest = async () => {
    setProcessingSummary(true);
    try {
      const res = await fetch("/api/jobs/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate })
      });

      if (res.ok) {
        showToast(`Health check digest compiled for ${selectedDate}!`, "success");
        // Reload vault files list
        const vRes = await fetch("/api/vault");
        const vaultData = await vRes.json();
        setVaultFiles(vaultData);
        // Autoselect digest
        const newFile = vaultData.digests.find((d: any) => d.date === selectedDate);
        if (newFile) selectFile(newFile);
      } else {
        showToast("Failed to compile diagnostic note.", "error");
      }
    } catch (err) {
      showToast("Error starting digest compile job.", "error");
    } finally {
      setProcessingSummary(false);
    }
  };

  // Wipe vault (For testing/QA)
  const handleClearDatabase = async () => {
    if (!window.confirm("Are you absolutely sure you want to delete all captured events, embeddings, and generated daily summaries in your Second Brain? This is permanent.")) return;

    try {
      const res = await fetch("/api/events/clear", { method: "DELETE" });
      if (res.ok) {
        showToast("All personal capture databases and Markdown summaries wiped successfully.", "success");
        setRawEvents([]);
        setSelectedFile(null);
        setVaultFiles({ summaries: [], digests: [] });
        await loadData();
      }
    } catch (err) {
      showToast("Failed to reset database.", "error");
    }
  };

  // Formatting helper
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDateLabel = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Render Loader if initial boot
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#E4E3E0] text-[#141414] font-sans p-6 border-8 border-[#141414]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="p-3 border-2 border-[#141414] bg-[#DAD9D5] text-[#141414] mb-4"
        >
          <Brain className="w-8 h-8" />
        </motion.div>
        <h3 className="text-sm font-bold uppercase tracking-tight">Syncing with Home Server Database...</h3>
        <p className="text-[10px] font-mono uppercase mt-1">Initializing Second Brain Ingestion Pipelines</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans antialiased flex flex-col selection:bg-[#141414] selection:text-[#E4E3E0] border-8 border-[#141414]">
      
      {/* Toast Alert Feedback */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 border-2 border-[#141414] text-xs font-mono uppercase tracking-wider flex items-center gap-2 max-w-md ${
              toast.type === "success" ? "bg-green-600 text-[#E4E3E0]" :
              toast.type === "error" ? "bg-red-600 text-[#E4E3E0]" :
              "bg-[#141414] text-[#E4E3E0]"
            }`}
          >
            {toast.type === "success" && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
            {toast.type === "error" && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {toast.type === "info" && <Sparkles className="w-4 h-4 flex-shrink-0" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Panel */}
      <header className="sticky top-0 bg-[#E4E3E0] border-b border-[#141414] px-6 py-4 z-40 flex flex-col md:flex-row md:items-baseline md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2 border border-[#141414] bg-[#DAD9D5] text-[#141414] flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tighter text-[#141414] flex items-center gap-3">
              Second Brain / Local Log
              <span className="text-[10px] font-mono border border-[#141414] px-2 py-0.5 uppercase bg-[#DAD9D5]">v1.0.4-beta</span>
            </h1>
            <p className="text-[10px] font-mono uppercase text-[#141414]/75 mt-0.5">Local-first digital footprint intake & semantic vault indexing</p>
          </div>
        </div>

        <div className="flex flex-wrap items-baseline gap-6 text-right self-start md:self-auto">
          <div>
            <p className="text-[10px] font-serif italic opacity-50 uppercase tracking-widest text-[#141414]">Server Uptime</p>
            <p className="font-mono text-xs font-bold text-[#141414]">14d 02h 44m</p>
          </div>
          <div>
            <p className="text-[10px] font-serif italic opacity-50 uppercase tracking-widest text-[#141414]">Storage (Vault)</p>
            <p className="font-mono text-xs font-bold text-[#141414]">{health?.totalEvents || 0} Events Logged</p>
          </div>
          <div>
            <p className="text-[10px] font-serif italic opacity-50 uppercase tracking-widest text-[#141414]">AI Core</p>
            <p className={`font-mono text-xs font-bold ${isAiConfigured ? "text-green-700" : "text-amber-700"}`}>
              {isAiConfigured ? "GEMINI_ACTIVE" : "NO_API_KEY"}
            </p>
          </div>
          <div className="flex items-center">
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 border border-[#141414] bg-transparent text-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] disabled:opacity-50 transition-colors flex items-center justify-center cursor-pointer"
              title="Sync Feed"
            >
              <RotateCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 border-b border-[#141414] bg-[#E4E3E0]">
        
        {/* Navigation Rail / Sidebar */}
        <nav className="col-span-1 lg:col-span-3 flex lg:flex-col bg-[#DAD9D5] border-r border-b lg:border-b-0 border-[#141414] divide-y divide-[#141414] overflow-x-auto lg:overflow-x-visible">
          <div className="p-4 flex-shrink-0">
            <h2 className="text-[11px] font-serif italic opacity-50 uppercase tracking-widest text-[#141414]">Navigation Menu</h2>
          </div>
          
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2.5 transition-colors whitespace-nowrap rounded-none border-none ${
              activeTab === "dashboard"
                ? "bg-[#141414] text-[#E4E3E0]"
                : "text-[#141414] hover:bg-[#141414]/10"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Dashboard Feed</span>
          </button>

          <button
            onClick={() => setActiveTab("search")}
            className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2.5 transition-colors whitespace-nowrap rounded-none border-none ${
              activeTab === "search"
                ? "bg-[#141414] text-[#E4E3E0]"
                : "text-[#141414] hover:bg-[#141414]/10"
            }`}
          >
            <Search className="w-4 h-4" />
            <span>AI Recall & RAG</span>
          </button>

          <button
            onClick={() => setActiveTab("vault")}
            className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2.5 transition-colors whitespace-nowrap rounded-none border-none ${
              activeTab === "vault"
                ? "bg-[#141414] text-[#E4E3E0]"
                : "text-[#141414] hover:bg-[#141414]/10"
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Markdown Vault</span>
          </button>

          <button
            onClick={() => setActiveTab("devices")}
            className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2.5 transition-colors whitespace-nowrap rounded-none border-none ${
              activeTab === "devices"
                ? "bg-[#141414] text-[#E4E3E0]"
                : "text-[#141414] hover:bg-[#141414]/10"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Device Tokens</span>
          </button>

          {/* Reference Theme Panel: Devices list from state */}
          <div className="p-4 hidden lg:block space-y-3">
            <h2 className="text-[11px] font-serif italic opacity-50 uppercase tracking-widest text-[#141414]">Sync Devices</h2>
            <div className="space-y-3">
              {health?.devices && health.devices.length > 0 ? (
                health.devices.map((dev) => (
                  <div key={dev.deviceId} className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-bold text-[11px] uppercase truncate max-w-[160px]">{dev.deviceName}</span>
                      <span className="text-[9px] font-mono opacity-60">Active Session</span>
                    </div>
                    <div className="w-2 h-2 bg-green-600"></div>
                  </div>
                ))
              ) : (
                <div className="text-[10px] opacity-60 italic">No devices paired.</div>
              )}
            </div>
          </div>

          {/* Reference Theme Panel: AI Workers */}
          <div className="p-4 hidden lg:block bg-[#DAD9D5] flex-1">
            <h2 className="text-[11px] font-serif italic opacity-50 uppercase tracking-widest text-[#141414] mb-3">AI Workers</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] font-bold">WHISPER_TRANSCRIPTION</span>
                  <span className="text-[9px] font-mono">{isRecording ? "RECORDING" : "IDLE"}</span>
                </div>
                <div className="h-1 bg-[#141414]/10 w-full relative">
                  {isRecording && <div className="absolute top-0 left-0 h-full bg-red-600 animate-pulse w-full"></div>}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] font-bold">OLLAMA_SUMMARIZATION</span>
                  <span className="text-[9px] font-mono">{transcribing || processingSummary ? "ACTIVE" : "READY"}</span>
                </div>
                <div className="h-1 bg-[#141414]/10 w-full relative overflow-hidden">
                  {(transcribing || processingSummary) && (
                    <div className="absolute top-0 left-0 h-full bg-orange-600 w-3/4 animate-pulse"></div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] font-bold">SQLITE_VECTORS</span>
                  <span className="text-[9px] font-mono">OK</span>
                </div>
                <p className="text-[9px] opacity-60 font-mono">100% Index Coverage ({health?.totalEvents || 0} events)</p>
              </div>
            </div>
          </div>

          {/* Quick interactive note in Brutalist theme */}
          <div className="p-4 bg-[#141414] text-[#E4E3E0] hidden lg:block">
            <h2 className="text-[11px] font-serif italic opacity-50 uppercase mb-2 tracking-widest">Local Context</h2>
            <div className="font-mono text-[10px] leading-relaxed">
              $ sqlite3 local.db<br />
              &gt; SELECT count(*) FROM logs;
            </div>
            <div className="border border-[#E4E3E0]/30 p-2 mt-2 text-[9px] font-mono opacity-60 uppercase">
              DB Status: Fully Synced
            </div>
          </div>
        </nav>

        {/* Content Area split */}
        <div className="col-span-1 lg:col-span-9 flex flex-col overflow-hidden bg-[#E4E3E0]">

          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-[#141414]">
              {/* Left Column: Simulation & Inputs */}
              <div className="xl:col-span-7 flex flex-col divide-y divide-[#141414]">
                
                {/* Real-time stats widgets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[#141414] bg-[#F0EFEC] border-b border-[#141414]">
                  <div className="p-4 flex items-center gap-3">
                    <div className="p-2 border border-[#141414] bg-[#DAD9D5] text-[#141414] flex items-center justify-center">
                      <Clipboard className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-serif italic opacity-50 uppercase tracking-widest text-[#141414] block">Clipboard</span>
                      <span className="text-md font-mono font-bold text-[#141414]">{health?.eventsBySource.clipboard || 0}</span>
                    </div>
                  </div>

                  <div className="p-4 flex items-center gap-3">
                    <div className="p-2 border border-[#141414] bg-[#DAD9D5] text-[#141414] flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-serif italic opacity-50 uppercase tracking-widest text-[#141414] block">Notifs</span>
                      <span className="text-md font-mono font-bold text-[#141414]">{health?.eventsBySource.notification || 0}</span>
                    </div>
                  </div>

                  <div className="p-4 flex items-center gap-3">
                    <div className="p-2 border border-[#141414] bg-[#DAD9D5] text-[#141414] flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-serif italic opacity-50 uppercase tracking-widest text-[#141414] block">Files</span>
                      <span className="text-md font-mono font-bold text-[#141414]">{health?.eventsBySource.file || 0}</span>
                    </div>
                  </div>

                  <div className="p-4 flex items-center gap-3">
                    <div className="p-2 border border-[#141414] bg-[#DAD9D5] text-[#141414] flex items-center justify-center">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-serif italic opacity-50 uppercase tracking-widest text-[#141414] block">Voice</span>
                      <span className="text-md font-mono font-bold text-[#141414]">{health?.eventsBySource.voice || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Simulated Capture Form */}
                <div className="p-6 space-y-4 bg-[#F0EFEC]">
                  <div className="flex items-center justify-between border-b border-[#141414] pb-3">
                    <h2 className="text-xs font-bold text-[#141414] tracking-wider uppercase flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Simulate Mobile Capture Intake
                    </h2>
                    <span className="text-[10px] text-[#141414] font-mono border border-[#141414] px-1.5 py-0.5 bg-[#DAD9D5]">BYPASS_TASKER_PIPE</span>
                  </div>

                  <div className="flex bg-[#DAD9D5] p-1 border border-[#141414]">
                    <button
                      type="button"
                      onClick={() => { setSimType("clipboard"); setSimSource("Chrome"); }}
                      className={`flex-1 py-1 text-[11px] font-bold uppercase transition-all rounded-none ${
                        simType === "clipboard" ? "bg-[#141414] text-[#E4E3E0]" : "text-[#141414] hover:bg-[#141414]/10"
                      }`}
                    >
                      Clipboard
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSimType("notification"); setSimSource("WhatsApp"); }}
                      className={`flex-1 py-1 text-[11px] font-bold uppercase transition-all rounded-none ${
                        simType === "notification" ? "bg-[#141414] text-[#E4E3E0]" : "text-[#141414] hover:bg-[#141414]/10"
                      }`}
                    >
                      Notification
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSimType("file"); setSimSource("FilesApp"); }}
                      className={`flex-1 py-1 text-[11px] font-bold uppercase transition-all rounded-none ${
                        simType === "file" ? "bg-[#141414] text-[#E4E3E0]" : "text-[#141414] hover:bg-[#141414]/10"
                      }`}
                    >
                      File/Screenshot
                    </button>
                  </div>

                  <form onSubmit={triggerSimulation} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-serif italic uppercase tracking-widest text-[#141414] opacity-60 mb-1">Source App</label>
                        <select
                          value={simSource}
                          onChange={(e) => setSimSource(e.target.value)}
                          className="w-full bg-[#DAD9D5] border border-[#141414] text-xs px-2.5 py-1.5 rounded-none focus:outline-none focus:bg-white font-mono uppercase text-[#141414]"
                        >
                          {simType === "clipboard" && (
                            <>
                              <option value="Chrome">Google Chrome</option>
                              <option value="Slack">Slack WorkSpace</option>
                              <option value="WhatsApp">WhatsApp Messenger</option>
                              <option value="Obsidian">Obsidian Notes</option>
                            </>
                          )}
                          {simType === "notification" && (
                            <>
                              <option value="WhatsApp">WhatsApp Messenger</option>
                              <option value="Gmail">Google Gmail</option>
                              <option value="Google Calendar">Google Calendar</option>
                              <option value="Twitter/X">Twitter / X</option>
                            </>
                          )}
                          {simType === "file" && (
                            <>
                              <option value="Screenshot Service">System Screenshot</option>
                              <option value="Downloads Folder">Downloads Folder</option>
                              <option value="Spotify Logs">Spotify App</option>
                              <option value="Fitbit Tracker">Fitbit Run Service</option>
                            </>
                          )}
                        </select>
                      </div>

                      {simType === "file" && (
                        <div>
                          <label className="block text-[10px] font-serif italic uppercase tracking-widest text-[#141414] opacity-60 mb-1">Captured File Name</label>
                          <input
                            type="text"
                            placeholder="e.g. run_stats_2026.gpx"
                            value={simFileName}
                            onChange={(e) => setSimFileName(e.target.value)}
                            className="w-full bg-[#DAD9D5] border border-[#141414] text-xs px-2.5 py-1.5 rounded-none focus:outline-none focus:bg-white font-mono placeholder-[#141414]/40"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-serif italic uppercase tracking-widest text-[#141414] opacity-60 mb-1">Captured Text / Content Payload</label>
                      <textarea
                        rows={3}
                        placeholder={
                          simType === "clipboard" ? "Paste text simulation here (e.g., links, quotes, key study notes)..." :
                          simType === "notification" ? "Notification content (e.g., 'Alice: Let's meet at 5pm for project review')..." :
                          "Describe the metadata/activity logs of this captured file..."
                        }
                        value={simContent}
                        onChange={(e) => setSimContent(e.target.value)}
                        className="w-full bg-[#DAD9D5] border border-[#141414] text-xs p-3 rounded-none focus:outline-none focus:bg-white font-mono placeholder-[#141414]/40 leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSimulating}
                      className="w-full bg-[#141414] text-[#E4E3E0] hover:bg-[#3a3a3a] text-xs font-bold uppercase py-2.5 px-4 rounded-none border border-[#141414] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isSimulating ? "Writing to SQLite Queue..." : "Simulate Ingestion"}</span>
                    </button>
                  </form>
                </div>

                {/* Voice note recorder widget */}
                <div className="p-6 space-y-4 bg-[#F0EFEC]">
                  <div className="flex items-center justify-between border-b border-[#141414] pb-3">
                    <h2 className="text-xs font-bold text-[#141414] tracking-wider uppercase flex items-center gap-2">
                      <Mic className="w-4 h-4 text-red-600" /> Gemini Voice Transcriber (Whisper Worker)
                    </h2>
                    <span className="text-[10px] text-[#141414] font-mono border border-[#141414] px-1.5 py-0.5 bg-[#DAD9D5]">MULTIMODAL_AUDIO_INTAKE</span>
                  </div>

                  <p className="text-xs text-[#141414] leading-relaxed">
                    Record voice memo directly from browser or upload any audio payload. The server pipeline transcribes it, appends markdown logs, and indexes the semantic vectors.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Recording Area */}
                    <div className="p-4 bg-[#DAD9D5] border border-[#141414] flex flex-col items-center justify-center text-center gap-3">
                      {isRecording ? (
                        <>
                          <div className="relative flex items-center justify-center h-12 w-12 border border-[#141414] bg-red-600 text-[#E4E3E0]">
                            <Mic className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-red-700 font-mono">RECORDING: {recordingSeconds}s</span>
                            <span className="text-[9px] text-[#141414] block mt-0.5 uppercase font-mono">Streaming micro-input</span>
                          </div>
                          <button
                            onClick={stopRecordingAndTranscribe}
                            className="bg-[#141414] text-[#E4E3E0] hover:bg-[#3a3a3a] text-[10px] font-bold uppercase px-4 py-2 border border-[#141414] flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <MicOff className="w-3.5 h-3.5 text-red-400" />
                            <span>Stop & Transcribe</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="p-3 bg-[#E4E3E0] text-[#141414] border border-[#141414]">
                            <Mic className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#141414] block uppercase tracking-tight">Microphone Dictation</span>
                            <span className="text-[10px] text-[#141414]/75">Record audio directly</span>
                          </div>
                          <button
                            onClick={startRecording}
                            className="bg-[#141414] text-[#E4E3E0] hover:bg-[#3a3a3a] text-[10px] font-bold uppercase px-4 py-2 border border-[#141414] flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Start Recording</span>
                          </button>
                        </>
                      )}
                    </div>

                    {/* Upload alternative */}
                    <div className="p-4 bg-[#DAD9D5] border border-[#141414] flex flex-col items-center justify-center text-center gap-3">
                      <div className="p-3 bg-[#E4E3E0] text-[#141414] border border-[#141414]">
                        <FileUp className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#141414] block uppercase tracking-tight">Upload Audio File</span>
                        <span className="text-[10px] text-[#141414]/75">MP3, WAV, WebM, Ogg (max 20MB)</span>
                      </div>
                      <label className="bg-[#141414] text-[#E4E3E0] hover:bg-[#3a3a3a] text-[10px] font-bold uppercase px-4 py-2 border border-[#141414] flex items-center gap-1 cursor-pointer transition-all">
                        <Upload className="w-3.5 h-3.5 text-orange-400" />
                        <span>Select File</span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleAudioUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {transcribing && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-3.5 bg-yellow-50 border border-[#141414] flex items-center gap-3 text-xs text-[#141414]"
                    >
                      <RotateCw className="w-4 h-4 text-[#141414] animate-spin flex-shrink-0" />
                      <div>
                        <span className="font-bold uppercase tracking-tight">Gemini Pipeline is translating audio waveform...</span>
                        <span className="block text-[10px] opacity-75 mt-0.5">Uploading base64 PCM chunks, running diarization and computing vector index.</span>
                      </div>
                    </motion.div>
                  )}
                </div>

              </div>

              {/* Right Column: Ingestion Logs feed */}
              <div className="xl:col-span-5 flex flex-col divide-y divide-[#141414]">
                
                {/* Live Raw Event Stream */}
                <div className="p-6 space-y-4 flex flex-col h-[520px] bg-[#E4E3E0]">
                  <div className="flex items-center justify-between border-b border-[#141414] pb-3 flex-shrink-0">
                    <h2 className="text-xs font-bold text-[#141414] tracking-wider uppercase flex items-center gap-2">
                      <Activity className="w-4 h-4" /> Live Ingest Feed
                    </h2>
                    <span className="text-[10px] font-mono border border-[#141414] px-2 py-0.5 bg-[#DAD9D5] text-[#141414]">{rawEvents.length} total events</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {rawEvents.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                        <Database className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-xs font-bold uppercase">Feed is currently empty</span>
                        <p className="text-[10px] max-w-xs mt-1 leading-relaxed uppercase opacity-70">No text, notifications, or voice memos received yet. Use the simulation panel to push raw footprint events.</p>
                      </div>
                    ) : (
                      rawEvents.slice().reverse().map((event) => (
                        <div key={event.id} className="p-3 bg-[#DAD9D5] border border-[#141414] rounded-none space-y-1.5 transition-all hover:bg-[#F0EFEC]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {event.eventType === "clipboard" && <Clipboard className="w-3.5 h-3.5" />}
                              {event.eventType === "notification" && <Bell className="w-3.5 h-3.5" />}
                              {event.eventType === "file" && <FileText className="w-3.5 h-3.5" />}
                              {event.eventType === "voice" && <Mic className="w-3.5 h-3.5" />}
                              <span className="text-[10px] font-bold uppercase">{event.appSource}</span>
                            </div>
                            <span className="text-[9px] font-mono opacity-60">{formatTime(event.timestamp)}</span>
                          </div>
                          
                          <p className="text-xs font-medium break-words leading-relaxed font-sans select-all text-[#141414]">
                            {event.content}
                          </p>

                          {event.fileName && (
                            <div className="flex items-center gap-1 text-[9px] font-mono text-[#141414] bg-[#E4E3E0] px-2 py-0.5 border border-[#141414] rounded-none w-max uppercase">
                              <FileCode className="w-3 h-3" />
                              <span>{event.fileName}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {rawEvents.length > 0 && (
                    <div className="pt-2 border-t border-[#141414] flex items-center justify-between flex-shrink-0">
                      <button
                        onClick={handleClearDatabase}
                        className="text-[10px] font-bold uppercase text-red-700 hover:text-red-900 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Reset All Databases</span>
                      </button>
                      <span className="text-[9px] font-mono opacity-60">AUTO_REFRESH: 8S</span>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: SEMANTIC AI SEARCH */}
          {activeTab === "search" && (
            <div className="p-6 space-y-6">
              
              <div className="bg-[#F0EFEC] p-6 border border-[#141414] space-y-4">
                <div className="flex items-center justify-between border-b border-[#141414] pb-3">
                  <h2 className="text-xs font-bold text-[#141414] tracking-wider uppercase flex items-center gap-2">
                    <Search className="w-4 h-4" /> Vector Semantic Recall (RAG Engine)
                  </h2>
                  <span className="text-[10px] text-[#141414] border border-[#141414] bg-[#DAD9D5] px-1.5 py-0.5 font-mono">EMBEDDINGS_V2_PREVIEW</span>
                </div>

                <p className="text-xs text-[#141414]/90 leading-relaxed">
                  Enter natural language queries. Rather than standard keyword searches, the RAG engine converts your query into a vector representation, retrieves highly relevant snippets from daily summaries or clipboard logs, and synthesizes a precise answer with matching source citations.
                </p>

                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#141414]/60" />
                    <input
                      type="text"
                      placeholder="e.g. 'What did I work on related to project alpha?' or 'Summarize my meeting note dictations'"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#DAD9D5] border border-[#141414] text-xs pl-10 pr-4 py-2.5 rounded-none focus:outline-none focus:bg-white font-mono placeholder-[#141414]/40 text-[#141414]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={searchTimeframe}
                      onChange={(e) => setSearchTimeframe(e.target.value)}
                      className="bg-[#DAD9D5] border border-[#141414] text-xs px-3 py-2 rounded-none focus:outline-none focus:bg-white font-mono uppercase text-[#141414]"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Last 24 Hours</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                    </select>

                    <button
                      type="submit"
                      disabled={searching}
                      className="bg-[#141414] text-[#E4E3E0] hover:bg-[#3a3a3a] text-xs font-bold uppercase px-5 py-2 rounded-none border border-[#141414] flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {searching ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-orange-400" />}
                      <span>Recall</span>
                    </button>
                  </div>
                </form>
              </div>

              {searching && (
                <div className="bg-[#DAD9D5] p-8 border border-[#141414] flex flex-col items-center justify-center text-center gap-3">
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="p-3 border border-[#141414] bg-[#141414] text-[#E4E3E0]"
                  >
                    <Brain className="w-6 h-6" />
                  </motion.div>
                  <h3 className="text-xs font-bold text-[#141414] uppercase">Embedding search vectors & calculating cosine similarity...</h3>
                  <p className="text-[10px] text-[#141414] max-w-sm uppercase font-mono opacity-80 leading-relaxed">Reading matching embeddings cache, extracting top-K segments and querying Gemini-3.5-Flash for synthesized response.</p>
                </div>
              )}

              {searchResponse && !searching && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* AI response card */}
                  <div className="lg:col-span-7 bg-[#F0EFEC] p-6 border border-[#141414] space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#141414] border-b border-[#141414] pb-3 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-orange-600" />
                      <span>Synthesized Digital Recollection</span>
                    </div>

                    <div className="text-[#141414] text-xs leading-relaxed max-w-none space-y-2.5 font-sans whitespace-pre-wrap select-text markdown-body">
                      {searchResponse.ragAnswer}
                    </div>
                  </div>

                  {/* Supporting citations list */}
                  <div className="lg:col-span-5 bg-[#F0EFEC] p-6 border border-[#141414] space-y-4">
                    <div className="text-xs font-bold text-[#141414] border-b border-[#141414] pb-3 flex items-center justify-between uppercase tracking-wider">
                      <span>Semantic Source Chunks</span>
                      <span className="text-[10px] font-mono text-[#141414] opacity-60">COSINE_MATCH</span>
                    </div>

                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                      {searchResponse.results.length === 0 ? (
                        <div className="text-center p-6 opacity-60 text-xs uppercase font-mono">
                          No matching records found.
                        </div>
                      ) : (
                        searchResponse.results.map((res, i) => (
                          <div key={i} className="p-3 bg-[#DAD9D5] border border-[#141414] space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-[#141414] flex items-center gap-1 uppercase">
                                {res.eventType === "voice" && <Mic className="w-3 h-3" />}
                                {res.eventType === "clipboard" && <Clipboard className="w-3 h-3" />}
                                {res.eventType === "notification" && <Bell className="w-3 h-3" />}
                                {res.eventType === "file" && <FileText className="w-3 h-3" />}
                                {!res.eventType && <FileCode className="w-3 h-3" />}
                                {res.date} {res.appSource ? `• ${res.appSource}` : ""}
                              </span>
                              <span className="font-mono text-[#E4E3E0] bg-[#141414] px-1.5 py-0.5 font-bold uppercase">
                                {(res.score * 100).toFixed(0)}% MATCH
                              </span>
                            </div>
                            <p className="text-[11px] text-[#141414] leading-relaxed font-semibold break-words italic font-serif">
                              "{res.content.slice(0, 300)}{res.content.length > 300 ? "..." : ""}"
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}          {/* TAB 3: MARKDOWN VAULT BROWSER */}
          {activeTab === "vault" && (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Sidebar File List */}
              <div className="lg:col-span-4 bg-[#F0EFEC] p-6 border border-[#141414] space-y-4">
                
                {/* Manual Summary compiler trigger */}
                <div className="bg-[#DAD9D5] p-4 border border-[#141414] space-y-2.5">
                  <span className="text-[10px] font-bold text-[#141414] uppercase flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Compile Vault Notes
                  </span>
                  
                  <div className="flex flex-col gap-2">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-white border border-[#141414] text-xs px-2.5 py-1.5 rounded-none focus:outline-none font-mono text-[#141414]"
                    />
                    
                    <div className="flex gap-1.5">
                      <button
                        onClick={compileDailySummary}
                        disabled={processingSummary}
                        className="flex-1 bg-[#141414] text-[#E4E3E0] hover:bg-[#3a3a3a] text-[10px] font-bold uppercase py-2 px-2 border border-[#141414] disabled:opacity-50 flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        {processingSummary ? "Compiling..." : "Daily Summary"}
                      </button>
                      <button
                        onClick={compileHealthDigest}
                        disabled={processingSummary}
                        className="flex-1 bg-[#DAD9D5] text-[#141414] hover:bg-white text-[10px] font-bold uppercase py-2 px-2 border border-[#141414] disabled:opacity-50 flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        Health Digest
                      </button>
                    </div>
                  </div>
                </div>

                {/* Vault files browser tabs */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[10px] font-bold text-[#141414]/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Daily Markdown Notes
                    </h3>
                    <div className="space-y-1">
                      {vaultFiles.summaries.length === 0 ? (
                        <p className="text-[10px] text-[#141414] italic p-2 uppercase font-mono">No compiled daily summaries yet.</p>
                      ) : (
                        vaultFiles.summaries.map((file) => (
                          <button
                            key={file.name}
                            onClick={() => selectFile(file)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-none text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer border ${
                              selectedFile?.path === file.path 
                                ? "bg-[#141414] text-[#E4E3E0] border-[#141414]" 
                                : "text-[#141414] border-transparent hover:bg-[#DAD9D5]"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5" />
                              {file.date}.md
                            </span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-bold text-[#141414]/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" /> Diagnostic digests
                    </h3>
                    <div className="space-y-1">
                      {vaultFiles.digests.length === 0 ? (
                        <p className="text-[10px] text-[#141414] italic p-2 uppercase font-mono">No health digests compiled yet.</p>
                      ) : (
                        vaultFiles.digests.map((file) => (
                          <button
                            key={file.name}
                            onClick={() => selectFile(file)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-none text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer border ${
                              selectedFile?.path === file.path 
                                ? "bg-[#141414] text-[#E4E3E0] border-[#141414]" 
                                : "text-[#141414] border-transparent hover:bg-[#DAD9D5]"
                            }`}
                          >
                            <span className="flex items-center gap-2 flex-1 truncate">
                              <FileCode className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">digest-{file.date}.md</span>
                            </span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Reader and Writer Panel */}
              <div className="lg:col-span-8 bg-[#F0EFEC] border border-[#141414] overflow-hidden flex flex-col min-h-[500px]">
                {selectedFile ? (
                  <>
                    <div className="px-5 py-3.5 border-b border-[#141414] flex items-center justify-between bg-[#DAD9D5] flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-[#141414]" />
                        <div>
                          <span className="text-xs font-bold text-[#141414] uppercase">{selectedFile.name}</span>
                          <span className="block text-[9px] font-mono text-[#141414]/70">PATH: vault/{selectedFile.path}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setIsEditingFile(!isEditingFile)}
                          className="px-2.5 py-1.5 rounded-none border border-[#141414] bg-white text-[#141414] text-[10px] font-bold hover:bg-[#DAD9D5] uppercase transition-colors cursor-pointer"
                        >
                          {isEditingFile ? "Preview Mode" : "Edit Raw Markdown"}
                        </button>
                        
                        {isEditingFile && (
                          <button
                            onClick={saveEditedFile}
                            disabled={savingFile}
                            className="bg-[#141414] text-[#E4E3E0] px-3 py-1.5 border border-[#141414] text-[10px] font-bold uppercase flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Save className="w-3 h-3" />
                            <span>{savingFile ? "Saving..." : "Save Changes"}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 p-6 overflow-y-auto select-text selection:bg-[#DAD9D5]">
                      {isEditingFile ? (
                        <textarea
                          rows={24}
                          value={fileContent}
                          onChange={(e) => setFileContent(e.target.value)}
                          className="w-full h-full min-h-[380px] bg-white border border-[#141414] rounded-none p-4 font-mono text-xs focus:outline-none focus:bg-white leading-relaxed text-[#141414]"
                        />
                      ) : (
                        <div 
                          className="markdown-body max-w-none text-xs"
                          dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(fileContent) }}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#141414]/50">
                    <FolderOpen className="w-10 h-10 mb-2 text-[#141414]" />
                    <span className="text-xs font-bold uppercase text-[#141414]">No vault file selected</span>
                    <p className="text-[11px] max-w-sm mt-1 uppercase leading-relaxed font-mono">Choose a Daily Summary or Diagnostic health digest from the sidebar browser to view, render, and edit compiled personal notes.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: AUTHORIZED DEVICES & SECURE TOKENS */}
          {activeTab === "devices" && (
            <div className="p-6 space-y-6">
              
              <div className="bg-[#F0EFEC] p-6 border border-[#141414] space-y-5">
                <div className="flex items-center justify-between border-b border-[#141414] pb-3">
                  <h2 className="text-xs font-bold text-[#141414] tracking-wider uppercase flex items-center gap-2">
                    <Smartphone className="w-4.5 h-4.5" /> Device Ingestion Credentials & Tokens
                  </h2>
                  <span className="text-[10px] text-[#141414] border border-[#141414] bg-[#DAD9D5] px-1.5 py-0.5 font-mono">BEARER_AUTH</span>
                </div>

                <p className="text-xs text-[#141414] leading-relaxed">
                  To sync data from mobile devices automatically, configure automation clients (e.g. Tasker on Android or iOS Shortcuts) to send batched requests with the pre-authorized bearer tokens below.
                </p>

                <div className="space-y-4">
                  {health?.devices.map((dev) => (
                    <div key={dev.deviceId} className="p-4 bg-[#DAD9D5] border border-[#141414] space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-[#E4E3E0] text-[#141414] border border-[#141414]">
                            <Smartphone className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#141414] block uppercase tracking-tight">{dev.deviceName}</span>
                            <span className="text-[10px] text-[#141414]/70 block font-mono">ID: {dev.deviceId}</span>
                          </div>
                        </div>

                        <div className="text-right sm:self-center font-mono">
                          <span className="text-[10px] text-[#141414]/60 block uppercase font-mono">Last Synced Activity</span>
                          <span className="text-[11px] font-bold text-[#141414]">{formatDateLabel(dev.lastSeen)} {formatTime(dev.lastSeen)}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#141414] grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        <div>
                          <label className="block text-[10px] font-bold text-[#141414]/70 uppercase mb-1">Authorization Token</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              readOnly
                              value={dev.token}
                              className="bg-white border border-[#141414] text-xs px-2.5 py-1.5 rounded-none font-mono flex-1 select-all focus:outline-none text-[#141414]"
                            />
                          </div>
                        </div>

                        <div className="text-[10px] text-[#141414] bg-[#E4E3E0] p-2.5 border border-[#141414] font-medium leading-relaxed font-mono">
                          <span className="font-bold block text-[#141414] mb-0.5">ENDPOINT:</span>
                          <code className="font-mono text-[9px] bg-white border border-[#141414] px-1.5 py-0.5 text-red-700">POST /api/ingest</code> with header <code className="font-mono text-[9px] bg-white border border-[#141414] px-1.5 py-0.5 text-slate-700">{"Authorization: Bearer " + dev.token}</code>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tasker / Shortcuts Configuration Guide */}
              <div className="bg-[#F0EFEC] p-6 border border-[#141414] space-y-4">
                <h3 className="text-xs font-bold text-[#141414] uppercase tracking-wider border-b border-[#141414] pb-2 flex items-center gap-2">
                  <FileCode className="w-4 h-4" /> Integration Setup Guide (Tasker & Shortcuts)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[#141414] flex items-center gap-1 uppercase tracking-tight">
                      <CornerDownRight className="w-3.5 h-3.5" /> Android: Tasker Capture Setup
                    </span>
                    <ol className="list-decimal list-inside text-[11px] text-[#141414] space-y-2.5 font-medium leading-relaxed pl-1.5 uppercase font-mono">
                      <li>Create profile triggering on variables like clipboard change.</li>
                      <li>In task, append row to local SQLite database or simple file.</li>
                      <li>Setup scheduled sync task to batch-post payload.</li>
                      <li>HTTP Request setup:
                        <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-[#141414]/80 font-normal normal-case font-mono text-[10px]">
                          <li>METHOD: <code className="font-bold">POST</code></li>
                          <li>URL: <code className="font-bold">http://[server-ip]:3000/api/ingest</code></li>
                          <li>HEADERS: <code className="font-bold">Authorization: Bearer brain_capture_token_2026</code></li>
                          <li>BODY: <code className="font-bold">[{"{"}"id":"uuid","eventType":"clipboard","content":"%CLIP"{"}"}]</code></li>
                        </ul>
                      </li>
                      <li>On status 200, flush raw SQLite queue tables.</li>
                    </ol>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[#141414] flex items-center gap-1 uppercase tracking-tight">
                      <CornerDownRight className="w-3.5 h-3.5" /> iOS: Shortcuts Automations
                    </span>
                    <ol className="list-decimal list-inside text-[11px] text-[#141414] space-y-2.5 font-medium leading-relaxed pl-1.5 uppercase font-mono">
                      <li>Open automation tab in Shortcuts application.</li>
                      <li>Select triggers like screen capturing or closing safari.</li>
                      <li>Build trigger action appending text log to files app.</li>
                      <li>Shortcuts batch upload:
                        <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-[#141414]/80 font-normal normal-case font-mono text-[10px]">
                          <li>ACTION: <code className="font-bold">Get Contents of URL</code></li>
                          <li>HEADERS: <code className="font-bold">Authorization: Bearer token</code></li>
                          <li>PAYLOAD: <code className="font-bold">JSON dictionary of logs</code></li>
                        </ul>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* Aesthetic minimalist footer */}
      <footer className="bg-[#141414] border-t border-[#141414] py-5 text-center flex-shrink-0">
        <p className="text-[10px] text-[#DAD9D5] tracking-widest font-mono uppercase flex items-center justify-center gap-2">
          <span>Designed with absolute intent • 100% PRIVATE PERSONAL DATA CAPTURE</span>
        </p>
      </footer>

    </div>
  );
}
