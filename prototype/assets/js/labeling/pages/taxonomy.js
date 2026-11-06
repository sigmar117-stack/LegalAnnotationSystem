/* ==========================================================================
   labeling/pages/taxonomy.js —— 标签体系
   依《指南 v1.1》的要素类型与关系类型。任务开始后不可变更，导出时带版本号。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.LPages = global.LPages || {};
  var h = UI.h;

  function render() {
    var page = h('div.page');
    page.appendChild(h('div.version-strip', {}, [
      UI.icon('book'),
      h('div', {}, [
        h('div', { text: '当前启用：' + DATA.GUIDELINE.name + '（' + DATA.GUIDELINE.version + '）' }),
        h('div.tiny.faint', { style: { marginTop: '2px' }, text: '标签版本随任务固化，导出数据附带该版本号' })
      ]),
      h('div.spacer'),
      h('span.badge.badge--ink', { text: '生效中' })
    ]));

    page.appendChild(typePanel());
    page.appendChild(relationPanel());
    page.appendChild(nestingPanel());
    return page;
  }

  function typePanel() {
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '要素类型' }),
      h('div.spacer'),
      h('div.pane-note', { text: '命题层 4 类 · 非命题层 2 类' })
    ]));

    var body = h('div.panel-body');

    var grid = h('table.tbl.tbl--fixed', { style: { marginBottom: '22px' } });
    grid.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { style: { width: '80px' } }),
      h('th', { style: { width: '45%' }, text: '个别' }),
      h('th', { style: { width: '45%' }, text: '一般' })
    ])]));
    var gt = h('tbody');
    [['事实', 'SF', 'GF'], ['规范', 'SM', 'GM']].forEach(function (row) {
      var tr = h('tr');
      tr.appendChild(h('td', { style: { fontWeight: 600 }, text: row[0] }));
      [row[1], row[2]].forEach(function (code) {
        var t = DATA.typeByCode(code);
        tr.appendChild(h('td', {}, [
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
            UI.elChip(code, null, { sm: true }),
            h('span', { text: t.name })
          ]),
          h('div.tiny.muted', { style: { marginTop: '5px', lineHeight: 1.6 }, text: t.def })
        ]));
      });
      gt.appendChild(tr);
    });
    grid.appendChild(gt);
    body.appendChild(grid);

    DATA.NON_ELEMENT_TYPES.forEach(function (t) { body.appendChild(typeRow(t)); });
    DATA.ELEMENT_TYPES.forEach(function (t) { body.appendChild(typeRow(t, true)); });

    panel.appendChild(body);
    panel.appendChild(h('div.panel-foot', {}, [
      h('span.tiny.muted', { text: '任务开始后标签体系不可变更，新增标签须在任务创建阶段完成。' })
    ]));
    return panel;
  }

  function typeRow(t, withSubs) {
    var node = h('div.tax-node');
    node.appendChild(h('div.tax-node-head', {}, [
      UI.elChip(t.code, null),
      h('div', {}, [
        h('div', { text: t.name }),
        h('div.tiny.faint', { text: withSubs ? (t.scope + ' · ' + t.group + ' 判断') : '非命题层' })
      ]),
      h('div.spacer'),
      (t.subs && t.subs.length) ? h('span.tag.tag--sm.tag--plain', { text: t.subs.length + ' 个子类型' }) : null
    ]));

    var b = h('div.tax-node-body');
    b.appendChild(h('div', { style: { fontSize: '13px', lineHeight: 1.7, marginBottom: t.subs.length ? '12px' : '4px' }, text: t.def }));

    if (t.mark) b.appendChild(kv('标志性表述', t.mark));
    (t.rules || []).forEach(function (r) { b.appendChild(kv('标注原则', r)); });

    if (withSubs && t.subs.length) {
      var subs = h('div', { style: { marginTop: '10px' } });
      t.subs.forEach(function (s) {
        subs.appendChild(h('div.tax-sub', {}, [
          h('div', {}, [UI.elChip(t.code, s.code, { sm: true })]),
          h('div', { text: s.name }),
          h('div.mark', { text: s.mark })
        ]));
      });
      b.appendChild(subs);
    }
    node.appendChild(b);
    return node;
  }

  function kv(k, v) {
    return h('div', { style: { display: 'grid', gridTemplateColumns: '74px 1fr', gap: '12px', fontSize: '12px', marginBottom: '6px' } }, [
      h('span.faint', { text: k }),
      h('span', { style: { lineHeight: 1.7 }, text: v })
    ]);
  }

  function relationPanel() {
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '关系类型' }),
      h('div.spacer'),
      h('div.pane-note', { text: '5 类' })
    ]));
    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { style: { width: '52px' }, text: '代码' }),
      h('th', { style: { width: '92px' }, text: '名称' }),
      h('th', { style: { width: '160px' }, text: '形式化表达' }),
      h('th', { style: { width: '180px' }, text: '图示特征' }),
      h('th', { text: '逻辑含义' })
    ])]));
    var tb = h('tbody');
    DATA.RELATIONS.forEach(function (r) {
      tb.appendChild(h('tr', {}, [
        h('td', {}, [h('span.mono', { style: { fontWeight: 600 }, text: r.code })]),
        h('td', { text: r.name }),
        h('td.formal', { style: { fontSize: '12px' }, text: r.form }),
        h('td.tiny', {}, [
          h('span.mono', { style: { marginRight: '6px' }, text: r.glyphChar }),
          h('span', { text: r.shape })
        ]),
        h('td.tiny', {}, [
          h('div', { text: r.meaning }),
          r.note ? h('div.faint', { style: { marginTop: '4px' }, text: r.note }) : null
        ])
      ]));
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    return panel;
  }

  function nestingPanel() {
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '嵌套结构' }),
      h('div.spacer'),
      h('div.pane-note', { text: '指南 §5.3 / §6.3' })
    ]));
    var body = h('div.panel-body');

    DATA.NESTINGS.forEach(function (n, i) {
      var samples = ['M(J(P4, P5), P2)', 'J(M(P1, P2), M(P3, P4))', 'S(J(P1, P2), P3)',
                     'S(M(P1, P2), P3)', 'A(P3, S(P1, P2))', 'S(M(J(P1, P2, P3), P4), P5)'][i];
      var lay = Graph.layout(
        ['P1', 'P2', 'P3', 'P4', 'P5'].map(function (s) { return { seq: s }; }),
        [{ id: 'R', tree: Formal.parse(samples) }],
        { propW: 30, propH: 18, relR: 4, gapX: 12, gapY: 26, padX: 4, padY: 4, compGap: 10 }
      );
      var out = Diagram.render(lay, {});

      var node = h('div.tax-node');
      node.appendChild(h('div.tax-node-head', {}, [
        h('span.stage-no', { text: n.sec }),
        h('div', {}, [
          h('div', { text: n.title }),
          h('div.formal.tiny', { style: { marginTop: '2px', color: 'var(--ink-3)' }, text: n.form })
        ])
      ]));
      var b = h('div.tax-node-body', { style: { display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr', gap: '18px', alignItems: 'center' } });
      var fig = h('div', { style: { border: '1px solid var(--rule)', borderRadius: 'var(--r)', background: 'var(--paper-tint)', padding: '6px', display: 'flex', justifyContent: 'center' } });
      fig.appendChild(out.svg);
      b.appendChild(fig);
      b.appendChild(h('div', { style: { fontSize: '13px', lineHeight: 1.75 }, text: n.desc }));
      node.appendChild(b);
      body.appendChild(node);
    });

    panel.appendChild(body);
    return panel;
  }

  Pages.taxonomy = {
    chrome: function () { return { title: '标签体系' }; },
    render: render
  };
})(window);
