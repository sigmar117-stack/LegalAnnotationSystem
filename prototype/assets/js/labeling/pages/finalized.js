/* ==========================================================================
   labeling/pages/finalized.js —— 已定稿
   本团体的定稿记录，可跳到结果输出查看与导出。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.LPages = global.LPages || {};
  var h = UI.h;
  var S = global.LStore;

  function render() {
    var team = S.currentTeam();
    var list = S.finalsOf(team.id).map(function (f) {
      return { f: f, task: S.task(f.taskId), doc: S.doc(f.docId) };
    }).filter(function (x) { return x.task; });

    var page = h('div.page');
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '已定稿' }),
      h('div.spacer'),
      h('div.pane-note', { text: list.length + ' 份' })
    ]));

    if (!list.length) {
      panel.appendChild(h('div.panel-body', {}, [
        h('div.empty', {}, [
          h('div.empty-title', { text: '还没有定稿结果' }),
          h('div.empty-desc', { text: '在「待裁定」中比对多版本并定稿后，结果出现在这里。' })
        ])
      ]));
      page.appendChild(panel);
      return page;
    }

    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { text: '文书' }),
      h('th', { style: { width: '170px' }, text: '任务' }),
      h('th', { style: { width: '90px' }, text: '命题' }),
      h('th', { style: { width: '90px' }, text: '关系' }),
      h('th', { style: { width: '90px' }, text: '定稿人' }),
      h('th', { style: { width: '140px' }, text: '定稿时间' }),
      h('th', { style: { width: '90px' } })
    ])]));

    var tb = h('tbody');
    list.forEach(function (x) {
      tb.appendChild(h('tr', {}, [
        h('td', {}, [
          h('div', { text: x.doc ? x.doc.title : x.f.docId }),
          h('div.tiny.faint', { text: x.doc ? x.doc.kind : '' })
        ]),
        h('td.tiny.muted', { text: x.task.name }),
        h('td.mono.tiny', { text: x.f.elements.length + '' }),
        h('td.mono.tiny', { text: x.f.relations.length + '' }),
        h('td.tiny', { text: S.nameOf(x.f.decidedBy) }),
        h('td.tiny.mono.faint', { text: x.f.decidedAt }),
        h('td', {}, [
          h('button.btn.btn--sm.btn--ghost', {
            onclick: function () { global.go('output', { tab: 'result', task: x.task.id }); }
          }, [h('span', { text: '查看' })])
        ])
      ]));
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    page.appendChild(panel);
    return page;
  }

  Pages.finalized = {
    chrome: function () { return { title: '已定稿' }; },
    render: render
  };
})(window);
