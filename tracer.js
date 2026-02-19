// tracer.js

window.TraceImage = function(imgEl, threshold=128, simplify=1.0) {
  return new Promise(resolve => {
    const MAX_DIM = 1024;
    const cw = imgEl.naturalWidth || imgEl.width;
    const ch = imgEl.naturalHeight || imgEl.height;
    const scale = Math.min(MAX_DIM/cw, MAX_DIM/ch, 1);
    const w = Math.round(cw*scale), h = Math.round(ch*scale);

    const cvs = document.createElement('canvas');
    cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, w, h);

    const idata = ctx.getImageData(0, 0, w, h);
    const data  = idata.data;
    const gray  = new Uint8Array(w * h);

    let hasAlpha = false;
    for(let i = 3; i < data.length; i += 4){
      if(data[i] < 250){ hasAlpha = true; break; }
    }

    if(hasAlpha){
      // Alpha-keyed: use alpha channel directly
      for(let i = 0; i < w*h; i++){
        gray[i] = data[i*4+3] > threshold ? 1 : 0;
      }
    } else {
      // No alpha: detect background brightness from image corners
      // so we always trace the LOGO color, not the background
      const cornerIdxs = [0, w-1, w*(h-1), w*h-1];
      let bgLum = 0;
      cornerIdxs.forEach(ci => {
        bgLum += 0.299*data[ci*4] + 0.587*data[ci*4+1] + 0.114*data[ci*4+2];
      });
      bgLum /= cornerIdxs.length;

      const darkBg = bgLum < 128;
      for(let i = 0; i < w*h; i++){
        const lum = 0.299*data[i*4] + 0.587*data[i*4+1] + 0.114*data[i*4+2];
        // Dark bg  -> trace pixels brighter than threshold (logo = bright vs dark bg)
        // Light bg -> trace pixels darker  than (255-threshold) (logo = dark vs light bg)
        gray[i] = darkBg ? (lum > threshold ? 1 : 0)
                         : (lum < (255 - threshold) ? 1 : 0);
      }
    }

    const visited = new Uint8Array(w * h);
    const contours = [];

    // 0:E 1:SE 2:S 3:SW 4:W 5:NW 6:N 7:NE
    const dx = [ 1,  1,  0, -1, -1, -1,  0,  1];
    const dy = [ 0,  1,  1,  1,  0, -1, -1, -1];

    function trace(sx, sy){
      const path = [];
      let x = sx, y = sy, dir = 7, steps = 0;

      let ok = false;
      for(let i = 0; i < 8; i++){
        const nx = x+dx[i], ny = y+dy[i];
        if(nx>=0 && nx<w && ny>=0 && ny<h && gray[ny*w+nx]){
          dir = i; ok = true; break;
        }
      }
      if(!ok) return null;

      do {
        path.push({x, y});
        visited[y*w+x] = 1;
        let found = false;
        const scan = (dir + 5) % 8;
        for(let i = 0; i < 8; i++){
          const d  = (scan + i) % 8;
          const nx = x + dx[d], ny = y + dy[d];
          if(nx>=0 && nx<w && ny>=0 && ny<h && gray[ny*w+nx]){
            x = nx; y = ny; dir = d; found = true; break;
          }
        }
        if(!found) break;
        steps++;
      } while((x !== sx || y !== sy) && steps < w*h);

      return path.length > 4 ? simplifyPath(path, simplify) : null;
    }

    function simplifyPath(pts, epsilon){
      const points = pts.map(p => [p.x, p.y]);

      function rdp(list, eps){
        if(list.length < 3) return list;
        let maxD = 0, idx = 0;
        const end = list.length - 1;
        for(let i = 1; i < end; i++){
          const d = ptLineDist(list[i], list[0], list[end]);
          if(d > maxD){ maxD = d; idx = i; }
        }
        if(maxD > eps){
          const l = rdp(list.slice(0, idx+1), eps);
          const r = rdp(list.slice(idx),       eps);
          return l.slice(0,-1).concat(r);
        }
        return [list[0], list[end]];
      }

      const simplified = rdp(points, epsilon);
      // without distorting the global shape (2 iterations is plenty)
      return simplified.length >= 4 ? chaikin(simplified, 2) : simplified;
    }

    function chaikin(pts, iters){
      let out = pts;
      for(let k = 0; k < iters; k++){
        const n = out.length, next = [];
        for(let i = 0; i < n; i++){
          const a = out[i], b = out[(i+1) % n];
          next.push([a[0]*0.75+b[0]*0.25, a[1]*0.75+b[1]*0.25]);
          next.push([a[0]*0.25+b[0]*0.75, a[1]*0.25+b[1]*0.75]);
        }
        out = next;
      }
      return out;
    }

    function ptLineDist(p, a, b){
      const ax=a[0],ay=a[1],bx=b[0],by=b[1],px=p[0],py=p[1];
      const cx=bx-ax, cy=by-ay, lenSq=cx*cx+cy*cy;
      const t = lenSq ? Math.max(0,Math.min(1,((px-ax)*cx+(py-ay)*cy)/lenSq)) : 0;
      return Math.hypot(px-(ax+t*cx), py-(ay+t*cy));
    }

    for(let y = 0; y < h; y++){
      for(let x = 0; x < w; x++){
        if(gray[y*w+x] === 1 && visited[y*w+x] === 0){
          let border = false;
          for(let k = 0; k < 8; k++){
            const nx=x+dx[k], ny=y+dy[k];
            if(nx<0||ny<0||nx>=w||ny>=h||gray[ny*w+nx]===0){ border=true; break; }
          }
          if(border){
            const p = trace(x, y);
            if(p) contours.push(p);
          }
        }
      }
    }

    if(contours.length === 0){ resolve([]); return; }


    // Signed area via shoelace formula
    function polyArea(poly){
      let a = 0;
      for(let i=0,n=poly.length; i<n; i++){
        const j = (i+1) % n;
        a += poly[i][0]*poly[j][1] - poly[j][0]*poly[i][1];
      }
      return Math.abs(a) * 0.5;
    }

    // (the first point may sit right on the edge after Chaikin smoothing)
    function centroid(poly){
      let cx=0, cy=0;
      for(const p of poly){ cx+=p[0]; cy+=p[1]; }
      return [cx/poly.length, cy/poly.length];
    }

    // Ray-cast point-in-polygon
    function isInside(pt, poly){
      let inside=false;
      const px=pt[0], py=pt[1];
      for(let i=0,j=poly.length-1; i<poly.length; j=i++){
        const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
        if(((yi>py)!==(yj>py)) && px < (xj-xi)*(py-yi)/(yj-yi)+xi)
          inside=!inside;
      }
      return inside;
    }

    const bounds = contours.map(poly => {
      let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
      for(const p of poly){
        if(p[0]<minX) minX=p[0]; if(p[0]>maxX) maxX=p[0];
        if(p[1]<minY) minY=p[1]; if(p[1]>maxY) maxY=p[1];
      }
      return {minX,minY,maxX,maxY};
    });

    const areas     = contours.map(polyArea);
    const centroids = contours.map(centroid);
    const totalArea = w * h;

    // Remove near-full-image contours (solid-background border artefact)
    // Remove sub-pixel noise (< 0.05% of canvas area)
    const MIN_AREA = totalArea * 0.0005;
    const MAX_AREA = totalArea * 0.90;

    const validIdx = contours
      .map((_,i) => i)
      .filter(i => areas[i] >= MIN_AREA && areas[i] <= MAX_AREA);

    if(validIdx.length === 0){ resolve([]); return; }

    const vContours  = validIdx.map(i => contours[i]);
    const vBounds    = validIdx.map(i => bounds[i]);
    const vAreas     = validIdx.map(i => areas[i]);
    const vCentroids = validIdx.map(i => centroids[i]);
    const n          = vContours.length;

    // For each contour, find its IMMEDIATE parent = the smallest contour
    // that fully contains it.  Using centroid + area makes this robust even
    // after the Chaikin smoothing has shifted point positions.
    const parent = new Int32Array(n).fill(-1);

    for(let i = 0; i < n; i++){
      const ci = vCentroids[i];
      let bestParent = -1, bestArea = Infinity;

      for(let j = 0; j < n; j++){
        if(i === j) continue;
        // Fast AABB reject: j must completely contain i's bounding box
        if(vBounds[i].minX < vBounds[j].minX || vBounds[i].maxX > vBounds[j].maxX ||
           vBounds[i].minY < vBounds[j].minY || vBounds[i].maxY > vBounds[j].maxY) continue;
        // j must be larger than i
        if(vAreas[j] <= vAreas[i]) continue;
        // Centroid of i must lie inside j
        if(isInside(ci, vContours[j])){
          // Prefer the SMALLEST qualifying parent (= closest ancestor)
          if(vAreas[j] < bestArea){ bestArea = vAreas[j]; bestParent = j; }
        }
      }
      parent[i] = bestParent;
    }

    function getDepth(i){
      let d=0, cur=i;
      while(parent[cur] !== -1){ d++; cur = parent[cur]; }
      return d;
    }

    const isHole = new Uint8Array(n);
    for(let i = 0; i < n; i++) isHole[i] = getDepth(i) % 2 !== 0 ? 1 : 0;

    const finalShapes = [];
    const shapeMap    = {};

    function makePath(obj, poly){
      obj.moveTo(poly[0][0]/w, 1 - poly[0][1]/h);
      for(let k = 1; k < poly.length; k++)
        obj.lineTo(poly[k][0]/w, 1 - poly[k][1]/h);
      obj.closePath();
    }

    // Create solid shapes first
    for(let i = 0; i < n; i++){
      if(!isHole[i]){
        const shape = new THREE.Shape();
        makePath(shape, vContours[i]);
        shapeMap[i] = shape;
        finalShapes.push(shape);
      }
    }

    // Attach holes to their nearest solid ancestor
    // (handles deep nesting: hole → solid → hole → solid…)
    for(let i = 0; i < n; i++){
      if(!isHole[i]) continue;
      let cur = parent[i];
      // Walk up until we find a solid ancestor to attach this hole to
      while(cur !== -1 && isHole[cur]) cur = parent[cur];
      if(cur !== -1 && shapeMap[cur]){
        const path = new THREE.Path();
        makePath(path, vContours[i]);
        shapeMap[cur].holes.push(path);
      }
    }

    resolve(finalShapes);
  });
};
