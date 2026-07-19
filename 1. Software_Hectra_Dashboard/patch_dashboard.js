const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');

// 1. Imports
content = content.replace(
  "import { useState, useEffect, useRef } from 'react';",
  "import { useState, useEffect, useRef } from 'react';\nimport { createPortal } from 'react-dom';"
);
content = content.replace("import StatsDrawer from '@/components/shared/StatsDrawer';\n", "");

// 2. State replacements
content = content.replace(
  "const [drawerData, setDrawerData] = useState({ isOpen: false, type: 'pantau', data: [] });",
  "const [activePopover, setActivePopover] = useState(null);"
);
// Remove showAllRecommendations if it's there, but wait, it might not have been added yet in the last commit?
// Wait, showAllRecommendations was added in my truncated steps. Let's see if it's there.

fs.writeFileSync('src/pages/Dashboard.jsx', content);
