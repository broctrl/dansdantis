/**
 * fetch-dore.mjs
 *
 * Scarica le tavole incise da Gustave Doré per l'Inferno (edizione Hachette
 * 1861 e ristampa Cassell 1892), elencate nel catalogo curato
 * `tools/dore-plates.json`, e salva le miniature in `assets/dore/`.
 *
 * I metadati di ogni immagine (autore, anno, licenza, pagina su Commons,
 * misure) vengono registrati in `tools/dore-fetch.json` e usati da
 * `build-inferno.mjs`. Tutte le tavole sono di pubblico dominio.
 *
 * Nota tecnica: Wikimedia risponde 429 (troppe richieste) sia alle richieste
 * dirette dei file originali sia alle miniature più grandi dell'originale,
 * e limita le richieste HTTP/1.1. Lo script quindi:
 *   1. legge le misure originali dall'API;
 *   2. chiede una miniatura di larghezza inferiore all'originale, scelta
 *      nella scala di misure standard di Wikimedia;
 *   3. scarica con `curl` (HTTP/2), con ripiego su `fetch`, e arretra fra un
 *      file e l'altro.
 *
 * Uso:
 *   node tools/fetch-dore.mjs            # scarica ciò che manca
 *   node tools/fetch-dore.mjs --migliora # riscarica a misura nativa le tavole
 *                                        # ancora sotto la loro risoluzione
 *   node tools/fetch-dore.mjs --refresh  # riscarica tutto
 *   node tools/fetch-dore.mjs --check    # verifica soltanto (nessuna rete)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, rmSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { misuraJpeg } from "./jpeg.mjs";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOGO = join(ROOT, "tools", "dore-plates.json");
const METADATI = join(ROOT, "tools", "dore-fetch.json");
const OUT_IMG = join(ROOT, "assets", "dore");

/** Misure di miniatura standard generate da Wikimedia, dalla più grande. */
const SCALA = [1280, 960, 800, 640, 480, 320];

/**
 * Guadagno minimo di larghezza perché valga la pena riscaricare una tavola:
 * sotto questa soglia il disturbo non vale il pugno di pixel in più.
 */
const SCARTO_MIGLIORA = 1.08;

/**
 * Pausa fra due tavole da riscaricare. Wikimedia concede solo poche richieste
 * nuove per finestra e poi risponde 429: la pausa allunga il fiato, ma può
 * comunque servire più di un giro. Per questo un file che non arriva non
 * interrompe gli altri e viene invece elencato alla fine.
 */
const PAUSA_MIGLIORA = 25000;

/**
 * Tetto di larghezza per le tavole. Non è una misura della scala standard:
 * si chiede la larghezza nativa (fino a questo tetto) così le incisioni
 * restano definite anche a piena pagina, senza salti alle miniature
 * standard che le dimezzavano (molte tavole stavano a 500 px su 700).
 */
const LARGHEZZA_MAX = 1400;

const UA = "InfernoDiDante/1.0 (sito didattico sull'Inferno di Dante; uso locale)";

const args = new Set(process.argv.slice(2));
const soloControllo = args.has("--check");
const refresh = args.has("--refresh");
const migliora = args.has("--migliora");

const catalogo = JSON.parse(readFileSync(CATALOGO, "utf8"));
const contatore = new Map();
const tavole = catalogo.map((voce) => {
  const i = contatore.get(voce.canto) || 0;
  contatore.set(voce.canto, i + 1);
  return { ...voce, file: `canto-${String(voce.canto).padStart(2, "0")}-${i + 1}.jpg` };
});

// ---------------------------------------------------------------------------
// Controllo locale
// ---------------------------------------------------------------------------

if (soloControllo) {
  let mancanti = 0;
  let peso = 0;
  for (const t of tavole) {
    const p = join(OUT_IMG, t.file);
    const ok = existsSync(p) && statSync(p).size > 1024;
    if (ok) peso += statSync(p).size;
    else {
      console.error(`  ✗ manca assets/dore/${t.file}  (${t.titolo})`);
      mancanti++;
    }
  }
  console.log(
    `Tavole: ${tavole.length} — mancanti: ${mancanti} — peso: ${(peso / 1048576).toFixed(1)} MB`,
  );
  process.exit(mancanti === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Wikimedia Commons
// ---------------------------------------------------------------------------

const esegui = promisify(execFile);
const dormi = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(parametri) {
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({ format: "json", formatversion: "2", ...parametri });
  for (let tentativo = 0; tentativo < 6; tentativo++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      const attesa = 4000 * (tentativo + 1);
      console.log(`   … API: ${e.message}, attendo ${attesa / 1000}s`);
      await dormi(attesa);
    }
  }
  throw new Error(`Commons non risponde: ${url}`);
}

const ripulisci = (html) =>
  String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** URL della miniatura: Special:FilePath genera sempre un'immagine ridotta. */
const urlMiniatura = (titolo, larghezza) =>
  "https://commons.wikimedia.org/wiki/Special:FilePath/" +
  encodeURIComponent(titolo) +
  `?width=${larghezza}`;

/**
 * URL del file originale. È la via più affidabile per una tavola piccola:
 * Wikimedia limita la *generazione* di nuove miniature, non la consegna di
 * file già esistenti, quindi l'originale non finisce in HTTP 429.
 */
const urlOriginale = (titolo) =>
  "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(titolo);

/**
 * Larghezze da tentare per un file, dalla più definita: la misura nativa
 * (entro il tetto) e poi, in caso di rifiuto, le miniature standard minori.
 */
function larghezzePossibili(larghezzaOriginale) {
  const nativa = Number(larghezzaOriginale);
  const obiettivo =
    Number.isFinite(nativa) && nativa > 0 ? Math.min(nativa, LARGHEZZA_MAX) : LARGHEZZA_MAX;
  return [...new Set([obiettivo, ...SCALA.filter((w) => w < obiettivo)])];
}

async function scarica(url, destinazione) {
  try {
    await esegui("curl", ["-sS", "-L", "--fail", "-A", UA, "-o", destinazione, url]);
    const byte = statSync(destinazione).size;
    if (byte < 1024) throw new Error("file troppo piccolo");
    return byte;
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  // Ripiego senza curl: `fetch` di Node (HTTP/1.1, più limitato).
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destinazione, buf);
  return buf.length;
}

/**
 * Scarica la tavola alla misura più definita disponibile.
 *
 * Il file si scrive prima in una copia temporanea e si sostituisce solo se
 * la misura ottenuta non è peggiore di `minimo`: senza questa precauzione un
 * ripiego sulla scala standard (chiedi 701, ottieni 480) avrebbe rimpicciolito
 * una tavola già presente.
 */
async function scaricaConRipieghi(meta, destinazione, minimo = 0, pausa = 3500) {
  const nativa = Number(meta.largOrigine) || 0;
  // Se l'originale sta dentro il tetto si prova per primo quello: non chiede
  // a Wikimedia di generare nulla e restituisce la tavola alla sua misura
  // piena. Le miniature restano come ripiego (e per i file giganteschi, dove
  // l'originale sarebbe troppo pesante da servire).
  const tentativi = [];
  if (nativa > 0 && nativa <= LARGHEZZA_MAX) {
    tentativi.push({ etichetta: `${nativa}px originale`, url: urlOriginale(meta.titolo) });
  }
  for (const larghezza of larghezzePossibili(nativa).filter(
    (w) => (minimo === 0 || w > minimo) && w < nativa,
  )) {
    tentativi.push({ etichetta: `${larghezza}px`, url: urlMiniatura(meta.titolo, larghezza) });
  }

  const temporanea = `${destinazione}.tmp`;

  for (const { etichetta, url } of tentativi) {
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      try {
        const byte = await scarica(url, temporanea);
        const misure = misuraJpeg(temporanea);
        if (misure.larghezza < minimo) {
          rmSync(temporanea, { force: true });
          throw new Error(`tavola più piccola del previsto (${misure.larghezza}px)`);
        }
        rmSync(destinazione, { force: true });
        renameSync(temporanea, destinazione);
        await dormi(pausa);
        return { byte, larghezza: misure.larghezza };
      } catch (e) {
        rmSync(temporanea, { force: true });
        // Wikimedia risponde 429 quando si chiedono troppe miniature nuove:
        // in quel caso serve un'attesa molto più lunga, e conviene rallentare
        // anche i file successivi.
        const limitato = /429/.test(String(e.message));
        const attesa = (limitato ? 30000 : 6000) * (tentativo + 1);
        console.log(`   … ${etichetta}: ${String(e.message).slice(0, 80)} — attendo ${attesa / 1000}s`);
        await dormi(attesa);
        if (limitato) await dormi(10000);
      }
    }
    console.log(`   … ripiego su una misura più piccola`);
  }
  throw new Error(`Download fallito: ${meta.titolo}`);
}

// ---------------------------------------------------------------------------

async function main() {
  const metadati = existsSync(METADATI) ? JSON.parse(readFileSync(METADATI, "utf8")) : {};
  mkdirSync(OUT_IMG, { recursive: true });

  const daRisolvere = [
    ...new Set(
      tavole
        .filter((t) => refresh || !metadati[t.file] || !existsSync(join(OUT_IMG, t.file)))
        .map((t) => t.titolo),
    ),
  ];

  for (let i = 0; i < daRisolvere.length; i += 20) {
    const blocco = daRisolvere.slice(i, i + 20);
    console.log(`Leggo i dati di ${i + 1}–${i + blocco.length} di ${daRisolvere.length}…`);
    const dati = await api({
      action: "query",
      titles: blocco.map((t) => `File:${t}`).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
    });
    for (const pagina of dati.query.pages) {
      const info = (pagina.imageinfo || [])[0];
      const titolo = pagina.title.replace(/^File:/, "");
      const voce = tavole.find((t) => t.titolo === titolo);
      if (!voce || !info) {
        console.error(`  ✗ non trovata su Commons: ${pagina.title}`);
        continue;
      }
      const em = info.extmetadata || {};
      metadati[voce.file] = {
        titolo,
        canto: voce.canto,
        commons: info.descriptionurl,
        largOrigine: info.width,
        altOrigine: info.height,
        artista: ripulisci(em.Artist?.value) || "Gustave Doré",
        data: ripulisci(em.DateTimeOriginal?.value),
        licenza: ripulisci(em.LicenseShortName?.value) || "Pubblico dominio",
      };
    }
    await dormi(2000);
  }

  writeFileSync(METADATI, JSON.stringify(metadati, null, 2) + "\n", "utf8");

  let peso = 0;
  let nuovi = 0;
  let migliorate = 0;
  const falliti = [];
  for (const t of tavole) {
    const dest = join(OUT_IMG, t.file);
    const meta = metadati[t.file];
    if (!meta) {
      console.error(`  ✗ metadati assenti per ${t.file} (${t.titolo})`);
      continue;
    }

    // Con --migliora si riscarica solo ciò che sta ancora sotto la misura
    // nativa: la larghezza si legge dal file, non dai metadati, che possono
    // essere rimasti indietro rispetto a quanto è stato salvato.
    let attuale = 0;
    if (existsSync(dest)) {
      try {
        attuale = misuraJpeg(dest).larghezza;
      } catch (e) {
        attuale = 0;
      }
    }
    const obiettivo = Math.min(Number(meta.largOrigine) || 0, LARGHEZZA_MAX);
    const daMigliorare = migliora && !refresh && obiettivo >= attuale * SCARTO_MIGLIORA;

    if (existsSync(dest) && !refresh && !daMigliorare && statSync(dest).size > 1024) {
      peso += statSync(dest).size;
      continue;
    }

    // Riscaricando per migliorare, la nuova tavola non deve mai risultare
    // meno definita di quella che sostituisce.
    // Riscaricare per guadagnare definizione significa chiedere a Wikimedia
    // di generare nuove miniature: la pausa fra un file e l'altro va allungata,
    // altrimenti si finisce subito in HTTP 429.
    const minimo = daMigliorare ? attuale : 0;
    let esito;
    try {
      esito = await scaricaConRipieghi(meta, dest, minimo, daMigliorare ? PAUSA_MIGLIORA : 3500);
    } catch (e) {
      // Un file che non arriva non deve interrompere gli altri: si segnala e
      // si prosegue; la tavola già presente (o il conteggio finale) dirà se
      // qualcosa è rimasto indietro.
      console.error(`  ✗ ${t.file}: ${e.message} (tavola lasciata com'era)`);
      if (existsSync(dest)) peso += statSync(dest).size;
      falliti.push(t.file);
      continue;
    }
    const { byte, larghezza } = esito;
    meta.larghezza = larghezza;
    peso += byte;
    nuovi++;
    if (daMigliorare) migliorate++;
    console.log(
      `  ↓ ${t.file}  ${larghezza}px  ${Math.round(byte / 1024)} KB` +
        (daMigliorare ? `  (era ${attuale}px)` : "") +
        `  ← ${t.titolo}`,
    );
  }

  writeFileSync(METADATI, JSON.stringify(metadati, null, 2) + "\n", "utf8");

  const mancanti = tavole.filter((t) => !existsSync(join(OUT_IMG, t.file)));
  console.log(
    `\nTavole: ${tavole.length} — scaricate ora: ${nuovi}` +
      (migliorate ? ` (di cui rese più definite: ${migliorate})` : "") +
      ` — peso totale: ${(peso / 1048576).toFixed(1)} MB`,
  );
  if (falliti.length) {
    console.error(
      `Tavole non aggiornate (riprova più tardi con --migliora): ${falliti.join(", ")}`,
    );
  }
  if (mancanti.length) {
    console.error(`File mancanti: ${mancanti.length}`);
    process.exit(1);
  }
  console.log("Scritto tools/dore-fetch.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
