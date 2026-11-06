/* ==========================================================================
   graph.js —— 关系树 → 可绘制的分层图
   严格按 §6 的构造规则展开：
     · 命题节点 = 矩形；关系节点 = 圆形
     · S 实心● / A 空心○ / J 与 M 均为 ⊕ / I 无关系节点，矩形框内 “/”
     · §6.3.1：M 内嵌 J 时，⊕ 同时承担组合与匹配节点，合并为同一节点
     · §6.3.4：S 内嵌 M 时，支持自「被匹配的一般判断节点」发出
     · §6.3.5：A 指向支持关系节点（●）本身，而非命题
   布局为自顶向下的分层（支持者在上），层内按重心排序以减少交叉。
   ========================================================================== */
(function (global) {
  'use strict';

  var DEFAULTS = {
    propW: 54,
    propH: 30,
    relR: 8,
    gapX: 28,
    gapY: 56,
    padX: 40,
    padY: 34,
    compGap: 52
  };

  /* ======================================================================
     端口语义
       outPort(x)  —— x 作为「被指向者」时，箭头落点所在节点
       headPort(x) —— x 作为「支持者 / 反对者」时，连线起点所在节点
     二者对二元关系并不相同：outPort(S(pi,pj)) 是 ● 节点本身，
     而 headPort(S(pi,pj)) 是 pj —— 支持链条自 pj 继续向下。
     ====================================================================== */
  function build(elements, relations) {
    var nodes = {};
    var order = [];
    var edges = [];

    function addNode(n) {
      if (!nodes[n.id]) { nodes[n.id] = n; order.push(n.id); }
      return nodes[n.id];
    }
    function propNode(seq) {
      return addNode({ id: 'p:' + seq, kind: 'prop', seq: seq });
    }
    /* term 字段：把关系节点还原为其形式化术语，供「拖动图元建立关系」使用 */
    function plusNode(childIds, isMatch, term) {
      var key = 'plus|' + childIds.filter(Boolean).slice().sort().join(',');
      var found = nodes[key];
      if (found) {
        if (isMatch) found.merged = true;
        if (term && !found.term) found.term = term;
        return found;
      }
      var n = addNode({ id: key, kind: 'rel', rel: 'plus', merged: !!isMatch, term: term || null });
      childIds.filter(Boolean).forEach(function (cid) {
        if (cid !== n.id) edges.push({ from: cid, to: n.id, kind: 'in' });
      });
      return n;
    }
    function binaryNode(relType, sourceId, targetId, term) {
      var key = relType + '|' + sourceId + '->' + targetId;
      var n = addNode({ id: key, kind: 'rel', rel: relType === 'S' ? 'solid' : 'hollow', term: term || null });
      edges.push({ from: sourceId, to: n.id, kind: 'in' });
      edges.push({ from: n.id, to: targetId, kind: 'out' });
      return n;
    }
    function mergeNode(seqs) {
      var key = 'I|' + seqs.slice().sort().join('/');
      return addNode({ id: key, kind: 'merge', seqs: seqs.slice() });
    }

    var guard = 0;
    function outPort(x) {
      if (!x || guard++ > 4000) return null;
      if (x.p) return propNode(x.p).id;
      switch (x.t) {
        case 'S': case 'A': {
          var src = headPort(x.c[0]);
          var tgt = outPort(x.c[1]);
          if (!src || !tgt) return null;
          return binaryNode(x.t, src, tgt, x).id;
        }
        case 'M': {
          var matched = outPort(x.c[x.c.length - 1]);
          var plus = buildMatch(x);
          if (matched) edges.push({ from: plus.id, to: matched, kind: 'out' });
          return plus.id;
        }
        case 'J':
          return plusNode(x.c.map(headPort), false, x).id;
        case 'I':
          return mergeNode(x.c.map(function (k) { return k.p || ''; })).id;
      }
      return null;
    }
    function headPort(x) {
      if (!x || guard++ > 4000) return null;
      if (x.p) return propNode(x.p).id;
      switch (x.t) {
        case 'S': case 'A':
          return outPort(x.c[1]);          // 链条自「被支持者 / 被反对者」继续
        case 'M':
          return outPort(x.c[x.c.length - 1]);   // §6.3.4：自被匹配的一般判断节点发出
        case 'J':
          return plusNode(x.c.map(headPort), false, x).id;
        case 'I':
          return mergeNode(x.c.map(function (k) { return k.p || ''; })).id;
      }
      return null;
    }

    /* M 的组合部分：§6.3.1 允许第一个实参为 J 并与匹配共用 ⊕ 节点 */
    function buildMatch(m) {
      var kids;
      if (m.c.length === 2 && m.c[0] && m.c[0].t === 'J') {
        kids = m.c[0].c.map(headPort);
        m.c[0].c.forEach(function (k) { outPort(k); headPort(k); });
      } else {
        kids = m.c.slice(0, -1).map(headPort);
        m.c.slice(0, -1).forEach(function (k) { outPort(k); headPort(k); });
      }
      return plusNode(kids, true, m);
    }

    /* 先把所有已标注要素登记为命题节点：未参与任何关系的命题同样要出现在图中 */
    (elements || []).forEach(function (e) { if (e && e.seq) propNode(e.seq); });

    /* 展开全部关系，确保每个关系都被构造 */
    relations.forEach(function (r) {
      if (!r.tree) return;
      var t = r.tree;
      if (t.p) { propNode(t.p); return; }
      guard = 0;
      outPort(t);
      headPort(t);
    });

    /* 去重 + 去自环 */
    var seen = {};
    edges = edges.filter(function (e) {
      if (!e.from || !e.to || e.from === e.to) return false;
      var k = e.from + '>' + e.to + '>' + e.kind;
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });

    return { nodes: nodes, order: order, edges: edges };
  }

  /* ---- 分层：自顶向下 ---------------------------------------------------- */
  function rank(g) {
    var r = {};
    g.order.forEach(function (id) { r[id] = 0; });
    for (var pass = 0; pass < 60; pass++) {
      var changed = false;
      g.edges.forEach(function (e) {
        var want = r[e.from] + 1;
        if (r[e.to] < want) { r[e.to] = want; changed = true; }
      });
      if (!changed) break;
    }
    return r;
  }

  /* ---- 弱连通分量 = 独立论证 --------------------------------------------- */
  function components(g) {
    var parent = {};
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    function union(a, b) { a = find(a); b = find(b); if (a !== b) parent[b] = a; }
    g.order.forEach(function (id) { parent[id] = id; });
    g.edges.forEach(function (e) { union(e.from, e.to); });
    var groups = {};
    g.order.forEach(function (id) {
      var root = find(id);
      (groups[root] = groups[root] || []).push(id);
    });
    return Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return b.length - a.length; });
  }

  /* ---- 布局 -------------------------------------------------------------- */
  function doLayout(g, opts) {
    var o = Object.assign({}, DEFAULTS, opts || {});
    var r = rank(g);
    var comps = components(g);

    /* 未参与任何关系的命题合并为一块，单独放最后，避免每个孤立命题各占一图 */
    var linkedIds = {};
    g.edges.forEach(function (e) { linkedIds[e.from] = 1; linkedIds[e.to] = 1; });
    var isolated = [];
    comps = comps.filter(function (c) {
      var allIsolated = c.every(function (id) { return !linkedIds[id]; });
      if (allIsolated) { isolated = isolated.concat(c); return false; }
      return true;
    });
    if (isolated.length) comps.push(isolated);
    var isolatedCount = isolated.length;

    function widthOf(id) {
      var n = g.nodes[id];
      if (!n) return o.propW;
      if (n.kind === 'prop') return o.propW;
      if (n.kind === 'merge') return o.propW * Math.max(1, n.seqs.length) * 0.86;
      return o.relR * 2;
    }

    var blocks = [];
    comps.forEach(function (ids, ci) {
      var isIsolatedBlock = isolatedCount > 0 && ci === comps.length - 1;
      var levels = {};
      ids.forEach(function (id) { (levels[r[id]] = levels[r[id]] || []).push(id); });
      var levelKeys = Object.keys(levels).map(Number).sort(function (a, b) { return a - b; });
      var rows = levelKeys.map(function (lv) { return levels[lv]; });

      var pos = {};
      function assignRow(row) {
        var total = row.reduce(function (s, id) { return s + widthOf(id); }, 0) +
                    o.gapX * Math.max(0, row.length - 1);
        var x = -total / 2;
        row.forEach(function (id) {
          var w = widthOf(id);
          pos[id] = { x: x + w / 2, w: w };
          x += w + o.gapX;
        });
      }
      assignRow(rows[0] || []);

      function sortByBary(row, dir) {
        var bary = {};
        row.forEach(function (id) {
          var xs = [];
          g.edges.forEach(function (e) {
            var other = dir === 'down' ? e.from : e.to;
            var self = dir === 'down' ? e.to : e.from;
            if (self === id && pos[other] !== undefined) xs.push(pos[other].x);
          });
          bary[id] = xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : NaN;
        });
        row.sort(function (a, b) {
          var ba = isNaN(bary[a]) ? -1e9 : bary[a];
          var bb = isNaN(bary[b]) ? -1e9 : bary[b];
          return ba - bb;
        });
        assignRow(row);
      }

      for (var s = 0; s < 6; s++) {
        for (var i = 1; i < rows.length; i++) sortByBary(rows[i], 'down');
        for (var j = rows.length - 2; j >= 0; j--) sortByBary(rows[j], 'up');
      }

      var minX = Infinity, maxX = -Infinity, maxY = 0;
      var out = [];
      rows.forEach(function (row, li) {
        var y = li * (o.propH + o.gapY);
        row.forEach(function (id) {
          var p = pos[id]; if (!p) return;
          var n = g.nodes[id];
          out.push({
            id: id, kind: n.kind, rel: n.rel, seq: n.seq, seqs: n.seqs, merged: n.merged,
            x: p.x, y: y,
            w: n.kind === 'rel' ? o.relR * 2 : p.w,
            h: n.kind === 'rel' ? o.relR * 2 : o.propH
          });
          minX = Math.min(minX, p.x - p.w / 2);
          maxX = Math.max(maxX, p.x + p.w / 2);
          maxY = Math.max(maxY, y + o.propH);
        });
      });
      blocks.push({
        nodes: out, minX: minX, maxX: maxX, maxY: maxY,
        levels: rows.length,
        props: ids.filter(function (id) { return g.nodes[id] && g.nodes[id].kind === 'prop'; }).length,
        isolated: isIsolatedBlock
      });
    });

    /* 各独立论证纵向堆叠：宽度取最宽者，使分层图在窄栏里也读得清 */
    var cursorY = o.padY, meta = [];
    blocks.forEach(function (b) {
      meta.push({
        dx: o.padX - b.minX, dy: cursorY,
        w: b.maxX - b.minX, h: b.maxY,
        levels: b.levels, props: b.props, nodes: b.nodes.length, isolated: b.isolated
      });
      cursorY += b.maxY + o.compGap;
    });

    var totalW = Math.max(160,
      Math.max.apply(null, blocks.map(function (b) { return b.maxX - b.minX; }).concat([120])) + o.padX * 2);
    var totalH = Math.max(90, cursorY - o.compGap + o.padY);

    var all = [];
    blocks.forEach(function (b, i) {
      b.nodes.forEach(function (n) {
        all.push(Object.assign({}, n, { x: n.x + meta[i].dx, y: n.y + meta[i].dy, block: i }));
      });
    });

    var byId = {};
    all.forEach(function (n) { byId[n.id] = n; });

    var edgesOut = g.edges.map(function (e) {
      return { from: e.from, to: e.to, kind: e.kind, a: byId[e.from], b: byId[e.to] };
    }).filter(function (e) { return e.a && e.b; });

    return {
      nodes: all,
      edges: edgesOut,
      blocks: meta.map(function (m, i) {
        return {
          index: i, width: m.w, height: m.h,
          levels: m.levels, props: m.props, nodes: m.nodes, isolated: m.isolated,
          x: 2, y: m.dy - 14, w: m.w + o.padX * 2
        };
      }),
      width: totalW,
      height: totalH,
      opts: o,
      graph: g
    };
  }

  global.Graph = {
    build: build,
    rank: rank,
    components: components,
    layout: function (elements, relations, opts) {
      return doLayout(build(elements, relations), opts);
    },
    layoutGraph: doLayout
  };
})(window);
