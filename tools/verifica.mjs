/**
 * verifica.mjs
 *
 * Controllo complessivo del sito: una sola passata che rifà, in un colpo, i
 * controlli tenuti finora a mano — ancore, id doppi, misure delle tavole,
 * contrassegno di versione, residui di lavorazione, coerenza della testata
 * fra le tre pagine, e coerenza fra l'indirizzo pubblico dichiarato in
 * `tools/sito.json` e ciò che lo ripete (canonical, og:url, anteprima,
 * robots.txt, sitemap.xml).
 *
 * Serve prima di pubblicare e dopo ogni modifica a mano: `index.html` e
 * `404.html` non sono generati, quindi possono scostarsi da `inferno.html`,
 * e niente se ne accorgerebbe.
 *
 * Uso:
 *   node tools/verifica.mjs
 *
 * Esce con codice 1 se c'è anche un solo errore; gli avvisi non fanno
 * fallire il controllo.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { misuraJpeg } from "./jpeg.mjs";
import { PAGINE as PAGINE_MAPPATE, PUBBLICO, assoluto, indirizzoDi } from "./sito.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGINE = ["index.html", "inferno.html", "404.html"];

/* Caratteri disegnati dal carattere emoji del sistema: forma e colori diversi
   su ogni macchina, e sordi al tema della pagina. Nel sito sono stati
   sostituiti da sagome SVG; questo controllo li tiene fuori. */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2705}\u{2728}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2795}-\u{2797}\u{27B0}\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;

let errori = 0;
let avvisi = 0;

const kb = (byte) => `${Math.round(byte / 1024)} KB`;

/** Tutte le pagine in un solo testo: serve a sapere se una tavola è mostrata. */
function htmlDiTutteLePagine() {
  return PAGINE.filter((nome) => existsSync(join(ROOT, nome)))
    .map((nome) => readFileSync(join(ROOT, nome), "utf8"))
    .join("\n");
}

function sezione(titolo) {
  console.log(`\n${titolo}`);
}

/** Una verifica andata a buon fine. */
function ok(messaggio) {
  console.log(`  ✓ ${messaggio}`);
}

/**
 * Una verifica fallita. `grave` distingue l'errore (fa uscire con 1) dal
 * semplice avviso: le tavole ancora sotto la loro risoluzione nativa, per
 * esempio, non impediscono di pubblicare.
 */
function ko(messaggio, dettagli = [], grave = true) {
  if (grave) errori++;
  else avvisi++;
  console.log(`  ${grave ? "✗" : "!"} ${messaggio}`);
  for (const riga of dettagli.slice(0, 12)) console.log(`      ${riga}`);
  if (dettagli.length > 12) console.log(`      … e altri ${dettagli.length - 12}`);
}

/** Attributi di un tag, letti come mappa. Bastano per src, alt, width, height. */
function attributi(tag) {
  const mappa = new Map();
  for (const m of tag.matchAll(/([a-zA-Z0-9:_.-]+)(?:\s*=\s*"([^"]*)")?/g)) {
    if (!mappa.has(m[1])) mappa.set(m[1], m[2] ?? "");
  }
  return mappa;
}

const versioneAttesa = (() => {
  const hash = createHash("sha1");
  for (const file of ["assets/site.css", "assets/site.js"]) {
    hash.update(readFileSync(join(ROOT, file)));
  }
  return hash.digest("hex").slice(0, 8);
})();

// ---------------------------------------------------------------------------
// Fonti: testo e incisioni
// ---------------------------------------------------------------------------

function controllaFonti() {
  sezione("Fonti");

  const mancanti = [];
  for (let n = 1; n <= 34; n++) {
    const file = join(ROOT, "tools", "cache", `canto_${n}.txt`);
    if (!existsSync(file)) mancanti.push(`tools/cache/canto_${n}.txt`);
  }
  if (mancanti.length) ko("canti mancanti nel deposito dei wikitext", mancanti);
  else ok("34 canti presenti in tools/cache");

  /* Il nome del file non è scritto nel catalogo: si ricava dal canto e
     dall'ordine, con la stessa regola dello script di build. */
  const catalogo = JSON.parse(readFileSync(join(ROOT, "tools", "dore-plates.json"), "utf8"));
  const metadati = JSON.parse(readFileSync(join(ROOT, "tools", "dore-fetch.json"), "utf8"));
  const contatore = new Map();
  const tavole = catalogo.map((voce) => {
    const i = contatore.get(voce.canto) || 0;
    contatore.set(voce.canto, i + 1);
    const file = `canto-${String(voce.canto).padStart(2, "0")}-${i + 1}.jpg`;
    return { ...voce, file, meta: metadati[file] || null };
  });
  const assenti = [];
  const troncate = [];
  for (const t of tavole) {
    const percorso = join(ROOT, "assets", "dore", t.file);
    if (!existsSync(percorso)) {
      assenti.push(t.file);
      continue;
    }
    if (!misuraJpeg(percorso).completo) troncate.push(t.file);
  }
  if (assenti.length) ko("tavole elencate ma assenti su disco", assenti);
  else ok(`${tavole.length} tavole elencate, tutte presenti`);

  if (troncate.length) ko("tavole interrotte a metà scaricamento", troncate);
  else ok("nessuna tavola troncata");

  const senzaMetadati = tavole.filter((t) => !t.meta);
  if (senzaMetadati.length) ko("tavole senza metadati in dore-fetch.json", senzaMetadati.map((t) => t.file));
  else ok("ogni tavola ha i suoi metadati (autore, licenza, misure)");

  /* Le tavole ancora alla misura della miniatura: non è un errore, ma è la
     prima cosa da guardare se le incisioni sembrano impastate. */
  const piccole = [];
  for (const t of tavole) {
    const percorso = join(ROOT, "assets", "dore", t.file);
    if (!existsSync(percorso)) continue;
    const { larghezza } = misuraJpeg(percorso);
    const nativa = Number(t.meta?.larg || t.meta?.larghezza || 0);
    /* Sotto del 5% è arrotondamento: conta solo ciò che si vede. */
    if (nativa && larghezza < nativa * 0.95) {
      piccole.push(`${t.file}: ${larghezza} px su ${nativa} px nativi`);
    }
  }
  if (piccole.length) {
    ko(`${piccole.length} tavole molto sotto la loro risoluzione nativa`, piccole, false);
    console.log("      → node tools/fetch-dore.mjs --migliora");
  } else {
    ok("tutte le tavole alla risoluzione nativa");
  }

  return { tavole, metadati };
}

// ---------------------------------------------------------------------------
// Pagine
// ---------------------------------------------------------------------------

/** Testo letterale di un blocco delimitato da due stringhe. */
function fra(html, inizio, fine) {
  const da = html.indexOf(inizio);
  if (da < 0) return "";
  const a = html.indexOf(fine, da);
  return a < 0 ? "" : html.slice(da, a + fine.length);
}

function controllaPagina(nome) {
  const percorso = join(ROOT, nome);
  if (!existsSync(percorso)) {
    ko(`${nome}: assente`);
    return;
  }
  const html = readFileSync(percorso, "utf8");
  const problemi = [];

  // --- Struttura del documento ---
  for (const [cosa, testa] of [
    ["dichiarazione del tipo", "<!DOCTYPE html>"],
    ["lingua della pagina", '<html lang="it"'],
    ["codifica dei caratteri", 'charset="UTF-8"'],
    ["adattamento allo schermo", 'name="viewport"'],
    ["titolo", "<title>"],
    ["descrizione", 'name="description"'],
    ["indirizzo dell'icona", 'rel="icon"'],
    ["foglio di stile", "assets/site.css?v="],
    ["copione", "assets/site.js?v="],
  ]) {
    if (!html.includes(testa)) problemi.push(`manca ${cosa} (${testa})`);
  }

  const titoli = [...html.matchAll(/<h1[\s>]/g)].length;
  if (titoli !== 1) problemi.push(`${titoli} intestazioni di primo livello (ne serve una)`);

  // --- Contrassegno di versione degli asset condivisi ---
  for (const file of ["site.css", "site.js"]) {
    const atteso = `assets/${file}?v=${versioneAttesa}`;
    if (!html.includes(atteso)) problemi.push(`contrassegno di versione non allineato: serve ${atteso}`);
  }

  // --- Identificatori unici ---
  const id = new Set();
  const doppi = new Set();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) {
    if (id.has(m[1])) doppi.add(m[1]);
    id.add(m[1]);
  }
  if (doppi.size) problemi.push(`identificatori ripetuti: ${[...doppi].join(", ")}`);

  // --- Collegamenti e risorse ---
  const ancoreRotte = [];
  const fileRotti = [];
  const destinazioni = [];
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const valore = m[1];
    /* Fuori dal sito (collegamenti esterni, posta, dati in linea) e campi
       vuoti: qui si guarda solo ciò che deve esistere fra queste cartelle. */
    if (!valore || /^(?:https?:|mailto:|tel:|data:|javascript:)/.test(valore)) continue;

    if (valore === "#") {
      problemi.push('c\'è un collegamento vuoto (href="#")');
      continue;
    }
    if (valore.startsWith("#")) {
      if (!id.has(valore.slice(1))) ancoreRotte.push(valore);
      continue;
    }
    const [conFrammento, frammento] = valore.split("#");
    /* Il contrassegno di versione ("?v=…") non fa parte del nome del file. */
    const pagina = conFrammento.split("?")[0];
    if (pagina && !existsSync(join(ROOT, pagina))) {
      fileRotti.push(valore);
      continue;
    }
    if (!pagina && frammento) {
      destinazioni.push([nome, frammento]);
      continue;
    }
    if (frammento && pagina) destinazioni.push([pagina, frammento]);
  }
  if (ancoreRotte.length) problemi.push(`ancore interne senza destinazione: ${ancoreRotte.join(", ")}`);
  if (fileRotti.length) problemi.push(`file collegati ma assenti: ${fileRotti.join(", ")}`);

  // --- Immagini: didascalia alternativa e misure dichiarate ---
  const immaginiSenzaAlt = [];
  const misureSbagliate = [];
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const a = attributi(m[0]);
    const src = a.get("src") || "";
    if (!a.has("alt")) {
      immaginiSenzaAlt.push(src || m[0].slice(0, 60));
      continue;
    }
    if (!src || src.includes("?") || !src.startsWith("assets/")) continue;
    const file = join(ROOT, src);
    if (!existsSync(file)) {
      problemi.push(`immagine assente: ${src}`);
      continue;
    }
    const dichiarati = [a.get("width"), a.get("height")];
    if (dichiarati.some((v) => !v)) continue;
    const reale = misuraJpeg(file);
    if (dichiarati[0] !== String(reale.larghezza) || dichiarati[1] !== String(reale.altezza)) {
      misureSbagliate.push(
        `${src}: dichiarate ${dichiarati[0]}×${dichiarati[1]}, reali ${reale.larghezza}×${reale.altezza}`
      );
    }
  }
  if (immaginiSenzaAlt.length) problemi.push(`immagini senza alt: ${immaginiSenzaAlt.join(", ")}`);
  if (misureSbagliate.length) problemi.push(...misureSbagliate);

  // --- Indirizzo pubblico: canonico, og:url, anteprima ---
  /* I sistemi di condivisione non sanno risolvere un indirizzo relativo, e
     due pagine che si dichiarano canoniche a vicenda si annullano: qui si
     pretende che tutti ripetano l'indirizzo di `tools/sito.json`. Una pagina
     che si dichiara `noindex` invece non deve averne alcuno. */
  const canonico = html.match(/<link rel="canonical" href="([^"]+)"/);
  const ogUrl = html.match(/property="og:url"\s+content="([^"]+)"/);
  const anteprima = html.match(/property="og:image"\s+content="([^"]+)"/);
  const atteso = indirizzoDi(nome);
  const esclusa = /name="robots"[^>]*noindex/.test(html);

  if (esclusa) {
    if (canonico) problemi.push("pagina esclusa dai motori con un indirizzo canonico: è una contraddizione");
  } else {
    if (canonico?.[1] !== atteso) {
      problemi.push(`indirizzo canonico «${canonico?.[1] ?? "assente"}», ne serve uno: ${atteso}`);
    }
    if (ogUrl?.[1] !== atteso) {
      problemi.push(`og:url «${ogUrl?.[1] ?? "assente"}», ne serve uno: ${atteso}`);
    }
    if (!anteprima) {
      problemi.push("manca l'immagine di anteprima (og:image)");
    } else if (!anteprima[1].startsWith(PUBBLICO)) {
      problemi.push(`og:image deve cominciare con ${PUBBLICO}: ${anteprima[1]}`);
    } else if (!existsSync(join(ROOT, anteprima[1].slice(PUBBLICO.length)))) {
      problemi.push(`og:image assente dal deposito: ${anteprima[1]}`);
    }
  }

  // --- Dati strutturati ---
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      problemi.push(`JSON-LD illeggibile: ${e.message}`);
    }
  }

  // --- Residui di lavorazione ---
  const emoji = [...new Set(html.match(EMOJI) || [])];
  if (emoji.length) problemi.push(`caratteri emoji (li disegna il sistema, non il tema): ${emoji.join(" ")}`);
  if (html.includes("{{") || html.includes("}}")) problemi.push("residui di markup wikitext");
  if (html.includes("127.0.0.1")) problemi.push("indirizzo di prova rimasto nella pagina");

  // --- Testata: è la parte copiata a mano fra una pagina e l'altra ---
  const marchio = fra(html, '<a href="index.html" class="logo">', "</a>");
  const tema = fra(html, '<button type="button" class="controllo" data-azione="tema"', "</button>");

  if (problemi.length) ko(`${nome} — ${problemi.length} da sistemare`, problemi);
  else ok(`${nome} — struttura, collegamenti, immagini e dati strutturati a posto`);

  return { id, destinazioni, marchio, tema };
}

// ---------------------------------------------------------------------------
// Indirizzo pubblico e file per i motori di ricerca
// ---------------------------------------------------------------------------

function controllaSeo() {
  const problemi = [];
  const leggi = (nome) => {
    const percorso = join(ROOT, nome);
    return existsSync(percorso) ? readFileSync(percorso, "utf8") : null;
  };

  const robots = leggi("robots.txt");
  const mappa = leggi("sitemap.xml");

  if (!robots) problemi.push("robots.txt assente (lo scrive node tools/build-inferno.mjs)");
  else if (!robots.includes(`Sitemap: ${assoluto("sitemap.xml")}`)) {
    problemi.push(`robots.txt non rimanda a ${assoluto("sitemap.xml")}`);
  }

  if (!mappa) problemi.push("sitemap.xml assente (la scrive node tools/build-inferno.mjs)");

  /* Ogni pagina elencata deve esistere, e ogni pagina del sito che non è
     esclusa dai motori deve comparire. */
  for (const { file } of PAGINE_MAPPATE) {
    if (!existsSync(join(ROOT, file))) {
      problemi.push(`${file} è nella mappa del sito ma non esiste`);
    }
    if (mappa && !mappa.includes(`<loc>${indirizzoDi(file)}</loc>`)) {
      problemi.push(`sitemap.xml non elenca ${indirizzoDi(file)}`);
    }
  }
  for (const nome of PAGINE) {
    const percorso = join(ROOT, nome);
    if (!existsSync(percorso)) continue;
    const esclusa = /name="robots"[^>]*noindex/.test(readFileSync(percorso, "utf8"));
    const elencata = (mappa || "").includes(`<loc>${indirizzoDi(nome)}</loc>`);
    const prevista = PAGINE_MAPPATE.some((p) => p.file === nome);
    if (esclusa && elencata) problemi.push(`${nome} si dichiara noindex ma compare nella mappa del sito`);
    if (!esclusa && !prevista) problemi.push(`${nome} non è elencata nella mappa del sito`);
  }

  /* La data di ciascuna voce: una mappa del sito ferma al giorno sbagliato è
     peggio di una senza date. Una data *indietro* rispetto al file è un
     errore — i motori crederebbero vecchia una pagina aggiornata. Una data
     *avanti* invece è normale su un deposito appena scaricato, dove i file
     portano la data del prelievo: quella è un avviso, non un guasto. */
  const dateIndietro = [];
  const dateAvanti = [];
  for (const m of (mappa || "").matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) {
    const file = m[1].slice(PUBBLICO.length) || "index.html";
    const percorso = join(ROOT, file);
    if (!existsSync(percorso)) continue;
    const data = statSync(percorso).mtime;
    const due = (n) => String(n).padStart(2, "0");
    const reale = `${data.getFullYear()}-${due(data.getMonth() + 1)}-${due(data.getDate())}`;
    if (m[2] === reale) continue;
    const riga = `${file}: dichiarata ${m[2]}, la pagina è del ${reale}`;
    (m[2] < reale ? dateIndietro : dateAvanti).push(riga);
  }
  if (dateIndietro.length) problemi.push(...dateIndietro);
  if (dateAvanti.length) {
    ko("la mappa del sito dichiara date più recenti dei file (normale su un deposito appena scaricato)", dateAvanti, false);
  }

  if (problemi.length) ko("indirizzo pubblico incoerente fra pagine e file per i motori", problemi);
  else ok(`canonical, anteprima, robots.txt e sitemap.xml concordano su ${PUBBLICO}`);
}

// ---------------------------------------------------------------------------
// Classi: scritte nel foglio di stile e mai usate, o usate e mai scritte
// ---------------------------------------------------------------------------

/**
 * Un nome di classe sbagliato non fa rumore: un `<li class="indcie">` si
 * disegna e basta, e non se ne accorge nessuno. Qui si confrontano i nomi del
 * foglio di stile con quelli che le pagine e gli script nominano davvero, nei
 * due sensi. Sono avvisi e non errori: una classe può servire a un copione
 * esterno al deposito, o essere una predisposizione voluta.
 */
function controllaClassi() {
  /* Indirizzi e dati in linea contengono punti che sembrano selettori
     (…/w3.org/2000/svg): si tolgono prima di cercare. */
  const css = readFileSync(join(ROOT, "assets", "site.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/url\([^)]*\)/g, "")
    .replace(/https?:\/\/\S*/g, "");

  const nominateDalCss = new Set();
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) nominateDalCss.add(m[1]);

  const nominateNelDocumento = new Set();
  const daLeggere = [
    ...PAGINE.filter((nome) => existsSync(join(ROOT, nome))).map((nome) => readFileSync(join(ROOT, nome), "utf8")),
    readFileSync(join(ROOT, "assets", "site.js"), "utf8"),
    readFileSync(join(ROOT, "tools", "build-inferno.mjs"), "utf8"),
  ];
  for (const testo of daLeggere) {
    /* class="…", className = "…" e classList.add("…") sono i tre modi in cui
       questo progetto nomina una classe. */
    for (const m of testo.matchAll(/class(?:Name)?\s*=\s*"([^"]*)"/g)) {
      for (const c of m[1].split(/\s+/)) if (c) nominateNelDocumento.add(c);
    }
    for (const m of testo.matchAll(/classList\.(?:add|remove|toggle|contains)\("([\w-]+)"/g)) {
      nominateNelDocumento.add(m[1]);
    }
    for (const m of testo.matchAll(/classList\.(?:add|remove|toggle)\(\s*"([\w-]+)"/g)) {
      nominateNelDocumento.add(m[1]);
    }
  }

  const maiUsate = [...nominateDalCss].filter((c) => !nominateNelDocumento.has(c)).sort();
  const maiScritte = [...nominateNelDocumento].filter((c) => !nominateDalCss.has(c)).sort();

  if (maiUsate.length) {
    ko("classi del foglio di stile che nessuna pagina nomina", maiUsate, false);
  } else {
    ok("nessuna classe del foglio di stile lasciata indietro");
  }
  if (maiScritte.length) {
    ko("classi usate nelle pagine ma assenti dal foglio di stile", maiScritte, false);
  } else {
    ok("ogni classe nominata dalle pagine esiste nel foglio di stile");
  }
}

// ---------------------------------------------------------------------------
// Tavole: file presenti ma mai mostrati
// ---------------------------------------------------------------------------

function controllaOrfane(tavole, htmlDiTutte) {
  /* Le tavole sono 54 e pesano 12 MB: un file che nessuna pagina mostra è
     peso morto nel deposito, e nessuno se ne accorgerebbe. */
  const orfane = tavole
    .map((t) => t.file)
    .filter((file) => !htmlDiTutte.includes(`assets/dore/${file}`));
  if (orfane.length) ko("tavole presenti su disco ma non mostrate da nessuna pagina", orfane, false);
  else ok("nessuna tavola orfana in assets/dore");

  /* Il rovescio: file rimasti nel deposito senza essere elencati da nessuno,
     che finirebbero pubblicati senza comparire in nessuna pagina. */
  const fuoriCatalogo = readdirSync(join(ROOT, "assets", "dore")).filter(
    (f) => f.endsWith(".jpg") && !tavole.some((t) => t.file === f)
  );
  if (fuoriCatalogo.length) ko("file in assets/dore fuori dal catalogo", fuoriCatalogo, false);
}

// ---------------------------------------------------------------------------

function main() {
  console.log("Controllo del sito — Esplorando l'Inferno di Dante");

  const { tavole } = controllaFonti();

  sezione("Pagine");
  const letti = new Map();
  for (const nome of PAGINE) {
    const risultato = controllaPagina(nome);
    if (risultato) letti.set(nome, risultato);
  }

  /* Le destinazioni fra pagine si controllano solo ora, che tutti gli id sono
     noti: è il caso di index.html → inferno.html#canto-21. */
  sezione("Rinvii fra le pagine");
  const rotte = [];
  for (const [partenza, destinazioni] of letti) {
    for (const [pagina, frammento] of destinazioni.destinazioni) {
      const destinazione = letti.get(pagina);
      if (!destinazione || !destinazione.id.has(frammento)) {
        rotte.push(`${partenza} → ${pagina}#${frammento}`);
      }
    }
  }
  if (rotte.length) ko("rinvii senza destinazione", rotte);
  else ok("ogni rinvio fra le pagine trova la sua destinazione");

  /* Testata identica: le tre pagine la ripetono, due la ripetono a mano. */
  sezione("Testata condivisa");
  const impronte = [...letti].map(([nome, p]) => [nome, `${p.marchio}\u0000${p.tema}`]);
  const prima = impronte[0];
  const diverse = impronte.filter(([, testo]) => testo !== prima[1]).map(([nome]) => nome);
  if (diverse.length) {
    ko("marchio o pulsante del tema divergono fra le pagine", [prima[0], ...diverse]);
    console.log("      → allinea il blocco <header> in index.html, 404.html e nello script di build");
  } else {
    ok("marchio e pulsante del tema identici nelle tre pagine");
  }
  if (!prima[1].includes("data-etichetta-tema")) {
    ko("il pulsante del tema non ha l'etichetta nominata (data-etichetta-tema)");
  }

  sezione("Motori di ricerca");
  controllaSeo();

  sezione("Foglio di stile");
  controllaClassi();

  sezione("Tavole");
  controllaOrfane(tavole, htmlDiTutteLePagine());

  // --- Peso ---
  sezione("Peso");
  const righe = [];
  let totalePagine = 0;
  for (const nome of PAGINE) {
    if (!existsSync(join(ROOT, nome))) continue;
    const byte = statSync(join(ROOT, nome)).size;
    totalePagine += byte;
    righe.push(`${nome} ${kb(byte)}`);
  }
  const dore = readdirSync(join(ROOT, "assets", "dore"))
    .filter((f) => f.endsWith(".jpg"))
    .reduce((s, f) => s + statSync(join(ROOT, "assets", "dore", f)).size, 0);
  console.log(`  ${righe.join(" · ")}`);
  console.log(`  tavole ${(dore / 1024 / 1024).toFixed(1)} MB · pagine in tutto ${kb(totalePagine)}`);

  console.log(
    `\nEsito: ${errori} ${errori === 1 ? "errore" : "errori"}, ${avvisi} ${avvisi === 1 ? "avviso" : "avvisi"}`
  );
  process.exit(errori ? 1 : 0);
}

main();
