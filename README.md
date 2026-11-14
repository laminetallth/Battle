# ⚔️ Anime Battle Arena — Lamine vs Bassirou

Gioco di aste tra due giocatori sullo stesso dispositivo. 20 monete a testa, 4 personaggi per squadra.

**Gioca:** https://laminetallth.github.io/Battle/

## Modalità
- **Asta Classica** — scegli un anime, un personaggio alla volta.
- **Tre Carte** — tre carte per asta; chi apre resta bloccato sulla sua scelta.
- **Multiverso** — personaggi di anime diversi mescolati.

## Note
- Le foto dei personaggi sono caricate nel browser dall'API pubblica [Jikan](https://jikan.moe) (MyAnimeList) e messe in cache; serve la connessione. Se una foto non si trova, la carta mostra nome e iniziali.
- I punteggi finali sono indicativi di gioco, non un verdetto canonico. A parità vince chi ha più monete.
- La partita si salva da sola: puoi riprenderla dal menu. Il tasto ↶ annulla l'ultima mossa.

File: `index.html`, `style.css`, `game.js` (motore, animazioni, audio), `data.js` (anime e personaggi), `images.js` (foto).
