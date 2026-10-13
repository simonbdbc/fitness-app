(() => {
  const promptKey = "__ACREA_PWA_INSTALL_PROMPT__";
  const promptEventName = "acrea:pwa-install-prompt";

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    window[promptKey] = event;
    window.dispatchEvent(new Event(promptEventName));
  });

  window.addEventListener("appinstalled", () => {
    window[promptKey] = null;
  });
})();
