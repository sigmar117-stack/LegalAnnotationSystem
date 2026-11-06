/* ==========================================================================
   labeling/app.js —— 标注系统的三段外壳

     未登录  →  登录 / 注册
     已登录无团体  →  创建团体 / 加入团体
     已登录有团体  →  侧边栏按团内身份动态渲染 + 工作区

   需求文档 V0.1.1 §1 §2.1–§2.4
   ========================================================================== */
(function (global) {
  'use strict';

  var h = UI.h;
  var S = global.LStore;

  /* ---- 导航（按团内身份过滤） -------------------------------------------- */
  var NAV = [
    { items: [{ id: 'overview', name: '概览' }] },
    {
      group: '管理区', items: [
        { id: 'docs',     name: '文书与语料',   cap: 'doc.manage' },
        { id: 'taxonomy', name: '标签体系',     cap: 'doc.manage' },
        { id: 'tasks',    name: '任务创建与分配', cap: 'task.manage' },
        { id: 'members',  name: '成员与身份',   cap: 'member.manage' },
        { id: 'output',   name: '结果输出',     cap: 'output' }
      ]
    },
    {
      group: '标注区', items: [
        { id: 'mine', name: '我的任务', cap: 'annotate' }
      ]
    },
    {
      group: '裁定区', items: [
        { id: 'arbitrate', name: '待裁定', cap: 'arbitrate' },
        { id: 'finalized', name: '已定稿', cap: 'arbitrate' }
      ]
    }
  ];

  var ctx = { path: 'overview', params: {} };

  /* ---- 路由 -------------------------------------------------------------- */
  function parseHash() {
    var raw = (location.hash || '#/overview').replace(/^#\/?/, '');
    var qs = '', qi = raw.indexOf('?');
    if (qi >= 0) { qs = raw.slice(qi + 1); raw = raw.slice(0, qi); }
    var params = {};
    qs.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
      params[k] = i < 0 ? '1' : decodeURIComponent(kv.slice(i + 1));
    });
    return { path: raw || 'overview', params: params };
  }

  function go(path, params) {
    var qs = params ? Object.keys(params)
      .filter(function (k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&') : '';
    location.hash = '#/' + path + (qs ? '?' + qs : '');
  }

  function pages() { return global.LPages || {}; }

  /* ======================================================================
     未登录：登录 / 注册
     ====================================================================== */
  function renderGate() {
    var root = h('div.auth');
    var demo = h('div.auth-demo');
    ['a-wang', 'a-chen', 'a-li', 'a-zhang', 'a-zhao', 'a-sun'].forEach(function (id) {
      var a = S.account(id);
      if (!a) return;
      var teamN = S.state().teams.filter(function (t) {
        return t.ownerId === a.id || t.members.some(function (m) { return m.accountId === a.id; });
      }).length;
      demo.appendChild(h('button.demo-row', {
        onclick: function () {
          document.getElementById('lg-email').value = a.email;
          document.getElementById('lg-pass').value = a.password;
          document.getElementById('lg-form').requestSubmit();
        }
      }, [
        h('span.avatar.avatar--sm.avatar--light', { text: a.name.slice(0, 1) }),
        h('div', { style: { flex: 1, minWidth: 0 } }, [
          h('div', { style: { fontSize: '13px' }, text: a.name }),
          h('div.tiny.faint', { text: a.title })
        ]),
        h('span.tiny.mono.faint', { text: teamN + ' 团' })
      ]));
    });

    var email = h('input.input', { id: 'lg-email', value: 'wangmin@lawlab.cn', autocomplete: 'username' });
    var pass = h('input.input', { id: 'lg-pass', type: 'password', value: 'demo2026', autocomplete: 'current-password' });

    var form = h('form', {
      id: 'lg-form',
      onsubmit: function (ev) {
        ev.preventDefault();
        var r = S.login(email.value, pass.value);
        if (!r.ok) { UI.toast(r.reason, 'seal'); return; }
        go('overview');
        render();
      }
    }, [
      h('label.field', {}, [h('span.field-label', { text: '邮箱' }), email]),
      h('label.field', {}, [h('span.field-label', { text: '密码' }), pass]),
      h('button.btn.btn--primary.btn--block', { type: 'submit', style: { height: '36px', marginTop: '20px' } }, [
        h('span', { text: '登录' })
      ])
    ]);

    var card = h('div.auth-card');
    card.appendChild(h('div.auth-tabs', {}, [
      h('button.is-on', { text: '登录' }),
      h('button', {
        text: '注册申请',
        onclick: function () { registerSheet(); }
      })
    ]));
    card.appendChild(form);
    card.appendChild(h('div.hr', { style: { margin: '24px 0 16px' } }));
    card.appendChild(h('div.field-label', { style: { marginBottom: '10px' }, text: '演示账号' }));
    card.appendChild(demo);
    card.appendChild(h('p.tiny.faint', { style: { marginTop: '16px', lineHeight: 1.7 },
      text: '注册申请由开发维护方审核。' }));

    root.appendChild(brandPane());
    root.appendChild(h('section.auth-right', {}, [card]));
    return root;
  }

  function registerSheet() {
    var name = h('input.input', { placeholder: '真实姓名' });
    var email = h('input.input', { placeholder: 'name@example.com' });
    var org = h('input.input', { placeholder: '单位' });
    UI.modal({
      title: '注册申请',
      body: h('div', {}, [
        h('label.field', {}, [h('span.field-label', { text: '真实姓名' }), name]),
        h('label.field', {}, [h('span.field-label', { text: '邮箱' }), email]),
        h('label.field', {}, [h('span.field-label', { text: '单位' }), org])
      ]),
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: '提交申请', kind: 'primary',
          onClick: function (close) {
            if (!name.value.trim() || !email.value.trim()) { UI.toast('请填写姓名与邮箱', 'seal'); return; }
            S.register({ name: name.value.trim(), email: email.value.trim(), org: org.value.trim() });
            close();
            UI.toast('申请已提交，等待开发维护方审核', 'quiet');
          }
        }
      ]
    });
  }

  function brandPane() {
    var box = h('section.auth-left', {}, [
      h('div.auth-brand', {}, [
        h('div.mark', { text: '论' }),
        h('div', {}, [
          h('div.auth-brand-name', { text: '裁判文书论证结构标记系统' }),
          h('div.auth-brand-sub', { text: '标注系统' })
        ])
      ]),
      h('div.auth-lede', {}, [
        h('p', { text: '以团体为单位开展标注：管理员上传文书、配置标签、分配任务，标注员独立标注，裁定者比对定稿。' })
      ])
    ]);
    return box;
  }

  /* ======================================================================
     已登录未选团体：创建 / 加入 / 选择
     ====================================================================== */
  function renderTeamLayer() {
    var me = S.currentAccount();
    var teams = S.myTeams();
    var body = h('div.team-layer');

    var head = h('div.team-layer-head', {}, [
      h('div.auth-brand', {}, [
        h('div.mark', { text: '论' }),
        h('div', {}, [
          h('div.auth-brand-name', { text: '标注系统' }),
          h('div.auth-brand-sub', { text: me.name + ' · ' + me.org })
        ])
      ]),
      h('div.spacer'),
      h('button.btn.btn--sm.btn--ghost', { onclick: function () { S.logout(); location.href = 'index.html'; } },
        [UI.icon('logout'), h('span', { text: '退出' })])
    ]);
    body.appendChild(head);

    var main = h('div.team-layer-body');

    if (teams.length) {
      main.appendChild(h('div.section-title', { style: { marginBottom: '14px' }, text: '我的团体' }));
      var list = h('div.team-list');
      teams.forEach(function (t) {
        var m = S.member(t.id, me.id);
        var isOwner = t.ownerId === me.id;
        var roles = isOwner ? ['最高管理'] : (m ? m.roles.map(S.roleName) : []);
        var row = h('button.team-row', {
          onclick: function () { S.setActiveTeam(t.id); go('overview'); render(); }
        });
        row.appendChild(h('div.team-row-main', {}, [
          h('div.team-row-name', { text: t.name }),
          h('div.team-row-meta', {}, [
            h('span.tiny.faint', { text: S.docsOf(t.id).length + ' 份文书' }),
            h('span.dot-sep'),
            h('span.tiny.faint', { text: S.tasksOf(t.id).length + ' 个任务' }),
            h('span.dot-sep'),
            h('span.tiny.faint', { text: t.members.length + ' 名成员' })
          ])
        ]));
        row.appendChild(h('div.team-row-roles', {}, roles.map(function (r) {
          return h('span.role-chip.role-chip--' + (isOwner ? 'admin' : (m.roles[0] || 'annotator')), { text: r });
        })));
        row.appendChild(UI.icon('arrowRight'));
        list.appendChild(row);
      });
      main.appendChild(list);
      main.appendChild(h('div.section-title', { style: { margin: '28px 0 14px' }, text: '其他' }));
    } else {
      main.appendChild(h('div.team-empty', {}, [
        h('div.team-empty-title', { text: '你还没有加入任何团体' }),
        h('div.team-empty-desc', { text: '创建一个新团体，或用管理员给你的身份码加入。' })
      ]));
    }

    var actions = h('div.team-actions');
    actions.appendChild(actionCard('创建团体', '创建后你将成为该团体的最高管理', 'plus', function () { createTeamSheet(); }));
    actions.appendChild(actionCard('加入团体', '输入管理员提供的身份码', 'link', function () { joinTeamSheet(); }));
    main.appendChild(actions);

    body.appendChild(main);
    return body;
  }

  function actionCard(title, desc, icon, fn) {
    return h('button.team-action', { onclick: fn }, [
      h('div.team-action-ico', {}, [UI.icon(icon, 16)]),
      h('div', {}, [
        h('div', { style: { fontSize: '14px' }, text: title }),
        h('div.tiny.faint', { style: { marginTop: '3px' }, text: desc })
      ])
    ]);
  }

  function createTeamSheet() {
    var name = h('input.input', { placeholder: '如：法律论证实验室' });
    UI.modal({
      title: '创建团体',
      body: h('label.field', {}, [h('span.field-label', { text: '团体名称' }), name]),
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: '创建', kind: 'primary',
          onClick: function (close) {
            if (!name.value.trim()) { UI.toast('请填写团体名称', 'seal'); return; }
            var t = S.createTeam(name.value.trim());
            close();
            UI.toast('已创建「' + t.name + '」，身份码 ' + t.inviteCode, 'quiet');
            go('overview'); render();
          }
        }
      ]
    });
  }

  function joinTeamSheet() {
    var code = h('input.input.input--mono', { placeholder: '如 LAW-2026' });
    var note = h('input.input', { placeholder: '选填，便于管理员识别' });
    UI.modal({
      title: '加入团体',
      body: h('div', {}, [
        h('label.field', {}, [h('span.field-label', { text: '身份码' }), code]),
        h('label.field', {}, [h('span.field-label', { text: '说明' }), note])
      ]),
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: '提交申请', kind: 'primary',
          onClick: function (close) {
            var r = S.requestJoin(code.value, note.value);
            if (!r.ok) { UI.toast(r.reason, 'seal'); return; }
            close();
            UI.toast('已向「' + r.team.name + '」提交加入申请', 'quiet');
            render();
          }
        }
      ]
    });
  }

  /* ======================================================================
     工作界面
     ====================================================================== */
  function renderApp() {
    var me = S.currentAccount();
    var team = S.currentTeam();
    if (!team) { go('overview'); return renderTeamLayer(); }

    var nav = [];
    NAV.forEach(function (grp) {
      var items = grp.items.filter(function (it) { return !it.cap || S.can(it.cap, team.id); });
      if (items.length) nav.push({ group: grp.group, items: items });
    });

    var allowed = {};
    nav.forEach(function (g) { g.items.forEach(function (i) { allowed[i.id] = i; }); });

    // 下钻页不占导航条目，单独放行
    var DRILL = {
      workbench: { name: '标注工作台', cap: 'annotate' },
      review: { name: '裁定', cap: 'arbitrate' }
    };
    var drill = DRILL[ctx.path];

    if (!drill && !allowed[ctx.path]) {
      ctx.path = nav.length ? nav[0].items[0].id : 'overview';
    }

    var root = h('div.app');

    /* ---- 侧边栏 ---- */
    var rail = h('aside.rail');
    rail.appendChild(h('div.rail-brand', {}, [
      h('div.rail-mark', { text: '论' }),
      h('div', { style: { minWidth: 0, flex: 1 } }, [
        h('div.rail-name', { text: '标注系统' }),
        h('div.rail-sub', { text: '指南 v1.1' })
      ])
    ]));

    var teamSw = h('button.rail-team', { onclick: function () { teamSheet(); } });
    teamSw.appendChild(h('div', { style: { minWidth: 0, flex: 1, textAlign: 'left' } }, [
      h('div.rail-team-name', { text: team.name }),
      h('div.rail-team-sub', { text: (S.isOwner(team.id) ? '最高管理' : S.myRoles().map(S.roleName).join(' · ')) || '成员' })
    ]));
    teamSw.appendChild(UI.icon('arrowRight', 12));
    rail.appendChild(teamSw);

    var navBox = h('nav.rail-nav');
    nav.forEach(function (g) {
      var box = h('div.rail-group');
      if (g.group) box.appendChild(h('div.rail-group-label', {}, [h('span', { text: g.group })]));
      g.items.forEach(function (it) {
        var active = ctx.path === it.id;
        box.appendChild(h('button.rail-item' + (active ? '.is-active' : ''), {
          onclick: function () { go(it.id); }
        }, [h('span', { text: it.name })]));
      });
      navBox.appendChild(box);
    });
    rail.appendChild(navBox);

    rail.appendChild(h('div.rail-foot', {}, [
      h('span.avatar', { text: me.name.slice(0, 1) }),
      h('div', { style: { minWidth: 0, flex: 1 } }, [
        h('div', { style: { fontSize: '13px', color: '#fff' }, text: me.name }),
        h('div.rail-sub', { text: me.title })
      ]),
      h('button.btn--ghost', {
        title: '退出登录',
        style: { color: 'rgba(255,255,255,.55)', padding: '4px' },
        onclick: function () { S.logout(); location.href = 'index.html'; }
      }, [UI.icon('logout')])
    ]));
    root.appendChild(rail);

    /* ---- 主区 ---- */
    var page = pages()[ctx.path] || pages().overview;
    var spec = (page && page.chrome) ? page.chrome(ctx) : { title: (allowed[ctx.path] || drill || {}).name || '' };

    var bar = h('header.topbar');
    bar.appendChild(h('div.topbar-title', { text: spec.title || '' }));
    if (spec.sub) bar.appendChild(h('div.topbar-sub', { text: spec.sub }));
    if (spec.crumbs) bar.appendChild(h('div.topbar-crumbs', {}, spec.crumbs));
    bar.appendChild(h('div.spacer'));
    (spec.actions || []).forEach(function (a) { bar.appendChild(a); });
    bar.appendChild(h('button.btn.btn--ghost.btn--sm', {
      title: '查看指南 v1.1',
      onclick: guidelineSheet
    }, [UI.icon('book'), h('span', { text: '指南 v1.1' })]));
    bar.appendChild(h('button.btn.btn--ghost.btn--sm', {
      title: '重置原型数据',
      onclick: function () {
        UI.confirm({
          title: '重置原型数据', message: '将清空本次演示中产生的所有数据，恢复到初始种子数据。',
          okLabel: '重置', danger: true,
          onOk: function () { S.reset(); UI.toast('已重置', 'quiet'); render(); }
        });
      }
    }, [UI.icon('reset')]));

    var view = h('div.view');
    view.classList.toggle('view--flush', !!(page && page.flush));
    try {
      var out = page ? page.render(ctx) : null;
      if (typeof out === 'string') view.innerHTML = out;
      else if (out) view.appendChild(out);
    } catch (err) {
      console.error(err);
      view.appendChild(errorPanel(err, ctx.path));
    }

    root.appendChild(h('div.main', {}, [bar, view]));
    document.title = (spec.title || '标注系统') + ' · 裁判文书论证结构标记系统';
    return root;
  }

  function teamSheet() {
    var me = S.currentAccount();
    var teams = S.myTeams();
    var t = S.currentTeam();
    var body = h('div');

    body.appendChild(h('div.field-label', { style: { marginBottom: '10px' }, text: '切换团体' }));
    var list = h('div.pick-list');
    teams.forEach(function (x) {
      var on = x.id === t.id;
      var row = h('div.pick-row' + (on ? '.is-on' : ''), {
        onclick: function () {
          if (x.id === t.id) return;
          S.setActiveTeam(x.id); close();
          go('overview'); render();
        }
      });
      row.appendChild(h('div', { style: { flex: 1 } }, [
        h('div', { text: x.name }),
        h('div.tiny.faint', { text: x.members.length + ' 名成员 · ' + S.docsOf(x.id).length + ' 份文书' })
      ]));
      if (on) row.appendChild(h('span.tiny.faint', { text: '当前' }));
      list.appendChild(row);
    });
    body.appendChild(list);

    if (S.isOwner(t.id)) {
      body.appendChild(h('div.field', { style: { marginTop: '20px' } }, [
        h('span.field-label', { text: '身份码（成员凭此申请加入）' }),
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
          h('code.invite-code', { text: t.inviteCode }),
          h('div.spacer'),
          h('button.btn.btn--sm', {
            onclick: function () { S.resetInviteCode(t.id); close(); UI.toast('身份码已重置', 'quiet'); render(); }
          }, [h('span', { text: '重置' })])
        ])
      ]));
    }

    body.appendChild(h('div', { style: { display: 'flex', gap: '8px', marginTop: '24px' } }, [
      h('button.btn.btn--sm', { onclick: function () { close(); createTeamSheet(); } }, [UI.icon('plus'), h('span', { text: '新建团体' })]),
      h('button.btn.btn--sm', { onclick: function () { close(); joinTeamSheet(); } }, [UI.icon('link'), h('span', { text: '加入团体' })])
    ]));

    if (S.isOwner(t.id)) {
      body.appendChild(h('div', { style: { marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--rule)' } }, [
        h('button.btn.btn--sm.btn--seal', {
          onclick: function () {
            UI.confirm({
              title: '解散团体', danger: true, okLabel: '解散',
              message: '将删除「' + t.name + '」及其全部文书、任务与标注结果，不可恢复。',
              onOk: function () { S.dissolveTeam(t.id); close(); go('overview'); render(); }
            });
          }
        }, [h('span', { text: '解散团体' })])
      ]));
    }

    var m = UI.modal({ title: '团体管理', wide: true, body: body, actions: [{ spacer: true }, { label: '关闭' }] });
    var close = m.close;
  }

  /* ---- 指南抽屉 ---------------------------------------------------------- */
  function guidelineSheet() {
    var D = DATA;
    var body = h('div');

    body.appendChild(h('div.section-title', { style: { marginBottom: '8px' }, text: '命题要素类型' }));
    var t1 = h('table.tbl.tbl--compact');
    var tb1 = h('tbody');
    D.ALL_TYPES.forEach(function (t) {
      tb1.appendChild(row(t.code, null, t.name, t.def));
      (t.subs || []).forEach(function (s) { tb1.appendChild(row(t.code, s.code, s.name, s.def)); });
    });
    function row(code, sub, name, def) {
      return h('tr', {}, [
        h('td', { style: { width: '96px' } }, [UI.elChip(code, sub, { sm: true })]),
        h('td', { style: { width: '130px' }, text: name }),
        h('td.tiny.muted', { text: def })
      ]);
    }
    t1.appendChild(tb1);
    body.appendChild(t1);

    body.appendChild(h('div.section-title', { style: { margin: '22px 0 8px' }, text: '关系类型' }));
    var t2 = h('table.tbl.tbl--compact');
    var tb2 = h('tbody');
    D.RELATIONS.forEach(function (r) {
      tb2.appendChild(h('tr', {}, [
        h('td', { style: { width: '36px' } }, [h('span.mono', { text: r.code })]),
        h('td', { style: { width: '80px' }, text: r.name }),
        h('td', { style: { width: '150px' } }, [h('span.formal.tiny', { text: r.form || r.formal })]),
        h('td', { style: { width: '34px' } }, [h('span.mono', { text: r.glyphChar })]),
        h('td.tiny.muted', { text: r.meaning })
      ]));
    });
    t2.appendChild(tb2);
    body.appendChild(t2);

    body.appendChild(h('div.section-title', { style: { margin: '22px 0 8px' }, text: '图示规范（§6）' }));
    body.appendChild(h('div.tiny.muted', { style: { lineHeight: 1.9 },
      text: '命题节点为矩形，矩形内仅有序号，不携带类型信息。关系节点为圆形：实心圆表示支持，空心圆表示反对，带「+」圆表示组合或匹配。同一关系以框内「/」表示，不设关系节点。' }));

    UI.modal({ title: '标注与图示指南 v1.1', wide: true, body: body, actions: [{ spacer: true }, { label: '关闭' }] });
  }

  function errorPanel(err, path) {
    return h('div.page', {}, [
      h('div.callout.callout--seal', {}, [
        h('div', {}, [
          h('div', { text: '页面「' + path + '」渲染失败' }),
          h('div.tiny.mono', { style: { marginTop: '6px' }, text: String(err && err.message || err) })
        ])
      ])
    ]);
  }

  /* ---- 启动 -------------------------------------------------------------- */
  function render() {
    var root = document.getElementById('root');
    UI.clear(root);

    var me = S.currentAccount();
    if (!me) { document.title = '登录 · 标注系统'; root.appendChild(renderGate()); return; }
    if (!S.currentTeam()) { document.title = '选择团体 · 标注系统'; root.appendChild(renderTeamLayer()); return; }
    root.appendChild(renderApp());
  }

  global.go = go;
  global.reRender = render;

  window.addEventListener('hashchange', function () {
    ctx = parseHash();
    render();
  });

  /* 演示直达：labeling.html?as=a-wang&team=team-lab#/tasks */
  (function bootstrap() {
    var qs = (location.search || '').replace(/^\?/, '');
    if (!qs) return;
    var p = {};
    qs.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) return;
      p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
    });
    if (p.as && S.account(p.as)) S.setSession(p.as, p.team || null);
  })();

  ctx = parseHash();
  render();
})(window);
