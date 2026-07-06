// src/pages/Settings.jsx

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  User,
  Globe,
  Send,
  Key,
  Users,
  Save,
  Loader2,
  Eye,
  EyeOff,
  UserPlus,
  MapPin,
  Search,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import axiosInstance from '@/lib/axios';
import regionData from '@/data/indonesia-region.json';
import useSettingsStore from '@/store/settingsStore';
import translations from '@/lib/i18n';

const loadLeafletAssets = () => {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    let link = document.querySelector('link[href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    let script = document.querySelector('script[src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        if (window.L) {
          resolve(window.L);
        } else {
          reject(new Error('Leaflet global object L not found'));
        }
      };
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    } else {
      const check = setInterval(() => {
        if (window.L) {
          clearInterval(check);
          resolve(window.L);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        if (!window.L) reject(new Error('Timeout loading Leaflet'));
      }, 10000);
    }
  });
};

export default function Settings() {
  const { lang, setLang } = useSettingsStore();
  const t = translations[lang];
  const user = useAuthStore(state => state.user);

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);

  // Tab 1: Profile
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [createdAt, setCreatedAt] = useState('--');
  const [lastLogin, setLastLogin] = useState('--');

  // Tab 1: Farm Details
  const [farmName, setFarmName] = useState('');
  const [farmType, setFarmType] = useState('dairy');
  const [totalCapacity, setTotalCapacity] = useState('');
  const [currentCattleCount, setCurrentCattleCount] = useState(0);

  // Address fields — all separate, combined on save
  const [selectedProv, setSelectedProv] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedPostal, setSelectedPostal] = useState('');
  const [streetAddress, setStreetAddress] = useState('');

  // Coordinates
  const [latitude, setLatitude] = useState(-2.5);
  const [longitude, setLongitude] = useState(118.0);

  // Geocoding search state
  const [geoSearching, setGeoSearching] = useState(false);

  // Tab 2: Telegram
  const [telegramChatId, setTelegramChatId] = useState('');
  const [showChatId, setShowChatId] = useState(false);
  const [tgSavedBadge, setTgSavedBadge] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [notifEstrus, setNotifEstrus] = useState(false);
  const [notifAnomaly, setNotifAnomaly] = useState(false);
  const [notifDaily, setNotifDaily] = useState(false);
  const [notifBreeding, setNotifBreeding] = useState(false);

  // Tab 3: Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  const inputClass = "w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text-1)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all shadow-sm";
  const labelClass = "block text-xs font-bold text-[var(--text-2)] mb-1.5 uppercase tracking-wider";

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // ─── Derived helpers ─────────────────────────────────────────────────────────

  const currentProv = regionData.find(p => p.id === selectedProv);
  const currentCity = currentProv?.cities.find(c => c.id === selectedCity);

  /** Build a human-readable address string from current dropdown + street state */
  const buildAddressString = useCallback(() => {
    const parts = [
      streetAddress,
      currentCity?.nama,
      currentProv?.nama,
      selectedPostal,
      'Indonesia',
    ].filter(Boolean);
    return parts.join(', ');
  }, [streetAddress, currentCity, currentProv, selectedPostal]);

  // ─── Telegram guide auto-close ────────────────────────────────────────────────
  useEffect(() => {
    let timer;
    if (showGuide) timer = setTimeout(() => setShowGuide(false), 30000);
    return () => clearTimeout(timer);
  }, [showGuide]);

  // ─── Map init (only when activeTab === 'profile') ─────────────────────────────
  useEffect(() => {
    if (activeTab !== 'profile') {
      // Destroy map when leaving tab so it re-inits cleanly on return
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const initMap = async () => {
      try {
        await loadLeafletAssets();
        if (!isMounted || !mapContainerRef.current) return;
        if (mapRef.current) return; // already inited

        const isDark = document.documentElement.classList.contains('dark');
        const tileUrl = isDark
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

        const map = window.L.map(mapContainerRef.current).setView([latitude, longitude], 13);
        window.L.tileLayer(tileUrl, { attribution: '© OpenStreetMap contributors' }).addTo(map);

        const marker = window.L.marker([latitude, longitude], { draggable: true }).addTo(map);

        // ✅ Drag end → reverse geocode → fill street field
        marker.on('dragend', async () => {
          const pos = marker.getLatLng();
          setLatitude(parseFloat(pos.lat.toFixed(6)));
          setLongitude(parseFloat(pos.lng.toFixed(6)));
          await reverseGeocode(pos.lat, pos.lng);
        });

        // ✅ Map click → move marker + reverse geocode
        map.on('click', async (e) => {
          const pos = e.latlng;
          marker.setLatLng(pos);
          setLatitude(parseFloat(pos.lat.toFixed(6)));
          setLongitude(parseFloat(pos.lng.toFixed(6)));
          await reverseGeocode(pos.lat, pos.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
      } catch (err) {
        console.error('Failed to initialize Leaflet Map:', err);
      }
    };

    // Small delay so the tab panel is visible before Leaflet measures the container
    const t = setTimeout(initMap, 80);
    return () => {
      isMounted = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ─── Sync marker position whenever lat/lng state changes ──────────────────────
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const cur = markerRef.current.getLatLng();
    if (Math.abs(cur.lat - latitude) > 0.00001 || Math.abs(cur.lng - longitude) > 0.00001) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapRef.current.setView([latitude, longitude]);
    }
  }, [latitude, longitude]);

  // ─── Reverse geocode helper (map → text fields) ───────────────────────────────
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      const data = await res.json();
      if (!data?.address) return;

      const addr = data.address;

      // Try to match province
      const provName = addr.state || addr.province || '';
      const matchedProv = regionData.find(p =>
        p.nama.toLowerCase().includes(provName.toLowerCase()) ||
        provName.toLowerCase().includes(p.nama.toLowerCase())
      );
      if (matchedProv) {
        setSelectedProv(matchedProv.id);

        // Try to match city
        const cityName = addr.city || addr.regency || addr.county || addr.town || '';
        const matchedCity = matchedProv.cities.find(c =>
          c.nama.toLowerCase().includes(cityName.toLowerCase()) ||
          cityName.toLowerCase().includes(c.nama.toLowerCase())
        );
        if (matchedCity) {
          setSelectedCity(matchedCity.id);
          // Try to match postal code
          const pc = addr.postcode;
          if (pc && matchedCity.postalCodes.includes(pc)) {
            setSelectedPostal(pc);
          } else if (matchedCity.postalCodes.length > 0) {
            setSelectedPostal(matchedCity.postalCodes[0]);
          }
        }
      }

      // Fill street address from Nominatim response
      const road = addr.road || addr.pedestrian || addr.neighbourhood || '';
      const village = addr.village || addr.suburb || '';
      const district = addr.district || addr.subdistrict || '';
      const streetParts = [road, village, district].filter(Boolean);
      if (streetParts.length > 0) {
        setStreetAddress(streetParts.join(', '));
      }
    } catch (err) {
      console.warn('Reverse geocode failed', err);
    }
  };

  // ─── Forward geocode: text → map (debounced, triggered by button) ─────────────
  const handleSearchOnMap = async () => {
    const query = buildAddressString();
    if (!query || query === 'Indonesia') {
      toast.error(lang === 'id' ? 'Isi detail alamat terlebih dahulu.' : 'Please fill in address details first.');
      return;
    }
    setGeoSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await res.json();
      if (data?.length > 0) {
        const { lat, lon } = data[0];
        setLatitude(parseFloat(parseFloat(lat).toFixed(6)));
        setLongitude(parseFloat(parseFloat(lon).toFixed(6)));
        toast.success(lang === 'id' ? 'Lokasi ditemukan & pin dipindahkan!' : 'Location found and pin moved!');
      } else {
        toast.error(lang === 'id' ? 'Lokasi tidak ditemukan. Coba perjelas alamat.' : 'Location not found. Try clarifying address.');
      }
    } catch {
      toast.error(lang === 'id' ? 'Gagal mencari lokasi. Cek koneksi internet.' : 'Failed to search location. Check internet connection.');
    } finally {
      setGeoSearching(false);
    }
  };

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
        setCreatedAt(u.created_at ? new Date(u.created_at).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'long' }) : '--');
        setLastLogin(u.last_login_at ? new Date(u.last_login_at).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US') : '--');

        const f = data.farm || {};
        setFarmName(f.farm_name || '');
        setFarmType(f.farm_type || 'dairy');
        setTotalCapacity(f.total_cattle_capacity || '');
        setCurrentCattleCount(data.cattle_count || 0);
        if (f.latitude) setLatitude(f.latitude);
        if (f.longitude) setLongitude(f.longitude);

        // Restore address dropdowns from saved farm_location string if needed
        if (f.street_address) setStreetAddress(f.street_address);
        if (f.province_id) setSelectedProv(f.province_id);
        if (f.city_id) setSelectedCity(f.city_id);
        if (f.postal_code) setSelectedPostal(f.postal_code);

        profileLoaded = true;
      }
    } catch (err) {
      console.warn('Profile fetch failed, loading offline defaults', err);
      setFullName(user?.full_name || 'Iwan Prianto');
      setEmail(user?.email || 'wan@farm.com');
      setCreatedAt(new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'long' }));
      setLastLogin(new Date().toLocaleString(lang === 'id' ? 'id-ID' : 'en-US'));
      setFarmName('Peternakan DeAraf');
      setStreetAddress('Jalan Ahmad Yani');
      setTotalCapacity(150);
      setCurrentCattleCount(0);
    }

    // 2. Fetch Telegram Settings
    try {
      const tgRes = await axiosInstance.get('/user/telegram-settings');
      if (tgRes.data?.has_chat_id) {
        setTgSavedBadge(true);
        if (tgRes.data.chat_id_masked) setTelegramChatId(tgRes.data.chat_id_masked);
      }
    } catch (err) {
      console.warn('Telegram settings fetch failed', err);
      if (!profileLoaded) {
        setTelegramChatId('648392013');
        setTgSavedBadge(true);
      }
    }

    // 3. Fetch Notification Preferences
    try {
      const notifRes = await axiosInstance.get('/user/notification-preferences');
      if (notifRes.data) {
        setNotifEstrus(notifRes.data.notif_estrus);
        setNotifAnomaly(notifRes.data.notif_anomaly);
        setNotifDaily(notifRes.data.notif_daily);
      }
    } catch (err) {
      console.warn('Notification preferences fetch failed', err);
      if (!profileLoaded) {
        setNotifEstrus(true);
        setNotifAnomaly(true);
        setNotifDaily(true);
      }
    }

    // 4. Load Team Members (Owners/Admins only)
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
        axiosInstance.put('/profile', { full_name: fullName, email }),
        axiosInstance.put('/profile/farm', {
          farm_name: farmName,
          farm_type: farmType,
          total_cattle_capacity: totalCapacity ? parseInt(totalCapacity) : null,
          latitude,
          longitude,
          street_address: streetAddress,
          province_id: selectedProv,
          city_id: selectedCity,
          postal_code: selectedPostal,
          // Composed display string for legacy farm_location field
          farm_location: buildAddressString(),
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

  const handleSaveTelegramId = async (e) => {
    e.preventDefault();
    if (!telegramChatId.trim()) return;
    setLoading(true);
    try {
      await axiosInstance.put('/user/telegram-settings', { telegram_chat_id: telegramChatId });
      setTgSavedBadge(true);
      toast.success(lang === 'id' ? 'Chat ID Telegram berhasil disimpan!' : 'Telegram Chat ID saved successfully!');
    } catch {
      toast.error(lang === 'id' ? 'Gagal menyimpan Chat ID.' : 'Failed to save Chat ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestTelegram = async () => {
    setLoading(true);
    try {
      await axiosInstance.post('/user/telegram-test');
      toast.success(lang === 'id' ? 'Pesan test terkirim! Periksa Telegram kamu.' : 'Test message sent! Check your Telegram.');
    } catch {
      toast.error(lang === 'id' ? 'Gagal mengirim test alert.' : 'Failed to send test alert.');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePreference = async (type, checked) => {
    const updated = {
      notif_estrus: type === 'estrus' ? checked : notifEstrus,
      notif_anomaly: type === 'anomaly' ? checked : notifAnomaly,
      notif_daily: type === 'daily' ? checked : notifDaily,
    };
    if (type === 'estrus') setNotifEstrus(checked);
    if (type === 'anomaly') setNotifAnomaly(checked);
    if (type === 'daily') setNotifDaily(checked);
    try {
      await axiosInstance.put('/user/notification-preferences', updated);
      toast.success(lang === 'id' ? 'Preferensi notifikasi diperbarui!' : 'Notification preferences updated!');
    } catch {
      toast.error(lang === 'id' ? 'Gagal menyimpan preferensi.' : 'Failed to save notification preferences.');
    }
  };

  const handleSaveSecurity = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(lang === 'id' ? 'Mohon isi semua kolom password.' : 'Please fill all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(lang === 'id' ? 'Konfirmasi password baru tidak cocok.' : 'New password confirmation does not match.');
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.post('/profile/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success(lang === 'id' ? 'Password berhasil diubah!' : 'Password changed successfully!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'id' ? 'Gagal mengubah password.' : 'Failed to change password.'));
    } finally {
      setLoading(false);
    }
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
          { id: 'telegram', icon: Send, label: t.settings_tab_telegram },
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

      {/* Content Card */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border)',
          borderRadius: '24px',
          boxShadow: 'var(--shadow-card)',
        }}
        className="p-5 md:p-8 relative overflow-hidden"
      >
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

              {/* Profile Card */}
              <div className="flex items-center gap-4 p-4 md:p-5 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-sm">
                <div
                  style={{ background: 'var(--accent)' }}
                  className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white text-lg md:text-xl font-black shrink-0"
                >
                  {fullName ? fullName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '--'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm md:text-base font-bold text-[var(--text-1)] truncate">{fullName || (lang === 'id' ? 'Operator' : 'Operator')}</p>
                  <p className="text-xs text-[var(--text-2)] truncate">{email || 'admin@farm.com'}</p>
                </div>
              </div>

              {/* ── Section: Personal Information ── */}
              <section className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--accent)] border-b border-[var(--border)] pb-1.5 flex items-center gap-1.5">
                  <User className="w-4 h-4" /> {t.settings_personal_info}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>{t.settings_full_name}</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder={lang === 'id' ? 'Nama Lengkap Anda' : 'Your Full Name'} />
                  </div>
                  <div>
                    <label className={labelClass}>{t.settings_email}</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="nama@email.com" />
                  </div>
                </div>
              </section>

              {/* ── Section: Farm Details ── */}
              <section className="space-y-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--accent)] border-b border-[var(--border)] pb-1.5 flex items-center gap-1.5">
                  <Globe className="w-4 h-4" /> {t.settings_farm_details}
                </h3>

                {/* Farm name + type + capacity — 3-col on desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className={labelClass}>{t.settings_farm_name}</label>
                    <input type="text" value={farmName} onChange={e => setFarmName(e.target.value)} placeholder={lang === 'id' ? 'Peternakan Jaya Abadi' : 'Jaya Abadi Farm'} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t.settings_farm_type}</label>
                    <select value={farmType} onChange={e => setFarmType(e.target.value)} className={inputClass}>
                      <option value="dairy">{t.settings_type_dairy}</option>
                      <option value="beef">{t.settings_type_beef}</option>
                      <option value="breeding">{t.settings_type_breeding}</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t.settings_farm_capacity}</label>
                    <input type="number" value={totalCapacity} onChange={e => setTotalCapacity(e.target.value)} placeholder="150" className={inputClass} />
                  </div>
                </div>

                {/* Capacity bar */}
                <div className="p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] flex items-center justify-between gap-4 shadow-sm">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.settings_total_registered}</p>
                    <p className="text-2xl font-black text-[var(--accent)] mt-0.5">{currentCattleCount} <span className="text-sm font-semibold text-[var(--text-2)]">{lang === 'id' ? 'sapi' : 'cows'}</span></p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{t.settings_capacity_used}</span>
                    <span className="text-sm font-bold text-[var(--text-1)] block mt-0.5">
                      {totalCapacity ? Math.round((currentCattleCount / totalCapacity) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* ── Address block ── */}
                <div className="space-y-3 p-4 md:p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)]">
                  <p className="text-xs font-black uppercase tracking-wider text-[var(--text-2)] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> {t.settings_farm_location}
                  </p>

                  {/* Row 1: Province + City/Kab (2-col) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>{t.settings_province}</label>
                      <select
                        value={selectedProv}
                        onChange={e => { setSelectedProv(e.target.value); setSelectedCity(''); setSelectedPostal(''); }}
                        className={inputClass}
                      >
                        <option value="">{lang === 'id' ? 'Pilih Provinsi...' : 'Select Province...'}</option>
                        {regionData.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>{t.settings_city}</label>
                      <select
                        value={selectedCity}
                        onChange={e => { setSelectedCity(e.target.value); setSelectedPostal(''); }}
                        disabled={!selectedProv}
                        className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <option value="">{lang === 'id' ? 'Pilih Kota/Kab...' : 'Select City/Regency...'}</option>
                        {currentProv?.cities.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Street address + Postal code (3:1 ratio) */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-3">
                      <label className={labelClass}>{t.settings_street_address}</label>
                      <input
                        type="text"
                        value={streetAddress}
                        onChange={e => setStreetAddress(e.target.value)}
                        placeholder={lang === 'id' ? 'Jalan, RT/RW, Dusun, Kelurahan, Kecamatan...' : 'Street, RT/RW, Sub-district, District...'}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t.settings_postal_code}</label>
                      <select
                        value={selectedPostal}
                        onChange={e => setSelectedPostal(e.target.value)}
                        disabled={!selectedCity}
                        className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <option value="">—</option>
                        {currentCity?.postalCodes.map(pc => <option key={pc} value={pc}>{pc}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Search button */}
                  <button
                    type="button"
                    onClick={handleSearchOnMap}
                    disabled={geoSearching}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] hover:border-[var(--accent)] text-xs font-bold text-[var(--text-2)] rounded-xl transition-all shadow-sm disabled:opacity-50"
                  >
                    {geoSearching
                      ? <><Loader2 size={14} className="animate-spin" /> {t.settings_searching_map}</>
                      : <><Search size={14} /> {t.settings_search_map}</>
                    }
                  </button>

                  {/* Coordinates — compact 2-col */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>{t.settings_latitude}</label>
                      <div className="relative">
                        <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--accent)]" />
                        <input
                          type="number" step="any" value={latitude}
                          onChange={e => setLatitude(parseFloat(e.target.value))}
                          className={`${inputClass} pl-8`}
                          placeholder="-7.9666"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>{t.settings_longitude}</label>
                      <div className="relative">
                        <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
                        <input
                          type="number" step="any" value={longitude}
                          onChange={e => setLongitude(parseFloat(e.target.value))}
                          className={`${inputClass} pl-8`}
                          placeholder="112.6326"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Map */}
                  <div
                    ref={mapContainerRef}
                    className="border border-[var(--border)] rounded-xl overflow-hidden shadow-inner mt-1"
                    style={{ height: '260px', width: '100%', zIndex: 1 }}
                  />
                  <p className="text-[10px] text-[var(--text-3)] text-center">
                    {t.settings_map_help}
                  </p>
                </div>
              </section>

              {/* Account meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
                <div>
                  <p className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-wider">{t.settings_created_at}</p>
                  <p className="text-xs font-bold text-[var(--text-1)] mt-1">{createdAt}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-wider">{t.settings_last_login}</p>
                  <p className="text-xs font-bold text-[var(--text-1)] mt-1">{lastLogin}</p>
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end pt-2">
                <button type="submit" className="flex items-center gap-2 px-5 py-3 bg-[var(--accent)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95">
                  <Save className="w-4 h-4" /> {t.settings_save_changes}
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2 — TELEGRAM & ALERTS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'telegram' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-1)] font-display border-b border-[var(--border)] pb-2 mb-2">{t.settings_telegram_title}</h2>
                <p className="text-xs text-[var(--text-2)]">{t.settings_telegram_desc}</p>
              </div>

              <div
                style={{
                  backgroundColor: tgSavedBadge ? 'var(--accent-dim)' : 'var(--amber-dim)',
                  borderColor: tgSavedBadge ? 'var(--accent-border)' : 'rgba(184, 122, 10, 0.3)',
                  color: tgSavedBadge ? 'var(--accent)' : 'var(--amber)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }}
                className="p-4 rounded-xl text-xs font-bold flex items-center gap-3"
              >
                {tgSavedBadge ? (
                  <Check className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                )}
                <span>{tgSavedBadge ? t.settings_telegram_connected : t.settings_telegram_disconnected}</span>
              </div>

              <form onSubmit={handleSaveTelegramId} className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelClass}>
                      Telegram Chat ID
                      {tgSavedBadge && <span className="ml-2 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold rounded-full">{t.settings_telegram_saved}</span>}
                    </label>
                    <button type="button" onClick={() => setShowGuide(!showGuide)} className="text-xs text-[var(--accent)] hover:underline font-bold">
                      {showGuide ? t.settings_telegram_hide : t.settings_telegram_show}
                    </button>
                  </div>

                  {showGuide && (
                    <div className="mb-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-600 dark:text-slate-300 space-y-2.5 animate-in slide-in-from-top-2 duration-300 shadow-sm">
                      <p className="font-bold text-slate-700 dark:text-slate-200">{t.settings_telegram_guide_title}</p>
                      <ol className="list-decimal pl-4 space-y-1.5 font-semibold">
                        <li>{lang === 'id' ? 'Buka Telegram, cari' : 'Open Telegram, search for'} <a href="https://t.me/chatIDrobot" target="_blank" rel="noreferrer" className="text-[var(--accent)] font-bold hover:underline">@chatIDrobot</a>.</li>
                        <li>{lang === 'id' ? 'Kirim perintah' : 'Send command'} <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">/start</code>.</li>
                        <li>{t.settings_telegram_guide_step3}</li>
                        <li className="text-[10px] text-slate-400 italic">{t.settings_telegram_guide_footer}</li>
                      </ol>
                    </div>
                  )}

                  <div className="relative">
                    <input
                      type={showChatId ? 'text' : 'password'}
                      value={telegramChatId}
                      onChange={e => { setTelegramChatId(e.target.value); setTgSavedBadge(false); }}
                      placeholder={lang === 'id' ? 'Contoh: 128472910' : 'Example: 128472910'}
                      className={`${inputClass} pr-12 font-mono`}
                    />
                    <button type="button" onClick={() => setShowChatId(!showChatId)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      {showChatId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-[var(--accent)]" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={handleTestTelegram} disabled={!tgSavedBadge} className="flex items-center gap-2 px-4 py-3 border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-1)] bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                    {t.settings_telegram_test}
                  </button>
                  <button type="submit" disabled={!telegramChatId} className="flex items-center gap-2 px-5 py-3 bg-[var(--accent)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl text-xs font-bold shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    {t.settings_telegram_save_btn}
                  </button>
                </div>
              </form>

              {/* Notification Preferences */}
              <div className="pt-6 border-t border-[var(--border)] space-y-4">
                <h3 className="text-sm font-bold text-[var(--text-1)] font-display">{t.settings_notif_pref}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'estrus', label: lang === 'id' ? 'Peringatan Estrus' : 'Estrus Alerts', badge: lang === 'id' ? 'Telegram & Email' : 'Telegram & Email', badgeColor: 'emerald', checked: notifEstrus },
                    { key: 'anomaly', label: lang === 'id' ? 'Peringatan Anomali' : 'Anomaly Alerts', badge: lang === 'id' ? 'Telegram Saja' : 'Telegram Only', badgeColor: 'amber', checked: notifAnomaly },
                    { key: 'daily', label: lang === 'id' ? 'Ringkasan Harian' : 'Daily Summary', badge: lang === 'id' ? 'Telegram & Email' : 'Telegram & Email', badgeColor: 'blue', checked: notifDaily },
                    { key: 'breeding', label: lang === 'id' ? 'Pengingat Perkawinan' : 'Breeding Reminders', badge: lang === 'id' ? 'Kalender & Email' : 'Calendar & Email', badgeColor: 'purple', checked: notifBreeding },
                  ].map(({ key, label, badge, badgeColor, checked }) => {
                    const badgeStyles = {
                      emerald: { bg: 'var(--accent-dim)', text: 'var(--accent)', border: 'var(--accent-border)' },
                      amber: { bg: 'var(--amber-dim)', text: 'var(--amber)', border: 'rgba(184, 122, 10, 0.2)' },
                      blue: { bg: 'var(--blue-dim)', text: 'var(--blue)', border: 'rgba(26, 96, 145, 0.2)' },
                      purple: { bg: 'rgba(168, 85, 247, 0.08)', text: 'rgb(168, 85, 247)', border: 'rgba(168, 85, 247, 0.2)' },
                    }[badgeColor] || { bg: 'var(--accent-dim)', text: 'var(--accent)', border: 'var(--accent-border)' };

                    return (
                      <div key={key} className="flex items-center justify-between p-3.5 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] shadow-sm">
                        <div>
                          <span className="text-xs font-bold text-[var(--text-1)] block">{label}</span>
                          <span
                            style={{
                              backgroundColor: badgeStyles.bg,
                              color: badgeStyles.text,
                              borderColor: badgeStyles.border,
                              borderWidth: '1px',
                              borderStyle: 'solid',
                            }}
                            className="text-[9px] font-bold mt-1.5 inline-block px-2.5 py-0.5 rounded-full"
                          >
                            {badge}
                          </span>
                        </div>
                        <Toggle
                          checked={checked}
                          onChange={e => key === 'breeding' ? setNotifBreeding(e.target.checked) : handleTogglePreference(key, e.target.checked)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3 — SECURITY
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'security' && (
            <div className="space-y-8 animate-in fade-in duration-300">

              {/* ── Section: Login PIN ── */}
              <section>
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-4">
                  <h2 className="text-base font-bold text-[var(--text-1)] font-display flex items-center gap-2">
                    <Key className="w-4 h-4 text-[var(--accent)]" />
                    {lang === 'id' ? 'Ubah PIN Login' : 'Change Login PIN'}
                  </h2>
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
                    style={userHasPin
                      ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }
                      : { background: 'rgba(255,91,91,0.08)', color: '#ff5b5b', borderColor: 'rgba(255,91,91,0.25)' }
                    }
                  >
                    {userHasPin
                      ? (lang === 'id' ? 'PIN Aktif' : 'PIN Active')
                      : (lang === 'id' ? 'Belum Ada PIN' : 'No PIN Set')}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-2)] mb-4 leading-relaxed">
                  {lang === 'id'
                    ? 'Gunakan 6-digit PIN untuk login cepat dari perangkat terpercaya. PIN menggantikan password setelah login pertama.'
                    : 'Use a 6-digit PIN for quick login from trusted devices. PIN replaces your password after the first login.'}
                </p>
                <form onSubmit={handleSavePIN} className="space-y-4">
                  {pinError && (
                    <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold">
                      {pinError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>{lang === 'id' ? 'PIN Baru (6 digit)' : 'New PIN (6 digits)'}</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={pinNewDigits}
                        onChange={e => { if (/^\d*$/.test(e.target.value) && e.target.value.length <= 6) { setPinNewDigits(e.target.value); setPinError(''); } }}
                        placeholder="••••••"
                        className={`${inputClass} font-mono tracking-[0.5em]`}
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
                        className={`${inputClass} font-mono tracking-[0.5em]`}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={pinLoading || pinNewDigits.length !== 6 || pinConfirmDigits.length !== 6}
                      className="flex items-center gap-2 px-5 py-3 bg-[var(--accent)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {pinLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> {lang === 'id' ? 'Menyimpan...' : 'Saving...'}</>
                        : <><Save className="w-4 h-4" /> {lang === 'id' ? 'Simpan PIN Baru' : 'Save New PIN'}</>}
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-3)] leading-relaxed">
                    💡 {lang === 'id'
                      ? 'Hanya berlaku di perangkat terpercaya. Login PIN lebih cepat daripada ketik password tiap saat.'
                      : 'Only works on trusted devices. PIN login is faster than typing your password every time.'}
                  </p>
                </form>
              </section>

              {/* ── Divider ── */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
                  {lang === 'id' ? 'atau' : 'or'}
                </span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>

              {/* ── Section: Change Password ── */}
              <section>
                <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 mb-4">
                  <h2 className="text-base font-bold text-[var(--text-1)] font-display">
                    {lang === 'id' ? 'Ubah Password Akun' : 'Change Account Password'}
                  </h2>
                  <div className="relative group">
                    <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400 hover:text-[var(--accent)] hover:border-[var(--accent)] cursor-help transition-all">i</div>
                    <div className="absolute left-0 top-7 w-72 p-3.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-2)] text-[11px] font-semibold rounded-xl shadow-xl opacity-0 scale-95 origin-top-left pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-50">
                      <div className="absolute top-0 left-2 -translate-y-1 w-2.5 h-2.5 bg-[var(--bg-surface)] border-t border-l border-[var(--border)] rotate-45" />
                      <p className="relative leading-relaxed">
                        <strong className="text-[var(--accent)]">{lang === 'id' ? 'Catatan:' : 'Note:'}</strong> {t.settings_security_info}
                      </p>
                    </div>
                  </div>
                </div>
                <form onSubmit={handleSaveSecurity} className="space-y-4">
                  <div>
                    <label className={labelClass}>{t.settings_current_pass}</label>
                    <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder={lang === 'id' ? 'Masukkan password saat ini' : 'Enter current password'} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t.settings_new_pass}</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={lang === 'id' ? 'Minimal 8 karakter' : 'Minimum 8 characters'} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t.settings_confirm_pass}</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={lang === 'id' ? 'Ketik ulang password baru' : 'Retype new password'} className={inputClass} />
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button type="submit" className="flex items-center gap-2 px-5 py-3 bg-[var(--accent)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95">
                      <Save className="w-4 h-4" /> {t.settings_change_pass_btn}
                    </button>
                  </div>
                </form>
              </section>

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
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className={inputClass}>
                      <option value="worker">{t.settings_role_worker} / Operator</option>
                      <option value="admin">Administrator</option>
                    </select>
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