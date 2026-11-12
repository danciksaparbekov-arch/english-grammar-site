// Мини-разметка для объяснений и ответов чата.
// Поддержка: ## заголовок, - список, > пример, | таблица |, **жирный**, *курсив*, `код`, ~~неверно~~.
// Весь текст сначала экранируется — HTML из данных и из ответов ИИ не исполняется.
(function () {
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/~~([^~]+)~~/g, '<span class="wrong">$1</span>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  }

  function render(text) {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let para = [], list = null, table = null, ex = null;

    function flush() {
      if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; }
      if (list) { out.push("<ul>" + list.map(li => "<li>" + inline(li) + "</li>").join("") + "</ul>"); list = null; }
      if (ex) { out.push('<div class="example">' + ex.map(inline).join("<br>") + "</div>"); ex = null; }
      if (table) {
        const [head, ...body] = table;
        let h = '<div class="table-wrap"><table><thead><tr>' + head.map(c => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>";
        h += body.map(r => "<tr>" + r.map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("");
        out.push(h + "</tbody></table></div>");
        table = null;
      }
    }

    for (const raw of lines) {
      const line = raw.trimEnd();
      const t = line.trim();
      if (!t) { flush(); continue; }
      if (t.startsWith("## ")) { flush(); out.push("<h3>" + inline(t.slice(3)) + "</h3>"); continue; }
      if (t.startsWith("|")) {
        if (!table) { flush(); table = []; }
        if (/^\|[\s:|-]+\|$/.test(t)) continue; // строка-разделитель
        table.push(t.replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
        continue;
      }
      if (t.startsWith("- ") || t.startsWith("* ")) {
        if (!list) { flush(); list = []; }
        list.push(t.slice(2));
        continue;
      }
      if (t.startsWith("> ")) {
        if (!ex) { flush(); ex = []; }
        ex.push(t.slice(2));
        continue;
      }
      if (list || table || ex) flush();
      para.push(t);
    }
    flush();
    return out.join("\n");
  }

  window.MD = { render, esc, inline };
})();
