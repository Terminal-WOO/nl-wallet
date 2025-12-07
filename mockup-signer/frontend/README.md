# NL Wallet Document Signer Mockup - GitHub Pages

Deze mockup werkt volledig client-side zonder backend en kan worden gehost op GitHub Pages.

## GitHub Pages Setup

1. Ga naar je repository settings op GitHub
2. Navigeer naar "Pages" in het menu
3. Selecteer "GitHub Actions" als source
4. De workflow wordt automatisch uitgevoerd bij elke push naar main

De mockup is dan beschikbaar op: `https://[username].github.io/nl-wallet/mockup-signer/frontend/`

## Lokale Test

Je kunt de mockup lokaal testen zonder backend:

```bash
cd mockup-signer/frontend
python3 -m http.server 8080
```

Open dan: http://localhost:8080/demo.html

## Features

- ✅ Volledig client-side (geen backend nodig)
- ✅ Werkt op GitHub Pages
- ✅ localStorage voor document opslag
- ✅ Mock credentials voor demo
- ✅ QR code simulatie
- ✅ NL Wallet app simulatie
- ✅ Document verificatie via link

## Bestanden

- `demo.html` - Interactieve demo/simulatie
- `verify.html` - Document verificatie pagina
- `index.html` - Startpagina

