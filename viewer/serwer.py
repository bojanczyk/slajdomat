#!/usr/bin/env python3

# https://royportas.com/posts/cors-python/
from http.server import BaseHTTPRequestHandler, HTTPServer, SimpleHTTPRequestHandler
from json import dumps, loads
import os
import threading



""" The HTTP request handler """
class RequestHandler(BaseHTTPRequestHandler):

  def _send_cors_headers(self):
      """ Sets headers required for CORS """
      self.send_header("Access-Control-Allow-Origin", "*")
      self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
      self.send_header("Access-Control-Allow-Headers", "x-api-key,Content-Type")

  def send_dict_response(self, d):
      """ Sends a dictionary (JSON) back to the client """
      x = dumps(d)
      self.wfile.write(bytes(x,"utf8"))

  def do_OPTIONS(self):
      self.send_response(200)
      self._send_cors_headers()
      self.end_headers()

  def do_GET(self):
      self.send_response(200)
      self._send_cors_headers()
      self.end_headers()

      response = {}
      response["status"] = "OK"
      self.send_dict_response(response)

  def do_POST(self):
      self.send_response(200)
      self._send_cors_headers()
      self.send_header("Content-Type", "application/json")
      self.end_headers()


      dataLength = int(self.headers["Content-Length"])
      raw = self.rfile.read(dataLength);
      data = loads(raw)
      print(data)
      for key in data:
          print(key)          
          f = open(key+'.svg', "wb")
          f.write(bytes(data[key]))
          f.close()

      response = {}
      response["status"] = "OK"
      self.send_dict_response(response)


def serverThread(name):
    print("backend: Starting server")
    httpd = HTTPServer(("127.0.0.1", 8001), RequestHandler)
    print("backend: Hosting server on port 8001")
    httpd.serve_forever()

def webThread(name):
    print("web: Starting server")
    httpd = HTTPServer(("127.0.0.1", 8000), SimpleHTTPRequestHandler)
    print("web: Hosting server on port 8000")
    httpd.serve_forever()    

x = threading.Thread(target=serverThread,args=(1,))
x.start()
y = threading.Thread(target=webThread,args=(1,))
y.start()




