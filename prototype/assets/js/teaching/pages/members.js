/* ==========================================================================
   teaching/pages/members.js —— 成员（老师）
   班级码；学生名单。加入班级输码即入，不审核。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.TPages = global.TPages || {};
  var h = UI.h;
  var S = global.TStore;

  function render() {
    var cls = S.currentClass();
    var page = h('div.page');

    var codePanel = h('div.panel');
    codePanel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '班级码' }),
      h('div.spacer'),
      h('div.pane-note', { text: '学生输入即可加入' })
    ]));
    codePanel.appendChild(h('div.panel-body', {}, [
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } }, [
        h('code.invite-code', { text: cls.classCode }),
        h('button.btn.btn--sm', {
          onclick: function () {
            try { navigator.clipboard.writeText(cls.classCode); UI.toast('已复制', 'quiet'); }
            catch (e) { UI.toast(cls.classCode, 'quiet'); }
          }
        }, [h('span', { text: '复制' })]),
        h('div.spacer'),
        h('button.btn.btn--sm.btn--ghost', {
          onclick: function () {
            UI.confirm({
              title: '重置班级码', danger: true, okLabel: '重置',
              message: '旧班级码立即失效，已加入的学生不受影响。',
              onOk: function () { S.resetClassCode(cls.id); global.reRender(); }
            });
          }
        }, [h('span', { text: '重置' })])
      ])
    ]));
    page.appendChild(codePanel);

    var students = cls.members.filter(function (m) { return m.role === 'student'; });
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '学生' }),
      h('div.spacer'),
      h('div.pane-note', { text: students.length + ' 人' })
    ]));

    if (!students.length) {
      panel.appendChild(h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: '还没有学生加入。把班级码发给他们即可。' })])
      ]));
      page.appendChild(panel);
      return page;
    }

    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { text: '学生' }),
      h('th', { style: { width: '160px' }, text: '单位 / 身份' }),
      h('th', { style: { width: '110px' }, text: '加入' }),
      h('th', { style: { width: '110px' }, text: '参与练习' })
    ])]));
    var tb = h('tbody');
    students.forEach(function (m) {
      var a = S.account(m.accountId) || {};
      tb.appendChild(h('tr', {}, [
        h('td', {}, [
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
            h('span.avatar.avatar--sm.avatar--light', { text: (a.name || '?').slice(0, 1) }),
            h('div', {}, [
              h('div', { text: a.name || m.accountId }),
              h('div.tiny.faint', { text: a.email || '' })
            ])
          ])
        ]),
        h('td.tiny.muted', { text: (a.org || '') + (a.title ? ' · ' + a.title : '') }),
        h('td.tiny.mono.faint', { text: m.joinedAt }),
        h('td.mono.tiny', { text: S.allExercisesOf(cls.id).filter(function (e) { return e.published; }).length + ' 次' })
      ]));
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    page.appendChild(panel);
    return page;
  }

  Pages.members = {
    chrome: function () { return { title: '成员' }; },
    render: render
  };
})(window);
