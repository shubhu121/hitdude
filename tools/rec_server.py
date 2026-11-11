"""Serve the project and accept the frames the game's record mode posts.

    python tools/rec_server.py <port> <out_dir>

GET  /...              static files from the project root
POST /__rec/frame/N    writes <out_dir>/f_N.jpg
POST /__rec/batch/N    many frames in one body (4-byte little-endian length, then the JPEG), from frame N
POST /__rec/audio      writes <out_dir>/audio.wav
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
OUT = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(ROOT, "renders", "rec")
os.makedirs(OUT, exist_ok=True)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        n = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(n)
        if self.path.startswith("/__rec/batch/"):
            i = int(self.path.rsplit("/", 1)[1])
            o = 0
            while o + 4 <= len(body):
                ln = int.from_bytes(body[o : o + 4], "little")
                with open(os.path.join(OUT, "f_%05d.jpg" % i), "wb") as f:
                    f.write(body[o + 4 : o + 4 + ln])
                o += 4 + ln
                i += 1
            self.send_response(204)
            self.end_headers()
            return
        if self.path.startswith("/__rec/frame/"):
            name = "".join(c for c in self.path.rsplit("/", 1)[1] if c.isdigit())
            path = os.path.join(OUT, "f_%s.jpg" % name)
        elif self.path == "/__rec/audio":
            path = os.path.join(OUT, "audio.wav")
        else:
            self.send_error(404)
            return
        with open(path, "wb") as f:
            f.write(body)
        self.send_response(204)
        self.end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print("serving", ROOT, "on", PORT, "-> frames to", OUT, flush=True)
    ThreadingHTTPServer.request_queue_size = 64
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
