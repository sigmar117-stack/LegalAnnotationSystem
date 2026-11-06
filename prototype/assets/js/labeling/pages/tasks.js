/* ==========================================================================
   labeling/pages/tasks.js —— 任务创建与分配
   任务是一个管理单位：1 篇到 N 篇文章，人员细分指派到篇，可事后变更。
   需求文档 V0.1.1 §2.5
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.LPages = global.LPages || {};
  var h = UI.h;
  var S = global.LStore;

  var STAGE = ['', '创建', '标注', '裁定', '输出'];

  function render() {
    var team = S.currentTeam();
    var page = h('div.page');

    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '标注任务' }),
      h('div.spacer'),
      h('div.pane-note', { text: S.tasksOf(team.id).length + ' 个' }),
      h('button.btn.btn--sm.btn--primary', { onclick: function () { taskSheet(null); } },
        [UI.icon('plus'), h('span', { text: '新建任务' })])
    ]));

    var tasks = S.tasksOf(team.id);
    if (!tasks.length) {
      panel.appendChild(h('div.panel-body', {}, [
        h('div.empty', {}, [
          h('div.empty-title', { text: '还没有任务' }),
          h('div.empty-desc', { text: '新建任务，选文书、指派标注员与裁定员。' })
        ])
      ]));
      page.appendChild(panel);
      return page;
    }

    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { text: '任务' }),
      h('th', { style: { width: '70px' }, text: '阶段' }),
      h('th', { style: { width: '150px' }, text: '进度' }),
      h('th', { style: { width: '100px' }, text: '截止' }),
      h('th', { style: { width: '116px' } })
    ])]));

    var tb = h('tbody');
    tasks.forEach(function (t) {
      var total = 0, done = 0;
      t.items.forEach(function (it) {
        (it.annotators || []).forEach(function (uid) {
          total++;
          var a = S.annotationOf(t.id, it.docId, uid);
          if (a && a.status === 'submitted') done++;
        });
      });
      var pct = total ? Math.round(done / total * 100) : 0;

      tb.appendChild(h('tr', {}, [
        h('td', {}, [
          h('div', { style: { cursor: 'pointer' }, onclick: function () { detailSheet(t); }, text: t.name }),
          h('div.tiny.faint', {
            text: t.items.length + ' 篇 · ' + t.items.reduce(function (s, it) { return s + (it.annotators || []).length; }, 0)
              + ' 项指派 · ' + peopleOf(t, 'arbiters')
          })
        ]),
        h('td', {}, [h('span.badge' + (t.stage === 4 ? '.badge--ok' : t.stage === 3 ? '.badge--warn' : '.badge--muted'),
          { text: '0' + t.stage + ' ' + STAGE[t.stage] })]),
        h('td', {}, [
          h('div.progress', {}, [h('span', { style: { width: pct + '%' } })]),
          h('div.tiny.faint', { style: { marginTop: '4px' }, text: done + ' / ' + total + ' 项已提交' })
        ]),
        h('td.mono.tiny.muted', { text: t.deadline || '—' }),
        h('td', {}, [
          h('button.btn.btn--sm', { onclick: function () { taskSheet(t); } }, [h('span', { text: '指派' })])
        ])
      ]));
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    page.appendChild(panel);
    return page;
  }

  function peopleOf(t, key) {
    var ids = [];
    t.items.forEach(function (it) {
      (it[key] || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    });
    return ids.map(function (id) { return S.nameOf(id); }).join('、') || '未指派';
  }

  /* ---- 新建 / 指派 -------------------------------------------------------- */
  function taskSheet(task) {
    var team = S.currentTeam();
    var docs = S.docsOf(team.id);
    var members = team.members;

    var picked = {};
    if (task) {
      task.items.forEach(function (it) {
        picked[it.docId] = {
          annotators: (it.annotators || []).slice(),
          arbiters: (it.arbiters || []).slice(),
          deadline: it.deadline || ''
        };
      });
    }

    var nameInput = h('input.input', { value: task ? task.name : '', placeholder: '如：劳务合同纠纷标注任务 A' });
    var ddlInput = h('input.input', { type: 'date', value: task ? (task.deadline || '') : nextWeek() });

    var rowsHost = h('div.assign-list');
    function redraw() {
      UI.clear(rowsHost);
      docs.forEach(function (d) {
        rowsHost.appendChild(assignRow(d, members, picked, redraw));
      });
      if (!docs.length) {
        rowsHost.appendChild(h('div.tiny.faint', { style: { padding: '14px 0' }, text: '本团体还没有文书，请先在「文书与语料」上传。' }));
      }
    }
    redraw();

    var body = h('div', {}, [
      h('div.grid-2', {}, [
        h('label.field', {}, [h('span.field-label', { text: '任务名称' }), nameInput]),
        h('label.field', {}, [h('span.field-label', { text: '统一截止日期' }), ddlInput])
      ]),
      h('div.field', {}, [
        h('span.field-label', { text: '文书与指派' }),
        h('div.tiny.faint', { style: { marginBottom: '10px' } , text: '勾选文书，指定谁标、谁裁；单篇截止留空则沿用统一截止。' }),
        rowsHost
      ])
    ]);

    UI.modal({
      title: task ? '指派 · ' + task.name : '新建任务',
      wide: true, body: body,
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: task ? '保存' : '创建任务', kind: 'primary',
          onClick: function (close) {
            if (!nameInput.value.trim()) { UI.toast('请填写任务名称', 'seal'); return; }
            var items = Object.keys(picked).filter(function (id) {
              return picked[id].annotators.length || picked[id].arbiters.length;
            }).map(function (id) {
              return {
                docId: id,
                annotators: picked[id].annotators.slice(),
                arbiters: picked[id].arbiters.slice(),
                deadline: picked[id].deadline || null
              };
            });
            if (!items.length) { UI.toast('请至少为一篇文书指派标注员', 'seal'); return; }

            if (task) {
              S.updateTask(task.id, { name: nameInput.value.trim(), deadline: ddlInput.value, items: items });
              if (task.stage === 1) S.advanceStage(task.id, 2);
            } else {
              S.addTask({
                teamId: team.id, name: nameInput.value.trim(), deadline: ddlInput.value,
                items: items, stage: 2
              });
            }
            close();
            UI.toast(task ? '已保存指派' : '已创建任务并推送', 'quiet');
            global.reRender();
          }
        }
      ]
    });
  }

  function assignRow(d, members, picked, redraw) {
    var p = picked[d.id];
    var on = !!p;

    var row = h('div.assign-row' + (on ? '.is-on' : ''));

    var check = h('input', { type: 'checkbox', checked: on });
    check.addEventListener('change', function () {
      if (check.checked) {
        picked[d.id] = { annotators: [], arbiters: [], deadline: '' };
      } else {
        delete picked[d.id];
      }
      redraw();
    });

    row.appendChild(h('div.assign-doc', {}, [
      check,
      h('div', { style: { minWidth: 0 } }, [
        h('div', { style: { fontSize: '13px' }, text: d.short }),
        h('div.tiny.faint', { text: d.kind + ' · ' + d.reason.length + ' 字' })
      ])
    ]));

    if (!on) {
      row.appendChild(h('div.tiny.faint', { text: '未指派' }));
      return row;
    }

    var cell = h('div.assign-cells');

    cell.appendChild(h('div.assign-cell', {}, [
      h('span.assign-label', { text: '标注员' }),
      chipPicker(members, p.annotators, function (id) {
        return S.member(S.currentTeam().id, id).roles.indexOf('annotator') >= 0;
      }, redraw)
    ]));
    cell.appendChild(h('div.assign-cell', {}, [
      h('span.assign-label', { text: '裁定员' }),
      chipPicker(members, p.arbiters, function (id) {
        return S.member(S.currentTeam().id, id).roles.indexOf('arbiter') >= 0;
      }, redraw)
    ]));
    cell.appendChild(h('div.assign-cell', {}, [
      h('span.assign-label', { text: '单篇截止' }),
      (function () {
        var inp = h('input.input.input--sm', { type: 'date', value: p.deadline || '' });
        inp.addEventListener('change', function () { p.deadline = inp.value; });
        return inp;
      })()
    ]));

    row.appendChild(cell);
    return row;
  }

  function chipPicker(members, arr, eligible, redraw) {
    var box = h('div.chip-picker');
    var any = false;
    members.forEach(function (m) {
      if (!eligible(m.accountId)) return;
      any = true;
      var on = arr.indexOf(m.accountId) >= 0;
      box.appendChild(h('button.chip-mini' + (on ? '.is-on' : ''), {
        onclick: function () {
          var i = arr.indexOf(m.accountId);
          if (i >= 0) arr.splice(i, 1); else arr.push(m.accountId);
          redraw();
        }
      }, [h('span', { text: S.nameOf(m.accountId) })]));
    });
    if (!any) box.appendChild(h('span.tiny.faint', { text: '本团体尚无此身份成员' }));
    return box;
  }

  /* ---- 任务详情 ---------------------------------------------------------- */
  function detailSheet(t) {
    var body = h('div');
    t.items.forEach(function (it) {
      var d = S.doc(it.docId);
      var box = h('div.detail-item');
      box.appendChild(h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' } }, [
        h('div', { style: { fontSize: '13px' }, text: d ? d.short : it.docId }),
        h('div.spacer'),
        h('span.tiny.mono.faint', { text: it.deadline || t.deadline || '—' })
      ]));

      var tbl = h('table.tbl.tbl--compact');
      tbl.appendChild(h('thead', {}, [h('tr', {}, [
        h('th', { text: '标注员' }),
        h('th', { style: { width: '90px' }, text: '状态' }),
        h('th', { style: { width: '130px' }, text: '提交时间' })
      ])]));
      var tb = h('tbody');
      (it.annotators || []).forEach(function (uid) {
        var a = S.annotationOf(t.id, it.docId, uid);
        var st = a ? a.status : 'none';
        tb.appendChild(h('tr', {}, [
          h('td', { text: S.nameOf(uid) }),
          h('td', {}, [Pages.overview.statusBadge(st, S.finalOf(t.id, it.docId))]),
          h('td.tiny.mono.faint', { text: a && a.submittedAt ? a.submittedAt : '—' })
        ]));
      });
      if (!(it.annotators || []).length) {
        tb.appendChild(h('tr', {}, [h('td.tiny.faint', { colspan: 3, text: '未指派标注员' })]));
      }
      tbl.appendChild(tb);
      box.appendChild(tbl);

      if ((it.arbiters || []).length) {
        box.appendChild(h('div.tiny.faint', { style: { marginTop: '10px' },
          text: '裁定员：' + it.arbiters.map(function (id) { return S.nameOf(id); }).join('、') }));
      }
      body.appendChild(box);
    });

    UI.modal({
      title: t.name, wide: true, body: body,
      actions: [
        { spacer: true },
        {
          label: '指派', onClick: function (close) { close(); taskSheet(t); }
        },
        { label: '关闭' }
      ]
    });
  }

  function nextWeek() {
    return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  }

  Pages.tasks = {
    chrome: function () { return { title: '任务创建与分配' }; },
    render: render
  };
})(window);
