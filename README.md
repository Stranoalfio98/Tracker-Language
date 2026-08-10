# Road to 90 — Diario dei Minuti & Habit Tracker

App web con login personale, database su Supabase e due pagine:
1. **Minuti Giornalieri** — registra i minuti per categoria, semaforo Verde/Giallo/Rosso, "Road to N", calendario con i giorni saltati in rosso.
2. **Habit Tracker classico** — lista di abitudini personalizzabile, spunte ✔/✗, calendario.

Funziona da qualsiasi dispositivo, con i tuoi dati salvati nel cloud.

---

## 1. Supabase — crea il database

1. Vai su [supabase.com](https://supabase.com) → **New project** (se non ne hai già uno per questo scopo; puoi anche riusarne uno esistente, le tabelle create qui non toccano nient'altro).
2. Una volta pronto, apri **SQL Editor** → **New query**.
3. Copia **tutto** il contenuto del file `supabase-schema.sql` (incluso in questo pacchetto), incollalo e premi **Run**.
   - Questo crea 4 tabelle (`minuti_entries`, `habit_entries`, `app_settings`, `app_habits`) con la sicurezza già impostata: ogni utente vede solo i propri dati.
4. Vai su **Authentication → Providers** e assicurati che **Email** sia abilitato (di default lo è).
   - Se vuoi evitare la conferma email (comodo per uso personale), in **Authentication → Settings** disattiva "Confirm email".
5. Vai su **Project Settings → API** e copia due valori, ti serviranno tra poco:
   - **Project URL**
   - **anon public key**

## 2. GitHub — carica il codice

1. Vai su [github.com/new](https://github.com/new), crea un repository (es. `road-to-90`, può essere privato).
2. Scarica questa cartella di progetto sul tuo computer, poi caricala nel repository. Il modo più semplice senza usare la riga di comando:
   - Sulla pagina del repository appena creato, clicca **"uploading an existing file"**
   - Trascina dentro **tutti** i file e le cartelle di questo pacchetto (compresa la cartella `src`)
   - Scrivi un messaggio tipo "Prima versione" e clicca **Commit changes**

## 3. Netlify — pubblica il sito

1. Vai su [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**.
2. Collega il tuo account GitHub e seleziona il repository appena creato.
3. Netlify rileverà automaticamente le impostazioni di build dal file `netlify.toml` incluso (build command `npm run build`, cartella `dist`). Non serve toccare nulla.
4. **Prima di fare Deploy**, vai su **Site settings → Environment variables** e aggiungi:
   - `VITE_SUPABASE_URL` → il Project URL copiato da Supabase
   - `VITE_SUPABASE_ANON_KEY` → la anon public key copiata da Supabase
5. Clicca **Deploy site**. Dopo un paio di minuti avrai un indirizzo tipo `nome-a-caso.netlify.app` — funzionante da telefono, PC, tablet.
6. (Facoltativo) In **Site settings → Domain management** puoi cambiare il nome del sottodominio o collegare un dominio tuo.

## 4. Primo accesso

Apri il link Netlify, clicca **"Non hai un account? Registrati"**, crea il tuo utente con email e password. Se hai lasciato attiva la conferma email su Supabase, controlla la posta prima di accedere.

Da quel momento tutti i dati che inserisci (minuti, habit, impostazioni) sono salvati su Supabase e visibili da qualunque dispositivo su cui fai login con le stesse credenziali.

---

## Sviluppo in locale (facoltativo)

Se vuoi provare l'app sul tuo computer prima di pubblicarla:

```bash
npm install
cp .env.example .env   # poi incolla dentro .env i tuoi valori Supabase
npm run dev
```

## Struttura del progetto

```
road-to-90-app/
  index.html
  package.json
  vite.config.js
  netlify.toml
  supabase-schema.sql   <- da incollare nell'SQL Editor di Supabase
  .env.example
  src/
    main.jsx
    App.jsx             <- tutta l'interfaccia e la logica
    calc.js              <- funzioni di calcolo (semafori, streak, date)
    supabaseClient.js
```
