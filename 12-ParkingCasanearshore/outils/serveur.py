# Serveur HTTP local sans cache pour développer l'exemple :
#   python outils/serveur.py 8771
# (lancé depuis le dossier 12-ParkingCasanearshore). Le navigateur recharge
# toujours la dernière version des scripts.
import http.server
import sys


class SansCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8771
    http.server.ThreadingHTTPServer(("", port), SansCache).serve_forever()
