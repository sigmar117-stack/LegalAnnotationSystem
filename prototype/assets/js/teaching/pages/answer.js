/* ==========================================================================
   teaching/pages/answer.js —— 标注标准答案（下钻页，复用三栏工作台）
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.TPages = global.TPages || {};
  var h = UI.h;
  var S = global.TStore;

  function render(ctx) {
    var d = ctx.params.doc ? S.doc(ctx.params.doc) : null;
    if (!d) return missing('文档不存在');
    if (d.classId !== S.currentClass().id) return missing('该文档不属于当前班级');

    var model = d.answer
      ? { elements: S.clone(d.answer.elements), relations: S.clone(d.answer.relations) }
      : { elements: [], relations: [] };

    return Workbench.render({
      doc: { title: d.title, meta: d.meta, lead: d.lead, reason: d.reason },
      model: model,
      readonly: false,
      save: function (m) { S.setAnswer(d.id, { elements: m.elements, relations: m.relations }); },
      submitLabel: '保存答案',
      onSubmit: function (m) {
        S.setAnswer(d.id, { elements: m.elements, relations: m.relations });
        S.log('标注「' + d.short + '」的标准答案', 'doc');
        UI.toast('标准答案已保存', 'quiet');
        global.go('answers');
      },
      title: d.short,
      onBack: function () { global.go('answers'); }
    });
  }

  function missing(text) {
    return h('div.page', {}, [
      h('div.panel', {}, [h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: text })])
      ])])
    ]);
  }

  Pages.answer = {
    flush: true,
    chrome: function (ctx) {
      var d = ctx.params.doc ? S.doc(ctx.params.doc) : null;
      return { title: '标准答案', sub: d ? d.short : '' };
    },
    render: render
  };
})(window);
