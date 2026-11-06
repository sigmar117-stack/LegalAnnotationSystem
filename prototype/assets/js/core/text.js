/* ==========================================================================
   core/text.js —— 文本切分与定位（指南 §2.3）

   第一次切割以句号为单位；句内以逗号、分号考查子句。
   所有过渡语词（「因此，」「综上来看，」等）与其之后的第一个要素切在一起。
   标注系统与教学系统共用。
   ========================================================================== */
(function (global) {
  'use strict';

  var TRANSITIONAL = /^(因此|所以|据此|综上|综上所?述|由此可见|然而|但是|但|故|因而|从而|另外|此外|同时|第一|第二|第三|其一|其二|其三)\s*[，,、]?$/;

  /* 返回 [{start, end, text}] 候选切割段 */
  function suggestCut(text) {
    var out = [], buf = '';
    for (var i = 0; i < text.length; i++) {
      buf += text[i];
      if ('。！？；'.indexOf(text[i]) >= 0) { out.push(buf); buf = ''; }
    }
    if (buf.trim()) out.push(buf);

    var merged = [];
    for (var j = 0; j < out.length; j++) {
      var seg = out[j];
      if (seg.trim() && TRANSITIONAL.test(seg.trim().replace(/[。；，]$/, '')) && j < out.length - 1) {
        out[j + 1] = seg + out[j + 1];
        continue;
      }
      merged.push(seg);
    }

    var cursor = 0, result = [];
    merged.forEach(function (seg) {
      var idx = text.indexOf(seg, cursor);
      if (idx < 0) idx = cursor;
      result.push({ start: idx, end: idx + seg.length, text: seg });
      cursor = idx + seg.length;
    });
    return result;
  }

  /* 在原文中定位若干片段 */
  function locate(text, pieces) {
    var cursor = 0, out = [];
    pieces.forEach(function (p) {
      var t = typeof p === 'string' ? p : p.text;
      var idx = text.indexOf(t, cursor);
      if (idx < 0) idx = text.indexOf(t);
      if (idx < 0) { out.push(null); return; }
      out.push({ start: idx, end: idx + t.length, text: t });
      cursor = idx + t.length;
    });
    return out;
  }

  /* 把要素解析为可渲染的区间；位置失配时回退到全文检索 */
  function spansOf(reason, elements) {
    var out = [];
    (elements || []).forEach(function (e) {
      var start = e.start;
      if (start === undefined || start === null || reason.substr(start, e.text.length) !== e.text) {
        var idx = reason.indexOf(e.text);
        if (idx < 0) return;
        start = idx;
      }
      out.push({ seq: e.seq, start: start, end: start + e.text.length, el: e });
    });
    out.sort(function (a, b) { return a.start - b.start; });
    return out;
  }

  /* 按原文顺序重排要素序号，并把关系里的引用一起重映射 */
  function renumber(elements, relations) {
    var sorted = (elements || []).slice().sort(function (a, b) {
      var sa = (a.start === undefined || a.start === null) ? 1e9 : a.start;
      var sb = (b.start === undefined || b.start === null) ? 1e9 : b.start;
      return sa - sb;
    });
    var map = {};
    sorted.forEach(function (e, i) { var ns = 'P' + (i + 1); map[e.seq] = ns; e.seq = ns; });

    var rels = (relations || []).map(function (r) {
      var t = remap(r.tree, map);
      return t ? { id: r.id, tree: t, label: global.Formal.print(t) } : null;
    }).filter(Boolean);
    rels.forEach(function (r, i) { r.id = 'R' + (i + 1); });

    return { elements: sorted, relations: rels, map: map };
  }

  function remap(node, map) {
    if (!node) return null;
    if (node.p) return map[node.p] ? { p: map[node.p] } : null;
    var kids = node.c.map(function (k) { return remap(k, map); });
    if (kids.some(function (k) { return !k; })) return null;
    return { t: node.t, c: kids };
  }

  /* 命题 / 标签 / 关系的简单重合度，用于教学系统的相似率 */
  function similarity(mine, answer) {
    if (!answer || !answer.elements || !answer.elements.length) return null;
    var a = index(answer.elements), b = index(mine.elements);

    var props = Object.keys(a);
    var matched = 0, labelOk = 0;
    props.forEach(function (seq) {
      if (!b[seq]) return;
      matched++;
      if (a[seq].code === b[seq].code && (a[seq].sub || '') === (b[seq].sub || '')) labelOk++;
    });

    var relA = {}, relB = {};
    (answer.relations || []).forEach(function (r) { relA[global.Formal.print(r.tree)] = 1; });
    (mine.relations || []).forEach(function (r) { relB[global.Formal.print(r.tree)] = 1; });
    var relKeys = Object.keys(relA);
    var relOk = relKeys.filter(function (k) { return relB[k]; }).length;

    var propScore = matched ? labelOk / props.length : 0;
    var relScore = relKeys.length ? relOk / relKeys.length : 0;
    var cover = props.length ? (matched / props.length) : 0;

    // 命题覆盖 30% + 标签正确 40% + 关系重合 30%
    return Math.round((cover * 0.3 + propScore * 0.4 + relScore * 0.3) * 100);

    function index(list) {
      var m = {};
      (list || []).forEach(function (e) { m[e.seq] = e; });
      return m;
    }
  }

  /* ======================================================================
     裁判理由的范围识别（指南 §2.2.1）
       原始判决书：自「本院认为」起，至「判决如下」所在句子之前
       指导性案例 / 参考案例：「裁判理由」段落
     ====================================================================== */
  var MARKERS = {
    '原始判决书': { start: ['本院认为', '本院经审理认为'], end: ['判决如下', '裁定如下'] },
    '指导性案例': { start: ['法院生效裁判认为', '裁判理由'], end: ['裁判要旨', '关联索引', '裁判结果'] },
    '参考案例':   { start: ['裁判理由'], end: ['裁判要旨', '关联索引'] }
  };

  function extractReason(text, kind) {
    var m = MARKERS[kind] || MARKERS['原始判决书'];
    var startIdx = -1, startMark = '';
    for (var i = 0; i < m.start.length; i++) {
      var p = text.indexOf(m.start[i]);
      if (p >= 0) { startIdx = p; startMark = m.start[i]; break; }
    }
    if (startIdx < 0) return { ok: false, reason: '未找到起始标记' };

    var from = startIdx + startMark.length;
    var lead = /^[，,：:]\s*/.exec(text.slice(from));
    if (lead) from += lead[0].length;

    var endIdx = text.length;
    m.end.forEach(function (mark) {
      var q = text.indexOf(mark, from);
      if (q >= 0 && q < endIdx) endIdx = q;
    });
    var body = text.slice(from, endIdx).trim();
    if (body.length < 20) return { ok: false, reason: '提取到的内容过短' };
    return { ok: true, start: from, end: endIdx, lead: text.slice(startIdx, from), body: body };
  }

  global.Text = {
    suggestCut: suggestCut,
    locate: locate,
    spansOf: spansOf,
    renumber: renumber,
    similarity: similarity,
    extractReason: extractReason,
    MARKERS: MARKERS
  };
})(window);
