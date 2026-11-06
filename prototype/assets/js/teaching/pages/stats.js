/* ==========================================================================
   teaching/pages/stats.js —— 统计（老师）
   按练习查看：完成人数、平均相似率、已完成 / 未完成名单、相似率排行。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.TPages = global.TPages || {};
  var h = UI.h;
  var S = global.TStore;

  function render(ctx) {
    var cls = S.currentClass();
    var exs = S.allExercisesOf(cls.id);
    var page = h('div.page');

    if (!exs.length) {
      page.appendChild(h('div.panel', {}, [h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: '还没有练习。' })])
      ])]));
      return page;
    }

    var pick = 0;
    if (ctx.params.ex) exs.forEach(function (e, i) { if (e.id === ctx.params.ex) pick = i; });

    if (exs.length > 1) {
      var seg = h('div.seg', { style: { marginBottom: '18px' } });
      exs.forEach(function (e, i) {
        seg.appendChild(h('button' + (i === pick ? '.is-on' : ''), {
          text: e.name,
          onclick: function () { global.go('stats', { ex: e.id }); }
        }));
      });
      page.appendChild(seg);
    }

    var ex = exs[pick];
    var st = S.statsOf(ex.id);
    var pct = st.total ? Math.round(st.done / st.total * 100) : 0;

    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: ex.name }),
      h('div.spacer'),
      h('span.badge' + (ex.published ? '.badge--ok' : '.badge--warn'), { text: ex.published ? '已发布' : '未发布' }),
      h('span.tiny.mono.faint', { text: '截止 ' + (ex.deadline || '—') })
    ]));

    var body = h('div.panel-body');

    var kpi = h('div.grid-3', { style: { marginBottom: '22px' } });
    kpi.appendChild(Pages.overview.stat('完成人数', st.done + ' / ' + st.total, '人'));
    kpi.appendChild(Pages.overview.stat('平均相似率', st.average === null ? '—' : st.average, st.average === null ? '' : '%'));
    kpi.appendChild(Pages.overview.stat('未完成', st.total - st.done, '人', st.total - st.done > 0 ? 'seal' : null));
    body.appendChild(kpi);

    body.appendChild(h('div.progress', { style: { marginBottom: '24px' } }, [h('span', { style: { width: pct + '%' } })]));

    var ranked = st.rows.slice().sort(function (a, b) {
      if (a.average === null && b.average === null) return 0;
      if (a.average === null) return 1;
      if (b.average === null) return -1;
      return b.average - a.average;
    });

    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { style: { width: '50px' }, text: '#' }),
      h('th', { text: '学生' }),
      h('th', { style: { width: '110px' }, text: '状态' }),
      h('th', { style: { width: '140px' }, text: '相似率' })
    ])]));
    var tb = h('tbody');
    ranked.forEach(function (r, i) {
      tb.appendChild(h('tr', {}, [
        h('td.mono.tiny.faint', { text: r.done ? String(i + 1) : '—' }),
        h('td', {}, [
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
            h('span.avatar.avatar--sm.avatar--light', { text: r.name.slice(0, 1) }),
            h('div', {}, [
              h('div', { text: r.name }),
              h('div.tiny.faint', { text: r.per.map(function (x) {
                return (x.status === 'submitted' ? '已提交' : x.status === 'draft' ? '草稿' : '未开始');
              }).join(' / ') })
            ])
          ])
        ]),
        h('td', {}, [
          r.done ? h('span.badge.badge--ok', { text: '已完成' }) : h('span.badge.badge--muted', { text: '未完成' })
        ]),
        h('td', {}, [
          r.average === null
            ? h('span.tiny.faint', { text: '—' })
            : h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
                h('div.progress', { style: { width: '70px' } }, [h('span', { style: { width: r.average + '%' } })]),
                h('span.tiny.mono', { text: r.average + '%' })
              ])
        ])
      ]));
    });
    tbl.appendChild(tb);
    body.appendChild(tbl);

    body.appendChild(h('div.tiny.faint', { style: { marginTop: '16px' },
      text: '相似率衡量学生标注与标准答案的重合度，覆盖命题、标签与关系。' }));

    panel.appendChild(body);
    page.appendChild(panel);
    return page;
  }

  Pages.stats = {
    chrome: function () { return { title: '统计' }; },
    render: render
  };
})(window);
