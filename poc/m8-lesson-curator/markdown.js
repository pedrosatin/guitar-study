(function (root) {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function inline(s) {
    s = escapeHtml(s);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return s;
  }

  function render(md) {
    const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let listOpen = false;

    function closeList() {
      if (listOpen) { out.push("</ul>"); listOpen = false; }
    }

    while (i < lines.length) {
      const line = lines[i];

      if (/^###\s+/.test(line)) {
        closeList();
        out.push("<h3>" + inline(line.replace(/^###\s+/, "")) + "</h3>");
        i++; continue;
      }
      if (/^##\s+/.test(line)) {
        closeList();
        out.push("<h2>" + inline(line.replace(/^##\s+/, "")) + "</h2>");
        i++; continue;
      }
      if (/^#\s+/.test(line)) {
        closeList();
        out.push("<h1>" + inline(line.replace(/^#\s+/, "")) + "</h1>");
        i++; continue;
      }

      if (/^\s*-\s+/.test(line)) {
        if (!listOpen) { out.push("<ul>"); listOpen = true; }
        out.push("<li>" + inline(line.replace(/^\s*-\s+/, "")) + "</li>");
        i++; continue;
      }

      if (line.trim() === "") {
        closeList();
        i++; continue;
      }

      let para = line;
      let j = i + 1;
      while (j < lines.length &&
             lines[j].trim() !== "" &&
             !/^(#{1,3})\s+/.test(lines[j]) &&
             !/^\s*-\s+/.test(lines[j])) {
        para += "\n" + lines[j];
        j++;
      }
      closeList();
      para = inline(para).replace(/\n/g, "<br/>");
      out.push("<p>" + para + "</p>");
      i = j;
    }
    closeList();
    return out.join("\n");
  }

  root.Markdown = { render: render };
})(window);