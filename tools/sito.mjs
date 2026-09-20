/**
 * sito.mjs — dove il sito vive, scritto una volta sola.
 *
 * Gli indirizzi assoluti servono a quattro cose che devono per forza dire la
 * stessa verità: il collegamento canonico di ogni pagina, `og:url` e
 * `og:image` (che i sistemi di condivisione non sanno risolvere se sono
 * relativi), e la mappa del sito. L'indirizzo sta in `tools/sito.json`; qui si
 * legge, si normalizza e si trasforma in indirizzi.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");

const configurazione = JSON.parse(readFileSync(join(RADICE, "tools", "sito.json"), "utf8"));

/** L'indirizzo pubblico, sempre con la barra finale. */
export const PUBBLICO = configurazione.indirizzo.endsWith("/")
  ? configurazione.indirizzo
  : configurazione.indirizzo + "/";

/** Indirizzo assoluto di un file: «assets/x.jpg» → «https://…/assets/x.jpg». */
export const assoluto = (percorso) => PUBBLICO + String(percorso).replace(/^\/+/, "");

/**
 * Indirizzo canonico di una pagina. La pagina iniziale è la cartella stessa:
 * è lì che il sito la serve, ed è quell'indirizzo che vale la pena indicare.
 * `404.html` non compare: resta fuori dai motori di ricerca per scelta.
 */
export const indirizzoDi = (file) => (file === "index.html" ? PUBBLICO : assoluto(file));

/** Le pagine che entrano nella mappa del sito, con il loro peso relativo. */
export const PAGINE = [
  { file: "index.html", priorita: "1.0" },
  { file: "inferno.html", priorita: "0.9" },
];
