/**
 * All narration text lives here so it can be edited without touching scene code.
 * Keep sentences short. One idea per paragraph. No formula before the picture that explains it.
 */

export const site = {
  title: "Lattice",
  tagline: "The math that is replacing the internet's locks.",
  intro: [
    "Every time you buy something online, your phone scrambles your card number with a lock that only the shop can open.",
    "The locks the internet uses today will pop open the moment quantum computers get big enough. So the world is switching to a new kind of lock, built on a puzzle almost nobody outside a few labs understands.",
    "The puzzle is this: find the nearest dot in a grid. Sounds easy. Keep scrolling.",
  ],
  scrollHint: "Scroll to begin",
};

export const scene1 = {
  kicker: "Scene 1",
  title: "The grid",
  paragraphs: [
    "This is a lattice: a grid of dots that goes on forever. Two arrows make the whole thing. Every dot is some whole number of the first arrow plus some whole number of the second.",
    "Drag the tips of the arrows. The grid follows. Different arrows, different grid.",
    "Now click anywhere between the dots. That's the ball. The lattice lights up the dot closest to it. Finding that dot is called the closest vector problem, and it is the puzzle the whole new lock is built on.",
  ],
  hint: "Drag the arrow tips · Click anywhere to throw a ball",
  labels: {
    basis1: "b₁",
    basis2: "b₂",
    nearest: "nearest dot",
    coords: "Show coordinates",
    reset: "Reset arrows",
    degenerate: "The arrows point the same way, so they only make a line. Pull one of them off the line.",
  },
};

export const scene2 = {
  kicker: "Scene 2",
  title: "Good basis, bad basis",
  paragraphs: [
    "Here is the same grid. Not a copy: the exact same dots. But there is a second pair of arrows that builds it too. Flip the switch. The arrows change; the dots don't move.",
    "The green pair is short and square. The red pair is long and skewed. Both make every dot, so both are “correct”. Now try finding the nearest dot with each.",
    "Click to throw. The rule is simple: walk along the arrows in whole steps and stop as close as you can. With the green arrows that lands on the right dot every time. With the red arrows the steps are huge and lopsided, and you land on the wrong dot again and again.",
    "That is the whole secret. The lock's public key is the ugly red pair, handed to everyone. The private key is the tidy green pair, kept by the owner. Same grid. Only one of them lets you find your way around it.",
  ],
  hint: "Flip the switch · Click anywhere to throw a ball",
  labels: {
    good: "Good basis",
    bad: "Bad basis",
    throwMany: "Throw 20 balls",
    clear: "Clear",
    wrong: "wrong",
    rightDot: "found it",
    wrongDot: "missed",
    realDot: "the real nearest dot",
  },
  readout: {
    right: "Found the nearest dot, {dist} away.",
    wrong: "Missed. This basis stopped {guess} away, but the nearest dot was {truth} away.",
  },
};

export const comingSoon = [
  { kicker: "Scene 3", title: "Add the wobble", blurb: "A little noise turns “find the nearest dot” into Learning With Errors, the heart of Kyber." },
  { kicker: "Scene 4", title: "Climb the dimensions", blurb: "2D, 3D, 4D. Run the attack live, and watch it stop working as the dimension rises." },
  { kicker: "Scene 5", title: "Kyber, for real", blurb: "A toy ML-KEM running in your browser, every value on screen, encrypting a message you type." },
];
