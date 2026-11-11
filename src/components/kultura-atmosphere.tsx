"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./kultura-atmosphere.module.css";

const COUNT = 920;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (n: number) => { const x = clamp(n); return x * x * (3 - 2 * x); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

type Geometry = {
  globe: Float32Array;
  burst: Float32Array;
  word: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
  seeds: Float32Array;
};

function seededRandom() {
  let seed = 0x57eab193;
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleGlobe(image: HTMLImageElement): Array<[number, number]> {
  const scratch = document.createElement("canvas");
  scratch.width = 320;
  scratch.height = 185;
  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(image, 0, 0, scratch.width, scratch.height);
  const { data } = context.getImageData(0, 0, scratch.width, scratch.height);
  const points: Array<[number, number]> = [];
  for (let y = 0; y < scratch.height; y++) {
    for (let x = 0; x < scratch.width; x++) {
      const index = (y * scratch.width + x) * 4;
      if (data[index + 3] > 128 && data[index + 1] > 110) {
        points.push([(x + .5) / scratch.width - .5, (y + .5) / scratch.height - .5]);
      }
    }
  }
  return points;
}

function makeGeometry(image: HTMLImageElement): Geometry | null {
  const logoPoints = sampleGlobe(image);
  if (!logoPoints.length) return null;

  const random = seededRandom();
  const globe = new Float32Array(COUNT * 2);
  const burst = new Float32Array(COUNT * 3);
  const word = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const colors = new Float32Array(COUNT);
  const seeds = new Float32Array(COUNT);

  // Sample an original KULTURA wordmark, then give each sampled pixel depth.
  const scratch = document.createElement("canvas");
  scratch.width = 840;
  scratch.height = 185;
  const context = scratch.getContext("2d", { willReadFrequently: true });
  const glyphs: Array<[number, number]> = [];
  if (context) {
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "900 123px Arial, Helvetica, sans-serif";
    context.fillText("KULTURA", 420, 93);
    const image = context.getImageData(0, 0, 840, 185).data;
    for (let y = 12; y < 173; y += 4) {
      for (let x = 10; x < 830; x += 4) {
        if (image[(y * 840 + x) * 4 + 3] > 140) glyphs.push([x, y]);
      }
    }
  }

  if (!glyphs.length) return null;

  for (let i = 0; i < COUNT; i++) {
    const j = i * 3;
    const [x, y] = logoPoints[Math.floor(i * logoPoints.length / COUNT)];
    globe[i * 2] = x;
    globe[i * 2 + 1] = y;
    burst[j] = x * 6.1 + (random() - .5) * 3.4;
    burst[j + 1] = -y * 3.7 + (random() - .5) * 2.2;
    burst[j + 2] = (random() - .5) * 3;

    const glyph = glyphs[Math.floor(i * glyphs.length / COUNT)];
    word[j] = (glyph[0] - 420) / 150;
    word[j + 1] = (92 - glyph[1]) / 143 - 1.09;
    word[j + 2] = (random() - .5) * .06;
    sizes[i] = 3.8 + Math.pow(random(), 2) * 6;
    colors[i] = random() > .99 ? 1 : random() * .78;
    seeds[i] = random() * Math.PI * 2;
  }

  return { globe, burst, word, sizes, colors, seeds };
}

const VERTEX = [
  "attribute vec3 a_position;",
  "attribute vec2 a_style;",
  "uniform float u_aspect;",
  "uniform float u_dpr;",
  "uniform float u_spin;",
  "uniform float u_pointer_x;",
  "uniform float u_pointer_y;",
  "varying float v_depth;",
  "varying float v_color;",
  "void main() {",
  "  float c = cos(u_spin); float s = sin(u_spin);",
  "  vec3 p = a_position;",
  "  p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z);",
  "  p.x += u_pointer_x * (.09 + .045 * p.z);",
  "  p.y += u_pointer_y * (.08 + .045 * p.z);",
  "  float perspective = 2.65 / max(2.05, 4.1 - p.z);",
  "  float mobile = min(1.0, u_aspect / 1.55);",
  "  gl_Position = vec4(p.x * perspective * mobile / u_aspect, p.y * perspective, 0.0, 1.0);",
  "  gl_PointSize = clamp(a_style.x * perspective * u_dpr, 1.0, 15.0 * u_dpr);",
  "  v_depth = clamp((p.z + 2.3) / 4.6, .16, 1.0);",
  "  v_color = a_style.y;",
  "}",
].join("\n");

const FRAGMENT = [
  "precision mediump float;",
  "uniform float u_opacity;",
  "varying float v_depth;",
  "varying float v_color;",
  "void main() {",
  "  vec2 p = gl_PointCoord * 2.0 - 1.0;",
  "  float diamond = abs(p.x) * .89 + abs(p.y) * 1.12;",
  "  float shard = 1.0 - smoothstep(.44, 1.02, diamond);",
  "  float core = 1.0 - smoothstep(0.0, .32, length(p));",
  "  float halo = 1.0 - smoothstep(.18, 1.12, length(p));",
  "  float brightness = .35 + v_depth * .65;",
  "  vec3 steel = mix(vec3(.32, .43, .58), vec3(.93, .97, 1.0), brightness);",
  "  vec3 color = mix(steel, vec3(.74, 1.0, .30), step(.986, v_color));",
  "  float alpha = (shard * .72 + core * .26 + halo * .095) * u_opacity * (.42 + v_depth * .7);",
  "  gl_FragColor = vec4(color, min(1.0, alpha));",
  "}",
].join("\n");

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

type Renderer = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  vertex: WebGLShader;
  fragment: WebGLShader;
  geometry: Geometry;
  values: Float32Array;
  aspect: WebGLUniformLocation | null;
  dprUniform: WebGLUniformLocation | null;
  spin: WebGLUniformLocation | null;
  mx: WebGLUniformLocation | null;
  my: WebGLUniformLocation | null;
  opacity: WebGLUniformLocation | null;
  dpr: number;
};

function setup(canvas: HTMLCanvasElement, logo: HTMLImageElement): Renderer | null {
  const geometry = makeGeometry(logo);
  if (!geometry) return null;
  const gl = canvas.getContext("webgl", {
    alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: "low-power",
  });
  if (!gl) return null;
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  const buffer = gl.createBuffer();
  if (!buffer) return null;
  const values = new Float32Array(COUNT * 5);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, values.byteLength, gl.DYNAMIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, "a_position");
  const styleLocation = gl.getAttribLocation(program, "a_style");
  if (positionLocation < 0 || styleLocation < 0) return null;
  gl.enableVertexAttribArray(positionLocation);
  gl.enableVertexAttribArray(styleLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 20, 0);
  gl.vertexAttribPointer(styleLocation, 2, gl.FLOAT, false, 20, 12);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);
  return {
    gl, program, buffer, vertex, fragment, values, geometry,
    aspect: gl.getUniformLocation(program, "u_aspect"),
    dprUniform: gl.getUniformLocation(program, "u_dpr"),
    spin: gl.getUniformLocation(program, "u_spin"),
    mx: gl.getUniformLocation(program, "u_pointer_x"),
    my: gl.getUniformLocation(program, "u_pointer_y"),
    opacity: gl.getUniformLocation(program, "u_opacity"),
    dpr: 1,
  };
}

function resize(canvas: HTMLCanvasElement, renderer: Renderer) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    renderer.gl.viewport(0, 0, width, height);
  }
  renderer.dpr = dpr;
}

function draw(
  r: Renderer, canvas: HTMLCanvasElement, mark: HTMLDivElement,
  p: number, angle: number, time: number, pointerX: number, pointerY: number,
) {
  const spread = smooth((p - .12) / .34);
  const form = smooth((p - .48) / .29);
  const drift = spread * (1 - form);
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const aspect = width / height;
  const mobile = Math.min(1, aspect / 1.55);
  const perspective = 2.65 / 4.1;
  const centerX = mark.offsetLeft;
  const centerY = mark.offsetTop + mark.offsetHeight / 2;
  const markWidth = mark.offsetWidth;
  const markHeight = mark.offsetHeight;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const { globe, burst, word, sizes, colors, seeds } = r.geometry;

  for (let i = 0; i < COUNT; i++) {
    const j = i * 3;
    const k = i * 5;
    const x = globe[i * 2] * markWidth;
    const y = globe[i * 2 + 1] * markHeight;
    const screenX = centerX + x * cos - y * sin;
    const screenY = centerY + x * sin + y * cos;
    const logoX = (screenX / width * 2 - 1) * aspect / (perspective * mobile);
    const logoY = (1 - screenY / height * 2) / perspective;

    r.values[k] = mix(mix(logoX, burst[j], spread), word[j], form)
      + drift * .14 * Math.sin(time * .6 + seeds[i]);
    r.values[k + 1] = mix(mix(logoY, burst[j + 1], spread), word[j + 1], form)
      + drift * .12 * Math.cos(time * .5 + seeds[i]);
    r.values[k + 2] = mix(burst[j + 2] * spread, word[j + 2], form);
    r.values[k + 3] = sizes[i];
    r.values[k + 4] = colors[i];
  }

  const gl = r.gl;
  gl.useProgram(r.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, r.buffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, r.values);
  gl.uniform1f(r.aspect, aspect);
  gl.uniform1f(r.dprUniform, r.dpr);
  gl.uniform1f(r.spin, drift * (Math.sin(time * .48) * .12 + pointerX * .18));
  gl.uniform1f(r.mx, pointerX * drift);
  gl.uniform1f(r.my, pointerY * drift);
  gl.uniform1f(r.opacity, smooth((p - .10) / .13) * mix(.78, 1, form));
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.POINTS, 0, COUNT);
}

export function KulturaAtmosphere({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const story = root.current;
    const layer = field.current;
    const surface = canvas.current;
    const logo = mark.current;
    const logoImage = image.current;
    if (!story || !layer || !surface || !logo || !logoImage) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motion.matches;
    let renderer: Renderer | null = null;
    let attempted = false;
    let contextLost = false;
    let visible = false;
    let frame = 0;
    let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
    const start = performance.now();

    const paint = () => {
      frame = 0;
      if (!visible || document.hidden) return;
      const rect = story.getBoundingClientRect();
      const p = clamp((-rect.top + window.innerHeight * .10) /
        Math.max(1, rect.height - window.innerHeight * .76));
      const time = (performance.now() - start) * .001;
      const angle = reduced ? 0 : (time % 26) / 26 * Math.PI * 2;
      const hasParticles = renderer !== null && !contextLost && !reduced;
      const logoOpacity = reduced
        ? Number(p < .63) * .52
        : (1 - smooth((p - .12) / .22)) * .52;
      const fallbackOpacity = reduced ? Number(p >= .63) : smooth((p - .48) / .29);
      layer.style.setProperty("--mark-opacity", logoOpacity.toFixed(3));
      layer.style.setProperty("--word-opacity", hasParticles ? "0" : fallbackOpacity.toFixed(3));
      layer.style.setProperty("--globe-angle", angle.toFixed(5) + "rad");
      layer.style.setProperty("--ring-angle", (reduced ? 0 : p * 135).toFixed(2) + "deg");
      layer.style.setProperty("--story-glow", (1 - smooth((p - .9) / .14) * .35).toFixed(3));
      if (renderer && hasParticles) {
        pointerX = mix(pointerX, targetX, .055);
        pointerY = mix(pointerY, targetY, .055);
        resize(surface, renderer);
        draw(renderer, surface, logo, p, angle, time, pointerX, pointerY);
      }
      if (!reduced && (p < .34 || (hasParticles && p < .77))) {
        frame = window.requestAnimationFrame(paint);
      }
    };

    const request = () => {
      if (visible && !frame && !document.hidden) frame = window.requestAnimationFrame(paint);
    };
    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const mouse = (event: PointerEvent) => {
      if (!visible || reduced || event.pointerType === "touch") return;
      targetX = (event.clientX / Math.max(window.innerWidth, 1) - .5) * 2;
      targetY = (event.clientY / Math.max(window.innerHeight, 1) - .5) * 2;
    };
    const prepare = () => {
      if (visible && !reduced && !attempted && logoImage.complete && logoImage.naturalWidth) {
        attempted = true;
        renderer = setup(surface, logoImage);
      }
      request();
    };
    const lost = () => { contextLost = true; request(); };
    const preference = () => { reduced = motion.matches; stop(); prepare(); };
    const visibility = () => { stop(); request(); };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) prepare();
      else stop();
    }, { rootMargin: "160px 0px", threshold: 0 });
    observer.observe(story);
    logoImage.addEventListener("load", prepare);
    surface.addEventListener("webglcontextlost", lost);
    motion.addEventListener("change", preference);
    window.addEventListener("pointermove", mouse, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    window.addEventListener("scroll", request, { passive: true });
    document.addEventListener("visibilitychange", visibility);

    return () => {
      visible = false;
      stop();
      observer.disconnect();
      logoImage.removeEventListener("load", prepare);
      surface.removeEventListener("webglcontextlost", lost);
      motion.removeEventListener("change", preference);
      window.removeEventListener("pointermove", mouse);
      window.removeEventListener("resize", request);
      window.removeEventListener("scroll", request);
      document.removeEventListener("visibilitychange", visibility);
      if (renderer) {
        const { gl, buffer, program, vertex, fragment } = renderer;
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
      }
    };
  }, []);

  return (
    <div className={styles.story} ref={root} data-kultura-story>
      <div className={styles.field} ref={field} aria-hidden="true">
        <div className={styles.ambientLight} />
        <canvas className={styles.particles} ref={canvas} />
        <div className={styles.orbitOne} />
        <div className={styles.orbitTwo} />
        <div className={styles.chromeMark} ref={mark}>
          <div className={styles.globeSpin}>
            <Image ref={image} src="/images/kultura-globe-scene.webp" alt="" fill unoptimized loading="lazy"
              sizes="(max-width: 720px) 78vw, 520px" />
          </div>
        </div>
        <div className={styles.wordFallback}>KULTURA</div>
        <div className={styles.groundGlow} />
        <div className={styles.grain} />
      </div>
      {children}
    </div>
  );
}
