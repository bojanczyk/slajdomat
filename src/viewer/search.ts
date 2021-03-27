export {
    initSearch
}





import Fuse from 'fuse.js'
import {  gotoEvent, eventTree, parentEvent } from './event'
import { SlideEvent } from './types'


type SearchKeyword = {
    slide: SlideEvent,
    text: string
}
let search: Fuse<SearchKeyword>

function initSearch(): void {

    
    const allStrings: SearchKeyword[] = [];

    function addStrings(slide : SlideEvent){
        for (const keyword of slide.keywords)
            allStrings.push({ slide: slide, text: keyword });
        for (const child of slide.children)
            addStrings(child);
    }
    addStrings(eventTree);

    search = new Fuse(allStrings, { keys: ['text']});
    document.getElementById('search-input').addEventListener('input', searchType);
}

function searchType(e: Event): void {
    const word = (e.target as HTMLInputElement).value;
    const allResults = document.getElementById('search-results') as HTMLDivElement;

    
    allResults.innerHTML = '';
    for (const result of search.search(word)) {
        const event = result.item.slide;
        let name : string;

        
        //we display the name of the containing slide
        if (event.type == 'child')
            name = event.name;
        else 
            name = parentEvent(event).name;

        const oneResult = document.createElement('div');
        oneResult.classList.add('one-result');
        oneResult.innerHTML = `<div class='search-result-slide'> ${name}</div> <div class='search-result-text'>${result.item.text}</div>`
        oneResult.addEventListener('click', () => {
            gotoEvent(event)} )
        allResults.appendChild(oneResult)

    }


}