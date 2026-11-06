/* ==========================================================================
   formal.js —— 形式化表达
   支持 §5.2 / §5.3 的无嵌套与多层嵌套表达：
     S(pi, pj)  A(po, pc)  J(p1, …, pn)  M(ps, pg)  I(p1, …, pn)
     S(J(p1, p2), p3)   M(J(p4, p5), p2)   A(p3, S(p1, p2))   …
   术语树结构：{ t:'S', c:[ 子项 ] }，子项为 { p:'P4' } 或另一术语树。
   ========================================================================== */
(function (global) {
  'use strict';

  var BINARY = { S: true, A: true, M: true };   // 二元关系
  var NARY   = { J: true, I: true };            // n 元（n ≥ 2）关系

  /* ---- 打印 ------------------------------------------------------------- */
  function print(node) {
    if (!node) return '';
    if (node.p) return node.p;
    return node.t + '(' + node.c.map(print).join(', ') + ')';
  }

  /* ---- 解析（容错：忽略空白与大小写；id 允许 P4 / p4 / 4） --------------- */
  function parse(str) {
    var s = String(str || '').trim();
    var i = 0;

    function ws() { while (i < s.length && /\s/.test(s[i])) i++; }

    function term() {
      ws();
      if (i >= s.length) throw new Error('表达式意外结束');
      var ch = s[i];
      if (ch === '(') return group();
      var m = /^[A-Za-z0-9_一-龥]+/.exec(s.slice(i));
      if (!m) throw new Error('第 ' + (i + 1) + ' 个字符处无法识别：' + JSON.stringify(s[i]));
      var word = m[0];
      i += word.length;
      ws();
      if (s[i] === '(') return group(word);
      // 裸标识符：视为命题引用
      return { p: normalizeId(word) };
    }

    function group(name) {
      if (s[i] !== '(') throw new Error('缺少左括号');
      i++;
      var kids = [];
      ws();
      if (s[i] === ')') throw new Error(name + ' 内没有参数');
      for (;;) {
        kids.push(term());
        ws();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === ')') { i++; break; }
        if (i >= s.length) throw new Error('括号未闭合');
        throw new Error('第 ' + (i + 1) + ' 个字符处期望 “,” 或 “)”');
      }
      if (!name) {
        if (kids.length === 1) return kids[0];
        throw new Error('并列命题需要使用关系符号包裹');
      }
      return { t: name.toUpperCase(), c: kids };
    }

    var out = term();
    ws();
    if (i < s.length) throw new Error('第 ' + (i + 1) + ' 个字符处存在多余内容');
    return out;
  }

  function normalizeId(w) {
    var m = /^[Pp]?(\d+)$/.exec(w);
    return m ? 'P' + m[1] : w;
  }

  /* ---- 校验（§5.2 基本结构 + §5.1.4 反对关系的展开条件） ----------------- */
  function validate(node) {
    var errs = [];
    (function walk(n, path) {
      if (n.p) return;
      if (!n.t || !n.c) { errs.push(path + '：术语结构不完整'); return; }
      if (!BINARY[n.t] && !NARY[n.t]) {
        errs.push(path + '：未知关系类型 “' + n.t + '”');
        return;
      }
      if (n.t === 'S' || n.t === 'A') {
        if (n.c.length !== 2) errs.push(path + '：' + n.t + ' 为二元关系，需要 2 个项，当前 ' + n.c.length + ' 个');
      }
      if (n.t === 'M') {
        if (n.c.length < 2) errs.push(path + '：M 需要“匹配者 + 被匹配者”两个项');
      }
      if (NARY[n.t] && n.c.length < 2) {
        errs.push(path + '：' + n.t + ' 为 n 元关系（n ≥ 2），当前仅 ' + n.c.length + ' 个项');
      }
      n.c.forEach(function (k, idx) { walk(k, path + ' › ' + (idx + 1)); });
    })(node, print(node));
    return errs;
  }

  /* ---- 命题引用收集 ------------------------------------------------------ */
  function props(node, into) {
    var acc = into || [];
    (function walk(n) {
      if (n.p) { if (acc.indexOf(n.p) < 0) acc.push(n.p); return; }
      n.c.forEach(walk);
    })(node);
    return acc;
  }

  /* ---- 关系类型收集 ------------------------------------------------------ */
  function types(node, into) {
    var acc = into || {};
    (function walk(n) {
      if (n.p) return;
      acc[n.t] = true;
      n.c.forEach(walk);
    })(node);
    return acc;
  }

  /* ---- 嵌套深度 ---------------------------------------------------------- */
  function depth(node) {
    if (!node || node.p) return 0;
    return 1 + Math.max.apply(null, node.c.map(depth));
  }

  /* ======================================================================
     角色推导（PDF §3：前提 / 子结论 / 结论 不作为独立标注项目，
     由关系结构通过图分析自动推导）
     仅作提示，不写回数据。
     ====================================================================== */
  function deriveRoles(elements, relations) {
    var role = {};
    elements.forEach(function (e) { role[e.seq] = { seq: e.seq, isSupporter: false, isTarget: false, attacked: false }; });

    function mark(seq, key) { if (role[seq]) role[seq][key] = true; }

    function walk(node, asSupportSource, isFirstArg) {
      if (!node) return null;
      if (node.p) {
        // 支持者一侧：其中第一个实参是“支持者”，S/M 的后续实参是被指向者
        if (asSupportSource) mark(node.p, 'isSupporter');
        return node.p;
      }
      var t = node.t;
      if (t === 'S' || t === 'A') {
        walk(node.c[0], true, true);                       // 支持者 / 反对者
        var tgt = walk(node.c[1], false, false);           // 被支持者 / 被反对者
        // 只有「被支持」才计入结论侧；「被反对」不改变命题在支持结构中的位置，
        // 否则一条被攻击的前提会被误判为子结论。
        if (t === 'S' && tgt && node.c[1].p) mark(tgt, 'isTarget');
        if (t === 'A' && tgt && node.c[1].p) mark(tgt, 'attacked');
        return tgt;
      }
      if (t === 'M') {
        for (var i = 0; i < node.c.length - 1; i++) walk(node.c[i], true, true);
        var pg = walk(node.c[node.c.length - 1], false, false);
        if (pg && node.c[node.c.length - 1].p) {
          mark(pg, 'isTarget');
          if (asSupportSource) mark(pg, 'isSupporter');    // §6.3.4：支持自一般判断节点发出
        }
        return pg;
      }
      // J / I：其成员沿同一支持方向传递
      node.c.forEach(function (k) { walk(k, asSupportSource, true); });
      return null;
    }

    relations.forEach(function (r) { if (r.tree) walk(r.tree, false, false); });

    return elements.map(function (e) {
      var r = role[e.seq] || {};
      var label = '未入论证';
      if (r.isTarget && r.isSupporter) label = '子结论';
      else if (r.isTarget) label = '结论';
      else if (r.isSupporter) label = '前提';
      return { seq: e.seq, role: label, attacked: !!r.attacked, roleCode: r.isTarget && r.isSupporter ? 'sub' : r.isTarget ? 'claim' : r.isSupporter ? 'premise' : 'loose' };
    });
  }

  global.Formal = {
    print: print,
    parse: parse,
    validate: validate,
    props: props,
    types: types,
    depth: depth,
    deriveRoles: deriveRoles
  };
})(window);
