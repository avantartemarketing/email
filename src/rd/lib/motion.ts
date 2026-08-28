/**
 * The motion budget's JavaScript side (ruling 27 §0).
 *
 * Almost all of the budget lives in `css/tokens.css` as `--rd-dur-*`
 * and `--rd-ease`, and almost all of the redesign's motion is a `transition`
 * reading it straight from there — which is what makes §7's reduced-motion
 * block able to switch the whole system off in four declarations.
 *
 * What cannot live there is a number that is a function of something: 88d's
 * stagger is the item's index times a constant, and an index is not a thing
 * CSS knows. So the constant lives here and `Menu` writes the product into a
 * custom property the stylesheet's own animation reads — the delay comes from
 * JS, the animation stays in CSS, and trap 1 is not tripped.
 *
 * Deliberately not here: 83c's counting figures. That clause is not
 * implemented, and a helper written for a
 * caller that does not exist is a helper nobody has ever run.
 */

/**
 * 88d: menu items fade up one after another, 14ms apart.
 *
 * Small enough that the panel still reads as one gesture rather than as a list
 * being dealt out — the ruling's own word for what a longer stagger costs. It
 * also does a second job it names: the destructive item is last, so it lands
 * after the eye has started reading rather than before.
 */
export const STAGGER_MS = 14

/**
 * …but only for the first few. After that every item shares one delay.
 *
 * 14ms apart is a gesture in a menu of six. In a menu of two hundred — which
 * is what a mailing account's audience list can be — it is three and a half seconds of
 * a list dealing itself out, and the owner reported exactly that as the
 * picker "not working": you open it, and most of what you are looking for is
 * still on its way. The ruling's own argument caps itself: a stagger is meant
 * to read as ONE gesture, and one that outlasts the reader's patience is no
 * longer a gesture.
 *
 * Eight steps, so nothing waits longer than 112ms — under the tenth of a
 * second at which a delay stops being felt as one.
 */
export const STAGGER_STEPS = 8
