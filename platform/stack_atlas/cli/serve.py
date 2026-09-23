"""Serve the already-built dist/ tree for local review."""

from __future__ import annotations

import argparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from stack_atlas.catalog import ROOT


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", default=str(ROOT / "dist"))
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    directory = Path(args.directory).resolve()
    if not (directory / "index.html").is_file():
        parser.error(f"{directory} has no index.html; run `make build` first")
    handler = lambda *handler_args, **kwargs: SimpleHTTPRequestHandler(*handler_args, directory=str(directory), **kwargs)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving {directory} at http://{args.host}:{args.port}/ (Ctrl-C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
