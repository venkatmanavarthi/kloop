const tile = document.getElementById("tile")!;

window.krackloop.helper.info().then(({ name, icon }) => {
  document.getElementById("name")!.textContent = name;
  for (const img of document.querySelectorAll<HTMLImageElement>("[data-icon]")) img.src = icon;
});

// Swap the browser's drag for a native file drag of the .app bundle, which System Settings accepts.
// The drag image is just the icon.
tile.addEventListener("dragstart", (event) => {
  event.preventDefault();
  window.krackloop.helper.startDrag();
});

document.getElementById("back")!.addEventListener("click", () => window.krackloop.helper.close());
