(function (root) {
  const W = 110, H = 140;
  const NUM_STRINGS = 6;
  const NUM_FRETS = 5;
  const PAD_X = 14;
  const PAD_TOP = 26;
  const PAD_BOTTOM = 14;
  const GRID_W = W - PAD_X * 2;
  const GRID_H = H - PAD_TOP - PAD_BOTTOM;
  const STR_GAP = GRID_W / (NUM_STRINGS - 1);
  const FRET_GAP = GRID_H / NUM_FRETS;

  function xForString(s) { return PAD_X + s * STR_GAP; }
  function yForFret(f) { return PAD_TOP + (f - 0.5) * FRET_GAP; }

  function render(chord) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const frets = chord.frets || ["x","x","x","x","x","x"];
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", chord.name + ". " + frets.map((f, i) => `${6-i}ª corda: ${f === "x" ? "não tocar" : f === 0 ? "solta" : "casa " + f}`).join("; "));
    const ns = "http://www.w3.org/2000/svg";

    function el(tag, attrs) {
      const e = document.createElementNS(ns, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    for (let f = 1; f <= NUM_FRETS; f++) {
      svg.appendChild(el("line", {
        x1: PAD_X, y1: PAD_TOP + f * FRET_GAP,
        x2: W - PAD_X, y2: PAD_TOP + f * FRET_GAP,
        stroke: "#8b93a7", "stroke-width": "1"
      }));
    }
    svg.appendChild(el("rect", {
      x: PAD_X - 2, y: PAD_TOP - 4,
      width: GRID_W + 4, height: 4,
      fill: "#7aa2f7"
    }));

    for (let s = 0; s < NUM_STRINGS; s++) {
      svg.appendChild(el("line", {
        x1: xForString(s), y1: PAD_TOP,
        x2: xForString(s), y2: H - PAD_BOTTOM,
        stroke: "#8b93a7", "stroke-width": "1"
      }));
    }

    for (let s = 0; s < NUM_STRINGS; s++) {
      const fret = frets[s];
      const cx = xForString(s);
      let label;
      if (fret === "x" || fret === "X") {
        svg.appendChild(el("text", {
          x: cx, y: PAD_TOP - 8,
          fill: "#8b93a7", "font-size": "11",
          "text-anchor": "middle",
          "font-family": "sans-serif"
        })).textContent = "X";
      } else if (fret === 0) {
        svg.appendChild(el("circle", {
          cx: cx, cy: PAD_TOP - 8, r: 5,
          fill: "none", stroke: "#8b93a7", "stroke-width": "1.5"
        }));
      } else {
        svg.appendChild(el("circle", {
          cx: cx, cy: yForFret(fret),
          r: 6, fill: "#7aa2f7"
        }));
      }
    }

    return svg;
  }

  root.ChordSvg = { render: render, W: W, H: H };
})(window);