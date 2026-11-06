/* ==========================================================================
   labeling/store.js —— 标注系统的状态与持久化

   层级：账号 → 团体 → 团内身份 → 任务 → 分配 → 标注
   账号本身不含任何业务权限；权限全部来自团体内的成员身份。
   需求文档 V0.1.1 §2
   ========================================================================== */
(function (global) {
  'use strict';

  var KEY = 'lal.labeling.v1';

  var memory = null;
  var listeners = [];

  function canPersist() {
    try {
      global.localStorage.setItem('__t', '1');
      global.localStorage.removeItem('__t');
      return true;
    } catch (e) { return false; }
  }
  var PERSIST = canPersist();

  /* ---- 团内身份 ---------------------------------------------------------- */
  var ROLES = {
    admin:     { name: '管理员', desc: '管理本团体：文书、标签、任务分配、成员身份、结果输出', rank: 3 },
    annotator: { name: '标注员', desc: '标注被指派的文书', rank: 1 },
    arbiter:   { name: '裁定员', desc: '比对多版本标注，裁定最终版本', rank: 1 }
  };

  /* 能力矩阵（需求文档 V0.1.1 §4）。
     owner 在 admin 之上额外拥有 dissolve / transfer / admin.remove。 */
  var CAP = {
    'team.dissolve':   { ownerOnly: true },
    'team.transfer':   { ownerOnly: true },
    'member.admin.remove': { ownerOnly: true },
    'member.manage':   { admin: true },     // 指定/变更身份、移除标注员与裁定员
    'member.join.review': { admin: true },  // 审核加入申请、重置身份码
    'doc.manage':      { admin: true },     // 上传文书、配置标签
    'task.manage':     { admin: true },     // 建任务、细分指派
    'output':          { admin: true },     // 导出与结果查看
    'annotate':        { role: 'annotator' },
    'arbitrate':       { role: 'arbiter' }
  };

  /* ---- 种子 -------------------------------------------------------------- */
  function seed() {
    var accounts = [
      { id: 'a-wang',  name: '王敏', email: 'wangmin@lawlab.cn',  password: 'demo2026', org: '法律论证实验室', title: '项目负责人' },
      { id: 'a-chen',  name: '陈璐', email: 'chenlu@lawlab.cn',   password: 'demo2026', org: '法律论证实验室', title: '硕士研究生' },
      { id: 'a-li',    name: '李维', email: 'liwei@lawlab.cn',    password: 'demo2026', org: '法律论证实验室', title: '硕士研究生' },
      { id: 'a-zhang', name: '张倩', email: 'zhangqian@lawlab.cn', password: 'demo2026', org: '法律论证实验室', title: '博士研究生' },
      { id: 'a-zhao',  name: '赵衡', email: 'zhaoheng@lawlab.cn', password: 'demo2026', org: '法学院', title: '副教授' },
      { id: 'a-sun',   name: '孙可', email: 'sunke@lawlab.cn',    password: 'demo2026', org: '法学院', title: '硕士生', fresh: true }
    ];

    var teams = [
      {
        id: 'team-lab', name: '法律论证实验室', inviteCode: 'LAW-2026',
        ownerId: 'a-wang', createdAt: '2026-09-20 09:30',
        members: [
          { accountId: 'a-wang',  roles: ['admin', 'arbiter'], joinedAt: '2026-09-20' },
          { accountId: 'a-chen',  roles: ['annotator'],        joinedAt: '2026-09-22' },
          { accountId: 'a-li',    roles: ['annotator'],        joinedAt: '2026-09-22' },
          { accountId: 'a-zhang', roles: ['annotator'],        joinedAt: '2026-09-23' },
          { accountId: 'a-zhao',  roles: ['arbiter'],          joinedAt: '2026-09-25' }
        ],
        joinRequests: [
          { id: 'jr-1', accountId: 'a-sun', at: '2026-10-09 14:20', note: '法学院硕士生，想参与标注', status: 'pending' }
        ]
      },
      {
        id: 'team-case', name: '司法案例研究组', inviteCode: 'CASE-1130',
        ownerId: 'a-zhao', createdAt: '2026-10-02 15:10',
        members: [
          { accountId: 'a-zhao',  roles: ['admin', 'annotator'], joinedAt: '2026-10-02' },
          { accountId: 'a-zhang', roles: ['annotator'],          joinedAt: '2026-10-04' }
        ],
        joinRequests: []
      }
    ];

    var D = global.DATA;
    var documents = [
      doc('doc1', 'team-lab', 'a-wang', '2026-09-20'),
      doc('doc2', 'team-lab', 'a-wang', '2026-09-21'),
      doc('doc3', 'team-case', 'a-zhao', '2026-10-02')
    ];
    function doc(id, teamId, by, at) {
      var d = D.docById(id);
      return {
        id: id, teamId: teamId, title: d.title, short: d.short, kind: d.kind,
        lead: d.lead, reason: d.reason, meta: clone(d.meta),
        uploadedBy: by, uploadedAt: at
      };
    }

    var tasks = [
      {
        id: 't-1', teamId: 'team-lab', name: '劳务合同纠纷标注任务 A',
        stage: 2, guideline: 'v1.1', createdAt: '2026-10-05 14:08', createdBy: 'a-wang',
        deadline: daysFromNow(6),
        items: [
          { docId: 'doc1', annotators: ['a-chen', 'a-li', 'a-zhang'], arbiters: ['a-wang'], deadline: null }
        ]
      },
      {
        id: 't-2', teamId: 'team-lab', name: '居间合同与租赁合同标注任务 B',
        stage: 2, guideline: 'v1.1', createdAt: '2026-10-07 10:30', createdBy: 'a-wang',
        deadline: daysFromNow(9),
        items: [
          { docId: 'doc2', annotators: ['a-chen', 'a-zhang'], arbiters: ['a-zhao'], deadline: null }
        ]
      },
      {
        id: 't-3', teamId: 'team-case', name: '集体建设用地租赁标注任务',
        stage: 3, guideline: 'v1.1', createdAt: '2026-10-06 09:05', createdBy: 'a-zhao',
        deadline: daysFromNow(3),
        items: [
          { docId: 'doc3', annotators: ['a-zhang'], arbiters: ['a-zhao'], deadline: null }
        ]
      }
    ];

    /* 陈璐、李维 各提交一份 doc1（用于演示裁定）；张倩留草稿（演示未完成） */
    var sample = D.SAMPLE_ANNOTATION;
    var aChen = mkAnn('an-chen-1', 't-1', 'doc1', 'a-chen', '陈璐', sample, 'submitted', '2026-10-06 16:22');
    var aLi   = mkAnn('an-li-1',   't-1', 'doc1', 'a-li',   '李维', sample, 'submitted', '2026-10-07 09:41');
    // 制造两处真实分歧：P4 标签判为 GM-L（应为 SM），R5 的组合对象写成 P8/P3
    aLi.elements = aLi.elements.map(function (e) {
      if (e.seq === 'P4') return Object.assign({}, e, { code: 'GM', sub: 'GM-L' });
      if (e.seq === 'P8') return Object.assign({}, e, { code: 'SF', sub: '' });
      return e;
    });
    aLi.relations = aLi.relations.map(function (r) {
      if (r.id === 'R5') return { id: 'R5', tree: { t: 'J', c: [{ p: 'P8' }, { p: 'P3' }] }, label: 'J(P8, P3)' };
      return r;
    });

    var aZhang = mkAnn('an-zhang-1', 't-1', 'doc1', 'a-zhang', '张倩', sample, 'draft', null);
    aZhang.relations = aZhang.relations.slice(0, 7);   // R1–R7 已建，R8–R10 待建

    function mkAnn(id, taskId, docId, accountId, userName, src, status, at) {
      return {
        id: id, taskId: taskId, docId: docId, accountId: accountId, userName: userName,
        guideline: 'v1.1', status: status, submittedAt: at,
        bornAt: '2026-10-05 15:00',
        elements: clone(src.elements), relations: clone(src.relations)
      };
    }

    return {
      version: 1,
      guideline: 'v1.1',
      session: null,
      activeTeamId: null,
      accounts: accounts,
      registrations: [
        { id: 'reg-1', name: '周予', email: 'zhouyu@lawlab.cn', org: '法学院', at: '2026-10-08 11:02', status: 'pending' }
      ],
      teams: teams,
      documents: documents,
      tasks: tasks,
      annotations: [aZhang, aChen, aLi],
      finals: [{
        id: 'f-1', teamId: 'team-case', taskId: 't-9', docId: 'doc3',
        elements: [], relations: [],
        decidedBy: 'a-zhao', decidedAt: '2026-09-28 17:02', source: []
      }],
      exports: [{
        id: 'e-1', teamId: 'team-lab', taskId: 't-4', name: '劳务合同纠纷标注任务_导出',
        formats: ['Excel', 'JSON', 'PNG'], guideline: 'v1.1',
        by: 'a-wang', at: '2026-09-18 17:02', size: '412 KB', items: 1
      }],
      log: [
        { at: '2026-10-07 09:41', accountId: 'a-li',    text: '提交「劳务合同纠纷标注任务 A」的标注结果', kind: 'submit' },
        { at: '2026-10-06 16:22', accountId: 'a-chen',  text: '提交「劳务合同纠纷标注任务 A」的标注结果', kind: 'submit' },
        { at: '2026-10-05 14:08', accountId: 'a-wang',  text: '创建任务「劳务合同纠纷标注任务 A」并细分指派', kind: 'task' },
        { at: '2026-10-02 15:10', accountId: 'a-zhao',  text: '创建团体「司法案例研究组」', kind: 'team' },
        { at: '2026-09-20 09:30', accountId: 'a-wang',  text: '创建团体「法律论证实验室」', kind: 'team' }
      ],
      drafts: {}
    };

    function daysFromNow(n) {
      var d = new Date(Date.now() + n * 86400000);
      return d.toISOString().slice(0, 10);
    }
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  /* ---- 读写 -------------------------------------------------------------- */
  function load() {
    if (memory) return memory;
    var raw = null;
    if (PERSIST) { try { raw = global.localStorage.getItem(KEY); } catch (e) { raw = null; } }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) { memory = parsed; return memory; }
      } catch (e) { /* 落到重建 */ }
    }
    memory = seed();
    save();
    return memory;
  }
  function save() {
    if (!memory) return;
    if (PERSIST) { try { global.localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* 配额 */ } }
  }
  function reset() { memory = seed(); save(); emit(); }

  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

  /* ---- 账号与会话 -------------------------------------------------------- */
  function state() { return load(); }
  function account(id) { return load().accounts.filter(function (a) { return a.id === id; })[0] || null; }
  function accountByEmail(email) {
    var e = String(email || '').trim().toLowerCase();
    return load().accounts.filter(function (a) { return a.email.toLowerCase() === e; })[0] || null;
  }
  function currentAccount() { return load().session ? account(load().session.accountId) : null; }

  function login(email, password) {
    var a = accountByEmail(email);
    if (!a) return { ok: false, reason: '该邮箱尚未注册' };
    if (a.password !== password) return { ok: false, reason: '密码不正确' };
    var s = load();
    s.session = { accountId: a.id, at: stamp() };
    s.activeTeamId = null;
    save(); emit();
    return { ok: true, account: a };
  }
  function logout() {
    var s = load();
    s.session = null; s.activeTeamId = null;
    save(); emit();
  }
  /* 演示直达：?as=<账号 id>&team=<团体 id> */
  function setSession(accountId, teamId) {
    var s = load();
    s.session = accountId ? { accountId: accountId, at: stamp() } : null;
    s.activeTeamId = teamId || null;
    save(); emit();
  }
  function register(payload) {
    var s = load();
    s.registrations.unshift({
      id: uid('reg'), name: payload.name, email: payload.email,
      org: payload.org || '', at: stamp(), status: 'pending'
    });
    save(); emit();
  }

  /* ---- 团体 -------------------------------------------------------------- */
  function team(id) { return load().teams.filter(function (t) { return t.id === id; })[0] || null; }
  /* 当前团体：必须确实在其中（成员或最高管理），否则视为未选择 */
  function currentTeam() {
    var t = team(load().activeTeamId);
    var me = currentAccount();
    if (!t || !me) return null;
    if (t.ownerId === me.id) return t;
    return t.members.some(function (m) { return m.accountId === me.id; }) ? t : null;
  }
  function myTeams() {
    var me = currentAccount();
    if (!me) return [];
    return load().teams.filter(function (t) {
      return t.ownerId === me.id || t.members.some(function (m) { return m.accountId === me.id; });
    });
  }
  function setActiveTeam(id) { var s = load(); s.activeTeamId = id; save(); emit(); }

  function createTeam(name) {
    var me = currentAccount();
    var s = load();
    var t = {
      id: uid('team'), name: name, inviteCode: makeCode(),
      ownerId: me.id, createdAt: stamp(), createdBy: me.id,
      members: [{ accountId: me.id, roles: ['admin'], joinedAt: stamp().slice(0, 10) }],
      joinRequests: []
    };
    s.teams.push(t);
    s.activeTeamId = t.id;
    log('创建团体「' + name + '」', 'team');
    save(); emit();
    return t;
  }
  function makeCode() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '0123456789', out = '';
    for (var i = 0; i < 4; i++) out += A[Math.floor(Math.random() * A.length)];
    out += '-';
    for (var j = 0; j < 4; j++) out += D[Math.floor(Math.random() * D.length)];
    return out;
  }
  function teamByCode(code) {
    var c = String(code || '').trim().toUpperCase();
    return load().teams.filter(function (t) { return t.inviteCode.toUpperCase() === c; })[0] || null;
  }
  function requestJoin(code, note) {
    var t = teamByCode(code);
    if (!t) return { ok: false, reason: '身份码无效' };
    var me = currentAccount();
    if (t.members.some(function (m) { return m.accountId === me.id; })) return { ok: false, reason: '你已在该团体中' };
    if (t.joinRequests.some(function (r) { return r.accountId === me.id && r.status === 'pending'; })) {
      return { ok: false, reason: '已提交申请，等待管理员审核' };
    }
    t.joinRequests.unshift({ id: uid('jr'), accountId: me.id, at: stamp(), note: note || '', status: 'pending' });
    save(); emit();
    return { ok: true, team: t };
  }
  function reviewJoin(teamId, reqId, approve) {
    var t = team(teamId);
    var r = t.joinRequests.filter(function (x) { return x.id === reqId; })[0];
    if (!r) return;
    r.status = approve ? 'approved' : 'rejected';
    if (approve) {
      t.members.push({ accountId: r.accountId, roles: ['annotator'], joinedAt: stamp().slice(0, 10) });
      log('批准 ' + nameOf(r.accountId) + ' 加入团体', 'member');
    } else {
      log('驳回 ' + nameOf(r.accountId) + ' 的加入申请', 'member');
    }
    save(); emit();
  }
  function resetInviteCode(teamId) {
    var t = team(teamId);
    t.inviteCode = makeCode();
    log('重置团体身份码', 'member');
    save(); emit();
  }
  function renameTeam(teamId, name) { team(teamId).name = name; save(); emit(); }
  function transferOwner(teamId, accountId) {
    var t = team(teamId);
    t.ownerId = accountId;
    var m = member(teamId, accountId);
    if (m && m.roles.indexOf('admin') < 0) m.roles.unshift('admin');
    log('转交最高管理权限给 ' + nameOf(accountId), 'member');
    save(); emit();
  }
  function dissolveTeam(teamId) {
    var s = load();
    var t = team(teamId);
    s.teams = s.teams.filter(function (x) { return x.id !== teamId; });
    s.documents = s.documents.filter(function (d) { return d.teamId !== teamId; });
    s.tasks = s.tasks.filter(function (x) { return x.teamId !== teamId; });
    s.annotations = s.annotations.filter(function (a) {
      return s.tasks.some(function (x) { return x.id === a.taskId; });
    });
    if (s.activeTeamId === teamId) s.activeTeamId = (myTeams()[0] || {}).id || null;
    log('解散团体「' + t.name + '」', 'team');
    save(); emit();
  }

  /* ---- 团内身份 ---------------------------------------------------------- */
  function member(teamId, accountId) {
    var t = team(teamId);
    if (!t) return null;
    return t.members.filter(function (m) { return m.accountId === accountId; })[0] || null;
  }
  function myMember() {
    var t = currentTeam(), me = currentAccount();
    if (!t || !me) return null;
    return member(t.id, me.id);
  }
  function myRoles() {
    var m = myMember();
    return m ? m.roles.slice() : [];
  }
  function isOwner(teamId) {
    var t = team(teamId || load().activeTeamId);
    var me = currentAccount();
    return !!(t && me && t.ownerId === me.id);
  }
  function setRoles(teamId, accountId, roles) {
    var m = member(teamId, accountId);
    if (!m) return;
    m.roles = roles.slice();
    log('调整 ' + nameOf(accountId) + ' 的身份：' + (roles.map(roleName).join('、') || '无'), 'member');
    save(); emit();
  }
  function removeMember(teamId, accountId) {
    var t = team(teamId);
    t.members = t.members.filter(function (m) { return m.accountId !== accountId; });
    log('移除成员 ' + nameOf(accountId), 'member');
    save(); emit();
  }

  /* ---- 能力判定 ---------------------------------------------------------- */
  function can(cap, teamId) {
    var c = CAP[cap];
    if (!c) return false;
    var roles = myRoles();
    // 标注区 / 裁定区凭身份进入：最高管理与管理员也须先给自己授予对应身份
    if (c.role) return roles.indexOf(c.role) >= 0;
    if (isOwner(teamId)) return true;
    if (c.ownerOnly) return false;
    if (c.admin && roles.indexOf('admin') >= 0) return true;
    return false;
  }
  function roleName(code) { return (ROLES[code] || {}).name || code; }
  function nameOf(accountId) { var a = account(accountId); return a ? a.name : accountId; }

  /* ---- 文书 -------------------------------------------------------------- */
  function docsOf(teamId) {
    return load().documents.filter(function (d) { return d.teamId === teamId; });
  }
  function doc(id) { return load().documents.filter(function (d) { return d.id === id; })[0] || null; }
  function addDocument(payload) {
    var s = load();
    var d = Object.assign({
      id: uid('doc'), uploadedBy: (currentAccount() || {}).id, uploadedAt: stamp()
    }, payload);
    s.documents.push(d);
    log('上传文书「' + d.title + '」', 'doc');
    save(); emit();
    return d;
  }
  function removeDocument(id) {
    var s = load();
    s.documents = s.documents.filter(function (d) { return d.id !== id; });
    save(); emit();
  }

  /* ---- 任务 -------------------------------------------------------------- */
  function task(id) { return load().tasks.filter(function (t) { return t.id === id; })[0] || null; }
  function tasksOf(teamId) { return load().tasks.filter(function (t) { return t.teamId === teamId; }); }
  function addTask(payload) {
    var s = load();
    var t = Object.assign({
      id: uid('t'), stage: 1, guideline: s.guideline,
      createdAt: stamp(), createdBy: (currentAccount() || {}).id
    }, payload);
    s.tasks.unshift(t);
    log('创建任务「' + t.name + '」', 'task');
    save(); emit();
    return t;
  }
  function updateTask(id, patch) { Object.assign(task(id), patch); save(); emit(); }
  function advanceStage(taskId, stage) {
    var t = task(taskId);
    if (!t || stage <= t.stage) return t;
    t.stage = stage; save(); emit();
    return t;
  }
  /* 我在该任务下被指派到的那几篇 */
  function myItems(taskId, accountId) {
    var t = task(taskId);
    var me = accountId || (currentAccount() || {}).id;
    if (!t) return [];
    return t.items.filter(function (it) { return (it.annotators || []).indexOf(me) >= 0; });
  }
  /* 我作为标注员的全部待办（文章 × 人 的条目） */
  function myAssignments(accountId) {
    var me = accountId || (currentAccount() || {}).id;
    var t = currentTeam();
    if (!t) return [];
    var out = [];
    tasksOf(t.id).forEach(function (task) {
      task.items.forEach(function (it) {
        if ((it.annotators || []).indexOf(me) < 0) return;
        out.push({ task: task, item: it, doc: doc(it.docId) });
      });
    });
    return out;
  }
  /* 我作为裁定员的全部待裁条目 */
  function myArbitrations(accountId) {
    var me = accountId || (currentAccount() || {}).id;
    var t = currentTeam();
    if (!t) return [];
    var out = [];
    tasksOf(t.id).forEach(function (task) {
      task.items.forEach(function (it) {
        if ((it.arbiters || []).indexOf(me) < 0) return;
        out.push({ task: task, item: it, doc: doc(it.docId) });
      });
    });
    return out;
  }

  /* ---- 标注 -------------------------------------------------------------- */
  function annotationsOf(taskId, docId) {
    return load().annotations.filter(function (a) {
      return a.taskId === taskId && (!docId || a.docId === docId);
    });
  }
  function annotationOf(taskId, docId, accountId) {
    return annotationsOf(taskId, docId).filter(function (a) { return a.accountId === accountId; })[0] || null;
  }
  function createAnnotation(taskId, docId, accountId) {
    var a = account(accountId);
    return {
      id: uid('an'), taskId: taskId, docId: docId, accountId: accountId,
      userName: a ? a.name : accountId, guideline: load().guideline,
      status: 'draft', submittedAt: null, bornAt: stamp(),
      elements: [], relations: []
    };
  }
  function upsertAnnotation(ann) {
    var s = load();
    for (var i = 0; i < s.annotations.length; i++) {
      if (s.annotations[i].id === ann.id) { s.annotations[i] = ann; save(); emit(); return ann; }
    }
    s.annotations.push(ann); save(); emit();
    return ann;
  }
  function submitAnnotation(ann) {
    ann.status = 'submitted';
    ann.submittedAt = stamp();
    upsertAnnotation(ann);
    log('提交「' + (task(ann.taskId) || {}).name + '」中 ' + shortOf(ann.docId) + ' 的标注', 'submit');
    return ann;
  }
  function shortOf(docId) { var d = doc(docId); return d ? d.short : docId; }

  /* ---- 定稿与导出 -------------------------------------------------------- */
  function finalOf(taskId, docId) {
    return load().finals.filter(function (f) { return f.taskId === taskId && f.docId === docId; })[0] || null;
  }
  function finalsOf(teamId) {
    return load().finals.filter(function (f) {
      var t = task(f.taskId);
      return t && t.teamId === teamId;
    });
  }
  function setFinal(taskId, docId, payload) {
    var s = load();
    var f = finalOf(taskId, docId);
    if (!f) { f = { id: uid('f'), taskId: taskId, docId: docId, teamId: (task(taskId) || {}).teamId }; s.finals.push(f); }
    Object.assign(f, payload, { decidedBy: (currentAccount() || {}).id, decidedAt: stamp() });
    save(); emit();
    return f;
  }
  function exportsOf(teamId) {
    return load().exports.filter(function (e) { return e.teamId === teamId; });
  }
  function addExport(rec) {
    var s = load();
    rec.id = uid('e');
    rec.at = stamp();
    rec.by = (currentAccount() || {}).id;
    s.exports.unshift(rec);
    log('导出「' + ((task(rec.taskId) || {}).name || '') + '」' + rec.formats.join(' + '), 'export');
    save(); emit();
    return rec;
  }

  /* ---- 草稿、日志、时间 -------------------------------------------------- */
  function saveDraft(key, payload) { var s = load(); s.drafts[key] = { at: stamp(), payload: payload }; save(); }
  function draft(key) { return (load().drafts || {})[key] || null; }

  function log(text, kind) {
    var s = load();
    var me = currentAccount();
    s.log.unshift({ at: stamp(), accountId: me ? me.id : null, text: text, kind: kind || 'info' });
    s.log = s.log.slice(0, 60);
  }
  function stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
           ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ======================================================================
     颗粒度与文本工具：共用 core/text.js
     ====================================================================== */
  var suggestCut = global.Text.suggestCut;
  var locate = global.Text.locate;

  global.LStore = {
    ROLES: ROLES, CAP: CAP,
    state: state, save: save, reset: reset, subscribe: subscribe, emit: emit,
    account: account, accountByEmail: accountByEmail, currentAccount: currentAccount,
    login: login, logout: logout, register: register, setSession: setSession,

    team: team, currentTeam: currentTeam, myTeams: myTeams, setActiveTeam: setActiveTeam,
    createTeam: createTeam, teamByCode: teamByCode, requestJoin: requestJoin,
    reviewJoin: reviewJoin, resetInviteCode: resetInviteCode, renameTeam: renameTeam,
    transferOwner: transferOwner, dissolveTeam: dissolveTeam,

    member: member, myMember: myMember, myRoles: myRoles, isOwner: isOwner,
    setRoles: setRoles, removeMember: removeMember,
    can: can, roleName: roleName, nameOf: nameOf,

    docsOf: docsOf, doc: doc, addDocument: addDocument, removeDocument: removeDocument,

    task: task, tasksOf: tasksOf, addTask: addTask, updateTask: updateTask,
    advanceStage: advanceStage, myItems: myItems,
    myAssignments: myAssignments, myArbitrations: myArbitrations,

    annotationsOf: annotationsOf, annotationOf: annotationOf,
    createAnnotation: createAnnotation, upsertAnnotation: upsertAnnotation,
    submitAnnotation: submitAnnotation,

    finalOf: finalOf, finalsOf: finalsOf, setFinal: setFinal,
    exportsOf: exportsOf, addExport: addExport,

    saveDraft: saveDraft, draft: draft, log: log, stamp: stamp,
    suggestCut: suggestCut, locate: locate, clone: clone, uid: uid,
    PERSIST: PERSIST
  };
})(window);
