/*
this code manages the upload scripts, which are user created scripts for uploading their presentations to their web pages, e.g. by synchronising using git. The appropriate script is stored in the file .gitscript in the presentations directoryŚ
*/

export { saveUploadScript, runUploadScript };
import * as child from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { sendMessageToRenderer, sendStatus } from './main';
import { slajdomatSettings } from './main-settings';
import { send } from 'process';



//save the upload script in the presentations directory
function saveUploadScript(script: string) {
  try {
    const fileName = path.join(slajdomatSettings.directory, '.gitscript');
    fs.writeFileSync(fileName, script);
    sendStatus('Saved upload script', 'quick');
  }
  catch (e) {
    sendStatus('failed saving script', 'upload');
  }
}

function runUploadScript(script: string): void {

  gitUpload();
  return;

  const gitProcess = child.spawn('bash', ['-c', script], { cwd: slajdomatSettings.directory });

  gitProcess.stdout.on('data', function (data) {
    if (data != null)
      for (const line of data.toString().split('\n'))
        sendStatus(line, 'upload');
  });

  gitProcess.stderr.on('data', function (data) {
    if (data != null)
      sendStatus(data.toString(), 'upload');
  });

  gitProcess.on('exit', function (code) {
    if (code == 0)
      sendStatus('Upload script successful.', 'upload')
    else
      sendStatus('Upload script failed.', 'upload')

    sendMessageToRenderer({ type: 'stop-spin' });
  });
}


function gitUpload() {

  function allowedFile( file : string) {
    return !file.startsWith('comments/');
  }

  function runShell( command : string ) {
    try {
      const output = child.execSync(command, { encoding: 'utf8' });
      for (const line of output.split('\n')) {
        sendStatus(line, 'upload');
      }
    } catch (err) {
      sendStatus('Error: ' + err, 'upload');
    }
  }

  const directoryPath = slajdomatSettings.directory; // replace with your directory path


  try {
    // get all untracked files
    const gitLsFilesOutput = child.execSync('git -C ' + directoryPath + ' ls-files --others --exclude-standard', { encoding: 'utf8' });
    const untrackedFiles = gitLsFilesOutput.split('\n').filter(Boolean); // filter out empty strings

    // add all untracked files to git
    for (const untrackedFile of untrackedFiles) {
      if (allowedFile(untrackedFile)){
        runShell('git -C ' + directoryPath + ' add ' + untrackedFile);
      }
    }

    // get all modified files
    const gitDiffOutput = child.execSync('git -C ' + directoryPath + ' diff --name-only', { encoding: 'utf8' });
    const changedFiles = gitDiffOutput.split('\n').filter(Boolean); // filter out empty strings

    for (const changedFile of changedFiles) {
      if (allowedFile(changedFile)){
        runShell('git -C ' + directoryPath + ' add ' + changedFile);
      }
    }
  } catch (err) {
    console.error(`Error: ${err}`);
  }

}