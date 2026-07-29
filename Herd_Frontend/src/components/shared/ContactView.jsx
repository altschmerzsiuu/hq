import React from 'react';

export default function ContactView({ lang }) {
  const waUrl = `https://wa.me/6285173140965?text=${encodeURIComponent('Halo, saya mengalami kendala terkait ...')}`;
  const igUrl = `https://www.instagram.com/helloherd.hq/`;
  const webUrl = `https://helloherd.vercel.app`;

  return (
    <div className="w-full bg-white rounded-[24px] p-8 flex flex-col items-center justify-center text-center shadow-sm border border-gray-100 mb-4">
      <h2 className="text-[28px] font-extrabold text-[#2c241d] mb-4 tracking-tight">
        {lang === 'id' ? 'Hubungi Kami' : 'Contact Us'}
      </h2>
      <p className="text-[15px] text-gray-500 leading-relaxed max-w-[320px] mx-auto mb-8">
        {lang === 'id' 
          ? 'Kami siap membantu menjawab pertanyaan seputar produk, dukungan teknis, atau info umum tentang HERD.' 
          : 'We are ready to help answer questions about products, technical support, or general info about HERD.'}
      </p>

      <div className="flex items-center justify-center gap-6">
        {/* Website Button */}
        <a 
          href={webUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-sm hover:scale-105 hover:shadow-md transition-all duration-300"
          style={{ background: 'linear-gradient(to bottom right, #e0f2fe, #bae6fd)' }}
        >
          <img 
            src="/herd.jpeg" 
            alt="HERD" 
            className="w-6 h-6 rounded-full object-cover"
          />
        </a>

        {/* WhatsApp Button */}
        <a 
          href={waUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-sm hover:scale-105 hover:shadow-md transition-all duration-300"
          style={{ background: 'linear-gradient(to bottom right, #d9f99d, #fef08a)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#2c241d">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </a>

        {/* Instagram Button */}
        <a 
          href={igUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-sm hover:scale-105 hover:shadow-md transition-all duration-300"
          style={{ background: 'linear-gradient(to bottom right, #fed7aa, #fbcfe8)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2c241d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
        </a>
      </div>
    </div>
  );
}
