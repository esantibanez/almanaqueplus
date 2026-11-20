/* Almanaque Plus — Herramientas para el campo:
   alertas de clima extremo, estrés calórico del ganado, riesgo de incendio y focos de calor,
   "¿Se puede fumigar hoy?" (productos orgánicos), cuaderno de campo y lectura en voz alta.
   Usa el pronóstico por hora de Open-Meteo (variable global `horas`, cargada en almanaque.js). */
"use strict";
let horas = [];          // [{iso, h, temp, hr, lluvia, prob, viento, rafaga, dir, uv, dia}]
let focos = null;        // focos de calor NASA FIRMS (focos.json, actualizado cada 3 h)

const horasDe = iso => horas.filter(x => x.iso === iso);
const maxDe = (arr, k) => arr.reduce((m, x) => x[k] != null && x[k] > m ? x[k] : m, -Infinity);
const minDe = (arr, k) => arr.reduce((m, x) => x[k] != null && x[k] < m ? x[k] : m, Infinity);

// ---- Alertas de clima extremo -------------------------------------------------------------
function alertasDia(iso) {
  const c = clima[iso]; if (!c) return [];
  const H = horasDe(iso), out = [], ant = clima[isoMas(iso, -1)];
  const raf = H.length ? maxDe(H, "rafaga") : null;
  if (c.min <= 2) out.push({ n: 2, ico: "🥶", tit: "Helada", txt: `Mínima de ${Math.round(c.min)}°: proteja almácigos, plantines y frutales jóvenes; abrigue a los animales.` });
  else if (c.min <= 6) out.push({ n: 1, ico: "❄️", tit: "Frío fuerte", txt: `Mínima de ${Math.round(c.min)}°: puede helar en los bajos. Cubra almácigos.` });
  // surazo: caída fuerte de temperatura con viento del sur
  const vientoSur = H.some(x => x.dir >= 135 && x.dir <= 225 && x.viento >= 15);
  if (ant && (ant.max - c.max >= 8 || (ant.min - c.min >= 7)) && vientoSur)
    out.push({ n: 2, ico: "🌬️", tit: "Surazo", txt: `Baja la temperatura (máxima de ${Math.round(ant.max)}° a ${Math.round(c.max)}°) con viento del sur${raf ? ` y ráfagas de ${Math.round(raf)} km/h` : ""}. Asegure techos y abrigue a los animales.` });
  if ([96, 99].includes(c.cod)) out.push({ n: 2, ico: "🧊", tit: "Tormenta con granizo", txt: "Puede dañar hortalizas y frutales en flor. Guarde herramientas y animales bajo techo." });
  else if (c.cod === 95) out.push({ n: 1, ico: "⛈️", tit: "Tormenta eléctrica", txt: "Evite estar en el campo abierto o bajo árboles aislados durante la tormenta." });
  if (c.lluvia >= 50) out.push({ n: 2, ico: "🌧️", tit: "Lluvia muy fuerte", txt: `${Math.round(c.lluvia)} mm: riesgo de anegamiento y crecida de quebradas. Revise drenajes.` });
  else if (c.lluvia >= 30) out.push({ n: 1, ico: "🌧️", tit: "Lluvia fuerte", txt: `${Math.round(c.lluvia)} mm: no siembre ni fumigue; revise drenajes.` });
  if (c.max >= 38) out.push({ n: 2, ico: "🔥", tit: "Calor extremo", txt: `Máxima de ${Math.round(c.max)}°: riegue temprano o al atardecer, dé sombra y agua al ganado.` });
  else if (c.max >= 36) out.push({ n: 1, ico: "🌡️", tit: "Mucho calor", txt: `Máxima de ${Math.round(c.max)}°: evite trabajos pesados al mediodía.` });
  if (raf != null && raf >= 50) out.push({ n: 1, ico: "💨", tit: "Viento fuerte", txt: `Ráfagas de ${Math.round(raf)} km/h: no fumigue ni queme; asegure plantas tutoradas.` });
  // veranillo: en plena época de lluvias, muchos días seguidos sin lluvia
  const mes = +iso.slice(5, 7);
  if ([10, 11, 12, 1, 2, 3].includes(mes)) {
    let seco = 0; for (let i = 0; i < 40; i++) { const z = clima[isoMas(iso, -i)]; if (!z || z.lluvia >= 2) break; seco++; }
    if (seco >= 10) out.push({ n: seco >= 15 ? 2 : 1, ico: "🏜️", tit: "Veranillo", txt: `${seco} días seguidos sin lluvia en plena época de lluvias: riesgo para lo recién sembrado. Riegue si puede.` });
  }
  return out;
}

// ---- Estrés calórico del ganado (índice de temperatura y humedad, ITH) ---------------------
function ithDia(iso) {
  const H = horasDe(iso).filter(x => x.temp != null && x.hr != null); if (!H.length) return null;
  const v = Math.max(...H.map(x => 0.8 * x.temp + (x.hr / 100) * (x.temp - 14.4) + 46.4));
  const nivel = v >= 84 ? [3, "Emergencia", "Riesgo de muerte: sombra, agua fresca abundante y nada de arreos ni manejo."]
    : v >= 79 ? [2, "Peligro", "Baja la producción de leche y el ganado sufre: sombra y agua; trabaje con los animales solo temprano."]
    : v >= 75 ? [1, "Alerta", "El ganado empieza a sentir el calor: asegure sombra y agua."]
    : [0, "Normal", "Sin estrés por calor."];
  return { v: Math.round(v), n: nivel[0], tit: nivel[1], txt: nivel[2] };
}

// ---- Riesgo de incendio (índice de Angström) y focos de calor ------------------------------
function incendioDia(iso) {
  const c = clima[iso], H = horasDe(iso); if (!c || !H.length) return null;
  // Angström usa la temperatura y la humedad de la 1 de la tarde
  const m = H.find(x => x.h === 13) || H.reduce((a, x) => (x.temp > a.temp ? x : a), H[0]);
  const I = m.hr / 20 + (27 - m.temp) / 10;
  let seco = 0; for (let i = 0; i < 60; i++) { const z = clima[isoMas(iso, -i)]; if (!z || z.lluvia >= 5) break; seco++; }
  let n = I <= 2 ? 3 : I <= 2.5 ? 2 : I <= 4 ? 1 : 0;
  // en el trópico Angström exagera: la lluvia reciente moja el pasto y la hojarasca
  if (c.lluvia >= 5) n = 0;
  else if (seco <= 3) n = Math.min(n, 1);
  else if (seco <= 7) n = Math.min(n, 2);
  else if (seco >= 20 && n < 3) n++;
  const raf = maxDe(H, "rafaga");
  const t = ["Bajo", "Moderado", "Alto", "Muy alto"][n];
  return { n, tit: t, I: I.toFixed(1), hrMin: Math.round(minDe(H, "hr")), seco, raf: isFinite(raf) ? Math.round(raf) : null,
    txt: n >= 2 ? "No queme. Si hay fuego cerca, avise a los bomberos voluntarios y a la alcaldía." : n === 1 ? "Evite quemas; si es imprescindible, solo con autorización de la ABT, cortafuego y personas vigilando." : "Riesgo bajo por el clima, pero toda quema necesita autorización de la ABT." };
}
async function cargarFocos() {
  try { const r = await fetch("focos.json?" + Math.floor(Date.now() / 600000)); if (r.ok) focos = await r.json(); } catch (e) {}
}
function focosCerca(km = 50) {
  if (!focos || !focos.focos) return null;
  const lista = focos.focos.map(f => ({ ...f, d: distKm(lugar.lat, lugar.lon, f.lat, f.lon) })).filter(f => f.d <= km).sort((a, b) => a.d - b.d);
  return { lista, generado: focos.generado };
}
const rumboTxt = (la1, lo1, la2, lo2) => {
  const y = Math.sin((lo2 - lo1) * RAD) * Math.cos(la2 * RAD), x = Math.cos(la1 * RAD) * Math.sin(la2 * RAD) - Math.sin(la1 * RAD) * Math.cos(la2 * RAD) * Math.cos((lo2 - lo1) * RAD);
  return ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"][Math.round(((Math.atan2(y, x) / RAD + 360) % 360) / 45) % 8];
};

// ---- ¿Se puede fumigar hoy? Productos orgánicos ----------------------------------------------
const ORGANICOS = {
  botanico: { nombre: "Extractos botánicos (neem, ajo-ají, paraíso, cola de caballo…)", tMax: 28, hrMin: 0, sinLluvia: 6, uvMax: 6, horas: [6, 7, 8, 9, 16, 17, 18],
    nota: "Se degradan con el sol fuerte y el calor: aplicar temprano o al atardecer. Agregar un adherente natural (jabón potásico) ayuda a que resistan una lluvia leve." },
  biologico: { nombre: "Biológicos (Bacillus thuringiensis, Beauveria, Trichoderma, Metarhizium)", tMax: 30, hrMin: 60, sinLluvia: 6, uvMax: 3, horas: [6, 7, 17, 18, 19],
    nota: "Son organismos vivos: el sol los mata. Aplicar al atardecer, con humedad alta, y con agua sin cloro. No mezclar con caldos de cobre." },
  mineral: { nombre: "Caldos minerales (sulfocálcico, bordelés, ceniza)", tMax: 30, hrMin: 0, sinLluvia: 12, uvMax: 8, horas: [6, 7, 8, 9, 10, 16, 17],
    nota: "Con más de 30° pueden quemar las hojas. Necesitan tiempo para secar. No aplicar en plena floración ni cerca de fuentes de agua (el cobre afecta a peces y abejas)." },
  foliar: { nombre: "Biofertilizantes foliares (biol, supermagro, té de compost)", tMax: 28, hrMin: 40, sinLluvia: 4, uvMax: 5, horas: [6, 7, 8, 16, 17, 18],
    nota: "La hoja absorbe mejor con los estomas abiertos: temprano por la mañana o al atardecer, sin calor fuerte." },
};
let tipoOrg = "botanico";
try { const g = localStorage.getItem("almanaquePlusOrganico"); if (ORGANICOS[g]) tipoOrg = g; } catch (e) {}
function ventanasFumigar(iso, tipo, desde = 0) {
  const P = ORGANICOS[tipo], H = horasDe(iso).filter(x => x.h >= desde); if (!horasDe(iso).length) return null;
  const fallas = {}, ok = [];
  for (const x of H) {
    if (!P.horas.includes(x.h)) continue;
    const idx = horas.indexOf(x), sig = horas.slice(idx, idx + P.sinLluvia);
    const llueve = sig.reduce((s, z) => s + (z.lluvia || 0), 0) >= 0.2 || sig.some(z => (z.prob || 0) >= 40);
    const motivos = [];
    if (llueve) motivos.push("lluvia en las horas siguientes");
    if (x.viento > 10 || x.rafaga > 20) motivos.push("viento fuerte (la mezcla se va con el viento)");
    if (x.viento < 2) motivos.push("calma total (la neblina de la mezcla queda flotando)");
    if (x.temp > P.tMax) motivos.push(`calor (más de ${P.tMax}°)`);
    if (x.hr < P.hrMin) motivos.push(`aire muy seco (menos de ${P.hrMin} % de humedad)`);
    if ((x.uv || 0) > P.uvMax) motivos.push("sol muy fuerte");
    if (!motivos.length) ok.push(x.h); else motivos.forEach(m => { fallas[m] = (fallas[m] || 0) + 1; });
  }
  // agrupar horas seguidas en ventanas
  const vent = []; for (const h of ok) { const u = vent[vent.length - 1]; if (u && h === u[1] + 1) u[1] = h; else vent.push([h, h]); }
  return { vent, fallas: Object.entries(fallas).sort((a, b) => b[1] - a[1]).map(z => z[0]) };
}
const txtVent = v => v.map(([a, b]) => `${String(a).padStart(2, "0")}:00 a ${String(b + 1).padStart(2, "0")}:00`).join(" y ");

// ---- Cuaderno de campo -------------------------------------------------------------------
// Ciclos aproximados en días desde la siembra (o el trasplante). Guía general: varían según variedad y clima.
const CICLOS = {
  maiz: { cosecha: [120, 140], etapas: [[25, 35, "Aporque y control de malezas"], [55, 70, "Floración: no debe faltar agua"], [80, 90, "Choclo"]] },
  frejol: { cosecha: [85, 100], etapas: [[35, 45, "Floración: evitar exceso de agua"]] },
  arroz: { cosecha: [110, 140], etapas: [[25, 45, "Macollamiento: control de malezas"], [75, 90, "Floración"]] },
  mani: { cosecha: [100, 130], etapas: [[25, 35, "Floración y clavado: aporque suave"]] },
  tomate: { desde: "trasplante", cosecha: [70, 90], etapas: [[15, 20, "Tutorado"], [20, 60, "Desbrote semanal"]] },
  zanahoria: { cosecha: [90, 120], etapas: [[25, 30, "Raleo de plantitas"]] },
  remolacha: { cosecha: [60, 90], etapas: [[20, 25, "Raleo"]] },
  lechuga: { desde: "trasplante", cosecha: [35, 50] },
  rabano: { cosecha: [25, 35] },
  pimenton: { desde: "trasplante", cosecha: [75, 95], etapas: [[15, 25, "Tutorado"]] },
  aji: { desde: "trasplante", cosecha: [85, 110] },
  pepino: { cosecha: [50, 65], etapas: [[15, 20, "Guiar en tutor o espaldera"]] },
  cebolla: { desde: "trasplante", cosecha: [90, 120], etapas: [[80, 100, "Cortar el riego cuando se doblan las hojas"]] },
  repollo: { desde: "trasplante", cosecha: [70, 100] },
  sandia: { cosecha: [75, 95], etapas: [[30, 40, "Floración: cuidar a las abejas"]] },
  melon: { cosecha: [70, 90], etapas: [[30, 40, "Floración: cuidar a las abejas"]] },
  joco: { cosecha: [90, 120] },
  yuca: { cosecha: [180, 365], nota: "Variedades tempranas de 6 a 8 meses, intermedias de 8 a 10 y tardías de 10 a 12 (CIAT Roboré).", etapas: [[30, 60, "Primera carpida (limpieza)"]] },
  camote: { cosecha: [120, 150] },
  walusa: { cosecha: [240, 300] },
  papaya: { desde: "trasplante", cosecha: [240, 300], etapas: [[90, 120, "Sexado: dejar plantas hembra o hermafroditas"]] },
  maracuya: { desde: "trasplante", cosecha: [180, 270], etapas: [[30, 60, "Guiar a la espaldera"]] },
  pina: { desde: "trasplante", cosecha: [420, 600] },
  platano: { desde: "trasplante", cosecha: [300, 420], etapas: [[120, 180, "Primer deshije"]] },
  guineo: { desde: "trasplante", cosecha: [270, 365], etapas: [[120, 180, "Primer deshije"]] },
};
const ANIOS = { naranja: [3, 4], mandarina: [3, 4], toronja: [3, 5], pomelo: [3, 5], lima: [2, 3], limon: [2, 3], palta: [3, 5], lucuma: [4, 5], cayu: [3, 4],
  piton: [5, 8], guapuru: [5, 8], acerola: [2, 3], pitanga: [2, 3], carambola: [2, 3], mango: [3, 5], guayaba: [2, 3], achachairu: [5, 7], tamarindo: [4, 6] };
const leerCuaderno = () => { try { return JSON.parse(localStorage.getItem("almanaquePlusCuaderno")) || []; } catch (e) { return []; } };
const guardarCuaderno = l => { try { localStorage.setItem("almanaquePlusCuaderno", JSON.stringify(l)); } catch (e) {} };
function eventosDe(e) {   // fechas importantes de una siembra
  const ev = [], C = CICLOS[e.cultivo];
  if (C) {
    (C.etapas || []).forEach(([a, b, t]) => ev.push({ desde: isoMas(e.fecha, a), hasta: isoMas(e.fecha, b), txt: t, ico: "📌" }));
    ev.push({ desde: isoMas(e.fecha, C.cosecha[0]), hasta: isoMas(e.fecha, C.cosecha[1]), txt: "Cosecha estimada", ico: "🧺" });
  } else if (ANIOS[e.cultivo]) {
    const [a, b] = ANIOS[e.cultivo];
    ev.push({ desde: isoMas(e.fecha, a * 365), hasta: isoMas(e.fecha, b * 365), txt: "Primera cosecha estimada (plantín injertado o de vivero)", ico: "🧺" });
  }
  return ev;
}
function eventosDelDia(iso) {   // etapas que empiezan ese día y cosechas (inicio y fin de la ventana)
  return leerCuaderno().flatMap(e => eventosDe(e).filter(v => iso === v.desde || (v.ico === "🧺" && iso === v.hasta)).map(v => ({ ...v, e, fin: iso === v.hasta && iso !== v.desde })));
}
function renderCuaderno() {
  const caja = document.getElementById("cuadernoLista"); if (!caja) return;
  const l = leerCuaderno(), h = hoyISO();
  caja.innerHTML = l.length ? l.map((e, i) => {
    const C = CICLOS[e.cultivo], ev = eventosDe(e), dias = Math.round((new Date(h) - new Date(e.fecha)) / 86400000);
    const prox = ev.filter(v => v.hasta >= h).slice(0, 3);
    return `<div class="cuad"><div class="cuadcab"><b>${CULTIVOS[e.cultivo].nombre}</b>${e.parcela ? ` · ${e.parcela}` : ""}
        <span class="cuadf">${C && C.desde === "trasplante" ? "trasplantado" : "sembrado"} el ${fmtISO(e.fecha)} · hace ${dias} días</span>
        <button class="cuadx" data-i="${i}" title="Borrar">✕</button></div>
      ${e.nota ? `<div class="cuadn">${e.nota}</div>` : ""}
      <ul>${prox.map(v => `<li>${v.ico} <b>${v.txt}:</b> ${v.desde === v.hasta ? fmtISO(v.desde) : `del ${fmtISO(v.desde)} al ${fmtISO(v.hasta)}`}</li>`).join("") || "<li>Ciclo completado.</li>"}</ul>
      ${C && C.nota ? `<div class="cuadn">${C.nota}</div>` : ""}</div>`; }).join("")
    : `<div class="nota">Todavía no anotó ninguna siembra. Lo que anote se guarda solo en este teléfono o computadora.</div>`;
  caja.querySelectorAll(".cuadx").forEach(b => b.onclick = () => { if (!confirm("¿Borrar esta anotación?")) return; const l2 = leerCuaderno(); l2.splice(+b.dataset.i, 1); guardarCuaderno(l2); render(); });
}
const fmtISO = iso => { const [a, m, d] = iso.split("-").map(Number); return `${d} ${NOMBRE_MES[m - 1].slice(0, 3).toLowerCase()}${a !== +hoyISO().slice(0, 4) ? ` ${a}` : ""}`; };
function iniciarCuaderno() {
  const sel = document.getElementById("cuadCultivo");
  sel.innerHTML = GRUPOS.map(([g, ids]) => `<optgroup label="${g}">${ids.map(id => `<option value="${id}">${CULTIVOS[id].nombre}</option>`).join("")}</optgroup>`).join("");
  document.getElementById("cuadFecha").value = hoyISO();
  document.getElementById("cuadForm").onsubmit = e => {
    e.preventDefault();
    const l = leerCuaderno();
    l.push({ cultivo: sel.value, fecha: document.getElementById("cuadFecha").value, parcela: document.getElementById("cuadParcela").value.trim(), nota: document.getElementById("cuadNota").value.trim() });
    l.sort((a, b) => a.fecha.localeCompare(b.fecha)); guardarCuaderno(l);
    document.getElementById("cuadParcela").value = ""; document.getElementById("cuadNota").value = "";
    render();
  };
}

// ---- Panel "Hoy en el campo" -------------------------------------------------------------
function renderCampo() {
  const el = document.getElementById("campo"); if (!el) return;
  const h = hoyISO(), m = isoMas(h, 1);
  if (!clima[h] || !horas.length) { el.innerHTML = `<div class="ctit">⚠️ Hoy en el campo</div><div class="nota">Cargando el pronóstico… (necesita internet)</div>`; renderCuaderno(); return; }
  // alertas próximos 7 días
  const al = []; for (let i = 0; i < 7; i++) { const d = isoMas(h, i); alertasDia(d).forEach(a => al.push({ ...a, d, i })); }
  const alHtml = al.length ? al.map(a => `<div class="alerta al${a.n}"><span class="aico">${a.ico}</span><div><b>${a.tit}</b> · ${a.i === 0 ? "hoy" : a.i === 1 ? "mañana" : fmtISO(a.d)}<br><small>${a.txt}</small></div></div>`).join("")
    : `<div class="alerta al0"><span class="aico">✅</span><div><b>Sin alertas de clima extremo</b> en los próximos 7 días.</div></div>`;
  // ganado
  const g = [0, 1, 2].map(i => ({ i, r: ithDia(isoMas(h, i)) })).filter(z => z.r);
  const gHtml = g.length ? g.map(z => `<span class="chip ith${z.r.n}">${["Hoy", "Mañana", "Pasado"][z.i]}: ${z.r.tit} (${z.r.v})</span>`).join(" ") + `<div class="csub">${g[0].r.txt}</div>` : "";
  // incendio y focos
  const f = incendioDia(h), fc = focosCerca(50);
  let focHtml = "";
  if (fc) {
    const c25 = fc.lista.filter(z => z.d <= 25).length;
    focHtml = fc.lista.length
      ? `<div class="csub">🛰️ <b>${fc.lista.length} foco${fc.lista.length > 1 ? "s" : ""} de calor</b> a menos de 50 km en las últimas 48 horas${c25 ? ` (${c25} a menos de 25 km)` : ""}. El más cercano, a ${Math.round(fc.lista[0].d)} km al ${rumboTxt(lugar.lat, lugar.lon, fc.lista[0].lat, fc.lista[0].lon)}.</div>`
      : `<div class="csub">🛰️ Sin focos de calor a menos de 50 km en las últimas 48 horas.</div>`;
  }
  // fumigar
  const fh = ventanasFumigar(h, tipoOrg, +fmt(new Date(), { hour: "numeric", hour12: false })), fm = ventanasFumigar(m, tipoOrg), P = ORGANICOS[tipoOrg];
  const dFum = (r, cuando) => !r ? "" : r.vent.length ? `<div class="fum ok">✅ <b>${cuando}:</b> de ${txtVent(r.vent)}</div>`
    : `<div class="fum no">⛔ <b>${cuando}:</b> ${cuando === "Hoy" && !r.fallas.length ? "ya no quedan horas buenas" : "sin un buen momento"}${r.fallas.length ? ` (${r.fallas.slice(0, 2).join("; ")})` : ""}</div>`;
  el.innerHTML = `<div class="ctit">⚠️ Hoy en el campo · ${lugar.nombre} <button class="voz" onclick="leerCampo()" title="Leer en voz alta">🔊</button></div>
    <div class="cgrid">
      <div class="cbox"><div class="cbt">Alertas de clima (7 días)</div>${alHtml}</div>
      <div class="cbox"><div class="cbt">🌿 ¿Se puede fumigar? · productos orgánicos</div>
        <select id="tipoOrg">${Object.entries(ORGANICOS).map(([k, v]) => `<option value="${k}" ${k === tipoOrg ? "selected" : ""}>${v.nombre}</option>`).join("")}</select>
        ${dFum(fh, "Hoy")}${dFum(fm, "Mañana")}
        <div class="csub">${P.nota} Sin viento fuerte (menos de 10 km/h) ni lluvia en las ${P.sinLluvia} horas siguientes. Aun siendo orgánicos, use guantes y barbijo, y respete la dosis.</div></div>
      <div class="cbox"><div class="cbt">🔥 Riesgo de incendio hoy</div>
        ${f ? `<span class="chip inc${f.n}">${f.tit}</span> <small>humedad mínima ${f.hrMin} % · ${f.seco} día${f.seco === 1 ? "" : "s"} sin lluvia${f.raf ? ` · ráfagas ${f.raf} km/h` : ""}</small><div class="csub">${f.txt}</div>` : ""}${focHtml}</div>
      <div class="cbox"><div class="cbt">🐄 Calor para el ganado</div>${gHtml}</div>
    </div>`;
  document.getElementById("tipoOrg").onchange = e => { tipoOrg = e.target.value; try { localStorage.setItem("almanaquePlusOrganico", tipoOrg); } catch (er) {} renderCampo(); };
  renderCuaderno();
}

// ---- Lectura en voz alta ------------------------------------------------------------------
function leer(texto) {
  if (!("speechSynthesis" in window)) { alert("Este teléfono no tiene lectura en voz alta."); return; }
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }   // tocar de nuevo = detener
  const limpio = texto.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ").replace(/°/g, " grados").replace(/ km\/h/g, " kilómetros por hora")
    .replace(/ mm\b/g, " milímetros").replace(/(\d+) %/g, "$1 por ciento").replace(/\s+/g, " ");
  const u = new SpeechSynthesisUtterance(limpio), voces = speechSynthesis.getVoices();
  u.voice = voces.find(v => /es[-_](BO|AR|PE|CL|MX|US|419)/i.test(v.lang)) || voces.find(v => v.lang.startsWith("es")) || null;
  u.lang = u.voice ? u.voice.lang : "es-ES"; u.rate = 0.95;
  speechSynthesis.speak(u);
}
const leerCampo = () => leer(document.getElementById("hoy").innerText + ". " + document.getElementById("campo").innerText);
const leerFicha = () => leer(document.getElementById("fichaCont").innerText);
