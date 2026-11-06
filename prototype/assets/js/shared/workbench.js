/* ==========================================================================
   shared/workbench.js —— 三栏标注工作台（标注系统与教学系统共用）

     左  原文 · 切割建议 / 要素加框
     中  命题与标签
     右  论证图示 + 关系区

   配置 cfg：
     doc           { title, meta, lead, reason }
     model         { elements, relations }   初始标注
     readonly      只读
     save(model)   任何变更后回调（持久化）
     submitLabel / onSubmit(model)
     docs, currentDocId, onPickDoc(id)       可选的文书切换
     peers         [{ userName, elements }]  颗粒度一致度（可空）
     answer        { elements, relations }   标准答案（可空）
     answerVisible 是否可查看答案
     onBack        返回回调（可空）
   ========================================================================== */
(function (global) {
  'use strict';

  var h = UI.h;
  var wb = null;

  function render(cfg) {
    wb = {
      cfg: cfg,
      doc: cfg.doc,
      readonly: !!cfg.readonly,
      model: cfg.model,
      peers: cfg.peers || [],
      answer: cfg.answer || null,
      answerOn: false,
      mode: (cfg.model.elements && cfg.model.elements.length) ? 'element' : 'cut',
      selectedSeq: null,
      multi: [],
      positions: {},
      colorByType: false,
      connectMode: false,
      scale: 1, tx: 0, ty: 0,
      layout: null,
      cuts: null, cutKept: null,
      spans: [],
      root: null
    };

    wb.cuts = Text.suggestCut(cfg.doc.reason);
    wb.cutKept = wb.cuts.map(function () { return true; });

    var wrap = h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 } });
    wrap.appendChild(taskbar());
    wrap.appendChild(h('div.split.split--3', { id: 'wb-split' }, [
      sourcePane(),
      h('div.gutter', { dataset: { gutter: 'a' } }),
      propPane(),
      h('div.gutter', { dataset: { gutter: 'b' } }),
      diagramPane()
    ]));

    setTimeout(function () { wireGutters(); refreshAll(); }, 0);
    return wrap;
  }

  function save() { if (!wb.readonly && wb.cfg.save) wb.cfg.save(wb.model); }

  /* ======================================================================
     顶部：文书切换 + 四步骤
     ====================================================================== */
  function taskbar() {
    var bar = h('div.wb-taskbar');

    if (wb.cfg.onBack) {
      bar.appendChild(h('button.btn.btn--sm.btn--ghost', { onclick: wb.cfg.onBack },
        [UI.icon('back'), h('span', { text: '返回' })]));
    }

    if (wb.cfg.docs && wb.cfg.docs.length > 1) {
      var dsel = h('select.select.select--sm', { style: { width: '240px' } });
      wb.cfg.docs.forEach(function (d) {
        var o = h('option', { value: d.id, text: d.short + (d.kind ? ' · ' + d.kind : '') });
        if (d.id === wb.cfg.currentDocId) o.selected = true;
        dsel.appendChild(o);
      });
      dsel.addEventListener('change', function () { wb.cfg.onPickDoc(dsel.value); });
      bar.appendChild(dsel);
    } else if (wb.cfg.title) {
      bar.appendChild(h('div.wb-task-title', { text: wb.cfg.title }));
    }

    bar.appendChild(h('div.steps', { id: 'wb-steps' }));
    bar.appendChild(h('div.spacer'));

    if (wb.readonly) {
      bar.appendChild(h('span.badge', {}, [UI.icon('eye'), h('span', { text: '只读' })]));
    } else {
      bar.appendChild(h('button.btn.btn--sm', { onclick: submit },
        [UI.icon('check'), h('span', { text: wb.cfg.submitLabel || '提交' })]));
    }
    return bar;
  }

  function refreshSteps() {
    var host = UI.$('#wb-steps');
    if (!host) return;
    UI.clear(host);

    var m = wb.model;
    var labeled = m.elements.filter(function (e) { return !!e.code; }).length;
    var steps = [
      { n: 1, name: '颗粒度对齐', done: m.elements.length > 0 },
      { n: 2, name: '要素标注',   done: m.elements.length > 0 && labeled === m.elements.length },
      { n: 3, name: '关系标注',   done: m.relations.length > 0 },
      { n: 4, name: '图示生成',   done: m.relations.length > 0 && m.elements.length > 0 }
    ];
    var activeIdx = 0;
    steps.forEach(function (s, i) { if (!s.done) { activeIdx = i; return false; } activeIdx = i; });

    steps.forEach(function (st, i) {
      if (i) host.appendChild(h('span.step-sep', { text: '›' }));
      var btn = h('button.step' + (st.done ? '.is-done' : (i === activeIdx ? '.is-on' : '')), {
        onclick: function () {
          if (i === 0 && !m.elements.length) setMode('cut');
          else if (i === 3) { wb.connectMode = true; refreshDiagramTools(); updateStageCursor(); }
          else { setMode('element'); if (i === 2) { wb.connectMode = true; refreshDiagramTools(); updateStageCursor(); } }
        }
      }, [h('span.n', { text: st.done ? '✓' : String(st.n) }), h('span', { text: st.name })]);
      host.appendChild(btn);
    });
  }

  function setMode(m) {
    wb.mode = m;
    UI.$$('#wb-mode .seg-btn').forEach(function (b) { b.classList.toggle('is-on', b.dataset.mode === m); });
    refreshSource();
  }

  /* ======================================================================
     左栏：原文
     ====================================================================== */
  function sourcePane() {
    var pane = h('div.pane');
    var head = h('div.pane-head', {}, [
      h('div.pane-title', { text: '原文 · 裁判理由' }),
      h('div.spacer'),
      h('div.seg.seg--sm', { id: 'wb-mode' }, [
        segBtn('cut', '切割建议'),
        segBtn('element', '要素标注')
      ])
    ]);
    pane.appendChild(head);
    pane.appendChild(h('div.src-bar', { id: 'wb-srcbar' }));

    var body = h('div.pane-body', { id: 'wb-body' });
    var inner = h('div');
    inner.appendChild(h('div.doc-head', {}, [
      h('div.doc-title', { text: wb.doc.title }),
      h('div.doc-court', { text: docSub() })
    ]));
    inner.appendChild(h('div.src', { id: 'wb-reason' }));
    body.appendChild(inner);
    pane.appendChild(body);

    var stale = UI.$('#wb-selbar');
    if (stale) stale.remove();
    var selbar = h('div.selbar', { id: 'wb-selbar', hidden: true, style: { position: 'fixed' } });
    document.body.appendChild(selbar);

    pane.appendChild(h('div.pane-foot', { id: 'wb-srcfoot' }));

    head.querySelectorAll('.seg-btn').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.dataset.mode); });
    });
    return pane;
  }

  function docSub() {
    var meta = wb.doc.meta || {};
    if (meta['裁判法院'] || meta['案号']) {
      return (meta['裁判法院'] || '') + (meta['案号'] ? '　' + meta['案号'] : '');
    }
    return [wb.doc.kind, meta['入库编号'] || meta['发布时间'] || ''].filter(Boolean).join('　');
  }

  function segBtn(mode, label) {
    return h('button.seg-btn', { dataset: { mode: mode }, text: label });
  }

  function refreshSource() {
    var host = UI.$('#wb-reason');
    if (!host) return;
    UI.clear(host);

    var reason = wb.doc.reason;
    if (wb.doc.lead) host.appendChild(h('span.src-lead', { text: wb.doc.lead }));

    if (wb.mode === 'cut') renderCut(host, reason);
    else renderElements(host, reason);

    var bar = UI.$('#wb-srcbar');
    UI.clear(bar);
    bar.appendChild(h('span.tiny.muted', {
      text: wb.mode === 'cut'
        ? '按句号切分得出候选边界；点击候选可取消，选中文本可手动切出。'
        : (wb.readonly ? '只读' : '选中文字创建命题；先给序号，标签稍后给出。')
    }));
    bar.appendChild(h('div.spacer'));
    if (wb.mode === 'cut') {
      var kept = wb.cutKept.filter(Boolean).length;
      bar.appendChild(h('span.tiny.mono.faint', { text: kept + ' / ' + wb.cuts.length }));
      if (!wb.readonly) {
        bar.appendChild(h('button.btn.btn--sm.btn--primary', { onclick: applyCuts }, [h('span', { text: '应用为要素' })]));
      }
    } else if (!wb.readonly) {
      bar.appendChild(h('button.btn.btn--sm', {
        onclick: function () {
          wb.cuts = Text.suggestCut(reason);
          wb.cutKept = wb.cuts.map(function () { return true; });
          setMode('cut');
        }
      }, [h('span', { text: '重新按句切分' })]));
    }

    var foot = UI.$('#wb-srcfoot');
    UI.clear(foot);
    if (wb.peers.length) {
      var mine = wb.model.elements.length, theirs = wb.peers[0].elements.length;
      var max = Math.max(mine, theirs, 1);
      var gap = Math.abs(mine - theirs) / max * 100;
      var ok = gap <= 10;
      foot.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, [
        h('span.badge' + (ok ? '.badge--ok' : '.badge--warn'), { text: '颗粒度一致度 ' + (100 - Math.round(gap * 10) / 10) + '%' }),
        h('span.tiny.faint', { text: '与 ' + wb.peers[0].userName + ' 的切割差异' + (ok ? '在 10% 以内' : '超过 10%，建议先校准边界') })
      ]));
    }

    bindSourceInteractions();
  }

  function renderCut(host, reason) {
    var cursor = 0;
    wb.cuts.forEach(function (seg, i) {
      if (seg.start > cursor) host.appendChild(document.createTextNode(reason.slice(cursor, seg.start)));
      host.appendChild(h('span.cut' + (wb.cutKept[i] ? '' : '.is-dropped'), {
        dataset: { cut: String(i) },
        title: '点击取消 / 恢复此边界',
        text: reason.slice(seg.start, seg.end)
      }));
      cursor = seg.end;
    });
    if (cursor < reason.length) host.appendChild(document.createTextNode(reason.slice(cursor)));
  }

  function renderElements(host, reason) {
    wb.spans = Text.spansOf(reason, wb.model.elements);
    var cursor = 0;
    wb.spans.forEach(function (sp) {
      if (sp.start > cursor) host.appendChild(document.createTextNode(reason.slice(cursor, sp.start)));
      var node = h('span.el' + (sp.el.code ? '.is-typed' : '.is-bare') + (wb.selectedSeq === sp.seq ? '.is-active' : ''), {
        dataset: { seq: sp.seq },
        title: sp.el.code
          ? (sp.seq + ' · ' + sp.el.code + (sp.el.sub ? ' / ' + sp.el.sub + ' ' + UI.subName(sp.el.sub) : ''))
          : (sp.seq + ' · 未标注')
      });
      node.appendChild(document.createTextNode(reason.slice(sp.start, sp.end)));
      if (sp.el.code) {
        var t = DATA.typeByCode(sp.el.code);
        node.style.borderBottomColor = 'var(--t-' + (t ? t.color : 'non') + ')';
      }
      host.appendChild(node);
      cursor = sp.end;
    });
    if (cursor < reason.length) host.appendChild(document.createTextNode(reason.slice(cursor)));
  }

  function bindSourceInteractions() {
    var host = UI.$('#wb-reason');
    if (!host || host.dataset.bound === '1') return;
    host.dataset.bound = '1';

    host.addEventListener('click', function (ev) {
      var cut = ev.target.closest('.cut');
      if (cut) {
        if (wb.readonly) return;
        var i = Number(cut.dataset.cut);
        wb.cutKept[i] = !wb.cutKept[i];
        refreshSource();
        return;
      }
      var el = ev.target.closest('.el');
      if (el) selectSeq(el.dataset.seq);
    });

    if (wb.readonly) return;
    host.addEventListener('mouseup', function () { setTimeout(showSelbar, 0); });
    host.addEventListener('keyup', function () { setTimeout(showSelbar, 0); });
  }

  function charOffset(container, node, offset) {
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    var total = 0, n;
    while ((n = walker.nextNode())) {
      if (n === node) return total + offset;
      total += n.nodeValue.length;
    }
    return total;
  }

  function currentSelection() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var range = sel.getRangeAt(0);
    var host = UI.$('#wb-reason');
    if (!host || !host.contains(range.startContainer) || !host.contains(range.endContainer)) return null;
    var start = charOffset(host, range.startContainer, range.startOffset);
    var end = charOffset(host, range.endContainer, range.endOffset);
    if (end <= start) return null;
    var text = wb.doc.reason.slice(start, end);
    if (!text.trim()) return null;
    return { start: start, end: end, text: text, rect: range.getBoundingClientRect() };
  }

  function showSelbar() {
    var selbar = UI.$('#wb-selbar');
    if (!selbar) return;
    var sel = currentSelection();
    if (!sel || wb.mode !== 'element' || wb.readonly) { selbar.hidden = true; return; }

    UI.clear(selbar);
    selbar.appendChild(h('span.quote', { text: sel.text.length > 14 ? sel.text.slice(0, 14) + '…' : sel.text }));
    selbar.appendChild(h('span.sep'));
    var dup = overlapWith(sel);
    if (dup) {
      selbar.appendChild(h('span', { style: { padding: '3px 8px', opacity: 0.8 }, text: '与 ' + dup + ' 重叠' }));
    } else {
      selbar.appendChild(h('button', { onclick: function () { createElement(sel); } },
        [h('span', { text: '创建命题' })]));
    }
    selbar.hidden = false;
    selbar.style.left = Math.max(8, Math.min(sel.rect.left, window.innerWidth - selbar.offsetWidth - 8)) + 'px';
    selbar.style.top = Math.max(8, sel.rect.top - selbar.offsetHeight - 8) + 'px';
  }

  function overlapWith(sel) {
    var hit = null;
    wb.spans.forEach(function (sp) {
      if (sel.start < sp.end && sel.end > sp.start) hit = sp.seq;
    });
    return hit;
  }

  function createElement(sel) {
    wb.model.elements.push({ seq: '', code: '', sub: '', text: sel.text, start: sel.start, end: sel.end });
    renumber();
    save();
    window.getSelection().removeAllRanges();
    var selbar = UI.$('#wb-selbar'); if (selbar) selbar.hidden = true;
    refreshAll();
    UI.toast('已创建命题', 'quiet');
  }

  function applyCuts() {
    var kept = wb.cuts.filter(function (_, i) { return wb.cutKept[i]; });
    if (!kept.length) { UI.toast('请至少保留一个边界', 'seal'); return; }
    if (wb.model.elements.length) {
      UI.confirm({
        title: '应用切割结果',
        message: '当前已有 ' + wb.model.elements.length + ' 个要素，应用后将被切割结果替换。',
        detail: '容错方式为「删除 — 重新创建」，不提供撤销。',
        okLabel: '替换', danger: true,
        onOk: function () { doApplyCuts(kept); }
      });
      return;
    }
    doApplyCuts(kept);
  }

  function doApplyCuts(kept) {
    wb.model.elements = kept.map(function (seg) {
      return { seq: '', code: '', sub: '', text: wb.doc.reason.slice(seg.start, seg.end), start: seg.start, end: seg.end };
    });
    wb.model.relations = [];
    renumber();
    save();
    setMode('element');
    refreshAll();
    UI.toast('已生成 ' + wb.model.elements.length + ' 个要素');
  }

  function renumber() {
    var r = Text.renumber(wb.model.elements, wb.model.relations);
    wb.model.elements = r.elements;
    wb.model.relations = r.relations;
    if (wb.selectedSeq && r.map[wb.selectedSeq]) wb.selectedSeq = r.map[wb.selectedSeq];
    else if (wb.selectedSeq && !r.map[wb.selectedSeq]) wb.selectedSeq = null;
  }

  function selectSeq(seq) {
    wb.selectedSeq = seq;
    if (!seq) wb.multi = [];
    refreshProps();
    refreshSourceMarks();
    refreshDiagram();
    refreshLabelPicker();
  }

  function refreshSourceMarks() {
    UI.$$('#wb-reason .el').forEach(function (n) {
      n.classList.toggle('is-active', n.dataset.seq === wb.selectedSeq);
    });
    var target = UI.$('#wb-reason .el.is-active');
    if (target && wb.scrollOnSelect) target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* ======================================================================
     中栏：命题列表 + 标签
     ====================================================================== */
  function propPane() {
    var pane = h('div.pane');
    pane.appendChild(h('div.pane-head', {}, [
      h('div.pane-title', { text: '命题与标签' }),
      h('div.spacer'),
      h('div.pane-note', { id: 'wb-propcount' })
    ]));
    pane.appendChild(h('div.pane-body.pane-body--flush', {}, [h('div.prop-list', { id: 'wb-props' })]));
    pane.appendChild(h('div', { id: 'wb-labelhost', style: { flex: 'none', borderTop: '1px solid var(--rule)', background: 'var(--paper-raised)', maxHeight: '46%', overflow: 'auto' } }));
    return pane;
  }

  function refreshProps() {
    var host = UI.$('#wb-props');
    if (!host) return;
    UI.clear(host);

    var count = UI.$('#wb-propcount');
    var labeled = wb.model.elements.filter(function (e) { return !!e.code; }).length;
    if (count) count.textContent = wb.model.elements.length + ' 条 · 已标注 ' + labeled;

    if (!wb.model.elements.length) {
      host.appendChild(h('div.empty', { style: { padding: '28px 16px' } }, [
        h('div.empty-desc', {
          text: wb.mode === 'cut'
            ? '先在原文区确认切割边界，再点「应用为要素」。'
            : '在原文中选中一段文字，即可创建命题。'
        })
      ]));
      return;
    }

    var roles = Formal.deriveRoles(wb.model.elements, wb.model.relations);
    var roleMap = {};
    roles.forEach(function (r) { roleMap[r.seq] = r; });

    wb.model.elements.forEach(function (e) {
      var r = roleMap[e.seq] || {};
      var item = h('div.prop-item' + (wb.selectedSeq === e.seq ? '.is-active' : '') + (e.code ? '' : '.is-unlabeled'), {
        onclick: function (ev) {
          if (ev.target.closest('.prop-del')) return;
          wb.scrollOnSelect = true;
          selectSeq(e.seq);
        }
      });
      item.appendChild(h('div.prop-seq', { text: e.seq }));

      var mid = h('div', { style: { minWidth: 0 } });
      mid.appendChild(h('div.prop-text', { text: e.text }));
      var meta = h('div.prop-meta');
      if (e.code) meta.appendChild(UI.elChip(e.code, e.sub || null, { sm: true }));
      else meta.appendChild(h('span.tag.tag--sm.tag--unlabeled', { text: '未标注' }));
      if (r.role && r.role !== '未入论证') {
        meta.appendChild(h('span.tag.tag--sm.tag--plain', {
          title: '命题角色由关系结构自动推导', text: r.role
        }));
      }
      if (r.attacked) meta.appendChild(h('span.tag.tag--sm.t-sm', { text: '被反对' }));
      mid.appendChild(meta);
      item.appendChild(mid);

      if (!wb.readonly) {
        item.appendChild(h('button.prop-del', {
          title: '删除命题',
          onclick: function (ev) { ev.stopPropagation(); deleteElement(e.seq); }
        }, [UI.icon('close', 12)]));
      }
      host.appendChild(item);
    });
  }

  function deleteElement(seq) {
    var rel = wb.model.relations.filter(function (r) { return Formal.props(r.tree).indexOf(seq) >= 0; });
    UI.confirm({
      title: '删除命题 ' + seq,
      message: rel.length ? '命题 ' + seq + ' 参与了 ' + rel.length + ' 条关系，删除后这些关系一并移除。' : '确认删除命题 ' + seq + '？',
      okLabel: '删除', danger: true,
      onOk: function () {
        wb.model.elements = wb.model.elements.filter(function (e) { return e.seq !== seq; });
        if (wb.selectedSeq === seq) wb.selectedSeq = null;
        renumber();
        save();
        refreshAll();
      }
    });
  }

  function refreshLabelPicker() {
    var host = UI.$('#wb-labelhost');
    if (!host) return;
    UI.clear(host);

    if (!wb.selectedSeq) {
      host.appendChild(h('div', { style: { padding: '14px 16px' } }, [h('div.tiny.faint', { text: '选中一个命题以设置标签。' })]));
      return;
    }
    var el = wb.model.elements.filter(function (e) { return e.seq === wb.selectedSeq; })[0];
    if (!el) return;

    host.appendChild(h('div.pane-head', { style: { borderBottom: '1px solid var(--rule)' } }, [
      h('div.pane-title', { text: '要素 ' + el.seq }),
      h('div.spacer'),
      el.code ? UI.elChip(el.code, el.sub || null, { sm: true }) : h('span.badge.badge--seal', { text: '未标注' })
    ]));

    var pick = h('div.tax-pick');

    var g0 = h('div.tax-group');
    g0.appendChild(h('div.tax-group-head', {}, [h('span', { text: '非命题要素' })]));
    var o0 = h('div.tax-opts');
    DATA.NON_ELEMENT_TYPES.forEach(function (t) { o0.appendChild(typeChip(t, el)); });
    g0.appendChild(o0);
    pick.appendChild(g0);

    DATA.ELEMENT_TYPES.forEach(function (t) {
      var g = h('div.tax-group');
      g.appendChild(h('div.tax-group-head', {}, [
        h('span', { text: t.name + '（' + t.code + '）' }),
        h('span.tiny.faint', { text: t.scope + ' · ' + t.group })
      ]));
      var opts = h('div.tax-opts');
      opts.appendChild(typeChip(t, el));
      g.appendChild(opts);
      if (t.subs.length && el.code === t.code) {
        var subOpts = h('div.tax-opts', { style: { marginTop: '7px', paddingLeft: '10px', borderLeft: '2px solid var(--rule)' } });
        t.subs.forEach(function (s) { subOpts.appendChild(subChip(t, s, el)); });
        g.appendChild(subOpts);
      }
      pick.appendChild(g);
    });

    pick.appendChild(h('div.callout', { style: { marginTop: '4px' } }, [
      h('div.tiny', { style: { opacity: 0.85, lineHeight: 1.7 },
        text: el.code ? ((DATA.typeByCode(el.code) || {}).def || '') : '命题中「应」「应当」等道义概念是规范判断的典型标志。' })
    ]));

    host.appendChild(pick);
  }

  function typeChip(t, el) {
    var on = el.code === t.code;
    var chip = h('button.chip' + (on ? '.is-on' : ''), {
      onclick: function () {
        if (wb.readonly) return;
        if (el.code === t.code) { el.code = ''; el.sub = ''; }
        else { el.code = t.code; el.sub = t.subs.length ? t.subs[0].code : ''; }
        save();
        refreshProps(); refreshLabelPicker(); refreshDiagram(); refreshSteps(); refreshSource();
      }
    });
    chip.appendChild(h('span.dot.t-' + t.color));
    chip.appendChild(h('span', { text: t.name }));
    chip.appendChild(h('span.code', { text: t.code }));
    return chip;
  }

  function subChip(parent, s, el) {
    var chip = h('button.chip' + (el.sub === s.code ? '.is-on' : ''), {
      title: s.def,
      onclick: function () {
        if (wb.readonly) return;
        el.code = parent.code;
        el.sub = s.code;
        save();
        refreshProps(); refreshLabelPicker(); refreshSource();
      }
    });
    chip.appendChild(h('span', { text: s.name }));
    chip.appendChild(h('span.code', { text: s.code }));
    return chip;
  }

  /* ======================================================================
     右栏：论证图示
     ====================================================================== */
  function diagramPane() {
    var pane = h('div.pane');
    var head = h('div.pane-head', {}, [
      h('div.pane-title', { text: '论证图示' }),
      h('div.diagram-legend', { style: { position: 'static' } }, [
        lg('●', 'S', '支持关系 S(pi, pj)'),
        lg('○', 'A', '反对关系 A(po, pc)'),
        lg('⊕', 'J·M', '组合 J(p1…pn) / 匹配 M(ps, pg)'),
        lg('▭', 'I', '同一关系 I(p1…pn)，框内以「/」分隔')
      ]),
      h('div.spacer'),
      h('div.pane-note', { id: 'wb-diagcount' })
    ]);
    pane.appendChild(head);

    var stage = h('div.diagram-stage', { id: 'wb-stage' });
    stage.appendChild(h('div.diagram-viewport', { id: 'wb-viewport' }));
    stage.appendChild(h('div.diagram-tools', { id: 'wb-tools' }));
    pane.appendChild(stage);

    pane.appendChild(h('div', { id: 'wb-answerhost', hidden: true, style: { flex: 'none', borderTop: '1px solid var(--rule)', background: 'var(--paper-raised)', maxHeight: '46%', overflow: 'auto' } }));
    pane.appendChild(h('div', { id: 'wb-relhost', style: { flex: 'none', borderTop: '1px solid var(--rule)', background: 'var(--paper-raised)', maxHeight: '44%', overflow: 'auto' } }));
    return pane;
  }

  function lg(glyph, label, title) {
    var d = h('div.lg', { title: title || label });
    d.appendChild(h('span.mono', { style: { width: '12px', textAlign: 'center' }, text: glyph }));
    d.appendChild(h('span.mono', { text: label }));
    return d;
  }

  function refreshDiagramTools() {
    var host = UI.$('#wb-tools');
    if (!host) return;
    UI.clear(host);

    if (!wb.readonly) {
      host.appendChild(h('button' + (wb.connectMode ? '.is-on' : ''), {
        title: '连线模式：拖动图元到另一个图元建立关系（也可按住 Shift 拖动）',
        onclick: function () { wb.connectMode = !wb.connectMode; refreshDiagramTools(); updateStageCursor(); }
      }, [UI.icon('link')]));
    }

    host.appendChild(h('button' + (wb.colorByType ? '.is-on' : ''), {
      title: '按命题类型着色（编辑辅助，非指南图元，导出不含）',
      onclick: function () { wb.colorByType = !wb.colorByType; refreshDiagramTools(); refreshDiagram(); }
    }, [UI.icon('eye')]));

    if (wb.answer && wb.cfg.answerVisible) {
      host.appendChild(h('button' + (wb.answerOn ? '.is-on' : ''), {
        title: '对照标准答案',
        onclick: function () { wb.answerOn = !wb.answerOn; refreshDiagramTools(); refreshAnswer(); refreshDiagram(); }
      }, [UI.icon('check')]));
    }

    host.appendChild(h('button', { title: '放大', onclick: function () { zoom(1.2); } }, [UI.icon('zoomIn')]));
    host.appendChild(h('button', { title: '缩小', onclick: function () { zoom(1 / 1.2); } }, [UI.icon('zoomOut')]));
    host.appendChild(h('button', { title: '适应窗口', onclick: function () { wb.userView = false; fit(); } }, [UI.icon('fit')]));
    host.appendChild(h('button', {
      title: '重置图元位置与视图',
      onclick: function () { wb.positions = {}; wb.scale = 1; wb.tx = 0; wb.ty = 0; wb.userView = false; refreshDiagram(); fit(); }
    }, [UI.icon('reset')]));
  }

  function updateStageCursor() {
    var st = UI.$('#wb-stage');
    if (st) st.classList.toggle('is-linking', wb.connectMode);
  }

  function refreshDiagram() {
    var vp = UI.$('#wb-viewport');
    if (!vp) return;

    var count = UI.$('#wb-diagcount');
    if (count) {
      count.textContent = wb.model.relations.length ? wb.model.relations.length + ' 条关系' : '建立关系后自动成图';
    }

    if (UI.$('#wb-linkline-svg')) UI.$('#wb-linkline-svg').remove();

    var layout = Graph.layout(wb.model.elements, wb.model.relations, {});
    wb.layout = layout;

    var typeMap = {};
    wb.model.elements.forEach(function (e) { typeMap[e.seq] = DATA.typeByCode(e.code) || { color: 'non', code: e.code }; });

    var out = Diagram.render(layout, {
      colorByType: wb.colorByType,
      typeOf: function (seq) { return typeMap[seq]; },
      positions: wb.positions,
      selected: wb.selectedSeq,
      showBlockLabels: true,
      onNodeDown: onNodePointerDown,
      onNodeClick: function () { /* 选中在 pointerup 处理，避免与拖拽冲突 */ }
    });

    UI.clear(vp);
    wb.root = out.root;
    vp.appendChild(out.svg);
    applyView();

    var stage = UI.$('#wb-stage');
    if (stage) wireStage(stage);
    if (!wb.fitted && stage && stage.clientWidth > 80) { wb.fitted = true; fit(); }
  }

  function applyView() {
    if (wb.root) wb.root.setAttribute('transform', 'translate(' + wb.tx + ',' + wb.ty + ') scale(' + wb.scale + ')');
  }

  function zoom(k, cx, cy) {
    var st = UI.$('#wb-stage');
    if (!st) return;
    wb.userView = true;
    var rect = st.getBoundingClientRect();
    cx = cx === undefined ? rect.width / 2 : cx;
    cy = cy === undefined ? rect.height / 2 : cy;
    var ns = Math.max(0.3, Math.min(2.6, wb.scale * k));
    var k2 = ns / wb.scale;
    wb.tx = cx - (cx - wb.tx) * k2;
    wb.ty = cy - (cy - wb.ty) * k2;
    wb.scale = ns;
    applyView();
  }

  function fit() {
    var st = UI.$('#wb-stage');
    if (!st || !wb.layout) return;
    var rect = st.getBoundingClientRect();
    var k = Math.min((rect.width - 48) / wb.layout.width, (rect.height - 48) / wb.layout.height, 1.5);
    wb.scale = Math.max(0.78, k);
    wb.tx = Math.max(16, (rect.width - wb.layout.width * wb.scale) / 2);
    var leftover = rect.height - wb.layout.height * wb.scale;
    wb.ty = leftover > 0 ? leftover / 2 : 16;
    applyView();
  }

  /* ---- 标准答案对照 ------------------------------------------------------ */
  function refreshAnswer() {
    var host = UI.$('#wb-answerhost');
    if (!host) return;
    UI.clear(host);
    host.hidden = !wb.answerOn;
    if (!wb.answerOn || !wb.answer) return;

    var sim = Text.similarity(wb.model, wb.answer);

    host.appendChild(h('div.pane-head', { style: { borderBottom: '1px solid var(--rule)' } }, [
      h('div.pane-title', { text: '标准答案' }),
      h('div.spacer'),
      sim === null ? null : h('span.badge' + (sim >= 80 ? '.badge--ok' : sim >= 60 ? '.badge--warn' : '.badge--seal'), { text: '相似率 ' + sim + '%' })
    ]));

    var tbl = h('table.tbl.tbl--compact');
    var tb = h('tbody');
    var map = {};
    wb.model.elements.forEach(function (e) { map[e.seq] = e; });
    (wb.answer.elements || []).forEach(function (a) {
      var m = map[a.seq];
      tb.appendChild(h('tr', {}, [
        h('td.seq', { style: { width: '46px' }, text: a.seq }),
        h('td', { style: { width: '120px' } }, [UI.elChip(a.code, a.sub || null, { sm: true })]),
        h('td', { style: { width: '120px' } }, [m && m.code ? UI.elChip(m.code, m.sub || null, { sm: true }) : h('span.tiny.faint', { text: '未标注' })]),
        h('td.tiny.muted', { text: a.text })
      ]));
    });
    tbl.appendChild(tb);
    host.appendChild(tbl);
  }

  /* ---- 关系区 ------------------------------------------------------------ */
  function refreshRelList() {
    var host = UI.$('#wb-relhost');
    if (!host) return;
    UI.clear(host);

    host.appendChild(h('div.pane-head', { style: { borderBottom: '1px solid var(--rule)' } }, [
      h('div.pane-title', { text: '关系区' }),
      h('div.spacer'),
      wb.readonly ? null : h('button.btn.btn--sm', { onclick: manualRelation },
        [UI.icon('plus'), h('span', { text: '手动添加' })])
    ]));

    if (!wb.model.relations.length) {
      host.appendChild(h('div', { style: { padding: '16px' } }, [
        h('div.tiny.faint', {
          text: wb.readonly
            ? '该版本未标注关系。'
            : '在图中按住 Shift 拖动一个图元到另一个图元建立关系；组合与同一关系可 Ctrl 多选后建立。'
        })
      ]));
      return;
    }

    var list = h('div.rel-list');
    wb.model.relations.forEach(function (r) {
      var codes = Object.keys(Formal.types(r.tree));
      var item = h('div.rel-item');
      item.appendChild(h('div.rel-id', { text: r.id }));
      var form = h('div.rel-form', { text: Formal.print(r.tree) });
      if (Formal.validate(r.tree).length) form.classList.add('is-bad');
      item.appendChild(form);

      var acts = h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } });
      codes.forEach(function (c) {
        acts.appendChild(h('span.mono.tiny', { style: { color: 'var(--ink-3)' }, text: UI.relGlyph(c) + ' ' + c }));
      });
      if (!wb.readonly) {
        acts.appendChild(h('button.rel-del', { title: '删除关系', onclick: function () { removeRelation(r.id); } },
          [UI.icon('close', 12)]));
      }
      item.appendChild(acts);
      list.appendChild(item);
    });
    host.appendChild(list);
  }

  function manualRelation() {
    var names = wb.model.elements.map(function (e) { return e.seq; }).join(', ');
    var input = h('input.input.input--mono', { placeholder: '例如：S(M(J(P4, P5), P2), P6)' });
    var errBox = h('div.tiny', { style: { color: 'var(--seal)', marginTop: '6px', minHeight: '18px' } });
    var preview = h('div.formal', { style: { marginTop: '10px', fontSize: '13px', color: 'var(--ink-2)' } });

    function check() {
      try {
        var t = Formal.parse(input.value);
        var errs = Formal.validate(t);
        if (errs.length) { errBox.textContent = errs[0]; preview.textContent = ''; return null; }
        var missing = Formal.props(t).filter(function (p) {
          return !wb.model.elements.some(function (e) { return e.seq === p; });
        });
        if (missing.length) { errBox.textContent = '引用了不存在的命题：' + missing.join('、'); preview.textContent = ''; return null; }
        errBox.textContent = '';
        preview.textContent = Formal.print(t);
        return t;
      } catch (err) {
        errBox.textContent = err.message;
        preview.textContent = '';
        return null;
      }
    }
    input.addEventListener('input', check);

    UI.modal({
      title: '手动添加关系',
      body: h('div', {}, [
        h('div.tiny.muted', { style: { marginBottom: '10px' }, text: '可用命题：' + names }),
        input, errBox, preview,
        h('div.callout', { style: { marginTop: '14px' } }, [
          h('div.tiny', { style: { opacity: 0.85, lineHeight: 1.7 },
            text: '支持嵌套表达：S(J(p1, p2), p3)　M(J(p4, p5), p2)　A(p3, S(p1, p2))　J(M(p1, p2), M(p3, p4))' })
        ])
      ]),
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: '添加', kind: 'primary',
          onClick: function (close) {
            var t = check();
            if (!t) return;
            if (addRelation(t)) close();
          }
        }
      ]
    });
  }

  function removeRelation(id) {
    wb.model.relations = wb.model.relations.filter(function (r) { return r.id !== id; });
    wb.model.relations.forEach(function (r, i) { r.id = 'R' + (i + 1); });
    save();
    refreshAll();
  }

  function addRelation(tree) {
    var errs = Formal.validate(tree);
    if (errs.length) { UI.toast(errs[0], 'seal'); return false; }
    var label = Formal.print(tree);
    if (wb.model.relations.some(function (r) { return Formal.print(r.tree) === label; })) {
      UI.toast('该关系已存在', 'quiet');
      return false;
    }
    wb.model.relations.push({ id: 'R' + (wb.model.relations.length + 1), tree: tree, label: label });
    wb.model.relations.forEach(function (r, i) { r.id = 'R' + (i + 1); });
    save();
    refreshAll();
    UI.toast('已建立 ' + label, 'quiet');
    return true;
  }

  /* ---- 图示交互 ---------------------------------------------------------- */
  var dragState = null;

  function nodeTerm(node) {
    if (!node) return null;
    if (node.term) return node.term;
    if (node.seq) return { p: node.seq };
    if (node.seqs) return { t: 'I', c: node.seqs.map(function (s) { return { p: s }; }) };
    return null;
  }

  function onNodePointerDown(ev, node) {
    ev.stopPropagation();
    var gEl = ev.currentTarget;

    if (ev.shiftKey || wb.connectMode) {
      if (wb.readonly) { UI.toast('只读版本不可修改关系', 'quiet'); return; }
      dragState = { kind: 'link', from: node, fromEl: gEl };
      startLinkLine(ev, node);
      return;
    }

    if (ev.ctrlKey || ev.metaKey) {
      var idx = wb.multi.indexOf(node.id);
      if (idx >= 0) wb.multi.splice(idx, 1); else wb.multi.push(node.id);
      applyMultiHighlight();
      return;
    }

    dragState = {
      kind: 'move', node: node, el: gEl,
      startX: ev.clientX, startY: ev.clientY,
      base: wb.positions[node.id] || { dx: 0, dy: 0 },
      moved: false
    };
    wb.multi = [];
    applyMultiHighlight();
    if (gEl.setPointerCapture) gEl.setPointerCapture(ev.pointerId);
  }

  function applyMultiHighlight() {
    UI.$$('#wb-viewport .dg-node').forEach(function (n) {
      n.classList.toggle('is-highlight', wb.multi.indexOf(n.dataset.node) >= 0);
    });
    updateMultiBar();
  }

  function updateMultiBar() {
    var bar = UI.$('#wb-multibar');
    if (bar) bar.remove();
    if (wb.multi.length < 2 || wb.readonly) return;

    var terms = wb.multi.map(function (id) {
      var n = wb.layout.nodes.filter(function (x) { return x.id === id; })[0];
      return nodeTerm(n);
    }).filter(Boolean);
    if (terms.length < 2) return;

    var stage = UI.$('#wb-stage');
    var b = h('div.selbar', { id: 'wb-multibar', style: { position: 'absolute', left: '12px', bottom: '12px' } });
    b.appendChild(h('span.quote', { text: '已选 ' + terms.length + ' 项' }));
    b.appendChild(h('span.sep'));
    b.appendChild(h('button', {
      onclick: function () { addRelation({ t: 'J', c: terms }); wb.multi = []; applyMultiHighlight(); }
    }, [h('span', { text: '组合 J' })]));
    b.appendChild(h('button', {
      onclick: function () { addRelation({ t: 'I', c: terms }); wb.multi = []; applyMultiHighlight(); }
    }, [h('span', { text: '同一 I' })]));
    b.appendChild(h('button', { onclick: function () { wb.multi = []; applyMultiHighlight(); } }, [h('span', { text: '取消' })]));
    stage.appendChild(b);
  }

  function startLinkLine(ev, node) {
    var vp = UI.$('#wb-viewport');
    var svg = vp.querySelector('svg');
    var line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('class', 'dg-linkline');
    line.id = 'wb-linkline-svg';
    wb.root.appendChild(line);

    var st = UI.$('#wb-stage').getBoundingClientRect();
    function toSvg(clientX, clientY) {
      return { x: (clientX - st.left - wb.tx) / wb.scale, y: (clientY - st.top - wb.ty) / wb.scale };
    }
    var p0 = { x: node.x, y: node.y };

    function move(e) {
      var p1 = toSvg(e.clientX, e.clientY);
      line.setAttribute('d', 'M' + p0.x + ',' + p0.y + ' L' + p1.x + ',' + p1.y);
    }
    move(ev);

    function up(e) {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      line.remove();
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var tgt = el && el.closest ? el.closest('.dg-node') : null;
      if (!tgt || tgt.dataset.node === node.id) return;
      var targetNode = wb.layout.nodes.filter(function (x) { return x.id === tgt.dataset.node; })[0];
      if (!targetNode) return;
      openRelationPop(e.clientX, e.clientY, node, targetNode);
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  function openRelationPop(cx, cy, src, dst) {
    var old = UI.$('#wb-relpop');
    if (old) old.remove();

    var srcTerm = nodeTerm(src), dstTerm = nodeTerm(dst);
    if (!srcTerm || !dstTerm) { UI.toast('该图元无法作为关系的一端', 'quiet'); return; }

    var pop = h('div.pop', { id: 'wb-relpop' });
    pop.appendChild(h('div.pop-head', {}, [h('span.mono', { text: labelOf(src) + ' → ' + labelOf(dst) })]));

    var body = h('div.pop-body');
    [
      { code: 'S', name: '支持关系', hint: '前者为后者提供理由' },
      { code: 'A', name: '反对关系', hint: '前者否定后者或其支持关系' },
      { code: 'M', name: '匹配关系', hint: '个别判断与一般判断的要件 — 事实对应' }
    ].forEach(function (opt) {
      var tree = { t: opt.code, c: [srcTerm, dstTerm] };
      var btn = h('button.pop-opt', { onclick: function () { pop.remove(); addRelation(tree); } });
      btn.appendChild(h('span.glyph', { text: UI.relGlyph(opt.code) }));
      btn.appendChild(h('div', {}, [
        h('div', { text: opt.name + '（' + opt.code + '）' }),
        h('div.form', { text: Formal.print(tree) })
      ]));
      body.appendChild(btn);
    });
    pop.appendChild(body);
    pop.appendChild(h('div.pop-foot', {}, [
      h('div.tiny.faint', { text: '组合与同一关系：Ctrl 多选图元后使用左下角按钮' })
    ]));

    var stage = UI.$('#wb-stage');
    var srect = stage.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(cx - srect.left, srect.width - 290)) + 'px';
    pop.style.top = Math.max(8, Math.min(cy - srect.top, srect.height - 220)) + 'px';
    stage.appendChild(pop);

    setTimeout(function () {
      document.addEventListener('pointerdown', function off(e) {
        if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('pointerdown', off); }
      });
    }, 0);
  }

  function labelOf(node) {
    if (node.seq) return node.seq;
    if (node.seqs) return node.seqs.join('/');
    if (node.term) return Formal.print(node.term);
    return '?';
  }

  function wireStage(stage) {
    if (stage.dataset.wired) return;
    stage.dataset.wired = '1';

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        if (!wb) { ro.disconnect(); return; }
        if (wb.userView) { ro.disconnect(); return; }
        if (stage.clientWidth > 80 && stage.clientHeight > 80) { wb.fitted = true; fit(); }
      });
      ro.observe(stage);
    }

    stage.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.dg-node') || ev.target.closest('.diagram-tools') || ev.target.closest('.pop')) return;
      dragState = { kind: 'pan', startX: ev.clientX, startY: ev.clientY, base: { tx: wb.tx, ty: wb.ty } };
      stage.classList.add('is-panning');
    });

    stage.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var rect = stage.getBoundingClientRect();
      zoom(ev.deltaY < 0 ? 1.1 : 1 / 1.1, ev.clientX - rect.left, ev.clientY - rect.top);
    }, { passive: false });
  }

  document.addEventListener('pointermove', function (ev) {
    if (!dragState || !wb) return;
    if (dragState.kind === 'pan') {
      wb.userView = true;
      wb.tx = dragState.base.tx + (ev.clientX - dragState.startX);
      wb.ty = dragState.base.ty + (ev.clientY - dragState.startY);
      applyView();
      return;
    }
    if (dragState.kind === 'move') {
      var dx = (ev.clientX - dragState.startX) / wb.scale;
      var dy = (ev.clientY - dragState.startY) / wb.scale;
      if (Math.abs(dx) + Math.abs(dy) > 2) dragState.moved = true;
      wb.positions[dragState.node.id] = { dx: dragState.base.dx + dx, dy: dragState.base.dy + dy };
      dragState.el.setAttribute('transform',
        'translate(' + (dragState.node.x + wb.positions[dragState.node.id].dx) + ',' +
                       (dragState.node.y + wb.positions[dragState.node.id].dy) + ')');
    }
  });

  document.addEventListener('pointerup', function (ev) {
    if (!dragState || !wb) return;
    var st = dragState;
    dragState = null;
    var stage = UI.$('#wb-stage');
    if (stage) stage.classList.remove('is-panning');

    if (st.kind === 'move' && !st.moved && st.node) {
      var term = nodeTerm(st.node);
      if (st.node.seq) { wb.scrollOnSelect = false; selectSeq(st.node.seq); }
      else if (term) {
        wb.selectedSeq = null;
        wb.multi = [st.node.id];
        applyMultiHighlight();
        refreshProps();
      }
    }
    if (st.kind === 'move' && st.moved) {
      var saved = wb.positions;
      var scale = wb.scale, tx = wb.tx, ty = wb.ty;
      refreshDiagram();
      wb.positions = saved;
      wb.scale = scale; wb.tx = tx; wb.ty = ty;
      applyView();
      UI.$$('#wb-viewport .dg-node').forEach(function (n) {
        var p = wb.positions[n.dataset.node];
        if (!p) return;
        var base = wb.layout.nodes.filter(function (x) { return x.id === n.dataset.node; })[0];
        if (!base) return;
        n.setAttribute('transform', 'translate(' + (base.x + p.dx) + ',' + (base.y + p.dy) + ')');
      });
      redrawEdges();
    }
    var pop = UI.$('#wb-relpop');
    if (pop && ev.target.closest && !ev.target.closest('#wb-relpop')) pop.remove();
  });

  function redrawEdges() {
    if (!wb.layout || !wb.root) return;
    var layer = wb.root.querySelector('.diagram-edges');
    if (!layer) return;
    var byId = {};
    UI.$$('#wb-viewport .dg-node').forEach(function (n) {
      var base = wb.layout.nodes.filter(function (x) { return x.id === n.dataset.node; })[0];
      if (!base) return;
      var m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(n.getAttribute('transform')) || [0, base.x, base.y];
      byId[n.dataset.node] = { x: parseFloat(m[1]), y: parseFloat(m[2]), w: base.w, h: base.h };
    });
    UI.clear(layer);
    wb.layout.edges.forEach(function (e) {
      var a = byId[e.from], b = byId[e.to];
      if (!a || !b) return;
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('class', 'dg-edge dg-edge--' + e.kind);
      p.setAttribute('d', edgePath(a, b));
      if (e.kind === 'out') {
        var marker = wb.root.querySelector('marker');
        if (marker) p.setAttribute('marker-end', 'url(#' + marker.id + ')');
      }
      layer.appendChild(p);
    });
  }

  function edgePath(a, b) {
    var x1 = a.x, y1 = a.y + a.h / 2;
    var x2 = b.x, y2 = b.y - b.h / 2 - 1;
    if (y2 - y1 < 12) {
      var mx = (x1 + x2) / 2;
      return 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + 26) + ' ' + mx + ',' + ((y1 + y2) / 2) + ' ' + x2 + ',' + y2;
    }
    var my = y1 + (y2 - y1) * 0.5;
    if (Math.abs(x2 - x1) < 0.8) return 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2;
    return 'M' + x1 + ',' + y1 + ' L' + x1 + ',' + my + ' L' + x2 + ',' + my + ' L' + x2 + ',' + y2;
  }

  /* ======================================================================
     提交
     ====================================================================== */
  function submit() {
    var m = wb.model;
    var unlabeled = m.elements.filter(function (e) { return !e.code; });

    var body = h('div');
    body.appendChild(h('div', { style: { fontSize: '13.5px', lineHeight: 1.8 } }, [
      h('div', { text: '共 ' + m.elements.length + ' 个命题、' + m.relations.length + ' 条关系。' }),
      unlabeled.length
        ? h('div', { style: { color: 'var(--seal)', marginTop: '6px' }, text: '仍有 ' + unlabeled.length + ' 个命题未标注：' + unlabeled.map(function (e) { return e.seq; }).join('、') })
        : h('div', { style: { color: 'var(--ok)', marginTop: '6px' }, text: '全部命题均已标注。' })
    ]));

    var roles = Formal.deriveRoles(m.elements, m.relations);
    var counts = {};
    roles.forEach(function (r) { counts[r.role] = (counts[r.role] || 0) + 1; });
    body.appendChild(h('div', { style: { marginTop: '14px' } }, [
      h('div.section-title', { style: { marginBottom: '6px' }, text: '推导出的命题角色' }),
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        Object.keys(counts).map(function (k) { return h('span.tag.tag--plain', { text: k + ' × ' + counts[k] }); }))
    ]));

    UI.modal({
      title: wb.cfg.submitLabel || '提交',
      body: body,
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: '确认提交', kind: 'primary',
          onClick: function (close) {
            m.elements.forEach(function (e) {
              var sp = wb.spans.filter(function (x) { return x.seq === e.seq; })[0];
              if (sp) { e.start = sp.start; e.end = sp.end; }
            });
            if (wb.cfg.onSubmit) wb.cfg.onSubmit(m);
            close();
          }
        }
      ]
    });
  }

  /* ---- 分栏拖拽 ---------------------------------------------------------- */
  function wireGutters() {
    var split = UI.$('#wb-split');
    if (!split) return;
    UI.$$('.gutter', split).forEach(function (g) {
      g.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        g.classList.add('is-dragging');
        var rect = split.getBoundingClientRect();
        var startA = parseFloat(getComputedStyle(split).getPropertyValue('--col-a')) || 34;
        var startB = parseFloat(getComputedStyle(split).getPropertyValue('--col-b')) || 30;
        var startC = parseFloat(getComputedStyle(split).getPropertyValue('--col-c')) || 36;
        var total = startA + startB + startC;
        var startX = ev.clientX;
        var which = g.dataset.gutter;

        function move(e) {
          var d = (e.clientX - startX) / rect.width * total;
          var a = startA, b = startB, c = startC;
          if (which === 'a') {
            a = Math.max(16, Math.min(startA + startB - 16, startA + d));
            b = startA + startB - a;
          } else {
            b = Math.max(16, Math.min(startB + startC - 16, startB + d));
            c = startB + startC - b;
          }
          split.style.setProperty('--col-a', a + 'fr');
          split.style.setProperty('--col-b', b + 'fr');
          split.style.setProperty('--col-c', c + 'fr');
        }
        function up() {
          g.classList.remove('is-dragging');
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
        }
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });
    });
  }

  function refreshAll() {
    refreshSteps();
    refreshSource();
    refreshProps();
    refreshLabelPicker();
    refreshDiagramTools();
    refreshDiagram();
    refreshAnswer();
    refreshRelList();
    updateStageCursor();
  }

  global.Workbench = { render: render };
})(window);
