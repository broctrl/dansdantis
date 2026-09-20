/**
 * jpeg.mjs
 *
 * Lettura delle misure di un JPEG dalla sua intestazione, senza decodificarlo.
 * Serve a due cose: sapere quanto è larga una tavola (per dichiararla nelle
 * pagine e per riconoscere quelle rimaste sotto la loro risoluzione nativa) e
 * accorgersi di un file arrivato troncato.
 *
 * Sta qui e non dentro i due script che lo usavano — `build-inferno.mjs` e
 * `fetch-dore.mjs` — perché ne esistevano due copie, libere di divergere.
 */

import { readFileSync } from "node:fs";

/* I marcatori che aprono un segmento "start of frame", cioè la testata che
   porta le dimensioni. Sono più d'uno: cambia la codifica dei coefficienti. */
const MARCATORI_SOF = [
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
];

/**
 * @param {string} percorso
 * @returns {{ larghezza: number, altezza: number, completo: boolean }}
 * @throws se il file non è un JPEG
 */
export function misuraJpeg(percorso) {
  const dati = readFileSync(percorso);
  if (dati[0] !== 0xff || dati[1] !== 0xd8) throw new Error("non è un JPEG");

  /* Un file intero si chiude con il marcatore di fine immagine: senza di
     esso lo scaricamento si è fermato a metà. */
  const completo = dati[dati.length - 2] === 0xff && dati[dati.length - 1] === 0xd9;

  let i = 2;
  while (i < dati.length - 9) {
    if (dati[i] !== 0xff) {
      i++;
      continue;
    }
    const marcatore = dati[i + 1];
    if (marcatore === 0xd8 || marcatore === 0xd9 || (marcatore >= 0xd0 && marcatore <= 0xd7)) {
      i += 2;
      continue;
    }
    const lunghezza = dati.readUInt16BE(i + 2);
    if (MARCATORI_SOF.includes(marcatore)) {
      return {
        altezza: dati.readUInt16BE(i + 5),
        larghezza: dati.readUInt16BE(i + 7),
        completo,
      };
    }
    i += 2 + lunghezza;
  }

  return { larghezza: 0, altezza: 0, completo };
}
