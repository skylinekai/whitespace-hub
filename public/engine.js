/* Form logic shared by the browser and the server:
   which fields are visible, and whether an answer set is complete. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FormEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const INPUT_TYPES = new Set(['textbox', 'textarea', 'email', 'number', 'phone', 'fullname', 'address',
    'date', 'datetime', 'time', 'dropdown', 'radio', 'checkbox', 'rating', 'scale', 'file', 'signature',
    'calculation', 'products']);

  function isEmpty(v) {
    if (v == null) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') {
      if (v.items) return Object.keys(v.items).length === 0;
      return Object.values(v).every(x => x == null || String(x).trim() === '');
    }
    return String(v).trim() === '';
  }

  function asText(v) {
    if (v == null) return '';
    if (typeof v === 'object' && !Array.isArray(v) && 'choice' in v) return v.choice === 'Other' ? (v.other || 'Other') : v.choice;
    return String(v);
  }

  function testTerm(term, values) {
    const v = values[term.field];
    const want = String(term.value ?? '').trim().toLowerCase();
    const list = Array.isArray(v) ? v.map(x => String(x).trim().toLowerCase())
      : [asText(v).trim().toLowerCase()];
    switch (term.op) {
      case 'equals': return list.includes(want) || list.some(x => x.startsWith(want + ':'));
      case 'notEquals': return !isEmpty(v) && !list.includes(want);
      case 'isEmpty': return isEmpty(v);
      case 'isFilled': return !isEmpty(v);
      case 'contains': return list.some(x => x.includes(want));
      case 'lessThan': return !isEmpty(v) && Number(asText(v)) < Number(want);
      case 'greaterThan': return !isEmpty(v) && Number(asText(v)) > Number(want);
      default: return false;
    }
  }

  function ruleMatches(rule, values) {
    const r = rule.terms.map(t => testTerm(t, values));
    return rule.link === 'all' ? r.every(Boolean) : r.some(Boolean);
  }

  // Returns a Set of visible field ids.
  function visibleFields(form, values) {
    const show = {}, hide = {}, triggers = {};
    for (const rule of form.rules || []) {
      const hit = ruleMatches(rule, values);
      for (const id of rule.targets) {
        if (rule.action === 'show') { show[id] = show[id] || hit; }
        else {
          hide[id] = hide[id] || hit;
          (triggers[id] = triggers[id] || []).push(...rule.terms.map(t => t.field));
        }
      }
    }
    const out = new Set();
    for (const f of form.fields) {
      let vis = true;
      if (f.id in show) vis = show[f.id];
      if (hide[f.id]) vis = false;
      if (vis && f.needsTrigger) vis = (triggers[f.id] || []).some(t => !isEmpty(values[t]));
      if (vis) out.add(f.id);
    }
    return out;
  }

  function calc(form, f, values) {
    const ids = f.sum || form.fields.filter(x => x.type === 'scale' || x.type === 'rating').map(x => x.id);
    return ids.reduce((s, id) => s + (Number(values[id]) || 0), 0);
  }

  // Validate answers. `files` maps field id -> number of files attached.
  function validate(form, values, files) {
    const vis = visibleFields(form, values);
    const errors = {};
    for (const f of form.fields) {
      if (!vis.has(f.id) || !INPUT_TYPES.has(f.type)) continue;
      const v = values[f.id];
      if (f.required) {
        const missing = f.type === 'file' ? !(files && files[f.id]) : isEmpty(v);
        if (missing) { errors[f.id] = 'This question needs an answer.'; continue; }
        if (f.type === 'fullname' && v && (!String(v.first || '').trim() || (!f.parts && !String(v.last || '').trim()))) {
          errors[f.id] = 'Enter both names.'; continue;
        }
      }
      if (f.type === 'email' && !isEmpty(v) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()))
        errors[f.id] = 'Enter an email address like name@company.com.';
      if (f.type === 'number' && !isEmpty(v) && isNaN(Number(v))) errors[f.id] = 'Enter a number.';
      if ((f.type === 'radio' || f.type === 'checkbox') && v && typeof v === 'object' && !Array.isArray(v) && v.choice === 'Other' && !String(v.other || '').trim() && f.required)
        errors[f.id] = 'Type your answer for "Other".';
    }
    return { errors, visible: vis };
  }

  // Human-readable answer for emails, the dashboard and CSV.
  function display(f, v) {
    if (isEmpty(v)) return '';
    switch (f.type) {
      case 'fullname': return [v.first, v.last].filter(Boolean).join(' ');
      case 'address': return ['street', 'line2', 'city', 'region', 'postcode', 'country'].map(k => v[k]).filter(Boolean).join(', ');
      case 'time': return f.range && v.to ? `${v.from || ''} – ${v.to}` : (v.from || '');
      case 'checkbox': return (Array.isArray(v) ? v : [v]).join('; ');
      case 'radio': case 'dropdown': return typeof v === 'object' ? asText(v) : String(v);
      case 'rating': return `${v} / ${f.max || 5}`;
      case 'scale': return `${v} / ${f.max || 10}`;
      case 'products': return Object.entries(v.items || {}).map(([name, it]) =>
        `${it.qty} × ${name}${it.opts && Object.keys(it.opts).length ? ' (' + Object.entries(it.opts).map(([k, x]) => `${k}: ${x}`).join(', ') + ')' : ''}`).join('; ');
      case 'signature': return 'Signed';
      default: return String(v);
    }
  }

  return { visibleFields, validate, display, calc, isEmpty, INPUT_TYPES };
});
