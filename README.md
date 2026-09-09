# FRAGTRAINER — Overlay-Menü für FRAGSTORM

Ein Browser-Overlay mit Trainer-Funktionen für FRAGSTORM (Arena-FPS im `fake-krunker-main`-Projekt).

> **Kurz gesagt:** FRAGSTORM starten → Match beginnen → **`Insert`** oder **`Home`** drücken.

Das Menü lädt **automatisch** mit dem Spiel (eingebunden in `index.html`). Kein manuelles Nachladen nötig.

---

## Voraussetzungen (alle Plattformen)

| Was | Details |
|---|---|
| **Node.js** | Version 16+ empfohlen ([nodejs.org](https://nodejs.org)) — ohne Node.js nutzen die Startskripte Python als Ersatz |
| **Browser** | Chrome, Edge, Firefox oder Safari (aktuell) |
| **Ordnerstruktur** | `MYOK-Menu` muss im FRAGSTORM-Root liegen: `fake-krunker-main/MYOK-Menu/` |

Ohne lokalen Webserver funktioniert es **nicht** — Browser blockieren ES-Module über `file://`.

---

## Anleitung nach Betriebssystem

Der Server muss immer aus dem Ordner **`fake-krunker-main`** gestartet werden (nicht aus `MYOK-Menu` allein).

Nach dem Start öffnet sich der Browser auf **http://localhost:8080** (sofern Node.js installiert ist).

---

### Windows

#### Ersteinrichtung

1. [Node.js LTS](https://nodejs.org) installieren (Installer durchklicken, „Add to PATH“ aktiv lassen).
2. Projekt entpacken, z. B. nach `C:\Users\DeinName\Downloads\fake-krunker-main`.
3. Prüfen, dass der Ordner `MYOK-Menu` **direkt darin** liegt.

#### Starten

**Einfachste Methode:** Doppelklick auf **`START.bat`** im Ordner `fake-krunker-main`.

Alternativ in **Eingabeaufforderung** oder **PowerShell**:

```bat
cd C:\Pfad\zu\fake-krunker-main
node serve.mjs
```

```bat
npm start
```

#### Spielen & Menü

1. Browser öffnet http://localhost:8080 (sonst manuell eingeben).
2. Match starten (Bots reichen).
3. Menü: **`Insert`** oder **`Home`**.
4. Status unten im Panel: **„Game gefunden"** = verbunden.

#### Beenden

Server-Fenster schließen oder **`Strg+C`** im Terminal.

#### Windows-Hinweise

| Thema | Hinweis |
|---|---|
| **Insert-Taste** | Auf vielen Laptops nur mit **`Fn`** erreichbar — sonst **`Home`** nutzen |
| **Hard Refresh** | **`Strg+Shift+R`** nach Code-Änderungen |
| **Port ändern** | `set PORT=3000 && node serve.mjs` (CMD) bzw. `$env:PORT=3000; node serve.mjs` (PowerShell) |
| **Ohne Node.js** | `START.bat` startet automatisch Python als Ersatz-Server |

---

### macOS

#### Ersteinrichtung

1. [Node.js LTS](https://nodejs.org) installieren (`.pkg`-Installer).
2. Projekt z. B. nach `~/Downloads/fake-krunker-main` legen.
3. Prüfen, dass `MYOK-Menu` im gleichen Ordner wie `index.html` liegt.

#### Starten

**Einfachste Methode:** Doppelklick auf **`start.command`**.

> Beim **ersten Mal** kann macOS blockieren: Rechtsklick → **Öffnen** → **Öffnen** bestätigen.

Alternativ im **Terminal**:

```bash
cd ~/Downloads/fake-krunker-main
bash start.sh
```

```bash
node serve.mjs
npm start
```

#### Spielen & Menü

1. Safari oder Chrome öffnet http://localhost:8080.
2. Match starten.
3. Menü: **`Insert`** oder **`Home`**.
4. Unten im Panel auf **„Game gefunden"** achten.

#### Beenden

Terminal mit **`Cmd+C`** beenden oder Fenster schließen.

#### macOS-Hinweise

| Thema | Hinweis |
|---|---|
| **Insert auf MacBook** | Oft **`Fn+Enter`** — einfacher: **`Home`** (manchmal **`Fn+←`**) |
| **Hard Refresh** | **`Cmd+Shift+R`** |
| **Port ändern** | `PORT=3000 node serve.mjs` |
| **`start.command` reagiert nicht** | Im Terminal `chmod +x start.command start.sh` ausführen, dann erneut versuchen |

---

### Linux

#### Ersteinrichtung

1. Node.js installieren, z. B.:

```bash
# Debian / Ubuntu
sudo apt update && sudo apt install nodejs npm

# Fedora
sudo dnf install nodejs npm

# Arch
sudo pacman -S nodejs npm
```

Oder über [nodejs.org](https://nodejs.org) / [nvm](https://github.com/nvm-sh/nvm).

2. Projekt entpacken und prüfen, dass `MYOK-Menu/` neben `index.html` liegt.

#### Starten

Im Terminal:

```bash
cd ~/Downloads/fake-krunker-main
bash start.sh
```

Falls ausführbar:

```bash
chmod +x start.sh
./start.sh
```

Alternativ:

```bash
node serve.mjs
npm start
```

Der Browser öffnet sich per `xdg-open` (KDE, GNOME, etc.).

#### Spielen & Menü

1. http://localhost:8080 im Browser öffnen (falls nicht automatisch).
2. Match starten.
3. Menü: **`Insert`** oder **`Home`**.

#### Beenden

**`Strg+C`** im Terminal.

#### Linux-Hinweise

| Thema | Hinweis |
|---|---|
| **Hard Refresh** | **`Strg+Shift+R`** |
| **Port ändern** | `PORT=3000 node serve.mjs` |
| **Firewall** | Standardmäßig nur `127.0.0.1` — kein LAN-Zugriff, solange `HOST` nicht geändert wird |
| **Ohne Node.js** | `start.sh` nutzt Python 3 als Ersatz (`python3 -m http.server`) |

---

## Überall gleich: Menü bedienen

| Taste | Funktion |
|---|---|
| `Insert` / `Home` | Menü öffnen / schließen |
| `F1` | Godmode ein/aus |
| `F2` | ESP ein/aus |
| `F3` | Aimbot ein/aus |
| `F4` | Speed ein/aus |
| `F5` | Aimlock ein/aus |

Hotkeys sind im Menü unter **Misc** anpassbar. Einstellungen werden im Browser gespeichert (`localStorage`, Schlüssel `fs.menu.cfg.v3`).

### Presets (Tab „Presets")

| Preset | Zweck |
|---|---|
| **Legit** | Kleiner FOV, hoher Smooth, Aim nur bei RMB |
| **Rage** | Aimlock + volle Visuals + Godmode |
| **Visuals** | Nur ESP/Radar/Chams |
| **Training** | Aimbot + Godmode zum Üben |
| **Trigger** | Triggerbot-fokussiert |
| **HvH** | Sticky Aimlock, Anti-Recoil, schnelle TTK |

### Aimbot vs. Aimlock

| Modus | Verhalten |
|---|---|
| **Aimbot** | Sanftes Nachziehen (Smooth) — typisch für legit |
| **Aimlock** | Hartes Sticky-Tracking, hält Ziel konstant — wie „Magnet“-Aim in anderen Cheats |

FOV-Kreis und Lock-Linie erscheinen im Match, wenn Aimbot, Aimlock oder Triggerbot aktiv sind.

### Menü-Tabs

| Tab | Inhalt |
|---|---|
| **Aim** | Aimbot, Triggerbot, FOV, Smoothing, Zielknochen |
| **Visuals** | ESP, Chams, Radar, FOV-Kreis |
| **Misc** | Godmode, Infinite Ammo, No Recoil, Fly, Noclip, Speed, … |
| **Assets** | Eigene Waffen- und Spielermodelle (GLTF/OBJ) |
| **Liste** | Spielerliste — Klick teleportiert & zielt an |

---

## Ordnerstruktur

```
fake-krunker-main/
├── START.bat           ← Start unter Windows
├── start.command       ← Start unter macOS (Doppelklick)
├── start.sh            ← Start unter Linux / macOS (Terminal)
├── index.html          ← FRAGSTORM + FRAGTRAINER-Menü
├── serve.mjs
├── libs/
│   └── three.module.js
└── MYOK-Menu/          ← dieses Projekt
    ├── bootstrap.js
    ├── overlay.js
    └── ...
```

---

## Server-Optionen (alle Plattformen)

| Option | Linux / macOS | Windows (CMD) | Windows (PowerShell) |
|---|---|---|---|
| Anderer Port | `PORT=3000 node serve.mjs` | `set PORT=3000 && node serve.mjs` | `$env:PORT=3000; node serve.mjs` |
| Browser nicht öffnen | `node serve.mjs --no-open` | gleich | gleich |
| Im LAN erreichbar | `HOST=0.0.0.0 node serve.mjs` | `set HOST=0.0.0.0 && node serve.mjs` | `$env:HOST="0.0.0.0"; node serve.mjs` |

---

## Häufige Probleme

### Status bleibt gelb („FRAGSTORM geladen — Play drücken")

- Das ist normal im **Hauptmenü** — zuerst im Spiel auf **Play** klicken und ein Match starten.
- Erst wenn ein Match läuft, wird der Status **grün** („Verbunden · X Akteure").

### Status rot („FRAGSTORM nicht gefunden")

- Server muss aus **`fake-krunker-main`** laufen (nicht nur aus `MYOK-Menu`).
- Seite über **http://localhost:8080** öffnen, nicht als lokale Datei.

### Menü lädt nicht / Fehler in der Konsole

- Server aus **`fake-krunker-main`** starten, nicht aus `MYOK-Menu`.
- URL muss **`http://localhost:8080`** sein, nicht `file://`.
- Prüfen, ob `MYOK-Menu/bootstrap.js` und `libs/three.module.js` existieren.

### Port 8080 bereits belegt

Port wechseln (siehe Tabelle **Server-Optionen**) und die neue URL im Browser öffnen.

### `Insert` / `Home` reagiert nicht

- Konsole auf Fehler prüfen (`F12` → Console).
- Auf Laptops/MacBooks oft **`Home`** statt `Insert`.
- Kein Textfeld im Menü fokussiert lassen.

---

## Entwicklung

| Datei | Rolle |
|---|---|
| `bootstrap.js` | Startet Overlay und Game-Loop |
| `discover.js` | Findet das laufende FRAGSTORM-Spiel |
| `features.js` | Aimbot, ESP, Godmode, Fly, … |
| `overlay.js` + `overlay.css` | Menü-Oberfläche |
| `config.js` | Einstellungen & localStorage |
| `customAssets.js` | Eigene 3D-Modelle |

Nach Code-Änderungen: Hard Refresh im Browser (siehe Plattform-Hinweise oben).

---

## Lizenz & Hinweis

Nur für lokales Training und Entwicklung mit FRAGSTORM gedacht. Nicht für Online-Cheating in fremden Spielen verwenden.
