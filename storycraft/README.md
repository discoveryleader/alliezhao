# StoryCraft

A daily storytelling practice app for designers ("Three Beats"): tell what you noticed, what you did, and the story. Save each entry to a shelf, browse it in the Story Bank, and retell it on the Compression Ladder.

Built from the Claude artifact https://claude.ai/artifact/Au4N3LzjXjLQesrUYw4Px5. The single bundled file was unpacked into plain files:

- `index.html`: the page
- `assets/js/`: the page runtime and components
- `assets/vendor/`: React 18.3.1, served locally instead of from a CDN
- `assets/fonts/`: Inter font files

## Run it

Serve the folder with any static web server, then open http://localhost:8000:

```bash
python3 -m http.server 8000
```

It also works on GitHub Pages. Entries are saved in your browser's local storage.
