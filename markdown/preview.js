(function () {
  const encodeBase64 = text => btoa(unescape(encodeURIComponent(text)));

  const replaceFences = () => {
    for (const code of document.querySelectorAll('pre > code.language-markgraf, pre > code.lang-markgraf')) {
      const pre = code.parentElement;
      if (!pre || pre.dataset.markgrafReplaced === "1") {
        continue;
      }

      pre.dataset.markgrafReplaced = "1";
      const preview = document.createElement("div");
      preview.className = "markgraf-markdown-preview markgraf-embed";
      preview.setAttribute("data-markgraf", "");
      preview.setAttribute("data-markgraf-src-b64", encodeBase64(code.textContent || ""));
      preview.setAttribute("data-markgraf-titles", "false");
      pre.replaceWith(preview);
    }
  };

  const mount = () => {
    replaceFences();
    if (window.markgraf && typeof window.markgraf.mountAll === "function") {
      window.markgraf.mountAll(document);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
})();
