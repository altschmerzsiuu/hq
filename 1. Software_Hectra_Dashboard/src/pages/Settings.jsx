// src/pages/Settings.jsx

import { useState, useEffect } from 'react';
import { LogOut, User, Bell, Key, Users, Settings as SettingsIcon, Trash2, Camera, ChevronLeft, ChevronDown, Monitor, HelpCircle, Globe, Sun, Moon, Send, Save, Loader2, UserPlus } from 'lucide-react';
import { FAQ } from '@/components/shared/FAQ';
import FeedbackModal from '@/components/shared/FeedbackModal';
import ContactView from '@/components/shared/ContactView';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { toast } from '@/store/toastStore';
import { handleError } from '@/lib/errorHandler';
import axiosInstance from '@/lib/axios';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';
import regionData from '@/data/indonesia-region.json';
import { useAuthStore } from '@/store/authStore';



export default function Settings() {
  const { lang, setLang } = useSettingsStore();
  const t = translations[lang];
  const user = useAuthStore(state => state.user);

  const [activeTab, setActiveTab] = useState('main');
  const [loading, setLoading] = useState(false);

  // Tab 1: Profile
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  // loginMethod: 'phone' = login via WA OTP, 'google' = login via Google
  // Determined from API response, NOT from phoneNumber state (to avoid the re-render bug)
  const [loginMethod, setLoginMethod] = useState('phone');
  const [createdAt, setCreatedAt] = useState('--');

  // Tab 1: Farm Details
  const [farmName, setFarmName] = useState('');
  const [selectedProv, setSelectedProv] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Tab 2: Notifications — master toggle + channel toggles (local state / mock)
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifChannels, setNotifChannels] = useState({ whatsapp: true, telegram: false, email: false });

  // Help Centre States
  const [helpView, setHelpView] = useState('menu'); // 'menu' | 'faq' | 'contact'
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Tab 3: Security -- PIN
  const [pinNewDigits, setPinNewDigits] = useState('');
  const [pinConfirmDigits, setPinConfirmDigits] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [userHasPin, setUserHasPin] = useState(user?.has_pin ?? false);

  // Tab 4: Team
  const [teamMembers, setTeamMembers] = useState([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('worker');
  const [teamLoading, setTeamLoading] = useState(false);

  const inputClass = "w-full min-h-[46px] px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2f7d31]/20 focus:border-[#2f7d31] transition-all shadow-sm";
  const labelClass = "block text-[11px] font-black text-gray-500 mb-2 uppercase tracking-wider";


  // ─── Load profile on mount ────────────────────────────────────────────────────
  useEffect(() => {
    loadProfileAndSettings();
  }, [lang]);

  const loadProfileAndSettings = async () => {
    setLoading(true);
    let profileLoaded = false;

    // 1. Fetch Primary Profile Info
    try {
      const response = await axiosInstance.get('/profile');
      const data = response.data;
      if (data) {
        const u = data.user || {};
        setFullName(u.full_name || '');
        setEmail(u.email || '');
        setPhoneNumber(u.phone_number || '');
        // Determine login method from API: if user has a phone_number, they logged in via WA OTP
        setLoginMethod(u.phone_number ? 'phone' : 'google');
        setCreatedAt(u.created_at ? new Date(u.created_at).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'long' }) : '--');

        const f = data.farm || {};
        setFarmName(f.farm_name || '');
        if (f.province_id) setSelectedProv(f.province_id);
        if (f.city_id) setSelectedCity(f.city_id);
        if (f.kecamatan) setKecamatan(f.kecamatan);
        profileLoaded = true;
      }
    } catch (err) {
      console.warn('Profile fetch failed, loading offline defaults', err);
      setFullName(user?.full_name || '');
      setEmail(user?.email || '');
      setLoginMethod(user?.phone_number ? 'phone' : 'google');
      setPhoneNumber(user?.phone_number || '');
      setCreatedAt(new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'long' }));
      setFarmName('');
    }

    // 2. Load Team Members (Owners/Admins only)
    try {
      if (['owner', 'admin'].includes(user?.role)) {
        await loadTeamMembers();
      }
    } catch (err) {
      console.warn('Team members fetch failed', err);
    }

    setLoading(false);
  };

  const loadTeamMembers = async () => {
    setTeamLoading(true);
    try {
      const response = await axiosInstance.get('/admin/users');
      setTeamMembers(response.data || []);
    } catch {
      setTeamMembers([]);
    } finally {
      setTeamLoading(false);
    }
  };

  // ─── Save handlers ────────────────────────────────────────────────────────────

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await Promise.all([
        axiosInstance.put('/profile', { full_name: fullName, email, phone_number: phoneNumber }),
        axiosInstance.put('/profile/farm', {
          farm_name: farmName,
          province_id: selectedProv || null,
          city_id: selectedCity || null,
        }),
      ]);
      toast.success(lang === 'id' ? 'Profil & Detail Peternakan berhasil diperbarui!' : 'Profile & Farm Details successfully updated!');
      loadProfileAndSettings();
    } catch {
      toast.error(lang === 'id' ? 'Gagal memperbarui profil atau detail peternakan.' : 'Failed to update profile or farm details.');
    } finally {
      setLoading(false);
    }
  };

  // --- Notification Toggle (local mock) ---
  const handleToggleNotif = () => {
    setNotifEnabled(prev => !prev);
    toast.success(lang === 'id' ? 'Preferensi notifikasi diperbarui!' : 'Notification preference updated!');
  };

  const handleSavePIN = async (e) => {
    e.preventDefault();
    setPinError('');
    if (!/^\d{6}$/.test(pinNewDigits)) {
      setPinError(lang === 'id' ? 'PIN harus tepat 6 digit angka.' : 'PIN must be exactly 6 digits.');
      return;
    }
    if (pinNewDigits !== pinConfirmDigits) {
      setPinError(lang === 'id' ? 'Konfirmasi PIN tidak cocok.' : 'PIN entries do not match.');
      return;
    }
    setPinLoading(true);
    try {
      await axiosInstance.post('/auth/pin/set', { pin: pinNewDigits });
      setUserHasPin(true);
      setPinNewDigits('');
      setPinConfirmDigits('');

      // Save user ID + name to localStorage so PIN screen appears on next login
      const { user: authUser, registerDevice } = useAuthStore.getState();
      if (authUser?.id) {
        localStorage.setItem('herd_user_id', String(authUser.id));
        localStorage.setItem('herd_user_name', authUser.full_name || authUser.name || '');
      }
      // Ensure this device is registered as trusted
      await registerDevice();

      toast.success(lang === 'id' ? 'PIN berhasil diperbarui! Login berikutnya pakai PIN.' : 'PIN updated! Next login will use your PIN.');
    } catch (err) {
      handleError(err, 'simpan PIN baru');
    } finally {
      setPinLoading(false);
    }
  };

  const handleInviteTeam = async (e) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return;
    setTeamLoading(true);
    try {
      await axiosInstance.post('/admin/users/invite', {
        email: inviteEmail, full_name: inviteName, role: inviteRole,
      });
      toast.success(lang === 'id' ? `Undangan dikirim ke ${inviteEmail}!` : `Invitation sent to ${inviteEmail}!`);
      setInviteName(''); setInviteEmail('');
      loadTeamMembers();
    } catch {
      toast.error(lang === 'id' ? 'Gagal mengundang anggota tim.' : 'Failed to invite team member.');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleUpdateRole = async (memberId, newRole) => {
    setTeamLoading(true);
    try {
      await axiosInstance.put(`/admin/users/${memberId}/role`, { role: newRole });
      toast.success(lang === 'id' ? 'Role berhasil diperbarui!' : 'Role updated successfully!');
      loadTeamMembers();
    } catch {
      toast.error(lang === 'id' ? 'Gagal memperbarui role.' : 'Failed to update role.');
      setTeamLoading(false);
    }
  };

  // ─── Reusable Toggle component ────────────────────────────────────────────────
  const Toggle = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]" />
    </label>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">

      {/* No more standard header or tabs */}

      {/* Content Area */}
      <div className="relative mt-2">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-30 flex items-center justify-center rounded-3xl">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
          </div>
        )}

        <div className="min-h-[300px]">

          {/* ══════════════════════════════════════════════════════════════════
              MAIN MENU (WhatsApp Style)
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'main' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* ── Avatar + Name (centered) ── */}
              <div className="flex flex-col items-center gap-2 pt-2">
                <div className="relative w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-black bg-[#2f7d31] overflow-hidden shadow-md ring-2 ring-[#2f7d31]/20">
                  {fullName ? fullName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '--'}
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-extrabold" style={{ background: 'linear-gradient(135deg, #2f7d31, #43a047)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {fullName || (lang === 'id' ? 'Tanpa Nama' : 'Unnamed')}
                  </h2>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-[#2f7d31]/10 rounded-full border border-[#2f7d31]/20">
                    <span className="text-[10px] font-black tracking-wider text-[#2f7d31] uppercase">
                      {user?.role === 'owner' ? t.settings_role_owner : user?.role === 'admin' ? t.settings_role_admin : t.settings_role_worker}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Menu List ── */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mt-4">
                
                <button onClick={() => setActiveTab('profile')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 text-[#2f7d31] rounded-lg"><User size={18} /></div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">{t.settings_tab_general || 'General'}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{lang === 'id' ? 'Detail profil & peternakan' : 'Profile & farm details'}</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                </button>

                <button onClick={() => setActiveTab('notifications')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Bell size={18} /></div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">{lang === 'id' ? 'Notifikasi' : 'Notifications'}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{lang === 'id' ? 'Pengaturan pesan WA/Telegram' : 'WA/Telegram message settings'}</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                </button>

                <button onClick={() => setActiveTab('security')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Key size={18} /></div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">{t.settings_tab_security || 'Security'}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{lang === 'id' ? 'Ubah PIN login perangkat' : 'Change device login PIN'}</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                </button>

                {['owner', 'admin'].includes(user?.role) && (
                  <button onClick={() => setActiveTab('team')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 active:scale-[0.99]">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Users size={18} /></div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-900">{t.settings_tab_team || 'Team'}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{lang === 'id' ? 'Manajemen pekerja & admin' : 'Manage workers & admins'}</p>
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                  </button>
                )}

                <button onClick={() => setActiveTab('appearance')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Monitor size={18} /></div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">{lang === 'id' ? 'Tampilan' : 'Appearance'}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{lang === 'id' ? 'Tema & Bahasa' : 'Theme & Language'}</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                </button>

                <button onClick={() => setActiveTab('help')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-50 text-teal-600 rounded-lg"><HelpCircle size={18} /></div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">{lang === 'id' ? 'Pusat Bantuan' : 'Help Centre'}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{lang === 'id' ? 'FAQ & Kirim Masukan' : 'FAQ & Feedback'}</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                </button>
              </div>

              {/* Account Created & Danger Zone */}
              <div className="pt-2 text-center space-y-4">
                <p className="text-[11px] font-bold text-gray-400">
                  {lang === 'id' ? 'Akun Dibuat: ' : 'Account Created: '} {createdAt}
                </p>
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <button type="button" className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-50 transition-colors border-b border-gray-100 text-red-600">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></div>
                      <span className="text-sm font-bold">{lang === 'id' ? 'Hapus Akun' : 'Delete Account'}</span>
                    </div>
                  </button>
                  <button type="button" onClick={() => useAuthStore.getState().logout()} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-50 rounded-lg"><LogOut className="w-4 h-4" /></div>
                      <span className="text-sm font-bold">{lang === 'id' ? 'Log Out' : 'Log Out'}</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 1 — GENERAL: Profile + Farm Details
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveGeneral} className="space-y-4 animate-in fade-in duration-300">
              
              {/* Header: Back Button & Title & Save Button */}
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => setActiveTab('main')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">{t.settings_tab_general || 'Profile'}</h2>
                <button type="submit" disabled={loading} className="text-xs font-bold text-[#2f7d31] bg-[#2f7d31]/10 border border-[#2f7d31]/20 backdrop-blur-md px-5 py-2 rounded-full shadow-sm hover:bg-[#2f7d31]/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? (lang === 'id' ? 'Menyimpan...' : 'Saving...') : (lang === 'id' ? 'Simpan' : 'Save')}
                </button>
              </div>

              {/* Avatar section */}
              <div className="flex flex-col items-center gap-2 mb-4">
                <div className="relative w-28 h-28 rounded-full flex items-center justify-center text-white text-4xl font-black bg-[#2f7d31] cursor-pointer overflow-hidden group shadow-lg ring-4 ring-[#2f7d31]/20">
                  {fullName ? fullName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '--'}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-7 h-7 text-white" />
                  </div>
                </div>
                <button type="button" className="text-[#2f7d31] text-sm font-bold mt-1 hover:underline">
                  {lang === 'id' ? 'Edit' : 'Edit'}
                </button>
              </div>

              {/* Personal Info Container */}
              <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm relative mt-2">
                <div className="px-5 pt-5 pb-2 border-b border-gray-100 flex items-center gap-2 relative z-10">
                  <User className="w-4 h-4 md:w-5 md:h-5 text-[#2f7d31]" />
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-[#2f7d31]">
                    {lang === 'id' ? 'INFORMASI PERSONAL' : 'PERSONAL INFORMATION'}
                  </h3>
                </div>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 transition-colors focus-within:bg-gray-50">
                  <label className="text-sm font-bold text-gray-900 w-1/3 shrink-0">{t.settings_full_name || 'Name'}</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-transparent text-sm font-medium text-gray-600 text-right outline-none placeholder-gray-400" placeholder={lang === 'id' ? 'Nama Lengkap Anda' : 'Your Full Name'} />
                </div>

                {/* Identity login */}
                {loginMethod === 'phone' ? (
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                    <label className="text-sm font-bold text-gray-900 w-1/3 shrink-0">{lang === 'id' ? 'No. WhatsApp' : 'WhatsApp No.'}</label>
                    <div className="flex items-center justify-end w-full gap-2">
                      <span className="text-sm font-medium text-gray-500">{phoneNumber || '—'}</span>
                      <button type="button" className="text-[10px] font-bold text-[#2f7d31] hover:text-[#007b46] underline underline-offset-2 ml-2 transition-colors">
                        {lang === 'id' ? 'Ganti' : 'Change'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                      <label className="text-sm font-bold text-gray-900 w-1/3 shrink-0">Email</label>
                      <span className="text-sm font-medium text-gray-500 truncate text-right w-full">{email || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 transition-colors focus-within:bg-gray-50">
                      <label className="text-sm font-bold text-gray-900 w-1/3 shrink-0">{lang === 'id' ? 'Nomor HP' : 'Phone Number'}</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phoneNumber}
                        onChange={e => { const v = e.target.value.replace(/\D/g, ''); setPhoneNumber(v); }}
                        className="w-full bg-transparent text-sm font-medium text-gray-600 text-right outline-none placeholder-gray-400"
                        placeholder="081234567890"
                        maxLength={15}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* ── Section: Farm Details ── */}
              {/* ── Section: Farm Details ── */}
              <div className="bg-white border border-gray-200 rounded-3xl shadow-sm relative overflow-hidden mt-6">
                <Globe className="absolute -right-4 -bottom-4 w-32 h-32 md:w-40 md:h-40 text-[#2f7d31] opacity-5 pointer-events-none" />
                
                <div className="px-5 pt-5 pb-2 border-b border-gray-100 flex items-center gap-2 relative z-10">
                  <Globe className="w-4 h-4 md:w-5 md:h-5 text-[#2f7d31]" />
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-[#2f7d31]">
                    {t.settings_farm_details}
                  </h3>
                </div>

                <div className="relative z-10">
                  {/* Nama Peternakan */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 transition-colors focus-within:bg-gray-50">
                    <label className="text-sm font-bold text-gray-900 w-1/3 shrink-0">{t.settings_farm_name || 'Farm Name'}</label>
                    <input type="text" value={farmName} onChange={e => setFarmName(e.target.value)} className="w-full bg-transparent text-sm font-medium text-gray-600 text-right outline-none placeholder-gray-400" placeholder={lang === 'id' ? 'Peternakan Jaya Abadi' : 'Jaya Abadi Farm'} />
                  </div>

                  {/* Provinsi */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 transition-colors focus-within:bg-gray-50 relative">
                    <label className="text-sm font-bold text-gray-900 w-1/3 shrink-0">{lang === 'id' ? 'Provinsi' : 'Province'}</label>
                    <div className="w-full relative flex items-center justify-end">
                      <select
                        value={selectedProv}
                        onChange={e => { setSelectedProv(e.target.value); setSelectedCity(''); }}
                        className="w-full bg-transparent text-sm font-medium text-gray-600 text-right appearance-none outline-none pr-6 cursor-pointer"
                        dir="rtl"
                      >
                        <option value="">{lang === 'id' ? 'Pilih...' : 'Select...'}</option>
                        {regionData.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                      </select>
                      <ChevronDown className="absolute right-0 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Kota / Kabupaten */}
                  <div className="flex items-center justify-between px-5 py-4 transition-colors focus-within:bg-gray-50 relative">
                    <label className="text-sm font-bold text-gray-900 w-1/3 shrink-0">{lang === 'id' ? 'Kota/Kabupaten' : 'City/Regency'}</label>
                    <div className="w-full relative flex items-center justify-end">
                      <select
                        value={selectedCity}
                        onChange={e => setSelectedCity(e.target.value)}
                        disabled={!selectedProv}
                        className="w-full bg-transparent text-sm font-medium text-gray-600 text-right appearance-none outline-none pr-6 cursor-pointer disabled:opacity-50"
                        dir="rtl"
                      >
                        <option value="">{lang === 'id' ? 'Pilih...' : 'Select...'}</option>
                        {regionData.find(p => p.id === selectedProv)?.cities.map(c => (
                          <option key={c.id} value={c.id}>{c.nama}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-0 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Save button moved to header */}

              {/* End of General Content */}
            </form>
          )}


          {/* ══════════════════════════════════════════════════════════════════
              TAB 2 — NOTIFICATIONS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center relative mb-4">
                <button type="button" onClick={() => setActiveTab('main')} className="absolute left-0 p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <h2 className="w-full text-center text-lg font-bold text-gray-900">{lang === 'id' ? 'Notifikasi' : 'Notifications'}</h2>
              </div>

              {/* Master toggle */}
              <div className="p-4 bg-white border border-gray-200 rounded-3xl shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-2xl shrink-0 ${notifEnabled ? 'bg-[#2f7d31]/10 text-[#2f7d31]' : 'bg-gray-100 text-gray-400'}`}>
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        {lang === 'id' ? 'Aktifkan Notifikasi' : 'Enable Notifications'}
                      </h3>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                        {lang === 'id' ? 'Dapatkan peringatan penting' : 'Get important alerts'}
                      </p>
                    </div>
                  </div>
                  <Toggle checked={notifEnabled} onChange={handleToggleNotif} />
                </div>
              </div>

              {/* Channel toggles */}
              <div className="p-4 bg-white border border-gray-200 rounded-3xl shadow-sm space-y-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">
                  {lang === 'id' ? 'Kirim Ke' : 'Send Via'}
                </p>

                {/* WhatsApp */}
                <div className={`flex items-center justify-between py-2.5 px-1 border-b border-gray-100 transition-opacity ${!notifEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#25D366' }}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.558 4.121 1.535 5.849L.057 23.617a.75.75 0 0 0 .92.92l5.799-1.487A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.956 9.956 0 0 1-5.143-1.427l-.369-.214-3.797.974.997-3.704-.235-.38A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">WhatsApp</p>
                    </div>
                  </div>
                  <Toggle checked={notifChannels.whatsapp} onChange={() => setNotifChannels(p => ({ ...p, whatsapp: !p.whatsapp }))} />
                </div>

                {/* Telegram */}
                <div className={`flex items-center justify-between py-2.5 px-1 border-b border-gray-100 transition-opacity ${!notifEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#229ED9' }}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Telegram</p>
                    </div>
                  </div>
                  <Toggle checked={notifChannels.telegram} onChange={() => setNotifChannels(p => ({ ...p, telegram: !p.telegram }))} />
                </div>

                {/* Email */}
                <div className={`flex items-center justify-between py-2.5 px-1 transition-opacity ${!notifEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#EA4335' }}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Email</p>
                    </div>
                  </div>
                  <Toggle checked={notifChannels.email} onChange={() => setNotifChannels(p => ({ ...p, email: !p.email }))} />
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3 — SECURITY
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'security' && (
            <div className="flex flex-col items-center justify-start min-h-[400px] animate-in fade-in duration-300">
              <div className="w-full max-w-lg mb-4 flex items-center justify-between">
                <button type="button" onClick={() => setActiveTab('main')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">{t.settings_tab_security || 'Security'}</h2>
                <button type="submit" form="pin-form" disabled={pinLoading || pinNewDigits.length !== 6 || pinConfirmDigits.length !== 6} className="text-xs font-bold text-[#2f7d31] bg-[#2f7d31]/10 border border-[#2f7d31]/20 backdrop-blur-md px-5 py-2 rounded-full shadow-sm hover:bg-[#2f7d31]/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {pinLoading ? (lang === 'id' ? 'Menyimpan...' : 'Saving...') : (lang === 'id' ? 'Simpan' : 'Save')}
                </button>
              </div>
              <div className="w-full max-w-lg bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <h2 className="text-lg font-bold text-gray-900 font-display flex items-center gap-2">
                    <Key className="w-5 h-5 text-[#2f7d31]" />
                    {lang === 'id' ? 'Ubah PIN Login' : 'Change Login PIN'}
                  </h2>
                </div>
                <form id="pin-form" onSubmit={handleSavePIN} className="space-y-4">
                  {pinError && (
                    <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                      {pinError}
                    </div>
                  )}
                  <div>
                      <label className={labelClass}>{lang === 'id' ? 'PIN Baru (6 digit)' : 'New PIN (6 digits)'}</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={pinNewDigits}
                        onChange={e => { if (/^\d*$/.test(e.target.value) && e.target.value.length <= 6) { setPinNewDigits(e.target.value); setPinError(''); } }}
                        placeholder="••••••"
                        className={`${inputClass} font-mono tracking-[0.5em] text-center`}
                      />
                  </div>
                  <div>
                      <label className={labelClass}>{lang === 'id' ? 'Konfirmasi PIN Baru' : 'Confirm New PIN'}</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={pinConfirmDigits}
                        onChange={e => { if (/^\d*$/.test(e.target.value) && e.target.value.length <= 6) { setPinConfirmDigits(e.target.value); setPinError(''); } }}
                        placeholder="••••••"
                        className={`${inputClass} font-mono tracking-[0.5em] text-center`}
                      />
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 4 — TEAM MANAGEMENT
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'team' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center relative mb-4">
                <button type="button" onClick={() => setActiveTab('main')} className="absolute left-0 p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <h2 className="w-full text-center text-lg font-bold text-gray-900">{t.settings_tab_team || 'Team'}</h2>
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-1)] font-display border-b border-[var(--border)] pb-2 mb-2">{t.settings_team_title}</h2>
                <p className="text-xs text-[var(--text-2)]">{t.settings_team_desc}</p>
              </div>

              <form onSubmit={handleInviteTeam} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-1)] flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-[var(--accent)]" /> {t.settings_invite_title}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder={lang === 'id' ? 'Nama Lengkap' : 'Full Name'} required className={inputClass} />
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder={lang === 'id' ? 'Alamat Email' : 'Email Address'} required className={inputClass} />
                  <div className="flex gap-2">
                    <div>
                      <label className={labelClass}>{lang === 'id' ? 'PERAN' : 'ROLE'}</label>
                      <div className="relative">
                        <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className={`${inputClass} appearance-none pr-10`}>
                          <option value="worker">{lang === 'id' ? 'Pekerja Kandang (Worker)' : 'Farm Worker'}</option>
                          <option value="admin">{lang === 'id' ? 'Admin / Manajer' : 'Admin / Manager'}</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                      </div>
                    </div>
                    <button type="submit" disabled={teamLoading} className="px-4 bg-[var(--accent)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center shrink-0">
                      {t.settings_invite_send}
                    </button>
                  </div>
                </div>
              </form>

              <div className="overflow-x-auto border border-[var(--border)] rounded-2xl bg-[var(--bg-card)]">
                {teamLoading ? (
                  <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" /></div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-slate-50 dark:bg-slate-900/60 text-[9px] font-black uppercase text-[var(--text-3)] tracking-wider">
                        <th className="px-4 py-3">{t.settings_table_name}</th>
                        <th className="px-4 py-3">{t.settings_table_email}</th>
                        <th className="px-4 py-3 text-right">{t.settings_table_role}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] text-xs font-semibold text-[var(--text-2)]">
                      {teamMembers.map(m => (
                        <tr key={m.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                          <td className="px-4 py-3.5 font-bold text-[var(--text-1)]">{m.full_name || (lang === 'id' ? 'Tanpa Nama' : 'Unnamed')}</td>
                          <td className="px-4 py-3.5 font-mono text-[var(--text-3)]">{m.email}</td>
                          <td className="px-4 py-3.5 text-right">
                            {m.role === 'owner'
                              ? <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full font-bold text-[9px]">{t.settings_role_owner}</span>
                              : <select value={m.role} onChange={e => handleUpdateRole(m.id, e.target.value)} className="bg-transparent font-bold text-[var(--accent)] border-none outline-none text-xs text-right cursor-pointer">
                                <option value="worker">{t.settings_role_worker}</option>
                                <option value="admin">{t.settings_role_admin}</option>
                              </select>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 5 — APPEARANCE
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'appearance' && (
            <div className="flex flex-col items-center justify-start min-h-[400px] animate-in fade-in duration-300">
              <div className="w-full max-w-lg mb-4 relative flex items-center">
                <button type="button" onClick={() => setActiveTab('main')} className="absolute left-0 p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <h2 className="w-full text-center text-lg font-bold text-gray-900">{lang === 'id' ? 'Tampilan' : 'Appearance'}</h2>
              </div>
              <div className="w-full max-w-lg bg-white border border-gray-200 p-6 rounded-3xl shadow-sm space-y-6">
                
                {/* Theme Setting */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-4">{lang === 'id' ? 'Tema Aplikasi' : 'App Theme'}</h3>
                  <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Monitor size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{lang === 'id' ? 'Mode Gelap' : 'Dark Mode'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{lang === 'id' ? 'Pilih mode tampilan' : 'Choose display mode'}</p>
                      </div>
                    </div>
                    <ThemeToggle />
                  </div>
                </div>

                {/* Language Setting */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-4">{lang === 'id' ? 'Bahasa' : 'Language'}</h3>
                  <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Globe size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{lang === 'id' ? 'Bahasa Aplikasi' : 'App Language'}</p>
                      </div>
                    </div>
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value)}
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--text-1)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        outline: 'none',
                        padding: '8px 14px 8px 14px',
                        appearance: 'none',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                      }}
                      className="hover:border-[var(--accent)]"
                    >
                      <option value="id">🇮🇩 Indonesia</option>
                      <option value="en">🇬🇧 English</option>
                    </select>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 6 — HELP CENTRE
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'help' && (
            <div className="flex flex-col items-center justify-start min-h-[400px] animate-in fade-in duration-300">
              <div className="w-full max-w-3xl mb-4 relative flex items-center">
                <button type="button" onClick={() => {
                  if (helpView !== 'menu') setHelpView('menu');
                  else setActiveTab('main');
                }} className="absolute left-0 p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors z-10">
                  <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <h2 className="w-full text-center text-lg font-bold text-gray-900">
                  {helpView === 'menu' ? (lang === 'id' ? 'Pusat Bantuan' : 'Help Centre') : ''}
                  {helpView === 'faq' ? (lang === 'id' ? 'Pertanyaan Umum' : 'FAQ') : ''}
                  {helpView === 'contact' ? (lang === 'id' ? 'Hubungi Kami' : 'Contact Us') : ''}
                </h2>
              </div>
              <div className="w-full max-w-3xl">
                
                {/* 1. Main Help View */}
                {helpView === 'menu' && (
                  <div className="animate-in slide-in-from-left-4 duration-300">
                    <ContactView lang={lang} />

                    <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
                      <button onClick={() => setHelpView('faq')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 active:scale-[0.99]">
                        <div className="text-left">
                          <p className="text-base font-bold text-gray-900">{lang === 'id' ? 'Pusat Bantuan' : 'Help Centre'}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{lang === 'id' ? 'Pertanyaan yang sering diajukan' : 'Frequently asked questions'}</p>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                      </button>

                      <button onClick={() => setIsFeedbackModalOpen(true)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors active:scale-[0.99]">
                        <div className="text-left">
                          <p className="text-base font-bold text-gray-900">{lang === 'id' ? 'Kirim Masukan' : 'Send feedback'}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{lang === 'id' ? 'Laporkan masalah teknis' : 'Report technical issues'}</p>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. FAQ View */}
                {helpView === 'faq' && (
                  <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden animate-in slide-in-from-right-4 duration-300">
                    <FAQ 
                      title={lang === 'id' ? 'Pertanyaan Umum' : 'FAQs'}
                      subtitle={lang === 'id' ? 'Pusat Bantuan' : 'Help Centre'}
                      categories={{
                        general: lang === 'id' ? 'Umum' : 'General',
                        account: lang === 'id' ? 'Akun' : 'Account',
                        reproduction: lang === 'id' ? 'Reproduksi' : 'Reproduction'
                      }}
                      faqData={{
                        general: [
                          { question: lang === 'id' ? 'Apa itu aplikasi HERD?' : 'What is HERD app?', answer: lang === 'id' ? 'HERD adalah aplikasi cerdas untuk manajemen peternakan sapi dengan fitur prediksi estrus AI.' : 'HERD is a smart application for cattle farm management with AI estrus prediction.' },
                          { question: lang === 'id' ? 'Bagaimana cara menghubungi support?' : 'How to contact support?', answer: lang === 'id' ? 'Anda dapat menghubungi melalui menu Kirim Masukan atau icon sosial media di bawah.' : 'You can contact via Send Feedback or social media icons below.' }
                        ],
                        account: [
                          { question: lang === 'id' ? 'Bagaimana mengubah PIN?' : 'How to change PIN?', answer: lang === 'id' ? 'Pergi ke tab Keamanan di menu pengaturan untuk mengubah PIN Anda.' : 'Go to Security tab in settings to change your PIN.' }
                        ],
                        reproduction: [
                          { question: lang === 'id' ? 'Kapan saya harus mencatat IB?' : 'When to record IB?', answer: lang === 'id' ? 'Gunakan fitur Catat IB segera setelah proses inseminasi buatan selesai.' : 'Use Record IB feature right after the artificial insemination is done.' }
                        ]
                      }}
                    />
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>
      
      <FeedbackModal 
        isOpen={isFeedbackModalOpen} 
        onClose={() => setIsFeedbackModalOpen(false)} 
        lang={lang} 
      />
    </div>
  );
}