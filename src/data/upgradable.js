/**
 * Which shapes are worth paying an image-to-3D service to model.
 *
 * The test is not "would a generated model be better" — it is "is the
 * procedural one actually losing anything". Those are different questions, and
 * the second one has a much shorter answer.
 *
 * A bookcase is a grid of boards. A dresser is a box with drawer fronts. The
 * builder in buildRoom.js gets those right, and it gets them right instantly,
 * for free, at any size, in any colour the palette asks for. A generated mesh
 * would be a slower, more expensive, less tintable version of a shape we have
 * already nailed. Sending a dresser off to be modelled is pure loss.
 *
 * A sofa is where it flips. The difference between a track arm and a rolled arm
 * and a chesterfield is the whole product, and it lives entirely in curves that
 * no amount of rounded boxes will find. Same for a reading chair, the shade on
 * a lamp, the sprawl of a plant. Those are silhouettes, and a silhouette is
 * exactly what these services are good at.
 *
 * So: soft and organic in, boxy and rectilinear out. Keeping this list short is
 * the point — it is the difference between a few pieces per room costing money
 * and all of them doing it.
 */
export const UPGRADABLE = new Set([
  // Upholstery. The single biggest gap between the procedural piece and the
  // real product, and the one people look at longest.
  'sofa',
  'armchair',
  'chair',
  'diningchair',
  'beanbag',
  'pouf',
  'stool',

  // Lighting. Shades and arms are curved and thin, and the current builders are
  // still cylinders — see the backlog note in the README.
  'floorlamp',
  'desklamp',
  'pendant',

  // Greenery. Every real plant is asymmetric and the procedural ones cannot be.
  // `tree` is deliberately absent: it already has a hand-modelled mesh.
  'palm',
  'plant',
  'smallplant',
  'hanging',
  'vase',

  // Sanitaryware, which is all compound curves and reads badly as boxes.
  'bathtub',
  'toilet',
])

/**
 * Shapes with a hand-modelled mesh already in the app. Never send these away —
 * a generated fig would be a downgrade on the SketchUp one.
 */
export const HAND_MODELLED = new Set(['tree'])

export const isUpgradable = (model) => UPGRADABLE.has(model) && !HAND_MODELLED.has(model)
