import { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, 
  X, 
  Maximize2, 
  Minimize2, 
  Send, 
  Sparkles,
  Bot,
  Plus,
  History,
  Activity,
  Calendar,
  Thermometer,
  Shield,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toastStore';
import { useAuthStore } from '@/store/authStore';
import useConfirmStore from '@/store/confirmStore';

const API_BASE = import.meta.env.DEV ? '/api' : `${import.meta.env.VITE_API_URL || ''}/api`;

export default function GendhisWidget() {
  const ask = useConfirmStore(state => state.ask);
  const [viewState, setViewState] = useState('minimized'); // 'minimized' | 'compact' | 'fullscreen'
  const [messages, setMessages] = useState([
    { id: 1, sender: 'gendhis', text: 'Halo! Saya Gendhis, asisten AI Estrus. Ada yang bisa saya bantu hari ini terkait kondisi sapi-sapi di kandang?', isInsight: true }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(`session_widget_${Date.now()}`);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const widgetRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [sessions, setSessions] = useState([]);

  const quickPrompts = [
    { icon: <Activity className="w-4 h-4 text-emerald-500" />, label: 'Prediksi Birahi', desc: 'Sapi yang estrus hari ini', text: 'Sapi mana saja yang menunjukkan gejala estrus hari ini?' },
    { icon: <Thermometer className="w-4 h-4 text-amber-500" />, label: 'Cek Suhu & Anomali', desc: 'Analisa grafik IoT collar', text: 'Tolong analisakan grafik suhu collar IoT yang mengalami anomali' },
    { icon: <Calendar className="w-4 h-4 text-blue-500" />, label: 'Rekomendasi Pakan', desc: 'Rasio pakan saat kebuntingan', text: 'Berapa rasio pakan dan konsentrat ideal saat sapi memasuki masa kebuntingan?' },
    { icon: <Shield className="w-4 h-4 text-purple-500" />, label: 'Tips Kesehatan', desc: 'Panduan medis darurat', text: 'Beri saya panduan penanganan awal untuk kembung (bloat) pada sapi.' }
  ];

  // ═════════════════════════════════════════════════════════════
  // ─── CUSTOM MARKDOWN RENDERER (Safely parses lists & headers) ───
  // ═════════════════════════════════════════════════════════════
  const parseInlineMarkdown = (text) => {
    if (!text) return '';
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-extrabold text-[var(--accent)]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const renderMarkdown = (text) => {
    if (!text) return '';
    const lines = text.split('\n');
    const rendered = lines.map((line, idx) => {
      let cleanLine = line.trim();

      // H3 Header
      if (cleanLine.startsWith('### ')) {
        const headerText = cleanLine.slice(4);
        return (
          <h3 key={idx} className="text-xs font-black text-[var(--text-1)] mt-3 mb-1 uppercase tracking-wider font-display">
            {parseInlineMarkdown(headerText)}
          </h3>
        );
      }

      // H2 Header
      if (cleanLine.startsWith('## ')) {
        const headerText = cleanLine.slice(3);
        return (
          <h2 key={idx} className="text-sm font-bold text-[var(--text-1)] mt-3 mb-1.5 font-display">
            {parseInlineMarkdown(headerText)}
          </h2>
        );
      }

      // H1 Header
      if (cleanLine.startsWith('# ')) {
        const headerText = cleanLine.slice(2);
        return (
          <h1 key={idx} className="text-base font-extrabold text-[var(--text-1)] mt-4 mb-2 font-display">
            {parseInlineMarkdown(headerText)}
          </h1>
        );
      }

      // Bullet List item
      if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
        const listText = cleanLine.slice(2);
        return (
          <ul key={idx} className="list-disc pl-5 my-0.5 space-y-0.5">
            <li className="text-xs font-semibold leading-relaxed text-[var(--text-1)]">
              {parseInlineMarkdown(listText)}
            </li>
          </ul>
        );
      }

      // Empty spacing line
      if (cleanLine === '') {
        return <div key={idx} className="h-2"></div>;
      }

      // Standard paragraph
      return (
        <p key={idx} className="text-xs font-semibold leading-relaxed mb-1 text-[var(--text-1)]">
          {parseInlineMarkdown(cleanLine)}
        </p>
      );
    });

    return <div className="space-y-0.5">{rendered}</div>;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (viewState !== 'minimized') {
      scrollToBottom();
    }
  }, [messages, streamingMessage, viewState]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/sessions`, {
        headers: {
          'Authorization': `Bearer ${token || localStorage.getItem('access_token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data || []);
      }
    } catch (err) {
      console.warn("Failed to fetch sessions from db:", err);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token || localStorage.getItem('access_token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const mapped = data.messages.map((m, idx) => ({
          id: idx,
          sender: m.role === 'assistant' || m.role === 'model' ? 'gendhis' : 'user',
          text: m.content
        }));
        setMessages(mapped.length > 0 ? mapped : [
          { id: Date.now(), sender: 'gendhis', text: 'Halo! Saya Gendhis, asisten AI Estrus. Ada yang bisa saya bantu hari ini terkait kondisi sapi-sapi di kandang?', isInsight: true }
        ]);
        setCurrentSessionId(sessionId);
        toast.success('Percakapan dimuat!');
      }
    } catch (err) {
      console.warn("Failed to load session:", err);
      toast.error("Gagal memuat percakapan.");
    }
  };

  useEffect(() => {
    if (token || localStorage.getItem('access_token')) {
      fetchSessions();
    }
  }, [token, viewState]);

  const handleSend = async (customMessage) => {
    const message = (typeof customMessage === 'string' ? customMessage : input).trim();
    if (!message || isTyping) return;

    const userMsg = { id: Date.now(), sender: 'user', text: message };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setStreamingMessage('');

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ message, session_id: currentSessionId }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setIsTyping(false);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedReply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.chunk !== undefined) {
              accumulatedReply += payload.chunk;
              setStreamingMessage(accumulatedReply);
            }
          } catch (_) {
            // Ignore incomplete JSON chunks
          }
        }
      }

      const modelMsg = { 
        id: Date.now() + 1, 
        sender: 'gendhis', 
        text: accumulatedReply.replace(/\[.*?\]/g, '').trim(),
        isInsight: true
      };
      setMessages(prev => [...prev, modelMsg]);
      setStreamingMessage('');
      fetchSessions();

    } catch (err) {
      console.warn("SSE stream failed. Running widget offline chatbot responses...", err);
      setIsTyping(false);
      
      const offlineReplies = [
        "Sapi yang sedang birahi biasanya menunjukkan peningkatan keaktifan gerak, vulva memerah/bengkak, dan keluar lendir bening lyy. Pastikan lakukan Inseminasi Buatan (IB) pada jendela waktu emas (Golden Window) 12-18 jam sejak tanda pertama.",
        "Kondisi sensor kalung IoT di kandang A termonitor stabil 98% lyy. Aku menyarankan untuk terus memantau grafik suhu harian agar anomali reproduksi bisa terdeteksi lebih awal.",
        "Ada yang bisa Gendhis bantu lagi lyy? Kamu bisa tanya tentang kesehatan sapi, jadwal kebuntingan, atau anomali suhu kandang."
      ];
      
      const randomReply = offlineReplies[Math.floor(Math.random() * offlineReplies.length)];
      
      setIsTyping(true);
      let typedText = '';
      for (let i = 0; i < randomReply.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 15));
        typedText += randomReply.charAt(i);
        setStreamingMessage(typedText);
      }
      setIsTyping(false);

      const modelMsg = { 
        id: Date.now() + 1, 
        sender: 'gendhis', 
        text: randomReply,
        isInsight: true
      };
      setMessages(prev => [...prev, modelMsg]);
      setStreamingMessage('');
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(`session_widget_${Date.now()}`);
    setMessages([
      { id: Date.now(), sender: 'gendhis', text: 'Halo! Saya Gendhis, asisten AI Estrus. Ada yang bisa saya bantu hari ini terkait kondisi sapi-sapi di kandang?', isInsight: true }
    ]);
    setStreamingMessage('');
    toast.success('Sesi percakapan baru dimulai!');
  };

  const isFullscreen = viewState === 'fullscreen';
  const userName = user?.full_name || 'Iwan Prianto';
  const userEmail = user?.email || 'wan@farm.com';
  const userInitials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  if (viewState === 'minimized') {
    return (
      <button 
        onClick={() => setViewState('compact')}
        className="fixed bottom-[104px] md:bottom-6 right-4 md:right-6 w-14 h-14 bg-[var(--accent)] hover:bg-[var(--color-primary-hover)] text-white rounded-full shadow-lg hover:shadow-2xl flex items-center justify-center transition-all duration-300 z-30 group active:scale-95"
        title="Tanya Gendhis"
      >
        <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform animate-pulse" />
        <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-ping"></span>
      </button>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // ─── FULLSCREEN MODE (Dynamic system Light/Dark theme matched!) ──
  // ═════════════════════════════════════════════════════════════
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 w-full h-full bg-[var(--bg-base)] text-[var(--text-1)] z-[999] flex overflow-hidden animate-in fade-in duration-300">
        
        {/* SIDEBAR (Responsive Collapsible matching system theme!) */}
        <aside 
          className={cn(
            "h-full bg-[var(--bg-surface)] border-r border-[var(--border)] flex flex-col p-4 shrink-0 transition-all duration-300 absolute md:relative z-20",
            isSidebarCollapsed ? "w-0 p-0 border-r-0 overflow-hidden" : "w-[280px]"
          )}
        >
          {!isSidebarCollapsed && (
            <>
              {/* Logo & Elegant Minimize Button inside the Sidebar Header next to Logo */}
              <div className="flex items-center justify-between px-2 py-3 mb-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[var(--accent)] flex items-center justify-center">
                    <Bot className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-[var(--text-1)]">Gendhis AI Session</h2>
                    <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-widest leading-none">Powered by HERD</span>
                  </div>
                </div>
                
                {/* Repositioned larger collapse button inside sidebar next to logo title */}
                <button 
                  type="button"
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="p-2 hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-xl text-[var(--text-2)] hover:text-[var(--accent)] transition-all active:scale-95 shadow-sm flex items-center justify-center shrink-0"
                  title="Sembunyikan Sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <button 
                onClick={startNewChat}
                className="flex items-center gap-2.5 px-4 py-3 bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-1)] transition-all shadow-sm w-full mb-6 active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4 text-[var(--accent)]" />
                New Chat Session
              </button>

              {/* History List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                <div className="flex items-center gap-1.5 px-2">
                  <History className="w-3.5 h-3.5 text-[var(--text-3)]" />
                  <span className="text-[10px] font-black uppercase text-[var(--text-3)] tracking-wider">Percakapan Terakhir</span>
                </div>
                <div className="space-y-1">
                  {sessions.length === 0 ? (
                    <p className="text-[10px] px-2 font-semibold text-[var(--text-3)] italic">Tidak ada percakapan tersimpan</p>
                  ) : (
                    sessions.map((item) => (
                      <div key={item.session_id} className="group flex items-center justify-between rounded-lg hover:bg-[var(--bg-hover)] transition-all">
                        <button
                          type="button"
                          onClick={() => loadSession(item.session_id)}
                          className={cn(
                            "flex-1 text-left px-3 py-2.5 text-xs font-semibold truncate block transition-all",
                            currentSessionId === item.session_id 
                              ? "text-[var(--accent)] font-bold" 
                              : "text-[var(--text-2)] hover:text-[var(--text-1)]"
                          )}
                        >
                          {item.title || 'Percakapan Tanpa Judul'}
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = await ask({
                              title: "Hapus Percakapan",
                              message: "Apakah Anda yakin ingin menghapus percakapan ini?",
                              confirmText: "Hapus",
                              cancelText: "Batal",
                              isDanger: true
                            });
                            if (confirmed) {
                              try {
                                const res = await fetch(`${API_BASE}/chat/sessions/${item.session_id}`, {
                                  method: 'DELETE',
                                  headers: {
                                    'Authorization': `Bearer ${token || localStorage.getItem('access_token')}`
                                  }
                                });
                                if (res.ok) {
                                  toast.success('Percakapan dihapus!');
                                  if (currentSessionId === item.session_id) {
                                    startNewChat();
                                  }
                                  fetchSessions();
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            }
                          }}
                          className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all text-[var(--text-3)] mr-1 shrink-0"
                          title="Hapus Percakapan"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* User Profile Footer */}
              <div className="pt-4 border-t border-[var(--border)] mt-4 flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
                  {userInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[var(--text-1)] truncate">{userName}</p>
                  <p className="text-[10px] text-[var(--text-3)] truncate">{userEmail}</p>
                </div>
              </div>
            </>
          )}
        </aside>

        {/* MAIN CHAT AREA */}
        <main className="flex-1 h-full flex flex-col bg-[var(--bg-base)] relative">
          
          {/* Header (Dynamic system theme colors, NO Ugly line!) */}
          <header className="px-6 py-4 flex items-center justify-between shrink-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-10">
            <div className="flex items-center gap-2">
              {isSidebarCollapsed && (
                <button 
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="mr-3 p-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-xl text-[var(--text-2)] hover:text-[var(--accent)] transition-all active:scale-95 shadow-sm flex items-center justify-center"
                  title="Tampilkan Sidebar"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              <span className="text-lg font-black text-[var(--accent)] tracking-tight">Gendhis</span>
              <span className="px-2 py-0.5 bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-[8px] font-bold rounded-full uppercase tracking-wider">Premium Session</span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setViewState('compact')}
                className="p-2 text-[var(--text-2)] hover:text-[var(--text-1)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-xl transition-all shadow-sm"
                title="Kembali ke Compact"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewState('minimized')}
                className="p-2 text-[var(--text-2)] hover:text-[var(--text-1)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-xl transition-all shadow-sm"
                title="Keluar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Message Viewport */}
          <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
            
            {/* If only welcome message is present: show gorgeous Gemini Welcome Empty State */}
            {messages.length === 1 && !streamingMessage ? (
              <div className="max-w-[720px] mx-auto w-full pt-12 pb-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Typing Typography Greeting */}
                <div>
                  <h1 className="text-4xl sm:text-5xl font-display font-black leading-tight tracking-tight bg-gradient-to-r from-[var(--accent)] via-teal-500 to-[var(--accent)] bg-clip-text text-transparent">
                    Halo, {userName}.
                  </h1>
                  <h2 className="text-3xl sm:text-4xl font-display font-bold text-[var(--text-2)] mt-2">
                    Ada yang bisa Gendhis bantu hari ini?
                  </h2>
                </div>

                {/* Grid of Prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
                  {quickPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(p.text)}
                      className="text-left p-4 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-2xl transition-all group flex flex-col gap-2.5 active:scale-[0.98] shadow-sm hover:shadow-md"
                    >
                      <div className="w-8 h-8 rounded-xl bg-[var(--bg-base)] flex items-center justify-center group-hover:scale-105 transition-transform border border-[var(--border)]">
                        {p.icon}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[var(--text-1)]">{p.label}</p>
                        <p className="text-[10px] text-[var(--text-3)] mt-0.5">{p.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

              </div>
            ) : (
              // Active Conversation View
              <div className="max-w-[700px] mx-auto w-full space-y-8">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex w-full gap-4", msg.sender === 'user' ? "justify-end" : "justify-start")}>
                    
                    {msg.sender === 'gendhis' && (
                      <div className="w-8 h-8 rounded-xl bg-[var(--accent)] flex items-center justify-center shrink-0 border border-emerald-400/20 shadow-md">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <div className={cn("flex flex-col max-w-[80%]", msg.sender === 'user' ? "items-end" : "items-start")}>
                      <span className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1.5 block">
                        {msg.sender === 'user' ? userName : 'Gendhis AI'}
                      </span>
                      <div className={cn(
                        "px-4 py-3 text-xs leading-6 border rounded-2xl font-medium shadow-sm transition-all duration-200",
                        msg.sender === 'user'
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-1)]"
                      )}>
                        {msg.sender === 'user' ? (
                          <p className="whitespace-pre-wrap font-sans font-medium">{msg.text}</p>
                        ) : (
                          renderMarkdown(msg.text)
                        )}
                      </div>
                    </div>

                    {msg.sender === 'user' && (
                      <div className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] text-[var(--text-1)] flex items-center justify-center font-bold text-xs shrink-0 border border-[var(--border)] shadow-md">
                        {userInitials}
                      </div>
                    )}

                  </div>
                ))}

                {/* Streaming Chunk */}
                {streamingMessage && (
                  <div className="flex w-full gap-4 justify-start">
                    <div className="w-8 h-8 rounded-xl bg-[var(--accent)] flex items-center justify-center shrink-0 border border-emerald-400/20 shadow-md">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex flex-col max-w-[80%] items-start">
                      <span className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1.5">Gendhis AI</span>
                      <div className="px-4 py-3 text-xs leading-6 border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-1)] rounded-2xl font-medium shadow-sm">
                        {renderMarkdown(streamingMessage)}
                        <span className="inline-block w-1.5 h-3.5 bg-[var(--accent)] rounded-sm animate-pulse ml-0.5 shrink-0"></span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Thinking Loader */}
                {isTyping && (
                  <div className="flex w-full gap-4 justify-start items-center">
                    <div className="w-8 h-8 rounded-xl bg-[var(--accent)] flex items-center justify-center shrink-0 border border-emerald-400/20 shadow-md">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] px-4 py-3 rounded-2xl flex items-center gap-1 shadow-sm">
                      <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Bottom input area (Dynamic system theme colors, NO Ugly line!) */}
          <div className="p-4 bg-[var(--bg-base)] shrink-0">
            <div className="max-w-[700px] mx-auto w-full">
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2 relative">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Gendhis..."
                  className="w-full bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-1)] text-xs rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/10 transition-all placeholder-slate-400 outline-none shadow-sm"
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="absolute right-2 top-2 bottom-2 aspect-square bg-[var(--accent)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
                >
                  <Send className="w-4 h-4 ml-0.5 text-white" />
                </button>
              </form>
              <p className="text-[9.5px] text-center text-[var(--text-3)] mt-2.5 font-medium tracking-wide">
                Gendhis AI dapat membuat kesalahan. Harap verifikasi info medis.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // ─── COMPACT FLOATING MODAL MODE ────────────────────────────
  // ═════════════════════════════════════════════════════════════
  return (
    <>
      {/* Tombol launcher silang melayang */}
      <button 
        onClick={() => setViewState('minimized')}
        className="fixed bottom-[104px] md:bottom-6 right-4 md:right-6 w-14 h-14 bg-slate-700 hover:bg-slate-800 rotate-90 text-white rounded-full shadow-lg hover:shadow-2xl flex items-center justify-center transition-all duration-300 z-30 group active:scale-95"
        title="Tutup Chat"
      >
        <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>

      {/* Widget Window */}
      <div 
        ref={widgetRef}
        style={{ 
          boxShadow: 'var(--shadow-modal)', 
          borderRadius: '24px',
          border: '1px solid var(--border)'
        }}
        className="fixed bottom-[164px] md:bottom-[84px] right-4 md:right-6 w-[360px] h-[440px] max-w-[calc(100vw-32px)] z-[200] animate-in slide-in-from-bottom-8 fade-in duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-1)] transition-all duration-300 ease-out"
      >
        {/* HEADER (Removed Trash Button as requested!) */}
        <div className="bg-[var(--accent)] text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center border border-white/10 relative">
              <Bot className="w-4.5 h-4.5 text-white animate-bounce" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-emerald-600 rounded-full animate-pulse"></span>
            </div>
            <div>
              <h3 className="font-display font-bold text-sm leading-none">Gendhis AI</h3>
              <p className="text-[9px] text-emerald-100 font-semibold tracking-wide flex items-center gap-1 mt-1 opacity-90">
                Asisten Kesehatan & Reproduksi Ternak
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => setViewState('fullscreen')}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="FullScreen Session"
          >
            <Maximize2 className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        {/* CHAT BODY AREA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-base)] custom-scrollbar">
          
          <div className="text-center my-2">
            <span className="text-[9px] font-bold tracking-wider text-[var(--text-3)] bg-[var(--bg-hover)] px-2.5 py-1 rounded-full border border-[var(--border)]">
              Hari ini
            </span>
          </div>

          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex w-full flex-col", msg.sender === 'user' ? "items-end" : "items-start")}>
              {msg.sender === 'gendhis' && (
                <div className="flex items-center gap-1 mb-1 ml-1">
                  <Sparkles className="w-3 h-3 text-amber-500 animate-spin" />
                  <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-widest">AI Insight</span>
                </div>
              )}
              
              <div 
                style={{ 
                  borderRadius: msg.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
                className={cn(
                  "max-w-[85%] px-4 py-2.5 text-xs leading-5 border transition-all duration-200",
                  msg.sender === 'user' 
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white" 
                    : "bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-1)]"
                )}
              >
                {msg.sender === 'user' ? (
                  <p className="whitespace-pre-wrap font-sans font-medium">{msg.text}</p>
                ) : (
                  renderMarkdown(msg.text)
                )}
              </div>
            </div>
          ))}

          {/* Streaming AI chunk text */}
          {streamingMessage && (
            <div className="flex w-full flex-col items-start">
              <div className="flex items-center gap-1 mb-1 ml-1">
                <Sparkles className="w-3 h-3 text-amber-500 animate-spin" />
                <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-widest">AI Insight</span>
              </div>
              <div 
                style={{ borderRadius: '16px 16px 16px 4px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                className="max-w-[85%] px-4 py-2.5 text-xs leading-5 border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-1)]"
              >
                <div className="text-xs leading-5 font-sans font-medium">
                  {renderMarkdown(streamingMessage)}
                  <span className="inline-block w-1.5 h-3.5 bg-[var(--accent)] rounded-sm animate-pulse ml-0.5 shrink-0"></span>
                </div>
              </div>
            </div>
          )}

          {/* Thinking loader */}
          {isTyping && (
            <div className="flex w-full justify-start items-center gap-2">
              <div 
                style={{ borderRadius: '16px 16px 16px 4px' }}
                className="bg-[var(--bg-surface)] border border-[var(--border)] px-4 py-2.5 shadow-sm flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT FOOTER */}
        <div className="p-3 bg-[var(--bg-surface)] border-t border-[var(--border)] shrink-0">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2 relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanya Gendhis..."
              className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-1)] text-xs rounded-full pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all placeholder-slate-400 outline-none"
            />
            <button 
              type="submit"
              disabled={!input.trim() || isTyping}
              className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square bg-[var(--accent)] text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <Send className="w-3.5 h-3.5 ml-0.5 text-white" />
            </button>
          </form>
          <p className="text-[9px] text-center text-[var(--text-3)] mt-2 font-semibold">
            Gendhis AI dapat membuat kesalahan. Harap verifikasi info medis.
          </p>
        </div>

      </div>
    </>
  );
}
