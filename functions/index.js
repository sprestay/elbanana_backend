const functions = require("firebase-functions");
const fetch = require('node-fetch');
const admin = require('firebase-admin');
admin.initializeApp();
// удалить
const candidate = require("./test_data_folders/test_user").candidate;
const filter = require('./test_data_folders/test_filter').filter;
// удалить
const ff = require("./formatted_functions").formatted_functions;

var bubble_url = "https://elbanana.com/version-test/api/1.1/obj/";
var prod_bubble_url = "https://elbanana.com/api/1.1/obj/";
var help = "https://elbanana.com/version-test/api/1.1/meta"; // все ключи, что есть
const bubble_webhook_url = "https://elbanana.com/version-test/api/1.1/wf/hr_search_cand_alert";
const prod_bubble_webhook_url = "https://elbanana.com/api/1.1/wf/hr_search_cand_alert";

const config_candidate = {
    "RelatedLanguages": "candidatelanguage",
    "MainCountry": "country",
    "ContactPhoneCode": "country",
    "PreferedRole": "candidateprefrole",
    "PreferedLocation": "candidatepreflocation",
    "PreferedTech": "candidatepreftech",
    "RelatedSchool": "candidateschool",
    "Country": "country",
    "Role": "candidaterolelist",
    "TechTag": "candidatetechlist",
    "RelatedExperience": "candidateexperience",
}

const config_filter = {
    "TechList": "filtertechlist",
    "Languages": "filterlanguage",
    "Roles": "filterrolelist",
    "CandidateRoleList": "candidaterolelist",
    "TechTag": "candidatetechlist",
    "RelocationCountries": "country",
}

const getSubItem = async (endpoint, item_id, config, is_live=false) => {
    return fetch(`${is_live ? prod_bubble_url : bubble_url}${endpoint}/${item_id}`)
    .then((res) => res.json())
    .then(async (res) => {
        if (res['response']) {
            var subresult = res['response'];
            return await buildJsonObject(subresult, config, is_live).then((res) => { return {"result": "successs", "data": res} }).catch((err) => { return {"result": "error", "desc": "error in recursion"} } );
        } else {
            return {"result": "error", "desc": "res.response produced an error"}
        }
    }).catch((err) => {
        return {"result": "error", "desc": err};
    })
}

const buildJsonObject = async (item, config, is_live=false) => {
    for (let key of Object.keys(item)) {
        if (config[key]) { // получили вложенный объект. Будем создавать под него отдельную коллекцию
            if (Array.isArray(item[key])) { // много вложенных объектов
                var bubble_responses = item[key].map((subitem) => getSubItem(config[key], subitem, config, is_live).then((res) => res));
            } else { // единичный объект
                var bubble_responses = [getSubItem(config[key], item[key], config, is_live).then(res => res)];
            }

            await Promise.all(bubble_responses).then((bubble) => {
                var errors = bubble.filter((i) => i['result'] == "error");
                if (errors.length == 0) {
                    item[key] = bubble.map((i) => i['data']);
                } else {  // что будет, когда в здесь будет ошибка?
                    console.log("ERROR", `Множественный запрос вернул ${errors.length} ошибку из ${bubble.length}. endpoint: ${config[key]} keys: ${item[key].join(",")}`);
                    // response.send({
                    //     "status": "error",
                    //     "desc": `Множественный запрос вернул ${errors.length} ошибку из ${bubble.length}. endpoint: ${config[key]} keys: ${item[key].join(",")}`,
                    // });
                }
            });                        
        }
    }
    return item;
}


exports.getAllDatabase = functions.https.onRequest(async (request, response) => {
    var query = [request.query.limit ? request.query.limit : '', request.query.cursor ? request.query.cursor : ''];
    var is_live = request.get('Referer') == "yes" ? true : false;
    query = query.filter((i) => i != '');
    fetch((is_live ? prod_bubble_url : bubble_url) + "candidate?" + query.join("&"))
    .then((res) => res.json())
    .then(async (res) => {
        if (res['response']['results']) {
            var items = res['response']['results'];

            // новый подход
            await Promise.all(items.map(async (item) => {
                await buildJsonObject(item, config_candidate, is_live).then(res =>  {
                    item = res
                });
            }));
            items.forEach(async (item) => {
                await admin.firestore().collection(is_live ? "live_candidate" : 'candidate').doc(item['_id']).set(item);
            })
            return {"status": "ok"}
        } else {
            return {"status": "Empty user list"};
        }
    })
    .then((res) => response.send(res))
    .catch((err) => console.log(err));
});

exports.addNewCandidate = functions.https.onRequest(async (request, response) => {
    if (request.method != "POST") {
        response.send({"error": "Request is not permitted"});
        return;
    }
    var is_live = request.get('Referer') == "yes" ? true : false;
    var user_id = request.body['user_id'];
    fetch(`${is_live ? prod_bubble_url : bubble_url}${"candidate"}/${user_id}`)
    .then((res) => res.json())
    .then((res) => {
        if (res['response']) {
            buildJsonObject(res['response'], config_candidate, is_live)
            .then(async (result) => await admin.firestore().collection(is_live ? "live_candidate" : 'candidate').doc(user_id).set(result))
            .then((res) => response.send({"result": "added"}))
            .catch((err) => response.send({"error" : err}));
            return;
        } else {
            response.send("Error! Maybe id is wrong");
            return;
        }
    })
    .catch((err) => response.send("Error occupied! " + err));
});

const snapshot_to_json = (snapshot) => {
    var res = {};
    snapshot.forEach((doc) => {
        res[doc.id] = doc.data();
    });
    return res;
}

exports.getFilteredCandidates = functions.https.onRequest(async (request, response) => {
    var filter_id = request.body['id'];
    var is_live = request.get('Referer') == "yes" ? true : false;
    if (!filter_id) {
        response.send({"error": "id is empty"});
        return;
    }
    if (typeof request.body == "string")
        request.body = JSON.parse(request.body);

    try {
        var data = request.body['ids'];
        data = data.split(", ");
        if (!data) {
            response.send({"error": "list of ids is empty"});
            return;
        }
    } catch (err) {
        functions.logger.log("ERROR, ", err);
        response.send({"error": "error parsing ids_list"});
        return;
    }
    
    fetch(`${is_live ? prod_bubble_url : bubble_url}${"filter"}/${filter_id}`)
    .then((res) => res.json())
    .then((res) => {
        if (res['response']) {
            buildJsonObject(res['response'], config_filter, is_live)
            .then(async (result_filter) => {
                const db = await admin.firestore().collection(is_live ? "live_candidate" : 'candidate');
                const currency_rate_table = await admin.firestore().collection("CurrencyRate");

                var promises = data.map(async (e) => await db.doc(e).get()
                    .then((snapshot) => {
                        if (snapshot.empty)
                            return null;
                        else
                            return snapshot.data();
                    })
                    .catch((err) => {
                        console.log("error extracting cands from db");
                        return null;
                    })
                );
                promises = await Promise.all(promises);
                var items = promises.filter((e) => e != null);
                if (items.length == 0) {
                    response.send({"result" : "OK", "items": []});
                    return;
                }

                var currency_snapshot = await currency_rate_table.get();
                if (currency_snapshot.empty) {
                    functions.logger.log("Currency table is empty");
                }
                var currencies = {};
                try {
                    currencies = snapshot_to_json(currency_snapshot);
                } catch (e) {
                    functions.logger.log("Функция snapshot_to_json вернула ошибку");
                }

                functions.logger.log("Всего items - ", items.length);
                step1 = step2 = step3 = step4 = step5 = step6 = 0;//
                var filtered = items.filter((i) => filterFunction(result_filter, i, currencies)).map((i) => i['_id']);
                functions.logger.log(step1, step2, step3, step4, step5, step6);
                response.send({"result": "OK", "items": filtered});
            })
            .catch((err) => {
                functions.logger.log("GOT AN ERROR", err);
                response.send({"result": "error"})
            });
        } else {
            response.send({"result": "error", "desc" : "Error! Maybe id is wrong"});
            return;
        }
    })
    .catch((err) => response.send({"result": "error", "desc" : "Error occupied! " + err}));
});

var step1 = 0;
var step2 = 0;
var step3 = 0;
var step4 = 0;
var step5 = 0;
var step6 = 0;

const filterFunction = (filter=filter, candidate=candidate, currencies) => {
    
    if (ff.listToBool(filter["CategoryParent"]) && (!ff.listToBool(candidate["CategoryParent"]) || ff.intersect(filter["CategoryParent"], candidate["CategoryParent"]).length == 0))
        return false;
    if (ff.listToBool(filter["CategoryChild"]) && (!ff.listToBool(candidate["CategoryChild"]) || ff.intersect(filter["CategoryChild"], candidate["CategoryChild"]).length == 0))
        return false;
    if (ff.listToBool(filter["IndustryList"]) && (!ff.listToBool(candidate['IndustryReady']) || ff.intersect(filter["IndustryList"], candidate["IndustryReady"]).length == 0))
        return false;
    // if (filter["SearchSubstring"] && (!candidate['MainTitle'] || !candidate["MainTitle"].toLowerCase().includes(filter['SearchSubstring'].toLowerCase())))
    //     return false;
    
    step1++;
    // тип работы 
    if (filter['JobType'] == "Permanent" && !candidate["JobTypePermanent"])
        return false;
    if (filter["JobType"] == "Contract" && !candidate["JobTypeContract"])
        return false;
    if (filter["JobType"] == "Internship" && !candidate["JobTypeInternship"])
        return false;
    if (filter["ParttimeAvailable"] && !candidate["JobTypeParttime"])
        return false;
    if (filter["ParttimeHours"] && (!candidate["ParttimeHours"] || filter["ParttimeHours"] <= parseInt(candidate["ParttimeHours"])))
        return false;
    step2++;

    // Filter -> Roles -> (CandidateRoleList[0], Experience)    Candidate - RelatedExperience (list) -> Role или PreferedRole -> Role
    if (!ff.rolesComparasion(filter, candidate))
        return false;
    
    var cand_exp = candidate["ExperienceTotalYears"];
    if (ff.listToBool(filter["ExperienceYears"]) && (!cand_exp || cand_exp < ff.experienceListToRange(filter["ExperienceYears"][0])[0]))
        return false;
    
    if (!ff.techListComparasion(filter, candidate))
        return false;
    
    // TechList в фильтре, кандидат - RelatedExperience -> Technology -> 
    if (!ff.languageComparasion(filter["Languages"], candidate["RelatedLanguages"]))
        return false;
    step3++;    
    // локация
    // filter - PreferedLocation, SearchRadius, 
    // filter -- JobLocation - On-site & Remote, On-site, 
    if (!ff.preferedLocationComparasion(filter, candidate))
        return false;
    step4++;

    if (!ff.salaryComparasion(filter, candidate, currencies))
        return false;
    step5++;

    if (filter['ActivelyLookingForJob'] == true && (!candidate['MainJobSearchStatus'] || candidate['MainJobSearchStatus'] != "Actively looking for a job")) {
        return false;
    }
    // остальные фильтры
    if (!ff.searchcandidatelocation(filter, candidate))
        return false;
    step6++;
    return true;
    
}

exports.getCandidateById = functions.https.onRequest(async (request, response) => {
    var candidate_id = request.query['id'];
    var is_live = request.get('Referer') == "yes" ? true : false;
    const res = await admin.firestore().collection(is_live ? "live_candidate" : 'candidate').doc(candidate_id).get();
    response.send(res.data());
    return;
});


exports.saveFilterToDB = functions.https.onRequest(async (request, response) => {
    var is_live = request.get('Referer') == "yes" ? true : false;
    if (request.method != "POST") {
        response.send({"error": "Request is not permitted"});
        return;
    }
    var filter_id = request.body['filter_id'];
    fetch(`${is_live ? prod_bubble_url : bubble_url}${"filter"}/${filter_id}`)
    .then((res) => res.json())
    .then((res) => {
        if (res['response']) {
            buildJsonObject(res['response'], config_filter, is_live)
            .then(async (result) => await admin.firestore().collection(is_live ? "live_filters" : 'filters').doc(filter_id).set(result))
            .then((res) => response.send({"result": "added"}))
            .catch((err) => response.send({"error" : err}));
            return;
        } else {
            response.send("Error! Maybe id is wrong");
            return;
        }
    })
    .catch((err) => response.send("Error occupied! " + err));
});

exports.deleteFilterToDB = functions.https.onRequest(async (request, response) => {
    var is_live = request.get('Referer') == "yes" ? true : false;
    if (request.method != "POST") {
        response.send({"error": "Request is not permitted"});
        return;
    }
    var filter_id = request.body['filter_id'];
    try {
        await admin.firestore().collection(is_live ? "live_filters": 'filters').doc(filter_id).delete();
        response.send("successfully deleted");
    } catch (e) {
        response.send("got an error");
        functions.logger.log("Error", e);
        response.send("error");
    }
});

const webhookBubble = async (url, user_id, filter_id) => {
    fetch(url, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "user_id": user_id,
            "filter_id": filter_id
        })
    }).then((res) => res.json()).then((res) => console.log("Result of bubble webhook", res)).catch((err) => console.log("Error fetching bubble endpoint", err));
}


exports.filtersAlert = functions.firestore.document('candidate/{user_id}').onCreate(async (snap, context) => {
    functions.logger.log("Функция onCreate")
    var candidate = snap.data();
    const db = await admin.firestore().collection('filters');
    var snapshot = await db.get();
    if (snapshot.empty) {
        return;
    }
    var filters = [];
    snapshot.forEach((d) => {
        var filter = d.data();
        let compare_result = filterFunction(filter, candidate);
        if (compare_result) {
            filters.push({"user_id": candidate['_id'], "filter_id": filter['_id']});
        }
    });
    if (filters.length) {
        var tasks = filters.map((i) => webhookBubble(bubble_webhook_url, i['user_id'], i['filter_id']));
        await Promise.all(tasks);
        functions.logger.log("Дождались выполнения await Promise.all");
    }
});

exports.prodFiltersAlert = functions.firestore.document('live_candidate/{user_id}').onCreate(async (snap, context) => {
    functions.logger.log("Функция onCreate")
    var candidate = snap.data();
    const db = await admin.firestore().collection('live_filters');
    var snapshot = await db.get();
    if (snapshot.empty) {
        return;
    }
    var filters = [];
    snapshot.forEach((d) => {
        var filter = d.data();
        let compare_result = filterFunction(filter, candidate);
        if (compare_result) {
            filters.push({"user_id": candidate['_id'], "filter_id": filter['_id']});
        }
    });
    if (filters.length) {
        var tasks = filters.map((i) => webhookBubble(prod_bubble_webhook_url, i['user_id'], i['filter_id']));
        await Promise.all(tasks);
        functions.logger.log("Дождались выполнения await Promise.all");
    }
});


exports.dropEmptyVals = functions.https.onRequest(async (request, response) => {
    if (request.method != "POST") {
        response.send({"error": "Request is not permitted"});
        return;
    }
    var is_live = request.get('Referer') == "yes" ? true : false;
    var filter_id = request.body['filter_id'];
    fetch(`${is_live ? prod_bubble_url : bubble_url}${"filter"}/${filter_id}`).then((res) => res.json()).then((res) => { 
        if (res['response']) {
            buildJsonObject(res['response'], config_filter).then((r) => response.send(r)).catch((e) => response.send("error"));
            return;
        } else {
            response.send("In is wrong");
            return;
        }
    }).catch((err) => response.send("Error occupied! " + err));
});

async function getTemplate() {
    const config = admin.remoteConfig();
    return await config.getTemplate()
        .then(template => {
            console.log('ETag from server: ' + template.etag);
            const templateStr = JSON.stringify(template);
            return templateStr;
        })
        .catch(err => {
            console.error('Unable to get template');
            console.error(err);
            return null;
        });
}

exports.testGetRemoteConfig = functions.https.onRequest(async (request, response) => {
    var result = await getTemplate();
    response.send(result);
    return;
})

exports.testGetUrl = functions.https.onRequest(async (request, response) => {
    var is_live = request.get('Referer') == "yes" ? true : false;
    response.send(is_live ? prod_bubble_url : bubble_url);
    return;
})