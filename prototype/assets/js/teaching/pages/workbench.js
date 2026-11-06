/* ==========================================================================
   teaching/pages/workbench.js —— 标注练习（下钻页，复用三栏工作台）
   逐篇提交、可重复提交；第一次提交即视为完成。
   已提交且老师已发布时，可对照标准答案。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.TPages = global.TPages || {};
  var h = UI.h;
  var S = global.TStore;

  function render(ctx) {
    var me = S.currentAccount();
    var cls = S.currentClass();

    var exs = S.allExercisesOf(cls.id).filter(function (e) { return e.published; });
    var ex = ctx.params.ex ? S.exercise(ctx.params.ex) : exs[0];
    if (!ex || !ex.published) return missing('没有可作答的练习');

    var docId = ctx.params.doc && ex.docIds.indexOf(ctx.params.doc) >= 0 ? ctx.params.doc : ex.docIds[0];
    var d = S.doc(docId);
    if (!d) return missing('文档不存在');

    var sub = S.submissionOf(ex.id, docId, me.id);
    if (!sub) {
      sub = S.createSubmission(ex.id, docId, me.id);
      S.upsertSubmission(sub);
    }

    function persist(m) {
      sub.elements = m.elements;
      sub.relations = m.relations;
      S.upsertSubmission(sub);
    }

    return Workbench.render({
      doc: { title: d.title, meta: d.meta, lead: d.lead, reason: d.reason },
      model: { elements: sub.elements, relations: sub.relations },
      readonly: false,
      save: persist,
      submitLabel: '提交',
      onSubmit: function (m) {
        persist(m);
        S.submitSubmission(sub);
        var sim = S.similarityOf(ex.id, docId, me.id);
        UI.toast(sim === null ? '已提交' : '已提交 · 相似率 ' + sim + '%', 'quiet');
        global.go('exercises');
      },
      docs: ex.docIds.map(function (id) {
        var x = S.doc(id);
        return { id: id, short: x ? x.short : id, kind: x ? x.kind : '' };
      }),
      currentDocId: docId,
      onPickDoc: function (id) { global.go('workbench', { ex: ex.id, doc: id }); },
      answer: d.answer,
      answerVisible: S.answerVisible(ex.id, docId, me.id),
      onBack: function () { global.go('exercises'); }
    });
  }

  function missing(text) {
    return h('div.page', {}, [
      h('div.panel', {}, [h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: text })])
      ])])
    ]);
  }

  Pages.workbench = {
    flush: true,
    chrome: function (ctx) {
      var ex = ctx.params.ex ? S.exercise(ctx.params.ex) : null;
      return { title: '标注练习', sub: ex ? ex.name : '' };
    },
    render: render
  };
})(window);
