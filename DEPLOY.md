# Pubblicare il sito

Tre pagine HTML, un foglio di stile, un copione, cinquantaquattro incisioni: 15 MB in
tutto. Non c'è nessuna dipendenza da installare e nessun passo di compilazione: **la radice
del deposito è la radice del sito**, e pubblicare vuol dire mettere questi file su un server
che li serve così come sono.

Le pagine usano percorsi relativi (`assets/site.css`, `assets/dore/canto-01-1.jpg`), quindi
il sito funziona sia su un dominio intero sia dentro una sottocartella, come
`https://broctrl.github.io/dansdantis/`. È per questo che non serve sapere, al momento di
costruire le pagine, da quale indirizzo verranno servite.

## In breve

| Cosa | Dove |
| --- | --- |
| Cosa si pubblica | La radice del deposito, così com'è: `index.html`, `inferno.html`, `404.html`, `robots.txt`, `sitemap.xml`, `assets/` |
| Passo di compilazione | Nessuno |
| L'indirizzo pubblico che le pagine dichiarano | `tools/sito.json`, unico posto |
| Prima di pubblicare | `node tools/build-inferno.mjs`, poi `node tools/verifica.mjs` |
| Come si pubblica | Un push su `main` |
| Documentazione delle pagine | [`README.md`](README.md) |

Serve Node solo per gli strumenti, non per il sito: qualsiasi versione recente va bene (la
pubblicazione automatica usa la 24). I comandi qui sotto si lanciano dalla radice del
deposito.

## Prima di ogni pubblicazione

`inferno.html` è **generata** dai wikitext in `tools/cache`, e due delle tre pagine sono
scritte a mano: possono quindi raccontare cose diverse senza che nessuno se ne accorga.
Due comandi, in quest'ordine:

```bash
node tools/build-inferno.mjs   # valida i versi e riscrive inferno.html, robots.txt e sitemap.xml
node tools/verifica.mjs        # esce con codice 1 se trova anche un solo errore
```

Il primo non scrive nulla se la validazione fallisce, e non tocca un file il cui contenuto
non è cambiato. Se hai modificato `assets/site.css` o `assets/site.js`, è lui a calcolare il
nuovo contrassegno di versione (`assets/site.css?v=…`) e a stampare il valore da riportare a
mano in `index.html` e `404.html`, che sono scritte a mano; `verifica.mjs` segnala quello
che è rimasto indietro. Il contrassegno non è un dettaglio: senza, chi ha già visitato il
sito continua a usare il foglio di stile vecchio.

Il secondo comando è quello che decide se pubblicare. Controlla identificatori, ancore,
immagini e loro misure, dati strutturati, indirizzo canonico, `robots.txt`, `sitemap.xml`,
classi del foglio di stile — l'elenco completo è nel README. Gli avvisi non fanno fallire il
controllo; sono cose da guardare, non da correggere per forza.

Lo stesso controllo gira da solo: `.github/workflows/controllo.yml` lo esegue a ogni push su
`main` e a ogni richiesta di unione, dopo aver rigenerato `inferno.html` e verificato che il
file versato corrisponda ai testi di partenza. Serve a **sapere** che una pagina è arrivata a
metà, non a impedire la pubblicazione: il flusso legge il deposito e basta.

## GitHub Pages

L'indirizzo scritto dentro le pagine è `https://broctrl.github.io/dansdantis/`, ricavato dal
remoto. **Al momento Pages non è configurato**: quell'indirizzo risponde 404, e finché è così
le pagine dichiarano un indirizzo canonico che non esiste — per i motori di ricerca è peggio
che non dichiararlo affatto. L'attivazione è una volta sola:

1. Sul deposito: **Settings → Pages**.
2. In *Build and deployment*, **Source: Deploy from a branch**.
3. **Branch: `main`**, cartella **`/` (root)**, poi *Save*.
4. Dopo un minuto circa la prima pubblicazione compare in **Actions** come
   *pages build and deployment*.
5. Apri <https://broctrl.github.io/dansdantis/>.

Da lì in poi **ogni push su `main` ripubblica il sito**: non c'è niente da lanciare a mano.

Tre cose che vale la pena sapere, perché spiegano scelte già fatte nel deposito:

- GitHub Pages consegna da sola il file `404.html` della radice per gli indirizzi che non
  esistono. È per questo che `404.html` è scritta a mano, con la stessa testata e gli stessi
  fogli delle altre; e si dichiara `noindex`, perché una pagina di errore nei risultati di
  ricerca non serve a nessuno.
- **Non serve** il file `.nojekyll`. Pages passa i file da Jekyll, che salta i nomi che
  cominciano con `_`: qui non ce ne sono. Se un giorno ne aggiungi uno (`_headers`,
  `_redirects`, una cartella `_dati`), crea un `.nojekyll` vuoto nella radice, altrimenti
  quel file non verrà servito.
- I limiti di Pages (dalla documentazione ufficiale): sito pubblicato non oltre 1 GB,
  traffico con un tetto morbido di 100 GB al mese, dieci pubblicazioni all'ora — quest'ultimo
  non vale se si pubblica con un flusso di Actions proprio — e una pubblicazione che viene
  interrotta se supera i dieci minuti. Qui siamo a 15 MB in tutto e la copia dei file dura
  qualche secondo.

Finita l'attivazione, una passata veloce per essere sicuri che tutto sia al suo posto:

```bash
curl -sI  https://broctrl.github.io/dansdantis/ | head -1                      # 200
curl -s   https://broctrl.github.io/dansdantis/robots.txt                      # Sitemap: …/sitemap.xml
curl -sI  https://broctrl.github.io/dansdantis/inferno.html | head -1          # 200
curl -sI  https://broctrl.github.io/dansdantis/pagina-inventata | head -1     # 404, ma con la pagina d'errore
curl -sI  https://broctrl.github.io/dansdantis/assets/dore/canto-01-1.jpg | head -1
```

Vale anche la pena aprire il sito da un telefono: è la prova più onesta che le incisioni
pigre, i segnaposti e la copertina si comportino come detto nel README. Gli indirizzi con
un'ancora (`inferno.html#canto-21`) si provano dal browser: l'ancora non arriva al server,
quindi `curl` non può verificarla.

### Dominio tuo

Se in Settings → Pages scrivi un dominio personalizzato, GitHub **aggiunge da sé** un file
`CNAME` nella radice: quel file va versato nel deposito, altrimenti la configurazione si
perde alla pubblicazione successiva. Dopo di che: metti lo stesso indirizzo in
`tools/sito.json`, rilancia la generazione e allinea a mano le testate di `index.html` e
`404.html`; `verifica.mjs` elenca quello che è rimasto indietro. Attiva anche *Enforce
HTTPS*.

## Pubblicare altrove

Il sito è statico: funziona su qualsiasi servizio che consegni file. Quello che conta non è
il servizio, ma tre cose:

- la **cartella da pubblicare è la radice del deposito** e non c'è nessun comando di
  compilazione da indicare;
- il file di errore è **`404.html`**, con stato 404 (non un reindirizzamento alla copertina:
  i motori di ricerca lo punirebbero, e chi ha sbagliato un indirizzo non capirebbe perché
  si trova altrove);
- i file possono essere serviti **compressi**: `inferno.html` passa da 743 KB a 132 KB con
  gzip, e i due fogli condivisi da 84 KB a 27 KB.

| Dove | Cosa impostare |
| --- | --- |
| Netlify, Cloudflare Pages, Vercel | Collega il deposito o trascina la cartella, nessun comando di build, cartella di pubblicazione `/`. Il `404.html` della radice viene riconosciuto da solo. |
| Amazon S3 (+ CloudFront) | Sincronizza la radice in un secchio con l'indicizzazione statica attiva, pagina d'errore `404.html`, e CloudFront davanti per TLS e compressione. |
| Server tuo (nginx, Apache) | Copia la cartella, punta la radice lì, dichiara il file di errore. Vedi sotto. |
| Solo per guardarlo | Apri i file da disco: funziona, ma senza un server non ci sono `404.html`, compressione, né intestazioni di cache. |

Un blocco nginx minimo, con il file di errore e le due intestazioni che contano:

```nginx
server {
    listen 443 ssl;
    server_name inferno.example.org;
    root /var/www/dansdantis;
    index index.html;

    error_page 404 /404.html;
    location / { try_files $uri $uri/ =404; }

    gzip on;
    gzip_types text/html text/css application/javascript image/svg+xml;

    # Le incisioni non cambiano mai nome: si possono tenere a lungo.
    location ~* ^/assets/dore/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Le pagine invece vanno ricontrollate: nominano i fogli con un contrassegno
    # di versione, e una copia vecchia della pagina rimanda a un contrassegno vecchio.
    location ~* \.html$ {
        add_header Cache-Control "no-cache";
    }
}
```

La distinzione è tutta qui: `assets/dore/…` e i due fogli condivisi (che portano `?v=…`)
possono essere conservati a lungo, le pagine HTML no. Chi conserva anche le pagine si
ritrova il sito di ieri anche dopo aver pubblicato quello di oggi.

## Pubblicare solo se il controllo passa

Così com'è, Pages pubblica a ogni push: se dopo la spinta il controllo trova un errore, il
sito è già in linea. Se preferisci che la pubblicazione **dipenda** dal controllo, porta
Pages su *Source: GitHub Actions* e aggiungi un flusso che, in un unico lavoro, esegua i
comandi della sezione «Prima di ogni pubblicazione» e solo dopo carichi la radice come
artefatto di Pages. Servono `permissions: pages: write` e `id-token: write`, l'ambiente
`github-pages`, e i tre passi di rito (`actions/configure-pages`, `actions/upload-pages-artifact`
con `path: .`, `actions/deploy-pages`).

Ha un prezzo: la pubblicazione smette di essere una conseguenza del push e diventa un
flusso da mantenere, e una giornata di Pages fuori servizio blocca anche le correzioni
urgenti.

## Tornare indietro

- **Ultimo commit sbagliato, pubblicazione già avvenuta:** `git revert <sha>` e push: il
  ripristino è un commit come gli altri, e la pubblicazione lo segue.
- **Senza toccare la storia:** in **Actions → pages build and deployment** ogni esecuzione è
  una pubblicazione; dalla pagina dell'ambiente `github-pages` (o da *Deployments*) si può
  ripubblicare una versione precedente. Utile quando il deposito è a posto e c'è solo da
  rimettere in linea quello di prima.
- **Per capire cosa è cambiato:** `git log --oneline -- inferno.html` dice quali commit
  hanno rigenerato la pagina del testo; un commit che la tocca senza aver toccato i wikitext
  in `tools/cache` è sospetto, ed è esattamente quello che il controllo automatico ferma.

## Cambiare indirizzo

`tools/sito.json` è l'unico posto dove l'indirizzo pubblico è scritto: da lì si ricavano il
`<link rel="canonical">`, `og:url`, `og:image`, `robots.txt` e `sitemap.xml`. Per spostare il
sito:

1. aggiorna `tools/sito.json`;
2. `node tools/build-inferno.mjs` (rigenera testo, `robots.txt` e `sitemap.xml`);
3. allinea a mano la testata di `index.html` e `404.html`, che non sono generate: canonical,
   `og:url`, `og:image`;
4. `node tools/verifica.mjs` elenca quello che è rimasto indietro.

`404.html` fa eccezione per scelta: si dichiara `noindex`, quindi non porta indirizzo
canonico e non compare nella mappa del sito.

## Trappole

1. **Non modificare `inferno.html` a mano.** È generata: la rigenerazione successiva
   riscrive tutto. Si modificano i wikitext in `tools/cache` e i cataloghi delle tavole in
   `tools/`.
2. **Dopo aver toccato `site.css` o `site.js`, rigenera.** Il contrassegno di versione vive
   dentro i tre file HTML: se resta indietro, il browser continua a usare il foglio vecchio
   anche se sul server c'è quello nuovo, e la modifica sembra non essere arrivata.
3. **Le date di `sitemap.xml` vengono dalla data dei file, non dall'orologio.** Su un
   deposito appena scaricato sono quelle del prelievo, non quelle vere: per questo
   `verifica.mjs` le considera un avviso e non un errore. Una data *indietro* invece resta
   un errore, perché lì i motori di ricerca crederebbero vecchia una pagina aggiornata.
4. **`.freebuff/` non si pubblica**, ed è già fuori dal deposito (`.gitignore`). Attenzione
   però in locale: il server di prova serve la cartella di lavoro, quindi lì dentro si vede.
5. **Non pubblicare i file temporanei di uno scaricamento interrotto** (`assets/dore/*.tmp`):
   sono ignorati dal deposito, e un copia-incolla della cartella se li porterebbe dietro.
