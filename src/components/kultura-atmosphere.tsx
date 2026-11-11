"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./kultura-atmosphere.module.css";

const COUNT = 920;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (n: number) => { const x = clamp(n); return x * x * (3 - 2 * x); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

type Geometry = {
  cloud: Float32Array;
  orbit: Float32Array;
  word: Float32Array;
  scatter: Float32Array;
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

function makeGeometry(): Geometry {
  const random = seededRandom();
  const cloud = new Float32Array(COUNT * 3);
  const orbit = new Float32Array(COUNT * 3);
  const word = new Float32Array(COUNT * 3);
  const scatter = new Float32Array(COUNT * 3);
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

  for (let i = 0; i < COUNT; i++) {
    const j = i * 3;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 2.25;
    cloud[j] = Math.cos(angle) * radius * 1.65;
    cloud[j + 1] = -0.62 + Math.sin(angle) * radius * 0.58;
    cloud[j + 2] = (random() - 0.5) * 2.9;

    const a = (i * 0.618033988749895 % 1) * Math.PI * 2;
    const orbitRadius = 1.16 + random() * 0.72;
    orbit[j] = Math.cos(a) * orbitRadius * 1.5;
    orbit[j + 1] = Math.sin(a) * orbitRadius * 0.67;
    orbit[j + 2] = Math.sin(a * 1.65) * 0.72 + (random() - .5) * 1.05;

    const glyph = glyphs.length
      ? glyphs[Math.floor(random() * glyphs.length)]
      : [420 + Math.cos(a) * 180, 93 + Math.sin(a) * 48];
    word[j] = (glyph[0] - 420) / 130;
    word[j + 1] = (92 - glyph[1]) / 118 - 0.12;
    word[j + 2] = (random() - .5) * 0.44;

    scatter[j] = (random() - .5) * 8.6;
    scatter[j + 1] = (random() - .5) * 4.1;
    scatter[j + 2] = (random() - .5) * 4;
    sizes[i] = 3.5 + Math.pow(random(), 2) * 9;
    colors[i] = random() > 0.977 ? 1 : random() * .78;
    seeds[i] = random() * Math.PI * 2;
  }

  return { cloud, orbit, word, scatter, sizes, colors, seeds };
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
  "  float mobile = min(1.0, u_aspect / 1.42);",
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

function setup(canvas: HTMLCanvasElement): Renderer | null {
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
    gl, program, buffer, vertex, fragment, values, geometry: makeGeometry(),
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

function draw(r: Renderer, p: number, elapsed: number, px: number, py: number) {
  const a = smooth((p - .20) / .30);
  const b = smooth((p - .61) / .21);
  const c = smooth((p - .88) / .18);
  const orbitMotion = a * (1 - b);
  const time = elapsed * .001;
  const { cloud, orbit, word, scatter, sizes, colors, seeds } = r.geometry;
  for (let i = 0; i < COUNT; i++) {
    const j = i * 3;
    const k = i * 5;
    const offset = .024 * Math.sin(time * .62 + seeds[i]);
    const x = mix(mix(cloud[j], orbit[j], a), word[j], b);
    const y = mix(mix(cloud[j + 1], orbit[j + 1], a), word[j + 1], b);
    const z = mix(mix(cloud[j + 2], orbit[j + 2], a), word[j + 2], b);
    r.values[k] = mix(x, scatter[j], c) + offset;
    r.values[k + 1] = mix(y, scatter[j + 1], c) + .034 * Math.cos(time * .53 + seeds[i]);
    r.values[k + 2] = mix(z, scatter[j + 2], c) + .018 * Math.sin(time * .36 + seeds[i]);
    r.values[k + 3] = sizes[i];
    r.values[k + 4] = colors[i];
  }
  const gl = r.gl;
  gl.useProgram(r.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, r.buffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, r.values);
  gl.uniform1f(r.aspect, Math.max(.1, gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight)));
  gl.uniform1f(r.dprUniform, r.dpr);
  gl.uniform1f(r.spin, orbitMotion * (Math.sin(time * .48) * .14 + px * .23));
  gl.uniform1f(r.mx, px);
  gl.uniform1f(r.my, py);
  gl.uniform1f(r.opacity, mix(.78, .36, orbitMotion) * (1 - c * .38));
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.POINTS, 0, COUNT);
}

export function KulturaAtmosphere({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const story = root.current;
    const layer = field.current;
    const surface = canvas.current;
    if (!story || !layer || !surface) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motion.matches;
    let renderer: Renderer | null = null;
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
      const intro = 1 - smooth((p - .22) / .24);
      const outro = smooth((p - .69) / .17);
      layer.style.setProperty("--mark-opacity", Math.max(intro * .47, outro * .45).toFixed(3));
      layer.style.setProperty("--word-opacity", Math.max(intro * .76, outro * .88).toFixed(3));
      layer.style.setProperty("--ring-angle", (p * 135).toFixed(2) + "deg");
      layer.style.setProperty("--story-glow", (1 - smooth((p - .9) / .14) * .35).toFixed(3));
      pointerX = mix(pointerX, targetX, .055);
      pointerY = mix(pointerY, targetY, .055);
      layer.style.setProperty("--parallax-x", (pointerX * 24).toFixed(2) + "px");
      layer.style.setProperty("--parallax-y", (pointerY * 18).toFixed(2) + "px");
      if (renderer) {
        resize(surface, renderer);
        draw(renderer, p, reduced ? 0 : performance.now() - start, reduced ? 0 : pointerX, reduced ? 0 : pointerY);
      }
      if (!reduced) frame = window.requestAnimationFrame(paint);
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
    const preference = () => { reduced = motion.matches; stop(); request(); };
    const visibility = () => { stop(); request(); };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        if (!renderer) renderer = setup(surface);
        request();
      } else stop();
    }, { rootMargin: "160px 0px", threshold: 0 });
    observer.observe(story);
    motion.addEventListener("change", preference);
    window.addEventListener("pointermove", mouse, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    window.addEventListener("scroll", request, { passive: true });
    document.addEventListener("visibilitychange", visibility);

    return () => {
      visible = false;
      stop();
      observer.disconnect();
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
        <div className={styles.chromeMark}>
          <Image src="/images/kultura-globe-scene.webp" alt="" fill loading="lazy"
            sizes="(max-width: 720px) 78vw, 520px" />
        </div>
        <div className={styles.brandWord}>
          <span>KULTURA</span>
          <small>STEP INTO KULTURA</small>
        </div>
        <div className={styles.groundGlow} />
        <div className={styles.grain} />
      </div>
      {children}
    </div>
  );
}
