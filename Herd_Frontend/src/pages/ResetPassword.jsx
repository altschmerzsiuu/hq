import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// Using axiosInstance since it handles the base URL automatically
import axiosInstance from '../lib/axios';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!token) {
      toast.error('Token tidak ditemukan. Silakan klik tautan dari email Anda lagi.');
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error('Kata sandi harus minimal 8 karakter.');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    
    setLoading(true);
    try {
      await axiosInstance.post('/auth/reset-password', {
        token: token,
        new_password: newPassword
      });
      
      setSuccess(true);
      toast.success('Kata sandi berhasil direset! Silakan login.');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Gagal mereset kata sandi. Tautan mungkin kedaluwarsa.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col md:flex-row bg-[#F7F9FC]">
      {/* LEFT COLUMN - Branding / Graphic */}
      <div className="hidden md:flex flex-col flex-1 bg-gradient-to-br from-[#1b5e20] to-[#2e7d32] p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <svg width="400" height="400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </div>
        <div className="z-10 mt-auto mb-auto">
          <h1 className="text-5xl font-black mb-6 leading-tight">Buat Kata Sandi Baru</h1>
          <p className="text-xl text-green-50 max-w-md font-medium leading-relaxed">
            Masukkan kata sandi baru untuk kembali mengakses Hectra Herd dan pantau peternakan Anda dengan cerdas.
          </p>
        </div>
        <div className="z-10 mt-auto pt-8">
          <p className="text-sm font-semibold opacity-80 uppercase tracking-widest">
            HECTRA HERD &copy; 2024
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN - Form */}
      <div className="flex-1 flex flex-col justify-center p-6 sm:p-12 md:max-w-xl bg-white relative shadow-2xl z-10">
        <div className="w-full max-w-sm mx-auto">
          {success ? (
            <div className="text-center animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Berhasil!</h2>
              <p className="text-gray-500 mb-8">Kata sandi Anda telah berhasil diperbarui.</p>
              <Link 
                to="/login"
                className="w-full inline-flex justify-center items-center h-[52px] bg-[#2e7d32] hover:bg-[#1b5e20] text-white text-base font-bold rounded-2xl shadow-lg shadow-green-600/20 active:scale-95 transition-all"
              >
                Kembali ke Login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-10 text-center md:text-left">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-2xl mb-6 md:hidden">
                  <Lock className="w-6 h-6 text-green-700" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">
                  Reset Password
                </h2>
                <p className="text-gray-500 font-medium">
                  {!token 
                    ? "Tautan reset tidak valid. Silakan periksa email Anda." 
                    : "Silakan masukkan kata sandi baru Anda di bawah ini."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide text-[11px]">Kata Sandi Baru</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#2e7d32] transition-colors">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type="password"
                      disabled={!token || loading}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 text-[15px] focus:ring-2 focus:ring-green-500/20 focus:border-[#2e7d32] focus:bg-white transition-all disabled:opacity-50 font-medium"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide text-[11px]">Konfirmasi Kata Sandi Baru</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#2e7d32] transition-colors">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type="password"
                      disabled={!token || loading}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 text-[15px] focus:ring-2 focus:ring-green-500/20 focus:border-[#2e7d32] focus:bg-white transition-all disabled:opacity-50 font-medium"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!token || loading || !newPassword || !confirmPassword}
                  className="w-full flex justify-center items-center h-[52px] bg-[#2e7d32] hover:bg-[#1b5e20] text-white text-base font-bold rounded-2xl shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:hover:bg-[#2e7d32] disabled:cursor-not-allowed active:scale-95 transition-all mt-4"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-white/80" />
                  ) : (
                    "Simpan Kata Sandi"
                  )}
                </button>
              </form>

              <div className="mt-8 text-center md:text-left">
                <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  Kembali ke Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
