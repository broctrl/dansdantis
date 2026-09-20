# Esplorando l'Inferno di Dante

Sito statico di studio sulla prima cantica della _Divina Commedia_: i nove cerchi,
la legge del contrappasso, i dannati più celebri e le tavole incise da Gustave Doré,
accostate ai versi che illustrano.

Nessun framework, nessuna dipendenza: sono tre pagine HTML con un foglio di stile e uno
script condivisi. Funziona anche aprendo i file da disco.

## Pagine

| File | Contenuto |
| --- | --- |
| `index.html` | Presentazione della cantica: copertina, mappa interattiva dei nove cerchi, pene e dannati, fine della cantica. |
| `inferno.html` | Testo integrale dei 34 canti (4.720 endecasillabi), con indice ricercabile, filtri per cerchio e 54 tavole di Doré. |
| `404.html` | Pagina di errore: serve un server configurato per usarla (GitHub Pages la prende così com'è). |
| `robots.txt`, `sitemap.xml` | I file per i motori di ricerca: li scrive `tools/build-inferno.mjs` dall'indirizzo pubblico, così non possono restare indietro. |

Le tre pagine condividono:

- `assets/site.css` — tema notturno (predefinito) e tema pergamena, tipografia, mappa,
  tavole, lightbox, adattamento agli schermi stretti, ai dispositivi che riducono il moto e
  alla stampa (i versi si stampano: niente comandi, terzine intere, un canto per pagina).
- `assets/site.js` — tema, avanzamento della lettura, ricerca e filtri dell'indice,
  navigazione con i tasti, menu dei canti, lightbox delle tavole, copia del rimando di una
  terzina.
- `assets/favicon.svg` — favicon vettoriale, e `assets/apple-touch-icon.png` — la stessa
  fiamma resa a 180×180, perché iOS non legge le icone vettoriali.

Le icone del marchio e del pulsante del tema sono sagome disegnate nel foglio di stile, non
emoji: l'emoji la disegna il sistema operativo — forma e colori diversi su ogni macchina — e
ignora il tema della pagina.

I due fogli sono richiamati con un contrassegno di versione (`assets/site.css?v=…`),
calcolato dallo script di generazione sul loro contenuto: senza di esso un browser che
ha già visitato il sito può continuare a usare la copia vecchia.

## Uso in locale

Le pagine usano percorsi relativi, quindi basta un server statico qualsiasi:

```bash
python -m http.server 4173
# poi apri http://127.0.0.1:4173/index.html
```

## Scorciatoie da tastiera

| Tasto | Effetto |
| --- | --- |
| `/` | Porta il fuoco al campo di ricerca dell'indice |
| `←` `→` | Canto precedente o successivo (pagina del testo) |
| `t` | Alterna tema notte / pergamena |
| `Esc` | Chiude la tavola a piena pagina, il pannello delle scorciatoie o il menu dei canti |
| `?` | Mostra o nascondi il pannello delle scorciatoie |

Con un tasto di comando premuto le scorciatoie non agiscono: `Alt` + `←` e `Alt` + `→`
restano Indietro e Avanti del browser, e `Ctrl`/`Cmd` + tasto resta del browser.

Toccare una terzina ne copia il rimando critico (per esempio `Inf. V, 134–135`).
Anche la mappa dei cerchi si può linkare: ogni livello scrive il proprio indirizzo
(`index.html#cerchio-VIII`), e aprendo quel collegamento la pagina si presenta sul cerchio
scelto.

## Accessibilità e riferimenti per i motori di ricerca

Le pagine dichiarano `lang="it"`, un solo `h1` ciascuna, i punti di riferimento
(`header`, `main`, `footer`) e un rimando «salta al contenuto»; ogni comando ha un nome
accessibile. Chi naviga da tastiera vede il contorno di fuoco su tutto ciò che è
raggiungibile, chi usa il mouse no: altrimenti resterebbe un rettangolo disegnato attorno
all'ultima cosa toccata. I colori stanno sopra il rapporto 4,5:1 chiesto dalle linee guida
in entrambi i temi, le animazioni si spengono con `prefers-reduced-motion`, e nessun
contenuto dipende da una dissolvenza per comparire.

Ogni pagina porta descrizione, Open Graph, Twitter Card e un blocco JSON-LD (`WebSite` in
copertina, `Book` nel testo integrale). L'indirizzo pubblico sta **in un posto solo**,
`tools/sito.json`: da lì si ricavano il `<link rel="canonical">`, `og:url`, l'indirizzo
assoluto dell'immagine di anteprima (i raccoglitori di link non sanno risolvere un percorso
relativo) e i due file per i motori di ricerca. `tools/verifica.mjs` confronta ciò che le
pagine dichiarano con quell'indirizzo, e controlla che `robots.txt` e `sitemap.xml`
elenchino le pagine giuste con la loro data reale di modifica.

`404.html` fa eccezione per scelta: si dichiara `noindex`, quindi non porta indirizzo
canonico e non compare nella mappa del sito — le due istruzioni si contraddirebbero.

Cambiando indirizzo: aggiorna `tools/sito.json`, rilancia la generazione e allinea a mano
l'intestazione di `index.html` e `404.html`; la verifica segnala quello che resta indietro.

## Rigenerare `inferno.html`

La pagina del testo è **generata**: non va modificata a mano, perché ogni
rigenerazione la riscrive. La fonte sono i wikitext dei canti, salvati in
`tools/cache/canto_1.txt` … `canto_34.txt`.

```bash
node tools/build-inferno.mjs           # valida, riscrive inferno.html, robots.txt e sitemap.xml
node tools/build-inferno.mjs --check   # valida soltanto (nessuna scrittura)
```

Lo script non scrive nulla se la validazione fallisce, e non riscrive un file il cui
contenuto non è cambiato: una rigenerazione senza modifiche non lascia una data nuova né
un cambiamento da mettere in una revisione. Controlla che:

- ogni canto abbia il numero di versi atteso (4.720 in totale);
- ogni strofa sia una terzina, tranne l'ultima di ciascun canto;
- non restino residui di markup o di spaziatura anomala;
- i versi citati da ogni tavola cadano dentro il canto giusto;
- ogni tavola abbia il file immagine, i metadati e una didascalia.

`index.html` e `404.html` sono invece scritti a mano; al termine della generazione lo
stesso script segnala soltanto — con un avviso, senza toccare i file — se dichiarano misure
di tavole diverse da quelle reali oppure se il contrassegno di versione dei due fogli
condivisi è rimasto indietro. Dopo aver modificato `site.css` o `site.js` conviene quindi
rilanciare lo script, che stampa la versione nuova da riportare in entrambe le pagine.

## Controllo prima di pubblicare

Due delle tre pagine sono scritte a mano: possono scostarsi da quella generata e nessuno se
ne accorgerebbe. Prima di pubblicare — e dopo ogni ritocco — basta una passata:

```bash
node tools/verifica.mjs
```

Esce con codice 1 se trova anche un solo errore, così può fare da guardia in una
pubblicazione automatica. Controlla che:

- ogni pagina abbia dichiarazione del tipo, lingua, codifica, titolo, descrizione, icona,
  un solo `h1` e nessun identificatore ripetuto;
- ogni ancora interna e ogni rinvio da una pagina all'altra (`index.html#struttura`,
  `inferno.html#canto-21`) trovi la sua destinazione, e che ogni file collegato esista;
- ogni immagine abbia la didascalia alternativa e, per le tavole, misure dichiarate pari a
  quelle reali del file;
- il contrassegno di versione dei due fogli condivisi sia allineato in tutte e tre le pagine;
- il marchio e il pulsante del tema (le parti copiate a mano) siano identici nelle tre pagine;
- l'indirizzo canonico, `og:url` e l'immagine di anteprima di ogni pagina coincidano con
  l'indirizzo pubblico, e `robots.txt` e `sitemap.xml` dicano la stessa cosa (data di
  modifica compresa);
- i dati strutturati JSON-LD siano leggibili, e non siano rimasti residui di wikitext,
  indirizzi di prova o caratteri emoji;
- le tavole elencate esistano, non siano troncate, non siano orfane e non siano rimaste a
  misure da miniatura;
- nessuna classe del foglio di stile sia rimasta senza uso, e nessuna classe nominata dalle
  pagine sia ignota al foglio di stile (un nome sbagliato non fa rumore: si disegna e basta).

Gli avvisi non fanno fallire il controllo: sono cose da guardare, non da correggere per
forza.

Lo stesso controllo gira da solo a ogni spinta su `main` e a ogni richiesta di unione
(`.github/workflows/controllo.yml`): rigenera `inferno.html` e fallisce se il file versato
non corrisponde ai wikitext di partenza, poi esegue `tools/verifica.mjs`. Una pagina
generata e versata a metà non passa più in silenzio.

## Tavole di Doré

Le incisioni sono enumerate in `tools/dore-plates.json` e descritte da
`tools/dore-fetch.json` (autore, anno, licenza, pagina su Commons, misure).
I file stanno in `assets/dore/`.

```bash
node tools/fetch-dore.mjs --check     # verifica che i file ci siano
node tools/fetch-dore.mjs --migliora  # riscarica a misura nativa le tavole troppo piccole
node tools/fetch-dore.mjs --refresh   # riscarica tutto e rilegge i metadati
```

Lo script legge le misure originali dall'API di Wikimedia Commons e, quando
restano sotto la loro risoluzione, riscarica le tavole preferendo **il file
originale**: Wikimedia limita la generazione di nuove miniature, non la consegna
di file già esistenti, quindi l'originale è la via più affidabile (e la più
definita). Solo quando l'originale supera il tetto di 1400 px si passa alla
scala delle miniature standard. Fra un file e l'altro c'è una pausa, e un file
che non arriva non interrompe gli altri: viene segnalato e si prosegue.

Dopo un nuovo scaricamento conviene rigenerare `inferno.html`, che riporta
larghezza e altezza reali di ogni tavola.

## Strumenti di servizio

Oltre ai due script di cui sopra, in `tools/` ci sono:

| File | Compito |
| --- | --- |
| `jpeg.mjs` | Legge larghezza e altezza di un JPEG dalla sua intestazione, e riconosce un file arrivato troncato. Lo usano gli altri due. |
| `verifica.mjs` | Il controllo complessivo del sito, descritto più sopra. |
| `sito.json` | L'indirizzo pubblico del sito, con la barra finale: l'unica fonte di canonical, `og:url`, anteprima, `robots.txt` e `sitemap.xml`. |
| `sito.mjs` | Legge quell'indirizzo e ne ricava gli indirizzi assoluti delle pagine e dei file. Lo usano la generazione e la verifica. |
| `dore-plates.json` | Catalogo delle incisioni: canto, versi illustrati, titolo, didascalia. |
| `dore-fetch.json` | Metadati di ogni tavola (autore, licenza, pagina su Commons, misure native). |
| `cache/canto_1.txt` … `canto_34.txt` | I wikitext dei canti così come vengono da Wikisource: la fonte da cui `inferno.html` è generato. |

## Convenzioni del deposito

I file di testo viaggiano con fini di riga LF e i binari non vengono mai convertiti: lo
dichiara `.gitattributes`, così il deposito si legge uguale su Windows, macOS e Linux. Il
segnaposto dell'ambiente di sviluppo locale e i file temporanei di uno scaricamento
interrotto restano fuori dal deposito (`.gitignore`).

`inferno.html` è **generato**: le modifiche fatte a mano su quella pagina si perdono alla
rigenerazione successiva. Le altre due sono scritte a mano, e per questo `verifica.mjs`
confronta fra loro le parti che ripetono.

## Fonti e licenze

- **Testo**: _Divina Commedia_ di Dante Alighieri, pubblico dominio (XIV secolo),
  trascritto da [Wikisource](https://it.wikisource.org/wiki/Divina_Commedia).
- **Incisioni**: Gustave Doré (1832–1883), edizione Hachette 1861 e ristampa
  Cassell 1892 — pubblico dominio, da Wikimedia Commons. Alcune tavole provengono
  dall'edizione londinese del 1866 e conservano la didascalia incisa in inglese.
- **Codice** (HTML, CSS, JavaScript, script di generazione e di scaricamento):
  licenza MIT, vedi [`LICENSE`](LICENSE).
