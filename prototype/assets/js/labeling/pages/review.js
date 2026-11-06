/* ==========================================================================
   labeling/pages/review.js —— 裁定：多版本并排比对与定稿

   不自动比对差异所在，由裁定者人工比对；逐条选择认可某一份，或直接重标。
   只有一种标注版本时同样展示本界面，条目只有一条。
   定稿后任务进入阶段四，流程不可回退。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.LPages = global.LPages || {};
  var h = UI.h;
  var S = global.LStore;

  var df = null;

  function render(ctx) {
    var task = ctx.params.task ? S.task(ctx.params.task) : null;
    var myArb = S.myArbitrations(S.currentAccount().id);
    if (!task && myArb.length) { task = myArb[0].task; ctx.params.doc = myArb[0].item.docId; }
    if (!task) return empty('没有待裁定的任务', '管理员指派裁定员后，任务会出现在这里。');

    var docId = ctx.params.doc || task.items[0].docId;
    var versions = S.annotationsOf(task.id, docId).filter(function (a) { return a.status === 'submitted'; });
    var fallback = S.annotationsOf(task.id, docId);

    df = {
      task: task, docId: docId, doc: S.doc(docId),
      versions: versions.length ? versions : fallback,
      picks: {}, custom: {}, relKeep: {},
      final: S.finalOf(task.id, docId)
    };
    buildRelKeep();

    var page = h('div.page');
    page.appendChild(toolbar());
    if (!df.versions.length) {
      page.appendChild(empty('该文书下还没有标注结果', '请先由标注员完成并提交标注。'));
      return page;
    }

    page.appendChild(versionColumns());
    page.appendChild(elementSection());
    page.appendChild(relationSection());

    var foot = h('div.panel');
    foot.appendChild(h('div.panel-foot', {}, [
      h('span.tiny.muted', { text: df.final ? '已定稿 ' + df.final.decidedAt : '定稿后任务进入阶段四，流程不可回退' }),
      h('div.spacer'),
      h('button.btn.btn--seal', { onclick: finalize }, [UI.icon('check'), h('span', { text: df.final ? '重新定稿' : '裁定定稿' })])
    ]));
    page.appendChild(foot);

    return page;
  }

  function empty(title, desc) {
    return h('div.panel', {}, [h('div.panel-body', {}, [
      h('div.empty', {}, [h('div.empty-title', { text: title }), h('div.empty-desc', { text: desc })])
    ])]);
  }

  /* ---- 顶部 -------------------------------------------------------------- */
  function toolbar() {
    var team = S.currentTeam();
    var mine = S.myArbitrations(S.currentAccount().id);
    var bar = h('div.panel');

    var head = h('div.panel-head', {}, [h('div.panel-title', { text: '多版本比对' })]);

    var tsel = h('select.select.select--sm', { style: { width: '200px', marginLeft: '10px' } });
    var seen = {};
    var opts = mine.map(function (x) { return x.task; });
    // 直接跳到某个任务时，它可能不在「指派给我的」列表里，一并列出
    if (!opts.some(function (t) { return t.id === df.task.id; })) opts.unshift(df.task);
    opts.forEach(function (t) {
      if (seen[t.id]) return;
      seen[t.id] = 1;
      var o = h('option', { value: t.id, text: t.name });
      if (t.id === df.task.id) o.selected = true;
      tsel.appendChild(o);
    });
    tsel.addEventListener('change', function () {
      var t = S.task(tsel.value);
      global.go('review', { task: t.id, doc: t.items[0].docId });
    });
    head.appendChild(tsel);

    if (df.task.items.length > 1) {
      var dsel = h('select.select.select--sm', { style: { width: '190px' } });
      df.task.items.forEach(function (it) {
        var d = S.doc(it.docId);
        var o = h('option', { value: it.docId, text: d ? d.short : it.docId });
        if (it.docId === df.docId) o.selected = true;
        dsel.appendChild(o);
      });
      dsel.addEventListener('change', function () { global.go('review', { task: df.task.id, doc: dsel.value }); });
      head.appendChild(dsel);
    }

    head.appendChild(h('div.spacer'));
    head.appendChild(h('span.badge' + (df.final ? '.badge--ok' : '.badge--warn'),
      { text: df.final ? '已定稿' : '待裁定' }));
    bar.appendChild(head);

    var body = h('div.panel-body');
    body.appendChild(h('div.tiny.muted', { text: '并排展示各标注者的结果，逐条选择认可哪一份，或由裁定者重标。' }));
    bar.appendChild(body);
    return bar;
  }

  /* ---- 每版本的小图 ------------------------------------------------------ */
  function versionColumns() {
    var box = h('div.diff-cols', { style: { marginBottom: '16px', gridTemplateColumns: 'repeat(' + df.versions.length + ', minmax(0,1fr))' } });
    df.versions.forEach(function (v) {
      var col = h('div.diff-col');
      col.appendChild(h('div.diff-col-head', {}, [
        h('span.avatar.avatar--sm.avatar--light', { text: v.userName.slice(0, 1) }),
        h('div', {}, [
          h('div', { style: { fontSize: '13px' }, text: v.userName }),
          h('div.tiny.faint', { text: v.submittedAt || '草稿' })
        ]),
        h('div.spacer'),
        h('span.tag.tag--sm.tag--plain', { text: v.elements.length + ' 命题' }),
        h('span.tag.tag--sm.tag--plain', { text: v.relations.length + ' 关系' })
      ]));
      var host = h('div.diff-cell', { style: { display: 'flex', justifyContent: 'center', padding: '10px', minHeight: '120px' } });
      host.appendChild(mini(v));
      col.appendChild(host);
      box.appendChild(col);
    });
    return box;
  }

  function mini(v) {
    if (!v.relations.length) return h('div.tiny.faint', { style: { padding: '10px' }, text: '未标注关系' });
    var lay = Graph.layout(v.elements, v.relations, { propW: 32, propH: 19, relR: 4.5, gapX: 14, gapY: 28, padX: 6, padY: 6, compGap: 18 });
    return Diagram.render(lay, {}).svg;
  }

  /* ---- 命题比对 ---------------------------------------------------------- */
  function elementSection() {
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '命题比对' }),
      h('div.spacer'),
      h('div.pane-note', { text: '按原文顺序排列' })
    ]));
    var body = h('div.panel-body');

    var seqs = [];
    df.versions.forEach(function (v) {
      v.elements.forEach(function (e) { if (seqs.indexOf(e.seq) < 0) seqs.push(e.seq); });
    });
    seqs.sort(function (a, b) { return Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')); });

    seqs.forEach(function (seq) {
      var entries = df.versions.map(function (v) {
        return { v: v, el: v.elements.filter(function (e) { return e.seq === seq; })[0] };
      });
      var present = entries.filter(function (x) { return x.el; });
      var uniform = present.length === df.versions.length && present.every(function (x) {
        return x.el.code === present[0].el.code && (x.el.sub || '') === (present[0].el.sub || '');
      });

      var item = h('div.arb-item');
      item.appendChild(h('div.arb-head' + (uniform && present.length > 1 ? '.is-agree' : ''), {}, [
        h('span.seq', { text: seq }),
        h('span.tiny.muted', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          text: present[0] ? present[0].el.text : '（该版本中不存在此序号）' }),
        uniform && present.length > 1 ? h('span.badge.badge--ok', { text: '一致' }) : null,
        present.length < df.versions.length ? h('span.badge.badge--warn', { text: '部分版本缺少' }) : null
      ]));

      var opts = h('div.arb-opts');
      entries.forEach(function (x) {
        if (!x.el) {
          opts.appendChild(h('div.arb-opt.diff-cell--void', { style: { cursor: 'default' } }, [
            h('div.arb-radio'), h('div.tiny', { text: x.v.userName + '：未标注' })
          ]));
          return;
        }
        var on = df.picks[seq] === x.v.id;
        opts.appendChild(h('div.arb-opt' + (on ? '.is-on' : ''), {
          onclick: function () { df.picks[seq] = x.v.id; delete df.custom[seq]; global.reRender(); }
        }, [
          h('div.arb-radio'),
          h('div', { style: { flex: 1, minWidth: 0 } }, [
            h('div.tiny.faint', { style: { marginBottom: '3px' }, text: x.v.userName }),
            h('div.arb-quote', { text: x.el.text })
          ]),
          h('div', {}, [x.el.code ? UI.elChip(x.el.code, x.el.sub || null, { sm: true })
                                  : h('span.badge.badge--seal', { text: '未标注' })])
        ]));
      });

      if (df.custom[seq]) {
        opts.appendChild(h('div.arb-opt.is-on', { style: { cursor: 'default' } }, [
          h('div.arb-radio'),
          h('div', { style: { flex: 1 } }, [h('div.tiny.faint', { text: '裁定者重标' })]),
          h('div', {}, [UI.elChip(df.custom[seq].code, df.custom[seq].sub || null, { sm: true })])
        ]));
      }
      item.appendChild(opts);

      var bar = h('div', { style: { display: 'flex', gap: '8px', padding: '8px 16px', borderTop: '1px solid var(--rule)', background: 'var(--paper-tint)' } });
      bar.appendChild(h('button.btn.btn--sm', {
        onclick: function () { reLabelSheet(seq, present[0] ? present[0].el : null); }
      }, [UI.icon('edit'), h('span', { text: '重标' })]));
      if (df.picks[seq]) {
        var picked = df.versions.filter(function (v) { return v.id === df.picks[seq]; })[0] || {};
        bar.appendChild(h('span.tiny.muted', { style: { alignSelf: 'center' }, text: '采纳 ' + picked.userName }));
      }
      bar.appendChild(h('div.spacer'));
      bar.appendChild(h('button.btn.btn--sm', {
        onclick: function () { expertSheet(seq); }
      }, [h('span', { text: '提交专家裁决' })]));
      item.appendChild(bar);

      body.appendChild(item);
    });

    panel.appendChild(body);
    return panel;
  }

  function reLabelSheet(seq, el) {
    var cur = df.custom[seq] || { code: el ? el.code : '', sub: el ? el.sub : '', text: el ? el.text : '' };
    var chosen = { code: cur.code, sub: cur.sub };

    var holder = h('div');
    (function redraw() {
      UI.clear(holder);
      DATA.ALL_TYPES.forEach(function (t) {
        var g = h('div.tax-group');
        g.appendChild(h('div.tax-group-head', {}, [h('span', { text: t.name + '（' + t.code + '）' })]));
        var opts = h('div.tax-opts');
        opts.appendChild(chip(t.name, chosen.code === t.code && !chosen.sub, function () {
          chosen.code = t.code; chosen.sub = ''; redraw();
        }));
        (t.subs || []).forEach(function (s) {
          opts.appendChild(chip(s.name + ' ' + s.code, chosen.sub === s.code, function () {
            chosen.code = t.code; chosen.sub = s.code; redraw();
          }));
        });
        g.appendChild(opts);
        holder.appendChild(g);
      });
    })();

    function chip(label, on, fn) {
      return h('button.chip' + (on ? '.is-on' : ''), { onclick: fn }, [h('span', { text: label })]);
    }

    UI.modal({
      title: '裁定者重标 · ' + seq,
      wide: true,
      body: h('div', {}, [
        h('div.tiny.muted', { style: { marginBottom: '14px' }, text: el ? el.text : '' }),
        holder
      ]),
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: '采用此标注', kind: 'primary',
          onClick: function (close) {
            if (!chosen.code) { UI.toast('请选择标签', 'seal'); return; }
            df.custom[seq] = { code: chosen.code, sub: chosen.sub, text: el ? el.text : '' };
            delete df.picks[seq];
            close();
            global.reRender();
          }
        }
      ]
    });
  }

  function expertSheet(seq) {
    var reason = h('textarea.textarea', { placeholder: '记录线下讨论的结论与理由', style: { minHeight: '110px' } });
    UI.modal({
      title: '提交专家裁决 · ' + seq,
      body: reason,
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: '记录', kind: 'primary',
          onClick: function (close) {
            S.log('就 ' + seq + ' 提交专家裁决', 'seal');
            close();
            UI.toast('已记录，等待项目负责人确认', 'quiet');
          }
        }
      ]
    });
  }

  /* ---- 关系比对 ---------------------------------------------------------- */
  function buildRelKeep() {
    var all = [];
    df.versions.forEach(function (v) {
      v.relations.forEach(function (r) {
        var k = Formal.print(r.tree);
        if (all.indexOf(k) < 0) all.push(k);
      });
    });
    df.relStrs = all;
    all.forEach(function (k) { if (df.relKeep[k] === undefined) df.relKeep[k] = true; });
  }

  function relationSection() {
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '关系比对' }),
      h('div.spacer'),
      h('div.pane-note', { text: '勾选进入最终版本' })
    ]));
    var body = h('div.panel-body');

    if (!df.relStrs.length) {
      body.appendChild(h('div.tiny.faint', { text: '各版本均未标注关系。' }));
      panel.appendChild(body);
      return panel;
    }

    var tbl = h('table.tbl');
    var head = h('tr', {}, [h('th', { style: { width: '40px' } }), h('th', { text: '关系' })]);
    df.versions.forEach(function (v) { head.appendChild(h('th', { style: { width: '80px', textAlign: 'center' }, text: v.userName })); });
    tbl.appendChild(h('thead', {}, [head]));

    var tb = h('tbody');
    df.relStrs.forEach(function (k) {
      var tr = h('tr');
      var cb = h('input', { type: 'checkbox', checked: df.relKeep[k] });
      cb.addEventListener('change', function () { df.relKeep[k] = cb.checked; });
      tr.appendChild(h('td', {}, [cb]));
      tr.appendChild(h('td', {}, [
        h('span.formal', { style: { fontSize: '12.5px' }, text: k }),
        h('span.tiny.faint', { style: { marginLeft: '10px' }, text: relKindOf(k) })
      ]));
      df.versions.forEach(function (v) {
        var has = v.relations.some(function (r) { return Formal.print(r.tree) === k; });
        tr.appendChild(h('td', { style: { textAlign: 'center' } }, [
          h('span.mono', { style: { color: has ? 'var(--ok)' : 'var(--ink-5)' }, text: has ? '●' : '—' })
        ]));
      });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    body.appendChild(tbl);
    panel.appendChild(body);
    return panel;
  }

  function relKindOf(str) {
    var names = [];
    ['S', 'A', 'J', 'M', 'I'].forEach(function (c) {
      if (new RegExp('(^|[^A-Z])' + c + '\\(').test(str)) names.push(c + ' ' + (DATA.relationByCode(c) || {}).name);
    });
    return names.join(' · ');
  }

  /* ---- 定稿 -------------------------------------------------------------- */
  function finalize() {
    var seqs = [];
    df.versions.forEach(function (v) { v.elements.forEach(function (e) { if (seqs.indexOf(e.seq) < 0) seqs.push(e.seq); }); });

    var outEls = [];
    seqs.forEach(function (seq) {
      if (df.custom[seq]) {
        var c = df.custom[seq];
        outEls.push({ seq: seq, code: c.code, sub: c.sub, text: c.text });
        return;
      }
      var src = df.picks[seq] ? df.versions.filter(function (v) { return v.id === df.picks[seq]; })[0] : null;
      if (!src) src = df.versions.filter(function (v) {
        return v.elements.some(function (e) { return e.seq === seq; });
      })[0];
      if (!src) return;
      var el = src.elements.filter(function (e) { return e.seq === seq; })[0];
      if (el) outEls.push({ seq: seq, code: el.code, sub: el.sub, text: el.text });
    });

    var outRels = [];
    df.versions.forEach(function (v) {
      v.relations.forEach(function (r) {
        var k = Formal.print(r.tree);
        if (!df.relKeep[k]) return;
        if (outRels.some(function (x) { return Formal.print(x.tree) === k; })) return;
        outRels.push({ id: 'R' + (outRels.length + 1), tree: r.tree, label: k });
      });
    });

    UI.confirm({
      title: '裁定定稿',
      message: '最终版本将包含 ' + outEls.length + ' 个命题、' + outRels.length + ' 条关系。',
      detail: '定稿后任务进入阶段四「结果输出」，流程不可回退。',
      okLabel: '确认定稿', danger: true,
      onOk: function () {
        S.setFinal(df.task.id, df.docId, {
          elements: outEls, relations: outRels,
          source: df.versions.map(function (v) { return v.id; })
        });
        S.advanceStage(df.task.id, 4);
        S.log('裁定「' + df.task.name + '」并定稿', 'seal');
        UI.toast('已定稿', 'quiet');
        global.go('finalized');
      }
    });
  }

  Pages.review = {
    flush: false,
    chrome: function (ctx) {
      var t = ctx.params.task ? S.task(ctx.params.task) : null;
      return { title: '裁定', sub: t ? t.name : '' };
    },
    render: render
  };
})(window);
