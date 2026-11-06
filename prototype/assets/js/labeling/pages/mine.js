/* ==========================================================================
   labeling/pages/mine.js —— 我的任务
   管理员指派给我（标注员身份）的任务，按任务分组，点进去是标注工作台。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.LPages = global.LPages || {};
  var h = UI.h;
  var S = global.LStore;

  function render() {
    var me = S.currentAccount();
    var list = S.myAssignments(me.id);
    var page = h('div.page');

    if (!list.length) {
      page.appendChild(h('div.panel', {}, [
        h('div.panel-body', {}, [
          h('div.empty', {}, [
            h('div.empty-title', { text: '没有指派给你的标注任务' }),
            h('div.empty-desc', { text: '任务由管理员分配；未指定给你时不会出现在这里。' })
          ])
        ])
      ]));
      return page;
    }

    /* 按任务分组 */
    var groups = [];
    var index = {};
    list.forEach(function (x) {
      if (!index[x.task.id]) { index[x.task.id] = { task: x.task, items: [] }; groups.push(index[x.task.id]); }
      index[x.task.id].items.push(x);
    });

    groups.forEach(function (g) {
      var panel = h('div.panel');
      var total = g.items.length;
      var done = g.items.filter(function (x) {
        var a = S.annotationOf(x.task.id, x.item.docId, me.id);
        return a && a.status === 'submitted';
      }).length;

      panel.appendChild(h('div.panel-head', {}, [
        h('div.panel-title', { text: g.task.name }),
        h('div.spacer'),
        h('div.pane-note', { text: done + ' / ' + total + ' 已提交' }),
        h('span.tiny.mono.faint', { text: '截止 ' + (g.task.deadline || '—') })
      ]));

      var tbl = h('table.tbl');
      tbl.appendChild(h('thead', {}, [h('tr', {}, [
        h('th', { text: '文书' }),
        h('th', { style: { width: '110px' }, text: '状态' }),
        h('th', { style: { width: '110px' }, text: '截止' }),
        h('th', { style: { width: '140px' } })
      ])]));
      var tb = h('tbody');
      g.items.forEach(function (x) {
        var ann = S.annotationOf(x.task.id, x.item.docId, me.id);
        var st = ann ? ann.status : 'none';
        var ddl = x.item.deadline || g.task.deadline;
        var finalRec = S.finalOf(x.task.id, x.item.docId);

        tb.appendChild(h('tr', {}, [
          h('td', {}, [
            h('div', { text: x.doc ? x.doc.title : x.item.docId }),
            h('div.tiny.faint', { text: x.doc ? (x.doc.kind + ' · ' + x.doc.reason.length + ' 字') : '' })
          ]),
          h('td', {}, [Pages.overview.statusBadge(st, finalRec)]),
          h('td.tiny.mono.muted', { text: ddl || '—' }),
          h('td', {}, [
            h('button.btn.btn--sm' + (st === 'submitted' ? '' : '.btn--primary'), {
              onclick: function () { global.go('workbench', { task: x.task.id, doc: x.item.docId }); }
            }, [h('span', { text: st === 'submitted' ? '查看' : (st === 'draft' ? '继续标注' : '开始标注') })])
          ])
        ]));
      });
      tbl.appendChild(tb);
      panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
      page.appendChild(panel);
    });

    return page;
  }

  Pages.mine = {
    chrome: function () { return { title: '我的任务' }; },
    render: render
  };
})(window);
