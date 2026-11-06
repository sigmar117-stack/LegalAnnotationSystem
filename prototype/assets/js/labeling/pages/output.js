/* ==========================================================================
   labeling/pages/output.js —— 结果输出
   图示（PNG / JPG / SVG）与数据（Excel / JSON）导出、导出记录、结果查看。
   导出后数据可查看但不可修改。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.LPages = global.LPages || {};
  var h = UI.h;
  var S = global.LStore;

  var TABS = [['config', '导出配置'], ['records', '导出记录'], ['result', '结果查看']];

  function render(ctx) {
    var tab = ctx.params.tab || 'config';
    var page = h('div.page');

    var seg = h('div.seg', { style: { marginBottom: '18px' } });
    TABS.forEach(function (t) {
      seg.appendChild(h('button' + (tab === t[0] ? '.is-on' : ''), {
        text: t[1],
        onclick: function () { if (tab !== t[0]) global.go('output', { tab: t[0] }); }
      }));
    });
    page.appendChild(seg);

    if (tab === 'records') page.appendChild(recordsView());
    else if (tab === 'result') page.appendChild(resultView(ctx));
    else page.appendChild(configView());
    return page;
  }

  function finalized() {
    var team = S.currentTeam();
    return S.finalsOf(team.id).map(function (f) {
      return { f: f, task: S.task(f.taskId), doc: S.doc(f.docId) };
    }).filter(function (x) { return x.task; });
  }

  /* ======================================================================
     导出配置
     ====================================================================== */
  function configView() {
    var list = finalized();
    var wrap = h('div');

    if (!list.length) {
      wrap.appendChild(h('div.panel', {}, [
        h('div.panel-body', {}, [
          h('div.empty', {}, [
            h('div.empty-title', { text: '还没有可导出的结果' }),
            h('div.empty-desc', { text: '导出前需先完成裁定定稿。' }),
            h('button.btn.btn--sm', { onclick: function () { global.go('arbitrate'); } }, [h('span', { text: '前往裁定' })])
          ])
        ])
      ]));
      return wrap;
    }

    /* 按任务聚合 */
    var byTask = {};
    list.forEach(function (x) {
      (byTask[x.task.id] = byTask[x.task.id] || { task: x.task, items: [] }).items.push(x);
    });
    var first = Object.keys(byTask)[0];

    var picked = { JSON: true, Excel: true, PNG: true, SVG: false, JPG: false };
    var taskSel = h('select.select', {});
    Object.keys(byTask).forEach(function (id) {
      taskSel.appendChild(h('option', { value: id, text: byTask[id].task.name }));
    });
    var nameInput = h('input.input', { value: byTask[first].task.name.replace(/\s/g, '') + '_导出' });
    taskSel.addEventListener('change', function () {
      nameInput.value = S.task(taskSel.value).name.replace(/\s/g, '') + '_导出';
      summary();
    });

    var fgrid = h('div.fmt-grid');
    [
      { k: 'JSON', d: '结构化数据：字符索引、标签层级、关系定义' },
      { k: 'Excel', d: '命题列表、标签、关系矩阵（.csv）' },
      { k: 'PNG', d: '论证图示位图' },
      { k: 'JPG', d: '论证图示位图（JPEG）' },
      { k: 'SVG', d: '论证图示矢量' }
    ].forEach(function (f) {
      var card = h('button.fmt-card' + (picked[f.k] ? '.is-on' : ''), {
        onclick: function () { picked[f.k] = !picked[f.k]; card.classList.toggle('is-on', picked[f.k]); }
      });
      card.appendChild(h('div.fmt-name', { text: f.k }));
      card.appendChild(h('div.fmt-desc', { text: f.d }));
      fgrid.appendChild(card);
    });

    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '导出配置' }),
      h('div.spacer'),
      h('span.badge.badge--seal', { text: '导出后不可再编辑' })
    ]));

    var body = h('div.panel-body');
    body.appendChild(h('div.grid-2', {}, [
      h('label.field', {}, [h('span.field-label', { text: '任务' }), taskSel]),
      h('label.field', {}, [h('span.field-label', { text: '文件命名' }), nameInput])
    ]));
    body.appendChild(h('div.field', {}, [h('span.field-label', { text: '导出内容' }), fgrid]));
    var prog = h('div.export-progress', { hidden: true });
    body.appendChild(prog);
    panel.appendChild(body);

    panel.appendChild(h('div.panel-foot', {}, [
      h('span.tiny.muted', { id: 'exp-summary' }),
      h('div.spacer'),
      h('button.btn.btn--primary', {
        onclick: function () { runExport(taskSel.value, nameInput.value, picked, prog); }
      }, [UI.icon('export'), h('span', { text: '开始导出' })])
    ]));

    function summary() {
      setTimeout(function () {
        var el = UI.$('#exp-summary');
        if (!el) return;
        var g = byTask[taskSel.value];
        var els = 0, rels = 0;
        g.items.forEach(function (x) { els += x.f.elements.length; rels += x.f.relations.length; });
        el.textContent = g.items.length + ' 份最终版本 · ' + els + ' 个命题 · ' + rels + ' 条关系 · 指南 ' + S.state().guideline;
      }, 0);
    }
    summary();

    wrap.appendChild(panel);
    return wrap;
  }

  function runExport(taskId, name, picked, prog) {
    var formats = Object.keys(picked).filter(function (k) { return picked[k]; });
    if (!formats.length) { UI.toast('请至少选择一种格式', 'seal'); return; }

    var fs = S.finalsOf(S.currentTeam().id).filter(function (f) { return f.taskId === taskId; });
    if (!fs.length) { UI.toast('该任务尚无定稿结果', 'seal'); return; }

    prog.hidden = false;
    UI.clear(prog);
    var label = h('div.tiny.muted', { text: '准备中' });
    var fill = h('span', { style: { width: '0%' } });
    prog.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' } }, [
      h('span.tiny', { text: '导出进度' }), label
    ]));
    prog.appendChild(h('div.bar-track', {}, [fill]));

    var steps = formats.slice(), done = 0, files = [];
    (function next() {
      if (!steps.length) {
        label.textContent = '完成';
        S.addExport({
          teamId: S.currentTeam().id, taskId: taskId, name: name, formats: formats,
          guideline: S.state().guideline, size: humanSize(totalBytes(files)), items: fs.length
        });
        UI.toast('已导出 ' + formats.length + ' 个文件', 'quiet');
        setTimeout(function () { global.go('output', { tab: 'records' }); }, 600);
        return;
      }
      var fmt = steps.shift();
      done++;
      fill.style.width = Math.round(done / formats.length * 100) + '%';
      label.textContent = '正在生成 ' + fmt;
      setTimeout(function () {
        files = files.concat(produce(fmt, name, fs));
        next();
      }, 200);
    })();
  }

  function totalBytes(files) { return files.reduce(function (s, f) { return s + (f.size || 0); }, 0); }
  function humanSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return Math.round(n / 1024) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function produce(fmt, name, fs) {
    var made = [];
    fs.forEach(function (f) {
      var d = S.doc(f.docId);
      var base = name + '_' + (d ? d.short : f.docId);
      if (fmt === 'JSON') made.push(download(base + '.json', buildJSON(f, d), 'application/json'));
      else if (fmt === 'Excel') made.push(download(base + '.csv', buildCSV(f), 'text/csv'));
      else if (fmt === 'SVG') {
        var svg = buildSVG(f);
        if (svg) made.push(download(base + '.svg', svg, 'image/svg+xml'));
      } else if (fmt === 'PNG' || fmt === 'JPG') {
        rasterize(f, base, fmt);
        made.push({ size: 0 });
      }
    });
    return made;
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
    return { name: filename, size: blob.size };
  }

  /* ---- JSON -------------------------------------------------------------- */
  function buildJSON(f, doc) {
    var spans = doc ? S.locate(doc.reason, f.elements) : [];
    var obj = {
      guideline: { id: DATA.GUIDELINE.id, name: DATA.GUIDELINE.name, version: DATA.GUIDELINE.version },
      document: {
        id: f.docId, title: doc ? doc.title : f.docId, kind: doc ? doc.kind : '',
        caseInfo: doc ? doc.meta : {}, reasonText: doc ? doc.reason : ''
      },
      taskId: f.taskId, decidedBy: f.decidedBy, decidedAt: f.decidedAt,
      propositions: f.elements.map(function (e, i) {
        var sp = spans[i];
        var t = DATA.typeByCode(e.code);
        return {
          seq: e.seq, text: e.text,
          charIndex: sp ? { start: sp.start, end: sp.end } : null,
          label: {
            level1: e.code || null, level1Name: t ? t.name : null,
            level2: e.sub || null, level2Name: e.sub ? UI.subName(e.sub) : null
          },
          role: null
        };
      }),
      relations: f.relations.map(function (r) {
        return { id: r.id, formal: Formal.print(r.tree), tree: r.tree, types: Object.keys(Formal.types(r.tree)) };
      }),
      derivedRoles: Formal.deriveRoles(f.elements, f.relations),
      relationMatrix: buildMatrix(f)
    };
    var roleMap = {};
    obj.derivedRoles.forEach(function (r) { roleMap[r.seq] = r.role; });
    obj.propositions.forEach(function (p) { p.role = roleMap[p.seq] || null; });
    return JSON.stringify(obj, null, 2);
  }

  function buildMatrix(f) {
    var seqs = f.elements.map(function (e) { return e.seq; });
    var m = { header: seqs, cells: seqs.map(function () { return seqs.map(function () { return ''; }); }) };
    f.relations.forEach(function (r) {
      var t = r.tree;
      if (t.t === 'S' || t.t === 'A' || t.t === 'M') {
        var a = leaf(t.c[0]), b = leaf(t.c[t.c.length - 1]);
        var i = seqs.indexOf(a), j = seqs.indexOf(b);
        if (i >= 0 && j >= 0) m.cells[i][j] = t.t;
      }
    });
    return m;
    function leaf(n) { return n && n.p ? n.p : (n && n.c && n.c[0] ? leaf(n.c[0]) : ''); }
  }

  /* ---- CSV --------------------------------------------------------------- */
  function buildCSV(f) {
    var rows = [];
    function q(s) { return '"' + String(s === null || s === undefined ? '' : s).replace(/"/g, '""') + '"'; }

    rows.push(['# 指南', DATA.GUIDELINE.name + '（' + DATA.GUIDELINE.version + '）'].map(q).join(','));
    rows.push(['# 任务', f.taskId, '定稿人', f.decidedBy, '定稿时间', f.decidedAt].map(q).join(','));
    rows.push('');
    rows.push(['序号', '命题内容', '一级标签', '一级名称', '二级标签', '二级名称', '字符起', '字符止', '推导角色'].map(q).join(','));

    var doc = S.doc(f.docId);
    var spans = doc ? S.locate(doc.reason, f.elements) : [];
    var roles = Formal.deriveRoles(f.elements, f.relations);
    var roleMap = {};
    roles.forEach(function (r) { roleMap[r.seq] = r.role; });

    f.elements.forEach(function (e, i) {
      var sp = spans[i];
      var t = DATA.typeByCode(e.code);
      rows.push([
        e.seq, e.text, e.code || '', t ? t.name : '', e.sub || '', e.sub ? UI.subName(e.sub) : '',
        sp ? sp.start : '', sp ? sp.end : '', roleMap[e.seq] || ''
      ].map(q).join(','));
    });

    rows.push('');
    rows.push(['关系序号', '形式化表达', '关系类型', '涉及命题'].map(q).join(','));
    f.relations.forEach(function (r) {
      rows.push([r.id, Formal.print(r.tree), Object.keys(Formal.types(r.tree)).join('/'), Formal.props(r.tree).join(' ')].map(q).join(','));
    });

    var m = buildMatrix(f);
    rows.push('');
    rows.push(['关系矩阵（行 → 列）'].map(q).join(','));
    rows.push([''].concat(m.header).map(q).join(','));
    m.cells.forEach(function (row, i) { rows.push([m.header[i]].concat(row).map(q).join(',')); });

    return '﻿' + rows.join('\r\n');
  }

  /* ---- 图示 -------------------------------------------------------------- */
  function buildSVG(f) {
    var lay = Graph.layout(f.elements, f.relations, {});
    var out = Diagram.render(lay, { showBlockLabels: true });
    return Diagram.toSVGString(out.svg, out.width, out.height);
  }

  function rasterize(f, base, fmt) {
    var svgStr = buildSVG(f);
    if (!svgStr) return;
    var img = new Image();
    var url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = function () {
      try {
        var c = document.createElement('canvas');
        var s = 2;
        c.width = img.width * s || 1200;
        c.height = img.height * s || 800;
        var ctx = c.getContext('2d');
        if (fmt === 'JPG') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          if (!b) { UI.toast('位图转换失败，已改为导出 SVG', 'quiet'); download(base + '.svg', svgStr, 'image/svg+xml'); return; }
          var u = URL.createObjectURL(b);
          var a = document.createElement('a');
          a.href = u; a.download = base + '.' + fmt.toLowerCase();
          document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 500);
        }, fmt === 'JPG' ? 'image/jpeg' : 'image/png', 0.94);
      } catch (e) {
        UI.toast('位图转换失败，已改为导出 SVG', 'quiet');
        download(base + '.svg', svgStr, 'image/svg+xml');
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      UI.toast('位图转换失败，已改为导出 SVG', 'quiet');
      download(base + '.svg', svgStr, 'image/svg+xml');
    };
    img.src = url;
  }

  /* ======================================================================
     导出记录
     ====================================================================== */
  function recordsView() {
    var list = S.exportsOf(S.currentTeam().id);
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '导出记录' }),
      h('div.spacer'),
      h('div.pane-note', { text: '记录下载人与所用指南版本' })
    ]));

    if (!list.length) {
      panel.appendChild(h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: '暂无导出记录。' })])
      ]));
      return panel;
    }

    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { text: '文件名' }),
      h('th', { style: { width: '160px' }, text: '任务' }),
      h('th', { style: { width: '150px' }, text: '格式' }),
      h('th', { style: { width: '90px' }, text: '下载人' }),
      h('th', { style: { width: '140px' }, text: '时间' }),
      h('th', { style: { width: '80px' }, text: '指南' })
    ])]));
    var tb = h('tbody');
    list.forEach(function (e) {
      tb.appendChild(h('tr', {}, [
        h('td', {}, [
          h('div', { text: e.name }),
          h('div.tiny.faint', { text: (e.items || 1) + ' 份 · ' + (e.size || '—') })
        ]),
        h('td.tiny.muted', { text: (S.task(e.taskId) || {}).name || '—' }),
        h('td', {}, [h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } },
          e.formats.map(function (f) { return h('span.tag.tag--sm.tag--plain', { text: f }); }))]),
        h('td', { text: S.nameOf(e.by) }),
        h('td.mono.tiny.faint', { text: e.at }),
        h('td.mono.tiny.faint', { text: e.guideline })
      ]));
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    return panel;
  }

  /* ======================================================================
     结果查看
     ====================================================================== */
  function resultView(ctx) {
    var list = finalized();
    if (!list.length) {
      return h('div.panel', {}, [h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: '还没有定稿结果。' })])
      ])]);
    }

    var wrap = h('div');
    var pick = 0;
    if (ctx.params.task) list.forEach(function (x, i) { if (x.task.id === ctx.params.task) pick = i; });
    var cur = list[pick];
    var f = cur.f;

    var seg = h('div.seg', { style: { marginBottom: '16px' } });
    list.forEach(function (x, i) {
      seg.appendChild(h('button' + (i === pick ? '.is-on' : ''), {
        text: x.task.name + ' · ' + (x.doc ? x.doc.short : x.f.docId),
        onclick: function () { global.go('output', { tab: 'result', task: x.task.id }); }
      }));
    });
    wrap.appendChild(seg);

    if (!f.elements.length) {
      wrap.appendChild(h('div.panel', {}, [h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: '该结果未保留命题明细。' })])
      ])]));
      return wrap;
    }

    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: cur.doc ? cur.doc.title : f.docId }),
      h('div.spacer'),
      h('span.badge.badge--ok', { text: '已定稿 ' + f.decidedAt }),
      h('button.btn.btn--sm', { onclick: function () { downloadAll(cur); } },
        [UI.icon('export'), h('span', { text: '下载' })])
    ]));

    var body = h('div.panel-body');
    var did = 'res-diagram';
    body.appendChild(h('div', {
      style: { border: '1px solid var(--rule)', borderRadius: 'var(--r)', background: 'var(--paper-tint)',
               padding: '16px', overflow: 'auto', marginBottom: '18px', display: 'flex', justifyContent: 'center' },
      id: did
    }));

    var roles = Formal.deriveRoles(f.elements, f.relations);
    var roleMap = {};
    roles.forEach(function (r) { roleMap[r.seq] = r; });

    var t1 = h('table.tbl');
    t1.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { style: { width: '50px' }, text: '序号' }),
      h('th', { text: '命题内容' }),
      h('th', { style: { width: '130px' }, text: '标签' }),
      h('th', { style: { width: '86px' }, text: '角色' })
    ])]));
    var tb1 = h('tbody');
    f.elements.forEach(function (e) {
      tb1.appendChild(h('tr', {}, [
        h('td.seq', { text: e.seq }),
        h('td', { style: { fontFamily: 'var(--font-doc)', fontSize: '13.5px', lineHeight: 1.7 }, text: e.text }),
        h('td', {}, [e.code ? UI.elChip(e.code, e.sub || null, { sm: true }) : h('span.tiny.faint', { text: '—' })]),
        h('td.tiny', { text: (roleMap[e.seq] || {}).role || '—' })
      ]));
    });
    t1.appendChild(tb1);
    body.appendChild(h('div', {}, [h('div.section-title', { style: { marginBottom: '8px' }, text: '命题列表' }), t1]));

    var t2 = h('table.tbl', { style: { marginTop: '22px' } });
    t2.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { style: { width: '50px' }, text: '序号' }),
      h('th', { text: '形式化表达' }),
      h('th', { style: { width: '190px' }, text: '关系类型' })
    ])]));
    var tb2 = h('tbody');
    f.relations.forEach(function (r) {
      tb2.appendChild(h('tr', {}, [
        h('td', { text: r.id }),
        h('td.formal', { style: { fontSize: '12.5px' }, text: Formal.print(r.tree) }),
        h('td.tiny', { text: Object.keys(Formal.types(r.tree)).map(function (c) {
          return c + ' ' + (DATA.relationByCode(c) || {}).name;
        }).join(' · ') })
      ]));
    });
    t2.appendChild(tb2);
    body.appendChild(h('div', {}, [h('div.section-title', { style: { marginBottom: '8px' }, text: '关系列表' }), t2]));

    body.appendChild(h('div', { style: { marginTop: '22px' } }, [
      h('div.section-title', { style: { marginBottom: '8px' }, text: 'JSON 结构预览' }),
      h('div.json-peek', { text: prettyPeek(buildJSON(f, cur.doc)) })
    ]));

    panel.appendChild(body);
    wrap.appendChild(panel);

    setTimeout(function () {
      var host = UI.$('#' + did);
      if (!host) return;
      var lay = Graph.layout(f.elements, f.relations, {});
      host.appendChild(Diagram.render(lay, { showBlockLabels: true }).svg);
    }, 0);

    return wrap;
  }

  function prettyPeek(str) {
    var lines = str.split('\n');
    return lines.slice(0, 42).join('\n') + (lines.length > 42 ? '\n  … 共 ' + lines.length + ' 行' : '');
  }

  function downloadAll(cur) {
    produce('JSON', cur.task.name + '_导出', [cur.f]);
    setTimeout(function () { produce('Excel', cur.task.name + '_导出', [cur.f]); }, 300);
  }

  Pages.output = {
    chrome: function (ctx) {
      var tab = ctx.params.tab || 'config';
      var name = { config: '导出配置', records: '导出记录', result: '结果查看' }[tab];
      return { title: '结果输出', sub: name };
    },
    render: render,
    buildJSON: buildJSON,
    buildCSV: buildCSV,
    buildSVG: buildSVG
  };
})(window);
