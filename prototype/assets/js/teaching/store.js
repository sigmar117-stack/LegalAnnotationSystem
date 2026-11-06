/* ==========================================================================
   teaching/store.js —— 教学系统的状态与持久化

   层级：账号 → 班级 → 身份（老师 / 学生） → 文档与标准答案 → 练习 → 提交
   与标注系统分开管：另一套账号、另一套浏览器存储，仅共用底层引擎。
   需求文档 V0.1.1 §3
   ========================================================================== */
(function (global) {
  'use strict';

  var KEY = 'lal.teaching.v1';
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

  var ROLES = {
    teacher: { name: '老师', desc: '上传文档、标标准答案、发布练习、查看统计' },
    student: { name: '学生', desc: '完成练习，提交后查看答案与相似率' }
  };

  /* ---- 种子 -------------------------------------------------------------- */
  function seed() {
    var accounts = [
      { id: 't-shen', name: '沈牧', email: 'shenmu@law.edu.cn', password: 'demo2026', org: '法学院', title: '讲师' },
      { id: 't-he',   name: '何嘉', email: 'hejia@law.edu.cn',  password: 'demo2026', org: '法学院', title: '副教授' },
      { id: 's-lin',  name: '林一舟', email: 'linyz@stu.edu.cn', password: 'demo2026', org: '法学 2023 级', title: '学生' },
      { id: 's-zhou', name: '周雨',  email: 'zhouyu@stu.edu.cn', password: 'demo2026', org: '法学 2023 级', title: '学生' },
      { id: 's-chen', name: '陈默',  email: 'chenmo@stu.edu.cn', password: 'demo2026', org: '法学 2023 级', title: '学生' },
      { id: 's-wu',   name: '吴迪',  email: 'wudi@stu.edu.cn',   password: 'demo2026', org: '法学 2023 级', title: '学生' }
    ];

    var classes = [
      {
        id: 'cls-1', name: '法学2023级2班', classCode: 'LAW2023',
        ownerId: 't-shen', createdAt: '2026-09-15 10:00',
        members: [
          { accountId: 't-shen', role: 'teacher', joinedAt: '2026-09-15' },
          { accountId: 's-lin',  role: 'student', joinedAt: '2026-09-16' },
          { accountId: 's-zhou', role: 'student', joinedAt: '2026-09-16' },
          { accountId: 's-chen', role: 'student', joinedAt: '2026-09-17' },
          { accountId: 's-wu',   role: 'student', joinedAt: '2026-09-18' }
        ]
      },
      {
        id: 'cls-2', name: '法律方法研讨班', classCode: 'METHOD',
        ownerId: 't-he', createdAt: '2026-10-01 14:00',
        members: [
          { accountId: 't-he',  role: 'teacher', joinedAt: '2026-10-01' },
          { accountId: 's-lin', role: 'student', joinedAt: '2026-10-02' }
        ]
      }
    ];

    var D = global.DATA;
    var d1 = D.docById('doc1');
    var documents = [
      {
        id: 'td-1', classId: 'cls-1',
        title: d1.title, short: d1.short, kind: d1.kind, lead: d1.lead, meta: clone(d1.meta),
        reason: d1.reason,
        answer: { elements: clone(D.SAMPLE_ANNOTATION.elements), relations: clone(D.SAMPLE_ANNOTATION.relations) },
        uploadedBy: 't-shen', uploadedAt: '2026-09-20'
      },
      {
        id: 'td-2', classId: 'cls-2',
        title: d1.title, short: d1.short, kind: d1.kind, lead: d1.lead, meta: clone(d1.meta),
        reason: d1.reason, answer: null,
        uploadedBy: 't-he', uploadedAt: '2026-10-03'
      }
    ];

    var exercises = [
      {
        id: 'ex-1', classId: 'cls-1', name: '劳务合同纠纷 · 首次练习',
        docIds: ['td-1'], deadline: daysFromNow(5),
        autoPublish: true, published: true,
        createdAt: '2026-10-01 09:00', createdBy: 't-shen'
      },
      {
        id: 'ex-2', classId: 'cls-1', name: '劳务合同纠纷 · 补练',
        docIds: ['td-1'], deadline: daysFromNow(12),
        autoPublish: true, published: false,
        createdAt: '2026-10-08 09:00', createdBy: 't-shen'
      }
    ];

    /* 林一舟：两处标签判断与答案不同；周雨：基本一致；陈默：未完成 */
    var subLin = mkSub('sb-lin', 'ex-1', 'td-1', 's-lin', '林一舟', 'submitted', '2026-10-03 20:14', [
      { seq: 'P4', code: 'GM', sub: 'GM-L' },
      { seq: 'P8', code: 'SF', sub: '' }
    ], [{ id: 'R5', tree: { t: 'J', c: [{ p: 'P8' }, { p: 'P3' }] }, label: 'J(P8, P3)' }]);
    var subZhou = mkSub('sb-zhou', 'ex-1', 'td-1', 's-zhou', '周雨', 'submitted', '2026-10-04 11:02', [], []);

    function mkSub(id, exId, docId, accountId, userName, status, at, labelOverrides, relOverrides) {
      var els = clone(D.SAMPLE_ANNOTATION.elements).map(function (e) {
        var hit = (labelOverrides || []).filter(function (o) { return o.seq === e.seq; })[0];
        return hit ? Object.assign({}, e, { code: hit.code, sub: hit.sub }) : e;
      });
      var rels = clone(D.SAMPLE_ANNOTATION.relations).map(function (r) {
        var hit = (relOverrides || []).filter(function (o) { return o.id === r.id; })[0];
        return hit || r;
      });
      return {
        id: id, exerciseId: exId, docId: docId, accountId: accountId, userName: userName,
        status: status, submittedAt: at, elements: els, relations: rels
      };
    }

    return {
      version: 1,
      guideline: 'v1.1',
      session: null,
      activeClassId: null,
      accounts: accounts,
      registrations: [],
      classes: classes,
      documents: documents,
      exercises: exercises,
      submissions: [subLin, subZhou],
      log: [
        { at: '2026-10-04 11:02', accountId: 's-zhou', text: '提交「劳务合同纠纷 · 首次练习」', kind: 'submit' },
        { at: '2026-10-03 20:14', accountId: 's-lin',  text: '提交「劳务合同纠纷 · 首次练习」', kind: 'submit' },
        { at: '2026-10-01 09:00', accountId: 't-shen', text: '发布练习「劳务合同纠纷 · 首次练习」', kind: 'task' },
        { at: '2026-09-15 10:00', accountId: 't-shen', text: '创建班级「法学2023级2班」', kind: 'team' }
      ]
    };

    function daysFromNow(n) {
      return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
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
        var p = JSON.parse(raw);
        if (p && p.version === 1) { memory = p; return memory; }
      } catch (e) { /* 重建 */ }
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

  /* ---- 账号 -------------------------------------------------------------- */
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
    s.activeClassId = null;
    save(); emit();
    return { ok: true, account: a };
  }
  function logout() { var s = load(); s.session = null; s.activeClassId = null; save(); emit(); }
  function setSession(accountId, classId) {
    var s = load();
    s.session = accountId ? { accountId: accountId, at: stamp() } : null;
    s.activeClassId = classId || null;
    save(); emit();
  }
  function register(payload) {
    var s = load();
    s.registrations.unshift(Object.assign({ id: uid('reg'), at: stamp(), status: 'pending' }, payload));
    save(); emit();
  }

  /* ---- 班级 -------------------------------------------------------------- */
  function klass(id) { return load().classes.filter(function (c) { return c.id === id; })[0] || null; }
  function currentClass() {
    var c = klass(load().activeClassId);
    var me = currentAccount();
    if (!c || !me) return null;
    return c.members.some(function (m) { return m.accountId === me.id; }) ? c : null;
  }
  function myClasses() {
    var me = currentAccount();
    if (!me) return [];
    return load().classes.filter(function (c) {
      return c.members.some(function (m) { return m.accountId === me.id; });
    });
  }
  function setActiveClass(id) { var s = load(); s.activeClassId = id; save(); emit(); }

  function createClass(name) {
    var me = currentAccount();
    var s = load();
    var c = {
      id: uid('cls'), name: name, classCode: makeCode(), ownerId: me.id,
      createdAt: stamp(), members: [{ accountId: me.id, role: 'teacher', joinedAt: stamp().slice(0, 10) }]
    };
    s.classes.push(c);
    s.activeClassId = c.id;
    log('创建班级「' + name + '」', 'team');
    save(); emit();
    return c;
  }
  function makeCode() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '0123456789', out = '';
    for (var i = 0; i < 3; i++) out += A[Math.floor(Math.random() * A.length)];
    for (var j = 0; j < 4; j++) out += D[Math.floor(Math.random() * D.length)];
    return out;
  }
  function classByCode(code) {
    var c = String(code || '').trim().toUpperCase();
    return load().classes.filter(function (x) { return x.classCode.toUpperCase() === c; })[0] || null;
  }
  /* 输码即入，不审核 */
  function joinClass(code) {
    var c = classByCode(code);
    if (!c) return { ok: false, reason: '班级码无效' };
    var me = currentAccount();
    if (c.members.some(function (m) { return m.accountId === me.id; })) return { ok: false, reason: '你已在该班级中' };
    c.members.push({ accountId: me.id, role: me.role || 'student', joinedAt: stamp().slice(0, 10) });
    save(); emit();
    return { ok: true, klass: c };
  }
  function resetClassCode(classId) {
    klass(classId).classCode = makeCode();
    save(); emit();
  }
  function memberOf(classId, accountId) {
    var c = klass(classId);
    if (!c) return null;
    return c.members.filter(function (m) { return m.accountId === accountId; })[0] || null;
  }
  function myRole() {
    var c = currentClass(), me = currentAccount();
    if (!c || !me) return null;
    var m = memberOf(c.id, me.id);
    return m ? m.role : null;
  }
  function isTeacher() { return myRole() === 'teacher'; }
  function nameOf(id) { var a = account(id); return a ? a.name : id; }
  function roleName(code) { return (ROLES[code] || {}).name || code; }

  /* ---- 文档与答案 -------------------------------------------------------- */
  function docsOf(classId) { return load().documents.filter(function (d) { return d.classId === classId; }); }
  function doc(id) { return load().documents.filter(function (d) { return d.id === id; })[0] || null; }
  function addDocument(payload) {
    var s = load();
    var d = Object.assign({ id: uid('td'), answer: null, uploadedBy: (currentAccount() || {}).id, uploadedAt: stamp() }, payload);
    s.documents.push(d);
    log('上传文档「' + d.title + '」', 'doc');
    save(); emit();
    return d;
  }
  function removeDocument(id) {
    var s = load();
    s.documents = s.documents.filter(function (d) { return d.id !== id; });
    save(); emit();
  }
  function setAnswer(docId, answer) {
    doc(docId).answer = answer;
    save(); emit();
  }

  /* ---- 练习 -------------------------------------------------------------- */
  function exercise(id) { return load().exercises.filter(function (e) { return e.id === id; })[0] || null; }
  function exercisesOf(classId) {
    return load().exercises.filter(function (e) {
      return e.classId === classId && (e.published || e.createdBy === (currentAccount() || {}).id);
    });
  }
  function allExercisesOf(classId) { return load().exercises.filter(function (e) { return e.classId === classId; }); }

  function addExercise(payload) {
    var s = load();
    var e = Object.assign({
      id: uid('ex'), published: false, createdAt: stamp(), createdBy: (currentAccount() || {}).id
    }, payload);
    s.exercises.unshift(e);
    log('创建练习「' + e.name + '」', 'task');
    save(); emit();
    return e;
  }
  function updateExercise(id, patch) { Object.assign(exercise(id), patch); save(); emit(); }
  function publishExercise(id) {
    var e = exercise(id);
    e.published = true;
    log('发布练习「' + e.name + '」', 'task');
    save(); emit();
  }
  function endExercise(id) { var e = exercise(id); e.ended = true; save(); emit(); }

  /* 答案是否对该学生可见：已提交 且 老师已发布 */
  function answerVisible(exerciseId, docId, accountId) {
    var e = exercise(exerciseId);
    if (!e) return false;
    if (!e.published) return false;
    var sub = submissionOf(exerciseId, docId, accountId);
    return !!(sub && sub.status === 'submitted');
  }

  /* ---- 提交 -------------------------------------------------------------- */
  function submissionsOf(exerciseId, docId) {
    return load().submissions.filter(function (s) {
      return s.exerciseId === exerciseId && (!docId || s.docId === docId);
    });
  }
  function submissionOf(exerciseId, docId, accountId) {
    return submissionsOf(exerciseId, docId).filter(function (s) { return s.accountId === accountId; })[0] || null;
  }
  function createSubmission(exerciseId, docId, accountId) {
    var a = account(accountId);
    return {
      id: uid('sb'), exerciseId: exerciseId, docId: docId, accountId: accountId,
      userName: a ? a.name : accountId, status: 'draft', submittedAt: null,
      elements: [], relations: []
    };
  }
  function upsertSubmission(sub) {
    var s = load();
    for (var i = 0; i < s.submissions.length; i++) {
      if (s.submissions[i].id === sub.id) { s.submissions[i] = sub; save(); emit(); return sub; }
    }
    s.submissions.push(sub);
    save(); emit();
    return sub;
  }
  /* 逐篇提交，可重复提交；第一次提交即视为完成 */
  function submitSubmission(sub) {
    sub.status = 'submitted';
    sub.submittedAt = stamp();
    upsertSubmission(sub);
    log('提交「' + (exercise(sub.exerciseId) || {}).name + '」', 'submit');
    return sub;
  }

  function similarityOf(exerciseId, docId, accountId) {
    var sub = submissionOf(exerciseId, docId, accountId);
    var d = doc(docId);
    if (!sub || !d || !d.answer) return null;
    return global.Text.similarity(sub, d.answer);
  }

  /* 一次练习的班级统计 */
  function statsOf(exerciseId) {
    var e = exercise(exerciseId);
    if (!e) return null;
    var c = klass(e.classId);
    var students = c.members.filter(function (m) { return m.role === 'student'; });
    var rows = students.map(function (m) {
      var per = e.docIds.map(function (docId) {
        var sub = submissionOf(e.id, docId, m.accountId);
        return {
          docId: docId,
          status: sub ? sub.status : 'none',
          similarity: similarityOf(e.id, docId, m.accountId)
        };
      });
      var done = per.every(function (x) { return x.status === 'submitted'; });
      var sims = per.map(function (x) { return x.similarity; }).filter(function (v) { return v !== null; });
      var avg = sims.length ? Math.round(sims.reduce(function (a, b) { return a + b; }, 0) / sims.length) : null;
      return { accountId: m.accountId, name: nameOf(m.accountId), per: per, done: done, average: avg };
    });
    var finished = rows.filter(function (r) { return r.done; });
    var sims = finished.map(function (r) { return r.average; }).filter(function (v) { return v !== null; });
    return {
      rows: rows,
      total: rows.length,
      done: finished.length,
      average: sims.length ? Math.round(sims.reduce(function (a, b) { return a + b; }, 0) / sims.length) : null
    };
  }

  /* ---- 我的成绩 ---------------------------------------------------------- */
  function myScores(accountId) {
    var c = currentClass();
    if (!c) return [];
    return allExercisesOf(c.id).filter(function (e) { return e.published; }).map(function (e) {
      var per = e.docIds.map(function (docId) {
        var sub = submissionOf(e.id, docId, accountId);
        return {
          docId: docId, doc: doc(docId),
          status: sub ? sub.status : 'none',
          similarity: similarityOf(e.id, docId, accountId)
        };
      });
      var sims = per.map(function (x) { return x.similarity; }).filter(function (v) { return v !== null; });
      return {
        exercise: e, per: per,
        average: sims.length ? Math.round(sims.reduce(function (a, b) { return a + b; }, 0) / sims.length) : null
      };
    });
  }

  /* ---- 日志与时间 -------------------------------------------------------- */
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

  global.TStore = {
    ROLES: ROLES,
    state: state, save: save, reset: reset, subscribe: subscribe, emit: emit,
    account: account, accountByEmail: accountByEmail, currentAccount: currentAccount,
    login: login, logout: logout, register: register, setSession: setSession,

    klass: klass, currentClass: currentClass, myClasses: myClasses, setActiveClass: setActiveClass,
    createClass: createClass, classByCode: classByCode, joinClass: joinClass,
    resetClassCode: resetClassCode, memberOf: memberOf,
    myRole: myRole, isTeacher: isTeacher, nameOf: nameOf, roleName: roleName,

    docsOf: docsOf, doc: doc, addDocument: addDocument, removeDocument: removeDocument,
    setAnswer: setAnswer,

    exercise: exercise, exercisesOf: exercisesOf, allExercisesOf: allExercisesOf,
    addExercise: addExercise, updateExercise: updateExercise,
    publishExercise: publishExercise, endExercise: endExercise,
    answerVisible: answerVisible,

    submissionsOf: submissionsOf, submissionOf: submissionOf,
    createSubmission: createSubmission, upsertSubmission: upsertSubmission,
    submitSubmission: submitSubmission, similarityOf: similarityOf,
    statsOf: statsOf, myScores: myScores,

    log: log, stamp: stamp, clone: clone, uid: uid,
    PERSIST: PERSIST
  };
})(window);
