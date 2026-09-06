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
    "Here is the trick that turns the dot game into a lock. The same grid can be described by two different pairs of arrows. One pair makes “find the nearest dot” easy. The other makes it nearly impossible. The easy pair is the private key. The hard pair is the public key.",
    "See it for yourself. Flip the switch. The green arrows (short, square) turn into the red arrows (long, skewed), but watch the dots: they don't move. Both pairs build the exact same grid.",
    "Now throw balls. The finder follows one rule: take whole steps along the arrows and stop as close to the ball as you can. With the green arrows it lands on the right dot every time. With the red arrows the steps are huge and lopsided, so it lands on the wrong dot most of the time. Press “Throw 20 balls” and compare the tally.",
    "So: hand the red pair to the whole world. It is useless to them. Keep the green pair to yourself, and you are the only one who can find your way around the grid. Every scene after this one is just making that trick bigger.",
  ],
  hint: "Flip the switch · Click anywhere to throw a ball",
  labels: {
    good: "Good basis · private key",
    bad: "Bad basis · public key",
    tallyGood: "Private key",
    tallyBad: "Public key",
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
