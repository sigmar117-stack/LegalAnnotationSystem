/* ==========================================================================
   ui.js —— DOM 助手、图标、浮层
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---- DOM --------------------------------------------------------------- */
  function h(tag, attrs, children) {
    var parts = String(tag).split(/([.#])/);
    var name = parts[0] || 'div';
    var n = document.createElement(name);
    for (var i = 1; i < parts.length; i += 2) {
      if (parts[i] === '.') n.classList.add(parts[i + 1]);
      else n.id = parts[i + 1];
    }
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') n.className = (n.className ? n.className + ' ' : '') + v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
        else if (k === 'dataset') { for (var d in v) n.dataset[d] = v[d]; }
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : v);
      }
    }
    append(n, children);
    return n;
  }

  function append(parent, children) {
    if (children === null || children === undefined || children === false) return parent;
    if (Array.isArray(children)) { children.forEach(function (c) { append(parent, c); }); return parent; }
    if (children instanceof Node) { parent.appendChild(children); return parent; }
    parent.appendChild(document.createTextNode(String(children)));
    return parent;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function on(node, evt, sel, fn) {
    if (typeof sel === 'function') { node.addEventListener(evt, sel); return; }
    node.addEventListener(evt, function (e) {
      var t = e.target.closest(sel);
      if (t && node.contains(t)) fn.call(t, e, t);
    });
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---- 图标（14px 线性） -------------------------------------------------- */
  var PATHS = {
    dashboard: '<rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1"/><rect x="8" y="1.5" width="4.5" height="4.5" rx="1"/><rect x="1.5" y="8" width="4.5" height="4.5" rx="1"/><rect x="8" y="8" width="4.5" height="4.5" rx="1"/>',
    import:    '<path d="M7 9.5V1.8m0 0L4.2 4.6M7 1.8l2.8 2.8"/><path d="M1.8 9v2.4c0 .6.4 1 1 1h8.4c.6 0 1-.4 1-1V9"/>',
    taxonomy:  '<path d="M7 1.6v3.2M3.4 4.8h7.2"/><rect x="1.6" y="7.6" width="4" height="4.8" rx=".8"/><rect x="8.4" y="7.6" width="4" height="4.8" rx=".8"/>',
    assign:    '<circle cx="5" cy="4.6" r="2.4"/><path d="M1.4 12.4c0-2 1.6-3.4 3.6-3.4s3.6 1.4 3.6 3.4"/><path d="M10 2.6a2.2 2.2 0 0 1 0 4.2M11.2 12.4c0-1.5-.6-2.6-1.6-3.2"/>',
    workbench: '<rect x="1.6" y="1.8" width="10.8" height="10.4" rx="1"/><path d="M1.6 5.2h10.8M5.6 5.2v7M9.2 5.2v7"/>',
    student:   '<path d="M1.6 5.4 7 2.2l5.4 3.2L7 8.6 1.6 5.4Z"/><path d="M4 6.8v3.1c0 .9 1.3 1.6 3 1.6s3-.7 3-1.6V6.8"/>',
    diff:      '<path d="M3.2 1.8v8.6M3.2 10.4 1.6 8.8M3.2 10.4l1.6-1.6"/><path d="M10.8 12.2V3.6M10.8 3.6 9.2 5.2M10.8 3.6l1.6 1.6"/><path d="M5.6 6h4.8"/>',
    export:    '<path d="M7 12.2V4.5m0 0L4.2 7.3M7 4.5l2.8 2.8"/><path d="M1.8 5V3.2c0-.6.4-1 1-1h8.4c.6 0 1 .4 1 1V5"/>',
    record:    '<circle cx="7" cy="7" r="5.4"/><path d="M7 4v3.2l2.2 1.4"/>',
    result:    '<path d="M2.6 1.8h6l3 3v8.4H2.6z"/><path d="M8.4 1.8v3.2h3.2"/><path d="M4.6 8h4.8M4.6 10.4h3.2"/>',
    shield:    '<path d="M7 1.6 2.6 3.2v3.4c0 2.6 1.8 4.6 4.4 5.8 2.6-1.2 4.4-3.2 4.4-5.8V3.2L7 1.6Z"/><path d="M5.2 7 6.4 8.2 9 5.6"/>',
    back:      '<path d="M8.6 3.4 5 7l3.6 3.6"/>',
    plus:      '<path d="M7 2.6v8.8M2.6 7h8.8"/>',
    minus:     '<path d="M2.6 7h8.8"/>',
    check:     '<path d="M2.6 7.4 5.4 10.2 11.4 4"/>',
    close:     '<path d="M3.4 3.4 10.6 10.6M10.6 3.4 3.4 10.6"/>',
    warn:      '<path d="M7 2.2 12.4 11.4H1.6L7 2.2Z"/><path d="M7 5.6v2.8M7 9.9v.6"/>',
    info:      '<circle cx="7" cy="7" r="5.4"/><path d="M7 6.2v3.6M7 4.3v.6"/>',
    link:      '<path d="M5.8 8.2a2.6 2.6 0 0 0 3.7 0l1.8-1.8a2.6 2.6 0 0 0-3.7-3.7l-.9.9"/><path d="M8.2 5.8a2.6 2.6 0 0 0-3.7 0L2.7 7.6a2.6 2.6 0 0 0 3.7 3.7l.9-.9"/>',
    zoomIn:    '<circle cx="6.2" cy="6.2" r="4.2"/><path d="M9.3 9.3 12.4 12.4M6.2 4.4v3.6M4.4 6.2h3.6"/>',
    zoomOut:   '<circle cx="6.2" cy="6.2" r="4.2"/><path d="M9.3 9.3 12.4 12.4M4.4 6.2h3.6"/>',
    fit:       '<path d="M2 4.6V2.4h2.2M9.8 2.4H12v2.2M12 9.4v2.2H9.8M4.2 11.6H2V9.4"/>',
    reset:     '<path d="M2.6 6.4a4.4 4.4 0 1 1 1.3 3.1"/><path d="M2.4 3.2v3.2h3.2"/>',
    trash:     '<path d="M2.6 3.8h8.8M5.4 3.8V2.4h3.2v1.4M4 3.8l.5 7.8h5l.5-7.8"/>',
    edit:      '<path d="M9.2 2.4 11.6 4.8 5 11.4H2.6V9L9.2 2.4Z"/>',
    eye:       '<path d="M1.4 7S3.6 3.2 7 3.2 12.6 7 12.6 7 10.4 10.8 7 10.8 1.4 7 1.4 7Z"/><circle cx="7" cy="7" r="1.9"/>',
    arrowRight:'<path d="M3.2 7h7.6M8 4.2 10.8 7 8 9.8"/>',
    arrowLeft: '<path d="M10.8 7H3.2M6 4.2 3.2 7 6 9.8"/>',
    doc:       '<path d="M3 1.8h5.4l3 3v8.4H3z"/><path d="M8.4 1.8v3h3"/><path d="M5 7.4h4.4M5 9.6h3"/>',
    graph:     '<circle cx="7" cy="2.6" r="1.4"/><circle cx="3" cy="11" r="1.4"/><circle cx="11" cy="11" r="1.4"/><path d="M7 4v3.2M3.6 9.8 6.2 7.2M10.4 9.8 7.8 7.2"/>',
    users:     '<circle cx="5.2" cy="4.8" r="2.2"/><path d="M1.8 12.2c0-1.9 1.5-3.2 3.4-3.2s3.4 1.3 3.4 3.2"/><path d="M9.6 3a2 2 0 0 1 0 3.8M10.8 12.2c0-1.4-.5-2.4-1.4-3"/>',
    logout:    '<path d="M5.8 2.4H3.2c-.6 0-1 .4-1 1v7.2c0 .6.4 1 1 1h2.6"/><path d="M9.4 9.6 12 7 9.4 4.4M12 7H5.8"/>',
    book:      '<path d="M7 3.4C5.8 2.4 3.8 2.2 2.2 2.2v8.4c1.6 0 3.6.2 4.8 1.2 1.2-1 3.2-1.2 4.8-1.2V2.2C10.2 2.2 8.2 2.4 7 3.4Z"/><path d="M7 3.4v8.4"/>'
  };

  function icon(name, size) {
    var s = size || 14;
    var wrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrap.setAttribute('viewBox', '0 0 14 14');
    wrap.setAttribute('width', s);
    wrap.setAttribute('height', s);
    wrap.setAttribute('fill', 'none');
    wrap.setAttribute('stroke', 'currentColor');
    wrap.setAttribute('stroke-width', '1.25');
    wrap.setAttribute('stroke-linecap', 'round');
    wrap.setAttribute('stroke-linejoin', 'round');
    wrap.setAttribute('class', 'ico');
    wrap.innerHTML = PATHS[name] || PATHS.info;
    return wrap;
  }

  /* ---- 浮层 -------------------------------------------------------------- */
  function toast(msg, kind) {
    var host = $('#toasts');
    if (!host) { host = h('div#toasts.toasts'); document.body.appendChild(host); }
    var t = h('div.toast' + (kind ? '.toast--' + kind : ''), { text: msg });
    host.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .2s, transform .2s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(4px)';
      setTimeout(function () { t.remove(); }, 220);
    }, kind === 'seal' ? 3600 : 2600);
  }

  function modal(opts) {
    opts = opts || {};
    var body = h('div.sheet-body');
    append(body, typeof opts.body === 'function' ? opts.body() : opts.body);

    var foot = null;
    if (opts.actions && opts.actions.length) {
      foot = h('div.sheet-foot');
      opts.actions.forEach(function (a) {
        if (a.spacer) { foot.appendChild(h('div.spacer')); return; }
        foot.appendChild(h('button.btn' + (a.kind ? '.btn--' + a.kind : ''), {
          text: a.label,
          onclick: function () { if (a.onClick) a.onClick(close); else close(); }
        }));
      });
    }

    var sheet = h('div.sheet' + (opts.wide ? '.sheet--wide' : ''), {}, [
      h('div.sheet-head', {}, [
        h('div.sheet-title', { text: opts.title || '' }),
        h('div.spacer'),
        h('button.btn.btn--ghost.btn--sm', { onclick: function () { close(); } }, [icon('close')])
      ]),
      body,
      foot
    ]);
    var mask = h('div.mask', {
      onclick: function (e) { if (e.target === mask) close(); }
    }, [sheet]);

    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() {
      document.removeEventListener('keydown', onKey);
      mask.remove();
      if (opts.onClose) opts.onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.appendChild(mask);
    var focusable = sheet.querySelector('input,select,textarea,button.btn--primary,button.btn--seal');
    if (focusable) focusable.focus();
    return { close: close, sheet: sheet, body: body };
  }

  function confirmSheet(opts) {
    return modal({
      title: opts.title,
      body: h('div', { style: { fontSize: '13.5px', lineHeight: '1.75' } },
        [h('p', { text: opts.message }), opts.detail ? h('p.muted.tiny', { style: { marginTop: '10px' }, text: opts.detail }) : null]),
      actions: [
        { spacer: true },
        { label: '取消' },
        { label: opts.okLabel || '确定', kind: opts.danger ? 'seal' : 'primary', onClick: function (close) { close(); if (opts.onOk) opts.onOk(); } }
      ]
    });
  }

  /* ---- 下载 -------------------------------------------------------------- */
  function download(filename, content, mime) {
    try {
      var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = h('a', { href: url, download: filename });
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
      return true;
    } catch (e) {
      toast('当前环境下无法直接下载，已改为在新窗口打开', 'quiet');
      return false;
    }
  }

  /* ---- 格式化 ------------------------------------------------------------ */
  function pct(a, b) { return b ? Math.round((a / b) * 1000) / 10 : 0; }

  function elChip(code, sub, opts) {
    opts = opts || {};
    var t = global.DATA.typeByCode(code);
    var colorKey = t ? t.color : 'non';
    var label = sub || code;
    var full = t ? (sub ? sub + ' ' + (subName(sub) || '') : code + ' ' + t.name) : code;
    var node = h('span.tag.tag--type.t-' + colorKey + (opts.sm ? '.tag--sm' : ''), { title: full });
    node.appendChild(h('span.dot.t-' + colorKey));
    node.appendChild(h('span', { text: label }));
    return node;
  }

  function subName(subCode) {
    if (!subCode) return '';
    var all = global.DATA.ELEMENT_TYPES;
    for (var i = 0; i < all.length; i++) {
      var subs = all[i].subs || [];
      for (var j = 0; j < subs.length; j++) if (subs[j].code === subCode) return subs[j].name;
    }
    return '';
  }

  function relGlyph(code) {
    var r = global.DATA.relationByCode(code);
    return r ? r.glyphChar : '';
  }

  global.UI = {
    h: h, append: append, clear: clear, $: $, $$: $$, on: on, esc: esc,
    icon: icon, toast: toast, modal: modal, confirm: confirmSheet, download: download,
    pct: pct, elChip: elChip, subName: subName, relGlyph: relGlyph,
    setHTML: function (node, html) { node.innerHTML = html; return node; }
  };
})(window);
