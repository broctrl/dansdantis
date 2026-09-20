/**
 * build-inferno.mjs
 *
 * Genera `inferno.html` — il testo integrale dell'Inferno, canto per canto —
 * a partire dai file grezzi (wikitext) salvati in `tools/cache/canto_N.txt`,
 * scaricati da Wikisource (Divina Commedia/Inferno/Canto I..XXXIV).
 *
 * Allega a ciascun canto le tavole incise da Gustave Doré, elencate in
 * `tools/dore-plates.json` (con la loro collocazione sui versi) e descritte da
 * `tools/dore-fetch.json`. Il testo è di pubblico dominio (XIV secolo); le
 * incisioni pure (1861-1892).
 *
 * Lo script non scrive nulla se la validazione non passa: numero di versi per
 * canto, forma delle terzine, assenza di residui di markup, coerenza fra
 * versi citati dalle tavole e testo.
 *
 * Uso:
 *   node tools/build-inferno.mjs            # valida e genera inferno.html
 *   node tools/build-inferno.mjs --check    # valida soltanto
 */

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { misuraJpeg } from "./jpeg.mjs";
import { PAGINE, assoluto, indirizzoDi } from "./sito.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "tools", "cache");
const USCITA = join(ROOT, "inferno.html");

/**
 * Impronta dei fogli di stile e del copione, da appendere al loro indirizzo.
 * Le due pagine si aggiornano di rado e i browser se le tengono strette: senza
 * questo contrassegno una modifica al CSS può non arrivare a chi ha già
 * visitato il sito.
 */
function versioneAsset() {
  const hash = createHash("sha1");
  for (const file of ["assets/site.css", "assets/site.js"]) {
    hash.update(readFileSync(join(ROOT, file)));
  }
  return hash.digest("hex").slice(0, 8);
}

const VERSIONE = versioneAsset();

/**
 * 4720 → «4.720». Il separatore delle migliaia non passa dai dati di
 * localizzazione di Node: `toLocaleString` restituisce il numero liscio su
 * tutte le installazioni prive del pacchetto completo delle lingue, e la
 * pagina cambierebbe a seconda della macchina che la genera.
 */
const migliaia = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const ROMAN = [
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
  "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX",
  "XXXI", "XXXII", "XXXIII", "XXXIV",
];

/** Numero di versi di ciascun canto dell'Inferno (endecasillabi). Totale: 4720. */
const VERSI_ATTESI = [
  136, 142, 136, 151, 142, 115, 130, 130, 133, 136,
  115, 139, 151, 142, 124, 136, 136, 136, 133, 130,
  139, 151, 148, 151, 151, 142, 136, 142, 139, 148,
  145, 139, 157, 139,
];

/** Luogo dell'Inferno in cui si svolge ciascun canto: compare fra i "bolli". */
const LUOGO = [
  "Antinferno", "Antinferno", "Antinferno",
  "I cerchio · Limbo", "II cerchio · Lussuria", "III cerchio · Gola",
  "IV–V cerchio · Avarizia e Ira", "V cerchio · Ira e accidia",
  "VI cerchio · Eresia", "VI cerchio · Eresia", "VI cerchio · Eresia",
  "VII cerchio · Flegetonte", "VII cerchio · Bosco dei suicidi",
  "VII cerchio · Sabbione", "VII cerchio · Sabbione", "VII cerchio · Sabbione",
  "VII cerchio · Gerione", "VIII cerchio · Malebolge",
  "VIII cerchio · Malebolge", "VIII cerchio · Malebolge", "VIII cerchio · Malebolge",
  "VIII cerchio · Malebolge", "VIII cerchio · Malebolge", "VIII cerchio · Malebolge",
  "VIII cerchio · Malebolge", "VIII cerchio · Malebolge", "VIII cerchio · Malebolge",
  "VIII cerchio · Malebolge", "VIII cerchio · Malebolge", "VIII cerchio · Malebolge",
  "VIII–IX cerchio · Pozzo dei giganti", "IX cerchio · Cocito", "IX cerchio · Cocito",
  "IX cerchio · Cocito",
];

/** Cerchi dell'Inferno: numero romano, nome e indice per i filtri dell'indice. */
const CERCHI = [
  ["I", "Limbo"], ["II", "Lussuria"], ["III", "Gola"],
  ["IV", "Avarizia"], ["V", "Ira"], ["VI", "Eresia"],
  ["VII", "Violenza"], ["VIII", "Frode"], ["IX", "Tradimento"],
];

const VALORE_ROMANO = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

/**
 * Gruppo di appartenenza di un canto, per i filtri dell'indice: «antinferno»
 * oppure il numero del cerchio. Il luogo («VIII–IX cerchio · Pozzo dei
 * giganti») si legge dal primo numero romano.
 */
function gruppoDi(numero) {
  const luogo = LUOGO[numero - 1];
  if (/antinferno/i.test(luogo)) return "antinferno";
  const romano = (luogo.match(/^([IVX]+)/) || [])[1];
  return romano && VALORE_ROMANO[romano] ? String(VALORE_ROMANO[romano]) : "tutti";
}

/**
 * Nomi, luoghi e temi di ciascun canto: servono solo alla ricerca
 * nell'indice, così che cercando «Ugolino» o «barattieri» si trovi il canto.
 */
const CHIAVI = [
  "selva oscura, tre fiere, lonza, leone, lupa, Virgilio, veltro",
  "Beatrice, Lucia, donne del cielo, proemio, invocazione alle Muse",
  "porta dell'inferno, Caronte, Acheronte, ignavi, pusillanimi, Celestino V",
  "Limbo, non battezzati, virtuosi pagani, Omero, Orazio, Ovidio, Lucano, Aristotele, Socrate, Platone, Enea, Cesare, nobile castello",
  "Minosse, Paolo e Francesca, Galeotto, Lancillotto, Didone, Cleopatra, Elena, Achille, Paride, Tristano, Semiramide, lussuriosi, bufera",
  "Cerbero, Ciacco, golosi, Firenze, Bianchi e Neri, superbia invidia avarizia",
  "Pluto, avari, prodighi, Fortuna, palude Stigia, iracondi, accidiosi, fango",
  "Flegiàs, palude Stigia, Filippo Argenti, torre, segnali, città di Dite",
  "Furie, Erinni, Medusa, messo celeste, porte di Dite, eresiarche",
  "Farinata degli Uberti, Cavalcante de' Cavalcanti, Guido Cavalcanti, Epicuro, eretici, tombe infuocate, ghibellini",
  "papa Anastasio, ordinamento dell'Inferno, contrappasso, usura, frode, violenza, matta bestialitade",
  "Minotauro, centauri, Chirone, Nesso, Flegetonte, tiranni, Alessandro, Dionisio, Attila, Obizzo d'Este",
  "Pier delle Vigne, Arpie, suicidi, scialacquatori, cagne nere, bosco, rovi",
  "Capaneo, vecchio di Creta, Veglio, sabbione, pioggia di fuoco, bestemmiatori, Bulicame",
  "Brunetto Latini, sodomiti, Tesoro, Orazio, esilio, Firenze",
  "Guido Guerra, Tegghiaio Aldobrandi, Iacopo Rusticucci, tre fiorentini, sabbione, corda, Gerione",
  "Gerione, usurai, Reginaldo degli Scrovegni, Gianni Buiamonte, burrato, Malebolge",
  "Malebolge, ruffiani, seduttori, adulatori, Venedico Caccianemico, Giasone, Alessio Interminelli, Taide, sterco",
  "simoniaci, Niccolò III, papi, avarizia ecclesiastica, oro e argento, buche",
  "indovini, Manto, Tiresia, Arunte, Anfiarao, Euripilo, Mantova, maghi, testa rivolta",
  "Malebolge, barattieri, pece bollente, Malebranche, diavoli, graffi",
  "Ciampolo di Navarra, barattieri, Malebranche, Barbariccia, pece, beffa",
  "ipocriti, cappe di piombo, frati godenti, Catalano, Loderingo, Caifàs, crocifisso in terra",
  "Vanni Fucci, ladri, serpenti, Pistoia, settima bolgia, cianfrusaglie",
  "ladri, metamorfosi, Caco, Agnolo Brunelleschi, Puccio Sciancato, serpi, Lucano, Ovidio",
  "Ulisse, Diomede, cavallo di Troia, folle volo, colonne d'Ercole, consiglieri fraudolenti, fiamme",
  "Guido da Montefeltro, Bonifacio VIII, falsi consiglieri, Romagna, assoluzione",
  "Maometto, Alì, Pier da Medicina, Bertran de Born, seminatori di discordia, Curione, Mosca dei Lamberti",
  "falsari, alchimisti, Gerì del Bello, Griffolino d'Arezzo, Capocchio, lebbrosi, scabbia",
  "Gianni Schicchi, Capocchio, maestro Adamo, Mirra, falsificatori di persona, idropisia",
  "giganti, Nembròt, Fialte, Briareo, Efialte, Anteo, pozzo, torre di Babele",
  "Cocito, Caina, Antenora, Bocca degli Abati, traditori dei parenti, traditori della patria, ghiaccio",
  "Ugolino, Ruggieri, torre della fame, Tolomea, Branca Doria, frate Alberigo, traditori degli ospiti",
  "Lucifero, Giuda, Bruto, Cassio, Giudecca, Cocito, centro della terra, stelle, risalita",
];

/** Tavole di Doré, indicizzate per canto. */
function caricaTavole() {
  const catalogo = JSON.parse(readFileSync(join(ROOT, "tools", "dore-plates.json"), "utf8"));
  let metadati = {};
  const fileMeta = join(ROOT, "tools", "dore-fetch.json");
  if (existsSync(fileMeta)) metadati = JSON.parse(readFileSync(fileMeta, "utf8"));

  const contatore = new Map();
  return catalogo.map((voce) => {
    const i = contatore.get(voce.canto) || 0;
    contatore.set(voce.canto, i + 1);
    const nome = `canto-${String(voce.canto).padStart(2, "0")}-${i + 1}.jpg`;
    return { ...voce, file: nome, immagine: `assets/dore/${nome}`, meta: metadati[nome] || null };
  });
}

// ---------------------------------------------------------------------------
// Pulizia del wikitext
// ---------------------------------------------------------------------------

/** Rimuove i template di servizio mantenendo, dove serve, il testo visibile. */
function pulisciVerso(testo) {
  let t = testo;

  // {{§§/Tc|ancora|verso citato|opera|pagina}}: tiene il verso, scarta la nota.
  t = t.replace(/\{\{§§\/Tc\|([^{}]*?)\}\}/g, (_m, dentro) => {
    const campi = dentro.split("|");
    return campi.length >= 2 ? campi[1] : "";
  });

  // Marcatori del numero di verso ({{R|6}}, {{r|33}}): ridondanti, li ricalcolo io.
  t = t.replace(/\{\{[Rr]\|\d+\}\}/g, "");

  // {{Ac|Autore|Nome mostrato}} -> "Nome mostrato"; {{AutoreCitato|...|...}} idem.
  t = t.replace(/\{\{[Aa]utoreCitato\|([^|}]*)\|([^|}]*)\}\}/g, "$2");
  t = t.replace(/\{\{[Aa]c\|([^|}]*)\|([^|}]*)\}\}/g, "$2");

  // Collegamenti wiki: [[Pagina|etichetta]] -> "etichetta"; [[Pagina]] -> "Pagina".
  t = t.replace(/\[\[[^\[\]]*\|([^\[\]]*)\]\]/g, "$1");
  t = t.replace(/\[\[([^\[\]]*)\]\]/g, "$1");

  // {{§|ancora}} -> ""  e  {{§|ancora|testo}} -> "testo".
  // I template possono essere annidati: si risolvono dal più interno al più esterno.
  let prima;
  do {
    prima = t;
    t = t.replace(/\{\{§\|([^{}]*?)\}\}/g, (_m, dentro) => {
      const taglio = dentro.indexOf("|");
      return taglio === -1 ? "" : dentro.slice(taglio + 1);
    });
  } while (t !== prima);

  // Avanzi di markup HTML rimasti nel testo.
  t = t.replace(/<\/?span[^>]*>/g, "");
  t = t.replace(/<!--[\s\S]*?-->/g, "");

  // Refusi tipografici di Wikisource: apostrofo dritto invece di ’.
  t = t.replace(/'/g, "’");

  // Spazi doppi residui della rimozione dei template.
  t = t.replace(/ {2,}/g, " ");

  return t;
}

/** Trasforma il testo di un canto nel suo modello strutturato. */
function analizza(numero, grezzo) {
  const poemMatch = grezzo.match(/<poem>([\s\S]*?)<\/poem>/);
  if (!poemMatch) throw new Error(`Canto ${numero}: blocco <poem> non trovato`);

  // Argomento del canto: la riga in corsivo prima del <poem>. Va ripulita come
  // il corpo: nel wikitext contiene wlink e template ({{AutoreCitato|…|Virgilio}})
  // che altrimenti comparirebbero tali e quali in pagina.
  const testa = grezzo.slice(0, poemMatch.index);
  const argomento = pulisciVerso((testa.match(/''([\s\S]+?)''/) || [, ""])[1].trim());

  const corpo = pulisciVerso(poemMatch[1]);

  // Ogni terzina (o gruppo finale di versi) è separata da una riga vuota.
  const strofe = corpo
    .split(/\n\s*\n/)
    .map((blocco) =>
      blocco
        .split("\n")
        .map((riga) => riga.trim())
        .filter((riga) => riga.length > 0),
    )
    .filter((strofa) => strofa.length > 0);

  const versi = strofe.flat();

  // Numero del primo e dell'ultimo verso di ogni strofa: ogni strofa diventa
  // una terzina con un proprio indirizzo (#c5v100), a cui rimandano le tavole.
  const inizi = [];
  const fini = [];
  let contatore = 0;
  for (const strofa of strofe) {
    inizi.push(contatore + 1);
    contatore += strofa.length;
    fini.push(contatore);
  }

  return { numero, argomento, strofe, versi, inizi, fini };
}

/** La terzina che contiene un certo verso: quella che comincia più vicino. */
function terzinaDi(canto, verso) {
  let indice = 0;
  canto.inizi.forEach((inizio, i) => {
    if (inizio <= verso) indice = i;
  });
  return indice;
}

// ---------------------------------------------------------------------------
// Lettura delle immagini
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Validazione
// ---------------------------------------------------------------------------

function valida(canti, tavole) {
  let errori = 0;
  let totale = 0;

  for (const canto of canti) {
    const attesi = VERSI_ATTESI[canto.numero - 1];
    const trovati = canto.versi.length;
    totale += trovati;

    if (trovati !== attesi) {
      console.error(`  ✗ Canto ${canto.numero}: ${trovati} versi, attesi ${attesi}`);
      errori++;
    }
    if (!canto.argomento) {
      console.error(`  ✗ Canto ${canto.numero}: argomento mancante`);
      errori++;
    }
    if (/\{\{|\}\}|\[\[|\]\]|<\/?[a-z]/i.test(canto.argomento)) {
      console.error(`  ✗ Canto ${canto.numero}: markup residuo nell'argomento -> ${canto.argomento.slice(0, 80)}`);
      errori++;
    }

    // Le strofe devono essere terzine, tranne eventualmente l'ultima.
    canto.strofe.forEach((s, i) => {
      const ultima = i === canto.strofe.length - 1;
      if (!ultima && s.length !== 3) {
        console.error(`  ✗ Canto ${canto.numero}, strofa ${i + 1}: ${s.length} versi (3 attesi)`);
        errori++;
      }
    });

    // Nessun residuo di markup, di apostrofo dritto o di spazio doppio.
    for (const verso of canto.versi) {
      if (/\{\{|\}\}|\[\[|\]\]|<\/?[a-z]/i.test(verso)) {
        console.error(`  ✗ Canto ${canto.numero}: markup residuo -> ${verso.slice(0, 80)}`);
        errori++;
      }
      if (/\s{2,}|^\s|\s$/.test(verso)) {
        console.error(`  ✗ Canto ${canto.numero}: spaziatura anomala -> ${JSON.stringify(verso.slice(0, 80))}`);
        errori++;
      }
      if (verso.includes("'")) {
        console.error(`  ✗ Canto ${canto.numero}: apostrofo dritto -> ${verso.slice(0, 80)}`);
        errori++;
      }
    }
  }

  if (totale !== 4720) {
    console.error(`  ✗ Versi totali: ${totale} (attesi 4720)`);
    errori++;
  }

  // Tavole: file presenti, versi coerenti con il testo, didascalie scritte.
  for (const tavola of tavole) {
    const canto = canti[tavola.canto - 1];
    if (!canto) {
      console.error(`  ✗ Tavola ${tavola.file}: canto ${tavola.canto} inesistente`);
      errori++;
      continue;
    }
    const percorso = join(ROOT, tavola.immagine);
    if (!existsSync(percorso) || statSync(percorso).size < 1024) {
      console.error(`  ✗ Tavola ${tavola.file}: file mancante (${tavola.titolo})`);
      errori++;
    } else {
      try {
        const m = misuraJpeg(percorso);
        if (!m.larghezza || !m.altezza) {
          console.error(`  ✗ Tavola ${tavola.file}: immagine illeggibile`);
          errori++;
        } else if (!m.completo) {
          console.error(`  ✗ Tavola ${tavola.file}: JPEG troncato`);
          errori++;
        } else {
          tavola.misure = m;
        }
      } catch (e) {
        console.error(`  ✗ Tavola ${tavola.file}: ${e.message}`);
        errori++;
      }
    }
    if (!tavola.didascalia || tavola.didascalia.length < 12) {
      console.error(`  ✗ Tavola ${tavola.file}: didascalia assente o troppo breve`);
      errori++;
    }
    if (tavola.verso !== null) {
      const fine = tavola.fine || tavola.verso;
      if (tavola.verso < 1 || fine < tavola.verso || fine > canto.versi.length) {
        console.error(
          `  ✗ Tavola ${tavola.file}: versi ${tavola.verso}-${fine} fuori dal canto ${tavola.canto} (${canto.versi.length} versi)`,
        );
        errori++;
      }
      // La citazione si aggancia a terzine intere: dal primo verso della
      // terzina che contiene l'inizio al verso finale di quella che contiene la fine.
      tavola.terzina = canto.inizi[terzinaDi(canto, tavola.verso)];
      tavola.citazioneFine = canto.fini[terzinaDi(canto, fine)];
      if (!canto.inizi.includes(tavola.terzina) || tavola.citazioneFine < tavola.terzina) {
        console.error(`  ✗ Tavola ${tavola.file}: terzine non individuate per i versi ${tavola.verso}-${fine}`);
        errori++;
      }
      if (tavola.citazioneFine !== fine) {
        console.log(
          `  · tavola ${tavola.file}: citazione estesa alla terzina intera (${tavola.terzina}-${tavola.citazioneFine}, da ${tavola.verso}-${fine})`,
        );
      }
    }
  }

  // Ogni tavola deve avere un'immagine scaricata con i suoi metadati.
  for (const tavola of tavole) {
    if (!tavola.meta) {
      console.error(`  ✗ Tavola ${tavola.file}: metadati assenti (esegui node tools/fetch-dore.mjs)`);
      errori++;
    }
  }

  const cantiConTavole = new Set(tavole.map((t) => t.canto)).size;
  const senzaTavole = canti.filter((c) => !tavole.some((t) => t.canto === c.numero));

  console.log(`Validazione:`);
  console.log(`  versi totali: ${totale} (attesi 4720)`);
  console.log(`  tavole: ${tavole.length} su ${cantiConTavole} canti`);
  console.log(
    `  canti senza tavola: ${senzaTavole.length ? senzaTavole.map((c) => ROMAN[c.numero - 1]).join(", ") : "nessuno"}`,
  );
  console.log(`  errori: ${errori}`);
  return errori === 0;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Riferimento critico in forma breve: Inf. V, 134–135. */
const riferimento = (numero, da, a) =>
  `Inf. ${ROMAN[numero - 1]}, ${da === a ? da : `${da}–${a}`}`;

/** Prima terzina di ogni canto, per l'indice e la ricerca. */
function incipitDi(canto) {
  return canto.versi[0].replace(/[«»"]/g, "").trim();
}

/**
 * Testo dei versi richiamati da una tavola, con i numeri di verso:
 * serve a mostrare che cosa illustra l'incisione.
 */
function rendiVersiIllustrati(canto, tavola) {
  if (tavola.verso === null) return "";
  const righe = [];
  for (let v = tavola.terzina; v <= tavola.citazioneFine; v++) {
    righe.push(`            <span>${v}. ${esc(canto.versi[v - 1])}</span>`);
  }
  return `\n          <span class="tavola-versi">\n${righe.join("\n")}\n          </span>`;
}

function rendiTavola(canto, tavola) {
  const meta = tavola.meta || {};
  // L'etichetta indica il passo citato per esteso (terzine intere).
  const versi = tavola.verso === null ? "" : riferimento(tavola.canto, tavola.terzina, tavola.citazioneFine);
  const credito = [
    meta.artista && meta.artista.startsWith("Gustave") ? "Gustave Doré" : meta.artista,
    meta.data || "",
    "pubblico dominio · Wikimedia Commons",
  ]
    .filter(Boolean)
    .join(", ");
  const collegamento =
    tavola.verso === null
      ? ""
      : `\n          <a class="tavola-rimando" data-vai-a-verso="c${tavola.canto}v${tavola.terzina}" href="#c${tavola.canto}v${tavola.terzina}">Leggi la terzina →</a>`;
  const misure = tavola.misure || { larghezza: 960, altezza: 1200 };
  return `        <figure class="tavola da-comparire">
          <button type="button" class="tavola-immagine" data-scheletro data-tavola
                  data-didascalia="${esc(tavola.didascalia)}"
                  data-versi="${esc(versi)}"
                  data-credito="${esc(credito)}">
            <img src="${tavola.immagine}" alt="${esc(tavola.didascalia)}" loading="lazy" decoding="async"
                 width="${misure.larghezza}" height="${misure.altezza}">
          </button>
          <figcaption>
            <strong>${versi ? `${versi} — tavola di Doré` : "Tavola di Doré"}</strong>
            ${esc(tavola.didascalia)}${rendiVersiIllustrati(canto, tavola)}${collegamento}
          </figcaption>
        </figure>`;
}

/** HTML delle strofe di un canto, con numerazione dei versi ogni terzina. */
function rendiStrofe(canto) {
  let verso = 0;
  return canto.strofe
    .map((strofa) => {
      const primo = verso + 1;
      const righe = strofa.map((riga, i) => {
        verso++;
        // Il numero del verso compare solo in fondo a ogni terzina, come nelle edizioni a stampa.
        const numero = i === strofa.length - 1 ? `<span class="vnum">${verso}</span>` : "";
        return `<span class="v">${numero}${esc(riga)}</span>`;
      });
      /* Il rimando critico («Inf. I, 4–6») non sta scritto qui: lo ricava lo
         script dalla coppia di numeri che segue, esattamente come faceva
         questa riga. Scriverlo anche nel documento erano 60 KB di testo
         ripetuto — il 7% di questa pagina — e due copie da tenere d'accordo. */
      return `          <p class="terzina" id="c${canto.numero}v${primo}"
             data-canto="${canto.numero}" data-verso="${primo}" data-verso-fine="${verso}">
            ${righe.join("\n            ")}
          </p>`;
    })
    .join("\n");
}

function rendiCanto(canto, precedente, successivo, tavoleDelCanto) {
  const num = ROMAN[canto.numero - 1];
  const colonna = tavoleDelCanto.length
    ? `
        <aside class="canto-colonna" aria-label="Tavole di Gustave Doré per il canto ${num}">
${tavoleDelCanto.map((t) => rendiTavola(canto, t)).join("\n")}
        </aside>`
    : `
        <aside class="canto-colonna">
          <p class="avviso">
            Per questo canto la serie dell'Inferno non comprende una tavola di Doré:
            le incisioni del 1861 coprono trentuno dei trentaquattro canti.
          </p>
        </aside>`;

  const nav =
    (precedente
      ? `<a data-nav-canto="canto-${precedente}" href="#canto-${precedente}">← Canto ${ROMAN[precedente - 1]}</a>`
      : `<a href="index.html">← Home</a>`) +
    `\n            <a href="#indice">↑ Indice dei canti</a>\n            ` +
    (successivo
      ? `<a data-nav-canto="canto-${successivo}" href="#canto-${successivo}">Canto ${ROMAN[successivo - 1]} →</a>`
      : `<a href="index.html">Torna al sito →</a>`);

  return `      <article class="canto" id="canto-${canto.numero}">
        <header class="canto-testa">
          <p class="canto-luogo">${LUOGO[canto.numero - 1]}</p>
          <h2>Canto ${num}<em>${esc(incipitDi(canto))}</em></h2>
          <ul class="canto-bolli">
            <li class="bollo">${canto.versi.length} versi</li>
            <li class="bollo">${tavoleDelCanto.length ? `${tavoleDelCanto.length} ${tavoleDelCanto.length === 1 ? "tavola di Doré" : "tavole di Doré"}` : "senza tavole"}</li>
          </ul>
          <p class="argomento">${esc(canto.argomento)}</p>
        </header>

        <div class="canto-corpo">
          <div class="versi">
${rendiStrofe(canto)}
          </div>
${colonna}
        </div>

        <nav class="canto-nav" aria-label="Navigazione fra i canti">
          <span>${nav}</span>
        </nav>
      </article>`;
}

/**
 * Testo su cui lavorano le ricerche (indice e menu dei canti): incipit,
 * argomento, luogo, temi e didascalie delle tavole. Una sola funzione per
 * entrambi, così cercare «barattieri» o «Ugolino» dà gli stessi risultati
 * ovunque.
 */
function chiaveRicerca(canto, tavole) {
  const num = ROMAN[canto.numero - 1];
  return [
    `Canto ${num}`,
    incipitDi(canto),
    canto.argomento,
    LUOGO[canto.numero - 1],
    CHIAVI[canto.numero - 1],
    tavole
      .filter((t) => t.canto === canto.numero)
      .map((t) => t.didascalia)
      .join(" "),
    tavole.some((t) => t.canto === canto.numero) ? "tavole di Doré" : "",
  ]
    .join(" ")
    .replace(/"/g, "");
}

function rendiIndice(canti, tavole) {
  return canti
    .map((c) => {
      const num = ROMAN[c.numero - 1];
      const incipit = incipitDi(c).slice(0, 46);
      return `          <li data-voce-indice data-destinazione="canto-${c.numero}" data-gruppo="${gruppoDi(c.numero)}" data-testo="${esc(chiaveRicerca(c, tavole))}">
            <a href="#canto-${c.numero}">
              <span class="indice-numero">${num}</span>
              <span class="indice-incipit">${esc(incipit)}…</span>
            </a>
          </li>`;
    })
    .join("\n");
}

/**
 * Menu dei canti della testata.
 *
 * Sostituisce un <select> nativo: la tendina del sistema operativo ignora il
 * tema della pagina (compariva un rettangolo bianco su fondo notturno) e non
 * lascia filtrare l'elenco. Qui è un pannello in pagina, con le stesse voci
 * dell'indice e la stessa ricerca.
 */
function rendiSelettore(canti, tavole) {
  /* Trentaquattro voci di fila sono un muro: qui si raccolgono sotto il luogo
     in cui il canto si svolge, così la discesa si legge a tappe. */
  const gruppi = [];
  for (const c of canti) {
    const luogo = LUOGO[c.numero - 1];
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo && ultimo.luogo === luogo) ultimo.canti.push(c);
    else gruppi.push({ luogo, canti: [c] });
  }

  const blocchi = gruppi
    .map(({ luogo, canti: dentro }) => {
      const voci = dentro
        .map((c) => {
          const num = ROMAN[c.numero - 1];
          const incipit = incipitDi(c).slice(0, 46);
          /* La chiave di ricerca non si ripete qui: il menu la prende
             dall'indice per numero di canto. Scritta due volte erano 35 KB
             di pagina in più, e due cose da tenere allineate. */
          return `                        <a class="selettore-voce" href="#canto-${c.numero}" data-selettore-voce="canto-${c.numero}" data-destinazione="canto-${c.numero}">
                            <span class="selettore-numero">${num}</span>
                            <span class="selettore-incipit">${esc(incipit)}…</span>
                        </a>`;
        })
        .join("\n");
      return `                    <div class="selettore-gruppo" role="group" aria-label="${esc(luogo)}" data-selettore-gruppo>
                        <p class="selettore-gruppo-titolo" aria-hidden="true">${esc(luogo)}</p>
${voci}
                    </div>`;
    })
    .join("\n");

  return `            <div class="selettore" data-selettore>
                <button type="button" class="controllo selettore-bottone" data-selettore-apri
                        aria-expanded="false" aria-controls="pannello-canti">
                    <span class="selettore-icona" aria-hidden="true">
                        <svg viewBox="0 0 14 12" width="13" height="11" focusable="false">
                            <path d="M7 2.5C5.6 1.6 3.8 1.3 2 1.5v7.9c1.8-.2 3.6.1 5 1z"></path>
                            <path d="M7 2.5c1.4-.9 3.2-1.2 5-1v7.9c-1.8-.2-3.6.1-5 1z"></path>
                        </svg>
                    </span>
                    <span class="selettore-etichetta" data-selettore-etichetta>Vai al canto…</span>
                    <span class="selettore-freccia" aria-hidden="true"></span>
                </button>
                <div class="selettore-pannello" id="pannello-canti" data-selettore-pannello hidden>
                    <input type="search" class="selettore-filtro" data-selettore-filtro
                           placeholder="Numero o parola d'apertura…" autocomplete="off"
                           aria-label="Filtra i canti" aria-controls="elenco-canti">
                    <div class="selettore-elenco" id="elenco-canti" data-selettore-elenco>
${blocchi}
                    </div>
                    <p class="selettore-vuoto" data-selettore-vuoto hidden>Nessun canto corrisponde.</p>
                </div>
            </div>`;
}

/**
 * Binario di salto rapido: una pallina per canto, fissa sul fianco della
 * pagina. Per un testo di 4.720 versi è il modo più diretto per spostarsi
 * senza tornare all'indice.
 */
function rendiBinario(canti) {
  return canti
    .map((c) => {
      const num = ROMAN[c.numero - 1];
      return `            <a href="#canto-${c.numero}" data-binario="canto-${c.numero}" title="Canto ${num}"><span>Canto ${num}</span></a>`;
    })
    .join("\n");
}

/** Pastiglie che filtrano l'indice per cerchio. */
function rendiFiltri() {
  const voce = (gruppo, etichetta, premuto) =>
    `                <li><button type="button" data-filtro-cerchio="${gruppo}" aria-pressed="${premuto}">${etichetta}</button></li>`;
  const voci = [
    voce("tutti", "Tutti", "true"),
    voce("antinferno", "Antinferno", "false"),
    ...CERCHI.map(([romano, nome], i) => voce(String(i + 1), `${romano} · ${nome}`, "false")),
  ];
  return `            <ul class="indice-filtri" aria-label="Filtra i canti per cerchio">\n${voci.join("\n")}\n            </ul>`;

}

/**
 * Le pagine scritte a mano (`index.html` e `404.html`) dichiarano larghezza e
 * altezza delle stesse tavole: se un riscaricamento le cambia, i valori
 * restano indietro e la pagina salta al momento del caricamento. Qui si
 * segnala il disallineamento senza riscrivere nulla.
 */
function controllaPagineScritteAMano() {
  for (const pagina of ["index.html", "404.html"]) controllaPagina(pagina);
}

function controllaPagina(nome) {
  const percorso = join(ROOT, nome);
  if (!existsSync(percorso)) return;
  const html = readFileSync(percorso, "utf8");
  const dichiarati = [
    ...html.matchAll(/src="(assets\/dore\/[^"]+)"[^>]*?width="(\d+)" height="(\d+)"/g),
  ];
  const incoerenti = [];

  for (const [, file, larghezza, altezza] of dichiarati) {
    const percorsoImg = join(ROOT, file);
    if (!existsSync(percorsoImg)) continue;
    try {
      const m = misuraJpeg(percorsoImg);
      if (String(m.larghezza) !== larghezza || String(m.altezza) !== altezza) {
        incoerenti.push(`${file}: dichiarati ${larghezza}×${altezza}, reali ${m.larghezza}×${m.altezza}`);
      }
    } catch (e) {
      incoerenti.push(`${file}: ${e.message}`);
    }
  }

  /* Stessa storia per il contrassegno di versione degli asset: se resta
     indietro, chi torna sul sito si ritrova il foglio di stile vecchio. */
  for (const file of ["site.css", "site.js"]) {
    const atteso = `assets/${file}?v=${VERSIONE}`;
    if (!html.includes(atteso)) incoerenti.push(`aggiorna il riferimento a ${file} in ${atteso}`);
  }

  if (incoerenti.length) {
    console.warn(`Avviso — ${nome} va allineato a mano:`);
    for (const riga of incoerenti) console.warn(`  ! ${riga}`);
  }
}

// ---------------------------------------------------------------------------

function main() {
  const soloControllo = process.argv.includes("--check");
  const canti = [];

  for (let n = 1; n <= 34; n++) {
    const file = join(CACHE, `canto_${n}.txt`);
    if (!existsSync(file)) throw new Error(`File mancante: tools/cache/canto_${n}.txt`);
    canti.push(analizza(n, readFileSync(file, "utf8")));
  }

  const tavole = caricaTavole();
  const ok = valida(canti, tavole);
  if (soloControllo) process.exit(ok ? 0 : 1);
  if (!ok) {
    console.error("\nValidazione fallita: nessun file generato.");
    process.exit(1);
  }

  const totaleVersi = canti.reduce((s, c) => s + c.versi.length, 0);
  const cantiConTavole = canti.filter((c) => tavole.some((t) => t.canto === c.numero)).length;

  const indice = rendiIndice(canti, tavole);
  const filtri = rendiFiltri();
  const binario = rendiBinario(canti);
  const selettore = rendiSelettore(canti, tavole);
  const articoli = canti
    .map((c, i) =>
      rendiCanto(
        c,
        i > 0 ? canti[i - 1].numero : null,
        i < canti.length - 1 ? canti[i + 1].numero : null,
        tavole.filter((t) => t.canto === c.numero),
      ),
    )
    .join("\n\n");

  // La copertina dichiara le misure reali del file: erano state copiate dalla
  // tavola di un altro canto e non corrispondevano più.
  const copertinaFile = "assets/dore/canto-03-1.jpg";
  let copertina = { larghezza: 979, altezza: 765 };
  try {
    copertina = misuraJpeg(join(ROOT, copertinaFile));
  } catch (e) {
    console.warn(`Avviso — copertina non misurabile (${e.message}): uso valori di ripiego`);
  }

  const html = `<!DOCTYPE html>
<html lang="it" data-tema="notte">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Il testo integrale dell'Inferno di Dante Alighieri: tutti i 34 canti nell'originale volgare, con le tavole di Gustave Doré accostate ai versi che illustrano.">
    <meta name="theme-color" content="#100e0d">
    <meta name="color-scheme" content="dark light">
    <title>Il testo integrale — Esplorando l'Inferno di Dante</title>
    <meta property="og:type" content="website">
    <meta property="og:locale" content="it_IT">
    <meta property="og:site_name" content="Esplorando l'Inferno di Dante">
    <meta property="og:title" content="Il testo integrale dell'Inferno di Dante">
    <meta property="og:description" content="Tutti e trentaquattro i canti nell'originale volgare, con l'argomento che li apre, le tavole di Doré accostate ai versi e i rimandi alle terzine.">
    <meta property="og:image" content="${assoluto(copertinaFile)}">
    <meta property="og:image:width" content="${copertina.larghezza}">
    <meta property="og:image:height" content="${copertina.altezza}">
    <meta property="og:image:alt" content="La porta dell'Inferno, incisione di Gustave Doré per il canto III.">
    <meta property="og:url" content="${indirizzoDi("inferno.html")}">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="canonical" href="${indirizzoDi("inferno.html")}">
    <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
    <!-- iOS non legge le icone vettoriali: qui ne serve una raster. Safari,
         che le legge, usa la stessa per la scheda fissata. -->
    <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
    <link rel="mask-icon" href="assets/favicon.svg" color="#e2542c">
    <script>
        /* Il tema scelto è applicato prima del primo disegno: senza questo
           script la pagina comparirebbe notturna e poi cambierebbe tinta. */
        (function () {
            try {
                var tema = localStorage.getItem("inferno-tema");
                if (tema === "chiaro" || tema === "notte") {
                    document.documentElement.dataset.tema = tema;
                }
            } catch (e) { /* memoria locale negata: resta il tema predefinito */ }
        })();
    </script>
    <link rel="stylesheet" href="assets/site.css?v=${VERSIONE}">
    <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Book",
            "name": "Inferno — testo integrale",
            "alternateName": "La Divina Commedia — Inferno",
            "author": { "@type": "Person", "name": "Dante Alighieri" },
            "illustrator": { "@type": "Person", "name": "Gustave Doré" },
            "inLanguage": "it",
            "genre": "Poesia epica",
            "isAccessibleForFree": true,
            "license": "https://creativecommons.org/publicdomain/mark/1.0/",
            "abstract": "I trentaquattro canti dell'Inferno nell'originale volgare, ${migliaia(totaleVersi)} endecasillabi, con le incisioni di Gustave Doré accostate ai versi che illustrano."
        }
    </script>
</head>
<body>

<div id="progresso" aria-hidden="true"></div>
<a class="salta-al-contenuto" href="#indice">Salta all'indice dei canti</a>

<header class="site-header">
    <div class="container header-inner">
        <a href="index.html" class="logo">
            <span class="logo-fiamma" aria-hidden="true"></span>
            <span class="logo-lungo">Esplorando l'</span><strong>Inferno</strong> di Dante
        </a>
        <nav aria-label="Navigazione principale">
            <ul class="nav-links">
                <li><a href="index.html">Home</a></li>
                <li><a href="#indice">Indice dei canti</a></li>
                <li><a href="index.html#struttura">I nove cerchi</a></li>
                <li><a href="#canto-34">Canto XXXIV</a></li>
            </ul>
        </nav>
        <div class="comandi">
${selettore}
            <button type="button" class="controllo" data-azione="tema" aria-pressed="false">
                <span class="icona-tema icona-sole" aria-hidden="true"></span>
                <span class="icona-tema icona-luna" aria-hidden="true"></span>
                <span data-etichetta-tema>Pergamena</span>
            </button>
        </div>
    </div>
</header>

<main>

    <section class="copertina" data-scheletro>
        <img class="copertina-sfondo" src="${copertinaFile}" alt="" aria-hidden="true"
             width="${copertina.larghezza}" height="${copertina.altezza}" decoding="async" fetchpriority="high">
        <div class="container copertina-interna">
            <p class="occhiello">Testo integrale · edizione di riferimento</p>
            <h1>L'Inferno<em>canto per canto</em></h1>
            <p class="copertina-sommario">
                Tutti e trentaquattro i canti nell'originale volgare, con l'argomento che li apre,
                le tavole di Doré accostate ai versi e i rimandi alle terzine.
            </p>
            <div class="azioni">
                <a class="btn btn-primo" href="#canto-1">Comincia dal canto I →</a>
                <a class="btn btn-secondo" href="#indice">Indice dei canti</a>
            </div>
            <p class="copertina-nota">
                ${migliaia(totaleVersi)} endecasillabi · ${canti.length} canti ·
                ${tavole.length} tavole di Doré su ${cantiConTavole} canti · testo di pubblico dominio
            </p>
        </div>
    </section>

    <section id="indice" class="sezione sezione-alternata">
        <div class="container">
            <div class="sezione-testa">
                <h2>Indice dei canti</h2>
                <p class="sezione-sommario">
                    Cerca fra incipit, argomenti e luoghi dell'Inferno — per esempio
                    <em>lussuria</em>, <em>Malebolge</em> o <em>Ugolino</em> — oppure
                    filtra per cerchio.
                </p>
            </div>
            <div class="comandi">
                <input class="controllo" type="search" data-ricerca
                       placeholder="Cerca un canto…  (premi / )"
                       aria-label="Cerca fra i canti">
                <span class="controllo esito-ricerca" data-esito-ricerca aria-live="polite"></span>
            </div>
${filtri}
            <ul class="indice">
${indice}
            </ul>
            <p class="indice-vuoto" data-indice-vuoto hidden>Nessun canto corrisponde alla ricerca.</p>
        </div>
    </section>

    <nav class="binario" aria-label="Salto rapido fra i canti">
${binario}
    </nav>

    <section class="sezione">
        <div class="container">
${articoli}
        </div>
    </section>

</main>

<footer class="site-footer">
    <div class="container footer-interno">
        <p><a href="index.html">← Torna alla pagina iniziale</a></p>
        <p><strong>Esplorando l'Inferno di Dante</strong> — testo integrale della prima cantica.</p>
        <p class="footer-fonte">
            Testo di Dante Alighieri, pubblico dominio (XIV secolo), trascritto da Wikisource.
            Incisioni di Gustave Doré (1832–1883), edizioni Hachette 1861 e Cassell 1892 — pubblico
            dominio, da Wikimedia Commons; alcune tavole vengono dall'edizione londinese del 1866 e
            conservano la didascalia incisa in inglese. Tocca una terzina per copiarne il rimando;
            apri una tavola per vederla a piena pagina (frecce ← → per scorrere).
        </p>
    </div>
</footer>

<button type="button" class="torna-su" aria-label="Torna all'inizio della pagina" title="Torna su"><span class="icona-freccia-su" aria-hidden="true"></span></button>

<script src="assets/site.js?v=${VERSIONE}"></script>
</body>
</html>
`;

  /* Il file si riscrive solo se è cambiato davvero: così una rigenerazione
     senza modifiche non lascia in giro una data di modifica nuova, né un
     cambiamento da mettere in una revisione. */
  const precedente = existsSync(USCITA) ? readFileSync(USCITA, "utf8") : null;
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  if (precedente === html) {
    console.log(`\ninferno.html era già aggiornata (${kb} KB)`);
  } else {
    writeFileSync(USCITA, html, "utf8");
    console.log(`\nScritto inferno.html (${kb} KB)`);
  }

  scriviSeo();
  controllaPagineScritteAMano();
}

// ---------------------------------------------------------------------------
// robots.txt e sitemap.xml
// ---------------------------------------------------------------------------

/**
 * La data di una pagina, come la vuole una mappa del sito: solo il giorno.
 * Si legge dal file, non dall'orologio — un sito che dichiara «modificato
 * oggi» a ogni passata mente ai motori di ricerca.
 */
function giornoDiModifica(percorso) {
  const data = statSync(percorso).mtime;
  const due = (n) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${due(data.getMonth() + 1)}-${due(data.getDate())}`;
}

/**
 * I due file che parlano ai motori di ricerca, derivati dall'indirizzo
 * pubblico dichiarato in `tools/sito.json`.
 *
 * `404.html` non compare nella mappa: la pagina si dichiara `noindex`, e
 * elencarla vorrebbe dire dire due cose diverse nella stessa pubblicazione.
 */
function scriviSeo() {
  const robots = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${assoluto("sitemap.xml")}`,
    "",
  ].join("\n");

  const voci = PAGINE.map(({ file, priorita }) => {
    const percorso = join(ROOT, file);
    const modificata = existsSync(percorso) ? giornoDiModifica(percorso) : null;
    return [
      "  <url>",
      `    <loc>${indirizzoDi(file)}</loc>`,
      modificata ? `    <lastmod>${modificata}</lastmod>` : null,
      `    <priority>${priorita}</priority>`,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n");
  }).join("\n");

  const mappa = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    voci,
    "</urlset>",
    "",
  ].join("\n");

  for (const [nome, contenuto] of [
    ["robots.txt", robots],
    ["sitemap.xml", mappa],
  ]) {
    const percorso = join(ROOT, nome);
    if (existsSync(percorso) && readFileSync(percorso, "utf8") === contenuto) continue;
    writeFileSync(percorso, contenuto, "utf8");
    console.log(`Scritto ${nome}`);
  }
}

main();
