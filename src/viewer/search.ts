export {
    initSearch
}





import Fuse from 'fuse.js'
import { PresentationNode } from './types'
import { manifest } from './viewer'
import { afterEventState, gotoState } from './timeline'


type SearchKeyword = {
    slide: PresentationNode,
    text: string
}
let search: Fuse<SearchKeyword>

function initSearch(): void {


    const allStrings: SearchKeyword[] = [];

    function addStrings(slide: PresentationNode) {
        for (const keyword of slide.keywords)
            allStrings.push({ slide: slide, text: keyword });
        if (slide.type == 'child')
            for (const child of slide.children)
                addStrings(child);
    }
    addStrings(manifest.tree);

    search = new Fuse(allStrings, { keys: ['text'] });

    const searchBox = document.getElementById('search-input') as HTMLInputElement;
    searchBox.addEventListener('input', searchType);
    searchBox.addEventListener('keyup',
        e => { if (e.key == 'Escape') { searchBox.value = ''; searchType() } })

}

function searchType(): void {
    const searchBox = document.getElementById('search-input') as HTMLInputElement;
    const word = searchBox.value;
    const allResults = document.getElementById('search-results') as HTMLDivElement;


    allResults.innerHTML = '';
    for (const result of search.search(word)) {
        const event = result.item.slide;
        let name: string;


        //we display the name of the containing slide
        if (event.type == 'child')
            name = event.name;
        else
            name = event.parent.name;

        const oneResult = document.createElement('div');
        oneResult.classList.add('one-result');
        oneResult.innerHTML = `<div class='search-result-slide'> ${name}</div> <div class='search-result-text'>${result.item.text}</div>`
        oneResult.addEventListener('click', () => {
            gotoState(afterEventState(event));
        })
        allResults.appendChild(oneResult)

    }


}