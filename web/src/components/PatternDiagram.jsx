import { useMemo, useRef, useState, useCallback } from "react";
import { Background, BackgroundVariant, Controls, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowNoLabel, EdgeLabels, FitOpen, Passport, PassportActions } from "../diagram-kit/DiagramKit.jsx";
import { boxPassport, sidePoint } from "../diagram-kit/diagramKit.js";
import "../diagram-kit/diagram-kit.css";
import DiagramStepBar from "./DiagramStepBar";
import { useDiagramStepper } from "../hooks/useDiagramStepper";
import { REFIT_EVENT, useFitOnResize } from "../hooks/useFitOnResize";
import Json from "./JsonPane.jsx";
import { HOT_KEYS } from "../utils/payload";
import "./PatternDiagram.css";

const FIT = { padding: 0.08 };
const HANDLES = [["t", Position.Top], ["b", Position.Bottom], ["l", Position.Left], ["r", Position.Right]];

function Box({ data }) {
  return (
    <div className={`pat-node pat-node--${data.kind}${data.on ? " pat-node--on" : ""}${data.passport ? " dk-open" : ""}`}>
      {HANDLES.map(([k, pos]) => (
        <span key={k}>
          <Handle id={`s-${k}`} type="source" position={pos} className="pat-handle" />
          <Handle id={`t-${k}`} type="target" position={pos} className="pat-handle" />
        </span>
      ))}
      {data.label}
      {data.passport && <Passport p={data.passport} />}
    </div>
  );
}
const nodeTypes = { box: Box };

// Pick the sides of the two boxes that face each other, so an arrow leaves toward its target.
function sides(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? ["r", "l"] : ["l", "r"]) : (dy > 0 ? ["b", "t"] : ["t", "b"]);
}

// The kit's point helper for this lab's `s-<side>` / `t-<side>` handles.
export const labelPointFor = (box, handle) => sidePoint(box, String(handle).replace(/^[st]-/, ""));

// One label item per arrow, for the kit's EdgeLabels layer (above the boxes, never overlapping).
export function toLabelItems(pattern, stepper) {
  return pattern.steps.map((s, i) => ({
    id: `e${i}`,
    text: `${i + 1}. ${s.label}`,
    source: s.from,
    target: s.to,
    active: stepper.step === i,
    dim: stepper.step >= 0 && stepper.step !== i,
  }));
}

function Canvas({ pattern, positions, onMove, stepper }) {
  const ref = useRef(null);
  useFitOnResize(ref, FIT);
  const active = stepper.step >= 0 ? pattern.steps[stepper.step] : null;
  // Click a box and it expands in place with its details (the shared diagram kit's Passport, §8c).
  const [open, setOpen] = useState(null);
  const graph = useMemo(() => ({
    nodes: pattern.nodes.map((n) => ({ id: n.id, label: n.label, group: n.kind })),
    edges: pattern.steps.map((s) => ({ source: s.from, target: s.to, label: s.label })),
  }), [pattern]);
  const nodes = pattern.nodes.map((n) => ({
    id: n.id, type: "box", position: positions[n.id], draggable: true,
    zIndex: n.id === open ? 10 : undefined,
    data: {
      label: n.label, kind: n.kind,
      on: !!active && (active.from === n.id || active.to === n.id),
      passport: n.id === open ? boxPassport(graph, n.id) : null,
    },
  }));
  const edges = pattern.steps.map((s, i) => {
    const [a, b] = sides(positions[s.from], positions[s.to]);
    const cp = ["iam", "priv", "authz"].includes(s.to);
    const now = stepper.step === i;
    const seen = stepper.step >= 0 && i <= stepper.step;
    return {
      id: `e${i}`, source: s.from, target: s.to, sourceHandle: `s-${a}`, targetHandle: `t-${b}`, type: "arrow",
      animated: now,
      className: `pat-edge${cp ? " pat-edge--cp" : ""}${now ? " pat-edge--now" : ""}${stepper.step >= 0 && !seen ? " pat-edge--dim" : ""}`,
      markerEnd: { type: MarkerType.ArrowClosed },
    };
  });
  const items = useMemo(() => toLabelItems(pattern, stepper), [pattern, stepper]);
  const actions = useMemo(() => ({
    open: (id) => setOpen(id),
    close: () => setOpen(null),
    link: (id) => { const u = new URL(window.location.href); u.searchParams.set("box", id); return u.toString(); },
  }), []);
  return (
    <div ref={ref} className="pat-canvas" data-testid="pattern-canvas">
      <PassportActions.Provider value={actions}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={{ arrow: ArrowNoLabel }}
          onNodeClick={(_, n) => setOpen((o) => (o === n.id ? null : n.id))} onPaneClick={() => setOpen(null)}
          onNodeDragStop={(_, n) => onMove(n.id, n.position)} onNodeDrag={(_, n) => onMove(n.id, n.position)}
          fitView fitViewOptions={FIT} nodesConnectable={false} minZoom={0.3} proOptions={{ hideAttribution: true }}>
          <Background variant={BackgroundVariant.Dots} gap={18} />
          <Controls showInteractive={false} />
          <EdgeLabels items={items} pointFor={labelPointFor} fallback={{ w: 190, h: 60 }} />
          <FitOpen open={open} closePadding={0.08} />
        </ReactFlow>
      </PassportActions.Provider>
    </div>
  );
}

export default function PatternDiagram({ pattern, path, onPath }) {
  const initial = useMemo(() => Object.fromEntries(pattern.nodes.map((n) => [n.id, { x: n.x, y: n.y }])), [pattern]);
  const [positions, setPositions] = useState(initial);
  const stepper = useDiagramStepper(pattern.steps.length);
  const onMove = useCallback((id, p) => setPositions((cur) => ({ ...cur, [id]: { x: p.x, y: p.y } })), []);
  const step = stepper.step >= 0 ? pattern.steps[stepper.step] : null;
  // Reset restores box positions as well as the walkthrough and the view.
  const reset = () => { stepper.stop(); setPositions(initial); setTimeout(() => window.dispatchEvent(new Event(REFIT_EVENT)), 0); };
  return (
    <section className="pat" aria-label={pattern.title}>
      {pattern.paths && (
        <div className="views" role="group" aria-label="MCP gateway path">
          {pattern.paths.map((o) => <button key={o.id} type="button" aria-pressed={path === o.id} onClick={() => onPath(o.id)}>{o.label}</button>)}
        </div>
      )}
      <p className="intro">{pattern.intro}</p>
      <DiagramStepBar stepper={stepper} caption={step ? step.label : ""} testId="pattern-step-bar" />
      <button type="button" className="pat-reset" onClick={reset} data-testid="pattern-reset">Reset positions and walkthrough</button>
      {step && (
        <article className="track__now" data-testid="pattern-now">
          <h2>Step {stepper.step + 1}: {step.label}</h2>
          <p>{step.say}</p>
          {step.payload && <div className="pat-payload"><Json value={step.payload} label={`${step.label} payload`} testId="pattern-json" hot={HOT_KEYS} /></div>}
        </article>
      )}
      <ReactFlowProvider>
        <Canvas pattern={pattern} positions={positions} onMove={onMove} stepper={stepper} />
      </ReactFlowProvider>
      <p className="keys">Drag any box. Mock token values; the hosts are examples.</p>
    </section>
  );
}
