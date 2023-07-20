import { ethers } from "hardhat";

const lifiApiUrl = 'https://li.quest/v1/tokens';
const squidApiUrl = 'https://api.0xsquid.com/v1/tokens'

export const getTokenList =async (chainID: string) => {
    const temp: string[] = []
    const response = await fetch(lifiApiUrl);
    let lifiTokenLIst = await response.json()

    for(let i = 0; i < lifiTokenLIst.tokens[chainID].length; i ++){
        if(ethers.utils.isAddress(lifiTokenLIst.tokens[chainID][i].address))
            temp.push(lifiTokenLIst.tokens[chainID][i].address)
    }

    const response1 = await fetch(squidApiUrl)
    let squidTokenLIst = await response1.json()

    for(let i = 0 ; i < squidTokenLIst.tokens.length; i ++){
        if(squidTokenLIst.tokens[i].chainId == chainID) 
            if(squidTokenLIst.tokens[i].address) temp.push(squidTokenLIst.tokens[i].address)
    }
    
    const uniqueArray = temp.filter(function(elem, pos) {
        return temp.indexOf(elem) == pos;
    })

    return removeZeroAddress(uniqueArray)
}

const removeZeroAddress = (uniqueArray: Array<string>) =>{
    for(let i = 0; i < uniqueArray.length; i ++){
        if(uniqueArray[i] == "0x0000000000000000000000000000000000000000" || uniqueArray[i] ==  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"){
            if (i > -1) {
                uniqueArray.splice(i, 1);
            }
        }
    }
    return uniqueArray
}
