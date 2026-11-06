/* ==========================================================================
   teaching/pages/overview.js —— 概览（老师 / 学生两种视图）
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.TPages = global.TPages || {};
  var h = UI.h;
  var S = global.TStore;

  function render() {
    return S.isTeacher() ? teacherView() : studentView();
  }

  /* ---- 老师 -------------------------------------------------------------- */
  function teacherView() {
    var cls = S.currentClass();
    var page = h('div.page');
    var docs = S.docsOf(cls.id);
    var exs = S.allExercisesOf(cls.id);
    var students = cls.members.filter(function (m) { return m.role === 'student'; });
    var drafts = docs.filter(function (d) { return !d.answer; }).length;

    var kpi = h('div.grid-4');
    kpi.appendChild(stat('学生', students.length, '人'));
    kpi.appendChild(stat('文档', docs.length, '份'));
    kpi.appendChild(stat('练习', exs.length, '次'));
    kpi.appendChild(stat('待标答案', drafts, '份', drafts > 0 ? 'seal' : null));
    page.appendChild(kpi);

    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '练习完成情况' }),
      h('div.spacer'),
      h('button.btn.btn--sm.btn--ghost', { onclick: function () { global.go('stats'); } },
        [h('span', { text: '统计' }), UI.icon('arrowRight', 12)])
    ]));

    var body = h('div.panel-body');
    if (!exs.length) {
      body.appendChild(h('div.empty', {}, [h('div.empty-desc', { text: '还没有练习。' })]));
    } else {
      exs.forEach(function (e) {
        var st = S.statsOf(e.id);
        var pct = st.total ? Math.round(st.done / st.total * 100) : 0;
        var row = h('div.progress-row');
        row.appendChild(h('div', { style: { flex: 1, minWidth: 0 } }, [
          h('div', { style: { fontSize: '13px' }, text: e.name }),
          h('div.tiny.faint', { text: '截止 ' + (e.deadline || '—') + (e.published ? ' · 已发布' : ' · 未发布') })
        ]));
        row.appendChild(h('div.progress', { style: { width: '120px' } }, [h('span', { style: { width: pct + '%' } })]));
        row.appendChild(h('div.tiny.mono.muted', { style: { width: '52px', textAlign: 'right' }, text: st.done + '/' + st.total }));
        body.appendChild(row);
      });
    }
    panel.appendChild(body);
    page.appendChild(panel);

    var two = h('div.grid-2');
    two.appendChild(feedPanel());
    two.appendChild(unansweredPanel(docs));
    page.appendChild(two);

    return page;
  }

  function unansweredPanel(docs) {
    var p = h('div.panel');
    p.appendChild(h('div.panel-head', {}, [h('div.panel-title', { text: '未标答案的文档' })]));
    var body = h('div.panel-body');
    var miss = docs.filter(function (d) { return !d.answer; });
    if (!miss.length) body.appendChild(h('div.tiny.faint', { text: '全部文档都已标出标准答案。' }));
    miss.forEach(function (d) {
      body.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--rule)' } }, [
        h('div', { style: { flex: 1, minWidth: 0 } }, [
          h('div', { style: { fontSize: '13px' }, text: d.short }),
          h('div.tiny.faint', { text: d.kind })
        ]),
        h('button.btn.btn--sm', { onclick: function () { global.go('answer', { doc: d.id }); } }, [h('span', { text: '去标' })])
      ]));
    });
    p.appendChild(body);
    return p;
  }

  /* ---- 学生 -------------------------------------------------------------- */
  function studentView() {
    var me = S.currentAccount();
    var page = h('div.page');
    var scores = S.myScores(me.id);

    var todo = 0, done = 0;
    scores.forEach(function (s) {
      s.per.forEach(function (x) {
        if (x.status === 'submitted') done++; else todo++;
      });
    });
    var sims = scores.map(function (s) { return s.average; }).filter(function (v) { return v !== null; });

    var kpi = h('div.grid-3');
    kpi.appendChild(stat('待完成', todo, '项', todo > 0 ? 'seal' : null));
    kpi.appendChild(stat('已完成', done, '项'));
    kpi.appendChild(stat('平均相似率', sims.length ? Math.round(sims.reduce(function (a, b) { return a + b; }, 0) / sims.length) : '—', sims.length ? '%' : ''));
    page.appendChild(kpi);

    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '我的练习' }),
      h('div.spacer'),
      h('button.btn.btn--sm.btn--ghost', { onclick: function () { global.go('exercises'); } },
        [h('span', { text: '全部' }), UI.icon('arrowRight', 12)])
    ]));

    var body = h('div.panel-body');
    if (!scores.length) {
      body.appendChild(h('div.empty', {}, [h('div.empty-desc', { text: '老师还没有发布练习。' })]));
    } else {
      scores.slice(0, 4).forEach(function (s) {
        var total = s.per.length;
        var ok = s.per.filter(function (x) { return x.status === 'submitted'; }).length;
        var row = h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', padding: '11px 0', borderBottom: '1px solid var(--rule)' } }, [
          h('div', { style: { flex: 1, minWidth: 0 } }, [
            h('div', { style: { fontSize: '13px' }, text: s.exercise.name }),
            h('div.tiny.faint', { text: '截止 ' + (s.exercise.deadline || '—') })
          ]),
          h('span.tiny.mono.faint', { text: ok + '/' + total }),
          s.average === null
            ? h('span.badge.badge--muted', { text: '未完成' })
            : h('span.badge' + (s.average >= 80 ? '.badge--ok' : '.badge--warn'), { text: '相似率 ' + s.average + '%' }),
          h('button.btn.btn--sm', {
            onclick: function () { global.go('exercises'); }
          }, [h('span', { text: '进入' })])
        ]);
        body.appendChild(row);
      });
    }
    panel.appendChild(body);
    page.appendChild(panel);
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

  function feedPanel() {
    var p = h('div.panel');
    p.appendChild(h('div.panel-head', {}, [h('div.panel-title', { text: '最近动态' })]));
    var body = h('div.panel-body');
    var feed = h('div.feed');
    var log = S.state().log.slice(0, 6);
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
      return { title: '概览', sub: me.name + ' · ' + S.roleName(S.myRole()) };
    },
    render: render,
    stat: stat
  };
})(window);
