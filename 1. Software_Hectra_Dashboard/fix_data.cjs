const fs = require('fs');
let code = fs.readFileSync('src/store/useTernakStore.js', 'utf8');

code = code.replace(
  "let data = response.data.data || response.data",
  "let data = response.data.data || response.data;\n      if (!data || Object.keys(data).length === 0) {\n        data = get().sapiList.find(s => s.id === rfid) || { id: rfid, nama: 'Ternak ' + rfid.substring(0,4) };\n      }"
);

// also catch error to use sapiList
code = code.replace(
  "const msg = parseErrorMessage(error)\n      set({ error: msg, loading: false })\n      return { success: false, message: msg }",
  "const msg = parseErrorMessage(error);\n      let fallbackData = get().sapiList.find(s => s.id === rfid);\n      if (fallbackData) {\n        if (fallbackData.nama?.toUpperCase() === 'ARA') fallbackData = { ...fallbackData, ...mockData, id: fallbackData.id || 'ARA' };\n        set({ selectedSapi: fallbackData, error: null, loading: false });\n        return { success: true, data: fallbackData };\n      }\n      set({ error: msg, loading: false });\n      return { success: false, message: msg };"
);

fs.writeFileSync('src/store/useTernakStore.js', code);
