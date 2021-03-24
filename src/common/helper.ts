export {freshName, sanitize}

//gives a name, starting with base, which is not on the avoid list
function freshName(base: string, avoid : string[]) : string {
    let candidate = base;
    if (avoid.indexOf(candidate) > -1) 
    {
        //we need to decorate the name;
        let index = 2;
        
        do {
            candidate = base+index.toString();
            index++;
        } while (avoid.indexOf(candidate) > -1 )
        
    }
     
    return candidate;
}

//sanitize a string so that it is a good filename 
function sanitize(s: string) : string {
    return encodeURI(s).replace(/:/g, "_").replace(/%20/g, '_').replace(/%/g, '_');
}
