(function () {
  const mount = () => {
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
