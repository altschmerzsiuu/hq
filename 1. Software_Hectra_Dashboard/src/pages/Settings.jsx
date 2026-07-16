// src/pages/Settings.jsx

import { useState, useEffect } from 'react';
import {
  User,
  Globe,
  Key,
  Users,
  Save,
  Loader2,
  UserPlus,
  Bell,
  Camera,
  LogOut,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import axiosInstance from '@/lib/axios';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';
import regionData from '@/data/indonesia-region.json';



export default function Settings() {
  const { lang, setLang } = useSettingsStore();
  const t = translations[lang];
  const user = useAuthStore(state => state.user);

  const [activeTab, setActiveTab] = useState('profile');
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

  const inputClass = "w-full min-h-[46px] px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009254]/20 focus:border-[#009254] transition-all shadow-sm";
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
      setFullName(user?.full_name || 'Iwan Prianto');
      setEmail(user?.email || 'wan@farm.com');
      setLoginMethod(user?.phone_number ? 'phone' : 'google');
      setPhoneNumber(user?.phone_number || '');
      setCreatedAt(new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'long' }));
      setFarmName('Peternakan DeAraf');
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
      setTeamMembers([
        { id: 1, full_name: 'Iwan Prianto', email: 'wan@farm.com', role: 'owner' },
        { id: 2, full_name: 'Ahmad Sodikin', email: 'sodikin@farm.com', role: 'worker' },
      ]);
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
      setPinError(err.response?.data?.detail || (lang === 'id' ? 'Gagal menyimpan PIN.' : 'Failed to save PIN.'));
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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-[var(--text-1)]">{t.settings_title}</h1>
        <p className="text-[var(--text-2)] mt-1 text-sm">{t.settings_sub}</p>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-[var(--border)] overflow-x-auto pb-0.5 gap-1 scrollbar-none">
        {[
          { id: 'profile', icon: User, label: t.settings_tab_general },
          { id: 'notifications', icon: Bell, label: lang === 'id' ? 'Notifikasi' : 'Notifications' },
          { id: 'security', icon: Key, label: t.settings_tab_security },
          ...((['owner', 'admin'].includes(user?.role))
            ? [{ id: 'team', icon: Users, label: t.settings_tab_team }]
            : []),
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            style={{
              borderColor: activeTab === id ? 'var(--accent)' : 'transparent',
              color: activeTab === id ? 'var(--accent)' : 'var(--text-2)',
            }}
            className="flex items-center gap-2 px-4 md:px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap hover:text-[var(--accent)]"
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="relative mt-6 md:mt-8">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-30 flex items-center justify-center rounded-3xl">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
          </div>
        )}

        <div className="min-h-[300px]">

          {/* ══════════════════════════════════════════════════════════════════
              TAB 1 — GENERAL: Profile + Farm Details
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveGeneral} className="space-y-8 animate-in fade-in duration-300">

              {/* ── Avatar + Name (centered) ── */}
              <div className="flex flex-col items-center gap-3 mb-8">
                <div className="relative w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-black bg-[#009254] cursor-pointer overflow-hidden group shadow-lg ring-4 ring-[#009254]/20">
                  {fullName ? fullName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '--'}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-extrabold" style={{ background: 'linear-gradient(135deg, #009254, #00c47a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {fullName || '—'}
                  </p>
                  <span className="inline-block mt-1 px-3 py-0.5 text-[10px] font-bold rounded-full bg-[#009254]/10 text-[#009254] border border-[#009254]/20 uppercase tracking-widest">
                    {user?.role === 'owner' ? '👑 Pemilik Peternakan' : user?.role === 'admin' ? '🛠️ Admin' : '🐄 Peternak'}
                  </span>
                </div>
              </div>

              <section className="space-y-4">
                <div>
                  <label className={labelClass}>{t.settings_full_name}</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder={lang === 'id' ? 'Nama Lengkap Anda' : 'Your Full Name'} />
                </div>

                {/* Identity login — keyed on loginMethod, NOT phoneNumber, to avoid re-render bug */}
                {loginMethod === 'phone' ? (
                  <div>
                    <label className={labelClass}>{lang === 'id' ? 'NOMOR WHATSAPP' : 'WHATSAPP NUMBER'}</label>
                    <div className={`${inputClass} flex items-center justify-between bg-gray-50 cursor-default`}>
                      <span className="text-gray-700">{phoneNumber || '—'}</span>
                      <button type="button" className="text-[10px] font-bold text-[#009254] hover:text-[#007b46] underline underline-offset-2 shrink-0 ml-3 transition-colors">
                        {lang === 'id' ? 'Ganti Nomor' : 'Change'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>{lang === 'id' ? 'EMAIL' : 'EMAIL'}</label>
                      <div className={`${inputClass} bg-gray-50 cursor-default text-gray-600`}>{email || '—'}</div>
                    </div>
                    <div>
                      <label className={labelClass}>{lang === 'id' ? 'NOMOR HP' : 'PHONE NUMBER'}</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phoneNumber}
                        onChange={e => { const v = e.target.value.replace(/\D/g, ''); setPhoneNumber(v); }}
                        className={inputClass}
                        placeholder="081234567890"
                        maxLength={15}
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* ── Section: Farm Details ── */}
              <div className="mt-8 p-5 md:p-6 rounded-3xl border border-[#009254]/20 bg-[#f2fcf5] relative overflow-hidden">
                <Globe className="absolute -right-4 -bottom-4 w-32 h-32 md:w-40 md:h-40 text-[#009254] opacity-5 pointer-events-none" />
                
                <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-[#009254] mb-6 flex items-center gap-2 relative z-10">
                  <Globe className="w-4 h-4 md:w-5 md:h-5" /> {t.settings_farm_details}
                </h3>

                <div className="space-y-4 relative z-10">
                  {/* Nama Peternakan */}
                  <div>
                    <label className={labelClass}>{t.settings_farm_name}</label>
                    <input type="text" value={farmName} onChange={e => setFarmName(e.target.value)} placeholder={lang === 'id' ? 'Peternakan Jaya Abadi' : 'Jaya Abadi Farm'} className={inputClass} />
                  </div>

                  {/* Provinsi */}
                  <div>
                    <label className={labelClass}>{lang === 'id' ? 'PROVINSI' : 'PROVINCE'}</label>
                    <div className="relative">
                      <select
                        value={selectedProv}
                        onChange={e => { setSelectedProv(e.target.value); setSelectedCity(''); }}
                        className={`${inputClass} appearance-none pr-10`}
                      >
                        <option value="">{lang === 'id' ? 'Pilih Provinsi...' : 'Select Province...'}</option>
                        {regionData.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* Kota / Kabupaten */}
                  <div>
                    <label className={labelClass}>{lang === 'id' ? 'KOTA / KABUPATEN' : 'CITY / REGENCY'}</label>
                    <div className="relative">
                      <select
                        value={selectedCity}
                        onChange={e => setSelectedCity(e.target.value)}
                        disabled={!selectedProv}
                        className={`${inputClass} appearance-none pr-10 disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <option value="">{lang === 'id' ? 'Pilih Kota/Kabupaten...' : 'Select City/Regency...'}</option>
                        {regionData.find(p => p.id === selectedProv)?.cities.map(c => (
                          <option key={c.id} value={c.id}>{c.nama}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Save button (Full width sticky-like at the bottom) */}
              <div className="pt-8">
                <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#009254] hover:bg-[#007b46] text-white rounded-2xl text-sm font-bold shadow-md transition-all active:scale-95">
                  <Save className="w-5 h-5" /> {t.settings_save_changes}
                </button>
              </div>

              {/* Account Created & Danger Zone */}
              <div className="pt-8 mt-8 border-t border-gray-100 text-center space-y-6">
                <p className="text-xs font-bold text-gray-400">
                  {lang === 'id' ? 'Account Created: ' : 'Account Created: '} {createdAt}
                </p>
                
                <div className="flex justify-center items-center gap-8">
                  <button type="button" className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-2 transition-colors">
                    <Trash2 className="w-4 h-4" /> {lang === 'id' ? 'Hapus Akun' : 'Delete Account'}
                  </button>
                  <button type="button" className="text-gray-500 hover:text-gray-800 text-sm font-bold flex items-center gap-2 transition-colors">
                    <LogOut className="w-4 h-4" /> {lang === 'id' ? 'Log Out' : 'Log Out'}
                  </button>
                </div>
              </div>
            </form>
          )}


          {/* ══════════════════════════════════════════════════════════════════
              TAB 2 — NOTIFICATIONS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-1)] font-display border-b border-[var(--border)] pb-2 mb-2">
                  {lang === 'id' ? 'Pengaturan Notifikasi' : 'Notification Settings'}
                </h2>
                <p className="text-xs text-[var(--text-2)]">
                  {lang === 'id' ? 'Kelola bagaimana aplikasi HERD memberitahu Anda.' : 'Manage how the HERD app notifies you.'}
                </p>
              </div>

              {/* Master toggle */}
              <div className="p-5 bg-white border border-gray-200 rounded-3xl shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl shrink-0 ${notifEnabled ? 'bg-[#009254]/10 text-[#009254]' : 'bg-gray-100 text-gray-400'}`}>
                      <Bell className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        {lang === 'id' ? 'Aktifkan Notifikasi' : 'Enable Notifications'}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {lang === 'id'
                          ? 'Dapatkan peringatan penting seperti waktu IB atau ternak sakit.'
                          : 'Get important alerts like insemination time or sick livestock.'}
                      </p>
                    </div>
                  </div>
                  <Toggle checked={notifEnabled} onChange={handleToggleNotif} />
                </div>
              </div>

              {/* Channel toggles */}
              <div className="p-5 bg-white border border-gray-200 rounded-3xl shadow-sm space-y-1">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-4">
                  {lang === 'id' ? 'Kirim Notifikasi Ke' : 'Send Notifications Via'}
                </p>

                {/* WhatsApp */}
                <div className={`flex items-center justify-between py-3 px-1 border-b border-gray-100 transition-opacity ${!notifEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#25D366' }}>
                      {/* WhatsApp icon SVG */}
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.558 4.121 1.535 5.849L.057 23.617a.75.75 0 0 0 .92.92l5.799-1.487A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.956 9.956 0 0 1-5.143-1.427l-.369-.214-3.797.974.997-3.704-.235-.38A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">WhatsApp</p>
                      <p className="text-[10px] text-gray-400">{lang === 'id' ? 'Pesan langsung ke nomor WA' : 'Direct message to WA number'}</p>
                    </div>
                  </div>
                  <Toggle checked={notifChannels.whatsapp} onChange={() => setNotifChannels(p => ({ ...p, whatsapp: !p.whatsapp }))} />
                </div>

                {/* Telegram */}
                <div className={`flex items-center justify-between py-3 px-1 border-b border-gray-100 transition-opacity ${!notifEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#229ED9' }}>
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Telegram</p>
                      <p className="text-[10px] text-gray-400">{lang === 'id' ? 'Notif via bot Telegram HERD' : 'Notifications via HERD Telegram bot'}</p>
                    </div>
                  </div>
                  <Toggle checked={notifChannels.telegram} onChange={() => setNotifChannels(p => ({ ...p, telegram: !p.telegram }))} />
                </div>

                {/* Email */}
                <div className={`flex items-center justify-between py-3 px-1 transition-opacity ${!notifEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#EA4335' }}>
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Email</p>
                      <p className="text-[10px] text-gray-400">{lang === 'id' ? 'Ringkasan ke inbox email kamu' : 'Summary to your email inbox'}</p>
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
            <div className="flex flex-col items-center justify-start min-h-[400px] py-4 animate-in fade-in duration-300">

              <div className="w-full max-w-lg bg-white border border-gray-200 p-6 md:p-8 rounded-3xl shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-5">
                  <h2 className="text-lg font-bold text-gray-900 font-display flex items-center gap-2">
                    <Key className="w-5 h-5 text-[#009254]" />
                    {lang === 'id' ? 'Ubah PIN Login' : 'Change Login PIN'}
                  </h2>
                  <span
                    className="text-[10px] font-bold px-3 py-1.5 rounded-full border"
                    style={userHasPin
                      ? { background: 'rgba(0,146,84,0.1)', color: '#009254', borderColor: 'rgba(0,146,84,0.2)' }
                      : { background: 'rgba(255,91,91,0.08)', color: '#ff5b5b', borderColor: 'rgba(255,91,91,0.25)' }
                    }
                  >
                    {userHasPin
                      ? (lang === 'id' ? 'PIN Aktif' : 'PIN Active')
                      : (lang === 'id' ? 'Belum Ada PIN' : 'No PIN Set')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                  {lang === 'id'
                    ? 'Gunakan 6-digit PIN untuk login cepat dari perangkat terpercaya. PIN menggantikan password.'
                    : 'Use a 6-digit PIN for quick login from trusted devices. PIN replaces your password.'}
                </p>
                <form onSubmit={handleSavePIN} className="space-y-5">
                  {pinError && (
                    <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                      {pinError}
                    </div>
                  )}
                  <div className="space-y-4">
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
                  </div>
                  <div className="flex justify-center pt-2">
                    <button
                      type="submit"
                      disabled={pinLoading || pinNewDigits.length !== 6 || pinConfirmDigits.length !== 6}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#009254] hover:bg-[#007b46] text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {pinLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> {lang === 'id' ? 'Menyimpan...' : 'Saving...'}</>
                        : <><Save className="w-4 h-4" /> {lang === 'id' ? 'Simpan PIN Baru' : 'Save New PIN'}</>}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-relaxed text-center mt-4">
                    💡 {lang === 'id'
                      ? 'Hanya berlaku di perangkat terpercaya. Login PIN lebih cepat daripada ketik password tiap saat.'
                      : 'Only works on trusted devices. PIN login is faster than typing your password every time.'}
                  </p>
                </form>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 4 — TEAM MANAGEMENT
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'team' && (
            <div className="space-y-6 animate-in fade-in duration-300">
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

        </div>
      </div>
    </div>
  );
}