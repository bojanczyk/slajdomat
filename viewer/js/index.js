var manifest;

fetch('presentations.json')
.then(res => { 
    if (!(res.ok))
    throw "not connected";
else
    return res.json();
})
.then(j => {
    document.getElementById('index-title').classList.remove('hidden');
    manifest = j;
    var ul = document.getElementById("slide-list");
for (const i of Object.keys(manifest)) 
{
    var li = document.createElement("a");
    li.href="viewer.html?slides="+encodeURI(i)
    li.id=i;
    li.innerHTML = i;
    ul.appendChild(li);
    
    console.log(i);
}
}).catch( (e) => 
    document.getElementById('no-pre').classList.remove('hidden')
    )

