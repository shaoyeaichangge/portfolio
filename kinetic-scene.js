(() => {
  const hero = document.querySelector(".kinetic-hero");
  const stage = hero?.querySelector(".kinetic-stage");
  if (!stage) return;
  const viewport = stage.querySelector(".kinetic-viewport");
  const canvas = stage.querySelector(".kinetic-canvas");
  const controls = stage.querySelector(".kinetic-tools");
  const expandButton = stage.querySelector('[data-action="expand"]');
  const resetButton = stage.querySelector('[data-action="reset"]');
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const viewer = document.querySelector(".image-viewer");
  let dispose;
  function fallback() {
    hero.classList.remove("kinetic-ready");
    controls.hidden = true;
    viewport.removeAttribute("tabindex");
    viewport.style.cursor = "default";
  }
  Promise.all([
    import("./assets/lib/three-0.170.0.module.min.js"),
    import("./kinetic-flow.js?v=1").catch(() => null),
  ]).then(([THREE, flowModule]) => {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    try {
      const flow = flowModule?.createFlowField(stage.querySelector(".kinetic-flow"));
      stage.classList.toggle("kinetic-flow-ready", Boolean(flow));
      init(THREE, renderer, flow);
    } catch (error) {
      dispose?.();
      renderer.dispose();
      throw error;
    }
  }).catch(fallback);

  function init(T, renderer, flow) {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(36, 1, .1, 40);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(0x000000, 0);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    const geometry = value => (geometries.add(value), value);
    const material = value => (materials.add(value), value);
    let environment;
    function lightStudio() {
      const mapCanvas = document.createElement("canvas");
      mapCanvas.width = 1024; mapCanvas.height = 512;
      const ctx = mapCanvas.getContext("2d");
      const ambient = ctx.createLinearGradient(0, 0, 0, 512);
      ambient.addColorStop(0, "#b5c4d6"); ambient.addColorStop(.4, "#26374f");
      ambient.addColorStop(.65, "#0d1625"); ambient.addColorStop(1, "#35445a");
      ctx.fillStyle = ambient; ctx.fillRect(0, 0, 1024, 512);
      for (const [x, y, w, h, color] of [[90, 45, 100, 370, "#ffffff"], [460, 30, 200, 110, "#f1f6ff"], [770, 90, 44, 300, "#92caff"], [930, 180, 60, 200, "#dae8ff"]]) {
        ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
      }
      const texture = new T.CanvasTexture(mapCanvas); texture.mapping = T.EquirectangularReflectionMapping; texture.colorSpace = T.SRGBColorSpace;
      const pmrem = new T.PMREMGenerator(renderer);
      environment?.dispose(); environment = pmrem.fromEquirectangular(texture);
      scene.environment = environment.texture;
      texture.dispose(); pmrem.dispose();
    }
    lightStudio();
    scene.add(new T.HemisphereLight(0xddeeff, 0x142036, 1));
    const key = new T.DirectionalLight(0xf1f6ff, 4.5); key.position.set(-3, 5, 4); scene.add(key);
    const rim = new T.DirectionalLight(0x8bbfff, 3.5); rim.position.set(4, 1, -2); scene.add(rim);
    const fill = new T.DirectionalLight(0xffffff, 1.2); fill.position.set(-2, -2, 4); scene.add(fill);

    // Entirely procedural geometry; no research assets or simulation data.
    const sculpture = new T.Group(); scene.add(sculpture);
    const body = new T.Group(); sculpture.add(body);
    const segments = 240, sides = 24;
    const base = geometry(new T.TorusKnotGeometry(1.13, .34, segments, sides, 2, 3));
    const pieces = [];
    [0xe2e9f0, 0xa8c5e5, 0xc4cfdf].forEach((color, index) => {
      const surface = geometry(new T.BufferGeometry());
      for (const attribute of ["position", "normal", "uv"]) surface.setAttribute(attribute, base.getAttribute(attribute));
      const first = index * 80, last = (index + 1) * 80;
      surface.setIndex(new T.BufferAttribute(base.index.array.slice((first + 1) * sides * 6, last * sides * 6), 1));
      const metal = material(new T.MeshPhysicalMaterial({ color, metalness: .98, roughness: .2, clearcoat: .7, clearcoatRoughness: .22, envMapIntensity: 1.6, side: T.DoubleSide }));
      const group = new T.Group(); group.add(new T.Mesh(surface, metal));
      const edgeMaterial = material(new T.LineBasicMaterial({ color: 0xdceeff, transparent: true, opacity: .7 }));
      for (const row of [first + 1, last]) {
        const points = Array.from({ length: sides }, (_, j) => new T.Vector3().fromBufferAttribute(base.attributes.position, row * (sides + 1) + j));
        group.add(new T.LineLoop(geometry(new T.BufferGeometry().setFromPoints(points)), edgeMaterial));
      }
      body.add(group); pieces.push(group);
    });
    const wireMaterial = material(new T.LineBasicMaterial({ color: 0xa0d5ff, transparent: true, opacity: 0, depthWrite: false }));
    const wireBase = geometry(new T.TorusKnotGeometry(1.13, .34, 100, 8, 2, 3));
    const wire = new T.LineSegments(geometry(new T.WireframeGeometry(wireBase)), wireMaterial); body.add(wire);

    const shadowCanvas = document.createElement("canvas"); shadowCanvas.width = shadowCanvas.height = 128;
    const shadowContext = shadowCanvas.getContext("2d");
    const gradient = shadowContext.createRadialGradient(64,64,4,64,64,62); gradient.addColorStop(0,"#000b"); gradient.addColorStop(.45,"#0005"); gradient.addColorStop(1,"#0000");
    shadowContext.fillStyle=gradient; shadowContext.fillRect(0,0,128,128);
    const shadowTexture = new T.CanvasTexture(shadowCanvas); textures.add(shadowTexture);
    const shadow = new T.Mesh(geometry(new T.PlaneGeometry(6,6)), material(new T.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: .75 })));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -2.35; scene.add(shadow);
    const grid = new T.GridHelper(14, 28, 0x49678b, 0x294361); grid.position.y=-2.4; grid.material.transparent=true; grid.material.opacity=.16; scene.add(grid);
    geometries.add(grid.geometry); materials.add(grid.material);
    scene.fog = new T.FogExp2(0x142239,.075);

    let frame=0, last=0, phase=0, elapsed=0, visible=true, lost=false, destroyed=false;
    let paused=reduceMotion.matches, expanded=false, spread=0, scroll=0, scrollTarget=0;
    let yaw=-.42, pitch=.2, targetYaw=yaw, targetPitch=pitch, px=0, py=0, targetPx=0, targetPy=0;
    let drag, holdTimer=0, heroTop=0, heroHeight=1, width=1, height=1;
    const canRender=()=>!destroyed&&!lost&&visible&&!document.hidden&&!viewer?.open;
    const auto=()=>!paused&&!reduceMotion.matches&&!drag;
    function schedule(){if(!frame&&canRender()){last=0;frame=requestAnimationFrame(tick);}}
    function tick(now){
      frame=0;if(!canRender())return;
      const dt=Math.min(.05,Math.max(0,last?(now-last)/1000:1/60));last=now;
      const ease=reduceMotion.matches?1:1-Math.exp(-dt*8);
      if(auto()){phase+=dt;elapsed+=dt;targetYaw+=dt*.11;}
      yaw+=(targetYaw-yaw)*ease;pitch+=(targetPitch-pitch)*ease;
      px+=(targetPx-px)*ease;py+=(targetPy-py)*ease;
      spread+=((expanded?1:0)-spread)*ease; scroll+=(scrollTarget-scroll)*ease;
      const entrance=reduceMotion.matches?1:Math.min(1,elapsed/1.2);
      const reveal=1-Math.pow(1-entrance,3);
      body.rotation.set(pitch+scroll*.16, yaw+scroll*.55, -.32);
      body.scale.setScalar(.86+.14*reveal);
      body.position.y=.15+Math.sin(phase*.6)*.045;
      pieces.forEach((piece,i)=>{
        const angle=i*Math.PI*2/3+.35;
        piece.position.set(Math.cos(angle)*spread*.85,Math.sin(angle)*spread*.7,(i-1)*spread*.45);
        piece.rotation.set(spread*(i-1)*.1,spread*(i-1)*.12,0);
      });
      wireMaterial.opacity=spread*.2;wire.visible=spread>.005;
      camera.position.set(px*.45,.35+py*.3,(width<450?7.8:8.5)-scroll*.35+spread*1.8);
      camera.lookAt(0,.05,0);
      key.position.x=-3+px*2;
      flow?.draw(dt, reduceMotion.matches);
      renderer.render(scene,camera);
      const moving=Math.abs(targetYaw-yaw)+Math.abs(targetPitch-pitch)+Math.abs(targetPx-px)+Math.abs(targetPy-py)+Math.abs((expanded?1:0)-spread)+Math.abs(scrollTarget-scroll)>.001;
      if(auto()||moving||(!reduceMotion.matches&&flow?.active))frame=requestAnimationFrame(tick);
    }
    function measure(){
      if(destroyed)return;
      const rect=viewport.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
      const ratio=Math.min(devicePixelRatio||1,innerWidth<761?1.25:1.5);
      renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);
      flow?.resize(width,height,ratio);
      camera.aspect=width/height;camera.fov=width<450?44:36;camera.updateProjectionMatrix();
      const bounds=hero.getBoundingClientRect();heroTop=bounds.top+scrollY;heroHeight=bounds.height;
      onScroll();schedule();
    }
    function onScroll(){if(visible){scrollTarget=reduceMotion.matches?0:Math.max(0,Math.min(1,(scrollY-heroTop)/heroHeight));schedule();}}
    function endDrag(){
      clearTimeout(holdTimer);
      flow?.release();
      const id=drag?.id;
      drag=undefined;
      delete viewport.dataset.dragging;
      if(id!==undefined&&viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);
      schedule();
    }
    function disturb(clientX, clientY, held, bounds = viewport.getBoundingClientRect()) {
      if (reduceMotion.matches || !canRender()) return;
      flow?.setPointer(clientX - bounds.left, clientY - bounds.top, held);
      schedule();
    }
    function pointerDown(event){
      if(!event.isPrimary||event.button!==0)return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:targetYaw,pitch:targetPitch,touch:event.pointerType==="touch"};
      viewport.setPointerCapture(event.pointerId);viewport.dataset.dragging="";
      if (!drag.touch) disturb(event.clientX, event.clientY, true);
      else if (flow && !reduceMotion.matches) holdTimer = setTimeout(() => {
        if (drag?.id === event.pointerId) disturb(drag.x, drag.y, true);
      }, 145);
    }
    function pointerMove(event){
      if(drag?.id===event.pointerId){
        const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
        if(drag.touch&&Math.abs(dy)>Math.abs(dx)*1.3&&Math.abs(dy)>10){endDrag();return;}
        if (!drag.touch || Math.abs(dx) > 8) {
          clearTimeout(holdTimer);
          disturb(event.clientX, event.clientY, true);
        }
        targetYaw=drag.yaw+dx*.009;targetPitch=Math.max(-1.1,Math.min(1.1,drag.pitch+dy*.006));schedule();
      }else if(event.pointerType==="mouse"&&!reduceMotion.matches){
        const r=viewport.getBoundingClientRect();targetPx=(event.clientX-r.left)/r.width*2-1;targetPy=-((event.clientY-r.top)/r.height*2-1);
        disturb(event.clientX,event.clientY,false,r);
      }
    }
    function leave(){if(!drag)flow?.release();targetPx=targetPy=0;schedule();}
    function keyDown(event){
      if (event.code === "Space" && flow && !reduceMotion.matches) {
        event.preventDefault();
        flow.setPointer(width * .26, height * .36, true);
        schedule();
        return;
      }
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;
      event.preventDefault();
      if(event.key==='Home')reset();
      else{targetYaw+=(event.key==='ArrowRight'?.22:event.key==='ArrowLeft'?-.22:0);targetPitch=Math.max(-1.1,Math.min(1.1,targetPitch+(event.key==='ArrowDown'?.15:event.key==='ArrowUp'?-.15:0)));schedule();}
    }
    function syncButtons(){
      expandButton.setAttribute('aria-pressed',String(expanded));expandButton.querySelector('span').textContent=expanded?'合拢结构':'展开结构';
      const canSteer = flow && !reduceMotion.matches;
      viewport.setAttribute('aria-keyshortcuts', `ArrowLeft ArrowRight ArrowUp ArrowDown Home${canSteer ? ' Space' : ''}`);
      viewport.setAttribute('aria-label', `三维曲面装置，可拖动或用方向键旋转，Home 键复位${canSteer ? '，按住空格扰动流线' : ''}`);
    }
    function reset(){targetYaw=-.42;targetPitch=.2;expanded=false;targetPx=targetPy=0;flow?.clear();syncButtons();schedule();}
    function toggleExpand(){expanded=!expanded;syncButtons();schedule();}
    function motionChange(){paused=reduceMotion.matches;elapsed=1.2;endDrag();syncButtons();schedule();}
    function visibilityChange(){endDrag();if(!canRender()){cancelAnimationFrame(frame);frame=0;}else schedule();}
    function contextLost(event){event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;endDrag();fallback();}
    function contextRestored(){try{lightStudio();lost=false;hero.classList.add('kinetic-ready');controls.hidden=false;viewport.tabIndex=0;viewport.style.cursor='';measure();}catch{fallback();}}
    viewport.addEventListener('pointerdown',pointerDown);viewport.addEventListener('pointermove',pointerMove);
    viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',endDrag);viewport.addEventListener('lostpointercapture',endDrag);viewport.addEventListener('pointerleave',leave);viewport.addEventListener('keydown',keyDown);
    viewport.addEventListener('keyup',event=>{if(event.code==='Space')flow?.release();});
    viewport.addEventListener('blur',()=>flow?.release());
    expandButton.addEventListener('click',toggleExpand);resetButton.addEventListener('click',reset);
    canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
    const resizeObserver=new ResizeObserver(measure);resizeObserver.observe(viewport);
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;visibilityChange();if(visible)onScroll();});observer.observe(hero);
    const modalObserver=new MutationObserver(visibilityChange);if(viewer)modalObserver.observe(viewer,{attributes:true,attributeFilter:['open']});
    window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('blur',endDrag);document.addEventListener('visibilitychange',visibilityChange);reduceMotion.addEventListener('change',motionChange);
    window.addEventListener('pagehide',()=>{endDrag();cancelAnimationFrame(frame);frame=0;});window.addEventListener('pageshow',schedule);
    dispose=()=>{destroyed=true;cancelAnimationFrame(frame);resizeObserver.disconnect();observer.disconnect();modalObserver.disconnect();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());environment?.dispose();};
    syncButtons();measure();
    // Render a first frame before replacing the static, equally legible fallback.
    cancelAnimationFrame(frame);frame=0;tick(0);hero.classList.add('kinetic-ready');controls.hidden=false;viewport.tabIndex=0;
  }
})();
