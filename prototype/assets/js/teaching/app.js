/* ==========================================================================
   teaching/app.js —— 教学系统的三段外壳
     未登录 → 登录 / 注册；已登录无班级 → 创建 / 加入；有班级 → 工作界面
   导航按班级内身份（老师 / 学生）渲染。
   ========================================================================== */
(function (global) {
  'use strict';

  var h = UI.h;
  var S = global.TStore;

  var NAV = {
    teacher: [
      { items: [{ id: 'overview', name: '概览' }] },
      {
        group: '班级管理', items: [
          { id: 'docs',      name: '文档库' },
          { id: 'answers',   name: '标准答案' },
          { id: 'exercises', name: '练习' },
          { id: 'members',   name: '成员' },
          { id: 'stats',     name: '统计' }
        ]
      }
    ],
    student: [
      { items: [{ id: 'overview', name: '概览' }] },
      {
        items: [
          { id: 'exercises', name: '我的练习' },
          { id: 'scores',    name: '我的成绩' }
        ]
      }
    ]
  };

  var ctx = { path: 'overview', params: {} };

  function parseHash() {
    var raw = (location.hash || '#/overview').replace(/^#\/?/, '');
    var qs = '', qi = raw.indexOf('?');
    if (qi >= 0) { qs = raw.slice(qi + 1); raw = raw.slice(0, qi); }
    var params = {};
    qs.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      if (i < 0) { params[decodeURIComponent(kv)] = '1'; return; }
      params[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
    });
    return { path: raw || 'overview', params: params };
  }

  function go(path, params) {
    var qs = params ? Object.keys(params)
      .filter(function (k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&') : '';
    location.hash = '#/' + path + (qs ? '?' + qs : '');
  }

  function pages() { return global.TPages || {}; }

  /* ======================================================================
     未登录
     ====================================================================== */
  function renderGate() {
    var root = h('div.auth');

    var email = h('input.input', { id: 'lg-email', value: 'linyz@stu.edu.cn', autocomplete: 'username' });
    var pass = h('input.input', { id: 'lg-pass', type: 'password', value: 'demo2026', autocomplete: 'current-password' });

    var form = h('form', {
      onsubmit: function (ev) {
        ev.preventDefault();
        var r = S.login(email.value, pass.value);
        if (!r.ok) { UI.toast(r.reason, 'seal'); return; }
        go('overview'); render();
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
      h('button', { text: '注册申请', onclick: registerSheet })
    ]));
    card.appendChild(form);
    card.appendChild(h('div.hr', { style: { margin: '24px 0 16px' } }));
    card.appendChild(h('div.field-label', { style: { marginBottom: '10px' }, text: '演示账号' }));

    var demo = h('div.auth-demo');
    ['t-shen', 't-he', 's-lin', 's-zhou', 's-chen'].forEach(function (id) {
      var a = S.account(id);
      if (!a) return;
      var role = a.id.charAt(0) === 't' ? '老师' : '学生';
      demo.appendChild(h('button.demo-row', {
        onclick: function () {
          email.value = a.email;
          pass.value = a.password;
          form.requestSubmit();
        }
      }, [
        h('span.avatar.avatar--sm.avatar--light', { text: a.name.slice(0, 1) }),
        h('div', { style: { flex: 1, minWidth: 0 } }, [
          h('div', { style: { fontSize: '13px' }, text: a.name }),
          h('div.tiny.faint', { text: a.org + ' · ' + a.title })
        ]),
        h('span.role-chip.role-chip--' + (role === '老师' ? 'admin' : 'annotator'), { text: role })
      ]));
    });
    card.appendChild(demo);

    root.appendChild(brandPane());
    root.appendChild(h('section.auth-right', {}, [card]));
    return root;
  }

  function brandPane() {
    return h('section.auth-left', {}, [
      h('div.auth-brand', {}, [
        h('div.mark', { text: '论' }),
        h('div', {}, [
          h('div.auth-brand-name', { text: '裁判文书论证结构标记系统' }),
          h('div.auth-brand-sub', { text: '教学系统' })
        ])
      ]),
      h('div.auth-lede', {}, [
        h('p', { text: '教师上传文书、标出标准答案、发布练习；学生在同一套工作台上完成标注，提交后与标准答案比对。' })
      ])
    ]);
  }

  function registerSheet() {
    var name = h('input.input', { placeholder: '真实姓名' });
    var email = h('input.input', { placeholder: 'name@example.com' });
    var org = h('input.input', { placeholder: '班级 / 单位' });
    UI.modal({
      title: '注册申请',
      body: h('div', {}, [
        h('label.field', {}, [h('span.field-label', { text: '真实姓名' }), name]),
        h('label.field', {}, [h('span.field-label', { text: '邮箱' }), email]),
        h('label.field', {}, [h('span.field-label', { text: '班级 / 单位' }), org])
      ]),
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: '提交申请', kind: 'primary',
          onClick: function (close) {
            if (!name.value.trim() || !email.value.trim()) { UI.toast('请填写姓名与邮箱', 'seal'); return; }
            S.register({ name: name.value.trim(), email: email.value.trim(), org: org.value.trim() });
            close();
            UI.toast('申请已提交，等待审核', 'quiet');
          }
        }
      ]
    });
  }

  /* ======================================================================
     班级层
     ====================================================================== */
  function renderClassLayer() {
    var me = S.currentAccount();
    var list = S.myClasses();
    var body = h('div.team-layer');

    body.appendChild(h('div.team-layer-head', {}, [
      h('div.auth-brand', {}, [
        h('div.mark', { text: '论' }),
        h('div', {}, [
          h('div.auth-brand-name', { text: '教学系统' }),
          h('div.auth-brand-sub', { text: me.name + ' · ' + me.org })
        ])
      ]),
      h('div.spacer'),
      h('button.btn.btn--sm.btn--ghost', { onclick: function () { S.logout(); location.href = 'index.html'; } },
        [UI.icon('logout'), h('span', { text: '退出' })])
    ]));

    var main = h('div.team-layer-body');

    if (list.length) {
      main.appendChild(h('div.section-title', { style: { marginBottom: '14px' }, text: '我的班级' }));
      var rows = h('div.team-list');
      list.forEach(function (c) {
        var m = S.memberOf(c.id, me.id);
        var students = c.members.filter(function (x) { return x.role === 'student'; }).length;
        var row = h('button.team-row', {
          onclick: function () { S.setActiveClass(c.id); go('overview'); render(); }
        });
        row.appendChild(h('div.team-row-main', {}, [
          h('div.team-row-name', { text: c.name }),
          h('div.team-row-meta', {}, [
            h('span.tiny.faint', { text: students + ' 名学生' }),
            h('span.dot-sep'),
            h('span.tiny.faint', { text: S.allExercisesOf(c.id).length + ' 次练习' })
          ])
        ]));
        row.appendChild(h('div.team-row-roles', {}, [
          h('span.role-chip.role-chip--' + (m.role === 'teacher' ? 'admin' : 'annotator'), { text: S.roleName(m.role) })
        ]));
        row.appendChild(UI.icon('arrowRight'));
        rows.appendChild(row);
      });
      main.appendChild(rows);
    } else {
      main.appendChild(h('div.team-empty', {}, [
        h('div.team-empty-title', { text: '你还没有加入任何班级' }),
        h('div.team-empty-desc', { text: '创建班级，或用老师给的班级码加入。' })
      ]));
    }

    var acts = h('div.team-actions');
    acts.appendChild(actionCard('创建班级', '创建后你将成为该班级的老师', 'plus', function () { createSheet(); }));
    acts.appendChild(actionCard('加入班级', '输入班级码即可加入', 'link', function () { joinSheet(); }));
    main.appendChild(acts);

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

  function createSheet() {
    var name = h('input.input', { placeholder: '如：法学2023级2班' });
    UI.modal({
      title: '创建班级',
      body: h('div', {}, [
        h('label.field', {}, [h('span.field-label', { text: '班级名称' }), name])
      ]),
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: '创建', kind: 'primary',
          onClick: function (close) {
            if (!name.value.trim()) { UI.toast('请填写班级名称', 'seal'); return; }
            var c = S.createClass(name.value.trim());
            close();
            UI.toast('已创建，班级码 ' + c.classCode, 'quiet');
            go('overview'); render();
          }
        }
      ]
    });
  }

  function joinSheet() {
    var code = h('input.input.input--mono', { placeholder: '如 LAW2023' });
    UI.modal({
      title: '加入班级',
      body: h('label.field', {}, [h('span.field-label', { text: '班级码' }), code]),
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: '加入', kind: 'primary',
          onClick: function (close) {
            var r = S.joinClass(code.value);
            if (!r.ok) { UI.toast(r.reason, 'seal'); return; }
            S.setActiveClass(r.klass.id);
            close();
            UI.toast('已加入「' + r.klass.name + '」', 'quiet');
            go('overview'); render();
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
    var cls = S.currentClass();
    if (!cls) { go('overview'); return renderClassLayer(); }

    var role = S.myRole();
    var nav = NAV[role] || NAV.student;
    var allowed = {};
    nav.forEach(function (g) { g.items.forEach(function (i) { allowed[i.id] = i; }); });

    var DRILL = { workbench: { name: '标注练习' }, answer: { name: '标准答案' } };
    var drill = DRILL[ctx.path];
    if (!drill && !allowed[ctx.path]) ctx.path = nav[0].items[0].id;

    var root = h('div.app');

    var rail = h('aside.rail');
    rail.appendChild(h('div.rail-brand', {}, [
      h('div.rail-mark', { text: '论' }),
      h('div', { style: { minWidth: 0, flex: 1 } }, [
        h('div.rail-name', { text: '教学系统' }),
        h('div.rail-sub', { text: '指南 v1.1' })
      ])
    ]));

    var sw = h('button.rail-team', { onclick: classSheet });
    sw.appendChild(h('div', { style: { minWidth: 0, flex: 1, textAlign: 'left' } }, [
      h('div.rail-team-name', { text: cls.name }),
      h('div.rail-team-sub', { text: S.roleName(role) })
    ]));
    sw.appendChild(UI.icon('arrowRight', 12));
    rail.appendChild(sw);

    var navBox = h('nav.rail-nav');
    nav.forEach(function (g) {
      var box = h('div.rail-group');
      if (g.group) box.appendChild(h('div.rail-group-label', {}, [h('span', { text: g.group })]));
      g.items.forEach(function (it) {
        box.appendChild(h('button.rail-item' + (ctx.path === it.id ? '.is-active' : ''), {
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

    var page = pages()[ctx.path] || pages().overview;
    var spec = (page && page.chrome) ? page.chrome(ctx) : { title: (allowed[ctx.path] || drill || {}).name || '' };

    var bar = h('header.topbar');
    bar.appendChild(h('div.topbar-title', { text: spec.title || '' }));
    if (spec.sub) bar.appendChild(h('div.topbar-sub', { text: spec.sub }));
    bar.appendChild(h('div.spacer'));
    (spec.actions || []).forEach(function (a) { bar.appendChild(a); });
    bar.appendChild(h('button.btn.btn--ghost.btn--sm', {
      title: '查看指南 v1.1', onclick: guidelineSheet
    }, [UI.icon('book'), h('span', { text: '指南 v1.1' })]));
    bar.appendChild(h('button.btn.btn--ghost.btn--sm', {
      title: '重置原型数据',
      onclick: function () {
        UI.confirm({
          title: '重置数据', message: '将恢复教学系统的初始数据。', okLabel: '重置', danger: true,
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
      view.appendChild(h('div.page', {}, [
        h('div.callout.callout--seal', {}, [
          h('div', {}, [
            h('div', { text: '页面渲染失败' }),
            h('div.tiny.mono', { style: { marginTop: '6px' }, text: String(err && err.message || err) })
          ])
        ])
      ]));
    }

    root.appendChild(h('div.main', {}, [bar, view]));
    document.title = (spec.title || '教学系统') + ' · 裁判文书论证结构标记系统';
    return root;
  }

  function classSheet() {
    var me = S.currentAccount();
    var list = S.myClasses();
    var cur = S.currentClass();
    var body = h('div');

    body.appendChild(h('div.field-label', { style: { marginBottom: '10px' }, text: '切换班级' }));
    var box = h('div.pick-list');
    list.forEach(function (c) {
      var on = c.id === cur.id;
      var row = h('div.pick-row' + (on ? '.is-on' : ''), {
        onclick: function () {
          if (on) return;
          S.setActiveClass(c.id); close(); go('overview'); render();
        }
      });
      row.appendChild(h('div', { style: { flex: 1 } }, [
        h('div', { text: c.name }),
        h('div.tiny.faint', { text: c.members.filter(function (m) { return m.role === 'student'; }).length + ' 名学生' })
      ]));
      if (on) row.appendChild(h('span.tiny.faint', { text: '当前' }));
      box.appendChild(row);
    });
    body.appendChild(box);

    if (S.isTeacher()) {
      body.appendChild(h('div.field', { style: { marginTop: '20px' } }, [
        h('span.field-label', { text: '班级码' }),
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
          h('code.invite-code', { text: cur.classCode }),
          h('div.spacer'),
          h('button.btn.btn--sm', {
            onclick: function () { S.resetClassCode(cur.id); close(); UI.toast('班级码已重置', 'quiet'); render(); }
          }, [h('span', { text: '重置' })])
        ])
      ]));
    }

    body.appendChild(h('div', { style: { display: 'flex', gap: '8px', marginTop: '24px' } }, [
      h('button.btn.btn--sm', { onclick: function () { close(); createSheet(); } }, [UI.icon('plus'), h('span', { text: '创建班级' })]),
      h('button.btn.btn--sm', { onclick: function () { close(); joinSheet(); } }, [UI.icon('link'), h('span', { text: '加入班级' })])
    ]));

    var m = UI.modal({ title: '班级管理', wide: true, body: body, actions: [{ spacer: true }, { label: '关闭' }] });
    var close = m.close;
  }

  /* ---- 指南抽屉（与标注系统一致） ---------------------------------------- */
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
        h('td', { style: { width: '150px' } }, [h('span.formal.tiny', { text: r.form })]),
        h('td', { style: { width: '34px' } }, [h('span.mono', { text: r.glyphChar })]),
        h('td.tiny.muted', { text: r.meaning })
      ]));
    });
    t2.appendChild(tb2);
    body.appendChild(t2);

    UI.modal({ title: '标注与图示指南 v1.1', wide: true, body: body, actions: [{ spacer: true }, { label: '关闭' }] });
  }

  /* ---- 启动 -------------------------------------------------------------- */
  function render() {
    var root = document.getElementById('root');
    UI.clear(root);

    var me = S.currentAccount();
    if (!me) { document.title = '登录 · 教学系统'; root.appendChild(renderGate()); return; }
    if (!S.currentClass()) { document.title = '选择班级 · 教学系统'; root.appendChild(renderClassLayer()); return; }
    root.appendChild(renderApp());
  }

  global.go = go;
  global.reRender = render;

  window.addEventListener('hashchange', function () { ctx = parseHash(); render(); });

  (function bootstrap() {
    var qs = (location.search || '').replace(/^\?/, '');
    if (!qs) return;
    var p = {};
    qs.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) return;
      p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
    });
    if (p.as && S.account(p.as)) S.setSession(p.as, p.cls || null);
  })();

  ctx = parseHash();
  render();
})(window);
