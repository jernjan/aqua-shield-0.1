#!/usr/bin/env python3
"""
Simple HTTP server for vessel dashboard.
Serves files from current directory (default port 8082).
"""

import http.server
import socketserver
import os
import argparse

DEFAULT_PORT = 8082
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Enable CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run vessel dashboard static server')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help='Port to serve vessel dashboard on')
    args = parser.parse_args()
    port = args.port

    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", port), MyHTTPRequestHandler) as httpd:
        print(f"🚢 Vessel Dashboard server running on http://localhost:{port}")
        print(f"📂 Serving files from: {DIRECTORY}")
        print("\nPress Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n✓ Server stopped")
