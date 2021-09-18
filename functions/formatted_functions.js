const languageLevelConvert = {
    "Beginner (A2)": 1,
    "Intermediate (B1)": 2,
    "Work Proficient (B2)": 3,
    "Fluent (C1)": 4,
    "Native or Bilingual": 5,
}


const toNormalArray = (item) => {
    if (item['arrayValue'] && item['arrayValue']['values'])
        return item['arrayValue']['values']
    else
        return item;
}

const intersect = (a, b) => {
    return a.filter((i) => b.includes(i));
}

const experienceListToRange = (list) => {
    let min;
    let max;
    for (let exp of list) {
        let x1 = parseInt(exp.split('-')[0]);
        let x2 = parseInt(exp.split('-')[1]);
        min = Math.min(x1, x2, min);
        max = Math.max(x1, x2, max);
    }
    return [min, max];
}

const languageComparasion = (filter, candidate) => {
    for (let lang of filter) {
        if (!lang['Language']) // выходим - языки не выбранны
            return true;
        let l = lang['Language'][0];
        let c_l = candidate.filter((i) => i["Language"] == l);
        if (c_l) {
            c_l = c_l[0];
            if (languageLevelConvert[c_l['LanguageLevel']] >= languageLevelConvert[lang["Language"]])
                return true;
        }
    }
    return false;
}

exports.formatted_functions = {
    "toNormalArray": toNormalArray,
    "intersect": intersect,
    "experienceListToRange": experienceListToRange,
    "languageComparasion": languageComparasion,
}