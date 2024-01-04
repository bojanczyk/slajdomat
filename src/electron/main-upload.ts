export { saveUploadScript, runUploadScript };
import * as child from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { sendMessageToRenderer, sendStatus } from './main';
import { slajdomatSettings } from './main-settings';



//save the upload script in the presentations directory
function saveUploadScript(script: string) {
  try {
    const fileName = path.join(slajdomatSettings.directory, '.gitscript');
    fs.writeFileSync(fileName, script);
    sendStatus('Saved upload script','quick');
  }
  catch (e) {
    sendStatus('failed saving script','upload');
  }
}

function runUploadScript(script: string): void {
  const gitProcess = child.spawn('bash', ['-c', script], { cwd: slajdomatSettings.directory });

  gitProcess.stdout.on('data', function (data) {
    if (data != null)
      for (const line of data.toString().split('\n'))
        sendStatus(line,'upload');
  });

  gitProcess.stderr.on('data', function (data) {
    if (data != null)
    sendStatus(data.toString(),'upload');
  });

  gitProcess.on('exit', function (code) {
    if (code == 0)
    sendStatus('Upload script successful.','upload')
    else
    sendStatus('Upload script failed.','upload')

    sendMessageToRenderer({ type: 'stop-spin' });
  });
}
