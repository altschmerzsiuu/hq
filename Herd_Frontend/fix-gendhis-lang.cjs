const fs = require('fs');
let c = fs.readFileSync('src/components/gendhis/GendhisWidget.jsx', 'utf8');

if (!c.includes('useSettingsStore')) {
  c = c.replace(
    /import \{ cn \} from '@\/lib\/utils';/,
    "import { cn } from '@/lib/utils';\nimport useSettingsStore from '@/store/settingsStore';"
  );
  
  c = c.replace(
    /export default function GendhisWidget\(\) \{/,
    "export default function GendhisWidget() {\n  const { lang } = useSettingsStore();"
  );
}

fs.writeFileSync('src/components/gendhis/GendhisWidget.jsx', c);
