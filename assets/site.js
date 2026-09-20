/* ==========================================================================
   Esplorando l'Inferno di Dante — comportamenti condivisi
   Nessuna dipendenza esterna: funziona anche aprendo i file da disco.
   ========================================================================== */

(function () {
    "use strict";

    const q = (sel, radice = document) => radice.querySelector(sel);
    const qa = (sel, radice = document) => Array.from(radice.querySelectorAll(sel));

    /* ----------------------------------------------------------------------
       Da dove arriva l'ultimo comando
       Il contorno di fuoco serve a chi naviga da tastiera. Dopo un clic col
       mouse il browser lo disegna comunque attorno ad alcuni elementi (per
       esempio il riquadro del livello toccato sull'imbuto, o il pulsante di
       una tavola quando il fuoco ci ritorna): qui si annota il tipo di
       comando, e il foglio di stile lo usa per non lasciare quei rettangoli.
       ---------------------------------------------------------------------- */

    document.addEventListener(
        "keydown",
        () => {
            document.documentElement.dataset.input = "tastiera";
        },
        true,
    );
    document.addEventListener(
        "pointerdown",
        () => {
            document.documentElement.dataset.input = "puntatore";
        },
        true,
    );

    /* ----------------------------------------------------------------------
       Scorrimento comandato dallo script
       La preferenza «meno movimento» non vale solo per il foglio di stile: le
       due scorrimenti decisi dal copione — il ritorno in cima e il salto a una
       terzina — devono rispettarla anche loro.
       ---------------------------------------------------------------------- */

    const scorrimentoFluido = () =>
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

    /* ----------------------------------------------------------------------
       Tema (notte / pergamena)
       Il tema scelto è già applicato dallo script inline nell'<head>, che
       evita il lampo del tema sbagliato al primo disegno; qui si allinea il
       pulsante e si registra la preferenza.
       ---------------------------------------------------------------------- */

    const CHIAVE_TEMA = "inferno-tema";

    function temaAttuale() {
        return document.documentElement.dataset.tema === "chiaro" ? "chiaro" : "notte";
    }

    function applicaTema(tema) {
        const chiaro = tema === "chiaro";
        document.documentElement.dataset.tema = chiaro ? "chiaro" : "notte";

        const colore = q('meta[name="theme-color"]');
        if (colore) colore.setAttribute("content", chiaro ? "#f3ece0" : "#100e0d");

        const bottone = q('[data-azione="tema"]');
        if (bottone) {
            /* Cambia solo la parola: le due icone stanno già nel pulsante e a
               mostrarla è il foglio di stile, sulla base del tema. */
            const etichetta = q("[data-etichetta-tema]", bottone);
            if (etichetta) etichetta.textContent = chiaro ? "Notte" : "Pergamena";
            else bottone.textContent = chiaro ? "Notte" : "Pergamena";
            bottone.setAttribute("aria-pressed", String(chiaro));
            bottone.setAttribute("aria-label", chiaro ? "Passa al tema notturno" : "Passa al tema pergamena");
            bottone.title = chiaro ? "Tema notturno — scorciatoia «t»" : "Tema pergamena — scorciatoia «t»";
        }
    }

    function giraTema() {
        const nuovo = temaAttuale() === "chiaro" ? "notte" : "chiaro";
        applicaTema(nuovo);
        try {
            localStorage.setItem(CHIAVE_TEMA, nuovo);
        } catch (e) {
            /* la memoria locale può essere negata: il tema vale per la pagina */
        }
    }

    applicaTema(temaAttuale());

    /* ----------------------------------------------------------------------
       Avanzamento della lettura e pulsante di risalita
       ---------------------------------------------------------------------- */

    const barra = q("#progresso");
    const tornaSu = q(".torna-su");

    function aggiornaAvanzamento() {
        const altezza = document.documentElement.scrollHeight - window.innerHeight;
        const quota = altezza > 0 ? Math.min(1, Math.max(0, window.scrollY / altezza)) : 0;
        if (barra) barra.style.width = (quota * 100).toFixed(2) + "%";
        if (tornaSu) tornaSu.dataset.visibile = String(window.scrollY > 600);
    }

    // Le misure sono lette una volta per fotogramma: lo scorrimento non deve
    // rifare il calcolo a ogni evento.
    let fotogrammaInCoda = false;
    function programmaAvanzamento() {
        if (fotogrammaInCoda) return;
        fotogrammaInCoda = true;
        requestAnimationFrame(() => {
            fotogrammaInCoda = false;
            aggiornaAvanzamento();
        });
    }

    if (tornaSu) {
        tornaSu.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: scorrimentoFluido() });
        });
    }

    /* ----------------------------------------------------------------------
       Comparse graduali
       ---------------------------------------------------------------------- */

    const daComparire = qa(".da-comparire");

    /* La dissolvenza è un di più: il contenuto è visibile comunque, e dopo la
       sua durata l'animazione si toglie di mezzo perché non sia lei a decidere
       se una tavola si vede (basta che il motore di disegno si fermi un
       istante e resterebbe a metà). */
    const rivela = (elemento) => {
        if (elemento.classList.contains("comparso")) return;
        elemento.classList.add("comparso");
        setTimeout(() => elemento.classList.add("tranquillo"), 780);
    };

    if (daComparire.length && "IntersectionObserver" in window) {
        const osservatore = new IntersectionObserver(
            (voci) => {
                for (const voce of voci) {
                    if (voce.isIntersecting) {
                        rivela(voce.target);
                        osservatore.unobserve(voce.target);
                    }
                }
            },
            { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
        );
        for (const elemento of daComparire) osservatore.observe(elemento);

        /* Rete di sicurezza: quello che è già sotto gli occhi non deve
           aspettare l'osservatore per comparire. */
        setTimeout(() => {
            for (const elemento of daComparire) {
                if (elemento.getBoundingClientRect().top < window.innerHeight) rivela(elemento);
            }
        }, 600);
    } else {
        for (const elemento of daComparire) rivela(elemento);
    }

    /* ----------------------------------------------------------------------
       Pulsante di cancellazione dei campi di ricerca
       <input type="search"> ne porta uno disegnato dal sistema, che ignora il
       tema della pagina; il foglio di stile lo spegne e questo lo rimpiazza.
       ---------------------------------------------------------------------- */

    for (const campo of qa('input[type="search"]')) {
        const pulisci = document.createElement("button");
        pulisci.type = "button";
        pulisci.className = "ricerca-pulisci";
        pulisci.textContent = "✕";
        pulisci.setAttribute("aria-label", "Cancella la ricerca");
        campo.insertAdjacentElement("afterend", pulisci);

        // Compare solo quando c'è qualcosa da cancellare.
        const aggiorna = () => {
            pulisci.hidden = campo.value === "";
        };
        campo.addEventListener("input", aggiorna);
        pulisci.addEventListener("click", () => {
            campo.value = "";
            campo.dispatchEvent(new Event("input", { bubbles: true }));
            campo.focus();
        });
        aggiorna();
    }

    /* ----------------------------------------------------------------------
       Indice dei canti: ricerca, filtro per cerchio e posizione corrente
       ---------------------------------------------------------------------- */

    const ricerca = q("[data-ricerca]");
    const vociIndice = qa("[data-voce-indice]");
    const messaggioVuoto = q("[data-indice-vuoto]");
    const esitoRicerca = q("[data-esito-ricerca]");
    const pastiglieFiltro = qa("[data-filtro-cerchio]");
    let gruppoAttivo = "tutti";

    /* Le chiavi di ricerca di ciascun canto sono scritte una volta sola, sulle
       voci dell'indice: il menu della testata le riprende da qui per numero di
       canto. Tenerne due copie nella pagina voleva dire 35 KB di testo ripetuto
       e due elenchi da aggiornare insieme. */
    const chiaviPerCanto = new Map(
        vociIndice.map((voce) => [voce.dataset.destinazione, voce.dataset.testo || ""])
    );

    const chiaveDi = (destinazione, ripiego) =>
        chiaviPerCanto.get(destinazione) || ripiego;

    function normalizza(testo) {
        return testo
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function filtraIndice() {
        if (!vociIndice.length) return;
        const termine = normalizza(ricerca ? ricerca.value.trim() : "");
        let visibili = 0;

        for (const voce of vociIndice) {
            const testo = normalizza(voce.dataset.testo || voce.textContent);
            const okTesto = termine === "" || testo.includes(termine);
            const okGruppo = gruppoAttivo === "tutti" || (voce.dataset.gruppo || "") === gruppoAttivo;
            const mostra = okTesto && okGruppo;
            voce.hidden = !mostra;
            if (mostra) visibili++;
        }

        if (messaggioVuoto) messaggioVuoto.hidden = visibili > 0;

        if (esitoRicerca) {
            const filtrato = termine !== "" || gruppoAttivo !== "tutti";
            // La pastiglia compare solo quando ha qualcosa da dire: prima
            // restava un contorno vuoto accanto al campo di ricerca.
            esitoRicerca.hidden = !filtrato;
            esitoRicerca.textContent = !filtrato
                ? ""
                : visibili === 1
                  ? "1 canto trovato"
                  : visibili + " canti trovati";
        }
    }

    if (ricerca && vociIndice.length) {
        ricerca.addEventListener("input", filtraIndice);
        ricerca.addEventListener("keydown", (evento) => {
            if (evento.key === "Escape" && ricerca.value) {
                ricerca.value = "";
                filtraIndice();
            }
        });
    }

    for (const pastiglia of pastiglieFiltro) {
        pastiglia.addEventListener("click", () => {
            gruppoAttivo = pastiglia.dataset.filtroCerchio || "tutti";
            for (const altra of pastiglieFiltro) {
                altra.setAttribute("aria-pressed", String(altra === pastiglia));
            }
            filtraIndice();
        });
    }

    filtraIndice();

    /* ----------------------------------------------------------------------
       Menu dei canti della testata
       Un pannello in pagina al posto del <select>: la tendina del sistema
       operativo ignora il tema (compariva un rettangolo chiaro su fondo
       notturno) e non lascia filtrare l'elenco.
       ---------------------------------------------------------------------- */

    const selettore = q("[data-selettore]");
    let etichettaCanto = null;
    let vociMenu = [];
    /* Assegnata solo se il menu dei canti esiste: la scorciatoia Esc, che
       ascolta sul documento, deve poterlo chiudere anche quando il fuoco è
       fuori dal pannello. */
    let chiudiMenuCanti = null;

    if (selettore) {
        const apri = q("[data-selettore-apri]", selettore);
        const pannello = q("[data-selettore-pannello]", selettore);
        const filtro = q("[data-selettore-filtro]", selettore);
        const vuoto = q("[data-selettore-vuoto]", selettore);
        etichettaCanto = q("[data-selettore-etichetta]", selettore);
        vociMenu = qa("[data-selettore-voce]", selettore);
        const gruppiMenu = qa("[data-selettore-gruppo]", selettore);

        const aperto = () => apri.getAttribute("aria-expanded") === "true";
        const vociVisibili = () => vociMenu.filter((voce) => !voce.hidden);

        function mostraVoci() {
            const termine = normalizza(filtro.value.trim());
            let visibili = 0;
            for (const voce of vociMenu) {
                const testo = normalizza(
                    chiaveDi(voce.dataset.destinazione, voce.dataset.testo || voce.textContent)
                );
                const mostra = termine === "" || testo.includes(termine);
                voce.hidden = !mostra;
                if (mostra) visibili++;
            }
            /* Il titolo del luogo non deve restare appeso sopra un elenco
               vuoto: si nasconde il gruppo quando non ha più voci. */
            for (const gruppo of gruppiMenu) {
                gruppo.hidden = !qa("[data-selettore-voce]", gruppo).some((voce) => !voce.hidden);
            }
            if (vuoto) vuoto.hidden = visibili > 0;
        }

        function apriPannello() {
            pannello.hidden = false;
            apri.setAttribute("aria-expanded", "true");
            filtro.value = "";
            mostraVoci();

            /* Il pannello non deve sporgere dal fianco: se a sinistra di lui
               resta meno di un pollice d'aria, si tira dentro di quanto serve
               invece di uscire dallo schermo. */
            pannello.style.removeProperty("transform");
            const riquadro = pannello.getBoundingClientRect();
            const aria = 8;
            if (riquadro.left < aria) {
                pannello.style.transform = `translateX(${aria - riquadro.left}px)`;
            }

            filtro.focus();
        }

        function chiudiPannello() {
            if (!aperto()) return false;
            // Il fuoco non deve restare su un elemento che sta sparendo.
            const dentro = selettore.contains(document.activeElement);
            pannello.hidden = true;
            apri.setAttribute("aria-expanded", "false");
            if (dentro) apri.focus();
            return true;
        }

        /** Sposta il fuoco fra le voci visibili, girando agli estremi. */
        function sposta(passo) {
            const visibili = vociVisibili();
            if (!visibili.length) return;
            const corrente = visibili.indexOf(document.activeElement);
            const prossimo =
                corrente === -1
                    ? passo > 0
                        ? 0
                        : visibili.length - 1
                    : (corrente + passo + visibili.length) % visibili.length;
            visibili[prossimo].focus();
        }

        apri.addEventListener("click", () => (aperto() ? chiudiPannello() : apriPannello()));
        filtro.addEventListener("input", mostraVoci);
        /* Con un termine già scritto, Invio va al primo canto che risponde:
           si cerca e si entra senza toccare il mouse. */
        filtro.addEventListener("keydown", (evento) => {
            if (evento.key !== "Enter") return;
            const prima = vociVisibili()[0];
            if (prima) {
                evento.preventDefault();
                prima.click();
            }
        });

        pannello.addEventListener("keydown", (evento) => {
            if (evento.key === "ArrowDown") {
                evento.preventDefault();
                sposta(1);
            } else if (evento.key === "ArrowUp") {
                evento.preventDefault();
                sposta(-1);
            } else if (evento.key === "Home") {
                evento.preventDefault();
                vociVisibili()[0]?.focus();
            } else if (evento.key === "End") {
                evento.preventDefault();
                vociVisibili().at(-1)?.focus();
            } else if (evento.key === "Escape") {
                evento.preventDefault();
                chiudiPannello();
            }
        });

        for (const voce of vociMenu) {
            voce.addEventListener("click", () => {
                // Il canto scelto si annuncia subito: aspettare che lo
                // scorrimento arrivi lascerebbe il menu su «Vai al canto…».
                const numero = q(".selettore-numero", voce)?.textContent;
                if (etichettaCanto && numero) etichettaCanto.textContent = `Canto ${numero}`;
                // La voce è un collegamento: la navigazione deve poter finire
                // prima che il pannello scompaia.
                setTimeout(chiudiPannello, 0);
            });
        }

        document.addEventListener("click", (evento) => {
            if (aperto() && !selettore.contains(evento.target)) chiudiPannello();
        });
        window.addEventListener("hashchange", chiudiPannello);

        /* Il pannello si chiude anche quando il fuoco ne esce con il tasto Tab.
           Prima restava aperto sopra la pagina: e con il fuoco altrove nemmeno
           Esc lo chiudeva più, perché quel tasto è ascoltato dentro di lui. */
        selettore.addEventListener("focusout", () => {
            if (!aperto()) return;
            /* Dopo aver ceduto il fuoco, non prima: solo allora si sa dove è
               andato — e un clic dentro il pannello non deve chiuderlo. */
            setTimeout(() => {
                if (!selettore.contains(document.activeElement)) chiudiPannello();
            }, 0);
        });

        chiudiMenuCanti = chiudiPannello;
    }

    /* ----------------------------------------------------------------------
       Canti: posizione corrente e navigazione con i tasti ← →
       ---------------------------------------------------------------------- */

    const canti = qa("article.canto");
    const navCanti = qa("[data-nav-canto]");
    const binario = qa("[data-binario]");
    let idCorrente = "";

    function segnalaCorrente() {
        if (!idCorrente) return;
        for (const voce of vociIndice) {
            const attiva = voce.dataset.destinazione === idCorrente;
            const link = q("a", voce);
            if (link) {
                if (attiva) link.setAttribute("aria-current", "true");
                else link.removeAttribute("aria-current");
            }
        }
        if (etichettaCanto) {
            const voce = vociMenu.find((v) => v.dataset.selettoreVoce === idCorrente);
            const numero = voce ? q(".selettore-numero", voce)?.textContent : "";
            etichettaCanto.textContent = numero ? `Canto ${numero}` : "Vai al canto…";
            for (const altra of vociMenu) {
                if (altra === voce) altra.setAttribute("aria-current", "true");
                else altra.removeAttribute("aria-current");
            }
        }
        for (const link of navCanti) {
            if (link.dataset.navCanto === idCorrente) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        }
        for (const punto of binario) {
            if (punto.dataset.binario === idCorrente) punto.setAttribute("aria-current", "page");
            else punto.removeAttribute("aria-current");
        }
    }

    if (canti.length && "IntersectionObserver" in window) {
        const osservatoreCanti = new IntersectionObserver(
            (voci) => {
                const visibili = voci
                    .filter((v) => v.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visibili.length) {
                    idCorrente = visibili[0].target.id;
                    segnalaCorrente();
                }
            },
            { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
        );
        for (const canto of canti) osservatoreCanti.observe(canto);
    } else if (canti.length) {
        idCorrente = canti[0].id;
        segnalaCorrente();
    }

    /**
     * Indice del canto che occupa la parte alta dello schermo.
     *
     * I tasti ← → devono muoversi a partire da qui: prima i due collegamenti
     * erano cercati una volta sola in tutta la pagina e puntavano sempre alla
     * navigazione del canto I, così la freccia destra riportava sempre al
     * canto II e la sinistra al canto I da qualunque punto del testo.
     */
    function indiceCantoVisibile() {
        if (!canti.length) return -1;
        const soglia = window.innerHeight * 0.35;
        /* −1 significa «sopra il primo canto»: chi è sulla copertina non ha
           ancora cominciato a leggere, e la freccia destra deve portarlo al
           canto I, non saltarlo. */
        let scelto = -1;
        for (let i = 0; i < canti.length; i++) {
            if (canti[i].getBoundingClientRect().top <= soglia) scelto = i;
        }
        return scelto;
    }

    function vaiAlCanto(passo) {
        const corrente = indiceCantoVisibile();
        if (corrente < 0 && passo < 0) return false;
        const destinazione = canti[Math.max(0, corrente + passo)];
        if (!destinazione || destinazione === canti[corrente]) return false;
        window.location.hash = destinazione.id;
        return true;
    }

    /*
     * L'osservatore segnala il canto quando la fascia di lettura cambia. Ma se
     * l'ultimo cambiamento è avvenuto a metà di uno scorrimento lungo — un
     * salto dal binario, un collegamento a #canto-21 — il canto evidenziato
     * resta quello di passaggio, mentre sotto gli occhi ce n'è già un altro:
     * menu, indice e binario indicavano il canto precedente a quello appena
     * aperto. All'assestarsi dello scorrimento si ricalcola dalla posizione,
     * con la stessa regola delle frecce ← →, e le quattro indicazioni tornano
     * a dire la stessa cosa.
     */
    function allineaCantoCorrente() {
        const indice = indiceCantoVisibile();
        if (indice < 0) return;
        const canto = canti[indice];
        if (!canto || canto.id === idCorrente) return;
        idCorrente = canto.id;
        segnalaCorrente();
    }

    if (canti.length) {
        if ("onscrollend" in window) {
            /* Dice esattamente il momento giusto, senza indovinare. */
            window.addEventListener("scrollend", allineaCantoCorrente);
        } else {
            let assestamento = null;
            window.addEventListener(
                "scroll",
                () => {
                    clearTimeout(assestamento);
                    assestamento = setTimeout(allineaCantoCorrente, 260);
                },
                { passive: true },
            );
        }
    }

    /* ----------------------------------------------------------------------
       Lightbox delle tavole incise
       ---------------------------------------------------------------------- */

    const tavole = qa("[data-tavola]").map((elemento) => {
        const img = q("img", elemento);
        return {
            elemento,
            src: img?.getAttribute("src") || "",
            alt: img?.getAttribute("alt") || "",
            didascalia: elemento.dataset.didascalia || "",
            versi: elemento.dataset.versi || "",
            credito: elemento.dataset.credito || "",
        };
    });

    let indiceTavola = 0;
    let elementoPrecedente = null;
    let lightbox = null;
    const immaginiInAnticipo = new Map();

    function precarica(indice) {
        if (!tavole.length) return;
        const tavola = tavole[(indice + tavole.length) % tavole.length];
        if (!tavola?.src || immaginiInAnticipo.has(tavola.src)) return;
        const anticipo = new Image();
        anticipo.decoding = "async";
        anticipo.src = tavola.src;
        immaginiInAnticipo.set(tavola.src, anticipo);
    }

    /** Elementi che possono ricevere il fuoco dentro un riquadro modale. */
    const SELEZIONE_FUOCO = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const sfondoModale = () => qa("body > header, body > main, body > footer, body > .torna-su");

    /** Isola la pagina di fondo finché un riquadro modale è aperto. */
    function bloccaSfondo(bloccato) {
        for (const elemento of sfondoModale()) {
            if (bloccato) {
                elemento.setAttribute("inert", "");
                elemento.setAttribute("aria-hidden", "true");
            } else {
                elemento.removeAttribute("inert");
                elemento.removeAttribute("aria-hidden");
            }
        }
    }

    function tieniFocus(evento, scatola) {
        if (evento.key !== "Tab" || !scatola) return;
        const fuochi = qa(SELEZIONE_FUOCO, scatola).filter((el) => el.offsetParent !== null);
        if (!fuochi.length) return;
        const primo = fuochi[0];
        const ultimo = fuochi[fuochi.length - 1];
        if (evento.shiftKey && document.activeElement === primo) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primo.focus();
        }
    }

    function costruisciLightbox() {
        const scatola = document.createElement("div");
        scatola.className = "lightbox";
        scatola.dataset.aperto = "false";
        scatola.setAttribute("role", "dialog");
        scatola.setAttribute("aria-modal", "true");
        scatola.setAttribute("aria-label", "Tavola a piena pagina");
        scatola.innerHTML = `
            <div class="lightbox-testa">
                <span class="lightbox-contatore"></span>
                <span class="lightbox-comandi">
                    <button type="button" data-lightbox-prev>← Precedente</button>
                    <button type="button" data-lightbox-next>Successiva →</button>
                    <button type="button" data-lightbox-chiudi>Chiudi ✕</button>
                </span>
            </div>
            <figure class="lightbox-figura"><img alt=""></figure>
            <div class="lightbox-didascalia">
                <p></p>
                <small></small>
            </div>`;
        document.body.appendChild(scatola);

        q("[data-lightbox-prev]", scatola).addEventListener("click", () => vai(-1));
        q("[data-lightbox-next]", scatola).addEventListener("click", () => vai(1));
        q("[data-lightbox-chiudi]", scatola).addEventListener("click", chiudi);
        scatola.addEventListener("click", (evento) => {
            if (evento.target === scatola || evento.target.classList.contains("lightbox-figura")) {
                chiudi();
            }
        });
        scatola.addEventListener("keydown", (evento) => tieniFocus(evento, scatola));

        // Scorrimento orizzontale col dito, come nelle gallerie.
        let partenza = null;
        scatola.addEventListener(
            "touchstart",
            (evento) => {
                partenza = evento.changedTouches[0]?.clientX ?? null;
            },
            { passive: true },
        );
        scatola.addEventListener(
            "touchend",
            (evento) => {
                if (partenza === null) return;
                const fine = evento.changedTouches[0]?.clientX ?? partenza;
                const scarto = fine - partenza;
                if (Math.abs(scarto) > 45) vai(scarto < 0 ? 1 : -1);
                partenza = null;
            },
            { passive: true },
        );

        return scatola;
    }

    function mostraIndice(i) {
        if (!lightbox || !tavole.length) return;
        indiceTavola = (i + tavole.length) % tavole.length;
        const tavola = tavole[indiceTavola];
        const img = q("img", lightbox);
        img.src = tavola.src;
        img.alt = tavola.alt;
        q(".lightbox-didascalia p", lightbox).textContent = tavola.didascalia;
        q(".lightbox-didascalia small", lightbox).textContent = [tavola.versi, tavola.credito]
            .filter(Boolean)
            .join(" — ");
        q(".lightbox-contatore", lightbox).textContent = `Tavola ${indiceTavola + 1} di ${tavole.length}`;
        q("[data-lightbox-prev]", lightbox).disabled = tavole.length < 2;
        q("[data-lightbox-next]", lightbox).disabled = tavole.length < 2;

        precarica(indiceTavola + 1);
        precarica(indiceTavola - 1);
    }

    function vai(passo) {
        mostraIndice(indiceTavola + passo);
    }

    const lightboxAperto = () => Boolean(lightbox && lightbox.dataset.aperto === "true");

    function apri(indice, origine) {
        if (!lightbox) lightbox = costruisciLightbox();
        elementoPrecedente = origine || null;
        mostraIndice(indice);
        lightbox.dataset.aperto = "true";
        document.body.classList.add("modale-aperto");
        bloccaSfondo(true);
        q("[data-lightbox-chiudi]", lightbox).focus();
    }

    function chiudi() {
        if (!lightboxAperto()) return;
        lightbox.dataset.aperto = "false";
        document.body.classList.remove("modale-aperto");
        bloccaSfondo(false);
        if (elementoPrecedente) elementoPrecedente.focus();
    }

    tavole.forEach((tavola, i) => {
        tavola.elemento.addEventListener("click", (evento) => {
            if (evento.target.closest("a")) return;
            apri(i, tavola.elemento);
        });
    });

    /* ----------------------------------------------------------------------
       Pannello delle scorciatoie da tastiera (tasto ?)
       ---------------------------------------------------------------------- */

    let aiuto = null;
    let elementoPrimaAiuto = null;
    const aiutoAperto = () => Boolean(aiuto && aiuto.dataset.aperto === "true");

    function scorciatoieDisponibili() {
        const elenco = [];
        if (ricerca) elenco.push(["/", "Cerca fra i canti"]);
        if (canti.length) elenco.push(["← →", "Canto precedente o successivo"]);
        elenco.push(["t", "Cambia tema (notte / pergamena)"]);
        if (tavole.length) elenco.push(["Esc", "Chiudi la tavola a piena pagina"]);
        elenco.push(["?", "Mostra o nascondi questo pannello"]);
        return elenco;
    }

    function apriAiuto() {
        if (!aiuto) {
            aiuto = document.createElement("div");
            aiuto.className = "lightbox aiuto";
            aiuto.dataset.aperto = "false";
            aiuto.setAttribute("role", "dialog");
            aiuto.setAttribute("aria-modal", "true");
            aiuto.setAttribute("aria-label", "Scorciatoie da tastiera");
            const voci = scorciatoieDisponibili()
                .map(([tasto, testo]) => `<dt><kbd>${tasto}</kbd></dt><dd>${testo}</dd>`)
                .join("");
            aiuto.innerHTML = `
                <div class="aiuto-scheda">
                    <h2 id="aiuto-titolo">Scorciatoie da tastiera</h2>
                    <dl>${voci}</dl>
                    <button type="button" data-aiuto-chiudi>Chiudi ✕</button>
                </div>`;
            document.body.appendChild(aiuto);
            aiuto.addEventListener("click", (evento) => {
                if (evento.target === aiuto) chiudiAiuto();
            });
            q("[data-aiuto-chiudi]", aiuto).addEventListener("click", chiudiAiuto);
            aiuto.addEventListener("keydown", (evento) => tieniFocus(evento, aiuto));
        }
        // Chi ha aperto il pannello deve ritrovare il fuoco dove l'aveva.
        elementoPrimaAiuto = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        aiuto.dataset.aperto = "true";
        document.body.classList.add("modale-aperto");
        bloccaSfondo(true);
        q("[data-aiuto-chiudi]", aiuto).focus();
    }

    function chiudiAiuto() {
        if (!aiutoAperto()) return;
        aiuto.dataset.aperto = "false";
        document.body.classList.remove("modale-aperto");
        bloccaSfondo(false);

        const torna = elementoPrimaAiuto;
        elementoPrimaAiuto = null;
        if (torna && torna !== document.body && document.contains(torna)) torna.focus();
    }

    /* ----------------------------------------------------------------------
       Versi: citazione e rimando diretto alla terzina
       ---------------------------------------------------------------------- */

    const NUMERI = [
        "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
        "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII",
        "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX", "XXXI",
        "XXXII", "XXXIII", "XXXIV",
    ];

    let brindisi = q(".brindisi");
    let timerBrindisi = null;

    function annuncia(testo) {
        if (!brindisi) {
            brindisi = document.createElement("div");
            brindisi.className = "brindisi";
            brindisi.setAttribute("role", "status");
            document.body.appendChild(brindisi);
        }
        brindisi.textContent = testo;
        brindisi.dataset.visibile = "true";
        clearTimeout(timerBrindisi);
        timerBrindisi = setTimeout(() => {
            brindisi.dataset.visibile = "false";
        }, 2600);
    }

    function copiaConCampo(testo) {
        const campo = document.createElement("textarea");
        campo.value = testo;
        campo.setAttribute("readonly", "");
        campo.style.position = "fixed";
        campo.style.top = "-1000px";
        document.body.appendChild(campo);
        campo.select();
        let esito = false;
        try {
            esito = document.execCommand("copy");
        } catch (e) {
            esito = false;
        }
        campo.remove();
        annuncia(esito ? "Citazione copiata: " + testo : "Rimando: " + testo);
    }

    function copia(testo) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(testo).then(
                () => annuncia("Citazione copiata: " + testo),
                () => copiaConCampo(testo),
            );
            return;
        }
        copiaConCampo(testo);
    }

    function rendiAttiva(terzina) {
        for (const altra of qa(".terzina.attiva")) altra.classList.remove("attiva");
        terzina.classList.add("attiva");
    }

    function testoTerzina(terzina) {
        return qa(".v", terzina)
            .map((v) => v.textContent.replace(/^\d+/, "").trim())
            .join(" ");
    }

    function riferimentoTerzina(terzina) {
        const canto = Number(terzina.dataset.canto);
        const da = Number(terzina.dataset.verso);
        const a = Number(terzina.dataset.versoFine);
        return "Inf. " + (NUMERI[canto - 1] || canto) + ", " + (da === a ? da : da + "–" + a);
    }

    // Le terzine si toccano per copiare il rimando. Non le rendo raggiungibili
    // con il tasto Tab: in una pagina di 4.720 versi sarebbero milleseicento
    // fermate. Per la tastiera valgono i rimandi «Leggi la terzina» delle tavole.
    const terzine = qa(".terzina[data-canto]");
    for (const terzina of terzine) {
        const riferimento = riferimentoTerzina(terzina);
        terzina.addEventListener("click", () => {
            rendiAttiva(terzina);
            history.replaceState(null, "", "#" + terzina.id);
            copia(riferimento + " — " + testoTerzina(terzina));
        });
        terzina.title = "Copia il rimando: " + riferimento;
    }

    function apriDaIndirizzo() {
        const frammento = decodeURIComponent(window.location.hash.replace(/^#/, ""));
        if (!frammento || !/^c\d+v\d+$/.test(frammento)) return;
        const terzina = document.getElementById(frammento);
        if (!terzina) return;
        rendiAttiva(terzina);
        terzina.scrollIntoView({ block: "center" });
    }

    /* ----------------------------------------------------------------------
       Rimandi «Leggi la terzina» e scorciatoie globali
       ---------------------------------------------------------------------- */

    document.addEventListener("click", (evento) => {
        const rimando = evento.target.closest("[data-vai-a-verso]");
        if (!rimando) return;
        const terzina = document.getElementById(rimando.dataset.vaiAVerso);
        if (!terzina) return;
        evento.preventDefault();
        rendiAttiva(terzina);
        history.replaceState(null, "", "#" + terzina.id);
        terzina.scrollIntoView({ behavior: scorrimentoFluido(), block: "center" });
    });

    document.addEventListener("keydown", (evento) => {
        // I comandi già usati da un componente (frecce nel menu dei canti,
        // nel lightbox, nel pannello delle scorciatoie) non devono ricadere
        // qui e muovere anche la pagina.
        if (evento.defaultPrevented) return;

        /* Con un tasto di comando premuto la scorciatoia non vale: Alt+← e
           Alt+→ sono Indietro e Avanti del browser, Ctrl+T apre una scheda.
           Il tasto delle maiuscole invece resta ammesso, perché su molte
           tastiere «?» e «/» si scrivono proprio con quello. */
        if (evento.ctrlKey || evento.metaKey || evento.altKey) return;

        const dentroCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");

        if (evento.key === "Escape") {
            if (lightboxAperto()) {
                chiudi();
                return;
            }
            if (aiutoAperto()) {
                chiudiAiuto();
                return;
            }
            if (chiudiMenuCanti && chiudiMenuCanti()) return;
            if (dentroCampo) document.activeElement.blur();
            return;
        }

        if (lightboxAperto()) {
            if (evento.key === "ArrowRight") {
                evento.preventDefault();
                vai(1);
            } else if (evento.key === "ArrowLeft") {
                evento.preventDefault();
                vai(-1);
            }
            return;
        }

        if (aiutoAperto()) return;
        if (dentroCampo) return;

        if (evento.key === "?") {
            evento.preventDefault();
            apriAiuto();
            return;
        }

        if (evento.key === "/" && ricerca) {
            evento.preventDefault();
            ricerca.focus();
            ricerca.select();
            return;
        }

        if (evento.key === "ArrowRight") {
            if (vaiAlCanto(1)) evento.preventDefault();
            return;
        }
        if (evento.key === "ArrowLeft") {
            if (vaiAlCanto(-1)) evento.preventDefault();
            return;
        }

        if (evento.key.toLowerCase() === "t") giraTema();
    });

    q('[data-azione="tema"]')?.addEventListener("click", giraTema);

    /* ----------------------------------------------------------------------
       Evidenzia nel menu la sezione che si sta leggendo
       ---------------------------------------------------------------------- */

    const collegamentiSezione = qa(".nav-links a[href^='#']");
    if (collegamentiSezione.length && "IntersectionObserver" in window) {
        const perId = new Map(
            collegamentiSezione.map((link) => [link.getAttribute("href").slice(1), link]),
        );
        const inVista = new Set();
        const ordine = [...perId.keys()];

        const evidenzia = () => {
            // Fra le sezioni dentro la fascia si sceglie la più avanzata nel
            // documento.
            let scelta = null;
            for (const id of ordine) if (inVista.has(id)) scelta = id;

            // Fuori da tutte le fasce — succede in fondo alla pagina, sotto
            // l'ultima sezione — vale l'ultima cominciata, altrimenti la voce
            // accesa resterebbe quella di un capitolo già finito.
            if (!scelta) {
                const limite = window.innerHeight * 0.35;
                for (const id of ordine) {
                    const sezione = document.getElementById(id);
                    if (sezione && sezione.getBoundingClientRect().top <= limite) scelta = id;
                }
            }

            if (!scelta) return;
            for (const altro of collegamentiSezione) altro.removeAttribute("aria-current");
            perId.get(scelta)?.setAttribute("aria-current", "true");
        };

        const osservatoreSezioni = new IntersectionObserver(
            (voci) => {
                for (const voce of voci) {
                    if (voce.isIntersecting) inVista.add(voce.target.id);
                    else inVista.delete(voce.target.id);
                }
                evidenzia();
            },
            { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
        );
        for (const id of perId.keys()) {
            const sezione = document.getElementById(id);
            if (sezione) osservatoreSezioni.observe(sezione);
        }
    }

    /* ----------------------------------------------------------------------
       Mappa dei nove cerchi (pagina iniziale)
       ---------------------------------------------------------------------- */

    const datiCerchi = q("[data-dati-cerchi]");
    if (datiCerchi) {
        let cerchi = [];
        try {
            cerchi = JSON.parse(datiCerchi.textContent);
        } catch (e) {
            cerchi = [];
        }

        const scheda = q("[data-scheda-cerchio]");
        const pastiglie = qa("[data-scelta-cerchio]");
        const disegni = qa("[data-cerchio]");
        let timerScheda = null;

        /*
         * Il livello scelto si legge anche dall'indirizzo (#cerchio-VIII): così
         * un cerchio si può linkare, e ricaricando la pagina si torna sullo
         * stesso invece che sul primo.
         */
        function cerchioDallIndirizzo() {
            const frammento = decodeURIComponent(window.location.hash.replace(/^#/, ""));
            const trovato = /^cerchio-([ivxlcdm]+|\d+)$/i.exec(frammento);
            if (!trovato) return 0;
            const scritto = trovato[1].toUpperCase();
            const indice = /^\d+$/.test(scritto)
                ? Number(scritto) - 1
                : cerchi.findIndex((c) => String(c.numero).toUpperCase() === scritto);
            return indice >= 0 && indice < cerchi.length ? indice : 0;
        }

        /* La scheda entra a ogni cambio di livello; la classe si toglie da sola
           poco dopo, così la dissolvenza non può lasciarla invisibile. */
        function faiEntrareScheda() {
            if (!scheda) return;
            scheda.classList.remove("entrata");
            void scheda.offsetWidth;
            scheda.classList.add("entrata");
            clearTimeout(timerScheda);
            timerScheda = setTimeout(() => scheda.classList.remove("entrata"), 420);
        }

        function mostraCerchio(indice, annotaIndirizzo) {
            const cerchio = cerchi[indice];
            if (!cerchio || !scheda) return;
            scheda.dataset.cerchio = String(indice);
            faiEntrareScheda();
            /* I campi che senza copione resterebbero vuoti si scoprono adesso
               che c'è qualcosa da mostrare. */
            for (const campo of qa("[data-scheda-campo]", scheda)) campo.hidden = false;
            q("[data-scheda-numero]", scheda).textContent = cerchio.numero;
            q("[data-scheda-nome]", scheda).textContent = cerchio.nome;
            q("[data-scheda-testo]", scheda).textContent = cerchio.testo;
            q("[data-scheda-peccatori]", scheda).textContent = cerchio.peccatori;
            q("[data-scheda-pena]", scheda).textContent = cerchio.pena;
            q("[data-scheda-dannati]", scheda).textContent = cerchio.dannati;
            const canti = q("[data-scheda-canti]", scheda);
            canti.textContent = "Leggi i canti " + cerchio.canti + " →";
            canti.href = "inferno.html#canto-" + cerchio.cantoIniziale;

            /* Si tocca l'indirizzo solo su scelta dell'utente: all'apertura
               della pagina cancellerebbe l'ancora con cui si è arrivati.
               Nello stesso momento la scheda diventa una regione viva, così
               il lettore di schermo annuncia il cambio di livello — ma non
               legge l'intera scheda al caricamento della pagina. */
            if (annotaIndirizzo) {
                scheda.setAttribute("aria-live", "polite");
                history.replaceState(null, "", "#cerchio-" + cerchio.numero);
            }

            for (const pastiglia of pastiglie) {
                pastiglia.setAttribute("aria-pressed", String(Number(pastiglia.dataset.sceltaCerchio) === indice));
            }
            for (const disegno of disegni) {
                disegno.setAttribute("aria-pressed", String(Number(disegno.dataset.cerchio) === indice));
            }
        }

        for (const disegno of disegni) {
            const indice = Number(disegno.dataset.cerchio);
            const cerchio = cerchi[indice];
            disegno.addEventListener("click", () => mostraCerchio(indice, true));
            disegno.addEventListener("keydown", (evento) => {
                if (evento.key === "Enter" || evento.key === " ") {
                    evento.preventDefault();
                    mostraCerchio(indice, true);
                }
            });
            disegno.tabIndex = 0;
            disegno.setAttribute("role", "button");
            disegno.setAttribute("aria-controls", "scheda-cerchio");
            /* Sull'imbuto ogni livello è un pulsante: senza nome, un lettore di
               schermo annuncerebbe solo il numero che ci sta dentro. */
            if (cerchio) {
                disegno.setAttribute("aria-label", `Cerchio ${cerchio.numero} — ${cerchio.nome}`);
            }
        }
        for (const pastiglia of pastiglie) {
            pastiglia.setAttribute("aria-controls", "scheda-cerchio");
            pastiglia.addEventListener("click", () =>
                mostraCerchio(Number(pastiglia.dataset.sceltaCerchio), true)
            );
        }

        mostraCerchio(cerchioDallIndirizzo());
    }

    /* ----------------------------------------------------------------------
       Avvio
       ---------------------------------------------------------------------- */

    /* ----------------------------------------------------------------------
       Ancore sotto la testata fissa
       L'altezza della testata cambia con la larghezza dello schermo e con
       l'ingrandimento del testo: invece di indovinarla con una misura fissa,
       si legge e si passa al browser come margine di scorrimento, così un
       salto a un capitolo non finisce mai con il titolo nascosto.
       ---------------------------------------------------------------------- */

    const testata = q(".site-header");

    function allineaAncore() {
        if (!testata) return;
        document.documentElement.style.scrollPaddingTop = `${testata.offsetHeight + 12}px`;
    }

    allineaAncore();
    window.addEventListener("resize", allineaAncore);

    window.addEventListener("scroll", programmaAvanzamento, { passive: true });
    window.addEventListener("resize", programmaAvanzamento);
    window.addEventListener("hashchange", apriDaIndirizzo);
    aggiornaAvanzamento();
    apriDaIndirizzo();
})();
