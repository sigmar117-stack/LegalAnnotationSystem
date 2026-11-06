/* ==========================================================================
   labeling/pages/docs.js —— 文书与语料
   上传本团体的待标注文书，按规则提取裁判理由并可人工校正。
   原型不解析 PDF / Word 二进制，拖入时载入内置语料作等价替代。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.LPages = global.LPages || {};
  var h = UI.h;
  var S = global.LStore;

  var extract = Text.extractReason;

  function render() {
    var team = S.currentTeam();
    var page = h('div.page');
    page.appendChild(uploadPanel(team));
    page.appendChild(documentPanel(team));
    page.appendChild(h('div', { id: 'doc-preview', style: { marginTop: '16px' } }));
    setTimeout(bindUpload, 0);
    return page;
  }

  function uploadPanel(team) {
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '上传文书' }),
      h('div.spacer'),
      h('button.btn.btn--sm', { onclick: pasteSheet }, [UI.icon('edit'), h('span', { text: '粘贴文本' })])
    ]));

    var body = h('div.panel-body');
    var drop = h('div.drop', { id: 'doc-drop' }, [
      h('div.drop-title', { text: '拖入文件，或点击选择' }),
      h('div.drop-desc', { text: '纯文本（.txt）直接读取；PDF 与 Word 载入内置语料作等价替代' })
    ]);
    body.appendChild(drop);
    body.appendChild(h('input', { type: 'file', id: 'doc-file', multiple: true, hidden: true, accept: '.txt,.pdf,.doc,.docx' }));

    var use = DATA.DOCUMENTS.filter(function (d) {
      return !S.docsOf(team.id).some(function (x) { return x.id === d.id; });
    });
    if (use.length) {
      body.appendChild(h('div', { style: { marginTop: '18px' } }, [
        h('div.field-label', { text: '内置语料' }),
        h('div.grid-3', {}, use.map(function (d) {
          return h('button.stage-card', { onclick: function () { showPreview(d.title, d.kind, d.reason, d); } }, [
            h('div.stage-card-top', {}, [h('span.stage-no', { text: d.kind })]),
            h('div.stage-name', { text: d.short }),
            h('div.stage-desc', { text: '裁判理由 ' + d.reason.length + ' 字' })
          ]);
        }))
      ]));
    }
    panel.appendChild(body);
    return panel;
  }

  function bindUpload() {
    var drop = UI.$('#doc-drop'), file = UI.$('#doc-file');
    if (!drop) return;
    drop.addEventListener('click', function () { file.click(); });
    ['dragenter', 'dragover'].forEach(function (e) {
      drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (e) {
      drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (ev) {
      if (ev.dataTransfer && ev.dataTransfer.files.length) handleFiles(ev.dataTransfer.files);
    });
    file.addEventListener('change', function () { handleFiles(file.files); });
  }

  function handleFiles(files) {
    Array.prototype.forEach.call(files, function (f) {
      var ext = (f.name.split('.').pop() || '').toLowerCase();
      if (ext === 'txt') {
        var reader = new FileReader();
        reader.onload = function () { extractAndPreview(f.name.replace(/\.txt$/i, ''), String(reader.result)); };
        reader.readAsText(f, 'utf-8');
      } else {
        var d = DATA.DOCUMENTS[1];
        UI.toast('不解析 ' + ext.toUpperCase() + '，已载入内置语料作等价替代', 'quiet');
        showPreview(f.name.replace(/\.[^.]+$/, ''), d.kind, d.reason, d);
      }
    });
  }

  function extractAndPreview(title, text) {
    var kind = /裁判理由|指导性案例/.test(text) ? '指导性案例' : '原始判决书';
    var r = extract(text, kind);
    if (!r.ok) {
      UI.toast('提取失败：' + r.reason, 'seal');
      showPreview(title, kind, text, null, r.reason);
      return;
    }
    showPreview(title, kind, r.body, null, null, { extracted: r, source: text });
  }

  function showPreview(title, kind, body, doc, failed, extra) {
    extra = extra || {};
    var holder = UI.$('#doc-preview');
    UI.clear(holder);

    var nameInput = h('input.input', { value: doc ? doc.title : title });
    var kindSel = h('select.select', { style: { width: '160px' } });
    ['原始判决书', '指导性案例', '参考案例'].forEach(function (k) {
      var o = h('option', { value: k, text: k });
      if (k === kind) o.selected = true;
      kindSel.appendChild(o);
    });
    var textarea = h('textarea.textarea', { style: { minHeight: '200px' }, text: body });

    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '裁判理由' }),
      h('div.spacer'),
      failed ? h('span.badge.badge--seal', { text: '未按规则找到边界，请手动校正' })
             : h('span.badge.badge--ok', { text: '已提取' })
    ]));

    var b = h('div.panel-body');
    b.appendChild(h('div.grid-2', {}, [
      h('label.field', {}, [h('span.field-label', { text: '文档命名' }), nameInput]),
      h('label.field', {}, [h('span.field-label', { text: '案例类型' }), kindSel])
    ]));

    if (extra.extracted && extra.source) {
      var before = extra.source.slice(Math.max(0, extra.extracted.start - 60), extra.extracted.start);
      var after = extra.source.slice(extra.extracted.end, extra.extracted.end + 60);
      b.appendChild(h('div.field', {}, [
        h('span.field-label', { text: '提取范围' }),
        h('div.extract', { style: { maxHeight: '160px', overflow: 'auto' } }, [
          h('span.outside', { text: '…' + before }),
          h('mark', { text: extra.extracted.lead + extra.extracted.body }),
          h('span.outside', { text: after + '…' })
        ])
      ]));
    }
    b.appendChild(h('label.field', {}, [
      h('span.field-label', { text: '裁判理由文本（可校正）' }),
      textarea
    ]));

    panel.appendChild(b);
    panel.appendChild(h('div.panel-foot', {}, [
      h('div.spacer'),
      h('button.btn.btn--sm.btn--primary', {
        onclick: function () {
          var text = textarea.value.trim();
          if (text.length < 20) { UI.toast('内容过短', 'seal'); return; }
          addDocument(nameInput.value || title, kindSel.value, text, doc);
        }
      }, [UI.icon('check'), h('span', { text: '加入语料库' })])
    ]));

    holder.appendChild(panel);
    holder.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function addDocument(title, kind, reason, src) {
    var team = S.currentTeam();
    S.addDocument({
      teamId: team.id, title: title, short: title.slice(0, 22), kind: kind,
      lead: src ? src.lead : '', reason: reason,
      meta: src ? S.clone(src.meta) : { 案例类型: kind }
    });
    UI.toast('已加入语料库', 'quiet');
    global.reRender();
  }

  function pasteSheet() {
    var ta = h('textarea.textarea', { placeholder: '粘贴裁判文书全文或裁判理由部分', style: { minHeight: '200px' } });
    UI.modal({
      title: '粘贴文本',
      body: ta,
      actions: [
        { spacer: true }, { label: '取消' },
        {
          label: '提取裁判理由', kind: 'primary',
          onClick: function (close) {
            var t = ta.value.trim();
            if (t.length < 20) { UI.toast('内容过短', 'seal'); return; }
            close();
            extractAndPreview('粘贴文本', t);
          }
        }
      ]
    });
  }

  function documentPanel(team) {
    var docs = S.docsOf(team.id);
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '语料库' }),
      h('div.spacer'),
      h('div.pane-note', { text: docs.length + ' 份 · 仅本团体可见' })
    ]));

    if (!docs.length) {
      panel.appendChild(h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: '本团体还没有文书。' })])
      ]));
      return panel;
    }

    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { text: '文书' }),
      h('th', { style: { width: '110px' }, text: '案例类型' }),
      h('th', { style: { width: '90px' }, text: '裁判理由' }),
      h('th', { style: { width: '130px' }, text: '分配情况' }),
      h('th', { style: { width: '60px' } })
    ])]));
    var tb = h('tbody');
    docs.forEach(function (d) {
      var tasks = S.tasksOf(team.id).filter(function (t) {
        return t.items.some(function (it) { return it.docId === d.id; });
      });
      tb.appendChild(h('tr', {}, [
        h('td', {}, [
          h('div', { text: d.title }),
          h('div.tiny.faint', { text: d.meta['案号'] || d.meta['入库编号'] || d.meta['发布时间'] || '—' })
        ]),
        h('td', {}, [h('span.tag.tag--sm.tag--plain', { text: d.kind })]),
        h('td.mono.tiny', { text: d.reason.length + ' 字' }),
        h('td', {}, [
          tasks.length
            ? h('span.badge.badge--ok', { text: '已用于 ' + tasks.length + ' 个任务' })
            : h('span.badge.badge--muted', { text: '未分配' })
        ]),
        h('td', {}, [
          h('button.btn.btn--sm.btn--ghost', { title: '移除', onclick: function () { removeDoc(d, tasks.length); } },
            [UI.icon('trash')])
        ])
      ]));
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    return panel;
  }

  function removeDoc(d, used) {
    UI.confirm({
      title: '移除文书',
      message: used ? '该文书已用于 ' + used + ' 个任务，移除后相关分配将失效。' : '确认从语料库移除「' + d.short + '」？',
      okLabel: '移除', danger: true,
      onOk: function () { S.removeDocument(d.id); global.reRender(); }
    });
  }

  Pages.docs = {
    chrome: function () { return { title: '文书与语料' }; },
    render: render,
    extract: extract
  };
})(window);
