/* ==========================================================================
   teaching/pages/exercises.js —— 练习
   老师：创建、发布、结束、看统计
   学生：我的练习，逐篇进入标注
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.TPages = global.TPages || {};
  var h = UI.h;
  var S = global.TStore;

  function render() {
    return S.isTeacher() ? teacherView() : studentView();
  }

  /* ======================================================================
     老师
     ====================================================================== */
  function teacherView() {
    var cls = S.currentClass();
    var page = h('div.page');
    var list = S.allExercisesOf(cls.id);

    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '练习' }),
      h('div.spacer'),
      h('div.pane-note', { text: list.length + ' 次' }),
      h('button.btn.btn--sm.btn--primary', { onclick: function () { exerciseSheet(null); } },
        [UI.icon('plus'), h('span', { text: '发布练习' })])
    ]));

    if (!list.length) {
      panel.appendChild(h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: '还没有练习。' })])
      ]));
      page.appendChild(panel);
      return page;
    }

    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { text: '练习' }),
      h('th', { style: { width: '110px' }, text: '截止' }),
      h('th', { style: { width: '120px' }, text: '完成' }),
      h('th', { style: { width: '130px' }, text: '状态' }),
      h('th', { style: { width: '220px' } })
    ])]));

    var tb = h('tbody');
    list.forEach(function (e) {
      var st = S.statsOf(e.id);
      var pct = st.total ? Math.round(st.done / st.total * 100) : 0;
      tb.appendChild(h('tr', {}, [
        h('td', {}, [
          h('div', { text: e.name }),
          h('div.tiny.faint', { text: e.docIds.length + ' 篇文档' })
        ]),
        h('td.mono.tiny.muted', { text: e.deadline || '—' }),
        h('td', {}, [
          h('div.progress', {}, [h('span', { style: { width: pct + '%' } })]),
          h('div.tiny.faint', { style: { marginTop: '4px' }, text: st.done + ' / ' + st.total + ' 人完成' })
        ]),
        h('td', {}, [
          e.ended ? h('span.badge.badge--muted', { text: '已结束' })
          : e.published ? h('span.badge.badge--ok', { text: '已发布' })
          : h('span.badge.badge--warn', { text: '未发布' })
        ]),
        h('td', {}, [
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, [
            e.published ? null : h('button.btn.btn--sm.btn--primary', {
              onclick: function () {
                UI.confirm({
                  title: '发布练习', okLabel: '发布',
                  message: '发布后全班学生即可看到并作答。',
                  onOk: function () { S.publishExercise(e.id); global.reRender(); }
                });
              }
            }, [h('span', { text: '发布' })]),
            h('button.btn.btn--sm', { onclick: function () { global.go('stats', { ex: e.id }); } }, [h('span', { text: '统计' })]),
            h('button.btn.btn--sm.btn--ghost', { onclick: function () { exerciseSheet(e); } }, [UI.icon('edit')]),
            e.ended ? null : h('button.btn.btn--sm.btn--ghost', {
              title: '提前结束',
              onclick: function () {
                UI.confirm({
                  title: '结束练习', danger: true, okLabel: '结束',
                  message: '结束后学生不能再作答，已提交的结果保留。',
                  onOk: function () { S.endExercise(e.id); global.reRender(); }
                });
              }
            }, [UI.icon('minus')])
          ])
        ])
      ]));
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    page.appendChild(panel);
    return page;
  }

  function exerciseSheet(ex) {
    var cls = S.currentClass();
    var docs = S.docsOf(cls.id);
    var picked = ex ? ex.docIds.slice() : docs.slice(0, 1).map(function (d) { return d.id; });

    var nameInput = h('input.input', { value: ex ? ex.name : '', placeholder: '如：劳务合同纠纷 · 首次练习' });
    var ddl = h('input.input', { type: 'date', value: ex ? (ex.deadline || '') : nextWeek() });
    var auto = h('input', { type: 'checkbox', checked: ex ? ex.autoPublish !== false : true });

    var rowsHost = h('div.assign-list');
    function redraw() {
      UI.clear(rowsHost);
      docs.forEach(function (d) {
        var on = picked.indexOf(d.id) >= 0;
        var row = h('div.assign-row' + (on ? '.is-on' : ''));
        var cb = h('input', { type: 'checkbox', checked: on });
        cb.addEventListener('change', function () {
          var i = picked.indexOf(d.id);
          if (cb.checked) { if (i < 0) picked.push(d.id); }
          else if (i >= 0) picked.splice(i, 1);
          redraw();
        });
        row.appendChild(h('div.assign-doc', {}, [
          cb,
          h('div', { style: { minWidth: 0 } }, [
            h('div', { style: { fontSize: '13px' }, text: d.short }),
            h('div.tiny.faint', { text: (d.answer ? '已有标准答案' : '尚未标答案') + ' · ' + d.reason.length + ' 字' })
          ])
        ]));
        row.appendChild(h('span.tiny.faint', { text: d.kind }));
        rowsHost.appendChild(row);
      });
      if (!docs.length) {
        rowsHost.appendChild(h('div.tiny.faint', { style: { padding: '14px' }, text: '本班还没有文档。' }));
      }
    }
    redraw();

    UI.modal({
      title: ex ? '修改练习' : '发布练习',
      wide: true,
      body: h('div', {}, [
        h('div.grid-2', {}, [
          h('label.field', {}, [h('span.field-label', { text: '练习名称' }), nameInput]),
          h('label.field', {}, [h('span.field-label', { text: '截止日期' }), ddl])
        ]),
        h('div.field', {}, [
          h('span.field-label', { text: '文档' }),
          h('div.tiny.faint', { style: { marginBottom: '10px' }, text: '全班学生都做选中的这几篇。' }),
          rowsHost
        ]),
        h('label.check', { style: { marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' } }, [
          auto, h('span', { text: '截至日期后自动发布答案' })
        ])
      ]),
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: ex ? '保存' : '创建并发布', kind: 'primary',
          onClick: function (close) {
            if (!nameInput.value.trim()) { UI.toast('请填写练习名称', 'seal'); return; }
            if (!picked.length) { UI.toast('请至少选择一篇文档', 'seal'); return; }
            if (ex) {
              S.updateExercise(ex.id, {
                name: nameInput.value.trim(), docIds: picked.slice(),
                deadline: ddl.value, autoPublish: auto.checked
              });
            } else {
              S.addExercise({
                classId: cls.id, name: nameInput.value.trim(), docIds: picked.slice(),
                deadline: ddl.value, autoPublish: auto.checked, published: true
              });
            }
            close();
            UI.toast(ex ? '已保存' : '练习已发布', 'quiet');
            global.reRender();
          }
        }
      ]
    });
  }

  /* ======================================================================
     学生
     ====================================================================== */
  function studentView() {
    var me = S.currentAccount();
    var cls = S.currentClass();
    var page = h('div.page');
    var exs = S.allExercisesOf(cls.id).filter(function (e) { return e.published; });

    if (!exs.length) {
      page.appendChild(h('div.panel', {}, [h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: '老师还没有发布练习。' })])
      ])]));
      return page;
    }

    exs.forEach(function (e) {
      var panel = h('div.panel');
      var total = e.docIds.length;
      var done = e.docIds.filter(function (id) {
        var sub = S.submissionOf(e.id, id, me.id);
        return sub && sub.status === 'submitted';
      }).length;

      panel.appendChild(h('div.panel-head', {}, [
        h('div.panel-title', { text: e.name }),
        h('div.spacer'),
        h('div.pane-note', { text: done + ' / ' + total + ' 已提交' }),
        h('span.tiny.mono.faint', { text: '截止 ' + (e.deadline || '—') })
      ]));

      var tbl = h('table.tbl');
      tbl.appendChild(h('thead', {}, [h('tr', {}, [
        h('th', { text: '文档' }),
        h('th', { style: { width: '110px' }, text: '状态' }),
        h('th', { style: { width: '120px' }, text: '相似率' }),
        h('th', { style: { width: '140px' } })
      ])]));
      var tb = h('tbody');
      e.docIds.forEach(function (docId) {
        var d = S.doc(docId);
        var sub = S.submissionOf(e.id, docId, me.id);
        var st = sub ? sub.status : 'none';
        var visible = S.answerVisible(e.id, docId, me.id);
        var sim = visible ? S.similarityOf(e.id, docId, me.id) : null;

        tb.appendChild(h('tr', {}, [
          h('td', {}, [
            h('div', { text: d ? d.title : docId }),
            h('div.tiny.faint', { text: d ? d.kind : '' })
          ]),
          h('td', {}, [
            st === 'submitted' ? h('span.badge.badge--ok', { text: '已提交' })
            : st === 'draft' ? h('span.badge.badge--warn', { text: '草稿' })
            : h('span.badge.badge--muted', { text: '未开始' })
          ]),
          h('td', {}, [
            sim === null ? h('span.tiny.faint', { text: visible ? '—' : '提交后可看' })
              : h('span.badge' + (sim >= 80 ? '.badge--ok' : sim >= 60 ? '.badge--warn' : '.badge--seal'), { text: sim + '%' })
          ]),
          h('td', {}, [
            h('button.btn.btn--sm' + (st === 'submitted' ? '' : '.btn--primary'), {
              onclick: function () { global.go('workbench', { ex: e.id, doc: docId }); }
            }, [h('span', { text: st === 'submitted' ? '查看' : (st === 'draft' ? '继续' : '开始') })])
          ])
        ]));
      });
      tbl.appendChild(tb);
      panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
      page.appendChild(panel);
    });

    return page;
  }

  function nextWeek() {
    return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  }

  Pages.exercises = {
    chrome: function () {
      return { title: S.isTeacher() ? '练习' : '我的练习' };
    },
    render: render
  };
})(window);
