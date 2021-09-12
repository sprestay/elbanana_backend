const functions = require("firebase-functions");
const fetch = require('node-fetch');
const admin = require('firebase-admin');
admin.initializeApp();
const candidate = require("./test_user").candidate;
const filter = require('./test_filter').filter;
const ff = require("./formatted_functions").formatted_functions;

var bubble_url = "https://elbanana.com/version-for-ignat/api/1.1/obj/";
var help = "https://elbanana.com/version-for-ignat/api/1.1/meta"; // все ключи, что есть

const config_candidate = {
    "RelatedLanguages": "candidatelanguage",
    "MainCountry": "country",
    "ContactPhoneCode": "country",
    "PreferedRole": "candidateprefrole",
    "PreferedLocation": "candidatepreflocation",
    "PreferedTech": "candidatepreftech",
    "RelatedSchool": "candidateschool",
    "Country": "country",
    // "MainJobSearchStatus": "jobsearchstatus",
    // "MainReadyStart": 'readystartmonth',
    // "MainReadyStartMonth": "ReadyStartMonth",
    // "PreferedContinent": ,
    // "candidateroleexperience",
    "RelatedExperience": "candidateexperience",
    // "JobTypeParttimeHoursMonth":,
}
// Country - возвращает id
// CandidatePrefTech - TechTag (candidateTechList)
// НЕОБХОДИМО ПРОДУМАТЬ ПОИСК ВЛОЖЕННЫХ ДАННЫХ
// (хардкодим - не выдержим изменений в базе. Переделать) - например явно указывает Permanent



// проблема, что не можем использовать option sets
const config_filter = {
    "TechList": "filtertechlist",
    "Languages": "filterlanguage",
    "Roles": "filterrolelist",
    "Skills": "candidateskillslist",
    "CandidateRoleList": "candidaterolelist",
}
// Filter - Roles - list of FilterRoleList - (CandidateRoleList, Experience)
// Candidate - PreferedRole - list of CandidatePrefRoles - (Candidate, ExperienceSelection, ExperienceYear, Role (CandidateRoleList))


// нет смысла сохранять вложенные структуры в отдельные коллекции, так как 
// у каждого пользователя будет уникальный набор ссылок - следовательно один вложенный объект будет
// соотвествовать только одному пользователю
const getSubItem = async (endpoint, item_id, config) => {
    return fetch(`${bubble_url}${endpoint}/${item_id}`)
    .then((res) => res.json())
    .then(async (res) => {
        if (res['response']) {
            var subresult = res['response'];
            return await buildJsonObject(subresult, config).then((res) => { return {"result": "successs", "data": res} }).catch((err) => { return {"result": "error", "desc": "error in recursion"} } );
        } else {
            return {"result": "error", "desc": "res.response produced an error"}
        }
    }).catch((err) => {
        return {"result": "error", "desc": err};
    })
}

const buildJsonObject = async (item, config) => {
    for (let key of Object.keys(item)) {
        if (config[key]) { // получили вложенный объект. Будем создавать под него отдельную коллекцию
            if (Array.isArray(item[key])) { // много вложенных объектов
                var bubble_responses = item[key].map((subitem) => getSubItem(config[key], subitem, config).then((res) => res));
            } else { // единичный объект
                var bubble_responses = [getSubItem(config[key], item[key], config).then(res => res)];
            }

            await Promise.all(bubble_responses).then((bubble) => {
                var errors = bubble.filter((i) => i['result'] == "error");
                if (errors.length == 0) {
                    item[key] = bubble.map((i) => i['data']);
                } else {  // что будет, когда в здесь будет ошибка?
                    console.log("ERROR", `Множественный запрос вернул ${errors.length} ошибку из ${bubble.length}. endpoint: ${config[key]} keys: ${item[key].join(",")}`);
                    response.send({
                        "status": "error",
                        "desc": `Множественный запрос вернул ${errors.length} ошибку из ${bubble.length}. endpoint: ${config[key]} keys: ${item[key].join(",")}`,
                    });
                }
            });                        
        }
    }
    return item;
}


exports.getAllDatabase = functions.https.onRequest(async (request, response) => {
    fetch(bubble_url + "candidate?limit=150")
    .then((res) => res.json())
    .then(async (res) => {
        if (res['response']['results']) {
            var items = res['response']['results'];

            // новый подход
            await Promise.all(items.map(async (item) => {
                await buildJsonObject(item, config_candidate).then(res =>  {
                    item = res
                });
            }));
            items.forEach(async (item) => {
                await admin.firestore().collection('candidate').doc(item['_id']).set(item);
            })
            return {"status": "ok"}
        } else {
            return {"status": "Empty user list"};
        }
    })
    .then((res) => response.send(res))
    .catch((err) => console.log(err));
});

exports.getFilteredCandidates = functions.https.onRequest(async (request, response) => {
    var filter_id = request.query['id'];
    if (!filter_id) {
        response.send({"error": "id is empty"});
        return;
    }
    fetch(`${bubble_url}${"filter"}/${filter_id}`)
    .then((res) => res.json())
    .then((res) => {
        if (res['response']) {
            buildJsonObject(res['response'], config_filter).then((result) => response.send(result));
            return;
        } else {
            response.send("Error! Maybe id is wrong");
            return;
        }
    })
    .catch((err) => response.send("Error occupied! " + err));
});

const filterFunction = (filter=filter, candidate=candidate) => {
    if (filter["CategoryParent"] && (!candidate["CategoryParent"] || ff.intersect(filter["CategoryParent"], candidate["CategoryParent"]).length == 0))
        return false;
    if (filter["CategoryChild"] && (!candidate["CategoryChild"] || ff.intersect(filter["CategoryChild"], candidate["CategoryChild"]).length == 0))
        return false;
    // if (filter["IndustryList"] && )
    if (filter["SearchSubstring"] && !candidate["MainTitle"].toLowerCase().includes(filter['SearchSubstring'].toLowerCase()))
        return false;
    
    // тип работы 
    if (filter['JobType'] == "Permanent" && !candidate["JobTypePermanent"])
        return false;
    if (filter["JobType"] == "Contract" && !candidate["JobTypeContract"])
        return false;
    if (filter["JobType"] == "Internship" && !candidate["JobTypeInternship"])
        return false;
    if (filter["ParttimeAvailable"] && !candidate["JobTypeParttime"])
        return false;
    // if ()

    
}

exports.getCandidateById = functions.https.onRequest(async (request, response) => {
    var candidate_id = request.query['id'];
    const res = await admin.firestore().collection('candidate').doc(candidate_id).get();
    response.send(res.data());
    return;
});