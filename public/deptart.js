/* Department artwork: an illustration per folder, drawn in the folder's colour.
   DeptArt.scene(dept)  -> large SVG for cards and banners
   DeptArt.badge(dept)  -> small SVG tile for the folder list
   DeptArt.ICONS        -> the icons admins can pick from */
(function () {
  'use strict';
  // 24 x 24 line drawings (stroke = currentColor). Kept simple so they read at any size.
  const G = {
    office: { label: 'Office', d: '<path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V21"/><path d="M15 10h3.5A1.5 1.5 0 0 1 20 11.5V21"/><path d="M2.5 21h19"/><path d="M7.5 8h1M10.5 8h1M7.5 11.5h1M10.5 11.5h1M7.5 15h1M10.5 15h1M17.5 14h0M17.5 17h0"/><path d="M8.5 21v-2.5h2V21"/>' },
    people: { label: 'People', d: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.6 14.3A4.8 4.8 0 0 1 21 19"/>' },
    finance: { label: 'Finance', d: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><rect x="8" y="5.5" width="8" height="3.5" rx=".8"/><path d="M8.5 12.5h0M12 12.5h0M15.5 12.5h0M8.5 15.5h0M12 15.5h0M15.5 15.5h0M8.5 18.5h0M12 18.5h3.5"/>' },
    project: { label: 'Projects', d: '<rect x="4.5" y="4" width="15" height="17.5" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M8 9h5M10 12.5h6M8 16h4"/><path d="M15.5 9h0M17.5 16h0"/>' },
    truck: { label: 'Operations', d: '<path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h9.5A1.5 1.5 0 0 1 15 6.5V17H2.5z"/><path d="M15 9.5h3.6a1.5 1.5 0 0 1 1.3.8l1.6 3V17H15"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>' },
    stand: { label: 'Exhibition stand', d: '<path d="M3 20.5h18"/><path d="M4.5 20.5V6h15v14.5"/><path d="M3.5 6h17V3.5h-17z"/><rect x="7.5" y="9" width="9" height="5.5" rx=".8"/><path d="M9.5 20.5v-3h5v3"/>' },
    growth: { label: 'Sales', d: '<path d="M3.5 3.5v17h17"/><path d="M7.5 16.5v-3M11.5 16.5v-6M15.5 16.5v-4.5M19.5 16.5V8"/><path d="m6.5 10 4-4 3.5 3 5.5-5.5"/><path d="M16 3.5h3.5V7"/>' },
    hardhat: { label: 'Health & safety', d: '<path d="M2.5 18.5h19"/><path d="M4.5 18.5v-2.5a7.5 7.5 0 0 1 5-7"/><path d="M19.5 18.5v-2.5a7.5 7.5 0 0 0-5-7"/><path d="M9.5 15.5V6.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v9"/>' },
    tools: { label: 'Production', d: '<path d="M14 3.5 10.5 7l2 2L16 5.5"/><path d="m12.5 9-9 9a1.4 1.4 0 0 0 2 2l9-9"/><path d="M16 5.5c1.7-1.3 4-1 5 .5l-3.5 3.5"/><path d="M14.5 14.5 20 20"/><path d="m5 4 4 4M3.5 5.5 5 4"/>' },
    leaf: { label: 'Sustainability', d: '<path d="M5 19c0-9 5.5-14.5 15-15 .5 9.5-5 15-14 15H5z"/><path d="M5 19c3-4 6-6.5 10-9"/>' },
    gift: { label: 'Benefits', d: '<rect x="3.5" y="8" width="17" height="4.5" rx="1"/><path d="M5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7"/><path d="M12 8v13"/><path d="M12 8C9 8 7 6.8 7 5.2 7 3.9 8 3 9.2 3 11 3 12 5.5 12 8zm0 0c3 0 5-1.2 5-2.8C17 3.9 16 3 14.8 3 13 3 12 5.5 12 8z"/>' },
    shield: { label: 'Policies', d: '<path d="M12 2.5 4.5 5.5v6c0 4.7 3.2 8.4 7.5 10 4.3-1.6 7.5-5.3 7.5-10v-6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>' },
    bulb: { label: 'Guides', d: '<path d="M9 18h6M10 21h4"/><path d="M8.5 15.5c0-1.5-3-3.3-3-7a6.5 6.5 0 0 1 13 0c0 3.7-3 5.5-3 7z"/><path d="M12 6.5a2.5 2.5 0 0 1 2.5 2.5"/>' },
    card: { label: 'Discount card', d: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 9.5h19"/><path d="m14.5 16.5 4-4"/><circle cx="14.8" cy="12.8" r=".9"/><circle cx="18.2" cy="16.2" r=".9"/><path d="M5.5 15h5"/>' },
    star: { label: 'Star', d: '<path d="m12 3 2.6 5.6 6 .6-4.5 4.1 1.3 6L12 16.3 6.6 19.3l1.3-6L3.4 9.2l6-.6z"/>' },
    folder: { label: 'Folder', d: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>' },
    calendar: { label: 'Calendar', d: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M7.5 14h0M12 14h0M16.5 14h0M7.5 17h0M12 17h0"/>' },
    palette: { label: 'Design', d: '<path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-.8 2-1.8 0-1.4-1.3-1.8-1.3-3.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.3 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>' },
    laptop: { label: 'IT', d: '<rect x="4.5" y="4.5" width="15" height="10.5" rx="1.5"/><path d="M2.5 19h19l-2-4h-15z"/>' },
    camera: { label: 'Photos', d: '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h3l1.5-2.5h6L16.5 7h3A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><circle cx="12" cy="13.5" r="3.5"/>' },
    globe: { label: 'Global', d: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9S14.5 18.4 12 21M12 3C9.5 5.6 8.3 8.6 8.3 12S9.5 18.4 12 21"/>' }
  };
  // Pick an icon from the folder's name (so new and renamed folders get something sensible).
  const MATCH = [
    [/office|facilit|admin|reception/i, 'office'], [/\bhr\b|human|people|recruit|staff|team/i, 'people'], [/financ|account|expens|payroll|invoice/i, 'finance'],
    [/project|estimat|planning|programme/i, 'project'], [/operat|logist|transport|fleet|warehouse/i, 'truck'], [/\bxpo\b|exhibit|stand|event|show/i, 'stand'],
    [/sales|marketing|growth|commercial|business dev/i, 'growth'], [/health|safety|h\s*&\s*s|risk|incident/i, 'hardhat'], [/production|workshop|build|manufact|joinery/i, 'tools'],
    [/sustain|carbon|environment|green|eco/i, 'leaf'], [/benefit|perk|reward|wellbeing/i, 'gift'], [/polic|complian|legal|govern|procedure/i, 'shield'],
    [/how.?to|guide|help|training|learn|faq/i, 'bulb'], [/discount|card|essa|offer|voucher/i, 'card'], [/design|creative|studio/i, 'palette'],
    [/\bit\b|tech|digital|software|systems/i, 'laptop'], [/photo|image|media/i, 'camera'], [/calendar|holiday|leave|rota/i, 'calendar'], [/custom|other|misc/i, 'star']
  ];
  const iconFor = d => (d.icon && G[d.icon]) ? d.icon : ((MATCH.find(([re]) => re.test(d.name || '')) || [, 'folder'])[1]);
  const hex = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#0F6CBD';
  const mix = (c, to, k) => { c = hex(c); const n = i => parseInt(c.slice(i, i + 2), 16), t = to === 'w' ? 255 : 0; return '#' + [1, 3, 5].map(i => Math.round(n(i) + (t - n(i)) * k).toString(16).padStart(2, '0')).join(''); };
  const glyph = (key, x, y, s, extra = '') => `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="currentColor" stroke-width="${(1.6 / Math.max(1, s / 2.4)).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" ${extra}>${G[key].d}</g>`;
  let uid = 0;
  // Large scene: 320 x 160. Soft gradient, light rings, a big faint icon, and the icon in a frosted tile.
  function scene(d) {
    const k = iconFor(d), c = hex(d.color), id = 'da' + (++uid);
    return `<svg class="art" viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${(G[k].label).replace(/"/g, '')}">
      <defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(c, 'w', .18)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${mix(c, 'b', .38)}"/></linearGradient>
      <radialGradient id="${id}r" cx=".78" cy=".22" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <pattern id="${id}p" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#fff" fill-opacity=".16"/></pattern></defs>
      <rect width="320" height="160" fill="url(#${id}g)"/><rect width="320" height="160" fill="url(#${id}r)"/>
      <rect x="0" y="96" width="150" height="64" fill="url(#${id}p)"/>
      <circle cx="262" cy="34" r="74" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="16"/>
      <circle cx="262" cy="34" r="118" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="2"/>
      <g color="#fff" opacity=".13">${glyph(k, 168, 12, 7.2)}</g>
      <rect x="28" y="30" width="100" height="100" rx="22" fill="#fff" fill-opacity=".2" stroke="#fff" stroke-opacity=".35"/>
      <g color="#fff">${glyph(k, 46, 48, 2.7)}</g>
    </svg>`;
  }
  // Wide banner: 960 x 150, icon tile on the left, title sits next to it (drawn by the page).
  function banner(d) {
    const k = iconFor(d), c = hex(d.color), id = 'da' + (++uid);
    return `<svg class="art" viewBox="0 0 960 150" preserveAspectRatio="xMinYMid slice" role="img" aria-label="${(G[k].label).replace(/"/g, '')}">
      <defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stop-color="${mix(c, 'b', .22)}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${mix(c, 'w', .2)}"/></linearGradient>
      <pattern id="${id}p" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#fff" fill-opacity=".14"/></pattern></defs>
      <rect width="960" height="150" fill="url(#${id}g)"/>
      <rect x="600" y="0" width="360" height="150" fill="url(#${id}p)"/>
      <circle cx="860" cy="40" r="110" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="22"/>
      <circle cx="860" cy="40" r="170" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="2"/>
      <g color="#fff" opacity=".14">${glyph(k, 640, -30, 9)}</g>
      <rect x="24" y="25" width="100" height="100" rx="22" fill="#fff" fill-opacity=".2" stroke="#fff" stroke-opacity=".35"/>
      <g color="#fff">${glyph(k, 42, 43, 2.7)}</g>
    </svg>`;
  }
  // Small tile for lists: rounded square in the folder colour with the icon in white.
  function badge(d, size = 24) {
    const k = iconFor(d), c = hex(d.color);
    return `<svg class="dbadge" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="db${++uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(c, 'w', .15)}"/><stop offset="1" stop-color="${mix(c, 'b', .2)}"/></linearGradient></defs>
      <rect width="24" height="24" rx="6" fill="url(#db${uid})"/><g color="#fff">${glyph(k, 4.2, 4.2, .65, 'stroke-width="2.2"')}</g></svg>`;
  }
  const ICONS = Object.entries(G).map(([key, g]) => ({ key, label: g.label }));
  window.DeptArt = { scene, banner, badge, iconFor, ICONS, glyph: k => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${glyph(k, 0, 0, 1)}</svg>` };
})();
