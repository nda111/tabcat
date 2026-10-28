# tabcat dashboard

Static web dashboard for the [tabcat](https://github.com/nda111/tabcat) browser extension,
served by GitHub Pages at <https://ghyeok.com/tabcat/>.

It has no backend: all data lives in the extension, reached through its content-script bridge.
Install the extension from the `main` branch first; see the README there for setup and the bridge protocol.

Local preview: `python3 -m http.server 8080` in this directory, then open <http://localhost:8080/>.
