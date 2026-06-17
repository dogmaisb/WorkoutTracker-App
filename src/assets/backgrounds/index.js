// ── Background Image Registry ─────────────────────────────────────────────────
//
// To add a background image for a page:
//   1. Drop your image file into the matching subfolder:
//        src/assets/backgrounds/progress/my-photo.jpg
//   2. Uncomment (or add) the import line for that page below.
//   3. Set the page key to the imported variable.
//
// Leave a key as `null` to use the default color theme for that page.
//
// Example:
//   import progressBg from './progress/my-photo.jpg';
//   ...
//   progress: progressBg,

const backgrounds = {
  week:     null,
  progress: null,
  history:  null,
  diet:     null,
  timers:   null,
  settings: null,
};

export default backgrounds;
