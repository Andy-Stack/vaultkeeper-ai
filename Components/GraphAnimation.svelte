<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";

  const NODE_COUNT = 20;
  const EXTRA_EDGE_TARGET = 12;
  const MIN_DIST = 0.15;
  const SHADES = [
    "var(--text-normal)",
    "var(--text-muted)",
    "var(--text-faint)",
    "var(--background-modifier-border)",
    "var(--interactive-accent)",
    "var(--color-accent)",
  ];
  const EDGE_STROKE = "var(--text-faint)";
  const ACCENT_EDGE_STROKE = "var(--interactive-accent)";
  const ACCENT_EDGE_CHANCE = 0.2;

  type GraphNode = { x: number; y: number; r: number; shade: string };
  type GraphEdge = { a: number; b: number; stroke: string };
  type Motion = { ax: number; ay: number; fa: number; fb: number; pa: number; pb: number };
  type RenderNode = { cx: number; cy: number; r: number; fill: string; opacity: number };
  type RenderEdge = { x1: number; y1: number; x2: number; y2: number; opacity: number; stroke: string };

  function generateGraph(n: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const pts: { x: number; y: number }[] = [];
    let attempts = 0;
    while (pts.length < n && attempts < 5000) {
      attempts++;
      const x = 0.07 + Math.random() * 0.86;
      const y = 0.07 + Math.random() * 0.86;
      let ok = true;
      for (const p of pts) {
        const dx = p.x - x, dy = p.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < MIN_DIST) { ok = false; break; }
      }
      if (ok) pts.push({ x, y });
    }
    while (pts.length < n) {
      pts.push({ x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8 });
    }

    const nodes: GraphNode[] = pts.map(p => ({
      x: p.x,
      y: p.y,
      r: 2.6 + Math.random() * 4.2,
      shade: SHADES[Math.floor(Math.random() * SHADES.length)],
    }));

    const order = [...Array(n).keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const inTree = new Set([order[0]]);
    const edges: [number, number][] = [];
    for (let k = 1; k < order.length; k++) {
      const node = order[k];
      const treeArr = [...inTree];
      let best = treeArr[0], bestD = Infinity;
      for (const cand of treeArr) {
        const dx = nodes[cand].x - nodes[node].x, dy = nodes[cand].y - nodes[node].y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = cand; }
      }
      edges.push([node, best]);
      inTree.add(node);
    }

    const degree = new Array(n).fill(0);
    edges.forEach(([a, b]) => { degree[a]++; degree[b]++; });
    const leaves: number[] = [];
    for (let i = 0; i < n; i++) if (degree[i] === 1) leaves.push(i);
    const protectedLeaves = new Set(leaves.slice(0, Math.max(2, Math.min(3, leaves.length))));

    const edgeKey = (a: number, b: number) => (a < b ? a + "-" + b : b + "-" + a);
    const existing = new Set(edges.map(([a, b]) => edgeKey(a, b)));
    let added = 0, tries = 0;
    while (added < EXTRA_EDGE_TARGET && tries < 600) {
      tries++;
      const a = Math.floor(Math.random() * n);
      const b = Math.floor(Math.random() * n);
      if (a === b) continue;
      if (protectedLeaves.has(a) || protectedLeaves.has(b)) continue;
      const key = edgeKey(a, b);
      if (existing.has(key)) continue;
      const dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
      if (Math.sqrt(dx * dx + dy * dy) > 0.4) continue;
      existing.add(key);
      edges.push([a, b]);
      added++;
    }

    const coloredEdges: GraphEdge[] = edges.map(([a, b]) => ({
      a,
      b,
      stroke: Math.random() < ACCENT_EDGE_CHANCE ? ACCENT_EDGE_STROKE : EDGE_STROKE,
    }));

    return { nodes, edges: coloredEdges };
  }

  function makeMotion(nodesArr: GraphNode[]): Motion[] {
    return nodesArr.map(() => ({
      ax: 0.03 + Math.random() * 0.03,
      ay: 0.026 + Math.random() * 0.03,
      fa: 0.16 + Math.random() * 0.2,
      fb: 0.45 + Math.random() * 0.32,
      pa: Math.random() * Math.PI * 2,
      pb: Math.random() * Math.PI * 2,
    }));
  }

  const graph = generateGraph(NODE_COUNT);
  const motion = makeMotion(graph.nodes);

  const VIEW_SIZE = 460;
  let renderNodes: RenderNode[] = [];
  let renderEdges: RenderEdge[] = [];
  let rafId: number | undefined;
  let startTime: number | undefined;

  function computeFrame(t: number) {
    const nodes: RenderNode[] = graph.nodes.map((n, i) => {
      const m = motion[i];
      const dx = m.ax * Math.sin(t * m.fa + m.pa) + m.ax * 0.4 * Math.sin(t * m.fb + m.pb);
      const dy = m.ay * Math.cos(t * m.fa * 0.9 + m.pb) + m.ay * 0.4 * Math.cos(t * m.fb * 1.1 + m.pa);
      return {
        cx: (n.x + dx) * VIEW_SIZE,
        cy: (n.y + dy) * VIEW_SIZE,
        r: n.r,
        fill: n.shade,
        opacity: 0.55 + 0.4 * Math.sin(t * 0.65 + i * 1.3),
      };
    });
    const edges: RenderEdge[] = graph.edges.map((e, i) => ({
      x1: nodes[e.a].cx,
      y1: nodes[e.a].cy,
      x2: nodes[e.b].cx,
      y2: nodes[e.b].cy,
      opacity: 0.26 + 0.16 * Math.sin(t * 0.4 + i),
      stroke: e.stroke,
    }));
    renderNodes = nodes;
    renderEdges = edges;
  }

  onMount(() => {
    const loop = (now: number) => {
      if (startTime === undefined) startTime = now;
      computeFrame((now - startTime) / 1000);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    if (rafId !== undefined) cancelAnimationFrame(rafId);
  });
</script>

<svg
  class="graph-animation"
  viewBox="0 0 {VIEW_SIZE} {VIEW_SIZE}"
  preserveAspectRatio="xMidYMid meet"
  in:fade={{ duration: 400 }}
>
  {#each renderEdges as e}
    <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.stroke} stroke-width="1.2" style="stroke-linecap: round; opacity: {e.opacity}"></line>
  {/each}
  {#each renderNodes as n}
    <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.fill} style="opacity: {n.opacity}"></circle>
  {/each}
</svg>

<style>
  .graph-animation {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
