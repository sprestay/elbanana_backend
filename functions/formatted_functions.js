const toNormalArray = (item) => {
    if (item['arrayValue'] && item['arrayValue']['values'])
        return item['arrayValue']['values']
    else
        return item;
}

const intersect = (a, b) => {
    return a.filter((i) => b.includes(i));
}




exports.formatted_functions = {
    "toNormalArray": toNormalArray,
    "intersect": intersect,
}