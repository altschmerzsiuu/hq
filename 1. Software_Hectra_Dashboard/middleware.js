export const config = {
  // Hanya jalankan middleware ini untuk halaman web, abaikan file statis seperti gambar, css, js
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)',
  ],
};

export default function middleware(request) {
  // Ambil data negara dari header Vercel
  const country = request.headers.get('x-vercel-ip-country');

  // Jika negara terdeteksi dan bukan Indonesia ('ID'), maka blokir
  if (country && country !== 'ID') {
    return new Response(
      `
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Akses Ditolak | Hectra Dashboard</title>
          <style>
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0; 
              background-color: #f3f4f6; 
              color: #111827; 
            }
            .container { 
              text-align: center; 
              padding: 2.5rem 2rem; 
              background: white; 
              border-radius: 1.5rem; 
              box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); 
              max-width: 400px;
              width: 90%;
            }
            .icon {
              font-size: 3rem;
              margin-bottom: 1rem;
            }
            h1 { 
              font-size: 1.5rem; 
              font-weight: 800;
              margin-bottom: 0.75rem; 
              color: #dc2626; 
              line-height: 1.2;
            }
            p { 
              color: #4b5563; 
              font-size: 0.95rem;
              line-height: 1.5;
            }
            .footer {
              font-size: 0.75rem; 
              margin-top: 2rem; 
              color: #9ca3af; 
              border-top: 1px solid #e5e7eb;
              padding-top: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⛔</div>
            <h1>Akses Wilayah Dibatasi</h1>
            <p>Maaf, Hectra Dashboard hanya dapat diakses melalui jaringan internet dari dalam wilayah <strong>Indonesia</strong> untuk alasan keamanan.</p>
            <div class="footer">
              Terdeteksi region: <strong>${country}</strong>
            </div>
          </div>
        </body>
      </html>
      `,
      {
        status: 403,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }
    );
  }

  // Jika dari Indonesia (atau sedang di local development), teruskan request seperti biasa
  return new Response(null, {
    headers: {
      'x-middleware-next': '1',
    },
  });
}
