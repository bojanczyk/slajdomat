import { nextButton, prevButton} from "./viewer";

export { timerStart, initPresenterTools, userDefinedKeys, formatTime };

let start: Date;
let interval: number;


let waitingForKey = undefined as () => void;
const userDefinedKeys: { [key: string]: () => void } = {};




function initPresenterTools() {
    function listUserDefinedKeys() {
        let list = '';
        document.getElementById('list-of-key-bindings').innerHTML = '';
        for (let key in userDefinedKeys) {
            if (userDefinedKeys[key] == prevButton)
                list = list + key + ': previous slide <br>';
            if (userDefinedKeys[key] == nextButton)
                list = list + key + ': next slide <br>';
        }
        document.getElementById('list-of-key-bindings').innerHTML = list;
    }






    document.getElementById('timer-button').addEventListener('click', timerStart);


    //scans most recently pressed key to display in the non-standard next/previous key selection from presenter tab
    document.addEventListener("keydown", (event) => {
        if (waitingForKey != undefined) {
            userDefinedKeys[event.key] = waitingForKey;
            waitingForKey = undefined;
            listUserDefinedKeys();
            document.getElementById('press-key-instructions').classList.add('hidden');
        }
    });

    for (const button of document.querySelectorAll('span')) {
        switch (button.id) {
            case 'new-prev-key':
                button.addEventListener('click', event => {
                    waitingForKey = prevButton;
                    document.getElementById('press-key-instructions').classList.remove('hidden');
                })
                break;
            case 'new-next-key':
                button.addEventListener('click', event => {
                    waitingForKey = nextButton;
                    document.getElementById('press-key-instructions').classList.remove('hidden');
                })
                break;
        }
    }
}



 //format the time in minutes and seconds
 function formatTime(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time) % 60;
    if (seconds < 10)
        return minutes + ':0' + seconds
    else
        return minutes + ':' + seconds;
}



function timerStart() {
    const timer = document.getElementById('timer');
    if (interval != undefined) {
        timer.classList.add('hidden');
        clearInterval(interval);
        interval = undefined;
        return;
    }
    else {
        function update() {
            const now = new Date();
            const diff = now.getTime() - start.getTime();
            const seconds = Math.floor(diff / 1000);
            timer.innerHTML = formatTime(seconds);
        }

        start = new Date();
        update();
        timer.classList.remove('hidden');



        interval = setInterval(update, 1000);
    }
}

