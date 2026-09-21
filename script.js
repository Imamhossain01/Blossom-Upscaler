(function(){
  "use strict";

  var PETAL_PATH = "M12 2C8 5 5 9 5 13c0 4 3 8 7 9 4-1 7-5 7-9 0-4-3-8-7-11z";
  var PETAL_COLORS = ["#ff9fb8","#ffc2d1","#ffd9e3","#ff85a6"];

  function makePetalSVG(size, color){
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns,"svg");
    svg.setAttribute("viewBox","0 0 24 24");
    svg.setAttribute("width", size); svg.setAttribute("height", size);
    var path = document.createElementNS(ns,"path");
    path.setAttribute("d", PETAL_PATH);
    path.setAttribute("fill", color);
    svg.appendChild(path);
    return svg;
  }

  var field = document.getElementById("petal-field");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function spawnAmbientPetal(){
    if (reduceMotion) return;
    var size = 14 + Math.random()*14;
    var color = PETAL_COLORS[Math.floor(Math.random()*PETAL_COLORS.length)];
    var el = makePetalSVG(size, color);
    el.classList.add("petal");
    var startX = Math.random()*100;
    var duration = 9 + Math.random()*8;
    var drift = (Math.random()*160 - 80) + "px";
    var spin = (280 + Math.random()*360) + "deg";
    el.style.left = startX + "vw";
    el.style.setProperty("--drift", drift);
    el.style.setProperty("--spin", spin);
    el.style.setProperty("--pmax", 0.55 + Math.random()*0.25);
    el.style.animationDuration = duration + "s";
    field.appendChild(el);
    setTimeout(function(){ el.remove(); }, duration*1000 + 200);
  }
  for (var i=0;i<6;i++){ setTimeout(spawnAmbientPetal, i*900); }
  setInterval(spawnAmbientPetal, 1400);

  function burstAtPoint(x,y){
    if (reduceMotion) return;
    var count = 6 + Math.floor(Math.random()*4);
    for (var i=0;i<count;i++){
      var size = 10 + Math.random()*12;
      var color = PETAL_COLORS[Math.floor(Math.random()*PETAL_COLORS.length)];
      var el = makePetalSVG(size, color);
      el.classList.add("click-petal");
      var angle = Math.random()*Math.PI*2;
      var dist = 40 + Math.random()*90;
      var tx = Math.cos(angle)*dist + "px";
      var ty = (Math.sin(angle)*dist + 60 + Math.random()*40) + "px";
      var rot = (Math.random()*360 - 180) + "deg";
      el.style.left = x+"px";
      el.style.top = y+"px";
      el.style.setProperty("--tx", tx);
      el.style.setProperty("--ty", ty);
      el.style.setProperty("--rot", rot);
      el.style.animationDelay = (Math.random()*80)+"ms";
      document.body.appendChild(el);
      (function(node){ setTimeout(function(){ node.remove(); }, 1400); })(el);
    }
  }
  document.addEventListener("click", function(e){
    burstAtPoint(e.clientX, e.clientY);
  });

  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var workspace = document.getElementById("workspace");
  var imgBefore = document.getElementById("imgBefore");
  var imgAfter = document.getElementById("imgAfter");
  var dimsBefore = document.getElementById("dimsBefore");
  var dimsAfter = document.getElementById("dimsAfter");
  var fileMeta = document.getElementById("fileMeta");
  var btnUpscale = document.getElementById("btnUpscale");
  var btnEnhance = document.getElementById("btnEnhance");
  var btnDownload = document.getElementById("btnDownload");
  var btnReset = document.getElementById("btnReset");
  var statusText = document.getElementById("statusText");
  var spinner = document.getElementById("spinner");
  var handle = document.getElementById("handle");
  var compare = document.getElementById("compare");

  var originalDataURL = null;
  var originalName = "image";
  var workCanvas = document.createElement("canvas");
  var workCtx = workCanvas.getContext("2d");
  var origW = 0, origH = 0;
  var upscaleApplied = false;
  var enhanceApplied = false;

  var MAX_DIM = 2200;

  function setStatus(msg, busy){
    statusText.textContent = msg || "";
    spinner.classList.toggle("on", !!busy);
  }

  function fmtBytes(n){
    if (n < 1024) return n + " B";
    if (n < 1024*1024) return (n/1024).toFixed(1) + " KB";
    return (n/(1024*1024)).toFixed(2) + " MB";
  }

  function openFile(file){
    if (!file || file.type.indexOf("image/") !== 0){
      setStatus("That file doesn't look like an image — try another.", false);
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e){
      originalDataURL = e.target.result;
      originalName = (file.name || "image").replace(/\.[^.]+$/, "");
      var img = new Image();
      img.onload = function(){
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, MAX_DIM / Math.max(w,h));
        origW = Math.round(w*scale);
        origH = Math.round(h*scale);
        workCanvas.width = origW;
        workCanvas.height = origH;
        workCtx.drawImage(img, 0, 0, origW, origH);

        imgBefore.src = workCanvas.toDataURL("image/png");
        imgAfter.src = workCanvas.toDataURL("image/png");
        dimsBefore.textContent = origW + " × " + origH + " px";
        dimsAfter.textContent = origW + " × " + origH + " px";
        fileMeta.innerHTML = "<strong>" + (file.name || "image") + "</strong><br>" + fmtBytes(file.size) + " · " + w + " × " + h + " px original";

        upscaleApplied = false; enhanceApplied = false;
        btnUpscale.classList.remove("active-state");
        btnEnhance.classList.remove("active-state");
        btnDownload.disabled = true;
        setStatus("Loaded. Choose a refinement below.", false);
        setHandlePercent(50);

        dropzone.style.display = "none";
        workspace.classList.add("active");
        workspace.scrollIntoView({behavior:"smooth", block:"start"});
      };
      img.onerror = function(){ setStatus("Couldn't read that image — try another file.", false); };
      img.src = originalDataURL;
    };
    reader.readAsDataURL(file);
  }

  dropzone.addEventListener("click", function(){ fileInput.click(); });
  dropzone.addEventListener("keydown", function(e){ if (e.key==="Enter" || e.key===" "){ e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener("change", function(e){ if (e.target.files[0]) openFile(e.target.files[0]); });

  ["dragenter","dragover"].forEach(function(evt){
    dropzone.addEventListener(evt, function(e){ e.preventDefault(); e.stopPropagation(); dropzone.classList.add("drag"); });
  });
  ["dragleave","drop"].forEach(function(evt){
    dropzone.addEventListener(evt, function(e){ e.preventDefault(); e.stopPropagation(); dropzone.classList.remove("drag"); });
  });
  dropzone.addEventListener("drop", function(e){
    var file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) openFile(file);
  });

  var progressEl = document.getElementById("progress");
  var progressBar = document.getElementById("progressBar");

  function showProgress(fraction){
    progressEl.classList.add("on");
    if (fraction == null){
      progressEl.classList.add("indeterminate");
      progressBar.style.width = "";
    } else {
      progressEl.classList.remove("indeterminate");
      progressBar.style.width = Math.round(Math.min(1, Math.max(0, fraction)) * 100) + "%";
    }
  }
  function hideProgress(){
    progressEl.classList.remove("on", "indeterminate");
    progressBar.style.width = "0%";
  }
  function nextFrame(){ return new Promise(function(res){ setTimeout(res, 30); }); }

  var UPSCALE_MULTIPLIER = 2;

  // Ultra-Smooth Upscaling with deeper black contrast
  async function applyUpscale(){
    setStatus("Upscaling with deep smooth blending...", true);
    showProgress(0.2);
    await nextFrame();

    var input = workCanvas;
    var newW = input.width * UPSCALE_MULTIPLIER;
    var newH = input.height * UPSCALE_MULTIPLIER;

    showProgress(0.6);
    await nextFrame();

    var scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = newW;
    scaledCanvas.height = newH;
    var sctx = scaledCanvas.getContext('2d');
    
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(input, 0, 0, newW, newH);

    // Apply high level smooth filtering to completely hide pixels
    applyDeepSmoothAndContrast(scaledCanvas, newW, newH);

    workCanvas = scaledCanvas;
    workCtx = sctx;
    origW = newW; 
    origH = newH;

    showProgress(1.0);
    await nextFrame();
  }

  // Deep Smoothing + Contrast for rich black areas
  function applyDeepSmoothAndContrast(canvas, w, h) {
    var ctx = canvas.getContext('2d');
    var src = ctx.getImageData(0, 0, w, h);
    var d = src.data;
    var copy = new Uint8ClampedArray(d);

    // 5x5 smooth blend window for maximum pixel elimination
    for (var y = 2; y < h - 2; y++) {
      for (var x = 2; x < w - 2; x++) {
        var idx = (y * w + x) * 4;
        for (var c = 0; c < 3; c++) {
          var sum = 0, count = 0;
          for (var ky = -2; ky <= 2; ky++) {
            for (var kx = -2; kx <= 2; kx++) {
              sum += copy[((y + ky) * w + (x + kx)) * 4 + c];
              count++;
            }
          }
          var smoothed = sum / count;
          // Blend: 55% original + 45% ultra-smooth blur
          var val = copy[idx + c] * 0.55 + smoothed * 0.45;

          // Push dark/black areas deeper (Contrast curve for shadows)
          if (val < 90) {
            val = val * (val / 90); // Darkens the blacks smoothly
          }

          d[idx + c] = Math.round(Math.min(255, Math.max(0, val)));
        }
      }
    }
    ctx.putImageData(src, 0, 0);
  }

  function applyEnhance(){
    var w = workCanvas.width, h = workCanvas.height;
    var ctx = workCanvas.getContext("2d");
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;

    for (var p = 0; p < w * h; p++){
      var i = p * 4;
      var r = d[i] / 255, g = d[i+1] / 255, b = d[i+2] / 255;
      
      r = Math.min(1, r * 1.06);
      g = Math.min(1, g * 1.06);
      b = Math.min(1, b * 1.06);

      d[i]   = Math.round(r * 255);
      d[i+1] = Math.round(g * 255);
      d[i+2] = Math.round(b * 255);
    }
    ctx.putImageData(img, 0, 0);
  }

  async function runProcess(kind){
    btnUpscale.disabled = true; btnEnhance.disabled = true; btnDownload.disabled = true;
    try{
      if (kind === "upscale"){
        await applyUpscale();
        upscaleApplied = true;
        btnUpscale.classList.add("active-state");
      } else {
        setStatus("Enhancing colors smoothly…", true);
        showProgress(0.5);
        await nextFrame();
        applyEnhance();
        enhanceApplied = true;
        btnEnhance.classList.add("active-state");
        showProgress(1);
      }
      imgAfter.src = workCanvas.toDataURL("image/png");
      dimsAfter.textContent = workCanvas.width + " × " + workCanvas.height + " px";
      setStatus("Done — slide to compare.", false);
    }catch(err){
      console.error(err);
      setStatus("Something went wrong, please try again.", false);
    }finally{
      hideProgress();
      btnUpscale.disabled = upscaleApplied;
      btnEnhance.disabled = enhanceApplied;
      btnDownload.disabled = !(upscaleApplied || enhanceApplied);
    }
  }

  btnUpscale.addEventListener("click", function(){ if (!upscaleApplied) runProcess("upscale"); });
  btnEnhance.addEventListener("click", function(){ if (!enhanceApplied) runProcess("enhance"); });

  btnDownload.addEventListener("click", function(){
    var a = document.createElement("a");
    a.href = workCanvas.toDataURL("image/png");
    a.download = originalName + "-blossom.png";
    document.body.appendChild(a); a.click(); a.remove();
  });

  btnReset.addEventListener("click", function(){
    workspace.classList.remove("active");
    dropzone.style.display = "";
    fileInput.value = "";
    upscaleApplied = false; enhanceApplied = false;
    btnUpscale.disabled = false; btnEnhance.disabled = false;
    btnUpscale.classList.remove("active-state"); btnEnhance.classList.remove("active-state");
    hideProgress();
    setStatus("", false);
  });

  function setHandlePercent(pct){
    pct = Math.min(100, Math.max(0, pct));
    handle.style.left = pct + "%";
    imgBefore.style.clipPath = "inset(0 " + (100-pct) + "% 0 0)";
    handle.setAttribute("aria-valuenow", Math.round(pct));
  }
  function pctFromClientX(clientX){
    var rect = compare.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  }
  var dragging = false;
  handle.addEventListener("pointerdown", function(e){ dragging = true; handle.setPointerCapture(e.pointerId); });
  window.addEventListener("pointermove", function(e){ if (dragging) setHandlePercent(pctFromClientX(e.clientX)); });
  window.addEventListener("pointerup", function(){ dragging = false; });
  compare.addEventListener("pointerdown", function(e){ if (e.target === handle || handle.contains(e.target)) return; setHandlePercent(pctFromClientX(e.clientX)); });
  handle.addEventListener("keydown", function(e){
    var current = parseFloat(handle.style.left) || 50;
    if (e.key === "ArrowLeft"){ setHandlePercent(current - 4); e.preventDefault(); }
    if (e.key === "ArrowRight"){ setHandlePercent(current + 4); e.preventDefault(); }
  });

})();