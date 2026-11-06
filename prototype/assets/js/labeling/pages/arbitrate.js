/* ==========================================================================
   labeling/pages/arbitrate.js —— 待裁定
   指派给我的裁定条目。标注提交齐了即可比对定稿。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.LPages = global.LPages || {};
  var h = UI.h;
  var S = global.LStore;

  function render() {
    var me = S.currentAccount();
    var list = S.myArbitrations(me.id);
    var page = h('div.page');

    if (!list.length) {
      page.appendChild(h('div.panel', {}, [h('div.panel-body', {}, [
        h('div.empty', {}, [
          h('div.empty-title', { text: '没有指派给你的裁定任务' }),
          h('div.empty-desc', { text: '裁定员由管理员在任务上指定。' })
        ])
      ])]));
      return page;
    }

    var pending = list.filter(function (x) { return !S.finalOf(x.task.id, x.item.docId); });
    var done = list.filter(function (x) { return S.finalOf(x.task.id, x.item.docId); });

    if (pending.length) page.appendChild(table('待裁定', pending, me, false));
    if (done.length) page.appendChild(table('已定稿', done, me, true));
    return page;
  }

  function table(title, list, me, isDone) {
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: title }),
      h('div.spacer'),
      h('div.pane-note', { text: list.length + ' 项' })
    ]));

    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { text: '文书' }),
      h('th', { style: { width: '160px' }, text: '任务' }),
      h('th', { style: { width: '130px' }, text: '版本' }),
      h('th', { style: { width: '130px' }, text: isDone ? '定稿时间' : '提交进度' }),
      h('th', { style: { width: '110px' } })
    ])]));

    var tb = h('tbody');
    list.forEach(function (x) {
      var subs = S.annotationsOf(x.task.id, x.item.docId).filter(function (a) { return a.status === 'submitted'; });
      var need = (x.item.annotators || []).length || 1;
      var rec = S.finalOf(x.task.id, x.item.docId);

      tb.appendChild(h('tr', {}, [
        h('td', {}, [
          h('div', { text: x.doc ? x.doc.title : x.item.docId }),
          h('div.tiny.faint', { text: x.doc ? x.doc.kind : '' })
        ]),
        h('td.tiny.muted', { text: x.task.name }),
        h('td.tiny', { text: subs.length + ' 份已提交' }),
        h('td', {}, [
          isDone
            ? h('span.tiny.mono.faint', { text: rec.decidedAt })
            : h('div.progress', {}, [h('span', { style: { width: Math.min(100, Math.round(subs.length / need * 100)) + '%' } })])
        ]),
        h('td', {}, [
          h('button.btn.btn--sm' + (isDone ? '' : '.btn--primary'), {
            onclick: function () { global.go('review', { task: x.task.id, doc: x.item.docId }); }
          }, [h('span', { text: isDone ? '查看' : '比对裁定' })])
        ])
      ]));
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    return panel;
  }

  Pages.arbitrate = {
    chrome: function () { return { title: '待裁定' }; },
    render: render
  };
})(window);
