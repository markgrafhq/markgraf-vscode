(function () {
  const themes = ["light", "dark", "blueprint", "whiteboard", "isometric"];
  const themeLabels = {
    light: "Light",
    dark: "Dark",
    blueprint: "Blueprint",
    whiteboard: "Whiteboard",
    isometric: "Isometric"
  };

  const encodeBase64 = text => btoa(unescape(encodeURIComponent(text)));
  const savedTheme = () => localStorage.getItem("markgraf.markdownTheme") || defaultTheme();
  const defaultTheme = () => document.body.classList.contains("vscode-light") ? "light" : "dark";

  const isMarkgrafCode = code => {
    const classes = Array.from(code.classList);
    return classes.some(name => name === "language-markgraf" || name === "lang-markgraf" || name.endsWith("-markgraf"));
  };

  const replaceFences = () => {
    for (const code of document.querySelectorAll("pre > code")) {
      if (!isMarkgrafCode(code)) {
        continue;
      }

      const pre = code.parentElement;
      if (!pre || pre.dataset.markgrafReplaced === "1") {
        continue;
      }

      pre.dataset.markgrafReplaced = "1";
      pre.replaceWith(markgrafBlock(code.textContent || ""));
    }
  };

  const markgrafBlock = source => {
    const shell = document.createElement("div");
    shell.className = "markgraf-markdown-shell";

    const toolbar = document.createElement("div");
    toolbar.className = "markgraf-markdown-toolbar";
    toolbar.setAttribute("aria-label", "Markgraf preview theme");

    const preview = document.createElement("div");
    preview.className = "markgraf-markdown-preview markgraf-embed";
    preview.setAttribute("data-markgraf", "");
    preview.setAttribute("data-markgraf-src-b64", encodeBase64(source));
    preview.setAttribute("data-markgraf-titles", "false");
    preview.setAttribute("data-markgraf-theme", savedTheme());

    for (const theme of themes) {
      const button = document.createElement("button");
      button.className = "markgraf-markdown-theme-button";
      button.type = "button";
      button.textContent = themeLabels[theme];
      button.dataset.theme = theme;
      button.addEventListener("click", () => setTheme(preview, toolbar, theme));
      toolbar.appendChild(button);
    }

    shell.appendChild(toolbar);
    shell.appendChild(preview);
    markSelectedTheme(toolbar, savedTheme());
    return shell;
  };

  const setTheme = (preview, toolbar, theme) => {
    localStorage.setItem("markgraf.markdownTheme", theme);
    markSelectedTheme(toolbar, theme);
    pause(preview);
    preview.innerHTML = "";
    preview.setAttribute("data-markgraf-theme", theme);
    preview.setAttribute("data-markgraf-mounted", "1");
    window.markgraf?.mount(preview, sourceFromPreview(preview));
  };

  const markSelectedTheme = (toolbar, theme) => {
    for (const button of toolbar.querySelectorAll("[data-theme]")) {
      button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
    }
  };

  const sourceFromPreview = preview => decodeURIComponent(escape(atob(preview.getAttribute("data-markgraf-src-b64") || "")));

  const pause = preview => {
    const play = preview.querySelector('[data-mg="play"]');
    if (play?.dataset.mgPlaying === "1") {
      play.click();
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
