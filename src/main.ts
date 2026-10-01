import { site, chapter0, chapter1, chapter2, chapter3, chapter4, chapter5, scene1, scene2, scene3, scene4, scene5 } from "./ui/copy.ts";
import { el, $ } from "./ui/dom.ts";
import { mountHero } from "./ui/hero.ts";
import { mountSoundControls } from "./ui/sound.ts";
import { mountSignal } from "./ui/signal.ts";
import { mountGlass } from "./ui/glass.ts";
import { mountSmoothScroll } from "./ui/smooth.ts";
import { mountReveal } from "./ui/reveal.ts";
import { mountChapter0 } from "./scenes/chapter0-problem.ts";
import { mountChapter1 } from "./scenes/chapter1-grid.ts";
import { mountChapter2 } from "./scenes/chapter2-basis.ts";
import { mountChapter3 } from "./scenes/chapter3-wobble.ts";
import { mountChapter4 } from "./scenes/chapter4-dimensions.ts";
import { mountChapter5 } from "./scenes/chapter5-kyber.ts";
import { mountScene1 } from "./scenes/scene1-grid.ts";
import { mountScene2 } from "./scenes/scene2-basis.ts";
import { mountScene3 } from "./scenes/scene3-noise.ts";
import { mountScene4 } from "./scenes/scene4-dimensions.ts";
import { mountScene5 } from "./scenes/scene5-kyber.ts";

/** Builds the page from copy.ts and mounts each scene into its section. */
function build() {
  const app = $("#app");

  // hero: the title and its words on the left, the glass crystal (the 3D stage) on the right; the flat shearing lattice is the fallback
  const hero = el(
    "header",
    { class: "hero" },
    el("div", { class: "hero-main" },
      el("h1", { text: site.title }),
      el("div", { class: "hero-text" },
        el("p", { class: "tagline", text: site.tagline }),
        ...site.intro.map((t) => el("p", { class: "intro", text: t })),
        el("a", { class: "scroll-hint", href: "#chapter-0", text: site.scrollHint + " ↓" }))),
    el("div", { class: "slot", "data-slot": "key", "aria-hidden": "true" }),
  );
  app.append(hero);

  // chapter 0: the problem (scroll story)
  const c0 = chapter("chapter-0", chapter0.kicker, chapter0.title, "fibre");
  app.append(c0.section);
  mountChapter0(c0.body);

  // chapter 1: the grid (scroll story), then "try it yourself"
  const c1 = chapter("chapter-1", chapter1.kicker, chapter1.title, "lattice");
  app.append(c1.section);
  mountChapter1(c1.body);

  const s1 = section("scene-1", scene1.kicker, scene1.title, scene1.paragraphs);
  app.append(s1.section);
  mountScene1(s1.stage);

  // chapter 2: the story, then "try it yourself"
  const c2 = chapter("chapter-2", chapter2.kicker, chapter2.title, "shear");
  app.append(c2.section);
  mountChapter2(c2.body);

  const s2 = section("scene-2", scene2.kicker, scene2.title, scene2.paragraphs);
  app.append(s2.section);
  mountScene2(s2.stage);

  // chapter 3: the story, then "try it yourself"
  const c3 = chapter("chapter-3", chapter3.kicker, chapter3.title, "drop");
  app.append(c3.section);
  mountChapter3(c3.body);

  const s3 = section("scene-3", scene3.kicker, scene3.title, scene3.paragraphs);
  app.append(s3.section);
  mountScene3(s3.stage);

  // chapter 4: the story, then "try it yourself"
  const c4 = chapter("chapter-4", chapter4.kicker, chapter4.title, "quantum");
  app.append(c4.section);
  mountChapter4(c4.body);

  const s4 = section("scene-4", scene4.kicker, scene4.title, scene4.paragraphs);
  app.append(s4.section);
  mountScene4(s4.stage);

  // chapter 5: the story, then "try it yourself"
  const c5 = chapter("chapter-5", chapter5.kicker, chapter5.title, "shield");
  app.append(c5.section);
  mountChapter5(c5.body);

  const s5 = section("scene-5", scene5.kicker, scene5.title, scene5.paragraphs);
  app.append(s5.section);
  mountScene5(s5.stage);

  // footer
  const footer = el(
    "footer",
    {},
    el("span", { text: "Lattice · built in September 2026 · " }),
    el("a", { href: "https://github.com/Knsravan/lattice", text: "source on GitHub" }),
  );
  // the end: the 3D stage's last piece (the title wave, back again) sits beside the footer
  app.append(el("div", { class: "finale" }, el("div", { class: "slot", "data-slot": "end", "aria-hidden": "true" }), footer));

  // the page's own scroll feel: glide scrolling, elements that appear as they come into view, liquid glass, the 3D stage
  mountSmoothScroll();
  mountReveal(app);
  mountGlass();
  mountSignal([...app.querySelectorAll<HTMLElement>("[data-slot]")]).catch(() => mountHero(hero)); // no WebGL or no CDN: the flat shearing lattice instead

  // voice + sound-effects switches, pinned in the corner
  const controls = mountSoundControls();
  document.body.append(controls);

  // nav dots
  const nav = el("nav", { class: "dots", "aria-label": "Scenes" });
  const ids = ["chapter-0", "chapter-1", "chapter-2", "chapter-3", "chapter-4", "chapter-5"];
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

/** A scroll-story chapter: its heading beside its piece of the 3D stage (`piece`), then the story (sticky picture + steps) mounts into `body`. */
function chapter(id: string, kicker: string, title: string, piece: string) {
  const body = el("div", { class: "chapter-body" });
  const sectionEl = el(
    "section",
    { id, class: Number(id.slice(-1)) % 2 ? "chapter flip" : "chapter" }, // the piece swaps sides from chapter to chapter
    el("div", { class: "chapter-open" },
      el("header", { class: "chapter-head" }, el("div", { class: "kicker", text: kicker }), el("h2", { text: title })),
      el("div", { class: "slot", "data-slot": piece, "aria-hidden": "true" })),
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
