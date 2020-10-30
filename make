rm -rf production
mkdir production
cd viewer/
pkg server.js
cp -r built ../production/
cp -r css ../production/
cp -r img ../production/
cp index.html ../production/
cp viewer.html ../production/
cp server.js ../production/
cp server-* ../production
cp favicon.png ../production/
cd ../
