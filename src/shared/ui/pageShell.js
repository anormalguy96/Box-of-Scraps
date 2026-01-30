export function mountTopbar({ title, subtitle, homeHref = "/" }) {
  const top = document.createElement("div");
  top.className = "topbar";
  top.innerHTML = `
    <div class="brand" style="display:flex; align-items:center; gap:12px;">
      <a href="${homeHref}" aria-label="Home" class="pill mono" style="text-decoration:none;">
        home
      </a>
      <div style="display:flex; flex-direction:column; gap:2px;">
        <div style="font-size:14px; opacity:.92">${title}</div>
        <div class="small">${subtitle ?? ""}</div>
      </div>
    </div>

    <div class="pill mono" id="statusPill">idle</div>
  `;
  return top;
}

export function setPill(text) {
  const el = document.getElementById("statusPill");
  if (el) el.textContent = text ?? "";
}
