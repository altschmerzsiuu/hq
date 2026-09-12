import re

with open("/Volumes/Kerberos/Github-Repo/hq/Herd_Frontend/src/components/gendhis/GendhisWidget.jsx", "r") as f:
    content = f.read()

# Add User import
if 'User' not in content[:500]:
    content = content.replace("import { \n  MessageCircle,", "import { \n  MessageCircle,\n  User,")

# Add Profile button
start_idx = content.find("<Syringe className=\"w-5 h-5\" />")
end_idx = content.find("</div>", start_idx)

if start_idx != -1 and end_idx != -1:
    btn_html = """<Syringe className="w-5 h-5" />
            </button>
            
            <button 
              onClick={() => { setIsFabOpen(false); navigate('/settings?tab=profile'); }}
              className="relative flex items-center justify-center w-12 h-12 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.1)] transition-all duration-300 group hover:shadow-[0_4px_20px_rgba(156,163,175,0.4)]"
            >
              <span className="absolute right-[120%] bg-gray-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap pointer-events-none translate-x-4 group-hover:translate-x-0">{lang === 'id' ? 'Profil' : 'Profile'}</span>
              <User className="w-5 h-5" />
            </button>"""
    
    content = content[:start_idx] + btn_html + content[start_idx + len("<Syringe className=\"w-5 h-5\" />\n            </button>"):]

with open("/Volumes/Kerberos/Github-Repo/hq/Herd_Frontend/src/components/gendhis/GendhisWidget.jsx", "w") as f:
    f.write(content)
