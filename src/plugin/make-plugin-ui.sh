#!/bin/bash
#I tried to use the webpack instructions from https://www.figma.com/plugin-docs/bundling-webpack/ but this did not work, so I do my own script to generate the ui.html file

echo "Putting together the figma plugin files, in the figma-plugin directory" $Out


Out=figma-plugin/ui.html

cp dist/code.js figma-plugin/
cp src/plugin/ui.html $Out
echo "<script>" >> $Out
cat dist/ui.js >> $Out
echo "</script>" >> $Out
echo "<style>" >> $Out
cat src/plugin/ui.css >> $Out
echo "</style>" >> $Out


# Copy the plugin files to the test-slides directory
if [ ! -d test-slides ]; then
    mkdir -p test-slides
    echo "Created directory for testing slides"
fi
cp dist/viewer.js test-slides/
cp src/viewer/slajdomat.html test-slides/index.html



