
const lifiApiUrl = 'https://li.quest/v1/tokens';
const squidApiUrl = 'https://api.0xsquid.com/v1/tokens'

export const getTokenList =async (chainID: string) => {
    const temp: string[] = []
    const response = await fetch(lifiApiUrl);
    let lifiTokenLIst = await response.json()

    for(let i = 0; i < lifiTokenLIst.tokens[chainID].length; i ++){
        temp.push(lifiTokenLIst.tokens[chainID][i].address)
    }

    const response1 = await fetch(squidApiUrl)
    let squidTokenLIst = await response1.json()

    for(let i = 0 ; i < squidTokenLIst.tokens.length; i ++){
        if(squidTokenLIst.tokens[i].chainId == chainID)  temp.push(squidTokenLIst.tokens[i].address)
    }
    const uniqueArray = temp.filter(function(elem, pos) {
        return temp.indexOf(elem) == pos;
    })

    return uniqueArray
}

