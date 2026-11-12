# Ontwerp: Fork-sync met upstream + Architectuurdocumentatie

Datum: 2026-11-12
Status: goedgekeurd door gebruiker

## Context

Deze repo (Terminal-WOO/nl-wallet) is een fork van MinBZK/nl-wallet en liep
6.727 commits achter op upstream (laatste upstream-commit: 2026-11-12).
Het eigen werk bestaat uit:

- 6 gecommitte commits (alleen `mockup-signer/`, `.gitignore`,
  `.github/workflows/deploy-mockup.yml`) — conflictvrij t.o.v. upstream
- ±27 uncommitted bestanden (+800/−391 regels): wallet_app POC-integratie
  (disclosure/QR/splash/mock, ±518 regels) en iOS/Android/macOS
  platformconfiguratie; 21 daarvan overlappen met upstream-wijzigingen
- Nieuwe zelfstandige POC-mappen: `document-signer/`, `poc-example/`,
  `POC_GUIDE.md`, `POC_GUIDE_APPLE.md`

## Beslissingen

1. **Sync-strategie (gekozen door gebruiker):** uncommitted wallet_app-werk
   gaat naar branch `poc/wallet-app-integratie`; `main` wordt schoon met
   upstream gemerged. Reden: direct mergen betekent nu meteen ~21
   conflicterende bestanden oplossen tegen een jaar nieuwe
   upstream-architectuur; het POC-integratiewerk moet later toch geport
   worden.
2. **Zelfstandige POC-artefacten op `main`:** `document-signer/`,
   `poc-example/` (zonder node_modules), POC-gidsen — nieuwe mappen die
   nergens met upstream overlappen en dus conflictvrij zijn.
3. **`uiautomation/bin/`** (compileerbinaire artefacten) wordt toegevoegd
   aan `.gitignore`.
4. **Architectuurdoc:** nieuw `ARCHITECTURE.md` in de repo-root, Nederlands.
   Upstream heeft geen root-architectuurdoc, dus geen conflict bij deze of
   toekomstige syncs.

## Stappen

1. Branch `poc/wallet-app-integratie` aanmaken vanaf huidige `main`.
2. Op de poc-branch in twee commits:
   - A: wallet_app POC-integratiecode (`wallet_app/lib/`,
     `wallet_app/packages/`, `wallet_core/flutter_api/src/frb_generated.rs`,
     `wallet_web/package-lock.json`)
   - B: iOS/Android/macOS-platformconfiguratie (gradle wrapper, Podfile(s),
     pbxproj, entitlements, Info.plist, icons, `linux/`, `macos/`, `web/`,
     kotlin-mappen, `.metadata`, RunnerTests)
3. Terug naar `main`: `.gitignore`-regel voor `uiautomation/bin/`; POC-mappen
   + gidsen + dit ontwerpdoc committen.
4. `git merge upstream/main`; verwacht conflict: alleen `.gitignore`
   (combineren). `mockup-signer/` en de POC-mappen blijven onaangeroerd.
5. `ARCHITECTURE.md` schrijven en committen (fork-relatie & sync-model,
   upstream-componenten, eigen POC-componenten, Mermaid-samenhangdiagram,
   port-notities).
6. Push `main` en `poc/wallet-app-integratie` naar origin.

## Verificatie

- `git status` schoon na de merge
- `git diff <oude-main> HEAD -- mockup-signer` is leeg (Pages-deployment
  blijft intact) en `deploy-mockup.yml` aanwezig
- `git rev-list --count main..upstream/main` = 0 na de merge
- Push geslaagd naar origin

## Toekomstig werk (buiten scope)

- Porten van `poc/wallet-app-integratie` naar de nieuwe upstream-architectuur
  (upstream heeft in een jaar o.a. de disclosure-flow en wallet_core API
  doorontwikkeld; `frb_generated.rs` en generated dart-code moeten
  gegenereerd worden tegen de nieuwe wallet_core)
