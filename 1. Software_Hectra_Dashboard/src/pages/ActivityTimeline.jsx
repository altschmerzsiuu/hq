import { useState, useEffect } from 'react';
import { 
  Clock, 
  Search, 
  Activity, 
  Heart, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  RefreshCw,
  Loader2
} from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { cn } from '@/lib/utils';

const EVENT_CONFIG = {
  estrus: {
    color: 'border-red-200 dark:border-red-900/40 bg-red-50/70 dark:bg-red-950/20 text-red-600 dark:text-red-400',
    iconColor: 'bg-red-500 text-white',
    icon: Activity,
    label: 'Estrus Detected'
  },
  insemination: {
    color: 'border-green-200 dark:border-green-900/40 bg-green-50/70 dark:bg-green-950/20 text-green-700 dark:text-green-400',
    iconColor: 'bg-green-500 text-white',
    icon: CheckCircle,
    label: 'Insemination'
  },
  pregnancy: {
    color: 'border-purple-200 dark:border-purple-900/40 bg-purple-50/70 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400',
    iconColor: 'bg-purple-500 text-white',
    icon: Heart,
    label: 'Pregnancy Check'
  },
  anomaly: {
    color: 'border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400',
    iconColor: 'bg-amber-500 text-white',
    icon: AlertTriangle,
    label: 'Anomaly Warning'
  },
  system: {
    color: 'border-blue-200 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400',
    iconColor: 'bg-blue-500 text-white',
    icon: Info,
    label: 'System Notification'
  }
};

export default function ActivityTimeline() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/timeline/events');
      setEvents(res.data || []);
    } catch (err) {
      console.error("Gagal mengambil data timeline:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  const getFilteredEvents = () => {
    let result = [...events];
    
    // Apply search query
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      result = result.filter(e => 
        (e.title || '').toLowerCase().includes(term) ||
        (e.description || '').toLowerCase().includes(term) ||
        (e.cow_name || '').toLowerCase().includes(term) ||
        (e.cow_id || '').toLowerCase().includes(term)
      );
    }

    // Apply category filter
    if (activeFilter !== 'all') {
      result = result.filter(e => e.type === activeFilter);
    }

    return result;
  };

  // Group events by date (e.g. Today, Yesterday, or formatted date)
  const groupEventsByDate = (eventList) => {
    const groups = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    eventList.forEach(event => {
      const eventDate = new Date(event.timestamp);
      eventDate.setHours(0, 0, 0, 0);

      let dateLabel = '';
      if (eventDate.getTime() === today.getTime()) {
        dateLabel = 'Hari Ini (Today)';
      } else if (eventDate.getTime() === yesterday.getTime()) {
        dateLabel = 'Kemarin (Yesterday)';
      } else {
        dateLabel = new Date(event.timestamp).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }

      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(event);
    });

    return groups;
  };

  const filteredEvents = getFilteredEvents();
  const groupedEvents = groupEventsByDate(filteredEvents);

  const filters = [
    { id: 'all', label: 'Semua Kategori' },
    { id: 'estrus', label: 'Deteksi Estrus' },
    { id: 'insemination', label: 'Inseminasi (IB)' },
    { id: 'pregnancy', label: 'Kebuntingan' },
    { id: 'anomaly', label: 'Anomali Perilaku' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)]">Timeline Aktivitas Peternakan</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Lacak semua aktivitas harian, peringatan estrus, tindakan kawin, dan kejadian anomali secara real-time.</p>
        </div>
        <button 
          onClick={fetchEvents}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: '0.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-1)', outline: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
          className="shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* FILTER & SEARCH */}
      <div className="flex flex-col gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
          </div>
          <input
            type="text"
            placeholder="Cari aktivitas atau nama sapi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 38px', border: '0.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-1)', outline: 'none', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
          />
        </div>

        {/* Horizontal Filters */}
        <div className="flex flex-row overflow-x-auto no-scrollbar gap-2 pb-1 flex-nowrap md:flex-wrap">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => handleFilterChange(filter.id)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-all whitespace-nowrap shadow-sm",
                activeFilter === filter.id
                  ? "bg-[var(--color-forest)] border-transparent text-white"
                  : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--color-text-secondary)] hover:bg-[var(--bg-hover)]"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* TIMELINE FEED */}
      <div className="max-w-4xl">
        {loading ? (
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px' }} className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[var(--color-forest)] animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)] italic">Sinkronisasi timeline aktivitas...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }} className="py-16 text-center">
            <div style={{ background: 'var(--bg-hover)' }} className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-semibold">Tidak ada aktivitas ditemukan</p>
            <p className="text-xs text-slate-400 mt-1">Coba sesuaikan filter Anda atau cari kata kunci lain.</p>
          </div>
        ) : (
          <div className="relative pl-6 border-l border-[var(--color-sage-light)]/30 space-y-8 ml-4">
            {Object.entries(groupedEvents).map(([dateLabel, dailyEvents]) => (
              <div key={dateLabel} className="space-y-4">
                {/* Date Header */}
                <div className="sticky top-0 backdrop-blur-md py-1 -ml-10 pl-10 z-10">
                  <span style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)' }} className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                    {dateLabel}
                  </span>
                </div>

                {/* Events list */}
                <div className="space-y-4">
                  {dailyEvents.map((event) => {
                    const config = EVENT_CONFIG[event.type] || EVENT_CONFIG['system'];
                    const EventIcon = config.icon;
                    const eventTime = new Date(event.timestamp).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div key={event.id} className="relative flex gap-4 group">
                        {/* Timeline Connector Indicator Icon */}
                        <div 
                          style={{ border: '4px solid var(--bg-surface)' }}
                          className={cn(
                            "absolute -left-[38px] top-1.5 w-7 h-7 rounded-full flex items-center justify-center z-10 shadow-sm transition-transform duration-300 group-hover:scale-110",
                            config.iconColor
                          )}
                        >
                          <EventIcon className="w-3.5 h-3.5" />
                        </div>

                        {/* Content Card */}
                        <div className={cn(
                          "flex-1 w-full max-w-full overflow-hidden border rounded-2xl px-3 py-4 md:p-5 hover:shadow-md transition-all cursor-pointer",
                          config.color
                        )}>
                          <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-bold text-[var(--color-text-primary)] flex-1 min-w-0">{event.title}</span>
                            <span style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)' }} className="text-xs font-mono text-[var(--color-text-muted)] px-2 py-0.5 rounded shadow-sm flex-shrink-0">
                              {eventTime}
                            </span>
                          </div>
                          
                          <p className="text-sm text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">
                            {event.description}
                          </p>

                          {event.cow_name && (
                            <div className="mt-3 flex items-center gap-2">
                              <span style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)' }} className="px-2.5 py-1 text-[10px] font-bold text-[var(--color-forest)] rounded-lg shadow-sm max-w-full overflow-hidden text-ellipsis whitespace-nowrap block">
                                {event.cow_name} {event.cow_id ? `| ${event.cow_id}` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
