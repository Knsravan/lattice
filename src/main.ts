import { site, scene1, scene2, comingSoon } from "./ui/copy.ts";
import { el, $ } from "./ui/dom.ts";
import { mountScene1 } from "./scenes/scene1-grid.ts";
import { mountScene2 } from "./scenes/scene2-basis.ts";

/** Builds the page from copy.ts and mounts each scene into its section. */
function build() {
  const app = $("#app");

  // hero
  app.append(
    el(
      "header",
      { class: "hero" },
      el("h1", { text: site.title }),
      el("p", { class: "tagline", text: site.tagline }),
      ...site.intro.map((t) => el("p", { class: "intro", text: t })),
      el("a", { class: "scroll-hint", href: "#scene-1", text: site.scrollHint + " ↓" }),
    ),
  );

  // scene 1
  const s1 = section("scene-1", scene1.kicker, scene1.title, scene1.paragraphs);
  app.append(s1.section);
  mountScene1(s1.stage);

  // scene 2
  const s2 = section("scene-2", scene2.kicker, scene2.title, scene2.paragraphs);
  app.append(s2.section);
  mountScene2(s2.stage);

  // placeholders for the rest
  for (const [i, c] of comingSoon.entries()) {
    const s = section(`scene-${i + 3}`, c.kicker, c.title, [c.blurb]);
    s.stage.append(el("div", { class: "placeholder", text: "In progress" }));
    s.section.classList.add("soon");
    app.append(s.section);
  }

  // footer
  app.append(
    el(
      "footer",
      {},
      el("span", { text: "Lattice · built in September 2026 · " }),
      el("a", { href: "https://github.com/Knsravan/lattice", text: "source on GitHub" }),
    ),
  );

  // nav dots
  const nav = el("nav", { class: "dots", "aria-label": "Scenes" });
  const ids = ["scene-1", "scene-2", "scene-3", "scene-4", "scene-5"];
  const links = ids.map((id, i) => el("a", { href: `#${id}`, title: `Scene ${i + 1}`, "aria-label": `Scene ${i + 1}` }));
  nav.append(...links);
  document.body.append(nav);
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const i = ids.indexOf(e.target.id);
        if (i >= 0) links[i].classList.toggle("active", e.isIntersecting);
      }
    },
    { threshold: 0.4 },
  );
  for (const id of ids) io.observe($(`#${id}`));
}

function section(id: string, kicker: string, title: string, paragraphs: string[]) {
  const stage = el("div", { class: "stage-wrap" });
  const prose = el(
    "div",
    { class: "prose" },
    el("div", { class: "kicker", text: kicker }),
    el("h2", { text: title }),
    ...paragraphs.map((t) => el("p", { text: t })),
  );
  const sectionEl = el("section", { id, class: "scene" }, prose, stage);
  return { section: sectionEl, stage };
}

build();
