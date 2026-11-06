/* ==========================================================================
   labeling/pages/members.js —— 成员与身份
   身份由管理员指定，本人不能自选。管理员可以给自己也指定标注员 / 裁定员身份。
   需求文档 V0.1.1 §2.3 §4
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.LPages = global.LPages || {};
  var h = UI.h;
  var S = global.LStore;

  function render() {
    var team = S.currentTeam();
    var page = h('div.page');
    page.appendChild(invitePanel(team));
    page.appendChild(requestPanel(team));
    page.appendChild(memberPanel(team));
    page.appendChild(matrixPanel());
    return page;
  }

  /* ---- 身份码 ------------------------------------------------------------ */
  function invitePanel(team) {
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '身份码' }),
      h('div.spacer'),
      h('div.pane-note', { text: '成员凭此申请加入，经管理员审核通过' })
    ]));
    var body = h('div.panel-body');
    body.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } }, [
      h('code.invite-code', { text: team.inviteCode }),
      h('button.btn.btn--sm', {
        onclick: function () {
          try {
            navigator.clipboard.writeText(team.inviteCode);
            UI.toast('已复制', 'quiet');
          } catch (e) { UI.toast(team.inviteCode, 'quiet'); }
        }
      }, [h('span', { text: '复制' })]),
      h('div.spacer'),
      h('button.btn.btn--sm.btn--ghost', {
        onclick: function () {
          UI.confirm({
            title: '重置身份码', message: '旧身份码立即失效，已加入的成员不受影响。',
            okLabel: '重置', danger: true,
            onOk: function () { S.resetInviteCode(team.id); global.reRender(); }
          });
        }
      }, [h('span', { text: '重置' })])
    ]));
    panel.appendChild(body);
    return panel;
  }

  /* ---- 加入申请 ---------------------------------------------------------- */
  function requestPanel(team) {
    var pending = team.joinRequests.filter(function (r) { return r.status === 'pending'; });
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '加入申请' }),
      h('div.spacer'),
      pending.length ? h('span.badge.badge--seal', { text: pending.length + ' 条待审' })
                     : h('div.pane-note', { text: '暂无待审' })
    ]));

    if (!pending.length) return panel;

    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { text: '申请人' }),
      h('th', { text: '说明' }),
      h('th', { style: { width: '130px' }, text: '时间' }),
      h('th', { style: { width: '140px' } })
    ])]));
    var tb = h('tbody');
    pending.forEach(function (r) {
      var a = S.account(r.accountId) || {};
      tb.appendChild(h('tr', {}, [
        h('td', {}, [
          h('div', { text: a.name || r.accountId }),
          h('div.tiny.faint', { text: a.org && a.title ? a.org + ' · ' + a.title : (a.email || '') })
        ]),
        h('td.tiny.muted', { text: r.note || '—' }),
        h('td.tiny.mono.faint', { text: r.at }),
        h('td', {}, [
          h('div', { style: { display: 'flex', gap: '6px' } }, [
            h('button.btn.btn--sm.btn--primary', {
              onclick: function () { S.reviewJoin(team.id, r.id, true); global.reRender(); UI.toast('已通过', 'quiet'); }
            }, [h('span', { text: '通过' })]),
            h('button.btn.btn--sm', {
              onclick: function () { S.reviewJoin(team.id, r.id, false); global.reRender(); }
            }, [h('span', { text: '驳回' })])
          ])
        ])
      ]));
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    return panel;
  }

  /* ---- 成员表 ------------------------------------------------------------ */
  function memberPanel(team) {
    var me = S.currentAccount();
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '成员与身份' }),
      h('div.spacer'),
      h('div.pane-note', { text: team.members.length + ' 人' })
    ]));

    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { text: '成员' }),
      h('th', { style: { width: '300px' }, text: '身份' }),
      h('th', { style: { width: '110px' }, text: '加入' }),
      h('th', { style: { width: '120px' } })
    ])]));

    var tb = h('tbody');
    var ordered = team.members.slice().sort(function (a, b) {
      if (a.accountId === team.ownerId) return -1;
      if (b.accountId === team.ownerId) return 1;
      return 0;
    });

    ordered.forEach(function (m) {
      var a = S.account(m.accountId) || {};
      var isOwner = m.accountId === team.ownerId;
      var editable = canManage(team, m, me);

      var roleCell = h('div', { style: { display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' } });
      if (isOwner) roleCell.appendChild(h('span.role-chip.role-chip--admin', { text: '最高管理' }));
      Object.keys(S.ROLES).forEach(function (code) {
        var on = m.roles.indexOf(code) >= 0;
        if (!on && !editable) return;
        roleCell.appendChild(h('button' + (on ? '.role-chip.role-chip--' + code : '.role-chip.role-chip--off'), {
          title: on ? '移除该身份' : '授予该身份',
          style: editable ? null : { cursor: 'default' },
          onclick: function () {
            if (!editable) return;
            var roles = m.roles.slice();
            var i = roles.indexOf(code);
            if (i >= 0) roles.splice(i, 1); else roles.push(code);
            S.setRoles(team.id, m.accountId, roles);
            global.reRender();
          }
        }, [h('span', { text: S.roleName(code) })]));
      });
      if (!editable && !m.roles.length && !isOwner) {
        roleCell.appendChild(h('span.tiny.faint', { text: '无身份' }));
      }

      var acts = h('div', { style: { display: 'flex', gap: '6px' } });
      if (S.isOwner(team.id) && !isOwner) {
        acts.appendChild(h('button.btn.btn--sm.btn--ghost', {
          title: '转交最高管理权限',
          onclick: function () { transferSheet(team, m); }
        }, [UI.icon('shield')]));
      }
      if (!isOwner && editable) {
        acts.appendChild(h('button.btn.btn--sm.btn--ghost', {
          title: '移除成员',
          onclick: function () {
            UI.confirm({
              title: '移除成员', danger: true, okLabel: '移除',
              message: '将 ' + a.name + ' 移出「' + team.name + '」，其已提交的标注结果保留。',
              onOk: function () { S.removeMember(team.id, m.accountId); global.reRender(); }
            });
          }
        }, [UI.icon('trash')]));
      }

      tb.appendChild(h('tr', {}, [
        h('td', {}, [
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
            h('span.avatar.avatar--sm.avatar--light', { text: (a.name || '?').slice(0, 1) }),
            h('div', {}, [
              h('div', { text: a.name || m.accountId }),
              h('div.tiny.faint', { text: a.org && a.title ? a.org + ' · ' + a.title : (a.email || '') })
            ])
          ])
        ]),
        h('td', {}, [roleCell]),
        h('td.tiny.mono.faint', { text: m.joinedAt }),
        h('td', {}, [acts])
      ]));
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    panel.appendChild(h('div.panel-foot', {}, [
      h('span.tiny.muted', { text: '身份由管理员指定；管理员可以给自己也授予标注员或裁定员身份。' })
    ]));
    return panel;
  }

  function canManage(team, target, me) {
    if (target.accountId === me.id) return true;
    if (target.accountId === team.ownerId) return false;
    if (S.isOwner(team.id)) return true;
    if (S.can('member.manage', team.id)) return target.roles.indexOf('admin') < 0;
    return false;
  }

  function transferSheet(team, m) {
    UI.confirm({
      title: '转交最高管理权限',
      danger: true,
      okLabel: '转交',
      message: '将「最高管理」转交给 ' + S.nameOf(m.accountId) + '，你本人保留管理员身份。',
      onOk: function () {
        S.transferOwner(team.id, m.accountId);
        global.reRender();
        UI.toast('已转交', 'quiet');
      }
    });
  }

  /* ---- 权限矩阵 ---------------------------------------------------------- */
  var MATRIX = [
    { name: '解散团体 / 转交最高管理权限',        owner: 1, admin: 0, annotator: 0, arbiter: 0 },
    { name: '移除管理员',                        owner: 1, admin: 0, annotator: 0, arbiter: 0 },
    { name: '指定身份、移除成员',                 owner: 1, admin: 1, annotator: 0, arbiter: 0 },
    { name: '审核加入申请、重置身份码',            owner: 1, admin: 1, annotator: 0, arbiter: 0 },
    { name: '上传文书、配置标签、创建任务与指派',   owner: 1, admin: 1, annotator: 0, arbiter: 0 },
    { name: '导出与结果查看',                     owner: 1, admin: 1, annotator: 0, arbiter: 0 },
    { name: '进入标注区',                        owner: 0, admin: 0, annotator: 1, arbiter: 0, hire: true },
    { name: '进入裁定区',                        owner: 0, admin: 0, annotator: 0, arbiter: 1, hire: true }
  ];

  function matrixPanel() {
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '权限矩阵' }),
      h('div.spacer'),
      h('div.pane-note', { text: '● 允许　— 不允许　兼任 需同时具备该身份' })
    ]));

    var tbl = h('table.tbl.matrix');
    var head = h('tr', {}, [h('th', { text: '能力' })]);
    ['最高管理', '管理员', '标注员', '裁定员'].forEach(function (n) { head.appendChild(h('th', { text: n })); });
    tbl.appendChild(h('thead', {}, [head]));

    var tb = h('tbody');
    MATRIX.forEach(function (row) {
      var tr = h('tr');
      tr.appendChild(h('td', {}, [
        h('span', { text: row.name }),
        row.hire ? h('span.tiny.faint', { style: { marginLeft: '8px' }, text: '兼任' }) : null
      ]));
      ['owner', 'admin', 'annotator', 'arbiter'].forEach(function (k) {
        var ok = row[k];
        tr.appendChild(h('td', {}, [
          h('span.yn.yn--' + (ok ? 'y' : 'n'), { text: ok ? '●' : '—' })
        ]));
      });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    panel.appendChild(h('div.panel-foot', {}, [
      h('span.tiny.muted', { text: '最高管理与管理员默认不进入标注区或裁定区，需给自己授予对应身份。' })
    ]));
    return panel;
  }

  Pages.members = {
    chrome: function () { return { title: '成员与身份' }; },
    render: render
  };
})(window);
