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
    "Here is the trick that turns the dot game into a lock. A pair of arrows that builds a grid is called a basis. The same grid can be built by many different bases. One basis makes “find the nearest dot” easy. Another makes it nearly impossible.",
    "Look at the grid on the right. The green arrows are a good basis: short and square. Press “Bad basis” below the grid. The arrows are replaced by a red pair: long and skewed. The dots stay exactly where they are, because both pairs build the same grid.",
    "Now click anywhere on the grid to throw a ball. The finder walks along the current arrows in whole steps and stops as close to the ball as it can. With the green arrows it finds the nearest dot every time. Press “Bad basis” and throw again: with the red arrows it usually stops at the wrong dot. Press “Throw 20 balls” to compare the two counts.",
    "That is the whole secret. The lock's public key is the ugly red pair, handed to everyone. The private key is the tidy green pair, kept by the owner. Same grid. Only one of them lets you find your way around it.",
  ],
  hint: "Press “Bad basis” below · Click anywhere to throw a ball",
  labels: {
    good: "Good basis",
    bad: "Bad basis",
    tallyGood: "Good basis",
    tallyBad: "Bad basis",
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
    throwing: "Throwing… {wrong} of {total} wrong so far",
  },
};

export const scene3 = {
  kicker: "Scene 3",
  title: "Add the wobble",
  paragraphs: [
    "Now we send a secret message through the grid: one bit, a 0 or a 1. The surprise is what keeps it secret. It is not the key alone. It is a small random shake we give the ball, called the wobble. Without the wobble, the public key is enough to read the message. With it, only the private key can.",
    "Sending. Pick any dot (the public key can do that). For a 0, put the ball on the dot. For a 1, push it half a step to the side. Then shake it a little. Where the ball lands is the encrypted message. Press “Send 0” or “Send 1” to watch.",
    "Reading. Round the ball to the nearest dot using your own arrows, then look at the leftover: near nothing means 0, near half a step means 1. Two readers try every ball. The owner (green, private key) rounds with the short arrows and gets it right. The eavesdropper (red, public key) rounds with the long arrows, lands on the wrong dot, and gets a coin flip. Press “Send 20 bits” and compare the scores.",
    "Now drag the “Wobble” slider. At zero the eavesdropper reads every bit: a ball with no wobble sits exactly on a dot or exactly halfway, and anyone can see which. Raise it and the eavesdropper drops to guessing while the owner keeps reading. Raise it past the green dashed circle and even the owner is lost. Real systems live in between. This is Learning With Errors, the heart of Kyber.",
  ],
  hint: "Press “Send 0” or “Send 1” · Drag “Wobble” to change the shake",
  labels: {
    send0: "Send 0",
    send1: "Send 1",
    sendMany: "Send 20 bits",
    wobble: "Wobble",
    clear: "Clear",
    owner: "Owner",
    eaves: "Eavesdropper",
    reads: "reads",
    right: "right",
  },
  readout: {
    result: "Sent {bit}  ·  Owner read {o}  ·  Eavesdropper read {e}",
    sending: "Sending…  Owner {o} right  ·  Eavesdropper {e} right",
    zero: "Wobble is zero: the ball sits exactly on a dot or exactly halfway, so anyone can read it.",
    tooMuch: "Too much wobble: the ball can leave the green circle, and then even the owner misreads.",
  },
};

export const scene4 = {
  kicker: "Scene 4",
  title: "Climb the dimensions",
  paragraphs: [
    "So far the grid was flat. Real locks hide their grid in hundreds of dimensions. We can't draw that, but we can climb a few steps and watch what happens to the attacker.",
    "Press “3D” and drag to spin the grid. Click to throw a ball: the nearest dot still lights up. Press “4D”: this is a four-dimensional grid, squashed into three so we can see it. Dots that fade are far away in the fourth direction.",
    "The red arrows are a bad basis, like a public key. Press “Run the attack”. The attacker runs a famous method called LLL: shorten one arrow using another, swap two when they are in the wrong order, repeat. In a few steps the arrows turn short and square. The attacker has rebuilt a good basis, so in 2, 3 or 4 dimensions the lock is broken.",
    "The chart below the grid runs the same attack in more dimensions, up to 40, on grids hidden the way Kyber hides them. LLL always finishes, in a blink. But the higher you climb, the less good its arrows are. Its answer lands on the wrong dot more and more often, and by 40 dimensions the secret stays hidden. Real Kyber uses 512 dimensions or more.",
    "What about quantum computers? They break today's locks with a trick (Shor's algorithm) that finds hidden repeating patterns in numbers. A grid in hundreds of dimensions has no such pattern to find. The best known quantum attacks on grids are only a little faster than normal ones, and both would take far longer than the age of the universe. That is why the internet is switching to grids.",
  ],
  hint: "Press “3D” or “4D” · Click to throw a ball · Press “Run the attack”",
  labels: {
    dims: ["2D", "3D", "4D"],
    run: "Run the attack",
    reset: "Reset arrows",
    loading: "Loading 3D…",
    failed: "The 3D view could not load (it needs Three.js from the internet). The chart below still works.",
  },
  readout: {
    reduce: "Step {s} of {n}: shorten arrow {i} using arrow {j}",
    swap: "Step {s} of {n}: swap arrows {a} and {b}",
    done: "Done in {n} steps. The arrows are short and square: in {d}D the attacker wins.",
    reset: "Back to the bad basis.",
    ball: "The ball's nearest dot is {dist} away.",
  },
  chart: {
    title: "Did the attack recover the secret?",
    ratio: "Attacker's shortest arrow ÷ the hidden one",
    found: "1× = found it",
    dimension: "D",
    gaveUp: "gave up (over 2 s)",
    kyber: "Kyber: 512+ →",
    idle: "Press “Run the attack” to fill in the chart.",
    running: "Attacking {trials} random grids in {d} dimensions…",
    done: "{trials} random grids per dimension. Each attack took under {ms} ms.",
    noWorker: "Running on the main thread (this browser has no module workers).",
  },
};

export const comingSoon = [
  { kicker: "Scene 5", title: "Kyber, for real", blurb: "A toy ML-KEM running in your browser, every value on screen, encrypting a message you type." },
];
