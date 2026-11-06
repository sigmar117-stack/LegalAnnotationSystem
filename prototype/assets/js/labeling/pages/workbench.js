/* ==========================================================================
   labeling/pages/workbench.js —— 标注工作台（下钻页）
   从「我的任务」点进来，针对某一篇被指派的文书标注。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.LPages = global.LPages || {};
  var S = global.LStore;

  function render(ctx) {
    var me = S.currentAccount();
    var team = S.currentTeam();

    var task = ctx.params.task ? S.task(ctx.params.task) : null;
    var mine = S.myAssignments(me.id);

    // 未指定任务时进入第一项待办
    if (!task && mine.length) {
      task = mine[0].task;
      ctx.params.doc = mine[0].item.docId;
    }
    if (!task) return missing('没有指派给你的标注任务');

    var items = task.items.filter(function (it) { return (it.annotators || []).indexOf(me.id) >= 0; });
    if (!items.length) return missing('该任务没有指派给你');

    var docId = ctx.params.doc && items.some(function (it) { return it.docId === ctx.params.doc; })
      ? ctx.params.doc : items[0].docId;

    var doc = S.doc(docId);
    if (!doc) return missing('文书不存在');

    var ann = S.annotationOf(task.id, docId, me.id);
    var readonly = !!ann && ann.status === 'submitted';

    var model = ann ? { elements: ann.elements, relations: ann.relations }
                    : { elements: [], relations: [] };

    function persist(m) {
      if (!ann) {
        ann = S.createAnnotation(task.id, docId, me.id);
        S.upsertAnnotation(ann);
      }
      ann.elements = m.elements;
      ann.relations = m.relations;
      S.upsertAnnotation(ann);
    }

    var peers = S.annotationsOf(task.id, docId).filter(function (a) {
      return a.status === 'submitted' && a.accountId !== me.id;
    }).map(function (a) { return { userName: a.userName, elements: a.elements }; });

    return Workbench.render({
      doc: { title: doc.title, meta: doc.meta, lead: doc.lead, reason: doc.reason },
      model: model,
      readonly: readonly,
      save: persist,
      submitLabel: '提交标注',
      onSubmit: function (m) {
        persist(m);
        S.submitAnnotation(ann);
        UI.toast('已提交', 'quiet');
        global.go('mine');
      },
      docs: items.map(function (it) {
        var d = S.doc(it.docId);
        return { id: it.docId, short: d ? d.short : it.docId, kind: d ? d.kind : '' };
      }),
      currentDocId: docId,
      onPickDoc: function (id) { global.go('workbench', { task: task.id, doc: id }); },
      peers: peers,
      onBack: function () { global.go('mine'); }
    });
  }

  function missing(text) {
    return UI.h('div.page', {}, [
      UI.h('div.panel', {}, [UI.h('div.panel-body', {}, [
        UI.h('div.empty', {}, [UI.h('div.empty-desc', { text: text })])
      ])])
    ]);
  }

  Pages.workbench = {
    flush: true,
    chrome: function (ctx) {
      var t = ctx.params.task ? S.task(ctx.params.task) : null;
      return { title: '标注工作台', sub: t ? t.name : '' };
    },
    render: render
  };
})(window);
