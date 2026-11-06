/* ==========================================================================
   teaching/pages/answers.js —— 标准答案（老师）
   标准答案由老师用同一套标注界面标出，存放在文档之下。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.TPages = global.TPages || {};
  var h = UI.h;
  var S = global.TStore;

  function render() {
    var cls = S.currentClass();
    var docs = S.docsOf(cls.id);
    var page = h('div.page');

    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '标准答案' }),
      h('div.spacer'),
      h('div.pane-note', { text: docs.filter(function (d) { return d.answer; }).length + ' / ' + docs.length + ' 已标' })
    ]));

    if (!docs.length) {
      panel.appendChild(h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: '先在「文档库」上传文档。' })])
      ]));
      page.appendChild(panel);
      return page;
    }

    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { text: '文档' }),
      h('th', { style: { width: '200px' }, text: '标准答案' }),
      h('th', { style: { width: '150px' } })
    ])]));
    var tb = h('tbody');
    docs.forEach(function (d) {
      tb.appendChild(h('tr', {}, [
        h('td', {}, [
          h('div', { text: d.title }),
          h('div.tiny.faint', { text: d.kind + ' · ' + d.reason.length + ' 字' })
        ]),
        h('td', {}, [
          d.answer
            ? h('div', {}, [
                h('span.badge.badge--ok', { text: d.answer.elements.length + ' 命题 · ' + d.answer.relations.length + ' 关系' }),
                h('div.tiny.faint.mono', { style: { marginTop: '5px' },
                  text: d.answer.relations.slice(0, 2).map(function (r) { return Formal.print(r.tree); }).join('  ') })
              ])
            : h('span.badge.badge--muted', { text: '未标注' })
        ]),
        h('td', {}, [
          h('button.btn.btn--sm' + (d.answer ? '' : '.btn--primary'), {
            onclick: function () { global.go('answer', { doc: d.id }); }
          }, [h('span', { text: d.answer ? '修改' : '标注答案' })])
        ])
      ]));
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    panel.appendChild(h('div.panel-foot', {}, [
      h('span.tiny.muted', { text: '标准答案决定相似率的基准；练习发布后再修改，会影响尚未提交学生的比对结果。' })
    ]));
    page.appendChild(panel);
    return page;
  }

  Pages.answers = {
    chrome: function () { return { title: '标准答案' }; },
    render: render
  };
})(window);
