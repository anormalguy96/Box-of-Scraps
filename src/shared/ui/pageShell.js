export function mountTopbar({ title, subtitle, homeHref="/" }){
  const top = document.createElement("div");
  top.className = "topbar";
  top.innerHTML = `
    <div class="brand">
      <a href="${homeHref}" aria-label="Home"></a>
      <div>
        <div style="font-size:14px; opacity:.92">${title}</div>
        <div class="small">${subtitle ?? ""}</div>
      </div>
    </div>
  `;
  return top;
}