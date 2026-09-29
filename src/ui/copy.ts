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
    canvas: "Interactive 2-D lattice",
  },
  readout: {
    found: "The nearest dot lights up. Drag an arrow: the grid changes, and so can the answer.",
    // only shown when “Show coordinates” is on (the scene has no numbers otherwise)
    coords: "Nearest dot = {c1}·b₁ {sign} {c2}·b₂  ·  {dist} away",
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
    basis1: "b₁",
    basis2: "b₂",
    canvas: "The same lattice with a good and a bad basis",
    group: "Basis",
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
    canvas: "Sending a secret bit through the lattice with a wobble",
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
    "The chart below the grid runs the same attack in more dimensions, up to 40 (or 60, if you pick it), on grids hidden the way Kyber hides them. LLL always finishes, in a blink. But the higher you climb, the less good its arrows are. Its answer lands on the wrong dot more and more often, and by 40 dimensions the secret stays hidden. Real Kyber uses 512 dimensions or more.",
    "What about quantum computers? They break today's locks with a trick (Shor's algorithm) that finds hidden repeating patterns in numbers. A grid in hundreds of dimensions has no such pattern to find. The best known quantum attacks on grids are only a little faster than normal ones, and both would take far longer than the age of the universe. That is why the internet is switching to grids.",
  ],
  hint: "Press “3D” or “4D” · Click to throw a ball · Press “Run the attack”",
  labels: {
    dims: ["2D", "3D", "4D"],
    run: "Run the attack",
    reset: "Reset arrows",
    loading: "Loading 3D…",
    canvas: "A lattice in 2, 3 or 4 dimensions",
    dimsGroup: "Dimensions",
    failed: "The 3D view could not load (it needs Three.js from the internet). The chart below still works.",
  },
  readout: {
    reduce: "Step {s} of {n}: shorten arrow {i} using arrow {j}",
    swap: "Step {s} of {n}: swap arrows {a} and {b}",
    done: "Done in {n} steps. The arrows are short and square: in {d}D the attacker wins.",
    reset: "Back to the bad basis.",
    ball: "The ball's nearest dot is {dist} away.",
  },
  quantum: {
    title: "Two quantum tricks, two different stories",
    shor: {
      name: "Shor’s algorithm",
      body: "Finds a hidden repeating pattern in numbers. Today’s locks (RSA and elliptic curves) are built on exactly such a pattern, so a big enough quantum computer opens them completely.",
      verdict: "Today’s locks: broken",
    },
    grover: {
      name: "Grover’s algorithm",
      body: "Speeds up blind guessing, but only by a square root: a million guesses become a thousand. A grid has no pattern for Shor to find, and Grover-style searching trims the grid attack only a little.",
      verdict: "Grids: still safe (just make them a bit bigger)",
    },
  },
  chart: {
    title: "Did the attack recover the secret?",
    ratio: "Attacker's shortest arrow ÷ the hidden one",
    found: "1× = found it",
    dimension: "D",
    gaveUp: "gave up (over 2 s)",
    kyber: "Kyber: 512+ →",
    idle: "Press “Run the attack”, or pick a setting below, to fill in the chart.",
    grids: "Grids per dimension",
    climb: "Climb to",
    running: "Attacking {trials} random grids in {d} dimensions…",
    done: "{trials} random grids per dimension. Each attack took under {ms} ms.",
    noWorker: "Running on the main thread (this browser has no module workers).",
  },
};

export const scene5 = {
  kicker: "Scene 5",
  title: "Kyber, for real",
  paragraphs: [
    "Everything so far was a picture. This is the real recipe, shrunk until every number fits on screen. It is called ML-KEM (you may know it as Kyber), and since 2024–2025 it is what your browser uses to lock the connection to many websites.",
    "Two changes from the pictures. The numbers wrap around at 97, like a clock with 97 hours. And instead of one bit at a time, Kyber sends eight at once, packed in lists of eight numbers. The trick is the one you already know.",
    "Step 1, make keys. The owner picks a secret s of tiny numbers (−1, 0 or 1), mixes it with a big public jumble A, and adds a wobble e. The result t is published with A. Getting s back from A and t means solving the nearest-dot puzzle in a grid of many dimensions.",
    "Step 2, lock. The sender picks eight random bits: they become the shared key. Each 1 is pushed half way round the clock (49 of the 97 hours), and everything gets a fresh wobble. That is the ciphertext.",
    "Step 3, unlock. The owner uses s to strip away the jumble. What is left is each bit plus a small wobble: near 0 o’clock means 0, near the far side of the clock means 1. Now both sides hold the same key, and the message locked with it opens. Type your own message in the box, and press “show it on the lattice” in any step to see it as dots and arrows.",
    "Real ML-KEM uses lists of 256 numbers that wrap around at 3,329, in 512 to 1,024 dimensions. Same trick, bigger grid.",
  ],
  labels: {
    message: "Your message",
    placeholder: "Type a short message",
    keygen: "1 · Make keys",
    encaps: "2 · Lock",
    decaps: "3 · Unlock",
    keygenBtn: "Make new keys",
    encapsBtn: "Lock a new key",
    decapsBtn: "Unlock",
    show: "show it on the lattice",
    A: "A (public jumble)",
    s: "s (secret)",
    e: "e (wobble)",
    t: "t = A·s + e (public)",
    m: "8 random bits",
    u: "u (ciphertext)",
    v: "v (ciphertext)",
    key: "shared key",
    sealed: "locked message",
    diff: "v − s·u (on the 97-hour clock)",
    bits: "bits read",
    opened: "unlocked message",
    waitEncaps: "Press “Lock a new key”.",
    waitDecaps: "Press “Unlock”.",
    match: "same key as the sender ✓",
    noMatch: "different key ✗",
    zero: "0",
    one: "1",
  },
  scale: {
    title: "For scale",
    intro: "The toy on this page next to ML-KEM-768, the size your browser uses.",
    toy: "Toy",
    real: "ML-KEM-768",
    bytes: "bytes",
    rows: { publicKey: "Public key", ciphertext: "Ciphertext", sharedKey: "Shared key" },
    note: "Real ML-KEM sends a short seed instead of the whole jumble A, and squeezes the ciphertext. The shared key is the same size: 32 bytes.",
  },
  lattice: {
    canvas: "The current step drawn on the lattice",
    lockedDot: "A·s",
    lockedBall: "t = A·s + e",
    keygen: "Keys: the green arrows are the secret key, the red ones are the public key. Same grid.",
    encaps: "Lock: each bit is a ball. 0 sits on a dot, 1 is pushed half a step, then everything wobbles.",
    decaps: "Unlock: the owner rounds each ball with the green arrows and reads the leftover.",
  },
};
