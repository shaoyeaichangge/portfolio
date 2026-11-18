const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// A stylized, procedural flow field. All coordinates are in units of viewport height.
export function createFlowField(canvas) {
  const context = canvas?.getContext("2d");
  if (!context) return null;

  const samples = 92;
  const lines = Array.from({ length: 33 }, (_, i) => ({
    seed: (i / 32 - .5) * .97,
    points: new Float32Array(samples + 1),
  }));
  const wake = [];
  const pointer = { x: -.35, y: 0, strength: 0, inside: false, held: false };
  let width = 1, height = 1, half = .5, wash;
  let time = 0, lastDraw = -Infinity, lastTrail = -Infinity, steering = 0;
  let trailX = pointer.x, trailY = pointer.y;

  function resize(nextWidth, nextHeight, ratio) {
    width = nextWidth;
    height = nextHeight;
    half = width / height / 2;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    wash = context.createLinearGradient(0, 0, width, 0);
    wash.addColorStop(0, "transparent");
    wash.addColorStop(.16, "#fff8");
    wash.addColorStop(.36, "white");
    wash.addColorStop(.84, "white");
    wash.addColorStop(1, "transparent");
    lastDraw = -Infinity;
  }

  function setPointer(x, y, held) {
    pointer.x = clamp((x - width / 2) / height, -half, half);
    pointer.y = clamp(y / height - .5, -.5, .5);
    if (!pointer.inside) lastTrail = -Infinity;
    pointer.inside = true;
    pointer.held = held;
  }

  function release() {
    pointer.inside = false;
    pointer.held = false;
  }

  function clear() {
    release();
    wake.length = 0;
    pointer.strength = 0;
    steering = 0;
    lastTrail = lastDraw = -Infinity;
  }

  function update(dt) {
    time += dt;
    const strength = pointer.held ? 1 : pointer.inside ? .66 : 0;
    pointer.strength += (strength - pointer.strength) * (1 - Math.exp(-dt * 8));
    const direction = pointer.held ? clamp(pointer.y * 1.15, -.37, .37) : 0;
    steering += (direction - steering) * (1 - Math.exp(-dt * 4));

    const travel = Math.hypot(pointer.x - trailX, pointer.y - trailY);
    const wait = pointer.held ? .23 : .105;
    if (pointer.inside && time - lastTrail > wait && (travel > .042 || pointer.held || !Number.isFinite(lastTrail))) {
      const spin = pointer.y < trailY ? -1 : 1;
      // A pair of opposite vortices creates the rolling edges of the wake.
      wake.push({ x: pointer.x + .025, y: pointer.y, born: time, spin, energy: pointer.held ? 1 : .76 });
      if (wake.length > 7) wake.shift();
      trailX = pointer.x;
      trailY = pointer.y;
      lastTrail = time;
    }
    for (let i = wake.length - 1; i >= 0; i--) {
      if (time - wake[i].born > 2.15) wake.splice(i, 1);
    }
  }

  function draw(dt, still) {
    if (!wash) return;
    if (still) {
      if (lastDraw === 0) return;
      clear();
    } else {
      update(dt);
      if (time - lastDraw < .029) return;
    }
    lastDraw = still ? 0 : time;
    const phase = still ? 0 : time;
    const step = width / samples;
    const unitStep = step / height;
    const hull = Math.min(.29, half * .52);
    const eddies = wake.map(vortex => {
      const age = time - vortex.born;
      return {
        age,
        x: vortex.x + age * .27,
        y: vortex.y + age * steering * .15,
        radius: .072 + age * .035,
        spin: vortex.spin * vortex.energy * Math.exp(-age * 1.35),
      };
    });

    context.clearRect(0, 0, width, height);
    context.lineWidth = .85;
    for (const [index, { seed, points }] of lines.entries()) {
      let offset = 0;
      context.beginPath();
      for (let i = 0; i <= samples; i++) {
        const x = i * unitStep - half;
        const bend = Math.exp(-(((x + .025) / hull) ** 2));
        const aroundHull = Math.tanh(seed * 34) * .188 * bend * Math.exp(-((seed / .28) ** 2));
        const y = seed + aroundHull + (x + half) * steering * .48
          + .015 * Math.sin(x * 5.5 - phase * 1.5 + seed * 7);
        const dy = y + offset - pointer.y;
        const dx = x - pointer.x;
        const push = pointer.strength * .88 * Math.tanh(dy * 47) * Math.exp(-(dx * dx + dy * dy) / .021);
        let curl = 0;
        for (const eddy of eddies) {
          const ex = x - eddy.x;
          if (Math.abs(ex) > eddy.radius * 2.6) continue;
          const ey = (y + offset - eddy.y) / eddy.radius;
          const px = ex / eddy.radius;
          curl += eddy.spin * px * .92 * (
            Math.exp(-(px * px + (ey - .54) ** 2)) - Math.exp(-(px * px + (ey + .54) ** 2))
          );
        }
        offset += clamp(push + curl - offset * 2.3, -1.1, 1.1) * unitStep;
        const py = (y + offset + .5) * height;
        points[i] = py;
        if (i === 0) context.moveTo(0, py);
        else context.lineTo(i * step, py);
      }
      const emphasis = Math.max(0, 1 - Math.abs(seed - pointer.y) * 5) * pointer.strength;
      const alpha = .15 + (index % 4 === 0 ? .09 : 0) + emphasis * .33;
      context.strokeStyle = `rgba(137, 192, 249, ${alpha})`;
      context.stroke();
    }

    // Fine pulses follow the same paths, making direction and curvature visible.
    context.lineWidth = 1.35;
    context.lineCap = "round";
    for (let i = 1; i < lines.length; i += 2) {
      const { points, seed } = lines[i];
      for (let j = 0; j < 2; j++) {
        const sample = ((i * .381966 + j * .5 + phase * (.13 + (i % 3) * .016)) % 1) * samples;
        const end = Math.floor(sample);
        if (end < 2 || end >= samples) continue;
        const head = points[end] + (points[end + 1] - points[end]) * (sample - end);
        const tail = Math.max(0, end - 2 - (i % 3));
        const light = context.createLinearGradient(tail * step, 0, sample * step, 0);
        const alpha = .51 + .34 * pointer.strength * Math.max(0, 1 - Math.abs(seed - pointer.y) * 5);
        light.addColorStop(0, "transparent");
        light.addColorStop(1, `rgba(191, 225, 255, ${alpha})`);
        context.strokeStyle = light;
        context.beginPath();
        context.moveTo(tail * step, points[tail]);
        for (let k = tail + 1; k <= end; k++) context.lineTo(k * step, points[k]);
        context.lineTo(sample * step, head);
        context.stroke();
      }
    }

    // Light traces curl around each traveling vortex, then disperse downstream.
    for (const eddy of eddies) {
      const opacity = Math.abs(eddy.spin) * Math.min(1, eddy.age * 16) * .49;
      const startX = (eddy.x + half - eddy.radius * 1.6) * height;
      const light = context.createLinearGradient(startX, 0, startX + eddy.radius * 2.8 * height, 0);
      light.addColorStop(0, "transparent");
      light.addColorStop(.68, `rgba(148, 207, 255, ${opacity})`);
      light.addColorStop(1, `rgba(210, 240, 255, ${opacity * .35})`);
      context.strokeStyle = light;
      context.lineWidth = 1.1;
      for (const side of [-1, 1]) {
        const rotation = Math.sign(eddy.spin) * side;
        context.beginPath();
        for (let i = 0; i <= 22; i++) {
          const t = i / 22;
          const angle = rotation * (eddy.age * 5 + t * 3.5) + side * 1.4;
          const radius = eddy.radius * (.59 - t * .25);
          const x = (eddy.x + half + radius * Math.cos(angle) - (1 - t) * eddy.radius) * height;
          const y = (eddy.y + .5 + side * eddy.radius * .52 + radius * Math.sin(angle)) * height;
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.stroke();
      }
    }
    context.globalCompositeOperation = "destination-in";
    context.fillStyle = wash;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";
  }

  return {
    resize, setPointer, release, clear, draw,
    get active() {
      return pointer.inside || pointer.strength > .008 || Math.abs(steering) > .003 || wake.length > 0;
    },
  };
}
