const PARTICLE_COUNT = 3200;
const SHOWROOM_START = 1.32;
const ENDING_WORD_REVEAL = .57;
const ENDING_FADE_OUT = -.04;
const MAX_PROGRESS_PER_SECOND = .58;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

function ease(value: number, start: number, end: number) {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}

type Point = { x: number; y: number };
type Fragment = { side: number; center: Point; drift: Point; tilt: number; delay: number };

// Six pieces per half, starting in their original positions in the globe.
const FRAGMENTS: Fragment[] = [-1, 1].flatMap(side =>
  [-1, 0, 1].flatMap(row => [0, 1].map(column => ({
    side,
    center: { x: side * (.125 + column * .25), y: row / 3 },
    drift: { x: side * (.018 + column * .088), y: row * (.14 + column * .035) },
    tilt: side * (row * .22 + (column ? .14 : -.14)),
    delay: (column + Math.abs(row)) * .019,
  }))),
);

function fragmentIndex({ x, y }: Point) {
  const row = Math.min(2, Math.floor((y + .5) * 3));
  const column = Number(Math.abs(x) >= .25);
  return (x < 0 ? 0 : 6) + row * 2 + column;
}

type Particle = {
  origin: Point;
  target: Point;
  fragment: number;
  scatter: Point;
  turn: number;
  delay: number;
  radius: number;
  color: string;
};

function makeParticles(image: HTMLImageElement, count: number): Particle[] {
  const sample = document.createElement("canvas");
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  sample.width = 320;
  sample.height = 185;
  context.drawImage(image, 0, 0, sample.width, sample.height);
  const logoPixels = context.getImageData(0, 0, sample.width, sample.height).data;
  const logoPoints: Point[] = [];
  for (let y = 0; y < sample.height; y++) {
    for (let x = 0; x < sample.width; x++) {
      const offset = (y * sample.width + x) * 4;
      if (logoPixels[offset + 3] > 128 && logoPixels[offset + 1] > 110) {
        logoPoints.push({ x: (x + .5) / sample.width - .5, y: (y + .5) / sample.height - .5 });
      }
    }
  }

  sample.width = 800;
  sample.height = 170;
  context.font = "900 142px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "white";
  context.fillText("KULTURA", 400, 85);
  const wordPixels = context.getImageData(0, 0, sample.width, sample.height).data;
  const wordPoints: Point[] = [];
  const wordWidth = context.measureText("KULTURA").width;
  for (let y = 0; y < sample.height; y += 2) {
    for (let x = 0; x < sample.width; x += 2) {
      if (wordPixels[(y * sample.width + x) * 4 + 3] > 160) {
        wordPoints.push({ x: (x - 400) / wordWidth, y: (y - 85) / wordWidth });
      }
    }
  }
  if (!logoPoints.length || !wordPoints.length) return [];

  // Keep the same point pairing every time a scroll position is revisited.
  let seed = 0x57eab193;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const origins = Array.from({ length: count }, (_, index) =>
    logoPoints[Math.floor(index * logoPoints.length / count)],
  ).sort((a, b) => a.x - b.x);
  const targets = Array.from({ length: count }, (_, index) =>
    wordPoints[Math.floor(index * wordPoints.length / count)],
  ).sort((a, b) => a.x - b.x);
  const colors = ["#83a0ba", "#b2c6d8", "#dce9f2", "#f4faff"];

  return origins.map((origin, index) => {
    const side = origin.x < 0 ? -1 : 1;
    const fragment = fragmentIndex(origin);
    const flare = random();
    const scatter = { x: side * (.10 + random() * .15) + origin.x * .25, y: (random() - .5) * .62 };
    // Adjacent fragments peel away in opposite directions, with a range of arc lengths.
    const direction = fragment % 2 === 0 ? 1 : -1;
    return {
      origin,
      fragment,
      target: targets[index],
      scatter,
      turn: direction * Math.PI * (1.03 + random() * .42),
      delay: random() * .14,
      radius: .55 + random() ** 2 * 1.36,
      color: flare > .992 ? "#c9ff4b" : colors[Math.floor(flare * colors.length)],
    };
  });
}

export function startAtmosphere({ story, layer, surface, logo, logoImage }: {
  story: HTMLDivElement;
  layer: HTMLDivElement;
  surface: HTMLCanvasElement;
  logo: HTMLDivElement;
  logoImage: HTMLImageElement;
}) {
  const showroom = story.querySelector<HTMLElement>("[data-kultura-showroom-region]");
  const manifesto = story.querySelector<HTMLElement>("[data-kultura-both]");
  const ending = story.querySelector<HTMLElement>("[data-kultura-ending]");
  if (!ending) return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const dataSaver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  const context = surface.getContext("2d");
  let particles: Particle[] | null = null;
  let visible = false;
  let frame = 0;
  let painted = false;
  let playhead: number | null = null;
  let previousTime: number | null = null;

  const paint = (time: number) => {
    frame = 0;
    if (!visible || document.hidden) return;

    const height = Math.max(layer.clientHeight, 1);
    const width = Math.max(layer.clientWidth, 1);
    const compact = width < 768;
    const showroomTop = (showroom?.getBoundingClientRect().top
      ?? manifesto?.getBoundingClientRect().bottom
      ?? ending.getBoundingClientRect().top) / height;
    const endingTop = ending.getBoundingClientRect().top / height;
    const storyRect = story.getBoundingClientRect();
    const backgroundTravel = clamp((height - storyRect.top) / (Math.max(storyRect.height, height) + height));
    // Stretch the same reversible stages across the showroom, even as its height changes.
    const distanceFromStart = SHOWROOM_START - showroomTop;
    const runway = Math.max(0, endingTop - showroomTop) + SHOWROOM_START - ENDING_WORD_REVEAL;
    const releaseProgress = 1 + (ENDING_WORD_REVEAL - ENDING_FADE_OUT) / runway;
    const target = Math.min(releaseProgress, Math.max(0, distanceFromStart / runway));
    const reduced = motion.matches || dataSaver;
    if (playhead === null || reduced) playhead = target;

    // Follow scroll in both directions with a speed cap for large wheel or touch jumps.
    const elapsed = Math.min(Math.max((time - (previousTime ?? time)) / 1000, 0), .05);
    const difference = target - playhead;
    if (Math.abs(difference) < .0005) {
      playhead = target;
    } else {
      const step = Math.min(Math.abs(difference) * -Math.expm1(-8 * elapsed), MAX_PROGRESS_PER_SECOND * elapsed);
      playhead += Math.sign(difference) * step;
    }
    const settled = playhead === target;
    previousTime = settled ? null : time;
    if (!settled) frame = window.requestAnimationFrame(paint);

    const progress = clamp(playhead);
    const split = reduced ? 0 : ease(progress, .03, .27);
    const showWord = progress >= .86;
    const dissolve = reduced ? Number(showWord) : ease(progress, .24, .40);
    const opacity = playhead < releaseProgress
      ? ease(ENDING_WORD_REVEAL + (1 - playhead) * runway, ENDING_FADE_OUT, .43)
      : 0;
    const logoWidth = logo.offsetWidth;
    const logoHeight = logo.offsetHeight;
    const centerX = logo.offsetLeft;
    const centerY = logo.offsetTop + logoHeight / 2;
    const splitDistance = Math.min(logoWidth * .15, width * .105) * split;
    const splitRise = splitDistance * .15;
    const hasParticles = !reduced && Boolean(particles?.length);

    layer.style.setProperty("--mark-opacity", String((1 - dissolve) * opacity * mix(.52, .82, split)));
    const wordOpacity = reduced ? Number(showWord) : ease(progress, .75, .97);
    layer.style.setProperty("--word-opacity", hasParticles ? "0" : String(wordOpacity * opacity));
    layer.style.setProperty("--split-x", `${splitDistance}px`);
    layer.style.setProperty("--split-y", `${splitRise}px`);
    layer.style.setProperty("--story-glow", String(mix(.65, 1, opacity)));
    layer.style.setProperty("--morph-settled", settled ? "1" : "0");
    layer.style.setProperty("--plane-y", `${reduced ? 0 : mix(-1.5, 6.5, backgroundTravel)}svh`);
    layer.style.setProperty("--dust-y", `${reduced ? 0 : mix(16, -16, backgroundTravel)}px`);

    if (!context) return;
    if (!hasParticles || !particles || dissolve === 0 || opacity === 0) {
      if (painted) context.clearRect(0, 0, surface.width, surface.height);
      painted = false;
      return;
    }

    const ratio = Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.5);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (surface.width !== pixelWidth) surface.width = pixelWidth;
    if (surface.height !== pixelHeight) surface.height = pixelHeight;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const wordWidth = Math.min(width * .79, 680);
    const fieldWidth = Math.min(width, 900);
    const fieldHeight = Math.min(height, 530);
    const pointScale = Math.max(.65, Math.min(1.25, wordWidth / 510));
    const spread = ease(progress, .46, .64);
    const swirl = ease(progress, .47, .79);
    const letterOpacity = ease(progress, .60, .99);
    context.globalAlpha = dissolve * opacity * mix(.67, .93, letterOpacity);

    const fragments = FRAGMENTS.map(({ side, center, drift, tilt, delay }) => {
      const breakaway = ease(progress, .25 + delay, .48 + delay);
      const rotation = tilt * breakaway;
      return {
        centerX: center.x * logoWidth,
        centerY: center.y * logoHeight,
        x: side * splitDistance + drift.x * logoWidth * breakaway,
        y: side * splitRise + drift.y * logoHeight * breakaway,
        cos: Math.cos(rotation),
        sin: Math.sin(rotation),
      };
    });

    for (const particle of particles) {
      const piece = fragments[particle.fragment];
      const localX = particle.origin.x * logoWidth - piece.centerX;
      const localY = particle.origin.y * logoHeight - piece.centerY;
      const fragmentX = piece.x + piece.centerX + localX * piece.cos - localY * piece.sin;
      const fragmentY = piece.y + piece.centerY + localX * piece.sin + localY * piece.cos;
      const turn = swirl * particle.turn;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const swirlX = (particle.scatter.x * cos - particle.scatter.y * sin) * fieldWidth;
      const swirlY = (particle.scatter.x * sin + particle.scatter.y * cos) * fieldHeight;
      const gather = ease(progress, .69 + particle.delay * .78, .98);
      const x = mix(
        mix(fragmentX, swirlX, spread),
        particle.target.x * wordWidth,
        gather,
      );
      const y = mix(
        mix(fragmentY, swirlY, spread),
        particle.target.y * wordWidth,
        gather,
      );
      const radius = particle.radius * pointScale * mix(1 + spread * .25, 1.12, gather);
      context.fillStyle = particle.color;
      context.fillRect(centerX + x - radius / 2, centerY + y - radius / 2, radius, radius);
    }
    painted = true;
  };

  const request = () => {
    if (visible && !frame && !document.hidden) frame = window.requestAnimationFrame(paint);
  };
  const prepare = () => {
    if (visible && context && !motion.matches && !dataSaver && particles === null && logoImage.complete && logoImage.naturalWidth) {
      particles = makeParticles(logoImage, layer.clientWidth < 768 ? 1600 : PARTICLE_COUNT);
    }
    request();
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    layer.style.setProperty("--ambient-state", visible && !dataSaver ? "running" : "paused");
    if (visible) prepare();
    else {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      playhead = null;
      previousTime = null;
    }
  }, { rootMargin: "160px 0px" });
  observer.observe(story);
  const resize = new ResizeObserver(request);
  resize.observe(layer);
  resize.observe(story);
  if (showroom) resize.observe(showroom);

  logoImage.addEventListener("load", prepare);
  motion.addEventListener("change", prepare);
  window.addEventListener("resize", request, { passive: true });
  window.addEventListener("scroll", request, { passive: true });
  document.addEventListener("visibilitychange", request);

  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    observer.disconnect();
    resize.disconnect();
    logoImage.removeEventListener("load", prepare);
    motion.removeEventListener("change", prepare);
    window.removeEventListener("resize", request);
    window.removeEventListener("scroll", request);
    document.removeEventListener("visibilitychange", request);
  };
}
