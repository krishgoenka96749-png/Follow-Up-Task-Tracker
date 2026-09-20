#!/usr/bin/env python3
"""Local dev server for the Follow Up Task Tracker page.

Serves index.html untouched on disk, with dev/seed.js + dev/mock-claude.js
injected into <head> on the way out, so window.claude exists before the page's
own script runs. index.html itself never references the mock.

    python3 dev/server.py            # http://localhost:8000
    python3 dev/server.py 8080

Useful URLs:
    /                 the page against the mock store
    /?fresh           reseed from dev/seed.js
    /?db=none         disconnected state (use("db") -> null)
    /?sample=none     Refine hidden (use("sample") -> null)
    /?sample=rate_limited   next refine rejects with that code

Nothing here ships: the published artifact gets index.html alone.
"""

import functools
import http.server
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INJECT = (
    '\n<!-- dev harness: injected by dev/server.py, not part of index.html -->\n'
    '<script src="/dev/seed.js"></script>\n'
    '<script src="/dev/mock-claude.js"></script>\n'
)


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path in ("/", "/index.html"):
            return self.serve_page()
        return super().do_GET()

    def serve_page(self):
        try:
            with open(os.path.join(ROOT, "index.html"), "r", encoding="utf-8") as fh:
                html = fh.read()
        except OSError as exc:
            self.send_error(500, f"cannot read index.html: {exc}")
            return
        marker = "<head>"
        if marker not in html:
            self.send_error(500, "index.html has no <head> to inject into")
            return
        html = html.replace(marker, marker + INJECT, 1)
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        if self.path.startswith("/dev/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(Handler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Follow Up Task Tracker dev harness -> http://localhost:{port}/  (Ctrl-C to stop)")
        print("  ?fresh reseeds · ?db=none disconnected · ?sample=none hides Refine")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
