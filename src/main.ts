import { site, chapter0, chapter1, scene1, scene2, scene3, scene4, scene5 } from "./ui/copy.ts";
import { el, $ } from "./ui/dom.ts";
import { mountHero } from "./ui/hero.ts";
import { mountChapter0 } from "./scenes/chapter0-problem.ts";
import { mountChapter1 } from "./scenes/chapter1-grid.ts";
import { mountScene1 } from "./scenes/scene1-grid.ts";
import { mountScene2 } from "./scenes/scene2-basis.ts";
import { mountScene3 } from "./scenes/scene3-noise.ts";
import { mountScene4 } from "./scenes/scene4-dimensions.ts";
import { mountScene5 } from "./scenes/scene5-kyber.ts";

/** Builds the page from copy.ts and mounts each scene into its section. */
function build() {
  const app = $("#app");

  // hero, with a slowly shearing lattice behind the title
  const hero = el(
    "header",
    { class: "hero" },
    el("h1", { text: site.title }),
    el("p", { class: "tagline", text: site.tagline }),
    ...site.intro.map((t) => el("p", { class: "intro", text: t })),
    el("a", { class: "scroll-hint", href: "#chapter-0", text: site.scrollHint + " ↓" }),
  );
  app.append(hero);
  mountHero(hero);

  // chapter 0: the problem (scroll story)
  const c0 = chapter("chapter-0", chapter0.kicker, chapter0.title);
  app.append(c0.section);
  mountChapter0(c0.body);

  // chapter 1: the grid (scroll story), then "try it yourself"
  const c1 = chapter("chapter-1", chapter1.kicker, chapter1.title);
  app.append(c1.section);
  mountChapter1(c1.body);

  const s1 = section("scene-1", scene1.kicker, scene1.title, scene1.paragraphs);
  app.append(s1.section);
  mountScene1(s1.stage);

  // scene 2
  const s2 = section("scene-2", scene2.kicker, scene2.title, scene2.paragraphs);
  app.append(s2.section);
  mountScene2(s2.stage);

  // scene 3
  const s3 = section("scene-3", scene3.kicker, scene3.title, scene3.paragraphs);
  app.append(s3.section);
  mountScene3(s3.stage);

  // scene 4
  const s4 = section("scene-4", scene4.kicker, scene4.title, scene4.paragraphs);
  app.append(s4.section);
  mountScene4(s4.stage);

  // scene 5
  const s5 = section("scene-5", scene5.kicker, scene5.title, scene5.paragraphs);
  app.append(s5.section);
  mountScene5(s5.stage);

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
  const ids = ["chapter-0", "chapter-1", "scene-2", "scene-3", "scene-4", "scene-5"];
  const links = ids.map((id, i) => el("a", { href: `#${id}`, title: `Chapter ${i}`, "aria-label": `Chapter ${i}` }));
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

/** A scroll-story chapter: a heading, then the story (sticky picture + steps) mounts into `body`. */
function chapter(id: string, kicker: string, title: string) {
  const body = el("div", { class: "chapter-body" });
  const sectionEl = el(
    "section",
    { id, class: "chapter" },
    el("header", { class: "chapter-head" }, el("div", { class: "kicker", text: kicker }), el("h2", { text: title })),
    body,
  );
  return { section: sectionEl, body };
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
