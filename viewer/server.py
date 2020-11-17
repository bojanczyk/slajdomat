#!/usr/bin/env python3

# https://royportas.com/posts/cors-python/
from http.server import BaseHTTPRequestHandler, HTTPServer, SimpleHTTPRequestHandler
from json import dumps, loads, load
import urllib.parse
import os
import threading



allPresentations = {}
slidesDir = 'slides'
presentationsFileName =  slidesDir + '/presentations.json'

def sanitize(string):
    return urllib.parse.quote(string).replace('%3A','_').replace('%20','_').replace('/','_').replace('%','')




    

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
      global fileToSave
      self.send_response(200)
      self._send_cors_headers()
      self.send_header("Content-Type", "application/json")
      self.end_headers()


      dataLength = int(self.headers["Content-Length"])
      raw = self.rfile.read(dataLength);
      msg = loads(raw)
      
      manifest = None
      response = {}
      response["status"] = "OK"

      # the returns the proper directory for presentation/slide/file
      # the slide parameter can be None
      # if necessary, the appropriate directories are created
      def fileName(presentation, slide, file, suggested = None):
        # try to fetch the presentation directory from the main database, otherwise generate a new file name and store it
        if not presentation in allPresentations:
          allPresentations[presentation] = sanitize(presentation)
          f = open(presentationsFileName,'wb')
          f.write(bytes(dumps(allPresentations,indent=2),'utf-8'))
          f.close()
        retval = slidesDir+'/'+allPresentations[presentation] 
        if not os.path.isdir(retval):
            os.mkdir(retval)
            print("creating  directory for presentation "+retval)

        #  try to fetch the slide directory from the manifest, otherwise generate a new file name and store it
        if slide != None:
          if not slide in manifest['slideDict']:
              #we try to use the suggested name, but if it is already used then we keep on appending x letters until it becomes unused
              suggested = sanitize(suggested)
              while (suggested in manifest['slideDict'].values()):
                suggested = suggested + 'x'
              manifest['slideDict'][slide] = suggested
          retval = retval + '/' + manifest['slideDict'][slide]
          #if the slide directory does not exit, create it
          if not os.path.isdir(retval):
            os.mkdir(retval)
            print("creating directory for slide "+retval)

        return retval + '/' +  file;
        # end of the function fileName
      
      
      if not os.path.isdir(slidesDir):
        os.mkdir(slidesDir)
        print("creating slides directory")
      try:
        json_file = open(presentationsFileName, 'r')
        allPresentations = load(json_file)
      except:
        print("Could not find the presentations file")
        allPresentations = {}
      
      # load the manifest file for the presentation, and otherwise initialise the manifest 
      manifestFile = fileName(msg['presentation'], None, 'manifest.json')
      try:
        json_file = open(manifestFile, 'r')
        manifest = load(json_file)
      except:
        print("Could not find the manifest for the presentation " + msg['presentation'])
        manifest = {'presentation' : msg['presentation'], 'slideDict' : {} , 'soundDict' : {}}
      
      # we are being sent slides from the figma plugin
      if msg['type'] == 'slides':
        print('Receiving slides from figma')
        #copy the slide tree from the message from Figma
        manifest['tree'] = msg['tree']
        
        for slide in msg['slideList']:
            file = fileName(msg['presentation'],slide['database']['id'], 'image.svg',  slide['database']['name'])
            f= open(file,'wb')
            f.write(bytes(slide['svg'],'utf-8'))
            f.close()
      
      # we are being sent a sound from the viewer 
      if msg['type'] == 'wav':
            file = fileName(msg['presentation'],msg['slide'], str(msg['name']))
            print('Receiving sound '+ file)
            f= open(file+'.wav','wb')
            f.write(bytes(msg['file']))
            f.close()

            if not (msg['slide'] in manifest['soundDict']):
                  manifest['soundDict'][msg['slide']] = {}
              
            if 0 != os.system('ffmpeg -y -i '+ file+'.wav '+ file+'.mp3 2>/dev/null' ):
                  print("Could not convert sound to mp3")
                  manifest['soundDict'][msg['slide']][msg['name']] = {'mp3' : str(msg['name'])}
            else:
                  os.remove(file+'.wav')
                  duration = os.popen('ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 '+file+'.mp3').read()
                  duration = float(duration)
                  print("Successfully converted sound to mp3, of duration "+str(duration))
                  manifest['soundDict'][msg['slide']][msg['name']] = {'file' : str(msg['name']), 'duration' : duration}
            
      #after the message has been processed, we save the manifest file
      f= open(manifestFile,'wb')
      f.write(bytes(dumps(manifest,indent=2),'utf-8'))
      f.close()

      
      
      self.send_dict_response(response)




def serverThread(name):
    print("backend: Starting server")
    httpd = HTTPServer(("127.0.0.1", 8001), RequestHandler)
    print("backend: Hosting server on port 8001")
    httpd.serve_forever()

def webThread(name):
    print("web: Starting server")
    httpd = HTTPServer(("0.0.0.0", 8000), SimpleHTTPRequestHandler)
    print("web: Hosting server on port 8000")
    httpd.serve_forever()    

fileToSave = None
x = threading.Thread(target=serverThread,args=(1,))
x.start()
y = threading.Thread(target=webThread,args=(1,))
y.start()
