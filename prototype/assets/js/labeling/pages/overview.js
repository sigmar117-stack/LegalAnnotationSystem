/* ==========================================================================
   labeling/pages/overview.js —— 概览
   按当前团内身份显示不同的待办与指标。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.LPages = global.LPages || {};
  var h = UI.h;
  var S = global.LStore;

  function render() {
    var me = S.currentAccount();
    var team = S.currentTeam();
    var page = h('div.page');

    /* ---- 指标 ---- */
    var docs = S.docsOf(team.id);
    var tasks = S.tasksOf(team.id);
    var finals = S.finalsOf(team.id);
    var waiting = 0;
    if (S.can('arbitrate', team.id)) {
      waiting = S.myArbitrations(me.id).filter(function (x) {
        return !S.finalOf(x.task.id, x.item.docId);
      }).length;
    }

    var kpi = h('div.grid-4');
    kpi.appendChild(stat('文书', docs.length, '份'));
    kpi.appendChild(stat('任务', tasks.length, '个'));
    kpi.appendChild(stat('成员', team.members.length, '人'));
    kpi.appendChild(stat('待裁定', waiting, '项', waiting > 0 ? 'seal' : null));
    page.appendChild(kpi);

    /* ---- 我的待办 / 待裁定 ---- */
    var mineList = S.myAssignments(me.id);
    if (mineList.length) {
      page.appendChild(assignmentPanel('我的标注待办', mineList.slice(0, 6), 'mine'));
    }
    if (S.can('arbitrate', team.id)) {
      var arb = S.myArbitrations(me.id).filter(function (x) { return !S.finalOf(x.task.id, x.item.docId); });
      if (arb.length) page.appendChild(assignmentPanel('待我裁定', arb.slice(0, 6), 'arbitrate'));
    }

    /* ---- 管理视图 ---- */
    if (S.can('task.manage', team.id)) {
      var two = h('div.grid-2');
      two.appendChild(taskPanel(tasks));
      two.appendChild(feedPanel(S.state().log.slice(0, 6)));
      page.appendChild(two);
    }

    return page;
  }

  function stat(label, value, unit, tone) {
    var c = h('div.stat');
    c.appendChild(h('div.stat-label', {}, [
      h('span', { text: label }),
      h('span.spacer'),
      tone && value > 0 ? h('span.badge.badge--seal', { text: '待处理' }) : null
    ]));
    c.appendChild(h('div.stat-value', {}, [
      h('span', { text: String(value) }),
      h('span.stat-unit', { text: unit })
    ]));
    return c;
  }

  function assignmentPanel(title, list, route) {
    var p = h('div.panel');
    p.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: title }),
      h('div.spacer'),
      h('button.btn.btn--sm.btn--ghost', { onclick: function () { global.go(route); } },
        [h('span', { text: '全部' }), UI.icon('arrowRight', 12)])
    ]));
    var body = h('div.panel-body.panel-body--flush');
    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { text: '文书' }),
      h('th', { style: { width: '150px' }, text: '任务' }),
      h('th', { style: { width: '90px' }, text: '截止' }),
      h('th', { style: { width: '86px' }, text: '状态' })
    ])]));
    var tb = h('tbody');
    list.forEach(function (x) {
      var ann = S.annotationOf(x.task.id, x.item.docId, S.currentAccount().id);
      var st = ann ? ann.status : 'none';
      var ddl = x.item.deadline || x.task.deadline;
      tb.appendChild(h('tr', {
        style: { cursor: 'pointer' },
        onclick: function () {
          if (route === 'mine') global.go('workbench', { task: x.task.id, doc: x.item.docId });
          else global.go('review', { task: x.task.id, doc: x.item.docId });
        }
      }, [
        h('td', {}, [h('div', { text: x.doc ? x.doc.short : x.item.docId })]),
        h('td.tiny.muted', { text: x.task.name }),
        h('td.tiny.mono.muted', { text: ddl || '—' }),
        h('td', {}, [statusBadge(st, S.finalOf(x.task.id, x.item.docId))])
      ]));
    });
    tbl.appendChild(tb);
    body.appendChild(tbl);
    p.appendChild(body);
    return p;
  }

  function statusBadge(status, finalRec) {
    if (finalRec) return h('span.badge.badge--ok', { text: '已定稿' });
    if (status === 'submitted') return h('span.badge.badge--ok', { text: '已提交' });
    if (status === 'draft') return h('span.badge.badge--warn', { text: '草稿' });
    return h('span.badge.badge--muted', { text: '未开始' });
  }

  function taskPanel(tasks) {
    var p = h('div.panel');
    p.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '任务进度' }),
      h('div.spacer'),
      h('button.btn.btn--sm.btn--ghost', { onclick: function () { global.go('tasks'); } },
        [h('span', { text: '管理' }), UI.icon('arrowRight', 12)])
    ]));
    var body = h('div.panel-body');

    if (!tasks.length) {
      body.appendChild(h('div.empty', {}, [h('div.empty-desc', { text: '本团体还没有任务。' })]));
      p.appendChild(body);
      return p;
    }

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

      var row = h('div.progress-row');
      row.appendChild(h('div', { style: { flex: 1, minWidth: 0 } }, [
        h('div', { style: { fontSize: '13px' }, text: t.name }),
        h('div.tiny.faint', { text: t.items.length + ' 篇 · ' + t.items.reduce(function (s, it) { return s + (it.annotators || []).length; }, 0) + ' 项指派' })
      ]));
      row.appendChild(h('div.progress', { style: { width: '120px' } }, [h('span', { style: { width: pct + '%' } })]));
      row.appendChild(h('div.tiny.mono.muted', { style: { width: '52px', textAlign: 'right' }, text: done + '/' + total }));
      body.appendChild(row);
    });

    p.appendChild(body);
    return p;
  }

  function feedPanel(log) {
    var p = h('div.panel');
    p.appendChild(h('div.panel-head', {}, [h('div.panel-title', { text: '最近动态' })]));
    var body = h('div.panel-body');
    var feed = h('div.feed');
    if (!log.length) feed.appendChild(h('div.tiny.faint', { text: '暂无动态' }));
    log.forEach(function (e) {
      var a = S.account(e.accountId);
      feed.appendChild(h('div.feed-item', {}, [
        h('div.feed-dot' + (e.kind ? '.feed-dot--' + e.kind : '')),
        h('div', {}, [
          h('div.feed-text', {}, [
            h('b', { style: { fontWeight: 600 }, text: (a ? a.name : '系统') + ' ' }),
            h('span', { text: e.text })
          ]),
          h('div.feed-time', { text: e.at })
        ])
      ]));
    });
    body.appendChild(feed);
    p.appendChild(body);
    return p;
  }

  Pages.overview = {
    chrome: function () {
      var me = S.currentAccount();
      var t = S.currentTeam();
      return { title: '概览', sub: me.name + ' · ' + ((S.isOwner(t.id) ? '最高管理' : S.myRoles().map(S.roleName).join(' · ')) || '成员') };
    },
    render: render,
    stat: stat,
    statusBadge: statusBadge
  };
})(window);
