/* ==========================================================================
   diagram.js —— 论证图示的 SVG 渲染
   图元严格遵循 §6：
     · 命题节点：矩形，框内为命题序号；按 §6.1，节点本身不表达命题类型
     · 关系节点：圆形。实心● = 支持，空心○ = 反对，带“+”圆 = 组合 / 匹配
     · 同一关系：矩形框内以“/”分隔，不设关系节点
     · 有向边：支持者 → 被支持者；组合关系为无向连线
   「按类型着色」为编辑辅助视图，非指南图元，导出时默认关闭。
   ========================================================================== */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    return n;
  }

  var CSS_VAR = {
    sf: '--t-sf', gf: '--t-gf', sm: '--t-sm', gm: '--t-gm',
    is: '--t-is', non: '--t-non'
  };

  function colorFor(typeInfo) {
    if (!typeInfo) return null;
    var key = typeInfo.color || (typeInfo.code === 'Non' ? 'non' : 'is');
    return 'var(' + (CSS_VAR[key] || '--ink') + ')';
  }

  /* ======================================================================
     render
     layout  : Graph.layout 的产物
     opts    : {
       colorByType : 是否按命题类型着色（编辑辅助）
       typeOf      : function(seq) -> 类型对象
       positions   : { nodeId: {dx, dy} }  拖拽后的位移
       selected    : nodeId | seq
       highlight   : [seq...]              高亮若干命题
       onNodeClick : function(nodeData)
       onNodeDown  : function(evt, nodeData)
       onBackgroundClick
       showBlockLabels : 是否给每个独立论证加标题
     }
     ====================================================================== */
  function render(layout, opts) {
    opts = opts || {};
    var o = layout.opts;
    var pad = 6;
    var W = layout.width + pad * 2;
    var H = layout.height + pad * 2;

    var svg = el('svg', {
      class: 'diagram-svg',
      viewBox: '0 0 ' + W + ' ' + H,
      width: W, height: H,
      xmlns: NS,
      'xmlns:xlink': 'http://www.w3.org/1999/xlink'
    });

    /* 箭头定义：实心三角，尺寸随线宽 */
    var defs = el('defs');
    ['arrow', 'arrow-muted'].forEach(function (id) {
      var m = el('marker', {
        id: id + '-' + uid(), markerWidth: 7, markerHeight: 7,
        refX: 6.2, refY: 3.5, orient: 'auto', markerUnits: 'strokeWidth'
      });
      m.appendChild(el('path', { d: 'M0,0 L7,3.5 L0,7 z', fill: id === 'arrow' ? 'var(--ink)' : 'var(--ink-3)' }));
      defs.appendChild(m);
    });
    var arrowIds = Array.prototype.slice.call(defs.querySelectorAll('marker')).map(function (m) { return m.id; });
    svg.appendChild(defs);

    var root = el('g', { class: 'diagram-root' });
    svg.appendChild(root);

    /* ---- 独立论证标题（§3.6.1：一份文书可能包含多个独立论证，需分开展示） ---- */
    if (opts.showBlockLabels && layout.blocks.length > 1) {
      var n = 0;
      layout.blocks.forEach(function (b, i) {
        if (!b.isolated) n++;
        var t = el('text', {
          x: b.x + 2,
          y: (b.y !== undefined ? b.y : o.padY - 14),
          class: 'diagram-block-label'
        });
        t.textContent = b.isolated ? '未入论证的命题' : ('论证 ' + n);
        root.appendChild(t);
      });
    }

    /* ---- 连线 ---- */
    var edgeLayer = el('g', { class: 'diagram-edges' });
    root.appendChild(edgeLayer);

    layout.edges.forEach(function (e) {
      var a = offset(e.a, opts), b = offset(e.b, opts);
      var d = route(a, b);
      var path = el('path', {
        d: d,
        class: 'dg-edge dg-edge--' + e.kind,
        'marker-end': e.kind === 'out' ? 'url(#' + arrowIds[0] + ')' : null
      });
      edgeLayer.appendChild(path);
    });

    /* ---- 节点 ---- */
    var nodeLayer = el('g', { class: 'diagram-nodes' });
    root.appendChild(nodeLayer);

    layout.nodes.forEach(function (n) {
      var p = offset(n, opts);
      var g = el('g', {
        class: 'dg-node dg-node--' + n.kind + (n.rel ? ' dg-node--rel-' + n.rel : ''),
        'data-node': n.id,
        'data-seq': n.seq || (n.seqs ? n.seqs.join('/') : '')
      });
      g.setAttribute('transform', 'translate(' + round(p.x) + ',' + round(p.y) + ')');

      var isSel = opts.selected && (opts.selected === n.id || opts.selected === n.seq ||
        (n.seqs && n.seqs.indexOf(opts.selected) >= 0));
      if (isSel) g.classList.add('is-selected');
      if (opts.highlight && n.seq && opts.highlight.indexOf(n.seq) >= 0) g.classList.add('is-highlight');

      var tint = null;
      if (opts.colorByType && opts.typeOf) {
        if (n.seq) tint = colorFor(opts.typeOf(n.seq));
        else if (n.seqs) tint = colorFor(opts.typeOf(n.seqs[0]));
      }

      if (n.kind === 'prop' || n.kind === 'merge') {
        var label = n.kind === 'merge' ? n.seqs.join('/') : n.seq;
        var bw = n.w, bh = n.h;
        g.appendChild(el('rect', {
          x: -bw / 2, y: -bh / 2, width: bw, height: bh,
          rx: 1.5, class: 'dg-prop-box'
        }));
        if (tint) {
          var tab = el('rect', {
            x: -bw / 2, y: bh / 2 - 3.5, width: bw, height: 3.5, rx: 1,
            class: 'dg-prop-tint'
          });
          tab.style.fill = tint;
          g.appendChild(tab);
        }
        var txt = el('text', { x: 0, y: 0, class: 'dg-prop-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        txt.textContent = label;
        g.appendChild(txt);
        // 拖拽热区在框外留一圈，方便连接时抓取
        g.appendChild(el('rect', { x: -bw / 2, y: -bh / 2, width: bw, height: bh, class: 'dg-hit' }));
      } else {
        var r = o.relR;
        var c = el('circle', { cx: 0, cy: 0, r: r, class: 'dg-rel-circle dg-rel--' + n.rel });
        g.appendChild(c);
        if (n.rel === 'plus') {
          var plus = el('text', { x: 0, y: 0.5, class: 'dg-rel-plus', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
          plus.textContent = '+';
          g.appendChild(plus);
        }
        g.appendChild(el('circle', { cx: 0, cy: 0, r: Math.max(r + 5, 13), class: 'dg-hit dg-hit--circle' }));
      }

      if (opts.onNodeClick) {
        g.addEventListener('click', function (ev) { ev.stopPropagation(); opts.onNodeClick(n, ev); });
      }
      if (opts.onNodeDown) {
        g.addEventListener('pointerdown', function (ev) { opts.onNodeDown(ev, n, g); });
      }
      nodeLayer.appendChild(g);
    });

    if (opts.onBackgroundClick) {
      svg.addEventListener('click', function (ev) { opts.onBackgroundClick(ev); });
    }

    return { svg: svg, root: root, width: W, height: H };
  }

  function offset(n, opts) {
    var d = opts.positions && opts.positions[n.id];
    if (!d) return n;
    return { x: n.x + (d.dx || 0), y: n.y + (d.dy || 0), w: n.w, h: n.h };
  }

  /* 正交折线：自 a 底边出发，走中线横向，再落到 b 顶边 */
  function route(a, b) {
    var x1 = a.x, y1 = a.y + a.h / 2;
    var x2 = b.x, y2 = b.y - b.h / 2 - 1;
    if (y2 - y1 < 12) {
      // 同一层或回指：走侧向弧，避免直线压在节点上
      var mx = (x1 + x2) / 2;
      return 'M' + round(x1) + ',' + round(y1) +
             ' C' + round(x1) + ',' + round(y1 + 26) +
             ' ' + round(mx) + ',' + round((y1 + y2) / 2) +
             ' ' + round(x2) + ',' + round(y2);
    }
    var my = y1 + (y2 - y1) * 0.5;
    if (Math.abs(x2 - x1) < 0.8) {
      return 'M' + round(x1) + ',' + round(y1) + ' L' + round(x2) + ',' + round(y2);
    }
    return 'M' + round(x1) + ',' + round(y1) +
           ' L' + round(x1) + ',' + round(my) +
           ' L' + round(x2) + ',' + round(my) +
           ' L' + round(x2) + ',' + round(y2);
  }

  function round(v) { return Math.round(v * 100) / 100; }

  var _uid = 0;
  function uid() { return 'm' + (++_uid); }

  /* ---- 导出为独立 SVG 字符串（供下载） ----------------------------------- */
  function toSVGString(svgEl, width, height) {
    var clone = svgEl.cloneNode(true);
    clone.setAttribute('width', width || svgEl.getAttribute('width'));
    clone.setAttribute('height', height || svgEl.getAttribute('height'));
    // 内联样式表：导出的 SVG 不依赖页面 CSS
    var style = document.createElementNS(NS, 'style');
    style.textContent = EXPORT_CSS;
    clone.insertBefore(style, clone.firstChild);
    // 把 CSS 变量解析成实际颜色
    var cs = getComputedStyle(document.documentElement);
    var css = style.textContent;
    Object.keys(CSS_VAR).forEach(function (k) {
      var name = CSS_VAR[k];
      var val = cs.getPropertyValue(name).trim() || '#171a1e';
      css = css.split('var(' + name + ')').join(val);
    });
    ['--ink', '--ink-2', '--ink-3', '--paper-raised', '--paper'].forEach(function (name) {
      var val = cs.getPropertyValue(name).trim() || '#171a1e';
      css = css.split('var(' + name + ')').join(val);
    });
    style.textContent = css;
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }

  var EXPORT_CSS = [
    '.dg-prop-box{fill:var(--paper-raised);stroke:var(--ink);stroke-width:1.4}',
    '.dg-prop-label{font-family:"Cascadia Mono",Consolas,monospace;font-size:12px;fill:var(--ink);font-weight:600}',
    '.dg-rel-circle{stroke:var(--ink);stroke-width:1.4}',
    '.dg-rel--solid{fill:var(--ink)}',
    '.dg-rel--hollow{fill:var(--paper-raised)}',
    '.dg-rel--plus{fill:var(--paper-raised)}',
    '.dg-rel-plus{font-family:Consolas,monospace;font-size:12px;fill:var(--ink)}',
    '.dg-edge{fill:none;stroke:var(--ink);stroke-width:1.3}',
    '.dg-edge--in{stroke:var(--ink-2)}',
    '.diagram-block-label{font-family:"Microsoft YaHei",sans-serif;font-size:11px;fill:var(--ink-3);letter-spacing:.08em}'
  ].join('');

  global.Diagram = {
    render: render,
    toSVGString: toSVGString,
    EXPORT_CSS: EXPORT_CSS
  };
})(window);
