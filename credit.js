// The Caspian Studio credit, in one place.
//
// It used to be copied into the footer markup of every page, which meant a
// wording change was a nine-file edit. Now each page just loads this.
(function () {
  var host =
    document.querySelector("footer .copyright span") ||
    document.querySelector("footer .f span");
  if (!host || host.querySelector(".studio-credit")) return;

  var el = document.createElement("span");
  el.className = "studio-credit";
  el.style.cssText = "display:block;opacity:.72;font-size:.92em;margin-top:2px";
  el.innerHTML =
    'Made with love by <a href="https://caspianstudio.in" target="_blank" ' +
    'rel="noopener" style="color:inherit;text-decoration:underline">Caspian Studio</a>';
  host.appendChild(el);
})();
