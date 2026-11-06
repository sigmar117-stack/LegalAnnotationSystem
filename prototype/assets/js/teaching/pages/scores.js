/* ==========================================================================
   teaching/pages/scores.js —— 我的成绩（学生）
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.TPages = global.TPages || {};
  var h = UI.h;
  var S = global.TStore;

  function render() {
    var me = S.currentAccount();
    var page = h('div.page');
    var scores = S.myScores(me.id);

    if (!scores.length) {
      page.appendChild(h('div.panel', {}, [h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: '还没有完成的练习。' })])
      ])]));
      return page;
    }

    scores.forEach(function (s) {
      var panel = h('div.panel');
      panel.appendChild(h('div.panel-head', {}, [
        h('div.panel-title', { text: s.exercise.name }),
        h('div.spacer'),
        s.average === null
          ? h('span.badge.badge--muted', { text: '未完成' })
          : h('span.badge' + (s.average >= 80 ? '.badge--ok' : '.badge--warn'), { text: '相似率 ' + s.average + '%' })
      ]));

      var tbl = h('table.tbl');
      tbl.appendChild(h('thead', {}, [h('tr', {}, [
        h('th', { text: '文档' }),
        h('th', { style: { width: '110px' }, text: '状态' }),
        h('th', { style: { width: '150px' }, text: '相似率' }),
        h('th', { style: { width: '110px' } })
      ])]));
      var tb = h('tbody');
      s.per.forEach(function (x) {
        tb.appendChild(h('tr', {}, [
          h('td', {}, [
            h('div', { text: x.doc ? x.doc.title : x.docId }),
            h('div.tiny.faint', { text: x.doc ? x.doc.kind : '' })
          ]),
          h('td', {}, [
            x.status === 'submitted' ? h('span.badge.badge--ok', { text: '已提交' })
            : x.status === 'draft' ? h('span.badge.badge--warn', { text: '草稿' })
            : h('span.badge.badge--muted', { text: '未开始' })
          ]),
          h('td', {}, [
            x.similarity === null
              ? h('span.tiny.faint', { text: '提交后可见' })
              : h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
                  h('div.progress', { style: { width: '70px' } }, [h('span', { style: { width: x.similarity + '%' } })]),
                  h('span.tiny.mono', { text: x.similarity + '%' })
                ])
          ]),
          h('td', {}, [
            h('button.btn.btn--sm', {
              onclick: function () { global.go('workbench', { ex: s.exercise.id, doc: x.docId }); }
            }, [h('span', { text: '查看' })])
          ])
        ]));
      });
      tbl.appendChild(tb);
      panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
      page.appendChild(panel);
    });

    return page;
  }

  Pages.scores = {
    chrome: function () { return { title: '我的成绩' }; },
    render: render
  };
})(window);
