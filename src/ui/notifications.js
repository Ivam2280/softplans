export function createNotifier(element) {
  let timer;
  return (message) => {
    clearTimeout(timer);
    element.textContent = message;
    element.hidden = false;
    const dialog = [...document.querySelectorAll("dialog[open]")].at(-1);
    if (dialog) {
      let status = dialog.querySelector(".dialog-status");
      if (!status) {
        status = document.createElement("p");
        status.className = "dialog-status";
        status.setAttribute("role", "status");
        dialog.querySelector(".group-dialog-form").append(status);
      }
      status.textContent = message;
    }
    timer = setTimeout(() => {
      element.hidden = true;
    }, 5500);
  };
}
