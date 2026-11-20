/* Instalación como aplicación, aviso de versión nueva y ajustes de lectura (tamaño de letra y estilo) */
"use strict";
(() => {
  const $ = id => document.getElementById(id);
  // ---- Ajustes de lectura
  const raiz = document.documentElement;
  const marcar = () => {
    document.querySelectorAll(".ajustes [data-tam]").forEach(b => b.classList.toggle("act", b.dataset.tam === raiz.dataset.tam));
    document.querySelectorAll(".ajustes [data-tema]").forEach(b => b.classList.toggle("act", b.dataset.tema === raiz.dataset.tema));
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = raiz.dataset.tema === "oscuro" ? "#c47f12" : "#F4A21E";
  };
  const poner = (k, v) => { raiz.dataset[k] = v; try { localStorage.setItem(k === "tam" ? "almanaquePlusTam" : "almanaquePlusTema", v); } catch (e) {} marcar();
    if (typeof mapaUb !== "undefined") setTimeout(() => mapaUb.invalidateSize(), 50); };
  const iniciarAjustes = () => {
    document.querySelectorAll(".ajustes [data-tam]").forEach(b => b.onclick = () => poner("tam", b.dataset.tam));
    document.querySelectorAll(".ajustes [data-tema]").forEach(b => b.onclick = () => poner("tema", b.dataset.tema));
    marcar();
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", iniciarAjustes) : iniciarAjustes();
  const instalada = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const leer = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const pospuesto = () => Date.now() < +(leer("almanaquePlusNoInstalar") || 0);
  let aviso = null;

  function abrir(html) { $("pwaCont").innerHTML = html; $("pwa").classList.add("on"); }
  function cerrar() { $("pwa").classList.remove("on"); }
  window.cerrarPwa = cerrar;

  function dialogoInstalar() {
    if (esIOS) abrir(`<div class="ptit">Instale el Almanaque Plus en su iPhone</div>
      <ol class="ppasos"><li>Toque el botón <b>Compartir</b> <span class="pico">⬆︎</span> en la barra de Safari.</li>
      <li>Elija <b>«Agregar a inicio»</b>.</li><li>Toque <b>Agregar</b>. Aparecerá el ícono del almanaque en su pantalla.</li></ol>
      <div class="pbot"><button onclick="cerrarPwa()">Entendido</button></div>`);
    else abrir(`<div class="ptit">¿Instalar el Almanaque Plus?</div>
      <p>Quedará como una aplicación en su teléfono, con su ícono. Abre más rápido y la luna, el sol, el santoral y los feriados funcionan <b>sin internet</b>.</p>
      <div class="pbot"><button class="prim" id="pwaSi">Instalar</button><button id="pwaNo">Ahora no</button></div>`);
    const si = $("pwaSi"), no = $("pwaNo");
    if (si) si.onclick = async () => { cerrar(); if (!aviso) return; aviso.prompt(); const r = await aviso.userChoice; aviso = null; if (r.outcome !== "accepted") posponer(); botonInstalar(); };
    if (no) no.onclick = () => { posponer(); cerrar(); };
  }
  const posponer = () => guardar("almanaquePlusNoInstalar", Date.now() + 7 * 86400000);   // no insistir por una semana
  function botonInstalar() {
    const b = $("btnInstalar"); if (!b) return;
    b.style.display = !instalada() && (aviso || esIOS) ? "" : "none";
    b.onclick = dialogoInstalar;
  }

  // Android y computadoras: el navegador avisa que se puede instalar
  addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); aviso = e; botonInstalar();
    if (!pospuesto()) setTimeout(() => { if (aviso && !instalada()) dialogoInstalar(); }, 6000);
  });
  addEventListener("appinstalled", () => { aviso = null; botonInstalar(); });
  // iPhone: Safari no avisa; se ofrece la guía una vez por semana
  if (esIOS && !instalada() && !pospuesto()) setTimeout(() => { dialogoInstalar(); posponer(); }, 8000);
  botonInstalar();

  // Versión nueva
  if (!("serviceWorker" in navigator)) return;
  let recargando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!recargando) { recargando = true; location.reload(); } });
  function avisarVersion(sw) {
    $("pwaVersion").classList.add("on");
    $("pwaActualizar").onclick = () => { $("pwaActualizar").textContent = "Actualizando…"; sw.postMessage("actualizar"); };
    $("pwaLuego").onclick = () => $("pwaVersion").classList.remove("on");
  }
  navigator.serviceWorker.register("sw.js").then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) avisarVersion(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const nuevo = reg.installing;
      nuevo.addEventListener("statechange", () => { if (nuevo.state === "installed" && navigator.serviceWorker.controller) avisarVersion(nuevo); });
    });
    // revisar si hay versión nueva al volver a la app y cada hora
    const revisar = () => reg.update().catch(() => {});
    setInterval(revisar, 3600000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") revisar(); });
  }).catch(() => {});
})();
