/* ==========================================================================
   teaching/pages/docs.js —— 文档库（老师）
   上传待标注文档；学生可见本班全部文档。
   ========================================================================== */
(function (global) {
  'use strict';
  var Pages = global.TPages = global.TPages || {};
  var h = UI.h;
  var S = global.TStore;
  var extract = Text.extractReason;

  function render() {
    var cls = S.currentClass();
    var page = h('div.page');
    page.appendChild(uploadPanel(cls));
    page.appendChild(listPanel(cls));
    page.appendChild(h('div', { id: 'td-preview', style: { marginTop: '16px' } }));
    setTimeout(bindUpload, 0);
    return page;
  }

  function uploadPanel(cls) {
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '上传文档' }),
      h('div.spacer'),
      h('button.btn.btn--sm', { onclick: pasteSheet }, [UI.icon('edit'), h('span', { text: '粘贴文本' })])
    ]));

    var body = h('div.panel-body');
    body.appendChild(h('div.drop', { id: 'td-drop' }, [
      h('div.drop-title', { text: '拖入文件，或点击选择' }),
      h('div.drop-desc', { text: '纯文本（.txt）直接读取；PDF 与 Word 载入内置语料作等价替代' })
    ]));
    body.appendChild(h('input', { type: 'file', id: 'td-file', multiple: true, hidden: true, accept: '.txt,.pdf,.doc,.docx' }));

    body.appendChild(h('div', { style: { marginTop: '18px' } }, [
      h('div.field-label', { text: '内置语料' }),
      h('div.grid-3', {}, DATA.DOCUMENTS.map(function (d) {
        return h('button.stage-card', { onclick: function () { showPreview(d.title, d.kind, d.reason, d); } }, [
          h('div.stage-card-top', {}, [h('span.stage-no', { text: d.kind })]),
          h('div.stage-name', { text: d.short }),
          h('div.stage-desc', { text: '裁判理由 ' + d.reason.length + ' 字' })
        ]);
      }))
    ]));
    panel.appendChild(body);
    return panel;
  }

  function bindUpload() {
    var drop = UI.$('#td-drop'), file = UI.$('#td-file');
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
        reader.onload = function () { previewFromText(f.name.replace(/\.txt$/i, ''), String(reader.result)); };
        reader.readAsText(f, 'utf-8');
      } else {
        var d = DATA.DOCUMENTS[1];
        UI.toast('不解析 ' + ext.toUpperCase() + '，已载入内置语料作等价替代', 'quiet');
        showPreview(f.name.replace(/\.[^.]+$/, ''), d.kind, d.reason, d);
      }
    });
  }

  function previewFromText(title, text) {
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
    var holder = UI.$('#td-preview');
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
      failed ? h('span.badge.badge--seal', { text: '未找到边界，请手动校正' })
             : h('span.badge.badge--ok', { text: '已提取' })
    ]));

    var b = h('div.panel-body');
    b.appendChild(h('div.grid-2', {}, [
      h('label.field', {}, [h('span.field-label', { text: '文档命名' }), nameInput]),
      h('label.field', {}, [h('span.field-label', { text: '案例类型' }), kindSel])
    ]));
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
          S.addDocument({
            classId: S.currentClass().id, title: nameInput.value || title, short: (nameInput.value || title).slice(0, 22),
            kind: kindSel.value, lead: doc ? doc.lead : '', reason: text,
            meta: doc ? S.clone(doc.meta) : { 案例类型: kindSel.value }, answer: null
          });
          UI.toast('已加入文档库', 'quiet');
          global.reRender();
        }
      }, [UI.icon('check'), h('span', { text: '加入文档库' })])
    ]));

    holder.appendChild(panel);
    holder.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            previewFromText('粘贴文本', t);
          }
        }
      ]
    });
  }

  function listPanel(cls) {
    var docs = S.docsOf(cls.id);
    var panel = h('div.panel');
    panel.appendChild(h('div.panel-head', {}, [
      h('div.panel-title', { text: '文档库' }),
      h('div.spacer'),
      h('div.pane-note', { text: docs.length + ' 份 · 本班学生均可见' })
    ]));

    if (!docs.length) {
      panel.appendChild(h('div.panel-body', {}, [
        h('div.empty', {}, [h('div.empty-desc', { text: '本班还没有文档。' })])
      ]));
      return panel;
    }

    var tbl = h('table.tbl');
    tbl.appendChild(h('thead', {}, [h('tr', {}, [
      h('th', { text: '文档' }),
      h('th', { style: { width: '110px' }, text: '案例类型' }),
      h('th', { style: { width: '90px' }, text: '裁判理由' }),
      h('th', { style: { width: '110px' }, text: '标准答案' }),
      h('th', { style: { width: '130px' } })
    ])]));
    var tb = h('tbody');
    docs.forEach(function (d) {
      tb.appendChild(h('tr', {}, [
        h('td', {}, [
          h('div', { text: d.title }),
          h('div.tiny.faint', { text: d.meta['案号'] || d.meta['入库编号'] || '—' })
        ]),
        h('td', {}, [h('span.tag.tag--sm.tag--plain', { text: d.kind })]),
        h('td.mono.tiny', { text: d.reason.length + ' 字' }),
        h('td', {}, [
          d.answer
            ? h('span.badge.badge--ok', { text: '已标 · ' + d.answer.elements.length + ' 命题' })
            : h('span.badge.badge--muted', { text: '未标' })
        ]),
        h('td', {}, [
          h('button.btn.btn--sm', { onclick: function () { global.go('answer', { doc: d.id }); } },
            [h('span', { text: d.answer ? '修改答案' : '标答案' })])
        ])
      ]));
    });
    tbl.appendChild(tb);
    panel.appendChild(h('div.panel-body.panel-body--flush', {}, [tbl]));
    return panel;
  }

  Pages.docs = {
    chrome: function () { return { title: '文档库' }; },
    render: render
  };
})(window);
