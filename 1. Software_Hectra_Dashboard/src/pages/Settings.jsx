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
  Bell,
  Smartphone,
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
  const [phoneNumber, setPhoneNumber] = useState('');
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

  // Tab 2: Notifications
  const [fcmEnabled, setFcmEnabled] = useState(false);
  const [notifEstrus, setNotifEstrus] = useState(false);
  const [notifAnomaly, setNotifAnomaly] = useState(false);
  const [notifDaily, setNotifDaily] = useState(false);
  const [notifBreeding, setNotifBreeding] = useState(false);

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

  const inputClass = "w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009254]/20 focus:border-[#009254] transition-all shadow-sm";
  const labelClass = "block text-[11px] font-black text-gray-500 mb-2 uppercase tracking-wider";

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
        setPhoneNumber(u.phone_number || '');
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

    // 2. Fetch FCM Settings (Mock)
    try {
      // Logic for FCM token checking would go here
      setFcmEnabled(true);
    } catch (err) {
      console.warn('FCM settings fetch failed', err);
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
        axiosInstance.put('/profile', { full_name: fullName, email, phone_number: phoneNumber }),
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

  // --- Push Notification Handler ---
  const handleEnableFCM = async () => {
    setLoading(true);
    try {
      // Simulate requesting notification permission
      await new Promise(resolve => setTimeout(resolve, 1500));
      setFcmEnabled(true);
      toast.success(lang === 'id' ? 'Notifikasi perangkat diaktifkan!' : 'Device notifications enabled!');
    } catch {
      toast.error(lang === 'id' ? 'Gagal mengaktifkan notifikasi.' : 'Failed to enable notifications.');
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

              {/* Profile Card */}
              <div className="flex items-center gap-4 p-5 md:p-6 bg-white rounded-3xl border border-gray-200 shadow-sm mb-6">
                <div
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white text-xl md:text-2xl font-black shrink-0 bg-[#009254]"
                >
                  {fullName ? fullName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '--'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base md:text-lg font-extrabold text-gray-900 truncate">{fullName || (lang === 'id' ? 'Operator' : 'Operator')}</p>
                  <p className="text-sm text-gray-500 truncate mt-0.5">{email || 'admin@farm.com'}</p>
                </div>
              </div>

              {/* ── Section: Personal Information ── */}
              <section className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#009254]" /> {t.settings_personal_info}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>{t.settings_full_name}</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder={lang === 'id' ? 'Nama Lengkap Anda' : 'Your Full Name'} />
                  </div>
                  <div>
                    <label className={labelClass}>{t.settings_email}</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="nama@email.com" />
                  </div>
                  <div>
                    <label className={labelClass}>{lang === 'id' ? 'NOMOR HP' : 'PHONE NUMBER'}</label>
                    <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className={inputClass} placeholder="081234567890" />
                  </div>
                </div>
              </section>

              {/* ── Section: Farm Details ── */}
              <section className="space-y-4 pt-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2 mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#009254]" /> {t.settings_farm_details}
                </h3>

                <div className="space-y-4">
                  <div>
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
                <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between gap-4 mt-2">
                  <div>
                    <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider">{t.settings_total_registered}</p>
                    <p className="text-3xl font-black text-[#009254] mt-0.5">{currentCattleCount} <span className="text-sm font-bold text-gray-600">{lang === 'id' ? 'sapi' : 'cows'}</span></p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block">{t.settings_capacity_used}</span>
                    <span className="text-base font-black text-gray-900 block mt-1">
                      {totalCapacity ? Math.round((currentCattleCount / totalCapacity) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* ── Address block ── */}
                <div className="space-y-4 pt-6">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2 mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#009254]" /> {t.settings_farm_location}
                  </h3>

                  <div className="space-y-4">
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

                  <div className="space-y-4 mt-4">
                    <div>
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:border-[#009254] hover:text-[#009254] text-xs font-bold text-gray-700 rounded-xl transition-all shadow-sm disabled:opacity-50 mt-2"
                  >
                    {geoSearching
                      ? <><Loader2 size={16} className="animate-spin" /> {t.settings_searching_map}</>
                      : <><Search size={16} /> {t.settings_search_map}</>
                    }
                  </button>

                  {/* Coordinates — compact 2-col */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className={labelClass}>{t.settings_latitude}</label>
                      <div className="relative">
                        <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#009254]" />
                        <input type="number" step="any" value={latitude} onChange={e => setLatitude(e.target.value)} className={`${inputClass} pl-9`} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>{t.settings_longitude}</label>
                      <div className="relative">
                        <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="number" step="any" value={longitude} onChange={e => setLongitude(e.target.value)} className={`${inputClass} pl-9`} />
                      </div>
                    </div>
                  </div>

                  <div className="relative h-[250px] mt-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm z-0">
                    <div ref={mapContainerRef} className="absolute inset-0 z-0" />
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-2 font-medium">
                    {t.settings_map_help}
                  </p>
                </div>
              </section>

              {/* Account Created & Last Login */}
              <div className="pt-6 mt-8 border-t border-gray-200">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t.settings_acc_created}</p>
                    <p className="text-sm font-extrabold text-gray-900 mt-1">{createdAt}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t.settings_last_login}</p>
                    <p className="text-sm font-extrabold text-gray-900 mt-1">{lastLogin}</p>
                  </div>
                </div>
              </div>

              {/* Save button (Full width sticky-like at the bottom) */}
              <div className="pt-8 pb-4">
                <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#009254] hover:bg-[#007b46] text-white rounded-2xl text-sm font-bold shadow-md transition-all active:scale-95">
                  <Save className="w-5 h-5" /> {t.settings_save_changes}
                </button>
              </div>
            </form>
          )}


          {/* ══════════════════════════════════════════════════════════════════
              TAB 2 — NOTIFICATIONS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-1)] font-display border-b border-[var(--border)] pb-2 mb-2">
                  {lang === 'id' ? 'Pengaturan Notifikasi' : 'Notification Settings'}
                </h2>
                <p className="text-xs text-[var(--text-2)]">
                  {lang === 'id' ? 'Kelola bagaimana aplikasi HERD memberitahu Anda.' : 'Manage how the HERD app notifies you.'}
                </p>
              </div>

              {/* Push Notification Card */}
              <div className="p-5 bg-white border border-gray-200 rounded-3xl shadow-sm space-y-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl ${fcmEnabled ? 'bg-[#009254]/10 text-[#009254]' : 'bg-gray-100 text-gray-500'}`}>
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-gray-900">
                      {lang === 'id' ? 'Notifikasi Perangkat' : 'Device Notifications'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {lang === 'id' 
                        ? 'Aktifkan agar HERD bisa mengirimkan peringatan langsung ke layar HP Anda (seperti pesan WhatsApp).' 
                        : 'Enable this so HERD can send alerts directly to your phone screen.'}
                    </p>
                  </div>
                </div>

                {!fcmEnabled ? (
                  <button
                    type="button"
                    onClick={handleEnableFCM}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#009254] hover:bg-[#007b46] text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
                  >
                    {lang === 'id' ? 'Aktifkan Notifikasi' : 'Enable Notifications'}
                  </button>
                ) : (
                  <div className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gray-100 text-[#009254] rounded-xl text-xs font-bold border border-gray-200">
                    <Check className="w-4 h-4" /> {lang === 'id' ? 'Notifikasi Perangkat Aktif' : 'Device Notifications Enabled'}
                  </div>
                )}
              </div>

              {/* Notification Preferences */}
              <div className="pt-6 border-t border-[var(--border)] space-y-4">
                <h3 className="text-sm font-bold text-[var(--text-1)] font-display">{t.settings_notif_pref}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'estrus', label: lang === 'id' ? 'Peringatan Estrus' : 'Estrus Alerts', badge: lang === 'id' ? 'Push & Email' : 'Push & Email', badgeColor: 'emerald', checked: notifEstrus },
                    { key: 'anomaly', label: lang === 'id' ? 'Peringatan Anomali' : 'Anomaly Alerts', badge: lang === 'id' ? 'Push Saja' : 'Push Only', badgeColor: 'amber', checked: notifAnomaly },
                    { key: 'daily', label: lang === 'id' ? 'Ringkasan Harian' : 'Daily Summary', badge: lang === 'id' ? 'Push & Email' : 'Push & Email', badgeColor: 'blue', checked: notifDaily },
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