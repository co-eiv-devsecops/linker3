/**
 * Strategy for generating short codes used to identify links.
 *
 * Decouples {@link LinkService} from the concrete generation algorithm
 * (e.g. random hex bytes), allowing it to be swapped or mocked in tests.
 */
export interface CodeGenerator {
  /**
   * Produces a new short code.
   *
   * @returns A freshly generated code. Uniqueness is not guaranteed by
   * the generator itself; callers must check for collisions.
   */
  generate(): string;
}
