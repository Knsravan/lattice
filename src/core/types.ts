/** A vector of real numbers. Length = dimension. */
export type Vec = number[];

/** A lattice basis: an array of `n` vectors, each of length `n` (rows are basis vectors). */
export type Basis = Vec[];

/** Deterministic pseudo-random source in [0, 1). */
export type Rng = () => number;
